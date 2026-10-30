import {DashboardError,clip} from './github.js';
export class StateStore {
  constructor(read,write) {this.read=read;this.write=write;this.value={schema:1,cache:null,analyses:{}};this.queue=Promise.resolve();}
  async load() {
    const s=await this.read();
    if(s?.schema===1&&s.analyses&&typeof s.analyses==='object')this.value=s;
    else if(s && Object.keys(s).length)throw new DashboardError('STORAGE_SCHEMA','已保存数据格式无法识别，未覆盖原数据。');
    return this;
  }
  change(fn) {const op=this.queue.then(async()=>{const next=structuredClone(this.value);fn(next);
    if(new TextEncoder().encode(JSON.stringify(next)).length>62000)throw new DashboardError('STORAGE_FULL','分析恢复记录已满，未发送新请求。请先查看现有分析状态。');
    await this.write(next);this.value=next;return next;
  });this.queue=op.catch(()=>{});return op;}
  async cache(snapshot) {
    const c=structuredClone(snapshot);c.prs=c.prs.map(p=>({...p,title:clip(p.title,450).text,ci:{state:p.ci.state,complete:p.ci.complete,checkCount:p.ci.checkCount,statusCount:p.ci.statusCount,conclusions:p.ci.conclusions,warnings:p.ci.warnings?.slice(0,3)}}));
    let trimmed=0;
    while(new TextEncoder().encode(JSON.stringify(c)).length>12000 && c.prs.length){c.prs.pop();trimmed++;}
    if(trimmed){c.complete=false;c.cacheOmitted=trimmed;}
    await this.change(s=>{s.cache=c;});
  }
  publicState() {return {cache:this.value.cache,analyses:Object.fromEntries(Object.entries(this.value.analyses).map(([k,v])=>{const {text,createKey,sendKey,pr,...visible}=v;return[k,visible];}))};}
}
