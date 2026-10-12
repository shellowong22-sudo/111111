import { ADMIN_DATA_MODULES, type AdminDataModule } from './adminDataModules';

export const ADMIN_CRAWLER_STRATEGY_VERSION = 'crawler-v3.0';

export const ADMIN_CRAWLER_REWRITE_STYLES = ['source_faithful', 'plain_language', 'conversational', 'brief'] as const;
export type AdminCrawlerRewriteStyle = typeof ADMIN_CRAWLER_REWRITE_STYLES[number];

export type AdminCrawlerSourceType =
  | 'financial_news'
  | 'macro_finance'
  | 'security_master'
  | 'fundamental_value'
  | 'analyst_rating'
  | 'dragon_tiger'
  | 'filing_event'
  | 'market_event'
  | 'fund_flow'
  | 'derivatives_signal'
  | 'workflow_intelligence';

export type AdminCrawlerStrategy = {
  moduleId: string;
  moduleName: string;
  targetPath: string;
  strategyKey: string;
  promptKey: string;
  viewType: string;
  sourceType: AdminCrawlerSourceType;
  focus: string;
  queryTerms: string[];
  transformationVersion: string;
  contentLabel: string;
  contentDescription: string;
  targetLabel: string;
  assetCoverage: string[];
  processingSteps: string[];
};

export const ADMIN_CRAWLER_CAPABILITY_CATALOG = [
  { key: 'global_news', label: '全球新闻', description: '全球公开新闻、突发事件、区域风险与跨市场影响' },
  { key: 'company_news', label: '企业新闻', description: '上市公司公告、经营动态、并购、管理层与产业链事件' },
  { key: 'macro_finance', label: '宏观与央行', description: '利率、通胀、就业、财政、央行会议与政策路径' },
  { key: 'equity_universe', label: '全球股票与企业', description: '全球股票代码、企业名称、国家、交易所与上市地映射' },
  { key: 'fundamental_value', label: '价值投资', description: '财务质量、估值、现金流、盈利能力与长期基本面线索' },
  { key: 'analyst_rating', label: '分析师评级', description: '评级变化、目标价方向、预期差与跨市场验证' },
  { key: 'dragon_tiger', label: '龙虎榜', description: '活跃席位、机构参与、买卖分歧与异常成交观察' },
  { key: 'fund_flow', label: '资金流向', description: '行业、区域、资产类别、机构与跨境资金分流线索' },
  { key: 'quantitative', label: '量化研究', description: '因子、异常、相关性、波动率、信号与回测输入整理' },
  { key: 'market_data', label: '全球行情数据', description: '股票、指数、外汇、商品、利率及多资产市场观察' },
  { key: 'fund_etf', label: '基金与 ETF', description: '基金、ETF、持仓、资产配置、主题与资金变化' },
  { key: 'fixed_income', label: '债券与信用', description: '国债、信用债、可转债、CDS、评级与期限结构' },
  { key: 'derivatives', label: '衍生品', description: '期货、期权、掉期、隐含波动率与期限价差' },
  { key: 'forex_commodity', label: '外汇与商品', description: '主要货币、贵金属、能源、农产品与跨资产联动' },
  { key: 'filings', label: '公告与财报', description: '企业财报、监管披露、重要公告和可追溯事件证据' },
  { key: 'risk_tools', label: '金融工具与风控', description: '定价、风险、组合、交易、订单及工作流辅助信息' },
  { key: 'ai_rewrite', label: 'AI 降重改写', description: '保留事实边界的标题与摘要降重、大白话、口语化和精简处理' },
  { key: 'auto_gap_scan', label: 'AI 自动缺失扫描', description: '按模块检查缺失、过期和来源不足，只更新需要补足的目标' },
] as const;

