# B1 我的 PR 看板：设计整理与核对笔记

原始想法见 [原稿](../raw/b1-design-original.md)，正式答案见 [B1(a)](../../answers/b1-pr-dashboard-design.md)，交给 Cindy 的制作任务见 [执行文档](../../tasks/cindy-b1-pr-dashboard.md)。本笔记记录完善过程，不代表插件已经实现。

## 保留的设计

采用可关闭、可重新打开的看板。用户不必先启动 Agent 就能查看 PR；需要诊断时，再把选中 PR 的证据交给 AI。插件负责 GitHub 数据接入、状态映射和展示，AI 负责结合日志、必要的 diff 解释原因。

第一版先做打开后加载、手动刷新、PR 列表、CI 状态和点击后交给 AI。自动轮询、OAuth 接入、分析结果回填面板、自动修复不作为最小闭环的前提。

## 原始想法中的修正

| 原先的表述 | 核对后的理解 | 本地依据 |
| --- | --- | --- |
| 纯工具会历史遗忘 | 工具也能读写持久数据。选择面板是因为需要独立入口、并列浏览、刷新和交互；存储与呈现分开考虑。 | `plugin-panels.md`、`plugin-settings.md` |
| 两种联网都要提前声明域名 | 自主联网需要域名白名单；在真实 Agent tool-call 内带 `callId` 的普通 HTTPS 请求可以不预声明域名。托管凭证及注入域名仍须声明。 | `plugin-network.md` §4.7 |
| 不反复询问，所以 AI 可以自行完成 OAuth | 复用已有授权不等于替用户授权。OAuth 需要真实应用和用户同意。第一版选用户 PAT，由宿主收单、保存、注入。 | `plugin-network.md`、产品原则 |
| 可以照用宿主 gh 登录态 | `source:"gh-cli"` 是官方 `cindy-github` 保留能力，自定义插件不能照用。 | `plugin-network.md` §4.7；`shared/ghost.ts` validator |
| 按结果显示在聊天还是面板选择 run / errand | 先判断调用来源：已有 Agent 工具调用直接返回；关联卡片交互使用 run；独立面板使用实际宿主支持的独立任务接口。 | `plugin-agent-tasks.md` §4.11 |

上表中的作者文档均位于 Cindy 源码的 `apps/desktop/resources/system-skills/cindy-plugin-creator/references/`。

## 进一步核对：不能把本地 API 当成已发布能力

作者文档 §4.11.3 推荐新插件通过 `cindy.tasks.create/send` 创建普通任务，但 `docs/dev-rules/plugin-task-api-implementation.md` 开头同时写明：**“状态：实验接口，尚未发布。”**

因此，“本地有 tasks 实现”只能证明这份源码含有该接口，不能证明实际安装的 Cindy 可用。先前 AI 将它直接推荐为实现路径，说得过于确定，此处修正。

制作前必须核对执行插件的宿主版本、对应 tag/commit 和公开能力。确认支持 tasks 后才使用，并声明 `agent.tasks: true`；否则核对该版本是否支持公开的 `agent.errand/queryErrand`，作为兼容实现。若两者均不可用，如实记录阻塞，不能把复制提示词或只打开链接描述为“AI 已接手”。

`agent.run` 要满足真实点击票、任务关联和模板契约，不能拿独立面板按钮伪造票据。`agent.errand` 虽是旧接口，但是否适用应以实际宿主契约为准，不能只因本地新接口存在就排除它。

## 证据与状态边界

- PR 列表第一版定义为“授权范围内，我创建且尚未关闭的 PR”；待我审阅可作为后续分类。处理分页，不能把首屏称为全部。
- 绑定仓库、PR 编号和当前 head SHA；检查记录、日志和后续分析都保留该 SHA，避免混用旧提交结果。
- 聚合状态至少区分通过、失败、运行中、无检查、获取失败，并保留取消、跳过等原始结论，不能把空列表当通过。
- check ID、Actions run ID、job ID 分别来自对应响应，不能互相猜测。外部 CI 不一定提供 Actions 日志。
- 日志有截断标记和来源链接；无权读取、未取得、尚未完成都应明确展示。403 等错误不能伪装成“没有 PR”。
- AI 输出区分观测、可能原因和待核实项。单次失败不足以证明 flaky；自动修复和重跑不属于本次分析动作。

## 本地阅读顺序与验证范围

先读插件作者 Skill 和版本核验要求，再读产品原则、面板、网络凭证与任务交接文档；随后对照 `manifest.ts`、`shared/ghost.ts`、`ghostPreload.ts`、`networkSlot.ts`、`taskSlot.ts` 等协议与实现位置。完整绝对路径、对应测试及阅读顺序写在制作任务中。

AI 参与了源码检索、文档对照、设计修正和本次材料编排。本轮仅做静态核对；本地源码目录没有 Git 元数据，未锁定其上游 commit，也未核验实际宿主版本、运行插件或执行业务测试。截图和运行结论须在后续实作后补充。
