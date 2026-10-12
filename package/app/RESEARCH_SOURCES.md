# 深度功能的官方数据来源记录

## SEC EDGAR

- 官方接口说明：<https://www.sec.gov/search-filings/edgar-application-programming-interfaces>
- 公司申报目录：`https://data.sec.gov/submissions/CIK##########.json`
- 公司 XBRL 事实：`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json`
- SEC 官方说明确认这些 JSON API 不需要 API key，并覆盖发行人申报历史与结构化 XBRL 财务事实；服务端请求须遵守 SEC 的自动访问政策、使用标识性 User-Agent，并在应用内展示来源、观测时间和不可用状态。

## Federal Register

- 官方 API 说明：<https://www.federalregister.gov/developers/documentation/api/v1>
- FederalRegister.gov 提供无需 API key 的公共 HTTP API。其 XML 网页版是信息性资源，涉及法律研究时应提示用户以官方版本核验；终端层仅呈现实际读取的标题、发布日、机构、文件类型和来源标识，不产生法律结论。

## 美国财政部 Fiscal Data 与利率统计

- 官方 API 文档：<https://fiscaldata.treasury.gov/api-documentation/>
- 美国国债拍卖数据集：<https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/>
- 美国财政部说明，日度 PAR 收益率曲线基于纽约联储在每个营业日下午约 3:30 取得的最近期国债场外市场指示性买价；该定义不等同于可执行二级市场报价。
- 终端内主权债工作台仅读取并展示拍卖目录的 CUSIP、证券类型、期限、拍卖日、发行日、到期日和发行规模；不会生成拍卖预测、二级市场 bid/ask、成交或交易建议。

## 已有项目复用模式

项目 `server/newsResearchDb.ts` 已实现官方 SEC 新闻、美联储 RSS 与 SEC EDGAR 申报的服务端读取，包含 10–12 秒超时、五分钟内存缓存、来源 URL、发布日期、实际读取状态和明确的终端内证据边界。后续行业深度层优先复用这一模式，避免前端直接跳转第三方网页、静态模拟数据或无依据的自动叙事。
