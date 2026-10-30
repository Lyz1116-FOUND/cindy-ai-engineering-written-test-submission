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

「我的 PR 看板」为 Cindy 第三方插件（`lyz-pr-dashboard` v1.0.1）：右侧栏展示当前 PAT 授权内我创建的 open PR 与 CI 状态；点击失败 PR 的「分析 CI」自动采集该 head SHA 的失败证据并交给 AI 分析。53 项自动化测试（Node 20/22），CI 见 [.github/workflows/pr-dashboard.yml](.github/workflows/pr-dashboard.yml)。

安装包（`.cindy`）暂未随仓库发布，可由 Agent 通过宿主 Forge 从 `part-b/b1/plugin/` 源码目录安装。

## 提交约定

每个部分分多次提交，commit 信息写明该次添加的内容；提交均带 DCO `Signed-off-by`。`part-b/b1/screenshots/` 内均为裁剪后仅保留插件面板/分析正文的版本。

各题的 raw 保存实际收到的原始材料。B2 已保留题面、用户个人思考及指定的 Skill/答案底稿；整理笔记说明用户与 AI 的分工，正式文件位于 end-of-work/ 和 answer.md。
