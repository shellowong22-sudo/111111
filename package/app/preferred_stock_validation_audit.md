# 优先股模块深化验证审计

**核验日期：2026-08-20**  
**核验结论：优先股原内容保持不变；深化能力以外层追加方式接入；公开资料的核心阅读、筛选和可视化均在终端内完成。**

## 原内容保护

| 核验项目 | 结果 | 证据 |
| --- | --- | --- |
| 原始菜单文件 | 通过 | SHA-256 与审计基线一致：`e202…a9ad` |
| 原面板文件 1 | 通过 | `PFPanels1.tsx` SHA-256 与审计基线一致：`6e21…65b4` |
| 原面板文件 2 | 通过 | `PFPanels2.tsx` SHA-256 与审计基线一致：`f8ce…f186` |
| 原面板文件 3 | 通过 | `PFPanels3.tsx` SHA-256 与审计基线一致：`a0dd…1893` |
| 菜单顺序和数量 | 通过 | 仍为 23 个 `pf-*` 原始入口 |
| 追加包装数量 | 通过 | `Terminal.tsx` 中存在 23 个 `PreferredStockPreservedModule` 外层包装 |
| 窗口去重标识 | 通过 | 继续使用既有 `pf-${normalizedItemId}` 标识 |

## 终端内数据与交互

SEC 主体检索、SEC 申报目录、SEC 关键词上下文片段、FRED 期限利率与 ICE BofA 指数级 OAS 都由服务器读取后返回本终端。公开环境快照实测返回了 2026-08-18 的 2 年期国债公共观察值及其历史序列；SEC 主体检索实测查询 `BAC` 时优先返回 Bank of America Corp. 的 CIK `0000070858`。这些数据均带有来源边界：期限和 OAS 只作为公开历史环境参照，不被标记为优先股个券价格、收益率、信用利差或成交。[1] [2]

个券报价、成交、盘口、库存和可执行流动性没有可再分发的免费结构化数据时，界面明确显示真实空状态。追加的优先股 UI 未发现 `href`、`window.open` 或 `location.href` 的离站导航调用；来源机构仅作为终端内字段溯源。

## 视觉、打包与回归

根路径深链 `/?module=preferred-stock&open=pf-secf` 已实际渲染 SECF 原窗口、原内容前的“原工作区保留展示/非实时参考”横幅和未改写的原面板。`/terminal` 并非注册路由，其 404 不构成优先股功能错误。受内嵌终端窗口独立滚动容器限制，自动截图仅展示了工作区顶部；服务端未出现优先股路由的 4xx/5xx 请求。

低内存 esbuild 已成功解析优先股研究层、服务端研究路由及完整 `Terminal.tsx`。全量生产构建在沙箱高内存压力下被环境终止（退出码 143），因此没有将其作为通过项；以轻量打包替代验证并保留该限制。完整 Vitest 回归通过：**67 个测试文件、378 项测试**，其中新增原内容保护与公共资料解析测试共 4 项。

## 参考资料

[1] [SEC EDGAR Application Programming Interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)

[2] [FRED series search documentation](https://fred.stlouisfed.org/docs/api/fred/series_search.html)
