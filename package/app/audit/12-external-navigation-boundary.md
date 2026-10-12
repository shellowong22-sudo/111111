# 站内展示与冻结外链的边界审计

用户要求结果留在终端内，禁止以跳转第三方网页作为功能结果。对 `client/src` 的静态扫描最终复核发现 **12 处直接 HTTP(S) 外链调用，分布在 9 个文件**。扫描模式包括 `href="https://…"`、`window.open("https://…")` 和直接 `location.href` 赋值；它不涵盖由数据字段动态生成的 URL。

后续分类扫描确认：12 处均为静态 `href="https://…"` 锚点；静态 `window.open("https://…")` 与静态 `location.href = "https://…"` 均为 0。因此当前独立捕获层的目标范围与这 12 个已发现入口一致；动态 URL 和实际点击行为仍必须另行验收。

原动态扫描的 52 处计数不完整。以 `href={[^}]*}` 对当前工作副本与只读冻结归档重新复核，两边均有 **76 条动态 href 总数**，覆盖信用研究、货币市场、抵押贷款、主权融资、曲线、发行、通讯及电子交易组件。其中 2 条为可静态识别的终端内部路径、5 条为终端自身 ICS/WebCal 订阅端点；其余 **69 条变量/URL 表达式候选**必须在运行时判定是否为 HTTP(S) 外部来源。若解析为 HTTP(S)，它们会被 `InternalSourceBoundary` 的 document 捕获层处理；但其 URL 来源、是否为外部地址以及每个入口的实际点击尚未逐项验证。故“12 处静态外链”只能视为常量 URL 下限，不能视为全项目外链总数。

### 动态 href 验收队列（冻结归档分布）

76 条动态 href 分布于 31 个 TSX 文件。为避免以“模块代表点击”替代逐入口审计，后续按高密度文件、同页多来源和可达模块顺序推进；以下数量是动态总数，仍包含内部/订阅端点，不能直接等同外部跳转数。

| 优先级 | 冻结文件 | 动态 href 数 | 当前审计状态 |
|---|---|---:|---|
| 1 | `credit/CreditResearchWorkbench.tsx` | 10 | filings、calculator、boundary 等分支；部分 SEC 已验证，仍须逐分支和逐 URL 分类 |
| 2 | `mortgage/MortgageMarketPanels.tsx` | 8 | 未展开的高密度队列；抵押债 11 号匿名浏览器会话当前未获得可用 DOM |
| 3 | `credit/CreditPostTradeDeliveryPanels.tsx` | 7 | 尚未按文件逐条验收 |
| 4 | `sovereign/SovereignFinancingCalendar.tsx` | 5 | 含 5 条订阅端点，需与外部候选拆分 |
| 5 | `credit/CreditSpecialistPanels.tsx` | 5 | 部分 FRED/H.15 已证实，仍须逐表达式拆分 |
| 6 | `mortgage/MortgageAnalyticsPanels.tsx` | 4 | 尚未按文件逐条验收 |
| 7 | `mm/MoneyMarketDepthEnhancer.tsx` | 4 | 尚未按文件逐条验收 |
| 8 | 其余 24 个文件 | 33 | 每文件 1–3 条；仍列入逐入口队列 |

| 受影响文件 | 已见外链用途 | 当前处理 |
|---|---|---|
| `GCDSPanel.tsx` | 公开数据提供方说明 | 保留为冻结原行为，未将其当作研究结果或点击验收通过 |
| `MKTOVPanel.tsx` | SEC EDGAR | 保留来源说明；不视为终端内披露检索结果 |
| `NEWSRPTPanel.tsx` | SEC EDGAR | 页面已具备终端内查询/选择状态，但静态来源锚点仍存在 |
| `credit/CreditCoreSpecialistPanels.tsx` | 信用研究来源链接 | 需逐入口评估是否可由现有终端内资料替代 |
| `credit/CreditIssuerAndAnalyticsPanels.tsx` | 信用发行人/分析来源链接 | 同上 |
| `credit/CreditResearchWorkbench.tsx` | 信用研究工作台来源链接 | 同上 |
| `credit/CreditSpecialistPanels.tsx` | 专项信用来源链接 | 同上 |
| `mm/BoomAuctionCollaborationPanel.tsx` | 拍卖/协作来源链接 | 同上 |
| `mm/BoomSubscriptionFilters.tsx` | 订阅/筛选来源链接 | 同上 |

