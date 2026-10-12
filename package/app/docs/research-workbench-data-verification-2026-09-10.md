# 优先股 / 股市工作台：后端数据核验

日期：2026-09-10。范围仅为两个研究环境接口、FRED 解析、现有内容推送接线；不是全产品或浏览器验收结论。

## 本轮修复

| 问题 | 修复及边界 |
| --- | --- |
| 将 CSV 最后一行当作最新观察，乱序时最新值/涨跌错误 | 两个路由共用 `server/fredObservationParser.ts`；按有效观察日期升序排列后再取最新/前值。 |
| 同日多行导致重复历史点、涨跌比较自身 | 每个日期只保留一个点；相同值计为重复、最后有效不同值计为来源修订；提供质量计数。 |
| 空格被 `Number()` 转为零 | 空白、点号及明确缺失标识只计缺失，不产生数据点，不覆盖同日已有有效观察。 |
| 非日期、未来日期、错列、HTML 错误页可被错误接收 | 校验真实日历日期、当前日期上界、目标序列列名及有限十进制数字；不匹配时保持空数据。 |
| 抓取时间容易与市场观察时间混淆 | 保留 `observationDate`，响应增加 `retrievedAt`、`observationMode: historical`、`refreshAfterMs: 30000`；系列明确 `realtime: false`、`frequency: daily`、来源、单位及统一 `fred:<ID>`。 |

历史保留最近 180 个真实观察；缺失日不补零，不插值，不合成价格。质量计数针对本次读取的完整原始文件，缺失数包括非交易日，不能将它直接称为近 180 点缺失率。

## 已运行验证

执行：`pnpm exec vitest run server/researchEnvironmentDataQuality.test.ts server/routers/preferredStockResearch.test.ts server/routers/stockMarketResearch.test.ts`。

结果：3 套、15 项通过。新测试包括真实路由处理函数调用、受控源响应和时间：并发读取合并、30 秒缓存、缓存到期重取、新旧值变更、全源失败不保留伪成功、部分源恢复。测试中的人为响应仅存在于测试文件，不进入生产数据链路。

执行：`pnpm run check:server`；结果：通过。

另执行现有 `server/adminModulePublicFeed.ack.test.ts`，4 项通过：未认证回执拒绝、未知内容不计成功、ACK 幂等且不改来源时间、多目标仅部分确认时不误报全部成功。该套使用隔离数据库测试替身，不是本轮浏览器端到端 ACK 证据。

随后直接运行两个修改后路由，从 FRED 官方 CSV 读取（此步骤未替换 fetch，也未使用测试数据）。以下是实际输出摘要；它不表示监听 4173 的服务已重新构建部署，也不代表浏览器已操作。

| 路由 / 序列 | 最近观察日 | 本次读取值 | 单位 | 历史点 |
| --- | --- | ---: | --- | ---: |
| preferredStockResearch / DGS2 | 2026-09-08 | 4.39 | % | 180 |
| preferredStockResearch / DGS5 | 2026-09-08 | 4.57 | % | 180 |
| preferredStockResearch / DGS10 | 2026-09-08 | 4.80 | % | 180 |
| preferredStockResearch / DGS30 | 2026-09-08 | 5.25 | % | 180 |
| preferredStockResearch / BAMLC0A0CM | 2026-09-08 | 0.81 | % | 180 |
| preferredStockResearch / BAMLC0A4CBBB | 2026-09-08 | 0.99 | % | 180 |
| preferredStockResearch / BAMLH0A0HYM2 | 2026-09-08 | 2.67 | % | 180 |
| stockMarketResearch / SP500 | 2026-09-09 | 7636.36 | 指数点 | 180 |
| stockMarketResearch / VIXCLS | 2026-09-08 | 15.72 | % | 180 |
| stockMarketResearch / DGS10 | 2026-09-08 | 4.80 | % | 180 |
| stockMarketResearch / BAMLH0A0HYM2 | 2026-09-08 | 2.67 | % | 180 |

优先股抓取完成时间 `2026-09-10T03:35:35.308Z`；股市抓取完成时间 `2026-09-10T03:35:34.841Z`。两个响应 `sourceStatus: available`。各序列日期严格递增，无重复观察日；本次拒绝行、重复行及同日修订行计数均为零。

注意：这些是官方历史观察，不是优先股个券 Bid/Ask、订单簿、逐笔成交，也不构成全球盘中行情授权。

## 内容推送与图表数据更新的明确区别

检查证据：

- `server/uploadAndSse.ts` 的 `/api/terminal/content-stream` 发送来源内容记录，并每两秒检查内容签名。
- `client/src/hooks/useModuleLiveFeed.ts` 接收内容记录，去重，在 React 提交后发送内容 ACK；fallback 查询每 15 秒刷新。
- `server/routers/adminDataModules.ts` 的 `acknowledgeFeeds` 为认证接口；`server/adminModulePublicFeed.ts` 依据真实内容键和目标更新回执，不能把匿名访客或未知内容直接计为成功。
- 检查时，优先股和股市研究环境查询未接入上述内容 hook，也不存在使这两个查询失效/刷新的内容流处理。内容 ACK **不能证明** 环境时间序列已接收、已应用或已确认。
- 检查时，多个研究查询只设置 `staleTime: 30000`；这不是轮询，且部分关闭焦点刷新。客户端工作台的刷新/离线状态由主任务另行修改和浏览器验收。

