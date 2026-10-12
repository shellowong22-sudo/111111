# API 到既有前端功能入口

本说明只记录已经存在的页面入口和后端读取链路。不会创建新页面，也不会把一个数据合同复制到多个功能。

## 读取链路

1. 后端适配器或 OpenBB 受控查询得到真实响应。
2. 后端清洗字段、移除管理字段和敏感信息，并按数据合同计算稳定指纹。
3. 数据写入 MySQL 的永久观测/发布记录；相同合同、标的、观测期和内容指纹会被去重。
4. 前端原页面通过 `useModuleLiveFeed(path)` 读取实时推送与持久化快照；结构化数据在原页面已有表格、图表或数据面板中渲染。
5. 浏览器完成实际渲染后返回 ACK。OpenBB 工作台会显示“查询已完成 → 自动投递目标 → 前端已确认”的生命周期。

## FinMind API 入口

| API 能力 | 既有前端入口 | 读取路径 | 真实时效边界 |
| --- | --- | --- | --- |
| TaiwanStockPrice | 股市 / EQS 股票筛选 | `/terminal?open=eqs&module=stocks` | 交易日历史观察，不标记为实时 |
| USStockPrice | 股市 / EQS 股票筛选 | `/terminal?open=eqs&module=stocks` | 交易日历史观察，不标记为实时 |
| TaiwanStockPER | 股市估值区域 | `/terminal?open=eqs&module=stocks` | 交易日/发布期观察 |
| TaiwanStockDividend | 股市股利区域 | `/terminal?open=eqs&module=stocks` | 公告日观察 |
| TaiwanStockInfo / USStockInfo | 股市标的目录 | `/terminal?open=eqs&module=stocks` | 目录信息，非行情报价 |
| GoldPrice | 大宗商品 / COMM | `/menu-item/COMM` | 参考观察，不标记为交易所实时 |
| TaiwanStockTotalReturnIndex | 指数 / WEI | `/index-hub?panel=WEI` | 交易日观察 |
| TaiwanFuturesDaily | 商品期货 | `/commodity-futures` | 交易日/交易时段观察 |
| TaiwanOptionDaily | 衍生品期权 | `/moso` | 交易日/交易时段观察 |
| TaiwanStockNews | 新闻与研究 CN | `/news-hub?tab=cn` | 只有真实文章记录才显示；无可验证文章时保持空状态 |

### 当前已验证的前端显示内容

以下数字是 2026-09-23 对永久归档的实际读取结果，不是目标值或占位值：

| 前端入口 | 当前显示的数据集 | 当前归档记录 | 最近观察期 |
| --- | --- | ---: | --- |
| `/terminal?open=eqs&module=stocks` | 台积电日频行情、苹果日频行情、台积电估值、台积电股利 | 63 / 60 / 63 / 4 | 2026-09-22 / 2026-09-18 |
| `/menu-item/COMM` | 黄金参考价格（同时保留该页独立的原油公共历史） | 815 | 2026-09-23 |
| `/index-hub?panel=WEI` | 台湾加权股价报酬指数 | 63 | 2026-09-22 |
| `/commodity-futures` | 中国期货公开快照、合约名称、成交价、成交量、未平仓量 | 13 | 2026-09-28 |
| `/moso` | 台湾期权日成交、行权价、看涨/看跌、成交量、未平仓量 | 800 | 2026-09-23 |
| `/news-hub?tab=cn` | FinMind 公司新闻 | 0 | 当前无可验证文章，保持真实空状态 |
| `/fund-browse` | 开放式基金净值公开快照 | 5,000 | 2026-09-28 |
| `/news-hub?tab=top` | 公开新闻动态 | 217 | 2026-09-28 |
| `/econ-hub?tab=ecst` | 中国 GDP、制造业 PMI | 82 / 224 | 2026-09-28 |

前端只接收清洗后的业务字段，例如观察期、标的、开高低收、成交量、未平仓量、行权价、期权类型、市盈率和股利。内部来源地址、Token、任务 ID、管理模块 ID、抓取过程和运行日志不会进入这些页面。

## OpenBB/API 入口

OpenBB 查询使用管理后台既有入口 `/admin/openbb`。选择一个已登记并可执行的合同后，点击“运行真实查询”。成功且有真实行时，后端立即自动投递到该合同唯一的既有功能槽，不需要再点击手动投递。

常用唯一绑定如下：

| OpenBB 能力 | 既有前端功能 |
| --- | --- |
| `equity_price_historical` / `equity_price_quote` / `equity_profile` | `/equity-market` |
| `index_price_historical` | `/index-hub` |
| `commodity_*` | `/commodity-market` |
| 期货历史/曲线 | `/commodity-futures` |
| 期权链 | `/moso` 或既有期权功能入口 |
| `company_news` | `/news-hub?tab=cn` |
| World Bank 年度经济指标 | `/econ-hub?tab=bie` 等对应经济分析子页 |
| FRED/官方经济系列 | 该合同声明的唯一经济分析子页 |

OpenBB 的 yfinance 部分接口如果返回空响应（例如 HTTP 204），前端会显示“暂无可验证观察”，不会用模拟值填充，也不会声称已完成全球实时行情。

管理后台入口为 `/admin/openbb`。查询结果区会直接显示：

- 查询是否成功、真实返回行数和观察期；
- 唯一自动投递目标；
- 可点击的“前端入口”链接；
- 等待前端确认或“自动投递已完成 · 前端已确认”；
- API OpenAPI 路径数、操作数、唯一分配、成功查询和永久观察数。

当前已实际确认 OpenBB/FRED 结果已在 `economic-wfii`、`economic-ecsu` 完成前端 ACK；最新 World Bank 人口查询已成功返回 8 行并自动投递到 `/econ-hub?tab=bie`，当前状态为等待该页面实际渲染 ACK。

## FinceptTerminal 压缩包功能盘点

`FinceptTerminal-main (1).zip` 不是一套可以直接复制到浏览器的 React 页面，而是 Qt/C++ 前端、C++ 服务和 Python 连接器混合工程。后台 `/admin/openbb` 的 “FinceptTerminal 能力归属” 区域现在会显示以下已核验的源码规模：

- 3,969 个压缩包条目；
- 320 个根级 API 连接器脚本，1,369 个 Python 脚本总量；
- 850 个 Qt 前端源文件、358 个 Qt 服务源文件；
- 448 个策略脚本、345 个分析脚本、178 个代理脚本。

该区域还会列出主要 Qt 功能域及其当前唯一入口。`已有入口·已验证合同` 才代表本平台已有数据合同；`已有入口·部分能力` 表示页面存在但仍受数据/授权边界限制；`仅盘点·未接入` 只说明压缩包确实包含该类前端代码，不会新增页面或伪造数据。

## TypeSafe 的边界

TypeSafe 仅用于新闻分类、语义重复判断和清洗决策：标题/摘要进入受限的 Choice/Noul 判断，代码使用固定阈值决定归类和去重。TypeSafe 不生成价格、指数、文章正文或缺失值；接口失败时使用可重复的确定性规则并保留真实空状态。

## 前端可见状态

- `FinMind/API 后端已接入`：当前既有功能已读到 FinMind 永久观测。
- `OpenBB/API 后端已接入`：当前既有功能已读到 OpenBB 结构化结果。
- `永久归档：已保存`：数据库已有稳定观测身份，可重启后读取。
- `API 暂无可验证观察`：当前合同没有真实可展示行，系统不会补模拟数据。
