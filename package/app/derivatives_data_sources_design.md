# 衍生品追加研究来源与边界

本记录只涵盖可在终端内读取、可追溯且免费公开的研究输入。所有时间戳均以来源的实际观察日期或读取时点展示；不会将公开序列表述为实时可执行报价、完整期权链、Greeks、订单簿或交易建议。

| 数据类 | 一级来源 | 已核验字段/节奏 | 终端内用途 | 明确边界 |
|---|---|---|---|---|
| 期货及期货期权持仓 | CFTC Commitments of Traders | 周二收盘持仓，通常周五 15:30 ET 发布；可读报告分类、未平仓、长/短/价差持仓 | FOM / MOSO 的周度持仓与拥挤度审计 | 不作为日内流、成交或可执行期货报价；报告交易者不足 20 名时不会出现；CFTC 不作分析或推荐。 |
| 股指期权预期波动输入 | FRED `VIXCLS`，来源 CBOE | 每日收盘、指数、未季调；定义为 SPX 期权价格所隐含的近期期望波动 | OV / VCA / MARS 的公开波动环境和共同日期对照 | 不替代单个合约、到期日曲面、期权 Greeks、成交、报价或波动率套利结论。 |
| 利率期货持仓 | CFTC Traders in Financial Futures API `gpe5-46if` | Treasury bond 等金融期货的交易商、资产管理人、杠杆基金及其他报告者长/短/价差仓位 | WBF / MARS 的周度利率期货仓位结构审计 | 不替代债券期货结算、交割篮子、DV01、保证金或可执行报价。 |
| 信用期权调整利差环境 | FRED `BAMLH0A0HYM2`，来源 ICE Data Indices | 每日收盘、百分比、未季调；高收益指数 OAS 相对现货国债曲线的加权指标 | CDSW / 信用监控的公开信用环境输入 | 不替代单名 CDS、CDX、违约概率曲线、交易对手报价或可执行信用衍生品价格。 |

## 已核验网页

1. CFTC, *Commitments of Traders*: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
2. FRED / CBOE, *CBOE Volatility Index: VIX (VIXCLS)*: https://fred.stlouisfed.org/series/VIXCLS
3. CFTC, *Public Reporting User’s Guide*: https://publicreporting.cftc.gov/stories/s/User-s-Guide/p2fg-u73y/；实际结构化端点 `https://publicreporting.cftc.gov/resource/gpe5-46if.json` 及 `https://publicreporting.cftc.gov/resource/72hh-3qpy.json`。
4. FRED / ICE Data Indices, *ICE BofA US High Yield Index Option-Adjusted Spread (BAMLH0A0HYM2)*: https://fred.stlouisfed.org/series/BAMLH0A0HYM2

后续若接入信用利差、国债收益率、现货油价、美元或股票公开历史，将继续通过 FRED 原始 CSV 读取并记录每条序列的源 URL、单位、更新状态与不可替代边界。
