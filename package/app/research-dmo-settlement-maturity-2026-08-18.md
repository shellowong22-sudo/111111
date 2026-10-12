# 英国 DMO Gilt 交收与到期字段核验（2026-08-18）

DMO 官方 `D1A`“Gilts in Issue”报告位于 `https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D1A`。其官方说明明确包含 gilt 名称、ISIN、首次发行日期和赎回日期；Excel 导出使用参数 `COBDate`，例如 `&COBDate=17/08/2026`。工作簿表头中“Redemption Date”与“First Issue Date”分别为可读取的 Excel 日期序列，且名称格式与 D5D 发行日历中的 Gilt Name 可直接匹配。

`D5D`为每次 Outright Auction 提供操作日、证券名与名义金额，但不提供单场交收日或到期日。交收日只在 DMO 单场 auction press notice 中披露，常以“Issue and Settlement Date”表述；系统仅在公告明确匹配同一操作日和证券时写入该字段。对于重开债，D1A 的 First Issue Date 不得替代本次交收日；D1A 的 Redemption Date 可作为到期日使用。
