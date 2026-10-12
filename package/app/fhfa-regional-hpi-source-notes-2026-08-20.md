# FHFA 地区级 HPI 数据接入说明

终端将使用 FHFA 官方公开下载文件，而不是从第三方页面摘取区域数字。首选数据集为季度 All-Transactions 州级和都市区级 CSV：`hpi_at_state.csv` 与 `hpi_at_metro.csv`。FHFA 官方数据集页面明确提供这两份免费 CSV，并标示其为基于销售价格和再融资评估数据估计的 All-Transactions 指数。[1]

MBS-11 默认展示州级观察；MBS-21 默认展示都市区观察。两者均支持名称筛选、最近可读观察的指数水平、季度变化和同比变化，以及 24 个季度历史趋势。数据服务端直接读取 FHFA 文件、校验表头、限制行数并设置短期缓存；上游不可读时保留真实空状态。

> FHFA HPI 衡量的是同一单户住宅重复交易或再融资的平均价格变化。指数可能修订，且不等同单项抵押物估值、CMBS 抵押品表现、资产权重、信用损失或交易价格。[2]

字段来源标签将区分“FHFA 公开 HPI”“FRED / Freddie Mac 公开抵押利率”“用户核验输入”和“终端计算”，不将任何标签解释为行情授权或投资建议。研究卡片导出只捕获当前终端内可见的表、指标、图表、数据边界和生成时点；不抓取外部网页内容。

## 运行时核验

MBS-11 已成功读取 FHFA 州级文件，并在终端内筛选 CA；MBS-21 已成功读取 FHFA 都市区级文件，并在终端内筛选 Los Angeles-Long Beach-Glendale, CA（MSAD）。两项均显示 24 个季度趋势、最新指数水平、季度变化、同比变化、公开利率观察、来源标签及 PDF/图片导出入口。没有将 FHFA 指数延伸为抵押物估值、地域权重、入住率、DSCR、损失或证券价格。

## References

[1] [FHFA HPI Datasets](https://www.fhfa.gov/data/hpi/datasets)

[2] [FHFA HPI FAQ](https://www.fhfa.gov/faqs/hpi)
