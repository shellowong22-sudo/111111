# BLS 官方发布日期字段来源记录

本记录服务于宏观经济仪表板后置的 `BLS PUBLISHED RELEASE EVIDENCE`，并将“统计观测期”“官方发布日期”和“本次终端读取时间”严格区分。

| 统计发布 | 官方发布日历 | 2026 年 7 月参考期的发布日期 | 计划发布时间 | 覆盖的证据台系列 |
| --- | --- | --- | --- | --- |
| Consumer Price Index | `https://www.bls.gov/schedule/news_release/cpi.htm` | 2026-08-12 | 08:30 AM | CPI-U `CUUR0000SA0` |
| Employment Situation | `https://www.bls.gov/schedule/news_release/empsit.htm` | 2026-08-07 | 08:30 AM | 失业率 `LNS14000000`、总非农就业 `CES0000000001` |

上述字段首先由 2026-08-25 的 BLS 官方浏览器页面核验。BLS Public Data API v2 提供已发布的时间序列观测，但其响应未附带发布日期；证据台因此独立读取 BLS 官方发布日历，并以“参考月”匹配数据 API 的 `YYYY-MM` 观测期。实际运行的服务器路由已成功返回 CPI 为 `2026-08-12 08:30 AM`，就业形势系列为 `2026-08-07 08:30 AM`。

部分直接命令行访问曾对日历页面和 iCalendar 地址返回 `403 Access Denied`。路由对日历读取设置了 12 秒超时并保留真实不可用状态：如 BLS 日历未来不可访问或找不到匹配参考月，`officialReleaseDate` 保持空，界面显示“BLS 日历本次不可获取”或“日历未匹配”，绝不将 `fetchedAt`（终端读取时间）或推测日期标为官方发布日期。
