/**
 * 通用菜单项处理系统
 * 为所有菜单项提供统一的功能处理、数据加载和导航
 */

import { toast } from 'sonner';
import { findTerminalFeature } from '@/config/terminalFeatureRegistry';

export interface MenuItemConfig {
  id: string;
  code?: string;
  name: string;
  category: string;
  dataType: 'chart' | 'table' | 'dashboard' | 'analysis' | 'trading' | 'news' | 'research';
  description?: string;
  icon?: string;
  path?: string;
}

export interface MenuItemData {
  title: string;
  description: string;
  data: any[];
  metadata: {
    lastUpdated: string;
    source: string;
    dataPoints: number;
  };
}

// 菜单项配置映射表
export const MENU_ITEM_CONFIG: Record<string, any> = {
  // 债券市场
  'WB': {
    id: 'WB',
    code: 'WB',
    name: '全球债券市场',
    category: '债券',
    dataType: 'dashboard',
    description: '全球主要债券市场的实时行情和分析'
  },
  'FIT': {
    id: 'FIT',
    code: 'FIT',
    name: 'FIT 固定收益交易终端',
    category: '固定收益交易',
    dataType: 'trading',
    description: '固定收益产品交易终端：债券全域/交易网格/多交易商报价/交易记录簿/执行分析/组合篮子/库存管理',
    path: '/fixed-income-trade'
  },
  'BTMM': {
    id: 'BTMM',
    code: 'BTMM',
    name: '国债与货币市场',
    category: '债券',
    dataType: 'dashboard',
    description: '国债和货币市场的综合展示'
  },
  'SWPM': {
    id: 'SWPM',
    code: 'SWPM',
    name: '掉期管理',
    category: '衍生品',
    dataType: 'trading',
    description: '掉期产品的交易平台和管理工具',
    path: '/swpm'
  },
  'GCDS': {
    id: 'GCDS',
    code: 'GCDS',
    name: '全球CDS图表',
    category: '衍生品',
    dataType: 'chart',
    description: '全球信用违约互换市场数据',
    path: '/wcds'
  },
  'FOM': {
    id: 'FOM',
    code: 'FOM',
    name: '期货与期权行情监控',
    category: '衍生品',
    dataType: 'dashboard',
    description: '全球期货期权实时行情，含二阶希腊字母与AI套利信号',
    path: '/fom'
  },
  'WBF-AI': {
    id: 'WBF-AI',
    code: 'WBF-AI',
    name: 'WBF全球债券期货AI增强',
    category: '衍生品',
    dataType: 'dashboard',
    description: 'DRL CTD预测 + GNN基差套利引擎',
    path: '/wbf-ai'
  },
  'CREDIT-MONITOR': {
    id: 'CREDIT-MONITOR',
    code: 'CREDIT-MONITOR',
    name: '信用监控综合面板',
    category: '信用',
    dataType: 'dashboard',
    description: 'FICM/GCDS/TFLO/CDX 多模态信用违约预警',
    path: '/credit-monitor'
  },
  'MIPR': {
    id: 'MIPR',
    code: 'MIPR',
    name: '市场隐含政策利率',
    category: '债券',
    dataType: 'analysis',
    description: '从市场价格推导的隐含政策利率'
  },
  // 外汇市场
  'EURUSD': {
    id: 'EURUSD',
    code: 'EURUSD',
    name: '欧美汇率',
    category: '外汇',
    dataType: 'chart',
    description: '欧元对美元的实时汇率'
  },
  'GBPUSD': {
    id: 'GBPUSD',
    code: 'GBPUSD',
    name: '英美汇率',
    category: '外汇',
    dataType: 'chart',
    description: '英镑对美元的实时汇率'
  },
  // 大宗商品
  'XAUUSD': {
    id: 'XAUUSD',
    code: 'XAUUSD',
    name: '黄金价格',
    category: '商品',
    dataType: 'chart',
    description: '国际黄金现货价格'
  },
  'XBRUSD': {
    id: 'XBRUSD',
    code: 'XBRUSD',
    name: '布伦特原油',
    category: '商品',
    dataType: 'chart',
    description: '布伦特原油期货价格'
  },
  // 股票市场
  'SPX': {
    id: 'SPX',
    code: 'SPX',
    name: 'S&P 500',
    category: '股票',
    dataType: 'chart',
    description: '标普500指数'
  },
  'INDU': {
    id: 'INDU',
    code: 'INDU',
    name: '道琼斯指数',
    category: '股票',
    dataType: 'chart',
    description: '道琼斯工业平均指数'
  },
  'CCMP': {
    id: 'CCMP',
    code: 'CCMP',
    name: '纳斯达克指数',
    category: '股票',
    dataType: 'chart',
    description: '纳斯达克综合指数'
  },
  // 衍生品核心功能模块
  'WBF': {
    id: 'WBF',
    code: 'WBF',
    name: '全球债券期货',
    category: '衍生品',
    dataType: 'dashboard',
    description: '全球主要债券期货市场行情和分析',
    path: '/wbf'
  },
  'CDSW': {
    id: 'CDSW',
    code: 'CDSW',
    name: 'CDS 估值',
    category: '衍生品',
    dataType: 'trading',
    description: '信用违约互换的估值和交易工具',
    path: '/cdsw'
  },
  'WCDS': {
    id: 'WCDS',
    code: 'WCDS',
    name: '全球CDS行情显示',
    category: '衍生品',
    dataType: 'dashboard',
    description: '全球CDS市场实时行情',
    path: '/wcds'
  },
  'OVME': {
    id: 'OVME',
    code: 'OVME',
    name: '股票/利率期权定价',
    category: '衍生品',
    dataType: 'trading',
    description: '期权定价和希腊值计算',
    path: '/ovme'
  },
  'MOSO': {
    id: 'MOSO',
    code: 'MOSO',
    name: '交易最活跃期权',
    category: '衍生品',
    dataType: 'dashboard',
    description: '最活跃期权合约展示',
    path: '/moso'
  },
  'NCEO': {
    id: 'NCEO',
    code: 'NCEO',
    name: '佑诚期权 · 诺诚增强期权',
    category: '衍生品',
    dataType: 'analysis',
    description: 'NCEO 模拟期权研究、策略测算与会话内复盘，不发送真实订单',
    path: '/terminal?module=derivatives&open=nceo'
  },
  'OVML': {
    id: 'OVML',
    code: 'OVML',
    name: '外汇/商品期权定价',
    category: '衍生品',
    dataType: 'trading',
    description: '外汇和商品期权定价工具',
    path: '/ovml'
  },
  'WVOL': {
    id: 'WVOL',
    code: 'WVOL',
    name: '外汇隐含波动率矩阵',
    category: '外汇',
    dataType: 'analysis',
    description: '外汇隐含波动率曲面分析',
    path: '/wvol'
  },
  'GLCO': {
    id: 'GLCO',
    code: 'GLCO',
    name: '全球商品价格',
    category: '衍生品',
    dataType: 'dashboard',
    description: '全球商品市场实时价格',
    path: '/glco'
  },
  'CFTC': {
    id: 'CFTC',
    code: 'CFTC',
    name: 'CFTC 全球期货持仓周报',
    category: '商品衍生品',
    dataType: 'research',
    description: '官方周度期货持仓、多空结构与净仓观察；不冒充实时行情',
    path: '/terminal?module=commodities&open=cftc'
  },
  'OILS': {
    id: 'OILS',
    code: 'OILS',
    name: '石油冲击（WTI 持仓结构）',
    category: '商品衍生品',
    dataType: 'research',
    description: '原有石油冲击工作区，追加 WTI 现货路径与 CFTC 周度持仓结构',
    path: '/terminal?module=commodities&open=oils'
  },
  'OVCV': {
    id: 'OVCV',
    code: 'OVCV',
    name: '可转换债券估价',
    category: '衍生品',
    dataType: 'trading',
    description: '可转换债券估价和转换权分析',
    path: '/ovcv'
  },
  'DLIB': {
    id: 'DLIB',
    code: 'DLIB',
    name: '衍生品库',
    category: '衍生品',
    dataType: 'research',
    description: '衍生品产品库和参考资料',
    path: '/dlib'
  },
  'VCA': {
    id: 'VCA',
    code: 'VCA',
    name: '波动率与相关系数分析',
    category: '衍生品',
    dataType: 'analysis',
    description: '多资产波动率和相关系数分析',
    path: '/vca'
  },
  'MARS': {
    id: 'MARS',
    code: 'MARS',
    name: '多资产风险系统',
    category: '衍生品',
    dataType: 'analysis',
    description: '投资组合VaR和压力测试',
    path: '/mars'
  },
  'BICO': {
    id: 'BICO',
    code: 'BICO',
    name: '佑诚行业研究概况',
    category: '衍生品',
    dataType: 'analysis',
    description: '行业研究概况与AI因果分析',
    path: '/bico'
  },
  'NI DRV': {
    id: 'NI DRV',
    code: 'NI DRV',
    name: '新闻：衍生品',
    category: '衍生品',
    dataType: 'news',
    description: '衍生品市场新闻和资讯',
    path: '/ni-drv'
  },
  'NI BMRDRV': {
    id: 'NI BMRDRV',
    code: 'NI BMRDRV',
    name: '新闻：衍生品研究',
    category: '衍生品',
    dataType: 'research',
    description: '衍生品研究报告和分析'
  },
  'DERI': {
    id: 'DERI',
    code: 'DERI',
    name: 'FinMind 期货',
    category: '衍生品',
    dataType: 'dashboard',
    description: '期货日成交、结算、成交量与未平仓量永久观察',
    path: '/deri'
  },
  // 衍生品菜单项 - 分类和功能
  '利率、通货衍生证券与结构债': {
    id: '利率、通胀衍生证券与结构债',
    name: '利率、通胀衍生证券与结构债',
    category: '衍生品',
    dataType: 'dashboard',
    description: '利率和通胀衍生证券的市场行情和分析'
  },
  '信用衍生产品': {
    id: '信用衍生产品',
    name: '信用衍生产品',
    category: '衍生品',
    dataType: 'dashboard',
    description: '信用衍生产品市场行情和分析'
  },
  '股票衍生品': {
    id: '股票衍生品',
    name: '股票衍生品',
    category: '衍生品',
    dataType: 'dashboard',
    description: '股票衍生品市场行情和分析'
  },
  '股指衍生品': {
    id: '股指衍生品',
    name: '股指衍生品',
    category: '衍生品',
    dataType: 'dashboard',
    description: '股指衍生品市场行情'
  },
  '外汇衍生品': {
    id: '外汇衍生品',
    name: '外汇衍生品',
    category: '衍生品',
    dataType: 'dashboard',
    description: '外汇衍生品市场行情'
  },
  '文件与资料': {
    id: '文件与资料',
    name: '文件与资料',
    category: '衍生品',
    dataType: 'research',
    description: '衍生品相关文件和资料'
  },
  '商品衍生品': {
    id: '商品衍生品',
    name: '商品衍生品',
    category: '衍生品',
    dataType: 'dashboard',
    description: '商品期货行情与周度持仓观察',
    path: '/commodity-derivatives'
  },
  '可转换债券': {
    id: '可转换债券',
    name: '可转换债券',
    category: '衍生品',
    dataType: 'dashboard',
    description: '可转换债券市场行情'
  },
  '定价与风险解决方案': {
    id: '定价与风险解决方案',
    name: '定价与风险解决方案',
    category: '衍生品',
    dataType: 'analysis',
    description: '衍生品定价和风险管理方案'
  },
  // 专业应用模块 - 新增深度功能页面
  'PORT': {
    id: 'PORT',
    code: 'PORT',
    name: '投资组合与风险分析',
    category: '投资组合',
    dataType: 'dashboard',
    description: '持仓管理、绩效归因、风险量化、组合优化',
    path: '/portfolio-optimizer'
  },
  'PRTU': {
    id: 'PRTU',
    code: 'PRTU',
    name: '投资组合管理',
    category: '投资组合',
    dataType: 'dashboard',
    description: '投资组合持仓管理与分析',
    path: '/portfolio-optimizer'
  },
  'PORT TE': {
    id: 'PORT TE',
    code: 'PORT TE',
    name: '跟踪误差',
    category: '投资组合',
    dataType: 'analysis',
    description: '投资组合跟踪误差分析',
    path: '/portfolio-optimizer'
  },
  'PORT VR': {
    id: 'PORT VR',
    code: 'PORT VR',
    name: '风险价值',
    category: '投资组合',
    dataType: 'analysis',
    description: 'VaR 风险价值计算与时序分析',
    path: '/portfolio-optimizer'
  },
  'PORT SA': {
    id: 'PORT SA',
    code: 'PORT SA',
    name: '情景分析',
    category: '投资组合',
    dataType: 'analysis',
    description: '压力测试与情景分析',
    path: '/portfolio-optimizer'
  },
  'PORT PA': {
    id: 'PORT PA',
    code: 'PORT PA',
    name: '业绩归因',
    category: '投资组合',
    dataType: 'analysis',
    description: '投资组合收益归因分析',
    path: '/portfolio-optimizer'
  },
  'PORT OP': {
    id: 'PORT OP',
    code: 'PORT OP',
    name: '投资组合优化',
    category: '投资组合',
    dataType: 'analysis',
    description: '有效前沿与组合优化',
    path: '/portfolio-optimizer'
  },
  'ECON': {
    id: 'ECON',
    code: 'ECON',
    name: '宏观经济仪表板',
    category: '经济分析',
    dataType: 'dashboard',
    description: '全球经济指标实时监控与多维分析',
    path: '/macro-dashboard'
  },
  'WECO': {
    id: 'WECO',
    code: 'WECO',
    name: '全球经济监控',
    category: '经济分析',
    dataType: 'dashboard',
    description: '全球经济指标实时监控',
    path: '/macro-dashboard'
  },
  'EQS': {
    id: 'EQS',
    code: 'EQS',
    name: '股票市场',
    category: '股票',
    dataType: 'dashboard',
    description: '全球股票行情、板块分析、资金流向',
    path: '/equity-market'
  },
  'BTCUSD': {
    id: 'BTCUSD',
    code: 'BTCUSD',
    name: '比特币行情',
    category: '加密货币',
    dataType: 'chart',
    description: '比特币实时行情与深度分析',
    path: '/crypto-market'
  },
  'CRYPTO': {
    id: 'CRYPTO',
    code: 'CRYPTO',
    name: '加密货币市场',
    category: '加密货币',
    dataType: 'dashboard',
    description: '加密货币市场概览、链上数据、DeFi',
    path: '/crypto-market'
  },
  // ── 指数模块 ──
  'WBIX': { id: 'WBIX', code: 'WBIX', name: '全球债券指数', category: '指数', dataType: 'dashboard', description: '全球债券指数行情与分析', path: '/index-hub?panel=WBIX' },
  'CIX': { id: 'CIX', code: 'CIX', name: '自设指数', category: '指数', dataType: 'dashboard', description: '自定义指数构建与回测', path: '/index-hub?panel=CIX' },
  'RRG': { id: 'RRG', code: 'RRG', name: '相对旋转图', category: '指数', dataType: 'chart', description: '行业/资产相对强弱旋转分析', path: '/index-hub?panel=RRG' },
  'GMM': { id: 'GMM', code: 'GMM', name: '宏观驱动者', category: '指数', dataType: 'dashboard', description: '宏观因子对指数的驱动分析', path: '/index-hub?panel=GMM' },
  'SECF': { id: 'SECF', code: 'SECF', name: '证券查找', category: '指数', dataType: 'dashboard', description: '多资产类别证券搜索引擎', path: '/index-hub?panel=SECF' },
  'WEIF': { id: 'WEIF', code: 'WEIF', name: '全球股指期货', category: '指数', dataType: 'dashboard', description: '期货溢价贴水矩阵与展期分析', path: '/index-hub?panel=WEIF' },
  'IN': { id: 'IN', code: 'IN', name: '指数浏览器', category: '指数', dataType: 'dashboard', description: '指数成分股深度分析', path: '/index-hub?panel=IN' },
  'INP': { id: 'INP', code: 'INP', name: '指数出版物', category: '指数', dataType: 'dashboard', description: '指数方法论文档库', path: '/index-hub?panel=INP' },
  'CIXB': { id: 'CIXB', code: 'CIXB', name: '自设篮子编辑器', category: '指数', dataType: 'dashboard', description: '股票篮子构建工具', path: '/index-hub?panel=CIXB' },
  'AGG': { id: 'AGG', code: 'AGG', name: '自设合并', category: '指数', dataType: 'dashboard', description: '多指数加权合并工具', path: '/index-hub?panel=AGG' },
  'FDFD': { id: 'FDFD', code: 'FDFD', name: '分析FDFD Index', category: '指数', dataType: 'chart', description: '联邦基金期货隐含利率曲线', path: '/index-hub?panel=FDFD' },
  'WT': { id: 'WT', code: 'WT', name: 'WTR行情显示', category: '指数', dataType: 'dashboard', description: '全球市场实时行情看板', path: '/index-hub?panel=WT' },
  'CIXN': { id: 'CIXN', code: 'CIXN', name: '自设表达式编辑器', category: '指数', dataType: 'dashboard', description: '公式驱动指数构建', path: '/index-hub?panel=CIXN' },
  'CIXS': { id: 'CIXS', code: 'CIXS', name: '自设利差编辑器', category: '指数', dataType: 'dashboard', description: '利差指数构建工具', path: '/index-hub?panel=CIXS' },
  'CIXR': { id: 'CIXR', code: 'CIXR', name: '自设比率编辑器', category: '指数', dataType: 'dashboard', description: '比率指数工具', path: '/index-hub?panel=CIXR' },
  'CIXC': { id: 'CIXC', code: 'CIXC', name: '自设转换编辑器', category: '指数', dataType: 'dashboard', description: '数据转换工具', path: '/index-hub?panel=CIXC' },
  'CIXX': { id: 'CIXX', code: 'CIXX', name: '本地数据-Excel', category: '指数', dataType: 'dashboard', description: 'Excel数据导入工具', path: '/index-hub?panel=CIXX' },
  'CIXI': { id: 'CIXI', code: 'CIXI', name: '自设时间序列编辑器', category: '指数', dataType: 'dashboard', description: '时间序列管理工具', path: '/index-hub?panel=CIXI' },
  'INDEX_DERIV': { id: 'INDEX_DERIV', code: 'INDEX_DERIV', name: '指数衍生品', category: '指数', dataType: 'dashboard', description: '指数期权期货衍生品工具', path: '/index-hub?panel=INDEX_DERIV' },
  'OTHER_INDEX': { id: 'OTHER_INDEX', code: 'OTHER_INDEX', name: '其他指数', category: '指数', dataType: 'dashboard', description: '全球另类指数分析', path: '/index-hub?panel=OTHER_INDEX' },
  'HELP INDX': { id: 'HELP INDX', code: 'HELP INDX', name: '指数', category: '指数', dataType: 'dashboard', description: '指数功能导航', path: '/index-hub?panel=HELP_INDX' },
  'HELP_INDX': { id: 'HELP_INDX', code: 'HELP_INDX', name: '指数帮助', category: '指数', dataType: 'dashboard', description: '指数功能导航', path: '/index-hub?panel=HELP_INDX' },
  // ── 外汇模块 ──
  'FXC': { id: 'FXC', code: 'FXC', name: '汇率矩阵', category: '外汇', dataType: 'dashboard', description: '全球主要货币汇率矩阵', path: '/terminal?module=forex&open=fxc' },
  'XCCY': { id: 'XCCY', code: 'XCCY', name: '交叉货币基差', category: '外汇', dataType: 'chart', description: '交叉货币基差互换分析', path: '/terminal?module=forex&open=xccy' },
  'FXFC': { id: 'FXFC', code: 'FXFC', name: '汇率预测', category: '外汇', dataType: 'dashboard', description: '汇率走势预测与情景分析', path: '/terminal?module=forex&open=fxfc' },
  'FXSW': { id: 'FXSW', code: 'FXSW', name: '外汇策略', category: '外汇', dataType: 'dashboard', description: '外汇交易策略工作台', path: '/terminal?module=forex&open=fxsw' },
  'FOREX': { id: 'FOREX', code: 'FOREX', name: '外汇市场', category: '外汇', dataType: 'dashboard', description: '外汇市场综合分析', path: '/forex-hub' },
  // ── 通讯与社区 ──
  'MSG': { id: 'MSG', code: 'MSG', name: '消息中心', category: '通讯与社区', dataType: 'dashboard', description: '实时消息与通讯', path: '/comms-hub' },
  'CHAT': { id: 'CHAT', code: 'CHAT', name: '社区讨论', category: '通讯与社区', dataType: 'dashboard', description: '投资者社区与讨论', path: '/comms-hub' },
  'DOCS': { id: 'DOCS', code: 'DOCS', name: '文件管理', category: '通讯与社区', dataType: 'dashboard', description: '研究文件与报告管理', path: '/comms-hub' },
  'COMMS': { id: 'COMMS', code: 'COMMS', name: '通讯中心', category: '通讯与社区', dataType: 'dashboard', description: '通讯与社区综合平台', path: '/comms-hub' },
  // ── 新闻与研究 ──
  'TOP': { id: 'TOP', code: 'TOP', name: '要闻精选', category: '新闻与研究', dataType: 'dashboard', description: '全球财经头条', path: '/news-hub?tab=top' },
  'BTDY': { id: 'BTDY', code: 'BTDY', name: 'Ucheer Today', category: '新闻与研究', dataType: 'dashboard', description: 'Ucheer Today 今日要闻', path: '/news-hub?tab=btdy' },
  'FRNT': { id: 'FRNT', code: 'FRNT', name: '首页', category: '新闻与研究', dataType: 'dashboard', description: '多板块新闻聚合首页', path: '/news-hub?tab=frnt' },
  'CN': { id: 'CN', code: 'CN', name: '公司新闻', category: '新闻与研究', dataType: 'news', description: '公司动态与企业新闻', path: '/news-hub?tab=cn' },
  'READ': { id: 'READ', code: 'READ', name: '最热门报道', category: '新闻与研究', dataType: 'news', description: '阅读热度排行榜', path: '/news-hub?tab=read' },
  'NI': { id: 'NI', code: 'NI', name: '新闻主题', category: '新闻与研究', dataType: 'dashboard', description: '按主题分类的新闻聚合', path: '/news-hub?tab=ni' },
  'NH': { id: 'NH', code: 'NH', name: '滚动新闻', category: '新闻与研究', dataType: 'news', description: '实时滚动新闻时间轴', path: '/news-hub?tab=nh' },
  'FIRS': { id: 'FIRS', code: 'FIRS', name: '佑诚率先报道', category: '新闻与研究', dataType: 'news', description: '佑诚独家率先报道', path: '/news-hub?tab=firs' },
  'BI': { id: 'BI', code: 'BI', name: '佑诚行业研究', category: '新闻与研究', dataType: 'research', description: '深度行业研究报告', path: '/news-hub?tab=bi' },
  'BECO': { id: 'BECO', code: 'BECO', name: '佑诚经济', category: '新闻与研究', dataType: 'dashboard', description: '宏观经济信号仪表盘', path: '/news-hub?tab=beco' },
  'DAYB': { id: 'DAYB', code: 'DAYB', name: '佑诚早间新闻', category: '新闻与研究', dataType: 'news', description: '每日早间市场简报', path: '/news-hub?tab=dayb' },
  'MAG': { id: 'MAG', code: 'MAG', name: '佑诚杂志', category: '新闻与研究', dataType: 'research', description: '佑诚深度杂志报道', path: '/news-hub?tab=mag' },
  'MEDI': { id: 'MEDI', code: 'MEDI', name: '佑诚媒体', category: '新闻与研究', dataType: 'news', description: '佑诚多媒体内容', path: '/news-hub?tab=medi' },
  'OPIN': { id: 'OPIN', code: 'OPIN', name: '佑诚观点', category: '新闻与研究', dataType: 'research', description: '佑诚专家观点与评论', path: '/news-hub?tab=opin' },
  'BNEF': { id: 'BNEF', code: 'BNEF', name: '佑诚新能源研究', category: '新闻与研究', dataType: 'research', description: '清洁能源与商品研究', path: '/news-hub?tab=bnef' },
  'MYN': { id: 'MYN', code: 'MYN', name: '我的新闻', category: '新闻与研究', dataType: 'news', description: '个性化新闻订阅', path: '/news-hub?tab=myn' },
  'NLRT': { id: 'NLRT', code: 'NLRT', name: '新闻检索与提醒', category: '新闻与研究', dataType: 'news', description: '新闻搜索与智能提醒', path: '/news-hub?tab=nlrt' },
  'NSUB': { id: 'NSUB', code: 'NSUB', name: '新闻订阅', category: '新闻与研究', dataType: 'news', description: '新闻源订阅管理', path: '/news-hub?tab=nsub' },
  'MREP': { id: 'MREP', code: 'MREP', name: 'Morning Report', category: '新闻与研究', dataType: 'research', description: '每日市场晨报', path: '/news-hub?tab=mrep' },
  'NZPD': { id: 'NZPD', code: 'NZPD', name: '新闻设定', category: '新闻与研究', dataType: 'dashboard', description: '新闻偏好设置', path: '/news-hub?tab=nzpd' },
  'SOCI': { id: 'SOCI', code: 'SOCI', name: '社交监测', category: '新闻与研究', dataType: 'dashboard', description: '社交媒体情绪监测', path: '/news-hub?tab=soci' },
  'TREN': { id: 'TREN', code: 'TREN', name: '新闻趋势', category: '新闻与研究', dataType: 'dashboard', description: '市场热点趋势追踪', path: '/news-hub?tab=tren' },
  'NEWS': { id: 'NEWS', code: 'NEWS', name: '新闻中心', category: '新闻与研究', dataType: 'dashboard', description: '新闻与研究综合平台', path: '/news-hub' },
  // ── 经济数据及分析 ──
  'ECO': { id: 'ECO', code: 'ECO', name: '经济日历', category: '经济分析', dataType: 'dashboard', description: '全球经济数据发布日历', path: '/econ-hub?tab=eco' },
  'ECST': { id: 'ECST', code: 'ECST', name: '世界经济统计数据', category: '经济分析', dataType: 'dashboard', description: '全球主要经济统计指标检索与对比', path: '/econ-hub?tab=ecst' },
  'ECTR': { id: 'ECTR', code: 'ECTR', name: '贸易流量', category: '经济分析', dataType: 'dashboard', description: '全球贸易流量与供应链分析', path: '/econ-hub?tab=ectr' },
  'WFII': { id: 'WFII', code: 'WFII', name: '外国投资组合投资', category: '经济分析', dataType: 'dashboard', description: '全球外国投资组合投资流向分析', path: '/econ-hub?tab=wfii' },
  'ECWB': { id: 'ECWB', code: 'ECWB', name: '经济工作台', category: '经济分析', dataType: 'dashboard', description: '经济数据综合工作台', path: '/econ-hub?tab=ecwb' },
  'RSAN': { id: 'RSAN', code: 'RSAN', name: '地缘政治风险分析', category: '经济分析', dataType: 'dashboard', description: '俄乌战争与地缘政治风险分析', path: '/econ-hub?tab=rsan' },
  'ECOB': { id: 'ECOB', code: 'ECOB', name: 'Economic Key Indicators', category: '经济分析', dataType: 'dashboard', description: '全球关键经济指标仪表盘', path: '/econ-hub?tab=ecob' },
  'ECFC': { id: 'ECFC', code: 'ECFC', name: '经济预测', category: '经济分析', dataType: 'dashboard', description: '主要机构经济预测汇总', path: '/econ-hub?tab=ecfc' },
  'SHOK': { id: 'SHOK', code: 'SHOK', name: 'BE预测模型', category: '经济分析', dataType: 'dashboard', description: '宏观冲击预测模型与情景模拟', path: '/econ-hub?tab=shok' },
  'WIRP': { id: 'WIRP', code: 'WIRP', name: '利率概率', category: '经济分析', dataType: 'chart', description: '央行利率决议概率分析', path: '/econ-hub?tab=wirp' },
  'FCON': { id: 'FCON', code: 'FCON', name: '财务状况', category: '经济分析', dataType: 'dashboard', description: '金融条件指数综合分析', path: '/econ-hub?tab=fcon' },
  'ECSU': { id: 'ECSU', code: 'ECSU', name: '经济意外', category: '经济分析', dataType: 'chart', description: '经济数据意外指数与供给侧分析', path: '/econ-hub?tab=ecsu' },
  'TAYL': { id: 'TAYL', code: 'TAYL', name: '泰勒规则', category: '经济分析', dataType: 'chart', description: '泰勒规则利率测算', path: '/econ-hub?tab=tayl' },
  'ECAN': { id: 'ECAN', code: 'ECAN', name: '世界经济分析工具', category: '经济分析', dataType: 'dashboard', description: '全球宏观经济综合分析', path: '/econ-hub?tab=ecan' },
  'MOSP': { id: 'MOSP', code: 'MOSP', name: 'Most Active Predict Markets', category: '经济分析', dataType: 'dashboard', description: '最活跃预测市场与市场展望', path: '/econ-hub?tab=mosp' },
  'CENB': { id: 'CENB', code: 'CENB', name: '央行查找', category: '经济分析', dataType: 'dashboard', description: '全球央行政策追踪与分析', path: '/econ-hub?tab=cenb' },
  'CBRT': { id: 'CBRT', code: 'CBRT', name: '央行利率分析', category: '经济分析', dataType: 'dashboard', description: '全球央行利率决策历史与预期', path: '/econ-hub?tab=cbrt' },
  'FOMC': { id: 'FOMC', code: 'FOMC', name: '美联邦公开市场操作', category: '经济分析', dataType: 'dashboard', description: 'FOMC会议纪要与点阵图分析', path: '/econ-hub?tab=fomc' },
  'FOMS': { id: 'FOMS', code: 'FOMS', name: 'FOMC声明', category: '经济分析', dataType: 'dashboard', description: 'FOMC声明全文与政策解读', path: '/econ-hub?tab=foms' },
  'FDSP': { id: 'FDSP', code: 'FDSP', name: '佑诚经济联储分析仪', category: '经济分析', dataType: 'dashboard', description: '联储政策分析仪与预测工具', path: '/econ-hub?tab=fdsp' },
  'BE': { id: 'BE', code: 'BE', name: '经济新闻与分析', category: '经济分析', dataType: 'news', description: '佑诚经济新闻与深度分析', path: '/econ-hub?tab=be' },
  'BIE': { id: 'BIE', code: 'BIE', name: 'Ucheer Eco Country Primers', category: '经济分析', dataType: 'dashboard', description: '佑诚经济国家报告', path: '/econ-hub?tab=bie' },
  'PMI': { id: 'PMI', code: 'PMI', name: '标普全球PMI', category: '经济分析', dataType: 'dashboard', description: '全球采购经理人指数综合分析', path: '/econ-hub?tab=pmi' },
  // ── 行业分组分析 ──
  'INDG': { id: 'INDG', code: 'INDG', name: '行业分类', category: '行业分组分析', dataType: 'dashboard', description: 'GICS行业分类体系与分析', path: '/industry-group' },
  'BLAW': { id: 'BLAW', code: 'BLAW', name: '法律监管', category: '行业分组分析', dataType: 'dashboard', description: '行业监管政策跟踪', path: '/industry-group' },
  'BTAX': { id: 'BTAX', code: 'BTAX', name: '税务分析', category: '行业分组分析', dataType: 'dashboard', description: '全球税务比较分析', path: '/industry-group' },
  'BGOV': { id: 'BGOV', code: 'BGOV', name: '政策跟踪', category: '行业分组分析', dataType: 'dashboard', description: '政府政策与财政分析', path: '/industry-group' },
  'BCY': { id: 'BCY', code: 'BCY', name: '行业周期', category: '行业分组分析', dataType: 'chart', description: '经济周期与行业轮动分析', path: '/industry-group' },
  'BSRCH_INDG': { id: 'BSRCH_INDG', code: 'BSRCH', name: '深度研究', category: '行业分组分析', dataType: 'research', description: '行业深度研究报告', path: '/industry-group' },
  'DCKM': { id: 'DCKM', code: 'DCKM', name: '行业分组分析', category: '行业分组分析', dataType: 'dashboard', description: '行业分组综合分析平台', path: '/industry-group' },
  // ── 电子交易界面 (2.13) ──
  'EMSX': { id: 'EMSX', code: 'EMSX', name: '电子交易系统', category: '电子交易', dataType: 'trading', description: 'Ucheer EMSX电子交易及委托单递送', path: '/electronic-trading' },
  'FIT2': { id: 'FIT2', code: 'FIT', name: '固定收益电子交易', category: '电子交易', dataType: 'trading', description: '固定收益产品电子交易平台', path: '/fixed-income-trade' },
  'NOTC': { id: 'NOTC', code: 'NOTC', name: 'NOTC 通知确认', category: '电子交易', dataType: 'trading', description: '通知与确认系统', path: '/electronic-trading?panel=NOTC' },

  'VCON': { id: 'VCON', code: 'VCON', name: 'VCON 语音确认', category: '电子交易', dataType: 'trading', description: '语音确认系统', path: '/electronic-trading?panel=VCON' },
  'UACK': { id: 'UACK', code: 'UACK', name: 'UACK 用户确认', category: '电子交易', dataType: 'trading', description: '用户确认系统', path: '/electronic-trading?panel=UACK' },
  // ── 交易簿 (2.15) ──
  'TBGS': { id: 'TBGS', code: 'TBGS', name: 'TBGS 交易簿汇总', category: '交易簿', dataType: 'dashboard', description: '高盛电子交易概览与交易簿全局汇总', path: '/trade-blotter' },
  'BTFI': { id: 'BTFI', code: 'BTFI', name: 'BTFI 交易簿期货信息', category: '交易簿', dataType: 'dashboard', description: '期货合约持仓明细与保证金占用', path: '/trade-blotter' },
  'TBMI': { id: 'TBMI', code: 'TBMI', name: 'TBMI 交易簿信息', category: '交易簿', dataType: 'analytics', description: '交易簿市场影响与成本分析', path: '/trade-blotter' },
  // ── 交易委托管理系统 (2.12) ──
  'AIM': { id: 'AIM', code: 'AIM', name: 'AIM 买方OMS', category: '交易委托管理', dataType: 'trading', description: 'AIM 买方委托管理系统（Order Management System）', path: '/order-management?panel=AIM' },
  'TOMS': { id: 'TOMS', code: 'TOMS', name: 'TOMS 卖方债券委托', category: '交易委托管理', dataType: 'trading', description: 'TOMS 卖方债券委托单管理系统', path: '/order-management?panel=TOMS' },
  'BBS': { id: 'BBS', code: 'BBS', name: 'BBS 买方解决方案', category: '交易委托管理', dataType: 'trading', description: 'Overview: Buy-Side Solutions', path: '/order-management?panel=BBS' },
  'BSS': { id: 'BSS', code: 'BSS', name: 'BSS 卖方解决方案', category: '交易委托管理', dataType: 'trading', description: 'Overview: Sell-Side Solutions', path: '/order-management?panel=BSS' },
  'TWC': { id: 'TWC', code: 'TWC', name: 'TWC TW配置', category: '交易委托管理', dataType: 'trading', description: 'TW配置系统', path: '/order-management?panel=TWC' },
  'RISK': { id: 'RISK', code: 'RISK', name: 'RISK MARS风险', category: '交易委托管理', dataType: 'trading', description: '概览：MARS风险分析系统', path: '/order-management?panel=RISK' },
  'MIFI': { id: 'MIFI', code: 'MIFI', name: 'MIFI MiFID II', category: '交易委托管理', dataType: 'trading', description: '概览：MiFID II解决方案', path: '/order-management?panel=MIFI' },
  'TTTT': { id: 'TTTT', code: 'TTTT', name: 'TTTT 定价号码状态', category: '交易委托管理', dataType: 'trading', description: '定价号码状态管理', path: '/order-management?panel=TTTT' },
  'EC': { id: 'EC', code: 'EC', name: 'EC 企业主控台', category: '交易委托管理', dataType: 'dashboard', description: '企业主控台', path: '/order-management?panel=EC' },
  'AIMH': { id: 'AIMH', code: 'AIMH', name: 'AIMH AIM功能说明', category: '交易委托管理', dataType: 'dashboard', description: 'AIM功能说明', path: '/order-management?panel=AIMH' },
  'HELP TOMS': { id: 'HELP TOMS', code: 'HELP TOMS', name: 'HELP TOMS 功能说明', category: '交易委托管理', dataType: 'dashboard', description: 'TOMS功能说明', path: '/order-management?panel=HELPTOMS' },
  'TSDM': { id: 'TSDM', code: 'TSDM', name: 'TSDM 交易系统演示', category: '交易委托管理', dataType: 'dashboard', description: 'TSDM 交易系统功能演示中心', path: '/order-management?panel=TSDM' },
  'BSKM': { id: 'BSKM', code: 'BSKM', name: 'BSKM ETF创建/赎回', category: '交易委托管理', dataType: 'trading', description: 'ETF一级市场创建/赎回管理', path: '/order-management?panel=BSKM' },
  'BSKT': { id: 'BSKT', code: 'BSKT', name: 'BSKT ETF创建赎回', category: '交易委托管理', dataType: 'trading', description: 'BSKT ETF一级市场创建与赎回委托', path: '/order-management?panel=BSKT' },
  'BSKA': { id: 'BSKA', code: 'BSKA', name: 'BSKA AP ETF委托', category: '交易委托管理', dataType: 'trading', description: 'AP ETF委托单管理', path: '/order-management?panel=BSKA' },
  'DSKM': { id: 'DSKM', code: 'DSKM', name: 'DSKM 券商权限', category: '交易委托管理', dataType: 'trading', description: 'BSKT券商交易台权限管理', path: '/order-management?panel=DSKM' },
  'CKMM': { id: 'CKMM', code: 'CKMM', name: 'CKMM ETF创建Beta', category: '交易委托管理', dataType: 'trading', description: 'ETF创建(Beta)', path: '/order-management?panel=CKMM' },
  'CKPV': { id: 'CKPV', code: 'CKPV', name: 'CKPV ETFP客户数据', category: '交易委托管理', dataType: 'trading', description: 'ETFP客户数据管理', path: '/order-management?panel=CKPV' },
  'CKPM': { id: 'CKPM', code: 'CKPM', name: 'CKPM ETF创建/赎回', category: '交易委托管理', dataType: 'trading', description: 'ETF创建/赎回生产环境', path: '/order-management?panel=CKPM' },
  'CKAP': { id: 'CKAP', code: 'CKAP', name: 'CKAP BSKT做市商', category: '交易委托管理', dataType: 'trading', description: 'BSKT做市商(Beta)', path: '/order-management?panel=CKAP' },
  'BSKAAP': { id: 'BSKAAP', code: 'BSKAAP', name: 'BSKAAP ETF委托管理', category: '交易委托管理', dataType: 'trading', description: 'BSKAAP ETF委托单管理与分配', path: '/order-management?panel=BSKA' },
  // ── STP 直通式处理解决方案 (2.14) ──
  'RESD': { id: 'RESD', code: 'RESD', name: 'EMIR报告', category: 'STP直通式处理', dataType: 'trading', description: 'MAV报告的EMIR初始用户界面', path: '/stp-processing?panel=RESD' },
  'FXTB': { id: 'FXTB', code: 'FXTB', name: 'FXGO交易记录簿', category: 'STP直通式处理', dataType: 'trading', description: 'FXGO外汇交易记录簿', path: '/stp-processing?panel=FXTB' },
  'FXSS': { id: 'FXSS', code: 'FXSS', name: '外汇确认和结算', category: 'STP直通式处理', dataType: 'trading', description: '外汇交易确认与结算系统', path: '/stp-processing?panel=FXSS' },
  'ALEX': { id: 'ALEX', code: 'ALEX', name: '分配记录簿', category: 'STP直通式处理', dataType: 'trading', description: '交易分配记录管理', path: '/stp-processing?panel=ALEX' },
  'TRPV': { id: 'TRPV', code: 'TRPV', name: '三方头寸浏览器', category: 'STP直通式处理', dataType: 'trading', description: '三方回购头寸浏览器', path: '/stp-processing?panel=TRPV' },
  'DTCP': { id: 'DTCP', code: 'DTCP', name: 'DTCC头寸显示', category: 'STP直通式处理', dataType: 'trading', description: 'DTCC清算头寸显示', path: '/stp-processing?panel=DTCP' },
  'POST': { id: 'POST', code: 'POST', name: 'STP交易后记录簿', category: 'STP直通式处理', dataType: 'trading', description: '交易后处理记录簿', path: '/stp-processing?panel=POST' },
  'STPE': { id: 'STPE', code: 'STPE', name: '记录簿管理', category: 'STP直通式处理', dataType: 'trading', description: 'STP记录簿管理系统', path: '/stp-processing?panel=STPE' },
  'ALOB': { id: 'ALOB', code: 'ALOB', name: '分配账户设定', category: 'STP直通式处理', dataType: 'trading', description: '分配账户参数设定', path: '/stp-processing?panel=ALOB' },
  'VCAD': { id: 'VCAD', code: 'VCAD', name: 'VCON全公司管理', category: 'STP直通式处理', dataType: 'trading', description: '全公司语音确认管理', path: '/stp-processing?panel=VCAD' },
  'ALOS': { id: 'ALOS', code: 'ALOS', name: '券商账户映射', category: 'STP直通式处理', dataType: 'trading', description: '券商账户映射管理', path: '/stp-processing?panel=ALOS' },
  'ESTP': { id: 'ESTP', code: 'ESTP', name: '启用BSTP', category: 'STP直通式处理', dataType: 'trading', description: '启用佑诚直通式处理', path: '/stp-processing?panel=ESTP' },
  'SPDL': { id: 'SPDL', code: 'SPDL', name: '交易支持目录', category: 'STP直通式处理', dataType: 'trading', description: '交易支持服务目录', path: '/stp-processing?panel=SPDL' },
  'MIFI_STP': { id: 'MIFI_STP', code: 'MIFI', name: 'MiFID II解决方案', category: 'STP直通式处理', dataType: 'trading', description: 'MiFID II监管合规解决方案', path: '/stp-processing?panel=MIFI' },
  'BRRS': { id: 'BRRS', code: 'BRRS', name: '监管报告', category: 'STP直通式处理', dataType: 'trading', description: '监管报告系统', path: '/stp-processing?panel=BRRS' },
  'RHUB': { id: 'RHUB', code: 'RHUB', name: '监管报告中心', category: 'STP直通式处理', dataType: 'trading', description: '监管报告集中管理中心', path: '/stp-processing?panel=RHUB' },
  'SREF': { id: 'SREF', code: 'SREF', name: 'STP转介屏幕', category: 'STP直通式处理', dataType: 'trading', description: 'STP转介处理屏幕', path: '/stp-processing?panel=SREF' },
  'FSTN': { id: 'FSTN', code: 'FSTN', name: 'FailStation工作站', category: 'STP直通式处理', dataType: 'trading', description: '交易失败处理工作站', path: '/stp-processing?panel=FSTN' },
  // ── ALLQ 全市场报价聚合 ──
  'ALLQ': { id: 'ALLQ', code: 'ALLQ', name: '全市场报价聚合', category: 'ALLQ报价聚合', dataType: 'trading', description: '多交易商报价聚合与最优执行', path: '/allq' },
  'FXAL': { id: 'FXAL', code: 'FXAL', name: '外汇全报价', category: 'ALLQ报价聚合', dataType: 'trading', description: '外汇市场全量报价聚合', path: '/allq' },
  'BQTE': { id: 'BQTE', code: 'BQTE', name: '债券报价聚合', category: 'ALLQ报价聚合', dataType: 'trading', description: '债券市场多交易商报价', path: '/allq' },
  'NBBO': { id: 'NBBO', code: 'NBBO', name: '全国最优买卖报价', category: 'ALLQ报价聚合', dataType: 'trading', description: 'NBBO实时追踪', path: '/allq' },

  // ── 固定收益交易 Fixed Income Trade ──
  'FITG': { id: 'FITG', code: 'FITG', name: 'FITG 固定收益交易网格', category: '固定收益交易', dataType: 'trading', description: '固定收益交易网格矩阵视图', path: '/fixed-income-trade' },
  'BOLT': { id: 'BOLT', code: 'BOLT', name: 'BOLT 多交易商报价', category: '固定收益交易', dataType: 'trading', description: '债券多交易商报价聚合与RFQ询价', path: '/fixed-income-trade' },
  'BLOT': { id: 'BLOT', code: 'BLOT', name: 'BLOT 电子交易记录簿', category: '固定收益交易', dataType: 'trading', description: '固定收益电子交易记录簿', path: '/fixed-income-trade' },
  'TSOX': { id: 'TSOX', code: 'TSOX', name: 'TSOX 执行质量分析', category: '固定收益交易', dataType: 'analytics', description: '固定收益执行质量分析（VWAP/TWAP/到达价格/实施缺口）', path: '/fixed-income-trade' },
  'PTBB': { id: 'PTBB', code: 'PTBB', name: 'PTBB 组合交易篮子', category: '固定收益交易', dataType: 'trading', description: '多债券组合交易篮子管理', path: '/fixed-income-trade' },
  'IMGR': { id: 'IMGR', code: 'IMGR', name: 'IMGR 库存与定价', category: '固定收益交易', dataType: 'dashboard', description: '交易商库存头寸与定价管理', path: '/fixed-income-trade' },
  'BBTM': { id: 'BBTM', code: 'BBTM', name: 'BBTM 佑诚债券交易监控', category: '固定收益交易', dataType: 'trading', description: '佑诚债券交易监控系统', path: '/fixed-income-trade' },
  'TRDEM': { id: 'TRDEM', code: 'TRDEM', name: 'TRDEM 交易演示', category: '固定收益交易', dataType: 'trading', description: '固定收益交易系统演示', path: '/fixed-income-trade' },
  'ETBTS': { id: 'ETBTS', code: 'ETBTS', name: 'ETBTS 电子交易统计', category: '固定收益交易', dataType: 'analytics', description: '电子交易统计分析', path: '/fixed-income-trade' },
  'WATL': { id: 'WATL', code: 'WATL', name: 'WATL 交易警报', category: '固定收益交易', dataType: 'trading', description: '交易警报与通知系统', path: '/fixed-income-trade' },

  // ── BMAP 全球热力地图 ──
  'BMAP': { id: 'BMAP', code: 'BMAP', name: 'BMAP 全球市场热力地图', category: '平台工具', dataType: 'dashboard', description: '全球各国市场表现热力地图：股票收益/GDP/通胀/利率/风险评分/资本流动', path: '/bmap' },

  // ── BSRCH 全市场搜索 ──
  'BSRCH': { id: 'BSRCH', code: 'BSRCH', name: 'BSRCH 佑诚智能搜索', category: '平台工具', dataType: 'research', description: '全市场智能搜索引擎：股票/债券/外汇/商品/指数/新闻/经济数据', path: '/bsrch' },

  // ── BVOL 波动率分析台 ──
  'BVOL': { id: 'BVOL', code: 'BVOL', name: 'BVOL 波动率分析台', category: '平台工具', dataType: 'analytics', description: '波动率曲面/期限结构/历史RV vs IV/VIX生态系统/波动率锥', path: '/bvol' },

  // ── 电子交易及委托单递送系统 31个面板 ──
  'GOVT': { id: 'GOVT', code: 'GOVT', name: '国债市场行情', category: '电子交易', dataType: 'trading', description: '国债行情报价与收益率曲线', path: '/electronic-trading?panel=GOVT' },
  'CORP': { id: 'CORP', code: 'CORP', name: '公司债', category: '电子交易', dataType: 'trading', description: '公司债电子交易', path: '/electronic-trading?panel=CORP' },
  'AGENCY': { id: 'AGENCY', code: 'AGENCY', name: '机构债/MBS', category: '电子交易', dataType: 'trading', description: '美国机构债与抵押债', path: '/electronic-trading?panel=AGENCY' },
  'EM': { id: 'EM', code: 'EM', name: '新兴市场', category: '电子交易', dataType: 'trading', description: '新兴市场债券电子交易', path: '/electronic-trading?panel=EM' },
  'TRDE': { id: 'TRDE', code: 'TRDE', name: 'TRDE 多品种列表', category: '电子交易', dataType: 'trading', description: '多品种列表交易', path: '/electronic-trading?panel=TRDE' },
  'EBND': { id: 'EBND', code: 'EBND', name: 'EBND 电子债券', category: '电子交易', dataType: 'trading', description: '电子债券交易', path: '/electronic-trading?panel=EBND' },
  'MUNI': { id: 'MUNI', code: 'MUNI', name: '地方债', category: '电子交易', dataType: 'trading', description: '地方债电子交易', path: '/electronic-trading?panel=MUNI' },
  'MBWD': { id: 'MBWD', code: 'MBWD', name: 'MBWD 地方债问询', category: '电子交易', dataType: 'trading', description: '地方债买价问询', path: '/electronic-trading?panel=MBWD' },
  'PICK': { id: 'PICK', code: 'PICK', name: 'PICK 地方债发行', category: '电子交易', dataType: 'trading', description: '地方债发行管理', path: '/electronic-trading?panel=PICK' },
  'IMGRMUNI': { id: 'IMGRMUNI', code: 'IMGRMUNI', name: 'IMGR MUNI', category: '电子交易', dataType: 'trading', description: '地方债库存与价格', path: '/electronic-trading?panel=IMGRMUNI' },
  'IRSWAP': { id: 'IRSWAP', code: 'IRSWAP', name: '利率掉期', category: '电子交易', dataType: 'trading', description: '利率掉期流动性', path: '/electronic-trading?panel=IRSWAP' },
  'CDS': { id: 'CDS', code: 'CDS', name: 'CDS 信用违约掉期', category: '电子交易', dataType: 'trading', description: '信用违约掉期电子交易', path: '/electronic-trading?panel=CDS' },
  'EQUITY': { id: 'EQUITY', code: 'EQUITY', name: '股票交易', category: '电子交易', dataType: 'trading', description: '股票电子交易', path: '/electronic-trading?panel=EQUITY' },
  'FX': { id: 'FX', code: 'FX', name: '外汇交易', category: '电子交易', dataType: 'trading', description: '外汇电子交易', path: '/electronic-trading?panel=FX' },
  'WORKFLOW': { id: 'WORKFLOW', code: 'WORKFLOW', name: '工作流程', category: '电子交易', dataType: 'trading', description: '工作流程工具', path: '/electronic-trading?panel=WORKFLOW' },
  'ETBT': { id: 'ETBT', code: 'ETBT', name: 'ETBT 单品种记录簿', category: '电子交易', dataType: 'trading', description: '单品种电子交易记录簿', path: '/electronic-trading?panel=ETBT' },
  'MONEY': { id: 'MONEY', code: 'MONEY', name: '货币市场', category: '电子交易', dataType: 'trading', description: '货币市场回购融资', path: '/electronic-trading?panel=MONEY' },
  'BOOM': { id: 'BOOM', code: 'BOOM', name: 'BOOM 委托单管理', category: '电子交易', dataType: 'trading', description: '债券委托单管理', path: '/electronic-trading?panel=BOOM' },
  'MIFIET': { id: 'MIFIET', code: 'MIFIET', name: 'MIFI MiFID II', category: '电子交易', dataType: 'trading', description: 'MiFID II电子交易合规', path: '/electronic-trading?panel=MIFIET' },
  // ── 交易账簿管理 9个面板 ──
  'TBSTOCK': { id: 'TBSTOCK', code: 'TBSTOCK', name: '交易账簿股票', category: '交易账簿管理', dataType: 'trading', description: '股票交易账簿发售管理', path: '/trading-ledger?panel=STOCK' },
  'TBFUTURES': { id: 'TBFUTURES', code: 'TBFUTURES', name: '交易账簿期货', category: '交易账簿管理', dataType: 'trading', description: '期货交易账簿发售管理', path: '/trading-ledger?panel=FUTURES' },
  'TBOPTIONS': { id: 'TBOPTIONS', code: 'TBOPTIONS', name: '交易账簿期权', category: '交易账簿管理', dataType: 'trading', description: '期权交易账簿发售管理', path: '/trading-ledger?panel=OPTIONS' },
  'TBAIM': { id: 'TBAIM', code: 'TBAIM', name: 'AIM 资产指令管理系统', category: '交易账簿管理', dataType: 'trading', description: '资产指令管理系统', path: '/trading-ledger?panel=AIM' },
  'TBTOMS': { id: 'TBTOMS', code: 'TBTOMS', name: 'TOMS 交易订单管理系统', category: '交易账簿管理', dataType: 'trading', description: '交易订单管理系统', path: '/trading-ledger?panel=TOMS' },
  'TBTSDM': { id: 'TBTSDM', code: 'TBTSDM', name: 'TSDM 交易结算与交收管理', category: '交易账簿管理', dataType: 'trading', description: '交易结算与交收管理', path: '/trading-ledger?panel=TSDM' },
};

