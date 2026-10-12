# 交易模拟端点可达性分片

本分片检索当前 `client/src` 中对 `trading.getOrderBook`、`trading.getExecutions`、`trading.getExecutionQuality`、`trading.getAlgoOrders`、`trading.getVWAPBenchmark` 与 `trading.getOrders` 的直接调用。

| 端点 | 客户端直接调用 | 本轮处置 |
| --- | --- | --- |
| `getOrderBook` | 未发现 | 不扩大修改范围；仅在后续发现实际调用方时关闭伪订单簿输出。 |
| `getExecutions` | 未发现 | 不扩大修改范围。 |
| `getExecutionQuality` | 未发现 | 不扩大修改范围。 |
| `getAlgoOrders` | 未发现 | 不扩大修改范围。 |
| `getVWAPBenchmark` | 未发现 | 不扩大修改范围。 |
| `getOrders` | 未发现 | 不扩大修改范围。 |

检索命令使用客户端 TS/TSX 文件；本结论仅说明当前静态直接调用不可达，不构成对未来调用方或外部 API 客户端的保证。EMSX 已可达的 `submitOrder` 与 `getRiskMetrics` 则另行关闭并有专属回归。
