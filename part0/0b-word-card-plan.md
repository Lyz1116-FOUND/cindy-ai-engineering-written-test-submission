# 每日单词卡插件方案

我会复用 Cindy 的 oneshot_text，为十个单词生成贴近用户工作场景的例句。插件负责单词卡流程、结果校验和缓存，模型路由与凭证交给宿主，不要求用户另填 OpenAI API Key。

## 怎样生成例句

输入已有十个单词和用户提供的场景，只需生成文字，适合快问快答。它无需工具，也不会读取用户文件或创建普通任务。插件在 ghost.json 中声明 cindy.text 包含 oneshot，再通过 cindy.send 发送 type 为 cindy-request、kind 为 oneshot_text 的请求。

宿主核对插件身份、能力声明与参数，选择模型通道并返回文字或结构化错误。若请求由 Agent 工具调用触发，应携带该次 msg.callId 归因。接口与调用示例见作者手册 plugin-runtime.md §4.0.2；处理实现见 apps/desktop/src/main/cindy-brain/cindySlot.ts 的 handleOneshotText。

## 用户需要额外配置什么

| 配置 | 处理方式 |
| --- | --- |
| 宿主模型通道 | Cindy 需要有可用文本通道与授权。已可用时直接复用；没有可用候选时提示配置，不保证仅登录就能调用。 |
| 插件专用 API Key | 本题不需要。模型凭证由宿主管理，不在插件设置或 /kv 中重复收集。 |
| 插件模型偏好 | 可选。优先使用用户显式选择，其次是可解析的 oneshotModel 声明，最后是系统辅助模型链。 |
| 工作场景与更新 | 场景、难度等是业务偏好。先在打开时检查日期和缓存；若确需定点后台生成，再设计调度与失败恢复。 |

不另填插件 Key 不代表免费或模型始终可用。用户显式选定的通道失败时应如实返回，不悄悄切换其他付费路由。配置与选模依据为 plugin-runtime.md §4.0.2、plugin-settings.md §4.8。

## 为什么不在设置页填 OpenAI Key 后直接调用

这会重复增加 Key 申请、模型选择和故障处理的负担，也偏离宿主已有模型路由。更直接的依据是 docs/dev-rules/plugin-security-and-authoring.md 明确要求模型调用走 Cindy 统一通道，不允许插件自建绕过通道的推理请求；声明 Node 或网络能力也不是豁免。

浏览器插件页没有通用外网直连，但同源 fetch('/kv') 等接口仍可用，逻辑页也有受控的 cindy 桥。若插件确需访问非推理的第三方服务，应按网络和凭证契约接入；/kv 不存明文密钥。依据为 plugin-network.md §4.7、plugin-settings.md §4.8。

## 最小流程与失败处理

十词与场景 → 查询当日缓存 → 请求 oneshot_text → 解析并校验十条结果 → 保存并展示。expectJson 只检查 JSON 可解析，插件还要检查字段、十词完整性、重复和空例句。没有模型、超时或输出错误时保留明确状态，不无限重试，也不伪造结果。

以上是方案，尚未实现或运行。本文简称的作者手册文件均位于 apps/desktop/resources/system-skills/cindy-plugin-creator/references/。产品取舍另依据 docs/product-rules/core-product-principles.md §2–3。
