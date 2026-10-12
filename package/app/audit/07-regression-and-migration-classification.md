# 回归失败、指纹冲突与迁移状态分类

## 当前证据边界

本记录保留数据恢复阶段的历史快照，并以最新完整 Vitest 日志 `/home/ubuntu/terminal_full_output/2026-08-26_20-00-00_full-credit-boundary-workbench-vitest.txt` 为当前结论：**216/229 个测试文件通过、747/764 个用例通过**，即仍有 13 个文件、17 个用例失败。信用债 21 号追加授权边界层及其新增映射契约通过，失败文件集合未扩大。用户后续提供的 46 份 XLSX 已完成逐文件来源审计、内容去重和仅新增事务导入；因此全球权益导入相关测试已通过，不再属于失败集合。

| 分类 | 发现 | 本轮处置 | 当前结论 |
|---|---|---|---|
| 可由冻结数据恢复 | `curves-db`、`treasuryHistoricalCurve` | 事务性导入冻结市场/曲线表；逐点验证已存在的美国财政部资产后仅补写既有审计元数据 | 两个曲线测试文件已定向通过，详见 `audit/06-baseline-data-import.md` |
| 缺失的审计运行时工件 | `interfaceContractMatrix`、`menuHierarchyMatrix` | 运行已恢复的归档审计脚本，生成 `audit/runtime/*.json` | 两个矩阵测试文件已定向通过 |
| 非确定性读取顺序 | `electronicTradingResearchDb` | 对同秒创建的审计记录增加 `id DESC` 并列排序；未改变记录、权限或账户隔离 | 定向测试 2/2 通过，服务端类型检查通过 |
| 冻结来源与旧期望冲突 | 多个原内容指纹/保护测试 | 生成跨工作副本、冻结外层、嵌套归档的哈希矩阵；不把旧测试期望写回用户归档文件 | 保持失败及限制，详见下节 |
| 用户补充的原始工作簿 | `globalEquityImport`、`globalEquityCurrentUpload` | 对 46 份 XLSX 完成逐文件审计、42 个去重内容来源的映射、合并预检和仅新增事务导入 | 当前 `equity_listings` 为 48,756 条、40 个国家/地区；两个导入测试已通过 |
| 有意的真实空状态 | `derivatives` 相关用例 | 路由返回空数组，代码明示替代数据和已验证事件尚未接入 | 不用固定信号、概率、置信度或因果链凑足测试要求 |
| 扩展版本冲突 | `legacyFieldAccess`、`indexResearch` 等 | 对照组件与冻结外层/嵌套归档字节，确认当前归档本身不含旧测试预期片段 | 只把官方经济观测组件作为 ECO 保留页面后的独立层接入；其余旧预期不回填 |
| 冻结映射与原面板可达性 | `credit-workbench` | 恢复信用债数字入口 1–24 的冻结 `creditPanel.component` 优先渲染，专项工作台追加在后 | 旧测试仅要求历史条件集合 `independentlyVerifiedPanelIds` 出现；该集合会继续遮蔽多数冻结面板，因此不以恢复遮蔽或无业务意义字符串换取断言通过 |

## 指纹期望与用户冻结归档的冲突

`audit/scripts/audit_fingerprint_baseline_matrix.mjs` 解析所有保护测试中的路径与 SHA-256 期望，并与工作副本、冻结外层归档工作区和嵌套 `_baseline_archive/project` 逐文件比较。审计结果为：182 个保护项中，工作副本与冻结外层归档 **182/182** 一致；测试期望仅匹配工作副本 165 项、匹配嵌套归档 169 项；**13 项不匹配任何可用归档版本**。因此不能为获得绿色测试而把用户上传的权威文件替换成旧测试所要求的未知版本。

| 旧测试文件 | 与任何可用归档均不匹配的保护文件 |
|---|---|
| `derivativesProtection.test.ts` | `client/src/pages/CreditMonitorAdvanced.tsx` |
| `electronicTradingOriginalContentFingerprint.test.ts` | `EquityTradingPanel.tsx`、`IMGRPanel.tsx`、`WorkflowPanel.tsx` |
| `forexProtection.test.ts` | `ALLQPanel.tsx`、`BFIXPanel.tsx` |
| `orderManagementOriginalContentFingerprint.test.ts` | `AIMPanel.tsx`、`TOMSPanel.tsx`、`AIMHelpPanel.tsx` |
| `portfolioManagementPreservation.test.ts` | `PortfolioManagementPanel.tsx`、`PORTOverviewPanel.tsx`、`AlertMonitorPanel.tsx` |
| `stpOriginalContentFingerprint.test.ts` | `FstnPanel.tsx` |

