# 运行时来源与会话限制记录

2026-08-26 的开发服务日志显示，AAPL 六个月图表查询调用平台数据 API 时返回 HTTP 400，错误为 `failed_precondition` 与“usage exhausted”。归档既有服务随后尝试公开 chart endpoint；这属于服务端来源回退，而非浏览器跳转。该回退的返回内容仍须通过现有页面来源/可用性状态呈现，不能被包装为归档已附带的实时金融事实。

同一日志区间还记录匿名预览的 `Missing session cookie`。本轮没有伪造登录、写入会话 cookie、冒充用户账户或以认证错误覆盖为成功状态。

| 限制 | 观测证据 | 当前处理 |
|---|---|---|
| 平台数据 API 配额耗尽 | `devserver.log` 在 16:58 与 17:01 记录 AAPL/6mo 的 HTTP 400 `usage exhausted` | 保留既有公开来源回退与页面真实状态；不生成替代价格、K 线或预测 |
| 匿名预览无会话 | `devserver.log` 记录 `Missing session cookie` | 保留未登录行为；不伪造身份或授权 |
| 外部来源可用性 | 外部服务、公共 endpoint 和认证状态均可能变化 | 不将一次成功、失败或缓存误报为持续可用；需要逐次运行时证据 |

> 以上限制不能通过修改原始归档、删除失败测试、伪造 session 或生成行情数据来关闭。

代码核验：`server/realDataService.ts` 的 `fetchYahooChart` 先调用平台数据 API；失败后在 8 秒受限请求内尝试公开 Yahoo chart endpoint。若公开 endpoint 同样失败，函数记录 `Historical OHLC unavailable` 并返回 `null`。`fetchMultipleYahoo` 仅保留具有至少 5 个来源历史点的成功结果，其他标的明确映射为 `null`。因此该服务路径没有以随机数、静态样本或推测值替代不可用价格。
