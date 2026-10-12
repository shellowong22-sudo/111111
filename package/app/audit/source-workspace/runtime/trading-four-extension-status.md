# 四个交易区域专项状态

四个区域均把 ZIP 原页面和原有私有数据工具放在保留边界内，随后才追加按 `panel` 选择的专属工具。没有移除私有导入、阈值、归档、导出、筛选、时间线、估值或账簿功能。

| 区域 | 原工具保留 | 入口映射 | 代表性交互 | 代表性渲染 |
| --- | --- | ---: | --- | --- |
| 交易委托簿 | `OrderManagementResearchLayer` | 23 | AIM 字段状态、TOMS 报价价差 | `order-management?panel=AIM` |
| 电子交易 | `ElectronicTradingResearchLayer`、`ElectronicTradingDataListExperienceContainer` | 31 | FIT 响应覆盖率 | `electronic-trading?panel=FIT` |
| STP | `StpPrivateResearchLayer`、`StpPrivateTimelineOverlay` | 24 | RESD 回执缺口 | `stp-processing?panel=RESD` |
| 交易账簿 | `TradeBookPrivateResearchLayer` | 9 | STOCK 持仓权重 | `trade-book?panel=STOCK` |

`node audit/scripts/audit_trading_four_extensions.mjs` 已生成 `trading-four-tab-mapping.tsv`，覆盖 **87** 个入口的任务、输入与可视结果指纹。`pnpm vitest run server/orderManagementDistinctExtension.test.tsx server/tradingDistinctExtensions.test.tsx --reporter=dot` 的结果为 **2 个文件、4 项断言通过**。

> 本记录不替代全站逐入口操作、全设备断点或全部接口运行时验收；这些事项仍按总 TODO 保持未完成。
