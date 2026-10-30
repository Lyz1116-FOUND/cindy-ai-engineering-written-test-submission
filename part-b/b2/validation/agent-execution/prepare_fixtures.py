from pathlib import Path
import subprocess,json,hashlib,shutil
import sys
root=Path(sys.argv[1]).resolve();root.mkdir(parents=True,exist_ok=True)
if any(root.iterdir()): raise SystemExit('Use a new empty directory')
skill=Path(__file__).resolve().parents[2]/'end-of-work/SKILL.md'
for agent in ['codex','claude']:
 for case in ['passing','failure-and-residue']:
  p=root/f'{agent}-{case}';p.mkdir(exist_ok=True)
  def git(*args):return subprocess.check_output(['git',*args],cwd=p,text=True).strip()
  git('init','-q');git('config','user.name','Skill Fixture');git('config','user.email','fixture@example.invalid')
  (p/'AGENTS.md').write_text('这是隔离测试项目。用 npm test 执行全部测试，无依赖，不安装任何包。cli.js 的 console.log 是正式 CLI 输出，测试中的固定数值是合法 fixture。不得修改代码、配置或 Git 状态。\n')
  (p/'package.json').write_text(json.dumps({'private':True,'type':'module','scripts':{'test':'node --test test/*.test.js'}}))
  (p/'src').mkdir();(p/'test').mkdir()
  (p/'src/math.js').write_text('export const add = (a, b) => a + b;\n')
  (p/'cli.js').write_text('console.log("usage: demo <number>");\n')
  (p/'test/math.test.js').write_text('import test from "node:test";\nimport assert from "node:assert/strict";\nimport { add } from "../src/math.js";\ntest("adds two inputs", () => assert.equal(add(2, 3), 5));\ntest("supports zero", () => assert.equal(add(0, 7), 7));\n')
  git('add','.');git('commit','-qm','baseline');base=git('rev-parse','HEAD')
  (p/'src/math.js').write_text('export function add(a, b) {\n  return a + b;\n}\n')
  git('add','src/math.js');git('commit','-qm','refactor addition')
  (p/'cli.js').write_text('console.log("usage: demo <number> [--help]");\n')
  if case=='failure-and-residue':
   (p/'src/math.js').write_text('export function add(a, b) {\n  return a - b;\n}\n')
   (p/'debug.js').write_text('debugger;\nconsole.log("temporary inspect");\n')
   (p/'debug-output.log').write_text('temporary fixture output\n')
   (p/'src/staged.js').write_text('export const value = 1;\nconsole.log("temporary staged probe");\n')
   git('add','src/staged.js')
   (p/'src/staged.js').write_text('export const value = 1;\n')
  else:
   (p/'test/extra.test.js').write_text('import test from "node:test";\nimport assert from "node:assert/strict";\nimport { add } from "../src/math.js";\ntest("fixture negative", () => assert.equal(add(-1, 1), 0));\n')
  skillp=root/f'{agent}-{case}-SKILL.md';shutil.copyfile(skill,skillp)
  prompt=f'收工。请读取 {skillp} 并严格按它执行。工作目录为 {p}，本次起点为 {base}；该基线之后所有提交、暂存、未暂存和未跟踪文件都属于本次工作。可以读取这些文件并运行项目规定的本地测试，不联网安装依赖，不修改或清理文件，不提交或推送。不要只描述计划，请实际执行。'
  (root/f'{agent}-{case}.prompt.txt').write_text(prompt)
  files={str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and '.git' not in f.parts}
  manifest={'agent':agent,'case':case,'directory':str(p),'base':base,'head':git('rev-parse','HEAD'),'status':git('status','--porcelain=v1'),'index':git('write-tree'),'files':files}
  (root/f'{agent}-{case}.before.json').write_text(json.dumps(manifest,indent=2))
print('Prepared four isolated fixtures and identical Skill copies; no credentials or actual project files used')
