# 六个区域重复后置层删除记录

用户明确要求删除重复，而不是把同一套研究/生命周期工作台换名后继续叠加。本次仅撤回恢复工作区之后追加的统一研究层、生命周期层、档案层、趋势层、隔离预览与按入口专属扩展；**ZIP 原页面、原菜单、原数据工具与原接口未删除**。

| 区域 | 保留内容 | 已撤回的重复追加内容 |
| --- | --- | --- |
| 定价与风险 | `PricingRisk` 原页面 | `ValuationAutomationLayer` |
| 投资组合与风险 | `PortfolioRiskPreservedModule` 的 `children` 原工作区 | `PortfolioRiskDistinctExtension`、档案、趋势、研究层与隔离预览 |
| 指数 | 原 `IndexHub`、事件归档、账户协作、官方权重导入 | `IndexDistinctExtension`、统一提示横幅与研究跳转 |
| 交易委托簿 | `OrderManagement` 原页面 | `OrderManagementResearchLayer`、`OrderManagementDistinctExtension` |
| 电子交易 | `ElectronicTrading` 原页面 | 执行质量研究层、数据列表体验层、专属扩展 |
| STP | `STPProcessing` 原页面 | 私有研究层、时间线层、专属扩展 |
| 交易账簿 | `TradeBook` 原页面 | 私有研究层、专属扩展 |

`server/exposedExtensionRemoval.test.ts` 已验证六个区域不再挂载上述重复层，结果为 **6/6 通过**。桌面抽样覆盖交易委托簿 AIM、电子交易 FIT、STP RESD、交易账簿 STOCK、指数 SECF 与定价风险原页面；截图中原工作区仍在，重复追加层不再出现。

> 本记录不代表全站功能验收。外部数据、逐菜单、逐入口、全设备与接口运行时验收继续保持在总 TODO 中。
