# 英国 DMO 融资日历来源核验（2026-08-18）

英国 Debt Management Office 的官方 `D5D` 报告位于 `https://www.dmo.gov.uk/data/pdfdatareport?reportCode=D5D`，页面标题为“Outright Gilt Issuance Calendar”。页面说明该年度日历会按季度指定实际拍卖证券，并在拍卖前一周补充规模；新券票面利率与规模同期公布，拍卖日再加入现金收入。

页面当前提供财年参数 `Financial Year=2026-27`，并展示 PDF、Excel、Word 三种导出控件。运行时加载的 DMO 官方脚本包括 `DataReport.js`、`PDFData.js`、`PDFDataReport.js` 和 `TableData.js`。后续实现须通过这些控件使用的官方报表请求读取字段，不以日历规律或第三方内容推断拍卖事件。

补充来源：`https://www.dmo.gov.uk/data/` 指向 Gilt Announcements 与 Gilt Auction Results (D2.1A)；一周前发布的单场 press notice 可补充拍卖日、交收日、证券和规模。
