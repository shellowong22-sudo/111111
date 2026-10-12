# 权益快照运行时写入保护

## 发现与修正

全局股票 `quote` 查询此前会在外部图表请求成功或不可用时，以插入/更新方式写入已恢复的 `equity_quote_snapshots`。这会使查询行为改变 ZIP 基准数据。当前路由保留对已导入证券的来源、查询时间、可用状态、不可用原因及本次响应数据，但已移除对恢复快照表的全部写入。

| 核验项 | 结果 |
|---|---|
| 基准范围检查 | 原始 `equity_quote_snapshots` INSERT 段为 11 行，且不含 `ABNIC.AD`。 |
| 运行时纠正 | 删除 ID 150001 的 `ABNIC.AD` 不可用记录；该行读取时间为 2026-08-26 07:38:14，非原转储快照。 |
| 路由保护 | `server/routers/equityListings.ts` 不再导入或写入 `equityQuoteSnapshots`。 |
| 定向回归 | `server/equityListingsQuoteContract.test.ts` 2/2 通过，断言路由不含恢复快照写入。 |
| 当前只读复核 | `equity_quote_snapshots=11`，`ABNIC.AD=0`。 |

该保护不伪造行情：外部数据不可用时仍返回明确的不可用状态和原因；外部数据可用时仅作为本次响应返回，既不替换原始快照，也不被描述为可执行市场报价。