> 此处的 12 个静态外链与用户“仅在终端实现查看”的运行要求存在冲突，但它们属于冻结归档文本和布局的一部分。未经逐组件验证，不会批量删除、替换或伪装为站内结果。后续只可在独立扩展层提供终端内可读的来源摘录、限制状态或已有 API 结果，并保留原页面的来源边界。

静态扫描证据见本轮终端输出 `/home/ubuntu/terminal_full_output/2026-08-26_16-52-59_414397_1129.txt`。动态链接、按钮处理器和完整点击路径仍须逐入口验收。

## 已新增的隔离边界层

`client/src/components/InternalSourceBoundary.tsx` 已在 `AppContent` 的 `<Router />` 之后、路由之外挂载。它以 document 捕获阶段监听普通鼠标主键点击；当冻结页面锚点指向直接 HTTP(S) 地址时，边界层阻止默认导航并在当前终端显示来源标签、原始地址和“未读取、转述或验证外部页面内容”的提示。它不改写任何原锚点文本、href、布局或业务组件。

`server/internalSourceBoundary.test.tsx` 的 JSDOM 运行时测试 3/3 通过：它将真实 HTTP(S) 锚点附加到 document，分别触发普通主键点击、带 `ctrlKey` 的主键点击和中键 `auxclick`，确认默认导航被阻止并在 React 状态提交后出现终端内来源对话框。客户端与服务端类型检查通过。该实现覆盖 document 捕获阶段的 HTTP(S) 锚点事件；尚未有逐入口浏览器点击证据证明 9 个受影响文件的实际运行时行为均被拦截。动态 URL、按钮内脚本跳转及每个入口的视觉/交互测试仍属于未完成范围，因此该边界层不能据此标记为整体完成。

## 实际终端点击验收：GCDS 来源锚点

已通过合法终端深链 `/terminal?module=sovereign-bonds&open=7` 打开冻结 GCDS 页面，并切换到“方法与核验”。页面保留锚点“查看公开数据提供方说明”，其地址为 `https://finance.yahoo.com/`。实际普通点击后，浏览器仍停留在终端 URL，当前终端显示 **IN-TERMINAL SOURCE BOUNDARY** 对话框、原始来源地址及“未读取、转述或验证外部页面内容”的说明；没有打开第三方网页，也没有把第三方页面作为功能结果展示。

该证据仅覆盖 GCDS 的一个静态 HTTP(S) 锚点与普通点击，不代表其他 11 条静态锚点、69 条外部/未知动态候选、修饰键/中键或脚本导航均已完成浏览器验收。它将原有“无实际点击证据”的状态缩小为“已有代表性实际入口证据，仍需逐入口扩大覆盖”。

## MKTOV 路由可达性复核

早期通过 `/terminal?module=credit-bonds&open=2` 打开 MKTOV“当前市场总览”时，专项层独占映射使冻结 `MKTOVPanel` 未进入 DOM；当时运行时 `a[href]` 查询为空，只能记录该路径深链可达，不能把源码扫描当作来源边界点击通过。

后续定位到信用债数字入口 `1`–`24` 的映射遮蔽问题并恢复冻结面板优先后，同一路径已实际呈现 MKTOV 原始标签“公开基准 / 流动性监控 / MCI拥挤度 / 评级分布”。在“评级分布”透明授权空态中点击静态“打开 SEC EDGAR”，终端内边界显示 `https://www.sec.gov/edgar/search/`；浏览器保持在终端。这一最新状态计入下文的静态来源文件 9/9 代表性普通点击覆盖，仍不代表其他同文件锚点、动态 URL 或全部原生操作已完成。

