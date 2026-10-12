/**
 * WBF - 全球债券期货 (World Bond Futures)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实计算：CTD债券筛选、转换因子、基差、净基差、期货理论价格
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- 金融计算引擎 -------------------------------------------------------------

/** 转换因子 CF：以6%年利率（3%半年）折现债券现金流 */
function calcConversionFactor(coupon: number, maturityYears: number): number {
  const c = coupon / 2 / 100;
  const n = Math.round(maturityYears * 2);
  const r = 0.03;
  let pv = 0;
  for (let i = 1; i <= n; i++) pv += c / Math.pow(1 + r, i);
  pv += 1 / Math.pow(1 + r, n);
  return parseFloat(pv.toFixed(6));
}

/** 债券净价（半年付息） */
function calcBondCleanPrice(coupon: number, yieldPct: number, maturityYears: number): number {
  const c = coupon / 2;
  const y = yieldPct / 200;
  const n = Math.round(maturityYears * 2);
  let pv = 0;
  for (let i = 1; i <= n; i++) pv += c / Math.pow(1 + y, i);
  pv += 100 / Math.pow(1 + y, n);
  return parseFloat(pv.toFixed(4));
}

/** 期货理论价格 */
function calcFuturesTheoPrice(
  cleanPrice: number, coupon: number, cf: number,
  repoRate: number, daysToDelivery: number
): number {
  const accrued = coupon * (daysToDelivery / 365) / 2;
  const carry = coupon * (daysToDelivery / 365);
  const fp = ((cleanPrice + accrued) * (1 + repoRate / 100 * daysToDelivery / 360) - carry) / cf;
  return parseFloat(fp.toFixed(4));
}

const REPO_RATE = 5.32;
const DAYS_TO_DELIVERY = 62;
const FUTURES_PRICE = 110.28125;

interface DeliverableBond {
  name: string; coupon: number; maturity: number; yieldPct: number;
  cleanPrice: number; cf: number; basis: number; netBasis: number;
  futuresEquiv: number; isCTD: boolean;
}

function buildDeliverables(): DeliverableBond[] {
  const bonds = [
    { name: 'T 4.500 05/15/33', coupon: 4.5, maturity: 7.0, yieldPct: 4.38 },
    { name: 'T 4.375 08/15/33', coupon: 4.375, maturity: 7.2, yieldPct: 4.40 },
    { name: 'T 4.250 11/15/33', coupon: 4.25, maturity: 7.4, yieldPct: 4.42 },
    { name: 'T 4.000 02/15/34', coupon: 4.0, maturity: 7.7, yieldPct: 4.45 },
    { name: 'T 3.875 05/15/34', coupon: 3.875, maturity: 8.0, yieldPct: 4.47 },
    { name: 'T 4.125 08/15/34', coupon: 4.125, maturity: 8.2, yieldPct: 4.48 },
    { name: 'T 4.250 11/15/34', coupon: 4.25, maturity: 8.5, yieldPct: 4.50 },
    { name: 'T 4.500 02/15/35', coupon: 4.5, maturity: 8.7, yieldPct: 4.51 },
    { name: 'T 4.625 05/15/35', coupon: 4.625, maturity: 9.0, yieldPct: 4.52 },
    { name: 'T 4.750 08/15/35', coupon: 4.75, maturity: 9.2, yieldPct: 4.53 },
  ];
  const results: DeliverableBond[] = bonds.map(b => {
    const cf = calcConversionFactor(b.coupon, b.maturity);
    const cleanPrice = calcBondCleanPrice(b.coupon, b.yieldPct, b.maturity);
    const carry = b.coupon * DAYS_TO_DELIVERY / 365;
    const basis = parseFloat((cleanPrice - FUTURES_PRICE * cf).toFixed(4));
    const netBasis = parseFloat((basis - carry).toFixed(4));
    const futuresEquiv = calcFuturesTheoPrice(cleanPrice, b.coupon, cf, REPO_RATE, DAYS_TO_DELIVERY);
    return { ...b, cf, cleanPrice, basis, netBasis, futuresEquiv, isCTD: false };
  });
  const minNetBasis = Math.min(...results.map(r => Math.abs(r.netBasis)));
  results.forEach(r => { r.isCTD = Math.abs(r.netBasis) === minNetBasis; });
  return results;
}

