# 我的 PR 看板

用于 Cindy AI 工程实习生笔试 B1(b) 的第三方插件。插件 ID 为 `lyz-pr-dashboard`，源码独立于 Cindy 宿主，不修改宿主或权限守卫。

源码版本 **1.0.1**。运行截图见 [`../screenshots/`](../screenshots/)，验收记录见 [`../validation/acceptance.md`](../validation/acceptance.md)；安装包（`.cindy`）暂未随仓库发布，可由 Agent 通过宿主 Forge 从本目录安装。

## 做了什么

- 可关闭、重开的右侧栏面板，打开加载、手动刷新、按仓库/标题/编号筛选。
- “我的 PR”指**当前 PAT 授权范围内，我创建且仍打开的 PR**。不包含仅分配给我或请求我 review 的 PR。
- 展示仓库、标题、编号/链接、分支、完整 head SHA、CI 状态及原始检查结论。
- 通过宿主代理访问 GitHub API，分页查询搜索、checks、commit statuses、Actions runs/jobs。搜索最多 1000 条，其他列表最多 10 页；上限、API 的 `incomplete_results`、部分失败均显示不完整。
- 点击失败 PR 的“分析 CI”，重新采集该 head SHA 的 checks/statuses、失败 Actions run/job/step、可取得的脱敏日志摘录、链接、采集时间与缺失项，收尾和发送前再次核对 head SHA。
- 通过 `cindy.tasks.create/send` 交给可见普通任务，按真实 `getRun` 状态展示受理、运行、完成、失败与待核实；不将创建成功当作分析完成。
- 使用持久 `requestKey`、taskId、runId、revision 恢复不确定请求。重复点击不会盲目新建/发送；不确定发送保留原正文、键、revision。
- 两个只读 Agent 工具：`list_my_prs` 和 `get_pr_ci`，复用面板的数据层。当前 Agent 调用时传递真实 `msg.callId`，直接返回资料继续分析，不嵌套创建任务。

## 版本、接口与证据边界

执行电脑为当前 Mac，`check_app_update` 实际返回 Cindy **0.1.120**。安装资源 `cindy-source.json` 记录构建 commit `b3dd8436228135aa8be9827d204e4e5eaf9316b4`。官方 API 查询该 commit 返回 HTTP 422，无法取得完全匹配的公开源码。

官方 `v0.1.120` tag 已核验为 `b0c217c98b2346bb32a34821241992ba52918a86`，与构建 commit 不同，因此仅作交叉参考。实际安装包的 `ghostPreload.js` 和 `bootstrap-electron-BQG0kPOv.js` 只读检查确认公开 tasks 桥、`tasks-request` 派发和 `experimental:true` 的 capability 响应存在。它们不证明当前账号的授权、模型或任务派发一定成功。

本插件只选用普通任务路径：`agent.tasks:true`；不同时实现 errand 或 agent.run，不调用内部 IPC。运行时检查 `capabilities().operations`。API 仍是实验接口，恢复窗口中的 `reconciling` 只能表示待核实，不能当作完成，也不能换键重发。

`minCindyVersion:0.1.120` 是本次核验的稳定兼容基线，不宣称已查明这些能力首次发布的历史版本。更早版本未验证。宿主核验细节见 [`../validation/host-verification.md`](../validation/host-verification.md)。

## 安装与配置

1. 安装包发布前，可明确让 Agent 通过 Forge 从本源码目录安装（如 `ghost_forge_install`）；首次安装由宿主展示网络和普通任务能力并确认。
2. 插件详情 → GitHub PAT：保存/替换 token；清除按钮删除宿主凭证。也可在 Agent 首次调用时使用宿主 Setup 卡。**不要把 PAT 发到聊天中。**
3. Fine-grained PAT 选择要查看的仓库，并授予 Pull requests、Checks、Commit statuses、Actions 读取权限（Metadata 按 GitHub 默认）。组织仓库可能需要审批/SSO。经典 PAT 对私有仓库通常需要 `repo`，权限较宽，优先使用 fine-grained PAT。
4. 开启右侧“我的 PR 看板”。关闭后可在侧栏 `+` 或插件详情重新打开。宿主绘制标题栏和关闭按钮。
5. 如果使用 AI 分析，在宿主“模型与任务”设置中选择可用模型；未覆盖时采用当前新任务选择。插件不静默切换模型、账号或权限。
6. 点击失败 PR 的“分析 CI”。在 **Cindy 左侧任务列表** 打开 `CI 分析 · owner/repo #编号`，可查看分析并随时停止。面板列出真实 taskId/runId。此版公开任务 API 没有面板直接 focus 任务的能力，所以不伪造“打开任务”按钮或不可用深链。

