# 佑诚金融终端 · 开发交接文档

> 新接手的开发者或 AI 先读完本文件，再按「待完成清单」逐条做。每次只做一两条，做完先自检再构建。

## 0. 两个 Claude 账号分工（必读，开工第一件事）
两个账号都通过“连接到这台电脑”直接改同一个文件夹 `...\package\app`，**靠“按目录分工 + 改前比对”避免互相覆盖**，不用分支。

### 分工
| 账号 | 负责范围（只改这些） | 不要碰 |
|---|---|---|
| **后端管理账号** | `server/**`（接口、数据采集、入库、`server/routers.ts`）、`shared/**`、`drizzle/**`、`scripts/**`、后台管理前端 `client/src/pages/admin/**`、`client/src/components/admin/**`、`client/src/components/AdminLayout.tsx` | 其余 `client/**` |
| **前端账号** | `client/**`（除上面后台管理部分）：`components/live/*`、各面板薄包装、`uc/**`、`pages/**`、`App.tsx` | `server/**`、`shared/**`、`drizzle/**`、`scripts/**` |

- 前端需要新接口时：在本文件第 0.2 节“接口需求”里写清“接口名 / 输入 / 返回字段 / 用途”，由后端账号实现；后端完成后在同一行标“已上线”。前端不要自己改 `server/`。
- `HANDOFF.md` 两边都可以改，但**只改自己负责的小节**；后端写第 0.2 节和第 3 节后端部分，前端写第 7、8 节。
- 新建文件用自己的前缀，避免重名：前端 `components/live/*Live*.tsx`，后端 `server/uc/*`。

### 每次写文件前（防覆盖）
1. 先把电脑上的该文件读回来（device_stage_files），与自己手上的版本比对；有别人的改动就在其基础上合并，不要直接覆盖。
2. 写完跑自检：`node scripts/dev-check/syn.cjs <文件>`、`python scripts/dev-check/impcheck.py <文件>`，都要 bad 0。

### 重建（同一时间只能一个）
- 两个账号都可以触发重建（`POST /api/trpc/ucAdmin.rebuild`），但触发前先读 `runtime-logs\claude-rebuild.log`：最后一行是 `DONE` 或 `BUILD FAILED` 才能触发；如果只有 `START` / `BUILD`，说明另一个账号正在构建，等 2 分钟再看。
- 构建失败会自动恢复旧版本：失败后看日志里的报错文件，属于谁的范围谁来修。

### 版本快照（git）
- 首次：用户在 `app\scripts` 双击 `git-setup.cmd` 建基线（只需一次）。
- 之后每完成一批并构建成功，请用户双击 `git-snapshot.cmd` 存一个还原点（AI 没有命令行，不能自己执行 git）。

### 0.2 接口需求（前端提，后端做）
| 接口 | 输入 | 返回 | 用途 | 状态 |
|---|---|---|---|---|
| （示例）ucHubs.xxx | {symbol} | {...} | 某面板 | 待做 |
| ucHubs.dividends | {symbols: string[]} | 每个标的近 10 年现金股息记录 [{exDate, payDate, amount, currency}] + 最新股息率 | DDIS 股息分布 / 股息增长（目前两个标签为空状态） | 已上线（2026-10-12，返回逐笔记录与近 12 个月股息率；payDate 为 null）|
| ucHubs.etfFlows | {symbols: string[]} | 每日份额 / 规模 / 净申赎（份额变化 × 净值） | ETF 资金流标签（目前为空状态） | 待做 |
| **修正** ucMarket.ticks（server/uc/market.ts 第 335 行附近，A 股腾讯行情） | — | `amount` 目前为“万元”（f[37] 未 ×10000），`volume` 为“手”；应统一为元、股（hubs2.ts 第 428 行已 ×10000，可参照） | 所有显示 A 股成交额的面板（ETF、TFLO、MOST 等），如 510300 今日成交额显示 30.47 万，实为 30.47 亿 | 待做（前端不做单位补偿，以免修正后翻倍） |
| 巴西 DI1 期货、台湾拆款定盘 | — | 见 §7 4a | CDIE / TWDI | 待做 |
| 市政债数据（MSRB 成交、发行日历、评级） | — | 见 §8 | 地方债工作台 | 待做 |

