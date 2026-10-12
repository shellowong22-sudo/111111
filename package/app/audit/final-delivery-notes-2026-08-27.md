# Finance Hub 最终交付说明（2026-08-27）

本包以当前工作副本为准，原上传归档仍保存在 `source-material/original-upload/`，只读冻结证据保存在 `recovery-evidence/`。本次回滚后的外汇恢复文件已真实纳入：`ForexOriginalInteractionBridge.tsx`、`ForexRestoredWorkspaces.tsx`，并恢复 `Terminal.tsx` 与 `ForexPreservedModule.tsx` 的挂载变更；原冻结面板未被重写。

## 已验证

| 项目 | 结果 |
|---|---|
| 外汇、来源边界、静态/动态清单专项 | 8 个文件、29 个用例通过 |
| 客户端 TypeScript | 通过 |
| 服务端 TypeScript | 通过 |
| 生产构建 | 通过；存在既有大 bundle 警告，未作业务重构 |
| 动态来源清单 | 审计候选 76 条：内部 2、订阅 5、外部/未知 69；新增终端内 CSV `data:` 导出单列为 `local-export`，不计入外部来源基线 |
| 全球股票工作簿 | staging 中 46 份，按既有审计保留 |
| 数据库 | 本轮未执行写入、迁移或破坏性 SQL；仅保留既有导出/迁移材料 |

## 未完成与限制

完整 Vitest 本轮真实结果为 **219 个文件通过、13 个文件失败；753 个用例通过、17 个用例失败**。失败集合属于既有冻结指纹/版本冲突、缺失或不一致的归档条件、数据库迁移/认证前置条件等，详见 `audit/final-full-vitest-2026-08-27.txt`、`audit/final-full-vitest-tail-2026-08-27.txt` 与既有失败登记；未通过修改测试断言、删除测试、修改冻结哈希或虚构登录态来掩盖。开发日志仍记录 `BadRequestError: request aborted`，以及匿名预览、外部服务/数据配额、迁移冲突和 bundle 体积等限制。

全入口逐项可视化验收、全部动态外部候选逐条运行时核验、全部模块零业务模板复用证明和数据库迁移冲突仍按 TODO 保持未完成。包内不含 `.env*`、私钥、凭据、session/cookie、`node_modules`、`dist`、缓存或开发日志；原始业务资料与用户工作簿按可获取范围保留。

本次交付不自动发布。请在管理界面通过 checkpoint 预览；发布动作需由用户自行操作。

> 包外 SHA-256 必须以最终 ZIP 实际生成后命令输出为准，避免自包含哈希造成自引用失真。
