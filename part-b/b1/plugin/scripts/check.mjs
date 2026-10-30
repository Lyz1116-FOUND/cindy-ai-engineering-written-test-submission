import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'ghost.json'),'utf8'));
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.js')))execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});
for(const f of [manifest.entry,manifest.panel.html,manifest.settingsHtml])if(!fs.statSync(path.join(root,f)).isFile())throw Error(`missing ${f}`);
console.log('JavaScript syntax and declared entry files checked. Forge validates the host manifest separately.');
