import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Zap, Shield, Eye, ChevronRight, RefreshCw, Bell, BellOff, Filter, Download, X } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface GlobalSignalDashboardProps {
  onClose: () => void;
  onNavigateToPanel?: (panelId: string) => void;
}

// ─── 信号定义 ─────────────────────────────────────────────────────────────────
type AssetClass = 'RATES' | 'MM' | 'FX' | 'DERIVATIVES' | 'INTELLIGENCE';

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  RATES: '利率/国债',
  MM: '货币市场',
  FX: '外汇',
  DERIVATIVES: '衍生品',
  INTELLIGENCE: '情报/新闻',
};

interface Signal {
  id: string;
  panelId: string;       // 对应货币市场面板的 id
  panelCode: string;     // 面板代码（如 MKTBEAT）
  panelName: string;     // 面板名称
  signalName: string;    // 信号名称
  winRate: number;       // 胜率（%）
  direction: 'LONG' | 'SHORT' | 'NEUTRAL' | 'ALERT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  assetClass: AssetClass; // 资产类别
  value: string;         // 当前数值
  threshold: string;     // 触发阈值
  description: string;  // 信号描述
  actionSuggestion: string; // 操作建议
  triggered: boolean;    // 是否已触发
  triggeredAt?: string;  // 触发时间
  history: number[];     // 历史信号强度（用于迷你图）
}

// ─── 种子随机数（确保数据稳定可复现）────────────────────────────────────────
let _seed = 20240624;
const rng = () => {
  _seed = (_seed ^ (_seed << 13)) >>> 0;
  _seed = (_seed ^ (_seed >> 7)) >>> 0;
  _seed = (_seed ^ (_seed << 17)) >>> 0;
  return _seed / 0xFFFFFFFF;
};
const stableRand = (min: number, max: number, offset = 0) => {
  let s = _seed + offset;
  s = (s ^ (s << 13)) >>> 0;
  s = (s ^ (s >> 7)) >>> 0;
  s = (s ^ (s << 17)) >>> 0;
  return min + (s / 0xFFFFFFFF) * (max - min);
};

const generateHistory = (base: number, len = 20): number[] => {
  const arr: number[] = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    v += (rng() - 0.5) * 8;
    v = Math.max(50, Math.min(100, v));
    arr.push(Math.round(v * 10) / 10);
  }
  return arr;
};