电子交易页本身也保持为冻结外层归档 SHA-256 `f048d41b351a74ff02b546dce2556d5f7f9958f5c2e7a5c88c15be7aa1184a1c`，而旧测试期望为 `adf2bf8486db042ccfc133a3b316b3b1faa1b848b2ee8b6b4bb2c132b124b497`。这一冲突不能通过改动测试、改写页面或把嵌套旧副本认定为用户唯一基准来“修复”。

## 迁移状态

只读脚本 `audit/scripts/audit_migration_state.mjs` 显示，归档 Drizzle journal 有 87 个条目（`0000_old_mockingbird` 至 `0086_bitter_mad_thinker`），当前数据库迁移台账只有一个已记录哈希，而实际可见 188 张基础表。这说明先前的模板迁移历史与归档迁移基线并不一致；表已部分具备，但不能将表存在误解为 87 个归档迁移均已串行、安全地应用。

`users` 当前有 36 行，存在 `PRIMARY(id)`，但没有归档首迁移所要求的 `users_openId_unique` 唯一键；其 role enum 已无损扩展为 `user/admin/trader/risk_manager`。扩展后的只读迁移审计显示 `openId` 空值为 0，但重复超额值为 66，因此直接增加唯一键将失败或需要合并/删除既有用户行，均不符合本任务的数据保护约束。此前同步在尝试重复添加主键时中止。为保护现有用户行，本轮没有清空表、删除主键、合并用户、篡改 `__drizzle_migrations` 或直接标记归档迁移为已执行。该冲突仍是未完成项。

> 数据库测试可能产生账户范围的临时行。此审计仅记录当前计数，不输出 openId、姓名或邮箱，也不删除任何用户记录来改变计数。

## 仍需后续处理的失败分类

| 范围 | 事实 | 安全下一步 |
|---|---|---|
| 全球权益 | 用户提供 46 份 XLSX，其中 42 个为去重后的选定内容来源；两份为重复别名，另有两份不属于可映射股票目录 | 保留全部原始文件与逐文件审计；不猜测性导入两份非目录文件，也不覆盖 5,088 条冻结 SQL 来源字段 |
| 衍生品 BICO/AI | 当前路由明确注释为未接入授权替代数据和可验证事件，因而返回空数组 | 保留空状态；仅在获得可核验的归档/授权来源后接入 |
| 保护测试 | 13 项旧哈希没有任一上传归档来源支持，另有旧测试期望只匹配嵌套版本 | 以冻结外层 ZIP 为准，保留失败及来源矩阵 |
| 经济扩展 | 当前 `EconomicCalendarOfficialObservations.tsx` 与冻结外层、嵌套归档 SHA 均为 `30955727c5a45f845ef10b908f9509b41e1a4985861682ca633edb19879ce64e`；旧测试还要求其不具备的文案/图形片段 | 已将现有组件独立挂载在 ECO 保留页面之后；不凭测试片段重写冻结组件 |
| 信用债映射 | 冻结 `Terminal.tsx` 的 `independentlyVerifiedPanelIds` 仅允许 7 个数字入口显示原面板，其余由专项层独占 | 当前将全部数字入口恢复为原面板优先、专项层追加；新静态契约与 MKTOV 浏览器实测均通过，不回退为遮蔽原页面 |
| 迁移 | 一条迁移台账与 87 条归档 journal 不一致，且 users 已有主键和数据 | 只允许后续基于列/索引差异的无损方案；不伪造迁移元数据 |

## 证据文件

| 文件 | 内容 |
|---|---|
| `audit/artifacts-fingerprint-baseline-matrix.json` | 182 项保护文件的当前、外层、嵌套基线哈希矩阵 |
| `audit/artifacts-migration-state.json` | 归档 journal、实际表数、迁移台账及 users 结构的只读快照 |
| `audit/artifacts-uploaded-global-equity-per-file-audit.json` | 46 份用户 XLSX 的 SHA-256、工作表、表头、映射、有效/拒绝行与去重状态 |
| `audit/artifacts-uploaded-global-equity-merge-preflight.json` | 与冻结 SQL 目录的合并预检：5,088 条精确既有、43,668 条新增、0 冲突 |
| `audit/artifacts-uploaded-global-equity-import-result.json` | 仅新增事务导入结果：48,756 条目录、40 个国家/地区 |
| `audit/runtime/interface-contract-matrix.json` | 重新生成的接口契约运行时矩阵 |
| `audit/runtime/menu-hierarchy-matrix.json` | 重新生成的菜单层级运行时矩阵 |
