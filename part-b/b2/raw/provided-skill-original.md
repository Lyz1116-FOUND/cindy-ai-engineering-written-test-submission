---
name: end-of-work
description: 用户说「收工」「收尾」「今天到这」「下班」或要求 wrap up 时，按固定流程收尾：运行相关测试、从头到尾审阅本次改动、扫描遗留的调试代码与临时文件、输出固定格式的简短摘要。适用于任何 git 仓库；只读取和验证，不提交、不推送、不删除文件。
metadata:
  short-description: 收工：测试、审阅改动、扫描调试残留、写摘要
---

# 收工

按固定顺序完成收尾：**定范围 → 跑测试 → 审阅 → 扫描 → 摘要**。目标是让不同的人或 AI 每次得到同样的结果，而不是自由发挥一份“看起来不错”的总结。

## 触发

- 触发：「收工」「收尾」「今天到这」「下班」「wrap up」。
- 不触发：只问「刚才改了什么」→ 直接回答；只想提交或发 PR → 按对应流程处理。本 Skill 不包含提交、推送和发 PR。

## 不变量

1. **顺序固定**，上一步没有结果不进入下一步。
2. **只读**：不执行 `git add`、`commit`、`push`、`stash`、`reset`、`clean`、`checkout`；不改源码；不删文件；不安装依赖。
3. **不跳步**：测试失败也要完成审阅、扫描和摘要。
4. **只报看到的**：结论必须带证据（命令、退出码、`文件:行`）；没运行的项写“未运行”，不能写成通过。
5. **有歧义先问一次**：只问阻塞当前步骤的问题，问完继续。

如果用户要求顺手修复，先说明“这会离开收工流程”，按普通任务修改；完成后重新从第 0 步收工。

## 第 0 步：确定范围

```bash
git rev-parse --show-toplevel
git status --short
```

确定基线 `BASE`：

1. 用户或本会话已指定基线 → 用它。
2. 否则依次尝试 `origin/main`、`origin/master`、`main`、`master`，取第一个存在的，运行 `git merge-base <ref> HEAD`。
3. 都不存在 → `git rev-list --max-parents=0 HEAD | tail -n 1`。

```bash
BASE=<上一步结果>
git log --oneline "$BASE"..HEAD
git diff --stat "$BASE"
git ls-files --others --exclude-standard
```

- 若 `BASE..HEAD` 中有不是本次会话产生的提交，或用户说的“这次”与分支历史不一致，**停下来问一次**用哪个基线；得到答复后继续。
- 记录：基线、提交数、改动文件数、`+A/−D`、未跟踪文件数；摘要中必须出现。

不在 git 仓库时：记录“无 git”，跳过第 0、2、3 步，第 1 步照常尝试，摘要注明。

## 第 1 步：跑测试

按下列顺序选择命令，**选到第一条就停止**：

| 顺序 | 条件 | 命令 |
| --- | --- | --- |
| 1 | 仓库根 `AGENTS.md`、`CLAUDE.md` 或 `CONTRIBUTING.md` 写明了测试命令 | 照它执行 |
| 2 | 根 `package.json` 有 `test:unit:related` | 用对应包管理器运行 `test:unit:related`（lockfile 为 pnpm 时即 `pnpm test:unit:related`） |
| 3 | 根 `package.json` 有 `test` | 按 lockfile 用 pnpm / yarn / npm 执行 `test` |
| 4 | 其他生态 | `pytest -q` / `go test ./...` / `cargo test` / `swift test` |
| 5 | 以上都没有 | 不猜；记录“未找到测试入口” |

范围：

- 改动路径向上找到最近的 `package.json`，取其 `name`，去重；用仓库对应的包管理器对每个受影响的包运行类型检查（Cindy 仓库为 `pnpm --filter <包名> run --if-present typecheck`）。
- 仓库规则要求全量、或改动跨多个包时，才扩大范围；不为了“更保险”默认跑全量。
- 不使用 `--watch`。

记录并写进摘要：每条命令、退出码、通过/失败数、耗时。测试超时（单条命令 10 分钟）按失败记录并终止。失败时记录首个失败用例和首条错误，**不在收工流程内修复**，继续第 2 步。

不得用 `--no-verify`、`--passWithNoTests`、跳过用例等方式把失败变成通过。

## 第 2 步：从头到尾审阅改动

“从头到尾”指**每个 hunk 都要读**。禁止只看 `--stat`、只看文件名，或让另一个模型代读后只取摘要。