插件只做读取和分析，不自动修改代码、合并 PR、重跑 CI。AI 任务遵循宿主自身的权限设置；分析提示不是 OS 只读沙箱保证。

## 网络与数据

- 自主联网仅声明 `api.github.com`、`*.actions.githubusercontent.com`、`*.blob.core.windows.net`。后两者用于 GitHub Actions 日志的签名下载重定向；实际下载仍受宿主每跳校验，非声明域名会被拒绝并记录为缺失。
- PAT 只注入 `api.github.com`。日志下载域不接收 GitHub PAT；插件代码不能从凭证库读回明文。
- 设置页将输入一次性交给 `/secrets/github_pat`，只查询 `saved`，不显示 token 指纹、不向广播/KV/日志发送 token。
- `/kv` 由逻辑页单写，保存 ≤12KB 的列表缓存、最多 16 条最新分析回执和未确认请求的冻结正文；总写入 ≤62KB。缓存裁剪会注明缺失，重新打开一律标记陈旧并刷新。所有持久化完成后才进入有副作用的任务操作。
- 日志优先保留最后最多 10 处 runner 错误，其次普通错误，先为诊断行预留空间再补上下文；无匹配时选末尾最多 35 行。每 job 最多 2000 字节、单行最多 600 字节，任何省略均标记截断。最多检查 5 个同 SHA run、收集 8 个当前失败 job，进一步压缩任务正文时仍保留截断标记。原始完整日志不持久化；未确认交接会暂存脱敏摘录供同键恢复，受理后清除正文。
- 常见 GitHub token、Bearer、敏感键值和签名 URL 参数会脱敏，但不宣称能识别业务日志中所有秘密。提交验收截图时仍需人工审查，不上传完整日志。

## CI 聚合规则

1. 已取得的任一 check 是 `failure/timed_out/action_required/startup_failure`，或 commit status 为 `failure/error`：失败；同时保留数据是否完整。
2. 尚无失败但任一来源报错、达到分页上限或 SHA 不匹配：获取失败。
3. 完整数据中有未完成 check 或 pending status：运行中。
4. 完整且两类检查都为空：无检查。
5. 完整且非空、每个 check 和 status 都是 success：通过。
6. 其余显示其他结论，保留 cancelled/skipped/neutral/stale 等原值，绝不作为通过。

Commit statuses 按 context 保留最新结果。checks 的 `filter=latest` 仍可能返回不同 check suite 的历史运行：存在同名 Actions 检查时，额外读取同 SHA 的 run 元数据，按 workflow ID、事件、分支、关联 PR 和 check 名称选择最新 run_number，返回 `supersededCheckCount` 说明排除数量。不同 workflow、事件或 PR 的同名检查分别保留；元数据无权限或不完整时保留原证据并标记 `CHECK_HISTORY_UNRESOLVED`，不猜测通过。无重复检查时不增加 Actions 请求。这是当前 head SHA 的检查概览，**不是 GitHub branch protection 的可合并性判断**。

Actions job 的 checkId 来自本仓库 API 的 `check_run_url`，runId/jobId 来自各自响应，不能互相代用。只接受匹配 PR head SHA 且对应当前失败 check 的 job；同 SHA 的历史 check/job 不混入本次证据。run 尚在运行或允许 job 失败时，也按当前失败 check 精确映射，不只看 run 结论。某些 PR CI 实际运行在 merge SHA、外部 CI 或权限不足时，可能无法取得 Actions 日志；保留 check 输出和原始链接，并明确列入缺失，不挪用其他 SHA 的日志。

