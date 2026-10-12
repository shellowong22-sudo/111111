# BOJ 预测偏差与 EIA 产品地区字段记录

BOJ TANKAN 官方商业状况调查表同时列出 Actual result 与 Forecast。实际值与“上期预测”比较的唯一配对规则为：当前季度的 Actual result 减去紧邻前一季度同企业规模、同产业的 Forecast；若前一季度不存在、两期不相邻或实际值/预测值为空，则该偏差为空，不用下一期预测、模型估计或第三方预期替代。

EIA 产品地区库存使用官方历史工作簿，已实际探测以下 PADD 代码均可返回工作簿：

| 产品 | PADD 1 | PADD 2 | PADD 3 | PADD 4 | PADD 5 |
| --- | --- | --- | --- | --- |
| 成品汽油库存 | WGTSTP11 | WGTSTP21 | WGTSTP31 | WGTSTP41 | WGTSTP51 |
| 馏分燃料油库存 | WDISTP11 | WDISTP21 | WDISTP31 | WDISTP41 | WDISTP51 |
| 商业原油库存 | WCESTP11 | WCESTP21 | WCESTP31 | WCESTP41 | WCESTP51 |

地区筛选只展示每个产品、每个 PADD 的 EIA 实际周度观察；它不表示地区实时库存、调运能力、成品油供应预测或价格建议。地区同比只在 52 周前同一实际发布日期存在时计算。
