export type TerminalCapability = {
  id: string;
  code: string;
  name: string;
  responsibility: string;
  sourceProfile: "market" | "filing" | "account" | "official" | "licensed";
};

export const STOCK_CAPABILITIES = [
  { id: "wei", code: "WEI", name: "全球股票指数", responsibility: "全球股票指数、区域基准和市场状态", sourceProfile: "official" },
  { id: "ftw", code: "FTW", name: "关注因子", responsibility: "账户关注因子、观察列表和触发条件", sourceProfile: "account" },
  { id: "imap", code: "IMAP", name: "日内市场图", responsibility: "日内价格、成交量和市场微观结构", sourceProfile: "market" },
  { id: "evts", code: "EVTS", name: "大事日历", responsibility: "公司事件、财报日程和公告时点", sourceProfile: "filing" },
  { id: "top", code: "TOP", name: "要闻精选", responsibility: "经过指纹去重的市场要闻和权威披露", sourceProfile: "filing" },
  { id: "tren", code: "TREN", name: "新闻趋势", responsibility: "新闻主题强度、来源分布和事件演变", sourceProfile: "filing" },
  { id: "8", code: "", name: "Top-Down分析", responsibility: "宏观、区域、行业到证券的自上而下传导", sourceProfile: "official" },
  { id: "eqs", code: "EQS", name: "股票筛选", responsibility: "多字段证券筛选、排序和候选集审计", sourceProfile: "market" },
  { id: "eqbt", code: "EQBT", name: "股票回溯测试", responsibility: "策略历史路径、交易成本和回撤复算", sourceProfile: "market" },
  { id: "ds", code: "DS", name: "文件检索", responsibility: "申报文件全文、版本和证据定位", sourceProfile: "filing" },
  { id: "bi-stox", code: "BI STOX", name: "彭博行业研究", responsibility: "行业结构、同业经营事实和横截面对比", sourceProfile: "filing" },
  { id: "res", code: "RES", name: "研究报告主页", responsibility: "研究文档、观点、证据和修订工作流", sourceProfile: "account" },
  { id: "in", code: "IN", name: "彭博指数浏览器", responsibility: "指数成分、权重、贡献和再平衡", sourceProfile: "official" },
  { id: "15", code: "", name: "投资组合管理与风险", responsibility: "投资组合持仓、限制、收益和总体风险", sourceProfile: "account" },
  { id: "tlts", code: "TLTS", name: "风险暴露倾向", responsibility: "组合行业、风格、因子和地区暴露", sourceProfile: "account" },
  { id: "port", code: "PORT", name: "投资组合与风险分析", responsibility: "组合归因、集中度、VaR 和压力测试", sourceProfile: "account" },
  { id: "18", code: "", name: "分析 IBM US Equity", responsibility: "单一股票报价、财务、估值和事件联动", sourceProfile: "market" },
  { id: "19", code: "", name: "股票衍生品", responsibility: "股票期权条款、波动率、Greeks 和情景", sourceProfile: "licensed" },
  { id: "moso", code: "MOSO", name: "交易最活跃期权", responsibility: "期权链成交、持仓和流动性活跃度", sourceProfile: "licensed" },
  { id: "21", code: "", name: "基金", responsibility: "基金身份、净值、持仓和风险暴露", sourceProfile: "market" },
  { id: "etf", code: "ETF", name: "交易型开放式指数基金", responsibility: "ETF 价格、净值、溢折价和跟踪差异", sourceProfile: "market" },
  { id: "fsrc", code: "FSRC", name: "基金筛选", responsibility: "基金分类、费用、表现和风险筛选", sourceProfile: "official" },
  { id: "pe", code: "PE", name: "私募股权概览", responsibility: "私募基金授权资料、估值口径和报告期", sourceProfile: "licensed" },
  { id: "25", code: "", name: "股票交易", responsibility: "股票订单录入、风险校验和状态生命周期", sourceProfile: "account" },
  { id: "emsx", code: "EMSX", name: "执行管理系统", responsibility: "订单路由、成交、拒单和执行审计", sourceProfile: "licensed" },
  { id: "27", code: "", name: "资本市场活动", responsibility: "股票发行、融资和资本结构事件", sourceProfile: "filing" },
  { id: "cact", code: "CACT", name: "公司大事检索", responsibility: "分红、回购、拆并股和公司行动检索", sourceProfile: "filing" },
  { id: "ma", code: "MA", name: "兼并与收购", responsibility: "并购参与方、关键日期、文件和交易状态", sourceProfile: "filing" },
  { id: "ipo", code: "IPO", name: "股票发行", responsibility: "IPO 申报版本、发行区间和时间线", sourceProfile: "filing" },
  { id: "31", code: "", name: "客户管理解决方案", responsibility: "客户覆盖、研究交付和权限审计", sourceProfile: "account" },
  { id: "32", code: "", name: "因子研究与量化策略", responsibility: "因子定义、组合构建、归因和策略检验", sourceProfile: "official" },
  { id: "factorlab", code: "FACTOR LAB", name: "全球因子研究实验室", responsibility: "全球因子回归、稳定性和模型版本", sourceProfile: "official" },
  { id: "cockpit", code: "COCKPIT", name: "股票智能驾驶舱", responsibility: "股票行情、研究、期权和预警联动工作区", sourceProfile: "account" },
] as const satisfies readonly TerminalCapability[];