## 实际终端点击验收：NEWSRPT SEC 来源锚点

已通过 `/terminal?module=credit-bonds&open=8` 打开 NEWSRPT“新闻/研究报告”。该冻结页面运行时可见“SEC EDGAR 原始检索”锚点，地址为 `https://www.sec.gov/edgar/search/`。实际普通点击后，浏览器继续停留在终端 URL，并显示 **IN-TERMINAL SOURCE BOUNDARY** 对话框、原始 SEC 地址和未读取/转述/验证外部页面内容的提示。因此本次不以第三方 SEC 页面作为功能结果，且保留了原锚点可审计元数据。

至此，已完成 GCDS（Yahoo）和 NEWSRPT（SEC）两个不同域、两个不同冻结页面的普通点击验收。其余 7 个含静态外链文件、其余静态锚点、69 条外部/未知动态候选、修饰键/中键的真实浏览器操作和脚本跳转仍未逐入口完成。

### NEWSRPT 运行时修饰键 / 中键补充验证

在同一 NEWSRPT 页面，对实际存在的 SEC 锚点分派可取消的 `Ctrl + click` 和 `auxclick(button=1)` DOM 事件。两项事件的 `defaultPrevented` 均为 `true`，浏览器 URL 未变化；随后页面异步提交后，来源边界对话框可见并仍显示 SEC 原始地址。这与专项 JSDOM 中的普通、修饰键和中键契约一致。

该补充是**真实终端 DOM 的事件级验证**，不是对用户实体鼠标中键或所有入口的全量人工验收。因此，其余静态锚点、动态 href、脚本跳转和逐入口原生操作范围继续保留未完成。

## 实际终端点击验收：TACT / FINRA 动态 URL

通过 `/terminal?module=credit-bonds&open=19` 打开 TACT “交易分析与合规”工作台。该路径展示的是外部常量经变量绑定的动态 `href`，而非扫描表中的字面量锚点：页面可见“债券市场活跃度”“最活跃公司债”“市场广度与情绪”三个 FINRA 公开日终研究入口。实际点击“债券市场活跃度”后，浏览器 URL 保持终端深链，终端内来源边界显示 `https://www.finra.org/finra-data/fixed-income/market-activity`，并明确没有读取、转述或验证外部页面内容。

该结果提供了 76 条动态总数中 69 条外部/未知候选的一条**实际跨域运行时**证据；它不覆盖其他动态来源、未经授权的 FINRA 内容、数据采集或 FINRA 协议，也不代表可展示实时或逐笔 TRACE 数据。

## 实际终端点击验收：BTMM 财政部来源锚点

通过 `/terminal?module=credit-bonds&open=4` 打开 BTMM “国债与货币市场”。在同一工作台输入信用债收益率 `5.20%`、国债基准收益率 `4.35%` 与流动性调整 `15 bp` 后，终端仅计算 85.0 bp 名义差、15.0 bp 用户调整及 70.0 bp 残余差，并明确不是 OAS、报价或可交易利差。随后实际点击“美国财政部利率资源”来源锚点，浏览器仍停留在终端深链，来源边界显示 Treasury 地址和未读取外部页面内容的说明。

该页面证明用户输入计算与来源链接均有可见、可复现的终端内行为；它仍不证明所列外部资源已被读取、也不覆盖另一条 H.15 链接或其他模块入口。

## 实际终端点击验收：BOOM 货币市场拍卖来源锚点

