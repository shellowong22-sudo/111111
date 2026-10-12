# 跨国主权比较数据来源说明

## FRED / OECD 月度十年期政府债收益率

本轮跨国比较补充使用 FRED 发布的 OECD 十年期政府债基准收益率，作为本地曲线缺失国家的**月度**真实观测参考。已核验并接入以下系列：加拿大 `IRLTLT01CAM156N`、澳大利亚 `IRLTLT01AUM156N`、韩国 `IRLTLT01KRM156N`、法国 `IRLTLT01FRM156N`、意大利 `IRLTLT01ITM156N`、西班牙 `IRLTLT01ESM156N`。该指标定义为十年期政府债的长期利率；界面必须保留月度频率和来源标签，不能表示为实时或可执行报价。

- OECD API 与访问说明：https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html
- OECD 长期利率指标说明：https://www.oecd.org/en/data/indicators/long-term-interest-rates.html
- FRED OECD 十年期系列目录：https://fred.stlouisfed.org/tags/series?t=10-year%3Binterest+rate%3Boecd

## BIS 统计数据与 CDS 数据边界

BIS 的统计资料允许在遵守来源标注、不得误导或暗示背书等条件下使用；其 API 遵循 SDMX REST。当前会话没有启用 Bloomberg、FactSet、LSEG 或同类主权 CDS 授权报价连接，因此系统明确保持主权 CDS 的“未接入获授权报价源”状态，**不使用 ETF、宏观指标或其他代理生成 CDS 点位**。

- BIS 使用条款与 API 说明：https://data.bis.org/help/legal

> 本文件仅记录数据出处与使用边界；不构成市场观点、交易指令或个性化投资建议。

## 扩展国家覆盖核验（2026-08-18）

为扩展跨国比较，已通过 FRED 公开 CSV 端点核验下列 OECD 月度十年期政府债收益率系列均返回 **2026-06-01** 的有效观测：比利时 `IRLTLT01BEM156N`、瑞士 `IRLTLT01CHM156N`、丹麦 `IRLTLT01DKM156N`、荷兰 `IRLTLT01NLM156N`、挪威 `IRLTLT01NOM156N`、新西兰 `IRLTLT01NZM156N`、波兰 `IRLTLT01PLM156N`、葡萄牙 `IRLTLT01PTM156N`、瑞典 `IRLTLT01SEM156N`。

这些系列均为 FRED 发布、来源归属 OECD 的月度、未经季调十年期政府债基准收益率。界面应根据“当前读取时间 − 数据观测日”显示时效状态，而不是暗示实时行情；若后续接口无观测值，则显示空状态而不生成替代数值。

## 主权发行与曲线深化来源（2026-08-18）

美国财政部 Fiscal Data 的 Treasury Securities Auctions Data 数据集提供已公告和已拍卖的可交易国债证券记录，包含 CUSIP、证券类型与期限、拍卖日、发行日和到期日等字段。该数据集可用于 NIM、TOP BON、DEBT、SRSK 和 RUNZ 中的**一级市场研究、事件追溯与核验清单**，不能被展示为二级市场即时 bid/ask 或可执行报价。数据集按需要更新，单行记录对应一个拍卖或公告证券。

欧洲央行每日发布欧元区政府债零息、远期与平价收益率曲线的估计结果，覆盖三个月至三十年剩余期限；原始债券会先经选择与异常值处理，故该曲线应被标注为估计曲线，而不是某一国家的可成交债券报价。它适合扩展 YCURVE、GC、YAS 与 PRICE 中的期限结构、曲线类别和历史比较功能。

- 美国财政部拍卖数据与 API：https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/
- 欧洲央行收益率曲线方法与发布口径：https://data.ecb.europa.eu/methodology/yield-curves

## 每日原始事实同步（2026-08-18）

经确认，系统每日仅同步四类可追溯的原始事实：FRED 利率与期限差、美国财政部拍卖记录、FRED 发布的 OECD 十年期政府债月度观测，以及 World Bank 已发布宏观指标。每次同步按来源和 UTC 日期保存抓取时点、最近观测期、记录数量、来源 URL、覆盖的主权债模块和不可用状态。FRED 利率序列、财政部拍卖、OECD 月度收益率和 World Bank 宏观指标的频率不同，页面必须逐项展示观测期与同步时间。

> 每日同步不生成研究摘要、市场观点、评分、预测、交易信号、二级报价或可执行价格。任何来源不可用时，系统保存并展示真实空状态，而不以历史示例、ETF 代理、合成行情或模拟数据替代。

- FRED 原始序列：https://fred.stlouisfed.org/
- 美国财政部拍卖数据：https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/
- World Bank 指标数据：https://data.worldbank.org/

## 国家级财政融资日历扩展（2026-08-18）

