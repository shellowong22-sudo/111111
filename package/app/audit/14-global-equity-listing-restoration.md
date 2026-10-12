# 全球股票清单 0 条问题的恢复审计

## 问题与权威来源

用户截图显示 WEI 面板的“已导入全球股票清单”为 **0 条**。只读预检确认当前 `equity_listings` 表为空，但冻结基线 `/home/ubuntu/finance-hub-baseline/source/unpacked/database/finance_hub.sql` 包含该表的原始 INSERT。该 SQL 来源是用户冻结归档所恢复的数据库资料，不是本轮从网络下载或生成的股票数据。

| 核验项 | 结果 |
|---|---:|
| 冻结 SQL INSERT 元组数 | 5,088 |
| 冻结 INSERT SHA-256 | `6c84ac2b18302ab7e8c2345b74e1fa7fa71f60eb0997ad447772aca8990c3dd0` |
| 导入前当前行数 | 0 |
| 当前列序与归档迁移一致 | 是 |
| 当前唯一键 | `(country_code, symbol)` |
| 导入后行数 | 5,088 |
| 导入后国家/地区数 | 6 |

## 受限导入

新增脚本 `audit/scripts/import_baseline_equity_listings.mjs` 仅接受上述精确行数、INSERT 指纹、既有列序与空目标表。它在单一事务内执行冻结 SQL 的原始 `equity_listings` INSERT；写入后必须再次得到 5,088 行才提交，否则回滚。脚本没有执行 `DROP TABLE`、`CREATE TABLE`、整库恢复，也没有修改 `users`、迁移台账、市场快照、曲线或任何其他表。

> 此次恢复的是冻结 SQL 所携带的**证券目录及其来源文件/工作表字段**，不是实时行情、公司基本面、价格、新闻或投资建议。面板和接口对行情不可用时仍必须显示真实限制。

## 导入后接口与测试证据

对本地既有接口 `equityListings.list` 与 `equityListings.countries` 的动态请求返回总数 5,088，首三条为 AE 市场 `2POINTZERO.AD`、`ABNIC.AD` 与 `ADAVIATION.AD`，并保留 `阿联酋全部股票.xlsx` / `阿联酋全部股票` 的冻结来源字段。国家计数如下。

| 国家/地区代码 | 目录记录数 |
|---|---:|
| AE | 175 |
| AT | 81 |
| BR | 476 |
| CA | 672 |
| CH | 241 |
| CN | 3,443 |

新增 `server/equityListingsBaselineRestore.test.ts` 直接验证总数、国家覆盖、首条来源字段和 CN 筛选。该测试与 `globalEquityCoverageDesk`、`historicalObservationDesk`、`historicalVaRDesk` 定向共 **7/7 通过**，服务端类型检查通过。

## WEI 页面真实交互验收

通过既有终端深链 `/terminal?module=stocks&open=wei&country=CN&symbol=000001.SZ` 打开用户截图对应的 WEI 窗口。首次异步读取时，面板现在显示“读取中”而不是误导性的 `0 条`；数据完成后，中国筛选显示 **3,443 条**、第 1/69 页，并列出 `000001.SZ 平安银行` 等冻结目录行。选择首行后，已有公开行情路径在实际可用时显示来源和观测时间；这不改变证券目录本身的冻结数据边界。

随后在同一浏览会话完成以下站内交互：输入“平安”后列表收窄为 `000001.SZ 平安银行` 与 `001359.SZ 平安电工` 两条；清空检索后点击“下一页股票清单”使页面从第 1/69 页切换至第 2/69 页并显示 `000096.SZ` 起的新一批记录；在国家下拉中选择“加拿大 (672)”后，面板显示 **672 条**和 `AAB.TO`、`AAUC.TO` 等加拿大目录行。所有结果在终端内呈现，未通过跳转第三方页面获得目录内容。

上述验证证明用户报告的“0 条”是当前表为空叠加页面加载期将未知值显示为 0 的组合问题；前者已由冻结 SQL 分表导入恢复，后者已以最小状态文案修正。它不证明缺失 XLSX 工作簿所代表的 42 国完整覆盖，也不把目录条目当作实时行情。

旧 `globalEquityImport.test.ts` 与 `globalEquityCurrentUpload.test.ts` 仍可能因用户上传目录缺少原始 XLSX 工作簿而失败；其所期待的 42 份工作簿、48,756 条清单并不能由仅有 5,088 条的冻结 SQL 目录伪造替代。这是不同于本次“当前面板为 0 条”的原始资料缺失限制。

## 证据文件

| 文件 | 内容 |
|---|---|
| `audit/artifacts-equity-listing-import-preflight.json` | 冻结 INSERT、列序、索引与空表的只读预检 |
| `audit/artifacts-equity-listing-import-result.json` | 事务性导入的行数与国家数结果 |
| `audit/artifacts-equity-listing-trpc-response.json` | 导入后既有 tRPC 分页与国家目录响应 |
