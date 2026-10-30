# 1.0.2 交付核对

核对日期：2026-10-30。对应源码提交 `76f67f6af20216e6e4f2e97c39dbbcd5996d1f48`。

## 产物与代码

- 安装包：[lyz-pr-dashboard-1.0.2.cindy](../plugin/lyz-pr-dashboard-1.0.2.cindy)，51,877 字节。
- SHA-256：`63da87becb4a31e61c7821c11dca40b230799ebc13379778e08a75aa02420648`。
- 已解包核对 manifest：插件 ID `lyz-pr-dashboard`，版本 `1.0.2`。
- 已逐字节核对包内 ghost.json、panel.js、panel.css、main.js、github.js、handoff.js、state.js、transport.js，与该提交源码一致。这是产物一致性检查，不等于 Forge 校验或安装成功。

## 本轮实际验证

在插件目录执行 `npm run check`，退出 0；执行 `npm test`，53 项通过、0 失败、0 跳过，退出 0。未新增或弱化测试。此轮使用本机 Node，不把它描述成新提交的远端 Node 20/22 CI 结果。

制作会话报告已完成 Dark/Light 的离线视觉预览，改动包括状态徽标、PR 卡片层次和主题配色。本轮没有独立打开该预览；`76f67f6` 只提交了源码和安装包，没有新增那四张视觉预览截图。因此不将制作会话的预览报告当作本轮目检证据。

## 运行边界

**2026-10-30，1.0.2 已通过 Forge 原位更新安装到用户 Cindy**（`action:updated`，配置与数据保留），并完成实机闭环验收：面板刷新 1/1 条、失败徽标与 Draft 徽章正确显示、点击「分析 CI」派发任务（taskId `04fb2aee-…`、runId `e0d9d70d-…`），证据 SHA `f15522a879ce` 与 PR head 一致，截图 05 记录的是“已受理 · 等待执行”状态；AI 随后输出 final_answer，完成情况由任务回执证明。详见[验收记录](acceptance.md)第 4 节与 [release-1.0.2-controlled-run.json](release-1.0.2-controlled-run.json)。

仍未验证项：宿主 Light 模式目检、跨应用重启恢复。

## 提交与目录

远端 `76f67f6` 的直接父提交为 B2 文档更新 `7eefaa4`，已包含 B2 实测、结论和导航。此次文档核对从该远端状态快进同步，只修正文档，不覆盖其他目录的未提交草稿，也不重写已有历史。
