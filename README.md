# Cindy AI 工程实习生笔试提交

本仓库为 Cindy AI 工程实习生笔试的独立提交仓库。材料按 Part 0 / Part A / Part B 分题目、小题排布：

```
part0/          Part 0：项目导览、每日单词卡方案、提交记录与阅读笔记
part-a/         Part A：A1 日期参照问题、A2 排查报告审阅
part-b/b1/      Part B B1：我的 PR 看板（设计、插件源码、截图、验收）
part-b/b2/      Part B B2：收工 Skill、设计说明、整理笔记与原始输入
```

## 正式答案

| 部分 | 题目 | 材料 |
| --- | --- | --- |
| Part 0(a) | 项目导览 | [阅读](part0/0a-project-guide.md) · [下载](part0/Cindy项目导览_修订版.docx) |
| Part 0(b) | 每日单词卡方案 | [阅读](part0/0b-word-card-plan.md) · [下载](part0/每日单词卡插件方案_修订版.docx) |
| Part 0(c) | 提交记录 | [阅读](part0/0c-submission-record.md) |
| Part A A1 | 日期参照问题 | [答案](part-a/a1-date-context/a1-time-context-answer.md) · [下载](part-a/a1-date-context/A1日期参照问题_最终提交版.docx) · [笔记](part-a/a1-date-context/a1-reading-notes.md) |
| Part A A2 | 排查报告审阅 | [答案](part-a/a2-report-review/a2-report-review-answer.md) · [下载](part-a/a2-report-review/A2排查报告审阅_最终提交版.docx) · [笔记](part-a/a2-report-review/a2-reading-notes.md) |
| Part B B1(a) | 我的 PR 看板设计 | [阅读](part-b/b1/b1-pr-dashboard-design.md) · [设计笔记](part-b/b1/design-notes/b1-design-notes.md) · [制作任务](part-b/b1/make-task.md) |
| Part B B1(b) | 插件实作与验证 | [源码与说明](part-b/b1/plugin/README.md) · [截图](part-b/b1/screenshots/) · [验收记录](part-b/b1/validation/acceptance.md) |
| Part B B2(a) | 收工 Skill | [SKILL.md](part-b/b2/end-of-work/SKILL.md) |
| Part B B2(b)(c) | 固定动作与 AI 判断、Skill 与插件的选择 | [答案](part-b/b2/answer.md) · [整理笔记](part-b/b2/notes.md) · [首次验证](part-b/b2/validation/agent-execution/README.md) · [修订后重测](part-b/b2/validation/agent-retest/README.md) · [原始输入](part-b/b2/raw/request.md) |

## B1(b) 插件速览

「我的 PR 看板」为 Cindy 第三方插件（`lyz-pr-dashboard` v1.0.2）：右侧栏展示当前 PAT 授权内我创建的 open PR 与 CI 状态；点击失败 PR 的「分析 CI」自动采集该 head SHA 的失败证据并交给 AI 分析。53 项自动化测试，本地复跑通过；CI 配置覆盖 Node 20/22，见 [.github/workflows/pr-dashboard.yml](.github/workflows/pr-dashboard.yml)。

已提供 [1.0.2 安装包](part-b/b1/plugin/lyz-pr-dashboard-1.0.2.cindy)。新版调整了 CI 徽标和卡片层次；尚未安装到 Cindy，双主题预览不能代替新版实机验收。包哈希、源码一致性及验证范围见 [1.0.2 交付核对](part-b/b1/validation/release-1.0.2.md)。此前 1.0.1 的真实运行截图和闭环记录继续保留，不作为 1.0.2 已安装的证明。

## B2 收工 Skill 与实际结果

用户说“收工”后，按“定范围 → 跑测试 → 审阅 → 扫描 → 摘要”执行。流程、扫描边界、记录字段和摘要模板固定；具体测试选择、代码用途和失败原因交给 AI 理解。完整文件见 [SKILL.md](part-b/b2/end-of-work/SKILL.md)，设计说明与[最后的结论](part-b/b2/answer.md#最后的结论)见正式答案。

已用 Codex CLI 和 Claude Code 做两轮、共 **8 个独立会话**的实际验证。Claude Code 当前配置的模型为 DeepSeek，不代表 Claude 模型验收；Pi 和自动触发尚未测试。

| 验证阶段 | 结果 |
| --- | --- |
| [首次四轮验证](part-b/b2/validation/agent-execution/README.md) | 能运行测试、区分正常与失败、识别暂存区和未跟踪文件中的残留；但 Claude Code 出现先审阅后测试，以及把未改文件计入扫描命中的问题。 |
| [修订后四轮重测](part-b/b2/validation/agent-retest/README.md) | 加入读取边界、命中准入和阶段记录后，原先顺序与最终命中范围问题在本轮样例中未复现；但仍有阶段记录晚写，以及宣称审阅完成时缺少完整差异阅读证据的问题。 |

目前它能辅助收工，但还不能保证每一步都严格执行，结果仍需人检查。这也可能与设计主要依赖 AI 自觉遵守有关。后续计划用小脚本核对改动清单、扫描范围和测试记录，让 AI 负责理解与解释；该方案尚未实现，不能把 AI 说“完成了”直接当作验收通过。两轮执行前后的样例文件、HEAD、暂存区和 Git 状态均未变化。

## 提交约定

每个部分分多次提交，commit 信息写明该次添加的内容；提交均带 DCO `Signed-off-by`。`part-b/b1/screenshots/` 内均为裁剪后仅保留插件面板/分析正文的版本。

各题的 raw 保存实际收到的原始材料。B2 已保留[个人思考原稿](part-b/b2/raw/design-original.md)、[指定的 Skill 底稿](part-b/b2/raw/provided-skill-original.md)、题面和后续修订要求；[整理笔记](part-b/b2/notes.md)说明用户与 AI 的分工，正式文件位于 end-of-work/ 和 answer.md。
