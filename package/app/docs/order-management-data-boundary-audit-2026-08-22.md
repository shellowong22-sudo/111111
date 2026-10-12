# 交易委托管理深化层：数据边界与字段审计

原有交易委托管理页面及其 23 个面板使用的委托、报价、成交、合规与连通性响应均为既有演示逻辑，包含随机生成路径；本轮不改写、删除或重新解释这些原有内容。新增研究层仅分析当前账户主动粘贴导入的规范化委托事件记录，并在无导入数据时显示明确空状态。

新增记录模型以订单生命周期、事件时间、路由、修改、取消与执行为核心。美国证券交易委员会 Rule 613 对可报告事件覆盖订单生成、修改、取消、路由和执行，并要求可将事件关联到完整订单生命周期；其规则说明还要求使用毫秒或更高精度的事件时间戳。[1] 这为终端内导入校验中的 `eventId`、`orderId`、`eventType`、`venue`、`eventAt` 与可选成交价格/数量提供了字段治理参考。SEC Rule 605 的资料也将订单执行、取消、修改、时间戳和执行质量统计列为重要报告维度。[2]

导入后，系统只持久化已经规范化的事件字段与批次元数据；不会保存原始 JSON/CSV 文本、券商凭据、外部链接内容或文件字节。聚合指标均以用户导入的记录为计算基础：完成率为已执行数量除以下单数量，生命周期时长为同一订单首次 `new` 到首次 `fill`/`partial_fill` 的差值，仅在对应事件齐备时计算。该层不提交真实订单、不连接或模拟券商、交易所、报价或成交数据源。

## References

[1]: https://www.sec.gov/about/divisions-offices/division-trading-markets/rule-613-consolidated-audit-trail "SEC Rule 613 (Consolidated Audit Trail)"
[2]: https://www.sec.gov/rules-regulations/staff-guidance/trading-markets-frequently-asked-questions/frequently-asked-questions-rule-605-regulation-nms "SEC Rule 605 FAQs"
