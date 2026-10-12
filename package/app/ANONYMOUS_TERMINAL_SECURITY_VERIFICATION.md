# 匿名根终端安全门控验证

## 2026-08-25 验证结论

`TerminalSecurityOverlay` 的 `terminalSecurity.watermarkConfig` 查询现以 `auth.isAuthenticated && isTerminalSurface` 为启用条件，并仅在该条件为真时按 60 秒周期刷新。该路由继续保持受保护，不改为公开接口。

匿名浏览器重新载入根路径 `/` 后，地址仍停留在 Finance Hub 根终端，没有跳转至 OAuth 登录页。短暂的数据库快照加载状态结束后，页面实际展示了项目数据库导入快照，包括 AAPL、MSFT 等记录及“项目数据库导入快照”来源标识。

直接调用本地 `market.getAll` tRPC 端点后，响应中的 `symbol` 字段计数为 **48**，与数据库导入快照及页面可见数据一致。

最终加载后检查开发服务日志最近 500 行：对 `terminalSecurity.watermarkConfig`、`401` 和 `Unauthorized` 的匹配为空。该日志观察与浏览器 DOM 结果一起支持本次匿名查询门控有效；它不替代已登录会话的水印显示与复制/剪切审计验收。

## 自动回归

在 `NODE_OPTIONS=--max-old-space-size=900` 下，以下定向套件通过：

| 测试文件 | 测试数 | 结果 |
| --- | ---: | --- |
| `server/terminalSecurityOverlayGovernance.test.ts` | 2 | 通过 |
| `server/market.test.ts` | 4 | 通过 |
| `server/importedMarketSnapshotLedger.test.ts` | 3 | 通过 |

合计 **3 文件、9 项测试通过**。回归明确锁定认证与终端表面双重门控，并保留已登录终端的复制/剪切拦截和最小化审计调用。
