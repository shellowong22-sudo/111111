# BOE、BOJ 与 EIA 官方来源记录

本记录只保存本轮服务端实际读取所依据的主来源和观察边界。所有展示均为历史或已发布的公开观察，不等于实时行情、可执行报价、政策预测或投资结论。

| 来源机构 | 终端字段 | 主来源 URL | 实际核验观察 | 读取方式与边界 |
| --- | --- | --- | --- | --- |
| 英格兰银行 | 官方 Bank Rate | https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp | 2026-08-20，3.75% | 使用英格兰银行数据库 CSV 自动下载端点及系列代码 `IUDBEDR`；仅展示已发布 Bank Rate 历史观察。 |
| 日本银行 | 国内银行贷款同比 | https://www.stat-search.boj.or.jp/ssi/mtshtml/bs02_m_1_en.html | 2026-05-01，5.6% | 读取 BOJ 月度时序统计表首列的实际值；该字段不是 BOJ 政策利率。 |
| 美国 EIA | 商业原油库存（不含战略储备） | https://www.eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls | 2026-08-14，428,815 千桶 | 读取官方周度历史工作簿；跨产品视图仅比较同一发布日期。 |
| 美国 EIA | 成品汽油库存 | https://www.eia.gov/dnav/pet/hist_xls/WGTSTUS1w.xls | 2026-08-14，209,378 千桶 | 读取官方周度历史工作簿；不对缺失周插值。 |
| 美国 EIA | 馏分燃料油库存 | https://www.eia.gov/dnav/pet/hist_xls/WDISTUS1w.xls | 2026-08-14，105,619 千桶 | 读取官方周度历史工作簿；不包含实时地区库存或供需预测。 |

英格兰银行数据库的下载规范说明：https://www.bankofengland.co.uk/boeapps/database/help.asp 。日本银行主时序统计页说明其定期更新与数据包下载：https://www.stat-search.boj.or.jp/index_en.html 。