const SOURCE_DESCRIPTORS: Record<AdminCrawlerSourceType, { label: string; description: string; assets: string[] }> = {
  financial_news: { label: '全球财经新闻', description: '公开新闻、企业事件、市场主题与跨区域金融信息', assets: ['全球新闻', '企业', '行业', '政策事件'] },
  macro_finance: { label: '宏观财经数据', description: '宏观指标、央行政策、利率路径、通胀和经济周期', assets: ['宏观指标', '利率', '国债', '外汇'] },
  security_master: { label: '全球投资标的主数据', description: '股票、企业、交易所、国家及可投资标的基础信息', assets: ['股票', 'ETF', '基金', '指数'] },
  fundamental_value: { label: '价值投资与企业基本面', description: '财务质量、估值、现金流、持仓与长期价值线索', assets: ['企业', '股票', '基金', 'ETF'] },
  analyst_rating: { label: '分析师评级数据', description: '评级行动、预期变化、行业比较和信用观察', assets: ['股票', '企业', '债券', '行业'] },
  dragon_tiger: { label: '龙虎榜与异常成交', description: '活跃席位、机构参与、资金分歧和异常交易线索', assets: ['股票', '行业', '席位', '成交'] },
  filing_event: { label: '公告、财报与信用事件', description: '公司披露、监管事件、债券信用与偿付能力证据', assets: ['企业', '债券', '可转债', 'CDS'] },
  market_event: { label: '全球市场行情与事件', description: '指数、股票、外汇、商品、加密资产与市场联动', assets: ['指数', '股票', '外汇', '商品', '加密资产'] },
  fund_flow: { label: '资金流向与量化线索', description: '资金分流、配置变化、持仓集中度、量化异常和相对价值', assets: ['股票', '基金', 'ETF', '行业', '组合'] },
  derivatives_signal: { label: '衍生品与量化信号', description: '期货、期权、掉期、波动率、价差和风险信号', assets: ['期货', '期权', '掉期', '波动率'] },
  workflow_intelligence: { label: '金融工具与工作流数据', description: '交易、订单、通知、组合、风控和运营工作流信息', assets: ['交易工具', '订单', '组合', '风控'] },
};

const LENSES = ['事件影响', '估值变化', '资金行为', '风险传导', '期限结构', '相对价值', '情绪拐点', '供需变化', '政策映射', '跨市场验证', '异常监测', '证据强度'] as const;

type MortgageCrawlerPlaybook = {
  sourceType: AdminCrawlerSourceType;
  focus: string;
  queryTerms: string[];
  assets: string[];
  specialistStep: string;
};

