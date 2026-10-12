# 经济日历官方原始读数来源记录

本记录仅用于终端内追加读取层；不替代或改写原经济日历的保留展示。读取时间基准为 2026-08-22（UTC+8）。所有端点均由服务端按需读取，失败时返回真实空状态。

| 机构 | 字段 | 官方端点 | 实际核验结果 | 终端边界 |
|---|---|---|---|---|
| 美国劳工统计局（BLS） | 失业率 `LNS14000000` | https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000 | 返回 `REQUEST_SUCCEEDED`，最新可读期为 2026-07，值 4.1 | 月度发布原始读数，不是预测或交易信号。 |
| 美国劳工统计局（BLS） | 非农就业总量 `CES0000000001` | https://api.bls.gov/publicAPI/v2/timeseries/data/CES0000000001 | 返回 `REQUEST_SUCCEEDED`，最新可读期为 2026-07，值 158858 | 单位为千人，是就业水平，不替代日历内市场预期或意外值。 |
| 美国劳工统计局（BLS） | 私营部门平均时薪 `CES0500000003` | https://api.bls.gov/publicAPI/v2/timeseries/data/CES0500000003 | 返回 `REQUEST_SUCCEEDED`，最新可读期为 2026-07，值 37.62 | 单位为美元/小时，不表示工资增速预测。 |
| 美国劳工统计局（BLS） | CPI-U `CUUR0000SA0` | https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0 | 返回 `REQUEST_SUCCEEDED`，最新可读期为 2026-07，值 333.918 | 指数水平，不推算同比或替代原始读数。 |
| 美国劳工统计局（BLS） | JOLTS 职位空缺 `JTS000000000000000JOL` | https://api.bls.gov/publicAPI/v2/timeseries/data/JTS000000000000000JOL | 返回 `REQUEST_SUCCEEDED`，最新可读期为 2026-06，值 7359 | 单位为千个职位，是已发布职位空缺水平，不表示招聘预测或职位匹配。 |
| 美国联邦储备系统 | 工业产出 `INDPRO` | https://fred.stlouisfed.org/graph/fredgraph.csv?id=INDPRO | 返回联邦储备 G.17 公开系列 CSV 的连续月度观察 | 仅显示实际工业产出指数观察，不表示工业产出预测。 |
| 日本银行（BOJ） | 无担保隔夜拆借平均利率 `STRDCLUCON` | https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=FM01&code=STRDCLUCON&startDate=202501 | 返回 `STATUS: 200`、每日实际观察、单位为年率百分比，`LAST_UPDATE` 为 2026-08-21 | 日本官方时序原始观察；不推断货币政策或汇率影响。 |
| 日本银行（BOJ） | 短观大企业制造业景气判断 `TK99F1000601GCQ01000` | https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=CO&startDate=202401&endDate=202604&code=TK99F1000601GCQ01000 | 返回 `STATUS: 200`、季度实际 DI，2026Q2 为 22；未来或空值不填补 | 日本官方企业调查实际值，不与预测、模型预期或其他行业混用。 |
| 英国国家统计局（ONS） | CPIH 全项目指数 | https://api.beta.ons.gov.uk/v1/datasets/cpih01/editions/time-series/versions/67/observations?time=*&geography=K02000001&aggregate=cpih1dim1A0 | 返回新版开放接口的时间序列观察；版本 67 的实际观察延续至 2026-01，服务端按观察期排序，不使用其他 CPI 系列补填 | 英国官方公开原始指数观察；旧 `api.ons.gov.uk/timeseries` 接口已退役，不能作为终端读取来源。 |
| 欧盟统计局（Eurostat） | 欧元区 HICP 年变化率 | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?geo=EA20&coicop=CP00&unit=RCH_A&lastTimePeriod=2 | 返回 JSON-stat，来源 `ESTAT`，最新值为 2.0 | 欧元区全项目 HICP 年变化率，不是单一国家 CPI 或通胀预测。 |
| 欧盟统计局（Eurostat） | 欧元区 GDP | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10_gdp?geo=EA20&na_item=B1GQ&unit=CP_MEUR&lastTimePeriod=2 | 返回 JSON-stat，2024/2025 现价总量为 15241552.8 / 15791910.9 | 年度、现价、百万欧元总量；不与季度增长率或预期混用。 |
| 欧盟统计局（Eurostat） | 欧元区零售销售量 | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sts_trtu_m?geo=EA20&nace_r2=G47&indic_bt=VOL_SLS&s_adj=SCA&unit=I21&lastTimePeriod=2 | 返回 JSON-stat，2026-05/06 指数为 104.5 / 104.2 | 季调零售销售量，2021=100；不表示零售额或消费者支出预测。 |
| 欧盟统计局（Eurostat） | 欧盟对外总出口 | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ext_st_eu27_2020sitc?geo=EU27_2020&partner=EXT_EU27_2020&sitc06=TOTAL&stk_flow=EXP&indic_et=TRD_VAL_SCA&lastTimePeriod=2 | 返回 JSON-stat，2026-05/06 季调金额为 226936.4 / 227732.4 | 对世界其他地区的总商品出口，单位百万欧元；不替代贸易差额。 |
| 欧盟统计局（Eurostat） | 欧盟对外总进口 | https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ext_st_eu27_2020sitc?geo=EU27_2020&partner=EXT_EU27_2020&sitc06=TOTAL&stk_flow=IMP&indic_et=TRD_VAL_SCA&lastTimePeriod=2 | 返回 JSON-stat，2026-05/06 季调金额为 237763.8 / 232653.3 | 从世界其他地区的总商品进口，单位百万欧元；不替代贸易差额。 |

