# 最小修复变更台账

工作副本相对归档工作区的以下最小修复均针对类型检查或可复现的确定性读取阻塞，不新增页面、路由、菜单、数据或对外跳转，亦不改写原有可见文案、布局或业务分支。`client/src/pages/ElectronicTrading.tsx` 当前已恢复为冻结归档原字节；该页面不再属于工作副本差异。

| 文件 | 原始阻塞 | 最小修复 | 运行时影响 |
|---|---|---|---|
| `server/routers/trading.ts` | 已故意标记为来源不可用的 `submitOrder` mutation 被推断为 `never`，使原页面内不可达成功回调访问返回字段时触发 8 个错误 | 仅为该 mutation 增加 `UnavailableOrderSubmissionSchema` 输出契约；原 mutation 仍直接抛出“来源不可用”错误 | 原电子交易页面保持冻结归档字节，仍展示来源不可用状态；未接入经纪商、账户、真实订单路由或模拟下单 |
| `client/src/components/YCURVEPanel.tsx` | 可选 `ticker` 被传给要求必填 ticker 的下游工具；可选索引与回调参数导致 4 个错误 | 在调用边界要求 ticker、为本地查询提供 `GCT` 兜底并补充回调参数类型 | 当前归档菜单数据中的 12 个项目均有 ticker；原有菜单文案、顺序、工具计算和空状态不变 |
| `server/electronicTradingResearchDb.ts` | 同一秒内连续保存的账户私有审计记录仅按 `createdAt DESC` 排序，数据库可返回不稳定的并列次序 | 在既有 `createdAt DESC` 后追加 `id DESC` 作为并列排序键 | 不改变账户隔离、审计记录、授权边界或导出内容；`electronicTradingResearchDb.test.ts` 定向 2/2 通过 |

2026-08-26 复核：工作副本与冻结归档中的 `ElectronicTrading.tsx` SHA-256 均为 `f048d41b351a74ff02b546dce2556d5f7f9958f5c2e7a5c88c15be7aa1184a1c`。当前 TypeScript 监视器在 2026-08-26 15:08 报告 `Found 0 errors`。日志中较早的 `xlsx` 缺失记录和本记录前的类型错误为历史错误，不能被解释为当前运行失败；后续完整类型检查、构建和测试仍须分别执行。
