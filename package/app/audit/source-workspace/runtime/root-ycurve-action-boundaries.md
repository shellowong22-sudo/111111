# 根终端与收益曲线动作边界分片

| 动作 | 实际处理 | 不可用或范围边界 | 验证 |
| --- | --- | --- | --- |
| 官方事实刷新 | 调用 `feed.refetch()`；读取期间按钮禁用 | 源读取失败时显示真实空状态，不用市场简报或固定新闻替代 | `rootCurveActionAvailability.test.ts` 通过 |
| 恢复曲线节点载入 | 调用 `loadSnapshot`，仅将已恢复官方观察载入本地节点簿 | 无快照时按钮禁用；不创建或伪装市场曲线 | `rootCurveActionAvailability.test.ts` 通过 |
| 本地工作曲线保存 | 仅设置当前会话内的保存标记 | 明确不写入外部数据、订单或市场曲线 | `rootCurveActionAvailability.test.ts` 通过 |

本分片未宣称完成全项目的导出、刷新或设置动作验收；其余入口仍保留总体待办。