### 0.3 当前待办分配（建议）
| 事项（见第 7 节） | 账号 |
|---|---|
| 第 5 条：清理 `server/routers/derivatives.ts` 写死信号 / 空数组接口；后台管理页面检查与完善；数据入库与分区维护 | 后端管理 |
| 第 2 条：电子交易 / 订单 / 直通式处理面板接平台交易系统（如需新接口按 0.2 提） | 前端 |
| 第 3、4 条：写死数据的路由页面、同代码两套实现统一 | 前端 |
| 第 1、6 条剩余：GF、功能说明文档、沟通类面板 | 前端 |

## 1. 位置与运行
- 项目根目录：`C:\Users\shell\Documents\Codex\2026-09-02\new-chat\work\terminal-recovery\package\app`
- 服务地址：http://127.0.0.1:4173（后台管理在站内 admin 路由）
- 构建并重启：`scripts\claude-rebuild-and-restart.cmd`。它会依次执行 `pnpm run build`（vite 构建前端 + esbuild 打包后端到 `dist\index.js`），然后结束 4173 端口进程，由守护进程自动拉起新进程。
  - 构建日志：`terminal-recovery\runtime-logs\claude-rebuild.log`（GBK 编码）。
  - **注意：构建失败时，脚本会恢复 `dist-backup-before-claude` 里的旧备份，那份备份很早。所以构建前务必先自检通过。**
  - 屏幕锁定时，也可以用管理员身份在站内调用 `POST /api/trpc/ucAdmin.rebuild` 触发重建。
- 技术栈：React 19 + Vite + wouter（前端，`client/src`）；Express + tRPC v11 + superjson + drizzle(mysql2)（后端，`server`）。

## 2. 硬性规范（用户要求）
1. 前台**绝不显示数据来源**，不出现 Yahoo、CBOE、腾讯、东方财富等字样。来源只在后台可见。
2. **不编造数据**：不用 Math.random / Math.sin 抖动 / 写死的行情数字。没有公开数据的，改成可由真实数据计算的分析，并用一句话写明口径。
3. 不新增页面或子页，只在现有页面内做。各子页、面板的内容不能重复或同质化。
4. 不能有死按钮、假链接。新闻和文书一律在终端内阅读，不跳转第三方网站。
5. 界面全中文，专业终端风格：深色、无卡片圆角阴影、紧凑表格、等宽数字；**涨红跌绿**（UP=#f2495c，DOWN=#1fbf75）。
6. 清洗、去重后的数据全部写入平台自有数据库，永久保留。
7. 允许商用，能接入的数据源就直接接入。

## 3. 代码地图
### 后端 `server/`
- `server/uc/market.ts`：行情核心。
  - 报价 getTicks：腾讯 → 雅虎 → 全球扫描 → 新浪 → 东财，带熔断机制。
  - K 线 getKline：上游全失败时依次回退到平台库的 uc_kline、分钟快照合成。
  - parseSymbol 负责标的代码格式解析（见第 5 节）。
- `server/uc/marketInfo.ts`：个股的盘前盘后（getSession）、个股新闻（getNews，聚合十余路来源，含 A 股公告、美股个股新闻）、基本面（getProfile）。
- `server/uc/news.ts`：新闻引擎。
  - 约 100 个频道，做聚类去重、分类、情绪、标的识别，结果入库。
  - 其他功能：经济日历、宏观快照、证监会文书、正文提取（readArticle）。
- `server/uc/hubs.ts`：期权链、外汇参考利率、CFTC 持仓、美债与欧元区收益率曲线。
- `server/uc/hubs2.ts`：期货期限结构、货币市场利率、联邦基金期货隐含路径、美债拍卖、欧洲主权利差、商品分类持仓、隐波扫描、多标的日线、按揭利率与住房数据、可转债，以及时间序列库 uc_series。
- `server/uc/hubs3.ts`：机构 MBS、美联储持仓、证监会全文检索、法院与监管文书、财政支出、监管新闻稿、平台运行指标、证券检索、资产负债表等。
- `server/uc/trade.ts` 与 `routers/ucTrade.ts`：平台自有模拟交易系统，按实时行情撮合。订单、成交、持仓、交收全部入库。
- `server/uc/warehouse.ts`：永久数据仓库。
  - 表：uc_news、uc_kline、uc_tick_minute、uc_series。
  - 每 20 秒批量写入，按日分区。
