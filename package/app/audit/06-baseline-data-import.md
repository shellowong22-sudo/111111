# 基线市场与曲线数据的非破坏性导入审计

## 范围与安全边界

本记录只覆盖冻结资料 `/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql` 中的 `market_data`、`curves` 与 `curve_data_points` 三张表。该源文件 SHA-256 为 `829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9`，大小为 11,520,236 bytes。源转储含有 `DROP TABLE`；导入过程没有执行该语句、`CREATE TABLE`、锁表语句或任何整库恢复操作。

导入前审计脚本 `audit/scripts/audit_baseline_market_curve_import.mjs` 将冻结 SQL 的 INSERT 语句、当前列序、索引和行数作只读比较。受限导入脚本 `audit/scripts/import_baseline_market_curve_data.mjs` 仅在目标表均为空、列序逐项相等且冻结行数满足预期时，在单一事务内执行这三张表的原始 `INSERT INTO ... VALUES` 语句；任一预检、写入后计数或事务步骤不符均会回滚。它不涉及 `users`、迁移元数据或其他业务表。

| 表 | 冻结 INSERT 行数 | 导入前行数 | 导入后行数 | 冻结 INSERT SHA-256 | 结果 |
|---|---:|---:|---:|---|---|
| `market_data` | 48 | 0 | 48 | `4cc4c8a00d75594cd40268f03479e43cd31a5cdd43986bc4a29fa3b08b62dcff` | 已以原始值导入 |
| `curves` | 2 | 0 | 2 | `bab082ade30892b5a06d95164850a2ee9ddd2bd4a5b022d65f6707b220ccd3bb` | 已以原始值导入 |
| `curve_data_points` | 4,276 | 0 | 4,276 | `468f69d81d9074be992ade6e7c8dfca10a8e1c64186d218c59f946de6aed234c` | 已以原始值导入 |

> 上表中的行情和 ZIP 测试曲线均为冻结归档内既有记录，而不是本轮生成、实时刷新或官方认证数据。页面或后续审计不得将其表述为实时市场事实。

## 官方历史曲线：已有资产的核验与审计元数据对账

导入后，当前数据库已存在 `UST_PAR_YIELD_OFFICIAL_HIST_1990_2023` 曲线及 4,257 个点位，但 `treasury_historical_curve_imports` 审计记录缺失。因此，冻结归档的原始导入程序尝试再次创建同一唯一 `curve_id` 并被数据库拒绝。该失败没有覆盖或删除现有点位。

没有通过伪造导入记录处理该问题。首先，`audit/scripts/verify_treasury_historical_curve_asset.mjs` 按冻结归档 `server/import-treasury-historical-curve.mjs` 相同的“每个自然月最后一个实际发布观测、无插值”规则，重新下载并解析美国财政部公开 CSV，然后将数据库完整点集与来源点集逐点比较。结果如下。

| 核验项 | 结果 |
|---|---|
| 来源 URL | `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rate-archives/par-yield-curve-rates-1990-2023.csv` |
| 来源文件 SHA-256 | `004461bcf87ec7b34daf035f05fc191d7cf2cd84986533df3e39d5dcdb0d62a4` |
| 来源首/末观测日 | `1990-01-31` / `2023-12-29` |
| 选取月末观测数 | 408 |
| 预期 / 实际点位数 | 4,257 / 4,257 |
| 预期 / 实际点集 SHA-256 | 均为 `09c00df2fa875abf487bb32c8a43d428b932aa89af7a74bd46498611a949116f` |
| 核验结论 | `verified: true` |

仅在上述只读核验通过、曲线 ID 与点位数仍一致且导入键尚不存在时，独立脚本 `audit/scripts/reconcile_treasury_historical_import_metadata.mjs` 向归档既有表 `treasury_historical_curve_imports` 插入来源审计元数据。它没有写入 `curves` 或 `curve_data_points`。随后 `server/treasuryHistoricalCurve.test.ts` 通过，且 `server/curves-db.test.ts` 的两个用例通过。

## 保留限制

冻结 SQL 中另有 14 个 `curve_data_points` 位于 `curve_id` 为 2、3、5、7 和 9 的五组无目录归属记录。冻结 `curves` INSERT 仅包含两个目录记录，缺少这些内部 ID 的名称或来源元数据。为不凭空创建曲线目录，本轮未重新指派、删除或生成这些点位；该事实保留在后续内容恢复审计范围内。

后续只读复核再次在冻结 SQL 中检索 `curve_id` 的非点位引用，并核对 `curves` 的唯一 INSERT：除表定义外，没有发现 ID `2`、`3`、`5`、`7`、`9` 对应的曲线名称、国家、币种、期限说明或外部来源关联；该 INSERT 仍仅含 `id=1 / UST_PAR_YIELD_OFFICIAL_HIST_1990_2023` 与 `id=30001 / ZIP_TEST_CURVE_PRESERVED`。因此不创建目录、不重指派、不删除 14 条点位是唯一可由冻结资料支持的处理结果；该项来源核验已完成，但点位因无目录而不可在业务曲线详情中解释的限制继续适用。

全局权益工作簿相关测试在市场快照导入后仍失败：`server/globalEquityImport.test.ts` 报告源文件列表为空，而其断言要求 42 份工作簿来源、48,756 条清单和 66 条重复边界。该问题与本记录的三个 SQL 表无关，也没有通过虚构工作簿或改写测试处理。

## 证据文件

| 文件 | 内容 |
|---|---|
| `audit/artifacts-baseline-import-preflight.json` | 导入前结构、索引、行数和冻结 INSERT 摘要 |
| `audit/artifacts-baseline-import-result.json` | 受限事务导入后各目标表的精确计数 |
| `audit/artifacts-curve-state-after-import-attempt.json` | 原始导入程序唯一键失败后的只读曲线状态 |
| `audit/artifacts-orphan-curve-directory-recheck.json` | 无目录 curve_id 2/3/5/7/9 的只读来源复核、两条目录记录及零修改结论 |
| `audit/artifacts-treasury-historical-verification.json` | 美国财政部来源与完整点集的只读逐点核验 |
| `audit/artifacts-treasury-historical-metadata-reconciliation.json` | 在核验通过后插入既有审计表的最小对账结果 |
