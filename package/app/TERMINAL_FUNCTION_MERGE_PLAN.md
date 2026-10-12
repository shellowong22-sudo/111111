# 终端功能合并方案（2026-10-04）

## 本轮已经执行

本轮不是删除功能，而是把重复入口归一到现有工作台：

| 合并组 | 统一入口 | 旧入口处理 |
| --- | --- | --- |
| 市场数据 | `/market` | 保留旧深链，统一到行情中心 |
| 股票/权益 | `/equity-market` | `stocks/equities/equity-market` 归一；EQS、WEI 等专用面板继续保留 |
| 大宗商品 | `/commodity-market` | `commodities/commodity-market/fdm` 归一；CFTC、OILS 等专用面板继续保留 |
| 指数 | `/index-hub?panel=WEI` | 指数别名归一到已有指数中心 |
| 外汇 | `/forex-hub` | 外汇别名归一到已有外汇工作台 |
| 衍生品 | `/terminal?module=derivatives&open=fom` | 只保留已有衍生品专用面板，不创建通用假页面 |
| 新闻与研究 | `/news-hub?tab=top` | 各新闻代码进入同一个新闻中心标签，不复制数据 |
| 经济分析 | `/econ-hub?tab=ecst` | 各经济代码进入同一个经济中心标签，不复制数据 |
| 基金 | `/fund-browse` | 基金/基金筛选入口统一到已有基金浏览工作台 |
| 加密货币 | `/crypto-market` | 加密货币别名统一到已有加密市场页面 |
| 投资组合与风险 | `/portfolio-optimizer` | 投资组合与风险入口统一到已有组合工作台 |

注册表位置：

`client/src/config/terminalFeatureRegistry.ts`

它只负责入口归一化，不生成行情、不生成随机数据，也不替代具体模块的数据契约。

## 不变的规则

1. 专用面板优先：`EQS`、`WEI`、`CFTC`、`OILS` 等具体功能码仍由原有面板处理。
2. 旧 URL 兼容：旧 `module/open` 深链不失效，只在重复入口处归一。
3. 不为未知功能创建 `/menu-item/*` 假页面；未知项仍需先接入真实数据契约。
4. 无代码的菜单项现在作为分类标题显示，不再伪装成可点击按钮。
5. 数据由统一工作台的现有 live-feed/API 提供，合并注册表不复制请求。

## 后续合并顺序

1. 先逐项盘点每个菜单项的数据契约、刷新频率、来源和有效观察字段。
2. 只有已有真实数据契约的项才加入统一工作台；没有契约的项保持原样并标明未接入。
3. 对同一数据集只保留一个 canonical `moduleId + contractId`，下钻只传筛选条件，不复制数据集。
4. 每组完成后验证：旧 URL、canonical URL、刷新、空数据状态、来源/观察时间和错误状态。

本文件记录的是合并治理与已执行范围，不代表三百项功能已经全部具备真实数据。
