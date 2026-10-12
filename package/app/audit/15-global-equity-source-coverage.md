# 全球股票目录完整覆盖来源盘点

为响应“完整导入”要求，本轮重新枚举用户冻结资料中的所有可疑目录来源。盘点覆盖只读外层证据目录、原上传 ZIP、三个嵌套 ZIP 与提取的 SQL 文件；没有执行资料，也没有将网络数据、测试期望或合成记录并入目录。

| 来源范围 | XLSX 数量 | `equity_listings` INSERT | 结论 |
|---|---:|---|---|
| 外层冻结证据目录 | 0 | 仅嵌套数据库基线 `finance_hub.sql` | 无额外工作簿可导入 |
| 用户原上传 ZIP | 0 | 不含额外 XLSX 成员 | 无额外工作簿可导入 |
| `_baseline_nested_source` 外部资产 ZIP | 0 | 不含 XLSX | 无额外目录来源 |
| `_baseline_archive` 完整交付 ZIP | 0 | 不含 XLSX | 无额外目录来源 |
| `original-upload` 嵌套恢复 ZIP | 0 | 不含 XLSX | 无额外目录来源 |
| 唯一数据库基线 INSERT | — | 5,088 条，SHA-256 `6c84ac2b18302ab7e8c2345b74e1fa7fa71f60eb0997ad447772aca8990c3dd0` | 已通过受限事务导入 |

因此，当前终端可严格依据用户冻结资料展示的全球股票目录上限是 **5,088 条、6 个国家/地区**。旧测试要求的 42 份 XLSX、48,756 条清单及 66 个跨来源重复边界没有随上传资料提供；这些数字不能作为构造新目录的依据。若用户后续提供原始工作簿，可按归档既有 `scripts/import_global_equity_listings.mjs` 的来源工作表映射、内容哈希和同国同代码冲突拒绝规则进行单独审计导入。

> 当前“5,088 条”是冻结 SQL 中可验证的目录覆盖，不是全球市场的完整证券总表，也不等同于实时上市、可交易资格或授权行情覆盖。

证据文件：`audit/artifacts-equity-listing-extracted-xlsx.txt`、`audit/artifacts-equity-listing-sql-sources.txt`、`audit/artifacts-equity-listing-upload-xlsx-members.txt` 与 `audit/artifacts-equity-listing-nested-zip-xlsx-counts.tsv`。

## 用户补充工作簿后的完整可验证覆盖

用户随后补充了上传目录内可见的 46 份 XLSX。归档既有解析器在只读 dry-run 中识别 102 个候选工作表，按内容 SHA-256 去重为 42 个独立来源工作表，得到 48,822 条有效源行、48,756 条按 `(country_code, symbol)` 去重后的目录记录和 66 条同名重复行。只读合并预检与当前 5,088 条 SQL 基线比较后，得出 43,668 条新增、5,088 条名称完全相同的既有记录、0 条名称冲突，因此允许仅新增导入。

专用事务脚本 `audit/scripts/import_uploaded_equity_listing_new_rows.mjs` 只插入预检后的新增记录，保留 5,088 条 SQL 基线行，不使用 `ON DUPLICATE KEY UPDATE` 覆盖既有来源字段。事务后精确计数为 **48,756 条**，覆盖 40 个国家/地区代码；导入结果与按国家计数见 `audit/artifacts-uploaded-global-equity-import-result.json`。

通过终端既有深链 `/terminal?module=stocks&open=wei&country=IN&symbol=RELIANCE.NS` 的真实浏览会话进一步验证：WEI 面板显示印度 **8,170 条**与第 1/164 页，列出 `20MICRONS.NS`、`500002.BO` 等来自上传工作簿的目录行；覆盖范围工作台显示 **48,756 条真实导入记录**及 40 个国家/地区筛选项。目录仍只表示来源工作簿中的代码、名称、国家和交易所；它不构成实时价格、上市有效性或可交易资格证明。

## 逐文件与代表性交互核验

逐文件产物 `audit/artifacts-uploaded-global-equity-per-file-audit.json` 已记录全部 **46** 份可见 XLSX 的文件 SHA-256、字节数、工作表名、首行表头、归档字段映射、有效行、拒绝行及其原因、内容 SHA-256 与内容去重后的选取状态。归档契约固定使用首个工作表行作为表头、列 0 作为 `symbol`、列 1 作为 `name`。其中 42 个独立内容来源被选取，另有两个识别到的别名表与已选来源内容 SHA-256 完全一致，因而不重复导入。

| 未映射文件/工作表 | 审查结论 | 导入处置 |
|---|---|---|
| `菲律宾股票.xlsx` / `菲律宾股票` | 386 条两列目录的内容 SHA-256 与 `菲律宾股票_3.xlsx` / `菲律宾股票_3` 完全一致 | 已由已映射来源覆盖，不重复插入 |
| `以色列股票_1.xlsx` / `以色列股票_1` | 527 条两列目录的内容 SHA-256 与既有映射的 `以色列股票` 内容完全一致 | 已由已映射来源覆盖，不重复插入 |
| `grid_x4ojopb2.xlsx` / `FIW Data` | 不是两列证券目录；首行含债券/利差字段，无法按归档股票契约推断国家与代码/名称列 | 不纳入股票目录 |
| `sheet1.xlsx` / `sheet1` | 仅一条物理数据行且无法按归档映射识别国家或有效两列证券目录 | 不纳入股票目录 |

代表性交互矩阵已经覆盖：WEI 中国国家筛选的 3,443 条、名称“平安”检索的两条结果、第二页分页、加拿大 672 条筛选（`audit/14-global-equity-listing-restoration.md`）；随后验证新上传来源中的印度 8,170 条、首批 NSE/BSE 代码和 1/164 页；覆盖范围工作台展示 48,756 条总数、40 个国家筛选项以及每行来源文件/工作表/行号。定向测试 `equityListingsBaselineRestore`、`globalEquityImport`、`globalEquityCurrentUpload` 与 `globalEquityCoverageDesk` 共 7/7 通过。

最终生产构建、客户端类型检查和服务端类型检查均通过；完整 Vitest 为 214/226 文件、740/756 用例通过。用户补充工作簿使原有全球目录导入用例转为通过，整体遗留失败从 14 个文件/19 个用例降至 12 个文件/16 个用例；详见 `audit/05-validation-status.md`。

## 目录来源溯源详情验收

在保持原 WEI 面板可见且不改变其字段、图表或菜单位置的前提下，覆盖范围工作台新增了目录来源溯源选择流程。通过 `/terminal?module=stocks&open=wei` 加载 48,756 条导入目录后，实际选择首条 `AE / 2POINTZERO.AD / Two Point Zero` 记录，终端内详情回显 `阿联酋证券市场`、`阿联酋全部股票.xlsx`、`阿联酋全部股票` 和原始行号 `2`。该动作不触发行情、新闻、公司基本面或第三方页面请求；其唯一输出是用户上传工作簿已导入字段的可审计来源链。

新增静态契约 `server/globalEquityCoverageDesk.test.ts` 在原有目录接口和追加层断言之外，覆盖可访问的鼠标/键盘选择路径、来源文件/工作表/行号字段以及筛选变更时清空选择状态。专项测试当前为 3/3 通过，客户端类型检查也通过。