// ─── 静态信号数据（22个面板的核心预警信号）──────────────────────────────────
const SIGNALS: Signal[] = [
  {
    id: 'mktbeat-attractor',
    panelId: 'mktbeat',
    panelCode: 'MKTBEAT',
    panelName: '当前市场',
    signalName: '吸引子崩塌预警',
    winRate: 80,
    direction: 'ALERT',
    severity: 'CRITICAL',
    assetClass: 'MM' as AssetClass,
    value: '坍塌概率 83.2%',
    threshold: '≥80% 触发',
    description: '市场微观结构吸引子检测到相变临界点，流动性分形维度骤降至 1.31，系统性风险累积。',
    actionSuggestion: '立即减少高久期头寸，增加短端流动性储备，关注 BTMM 国债市场异动。',
    triggered: true,
    triggeredAt: '14:23:07',
    history: generateHistory(80),
  },
  {
    id: 'tcon-montecarlo',
    panelId: 'tcon',
    panelCode: 'TCON',
    panelName: '国债控制面板',
    signalName: '蒙特卡洛路径 P95 突破',
    winRate: 78,
    direction: 'SHORT',
    severity: 'HIGH',
    assetClass: 'RATES' as AssetClass,
    value: 'P95 = 4.87%',
    threshold: '≥4.80% 触发',
    description: '10000条蒙特卡洛路径中，P95 收益率突破 4.80% 关键阻力位，尾部风险显著扩大。',
    actionSuggestion: '启动 Gamma 对冲程序，压缩 DV01 敞口至目标区间 ±50k。',
    triggered: true,
    triggeredAt: '14:18:42',
    history: generateHistory(75),
  },
  {
    id: 'ycqsim-phase',
    panelId: 'ycqsim',
    panelCode: 'YCQSIM',
    panelName: '收益曲线量子模拟',
    signalName: '相变预警（量子纠缠断裂）',
    winRate: 82,
    direction: 'ALERT',
    severity: 'CRITICAL',
    assetClass: 'RATES' as AssetClass,
    value: '纠缠熵 0.71 nats',
    threshold: '≥0.65 触发',
    description: '2Y-10Y 量子纠缠态检测到去相干化，路径积分云图出现双峰分裂，曲线形态即将突变。',
    actionSuggestion: '关注曲线陡峭化/平坦化方向，布局 2s10s 利差期权对冲。',
    triggered: true,
    triggeredAt: '14:31:15',
    history: generateHistory(82),
  },
  {
    id: 'efsf-critical',
    panelId: 'efsf',
    panelCode: 'EFSF',
    panelName: 'EFSF EMTN M-Mkt',
    signalName: '临界点爆发预警',
    winRate: 80,
    direction: 'SHORT',
    severity: 'HIGH',
    assetClass: 'MM' as AssetClass,
    value: '利差 +187bp',
    threshold: '≥180bp 触发',
    description: 'EFSF EMTN 与基准利差突破 180bp 临界点，欧元区外围国家风险溢价快速扩张。',
    actionSuggestion: '减持欧元区外围债券敞口，增配德国国债作为避险资产。',
    triggered: true,
    triggeredAt: '13:55:30',
    history: generateHistory(78),
  },
  {
    id: 'mmidx-water',
    panelId: 'mmidx',
    panelCode: 'MMIDX',
    panelName: '货币市场指数',
    signalName: '流动性水位驤降',
    winRate: 88,
    direction: 'ALERT',
    severity: 'CRITICAL',
    assetClass: 'MM' as AssetClass,
    value: '水位指数 12.3%',
    threshold: '≤15% 触发',
    description: '货币市场综合流动性指数骤降至 12.3%，银行间拆借利差扩大至 45bp，流动性危机信号。',
    actionSuggestion: '立即启动流动性应急预案，向央行申请 MLF/SLF 操作窗口。',
    triggered: true,
    triggeredAt: '14:05:18',
    history: generateHistory(90),
  },
  {
    id: 'mmidx-repo',
    panelId: 'mmidx',
    panelCode: 'MMIDX',
    panelName: '货币市场指数',
    signalName: '回购利率异常飙升',
    winRate: 95,
    direction: 'ALERT',
    severity: 'CRITICAL',
    assetClass: 'MM' as AssetClass,
    value: 'GC Repo 5.82%',
    threshold: '≥5.50% 触发',
    description: 'GC 回购利率飙升至 5.82%，超出联邦基金利率上限 57bp，市场资金面极度紧张。',
    actionSuggestion: '暂停新增杠杆，优先偿还到期回购，关注 Fed 是否启动临时 REPO 操作。',
    triggered: true,
    triggeredAt: '14:42:03',
    history: generateHistory(93),
  },
  {
    id: 'etrade-algo',
    panelId: 'etrade',
    panelCode: 'ETRADE',
    panelName: '电子交易',
    signalName: '算法交易异常暴露',
    winRate: 85,
    direction: 'ALERT',
    severity: 'HIGH',
    assetClass: 'MM' as AssetClass,
    value: '算法占比 73.4%',
    threshold: '≥70% 触发',
    description: '电子交易平台检测到算法交易占比异常升至 73.4%，市场深度急剧下降，闪崩风险上升。',
    actionSuggestion: '切换至 VWAP/TWAP 算法，分散执行时间窗口，避免触发熔断机制。',
    triggered: true,
    triggeredAt: '14:28:55',
    history: generateHistory(83),
  },
  {
    id: 'pboc-policy',
    panelId: 'pboc',
    panelCode: 'PBOC',
    panelName: '中国人民銀行',
    signalName: '政策转向信号',
    winRate: 90,
    direction: 'LONG',
    severity: 'HIGH',
    assetClass: 'RATES' as AssetClass,
    value: 'MLF 降息 15bp',
    threshold: '降息≥10bp 触发',
    description: '人民银行意外下调 MLF 利率 15bp，叠加 RRR 降准 0.5%，货币政策明显转向宽松。',
    actionSuggestion: '增配中短端利率债，布局利率互换收取固定端，关注 LPR 跟随下调节奏。',
    triggered: true,
    triggeredAt: '09:15:00',
    history: generateHistory(88),
  },
  {
    id: 'pboc-cny',
    panelId: 'pboc',
    panelCode: 'PBOC',
    panelName: '中国人民銀行',
    signalName: '人民币汇率中间价偏离',
    winRate: 82,
    direction: 'ALERT',
    severity: 'MEDIUM',
    assetClass: 'FX' as AssetClass,
    value: '偏离 +312pips',
    threshold: '≥300pips 触发',
    description: '人民币中间价较市场预期偏离 312pips，央行干预意图明显，汇率管理机制趋严。',
    actionSuggestion: '压缩 CNY 空头头寸，关注跨境资本流动管制风险。',
    triggered: true,
    triggeredAt: '09:30:00',
    history: generateHistory(80),
  },
  {
    id: 'twdi-outflow',
    panelId: 'twdi',
    panelCode: 'TWDI',
    panelName: '台北拆款利率',
    signalName: '外资净流出预警',
    winRate: 80,
    direction: 'SHORT',
    severity: 'HIGH',
    assetClass: 'FX' as AssetClass,
    value: '净流出 NT$182亿',
    threshold: '≥NT$150亿 触发',
    description: '台湾债券市场单日外资净流出 NT$182 亿，连续三日净流出累计超 NT$500 亿，资金外逃迹象明显。',
    actionSuggestion: '减持台湾公债，关注 TAIBOR 利率上行压力及新台币贬值风险。',
    triggered: true,
    triggeredAt: '15:00:00',
    history: generateHistory(78),
  },
  {
    id: 'news-sentiment',
    panelId: 'news-mm',
    panelCode: 'NEWS',
    panelName: '新闻与研究报告',
    signalName: '预期偏离度突破',
    winRate: 80,
    direction: 'ALERT',
    severity: 'MEDIUM',
    assetClass: 'INTELLIGENCE' as AssetClass,
    value: '偏离指数 2.34σ',
    threshold: '≥2.0σ 触发',
    description: 'NLP 情绪模型检测到市场预期与实际数据偏离达 2.34 个标准差，重大认知差异窗口开启。',
    actionSuggestion: '关注即将发布的 CPI/NFP 数据，布局预期修正方向的波动率策略。',
    triggered: true,
    triggeredAt: '13:45:22',
    history: generateHistory(80),
  },
  {
    id: 'boom-auction',
    panelId: 'boom',
    panelCode: 'BOOM',
    panelName: '货币市场发售',
    signalName: '拍卖尾部利率异常',
    winRate: 83,
    direction: 'SHORT',
    severity: 'HIGH',
    assetClass: 'MM' as AssetClass,
    value: '尾部利率 +8.2bp',
    threshold: '≥5bp 触发',
    description: '国债拍卖尾部利率较中标利率高出 8.2bp，认购倍数降至 1.87x，市场需求明显疲弱。',
    actionSuggestion: '避免在拍卖前建立长端多头，等待拍卖后价格企稳再考虑布局。',
    triggered: true,
    triggeredAt: '11:30:00',
    history: generateHistory(81),
  },
  {
    id: 'rv-arbitrage',
    panelId: 'rv',
    panelCode: 'RV',
    panelName: '相对价値',
    signalName: '套利窗口开启（Z-Score 极値）',
    winRate: 84,
    direction: 'LONG',
    severity: 'HIGH',
    assetClass: 'DERIVATIVES' as AssetClass,
    value: 'Z-Score = -2.87',
    threshold: '≤-2.5 触发',
    description: '5Y-7Y 利差 Z-Score 达到 -2.87，历史分位数 2.1%，均值回归套利窗口开启。',
    actionSuggestion: '做多 5Y、做空 7Y，目标利差收窄 12bp，止损设置在 Z-Score -3.5。',
    triggered: true,
    triggeredAt: '14:10:33',
    history: generateHistory(84),
  },
  {
    id: 'cenb-diverge',
    panelId: 'cenb',
    panelCode: 'CENB',
    panelName: '央行查找',
    signalName: '全球央行政策分化加剧',
    winRate: 81,
    direction: 'ALERT',
    severity: 'MEDIUM',
    assetClass: 'INTELLIGENCE' as AssetClass,
    value: '分化指数 87.3',
    threshold: '≥80 触发',
    description: '全球主要央行政策分化指数升至 87.3（满分100），美联储鹰派与日本央行鸽派形成极端对立。',
    actionSuggestion: '布局 USD/JPY 利差扩大策略，关注跨境套利资金流向对新兴市场的冲击。',
    triggered: true,
    triggeredAt: '08:00:00',
    history: generateHistory(79),
  },
  {
    id: 'edsf-basis',
    panelId: 'edsf',
    panelCode: 'EDSF',
    panelName: 'ED合成FRA',
    signalName: '非线性基差修正信号',
    winRate: 81,
    direction: 'LONG',
    severity: 'MEDIUM',
    assetClass: 'DERIVATIVES' as AssetClass,
    value: '基差 -18.3bp',
    threshold: '≤-15bp 触发',
    description: 'ED 期货与 OIS 之间的非线性基差收窄至 -18.3bp，信用基差时序演化显示均值回归动能。',
    actionSuggestion: '做多 ED 期货基差，目标回归至 -8bp，设置 -25bp 止损。',
    triggered: true,
    triggeredAt: '14:35:47',
    history: generateHistory(79),
  },
];

