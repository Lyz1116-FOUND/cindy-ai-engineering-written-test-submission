// Receipt acknowledgement and deduplication. A duplicate reqId joins the original operation.
export function createRouter(execute,{limit=100}={}) {
  const records=new Map();
  return async function receive(msg,post) {
    if(msg?.type!=='request'||typeof msg.reqId!=='string'||msg.reqId.length>100||!['state','refresh','analyze','query'].includes(msg.action))return;
    const signature=JSON.stringify([msg.action,msg.args]);
    const previous=records.get(msg.reqId);
    if(previous&&previous.signature!==signature){post({type:'response',reqId:msg.reqId,ok:false,error:{code:'REQUEST_CONFLICT',message:'同一请求编号携带了不同内容，未执行。'}});return;}
    post({type:'ack',reqId:msg.reqId});
    let record=previous;
    if(!record){record={signature,settled:false};records.set(msg.reqId,record);record.promise=Promise.resolve().then(()=>execute(msg.action,msg.args||{})).then(result=>({type:'response',reqId:msg.reqId,ok:true,result}),e=>({type:'response',reqId:msg.reqId,ok:false,error:{code:e.code||'PLUGIN_ERROR',message:e.message||'插件操作未完成。'}})).finally(()=>{record.settled=true;for(const[k,v]of records)if(records.size>limit&&v.settled)records.delete(k);});}
    post(await record.promise);
  };
}
export function createRequester({wake,channel,newId=()=>crypto.randomUUID(),timers=globalThis,timeoutMs=360000}) {
  const pending=new Map();
  const listener=e=>{const m=e.data,p=pending.get(m?.reqId);if(!p)return;if(m.type==='ack'){timers.clearInterval(p.retry);return;}if(m.type==='response'){timers.clearInterval(p.retry);timers.clearTimeout(p.timeout);pending.delete(m.reqId);m.ok?p.resolve(m.result):p.reject(Object.assign(new Error(m.error?.message||'操作未完成。'),{code:m.error?.code}));}};
  channel.addEventListener('message',listener);
  return {async request(action,args={}) {
    await wake();
    return new Promise((resolve,reject)=>{const reqId=newId(),msg={type:'request',reqId,action,args};const p={resolve,reject};pending.set(reqId,p);
      p.retry=timers.setInterval(()=>channel.postMessage(msg),350);
      p.timeout=timers.setTimeout(()=>{timers.clearInterval(p.retry);pending.delete(reqId);reject(Object.assign(new Error('等待插件回执超时。分析可能已受理，请刷新状态或恢复原请求；不要重复创建。'),{code:'RESPONSE_TIMEOUT'}));},timeoutMs);
      channel.postMessage(msg);
    });
  },dispose(){channel.removeEventListener('message',listener);for(const p of pending.values()){timers.clearInterval(p.retry);timers.clearTimeout(p.timeout);p.reject(new Error('面板已关闭，请重新打开查看原请求。'));}pending.clear();}};
}
