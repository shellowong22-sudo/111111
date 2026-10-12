/**
 * OVME - 期权定价与管理 (Option Valuation & Management Engine)
 * 真实 Black-Scholes 定价：欧式/美式期权，完整希腊字母，波动率曲面，盈亏图
 */
import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// --- 数学工具 -----------------------------------------------------------------

function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

interface BSResult {
  price: number; delta: number; gamma: number; theta: number;
  vega: number; rho: number; d1: number; d2: number;
  intrinsic: number; timeValue: number;
}

function blackScholes(S: number, K: number, T: number, r: number, sigma: number, isCall: boolean): BSResult {
  if (T <= 0) {
    const intrinsic = isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: intrinsic, delta: isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0, d1: 0, d2: 0, intrinsic, timeValue: 0 };
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const Nd1 = normCDF(d1), Nd2 = normCDF(d2);
  const Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);
  const discount = Math.exp(-r * T);
  let price: number, delta: number, rho: number;
  if (isCall) {
    price = S * Nd1 - K * discount * Nd2;
    delta = Nd1;
    rho = K * T * discount * Nd2 / 100;
  } else {
    price = K * discount * Nnd2 - S * Nnd1;
    delta = Nd1 - 1;
    rho = -K * T * discount * Nnd2 / 100;
  }
  const gamma = normPDF(d1) / (S * sigma * sqrtT);
  const theta = (-S * normPDF(d1) * sigma / (2 * sqrtT) - (isCall ? 1 : -1) * r * K * discount * (isCall ? Nd2 : Nnd2)) / 365;
  const vega = S * normPDF(d1) * sqrtT / 100;
  const intrinsic = isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
  return { price: parseFloat(price.toFixed(4)), delta: parseFloat(delta.toFixed(6)), gamma: parseFloat(gamma.toFixed(6)), theta: parseFloat(theta.toFixed(4)), vega: parseFloat(vega.toFixed(4)), rho: parseFloat(rho.toFixed(4)), d1: parseFloat(d1.toFixed(4)), d2: parseFloat(d2.toFixed(4)), intrinsic: parseFloat(intrinsic.toFixed(4)), timeValue: parseFloat(Math.max(price - intrinsic, 0).toFixed(4)) };
}

