# 运行环境恢复记录

归档源码的 `server/realDataService.ts` 在加载时依赖 `xlsx`。恢复源文件后，当前模板遗留的依赖目录未包含该包，导致开发服务在 `ERR_MODULE_NOT_FOUND: Cannot find package 'xlsx'` 处退出。归档的 `package.json` 和 `pnpm-lock.yaml` 本身已经声明 `xlsx@^0.18.5`；因此未改写归档依赖契约，只将本地依赖目录与原始锁定清单同步。

| 检查项 | 结果 |
|---|---|
| 归档 `package.json` 与工作副本差异 | 无差异 |
| 归档 `pnpm-lock.yaml` SHA-256 | `81889337d5d96755fe5a652b8e029c02cff8c9ce37c3072dc0f4774fd67cc917` |
| 工作副本 `pnpm-lock.yaml` SHA-256 | `81889337d5d96755fe5a652b8e029c02cff8c9ce37c3072dc0f4774fd67cc917` |
| 已解析的 `xlsx` 版本 | `0.18.5` |
| 重启后开发服务 | 已在日志中报告 `Server running on http://localhost:3000/` |

修复范围仅为工作副本的目录写权限和本地依赖安装。冻结原始归档、冻结解压基准以及 `audit/baseline-manifests/` 均保持只读。