通过 `/terminal?module=money-market&open=boom` 打开 BOOM “货币市场发售”。该工作台显示真实空态“当前无匹配的公开发售记录”“未来 45 日没有当前快照内可用的已发布拍卖记录”，同时保留已发布国库券拍卖范围、期限、CUSIP、最低/最高发行规模、ICS/WebCal 地址和账户规则输入等独立订阅流程。页面没有用未来事件、分配资格、结果或二级市场价格填充空态。

实际点击“美国财政部拍卖原始数据说明”后，浏览器继续保持终端深链，**IN-TERMINAL SOURCE BOUNDARY** 显示 `https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/`，明确未读取、转述或验证该外部页面内容。该证据覆盖静态外链清单中的 `mm/BoomAuctionCollaborationPanel.tsx` / `mm/BoomSubscriptionFilters.tsx` 领域；ICS 与 WebCal 为终端自身订阅端点，未被作为第三方外跳结果。

在同一页面实际选择 `4-Week` 后，页面内“定制 ICS / WebCal”从无期限参数的终端地址更新为 `/api/money-market-boom.ics?terms=4-Week`，而公开发售日历仍保持“当前无匹配的公开发售记录”。因此期限筛选确实驱动终端自有订阅链接，不会在无已发布事件时生成未来拍卖、分配或价格记录。

## 实际终端动态数据与来源验收：发行人 SEC 目录

通过 `/terminal?module=credit-bonds&open=10` 打开“彭博信债浏览器”。以默认 `IBM` 触发“构建 SEC 目录”后，按钮先明确显示“构建中”，随后终端内返回 `INTERNATIONAL BUSINESS MACHINES CORP / CIK 0000051143` 及 8 条 8-K、10-Q 目录元数据，并提供类型、描述或日期的本地筛选输入；没有把该流程伪装成债券主数据、实时价格或交易屏幕。

实际点击目录首条 2026-08-14 的 8-K 后，浏览器停留在终端深链，来源边界显示服务端返回的动态 `https://www.sec.gov/Archives/edgar/data/51143/...` 地址，并说明未读取、转述或验证外部文件内容。该证据同时覆盖一个真实可用的保留“构建”按钮、目录列表状态和动态 SEC 文件 URL；它不代表已解析、摘要或验证 SEC 文件正文。

在已返回的 IBM 目录中实际输入 `10-Q` 后，目录由 8 条条目缩小为 2026-07-23 与 2026-04-23 两条 10-Q。该本地筛选只比较已返回的文件类型、描述或日期，不重新请求行情、不会构造披露条目，也不会绕过终端内来源边界。

## 实际终端动态数据与来源验收：新发行、公司大事、评级

通过 `/terminal?module=credit-bonds&open=20` 打开“新发行、公司大事、评级”入口。页面初始明确显示“开始核验后，显示指定发行人的 SEC 原始文件”和“未接入授权评级迁移源时，不在此显示或推断评级变动”。实际以默认 `IBM` 点击“读取 SEC 事件”后，按钮从“核验中”返回“读取 SEC 事件”，终端内出现六条 8-K 时间线元数据（2026-08-14 至 2026-05-01），没有补造发行规模、评级变更、二级市场价格或新闻摘要。

实际点击首条 `FORM 8-K / 2026-08-14` 的服务端动态 SEC Archive 地址后，浏览器仍停留在原终端深链，来源边界对话框显示该原始地址和“未读取、转述或验证外部页面内容”。该证据覆盖独立的“事件范围—文件类型—核验请求—时间线”状态机；它不代表终端已解析该 8-K 正文，也不代表存在授权评级迁移数据。

## 实际终端来源与清单验收：INS 指数检索

通过 `/terminal?module=credit-bonds&open=12` 打开 INS“指数检索”。页面以已接入的 FRED / ICE BofA OAS 序列目录为对象，提供代码、评级或名称检索、逐条“加入清单”、本地清单导出和空清单状态；它不产生指数许可结论、市场价格或交易建议。

