# 归档用户 ID 映射迁移计划

## 授权与来源

本迁移由用户于 2026-08-26 明确授权。唯一业务来源仍为不可改写的原始转储 `_baseline_nested_source/database/finance_hub.sql`，其 SHA-256 为 `829b54ca0a17b667317ece71dac4ad4ddedfe168ce618698af5c9e8ada5093d9`。

## 已确认的冲突范围

只读审计显示，原始转储有 5,512 个归档用户，当前认证库有 1 个运行用户。原始用户 ID 与当前用户 ID 发生 1 次冲突；原始与运行用户的 `openId` 不冲突。原始 `money_market_module_usage_events` 与 `terminal_security_events` 仅引用 1 个归档用户 ID，且该 ID 位于原始用户表中。

## 确定性映射规则

| 源用户 ID 情况 | 目标用户 ID | 目的 |
| --- | --- | --- |
| 未与运行 `users.id` 冲突 | 保留原始 ID | 最大程度保留原始主键与关联结构。 |
| 与运行 `users.id` 冲突 | 从原始 `users` DDL 的 `AUTO_INCREMENT=1890001` 起，按源 ID 升序依次分配未占用 ID | 永不覆盖当前认证用户，且映射在同一源转储和同一运行库状态下可重复推导。 |

本次预期仅有一条重映射：源 ID `1` 映射至目标 ID `1890001`。其他归档用户保留其原始 ID。所有用户关联事件的 `user_id` 使用同一映射替换；除 `users.id` 与关联表的 `user_id` 外，其余源字段逐字节按原始 SQL 值导入。

## 写入与回滚边界

迁移将新增独立审计表 `recovery_user_id_mappings`，仅记录源 ID、目标 ID、源 `openId` 的 SHA-256 及记录时间，不存储明文 `openId`。归档用户、使用事件与安全事件将在同一个数据库事务中写入；预演统计、目标表非空、映射不一致或任何源外键缺失时，迁移必须停止且不覆盖现有用户。`__drizzle_migrations` 不纳入本迁移。