const MORTGAGE_CRAWLER_PLAYBOOKS: Record<string, MortgageCrawlerPlaybook> = {
  'mortgage-01-info': { sourceType: 'security_master', focus: '机构抵押债字段字典、证券标识与定义版本', queryTerms: ['MBS data dictionary', 'security identifier', 'disclosure schema'], assets: ['字段字典', '证券标识', '版本记录'], specialistStep: '字段版本差异核对' },
  'mortgage-02-secf': { sourceType: 'security_master', focus: '抵押证券代码、机构、票息、期限与池号检索', queryTerms: ['agency MBS search', 'pool number', 'CUSIP mortgage'], assets: ['机构 MBS', '池号', 'CUSIP'], specialistStep: '检索实体消歧' },
  'mortgage-03-mtgs': { sourceType: 'security_master', focus: '贷款池特征筛选与候选证券淘汰原因', queryTerms: ['MBS pool factors', 'WAC WALA FICO LTV', 'pool screening'], assets: ['贷款池', '担保品字段', '筛选条件'], specialistStep: '筛选条件一致性验证' },
  'mortgage-04-mtgh': { sourceType: 'workflow_intelligence', focus: '抵押债工作流说明、使用边界与字段责任', queryTerms: ['MBS workflow documentation', 'market convention', 'field governance'], assets: ['功能说明', '数据责任', '操作边界'], specialistStep: '功能边界冲突检查' },
  'mortgage-05-new': { sourceType: 'filing_event', focus: '机构与非机构抵押债新发行披露及供给变化', queryTerms: ['MBS new issue', 'agency issuance', 'securitization offering'], assets: ['新发行', '发售文件', '供给计划'], specialistStep: '发行批次归并' },
  'mortgage-06-mcal': { sourceType: 'workflow_intelligence', focus: '抵押债结算、汇款、披露和支付事件日历', queryTerms: ['MBS settlement calendar', 'remittance date', 'distribution date'], assets: ['结算事件', '汇款日', '支付日'], specialistStep: '事件日期时区标准化' },
  'mortgage-07-imgr': { sourceType: 'market_event', focus: '许可库存、报价时效与可用规模状态', queryTerms: ['MBS inventory', 'dealer axes', 'quote validity'], assets: ['库存意向', '报价状态', '规模'], specialistStep: '报价与库存权限校验' },
  'mortgage-08-stsh': { sourceType: 'derivatives_signal', focus: 'IO、PO、PAC、Support 与浮动档结构条款', queryTerms: ['MBS tranche structure', 'IO PO PAC support', 'CMO waterfall'], assets: ['结构分层', '现金流规则', '触发条款'], specialistStep: '分层现金流规则解析' },
  'mortgage-09-market': { sourceType: 'macro_finance', focus: 'Freddie Mac PMMS 抵押利率水平、变化和历史区间', queryTerms: ['Freddie Mac PMMS', 'mortgage rate weekly', 'FRED MORTGAGE30US'], assets: ['抵押利率', '期限比较', '周度历史'], specialistStep: '观测日期与修订值核验' },
  'mortgage-10-tbpf': { sourceType: 'market_event', focus: 'TBA 月份价格、Dollar-roll 与交割期差异', queryTerms: ['TBA dollar roll', 'MBS settlement month', 'drop financing'], assets: ['TBA 月份', 'Dollar-roll', '交割条件'], specialistStep: '月份与结算约定对齐' },
  'mortgage-11-collateral': { sourceType: 'filing_event', focus: '抵押品质量、评级迁移与贷款表现披露', queryTerms: ['MBS collateral performance', 'rating migration', 'delinquency disclosure'], assets: ['担保品', '评级行动', '逾期表现'], specialistStep: '评级事件与抵押品快照配对' },
  'mortgage-12-bmmi': { sourceType: 'macro_finance', focus: '住房、利率、再融资和提前还款驱动联动', queryTerms: ['housing macro MBS', 'refinance index', 'prepayment driver'], assets: ['住房宏观', '再融资', '提前还款驱动'], specialistStep: '宏观发布日期对齐' },
  'mortgage-13-research': { sourceType: 'financial_news', focus: '抵押债新闻、政策纪要与机构研究长文', queryTerms: ['mortgage backed securities news', 'housing finance policy', 'MBS research'], assets: ['新闻长文', '研究报告', '政策纪要'], specialistStep: '事件与市场窗口交叉核验' },
  'mortgage-14-firs': { sourceType: 'filing_event', focus: 'Fannie、Freddie、Ginnie 与 FHFA 原始披露导航', queryTerms: ['Fannie Mae disclosure', 'Freddie Mac disclosure', 'Ginnie Mae disclosure', 'FHFA data'], assets: ['原始披露', '监管文件', '数据附件'], specialistStep: '原件链接与附件版本固定' },
  'mortgage-15-ni': { sourceType: 'filing_event', focus: 'RMBS、CMBS 与 CRT 结构融资发行管道', queryTerms: ['RMBS pipeline', 'CMBS securitization', 'credit risk transfer issuance'], assets: ['结构融资管道', '发行阶段', '承销进度'], specialistStep: '交易阶段状态识别' },
  'mortgage-16-gn455993': { sourceType: 'filing_event', focus: 'GN 455993 命名证券条款、池特征和证据链', queryTerms: ['GN 455993', 'Ginnie Mae pool disclosure', 'pool factor history'], assets: ['命名证券', '池级披露', '偿付历史'], specialistStep: '证券标识精确匹配' },
  'mortgage-17-des': { sourceType: 'security_master', focus: '抵押证券条款、现金流优先级和隐藏条件', queryTerms: ['MBS security description', 'prospectus terms', 'call prepayment provisions'], assets: ['证券条款', '现金流顺序', '风险条件'], specialistStep: '条款证据定位' },
  'mortgage-18-yt': { sourceType: 'derivatives_signal', focus: '收益率、久期、凸性与提前还款假设矩阵', queryTerms: ['MBS yield table', 'option adjusted duration', 'prepayment yield'], assets: ['收益率矩阵', '久期', '凸性'], specialistStep: '估值口径与假设绑定' },
  'mortgage-19-fibc': { sourceType: 'workflow_intelligence', focus: '抵押债透明计算输入、冲击路径与结果复核', queryTerms: ['MBS calculator', 'key rate DV01', 'prepayment scenario'], assets: ['计算输入', '情景冲击', '复核结果'], specialistStep: '公式输入输出复算' },
  'mortgage-20-q': { sourceType: 'market_event', focus: '参考报价、有效期、规模、结算与失效原因', queryTerms: ['MBS quote', 'dealer indication', 'price validity settlement'], assets: ['参考报价', '报价规模', '失效状态'], specialistStep: '参考价与可执行价隔离' },
  'mortgage-21-cmap': { sourceType: 'macro_finance', focus: 'FHFA 州级 HPI 与 CMBS 地域抵押物环境', queryTerms: ['FHFA state HPI', 'CMBS geography', 'commercial property region'], assets: ['州级 HPI', '地域风险', '抵押物环境'], specialistStep: '地域代码与季度序列拼接' },
  'mortgage-22-index': { sourceType: 'market_event', focus: '抵押债指数方法、成分、再平衡与跟踪差异', queryTerms: ['MBS index methodology', 'index constituents', 'rebalancing mortgage'], assets: ['指数方法', '成分权重', '再平衡'], specialistStep: '指数版本与生效日匹配' },
  'mortgage-23-mccn': { sourceType: 'market_event', focus: 'TBA 成交观察、量价异常与 VWAP 偏离', queryTerms: ['TBA market activity', 'MBS volume VWAP', 'TBA liquidity'], assets: ['TBA 活动', '成交量', '价格偏离'], specialistStep: '量价事件窗口聚合' },
  'mortgage-24-assets': { sourceType: 'fundamental_value', focus: 'Agency、Non-Agency、RMBS、CMBS 风险资本对比', queryTerms: ['MBS asset class comparison', 'agency non-agency', 'RMBS CMBS capital'], assets: ['资产类别', '资本占用', '风险特征'], specialistStep: '资产分类口径统一' },
  'mortgage-25-rmbs-cmbs': { sourceType: 'macro_finance', focus: '民用与商用抵押债的住房、商业地产传导差异', queryTerms: ['RMBS versus CMBS', 'housing commercial real estate', 'mortgage transmission'], assets: ['RMBS', 'CMBS', '宏观传导'], specialistStep: '民用与商用证据分流' },
  'mortgage-26-volume': { sourceType: 'market_event', focus: '抵押债成交量、价格表现与事件时段归因', queryTerms: ['MBS trading volume', 'price performance event', 'mortgage liquidity'], assets: ['成交量', '价格表现', '事件归因'], specialistStep: '成交窗口去重与归因' },
};