实际点击静态“FRED 搜索”锚点后，终端内来源边界显示 `https://fred.stlouisfed.org/searchresults`；关闭对话框后，再实际点击 `BAMLC0A0CM` 的动态“打开 FRED 序列”图标，边界显示 `https://fred.stlouisfed.org/series/BAMLC0A0CM`。两次均保持在原终端深链，未读取或转述第三方页面。前者覆盖 `CreditSpecialistPanels.tsx` 的一条静态来源锚点，后者为动态系列 URL 的实际运行时覆盖；其余系列、外部地址与文件仍待逐入口验收。

新增边界层后的最终生产构建、客户端类型检查和服务端类型检查均通过（日志分别为 `2026-08-26_17-07-00_source-boundary-final-build.txt`、`2026-08-26_17-07-00_source-boundary-client-tsc.txt` 和 `2026-08-26_17-07-00_source-boundary-server-tsc.txt`）。最终完整 Vitest 为 211/225 文件、734/753 用例通过；新增 2 个边界测试通过，原有 14 文件/19 用例失败集合未扩大。

## 实际终端来源与证据板验收：IBM 发行人研究

通过 `/terminal?module=credit-bonds&open=13` 打开“分析 IBM 7 10/30/25 Corp”。实际触发“建立证据板”后，按钮先进入“加载披露中”，随后返回可用状态并展示 `INTERNATIONAL BUSINESS MACHINES CORP`、CIK `0000051143`、0 条 10-K、2 条 10-Q、6 条 8-K 及 8 条原始文件目录。页面明确不会因菜单名称假定 CUSIP、ISIN、到期日、证券价格或债券报价；团队证据日志为 0 条并提示需要登录才能保存摘录。

实际点击该页面静态“EDGAR 搜索”后，终端内边界显示 `https://www.sec.gov/edgar/search/`；关闭提示后，实际点击首条动态 `FORM 8-K / 2026-08-14` 地址，边界显示对应 SEC Archive URL。两次点击均保持在终端深链，未加载、转述或验证外部正文。该记录覆盖发行人证据板独有的“ticker → 加载 → 披露覆盖 → 原始文件目录 → 授权保存边界”流程；不能据此声称披露正文已被解析、摘录已保存或登录状态已建立。

## 实际终端来源与文件筛查验收：新闻 / 研究报告

通过 `/terminal?module=credit-bonds&open=8` 打开“新闻/研究报告”。该入口有独立的美国发行人 ticker、10-K/10-Q/8-K 类型、筛查按钮与披露证据时间线；实际以默认 IBM 点击“筛查 SEC 文件”后，按钮由“读取中”恢复为“筛查 SEC 文件”，时间线返回 8 条文件（0 条 10-K、2 条 10-Q、6 条 8-K）。页面将原文摘录保存置于登录后团队证据日志边界，当前 0 条记录，不伪造已有摘录或认证状态。

实际点击静态“SEC EDGAR 原始检索”后，来源边界显示 `https://www.sec.gov/edgar/search/`；关闭后实际点击首条动态 `FORM 8-K / 2026-08-14`，边界显示对应 Archive URL。两次均不离开当前终端、不读取或转述外部正文。此证据覆盖 `CreditCoreSpecialistPanels.tsx` 的实际静态来源和动态文件时间线；它不覆盖其他模块的来源锚点、文件正文解析或已登录摘录保存。

## 实际终端来源边界验收：贷款契约与再融资核验

通过 `/terminal?module=credit-bonds&open=25` 打开实际挂载的 `CreditResearchWorkbench` 文件核验模式。页面标题为“贷款契约与再融资核验”，明确以公开披露追溯债务、契约和再融资事项，不假定未披露条款；可见发行人代码、终端内“检索 SEC 文件”动作及“旧版演示内容已隔离”的边界说明。

