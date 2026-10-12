# 数据库恢复范围证据

嵌套交付包保留了数据库转储 `_baseline_nested_source/database/finance_hub.sql`。该文件大小为 `11,520,236` bytes，SHA-256 为 `829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9`，含 `188` 条 `CREATE TABLE` 定义，并包含 `market_data` 表定义。

恢复初期，运行数据库曾缺少 `market_data` 表；这已在当时的 `server/market.test.ts` 日志中实际出现。尽管该测试的四条断言通过，数据库异常被既有代码处理为可预期结果，因而该阶段测试不能作为真实数据恢复成功的证据。

当时已执行只读 SQL `SHOW TABLES LIKE 'market_data'`；查询成功但未返回该表，和测试日志一致。该历史结论仅说明初期项目运行数据库未完成基准 schema 恢复；后续恢复与当前复核见本文件下文及 `audit/runtime/database-current-consistency-recheck.md`。

在未对 schema、迁移顺序、现有数据库状态和转储适配性完成审计前，不执行导入，也不以固定值、缓存值或随机数据替代市场数据。

## 已完成的最小数据恢复

2026-08-26 已依据原始转储中的 `market_data` 表定义与插入段恢复 48 条行情快照。恢复后使用 `audit/scripts/verify_market_data_restore.mjs` 对原始插入段和运行数据库按 `id`、标的、名称、市场、价格、涨跌额、涨跌幅、成交量与读取时间逐行逐字段比对，结果为 `sourceCount=48`、`liveCount=48`、`differenceCount=0`。该数据是 2026-08-25 的原始快照，不表示实时行情。

`notifications` 表在原始转储中没有数据行；其 schema 和其余 186 个原始表仍属于未完成的恢复范围。

## 后续逐表恢复记录

所有以下写入均只取自同一原始转储（SHA-256：`829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9`），未调用外部行情或宏观数据源，也未生成、猜测或补造任何值。

| 表 | 原始记录数 | 运行库记录数 | 来源字段与时间边界 | 结果与限制 |
| --- | ---: | ---: | --- | --- |
| `equity_quote_snapshots` | 11 | 11 | 保留 `status`、`observation_at`、`fetched_at`、`unavailable_reason`；最早观测为 2024-07-15，最晚读取为 2026-08-25 13:11:26 | 已恢复。4 条为真实可用快照，7 条保留原始不可用状态及原因；不代表实时价格。 |
| `money_market_source_availability_snapshots` | 10 | 10 | 保留 `status`、`record_count`、`latency_ms`、`sampled_at`、`created_at`；采样时间为 2026-08-25 11:00 与 13:00 | 已恢复。仅 11:00 的 FRED SOFR 源在原始快照中为可用，其余状态如实保留为不可用。 |
| `index_constituent_archive_events` | 2 | 2 | 保留来源机构、公告日、生效日、成分增删列表、来源 URL 与读取时间；读取时间为 2026-08-25 | 已恢复。内容为 NASDAQ-100 的两条原始归档事件，不表示当前成分实时状态。 |
| `curve_data_points` | 4,276 | 4,276 | 原始曲线点数据经脚本按完整 INSERT 段事务导入，依赖既有的 2 条 `curves` 主记录 | 已恢复。脚本导入回执 `insertedRows=4,276`、`differenceCount=0`；点位日期和值均直接来自转储。 |
| `treasury_historical_curve_imports` | 1 | 1 | 保留 Treasury 发布源 URL、源指纹、起止观测日与实际日历月末说明 | 已恢复。脚本导入回执 `insertedRows=1`、`differenceCount=0`；该表描述历史曲线导入边界，而非实时利率。 |
| `admin_runtime_health_samples` | 14 | 14 | 保留原始运行采样时间与状态 | 已恢复。脚本导入回执 `insertedRows=14`、`differenceCount=0`。 |
| `terminal_watermark_settings` | 1 | 1 | 保留原始全局水印开关、透明度与更新时间 | 已恢复。脚本导入回执 `insertedRows=1`、`differenceCount=0`。 |
| `users` | 5,512 | 5,512 个映射归档用户；另保留 1 个既有认证用户 | 源 ID `1` 映射为 `1890001`，其余保留源 ID；所有原始 `openId` 原值均保留 | 映射表、归档目标用户均为 5,512 条，映射差异为 0；为对齐原始 DDL，已移除模板额外 `openId` 唯一索引。 |
| `money_market_module_usage_events` | 3 | 3 | 关联 `user_id` 通过同一映射替换 | 已恢复。所有事件均能连接至映射后的归档用户，差异为 0。 |
| `terminal_security_events` | 2 | 2 | 关联 `user_id` 通过同一映射替换 | 已恢复。所有事件均能连接至映射后的归档用户，差异为 0。 |

