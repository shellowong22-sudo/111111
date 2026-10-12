# 公开日频外汇参考数据契约

FXDS 与 FXTF 使用 `https://api.frankfurter.dev/v2/rates` 提供的公开日频参考数据。该 API 无需 API key，支持 `base`、`quotes`、`from` 和 `to` 参数，用于获取最新与区间时间序列；Frankfurter 说明其数据覆盖 84 家中央银行、201 个货币，并可按提供方筛选。[1]

| 项目 | 当前实现 |
| --- | --- |
| 数据来源 | Frankfurter v2 公共 API；客户端通过站内 tRPC 读取，外部源 URL 不作为用户跳转目标。 |
| 参考频率 | 日频参考值；应用每五分钟重新请求一次，最新可用日由上游返回。 |
| 走势图 | FXDS 行项详情和 FXTF 代码详情使用同一货币对的真实区间时间序列。 |
| 降级行为 | 请求失败或币种无公开序列时显示真实不可读取状态；不回退到固定演示路径、随机曲线、买卖价、成交量或可执行报价。 |
| 使用边界 | 不代表逐秒行情、银行双边报价、订单簿、交易权限或官方 fixing。 |

## References

[1] [Frankfurter v2 API documentation](https://frankfurter.dev/)
