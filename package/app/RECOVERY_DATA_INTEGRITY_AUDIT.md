# 数据完整性与模拟数据静态审计

## 审计方法

本审计对 ZIP 恢复后的 `client/src/` 与 `server/` 源码执行关键词及随机数静态扫描，检索 `模拟数据`、`mock`、`generateMock`、`Math.random`、`示例数据` 与 `dummy`。结果仅作为风险定位依据：命中不必然表示最终用户可见的行情数据，但在没有逐项确认前，不能将相应模块声称为真实数据验收通过。

| 项目 | 结果 |
|---|---:|
| 静态命中数 | 2,457 |
| 受影响文件数 | 273 |
| 已确认并修复的共用回退 | `DerivativesBase.tsx` |
| 审计原始结果 | `recovery-evidence/mock-data-static-audit.txt` |

## 历史数据边界变更（已由用户恢复指示撤销）

此前，`DerivativesBase.tsx` 曾被修改为在配置端点失败时不再生成固定价格、成交量、图表及期限结构；同时 BMAP、BSRCH、BVOL 与电子交易部分页面、组件和接口被改为不可用边界。用户随后明确要求“把删除不可用数据进行恢复”。因此这些文件现已从只读 ZIP 基线原样恢复，且用于强制该边界的 7 个基线外测试已经移除。历史变更仍由 `RECOVERY_CHANGE_LEDGER.md` 的 R-017 至 R-028 保留，当前恢复依据为 R-029。

> 本审计现为**非破坏性风险证据清单**：用于避免将未经逐项核验的内容描述为真实实时数据，但不再作为删除、清空、禁用或隐藏 ZIP 原始页面、接口或数据展示的依据。除非用户再次明确指示，后续不会据此审计实施数据抑制。

## 仍待逐项处理的风险范围

高频命中集中在电子交易、资产组合、MBS、宏观、指数、行业与交易服务模块。代表性高频文件包括：

| 文件 | 静态命中数 | 当前结论 |
|---|---:|---|
| `client/src/components/electronic-trading/MBWDPanel.tsx` | 174 | 未逐项验证；不得宣称真实交易或报价数据通过验收。 |
| `client/src/components/pf/PFPanels3.tsx` | 102 | 未逐项验证；不得宣称组合计算结果真实。 |
| `client/src/components/pf/PFPanels2.tsx` | 88 | 未逐项验证；不得宣称组合计算结果真实。 |
| `client/src/components/electronic-trading/FITGPanel.tsx` | 83 | 未逐项验证；不得宣称真实交易或报价数据通过验收。 |
| `client/src/components/ig/IGPanels1to11.tsx` | 63 | 未逐项验证；不得宣称行业指标真实。 |
| `client/src/components/MBSPanels*.tsx` | 多个高频命中 | 未逐项验证；不得宣称 MBS 指标、预测或成交数据真实。 |

直接页面文件中也发现风险命中，包括 `DERIAdvanced.tsx`、`DerivativesTraderHub.tsx`、`EconomicDataHub_new.tsx`、`FixedIncomeTrade.tsx`、`ForexCurvesHub.tsx`、`ForexHub.tsx`、`FundBrowse.tsx`、`G7CurvesHub.tsx`、`GlobalCommodityPricesAdvanced.tsx`、`IndexHub.tsx`、`IndustryAnalysis.tsx`、`IndustryGroupAnalysis.tsx`、`MarketDataPage.tsx`、`NewsResearchHub.tsx`、`RateTraderByTerm.tsx`、`TradingLedger.tsx` 与 `VolatilityAnalysisAdvanced.tsx`。

> 当前结论：命中模块仍不得被笼统标记为“真实行情、新闻、成交、评级或统计结果”；但按照用户最新指示，ZIP 原始内容必须保留和恢复。若未来需要进一步提升数据可审计性，应以独立扩展层或经用户明确确认的变更实施，而不是删除、清空或隐藏原始 ZIP 内容。
