# Finance Hub 路由与交互保真基线

**建立日期：** 2026-08-25  
**原则：** 后续修复仅补足可达性、状态更新、加载反馈或认证边界，不重命名、删除或改变已有业务含义。

## 路由分类基线

| 类别 | 路由 / 范围 | 当前预期行为 |
|---|---|---|
| 公开终端与数据 | `/`, `/terminal`, `/home`, `/market`, `/curve-search`, `/yield-curve`, `/bond-market`, `/interest-rates` | 加载终端或公开数据；无数据时应显示明确空状态。 |
| 公开分析与市场 | `/rate-trader`, `/rate-trader-by-term`, `/multi-term-dashboard`, `/secondary-markets`, `/spread-drop`, `/g7-curves`, `/regional-curves`, `/forex-curves`, `/bond-trader`, `/derivatives-trader`, `/industry-analysis`, `/portfolio-optimizer`, `/macro-dashboard`, `/sector-analysis`, `/asset-allocation`, `/fixed-income`, `/credit-analysis` | 保持原有分析页面、筛选与详情交互。 |
| 公开资产类别 | `/equity-market`, `/commodity-market`, `/crypto-market`, `/real-estate`, `/energy-market`, `/precious-metals`, `/curves-list`, `/curve-detail/:curveId`, `/financial-analysis`, `/credit-ratings`, `/model-predictions` | 保持原有市场浏览、详情和分析语义。 |
| 公开基金与搜索 | `/curves-compare`, `/etf-detail/:etfId`, `/etf-holdings-admin`, `/fund-browse`, `/fund-holdings`, `/fund-compare`, `/search-results`, `/menu-item/:itemId` | 保持原有查询、详情与比较语义。 |
| 公开专业模块 | `/swpm`, `/wbf`, `/cdsw`, `/wcds`, `/ovme`, `/moso`, `/fom`, `/wbf-ai`, `/credit-monitor`, `/ovml`, `/wvol`, `/glco`, `/commodity-prices`, `/ovcv`, `/dlib`, `/vca`, `/mars`, `/ni-drv`, `/deri`, `/bico`, `/market-manage` | 保持原有专业面板入口与动态模块映射。 |
| 公开工作区 | `/index-hub`, `/forex-hub`, `/comms-hub`, `/news-hub`, `/econ-hub`, `/industry-group`, `/bquant`, `/stp-processing`, `/allq`, `/trade-blotter`, `/fixed-income-trade`, `/bmap`, `/bsrch`, `/bvol`, `/workspace`, `/notifications`, `/verify-export`, `/trading-ledger`, `/bond-futures`, `/commodity-derivatives`, `/commodity-futures` | 保持原有工作区入口、研究层与公开空状态。 |
| 受认证保护 | `/risk-management`, `/electronic-trading`, `/trade-book`, `/pricing-risk`, `/order-management` | 匿名用户显示登录边界；有权限用户进入原有功能。 |
| 受管理员保护 | `/admin`, `/secure-admin`, `/admin/users`, `/admin/market-data`, `/admin/monitor`, `/admin/settings`, `/admin/announcements`, `/admin/export-registry` | 匿名或非管理员用户显示权限边界；管理员进入原有功能。 |
| 工具与兜底 | `/help`, `/settings`, `/_showcase`, `/_latest`, `/_files`, `/_pricing-and-risk`, `/_derivatives-base`, `/_derivatives-enhanced`, `/_derivatives-news`, `/_derivatives-research`, `/_rate-inflation-derivatives`, `/_convertible-bonds-category`, `/_credit-derivatives`, `/_equity-derivatives`, `/_fx-derivatives`, `/_global-cds`, `/_index-derivatives`, `/_index-futures`, `/_index-options`, `/404` | 保持工具页、展示页与 Not Found 回退行为。 |

## 已确认的占位式按钮