export const PREFERRED_STOCK_CAPABILITIES = [
  { id: "secf", code: "SECF", name: "智能证券查找器", responsibility: "多字段证券筛选、事件预警和证据追溯", sourceProfile: "filing" },
  { id: "psch", code: "PSCH", name: "深度检索与条款解析", responsibility: "发行文件检索、条款抽取和逐字段复核", sourceProfile: "filing" },
  { id: "wb", code: "WB", name: "全球债券与宏观联动", responsibility: "利率、信用、资金流和宏观环境联动", sourceProfile: "official" },
  { id: "wei", code: "WEI", name: "全球股票与行业轮动", responsibility: "股债联动、行业轮动和波动传导", sourceProfile: "market" },
  { id: "fit", code: "FIT", name: "智能固定收益交易", responsibility: "订单路由、执行成本和成交复核", sourceProfile: "licensed" },
  { id: "qfm", code: "QFM", name: "量化因子模型", responsibility: "优先股因子、IC、IR 和拥挤度", sourceProfile: "account" },
  { id: "eds", code: "EDS", name: "事件驱动策略引擎", responsibility: "事件识别、冲击量化和反事实分析", sourceProfile: "filing" },
  { id: "cma", code: "CMA", name: "跨市场联动与套利", responsibility: "股债联动、可转换和统计套利输入", sourceProfile: "market" },
  { id: "por", code: "POR", name: "组合优化与风险预算", responsibility: "组合约束、风险预算和动态再平衡", sourceProfile: "account" },
  { id: "aide", code: "AIDE", name: "AI决策引擎", responsibility: "多模型研究、预测审计和决策解释", sourceProfile: "account" },
  { id: "viz", code: "VIZ", name: "高级可视化与交互", responsibility: "因果图谱、风险曲面和联动可视化", sourceProfile: "account" },
  { id: "pord", code: "PORD", name: "组合优化深度扩展", responsibility: "多目标、尾部风险和成本约束优化", sourceProfile: "account" },
  { id: "rpa", code: "RPA", name: "风险归因与绩效分析", responsibility: "多因子风险归因、绩效归因和监控", sourceProfile: "account" },
  { id: "aid", code: "AID", name: "AI投顾深度扩展", responsibility: "可解释模型、训练治理和个性化研究", sourceProfile: "account" },
  { id: "dat", code: "DAT", name: "数据层架构", responsibility: "多源接入、标准化、去重和质量追踪", sourceProfile: "licensed" },
  { id: "mdl", code: "MDL", name: "模型层架构", responsibility: "模型注册、版本、校准和运行监控", sourceProfile: "official" },
  { id: "app", code: "APP", name: "应用层架构", responsibility: "功能服务、接口、实时通信和状态管理", sourceProfile: "account" },
  { id: "inf", code: "INF", name: "基础设施层", responsibility: "计算、存储、安全、容灾和可用性", sourceProfile: "licensed" },
  { id: "prc", code: "PRC", name: "优先股定价模型", responsibility: "现金流估值、隐含参数、Greeks 和情景", sourceProfile: "account" },
  { id: "crd", code: "CRD", name: "优先股信用分析", responsibility: "主体信用、资本结构、评级和压力测试", sourceProfile: "licensed" },
  { id: "liq", code: "LIQ", name: "流动性深度分析", responsibility: "价差、深度、成交和冲击成本", sourceProfile: "licensed" },
  { id: "case", code: "CASE", name: "实战策略与案例", responsibility: "可重放案例、决策过程和绩效归因", sourceProfile: "account" },
  { id: "sop", code: "SOP", name: "投资操作指南", responsibility: "筛选、研究、执行、监控和复盘流程", sourceProfile: "account" },
] as const satisfies readonly TerminalCapability[];