const MONEY_MARKET_CRAWLER_PLAYBOOKS: Record<string, MortgageCrawlerPlaybook> = {
  'mm-01-des': { sourceType: 'security_master', focus: '货币市场字段定义、发布频率、单位、修订与来源血缘', queryTerms: ['money market data dictionary', 'benchmark methodology', 'reference rate metadata'], assets: ['字段口径', '发布日历', '修订记录'], specialistStep: '字段版本和单位一致性核验' },
  'mm-02-pgm': { sourceType: 'workflow_intelligence', focus: '货币市场研究委托、资料缺口、责任人和交付进度', queryTerms: ['money market research workflow', 'evidence checklist', 'research mandate'], assets: ['研究委托', '证据清单', '交付状态'], specialistStep: '委托范围与证据缺口匹配' },
  'mm-03-mktbeat': { sourceType: 'market_event', focus: '隔夜融资脉冲、成交量、基准偏离和异常窗口', queryTerms: ['SOFR EFFR OBFR', 'overnight funding pressure', 'repo volume'], assets: ['隔夜利率', '融资量', '异常时段'], specialistStep: '跨基准同日对齐和异常窗口识别' },
  'mm-04-btmm': { sourceType: 'macro_finance', focus: '国库券期限结构、拍卖供给、发行节奏与短端基准联动', queryTerms: ['Treasury bill auction', 'T-bill curve', 'short-end issuance'], assets: ['国库券曲线', '拍卖供给', '发行日历'], specialistStep: '期限、拍卖日和发行额归并' },
  'mm-05-boom': { sourceType: 'filing_event', focus: '已公告货币工具发售、申购窗口、结算与到期事件', queryTerms: ['Treasury auction announcement', 'bill offering calendar', 'settlement maturity'], assets: ['发售公告', '申购窗口', '结算事件'], specialistStep: '事件日期、CUSIP 与期限消歧' },
  'mm-06-tcon': { sourceType: 'macro_finance', focus: '政策利率走廊、准备金报酬、担保与无担保资金传导', queryTerms: ['IORB EFFR corridor', 'SOFR policy implementation', 'reserve remuneration'], assets: ['政策走廊', '准备金利率', '传导偏差'], specialistStep: '走廊边界和越界观察核验' },
  'mm-07-rv': { sourceType: 'fund_flow', focus: '同日短端基准相对差、历史分位、波动调整和均值偏离', queryTerms: ['money market relative value', 'TGCR BGCR spread', 'funding basis percentile'], assets: ['基准差值', '历史分位', '波动带'], specialistStep: '相对价值配对和同日样本去重' },
  'mm-08-ycqsim': { sourceType: 'derivatives_signal', focus: '短端曲线节点冲击、形态变化、参数敏感度与情景损益', queryTerms: ['short rate curve scenario', 'yield curve shock surface', 'front-end stress'], assets: ['冲击曲面', '节点敏感度', '情景差分'], specialistStep: '输入参数与情景结果可重复计算验证' },
  'mm-09-gc': { sourceType: 'macro_finance', focus: '短端基准历史绘图、曲线叠加、观察点证据与报告交付', queryTerms: ['money market curve chart', 'reference rate history', 'curve evidence'], assets: ['历史曲线', '观察点', '图表报告'], specialistStep: '图表序列与证据清单绑定' },
  'mm-10-crvf-mmkt': { sourceType: 'security_master', focus: '按工具、地区、频率和口径发现货币市场曲线来源', queryTerms: ['money market curve directory', 'reference rate source', 'overnight benchmark catalogue'], assets: ['曲线目录', '来源路由', '覆盖元数据'], specialistStep: '货币市场来源分类和可达性检查' },
  'mm-11-crvf': { sourceType: 'macro_finance', focus: '跨市场曲线口径兼容、观测时区、频率与期限可比性', queryTerms: ['cross market rate curve', 'benchmark comparability', 'rate convention'], assets: ['跨市场曲线', '口径差异', '时区频率'], specialistStep: '跨来源可比性边界检查' },
  'mm-12-fibc': { sourceType: 'workflow_intelligence', focus: '贴现工具价格、年化收益、日计数与敏感度复算', queryTerms: ['discount instrument calculator', 'T-bill yield calculation', 'money market day count'], assets: ['贴现计算', '日计数', '敏感度'], specialistStep: '公式、日计数和输入输出复算' },
  'mm-13-cdie': { sourceType: 'derivatives_signal', focus: '巴西 CDI 实际累计与用户 DI 期货路径、基差和情景偏离', queryTerms: ['Brazil CDI DI futures', 'CDI accumulated rate', 'DI curve'], assets: ['CDI 实际值', 'DI 情景', '累计基差'], specialistStep: 'CDI 观察与 DI 输入期限对齐' },
  'mm-14-efsf': { sourceType: 'filing_event', focus: 'EFSF EMTN 文件、期限条款、版本变更和到期结构', queryTerms: ['EFSF EMTN programme', 'EFSF short term debt', 'EFSF issuance document'], assets: ['EMTN 文件', '条款版本', '到期结构'], specialistStep: '文件版本和证券标识精确匹配' },
  'mm-15-mmidx': { sourceType: 'fund_flow', focus: '多基准归一化资金指数、离散度、状态切换与贡献拆分', queryTerms: ['money market composite index', 'funding dispersion', 'liquidity regime'], assets: ['资金指数', '基准离散', '状态切换'], specialistStep: '指数成分归一化和贡献一致性校验' },
  'mm-16-etrade': { sourceType: 'workflow_intelligence', focus: '货币市场交易前校验、定价证据、审批、结算和回执', queryTerms: ['money market electronic trading', 'trade pre-check', 'settlement approval'], assets: ['交易意向', '审批节点', '结算状态'], specialistStep: '交易前置条件和权限链核验' },
  'mm-17-edsf': { sourceType: 'derivatives_signal', focus: '合成 FRA 远期利率、折现现金流、冲击曲面和盈亏边界', queryTerms: ['synthetic FRA SOFR', 'forward rate agreement', 'FRA settlement'], assets: ['远期利率', '折现现金流', '盈亏曲面'], specialistStep: '近远端日期与现金流公式复核' },
  'mm-18-wbf': { sourceType: 'derivatives_signal', focus: '债券期货可交割券、转换因子、基差与隐含回购敏感度', queryTerms: ['bond futures CTD', 'conversion factor', 'implied repo basis'], assets: ['可交割券', '转换因子', '隐含回购'], specialistStep: '合约、现券和交割日期一致性核验' },
  'mm-19-pboc': { sourceType: 'macro_finance', focus: '人民银行公开市场操作、政策工具、到期回笼与措辞变化', queryTerms: ['PBOC open market operation', 'MLF repo liquidity', 'PBOC announcement'], assets: ['公开市场操作', '政策工具', '净投放事件'], specialistStep: '公告事件、金额和期限结构化' },
  'mm-20-twdi': { sourceType: 'market_event', focus: '台湾隔夜拆款观察、波动区间、缺口和数据质量', queryTerms: ['Taiwan interbank overnight call rate', 'CBC call money rate', 'TWDI'], assets: ['隔夜拆款', '波动区间', '质量审计'], specialistStep: '日期格式和重复观察清理' },
  'mm-21-cenb': { sourceType: 'macro_finance', focus: '全球央行货币市场来源覆盖、政策工具差异与更新状态', queryTerms: ['central bank money market operations', 'policy rate corridor', 'liquidity facility'], assets: ['央行目录', '政策工具', '更新覆盖'], specialistStep: '央行、地区与政策工具实体关联' },
  'mm-22-news': { sourceType: 'financial_news', focus: '货币市场政策、融资、拍卖和基准利率事件长文', queryTerms: ['money market news', 'funding market event', 'central bank liquidity news'], assets: ['政策新闻', '融资事件', '研究长文'], specialistStep: '新闻事件与对应观察窗口配对' },
  'mm-23-source': { sourceType: 'workflow_intelligence', focus: '货币市场来源可用率、延迟、异常、恢复和版本轨迹', queryTerms: ['data source availability', 'financial feed latency', 'source lineage'], assets: ['来源可用率', '读取延迟', '恢复事件'], specialistStep: '来源探测和异常恢复状态聚合' },
  'mm-24-mmflow': { sourceType: 'workflow_intelligence', focus: '货币市场交付包版本、审批回执、失败原因和审计链', queryTerms: ['research delivery workflow', 'approval receipt', 'version audit'], assets: ['交付版本', '确认回执', '审计事件'], specialistStep: '交付版本、目标和确认回执对账' },
};