> BLS 官方开发页面说明其 Public Data API 向公众开放，版本 1.0 无需注册；Eurostat 官方 API 文档说明 JSON-stat 返回中包含来源、更新时点及维度元数据。

## 官方说明页面

1. https://www.bls.gov/developers/home.htm
2. https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-getting-started/api
3. https://www.bea.gov/developers/ （BEA 提供 API 与新闻发布 RSS；本轮未把需要 API 密钥的 BEA 指标作为实际读数接入。）

## 2026-08-22 日本、英国与实际读数阈值追加核验

本轮将日本银行无担保隔夜拆借平均利率、短观大企业制造业景气判断及英国国家统计局 CPIH 全项目纳入官方宏观观察研究台。研究台仅显示本次服务端实际读取的同字段观察与相邻实际观察变化；国家快速筛选只作用于追加研究台，不改写原经济分析内容。

账户私有阈值规则仅对单一字段的最近两条实际观察的绝对差异判定，并以账户、字段、阈值、观察日和实际差异的稳定键去重。终端的琥珀色“触发阈值”标记只匹配当前字段最新实际观察日的已去重事件；读取失败、预测、插值和跨字段比较均不产生标记。

专项回归与完整回归均已通过（101 个测试文件、485 项测试）。开发服务重启后健康检查无类型错误。截图服务与开发预览浏览器本轮未能完成经济中心全页捕获，原因是预览环境返回通用加载页；该限制已记录，未以截图代替测试或来源端点核验。

## 2026-08-22 英日核心指标及实际观察趋势来源基线

