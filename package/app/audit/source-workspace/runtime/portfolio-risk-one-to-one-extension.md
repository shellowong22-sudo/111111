# 投资组合与风险一对一扩展恢复记录

## 已替换的重复层

`PortfolioRiskPreservedModule` 仍先渲染 `data-preserved-portfolio-workspace="true"` 内的 ZIP 原工作区，随后挂载新的 `PortfolioRiskDistinctExtension`。原先每个入口追加的 `PortfolioRiskResearchLayer`（“投资组合与风险 · 24 模块研究导航”）已不再挂载；原文件保留在工作区中作为历史恢复证据，未被改写。

## 一对一实现范围

新分派器覆盖原面板的 24 个 tab。组合管理、基准管理、综合分析、持仓分析、跟踪误差、历史 VaR、情景冲击、特征聚合和回撤分别使用再平衡草案、偏离瀑布、集中度、配对收益散点、分位风险直方图、冲击网格、加权计算和回撤轨迹。日内业绩、字段展示、归因、交易模拟、优化、新闻、事件、报告、合规、预警、决策报告、审计、系统集成和债券风险分别使用独立台账、列预览、桥接残差、换手试算、约束诊断、来源队列、倒计时、清单、阈值仪表、比较/会话时间线、端点语法预检及已有账户私有风险档案。

所有会话内计算都明确以用户输入为来源；连接、行情、订单、通知和外部抓取未实现时均显示未启用或不执行，不生成伪数据或伪操作。债券档案和趋势面板仅在其原本适用的风险 tab 中继续显示，且保持已有登录、账户快照与服务端保存边界。

## 验证

`pnpm exec esbuild client/src/components/portfolio/PortfolioRiskDistinctExtension.tsx --jsx=automatic --format=esm` 通过；保留包装器的目标语法编译通过。`server/portfolioRiskDistinctExtension.test.ts` 通过 3/3：确认 ZIP 原工作区仍隔离、统一研究导航不再挂载、24 个原 tab 有明确映射、各区域包含不同的结果交互和不伪造网络/交易行为的边界。页面级视觉验收仍待用户在终端中逐 tab 确认。

后续拆分已将原先仍共用骨架的 PORT HD、NL、DRPT、AUDT、PREP、MIFI、SYS 和 BOND RISK 直接分派为 `HoldingInventory`、`NewsQueue`、`DecisionMatrix`、`SessionAudit`、`ReportBoard`、`ComplianceEvidence`、`SystemIntegrity` 和 `BondReadiness`。逐 tab 的组件、输入、结果和不可用边界见 `audit/runtime/portfolio-risk-24-tab-mapping.tsv`；强化回归测试现为 4/4 通过。

页面级抽样验收已通过隔离预览路由完成：PRTU 显示权重再平衡条形图与 CSV 导出；PORT VR 显示置信度、分位损失、尾部均值与直方图；PORT PA 显示归因桥接残差；NL 显示来源待核验队列；MIFI 显示证据状态表；BOND RISK 显示输入就绪度及无伪计算按钮。六个页面均未显示旧“24 模块研究导航”，文字可见、模块不重叠。预览路由仅用于恢复验收，仍不替换原终端工作区；余下 18 个 tab 的页面级抽样与全部交互验收仍待执行。

随后已用同一隔离预览路由加载其余 18 个 tab，累计 24/24 均可渲染；统一研究导航未出现，专属标题、输入区域和结果面板均可见。页面级验收发现的空输入控件边界不足已通过限定在 `data-portfolio-risk-extension` 内的样式规则修复，并复核 PORT PA、PORT TS、PORT OP、EVTS、ALRT、BBU、AUDT、INTG：空输入框、日期占位符和预警/比较结果均可辨识。尚未把这项工作标记为完整交互验收，因为保存、导出、切换、输入后重算等逐一点击路径仍需后续专门执行。

移动视口（375×812）复核已覆盖 PRTU、PORT VR 与 INTG：权重条、置信度滑杆/直方图、输入框和连接预检结果均完整显示，没有横向遮挡；隔离预览提示与各模块边界文本在窄屏仍可阅读。

组件级真实交互测试 `server/portfolioRiskDistinctExtension.interaction.test.tsx` 已通过 3/3：修改 PRTU 的用户输入会重算并显示正负偏离；修改 PORT OP 的上下限、目标和总权重会显示“输入约束冲突”；向 NL 填入 HTTPS 链接与标题并点击“进入待核验队列”会生成用户提供来源和“待人工核验”状态。该验证不把未测路径标记为通过，剩余模块的逐一点击验收继续保留在 TODO。

交互测试现扩展为 5/5：PORT VR 的置信度滑杆会更新可见置信度状态；PORT PA 的期初、市场、交易、费用和期末输入会即时计算并显示桥接残差。其余未覆盖模块仍未被声称为已完成点击验收。
