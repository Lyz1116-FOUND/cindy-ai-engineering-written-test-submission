# B1(b) 验收笔记

> 本篇按实际验证路径整合了原始三份验收文档的叙事与事实；分项原始记录保留在同目录各回执 JSON 与 real-ai-analysis.md、host-verification.md 中。

日期：2026-10-29 ～ 2026-10-30（Asia/Tokyo）。宿主 Cindy 0.1.120（macOS）。

## 版本与证据对照

| 版本 | 内容 | 证据状态 |
| --- | --- | --- |
| 1.0.0 | 首版交付（21 项测试） | 安装、面板、按钮交接、AI 闭环均已实测；旧包与哈希归档为历史 |
| 1.0.1 | CI 修复 + 宿主无 code 错误兼容（53 项测试） | Forge 原位更新安装；面板实机闭环（旧仓库 PR #2，证据 SHA `f80d6b44ba2f`）；包 SHA-256 `0c10653b…e77c61ec` |
| 1.0.2 | 视觉优化（徽标系统 + 卡片层次，测试数不变） | Forge 原位更新安装（配置数据保留）；实机闭环见第 4 节；包 SHA-256 `63da87be…a02420648` |

截图：01–04 号摄于 1.0.1 及更早版本；**05 号为 1.0.2 面板实拍**。

## 0. 背景与验证方法

按交付笔记的润色提示词交给 Cindy 后，Cindy 完成了插件「我的 PR 看板」（`lyz-pr-dashboard`）的制作。随后我**不直接信任生成结果**，按原始笔记 [`design-notes/raw/B1.docx`](../design-notes/raw/B1.docx) (b) 节写下的两段式方法做人工实测：

1. **先用成功 PR 验证连通性**：面板能否取到真实 PR 列表、CI「通过」状态判定是否与 GitHub 实际一致；
2. **再故意设置不成功 PR 验证失败路径**：受控失败是否被如实读取（而不是被掩盖或误判），失败证据（run/job/step、日志）能否采集，AI 交接闭环能否完成。

验证过程中暴露了三个真实问题，每个都按「报错 → 定位 → 验证修复」链路处理并补回归测试。最终 53 项自动化测试全部通过，实机闭环完成。

## 1. 阶段一：成功 PR 验证连通性

首次真实列表返回空（`prs=[]、total=0、complete=true`，2026-10-29T15:05:11Z）——符合当时授权范围内没有自建 open PR 的事实，也顺带验证了「无 PR」不是报错。

