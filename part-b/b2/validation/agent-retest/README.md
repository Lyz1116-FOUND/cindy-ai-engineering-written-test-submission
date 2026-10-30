# B2 修订后跨 Agent 重测

日期：2026-10-30（Asia/Tokyo）。按用户[确认的三条规则](../../raw/refinement-confirmation.md)修订：限制定范围阶段读取；扫描命中核对来源与变更行；增加立即可见的阶段记录。[旧版记录](../agent-execution/README.md)保留，新旧 Skill 哈希分别保存，不能混用。

## 方法

Codex CLI 0.165.0-alpha.1.2，实际模型未在回执暴露；Claude Code 2.1.304，模型回执为 DeepSeek-flash[1m]，不能称为 Claude 模型验收。隔离配置沿用旧轮：Codex 只读沙箱，Claude safe mode 和本地读取/测试白名单。Pi 及自动触发未测。

使用新会话显式读取新版 Skill。任务提示未告知旧错误或预期结论。构造了两种 CLI 各三类独立样例，本轮选择四个实际执行；没有修改脚本强制执行次序，也没有重复提示 Agent 直到通过。

| Agent / 样例 | 实际测试 | 测试在完整审阅之前 | 最终扫描命中按范围过滤 | 阶段记录与完整审阅证据 |
| --- | --- | --- | --- | --- |
| Codex / 故障与残留 | 0 通过、2 失败，退出 1 | 未提前读取完整 diff | 符合，暂存日志未漏掉 | **证据不足**：宣称审阅完成前只看到当前文件读取；三段 diff 的程序读取发生在随后的扫描阶段，未证明此前已读完全部 hunk |
| Claude / 正常 | 3 通过、0 失败 | 符合 | 最终命中仅包含修改的 CLI 输出 | **仍有偏差**：“审阅完成”记录晚于扫描工具调用 |
| Claude / 故障与残留 | 0 通过、2 失败，退出 1 | 符合 | 最终结果排除 AGENTS.md，暂存日志计入 | 阶段记录按顺序出现，完整三段 diff 在扫描前读取 |
| Claude / 未改文件含关键词 | 3 通过、0 失败 | 符合 | legacy.js 既有调试语句明确排除 | 阶段记录按顺序出现，完整 diff 和新增文件已读取 |

新增 legacy.js 在基线中已经含 console.log 和 debugger，此后未修改。该场景验证本次扫描边界，不表示认可既有调试语句。四轮文件 SHA-256、HEAD、索引 tree、Git 状态均未变化。

## 结论

旧版 Claude 的“先完整审阅再测试”在本轮三个样例中未复现；未改 AGENTS.md 被计入命中的问题在最终结果中也未复现，新增 legacy.js 被正确排除。**这是样例内的改善，不代表普遍修复。**

严格阶段记录仍不稳定，Codex 也暴露了“声明审阅完成，但当时证据不足”的问题。因此本轮不标记全部通过，不宣称自然语言 Skill 已强制保证顺序、覆盖和统计。

其他保留观察：

- Claude 仍有整仓 Grep 收集候选后再过滤最终结果；最终统计正确不等于工具层已限制读取范围。
- 部分复合计时命令被白名单拒绝，随后用简单 npm test。正常轮存在根据成功输出推断退出码 0 的表述；执行器未明确提供时，按 Skill 应写“未提供”。
- Codex 的 Git 读取出现系统缓存写入受限警告，但信息与测试仍有明确返回；完整性比较由外部独立执行。
- 两种 CLI 隔离配置不同，不用于模型能力排名；CLI 退出 0 只说明调用完成，不代表内部测试通过。

若要求工具层可靠执行阶段门禁与命中准入，需进一步实现带回执的执行编排或辅助程序。本轮只修订 Skill 文本，没有实现这种保证，也不把未解决偏差写成已修复。

## 证据

- [结构化结果](results.json)：新旧 Skill 哈希、运行配置、完整性比较及 CLI 自报用量；未据此核对账单。
- Codex 故障：[回答](codex-failure-and-residue.final.md)、[调用顺序](codex-failure-and-residue.trace.json)。
- Claude 正常：[回答](claude-passing.final.md)、[调用顺序](claude-passing.trace.json)。
- Claude 故障：[回答](claude-failure-and-residue.final.md)、[调用顺序](claude-failure-and-residue.trace.json)。
- Claude 新增边界：[回答](claude-unchanged-keywords.final.md)、[调用顺序](claude-unchanged-keywords.trace.json)。

记录从真实事件流提取，临时目录与用户目录已归一化，回答行尾换行空格已移除。Skill/全局规则正文和内部思考流不重复归档。命令拒绝须结合工具结果判断，不能将请求调用视为执行成功。

## 重建样例

在空临时目录运行：

```sh
python3 prepare_fixtures.py /tmp/my-b2-retest-fixtures
```

[构造脚本](prepare_fixtures.py)生成六份隔离仓库、提示词和快照，不调用模型、不安装依赖。需要 Python/Git，运行样例测试需要 Node/npm。本轮实际运行四个会话，其余两个构造样例不算已执行验证。
