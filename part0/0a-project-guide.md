# Cindy 项目导览

Cindy 是连接用户、设备、Agent 引擎和模型的 AI 工作客户端。模型负责生成，Agent 引擎组织上下文与工具执行，Cindy 提供界面、宿主服务和多端连接。本仓只包含桌面端、手机端及共享包；服务端在独立仓库。

## 主要组成

| 位置 | 职责 |
| --- | --- |
| apps/desktop | Electron 桌面端。renderer 绘制界面，preload 暴露受控接口，main 承担系统能力、持久化与 Agent 接入。 |
| apps/mobile | Expo / React Native 手机端，提供移动交互及对桌面设备的远程访问。 |
| packages/maker-core | Agent 抽象与任务编排。通过宿主注入的接口使用存储、日志等能力，不反向依赖 Desktop。 |
| 其他 packages | device-link 提供跨设备协议；model-providers 管理供应商目录与路由抽象；plugin-protocol 定义插件契约。 |
| docs、scripts、tools | 产品与工程规则、校验脚本，以及随包工具的版本管理。 |

模块依据：docs/dev-rules/repo-map.md；进程边界：docs/dev-rules/electron-security-and-process-boundaries.md。

普通消息的简化路径是 Renderer → preload → Main → maker-core Session → 具体 Agent 引擎。数据库、插件运行时和远控由宿主接入；package 的组织边界不等于独立进程。

## 插件可以请求的宿主能力

插件以 .cindy 打包，用 ghost.json 声明能力。下面的文件名均相对于插件作者手册目录：
apps/desktop/resources/system-skills/cindy-plugin-creator/references/

| 能力 | 用途与依据 |
| --- | --- |
| 存储 | /kv 保存小参数；fs 提供私有文件；library 保存用户作品。见 plugin-settings.md、plugin-files-and-library.md。 |
| 联网与凭证 | 通过宿主代发请求、托管凭证；在途工具调用与自主联网的条件不同。见 plugin-network.md。 |
| 文本生成与 Agent | oneshot_text 用于无需工具的一次文本回答；需执行工作时按任务接口交给 Agent。见 plugin-runtime.md §4.0.2、plugin-agent-tasks.md。 |
| 界面与事件 | 提供面板、聊天卡片与事件订阅。见 plugin-panels.md、plugin-chat-cards.md、plugin-event-subscriptions.md。 |

浏览器逻辑页经 cindy 桥请求宿主，面板没有特权桥；声明 node 的插件另有独立 Node 工作进程。能力在运行时仍需校验。依据：docs/dev-rules/plugin-security-and-authoring.md §2–3。

## 我是怎么读的

我先读 README 和 AGENTS.md 确定范围，再用仓库地图定位模块，随后集中看插件声明与作者手册。AI 帮我检索文件、补充能力清单和整理文字；我重点理解 fs 与 library 等区别。调用链由 AI 辅助静态核对。本次没有通读全部实现，也没有启动应用或运行测试。