| 机构 | 新增字段 | 官方机器读取端点 | 本轮实际核验 | 终端展示边界 |
|---|---|---|---|---|
| 日本银行（BOJ） | 核心 CPI：除生鲜食品及制度性因素 | https://www.boj.or.jp/research/research_data/cpi/cpirev.xlsx | 官方工作簿 `chart` 页以月度、2020 基期同比百分比给出连续实际观察；2026-06 为 2.7 | 为 BOJ 调查统计局核心 CPI 研究数据；不与总 CPI、预测或其他基期并接。 |
| 日本银行（BOJ） | M2 平均残高货币存量 | https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=MD02&startDate=202501&code=MAM1NAM2M2MO | 返回 `STATUS:200`，单位为亿日元，最新实际观察为 2026-07，值为 12,970,074 | 仅为 BOJ 定义的 M2 平均余额；不解释为货币政策目标、流动性评分或资产价格信号。 |
| 英国国家统计局（ONS） | 月度 GDP 总体指数 | https://download.ons.gov.uk/downloads/datasets/gdp-to-four-decimal-places/editions/time-series/versions/68.csv | `A--T`（A-T: Monthly GDP）、英国总体、连续月度实际观察；最新为 2026-03，值为 103.3960 | 月度 GDP 指数，不是季调环比、实际 GDP 金额或预测。 |
| 英国国家统计局（ONS） | 季调在职人数 | https://download.ons.gov.uk/downloads/datasets/labour-market/editions/PWT24/versions/1.csv | `in-employment`、16+、all-adults、seasonal-adjustment、levels 的连续三月滚动实际观察；当前公开版本最晚为 2025-02 至 2025-04，值为 34,011,034 | 仅展示 ONS 当前开放版本的 UK LFS 实际在职人数；由于版本的实际观测期较早，终端必须显示观察日和真实时效边界，不以其他来源补点。 |

> BOJ 官方说明：时序数据 API 支持 JSON/CSV，货币存量统计在月度公布；ONS 官方开发者文档说明新版 API 和公开下载数据均无需 API 密钥，数据集版本可随修订变化。本轮趋势图只连接以上来源本次读取的同字段实际观察。

### 本轮运行与可视化核验

服务端实际运行读取确认上述四项新增字段均为 `available`，且各自保留 12 条同字段实际历史观察。BOJ 核心 CPI 的最近观察为 2026-06（2.7%），BOJ M2 为 2026-07（12,970,074 亿日元），ONS 月度 GDP 总体指数为 2026-03（103.396），ONS 在职人数的当前公开版本最近观察为 2025-04（34,011,034 人）。

开发预览 `/econ-hub` 全页视觉核验确认：原始经济日历完整位于前方，官方观察层、官方宏观观察研究台、字段来源目录和研究路径均后置；研究台的日本和英国主题出现新增字段，且仅对上述四项字段显示可切换的实际观察趋势区。初次截取显示的是读取中的骨架屏，等待官方下载完成后的第二次核验显示实际数值、微型趋势与追加趋势图，无外部跳转、模拟补点或原工作区位移。

完整 Vitest 回归通过 101 个测试文件、485 项测试；服务器与组件级低内存打包均通过。全站客户端打包在环境内存保护下被 `SIGTERM` 终止两次，随后以组件级打包确认新增研究台可编译；该环境限制不影响已通过的完整回归、服务端读取或开发预览核验。

## 2026-08-22 英日扩展指标与私有趋势窗口来源基线

| 机构 | 新增字段 | 官方机器读取端点 | 本轮实际核验 | 终端展示边界 |
|---|---|---|---|---|
| 日本银行（BOJ） | 核心 CPI 分项：除生鲜食品、能源及制度性因素；除食物、能源及制度性因素 | https://www.boj.or.jp/research/research_data/cpi/cpirev.xlsx | `chart` 表的 2020 基期实际同比列连续返回；2026-06 分别为 2.0 与 1.5 | 为 BOJ 调查统计局研究数据中的独立核心 CPI 口径，不拼接总 CPI、其他基期或预测。 |
| 日本银行（BOJ） | M3 平均残高货币存量 | https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=MD02&startDate=202501&code=MAM1NAM3M3MO | `STATUS:200`；单位为亿日元；最新实际观察为 2026-07，值为 16,412,355 | 仅为 BOJ 定义的 M3 平均余额，不解释为政策目标、流动性评分或资产价格信号。 |
| 英国国家统计局（ONS） | 失业率：英国、16岁及以上、全体成人、季调、三月滚动 | https://download.ons.gov.uk/downloads/datasets/labour-market/editions/PWT24/versions/1.csv | `rates`、`unemployed`、`16+`、`all-adults`、`seasonal-adjustment` 实际序列最新为 2025-02 至 2025-04，值为 4.60 | 只显示 ONS 当前开放版本中的实际三月滚动失业率；不以其他口径、其他来源或预测补点。 |
| 英国国家统计局（ONS） | 平均周薪：全经济总薪酬、季调 | https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/averageweeklyearningsearn01/current/earn01jul2026.xls | EARN01 `1. AWE Total Pay` 表的 `KAB9`（Whole Economy Weekly Earnings）连续月度实际观察；最新为 2026-05，值为 £748.7831 | 为 Great Britain 全经济总薪酬、季调水平；不混同常规薪酬、同比变化、实际薪酬或部门分项。 |

