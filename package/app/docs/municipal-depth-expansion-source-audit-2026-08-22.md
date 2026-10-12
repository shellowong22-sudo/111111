# 地方债逐模块深度扩展：数据源与授权边界审计

审计日期：2026-08-22

## 已核验的官方资料能力

| 来源 | 可核验内容 | 适合追加的模块 | 终端内使用边界 |
| --- | --- | --- | --- |
| MSRB EMMA | 市政证券检索、交易价格、官方说明书、信用评级、持续披露、发行人资料、发行日历及统计资料 | MSRC、SMUN、CDRN、CDRC、CDRA、CACT、MSRB | EMMA 网页可读性不等于本项目已获结构化实时数据订阅；在无授权连接时不得抓取、缓存或转述为实时成交、报价、日历或评级字段。 |
| MSRB 数据订阅服务 | 交易、短期债务、一级市场、持续披露等结构化订阅产品 | MSRB、VRDN、CDRV、DEAL、MBWD、BOOM、MBIX | 当前项目未启用该订阅；必须保持真实空状态，不能用示例交易、库存、指数或报价替代。 |
| Treasury Fiscal Data：SLGS Daily Rate Table | 日度 Demand Deposit 利率、Time Deposit 分期限最高可用利率 | AAA、BTMM、CNDS、CDRV、VRDN、BMA、SLGS | SLGS 为非流通证券，不得标注为市政债 AAA 曲线、VRDN/SIFMA 基准、可成交报价或指数。 |
| Treasury Fiscal Data：SLGS Monthly Program Statistics | 按证券类型的未偿证券数与本金余额 | AAA、BTMM、PICK、CNDS、MCAL、BMA、SLGS | 仅为 SLGS 计划统计，不代表地方政府债务余额、市场供给、指数权重或客户库存。 |

财政部 Fiscal Data API 文档已核验为开放 REST GET 接口，无需账号或令牌；端点由数据集详情页列出的版本化 endpoint 确定，字段、类型和空值必须以实际响应为准，不能依据界面文本猜测。请求采用 `fields`、`filter`、`sort` 与分页参数，并返回 JSON 数据与元数据。

## 模块追加原则

1. 每个模块的原面板、菜单顺序、字段、路由与交互继续由保护测试固定；新增能力只能挂载在原面板之后。
2. 对有官方数据但非同类市场数据的模块，仅提供清楚标识的参照、覆盖审计、期限结构或输入研究，不作同类市场事实替换。
3. 对 MSRB 成交、一级市场、短期债务、报价、库存与指数等需订阅资料的模块，保留可操作的授权闸门、证据工作流或真实空状态；不得生成模拟表格、假链接或无执行结果的按钮。
4. 每项可视化必须可追溯到实际返回字段，显示观察日或抓取时点，并提供加载、错误和无数据状态。

## 核验参考

1. MSRB, *About EMMA*: https://www.msrb.org/Transparency-and-Technology/About-EMMA
2. MSRB, *Data Subscription Services and Products*: https://www.msrb.org/Market-Data-and-Research/Data-Subscription-Services-and-Products
3. U.S. Treasury Fiscal Data, *SLGS Daily Rate Table*: https://fiscaldata.treasury.gov/datasets/slgs-daily-rate-table/
4. U.S. Treasury Fiscal Data, *Monthly SLGS Securities Program Statistics*: https://fiscaldata.treasury.gov/datasets/slgs-securities-program-stats/
5. U.S. Treasury Fiscal Data, *API Documentation*: https://fiscaldata.treasury.gov/api-documentation/

## 开发验证记录

地方债 21 个原入口保护、研究边界、导出、完整性与发行人证据专项测试均通过。预览代理在本次深链检查中返回空白画面，但开发服务日志未出现本轮地方债组件的新增运行时错误；此类代理状态不被用作市场或功能事实。后续交付前仍需以本地路由响应和完整回归验证为准。
