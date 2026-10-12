# 货币市场公开原始数据来源说明

本文件仅记录已核验的公开原始资料入口、可用字段和产品边界；不代表这些序列提供单券报价、可执行价格、交易深度、投资建议或市场预测。

| 来源 | 可用公开内容 | 已核验字段/频率 | 计划使用边界 |
| --- | --- | --- | --- |
| [FRED：SOFR](https://fred.stlouisfed.org/series/SOFR) | 纽约联储担保隔夜融资利率历史观察 | 日度、百分比、非季调；页面注明来源为纽约联储 | 用于货币市场隔夜利率路径、窗口统计和 SOFR 与其他公开利率的历史差值；不等同回购交易可执行报价或期限 SOFR。 |
| [FRED：EFFR](https://fred.stlouisfed.org/series/EFFR) | 纽约联储有效联邦基金利率历史观察 | 日度、百分比、非季调；说明为 FR 2420 报告交易的成交量加权中位数 | 用于无担保隔夜资金基准路径和 SOFR/EFFR 历史比较；不推导银行个体融资成本。 |
| [美国财政部 Fiscal Data：Treasury Securities Auctions](https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/) | 已公告及已拍卖的可交易美国国债 | CUSIP、证券类型/期限、拍卖日、发行日、到期日等；官方 API 为 `v1/accounting/od/auctions_query` | 用于 BOOM、BTMM、TCON 的国库券与短端拍卖日历、结果、期限结构和来源导航；不构成二级市场报价。 |
| [美国财政部 Fiscal Data：Upcoming Auctions](https://fiscaldata.treasury.gov/datasets/upcoming-auctions/) | 未来一周将公告或拍卖的可交易美国国债 | 证券、公告日、拍卖日、发行日；按需要更新 | 用于即将发生的美国国库券事件与工作流提醒；仅显示官方披露可用字段。 |
| [台湾中央银行：Interbank Overnight Call-loan Rate](https://www.cbc.gov.tw/en/lp-696-2.html) | 台湾银行间隔夜拆款利率 | 日度表格：Date、Rate；页面更新于 2026-08-19 | 用于 TWDI 的公开隔夜拆款观察、时效说明及 CSV 导出；不等同 TAIBOR 或未授权期限拆款报价。 |
| [中国人民银行（英文站）](https://www.pbc.gov.cn/en/3688006/index.html) | 货币政策与公开市场原始公告入口 | 可核验公告与政策信息；结构化市场利率覆盖依公告而定 | 用于 PBOC 的原始公告索引、用户核验记录与资料来源导航；无稳定结构化免费序列时不得填充市场利率或预测。 |
| [巴西中央银行 SGS：系列 12](https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/20?formato=json) | CDI 日度观察 | JSON 字段为 `data`（DD/MM/YYYY）和 `valor`；公开端点单次最多 20 个最近值 | 用于 CDIE 的实际 CDI 历史观察、累计比较和用户输入 DI 期货隐含年化收益率的透明差值；不提供、推断或替代 DI 期货报价。 |

## 数据与界面边界

1. 所有公开序列展示原始发布日期或最近成功读取时点。短时缓存只能改善加载，不改变原始频率或将 EOD 序列描述为实时数据。
2. 公开序列无法支持单笔回购、银行间拆借盘中深度、可执行 bid/ask、FRA 或期货报价时，界面必须显示授权边界或用户核验输入，不使用随机数、静态样本或预测替代。
3. 任何以公开利率为基础的价差、窗口统计或用户输入计算，均需保留参与序列、观察窗口与来源链接，且不显示交易指令或个性化投资结论。

## 核验记录

- 2026-08-19：已在台湾中央银行英文公开页面核验 `Interbank Overnight Call-loan Rate` 的日度 `Date` / `Rate` 表格和页面更新标记。服务端读取超时或页面结构变更时，TWDI 必须显示真实空状态，不能回退为样本曲线。
- 2026-08-19：终端深链接可打开 MKTBEAT 与 CDIE 专属窗口。公开数据为异步读取，首屏使用加载状态；只在服务端公开快照完成后展示真实观察，否则保持明确空状态。

## 央行政策文件原始来源

| 来源 | 可核验原始资料 | 高亮边界 |
| --- | --- | --- |
| [美联储 FOMC 日程、声明与纪要](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) | 会议日程页提供 FOMC 声明与纪要的 HTML/PDF 原件链接；截至 2026-07-29 页面列示 2021–2027 年相关材料。 | 只显示从用户选择的 HTML 原文中提取的命中片段及链接；“目标区间”“维持/上调/下调”“前瞻性表述”均为关键词辅助，不自动归纳政策立场。 |
| [欧洲央行货币政策决定](https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html) | 管理委员会货币政策会议日发布决定新闻稿，并链接到政策声明/问答文字稿和货币政策会议纪要。 | 只允许 ECB 官方域名的原始文件；保留原文上下文和链接，不把关键词命中转化为预测。 |
| [英格兰银行货币政策](https://www.bankofengland.co.uk/monetary-policy) | 官方说明 Bank Rate 及量化宽松工具；具体决定须由用户选取并核验对应原始页面。 | 只允许官方域名；若无法读取具体公告，显示来源索引和真实空状态。 |