// ─── 严重程度颜色 ─────────────────────────────────────────────────────────────
const severityConfig = {
  CRITICAL: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', badge: 'bg-red-500', dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400', badge: 'bg-orange-500', dot: 'bg-orange-500' },
  MEDIUM:   { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400', badge: 'bg-yellow-500', dot: 'bg-yellow-500' },
};

const directionConfig = {
  LONG:    { icon: TrendingUp, color: 'text-green-400', label: '做多' },
  SHORT:   { icon: TrendingDown, color: 'text-red-400', label: '做空' },
  NEUTRAL: { icon: Activity, color: 'text-gray-400', label: '中性' },
  ALERT:   { icon: AlertTriangle, color: 'text-amber-400', label: '预警' },
};

// ─── 迷你折线图 ───────────────────────────────────────────────────────────────
const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ─── 信号卡片 ─────────────────────────────────────────────────────────────────
const SignalCard: React.FC<{
  signal: Signal;
  onNavigate: (panelId: string) => void;
  muted: boolean;
  onToggleMute: (id: string) => void;
}> = ({ signal, onNavigate, muted, onToggleMute }) => {
  const sev = severityConfig[signal.severity];
  const dir = directionConfig[signal.direction];
  const DirIcon = dir.icon;
  const sparkColor = signal.direction === 'LONG' ? '#22c55e' : signal.direction === 'SHORT' ? '#ef4444' : '#f59e0b';

  return (
    <div className={`relative rounded-lg border ${sev.border} ${sev.bg} p-4 flex flex-col gap-3 transition-all hover:brightness-110`}>
      {/* 顶部：严重程度 + 面板代码 + 静音按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sev.dot} ${signal.triggered ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${sev.badge} text-white`}>{signal.severity}</span>
          <span className="text-xs text-gray-400 font-mono">{signal.panelCode}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${sev.text}`}>胜率 {signal.winRate}%</span>
          <button
            onClick={() => onToggleMute(signal.id)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title={muted ? '取消静音' : '静音此信号'}
          >
            {muted ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 信号名称 + 方向 */}
      <div className="flex items-start gap-2">
        <DirIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dir.color}`} />
        <div>
          <div className="text-sm font-semibold text-gray-100">{signal.signalName}</div>
          <div className="text-xs text-gray-400 mt-0.5">{signal.panelName}</div>
        </div>
      </div>

      {/* 当前值 + 阈值 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-black/30 rounded px-2 py-1.5">
          <div className="text-gray-500 mb-0.5">当前值</div>
          <div className={`font-mono font-bold ${sev.text}`}>{signal.value}</div>
        </div>
        <div className="bg-black/30 rounded px-2 py-1.5">
          <div className="text-gray-500 mb-0.5">触发阈值</div>
          <div className="font-mono text-gray-300">{signal.threshold}</div>
        </div>
      </div>

      {/* 迷你走势图 */}
      <div className="h-9">
        <MiniSparkline data={signal.history} color={sparkColor} />
      </div>

      {/* 信号描述 */}
      <p className="text-xs text-gray-400 leading-relaxed">{signal.description}</p>

      {/* 操作建议 */}
      <div className="bg-black/20 rounded px-3 py-2 border-l-2 border-amber-500/50">
        <div className="text-xs text-amber-400 font-semibold mb-1 flex items-center gap-1">
          <Zap className="w-3 h-3" /> 操作建议
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{signal.actionSuggestion}</p>
      </div>

      {/* 底部：触发时间 + 跳转按钮 */}
      <div className="flex items-center justify-between pt-1 border-t border-white/10">
        {signal.triggeredAt ? (
          <span className="text-xs text-gray-500">触发时间 {signal.triggeredAt}</span>
        ) : (
          <span className="text-xs text-gray-600">监控中...</span>
        )}
        <button
          onClick={() => onNavigate(signal.panelId)}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium"
        >
          跳转面板 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ─── 统计汇总卡片 ─────────────────────────────────────────────────────────────
const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({ label, value, sub, color = 'text-amber-400' }) => (
  <div className="bg-gray-800/60 rounded-lg px-4 py-3 border border-gray-700/50">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
  </div>
);

// ─── 主组件 ───────────────────────────────────────────────────────────────────
const GlobalSignalDashboard: React.FC<GlobalSignalDashboardProps> = ({ onClose, onNavigateToPanel }) => {
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [dirFilter, setDirFilter] = useState<'ALL' | 'LONG' | 'SHORT' | 'ALERT'>('ALL');
  const [assetFilter, setAssetFilter] = useState<'ALL' | AssetClass>('ALL');
  const [minWinRate, setMinWinRate] = useState<number>(0);
  const [searchText, setSearchText] = useState('');
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [showMuted, setShowMuted] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);

  // 模拟刷新
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLastRefresh(new Date());
      setRefreshing(false);
    }, 800);
  }, []);

  // 自动刷新（每30秒）
  useEffect(() => {
    const timer = setInterval(handleRefresh, 30000);
    return () => clearInterval(timer);
  }, [handleRefresh]);

  const toggleMute = (id: string) => {
    setMutedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 过滤信号
  const filteredSignals = SIGNALS.filter(s => {
    if (!showMuted && mutedIds.has(s.id)) return false;
    if (filter !== 'ALL' && s.severity !== filter) return false;
    if (dirFilter !== 'ALL' && s.direction !== dirFilter) return false;
    if (assetFilter !== 'ALL' && s.assetClass !== assetFilter) return false;
    if (minWinRate > 0 && s.winRate < minWinRate) return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      if (!s.signalName.toLowerCase().includes(q) && !s.panelName.toLowerCase().includes(q) && !s.panelCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // 活跃筛选数量
  const activeFilterCount = [filter !== 'ALL', dirFilter !== 'ALL', assetFilter !== 'ALL', minWinRate > 0, searchText.trim() !== ''].filter(Boolean).length;

  const resetFilters = () => {
    setFilter('ALL');
    setDirFilter('ALL');
    setAssetFilter('ALL');
    setMinWinRate(0);
    setSearchText('');
  };

  const criticalCount = SIGNALS.filter(s => s.severity === 'CRITICAL').length;
  const highCount = SIGNALS.filter(s => s.severity === 'HIGH').length;
  const mediumCount = SIGNALS.filter(s => s.severity === 'MEDIUM').length;
  const triggeredCount = SIGNALS.filter(s => s.triggered).length;
  const avgWinRate = Math.round(SIGNALS.reduce((a, s) => a + s.winRate, 0) / SIGNALS.length);

  // 导出 CSV
  const handleExport = () => {
    const rows = [
      ['面板代码', '信号名称', '胜率', '方向', '严重程度', '当前值', '触发阈值', '触发时间', '操作建议'],
      ...SIGNALS.map(s => [s.panelCode, s.signalName, `${s.winRate}%`, s.direction, s.severity, s.value, s.threshold, s.triggeredAt || '-', s.actionSuggestion]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `global-signals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* ── 顶部标题栏 ── */}
      <div className="flex-shrink-0 bg-gray-900 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                全局信号监控看板
                <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-mono">
                  {triggeredCount} ACTIVE
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                集中展示所有胜率 ≥80% 的预警信号 · 最后刷新 {lastRefresh.toLocaleTimeString('zh-CN')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> 导出 CSV
            </button>
            <button
              onClick={handleRefresh}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors ${refreshing ? 'opacity-60' : ''}`}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> 刷新
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 统计汇总 ── */}
      <div className="flex-shrink-0 px-4 py-3 grid grid-cols-5 gap-3 border-b border-gray-800">
        <StatCard label="总信号数" value={SIGNALS.length} sub="胜率≥80%" color="text-amber-400" />
        <StatCard label="CRITICAL" value={criticalCount} sub="立即处理" color="text-red-400" />
        <StatCard label="HIGH" value={highCount} sub="优先关注" color="text-orange-400" />
        <StatCard label="MEDIUM" value={mediumCount} sub="持续监控" color="text-yellow-400" />
        <StatCard label="平均胜率" value={`${avgWinRate}%`} sub="历史验证" color="text-green-400" />
      </div>

      {/* ── 多维度筛选器 ── */}
      <div className="flex-shrink-0 border-b border-gray-800 bg-gray-900/50">
        {/* 第一行：搜索框 + 展开按钮 */}
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜索信号名称、面板代码..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button
            onClick={() => setFilterExpanded(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border transition-colors ${
              filterExpanded || activeFilterCount > 0
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            筛选
            {activeFilterCount > 0 && (
              <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{activeFilterCount}</span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">重置</button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowMuted(v => !v)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${showMuted ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              {showMuted ? '隐藏已静音' : '显示已静音'}
            </button>
            <span className="text-xs text-gray-500">共 {filteredSignals.length} 个信号</span>
          </div>
        </div>

        {/* 第二行：可折叠的多维度筛选面板 */}
        {filterExpanded && (
          <div className="px-4 pb-3 space-y-2.5 border-t border-gray-800/60 pt-2.5">
            {/* 严重程度 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">严重程度</span>
              <div className="flex items-center gap-1">
                {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      filter === f
                        ? f === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : f === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                          : f === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {f === 'ALL' ? '全部' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* 信号方向 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">信号方向</span>
              <div className="flex items-center gap-1">
                {(['ALL', 'LONG', 'SHORT', 'ALERT', 'NEUTRAL'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDirFilter(f as any)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      dirFilter === f
                        ? f === 'LONG' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                          : f === 'SHORT' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : f === 'ALERT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-gray-500/20 text-gray-300 border border-gray-500/40'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {f === 'ALL' ? '全部' : f === 'LONG' ? '做多' : f === 'SHORT' ? '做空' : f === 'ALERT' ? '预警' : '中性'}
                  </button>
                ))}
              </div>
            </div>

            {/* 资产类别 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">资产类别</span>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setAssetFilter('ALL')}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    assetFilter === 'ALL' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                  }`}
                >全部</button>
                {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map(cls => {
                  const count = SIGNALS.filter(s => s.assetClass === cls).length;
                  return (
                    <button
                      key={cls}
                      onClick={() => setAssetFilter(cls)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                        assetFilter === cls ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                      }`}
                    >
                      {ASSET_CLASS_LABELS[cls]}
                      <span className="text-gray-600 font-mono">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 最低胜率 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-16 flex-shrink-0">最低胜率</span>
              <div className="flex items-center gap-1">
                {[0, 80, 85, 90, 95].map(v => (
                  <button
                    key={v}
                    onClick={() => setMinWinRate(v)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      minWinRate === v ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {v === 0 ? '不限' : `≥${v}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 信号卡片网格 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Shield className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">当前过滤条件下无信号</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSignals.map(signal => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onNavigate={(panelId) => {
                  onNavigateToPanel?.(panelId);
                  onClose();
                }}
                muted={mutedIds.has(signal.id)}
                onToggleMute={toggleMute}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 底部免责声明 ── */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-gray-800 bg-gray-900/50">
        <p className="text-xs text-gray-600 text-center">
          ⚠ 以上信号基于量化模型生成，仅供参考，不构成投资建议。实际交易请结合基本面分析和风险管理规则。
        </p>
      </div>
    </div>
  );
};

export default GlobalSignalDashboard;