function sourceTypeFor(module: AdminDataModule): AdminCrawlerSourceType {
  const text = `${module.id} ${module.name}`.toLowerCase();
  if (/龙虎|industry-group|equity-market|market-manage/.test(text)) return 'dragon_tiger';
  if (/评级|rating|credit-analysis|industry-analysis|sector-analysis/.test(text)) return 'analyst_rating';
  if (/财务|价值|fundamental|fund-|etf|portfolio|asset-allocation/.test(text)) return 'fundamental_value';
  if (/新闻|news|top|btdy|frnt|read|nlrt|nsub|mrep|soci|tren|opin|bnef/.test(text)) return 'financial_news';
  if (/宏观|经济|利率|曲线|curve|rate|yield|econ/.test(text)) return 'macro_finance';
  if (/衍生|期权|期货|掉期|波动|derivative|option|future|swpm|ovm|wvol|mars|vca/.test(text)) return 'derivatives_signal';
  if (/抵押债|mbs|tba|cmbs|rmbs|信用|债券|cds|fixed-income|convertible/.test(text)) return 'filing_event';
  if (/交易|订单|账簿|stp|workflow|comms|notification|workspace|settings/.test(text)) return 'workflow_intelligence';
  if (/市场|market|指数|index|forex|commodity|crypto|energy|metal|bico/.test(text)) return 'market_event';
  if (/股票|证券|标的|search|listing/.test(text)) return 'security_master';
  return 'fund_flow';
}

