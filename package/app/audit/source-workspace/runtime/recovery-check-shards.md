# 可中断恢复检查分片

为避免全量测试、类型检查或生产构建阻塞开发，恢复验收按功能边界拆分。每次只运行当前变更直接相关的一个分片；脚本将完整输出覆盖写入 `audit/runtime/check-shards/<分片>.md`，因此失败不会掩盖已完成分片，也不会被错误视为全项目通过。

| 分片 | 运行命令 | 检查边界 |
|---|---|---|
| 指数独立层 | `node audit/scripts/run_recovery_shard.mjs index-extension` | 24 个专属组件、原工作区/权重工具保留、6 条组件交互。 |
| 投资组合与风险独立层 | `node audit/scripts/run_recovery_shard.mjs portfolio-extension` | 24 个专属组件、原工作区保留、关键组件交互。 |
| 管理员导航 | `node audit/scripts/run_recovery_shard.mjs admin-navigation` | 未登录菜单可见、内容仍受保护、OAuth 回跳安全。 |
| 移动终端壳层 | `node audit/scripts/run_recovery_shard.mjs mobile-shell` | 375px 首帧断点状态；不替代页面级移动验收。 |
| 已导入市场数据 | `node audit/scripts/run_recovery_shard.mjs imported-market-data` | 已导入数据与曲线契约；不请求外部实时数据。 |

> 这些分片是定向证据，不等同于全部页面、全部接口、全部浏览器交互、全量类型检查或生产构建。总体待办保留其各自的未完成状态。
