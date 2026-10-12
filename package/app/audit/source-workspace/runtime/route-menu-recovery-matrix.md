# 路由与菜单恢复矩阵

本矩阵以 `audit/inventory/routes.tsv` 与 `audit/inventory/menu-components.tsv` 的 ZIP 基线盘点为来源，并将其与当前 `client/src/App.tsx` 及导航组件文件做只读比对。它不更改页面、菜单文案或导航行为。

| 项目 | 基线/预期 | 当前矩阵结果 |
|---|---:|---:|
| 原始显式路由 | 119 | 119/119 在当前路由定义中存在，缺失为 0。 |
| 当前显式路由 | — | 120；额外 `/_recovery/portfolio-extension-preview` 是隔离验收入口，不替代原路由。 |
| 参数路由 | 3 | `/curve-detail/:curveId`、`/etf-detail/:etfId`、`/menu-item/:itemId` 均存在。 |
| 权限路由 | 13 | 风险、交易、定价风险和管理后台均继续由 `ProtectedRoute` 保护。 |
| 404 出口 | 2 | 显式 `/404` 与最终 `NotFound` 回退均存在。 |
| 原始导航组件 | 26 | 26/26 文件仍存在，缺失为 0。 |
| 菜单导航解析 | 526 | 23 个菜单组件的编码导航、其余直接导航及 `/menu-item/:itemId` 回退均解析到当前路由，未解析目标为 0。 |

受保护路径包括 `/risk-management`、`/electronic-trading`、`/trade-book`、`/pricing-risk`、`/order-management`、`/admin`、`/secure-admin` 及 6 个管理员子路由。管理员菜单公开可见但内容受登录与管理员权限保护的既有修复仍受本矩阵覆盖。

`audit/scripts/audit_route_menu_matrix.mjs` 输出 `pass=true`；`server/routeMenuRecoveryMatrix.test.ts` 通过 2/2。该证据证明路径、参数、守卫、回退、菜单组件文件和菜单编码目标的**静态恢复一致性**。菜单组件中的可见条件、视觉层级、逐项点击、页面加载/错误/空状态仍需在浏览器验收中单独完成。