本次记录数以原始 `INSERT` 段与运行库按表的必要行数检查为准。后续大表（包括曲线点、上市证券和央行决策正文）将继续按“源 DDL → 源 INSERT → 表级字段比对”的顺序恢复；在完成前，不将整个数据库描述为已完全恢复。

## 用户关联数据的恢复前冲突审计

为避免覆盖当前认证环境，已对原始 `users` 段、运行 `users` 表以及原始 `money_market_module_usage_events`、`terminal_security_events` 的关联用户 ID 进行了**只读汇总审计**。原转储包含 5,512 个用户，运行库当前有 1 个用户；存在 1 个用户 ID 冲突，但没有 `openId` 冲突。两张用户关联表共引用 1 个原始用户 ID，且该 ID 在原始用户表中存在。

因此，在取得明确的用户数据合并策略前，不导入 `users`、`money_market_module_usage_events` 或 `terminal_security_events`，也不导入 `__drizzle_migrations`。这一阻断是为了避免覆盖当前认证用户、制造悬挂关联或伪造迁移已应用状态。

## 恢复期间运行时写入的纠正

在权益快照恢复后，运行环境曾新增一条不在原始转储中的 `AFNIC.AD` 不可用快照，并刷新了一条 `AIRARABIA.DFM` 记录的读取时间。二者均非原始基准内容，已分别删除和回写为转储中的原始字段。随后以原始 INSERT 段重算结果为 `sourceRowCount=11`、`liveCount=11`、`differenceCount=0`。因此本表当前不包含该次运行时写入。

## 已授权的用户 ID 映射恢复

用户已明确授权执行可审计的 ID 映射迁移。原始 `users` 转储含 5,512 条记录，其中 5,511 条与其他归档记录重复使用同一 `openId`。这是原始转储允许的数据形态：其 `users` DDL 没有 `openId` 唯一索引。运行模板初始创建了并非原始 DDL 一部分的 `users_openId_unique` 索引，首次迁移因此被数据库拒绝并回滚。为与原始 schema 对齐且不改写归档 `openId` 值，已移除该模板索引。

运行认证库原有用户 ID `1` 保持不变。原始同 ID 用户按已批准规则映射到 `1890001`；其余 5,511 个归档用户保留原始 ID。迁移在同一事务内写入归档用户、3 条 `money_market_module_usage_events`、2 条 `terminal_security_events` 和 5,512 条独立映射审计记录；映射仅保存源 ID、目标 ID、源 `openId` 的 SHA-256 及转储 SHA-256，不保存额外明文身份字段。

后续只读核验结果为：映射行数 5,512、映射源/目标 ID 各自去重数均为 5,512、目标用户存在数 5,512、关联使用事件 3、关联安全事件 2、预期重映射 1、运行用户 ID `1` 仍存在且未被映射覆盖，综合 `differenceCount=0`。映射规则和前置约束说明位于 `audit/runtime/user-id-mapping-migration-plan.md`，核验脚本位于 `audit/scripts/verify_user_mapping_migration.mjs`。

## 原始空表 schema 覆盖

原始转储包含 188 条 `CREATE TABLE` 定义。受控恢复脚本使用原始 DDL 仅创建运行库中缺失的表，并明确排除对 `__drizzle_migrations` **数据记录**的导入。恢复后复核结果显示：188 张原始表定义均已存在，缺失的非迁移源表数量为 `0`，没有 DDL 执行失败。

逐表审计脚本 `audit/scripts/audit_empty_source_schema_tables.mjs` 已枚举 173 张原始无 INSERT 表。其汇总为：`sourceEmptyTableCount=173`、`missingSchemaCount=0`、`nonEmptyLiveTableCount=0`。该脚本对每张表输出 `tableName`、`schemaRestored=true`、`sourceRowCount=0`、`liveRowCount=0` 和 `functionalAcceptance=未验收`；这些表保持原始空数据状态，不能被描述为已有业务记录或已完成页面功能验收。
