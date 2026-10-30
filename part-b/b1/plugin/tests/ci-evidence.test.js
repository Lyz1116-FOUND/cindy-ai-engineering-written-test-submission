import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitHubClient} from '../github.js';

const repository = 'example/project', sha = 'a'.repeat(40);
const response = (body, status = 200, extra = {}) => ({ok:true, status, headers:{}, body:typeof body === 'string' ? body : JSON.stringify(body), ...extra});
const run = (id = 201, extra = {}) => ({id, head_sha:sha, run_attempt:1, conclusion:'failure', ...extra});
const job = (id = 301, extra = {}) => ({id, head_sha:sha, name:'plugin', conclusion:'failure', check_run_url:`https://api.github.com/repos/${repository}/check-runs/101`, steps:[{number:6,name:'Sample',conclusion:'failure'}], ...extra});
function fixture({runs = [run()], jobs = [job()], checkIds = [101], log = '##[error] build failed\n##[error] Process completed with exit code 1.', logStatus = 200, hostTruncated = false} = {}) {
  const calls = [];
  const client = new GitHubClient(async req => {
    const url = new URL(req.url); calls.push(url.pathname);
    if(url.pathname.endsWith('/pulls/7')) return response({number:7, state:'open', title:'Build', head:{sha,ref:'fix'}, base:{ref:'main',repo:{full_name:repository}}});
    if(url.pathname.endsWith('/check-runs')) return response({total_count:checkIds.length,check_runs:checkIds.map(id=>({id, head_sha:sha, name:'plugin', status:'completed', conclusion:'failure'}))});
    if(url.pathname.endsWith('/statuses')) return response([]);
    if(url.pathname.endsWith('/actions/runs')) return response({total_count:runs.length,workflow_runs:runs});
    if(url.pathname.endsWith('/jobs')) return response({total_count:jobs.length,jobs});
    if(url.pathname.endsWith('/logs')) return response(log,logStatus,{truncated:hostTruncated});
    throw Error('Unexpected request: '+url.pathname);
  });
  return {collect:() => client.collectEvidence(repository,7,sha), calls};
}