export const ADMIN_CRAWLER_STRATEGIES: AdminCrawlerStrategy[] = ADMIN_DATA_MODULES.map((module, index) => {
  const ordinal = String(index + 1).padStart(3, '0');
  const lens = LENSES[index % LENSES.length];
  const mortgagePlaybook = MORTGAGE_CRAWLER_PLAYBOOKS[module.id];
  const specialistPlaybook = mortgagePlaybook ?? MONEY_MARKET_CRAWLER_PLAYBOOKS[module.id];
  const sourceType = specialistPlaybook?.sourceType ?? sourceTypeFor(module);
  const descriptor = SOURCE_DESCRIPTORS[sourceType];
  return {
    moduleId: module.id,
    moduleName: module.name,
    targetPath: module.path,
    strategyKey: `${ADMIN_CRAWLER_STRATEGY_VERSION}:${ordinal}:${module.id}`,
    promptKey: `module-${ordinal}-${sourceType}-${module.id}`,
    viewType: `${sourceType}:${lens}:${ordinal}`,
    sourceType,
    focus: specialistPlaybook?.focus ?? `${module.name}·${lens}`,
    queryTerms: specialistPlaybook ? [module.name, ...specialistPlaybook.queryTerms] : [module.name, module.domain, lens, sourceType],
    transformationVersion: `${ADMIN_CRAWLER_STRATEGY_VERSION}.${ordinal}`,
    contentLabel: descriptor.label,
    contentDescription: descriptor.description,
    targetLabel: `${module.name}（${module.path}）`,
    assetCoverage: specialistPlaybook?.assets ?? descriptor.assets,
    processingSteps: specialistPlaybook
      ? ['来源采集', '内容识别', specialistPlaybook.specialistStep, '事实边界校验', '模块级去重', 'AI 改写', '质量检查', '定向推送']
      : ['来源采集', '内容识别', '事实边界校验', '模块级去重', 'AI 改写', '质量检查', '定向推送'],
  };
});

