# 新闻与研究追加层：官方来源与终端内边界

**核验日期：2026-08-22（UTC）**

| 来源标识 | 机构 | 服务器读取端点 | 在终端内展示字段 | 边界 |
|---|---|---|---|---|
| `SEC_PRESS` | U.S. Securities and Exchange Commission | `https://www.sec.gov/news/pressreleases.rss` | 标题、发布日期、机构、RSS 摘要、稳定 GUID | 仅展示 SEC 实际 RSS 条目；不生成执法、监管或投资结论。 |
| `FED_MONETARY` | Board of Governors of the Federal Reserve System | `https://www.federalreserve.gov/feeds/press_monetary.xml` | 标题、发布日期、机构、官方摘要、稳定条目标识 | 仅展示实际官方货币政策新闻；不归因市场价格变化。 |
| `FED_RESEARCH` | Board of Governors of the Federal Reserve System | `https://www.federalreserve.gov/feeds/feds.xml` | 论文/研究标题、发布日期、官方摘要、稳定条目标识 | 仅展示官方研究摘要；不将研究发现改写为交易建议。 |
| `SEC_FILINGS` | U.S. Securities and Exchange Commission EDGAR | `https://www.sec.gov/files/company_tickers.json` 与 `https://data.sec.gov/submissions/CIK{CIK}.json` | 发行人、CIK、表单、申报日、主文件名、正文关键词附近的受限片段 | 仅对服务器实际返回的美国公开发行人披露显示；不可读、未命中或无记录时显示真实空状态。 |

所有新增阅读、筛选、摘要原文片段与账户私有证据卡均在终端内呈现。来源 URL 只作为服务端溯源元数据保存，不提供离站核心路径。原新闻与研究菜单、原工作区和原始面板不读取、不迁移、不改写。
