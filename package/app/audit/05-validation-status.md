# 运行、测试与可视化验收状态

| 检查 | 结果 | 证据/说明 |
|---|---|---|
| 生产构建 | 通过 | 2026-08-26 信用债追加工作台本地标识去随机化后重新运行 `pnpm run build` 通过，构建约 1 分 56 秒；仍有大体积 bundle 警告（最大主包约 20.35 MB、vendor 约 14.10 MB），但未阻断构建。 |
| 客户端类型检查 | 通过 | 2026-08-26 本地标识修复后运行 `pnpm exec tsc -p tsconfig.check-client.json --pretty false` 通过。 |
| 服务端类型检查 | 通过 | 2026-08-26 本地标识修复后运行 `pnpm run check:server` 通过。 |
| 专项类型检查 | 通过 | 官方数据客户端与终端安全覆盖层检查通过。 |
| 全量 Vitest（恢复前） | 186/224 文件通过，686/745 用例通过 | 数据库表缺失等问题导致 38 文件、53 用例失败。 |
| 全量 Vitest（当前） | 218/231 文件通过，751/768 用例通过 | 日志：`/home/ubuntu/terminal_full_output/2026-08-26_20-45-00_full-credit-workpaper-id-vitest.txt`。新增本地工作底稿标识策略测试和静态来源清单测试均通过；13 个失败文件、17 个失败用例集合未扩大。`credit-workbench` 仍要求历史条件集合 `independentlyVerifiedPanelIds`，该集合在冻结终端中会让多数数字入口不挂载原面板，与“冻结原面板均须可达、专项层仅追加”的恢复要求冲突；未用无效兼容字符串、回退遮蔽或改写测试获取绿色结果。 |
| 外汇与来源边界专项回归 | 外汇 4/4、来源边界 3/3 用例通过 | 外汇专项新增大写代码深链归一化契约；来源边界覆盖普通点击、带修饰键点击和中键辅助点击的终端内拦截。大写 FXDS 已实际复验，修复后 7 个外汇代码深链已完成窄屏截图。 |
| 信用债冻结面板映射专项 | 1/1 通过 | `creditLegacyFirstMapping.test.ts` 锁定数字入口先渲染冻结 `creditPanel.component`、再追加专项工作区；MKTOV 已实际复验原标签、透明评级空态和 SEC 终端内来源边界。 |
| 信用债工作底稿标识专项 | 1/1 通过 | `creditWorkpaperIdPolicy.test.ts` 锁定追加层使用同会话单调标识，禁止 `Math.random` 用于字段、授权、曲线或研究清单记录的本地 ID；不触及冻结面板或业务数据。 |
| 数据库结构 | 188 张表可见 | `users` 当前有 36 条记录；归档唯一键无法无损加入，schema 同步在既有 users 冲突处中止，表结构已部分创建。 |
| 桌面截图 | 8 条代表路由已截图并完成延迟复测 | `/`、`/market`、`/news-hub`、`/forex-hub`、`/yield-curve`、`/econ-hub`、`/index-hub` 和 `/electronic-trading` 已可见；曲线显示真实“暂无曲线快照数据”空态，电子交易显示来源不可用状态。 |
| 移动端截图 | 4 条代表路由已验收 | `/yield-curve`、`/econ-hub` 和 `/electronic-trading` 的文字、控件和状态可见；`/` 在窄屏时主菜单折叠，需继续进行完整可用性核验。 |
| 导入后曲线数据库回归 | 通过 | `server/curves-db.test.ts` 的 2 个用例已通过；从冻结 SQL 事务性导入的 4,276 条点位可由既有服务读取。 |
| 导入后官方历史曲线回归 | 通过 | `server/treasuryHistoricalCurve.test.ts` 通过。曲线点集已与美国财政部 1990–2023 CSV 逐点核验，之后仅补写归档既有审计表元数据；详见 `audit/06-baseline-data-import.md`。 |
| 审计矩阵回归 | 通过 | 运行归档恢复的审计脚本后，`interfaceContractMatrix.test.ts` 与 `menuHierarchyMatrix.test.ts` 定向共 4/4 通过。 |
| 电子交易私有研究回归 | 通过 | 对同秒审计记录增加 `id DESC` 并列排序后，`electronicTradingResearchDb.test.ts` 定向 2/2 通过，且服务端类型检查通过。 |

剩余失败包括：原页面/面板指纹与可用归档均不一致的旧期望、未接入授权替代数据与可验证事件造成的衍生品真实空结果，以及旧扩展版本冲突。用户补充的全球股票 XLSX 现已导入，相关归档导入测试已通过；导入的曲线与官方历史曲线用例也已通过。所有这些结果均保持真实状态；没有通过改写断言、伪造数据、删除路由或伪造登录态来获取“通过”。

其中，冻结归档与工作副本的 `ElectronicTrading.tsx` SHA-256 均为 `f048d41b351a74ff02b546dce2556d5f7f9958f5c2e7a5c88c15be7aa1184a1c`，而旧指纹测试要求 `adf2bf8486db042ccfc133a3b316b3b1faa1b848b2ee8b6b4bb2c132b124b497`。该冲突以用户上传归档为唯一基准保留为未完成限制。

当前失败文件清单为：`commsPreservation`、`credit-workbench`、`derivatives`、`derivativesProtection`、`electronicTradingOriginalContentFingerprint`、`forexProtection`、`indexResearch`、`legacyFieldAccess`、`newsPreservation`、`orderManagementOriginalContentFingerprint`、`portfolioManagementPreservation`、`pricingRiskOriginalContentFingerprint` 和 `stpOriginalContentFingerprint`。该清单仅用于后续逐项处理，并不表示其已通过或应当绕过。

归档数据库基线 `finance_hub.sql`（11,520,236 bytes）包含 `market_data`、`curves` 与 `curve_data_points` 的 INSERT 数据，但其表结构段含有 `DROP TABLE`。当前恢复数据库已有 `users` 36 条记录且 migrations 元数据与归档首项不一致；因此该转储不能整库直接导入。后续仅可在核对列结构、主键和冲突策略后，以分表、非破坏性方式导入可验证数据。