> 用户私有观察窗口预设只保存窗口名称、开始观察日、结束观察日和账户标识。它仅裁剪终端已读取的同字段实际观察，不改变来源读取、不生成缺失点，也不与其他账户共享。

### 本轮运行、权限与视觉核验

服务端直接读取确认 BOJ“除生鲜食品、能源及制度性因素”核心 CPI 为 2026-06 的 2.0%，BOJ“除食物、能源及制度性因素”核心 CPI 为 2026-06 的 1.5%，BOJ M3 为 2026-07 的 16,412,355 亿日元；ONS 季调三月滚动失业率为 2025-02 至 2025-04 的 4.60%，ONS 全经济总薪酬平均周薪为 2026-05 的 £748.7831。五个新增字段均返回最近 12 条同字段实际观察。

迁移 0057 创建 `economic_trend_window_presets`，并将既有地区预设枚举补齐 `japan`、`uk`。窗口预设按 `user_id` 与名称唯一，查询、保存和删除均使用受保护路径与用户条件；匿名读取、写入和删除被专项回归拒绝。预设仅保存名称、英日地区与起止观察日，图表只显示窗口内已读取实际观察，窗口为空时保持真实空状态。

开发预览 `/econ-hub` 二次全页核验确认：原经济日历仍在前方；官方宏观观察研究台后置显示新增 BOJ CPI 分项、M3、ONS 失业率和平均周薪卡片。英日实际趋势区的日期窗口与私有预设控制位于研究台内，读取完成后无骨架屏遮挡或原工作区位移。完整 Vitest 回归通过 101 个测试文件、485 项测试；服务端和新增组件级低内存打包通过。

## 2026-08-22 英日同窗口比较、薪酬切换与预设主题筛选来源基线

BOJ 三项核心 CPI 口径与 M3 的最近 12 条实际观察中有 11 个严格相同观察日；最新完整交集为 2026-06-01：除生鲜食品及制度性因素 2.7%、除生鲜食品、能源及制度性因素 2.0%、除食物、能源及制度性因素 1.5%、M3 16,397,801 亿日元。并列观察表只显示这类所有字段均存在的相同日期；2026-07 的 M3 不与尚未发布的 CPI 分项拼接。

ONS EARN01 `3. AWE Regular Pay` 表提供 Great Britain、全经济、季调的常规薪酬实际周薪，`KAI7` 列最新 2026-05 观察为 £699.2855；现有 `1. AWE Total Pay` 的 `KAB9` 同期总薪酬为 £748.7831。终端切换仅在两条各自实际序列间切换，不计算或暗示奖金归因，也不混入同比变动、实际薪酬或部门数据。

趋势窗口预设的主题筛选仅按预设保存时对应的日本 CPI/货币或英国薪酬/劳动力/活动主题过滤本账户记录；筛选不改写预设、源端实际观察或其他账户数据。

### 本轮运行、权限与视觉核验

