# 授权债券数据与官方拍卖数据：实施边界

## 参考时间与来源

本设计的外部来源调研于 **2026-08-18（GMT+8）** 完成。美国财政部 Fiscal Data 的 Treasury Securities Auctions Data 数据集覆盖已公告及已拍卖的可流通国债，并提供记录日期、CUSIP、证券类型、期限、拍卖日期等字段；其文档声明 API 返回值均为字符串，接入层必须进行类型转换与空值处理。[1]

TreasuryDirect 的官方拍卖页面提供国库券、票据、债券、TIPS 与 FRN 的公告和结果，并说明季度暂定拍卖日程通常在 2、5、8、11 月的首次周三发布；页面同时提示其拍卖 XML 和 API 数据即将发生重大变更，因此解析器必须使用版本化适配层而非依赖固定 XML 格式。[2]

## 实施决策

| 数据层 | 实施方式 | 授权状态 | 平台展示与限制 |
| --- | --- | --- | --- |
| 官方拍卖 | 服务端访问 Treasury Fiscal Data API；必要时以 TreasuryDirect 公告页交叉核验 | 公开官方数据，无用户密钥 | 展示拍卖日、CUSIP、期限、发行/到期日、投标规模、加权/最高收益率或利率与数据时间；标注“官方拍卖结果”，不作为二级市场实时价格。 |
| 实时债券报价 | 建立提供商适配接口，读取授权服务的安全环境变量，不在客户端或代码中嵌入密钥 | 需要用户有合规订阅并授权，例如已发现但未启用的 S&P Global 连接 | 未授权时明确显示“等待已授权报价源”，不把本地模拟市场推送误标为授权报价；保留最后更新时间、提供商、延迟与降级状态。 |
| 现有公开研究参考 | FRED、Yahoo Finance、World Bank 等既有路由 | 现有公开参考 | 继续仅用于研究代理、宏观和曲线背景，不能替代可交易的债券报价。 |

## 审计与数据治理要求

报价记录、拍卖结果与计算输出均需携带来源、采集时间、观测时间、可用性状态与口径。实时报价适配器只负责接收和标准化经许可数据，不生成、推断或填补缺失 bid/ask。拍卖数据与二级市场报价在界面和 API 合约中分离，防止将一级拍卖结果误解为实时二级市场报价。

## 本轮实施结论

用户选择**免费公开来源**。系统已接入美国财政部 Fiscal Data 的官方主权债拍卖数据，并在 NIM 中展示拍卖日、CUSIP、期限、发行规模、可用拍卖结果指标、票面利率、记录日与官方来源链接。该信息被明确分类为“官方一级市场拍卖参考”，不会声明为实时二级市场 bid/ask、可执行报价或流动性深度。

经许可的现金债券报价仍需要用户日后授权 S&P Global、Bloomberg、ICE、LSEG、FactSet 或其他已订阅供应商后接入。在未授权之前，平台不生成或补位二级市场实时报价。

## 参考资料

[1]: https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/ "U.S. Treasury Fiscal Data — Treasury Securities Auctions Data"
[2]: https://www.treasurydirect.gov/auctions/announcements-data-results/ "TreasuryDirect — Announcements, Data & Results"
