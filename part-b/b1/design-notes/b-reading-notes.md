# 每日单词卡阅读笔记

我从“十个词生成工作场景例句”这个需求出发，先判断是否需要完整 Agent，再看插件接口、配置和调用边界。这里整理原笔记中的判断与疑问；调用链和规则修正由 AI 辅助静态核对，尚未实际运行插件。

## 先判断需要哪种模型能力

这个任务的输入可以由插件直接提供：十个单词，以及用户选择或填写的工作场景。我倾向于使用 oneshot_text。它用于一次文本回答，不包含工具执行，也不能自行查看用户文件。原笔记里“任务很轻”的判断，应落实为“已有足够输入，只需要文本生成”。

oneshot_text 是请求的 kind；oneshot 是 manifest 中声明的动作；handleOneshotText 是宿主处理方法。三者属于同一能力的不同位置，不应混成一个同名函数。

## 声明与请求怎样对应

ghost.json 中的能力片段如下，完整 manifest 还需要身份和入口等字段。

```json
{ "cindy": { "text": ["oneshot"] } }
```

下面是调用示意，不是已运行代码。words、workScene 由插件业务提供；若由工具调用触发，再按契约加入 callId: msg.callId。

```js
const result = await cindy.send({
  type: 'cindy-request',
  kind: 'oneshot_text',
  prompt: `为这些单词生成 ${workScene} 场景例句。
只回 JSON 数组，每项含 word 和 sentence：${words.join(', ')}`,
  expectJson: true,
});
```

先判断 result.ok，再解析 result.text。宿主只验证 JSON 可解析，插件仍需检查数组长度、字段类型、单词是否完整且无重复、例句是否为空。模型返回的字符串不是业务验收结果。

## 我用哪些文件定位

作者契约位于 apps/desktop/resources/system-skills/cindy-plugin-creator/references/plugin-runtime.md §4.0.2。声明类型见 packages/plugin-protocol/src/manifest.ts 的 GhostCindyNeeds；实际处理见 apps/desktop/src/main/cindy-brain/cindySlot.ts 的 handleOneshotText。按符号定位比只保留行号更容易应对后续代码变化。

## 沿宿主调用链继续读

```text
插件逻辑页 cindy.send(...)
  → ghostPreload.ts 的 ghost-pipe:send
  → cindy-brain/index.ts 核对来源并分派
  → cindySlot.ts 的 handleModelRequest
  → handleOneshotText
  → index.ts 注入的 oneshotText
  → oneShotCandidates.ts 的 requestUtilityText
```

ghostPreload 暴露最小 cindy 桥，宿主按发送页面反查真实插件身份。处理器核对状态、声明与参数后选择模型路由，最后沿原 IPC 请求返回结果。浏览器逻辑页的 main.js 并不是 Electron Main。

对应路径为 apps/desktop/src/preload/ghostPreload.ts；apps/desktop/src/main/cindy-brain/ 下的 index.ts、cindySlot.ts；apps/desktop/src/main/utility-model/oneShotCandidates.ts。这条链由 AI 辅助定位，不能据此声称我已逐行读完全部实现或验证每种供应商。

## 把模型连接与业务设置分开

模型连接和凭证优先复用 Cindy 配置。插件可以提供工作场景、难度等业务偏好，它们可保存在 /kv；模型是否可用、费用由哪条通道承担，是另一个问题。

文本选模依次是用户显式选择、可解析的 oneshotModel 声明、系统辅助模型链。仅声明 oneshotModel 不保证目标模型可用，也需考虑旧宿主兼容性。第一版可以不声明固定偏好，先复用宿主默认通道。

没有可用候选时可返回 NO_CANDIDATE；但不能把所有凭证、网络或执行错误都归成这个错误。显式选择的通道失败时不静默换路；实际账号和供应商行为还需运行验证。

## 每日更新是否需要后台定时

原笔记提出 resident 加定时器或 agent.schedule。这里先拆开需求：若每天第一次打开时出现新卡片即可，检查日期和缓存就够了；如果要求关闭界面后仍在指定时间生成，才需要进一步研究宿主调度与生命周期。

当前不把某种定时方式写成官方推荐，也不声称后台生成已经实现。十个词可以合并为一次有界请求；请求质量、缓存内容大小和过期方式仍需通过实际实现确认。

## 对单独填写 OpenAI Key 的判断

我不采用这个方案。文本能力已由宿主提供，重复收集 Key 会增加用户配置成本。当前规则还明确要求模型推理走 Cindy 统一通道：docs/dev-rules/plugin-security-and-authoring.md 的模型调用约束是直接依据，不只是产品风格上的偏好。

不能把网络能力当作绕过推理通道的许可。一般第三方服务可以按声明走宿主代发和托管凭证；这不改变模型推理的专门规则。

## 原笔记中需要修正的表述

| 原表述或待确认问题 | 修正后的理解 |
| --- | --- |
| fetch 自然不可用 | 浏览器页没有通用外网直连，但 fetch('/kv') 等同源接口可用；逻辑页有 cindy 桥，面板没有特权桥。 |
| Node 连接就一定明文暴露 Key | Node 工作进程有用户级能力，但仅凭这个事实不能断言 Key 必然进入 Worker。要看具体的凭证绑定与数据流。 |
| 只连接订阅时能否调用 | 宿主必须有当前请求可用的模型通道；连接、额度、网络与执行成功是不同条件。 |
| 每天生成必须常驻或定时 | 先确定是否需要后台按时执行；按打开日期更新是更小的可选方案。 |
| AI 只做语言和结构 | 本次还用 AI 辅助核对接口、路由和规则，应如实记录，不写成纯润色。 |

## 凭证与运行边界

/kv 适合普通业务参数，不保存明文密钥。第三方服务凭证按 network.secrets 等声明走宿主托管；/secrets 是受控写入和状态查询通道，不是读取完整密钥的接口。插件设置页也不能因此被当作可信的任意外网环境。

依据为作者手册 plugin-settings.md §4.8、plugin-network.md §4.7，以及 docs/dev-rules/plugin-security-and-authoring.md §2–3。作者手册的完整目录为 apps/desktop/resources/system-skills/cindy-plugin-creator/references/。

## 尚未验证的部分

这次没有启动 Cindy、安装或运行单词卡插件、执行单测或调用真实模型。没有确认特定账号只连接订阅时的路由结果，也没有测量价格、耗时或每日调用额度。当前目录未锁定源码 commit，执行宿主版本也需后续核对。

下一步应实际检查正常生成、缺模型、超时、错误 JSON、结果不足十词，以及同日重复打开能否命中缓存。完成后再记录命令、结果与差异；这些仍是计划，不是已通过的测试。