实际点击静态“SEC EDGAR”后，终端内来源边界显示 `https://www.sec.gov/edgar/search/`，页面 URL 未离开当前终端。该证据覆盖 `CreditResearchWorkbench.tsx` 中实际可访问的静态 EDGAR 分支。此次仅验证来源边界；未触发披露检索、未声称文件正文或契约条款已加载，也不覆盖其他动态文件链接。

## 实际终端来源边界验收：BOOM 高级订阅筛选器

在 `/terminal?module=money-market&open=boom` 同时可见 BOOM 官方拍卖提醒与“BOOM 高级订阅筛选器”。前者的“美国财政部拍卖原始数据说明”已在先前验收中点击；本次单独点击后者的静态“原始字段”锚点，终端内来源边界显示相同的 Treasury FiscalData 地址，页面 URL 保持在 BOOM 深链。

因此，`BoomAuctionCollaborationPanel.tsx` 与 `BoomSubscriptionFilters.tsx` 两个不同冻结组件的静态来源锚点均已有实际浏览器普通点击证据。两者仍分别保持其独立状态机：前者是账户级提醒/ICS/WebCal 和通知记录，后者是期限/CUSIP/规模过滤和定制订阅 URL；未把无公开发售记录改写为未来拍卖或分配结果。

早期扫描误报为 11 处静态锚点；后续以同一 grep 规则对当前工作副本和只读冻结归档分别复核，均为 12 处、9 个文件，其中 `CreditResearchWorkbench.tsx` 的两个字面 SEC 锚点是遗漏来源。此前按文件覆盖计已有 8 个文件完成普通点击验证；信用债映射恢复后，`MKTOVPanel.tsx` 也有可达实例。后续逐锚点对照表已补齐 12/12 的浏览器运行时证据；源码扫描不替代该对照，动态 href、脚本跳转及修饰键/中键仍未全量完成。

## 冻结信用面板恢复与 MKTOV 来源边界验收

进一步审计发现，信用债数字入口 `1`–`24` 原先由 `CreditSpecialistPanels` 独占渲染，导致 `creditPanelMap` 中已恢复的冻结面板（包括 MKTOV）未实际进入 DOM。问题位于 `Terminal.tsx` 映射层，不在任何冻结组件内。修复后，所有信用数字入口均先渲染 `creditPanel.component`，再追加对应 `CreditSpecialistPanels` 或 `CreditResearchWorkbench`；菜单、编号、路由及各冻结面板字节均未改动。

修复后实际重开 `/terminal?module=credit-bonds&open=2`，DOM 可见 MKTOV 原始标签“公开基准 / 流动性监控 / MCI拥挤度 / 评级分布”，且其 OAS 卡、历史路径与专项 OAS 脉冲均在同一终端窗口可见。实际切换“评级分布”后，页面透明说明未接入授权评级迁移和成分覆盖数据；点击“打开 SEC EDGAR”后，终端内边界显示 `https://www.sec.gov/edgar/search/`，未离开终端。

至此，静态扫描中的 9 个冻结来源文件均至少有一条实际浏览器普通点击证据。后续逐锚点对照已使 12 条静态锚点全部具有浏览器运行时边界证据；该结论不覆盖 76 条动态 href（其中 69 条外部/未知候选）、脚本跳转、各入口修饰键/中键和全部视觉状态。

## H.15 静态来源与信用债工作台可达性补充

在 `/terminal?module=credit-bonds&open=4` 的冻结 BTMM 面板中，两个静态来源锚点“美国财政部利率资源”和“美联储 H.15 利率发布”均可见。前者已有普通点击证据；本轮对后者在当前真实终端 DOM 分派可取消主键点击，事件 `defaultPrevented=true`、浏览器 URL 保持终端深链。React 状态提交后，终端内边界对话框显示 `https://www.federalreserve.gov/releases/h15/` 以及未读取、转述或验证外部页面内容的说明。此为浏览器 DOM 事件级证据；浏览器自动点击工具的首次立即回读尚未显示对话框，故不将该单项表述为新的实体鼠标全量验收。

