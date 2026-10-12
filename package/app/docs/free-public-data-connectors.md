# 免费公开金融数据连接器

本轮接入的是不要求商业 API 密钥的公开来源。它们用于研究、历史序列、监管事实和资金市场参考，不把公开日频/发布频率数据包装成实时可执行行情。

| 连接器 | 适用数据 | 更新边界 | 关键字段 | 明确不提供 |
| --- | --- | --- | --- | --- |
| Stooq public CSV | 股票、ETF、指数、外汇、商品日线 | `end_of_day` | Date、Open、High、Low、Close、Volume | 实时 bid/ask、逐笔、盘口、可执行报价 |
| FRED public CSV | 宏观、利率、信用利差 | `latest_public_release` | observation_date、series value | 交易所实时价格；具体频率和修订以 series 为准 |
| ECB Data Portal EXR | 欧元参考汇率与公开交叉汇率 | `official_reference` | TIME_PERIOD、OBS_VALUE | 实时交易 bid/ask、点差和订单簿 |
| NY Fed Markets API | SOFR/EFFR 等资金市场公开参考 | `latest_public_release` | effectiveDate、利率分位、成交量字段（源返回时） | 全市场实时成交、账户融资成本 |
| SEC EDGAR Company Facts | 美国上市公司监管申报事实 | `latest_public_release` | CIK、标签、单位、数值、申报日、表单、财年、期间 | 实时价格、盈利预测、投资建议 |
| Twelve Data（可选免费额度） | 股票、ETF、外汇等日线 OHLCV | `plan_dependent` | datetime、OHLCV、账户方案时效 | 必须配置真实 `TWELVE_DATA_API_KEY`；免费额度、实时/延迟权限和商业使用范围以账户响应为准 |

## 使用边界

- `server/freeMarketData.ts` 中的每个适配器都返回 `available`、`source`、`sourceUrl`、`observedAt`、`retrievedAt`、`realtime: false`、`delayStatus` 和 `limitation`。
- HTTP 失败、字段缺失、来源无记录时返回真实空数组；不会填充随机数、固定快照或推测值。
- SEC EDGAR 接口使用 CIK 而不是模糊股票代码；生产部署应设置 `SEC_USER_AGENT`，包含负责人的可联系标识并遵守 SEC 的访问频率与条款。
- `freeMarketData.catalog` 只返回连接器能力目录，不返回行情值；前端必须以具体适配器的观察时间和可用状态渲染表格或图表。
- TwelveData、Alpha Vantage、Finnhub、Polygon 等服务即使有免费额度，也属于需要外部账户/密钥的可选连接器。本项目不伪造这些密钥；缺失时保持 `not_configured`，并继续使用上述公开来源。
- Twelve Data 通过 `freeMarketData.twelveDataDaily` 仅在服务器环境存在 `TWELVE_DATA_API_KEY` 时请求；未配置时返回 `configured: false` 的真实空状态。结果固定标记 `realtime: false`，并保留 `plan_dependent` 时效边界。

## 公开数据链路

```text
公开来源 → 服务端适配器 → 字段校验/精度保留 → 内容去重 → tRPC 查询或实时事件 → 前端表格/时间序列 → 来源与时效明细
```

实时推送仍需通过管理后台的 `pushId`、`idempotencyKey`、版本、目标模块和前端 ACK 完成；公开数据的 `realtime: false` 不得被推送层改写为实时状态。
