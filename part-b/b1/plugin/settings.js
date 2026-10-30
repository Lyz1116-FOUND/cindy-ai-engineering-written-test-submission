const $=s=>document.querySelector(s);
let busy=false;
function lock(on){busy=on;for(const b of document.querySelectorAll('button'))b.disabled=on;}
async function status(){const r=await fetch('/secrets');if(!r.ok)throw Error(`无法读取凭证状态（HTTP ${r.status}）。`);const items=await r.json();const secret=items.find(s=>s.key==='github_pat');$('#saved').textContent=secret?.saved?'已保存 GitHub PAT（尚未验证有效性）':'尚未配置 GitHub PAT';}
$('#credential').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  let value=$('#pat').value.trim();$('#pat').value='';if(!value){$('#feedback').textContent='请输入 PAT。';return;}
  lock(true);
  try{const request=fetch('/secrets/github_pat',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value})});value='';const r=await request;if(r.status!==204)throw Error(`凭证未保存（HTTP ${r.status}）。请检查插件状态。`);await status();$('#feedback').textContent='已保存。回到看板刷新，以验证 GitHub 授权。';}
  catch(e){$('#feedback').textContent=e.message;}finally{value='';$('#pat').value='';lock(false);}
});
$('#clear').addEventListener('click',async()=>{if(busy)return;lock(true);$('#pat').value='';try{const r=await fetch('/secrets/github_pat',{method:'DELETE'});if(r.status!==204)throw Error(`凭证未清除（HTTP ${r.status}）。`);await status();$('#feedback').textContent='凭证已清除；看板中的历史状态将在下次刷新时重新核对。';}catch(e){$('#feedback').textContent=e.message;}finally{lock(false);}});
window.addEventListener('pagehide',()=>{$('#pat').value='';});
status().catch(e=>{$('#saved').textContent=e.message;});