## 验证方式

无需安装依赖，开发验证使用 Node.js ≥20：

```sh
npm run check
npm test
```

行为测试通过真实生产入口 `GitHubClient`、`Handoff`、`StateStore`、`createRouter/createRequester`，注入离线 HTTP/任务回执/存储。覆盖 CI 聚合、HTTP 错误、分页/部分失败、真实 callId 传递、SHA 一致性、check/run/job 区分、日志脱敏/截断、重复提交、受理丢回执、revision 和持久化失败。新增测试还覆盖成功汇总挤占错误摘录、长行与多字节预算、历史/异仓 job、运行中或允许失败的 run、日志 403、run/job 数量上限。不读取用户凭证、不访问业务外网、不做真实等待；CI 使用 Node 20 和 22。

受控失败样本必须同时满足 draft PR 和正文标记 `[B1_CI_FAILURE_SAMPLE]`；该步骤显式 `continue-on-error:false`，不会掩盖真实检查结果。workflow 监听正文编辑及 draft 状态转换，因此移除标记后可自动产生新的正常检查。仅编辑正文不会改变 head SHA，历史失败 run 会保留；通过上述 run 元数据区分历史检查，不把旧失败算作当前缺陷。新增回归测试覆盖恢复通过、运行中、跨 workflow/事件/PR 同名检查及元数据缺失。

```sh
node scripts/preview.mjs
```

该服务器仅绑定随机 loopback 端口，页面显式标注**离线模拟数据**，用于 Light/Dark、320px、HTML 转义和广播交互的浏览器验证。它不是 Cindy 运行，也不能替代真实验收截图。Ctrl-C 停止。固定夹具在 `tests/browser-host.js`，不会成为生产入口。

## 报错与恢复

| 表现 | 依据与处理 |
| --- | --- |
| HTTP 401 | PAT 无效/过期；在设置替换，再刷新。 |
| HTTP 403 | 权限、组织/SSO 或限流可能导致；不能只凭 403 判断原因。检查凭证与 GitHub 页面。 |
| RATE_LIMITED / HTTP 429 | 遵守服务端 Retry-After；宿主不透传 x-ratelimit 时不编造重置时间，不自动循环重试。 |
| 无 PR | 仅说明授权范围内未找到我创建且仍打开的 PR，不代表 GitHub 上所有仓库均可见。 |
| 无检查 | 完整空检查；与权限失败不同。 |
| HEAD_CHANGED | 刷新后针对新 SHA 分析；不发送旧证据。 |
| 无 job/日志、404、重定向域名拒绝 | 详见证据的 missing；外部 CI、merge SHA、日志过期或 Actions 读取权限不足均可能导致。检查原始链接；不猜 ID。 |
| PERMISSION_DENIED | 查看插件详情的任务权限和模型/任务设置；不循环弹批准，也不绕过为另一种接口。 |
| 受理结果待确认 | 点“恢复原请求”，只用已保存的 create/send 键、正文、revision；不换键盲重发。 |
| reconciling | 在原任务核对实际执行，继续查询原 run；不自动再启动一轮。 |
| failed/cancelled/interrupted | 可在任务中恢复模型连接/查看原因；明确点击“重新分析”才创建新输入，继续复用原任务并读最新 revision。 |
| 打开后无响应 | 看宿主插件运行状态；检查 `/wake` 与脚本加载。面板请求有 ACK 超时和响应超时，不将其显示为成功。 |

## 未完成项

真实 GitHub 列表/CI 对照、真实点击后 AI 分析与截图目检的结论以 [`../validation/acceptance.md`](../validation/acceptance.md) 为准；离线测试不代替这些结论。宿主 Light 模式目检与跨应用重启恢复仍未验证。暂不支持结果回填、仓库代码读取、自动修复、定时刷新或通用 GitHub 写操作。