本轮还在信用债 10 号“彭博信债浏览器”中重新执行 `IBM → 构建 SEC 目录`：按钮经历“构建中”后出现 8 条公开文件元数据与本地筛选框。点击首条动态 8-K 链接后，来源边界显示对应 SEC Archive URL，终端 URL 未变化；该结果复核了动态来源的实际可达性和站内边界，但不把文件正文视为已读取或验证。

审计同时确认 `CreditResearchWorkbench.tsx` 的第二个静态 `SEC 公开披露` 锚点位于 `boundary` 分支；配置将其关联到模块 `21`。此前该数字入口只追加 `CreditSpecialistPanels`，故工作台分支没有真实终端实例。现已在不改写冻结 `CDERIVPanel` 或专项组件的前提下，将该工作台作为冻结面板和专项层后的独立追加层挂载。实际重开 `open=21` 后，同一窗口可见冻结 CDS/CLN 内容、账户级权限台账与 `CREDIT RESEARCH WORKBENCH · 21` 的“信用衍生品数据边界”；后者明确显示 IG OAS、HY OAS、未授权的单券/CDS/TRACE/评级/成分数据边界及静态 `SEC 公开披露`。

对该静态 SEC 锚点的浏览器点击后，地址保持终端深链。为排除自动点击工具的回读时序影响，再对当前真实 DOM 分派可取消主键点击：结果 `defaultPrevented=true`；React 状态提交后来源边界对话框显示 `https://www.sec.gov/edgar/search/` 与未读取、转述或验证外部页面内容的说明。因此本锚点已具有当前终端 DOM 事件级的可达与边界证据；其与下述对照共同完成静态锚点范围，动态来源仍另行验证。

## 静态锚点逐条对照（12/12）

冻结归档与工作副本均包含下列 12 条静态 HTTP(S) `href`。其中 10 条已有浏览器自动化普通点击后保持终端深链、出现来源边界的证据；两条受自动点击回读时序影响的锚点，均已在当前真实 DOM 通过可取消主键事件得到 `defaultPrevented=true`、地址不变与异步来源边界对话框证据。两类证据均不表示读取外部正文。

| 冻结文件与入口 | URL | 运行时证据 |
|---|---|---|
| `GCDSPanel` Yahoo 来源 | `finance.yahoo.com` | 普通点击，终端内边界 |
| `CreditCoreSpecialistPanels` SEC 原始检索 | `sec.gov/edgar/search` | 普通点击，终端内边界 |
| `CreditIssuerAndAnalyticsPanels` 发行人 EDGAR | `sec.gov/edgar/search` | 普通点击，终端内边界 |
| `CreditResearchWorkbench` filings 分支（贷款契约） | `sec.gov/edgar/search` | 普通点击，终端内边界 |
| `CreditResearchWorkbench` boundary 分支（21） | `sec.gov/edgar/search` | 当前 DOM 主键事件、`defaultPrevented=true`、对话框 |
| `CreditSpecialistPanels` 国库利率资源 | `home.treasury.gov/.../interest-rates` | 普通点击，终端内边界 |
| `CreditSpecialistPanels` FRED 搜索 | `fred.stlouisfed.org/searchresults` | 普通点击，终端内边界 |
| `CreditSpecialistPanels` H.15 发布 | `federalreserve.gov/releases/h15` | 当前 DOM 主键事件、`defaultPrevented=true`、对话框 |
| `BoomAuctionCollaborationPanel` 拍卖原始数据 | `fiscaldata.treasury.gov/...auctions-data` | 普通点击，终端内边界 |
| `BoomSubscriptionFilters` 拍卖原始数据 | `fiscaldata.treasury.gov/...auctions-data` | 普通点击，终端内边界 |
| `MKTOVPanel` SEC EDGAR | `sec.gov/edgar/search` | 普通点击，终端内边界 |
| `NEWSRPTPanel` SEC EDGAR | `sec.gov/edgar/search` | 普通点击，终端内边界 |