test('日志：成功测试的 fail 0 不挤掉末尾 runner 错误和退出码', async () => {
  const log = Array.from({length:20},(_,i)=>`suite ${i}\n# fail 0\nall done`).join('\n')+'\n##[error] ACTUAL_COMPILER_ERROR\n##[error] Process completed with exit code 1.';
  const e = await fixture({log}).collect();
  assert.match(e.jobs[0].log.excerpt,/ACTUAL_COMPILER_ERROR/);
  assert.match(e.jobs[0].log.excerpt,/Process completed with exit code 1/);
});
test('日志：大量错误和长行下仍保留最后退出错误，并遵守 2000 字节预算', async () => {
  const log = Array.from({length:30},(_,i)=>`##[error] earlier-${i} ${'x'.repeat(500)}`).join('\n')+'\n##[error] FINAL_DIAGNOSTIC\n##[error] Process completed with exit code 1.';
  const e = await fixture({log}).collect(), summary=e.jobs[0].log;
  assert.match(summary.excerpt,/FINAL_DIAGNOSTIC/);
  assert.match(summary.excerpt,/Process completed with exit code 1/);
  assert.ok(new TextEncoder().encode(summary.excerpt).length<=2000);
  assert.equal(summary.truncated,true);
});
test('日志：末尾只有成功汇总时仍优先保留真实 runner 错误', async () => {
  const e=await fixture({log:'##[error] ORIGINAL_ERROR\n'+'# fail 0\n'.repeat(100)}).collect();
  assert.match(e.jobs[0].log.excerpt,/ORIGINAL_ERROR/);
});
test('日志：无错误时选末尾，宿主截断保持可见', async () => {
  const e=await fixture({log:Array.from({length:70},(_,i)=>`line ${i}`).join('\n'),hostTruncated:true}).collect();
  assert.match(e.jobs[0].log.excerpt,/line 69/);
  assert.doesNotMatch(e.jobs[0].log.excerpt,/1: line 0\n/);
  assert.equal(e.jobs[0].log.totalLines,70);
  assert.equal(e.jobs[0].log.truncated,true);
});
test('日志：脱敏在摘录前执行，不泄漏 token 和签名参数', async () => {
  const e=await fixture({log:'##[error] github_pat_FAKE_TEST_SECRET https://example.com/?token=FAKE_SIGNED_VALUE'}).collect();
  assert.doesNotMatch(e.jobs[0].log.excerpt,/FAKE_TEST_SECRET|FAKE_SIGNED_VALUE/);
  assert.equal(e.jobs[0].log.redacted,true);
});
test('日志：403 保留失败步骤和精确缺口', async () => {
  const e=await fixture({logStatus:403}).collect();
  assert.equal(e.jobs[0].failedSteps[0].number,6);
  assert.equal(e.jobs[0].log.unavailable.code,'FORBIDDEN');
  assert.ok(e.missing.some(m=>m.source==='job 301 logs'));
});
for(const [label,checkURL] of [
  ['历史 check','https://api.github.com/repos/example/project/check-runs/99'],
  ['缺少 check URL',null],
  ['其他仓库','https://api.github.com/repos/other/project/check-runs/101'],
  ['非 API 主机','https://example.com/repos/example/project/check-runs/101'],
]) test(`映射：${label} 的失败 job 不混入当前失败证据`, async () => {
  const f=fixture({jobs:[job(301,{check_run_url:checkURL})]}), e=await f.collect();
  assert.deepEqual(e.jobs,[]);
  assert.ok(e.missing.some(m=>m.code==='CHECK_WITHOUT_ACTIONS_JOB'));
  assert.ok(f.calls.every(p=>!p.endsWith('/logs')));
});
test('映射：run 尚未结束时，也能收集已经失败的当前 check/job', async () => {
  const e=await fixture({runs:[run(201,{status:'in_progress',conclusion:null})]}).collect();
  assert.equal(e.jobs.length,1);
  assert.equal(e.jobs[0].checkId,101);
});
test('映射：同 SHA 的旧失败 job 和当前失败 job 只保留后者', async () => {
  const f=fixture({jobs:[job(300,{check_run_url:'https://api.github.com/repos/example/project/check-runs/99'}),job()]}), e=await f.collect();
  assert.deepEqual(e.jobs.map(j=>j.id),[301]);
  assert.ok(f.calls.every(p=>!p.includes('/jobs/300/logs')));
});
test('映射：不同 SHA 的 job 明确记缺口，不取日志', async () => {
  const f=fixture({jobs:[job(301,{head_sha:'b'.repeat(40)})]}), e=await f.collect();
  assert.deepEqual(e.jobs,[]);
  assert.ok(e.missing.some(m=>m.code==='JOB_SHA_MISMATCH'));
  assert.ok(f.calls.every(p=>!p.endsWith('/logs')));
});
test('映射：非法 run/job ID 不构造日志请求', async () => {
  const badRun=fixture({runs:[run(-1)]});
  const a=await badRun.collect();
  assert.ok(a.missing.some(m=>m.code==='INVALID_RUN_ID'));
  assert.ok(badRun.calls.every(p=>!p.includes('/runs/-1/')));
  const badJob=fixture({jobs:[job(-1)]}), b=await badJob.collect();
  assert.ok(b.missing.some(m=>m.code==='INVALID_JOB_ID'));
  assert.ok(badJob.calls.every(p=>!p.includes('/jobs/-1/')));
});
test('日志：多字节长行不超预算，仍可找到末尾诊断', async () => {
  const e=await fixture({log:'##[error] '+'错误😀'.repeat(2000)+'\n##[error] LAST_ERROR'}).collect();
  assert.match(e.jobs[0].log.excerpt,/LAST_ERROR/);
  assert.ok(new TextEncoder().encode(e.jobs[0].log.excerpt).length<=2000);
  assert.equal(e.jobs[0].log.truncated,true);
});
test('日志：没有 runner 标记时保留普通编译失败信息', async () => {
  const e=await fixture({log:'# fail 0\n'.repeat(20)+'compiler: error TS1234\ncompilation failed'}).collect();
  assert.match(e.jobs[0].log.excerpt,/error TS1234/);
  assert.match(e.jobs[0].log.excerpt,/compilation failed/);
});
test('映射：整个 run 成功也不遮蔽被允许失败的当前 job', async () => {
  const e=await fixture({runs:[run(201,{conclusion:'success'})]}).collect();
  assert.equal(e.jobs[0].id,301);
});
test('采集上限：超过 5 个同 SHA run 时明确报告缺口', async () => {
  const f=fixture({runs:Array.from({length:6},(_,i)=>run(201+i)),jobs:[]}), e=await f.collect();
  assert.ok(e.missing.some(m=>m.code==='RUN_LIMIT'));
  assert.ok(f.calls.every(p=>!p.includes('/runs/206/')));
});
test('采集上限：超过 8 个当前失败 job 时保留未覆盖 check 的缺口', async () => {
  const checkIds=Array.from({length:9},(_,i)=>101+i);
  const jobs=checkIds.map((checkId,i)=>job(301+i,{check_run_url:`https://api.github.com/repos/${repository}/check-runs/${checkId}`}));
  const f=fixture({checkIds,jobs}), e=await f.collect();
  assert.equal(e.jobs.length,8);
  assert.ok(e.missing.some(m=>m.code==='JOB_LIMIT'));
  assert.ok(e.missing.some(m=>m.code==='CHECK_WITHOUT_ACTIONS_JOB'&&m.message.includes('109')));
  assert.ok(f.calls.every(p=>!p.includes('/jobs/309/logs')));
});
