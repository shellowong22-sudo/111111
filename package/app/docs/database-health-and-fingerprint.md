# 数据库与历史内容指纹核验

本项目提供两个只读审计入口：

- `pnpm run audit:database-health`：连接 `DATABASE_URL`（本地未设置时仅用于此工作区的回环测试库 `mysql://root@127.0.0.1:3307/finance_hub`），输出并保存 `audit/runtime/database-health-report.json`。
- `pnpm run audit:migration-state`：读取当前包内 `drizzle/meta/_journal.json`，不再依赖 Linux 绝对路径。

数据库审计覆盖：

- 关键业务表是否存在及行数；
- 去重唯一索引和幂等唯一键；
- `admin_data_module_content_items` 的 `dedupe_scope + content_hash`；
- 爬虫原始内容 `spider_raw_data.content_hash`；
- 历史快照 `entity_uuid + content_hash`；
- 新闻来源 URL 和全球数据“来源 + 标的 + 子类型 + 原始内容指纹”；
- 管理后台推送状态和前端回执状态。

审计命令只读，不删除重复记录、不覆盖历史归档、不自动运行可能重复建表的迁移。发现重复或迁移漂移时会返回 `duplicates_detected` / `drift_detected`，由后续明确的迁移方案处理。

爬虫历史快照由 `server/spiderPlatform.ts` 的内容指纹链维护：相同实体和相同指纹重复抓取为 no-op；内容指纹变化时按 `version` 追加新快照，并保留来源 URL、原始抓取 UUID、内容和变更摘要。RSS 条目以“来源种子 + 条目 URL”作为稳定身份，标题或摘要更新会更新原记录并追加快照，不再因标题变化生成重复新闻。

当前本地核验记录（2026-09-12）：关键去重检查无重复哈希；`spider_push_relation` 有 23 条 `front_acknowledged`、6 条 `waiting_front_ack`，仅前者计为前端已确认；迁移日志与实际表数量存在历史漂移，已登记但未用重复 `CREATE TABLE` 迁移掩盖。
