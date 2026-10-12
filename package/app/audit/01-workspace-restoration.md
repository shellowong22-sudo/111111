# 工作副本恢复记录

归档中的 `workspace/` 已作为**源工作区**复制至本项目根目录。嵌套的 `_baseline_archive/` 与 `_baseline_nested_source/` 保留在项目外冻结基准中，未复制入运行项目；`.manus-logs/`、`.manus/` 和 `.project-config.json` 属于环境状态或运行日志，也未替换当前项目环境。归档原有 `audit/` 与 `todo.md` 已保存至 `audit/source-workspace/` 和 `audit/original-workspace-todo.md`，便于回溯但不覆盖本次审计清单。

| 关键文件 | 源工作区 SHA-256 | 运行工作副本 SHA-256 | 结果 |
|---|---|---|---|
| `package.json` | `456a7a82a1fc3a8e629738f615e909e04b620eb4c83e178eb3b6db4a3c563833` | `456a7a82a1fc3a8e629738f615e909e04b620eb4c83e178eb3b6db4a3c563833` | 一致 |
| `pnpm-lock.yaml` | `81889337d5d96755fe5a652b8e029c02cff8c9ce37c3072dc0f4774fd67cc917` | `81889337d5d96755fe5a652b8e029c02cff8c9ce37c3072dc0f4774fd67cc917` | 一致 |
| `client/src/App.tsx` | `abcfc54fb4d0394d780206e6955c0353bdaee575b3a8b466fe4f7725eee355fe` | `abcfc54fb4d0394d780206e6955c0353bdaee575b3a8b466fe4f7725eee355fe` | 一致 |
| `server/routers.ts` | `77586ec4398612632805c543790ad18add4ae383de29618b96dfcef2b99d95e0` | `77586ec4398612632805c543790ad18add4ae383de29618b96dfcef2b99d95e0` | 一致 |
| `drizzle/schema.ts` | `52a8f1cfde6e2c8f9a538228cd9e4c48466f07ec36281ab2f7e4ebfe6c80f9d9` | `52a8f1cfde6e2c8f9a538228cd9e4c48466f07ec36281ab2f7e4ebfe6c80f9d9` | 一致 |

恢复后的可获取资料清点如下。此统计仅说明文件已进入独立工作副本，不代表尚未运行核验的模块已经通过。

| 类别 | 数量 |
|---|---:|
| TypeScript / TSX 文件 | 1,358 |
| 自动化测试文件 | 227 |
| Drizzle 文件 | 180 |
| SQL 迁移文件 | 90 |
| 源审计 Markdown 文件 | 52 |
| 参考资料、恢复证据和文档文件 | 59 |
| `client/public` 文件 | 3 |
| `client/src/assets` 文件 | 0 |

数据库迁移和快照已随 `drizzle/` 恢复。外层归档没有可直接导入的独立数据库转储被识别为运行时数据库；是否存在可获取的结构/数据导出将继续在后续审计中逐项确认，并在最终归档中分别标注。

在排除环境状态（`.git/`、`node_modules/`、`.manus/`、`.manus-logs/`、`.project-config.json`）、本次审计资料（`audit/`、`todo.md`）及项目外冻结的嵌套基准后，已对源工作区和运行工作副本执行递归逐文件比对。初次比对仅发现两个由当前模板产生、但不属于归档工作区的残留：`drizzle/0000_late_turbo.sql` 与 `vite.config.ts.bak`。二者已从工作副本移除；复核结果为 **0 行源文件差异**。该复核表明归档源代码、配置、迁移和资料在工作副本中按字节保持一致，后续仅在证实有运行阻塞时再作最小补足并单独记录。