const GLOBAL_FUTURES = [
  { market: '美国', contract: 'ZN (10Y T-Note)', price: 110.28, change: -0.22, yield: 4.38, oi: 3842000, vol: 892000 },
  { market: '美国', contract: 'ZB (30Y T-Bond)', price: 118.09, change: -0.31, yield: 4.52, oi: 1234000, vol: 312000 },
  { market: '德国', contract: 'Bund (10Y)', price: 130.45, change: +0.18, yield: 2.42, oi: 1876000, vol: 623000 },
  { market: '英国', contract: 'Gilt (10Y)', price: 95.82, change: -0.14, yield: 4.18, oi: 892000, vol: 234000 },
  { market: '日本', contract: 'JGB (10Y)', price: 144.21, change: +0.08, yield: 1.05, oi: 2341000, vol: 456000 },
  { market: '澳大利亚', contract: 'AGB (10Y)', price: 94.15, change: -0.09, yield: 4.32, oi: 456000, vol: 123000 },
  { market: '加拿大', contract: 'CGB (10Y)', price: 118.76, change: -0.17, yield: 3.68, oi: 567000, vol: 145000 },
];

const PRICE_HISTORY = [
  { date: '06/01', zn: 109.12, bund: 129.80, gilt: 95.20 },
  { date: '06/03', zn: 109.45, bund: 130.10, gilt: 95.45 },
  { date: '06/05', zn: 109.78, bund: 130.28, gilt: 95.60 },
  { date: '06/07', zn: 110.02, bund: 130.15, gilt: 95.72 },
  { date: '06/09', zn: 110.18, bund: 130.35, gilt: 95.68 },
  { date: '06/11', zn: 109.95, bund: 130.20, gilt: 95.55 },
  { date: '06/13', zn: 110.05, bund: 130.38, gilt: 95.70 },
  { date: '06/15', zn: 110.22, bund: 130.42, gilt: 95.78 },
  { date: '06/17', zn: 110.28, bund: 130.45, gilt: 95.82 },
];

