# BOJ 短观与 EIA 季节性来源记录

日本银行官方短观商业状况调查页面确认提供大型、中型和小型企业的制造业与非制造业列，每类都分别提供 `Actual result` 与 `Forecast`。本轮横向比较将**只读取 Actual result** 四类或六类实际列，预测列只作为已知但未纳入图表的来源边界；所有读数的单位为扩散指数百分点，并按官方季度观察日期保留。来源：[BOJ TANKAN Business Conditions](https://www.stat-search.boj.or.jp/ssi/mtshtml/co_q_1_en.html)。

EIA 季节性视图复用已核验的商业原油、成品汽油和馏分燃料油周度历史工作簿。同比值只在当前实际发布周可对应到上一年**相同 ISO 周**的另一条实际观察时计算；如该周没有上一年实际观察，则为空值，而不插值或以相邻周代替。
