# 宿主版本核验

核验于 2026-10-29（Asia/Tokyo）。

| 事实 | 实际结果 |
| --- | --- |
| `cindy_helper.check_app_update`（只读） | currentVersion `0.1.120`，未请求升级 |
| 安装资源 `cindy-source.json` | sourceCommit `b3dd8436228135aa8be9827d204e4e5eaf9316b4`；builtAt `2026-10-29T00:19:45.253+08:00` |
| 查询构建 commit | GitHub HTTP 422，`No commit found for SHA: b3dd8436228135aa8be9827d204e4e5eaf9316b4` |
| `git ls-remote --tags` | `refs/tags/v0.1.120` → `b0c217c98b2346bb32a34821241992ba52918a86`；与构建 commit 不同 |
| 本地参考快照 | 无 `.git` 元数据，不能证明与安装构建匹配 |
| 实际安装包 `ghostPreload.js` 只读静态检查 | 暴露 fetch 与 tasks.capabilities/create/get/send/getRun/listRuns/readMessages 等公开方法 |
| 实际安装包 `bootstrap-electron-BQG0kPOv.js` 只读静态检查 | 含 `tasks-request` validator、`handlePluginTaskRequest`、`experimental:true`、operations 列表、独立任务能力批准和服务未就绪错误 |
| 运行探测 | 安装后每次提交前由插件实际调用 capabilities；实际受理另见 acceptance |

依据顺序：实际构建 → 随宿主发布的 Creator 作者契约 → 运行结果。官方 tag 仅作交叉参考，未冒充构建源码。

已按官方 tag 获取并阅读同一 commit 的 public preload、manifest/validator、networkSlot、taskSlot/taskCapability、agentSlot、errandSlot、index 派发、forge、主题，以及相关网络/任务测试，未执行这些宿主测试。

交叉参考链接：

- [public preload](https://github.com/makecindy/cindy/blob/b0c217c98b2346bb32a34821241992ba52918a86/apps/desktop/src/preload/ghostPreload.ts)
- [taskSlot](https://github.com/makecindy/cindy/blob/b0c217c98b2346bb32a34821241992ba52918a86/apps/desktop/src/main/cindy-brain/taskSlot.ts)
- [taskCapability](https://github.com/makecindy/cindy/blob/b0c217c98b2346bb32a34821241992ba52918a86/apps/desktop/src/main/cindy-brain/taskCapability.ts)
- [networkSlot](https://github.com/makecindy/cindy/blob/b0c217c98b2346bb32a34821241992ba52918a86/apps/desktop/src/main/cindy-brain/networkSlot.ts)
- [面板主题](https://github.com/makecindy/cindy/blob/b0c217c98b2346bb32a34821241992ba52918a86/apps/desktop/src/renderer/cindy-brain/ghostPanelTheme.ts)
- [GitHub checks API](https://docs.github.com/en/rest/checks/runs)
- [GitHub Actions jobs / 日志 API](https://docs.github.com/en/rest/actions/workflow-jobs)

插件仅调用 `cindy` 公开 API 和公开同源端点；不导入上述宿主内部模块，不发送内部 IPC，不修改安装资源。