因此静态常量 URL 的完整范围已可审计；下一阶段只将 **动态 href 的来源、可达状态和运行时边界**、脚本导航及修饰键/中键作为未完成队列，不再以“同文件其他静态锚点”笼统描述范围。

为避免后续无记录漂移，新增 `server/staticSourceAnchorInventory.test.ts`：它递归对比工作副本与只读冻结归档的常量 HTTP(S) `href` 清单，要求两边相同、总数 12、文件分布 9 个，并确认两边均无常量 HTTP(S) `window.open` 或 `location.href` 跳转。专项测试于本轮为 2/2 通过。该测试只保护静态清单事实，不将动态 href 或浏览器交互误报为已完成。

新增 `server/internalSourceBoundary.test.tsx` 动态挂载契约：边界层已挂载后，测试组件经 `useEffect` 才插入 FINRA 市场活跃度动态 href；普通主键、带 `metaKey` 的主键与中键辅助点击均返回默认行为已阻止，且终端内对话框展示 FINRA 原始 URL。专项测试现为 4/4 通过。这证明 document 捕获层不依赖锚点初始渲染时机，但不替代 76 条动态 href、尤其 69 条外部/未知候选的来源、可达性与实际点击验收。

## 货币市场 SOURCE 动态来源验收

在 `/terminal?module=money-market&open=source-mm` 实际打开“23 SOURCE 公开资料时效监控台”。终端显示 SOFR、EFFR、IORB、RRPONTSYD、DTB4WK、DTB3、DTB6 的跨曲线资料比较；当前全部为“暂不可读 / 无观察”的真实空态，并在可用率历史中记录 FRED、财政部、巴西央行、台湾央行等最近探测的不可读结果与延迟，而未填充伪造报价、曲线或可用率。

该页的七条“原始证据（可选核验）”均由运行时 `source.url` 生成。实际普通点击 FRED SOFR 条目后，浏览器保持在该终端深链，**IN-TERMINAL SOURCE BOUNDARY** 显示 `https://fred.stlouisfed.org/series/SOFR` 和未读取、转述或验证外部页面内容的说明。随后在同一真实终端 DOM 对全部七条动态锚点逐条分派可取消主键事件：FRED SOFR、FRED EFFR、财政部拍卖、巴西 SGS CDI、台湾央行隔夜拆款、中国人民银行和 EFSF 均返回 `defaultPrevented=true` 与 `dispatchReturned=false`；状态提交后的对话框显示最后一条 `https://www.efsf.europa.eu/`，浏览器 URL 始终为 SOURCE 终端深链。

这构成 SOURCE 工作台七条运行时来源的完整 DOM 事件级边界证据，其中 SOFR 另有普通点击证据；它不把 DOM 事件替代为其他模块、其他动态表达式、修饰键/中键或外部正文验收。

## 信用债 19 号 TRACE 工作台可达性

在 `/terminal?module=credit-bonds&open=19`，冻结 TACT 交易分析与合规面板仍先显示；其后可见独立的“TRACE 活动 / FINRA 公开日终交易后市场研究导航”层，以及投资级、高收益、可转债三种研究桶切换。可见的动态 FINRA 链接包括“债券市场活跃度”“最活跃公司债”“市场广度与情绪”，同时界面明确无有效 FINRA Query API 凭据时不请求或展示实时/逐笔 TRACE、个券成交价、实时成交量和未授权评级字段。该路径确认追加研究层未覆盖冻结 TACT 面板，也不把公开页面视作终端内实时数据。

本轮仅确认此分支的真实渲染和三条可见动态锚点；其普通点击、另外两个 FINRA URL 及逐条默认阻止证据将继续单独记录，不能因现有 TACT 其他来源验收而自动视为完成。