| 文件 | 原操作语义 | 确认问题 | 保真修复方向 |
|---|---|---|---|
| `IMGRPanel.tsx` | 筛选、设置 | 两个按钮仅弹出“待实现”提示 | 增加本地筛选与显示设置状态，不改动库存与定价内容。 |
| `WorkflowPanel.tsx` | 审批/拒绝、规则编辑/启停/新增、审批查看 | 七个按钮仅弹窗 | 在原有本地工作流数据中执行状态更新、编辑或筛选聚焦，并明确其为面板内状态。 |
| `FstnPanel.tsx` | 确认补救 | 按钮仅弹窗 | 在原有失败交收清单中记录补救提交状态，不伪造外部结算执行。 |

## 验收方法

每一处修改均需保留既有文本、路由、组件层级和业务名称；新增操作必须有可观察的状态变化、禁用条件、错误/空状态或明确的权限边界。路由回归以 `App.tsx` 为准，且同时检查匿名边界和公开页面的加载结果。

## 核心页面运行时记录

| 入口 | 加载 / 数据状态 | 已验证的关键入口或边界 | 结论 |
|---|---|---|---|
| `/terminal` | 终端导航、市场工作区与事实边界可渲染。 | 主导航与市场入口可见。 | 公开核心入口可用。 |
| `/market` | 31 条已导入品种、分类、搜索与详情入口可渲染；刷新时保留现有表格并显示快照更新状态。 | 当前视图刷新会重新读取公开 `market` 查询并请求推送重连。 | 公开行情读取可用。 |
| `/yield-curve` | 已落库期限结构、利差、趋势卡片、历史对比与 CSV 入口可渲染；首次无数据时已有空态文案。 | 手动刷新与 60 秒客户端查询刷新会重新读取持久化曲线数据。 | 公开曲线读取可用。 |
| `/bond-market` | 14 国 YTM 矩阵、筛选与分析标签可渲染。 | 公开数据分析标签可见。 | 公开债券入口可用。 |
| `/order-management` | 匿名会话进入权限边界或 OAuth 登录流程。 | 不展示伪订单按钮。 | 受保护入口安全拒绝。 |
| `/admin` | 匿名会话进入权限边界或 OAuth 登录流程。 | 不展示伪管理操作。 | 管理入口安全拒绝。 |

| 操作类别 | 验收状态 | 说明 |
|---|---|---|
| 只读查询 | 已验证 | 公开行情、曲线、债券页面与公开行情 tRPC 查询均有运行时证据。 |
| 未登录拒绝 | 已验证 | 订单管理和后台均显示认证边界或进入 OAuth 流程。 |
| 导出 | 受认证 / 浏览器限制边界 | 收益率曲线 CSV 导出入口已渲染；其他账户导出操作按当前匿名会话不实测。 |
| 签名校验 | 受认证限制待验收 | 当前匿名会话无法提供账户签名上下文。 |
| 规则创建 / 删除 | 代码与定向回归验证 | 账户规则操作已有定向测试；浏览器实操按用户确认在未登录会话跳过。 |

受认证操作均被保留为明确边界，而非通过项或失败项。后续如提供登录会话，应仅补做相应浏览器实操，不改写已有业务流程。

## 静态路由可达性审计

`scripts/route-reachability-audit.mjs` 从 `App.tsx` 提取所有注册路由，对动态参数使用审计占位符后向本地开发服务发出 HTTP 请求。本轮结果为 **119 条路由、0 条非 200 响应**。该检查仅证明客户端路由在开发服务中可达；它不替代需要登录会话的写操作、账户权限操作或每个可点击控件的浏览器实操验收。

主终端导航另以 JSDOM 点击回归覆盖九个一级分组：市场、权益与衍生品、通讯与社区、新闻与研究、经济分析、专业应用、平台工具、个性化工作台及帮助与关于。测试逐项验证分组可展开、可收起，并在恢复后呈现其原有首个子入口；另验证“数据导出”与“文档”普通入口仍会调用既有模块回调。该组件级验证与 119 路由 HTTP 审计共同作为主导航的可重复验收证据。