/**
 * 处理菜单项点击事件
 */
export function handleMenuItemClick(
  itemId: string,
  itemName: string,
  onNavigate?: (path: string, data: MenuItemConfig) => void
) {
  const config = MENU_ITEM_CONFIG[itemId];
  const mergedFeature = findTerminalFeature(itemId);

  if (!config) {
    // 顶层重复入口走已有工作台，不再生成 /menu-item/* 假页面。
    // 具体功能码仍由各模块自己的专用分发器负责。
    if (mergedFeature?.routeOnly) {
      const mergedConfig = {
        id: mergedFeature.id,
        code: itemId,
        name: mergedFeature.label,
        category: mergedFeature.group,
        dataType: 'dashboard',
        description: `已合并到${mergedFeature.label}工作台`,
        path: mergedFeature.canonicalPath,
      } as MenuItemConfig;
      onNavigate?.(mergedFeature.canonicalPath, mergedConfig);
      toast.success(`已打开 ${mergedFeature.label}`, {
        description: '使用统一工作台，避免重复数据请求',
        duration: 2000,
      });
      return;
    }

    // 没有配置时也导航到功能页面
    const fallbackPath = `/menu-item/${itemId}`;
    if (onNavigate) {
      onNavigate(fallbackPath, { type: 'dashboard', description: itemName, dataKey: itemId.toLowerCase() } as any);
    }
    toast.success(`已打开 ${itemName}`, {
      description: '数据面板已加载',
      duration: 2000,
    });
    return;
  }

    // 优先使用 config.path，否则回退到 menu-item 通用页面
  const path =
    config.path ??
    (mergedFeature?.routeOnly ? mergedFeature.canonicalPath : undefined) ??
    `/menu-item/${itemId}`;
  if (onNavigate) {
    onNavigate(path, config);
  }

  toast.success(`已打开 ${itemName}`, {
    description: config.description,
    duration: 2000,
  });
}

