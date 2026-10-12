# 股市模块原内容保护基线

**审计日期：2026-08-20**  
**保护规则：原菜单、原面板、原字段与既有交互均不可改写；后续仅可在原面板之前或之后追加独立内容。**

## 不可变原始菜单文件指纹

| 文件 | SHA-256 | 保护方式 |
| --- | --- | --- |
| `client/src/components/StockMarketMenu.tsx` | `3e7b2bbcf6689195c1cd515960c9d33af5824541d28a01029bbe4615dbc75011` | 禁止修改 |

## 23 项可操作菜单—原面板—窗口标识基线

| 序号 | 功能码 | 菜单标识 | 原始组件 | 既有窗口标识 |
| ---: | --- | --- | --- | --- |
| 2 | WEI | `wei` | `WEIPanel` | `st-wei` |
| 3 | FTW | `ftw` | `FTWPanel` | `st-ftw` |
| 4 | IMAP | `imap` | `IMAPPanel` | `st-imap` |
| 5 | EVTS | `evts` | `EVTSPanel` | `st-evts` |
| 6 | TOP | `top` | `TOPPanel` | `st-top` |
| 7 | TREN | `tren` | `TRENPanel` | `st-tren` |
| 9 | EQS | `eqs` | `EQSPanel` | `st-eqs` |
| 10 | EQBT | `eqbt` | `EQBTPanel` | `st-eqbt` |
| 11 | DS | `ds` | `DSPanel` | `st-ds` |
| 12 | BI STOX | `bi-stox` | `BIPanel` | `st-bi-stox` |
| 13 | RES | `res` | `RESPanel` | `st-res` |
| 14 | IN | `in` | `INPanel` | `st-in` |
| 16 | TLTS | `tlts` | `TLTSPanel` | `st-tlts` |
| 17 | PORT | `port` | `PORTPanel` | `st-port` |
| 20 | MOSO | `moso` | `MOSOPanel` | `st-moso` |
| 22 | ETF | `etf` | `ETFPanel` | `st-etf` |
| 23 | FSRC | `fsrc` | `FSRCPanel` | `st-fsrc` |
| 24 | PE | `pe` | `PEPanel` | `st-pe` |
| 26 | EMSX | `emsx` | `EMSXPanel` | `st-emsx` |
| 28 | CACT | `cact` | `CACTPanel` | `st-cact` |
| 29 | MA | `ma` | `MAPanel` | `st-ma` |
| 30 | IPO | `ipo` | `IPOPanel` | `st-ipo` |
| 33 | FACTOR LAB | `factorlab` | `FactorLabPanel` | `st-factorlab` |

## 追加边界

每个原面板外层将按固定顺序呈现：**原工作区保留展示与非实时边界提示 → 完全未经改写的原面板 → 模块级事实边界 → 终端内深化研究层**。原有菜单项、面板 JSX、原字段、原按钮回调、原名称、编号、顺序和窗口去重标识不得删除、重命名或替换。

## 路由备注

股市原窗口调度位于 `Terminal.tsx` 的 `stockPanelMap`。入口通过 `st-${itemId}` 作为窗口标识，创建前执行既有去重检查。后续深化层须复用该窗口调度，不单独创建菜单入口或替代原面板。

## 深链视觉核验

2026-08-20 修复主终端深链对白名单中 `stocks` 模块的识别后，`/?module=stocks&open=ftw`、`/?module=stocks&open=evts` 与 `/?module=stocks&open=moso` 均打开对应的原股市窗口。三项截图均显示原工作区在保留横幅之后完整呈现，横幅中的“查看终端内深化研究”是同一窗口内滚动定位操作，不离站、不替换原面板。FTW、EVTS 与 MOSO 原面板含有非实时样式字段，保留横幅已明确其事实边界；对应追加层在长工作区之后提供实际公开资料或真实空状态。
