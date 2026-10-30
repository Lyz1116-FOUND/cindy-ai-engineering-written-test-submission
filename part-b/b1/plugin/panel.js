import {createRequester} from './transport.js';
import {safeLink} from './github.js';
const $=s=>document.querySelector(s);
const channel=new BroadcastChannel('lyz-pr-dashboard-v1');
const client=createRequester({channel,wake:async()=>{const r=await fetch('/wake');if(!r.ok)throw Error(`无法唤醒插件（HTTP ${r.status}）。请检查插件是否启用。`);const s=await r.json();if(['asleep','crashed','fused'].includes(s.state))throw Error('插件当前不可运行，请在插件详情中查看状态。');}});
let snapshot=null,analyses={},stale=true,busy=false;
const labels={passed:'✓ 通过',failed:'× 失败',running:'◌ 运行中',none:'— 无检查',error:'! 获取失败',other:'— 其他结论'};
const taskLabels={prepared:'准备交接',creating:'正在创建任务',sending:'正在交接',queued:'已受理 · 等待执行',running:'AI 运行中',stopping:'正在停止',completed:'分析已完成',failed:'分析失败',cancelled:'已取消',interrupted:'已中断',uncertain:'受理结果待确认',reconciling:'执行结果待核实',blocked:'交接被阻止',obsolete:'证据已过期'};
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
function badge(state,text){const b=el('span',`badge badge-${state}`);b.append(el('span','dot'),document.createTextNode(text));return b;}
function link(text,url){const a=el('a',null,text);const href=safeLink(url);if(href)a.href=href;return a;}
function notice(text,error=false){$('#notice').textContent=text;$('#notice').className=error?'error':'';}
function button(text,fn,primary=false){const b=el('button',primary?'action-primary':null,text);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b;}
function setBusy(value){busy=value;$('#refresh').disabled=value;render();}
function date(s){const d=new Date(s);return Number.isNaN(+d)?'时间未知':d.toLocaleString('zh-CN',{hour12:false});}
function apply(result){if(result.analyses)analyses=result.analyses;}
function analysisBlock(pr,op){
  const box=el('div','analysis');box.append(el('p','status',taskLabels[op.status]||`宿主状态：${op.status}`));
  box.append(el('p','hint',`证据 SHA ${op.sha?.slice(0,12)} · ${date(op.collectedAt)}`));
  if(op.sha!==pr.headSHA)box.append(el('p','hint','这是旧提交的分析记录。新提交需重新收集证据。'));
  if(op.taskId){box.append(el('p','hint',`任务：${op.title}`));box.append(el('p','hint','请在 Cindy 左侧任务列表打开此标题，查看分析或停止执行。'));box.append(el('code',null,`taskId: ${op.taskId}`));}
  if(op.runId)box.append(el('p','meta',`runId: ${op.runId}`));
  for(const err of [op.error,op.queryError].filter(Boolean))box.append(el('p','hint',typeof err==='string'?err:`${err.message}（${err.code}）`));
  const row=el('div','actions');
  if(op.runId)row.append(button('刷新分析状态',()=>query(pr)));
  else if(['uncertain','blocked','creating','sending','prepared'].includes(op.status))row.append(button('恢复原请求',()=>analyze(pr,{resume:true})));
  if(['failed','cancelled','interrupted'].includes(op.status))row.append(button('重新分析',()=>analyze(pr,{retry:true})));
  box.append(row);return box;
}
function render(){
  const list=$('#list');list.replaceChildren();$('#summary').replaceChildren();$('#orphans').replaceChildren();
  if(!snapshot){list.append(el('p','empty',busy?'正在读取 GitHub…':'配置 GitHub 凭证后，刷新查看 PR。'));return;}
  $('#scope').textContent=`${snapshot.login} · 授权范围内，我创建且仍打开的 PR`;
  const complete=snapshot.complete&&!snapshot.cacheOmitted;
  $('#updated').textContent=`${stale?'缓存 · 已陈旧，正在核对最新数据':'更新于'} ${date(snapshot.updatedAt)} · ${snapshot.prs.length}${snapshot.total!==undefined?` / ${snapshot.total}`:''} 条${complete?'':' · 数据不完整'}`;
  if(stale&&!busy)$('#updated').textContent=`缓存 · 已陈旧 · ${date(snapshot.updatedAt)} · ${snapshot.prs.length} 条`;
  const counts={};for(const p of snapshot.prs)counts[p.ci.state]=(counts[p.ci.state]||0)+1;
  for(const state of Object.keys(labels))if(counts[state])$('#summary').append(badge(state,`${labels[state]} ${counts[state]}`));
  const term=$('#search').value.toLowerCase().trim();
  const rows=snapshot.prs.filter(p=>`${p.repository} ${p.number} ${p.title}`.toLowerCase().includes(term));
  if(!rows.length)list.append(el('p','empty',term?'没有匹配的 PR。':snapshot.complete?'当前授权范围内没有我创建且仍打开的 PR。':'暂未取得 PR，数据不完整。请检查上方错误或凭证权限。'));
  for(const pr of rows){
    const article=el('article','pr'),top=el('div','pr-top');
    const repo=el('span','repo',`${pr.repository} · #${pr.number}`);if(pr.draft)repo.append(el('span','draft-chip','Draft'));top.append(repo,badge(pr.ci.state,labels[pr.ci.state]||'未知状态'));
    article.append(top);const h=el('h2');h.append(link(pr.title,pr.url));article.append(h);
    article.append(el('p','branch',pr.headSHA?`${pr.headBranch} → ${pr.baseBranch} · ${pr.headSHA.slice(0,12)}`:'PR 详情未取得，无法确认 head SHA。'));
    const details=el('details');details.append(el('summary',null,'提交与检查详情'));const body=el('div','details-body');
    if(pr.headSHA)body.append(el('p',null,`head SHA：${pr.headSHA}`));
    if(!pr.ci.complete)body.append(el('p',null,'CI 数据不完整，不代表全部检查。'));
    for(const w of pr.ci.warnings||[])body.append(el('p',null,`${w.message}（${w.code}）`));
    for(const c of pr.ci.checks||[]){const p=el('p','check-row');p.append(link(c.name,c.url),document.createTextNode(` · ${c.status} / ${c.conclusion??'未结束'}`));body.append(p);}
    for(const s of pr.ci.statuses||[]){const p=el('p','check-row');p.append(link(s.context,s.url),document.createTextNode(` · ${s.state}`));body.append(p);}
    if(!pr.ci.checks && !pr.ci.statuses)body.append(el('p','hint','缓存只保留状态摘要，刷新后可查看检查明细。'));
    details.append(body);article.append(details);
    const op=analyses[`${pr.repository.toLowerCase()}#${pr.number}`];
    if(pr.ci.state==='failed'&&pr.headSHA){const row=el('div','actions');if(!op||op.sha!==pr.headSHA)row.append(button('分析 CI',()=>analyze(pr),true));if(row.childNodes.length)article.append(row);}
    if(op)article.append(analysisBlock(pr,op));
    list.append(article);
  }
  const keys=new Set(snapshot.prs.map(p=>`${p.repository.toLowerCase()}#${p.number}`));
  for(const[key,op]of Object.entries(analyses))if(!keys.has(key)){
    const section=el('section','pr');section.append(el('p',null,`历史交接 · ${op.repository} #${op.number}`),analysisBlock({repository:op.repository,number:op.number,headSHA:op.sha},op));$('#orphans').append(section);
  }
}
async function refresh(){setBusy(true);notice('正在读取我的 PR 和当前提交的 CI…');try{const r=await client.request('refresh');snapshot=r.snapshot;apply(r);stale=false;notice(snapshot.complete?'':`数据不完整。${snapshot.warnings.map(w=>w.message).join(' ')}${snapshot.prs.some(p=>!p.ci.complete)?'部分 PR 的 CI 未完整取得，展开详情查看。':''}`);}catch(e){stale=true;notice(e.message,true);}finally{setBusy(false);}}
async function analyze(pr,flags={}){setBusy(true);notice(flags.resume?'正在恢复原请求，沿用原请求编号…':'正在重新核对 head SHA 并收集失败证据…');try{const r=await client.request('analyze',{repository:pr.repository,number:pr.number,sha:pr.headSHA,...flags});apply(r);const op=r.analysis;notice(`${taskLabels[op.status]||op.status}。${op.taskId?`任务：${op.title}。`:''}`,['uncertain','blocked','obsolete','failed'].includes(op.status));}catch(e){notice(e.message,true);}finally{setBusy(false);}}
async function query(pr){setBusy(true);try{const r=await client.request('query',{repository:pr.repository,number:pr.number});apply(r);notice('已读取宿主的分析状态。');}catch(e){notice(e.message,true);}finally{setBusy(false);}}
$('#refresh').addEventListener('click',refresh);$('#search').addEventListener('input',render);
window.addEventListener('pagehide',()=>{client.dispose();channel.close();},{once:true});
let scrollTimer;window.addEventListener('scroll',()=>{document.documentElement.classList.add('is-scrolling');clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>document.documentElement.classList.remove('is-scrolling'),2000);},{passive:true});
try{const state=await client.request('state');apply(state);if(state.cache)snapshot=state.cache;render();await refresh();}catch(e){notice(e.message,true);render();}
