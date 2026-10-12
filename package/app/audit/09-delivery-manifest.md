# 本轮交付包清单

本轮交付 ZIP 包含恢复工作副本中的可获取源代码、配置、Drizzle schema 与迁移、数据库基线 SQL、测试、审计记录和运行时审计产物；同时附带用户原始上传 ZIP 的只读副本。为避免 ZIP 将自身 SHA-256 作为内部内容而形成不可满足的自引用，不在包内声明该包的最终 SHA-256；最终生成后的校验值在交付消息中提供，并以 `unzip -tq` 进行完整性验证。

| 内容区 | 来源或说明 |
|---|---|
| `project/` | `/home/ubuntu/finance-hub-recovery`，排除可再生的 `node_modules`、`dist`、`.git`、`.manus-logs` 和本地终端日志 |
| `source-material/original-upload/` | 用户上传的 `finance-hub-recovery-complete-archive-2026-08-26.zip` 只读副本 |
| `source-material/database/` | 冻结基线 `finance_hub.sql`；仅已审计的三表 INSERT 曾以事务方式导入 |
| `source-material/uploaded-equity-workbooks/` | 用户补充的 46 份全球股票 XLSX；逐文件 SHA-256、表头、映射、有效/拒绝行和去重结论见 `audit/artifacts-uploaded-global-equity-per-file-audit.json` |
| `project/README-DELIVERY.md` | 交付范围、重建边界、最新验证结果与仍未完成限制的摘要 |

> 交付包不包含 `node_modules`、生产构建目录、开发服务日志或账户凭据。数据库运行态不是可安全整库覆盖的基线：迁移台账冲突和当前 users 数据均已在审计中保留；全球股票工作簿已作为独立来源材料纳入本包。
