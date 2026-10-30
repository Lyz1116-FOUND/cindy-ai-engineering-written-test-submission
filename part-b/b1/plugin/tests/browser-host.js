window.qaErrors=[]; window.addEventListener('error',e=>window.qaErrors.push({message:e.message,file:e.filename,line:e.lineno}));window.addEventListener('unhandledrejection',e=>window.qaErrors.push(String(e.reason)));const oldError=console.error;console.error=(...a)=>{window.qaErrors.push(a);oldError(...a);};
// OFFLINE FIXTURE ONLY. This file is never a production entry point.
const sha='a'.repeat(40),root='https://github.com/example/project';
window.cindy={
  onHostMessage(){return()=>{};},send:async()=>({ok:true}),
  tasks:{capabilities:async()=>({operations:['create','get','send','getRun']}),create:async()=>({taskId:'fixture-task',revision:1}),get:async()=>({taskId:'fixture-task',revision:1}),send:async()=>({taskId:'fixture-task',runId:'fixture-run',status:'queued'}),getRun:async()=>({taskId:'fixture-task',runId:'fixture-run',status:'completed'})},
  fetch:async req=>{
    const u=new URL(req.url);let body;
    if(u.pathname==='/user')body={login:'offline-fixture'};
    else if(u.pathname==='/search/issues')body={total_count:3,items:[1,2,3].map(number=>({number,title:'Fixture',repository_url:'https://api.github.com/repos/example/project',pull_request:{}}))};
    else if(/\/pulls\/\d+$/.test(u.pathname)){const number=Number(u.pathname.split('/').at(-1));body={number,title:number===1?'Fix build: escaped <script> stays text':number===2?'Improve documentation':'Update dependencies',state:'open',head:{sha,ref:'fix/readable-ci'},base:{ref:'main',repo:{full_name:'example/project'}}};}
    else if(u.pathname.endsWith('/check-runs'))body={total_count:1,check_runs:[{id:101,head_sha:sha,name:'Unit tests',status:'completed',conclusion:'failure',html_url:root+'/runs/101',app:{slug:'external-ci'},output:{summary:'Offline fixture: test failed'}}]};
    else if(u.pathname.endsWith('/statuses'))body=[];
    else if(u.pathname.endsWith('/actions/runs'))body={total_count:0,workflow_runs:[]};
    else throw Error('Unmapped offline fixture '+u.pathname);
    return{ok:true,status:200,headers:{},body:JSON.stringify(body)};
  }
};