为获得真实的成功/失败样本，在 GitHub 测试仓库创建功能分支草稿 [PR #1](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test/pull/1)：workflow 先跑真实语法/入口检查和全部插件测试（Node 20/22），最后一步 `B1 controlled failure sample` **仅在 draft 且正文含 `[B1_CI_FAILURE_SAMPLE]` 标记时** `exit 1`，显式 `continue-on-error:false`。这让我可以在同一个 PR 上反复切换成功/失败状态。

固定 head SHA `0f026073…` 的五轮真实切换，看板与 GitHub 实际状态逐轮对照：

| 场景 | run | step #6 | 看板判定 |
| --- | --- | --- | --- |
| draft，无标记（成功 PR） | [40903007578](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test/actions/runs/40903007578) | skipped | ✅ 通过，与实际一致 |
| draft，加标记（故意失败） | [40903133819](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test/actions/runs/40903133819) | failure | ✅ 失败，见阶段二 |
| 转非 draft，保留标记 | [40903280460](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test/actions/runs/40903280460) | skipped | ✅ 通过 |
| 转回 draft，保留标记 | [40903520919](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test/actions/runs/40903520919) | failure | ✅ 失败 |
| draft，移除标记（恢复成功） | [40903969800](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test/actions/runs/40903969800) | skipped | ⚠️ 起初**误报失败** → 链路二 |

每轮 Node 20/22 的测试步骤均通过，失败只来自受控样本。连通性结论：列表取数、身份识别（login 来自宿主托管 PAT，凭证不可读回）、CI「通过」判定、状态切换跟踪均成立。

## 2. 阶段二：故意失败 PR 验证失败路径与 AI 闭环

对加标记的失败 PR 点击「分析 CI」：

- 证据采集：固定 head SHA，失败 check/job `123536798241`、run `40899275436`、失败 step #6，均从真实响应映射；日志原始 314 行，摘录显式 `truncated:true`、脱敏。
- 交接：面板创建真实 task `24d48a57-…`、run `b46b4808-…`；AI 于 2026-10-29T15:17:12Z 完成分析（final_answer 原文存 `real-ai-analysis.md`）。AI 结论正确区分了「受控失败样本」与插件缺陷，并列出证据缺口（check 输出为空、日志截断），未修改文件、未合并、未重跑 CI。
- 截图三张目检通过（Dark；截图已裁剪去除账号、侧栏、输入框等个人信息后再交付）。

## 3. 报错 → 定位 → 验证修复

### 链路一：日志采样漏掉末尾退出错误

- **报错**：早期 AI 分析对失败原因的引用不完整——末尾的 runner 退出诊断（`Process completed with exit code 1`）可能不在摘录里。
- **定位**：旧采样取「最早 10 处匹配」，成功测试的 `# fail 0` 汇总或长行会把末尾错误挤出 2000 字节预算。
- **修复**：先为最后最多 10 处 runner 错误预留空间，再补上下文；每 job 2000 字节、单行 600 字节上限与显式截断标记不变。
- **验证**：第一批 14 项回归中 9 项在旧实现上失败，修复后通过；真实受控日志（457/506 行）摘录确认末尾错误保留。

### 链路二：同 SHA 历史检查污染，看板持续误报失败

- **报错**：上表第五轮移除标记恢复成功后，看板仍显示失败（场景切换多轮后必然出现）。
- **定位**：GitHub `check-runs?filter=latest` 对同 SHA 仍返回多个 check suite 的结果，旧的受控失败覆盖了最新成功；旧逻辑只按名称/结论聚合。用移除标记后的真实 API 快照直接聚合得到 failed，证实污染来源。
- **修复**：存在同名 Actions 检查时，额外读取同 SHA 的 run 元数据，按 workflow ID、事件、分支、关联 PR、check 名称和 run_number 选出当前结果；不同来源分别保留，映射不完整时显式报 `CHECK_HISTORY_UNRESOLVED` 而不是猜通过。
- **验证**：真实快照回放——新版生产 `GitHubClient.getCI` 输出 **passed、complete:true**，保留当前 check `123553540799`/`123553540129`，`supersededCheckCount:8`；新增 9 项回归（恢复通过、运行中、矩阵命名、跨 workflow/事件/PR 同名、元数据 403/缺失）。

### 链路三：宿主拒绝错误不带 `code`，恢复分支不命中

- **报错**：1.0.1 实机验收期间，一次点击后分析卡在「待核实（uncertain）」，宿主返回的错误只有消息 `Task configuration changed`，没有 `code` 字段。
- **定位**：按 revision 冲突设计的恢复分支只认 `REVISION_CONFLICT`/`STALE_REVISION`；对照宿主 0.1.120 的 preload 只读检查确认这类拒绝 Error 确实可能不带 `code`。
- **修复**：无 `code` 且消息**精确等于** `Task configuration changed` 时按 revision 冲突处理（重读 revision、同键同正文重试一次）；消息有变化或带其他 `code`（如 `PERMISSION_DENIED`）一律不自动重试，仍按 uncertain 处理。
- **验证**：新增回归覆盖三条路径（52 → 53 项）；修复重建包后实机最终闭环（PR #2，head `f80d6b44ba2f…`）一次完成——面板刷新 2/2 条、任务 `eb474e25-…`/`71e6ae91-…` 受理并完成，证据 SHA 与最终提交一致，AI 引用的 run `40909414476`、job `123572977643/123572977999`、step #6 `exit 1` 与 GitHub API 独立核验完全吻合，全程未再出现卡死。

### 其他报错记录（未改代码，如实记录）

- 一次 `get_pr_ci` 首请求 `NETWORK_ERROR: fetch failed`，下一次只读调用成功；未因此改网络或凭证权限。
- 自动点击被 macOS 拒绝（`osascript 不允许辅助访问 -1728`），未绕过，改由我在面板手动点击；截图捕获预检通过，`screencapture -l` 单窗口失败后改用指定区域捕获。
- 宿主实际构建 commit `b3dd843…` 官方 API 查询 422、tag `v0.1.120` 为不同 commit；安装资源静态核验有记录，公开核验缺口如实保留。
- 首轮 AI 读取调试规范时触发宿主默认权限确认，确认后完成；插件未替用户提权。

## 4. 1.0.2 实机闭环（最终包）

1.0.2 仅改面板视觉（panel.css/panel.js），数据层与交接逻辑不变。Forge 原位更新安装（配置数据保留）后，先遇一次偶发 `fetch failed`（重试成功，见第 3 节杂项），随后完成完整闭环：

- 载具：新仓库草稿 [PR #1](https://github.com/Lyz1116-FOUND/cindy-ai-engineering-written-test-submission/pull/1)（draft + 正文受控标记）。CI 经 workflow_dispatch 派发（多次操作未观察到 pull_request 工作流运行，原因未确认；本次在验证分支通过手动派发完成验证，main 的守卫不变）：run `41029691351`，Node 20/22 两 job 的 53 项测试全部通过，仅第 6 步受控样本 `exit 1`。
- 面板：刷新返回 1/1 条，红色「× 失败」徽标、Draft 徽章、卡片新视觉均正确显示。截图 `05-real-1.0.2-closed-loop.png` 摄于“已受理 · 等待执行”阶段，仅证明新版面板与交接受理状态；随后分析完成由任务回执及 AI final_answer 证明。
- 按钮交接：点击「分析 CI」，插件采集证据并派发任务 taskId `04fb2aee-213c-4a36-91dd-c51d3d199e1b`、runId `e0d9d70d-8bfe-49cd-a816-b0b2c0ed9940`；证据 head SHA `f15522a879cee11a109ffe2ba3326d30cb9d3e25` 与 PR head 一致，日志脱敏截断、`missing:[]`。
- AI 完成分析（2026-10-30T08:59:00Z final_answer）：结论正确识别受控失败样例，引用 run/job/step 与日志行号，并如实列出证据缺口；未修改文件、未合并、未重跑 CI。
- 回执：[release-1.0.2-controlled-run.json](release-1.0.2-controlled-run.json)。

## 5. 测试与证据索引

- 自动化测试演进：21（首版）→ 24 → 43（真实多轮前）→ 52（历史选择回归）→ **53（宿主无 code 兼容；1.0.2 视觉版同数）**，`npm test`/`npm run check` 全绿，CI Node 20/22。
- 说明：五轮真实场景执行时是 43 项测试版本；52/53 项版本另有远端 checks 与真实 API 快照回放记录，不混称。
- 截图：01–04 摄于 1.0.1 及更早版本（均已裁剪为仅保留面板/分析正文）；05 为 **1.0.2 面板实拍**（新视觉 + 已受理状态）。
- 结构化回执：`live-receipt.json`、`ci-hardening-receipt.json`、`forge-receipts.json`、`forge-1.0.1-receipts.json`、`installed-1.0.1-ci.json`、`release-1.0.1-controlled-run.json`、`release-1.0.2-controlled-run.json`。
- 安装包：1.0.1 包 SHA-256 `0c10653b…e77c61ec`（旧仓库 artifacts 归档）；1.0.2 包 SHA-256 `63da87be…a02420648`（视觉优化版）；1.0.0 包与哈希归档为历史。

## 6. 未验证与限制（如实保留）

- 宿主 **Light 模式**未实机目检（离线浏览器验证过语义变量与 320px，不等同宿主实测）。
- **跨应用重启**后的最终对账未实测；离线测试覆盖同键恢复与不确定不重发。
- 实验 tasks API 仍在演化；日志摘录是截断样本，不能当完整诊断；分页上限、外部 CI/merge SHA 无日志等分支主要靠离线回归覆盖。
- 未发布插件市场，未修改宿主，未绕过任何权限。