```bash
git diff --check "$BASE"
git diff --name-status "$BASE"
git diff "$BASE" -- .
git ls-files --others --exclude-standard
```

- 逐个文件读完整 diff；未跟踪文件逐个读全文。
- 有 commit 且 `package.json` 有 `check:dco` 时运行 `check:dco`（用对应包管理器；Cindy 仓库为 `pnpm check:dco`）。
- 对每个文件回答：
  - 改了什么，为什么（只能写 diff 和上下文能支持的理由）；
  - 是否误删文件、意外整文件格式化、混入锁文件/二进制/大文件；
  - 边界、错误路径、权限与安全（密钥、token、真实用户数据、本机绝对路径）；
  - 是否留下写死的测试值（固定 ID、固定时间、mock 数据、`localhost` 地址）；
  - 仓库规则是否满足（如 UI 双模式、i18n、测试、DCO）；
  - 新增行为是否有对应测试。
- 产出：每个文件一行“改了什么”，供第 4 步使用。

`git diff --check` 报出的冲突标记或空白错误必须记录；冲突标记视为阻塞问题。

## 第 3 步：扫描遗留调试代码与临时文件

`git diff` 看不到未跟踪文件，所以必须扫两个来源。只扫**本次新增**内容，避免把仓库里既有的日志全部翻出来。

```bash
PATTERN='console\.(log|debug|trace|dir)|debugger|alert\(|\.only\(|(it|test|describe)\.skip|TODO|FIXME|XXX|HACK|pdb\.set_trace|breakpoint\(|fmt\.Print|System\.out\.print|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|/Users/[A-Za-z]'

# 1) 已跟踪文件的新增行（带 文件:行号）
git diff -U0 "$BASE" -- . | awk '
  /^\+\+\+ b\// { f=substr($0,7); next }
  /^@@/ { if (match($0, /\+[0-9]+/)) ln=substr($0,RSTART+1,RLENGTH-1)+0; next }
  /^\+/ && !/^\+\+\+/ { print f ":" ln ":" substr($0,2); ln++ }
' | grep -E "$PATTERN"

# 2) 未跟踪文件
git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
  grep -nHIE "$PATTERN" -- "$f"
done

# 3) 临时文件名
git ls-files --others --exclude-standard | grep -E '(^|/)(\.DS_Store|nohup\.out|.*\.(log|tmp|bak|orig|rej|swp))$'
```

`grep` 无命中时退出码为 1，属正常。不得把“没有输出”当成“扫描通过”，要在摘要里写“扫描 0 命中”。

把每个命中分到三类，逐条给出 `文件:行` 和理由：

| 类别 | 判定 | 处理 |
| --- | --- | --- |
| 明确残留 | 调试输出、`debugger`、`.only`、无理由的 `skip`、临时文件、真实 token 或本机绝对路径 | 列入摘要“待清理” |
| 可能合法 | logger 实现、CLI 的预期输出、断言 `console` 的测试、带 issue 链接的 `skip`、示例代码 | 保留，写明理由 |
| 不确定 | 无法从上下文判断 | 列入摘要“需确认” |

写死的测试值（固定 ID、固定时间、mock 数据、`localhost` 地址）无法用正则可靠识别，在第 2 步按文件判断；测试文件内的 fixture 不算残留。

**本轮不清理**。用户明确要求清理时，另开普通任务：先列清单，删除未跟踪文件前逐项确认。

## 第 4 步：输出摘要

只输出下面这个结构，正文不超过 8 行：

```markdown
## 收工摘要
范围：<BASE>..工作区，N 个文件（M 个未跟踪），+A/−D
改动：<2–4 条，按模块，每条一句>
验证：<命令> → 通过/失败（X 通过 / Y 失败，Zs）
残留：无 / <文件:行> / N 处待确认
风险：<未验证项、既有失败、需要决定的事>
```

- 测试失败、有明确残留或发现阻塞问题时，**第一行先写结论**，不要埋在最后。
- 只写结论和证据：不复述 diff，不逐个文件罗列，不写“整体来看质量不错”这类评价。
- 没有验证的项必须出现“未验证”字样。

## 停止条件

遇到下列情况停止当前动作并说明，不要自行绕过：

- 需要 `sudo`、联网安装依赖、修改仓库外文件或执行其他破坏性命令；
- 测试命令与仓库文档冲突，或仓库文档要求先征得维护者同意；
- 连续两次测试失败原因不同（可能是环境不稳定），仍按失败记录，不强行重跑到通过；
- 用户中途改变要求：按新要求执行，摘要中列出未执行项。
