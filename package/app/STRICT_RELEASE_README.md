# Finance Hub 严格独立发行版

本目录是从 Finance Hub 当前恢复工作区派生的**独立发行源码树**。默认运行路径不包含平台 OAuth、托管 AI 网关、平台调度 RPC、平台对象存储代理、平台通知服务或平台 Vite 运行时。认证使用本地管理员或标准 OIDC；AI 使用 OpenAI-compatible API；数据服务使用 HTTPS allowlist；文件使用 S3/MinIO；运维通知使用 Webhook；计划任务使用数据库持久 scheduler。

## 本地查看与构建

先复制 `standalone/ENVIRONMENT_TEMPLATE.txt` 为项目根目录 `.env`，替换所有 `replace-me` 和示例地址。安装 Node.js 22 与 pnpm 后执行：

```bash
pnpm install --frozen-lockfile
pnpm run check:server
pnpm test
pnpm run build
pnpm start
```

应用默认监听 `PORT`，数据库使用 `DATABASE_URL`。首次启动前必须导入归档中的数据库 SQL，或按 `drizzle/` 迁移初始化全新数据库。对象存储 bucket 必须与 `S3_BUCKET` 一致。

## 必需外部服务

| 能力 | 独立实现 | 必需配置 |
| --- | --- | --- |
| 认证 | 本地管理员或标准 OIDC | `AUTH_MODE`、`JWT_SECRET`，以及对应认证变量 |
| 数据库 | MySQL 8/TiDB 兼容服务 | `DATABASE_URL` |
| AI | OpenAI-compatible provider | `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` |
| 文件 | AWS S3 或 MinIO | `S3_*` |
| 调度 | 数据库持久 scheduler | `APP_ORIGIN`、`SCHEDULER_SECRET` |
| 外部数据 | HTTPS endpoint allowlist | `DATA_API_ENDPOINTS_JSON` |
| 运维通知 | 标准 Webhook | `WEBHOOK_URL`，可选 |

## 已完成验证

严格发行树已完成服务端 TypeScript 检查、认证/调度/通知/Data API/对象存储定向测试和前端加 Node 生产构建。源码、锁文件、构建配置和构建产物的平台域名、平台凭据变量、平台 RPC 头、平台 Vite 依赖及平台 UI 品牌扫描结果均为零。

## 真实限制

当前沙箱没有用户自有 Docker 主机、独立数据库、MinIO、OIDC、LLM 或 Webhook 凭据，因此无法证明用户外部基础设施已经连通。代码和构建的独立性已经验证；生产可用性仍取决于部署者提供的服务、密钥、DNS、TLS、备份和监控。

