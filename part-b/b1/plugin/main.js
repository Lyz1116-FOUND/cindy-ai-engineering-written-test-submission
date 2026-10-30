// Register the public Host listener synchronously. Cold-start tool calls can arrive before imports finish.
let handleTool;
const earlyCalls=[];
cindy.onHostMessage(msg=>{
  if(msg.type!=='tool-call'||!['get_pr_ci','list_my_prs'].includes(msg.tool))return;
  if(handleTool)void handleTool(msg);else earlyCalls.push(msg);
});
(async function () {
  const [{GitHubClient,validatePR,redact},{StateStore},{Handoff},{createRouter}] = await Promise.all([import('./github.js'),import('./state.js'),import('./handoff.js'),import('./transport.js')]);
  const channel=new BroadcastChannel('lyz-pr-dashboard-v1');
  let store;
  const ready=new StateStore(async()=>{
    const r=await fetch('/kv');if(!r.ok)throw Error('无法读取插件恢复记录。');return r.json();
  },async s=>{
    const r=await fetch('/kv',{method:'PUT',body:JSON.stringify(s)});
    if(!r.ok)throw Error(`保存恢复记录失败（HTTP ${r.status}），未继续发送。`);
  }).load().then(s=>{store=s;return s;});
  // Route load failures into a request error when the panel next asks; avoid an unhandled rejection.
  ready.catch(()=>{});
  const github=new GitHubClient(r=>cindy.fetch(r));
  let handoff,refreshing=null;
  const router=createRouter(async(action,args)=>{
    await ready;
    handoff ||= new Handoff({tasks:cindy.tasks,store,github});
    if(action==='state')return store.publicState();
    if(action==='refresh'){
      if(!refreshing)refreshing=github.listMine().then(async data=>{await store.cache(data);return data;}).finally(()=>{refreshing=null;});
      return {snapshot:await refreshing,...store.publicState()};
    }
    validatePR(args.repository,args.number);
    if(action==='analyze'){
      if(typeof args.sha!=='string'||!/^[a-f0-9]{40}$/i.test(args.sha))throw Error('缺少有效 head SHA，请先刷新看板。');
      const analysis=await handoff.analyze(args.repository,args.number,args.sha,{resume:args.resume===true,retry:args.retry===true});
      return {analysis,...store.publicState()};
    }
    if(action==='query')return {analysis:await handoff.query(args.repository,args.number),...store.publicState()};
  });
  channel.onmessage=e=>{router(e.data,m=>channel.postMessage(m)).catch(()=>{});};
  handleTool=async msg=>{
    const timer=setInterval(()=>{cindy.send({type:'tool-progress',callId:msg.callId}).catch(()=>{});},45000);
    try{
      const client=new GitHubClient(r=>cindy.fetch(r),{callId:msg.callId});
      if(msg.tool==='get_pr_ci')validatePR(msg.args?.repository,msg.args?.number);
      const evidence=msg.tool==='list_my_prs'?await client.listMine():await client.collectEvidence(msg.args.repository,msg.args.number);
      await cindy.send({type:'tool-result',callId:msg.callId,ok:true,result:evidence});
    }catch(e){
      await cindy.send({type:'tool-result',callId:msg.callId,ok:false,errorCode:e.code||'CI_FETCH_FAILED',message:redact(e.message)+' 请根据错误修复凭证、仓库信息或网络后重新读取。'});
    }finally{clearInterval(timer);}
  };
  for(const msg of earlyCalls.splice(0))void handleTool(msg);
})().catch(()=>{
  handleTool=async msg=>{await cindy.send({type:'tool-result',callId:msg.callId,ok:false,errorCode:'PLUGIN_INITIALIZATION_FAILED',message:'插件脚本初始化失败，请检查安装是否完整并在插件详情查看运行状态。'});};
  for(const msg of earlyCalls.splice(0))void handleTool(msg);
  console.error('PR dashboard initialization failed.');
});