export const ADMIN_CRAWLER_STRATEGY_BY_MODULE = new Map(ADMIN_CRAWLER_STRATEGIES.map((strategy) => [strategy.moduleId, strategy]));

export function validateAdminCrawlerStrategies() {
  const moduleIds = new Set(ADMIN_DATA_MODULES.map((module) => module.id));
  const strategies = ADMIN_CRAWLER_STRATEGIES;
  const unique = (values: string[]) => new Set(values).size === values.length;
  const missing = [...moduleIds].filter((moduleId) => !ADMIN_CRAWLER_STRATEGY_BY_MODULE.has(moduleId));
  return {
    moduleCount: ADMIN_DATA_MODULES.length,
    strategyCount: strategies.length,
    missing,
    uniqueModuleIds: unique(strategies.map((strategy) => strategy.moduleId)),
    uniqueStrategyKeys: unique(strategies.map((strategy) => strategy.strategyKey)),
    uniquePromptKeys: unique(strategies.map((strategy) => strategy.promptKey)),
    uniqueViewTypes: unique(strategies.map((strategy) => strategy.viewType)),
    valid: strategies.length === ADMIN_DATA_MODULES.length && missing.length === 0
      && unique(strategies.map((strategy) => strategy.moduleId))
      && unique(strategies.map((strategy) => strategy.strategyKey))
      && unique(strategies.map((strategy) => strategy.promptKey))
      && unique(strategies.map((strategy) => strategy.viewType)),
  };
}
