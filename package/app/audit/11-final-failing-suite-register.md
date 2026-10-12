# 最终完整回归的失败测试文件登记

本登记对应 `/home/ubuntu/terminal_full_output/2026-08-26_20-00-00_full-credit-boundary-workbench-vitest.txt`：完整 Vitest 为 216/229 文件、747/764 用例通过，剩余 13 个失败文件、17 个失败用例。此表用于后续逐项恢复，不把未完成来源、旧基线或模拟需求错误地认定为已修复。`globalEquityImport.test.ts` 与 `globalEquityCurrentUpload.test.ts` 已在用户提供的 46 份 XLSX 按来源审计、去重与仅新增事务导入后通过，故不再属于失败登记。

| 失败文件 | 用例数 | 分类 | 证据与处理边界 |
|---|---:|---|---|
| `commsPreservation.test.ts` | 1 | 原内容旧指纹/基线冲突 | `audit/artifacts-fingerprint-baseline-matrix.json` 显示工作副本遵循冻结外层归档；不以旧保护期望改写通讯中心或面板。 |
| `credit-workbench.test.ts` | 1 | 历史映射符号与冻结面板可达性恢复冲突 | 冻结测试只要求 `Terminal.tsx` 含 `independentlyVerifiedPanelIds` 文字。冻结实现以该集合条件性展示原面板，造成数字入口 1–24 中多数冻结面板不进入 DOM。当前映射已恢复所有原面板优先显示且专项层仅追加；不为满足字符串断言重新隐藏面板、添加无业务意义符号或改写测试。 |
| `derivatives.test.ts` | 4 | 未接入可验证替代数据/事件的真实空状态 | BICO/AI 路由不具有授权的替代数据或可验证事件；不得生成 sector、signals 或 causal chain 凑足断言。 |
| `derivativesProtection.test.ts` | 1 | 原内容旧指纹/基线冲突 | 与上述冻结基线比较矩阵一并保留。 |
| `electronicTradingOriginalContentFingerprint.test.ts` | 1 | 原内容旧指纹/基线冲突 | 电子交易页保持冻结 SHA `f048d41…`；旧期望 `adf2bf…` 不由用户冻结外层 ZIP 支持。 |
| `forexProtection.test.ts` | 1 | 原内容旧指纹/基线冲突 | `ALLQPanel.tsx` 当前 SHA-256 `49a785c8…` 同时匹配工作副本、冻结外层与嵌套归档，但旧期望为 `15dfa014…`；不以未知版本覆盖用户资料。 |
| `indexResearch.test.ts` | 1 | 旧扩展版本冲突 | 当前恢复版本使用外层归档的研究层边界；不把其他版本的容器约束覆盖到冻结组件。 |
| `legacyFieldAccess.test.ts` | 1 | 旧扩展版本冲突 | 当前 `EconomicCalendarOfficialObservations.tsx` 与外层/嵌套归档一致，但旧测试要求其不含的筛选、Sparkline 和监测组件片段。试验性挂载会新增三项保护失败，已撤回。 |
| `newsPreservation.test.ts` | 1 | 原内容旧指纹/基线冲突 | 不改写新闻中心、菜单或面板以追随非权威旧 SHA。 |
| `orderManagementOriginalContentFingerprint.test.ts` | 1 | 原内容旧指纹/基线冲突 | AIM/TOMS 与帮助面板的保护期望不匹配用户外层归档。 |
| `portfolioManagementPreservation.test.ts` | 2 | 原内容旧指纹/基线冲突 | 组合管理菜单、工作区和子面板保留冻结外层版本。 |
| `pricingRiskOriginalContentFingerprint.test.ts` | 1 | 原内容旧指纹/基线冲突 | 不用旧定价与风险工作区版本替换冻结页面。 |
| `stpOriginalContentFingerprint.test.ts` | 1 | 原内容旧指纹/基线冲突 | STP `FstnPanel` 期望与可用归档版本均不匹配。 |

> 以上分类只表示当前“为何不能以安全方式让断言变绿”。它不把任一失败项标记为完成，也不降低用户要求的逐入口、逐页面动态验收门槛。