/**
 * 兼容旧调用的数据契约。真实数据由各页面的后端查询或模块推送提供；
 * 这里不再生成随机值、静态证券报价或伪装来源。
 */
export function generateMenuItemData(itemId: string): any {
  const config = MENU_ITEM_CONFIG[itemId];
  
  if (!config) {
    const fallbackData: any[] = [];
    return {
      title: itemId,
      description: `${itemId} 数据面板`,
      data: fallbackData,
      metadata: {
        lastUpdated: new Date().toISOString(),
        source: '未配置',
        dataPoints: fallbackData.length,
      },
    };
  }

  // 根据数据类型生成相应的数据
  const baseData = generateBaseData(itemId, config.dataType);

  return {
    title: config.name,
    description: config.description || '',
    data: baseData,
    metadata: {
      lastUpdated: new Date().toISOString(),
      source: baseData.length ? '模块后端契约' : '未配置',
      dataPoints: baseData.length,
    },
  };
}

/**
 * 根据数据类型生成基础数据
 */
function generateBaseData(itemId: string, dataType: string): any[] {
  switch (dataType) {
    case 'chart':
      return generateChartData(itemId);
    case 'table':
      return generateTableData(itemId);
    case 'dashboard':
      return generateDashboardData(itemId);
    case 'analysis':
      return generateAnalysisData(itemId);
    case 'trading':
      return generateTradingData(itemId);
    case 'news':
      return generateNewsData(itemId);
    case 'research':
      return generateResearchData(itemId);
    default:
      return [];
  }
}

function generateChartData(itemId: string): any[] {
  void itemId;
  return [];
}

function generateTableData(itemId: string): any[] {
  void itemId;
  return [];
}

function generateDashboardData(itemId: string): any[] {
  void itemId;
  return [];
}

function generateAnalysisData(itemId: string): any[] {
  void itemId;
  return [];
}

function generateTradingData(itemId: string): any[] {
  void itemId;
  return [];
}

function generateNewsData(itemId: string): any[] {
  void itemId;
  return [];
}

function generateResearchData(itemId: string): any[] {
  void itemId;
  return [];
}

/**
 * 获取菜单项的导航路径
 */
export function getMenuItemPath(itemId: string): string {
  const config = MENU_ITEM_CONFIG[itemId];
  if (config && config.path) {
    return config.path;
  }
  const mergedFeature = findTerminalFeature(itemId);
  if (mergedFeature?.routeOnly) {
    return mergedFeature.canonicalPath;
  }
  return `/menu-item/${itemId}`;
}

/**
 * 验证菜单项是否存在
 */
export function isValidMenuItem(itemId: string): boolean {
  return itemId in MENU_ITEM_CONFIG;
}
