# Finance Hub 严格独立发行包

本包中的 `app/` 是独立发行源码树。运行时代码、构建配置、锁文件和已生成构建产物已完成平台域名、凭据变量、RPC 头、构建插件、旧存储路径和 UI 品牌扫描，阻断匹配为零。

## 目录

| 路径 | 内容 |
| --- | --- |
| `app/` | 严格独立源码、Drizzle 迁移、独立 Docker/Compose、验证报告和生产构建产物 |
| `database/finance-hub.sql` | 真实数据库结构与数据导出 |
| `original-uploads/` | 当前可获取的 20 个原始上传资料 |
| `FILE_MANIFEST.tsv` | 归档文件清单 |
| `SHA256SUMS.txt` | 归档内部逐文件校验 |

## 本地查看与运行

进入 `app/`，将 `standalone/ENVIRONMENT_TEMPLATE.txt` 复制为 `standalone/.env.standalone`，然后替换全部占位值。请勿把真实密钥提交到代码仓库。

```bash
cd app
pnpm install --frozen-lockfile
STANDALONE_ENV_FILE=standalone/.env.standalone node scripts/standalone-preflight.mjs
pnpm run check:server
pnpm test
pnpm run build
pnpm start
```

若使用 Docker，请在 `standalone/` 目录准备 `.env.standalone` 后运行：

```bash
docker compose --env-file .env.standalone -f docker-compose.full.yml up --build -d
```

## 数据库恢复

请先创建目标 MySQL 数据库，再导入 `database/finance-hub.sql`。也可以使用 `app/drizzle/` 仅初始化新数据库，但这不会恢复已有业务数据。

```bash
mysql --host HOST --user USER --password DATABASE < database/finance-hub.sql
```

## 已验证与未验证

已验证：frozen-lockfile 安装、服务端 TypeScript、6 个核心测试文件的 9 项测试、前端生产构建、Node 服务 bundle、源码/锁文件/构建产物零平台阻断扫描。

未验证：用户未提供自有 MySQL、Redis、S3/MinIO、OIDC、LLM 或 Webhook 凭据，因此没有伪造这些外部服务已连通。部署后必须按 `app/STRICT_RELEASE_README.md` 完成环境验收。