服务端直接读取确认 ONS EARN01 总薪酬与常规薪酬两条 Great Britain 全经济、季调实际周薪均可读取，各自返回 12 条同字段观察。BOJ CPI 三个分项和 M3 的同日期核验显示：各字段均有 12 条历史观察、严格同日期交集为 11 期，最新完整交集为 2026-06-01；研究台仅将这 11 期中的当前窗口部分并列呈现。

迁移 0058 为 `economic_trend_window_presets` 增加默认值为 `all` 的主题字段，保留既有预设可见性。新建或更新预设时主题由当前英日趋势字段绑定，主题按钮只过滤当前账户查询结果；路由输入、查询、写入和删除仍受既有登录保护与 `user_id` 条件限制。

开发预览 `/econ-hub` 的第二次全页核验显示原经济日历仍保持在前，官方宏观观察研究台后置加载实际卡片；新增 ONS 常规薪酬实际卡片与总薪酬卡片均出现，英日研究区保留 BOJ 同日期表、ONS 切换及窗口主题筛选控制。完整 Vitest 回归通过 101 个测试文件、485 项测试；新增客户端和服务端组件级打包通过。

### 观察日对齐与最近使用排序追加核验

ONS 薪酬切换现以当前读取的总薪酬与常规薪酬各自实际观察日计算视觉状态。两者同日显示“观察日已对齐”；日期不同显示“观察日未对齐”，不补齐、不计算差异；任一字段不可读显示“当前不可读”，不推断发布时点。该状态只描述两个当前实际观察日是否一致，不表示数据质量、修订状态或薪酬构成结论。

迁移 0059 为 `economic_trend_window_presets` 追加可空 `last_used_at` 与账户级索引。应用预设时，受保护路由只按 `user_id` 更新该账户、该预设记录的最近使用时间；列表提供“最近修改”与“最近使用”排序，未曾使用的历史预设不被删除或填充虚构时间。开发预览二次全页核验确认原经济日历先显示、实际观察卡片与新增研究台控制均在追加层正常加载；完整 Vitest 回归通过 101 个测试文件、485 项测试。

### ONS 三期并列明细与私有预设闲置清理追加核验

ONS 薪酬对齐区现基于两条同字段实际历史各自的观察日期集合，按日期倒序展示最近三期。每一行只显示该观察日真实返回的总薪酬和常规薪酬值；两个值都存在时标为“同日实际观察”，只有单边实际值时标为“该日仅一条实际观察”。该表不把相邻月份、预测或其他薪酬序列填入缺失单元格。

闲置清理视图从当前账户的英日私有预设读取全部地区记录。闲置判断使用 `last_used_at`，若尚未使用则退回该预设的 `updated_at`；系统不伪造最近使用时间。批量删除入口仅接受最多 100 个预设编号与 1–3650 天阈值，服务端再次以当前账户 `user_id` 和截止时间复核后才删除，任何跨账户、非闲置或未选中记录均保留。开发预览二次全页核验确认原经济日历在前、官方宏观追加层的实际观察卡片、薪酬区与预设管理区均完成加载；完整 Vitest 回归通过 101 个测试文件、485 项测试。

### ONS 薪酬三期微型趋势与实际变化高亮追加核验

最近三期薪酬明细的总薪酬和常规薪酬列现各自以该字段最多六条已读取实际观察绘制微型趋势，并以当前明细行的相邻同字段实际观察计算列内变化。正变化使用绿色、负变化使用红色、持平或没有相邻实际观察使用中性灰色；颜色不表达跨字段比较、预测、因果解释或薪酬构成结论。两条薪酬序列仍只使用 ONS EARN01 的 Great Britain、全经济、季调实际周薪记录。

开发预览 `/econ-hub` 二次全页核验确认：原经济日历在前，官方宏观研究台后置加载实际 ONS 薪酬卡片、最近三期明细、两条列内趋势及变化颜色提示，且无骨架屏遮挡。完整 Vitest 回归通过 101 个测试文件、485 项测试；新增客户端组件级打包通过。
