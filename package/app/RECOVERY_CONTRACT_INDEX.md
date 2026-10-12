# 原始项目静态契约索引与验收映射

本索引从不可写 ZIP 基线 `/home/ubuntu/finance-hub-baseline/source/unpacked/project/` 静态提取。它不替代运行时验收，而是用于说明恢复范围、逐项入口数量与可复现证据的位置。

| 契约类别 | 条目数 | 基线索引文件 | 运行时/回归映射 |
|---|---:|---|---|
| `App.tsx` 页面导入 | 123 | `baseline-evidence/static-contract-index/app-page-imports.txt` | 分域类型检查、Vite 开发预览、路由 HTTP 审计 |
| 路由定义 | 119 | `baseline-evidence/static-contract-index/app-route-definitions.txt` | `recovery-evidence/route-http-status.tsv`：104 条静态路径 200；3 条参数化模式另列 |
| 页面文件 | 135 | `baseline-evidence/static-contract-index/page-files.txt` | 原始业务文件哈希基线、受控预览截图 |
| 组件文件 | 767 | `baseline-evidence/static-contract-index/component-files.txt` | 分域 TypeScript 检查、组件/页面回归 |
| 菜单候选 | 1,575 | `baseline-evidence/static-contract-index/menu-candidates.txt` | 菜单/路由/面板定向回归 9 文件、23 项断言 |
| 客户端交互候选 | 4,010 | `baseline-evidence/static-contract-index/client-interaction-candidates.txt` | 面板交互、终端深链接、菜单及模块导航回归 |
| 服务契约候选 | 1,432 | `baseline-evidence/static-contract-index/server-contract-candidates.txt` | 服务端分域类型检查、真实数据与融资日历回归 |
| 服务端文件 | 402 | `baseline-evidence/static-contract-index/server-files.txt` | 服务端分域类型检查 |
| Vitest 测试文件 | 205 | `baseline-evidence/static-contract-index/server-test-files.txt` | 最终全量回归：192 通过、13 失败文件 |

## 复现路径

| 验收维度 | 命令或证据 |
|---|---|
| 文件完整性 | `baseline-evidence/post-overlay-business-hash-diff.txt`；初始同步时为空 |
| 静态路由可达性 | `recovery-evidence/static-route-paths.txt`、`route-http-status.tsv` |
| 路由/菜单/面板行为 | `server/adminPagesRestoration.test.ts`、`derivativesRouting.test.ts`、`moduleNavigationRuntime.test.tsx`、`panelInteractionRestoration.test.ts`、`panelInteractionRuntime.test.tsx`、`portfolioManagementMenu.test.tsx`、`pricingRiskMenu.test.tsx`、`sovereign-routing.test.ts`、`terminalDeepLinkRouting.test.ts` |
| 真实数据边界 | `recovery-evidence/full-vitest-final-2026-08-26.log`，以及 BLS、ECB、财政部、曲线、新闻和市场数据定向测试 |
| 多端核心截图 | 归档 ZIP 的 `screenshots/`；覆盖范围及未完成项见 `RECOVERY_DELIVERY_REPORT.md` |
| 最小变更 | `RECOVERY_CHANGE_LEDGER.md` |

> 限制：静态候选数量不等于完成交互数量。当前已以路由/菜单/面板回归、104 条静态路由 HTTP 200 与核心多端截图验证主要入口；全量逐项点击和全部静态路由三端截图尚未完成，保留为 TODO 未完成项。
