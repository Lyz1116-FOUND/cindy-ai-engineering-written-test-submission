import {fileURLToPath} from 'node:url';
// Local visual QA with clearly labelled synthetic data. Not a Cindy runtime, no real network/auth.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));let state={};
const palettes={light:{'panel-bg':'#f8f8f6',surface:'#f8f8f6','surface-elevated':'#fff','surface-chip':'#eee','border-default':'#d7d7d4','text-primary':'#262626','text-secondary':'#626262','text-placeholder':'#777','accent-cta-bg':'#262626','accent-pure-cta-fg':'#fff','error-fg':'#a33224','focus-ring':'#526d92'},dark:{'panel-bg':'#1f1f1e',surface:'#1f1f1e','surface-elevated':'#2c2c2a','surface-chip':'#353535','border-default':'#3c3c3a','text-primary':'#eee','text-secondary':'#aaa','text-placeholder':'#999','accent-cta-bg':'#eee','accent-pure-cta-fg':'#262626','error-fg':'#e99a8c','focus-ring':'#abc'}};
const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://localhost');const route=u.pathname;
  if(route==='/wake'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({state:'running'}));return;}
  if(route==='/kv'){res.setHeader('Content-Type','application/json');if(req.method==='PUT'){let s='';for await(const b of req)s+=b;state=JSON.parse(s);res.writeHead(204);res.end();}else res.end(JSON.stringify(state));return;}
  if(route==='/'){const theme=u.searchParams.get('theme')==='dark'?'dark':'light';const css=Object.entries(palettes[theme]).map(([k,v])=>`--${k}:${v}`).join(';');res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html style="color-scheme:${theme};${css}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OFFLINE FIXTURE · PR 看板视觉测试</title><style>body{margin:0;background:var(--surface);color:var(--text-primary);font:12px system-ui}.label{padding:8px;border-bottom:1px solid var(--border-default)}iframe{width:100%;height:calc(100vh - 42px);border:0;display:block}</style></head><body><div class="label">离线模拟数据 · 仅验证界面 · 不是 Cindy 真实运行</div><iframe title="PR dashboard fixture" src="/panel.html?theme=${theme}"></iframe><script src="/tests/browser-host.js"></script><script src="/main.js"></script></body></html>`);return;}
  const file=path.resolve(root,'.'+decodeURIComponent(route));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  let data=await fs.readFile(file);const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'})[ext]||'application/octet-stream');
  if(ext==='.html'){const theme=u.searchParams.get('theme')==='dark'?'dark':'light';const css=Object.entries(palettes[theme]).map(([k,v])=>`--${k}:${v}`).join(';');data=Buffer.from(data.toString().replace('</head>',`<style>:root{color-scheme:${theme};${css}}body{background:var(--panel-bg)}</style></head>`));}res.end(data);
}catch{res.writeHead(404);res.end();}});
server.listen(0,'127.0.0.1',()=>console.log(`OFFLINE_PREVIEW=http://127.0.0.1:${server.address().port}`));