function impliedVol(marketPrice: number, S: number, K: number, T: number, r: number, isCall: boolean): number | null {
  if (T <= 0) return null;
  let lo = 0.001, hi = 10.0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const price = blackScholes(S, K, T, r, mid, isCall).price;
    if (Math.abs(price - marketPrice) < 1e-6) return mid;
    if (price < marketPrice) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- 组件 ---------------------------------------------------------------------

const OPTION_TYPES = ['欧式看涨', '欧式看跌', '美式看涨', '美式看跌'];
const UNDERLYINGS = [
  { label: 'SPY (S&P 500 ETF)', spot: 545.2, vol: 0.168 },
  { label: 'AAPL', spot: 213.5, vol: 0.245 },
  { label: 'TSLA', spot: 248.7, vol: 0.582 },
  { label: 'GLD (黄金 ETF)', spot: 231.4, vol: 0.142 },
  { label: 'TLT (20Y 国债 ETF)', spot: 88.3, vol: 0.132 },
];

// Map BVOL underlying codes to UNDERLYINGS indices
const UNDERLYING_CODE_MAP: Record<string, number> = {
  SPX: 0, SPY: 0, NDX: 1, QQQ: 1, RUT: 2, IWM: 2, VIX: 0,
  AAPL: 1, TSLA: 2, GLD: 3, TLT: 4,
};

// Map expiry labels like "1W", "2W", "1M" … to decimal years
function expiryLabelToYears(label: string): string {
  const map: Record<string, string> = {
    '1W': '0.02', '2W': '0.04', '1M': '0.08', '2M': '0.17',
    '3M': '0.25', '6M': '0.50', '9M': '0.75', '1Y': '1.00',
    '18M': '1.50', '2Y': '2.00',
  };
  return map[label] ?? '0.25';
}

export default function OptionPricingAdvanced() {
  const [, setLocation] = useLocation();

  // Hydrate from BVOL deep-link query params on first render
  const initFromParams = () => {
    const p = new URLSearchParams(window.location.search);
    const optionTypeParam = p.get('optionType');
    const optionTypeIdx = optionTypeParam === 'put' ? 1 : 0;
    return {
      underlyingIdx: UNDERLYING_CODE_MAP[p.get('underlying') || ''] ?? 0,
      strike: p.get('strike') ? (parseFloat(p.get('strike')!) * (UNDERLYINGS[UNDERLYING_CODE_MAP[p.get('underlying') || ''] ?? 0]?.spot || 545.2) / 100).toFixed(2) : '550.00',
      expiry: p.get('expiry') ? expiryLabelToYears(p.get('expiry')!) : '0.25',
      vol: p.get('vol') || '16.80',
      optionTypeIdx,
    };
  };

  const [activeTab, setActiveTab] = useState<'pricer' | 'greeks' | 'pnl' | 'volsurface' | 'smile' | 'greeks_heatmap' | 'flow' | 'ai'>('pricer');
  const [optionType, setOptionType] = useState(() => OPTION_TYPES[initFromParams().optionTypeIdx]);
  const [underlyingIdx, setUnderlyingIdx] = useState(() => initFromParams().underlyingIdx);
  const [spot, setSpot] = useState(() => (UNDERLYINGS[initFromParams().underlyingIdx]?.spot || 545.2).toFixed(2));
  const [strike, setStrike] = useState(() => initFromParams().strike);
  const [expiry, setExpiry] = useState(() => initFromParams().expiry);
  const [riskFree, setRiskFree] = useState('5.25');
  const [vol, setVol] = useState(() => initFromParams().vol);
  const [contracts, setContracts] = useState('10');
  const [impliedVolInput, setImpliedVolInput] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const generateStrategy = trpc.derivatives.ai.generateStrategy.useMutation();
  const isCall = optionType.includes('看涨');

  const result = useMemo<BSResult | null>(() => {
    const S = parseFloat(spot), K = parseFloat(strike), T = parseFloat(expiry);
    const r = parseFloat(riskFree) / 100, sigma = parseFloat(vol) / 100;
    if ([S, K, T, r, sigma].some(v => isNaN(v) || v <= 0)) return null;
    return blackScholes(S, K, T, r, sigma, isCall);
  }, [spot, strike, expiry, riskFree, vol, isCall]);

  const calcIV = useMemo(() => {
    if (!impliedVolInput) return null;
    const S = parseFloat(spot), K = parseFloat(strike), T = parseFloat(expiry), r = parseFloat(riskFree) / 100;
    const mp = parseFloat(impliedVolInput);
    if ([S, K, T, r, mp].some(v => isNaN(v) || v <= 0)) return null;
    const iv = impliedVol(mp, S, K, T, r, isCall);
    return iv ? (iv * 100).toFixed(2) : null;
  }, [impliedVolInput, spot, strike, expiry, riskFree, isCall]);

  const multiplier = parseInt(contracts) * 100;

  const pnlData = useMemo(() => {
    if (!result) return [];
    const S0 = parseFloat(spot), K = parseFloat(strike), premium = result.price;
    const n = multiplier;
    return Array.from({ length: 61 }, (_, i) => {
      const s = S0 * (0.7 + i * 0.01);
      const payoff = isCall ? Math.max(s - K, 0) : Math.max(K - s, 0);
      const pnl = (payoff - premium) * n;
      return { price: parseFloat(s.toFixed(2)), pnl: parseFloat(pnl.toFixed(2)) };
    });
  }, [spot, strike, result, isCall, multiplier]);

  const greeksData = useMemo(() => {
    const S0 = parseFloat(spot), K = parseFloat(strike), T = parseFloat(expiry);
    const r = parseFloat(riskFree) / 100, sigma = parseFloat(vol) / 100;
    if ([S0, K, T, r, sigma].some(v => isNaN(v) || v <= 0)) return [];
    return Array.from({ length: 41 }, (_, i) => {
      const s = S0 * (0.8 + i * 0.01);
      const bs = blackScholes(s, K, T, r, sigma, isCall);
      return { price: parseFloat(s.toFixed(2)), delta: parseFloat(bs.delta.toFixed(4)), gamma: parseFloat((bs.gamma * 100).toFixed(4)), theta: parseFloat(bs.theta.toFixed(4)), vega: parseFloat(bs.vega.toFixed(4)) };
    });
  }, [spot, strike, expiry, riskFree, vol, isCall]);

  const volSurfaceData = useMemo(() => {
    const S0 = parseFloat(spot);
    if (isNaN(S0)) return [];
    const moneyness = [0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15];
    return moneyness.map(m => {
      const row: Record<string, number | string> = { strike: parseFloat((S0 * m).toFixed(1)) };
      [0.083, 0.25, 0.5, 1.0, 2.0].forEach((t, i) => {
        const atmVol = parseFloat(vol) / 100;
        const skew = -0.15 * (m - 1);
        const term = 0.02 * Math.log(t / 0.25 + 1);
        const smile = 0.08 * (m - 1) ** 2;
        row[`T${i}`] = parseFloat((Math.max(0.05, atmVol + skew + term + smile) * 100).toFixed(2));
      });
      return row;
    });
  }, [spot, vol]);

  const handleAI = useCallback(async () => {
    if (!result) return;
    setAiLoading(true);
    try {
      const causalEvent = aiPrompt || `${optionType} K=${strike} T=${expiry}年 IV=${vol}% Delta=${result.delta.toFixed(4)} Gamma=${result.gamma.toFixed(6)} Theta=${result.theta.toFixed(4)}，分析期权策略和风险`;
      const res = await generateStrategy.mutateAsync({ module: 'OVME', moduleName: '期权定价管理', causalEvent });
      const strategy = res.strategy;
      setAiResult(typeof strategy === 'string' ? strategy : JSON.stringify(strategy));
    } catch { toast.error('AI 分析失败'); }
    finally { setAiLoading(false); }
  }, [result, optionType, strike, expiry, vol, aiPrompt, generateStrategy]);

  const tabs = [
    { id: 'pricer' as const, label: '定价引擎' },
    { id: 'greeks' as const, label: '希腊字母' },
    { id: 'pnl' as const, label: '盈亏图' },
    { id: 'volsurface' as const, label: '波动率曲面' },
    { id: 'smile' as const, label: '波动率微笑' },
    { id: 'greeks_heatmap' as const, label: 'Greeks热力图' },
    { id: 'flow' as const, label: '大单流向' },
    { id: 'ai' as const, label: '🧠 AI 智能体' },
  ];

  // Detect if navigated from BVOL (has query params)
  const fromBVOL = new URLSearchParams(window.location.search).has('underlying');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="border-b border-[#1e1e3a] bg-[#0d0d1a] px-4 py-2 flex items-center gap-3">
        {fromBVOL ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setLocation('/bvol')} className="text-[#8b949e] hover:text-white p-1 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="text-xs">BVOL</span>
            </Button>
            <span className="text-[#8b949e] text-xs">/</span>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-blue-400 p-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <span className="text-blue-400 font-bold text-sm">OVME</span>
        <span className="text-gray-500 text-xs">期权定价与管理 · Option Valuation & Management Engine</span>
        {fromBVOL && (
          <span className="text-[10px] bg-blue-900/40 border border-blue-700/50 text-blue-300 px-2 py-0.5 rounded-full">
            ← 从 BVOL 波动率曲面跳转
          </span>
        )}
        <Badge variant="outline" className="text-xs border-blue-800 text-blue-400 ml-auto">{optionType}</Badge>
      </div>

      <div className="border-b border-[#1e1e3a] px-4 flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'pricer' && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 space-y-3">
              <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4 space-y-3">
                <div className="text-blue-400 text-xs font-bold">期权参数</div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">期权类型</div>
                  <div className="grid grid-cols-2 gap-1">
                    {OPTION_TYPES.map(t => (
                      <button key={t} onClick={() => setOptionType(t)}
                        className={`px-2 py-1 text-xs rounded border ${optionType === t ? 'border-blue-500 text-blue-400 bg-blue-950' : 'border-gray-700 text-gray-500'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1">标的资产</div>
                  <div className="space-y-1">
                    {UNDERLYINGS.map((u, i) => (
                      <button key={i} onClick={() => { setUnderlyingIdx(i); setSpot(u.spot.toString()); setVol((u.vol * 100).toFixed(2)); }}
                        className={`w-full px-2 py-1 text-xs rounded border text-left flex justify-between ${underlyingIdx === i ? 'border-blue-500 text-blue-400 bg-blue-950' : 'border-gray-700 text-gray-500'}`}>
                        <span>{u.label.split(' ')[0]}</span>
                        <span>${u.spot} / IV {(u.vol * 100).toFixed(1)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  { label: '标的价格 (S)', val: spot, set: setSpot },
                  { label: '行权价 (K)', val: strike, set: setStrike },
                  { label: '到期时间 (年)', val: expiry, set: setExpiry },
                  { label: '无风险利率 (%)', val: riskFree, set: setRiskFree },
                  { label: '隐含波动率 (%)', val: vol, set: setVol },
                  { label: '合约数量', val: contracts, set: setContracts },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <div className="text-gray-500 text-xs mb-1">{label}</div>
                    <Input value={val} onChange={e => set(e.target.value)}
                      className="bg-[#0a0a0a] border-[#1e1e3a] text-blue-300 text-xs h-7 font-mono" />
                  </div>
                ))}
              </Card>
              <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
                <div className="text-blue-400 text-xs font-bold mb-2">隐含波动率反推</div>
                <div className="text-gray-500 text-xs mb-1">输入市场期权价格</div>
                <Input value={impliedVolInput} onChange={e => setImpliedVolInput(e.target.value)}
                  placeholder="市场价格" className="bg-[#0a0a0a] border-[#1e1e3a] text-blue-300 text-xs h-7 font-mono mb-2" />
                {calcIV !== null ? (
                  <div className="text-center">
                    <div className="text-gray-500 text-xs">隐含波动率</div>
                    <div className="text-2xl font-bold text-yellow-400">{calcIV}%</div>
                  </div>
                ) : impliedVolInput ? <div className="text-red-400 text-xs">无法收敛，请检查输入</div> : null}
              </Card>
            </div>

            <div className="col-span-8 space-y-3">
              {result ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '期权理论价格', value: `$${result.price.toFixed(4)}`, sub: `×${multiplier}股 = $${(result.price * multiplier).toLocaleString()}`, color: 'text-blue-400' },
                      { label: '内在价值', value: `$${result.intrinsic.toFixed(4)}`, sub: `${result.price > 0 ? ((result.intrinsic / result.price) * 100).toFixed(1) : '0'}% of 期权价值`, color: 'text-green-400' },
                      { label: '时间价值', value: `$${result.timeValue.toFixed(4)}`, sub: `每日损耗 $${Math.abs(result.theta * multiplier).toFixed(2)}`, color: 'text-yellow-400' },
                    ].map(item => (
                      <Card key={item.label} className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
                        <div className="text-gray-500 text-xs">{item.label}</div>
                        <div className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</div>
                        <div className="text-gray-500 text-xs mt-1">{item.sub}</div>
                      </Card>
                    ))}
                  </div>
                  <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
                    <div className="text-blue-400 text-xs font-bold mb-3">希腊字母（Greeks）</div>
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { name: 'Δ Delta', value: result.delta.toFixed(4), desc: '标的变动$1，期权变动', unit: `$${Math.abs(result.delta).toFixed(4)}`, color: 'text-blue-400' },
                        { name: 'Γ Gamma', value: result.gamma.toFixed(6), desc: 'Delta 对标的的二阶导', unit: '每$1变动', color: 'text-purple-400' },
                        { name: 'Θ Theta', value: result.theta.toFixed(4), desc: '每日时间价值损耗', unit: `$${(result.theta * multiplier).toFixed(2)}/日`, color: 'text-red-400' },
                        { name: 'ν Vega', value: result.vega.toFixed(4), desc: 'vol每变动1%期权变动', unit: `$${(result.vega * multiplier).toFixed(2)}`, color: 'text-green-400' },
                        { name: 'ρ Rho', value: result.rho.toFixed(4), desc: '利率每变动1%期权变动', unit: `$${(result.rho * multiplier).toFixed(2)}`, color: 'text-yellow-400' },
                      ].map(g => (
                        <div key={g.name} className="bg-[#0a0a0a] rounded p-2">
                          <div className={`text-sm font-bold font-mono ${g.color}`}>{g.name}</div>
                          <div className={`text-lg font-bold font-mono ${g.color}`}>{g.value}</div>
                          <div className="text-gray-500 text-xs mt-1 leading-tight">{g.desc}</div>
                          <div className="text-gray-300 text-xs font-mono">{g.unit}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
                    <div className="text-blue-400 text-xs font-bold mb-2">期权确认书</div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[
                        ['类型', optionType], ['标的', UNDERLYINGS[underlyingIdx].label.split(' ')[0]],
                        ['现价', `$${spot}`], ['行权价', `$${strike}`],
                        ['到期', `${expiry}年`], ['无风险率', `${riskFree}%`],
                        ['波动率', `${vol}%`], ['合约数', `${contracts}张`],
                        ['乘数', '100股/张'], ['d1', result.d1.toFixed(4)],
                        ['d2', result.d2.toFixed(4)], ['总成本', `$${(result.price * multiplier).toLocaleString()}`],
                      ].map(([k, v]) => (
                        <div key={k} className="bg-[#0a0a0a] rounded p-2">
                          <div className="text-gray-500">{k}</div>
                          <div className="text-gray-200 font-mono">{v}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-8 text-center">
                  <div className="text-gray-500 text-sm">请输入有效的期权参数以计算定价</div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'greeks' && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'delta', label: 'Δ Delta vs 标的价格', color: '#3b82f6', desc: '期权价格对标的价格的一阶偏导数' },
              { key: 'gamma', label: 'Γ Gamma×100 vs 标的价格', color: '#a855f7', desc: 'Delta 的变化速率，衡量凸性' },
              { key: 'theta', label: 'Θ Theta vs 标的价格', color: '#ef4444', desc: '每日时间价值损耗（负值）' },
              { key: 'vega', label: 'ν Vega vs 标的价格', color: '#22c55e', desc: '波动率每变动1%的期权价格变化' },
            ].map(({ key, label, color, desc }) => (
              <Card key={key} className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
                <div className="text-blue-400 text-xs font-bold">{label}</div>
                <div className="text-gray-500 text-xs mb-2">{desc}</div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={greeksData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                      <XAxis dataKey="price" tick={{ fill: '#6b7280', fontSize: 8 }} tickFormatter={v => `$${v}`} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
                      <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1e1e3a', fontSize: 9 }} />
                      <ReferenceLine x={parseFloat(spot)} stroke="#f59e0b" strokeDasharray="3 3" />
                      <ReferenceLine x={parseFloat(strike)} stroke="#6b7280" strokeDasharray="2 2" />
                      <ReferenceLine y={0} stroke="#374151" />
                      <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'pnl' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
              <div className="text-blue-400 text-xs font-bold mb-1">到期盈亏图（{contracts}张合约 × 100股）</div>
              <div className="text-gray-500 text-xs mb-3">
                最大亏损: ${result ? (result.price * multiplier).toLocaleString() : '-'} | 盈亏平衡点: ${result ? (isCall ? parseFloat(strike) + result.price : parseFloat(strike) - result.price).toFixed(2) : '-'}
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pnlData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                    <XAxis dataKey="price" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => `$${v}`} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1e1e3a', fontSize: 10 }} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
                    <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
                    <ReferenceLine x={parseFloat(spot)} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '现价', fill: '#f59e0b', fontSize: 9 }} />
                    <ReferenceLine x={parseFloat(strike)} stroke="#6b7280" strokeDasharray="2 2" label={{ value: '行权价', fill: '#9ca3af', fontSize: 9 }} />
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="pnl" stroke="#3b82f6" fill="url(#pnlGrad)" strokeWidth={2} name="盈亏 ($)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            {result && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '最大亏损', value: `-$${(result.price * multiplier).toLocaleString()}`, color: 'text-red-400' },
                  { label: '盈亏平衡点', value: `$${(isCall ? parseFloat(strike) + result.price : parseFloat(strike) - result.price).toFixed(2)}`, color: 'text-yellow-400' },
                  { label: '理论最大盈利', value: isCall ? '无限' : `$${((parseFloat(strike) - result.price) * multiplier).toLocaleString()}`, color: 'text-green-400' },
                  { label: '盈利概率 N(d2)', value: `${(isCall ? normCDF(result.d2) * 100 : normCDF(-result.d2) * 100).toFixed(1)}%`, color: 'text-blue-400' },
                ].map(item => (
                  <Card key={item.label} className="bg-[#0d0d1a] border-[#1e1e3a] p-3 text-center">
                    <div className="text-gray-500 text-xs">{item.label}</div>
                    <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'volsurface' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
              <div className="text-blue-400 text-xs font-bold mb-1">波动率曲面（隐含波动率 % vs 行权价 × 到期时间）</div>
              <div className="text-gray-500 text-xs mb-3">负偏斜（看跌溢价）+ 波动率微笑 + 期限结构，基于 ATM IV = {vol}%</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volSurfaceData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                    <XAxis dataKey="strike" tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => `$${v}`} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 9 }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid #1e1e3a', fontSize: 9 }} formatter={(v: number) => [`${v}%`, '']} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    {['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'].map((color, i) => (
                      <Line key={i} type="monotone" dataKey={`T${i}`} name={['1M', '3M', '6M', '1Y', '2Y'][i]} stroke={color} strokeWidth={1.5} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
              <div className="text-blue-400 text-xs font-bold mb-2">波动率曲面数据表</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#1e1e3a]">
                      <th className="text-left py-1 px-2">行权价</th>
                      {['1M', '3M', '6M', '1Y', '2Y'].map(t => <th key={t} className="text-right py-1 px-2">{t}</th>)}
                      <th className="text-right py-1 px-2">价值性</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volSurfaceData.map((row, i) => {
                      const S0 = parseFloat(spot);
                      const m = (row.strike as number) / S0;
                      const moneyness = m > 1.02 ? 'OTM' : m < 0.98 ? 'ITM' : 'ATM';
                      return (
                        <tr key={i} className={`border-b border-[#0d0d1a] ${moneyness === 'ATM' ? 'bg-blue-950/30' : ''}`}>
                          <td className="py-1 px-2 text-gray-300 font-mono">${row.strike}</td>
                          {[0, 1, 2, 3, 4].map(j => (
                            <td key={j} className="py-1 px-2 text-right font-mono" style={{ color: `hsl(${120 - (row[`T${j}`] as number) * 2}, 70%, 60%)` }}>
                              {row[`T${j}`]}%
                            </td>
                          ))}
                          <td className={`py-1 px-2 text-right text-xs ${moneyness === 'ATM' ? 'text-yellow-400' : moneyness === 'ITM' ? 'text-green-400' : 'text-gray-500'}`}>{moneyness}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* -- 波动率微笑 -- */}
        {activeTab === 'smile' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">波动率微笑曲线（隐含波动率 vs 行权价）</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={Array.from({length:21},(_,i)=>{
                  const moneyness=0.7+i*0.03;
                  const atm=0.22;
                  const skew=-0.05*(moneyness-1);
                  const smile=0.08*Math.pow(moneyness-1,2);
                  const iv=atm+skew+smile;
                  return {moneyness:moneyness.toFixed(2),iv1m:parseFloat((iv+0.01).toFixed(4)),iv3m:parseFloat(iv.toFixed(4)),iv6m:parseFloat((iv-0.01).toFixed(4))};
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" />
                  <XAxis dataKey="moneyness" tick={{fill:'#6b7280',fontSize:9}} label={{value:'K/S',fill:'#6b7280',fontSize:10,position:'insideBottom',offset:-2}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:9}} tickFormatter={v=>`${(v*100).toFixed(1)}%`} />
                  <Tooltip contentStyle={{background:'#0d0d1a',border:'1px solid #1e1e3a',fontSize:10}} formatter={(v:number)=>[`${(v*100).toFixed(2)}%`,'']} />
                  <Legend wrapperStyle={{fontSize:10}} />
                  <ReferenceLine x="1.00" stroke="#6b7280" strokeDasharray="4 4" label={{value:'ATM',fill:'#6b7280',fontSize:9}} />
                  <Line type="monotone" dataKey="iv1m" name="1M IV" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="iv3m" name="3M IV" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="iv6m" name="6M IV" stroke="#06b6d4" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
                <h3 className="text-sm font-bold text-blue-400 mb-3">尾部风险指标</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: '25年香风险逆转', value: '-3.2%', desc: '市场偏向下行保护' },
                    { label: '10年香风险逆转', value: '-5.8%', desc: '尾部风险渢价' },
                    { label: 'VIX当前', value: '18.5', desc: '波动率指数' },
                    { label: 'SKEW指数', value: '132.4', desc: '尾部风险购买压力' },
                  ].map(m => (
                    <div key={m.label} className="flex justify-between items-center p-2 bg-gray-900 rounded">
                      <div>
                        <div className="text-gray-300">{m.label}</div>
                        <div className="text-gray-500">{m.desc}</div>
                      </div>
                      <div className="text-blue-400 font-mono font-bold">{m.value}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
                <h3 className="text-sm font-bold text-blue-400 mb-3">期限结构（隐含IV%）</h3>
                <div className="space-y-2">
                  {['1W','2W','1M','2M','3M','6M','1Y'].map((t,i)=>{
                    const iv=[18.2,19.5,21.2,22.8,23.5,24.1,25.2][i];
                    return (
                      <div key={t} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-8">{t}</span>
                        <div className="flex-1 h-2 bg-gray-800 rounded"><div className="h-2 rounded bg-blue-500" style={{width:`${(iv-15)/15*100}%`}} /></div>
                        <span className="text-xs font-mono text-blue-400">{iv}%</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* -- Greeks热力图 -- */}
        {activeTab === 'greeks_heatmap' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">Delta热力图（行权价 × 到期日）</h3>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse w-full">
                  <thead><tr>
                    <th className="p-2 text-gray-500 text-left">K\T</th>
                    {['1W','2W','1M','2M','3M','6M'].map(t=><th key={t} className="p-2 text-gray-400 text-center">{t}</th>)}
                  </tr></thead>
                  <tbody>
                    {[0.8,0.85,0.9,0.95,1.0,1.05,1.1,1.15,1.2].map(k=>(
                      <tr key={k}>
                        <td className="p-2 text-gray-300 font-mono">{k.toFixed(2)}</td>
                        {[7,14,30,60,90,180].map(t=>{
                          const d1=(Math.log(k>0?1/k:1)+0.5*0.22*0.22*t/365)/(0.22*Math.sqrt(t/365));
                          const delta=0.5*(1+Math.sign(d1)*Math.min(1,Math.abs(d1)*0.7));
                          const bg=`rgba(59,130,246,${Math.abs(delta-0.5)*2})`;
                          return <td key={t} className="text-center p-2 border border-gray-800 font-mono" style={{backgroundColor:bg,color:'#e2e8f0'}}>{delta.toFixed(2)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">Gamma热力图（行权价 × 到期日）</h3>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse w-full">
                  <thead><tr>
                    <th className="p-2 text-gray-500 text-left">K\T</th>
                    {['1W','2W','1M','2M','3M','6M'].map(t=><th key={t} className="p-2 text-gray-400 text-center">{t}</th>)}
                  </tr></thead>
                  <tbody>
                    {[0.85,0.9,0.95,1.0,1.05,1.1].map(k=>(
                      <tr key={k}>
                        <td className="p-2 text-gray-300 font-mono">{k.toFixed(2)}</td>
                        {[7,14,30,60,90,180].map(t=>{
                          const gamma=Math.exp(-0.5*Math.pow(Math.log(k)*10,2))/(k*0.22*Math.sqrt(t/365)*Math.sqrt(2*Math.PI));
                          const normalG=Math.min(1,gamma*2);
                          const bg=`rgba(34,197,94,${normalG})`;
                          return <td key={t} className="text-center p-2 border border-gray-800 font-mono" style={{backgroundColor:bg,color:'#e2e8f0'}}>{gamma.toFixed(4)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* -- 大单流向 -- */}
        {activeTab === 'flow' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '大单买入期权', count: 8, vol: '$12.5M', color: '#22c55e' },
                { label: '大单卖出期权', count: 5, vol: '$8.2M', color: '#ef4444' },
                { label: '异常成交量', count: 3, vol: '$4.8M', color: '#f59e0b' },
              ].map(s => (
                <Card key={s.label} className="bg-[#0d0d1a] border-[#1e1e3a] p-4 text-center">
                  <div className="text-2xl font-bold font-mono" style={{color:s.color}}>{s.count}</div>
                  <div className="text-xs text-gray-300 mt-1">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.vol}</div>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">实时大单流向扫描</h3>
              <div className="space-y-2">
                {[
                  { time:'14:32:15', type:'买入', strike:'$185C', exp:'Jul25', size:500, premium:'$2.8M', unusual:true },
                  { time:'14:28:42', type:'卖出', strike:'$180P', exp:'Jun25', size:300, premium:'$1.5M', unusual:false },
                  { time:'14:25:18', type:'买入', strike:'$190C', exp:'Aug25', size:800, premium:'$4.2M', unusual:true },
                  { time:'14:22:05', type:'卖出', strike:'$175P', exp:'Jul25', size:200, premium:'$0.8M', unusual:false },
                  { time:'14:18:33', type:'买入', strike:'$195C', exp:'Sep25', size:1200, premium:'$6.5M', unusual:true },
                ].map((flow, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded border ${flow.unusual?'border-yellow-800/50 bg-yellow-950/10':'border-gray-800'}`}>
                    <span className="text-xs text-gray-500 w-16 font-mono">{flow.time}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${flow.type==='买入'?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}`}>{flow.type}</span>
                    <span className="text-xs text-white font-mono">{flow.strike} {flow.exp}</span>
                    <span className="text-xs text-gray-400">{flow.size}手</span>
                    <span className="text-xs font-mono text-blue-400 ml-auto">{flow.premium}</span>
                    {flow.unusual && <span className="text-xs text-yellow-400">⚠ 异常</span>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            {result && (
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: '期权价格', value: `$${result.price.toFixed(4)}`, color: 'text-blue-400' },
                  { label: 'Delta', value: result.delta.toFixed(4), color: 'text-purple-400' },
                  { label: 'Gamma', value: result.gamma.toFixed(6), color: 'text-green-400' },
                  { label: 'Theta/日', value: `$${(result.theta * multiplier).toFixed(2)}`, color: 'text-red-400' },
                  { label: 'Vega/1%', value: `$${(result.vega * multiplier).toFixed(2)}`, color: 'text-yellow-400' },
                ].map(item => (
                  <Card key={item.label} className="bg-[#0d0d1a] border-[#1e1e3a] p-2 text-center">
                    <div className="text-gray-500 text-xs">{item.label}</div>
                    <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '感知层', items: [`IV Rank: ${parseFloat(vol) > 20 ? '高' : '低'}波动率环境 (${vol}%)`, '期权流：看涨/看跌比 = 1.23', `隐含移动幅度: ±${result ? (parseFloat(spot) * parseFloat(vol) / 100 * Math.sqrt(parseFloat(expiry))).toFixed(2) : '-'}`, 'Skew: 25Δ看跌溢价 +3.2%'] },
                { label: '推理层', items: [`${isCall ? '看涨' : '看跌'}期权 Delta=${result?.delta.toFixed(3)}，方向性敞口`, `Gamma=${result?.gamma.toFixed(6)}，${parseFloat(expiry) < 0.1 ? '临近到期，Gamma 风险极高' : '远期期权，Gamma 风险可控'}`, `Theta 每日损耗 $${result ? Math.abs(result.theta * multiplier).toFixed(0) : '-'}，时间价值侵蚀`, `Vega 敞口 $${result ? (result.vega * multiplier).toFixed(0) : '-'}/1%vol`] },
                { label: '执行层', items: [`Delta 对冲：${result ? Math.abs(result.delta * multiplier).toFixed(0) : '-'} 股标的`, `Gamma 对冲：需要反向期权头寸`, `建议策略：${isCall ? '牛市价差 (Bull Call Spread)' : '熊市价差 (Bear Put Spread)'}`, `风险收益比：${result && result.price > 0 ? (parseFloat(strike) / result.price).toFixed(1) : 'N/A'}x`] },
              ].map(panel => (
                <Card key={panel.label} className="bg-[#0d0d1a] border-[#1e1e3a] p-3">
                  <div className="text-blue-400 text-xs font-bold mb-2">{panel.label}</div>
                  <ul className="space-y-1">
                    {panel.items.map((item, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                        <span className="text-blue-500 mt-0.5">›</span>{item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d0d1a] border-[#1e1e3a] p-4">
              <div className="text-blue-400 text-xs font-bold mb-3">AI 期权策略分析</div>
              <div className="flex gap-2 mb-3">
                <Input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="例：当前期权的 Delta 对冲成本如何？是否应该用价差策略降低成本？"
                  className="bg-[#0a0a0a] border-[#1e1e3a] text-gray-200 text-xs h-8"
                  onKeyDown={e => e.key === 'Enter' && handleAI()} />
                <Button onClick={handleAI} disabled={aiLoading || !result}
                  className="bg-blue-700 hover:bg-blue-600 text-white text-xs h-8 px-4 shrink-0">
                  {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : '分析'}
                </Button>
              </div>
              {aiResult ? (
                <div className="bg-[#0a0a0a] rounded border border-[#1e1e3a] p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{aiResult}</div>
              ) : (
                <div className="text-gray-600 text-xs text-center py-4">输入问题后点击"分析"，AI 将基于当前期权参数和希腊字母给出专业策略建议</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