本报告不声称后台已完成图表数据精准推送，不声称多浏览器/多用户/离线恢复已经在优先股与股市完成端到端验收；这些仍需真实工作台与管理后台联调证据。

## 研究刷新信号适配（现有 SSE）

没有新增后台页面、路由或第二套传输。现有 `content-stream` 现在同时携带按页面解析后的最近来源刷新信号（仅 `status/refreshedAt`，不携带后台 ID、管理说明、行情或图表值），并用事件签名避免无变化重复发送。`useModuleLiveFeed` 收到匹配 `stock` / `preferred` / `equity` 页面刷新信号时，仅使 `stockMarketResearch.getEnvironment` 与 `preferredStockResearch.getMarketEnvironment` 的 typed query 失效，随后由原查询重新读取其已验证来源；推送内容不会直接写入研究状态。

新增 `server/researchRefreshDelivery.test.ts`，3 项契约测试通过；与本轮数据测试合计 21 项通过，`pnpm run check` 通过。该适配的有效范围是已挂载 `useModuleLiveFeed` 的页面；若某个研究工作台未挂载该 hook，它仍需由主任务在现有布局生命周期中接入，不能由本适配虚称已刷新。内容 SSE 仍不等同于图表 payload 推送，前端 ACK 仍只确认内容记录渲染。

## 修改文件

- `server/fredObservationParser.ts`：统一解析和质量计数。
- `server/routers/preferredStockResearch.ts`：优先股环境接入统一解析及真实历史元数据。
- `server/routers/stockMarketResearch.ts`：股市环境接入统一解析及真实历史元数据。
- `server/researchEnvironmentDataQuality.test.ts`：12 项新增回归测试。

未修改客户端、浏览器、账号权限、密钥、外部服务配置或数据许可证。

## 浏览器反馈后的 XBRL 报告期修复

主任务实际打开 RES 后发现：同一结束日的年度/季度值缺少起始日，两种收入口径同名，默认选中只到 2018 年的 `Revenues`。据此仅修改 `stockMarketResearch.getCompanyFacts` 数据规范化：

- 保留 `start/end`、`durationDays`、`form`、`filed/filingDate`、`accessionNumber/accn`、`fy/fp/frame`。
- 根据真实持续天数标识季度、半年、九个月、年度；时点指标单独标识。`fy/fp` 不用于猜测观察期间。
- `id` 区分每个来源事实和申报版本；`periodId` 关联同一指标和真实起止期间。精确重复才合并，不按结束日删除不同期间或修订。
- 每指标保留最近 120 条证据（原为 8 条），并报告总数与截断数；不同收入标签明确区分，指标按最近观察日降序。

新增 `server/routers/stockCompanyFacts.test.ts`：6 项测试通过；连同数据解析回归共 3 套 19 项通过；再次执行服务端类型检查通过。

真实 SEC 读取：`2026-09-10T04:00:40.122Z`，CIK `0000320193`（Apple Inc.），来源状态 available。合同客户收入返回 117 条，最近观察 `2026-06-27` 并排在首项；旧 `Revenues` 返回 11 条，只到 `2018-09-29`，排在末项。净利润、资产、股东权益和稀释 EPS 各返回 120 条，所返回记录 ID 均唯一。

同一 `2026-06-27` 结束日的真实收入证据分别保留：`2025-09-28` 起的 273 天累计 `364357000000 USD`，以及 `2026-03-29` 起的 91 天单季 `109417000000 USD`。两者申报编号均为 `0000320193-26-000020`，但期间 ID 与事实 ID 不同。图表应按真实期间类型筛选后比较，不能直接把不同期间的数据当作同一口径连接。

## 2026-09-10 最终浏览器复核

- WB 工作台逐一点击时间序列、历史分布、变动热力图、期限曲线和盘口深度；`NOTFOUND` 筛选显示空状态；盘口深度仅显示授权行情未配置，不以 FRED 历史替代订单簿。
- RES 工作台显示市场环境矩阵、证券报价与历史、SEC 主体、报告期事实、申报与证据五个标签；输入 `AAPL` 返回 Apple Inc.，事实表实际显示起止日、持续天数、期间类型、单位、表单、申报编号和申报日期。
- 浏览器证据：`docs/workbench-evidence-2026-09-10/workbench-after.png`、`interaction-verification.json`。
- 工作区分栏在约 620px 容器保持并列，只有小于 560px 才垂直排列；来源不可用时显示明确状态。

## 推送刷新边界

后台复用既有 SSE 内容流发送去重后的刷新提示，前端只在 `available/partial` 且时间合法时重新读取已验证的 typed query；不会把 SSE 提示直接当行情或图表数据。前端 ACK 与刷新提示分离。当前仍需获得授权的逐档行情和外部实时数据许可证，不能据此声称盘口或全市场实时推送已完成。