- `server/uc/warm.ts`：开盘前预热常用标的。
- `server/uc/http.ts`：SSE 实时推送（`/api/uc/quotes`）、zip 上传、启动任务。
- `server/uc/zipSmart.ts`、`zipImport.ts`、`zipExplore.ts`：zip 导入的垃圾识别、自动映射、后台逐字内容浏览。
- `server/uc/netFallback.ts`：全局 fetch 拦截，负责请求改写和 curl 兜底。
- 路由：`server/routers/ucMarket.ts`、`ucNews.ts`、`ucHubs.ts`、`ucTrade.ts`、`ucAdmin.ts`，统一在 `server/routers.ts` 注册。

### 前端 `client/src/`
- `uc/market/live.ts`：前端数据核心。
  - 行情与 K 线：useTicks（SSE 推送）、useLiveKline / useKline（增量拉取 klineTail）。
  - 通用轮询 usePolled，以及 useNews、useProfile、useSession。
- `uc/hubs/`：专业页面。
  - 外汇 FxTerminal；债券 BondTerminal；衍生品 DerivTerminal；组合 PortfolioTerminal。
  - 利率与拍卖 RatesDesk；期货 FuturesDesk；信用 CreditDesk；波动率 VolDesk；资产配置 AllocDesk；地产与可转债 PropertyDesk。
  - 公用件：`kit.tsx`（HubShell / LiveBoard / Lines / Bars）、`calc.ts`（收益、波动、相关、风险平价、BS 定价）。
- `uc/panels/kit.tsx`：终端小窗外壳（PanelShell / Kpis / VirtualRows / DocList / useSaved）。
- `components/live/*.tsx`：所有小窗面板的真实数据实现。原面板文件（如 `components/CDXPanel.tsx`）只是薄包装，转调 live 实现。
- `uc/news/`：新闻终端（NewsTerminal、views、kit、EconCalendar）。
- `uc/trade/kit.tsx`：交易系统前端公用件。
- 路由表：`App.tsx`。

## 4. 自检（每次改完必须做，全部 bad 0 才能构建）
脚本副本放在 `scripts/dev-check/` 下（见同目录 README）：
- `node scripts/dev-check/syn.cjs <文件...>`：语法检查。
- `python scripts/dev-check/impcheck.py <文件...>`：检查导入的模块和具名导出是否存在。缺导出会导致 vite 构建失败。
- 再执行 `grep -n "Math.random\|Math.sin" <文件>`，确认没有造数。

## 5. 标的代码格式
| 类型 | 格式示例 |
|---|---|
| 美股 / ETF | `AAPL`、`SPY` |
| 指数、收益率、波动率 | `^GSPC`、`^TNX`、`^VIX` |
| A 股 | `sh600519`、`sz000001`；指数 `sh000300` |
| 港股 | `0700.HK` |
| 期货 | `CL`、`GC`、`ZN`、`KC=F` |
| 外汇 | `EURUSD`、`USDCNH` |
| 加密 | `BTC`、`ETH` |
| 其他国际市场 | `7203.T`、`ALI.PS` |