| 覆盖范围 | 官方机构与入口 | 已核验字段/频率 | 当前接入边界 |
| --- | --- | --- | --- |
| 德国 | [Deutsche Finanzagentur 发行日历](https://www.deutsche-finanzagentur.de/en/federal-securities/issuances/issuance-calendar) | 即将发行的日期、证券类型、规模、票面利率、到期日；年度计划并以季度更新 | 可读取页面内官方记录；金额保持欧元原始口径 |
| 英国 | [UK Debt Management Office D5D Outright Gilt Issuance Calendar](https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D5D)、[D1A Gilts in Issue](https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D1A)及[单场 Gilt Announcements](https://www.dmo.gov.uk/publications/?offset=0&itemsPerPage=20&parentFilter=-1&childFilter=-1&startMonth=4&startYear=2025) | D5D 官方 XLS 提供 Operation Date、Gilt Name、Nominal Amount Issued、Cash Raised 和 Issuance Method；D1A 提供证券名、ISIN、首次发行日和赎回日；单场拍卖公告披露 ISIN、Auction Date 与 Issue and Settlement Date | 仅保留 D5D 的 `Outright Auction`。ISIN 优先使用同券同拍卖日的单场公告，否则使用 D1A 同名证券的 ISIN；D1A 仅以 Redemption Date 补充到期日。含 ISIN 的日历记录可复制该已披露标识，并跳转至对应 DMO 原始证券资料：有单场公告时为该公告，否则为 D1A 官方证券报告；不构造未公开的逐券 URL。只有单场公告同时明确同一证券和拍卖日时才补充本次交收日，绝不以 D1A First Issue Date 替代重开债的本次交收日。读取设有顺序节流、一次受控重试和文件签名校验；未披露字段保持为空 |
| 日本 | [日本财务省 JGB Auction Calendar](https://www.mof.go.jp/english/policy/jgbs/auction/calendar/index.htm) | 月度拍卖日历、历史拍卖结果入口及修订公告 | 仅在可读取具体月份官方记录时显示日期与类型；不从新闻或市场预测补全 |
| 法国 | [Agence France Trésor 月度拍卖日历](https://www.aft.gouv.fr/en/auction-indicative-calendars)及[单场发行公告](https://www.aft.gouv.fr/en/publications/communiques-presse/14-august-2026-next-issuance-oats) | 月度图表按类别披露日期；当前官方首页明确列示的单场“next issuance”公告披露公告、拍卖及交收日期，部分页面还披露 ISIN 与规模区间 | 动态发现官方首页当前公告并仅解析明确日期；直接读取遇防护时，通过只读转译读取同一 AFT 原页面，事件仍指向原始 AFT URL；范围金额或未逐笔披露的期限保持为空 |
| 意大利 | [MEF Treasury Bills Auction Calendar](https://www.dt.mef.gov.it/en/debito_pubblico/calendari_emissioni/calendari_aste_bot/) | 官方英文年度 BOT PDF 明示公告、认购截止、拍卖、交收、到期日期及 6/12 月期限类别 | 已读取公告、拍卖和交收日为独立事件；发行规模以单场 MEF 公告为准，年度日历未披露时保持为空 |
| 欧元区国家参考 | [European Commission National Issuance Information](https://economic-financial-policy-committees.europa.eu/economic-and-financial-committee/working-groups/efc-sub-committee-eu-sovereign-debt-markets/issuance-calendar_en) | 国家级发行规律与发布口径；页面更新日为 2026-06-15 | 作为来源索引与频率说明；不把规律转换为具体未来发行事件 |

> 多国日历仅展示官方页面实际发布的记录。未读取到日期、金额或证券类型时保留空字段和来源链接，不以规律、推测或第三方市场内容填补。

### 英国与日本公告读取结论

英国 DMO 的 [Calendars](https://www.dmo.gov.uk/calendars/) 页面确认其 Events Calendar 覆盖每月 gilt auction、规模/新券票面利率公告日、赎回及季度发行日历公告；Issuance Calendar 覆盖财年拍卖日期及 conventional/index-linked gilt 类型，并按季度补充具体证券。系统现通过 D5D 官方 XLS 读取已明示的 Outright Auction，并以 D1A 与单场公告在精确匹配时补充到期或交收字段；若同源端点短时限流、文件不具有效签名或公告未明确匹配，则保留对应字段为空而非推测。

日本财务省的 [Weekly Schedule](https://www.mof.go.jp/english/public_relations/weekly_schedule/index.htm) 提供可读取的已发布 JGB 公告和结果事件，包括 2 年、5 年、10 年、20 年、30 年 JGB、气候转型国债及 Treasury Discount Bills。系统仅保存公告/结果的财务省公布日和页面披露的期限文本；该周度页面未披露的发行规模、票面利率、发行日或到期日保持为空。 [JGB Auction Calendar](https://www.mof.go.jp/english/policy/jgbs/auction/calendar/index.htm) 继续作为月度日历与历史结果入口。

### 融资日历提醒与 WebCal 订阅边界

账户可针对发行公告、拍卖或交收三类已发布事件，选择全部已接入国家或单一国家并设置提前 1–90 天的提醒。既有小时任务仅在事件 UTC 日期前的配置窗口内写入一次账户通知，并以规则与官方事件标识去重；它不生成未发布的未来事件，也不发送外部邮件、短信或交易指令。WebCal 链接复用同一 ICS 端点及国家筛选参数，订阅端看到的仅为已读取的官方一级市场事件与原始来源链接；端点的公共缓存上限为五分钟。

提醒规则可由规则所属账户暂停或恢复，也可在多选后批量暂停或恢复；服务端以当前账户和规则 ID 联合限制批量操作范围。暂停后，小时扫描不再匹配该规则；恢复后只会对仍处于有效提醒窗口、且尚未写入去重事件的官方记录发送提醒。账户级历史发送记录支持按事件日期范围、国家与规则当前状态筛选，并可将同一筛选范围内最多 500 条记录导出为 UTF-8 CSV；导出内容包括规则编号、国家、事件类型、事件日期、提前天数、规则当前状态、发送时间及官方事件标识，作为通知中心记录之外的专用审计视图。

## 信用债深化数据边界（2026-08-18）

信用债模块的公开基准数据优先使用 FRED 发布、来源为 ICE Data Indices 的 ICE BofA 期权调整利差（OAS）系列。投资级综合利差使用 `BAMLC0A0CM`，高收益综合利差使用 `BAMLH0A0HYM2`；两者均为**日度收盘百分比口径的指数级 OAS**，不能表示为单只债券报价、可成交价差或实时 CDS。FRED 页面说明该数据具有 ICE 的使用及分发限制，系统仅将其显示为带来源和观察日的研究参考，不再将静态或随机数包装成信用利差、评级迁移、违约概率或交易方向。

美国发行人基本面、债务与公开披露核验可使用 SEC EDGAR 的 `data.sec.gov` submissions 和 XBRL companyfacts JSON API。该 API 不需密钥，但服务端必须采用限速、清晰 User-Agent 和按需读取；前端只通过本系统接口读取。没有获授权的单券二级报价、TRACE 逐笔成交、CDS 点位、评级迁移或指数成分数据时，模块必须展示来源状态与真实空状态，不以样本、随机路径、模型预测或伪造信号替代。

- FRED / ICE BofA 投资级 OAS：https://fred.stlouisfed.org/series/BAMLC0A0CM
- FRED / ICE BofA 高收益 OAS：https://fred.stlouisfed.org/series/BAMLH0A0HYM2
- SEC EDGAR API：https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- SEC Developer Resources：https://www.sec.gov/about/developer-resources

### 本轮端到端读取核验

在 **2026-08-18** 的本地服务核验中，FRED `BAMLC0A0CM` 返回观察日 **2026-08-14**、数值 **0.80%** 的投资级综合 OAS；该值仅用于运行时指数级研究展示。SEC EDGAR 发行人检索以 IBM（CIK `0000051143`）返回最近的 8-K 与 10-Q 原始文件 URL，证明披露导航可用；文件列表按请求实时读取，不作为固定样本或单券条款数据持久化展示。

### 信用债可视化复核

已复核信用债当前市场、新闻/研究、计算器与全球 CDS 页面的首屏：原有静态市场数值、示例新闻、预填计算和虚构 CDS 点位已改为公开 FRED OAS 读取、SEC EDGAR 文件检索、用户输入计算或明确授权空状态。CDS、TRACE 逐笔成交、单券报价、评级迁移和指数成分在未接入许可数据时继续为空，不在页面上生成替代数值、历史路径、信号或套利结论。

信用债全球 CDS 与收益曲线页面的后续核验确认：CDS 现仅展示授权数据的必要前提、CDX/iTraxx 许可入口与 OAS 研究参考；信用曲线现仅展示真实 IG/HY OAS 观察路径、期限数据边界和同口径用户输入的简单曲线差值。两者均不再展示静态期限参数、压力情景、远期利率、骑乘收益、主权 CDS 历史、基差或对冲结论。

信用债深链接抽样（3、10、20、23）进一步确认：跨市场信用基准、发行人披露导航、新发行/事项核验与固定收益工作表均保留其独有的公开数据、SEC 文件、用户计算或来源状态入口。尚未逐页完成来源改造的旧展示组件已从用户界面隔离，避免其静态样本与实际研究工作流并列出现。

信用债协作证据与 OAS 提醒边界：SEC EDGAR 证据日志仅允许 `www.sec.gov/Archives/edgar/` 的 HTTPS 原始文件链接，并持久化用户选定的原文摘录、研究注释、高亮颜色、创建/更新/共享/撤销共享审计事件和成员级只读或编辑授权；系统不缓存、复制或再分发整份 SEC 文件。FRED / ICE BofA OAS 阈值为账户级、严格“高于”比较，以系列、规则和观察日组成的幂等键去重；仅在市场提醒偏好启用时写入通知中心，并借由现有 SSE 通道向在线账户展示右上角通知。OAS 是指数级日度观察，不代表 TRACE 成交、单券报价或 CDS 点位。

授权 TRACE/CDS 接入边界：FINRA 的 TRACE 转售商目录列示 FactSet 可通过桌面与数据馈送提供实时及延迟 TRACE 数据；FactSet 官方产品资料列示固定收益价格覆盖，并提供 CDS/CDX 相关产品资料。当前任务配置中的 FactSet 连接处于未启用状态，且没有 TRACE/CDS 字段权限或供应商 API 范围的已验证凭据。因此在用户确认并启用相应授权前，信用债页面保持已审计的授权状态与真实空值，不以 ETF、指数或随机数据替代 TRACE/CDS。来源：FINRA TRACE Retransmission Vendors；FactSet Prices API；FactSet CDS/CDX Option 产品资料。

免费公开数据路线核验：FINRA Fixed Income API 可提供 TRACE 报告的周度美国国债聚合、市场广度/情绪与上限交易量等固定收益聚合数据，但需要 FINRA Query API 的有效 Public、Firm 或 Organization Access Credentials，并遵守 FINRA 署名、免费转发及不得继续转发等条款。FINRA 的逐笔实时与日终 TRACE 文件仍需订阅、协议与访问授权；公开示例文件不可作为实时数据源。没有发现可免费、合规且可无凭据直接读取的实时 CDS 点位源，故不展示 CDS 代理。免费 FRED / ICE BofA 路线现扩展为 IG、AAA、AA、BBB、HY 指数级日度 OAS；这些均是评级分类指数的期权调整利差，不是单券报价、TRACE 成交或 CDS。来源：FINRA Fixed Income API/Specific Terms/TRACE Data & Licensing；FRED ICE BofA AAA、AA、BBB OAS。


### 2026-08-18 FINRA Fixed Income / TRACE 接入核验
FINRA Developer Center 的 Fixed Income API 文档说明可访问 TRACE 报告的固定收益 OTC 二级市场数据集，示例数据集包括 Weekly Treasury Aggregates、Market Breadth & Sentiment 和 Capped Volume；这不等同于无凭据逐笔实时 TRACE。FINRA Fixed Income 数据具体条款要求使用者持有有效 Query API Access Credentials，凭据类型包括 Public、Firm 或 Organization；条款允许在非商业个人或专业使用范围内使用，并要求明确标注 FINRA 为数据所有者和来源。FINRA TRACE 数据页同时说明实时和历史多数 TRACE-eligible 数据通常属于订阅数据，TRACE Security Activity Report 为按证券聚合的月度报告，市场报告与统计可通过 API 自动化访问。当前会话配置未发现 FINRA 连接或凭据，因此本项目暂不展示 TRACE 聚合点位，仅保留真实授权状态与官方入口。来源：FINRA Fixed Income API（https://developer.finra.org/node/1171）、Fixed Income Data Specific Terms（https://developer.finra.org/specific-terms-fixed-income-data）、TRACE Data & Licensing（https://www.finra.org/filing-reporting/trace/data）。

### 2026-08-19 无凭据 FINRA TRACE 公开市场研究
在没有有效 FINRA Query API 凭据时，TRACE 功能码仅导航至 FINRA Fixed Income Data Center 中可由公开页面访问的研究资料：Bond Market Activity、Bond Market Sentiment 与 Most Active Corporate Bonds。前两者说明其为系统开放日的日终公司债、机构债及 144A 汇总统计；最活跃公司债页按市场日发布投资级、高收益与可转债 Top 10。该终端不抓取、缓存或再发布这些动态表格，也不将其表述为实时、逐笔成交、单券价格或可程序化 API 返回。若用户在官方页面使用证券查询或导出功能，仍须遵守 FINRA User Agreement；Query API、实时 TRACE 与日终交易文件继续需要相应凭据或订阅。来源：https://www.finra.org/finra-data/fixed-income/market-activity、https://www.finra.org/finra-data/fixed-income/market-sentiment、https://www.finra.org/finra-data/fixed-income/market-corp、https://www.finra.org/finra-data/fixed-income。