export const INDUSTRY_GROUP_CAPABILITIES = [
  { id: "CLASS", code: "BLAW", name: "彭博法律网络平台", responsibility: "法律资料入口、权限和检索范围", sourceProfile: "account" },
  { id: "MEMBERS", code: "BTAX", name: "彭博税务", responsibility: "税务主题、司法辖区和法规资料", sourceProfile: "account" },
  { id: "QUOTES", code: "BGOV", name: "彭博政府", responsibility: "政府政策、机构和公共记录", sourceProfile: "licensed" },
  { id: "RETURNS", code: "INDG", name: "彭博行业分组", responsibility: "行业分类、成分和分组版本", sourceProfile: "market" },
  { id: "VOLUME", code: "CL", name: "公司诉讼", responsibility: "公司诉讼案件、参与方和关键日期", sourceProfile: "market" },
  { id: "FLOW", code: "BCY", name: "破产控制面板", responsibility: "破产案件、债权结构和程序状态", sourceProfile: "licensed" },
  { id: "BREADTH", code: "DCKM", name: "案卷管理", responsibility: "案卷日程、文书和任务追踪", sourceProfile: "market" },
  { id: "VALUATION", code: "BBLS", name: "法律文档检索", responsibility: "法律文件全文、引用和证据定位", sourceProfile: "account" },
  { id: "EARNINGS", code: "BLSS", name: "已保存法律检索", responsibility: "已保存检索、条件版本和结果变更", sourceProfile: "account" },
  { id: "FORECAST", code: "BLDA", name: "法律文件提醒", responsibility: "法律文件变化、提醒规则和送达记录", sourceProfile: "licensed" },
  { id: "REVENUE", code: "BIP", name: "BI概况：诉讼", responsibility: "诉讼主题研究、案件统计和证据", sourceProfile: "account" },
  { id: "PROFIT", code: "TOP LAW", name: "要闻：法律", responsibility: "法律要闻去重、来源和事件聚合", sourceProfile: "account" },
  { id: "BALANCE", code: "HELP", name: "BLAW相关信息", responsibility: "法律平台帮助、资料范围和使用说明", sourceProfile: "account" },
  { id: "CASHFLOW", code: "PRAC", name: "BLAW实践领域", responsibility: "法律实践领域、主题和专家资料", sourceProfile: "account" },
  { id: "CAPEX", code: "BILL", name: "美国政府立法", responsibility: "法案文本、进度、表决和版本", sourceProfile: "account" },
  { id: "DIVIDEND", code: "SPEN", name: "美国政府支出", responsibility: "政府支出、机构、项目和期间", sourceProfile: "account" },
  { id: "VOLATILITY", code: "BGS", name: "联邦合约", responsibility: "联邦合约、承包商、金额和履约期", sourceProfile: "market" },
  { id: "CORRELATION", code: "BI BUDG", name: "美国联邦预算", responsibility: "预算科目、预测、执行和差异", sourceProfile: "market" },
  { id: "ROTATION", code: "BIP", name: "BI入门指南：国债", responsibility: "国债政策资料、发行和市场背景", sourceProfile: "market" },
  { id: "CONTRIBUTION", code: "NH BGV", name: "新闻标题", responsibility: "政府新闻标题、来源和去重事件", sourceProfile: "account" },
  { id: "CYCLE", code: "GNR", name: "法律和政府分析", responsibility: "法律政策、政府事件和影响研究", sourceProfile: "official" },
  { id: "STRESS", code: "MAP VOTE", name: "自设地图：选举", responsibility: "选举区域、候选人、结果和地图图层", sourceProfile: "account" },
] as const satisfies readonly TerminalCapability[];

export function assertThreeModuleCatalogs() {
  const groups = [STOCK_CAPABILITIES, PREFERRED_STOCK_CAPABILITIES, INDUSTRY_GROUP_CAPABILITIES] as const;
  const expected = [33, 23, 22];
  groups.forEach((group, index) => {
    if (group.length !== expected[index]) throw new Error(`CAPABILITY_COUNT_${index}`);
    if (new Set(group.map(item => item.id)).size !== group.length) throw new Error(`CAPABILITY_ID_DUPLICATE_${index}`);
    if (new Set(group.map(item => item.responsibility)).size !== group.length) throw new Error(`CAPABILITY_RESPONSIBILITY_DUPLICATE_${index}`);
  });
  return true;
}

