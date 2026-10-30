import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitHubClient} from '../github.js';

const sha='a'.repeat(40), repository='example/project';
const pr={repository,number:7,headSHA:sha};
const response=(body,status=200)=>({ok:true,status,body:JSON.stringify(body),headers:{}});
const check=(id,runId,conclusion='success',extra={})=>({id,head_sha:sha,name:'plugin',status:conclusion===null?'in_progress':'completed',conclusion,app:{id:15368,slug:'github-actions'},details_url:`https://github.com/${repository}/actions/runs/${runId}/job/${id}`,check_suite:{id:runId},...extra});
const run=(id,run_number,extra={})=>({id,workflow_id:501,run_number,head_sha:sha,event:'pull_request',head_branch:'fix',pull_requests:[{number:7}],...extra});
function fixture(checks,runs,{status=200}={}) {
  const calls=[];
  const client=new GitHubClient(async req=>{
    const u=new URL(req.url);calls.push(u.pathname);
    if(u.pathname.endsWith('/check-runs'))return response({total_count:checks.length,check_runs:checks});
    if(u.pathname.endsWith('/statuses'))return response([]);
    if(u.pathname.endsWith('/actions/runs'))return response({total_count:runs.length,workflow_runs:runs},status);
    throw Error('Unexpected '+u.pathname);
  });
  return {read:()=>client.getCI(pr),calls};
}
test('同 SHA 多轮检查：旧失败不覆盖同 workflow 最新通过',async()=>{
  const ci=await fixture([check(103,203),check(102,202,'failure'),check(101,201)],[run(203,3),run(202,2),run(201,1)]).read();
  assert.equal(ci.state,'passed');
  assert.deepEqual(ci.checks.map(c=>c.id),[103]);
  assert.equal(ci.supersededCheckCount,2);
});
test('同 SHA 多轮检查：最新运行中不被旧失败覆盖',async()=>{
  const ci=await fixture([check(102,202,null),check(101,201,'failure')],[run(202,2),run(201,1)]).read();
  assert.equal(ci.state,'running');
  assert.deepEqual(ci.checks.map(c=>c.id),[102]);
});
test('不同 workflow 的同名检查保持独立，不隐藏其中的失败',async()=>{
  const ci=await fixture([check(102,202),check(101,201,'failure')],[run(202,2),run(201,1,{workflow_id:502})]).read();
  assert.equal(ci.state,'failed');assert.equal(ci.checks.length,2);
  assert.equal(ci.supersededCheckCount,0);
});
test('同 workflow 不同事件的同名检查保持独立',async()=>{
  const ci=await fixture([check(102,202),check(101,201,'failure')],[run(202,2),run(201,1,{event:'push',pull_requests:[]})]).read();
  assert.equal(ci.state,'failed');assert.equal(ci.checks.length,2);
});
test('同 workflow 不同 PR 的同名检查保持独立',async()=>{
  const ci=await fixture([check(102,202),check(101,201,'failure')],[run(202,2),run(201,1,{pull_requests:[{number:8}]})]).read();
  assert.equal(ci.state,'failed');assert.equal(ci.checks.length,2);
});
test('矩阵 job 名称分别取最新一轮，不跨名称去重',async()=>{
  const ci=await fixture([check(104,202,'success',{name:'plugin (22)'}),check(103,202,'success',{name:'plugin (20)'}),check(102,201,'failure',{name:'plugin (22)'}),check(101,201,'failure',{name:'plugin (20)'})],[run(202,2),run(201,1)]).read();
  assert.equal(ci.state,'passed');assert.equal(ci.checks.length,2);assert.equal(ci.supersededCheckCount,2);
});
test('无法读取 run 元数据时保留重复检查并说明歧义，不能猜成通过',async()=>{
  const ci=await fixture([check(102,202),check(101,201,'failure')],[],{status:403}).read();
  assert.equal(ci.complete,false);assert.equal(ci.checks.length,2);
  assert.ok(ci.warnings.some(w=>w.code==='CHECK_HISTORY_UNRESOLVED'));
});
test('run 元数据缺失或不完整时只保留证据，不把缺失项当成过期',async()=>{
  const ci=await fixture([check(102,202),check(101,201,'failure')],[run(202,2)]).read();
  assert.equal(ci.complete,false);assert.equal(ci.checks.length,2);
  assert.ok(ci.warnings.some(w=>w.code==='CHECK_HISTORY_UNRESOLVED'));
});
test('没有同名重复检查时不额外要求 Actions 权限',async()=>{
  const f=fixture([check(101,201)],[],{status:403}), ci=await f.read();
  assert.equal(ci.state,'passed');assert.equal(ci.complete,true);
  assert.ok(f.calls.every(p=>!p.endsWith('/actions/runs')));
});
