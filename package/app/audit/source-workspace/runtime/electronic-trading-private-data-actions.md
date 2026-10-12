# 电子交易账户私有数据动作分片

| 动作 | 实际处理器 | 范围与空状态 | 验证 |
| --- | --- | --- | --- |
| 读取与刷新 | 刷新当前账户的批次、数据簿、质量阈值与复核记录查询 | 无导入批次时明确显示无可筛选、统计、搜索或导出的账户私有数据 | `electronicTradingDataList.test.ts` 通过 |
| 筛选与排序 | 对传入的当前账户订单行按关键词、方向、事件、场所、经纪商、策略、路由、复核、预警和时间执行过滤与排序 | 缺失数值保持不可计算，不用于推断；筛选为空时可清除筛选 | `electronicTradingDataList.test.ts` 通过 |
| CSV 与 Excel 导出 | 基于当前筛选结果生成 CSV 或 XLSX；包含数据范围与筛选元数据 | 无筛选结果时导出按钮禁用并显示空结果原因；不包含原始上传文件、其他账户记录或凭据 | `electronicTradingDataList.test.ts` 与 `electronicTradingResearchDb.test.ts` 覆盖 |

该分片只覆盖追加的账户私有交易数据列表，不替代或重写 ZIP 原电子交易工作区。
