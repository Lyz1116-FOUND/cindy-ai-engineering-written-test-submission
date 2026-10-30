/**
 * 测试价值：通过生产 GitHubClient / Handoff / StateStore / router 入口验证任务说明 §4–5。
 * 本插件为新领域，无相邻覆盖。最小风险输入为空检查、ok:true/401、分页第二页失败、
 * head 在采集后变化、宿主已受理但 ACK 丢失、重复 reqId。tier: unit，进程内假 HTTP/任务/存储，
 * 不访问业务网络、真实账号或凭证，不做真实等待。实测耗时见 README。
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GitHubClient,aggregateCI,redact} from '../github.js';
import {Handoff,evidencePrompt} from '../handoff.js';
import {StateStore} from '../state.js';
import {createRouter,createRequester} from '../transport.js';
const sha='a'.repeat(40),nextSHA='b'.repeat(40),repository='example/project';
const pr={repository,number:7,title:'Fix build',url:'https://github.com/example/project/pull/7',headSHA:sha,headBranch:'fix',baseBranch:'main',state:'open'};
const rawPR=s=>({number:7,title:'Fix build',head:{sha:s,ref:'fix'},base:{ref:'main',repo:{full_name:repository}},state:'open'});
const check=(conclusion='failure')=>({id:101,head_sha:sha,name:'build',status:'completed',conclusion,app:{slug:'github-actions'},html_url:'https://github.com/example/project/runs/101',output:{summary:'Build failed'}});
const response=(data,status=200,extra={})=>({ok:true,status,body:typeof data==='string'?data:JSON.stringify(data),headers:{},...extra});
function proxy(routes){const calls=[];const fn=async req=>{calls.push(req);const u=new URL(req.url);return routes(u,req,calls);};fn.calls=calls;return fn;}
const evidence=()=>({schema:1,pr,ci:{checks:[check()],statuses:[],state:'failed',complete:true,warnings:[]},jobs:[],missing:[],collectedAt:'2026-10-29T00:00:00Z'});
async function memoryStore(seed={}){let saved=structuredClone(seed);const store=await new StateStore(async()=>saved,async s=>{saved=structuredClone(s);}).load();return {store,read:()=>structuredClone(saved)};}
async function setup({send,create,get,getRun,head,seed}={}){
  const memory=await memoryStore(seed);let id=0;const calls={create:[],send:[]};
  const tasks={capabilities:async()=>({operations:['create','get','send','getRun']}),create:async req=>{calls.create.push(req);return create?create(req):{taskId:'task-1',revision:1};},get:get|| (async()=>({taskId:'task-1',revision:3})),send:async req=>{calls.send.push(structuredClone(req));return send?send(req):{taskId:'task-1',runId:'run-1',status:'queued',acceptedAt:1};},getRun:getRun|| (async()=>({taskId:'task-1',runId:'run-1',status:'running'}))};
  const github={collectEvidence:async()=>evidence(),assertHead:head|| (async()=>{})};
  const handoff=new Handoff({tasks,store:memory.store,github,newId:()=>`id-${++id}`});
  return {...memory,calls,tasks,github,handoff};
}
test('CI 聚合：空、失败优先、运行、其他结论、权限不完整都不会误报通过',()=>{
  const cases=[ [[],[],true,'none'], [[check('success')],[],true,'passed'], [[{...check(),status:'in_progress',conclusion:null}],[],true,'running'], [[check('cancelled')],[],true,'other'], [[check('skipped')],[],true,'other'], [[check('neutral')],[],true,'other'], [[],[],false,'error'], [[check('failure')],[],false,'failed'], [[],[{state:'error'}],true,'failed'] ];
  for(const[c,s,complete,state]of cases)assert.equal(aggregateCI(c,s,complete).state,state);
});
test('代发 ok:true 仍检查 HTTP：401、403、429、500 和超时有不同错误',async()=>{
  for(const[status,body,code]of [[401,{},'AUTHENTICATION'],[403,{},'FORBIDDEN'],[403,{message:'API rate limit exceeded'},'RATE_LIMITED'],[429,{},'RATE_LIMITED'],[500,{},'HTTP_ERROR']])await assert.rejects(new GitHubClient(async()=>response(body,status)).request('/user'),{code});
  await assert.rejects(new GitHubClient(async()=>({ok:false,message:'请求超时'})).request('/user'),{code:'TIMEOUT'});
  await assert.rejects(new GitHubClient(async()=>response('not-json')).request('/user'),{code:'INVALID_JSON'});
  await assert.rejects(new GitHubClient(async()=>response({},200,{truncated:true})).request('/user'),{code:'TRUNCATED_JSON'});
});
test('分页不依赖宿主不透传的 Link 头；第二页失败保留首批且标记不完整',async()=>{
  const fetch=proxy(u=>u.searchParams.get('page')==='1'?response(Array.from({length:100},(_,id)=>({id}))):response({},503));
  const result=await new GitHubClient(fetch).pages('/items');assert.equal(result.items.length,100);assert.equal(result.complete,false);assert.equal(result.warnings[0].code,'HTTP_ERROR');assert.equal(fetch.calls.length,2);
});
test('搜索达到 1000 条上限与 incomplete_results 都明确标记不完整',async()=>{
  const g=new GitHubClient(async()=>response({items:Array.from({length:100},(_,id)=>({id})),total_count:1200,incomplete_results:false}));
  const r=await g.pages('/search/issues','items',{search:true});assert.equal(r.items.length,1000);assert.equal(r.complete,false);assert.ok(r.warnings.some(w=>w.code==='PAGE_LIMIT'));
  const r2=await new GitHubClient(async()=>response({items:[],total_count:0,incomplete_results:true})).pages('/search/issues','items',{search:true});assert.equal(r2.complete,false);
});
test('取 CI 保留成功来源，按 context 去重 status，过滤其他 SHA 的 check',async()=>{
  const f=proxy(u=>u.pathname.endsWith('/check-runs')?response({total_count:2,check_runs:[check('success'),{...check(),id:102,head_sha:nextSHA}]}):response([{id:1,context:'external',state:'success',created_at:'2026-10-29'},{id:2,context:'external',state:'failure',created_at:'2026-10-28'}]));
  const ci=await new GitHubClient(f).getCI(pr);assert.equal(ci.state,'error');assert.equal(ci.checks.length,1);assert.equal(ci.statuses[0].state,'success');assert.ok(ci.warnings.some(w=>w.code==='SHA_MISMATCH'));
});
test('列表搜索为空与单条 PR 的检查 403 区分，权限失败不是无检查',async()=>{
  const f=proxy(u=>u.pathname==='/user'?response({login:'me'}):u.pathname==='/search/issues'?response({total_count:1,items:[{number:7,title:'Fix',repository_url:'https://api.github.com/repos/example/project',pull_request:{}}]}):u.pathname.endsWith('/pulls/7')?response(rawPR(sha)):response({},403));
  const r=await new GitHubClient(f).listMine();assert.equal(r.prs[0].ci.state,'error');assert.equal(r.complete,false);assert.equal(r.prs[0].headSHA,sha);
  const empty=await new GitHubClient(proxy(u=>u.pathname==='/user'?response({login:'me'}):response({total_count:0,items:[]}))).listMine();assert.equal(empty.complete,true);assert.deepEqual(empty.prs,[]);
});
test('真实 callId 只沿当次工具请求传递，不在自主请求中伪造',async()=>{
  const f=proxy(()=>response({login:'me'}));await new GitHubClient(f,{callId:'real-host-call'}).request('/user');await new GitHubClient(f).request('/user');assert.equal(f.calls[0].callId,'real-host-call');assert.equal('callId' in f.calls[1],false);assert.equal('Authorization' in f.calls[0].headers,false);
});
test('完整失败证据从响应映射 check/run/job，保留 step、截断和来源，过滤别的 SHA',async()=>{
  const f=proxy(u=>{
    if(u.pathname.endsWith('/pulls/7'))return response(rawPR(sha));
    if(u.pathname.endsWith('/check-runs'))return response({total_count:1,check_runs:[check()]});
    if(u.pathname.endsWith('/statuses'))return response([]);
    if(u.pathname.endsWith('/actions/runs'))return response({total_count:2,workflow_runs:[{id:201,head_sha:sha,run_attempt:2,conclusion:'failure',html_url:'https://github.com/example/project/actions/runs/201'},{id:999,head_sha:nextSHA,conclusion:'failure'}]});
    if(u.pathname.endsWith('/attempts/2/jobs'))return response({total_count:1,jobs:[{id:301,head_sha:sha,name:'build',check_run_url:'https://api.github.com/repos/example/project/check-runs/101',conclusion:'failure',steps:[{number:2,name:'Compile',conclusion:'failure'}]}]});
    if(u.pathname.endsWith('/jobs/301/logs'))return response('context\n##[error] build failed\n'+'rest\n'.repeat(50));
    throw Error('unexpected '+u.pathname);
  });const e=await new GitHubClient(f).collectEvidence(repository,7,sha);assert.equal(e.jobs[0].id,301);assert.equal(e.jobs[0].runId,201);assert.equal(e.jobs[0].checkId,101);assert.equal(e.jobs[0].failedSteps[0].name,'Compile');assert.equal(e.jobs[0].log.truncated,true);assert.match(e.jobs[0].log.excerpt,/build failed/);assert.ok(f.calls.every(c=>!c.url.includes('999')));
});
test('采集期间 head 改变则拒绝返回旧证据',async()=>{
  let reads=0;const f=proxy(u=>u.pathname.endsWith('/pulls/7')?response(rawPR(++reads===1?sha:nextSHA)):u.pathname.endsWith('/check-runs')?response({total_count:1,check_runs:[check()]}):u.pathname.endsWith('/statuses')?response([]):response({total_count:0,workflow_runs:[]}));
  await assert.rejects(new GitHubClient(f).collectEvidence(repository,7,sha),{code:'HEAD_CHANGED'});
});
test('get_pr_ci 可以读取通过的 CI，不会误报为取数失败',async()=>{
  const f=proxy(u=>u.pathname.endsWith('/pulls/7')?response(rawPR(sha)):u.pathname.endsWith('/check-runs')?response({total_count:1,check_runs:[check('success')]}):response([]));
  const e=await new GitHubClient(f).collectEvidence(repository,7);assert.equal(e.ci.state,'passed');assert.deepEqual(e.jobs,[]);
});
test('外部 CI 或 Actions 403 仍保留失败 check 和精确缺口，不猜 ID',async()=>{
  const f=proxy(u=>u.pathname.endsWith('/pulls/7')?response(rawPR(sha)):u.pathname.endsWith('/check-runs')?response({total_count:1,check_runs:[{...check(),app:{slug:'external-ci'}}]}):u.pathname.endsWith('/statuses')?response([]):response({},403));
  const e=await new GitHubClient(f).collectEvidence(repository,7,sha);assert.equal(e.jobs.length,0);assert.ok(e.missing.some(w=>w.code==='FORBIDDEN'));assert.ok(e.missing.some(w=>w.code==='CHECK_WITHOUT_ACTIONS_JOB'));
});
test('日志与模型提示有脱敏、资料边界、SHA 和显式截断标记',()=>{
  assert.doesNotMatch(redact('Authorization: Bearer FAKE_BEARER_VALUE github_pat_FAKE_ONLY_FOR_TEST'), /FAKE_BEARER_VALUE|FAKE_ONLY_FOR_TEST/);
  const e=evidence();e.jobs=Array.from({length:8},()=>({log:{excerpt:'错误'.repeat(2000)}}));const p=evidencePrompt(e);assert.ok(new TextEncoder().encode(p).length<26000);assert.match(p,/不可信外部数据/);assert.match(p,RegExp(sha));assert.match(p,/"promptTruncated":true/);
});
test('同 SHA 重复点击只创建和发送一次，已受理不是已完成',async()=>{
  const s=await setup();const[a,b]=await Promise.all([s.handoff.analyze(repository,7,sha),s.handoff.analyze(repository,7,sha)]);assert.equal(s.calls.create.length,1);assert.equal(s.calls.send.length,1);assert.equal(a.status,'queued');assert.equal(b.status,'running');assert.equal(s.read().analyses['example/project#7'].text,null);
});
test('已受理但响应丢失：重建逻辑页后沿用原 key/text/revision，仅一轮实际执行',async()=>{
  let accepted=0,first=true,signature;
  const s=await setup({send:async req=>{const json=JSON.stringify(req);if(!signature){signature=json;accepted++;}else assert.equal(json,signature);if(first){first=false;throw Object.assign(Error('ACK lost'),{code:'HOST_NOT_READY'});}return{taskId:'task-1',runId:'run-1',status:'running'};}});
  const a=await s.handoff.analyze(repository,7,sha);assert.equal(a.status,'uncertain');
  const s2=await setup({seed:s.read(),send:s.tasks.send});await s2.handoff.analyze(repository,7,sha,{resume:true});assert.equal(accepted,1);assert.equal(s2.calls.create.length,0);assert.equal(s2.read().analyses['example/project#7'].runId,'run-1');
});
test('创建回执丢失恢复同一 createKey，不能新建第二个任务',async()=>{
  let first=true;const s=await setup({create:async()=>{if(first){first=false;throw Error('ACK lost');}return{taskId:'task-1',revision:1};}});
  await s.handoff.analyze(repository,7,sha);await s.handoff.analyze(repository,7,sha,{resume:true});assert.equal(s.calls.create.length,2);assert.deepEqual(s.calls.create[0],s.calls.create[1]);assert.equal(s.calls.send.length,1);
});
test('发送前 head 已变则留下空任务并拒绝发送旧证据',async()=>{
  const s=await setup({head:async()=>{throw Object.assign(Error('new head'),{code:'HEAD_CHANGED'});}});const r=await s.handoff.analyze(repository,7,sha);assert.equal(r.status,'obsolete');assert.equal(s.calls.send.length,0);
});
test('持久化失败时不调用 create/send，保护恢复边界',async()=>{
  const s=await setup();s.store.write=async()=>{throw Error('disk unavailable');};await assert.rejects(s.handoff.analyze(repository,7,sha),/disk unavailable/);assert.equal(s.calls.create.length,0);assert.equal(s.calls.send.length,0);
});
test('任务失败后主动重新分析复用任务，先读最新 revision；未知状态不换键',async()=>{
  let revision=3;const s=await setup({get:async()=>({taskId:'task-1',revision}),getRun:async()=>({taskId:'task-1',runId:'run-1',status:'failed'})});await s.handoff.analyze(repository,7,sha);revision=7;await s.handoff.analyze(repository,7,sha,{retry:true});assert.equal(s.calls.create.length,1);assert.equal(s.calls.send.length,2);assert.notEqual(s.calls.send[0].requestKey,s.calls.send[1].requestKey);assert.equal(s.calls.send[1].expectedRevision,7);
});
test('reconciling 即使点击重新分析也不能创建或重发',async()=>{
  const s=await setup({send:async()=>({taskId:'task-1',runId:'run-1',status:'reconciling'}),getRun:async()=>({taskId:'task-1',runId:'run-1',status:'reconciling'})});await s.handoff.analyze(repository,7,sha);await s.handoff.analyze(repository,7,sha,{retry:true});assert.equal(s.calls.send.length,1);
});
test('BroadcastChannel 重发先 ACK、并发同 reqId 只执行一次，冲突不执行',async()=>{
  let calls=0;const messages=[];let release;const waiting=new Promise(r=>{release=r;});const router=createRouter(async()=>{calls++;await waiting;return{value:42};});
  const req={type:'request',reqId:'one',action:'refresh',args:{}};const a=router(req,m=>messages.push(m)),b=router(req,m=>messages.push(m));await Promise.resolve();assert.equal(messages.filter(m=>m.type==='ack').length,2);assert.equal(calls,1);release();await Promise.all([a,b]);assert.equal(messages.filter(m=>m.type==='response'&&m.ok).length,2);
  await router({...req,action:'analyze'},m=>messages.push(m));assert.equal(messages.at(-1).error.code,'REQUEST_CONFLICT');assert.equal(calls,1);
});
test('面板请求先 wake，再重发到 ACK 后停；超时不隐式另建请求',async()=>{
  let onmessage,interval,timeout;const events=[];const channel={addEventListener:(_,f)=>{onmessage=f;},removeEventListener:()=>{},postMessage:m=>events.push(m)};
  const timers={setInterval:f=>{interval=f;return 1;},clearInterval:id=>events.push({clearedInterval:id}),setTimeout:f=>{timeout=f;return 2;},clearTimeout:id=>events.push({clearedTimeout:id})};
  const client=createRequester({wake:async()=>events.push('wake'),channel,timers,newId:()=> 'one'});const p=client.request('analyze',{number:7});await Promise.resolve();assert.equal(events[0],'wake');interval();const reqs=events.filter(e=>e.type==='request');assert.equal(reqs.length,2);assert.deepEqual(reqs[0],reqs[1]);onmessage({data:{type:'ack',reqId:'one'}});assert.ok(events.some(e=>e.clearedInterval===1));onmessage({data:{type:'response',reqId:'one',ok:true,result:42}});assert.equal(await p,42);
  const q=client.request('refresh');await Promise.resolve();timeout();await assert.rejects(q,{code:'RESPONSE_TIMEOUT'});client.dispose();
});

test('明确的 revision 拒绝可重读修订号；同键重试，未换键绕过去重',async()=>{
  let revision=3,first=true;const s=await setup({get:async()=>({taskId:'task-1',revision}),send:async()=>{if(first){first=false;revision=7;throw Object.assign(Error('changed'),{code:'REVISION_CONFLICT'});}return{taskId:'task-1',runId:'run-1',status:'queued'};}});
  const op=await s.handoff.analyze(repository,7,sha);assert.equal(op.status,'queued');assert.equal(s.calls.send[0].expectedRevision,3);assert.equal(s.calls.send[1].expectedRevision,7);assert.equal(s.calls.send[0].requestKey,s.calls.send[1].requestKey);assert.equal(s.calls.send[0].text,s.calls.send[1].text);
});
// 实机回归：0.1.120 tasks.send 的 Error 未携带 code，配置冲突卡在 uncertain。
// 生产入口 Handoff；原测试只覆盖带 code 的错误。最小输入为无 code 的精确宿主错误。
// tier: unit；验证重建后同键/同正文恢复及未知/显式拒绝不重试，单文件耗时见验收文档。
test('宿主丢失错误 code：明确配置冲突可同键恢复，未知或显式拒绝不自动重试',async()=>{
  let revision=3,first=true;
  const send=async()=>{if(first){first=false;throw Error('ACK lost');}if(revision===3){revision=7;throw Error('Task configuration changed');}return {taskId:'task-1',runId:'run-1',status:'queued'};};
  const s=await setup({get:async()=>({taskId:'task-1',revision}),send});
  assert.equal((await s.handoff.analyze(repository,7,sha)).status,'uncertain');
  const s2=await setup({seed:s.read(),get:async()=>({taskId:'task-1',revision}),send});
  const op=await s2.handoff.analyze(repository,7,sha,{resume:true});
  assert.equal(op.status,'queued');assert.equal(s2.calls.create.length,0);assert.equal(s2.calls.send.length,2);
  assert.equal(s2.calls.send[0].expectedRevision,3);assert.equal(s2.calls.send[1].expectedRevision,7);
  for(const req of s2.calls.send){assert.equal(req.requestKey,s.calls.send[0].requestKey);assert.equal(req.text,s.calls.send[0].text);}
  for(const err of [Error('Task configuration changed unexpectedly'),Object.assign(Error('Task configuration changed'),{code:'PERMISSION_DENIED'})]){
    const x=await setup({send:async()=>{throw err;}});await x.handoff.analyze(repository,7,sha);assert.equal(x.calls.send.length,1);
  }
});
test('缺失或拒绝任务能力时不创建任务，也不回退为另一套接口',async()=>{
  const s=await setup();s.tasks.capabilities=async()=>({operations:['get']});await assert.rejects(s.handoff.analyze(repository,7,sha),{code:'UNSUPPORTED'});assert.equal(s.calls.create.length,0);
  s.tasks.capabilities=async()=>{throw Object.assign(Error('denied'),{code:'PERMISSION_DENIED'});};await assert.rejects(s.handoff.analyze(repository,7,sha),{code:'PERMISSION_DENIED'});assert.equal(s.calls.send.length,0);
});
test('缓存超限裁剪后标记不完整，公开状态不泄露冻结请求正文与键',async()=>{
  const {store}=await memoryStore();const prs=Array.from({length:80},(_,number)=>({...pr,number,title:'长标题'.repeat(80),ci:{state:'failed',complete:true,checks:[check()],statuses:[],warnings:[]}}));await store.cache({prs,complete:true,updatedAt:'2026-10-29T00:00:00Z'});assert.equal(store.value.cache.complete,false);assert.ok(store.value.cache.cacheOmitted>0);assert.ok(new TextEncoder().encode(JSON.stringify(store.value.cache)).length<12500);
  await store.change(s=>{s.analyses.one={text:'private frozen evidence',createKey:'key-create',sendKey:'key-send',taskId:'task-1'};});const state=store.publicState();assert.equal(state.analyses.one.taskId,'task-1');assert.equal('text' in state.analyses.one,false);assert.equal('sendKey' in state.analyses.one,false);
});