## 6. 已完成（截至 2026-10-12）
- WEI：实时推送、盘前盘后、全市场 K 线与技术指标买卖点、个股新闻（含 A 股公告、美股个股新闻、中文财经检索）。前沿市场（菲律宾、阿布扎比等）的报价已接入，K 线从当天起每天自动积累。
- 新闻终端：28 个功能代码都在同一工作台显示，正文在终端内阅读，经济日历实时更新。
- 外汇、固定收益、衍生品、组合、利率、债券拍卖、商品、贵金属、信用、主权、CDS 估值、波动率、外汇期权、行业轮动、资产配置、跨资产相关、风险压力、房地产、可转债：都已接实时数据。
- 终端小窗面板：投资组合、行业组、按揭证券、指数、直通式处理、订单管理、交易流水、定价与风险、市场、外汇、利率、信用、宏观、股票资金流等约 200 个面板，已改为真实数据。
- 后台：zip 内容逐字浏览、映射建议、垃圾识别；约 90 个垃圾模块已下架（可在后台恢复）。
- 数据库：数据永久保留并按日分区；K 线增量推送；开盘前预热；大表虚拟滚动。

## 7. 待完成清单（2026-10-12 全量排查结果）
排查方法：扫描所有被页面 / 路由引用、但没有任何实时数据调用（usePolled / useTicks / components/live / @/uc/）且含写死数组的组件。下面是仍需改造的文件，改造方式同前：实现写进 `components/live/*`，原文件改成薄包装；同一功能代码在所有入口用同一个实现。
1. 终端小窗剩余：GF（基本面图表）、SECDESC / MuniSecInfo（功能说明文档，需确认是否含写死行情数字）、`MBSRiskCenter.tsx` 中的 FavoriteSignalsSidebar。FIBC、NIB、LEAG、GC3D、GCT、IMGRBond 在 Terminal 里只有 import 没有渲染，可直接删除 import。（2026-10-12 已完成：ECST、BCLO/BYFC、GOVY、WIRP、CENB、ECFC、GOVI、WFII、ILB、ANR、ECAN、WBI、RV、MOST、CRAN、TAYLR、OMON、经济日历、NEWSRPT、NewsPanel、econ 的 ECAN/RSAN/CENB 标签。）
2. （2026-10-12 前端已完成）电子交易 / 订单 / 直通式处理 / 组合管理全部改接平台自有交易系统，见 §8。仍待处理：服务端 `orderManagement`、`stp`、`derivatives` 路由返回空数组或写死数据，前端已不再调用 `trpc.stp.*`，后端可清理。组合中心（/portfolio-optimizer）与组合小窗的 PORT / PORT VR / PORT SA 存在角度重叠（持仓盈亏、风险、压力测试），后续应统一。
3. （2026-10-12 已完成）路由页面写死数据与页面 / 小窗双实现：见 §8。/deri、/spread-drop、/energy-market 读取后台数据模块投递（非写死），保留；其投递表已去掉来源字样。旧页面文件（SWPMAdvanced、OptionPricingAdvanced、ActiveOptionsAdvanced、GlobalInterestRates、BondFutures、WBFAdvanced）与 uc/hubs 中的 BondFuturesDesk / CdsPricer / SovereignDesk / FxVolDesk / VolScanner / CorrDesk 已无路由引用，可删。
4. 货币市场菜单原 `MoneyMarketSpecialistPanels`（24 个功能一个组件，显示数据来源与外链）已全部换成 live 实现，`components/mm/MoneyMarketSpecialistPanels.tsx` 及其子组件已无引用，可删。后端 `moneyMarketResearch.getSnapshot` 仍在使用（BTMM / MMIDX / CDIE / TWDI）。
4a. **接口需求（给后端）**：巴西 DI1 利率期货报价（CDIE 需要期货隐含 CDI）；台湾金融业拆款定盘利率目前快照为空（TWDI 显示空状态）。
5. 服务端 `server/routers/derivatives.ts` 大部分接口返回写死的信号或空数组（如 bico.getSectorOverview 返回 []，getVolatilityData 是写死矩阵）。前端已不再依赖它展示行情；AI 生成类接口（generateStrategy / generateRiskReport）可保留。
6. （2026-10-12 已完成）沟通类改为真实数据，见 §8。`lib/commsStore.ts`（本地示例邮件 / 联系人）已无引用，可删。
7. 已无引用的旧文件可删除（不影响打包）：`GlobalCommodityPricesAdvanced`、`VolatilityAnalysisAdvanced`、`FXVolatilityAdvanced`、`components/index-panels/CIX*.tsx`、`INPPanel.tsx`、`components/forex/ForexRemediationWorkspaces.tsx`、`ForexDynamicResearchDesk.tsx`、`DynamicCurrencyRankBoard.tsx`、`ForexGpDynamicPanel.tsx`、`lib/dynamicFxSimulation.ts`、`components/ForexExtPanels.tsx`、`pages/BICO.tsx`、`pages/DerivativesLibraryAdvanced.tsx`、`components/news/*Panel.tsx`（菜单已转到新闻终端）。删除前先 grep 确认无引用。
8. 隐波分位依赖每日入库，满 20 个交易日后生效；前沿市场 K 线逐日积累。
9. **防重复原则**：每个功能代码只做一个分析角度、只有一套实现。改造前先 grep `components/live/*.tsx` 文件头注释和 App.tsx 路由，确认没有别的功能已经展示同一组数据。