export default function GlobalBondFuturesAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('ctd');
  const deliverables = useMemo(() => buildDeliverables(), []);
  const ctd = deliverables.find(d => d.isCTD)!;

  // -- 全球期货多维筛选 ------------------------------------------------------
  const [marketFilter, setMarketFilter] = useState<string>('ALL');
  const [minYield, setMinYield] = useState('');
  const [maxYield, setMaxYield] = useState('');
  type FuturesSortCol = 'price' | 'change' | 'yield' | 'oi' | 'vol';
  const [futuresSortBy, setFuturesSortBy] = useState<FuturesSortCol>('oi');
  const [futuresSortDir, setFuturesSortDir] = useState<'desc' | 'asc'>('desc');

  const handleFuturesSort = (col: FuturesSortCol) => {
    if (futuresSortBy === col) setFuturesSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setFuturesSortBy(col); setFuturesSortDir('desc'); }
  };

  const filteredFutures = useMemo(() => {
    return GLOBAL_FUTURES
      .filter(f => marketFilter === 'ALL' || f.market === marketFilter)
      .filter(f => !minYield || f.yield >= parseFloat(minYield))
      .filter(f => !maxYield || f.yield <= parseFloat(maxYield))
      .sort((a, b) => futuresSortDir === 'desc' ? b[futuresSortBy] - a[futuresSortBy] : a[futuresSortBy] - b[futuresSortBy]);
  }, [marketFilter, minYield, maxYield, futuresSortBy, futuresSortDir]);

  const uniqueMarkets = ['ALL', ...Array.from(new Set(GLOBAL_FUTURES.map(f => f.market)))];

  // -- CTD 排序 --------------------------------------------------------------
  type CtdSortCol = 'netBasis' | 'basis' | 'yieldPct' | 'cf' | 'cleanPrice';
  const [ctdSortBy, setCtdSortBy] = useState<CtdSortCol>('netBasis');
  const [ctdSortDir, setCtdSortDir] = useState<'asc' | 'desc'>('asc');

  const handleCtdSort = (col: CtdSortCol) => {
    if (ctdSortBy === col) setCtdSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setCtdSortBy(col); setCtdSortDir('asc'); }
  };

  const sortedDeliverables = useMemo(() => {
    return [...deliverables].sort((a, b) =>
      ctdSortDir === 'asc' ? a[ctdSortBy] - b[ctdSortBy] : b[ctdSortBy] - a[ctdSortBy]
    );
  }, [deliverables, ctdSortBy, ctdSortDir]);

  // 传给 AI 面板的实时指标
  const liveMetrics = useMemo(() => ({
    'CTD 债券': ctd?.name ?? 'N/A',
    'CTD 净基差': ctd?.netBasis?.toFixed(4) ?? 'N/A',
    'CTD 转换因子': ctd?.cf?.toFixed(6) ?? 'N/A',
    'ZN 期货价格': FUTURES_PRICE,
    'Repo 利率': `${REPO_RATE}%`,
    '交割天数': DAYS_TO_DELIVERY,
    'ZN 收益率': '4.38%',
    'Bund 收益率': '2.42%',
    '当前筛选市场': marketFilter,
    '显示合约数': filteredFutures.length,
  }), [ctd, filteredFutures.length, marketFilter]);

  const tabs = [
    { id: 'ctd', label: '可交割债券/CTD' },
    { id: 'global', label: '全球期货行情' },
    { id: 'basis', label: '基差分析' },
    { id: 'price', label: '价格走势' },
    { id: 'spread', label: '跨市场价差' },
    { id: 'signals', label: '基差交易信号' },
    { id: 'macro', label: '宏观驱动' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];

  return (
    <div className="min-h-screen bg-[#050a05] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-lime-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-lime-400">WBF</h1>
                <Badge className="bg-lime-500/20 text-lime-400 border-lime-500/30">全球债券期货</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">CTD筛选 · 转换因子 · 基差分析 · 期货定价 · AI因果推理</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">ZN 期货价格</div>
            <div className="text-xl font-mono font-bold text-lime-400">{FUTURES_PRICE.toFixed(5)}</div>
            <div className="text-xs text-red-400">▼ -0.22 (-0.20%)</div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'CTD 债券', value: ctd?.name ?? '-', sub: `CF: ${ctd?.cf.toFixed(4)}`, color: 'text-lime-400' },
            { label: 'CTD 净基差', value: ctd ? `${ctd.netBasis.toFixed(4)}` : '-', sub: '越小越接近CTD', color: 'text-yellow-400' },
            { label: '期货 DV01', value: ctd ? `$${(ctd.cleanPrice * 7.2 / 10000 * 100000 / ctd.cf).toFixed(0)}` : '-', sub: '每张合约', color: 'text-cyan-400' },
            { label: '回购利率', value: `${REPO_RATE}%`, sub: `到期 ${DAYS_TO_DELIVERY}天`, color: 'text-orange-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color} truncate`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        <div className="flex gap-1 mb-6 border-b border-[#1e2a1e] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-lime-400 border-b-2 border-lime-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'ctd' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">可交割债券清单 — ZN 10年期国债期货</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2a1e]">
                      {['债券', '票面', '到期(年)', '收益率%', '净价', '转换因子', '基差', '净基差', '期货等价', 'CTD'].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDeliverables.map((b, i) => (
                      <tr key={i} className={`border-b border-[#0f1f0f] hover:bg-[#0f1f0f] ${b.isCTD ? 'bg-lime-500/5' : ''}`}>
                        <td className={`px-2 py-2 font-mono ${b.isCTD ? 'text-lime-400 font-bold' : 'text-slate-300'}`}>{b.name}</td>
                        <td className="px-2 py-2 text-slate-400">{b.coupon.toFixed(3)}%</td>
                        <td className="px-2 py-2 text-slate-400">{b.maturity.toFixed(1)}</td>
                        <td className="px-2 py-2 text-cyan-400">{b.yieldPct.toFixed(2)}%</td>
                        <td className="px-2 py-2 text-slate-300 font-mono">{b.cleanPrice.toFixed(4)}</td>
                        <td className="px-2 py-2 text-yellow-400 font-mono">{b.cf.toFixed(6)}</td>
                        <td className={`px-2 py-2 font-mono ${b.basis > 0 ? 'text-green-400' : 'text-red-400'}`}>{b.basis.toFixed(4)}</td>
                        <td className={`px-2 py-2 font-mono ${Math.abs(b.netBasis) < 0.05 ? 'text-lime-400' : 'text-slate-400'}`}>{b.netBasis.toFixed(4)}</td>
                        <td className="px-2 py-2 text-slate-300 font-mono">{b.futuresEquiv.toFixed(4)}</td>
                        <td className="px-2 py-2 text-center">{b.isCTD ? <Badge className="bg-lime-500/20 text-lime-400 border-lime-500/30 text-xs">CTD</Badge> : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            {ctd && (
              <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
                <h3 className="text-sm font-bold text-lime-400 mb-3">CTD 债券详细分析 — {ctd.name}</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '转换因子 (CF)', value: ctd.cf.toFixed(6) },
                    { label: '净价', value: ctd.cleanPrice.toFixed(4) },
                    { label: '期货等价价格', value: ctd.futuresEquiv.toFixed(4) },
                    { label: '基差 (Gross Basis)', value: ctd.basis.toFixed(4) },
                    { label: '净基差 (Net Basis)', value: ctd.netBasis.toFixed(4) },
                    { label: '修正久期 (估算)', value: `${(ctd.maturity * 0.92).toFixed(2)} 年` },
                    { label: 'DV01 (每$100)', value: `$${(ctd.cleanPrice * ctd.maturity * 0.92 / 10000).toFixed(4)}` },
                    { label: '对冲比率 ($1M)', value: `${(1000000 / (ctd.cleanPrice * ctd.maturity * 0.92 / 10000 * 100000 / ctd.cf)).toFixed(2)} 张` },
                  ].map((item, i) => (
                    <div key={i} className="bg-[#0a0a0a] rounded p-3">
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className="text-sm font-mono text-lime-300 font-bold">{item.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'global' && (
          <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
            <h3 className="text-sm font-bold text-lime-400 mb-3">全球主要债券期货实时行情</h3>
            {/* 筛选工具栏 */}
            <div className="flex flex-wrap gap-3 items-end mb-3 p-3 rounded bg-[#0a0a0a] border border-[#1e2a1e]">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">市场筛选</span>
                <div className="flex gap-1 flex-wrap">
                  {uniqueMarkets.map(m => (
                    <button key={m} onClick={() => setMarketFilter(m)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        marketFilter === m ? 'bg-lime-600 text-white' : 'bg-[#050a05] text-slate-400 border border-[#1e2a1e] hover:border-lime-500/40'
                      }`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">收益率范围 (%)</span>
                <div className="flex gap-1 items-center">
                  <input value={minYield} onChange={e => setMinYield(e.target.value)} placeholder="最小"
                    className="bg-[#050a05] border border-[#1e2a1e] text-slate-200 text-xs h-7 w-14 rounded px-2" />
                  <span className="text-slate-600 text-xs">–</span>
                  <input value={maxYield} onChange={e => setMaxYield(e.target.value)} placeholder="最大"
                    className="bg-[#050a05] border border-[#1e2a1e] text-slate-200 text-xs h-7 w-14 rounded px-2" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">排序字段</span>
                <div className="flex gap-1">
                  {([['oi','持仓量'],['vol','成交量'],['yield','收益率'],['price','价格'],['change','涨跌']] as [FuturesSortCol, string][]).map(([col, label]) => (
                    <button key={col} onClick={() => handleFuturesSort(col)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        futuresSortBy === col ? 'bg-lime-600 text-white' : 'bg-[#050a05] text-slate-400 border border-[#1e2a1e]'
                      }`}>{label} {futuresSortBy === col ? (futuresSortDir === 'desc' ? '↓' : '↑') : ''}</button>
                  ))}
                </div>
              </div>
              <div className="ml-auto self-end text-xs text-slate-500">
                显示 <span className="text-lime-400 font-bold">{filteredFutures.length}</span> / {GLOBAL_FUTURES.length} 条
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2a1e]">
                    {['市场', '合约', '价格', '涨跌', '收益率', '持仓量', '成交量'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFutures.map((f, i) => (
                    <tr key={i} className="border-b border-[#0f1f0f] hover:bg-[#0f1f0f]">
                      <td className="px-3 py-3 text-slate-400 text-xs">{f.market}</td>
                      <td className="px-3 py-3 text-lime-300 font-mono font-bold">{f.contract}</td>
                      <td className="px-3 py-3 text-slate-200 font-mono">{f.price.toFixed(2)}</td>
                      <td className={`px-3 py-3 font-mono ${f.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {f.change >= 0 ? '+' : ''}{f.change.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-cyan-400 font-mono">{f.yield.toFixed(2)}%</td>
                      <td className="px-3 py-3 text-slate-400 text-xs">{(f.oi / 1000).toFixed(0)}K</td>
                      <td className="px-3 py-3 text-slate-400 text-xs">{(f.vol / 1000).toFixed(0)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'basis' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">基差 vs 净基差（全部可交割债券）</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deliverables.map(d => ({
                  name: d.name.slice(2, 12), basis: d.basis, netBasis: d.netBasis
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="name" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a0d', border: '1px solid #1e2a1e', fontSize: 11 }} />
                  <Legend />
                  <Bar dataKey="basis" fill="#84cc16" name="基差 (Gross)" opacity={0.7} />
                  <Bar dataKey="netBasis" fill="#22d3ee" name="净基差 (Net)" opacity={0.7} />
                  <ReferenceLine y={0} stroke="#4a5568" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">转换因子 vs 收益率</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="yield" name="收益率%" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="cf" name="转换因子" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1a0d', border: '1px solid #1e2a1e', fontSize: 11 }}
                    formatter={(v: any) => [typeof v === 'number' ? v.toFixed(4) : v]} />
                  <Scatter data={deliverables.map(d => ({ yield: d.yieldPct, cf: d.cf }))} fill="#84cc16" opacity={0.8} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === 'price' && (
          <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
            <h3 className="text-sm font-bold text-lime-400 mb-3">全球债券期货价格走势（近20日）</h3>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={PRICE_HISTORY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                <XAxis dataKey="date" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="us" orientation="left" stroke="#84cc16" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <YAxis yAxisId="eu" orientation="right" stroke="#60a5fa" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1a0d', border: '1px solid #1e2a1e', fontSize: 11 }} />
                <Legend />
                <Line yAxisId="us" type="monotone" dataKey="zn" stroke="#84cc16" name="ZN 10Y" strokeWidth={2} dot={false} />
                <Line yAxisId="eu" type="monotone" dataKey="bund" stroke="#60a5fa" name="Bund" strokeWidth={2} dot={false} />
                <Line yAxisId="eu" type="monotone" dataKey="gilt" stroke="#f59e0b" name="Gilt" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* -- 跨市场价差 -- */}
        {activeTab === 'spread' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">全球主要债券期货跨市场收益率价差（bp）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-500 border-b border-[#1e2a1e]">
                    <th className="text-left p-2">市场对</th>
                    <th className="text-right p-2">当前价差</th>
                    <th className="text-right p-2">1周变化</th>
                    <th className="text-right p-2">1月变化</th>
                    <th className="text-right p-2">历史分位</th>
                    <th className="p-2">信号</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { pair: 'US 10Y - Bund 10Y', current: 182, w1: +8, m1: +15, percentile: 72, signal: '做多美债/做空德债' },
                      { pair: 'US 10Y - Gilt 10Y', current: 95, w1: -3, m1: +5, percentile: 58, signal: '中性' },
                      { pair: 'US 10Y - JGB 10Y', current: 385, w1: +12, m1: +28, percentile: 85, signal: '做多美债/做空JGB' },
                      { pair: 'Bund 10Y - OAT 10Y', current: 52, w1: +2, m1: -8, percentile: 45, signal: '中性' },
                      { pair: 'US 2Y - US 10Y', current: -35, w1: -5, m1: -12, percentile: 25, signal: '曲线陡峭化机会' },
                    ].map((row, i) => (
                      <tr key={i} className="border-t border-[#1e2a1e] hover:bg-[#0f2a0f]">
                        <td className="p-2 text-white font-medium">{row.pair}</td>
                        <td className="p-2 text-right font-mono text-lime-400">{row.current}bp</td>
                        <td className={`p-2 text-right font-mono ${row.w1>=0?'text-green-400':'text-red-400'}`}>{row.w1>=0?'+':''}{row.w1}bp</td>
                        <td className={`p-2 text-right font-mono ${row.m1>=0?'text-green-400':'text-red-400'}`}>{row.m1>=0?'+':''}{row.m1}bp</td>
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-16 h-1.5 bg-gray-800 rounded"><div className="h-1.5 rounded bg-lime-500" style={{width:`${row.percentile}%`}} /></div>
                            <span className="text-gray-400 font-mono">{row.percentile}%</span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${row.signal==='中性'?'bg-gray-700 text-gray-400':'bg-lime-500/20 text-lime-400 border border-lime-500/30'}`}>{row.signal}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">US-Bund价差历史走势（近20日）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={Array.from({length:20},(_,i)=>({day:`${i+1}日`,spread:175+Math.sin(i*0.4)*12+i*0.4})) }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickFormatter={v=>`${v}bp`} />
                  <Tooltip contentStyle={{background:'#0d1a0d',border:'1px solid #1e2a1e',fontSize:11}} />
                  <ReferenceLine y={182} stroke="#84cc16" strokeDasharray="4 4" label={{value:'当前',fill:'#84cc16',fontSize:9}} />
                  <Line type="monotone" dataKey="spread" stroke="#84cc16" strokeWidth={2} dot={false} name="US-Bund价差(bp)" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* -- 基差交易信号 -- */}
        {activeTab === 'signals' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '做多基差信号', count: 3, color: '#22c55e', desc: '期货低估，买现券卖期货' },
                { label: '做空基差信号', count: 2, color: '#ef4444', desc: '期货高估，卖现券买期货' },
                { label: '中性信号', count: 5, color: '#6b7280', desc: '基差处于合理区间' },
              ].map(s => (
                <Card key={s.label} className="bg-[#0d1a0d] border-[#1e2a1e] p-4 text-center">
                  <div className="text-2xl font-bold font-mono" style={{color:s.color}}>{s.count}</div>
                  <div className="text-xs text-gray-300 mt-1">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">基差交易机会扫描</h3>
              <div className="space-y-3">
                {[
                  { bond: 'UST 4.25% 2034', basis: -2.8, netBasis: -1.2, signal: '做多', confidence: 85, action: '买现券 + 卖ZN期货' },
                  { bond: 'UST 3.875% 2033', basis: -1.5, netBasis: -0.8, signal: '做多', confidence: 72, action: '买现券 + 卖ZN期货' },
                  { bond: 'Bund 2.5% 2034', basis: 1.8, netBasis: 0.9, signal: '做空', confidence: 68, action: '卖现券 + 买Bund期货' },
                  { bond: 'UST 4.5% 2036', basis: 0.3, netBasis: 0.1, signal: '中性', confidence: 45, action: '观望' },
                ].map((sig, i) => (
                  <div key={i} className={`p-3 rounded border ${sig.signal==='做多'?'border-green-800/50 bg-green-950/10':sig.signal==='做空'?'border-red-800/50 bg-red-950/10':'border-gray-800'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm text-white font-medium">{sig.bond}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{sig.action}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${sig.signal==='做多'?'bg-green-500/20 text-green-400':sig.signal==='做空'?'bg-red-500/20 text-red-400':'bg-gray-700 text-gray-400'}`}>{sig.signal}</span>
                        <div className="text-xs text-gray-500 mt-1">置信度 {sig.confidence}%</div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-gray-500">基差: <span className="font-mono text-lime-400">{sig.basis}bp</span></span>
                      <span className="text-gray-500">净基差: <span className="font-mono text-lime-400">{sig.netBasis}bp</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* -- 宏观驱动 -- */}
        {activeTab === 'macro' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '美国CPI(YoY)', value: '3.2%', change: '-0.1%', color: '#22c55e' },
                { label: '美联储政策利率', value: '5.25-5.50%', change: '不变', color: '#f59e0b' },
                { label: '美国10Y实际利率', value: '2.18%', change: '+0.05%', color: '#ef4444' },
                { label: '全球债券供应', value: '$4.2T', change: '+12%YoY', color: '#3b82f6' },
              ].map(m => (
                <Card key={m.label} className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                  <div className="text-xs text-gray-500">{m.label}</div>
                  <div className="text-lg font-bold font-mono mt-1" style={{color:m.color}}>{m.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.change}</div>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-lime-400 mb-3">宏观因子对全球债券期货的影响评估</h3>
              <div className="space-y-3">
                {[
                  { factor: '美联储降息预期', impact: '正面', magnitude: 82, direction: '债券期货上涨', desc: '降息预期增强推动债券价格上涨，期货多头受益' },
                  { factor: '通胀数据超预期', impact: '负面', magnitude: -65, direction: '债券期货下跌', desc: '通胀持续高企削弱降息预期，债券期货承压' },
                  { factor: '美国财政赤字扩大', impact: '负面', magnitude: -45, direction: '供应压力', desc: '国债供应增加压低价格，期货基差扩大' },
                  { factor: '全球风险偏好下降', impact: '正面', magnitude: 58, direction: '避险需求', desc: '市场恐慌推动资金流入国债，期货价格上涨' },
                  { factor: '中国经济数据疲软', impact: '正面', magnitude: 35, direction: '全球避险', desc: '新兴市场风险上升，资金流向发达国家国债' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded border border-[#1e2a1e]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-white font-medium">{f.factor}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${f.impact==='正面'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}`}>{f.impact}</span>
                      </div>
                      <p className="text-xs text-gray-500">{f.desc}</p>
                    </div>
                    <div className="text-right w-32">
                      <div className="text-xs text-gray-400 mb-1">{f.direction}</div>
                      <div className="h-2 bg-gray-800 rounded">
                        <div className="h-2 rounded" style={{width:`${Math.abs(f.magnitude)}%`,backgroundColor:f.impact==='正面'?'#22c55e':'#ef4444'}} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="WBF" moduleName="全球债券期货" accentColor="lime" liveMetrics={liveMetrics} />
        )}
      </div>
    </div>
  );
}
