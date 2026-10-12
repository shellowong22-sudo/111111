# 截图暴露与重复追加层审计

| 截图问题 | 挂载文件 | 待处理范围 | 必须保留 |
|---|---|---|---|
| EMSX Workflow 图表覆盖筛选器和表格 | `components/electronic-trading/WorkflowPanel.tsx` | 仅调整根容器、图表块与表格区的高度/收缩/滚动布局 | 原规则、执行列表、筛选器、审批会话状态和未授权外部交易边界。 |
| 定价与风险自动刷新曝光区 | `components/pricing/PricingRiskPreservedRoute.tsx` | 删除 `ValuationAutomationLayer` 的导入和单一挂载 | `PricingRisk` 原页面及其路由。 |
| 投资组合与风险扩展区 | `components/portfolio/PortfolioRiskPreservedModule.tsx` | 删除研究引导条及 `PortfolioRiskResearchLayer`、Dossier、Trend、Governance、OAS 追加挂载 | `children` 所承载的 24 个原模块和原导航。 |
| 经济数据重复区 | `components/econ/EconomicDataHubPreservedRoute.tsx` | 删除原页之后的官方日历、宏观观察台和字段目录追加挂载 | `children` 所承载的经济数据原页面。 |
| 新闻研究证据工作区 | `components/news/NewsPreservedModule.tsx` | 删除研究引导条及 `NewsResearchLayer` 挂载 | 原新闻研究工作区及其小视口滚动容器。 |
| 通讯/社区协作上下文 | `components/comms/CommsPreservedModule.tsx` | 删除协作引导条及 `CommsResearchLayer` 挂载 | 原通讯、社区、联系人和文件工作区。 |

以上删除仅移除后续追加的暴露层，不改动每个模块的原始菜单、标题、字段、顺序、路由或交互含义。