## 8. 2026-10-12 本轮新增
- COSY 商品综合分析（宏观敏感度 / 商品间相关 / 持仓拥挤度 / 商品—股票传导）、CMRV 商品比值与相对价值：`live/CommodityLive.tsx`
- CIX 主要指数（盘中结构 + 走势对比）、CIXX 自定义篮子指数（可保存）：`live/IndexXLive.tsx`
- WCR 有效汇率与估值、WCRS 全球央行政策利率、FXCORR 外汇相关、FXSW 外汇因子策略与回测：`live/FxDeskLive.tsx`
- OVML 外汇期权定价、MARS FX 外汇组合风险、TOP FX 货币新闻热度、BICO 行业货币敏感度、MYQ 个人外汇监控：`live/FxDeskLive2.tsx`
- Terminal 外汇窗口的 FXIP / FXDS / FXTF / ECMI / STNI 改用 live 版本；FXIP 去掉与 WCRS 重复的政策利率块。
- 新接口：`ucHubs.cbRates`（28 个经济体政策利率 + 通胀，月度）、`ucHubs.eer`（名义 / 实际有效汇率，月度），均写入 uc_series。
- 自检脚本改名为 `scripts/dev-check/syn.cjs`（项目是 ESM，.js 无法运行）。
- OV 期权情景估值、DLIB 个人衍生品库：`live/DerivLibLive.tsx`；OVCV 小窗统一用 /ovcv 的可转债工作台。
- 去掉商品 / 外汇 / 衍生品小窗下方追加的“资料观察层”（与主面板重复，且显示来源）：`CommodityPreservedModule`、`ForexPreservedModule`、`DerivativesPreservedModule`。
- XDSH 外汇市场状态仪表、ALLQ 单一货币全球报价面、FRD 远期计算器、BFIX 平台半小时定盘、FXFA 套息交易分析：`live/FxDeskLive3.tsx`（终端外汇窗口与 /menu-item 外汇入口共用）。
- OVML 统一用 /ovml 页面的 FxOptionDesk，并把其中写死的默认政策利率换成 cbRates 真实数据。
- 经济数据中心（/econ-hub）：ECO 改用实时经济日历；ECST 保留官方月度 / 季度数据并加入各国年度与预测；新增 ECWB 经济工作台、ECOB 关键指标矩阵、SHOK 数据冲击与市场反应、FOMS 联储声明比对、MOSP 预测市场（`live/EconLive.tsx`、`live/EconLive2.tsx`）；删除写死的 FOMC / BE / BECO / BIE 标签（与新闻终端、WIRP 重复）；CBRT 统一用 WCRS。
- 股票 / 债券：MOST 最活跃证券、ANR 分析师建议、RV 相对估值（`live/StockXLive.tsx`）；ILB 美国通胀挂钩债、WBI 全球通胀挂钩债、BYFC 收益率预测、CRAN 固收工作表（`live/BondXLive.tsx`）。同质功能合并：GOVY→IRS、GOVI→SOVM、WIRP→利率工作台路径、OMON→衍生品终端期权链、WFII/ECST/ECFC/TAYLR→经济数据中心同一实现。
- 新接口：`ucHubs.imf`（各国年度宏观与预测）、`ucHubs.predict`（预测市场，概率逐日入库）、`ucHubs.fomc`（联储声明清单）、`ucHubs.analyst`（美股分析师一致预期）、`ucHubs.most`（美股 / A 股 / 港股活跃榜）、`ucHubs.realCurve`（美国实际收益率曲线）。
- /bico、/dlib 路由改用 BicoLive、DlibLive；/menu-item 下的新闻代码统一跳转新闻终端对应功能；GMM / RRG / INP / SECF / CPLY / SEAG / CCRV / GCDS 的旧静态副本改为同一 live 实现。
- 电子交易（EMSX）：GOVT / FIT（利率隐含公允变动）/ FITG / CORP / BOLT / AGENCY / EM / EBND / MUNI 在 `live/EmsxLive.tsx`；IMGR / TRDE / IRSWAP / CDS / EQUITY / FX / WORKFLOW / ETBT / WATL 在 `live/EmsxLive2.tsx`。同质合并：PTBB→AIM、BLOT→STP BLOT、MIFIET→MIFI、VCON→VCAD、UACK→IB、TSOX→OMS 总览；删除 BBTM / IMGRMUNI / MBWD / BOOM / NOTC 标签。
- 订单管理（/order-management）：BBS 按策略标签执行质量、BSS 按市场与币种的成交与费用、BSKT ETF 跟踪偏离（`live/OmsLive2.tsx`）；其余标签统一到 Ledger / STP / PortOps 已有实现。
- 直通式处理（/stp-processing）：整页改为功能面板工作台（ESTP、BLOT、VCAD、DTCP、FXSS、ALOS、FSTN、SREF、RESD、RHUB），不再调用 `trpc.stp.*`。新增 DTCP 净额交收（逐证券轧差，`live/STPLive4.tsx`）。同质合并：VCON→VCAD、FXTB→FXSS、ALEX→ALOB、POST / STPE→ESTP、RHAD→RHUB。
- 组合管理小窗（PortfolioManagementPanel）：BBU 基准拟合度与保存基准、PORT IP 日内盈亏路径、PDSP 行情位置与动量、PORT TE 主动风险、PORT CH 组合基本面特征（`live/PortLive2.tsx`）；PORT HP 已实现历史业绩、PORT PA 本币 / 汇率归因、PORT TS 下单前测算、NL 持仓新闻情绪、EVTS 业绩预期与申报、PREP 报告快照与对比（`live/PortLive3.tsx`）。同质合并：PORT HD→PORT CH、DRPT→PREP、MIFI→STP MIFI、PRTU / PORT OP→组合中心（PortfolioTerminal 新增 `initialFunc` 参数）。`PortOpsLive.tsx` 导出 useBook / useBookReturns 供复用。
- 页面与小窗统一为同一实现（App.tsx 中 `Full` 满屏外壳）：/wbf、/bond-futures、/wbf-ai→WbfLive；/cdsw→CdswLive；/wcds 与 WCDS 小窗→SOVRLive（单名 CDS 估值只保留 CDSW）；/wvol→WvolLive；/vca→VcaLive；/mars→MarsLive；/interest-rates 与 GRM 小窗→WbmvLive；/ovme→期权估值引擎 VAL（LiveValuation）。
- 新增 SWPM 掉期估值（SOFR 期货条推算短端 + 美债加利差外推长端，现值 / 平价 / DV01 / 关键期限 / 现金流 / 情景 / 互换簿永久保存）、MOSO 最活跃期权（14 个标的真实期权链成交排名、看跌看涨比、异动合约）：`live/DerivXLive.tsx`。原 MOSO 小窗显示的是股票动量因子，已替换。
- 货币市场菜单 24 项：BTMM 资金面监控（MKTBEAT、TCON 同一实现）、MMIDX 复利平均与累计指数、FIBC 债券计算器（信用菜单 CALC 同一实现）、CDIE 巴西 CDI、TWDI 台北拆款（`live/MMLive2.tsx`）；其余映射到已有实现：DES→DesBondLive、PGM / BOOM→PGMLive、RV→IRS、YCQSIM、GC→YLD、CRVF→BCMP、EFSF、EDSF、WBF、PBOC、CENB、ETRADE→GOVT、NEWS / MMFLOW→货币市场新闻研究、SOURCE→集成监控。信用菜单 BTMM / GC / YCURVE / GLBBOND / CALC 也改为同一实现。
- `ModuleLiveDeliveryTable`（约 24 个页面共用的后台数据投递表）去掉“来源 xxx”“OpenBB/FinMind 已接入”等字样，标题中的 OpenBB 一并去掉。
- GF 图形化基本面：年度 / 季度营收、净利、毛利、自由现金流、每股收益与利润率、同业对比（`live/GfLive.tsx`），原写死数据已移除。
- 沟通类（`live/CommsLive.tsx`）：MSG / IB / CMTY / SHAR 统一为平台讨论串 CommsResearchLayer（账号间真实收发）；PEOP / BIO 平台成员目录（可发起讨论）；NOTE 个人笔记（数据库永久保存，可关联标的显示实时行情）；FILE 我的资料库（汇总各功能保存的个人数据，可导出）；SPDL 统一为 STP 的证券速拨目录；MGU / MRUL / VACN / SMGM 统一为提醒规则与提醒记录。
- Terminal 删除未使用的导入（GCT、GC3D、NIB、LEAG、FIBC、IMGRBond 及货币市场旧面板）。
- 终端通用窗口：市场情绪（价格与期权隐含的 0–100 情绪分）、选股筛选器（按市场多条件筛选）、GIY 日内收益率（`live/MarketXLive.tsx`）；量化回测→BKT、投资笔记→NOTE 同一实现。
- 定价与风险页：决策看板（持仓风险收益 + 规则提示，非建议）、合约静态数据与生命周期、资本占用（`live/PricingXLive.tsx`）；希腊值→DLIB、情景模拟→PORT TS、资产分类→PORT CH。
- 信用菜单：BYFC 小窗→ByfcLive、CRPR→MKTOV、RATC 评级变动（按真实新闻归类上调 / 下调）、PRICING / YAS→FIBC 债券计算器。
- ECTR 贸易流量重写（美国贸易伙伴、各国贸易差额、IMF 贸易量增速、贸易敏感资产），小窗与经济中心同一实现；CBRT 小窗→WCRS；FCON 小窗→经济中心 FCON；WFII 去掉空的 KPI 条与“货币危机 / 跨境支付”两个无数据视图。
- 地方债工作台：去掉“业务操作”页（其背后 16 个 municipalResearch.*Status 接口均返回 restricted 空数据），保留工作台真实数据与计算页。**接口需求**：市政债指数、成交（MSRB）、发行日历、评级等真实数据源。
- /curves-compare→YLD；电子交易 MONEY→BTMM。
- 同代码多实现统一：WEIF（指数中心 / 市场菜单）→WeifFuturesLive；GMM→MacroGMM；IMGR（电子交易 / 信用 / 主权三处）→ImgrLive；MAP→MapRatesLive；WBIX→IdxWBIX；GP→GpMarketsLive；FIT→FitLive；CIX（两处）→CixxLive；IN（终端小窗 / 指数中心）→新 IdxIN 指数浏览器（`live/IndexInLive.tsx`：区间收益阶梯、月度收益热力表、回撤、滚动波动、日收益分布）。
- IMAP 日内市场图重写（`live/ImapLive.tsx`）：板块 / 细分行业 ETF 瓦片（面积按成交额、颜色按涨跌）、所选板块 vs 标普盘中路径、盘中广度与分化、明细表；原面板中 9 处“资金流 / 逐笔 / Level 2 未配置”空视图移除。
- ETF 小窗重写（`live/EtfLive.tsx`）：美国宽基 / 海外 / 行业主题 / 商品 / A 股 / 港股 ETF 的行情、52 周区间位置、表现与风险（波动、回撤、对标普贝塔与相关）、类别路径；原“资金流量 / 溢价折价”未配置视图移除。DDIS 股息分析重写（`live/DdisLive.tsx`）：红利与股息增长 ETF 的表现、相对基准、与长债相关、相对强弱曲线；个股股息明细等后端 ucHubs.dividends。
- 股票智能驾驶舱（cockpit）：加入实时报价条（名称 / 行业 / 市值 / 市盈率 / 成交额）、多周期实时 K 线（1 分–周 K）、标的相关实时新闻、期权摘要卡（`live/CockpitLive.tsx`、`live/NceoOptionsLive.tsx`，真实期权链：隐波、偏度、看跌看涨比、最大痛点、平值附近买卖价）；删除“分钟线未授权”按钮、“数据层状态”“当前未授权”等空块与来源字样。NCEO 面板的“授权报价状态（未配置）”换成同一期权摘要卡。`StockCockpitNewsPanel.tsx` 已无引用可删。
- EMSX：终端小窗、/menu-item 与电子交易页统一为 `live/EmsxOrderLive.tsx`（平台模拟交易系统下单票据 + 我的委托）；电子交易页删除旧下单表单死代码与写死的经纪商 / 账户列表，EMSX 总览在未登录时显示“—”而不是“数据源不可用”。
- FXC 外汇交叉汇率统一为 `live/FxcLive.tsx`（终端外汇小窗与 /forex-hub 的 FXC 标签同一实现）：实时交叉矩阵 + 按两国政策利率的利率平价理论远期（1 月–1 年远期与远期点），替换原“远期合同未接入”空档。`pages/ForexHub.tsx`、Terminal 中的 FXCrossMatrixWorkspace / ForexOriginalInteractionBridge 仅有导入无渲染，可删。
- CACT：地方债菜单的 MunicipalCACTPanel 改为股票 CACT 同一实现；去掉每行都显示“来源未配置”的一致预期 / 意外幅度两列。IPO：去掉“IPO 发行价 来源未配置”等空行与锁定期 / 核验状态空列。
- **用户新规（2026-10-13）：界面不出现计算公式、计算口径 / 方法说明及其他暴露性、敏感文字**（含“= ÷ × Σ”式子、“口径：”“模型：”“回归”“代理”等方法描述、数据提供方、接口与时效状态措辞）。已处理：所有 live 面板的 `Note` 组件改为不渲染；各面板副标题中的公式段落已删；遗留面板（市政 AAA / 证券信息、优先股、按揭、ECSU、世界银行视图、指数基准、OILS 等）的公式段落已删；/financial-analysis 改用 GF 实现；底部全球行情条与终端右侧“市场观察”改为实时报价（涨红跌绿，中文名称，不显示代码后缀、来源与时效状态）。后续新增面板请直接遵守。
- 数据观察（给后端）：ucHubs.closes 中 VIG 只有 1 个点（未回补历史）；HDV、SCHD 与 SPY 的一年日收益相关仅 0 / 0.29（VYM 为 0.74），建议核对这两只的历史序列。
- 新闻类小窗 FIRS / TOP / TREN / BI 改为跳转新闻终端对应标签（`components/news/NewsGoto.tsx`），bi 在新闻终端里别名到 ni。
- 全站去掉数据提供方名称、“来源 xxx”字样、来源列和外链（target=_blank 链接改为纯文本）：曲线、因子、证券信息、主权日历 / 检索、RES、WEI、IN、基金持仓、加密货币、EVTS、GIPO、EQBT、EQS、TOP 债券、BLS 宏观、地方债、事件标记、OpenBB 数据页（信用分析、G7 曲线、外汇曲线、外汇中心、基金浏览、利率期货）等。加密货币、基金浏览、外汇曲线的涨跌色改为涨红跌绿。用户自己登记的“来源 / 核验文件”字段（研究底稿、披露登记）保留，属于用户数据。
- 重建日志位置：`terminal-recovery\runtime-logs\claude-rebuild.log`（不在 package\app 下）。
- 待清理（不影响显示）：`pages/EconomicDataHub.tsx` 中已不渲染的写死常量（ECO_CALENDAR 等）、`components/econ/ECTRTab` 旧常量已随重写删除。仍有少量页面以文字注明个别字段“未接入”（PMI、TAYL、ECSU、FCON 等），主体数据真实。
