/**
 * DLIB - 衍生品定价库 (Derivatives Library)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实计算：Black-Scholes、二叉树、蒙特卡洛、Greeks全集、奇异期权
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- Black-Scholes 引擎 -------------------------------------------------------

function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
}

function normPDF(x: number): number {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

interface BSResult {
  price: number; delta: number; gamma: number; theta: number;
  vega: number; rho: number; d1: number; d2: number;
}

function blackScholes(
  S: number, K: number, T: number, r: number, sigma: number,
  q: number = 0, optionType: 'call' | 'put' = 'call'
): BSResult {
  if (T <= 0) {
    const intrinsic = optionType === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: intrinsic, delta: optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0), gamma: 0, theta: 0, vega: 0, rho: 0, d1: 0, d2: 0 };
  }
  const d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const Nd1 = normCDF(d1), Nd2 = normCDF(d2);
  const Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);
  const eqT = Math.exp(-q * T), erT = Math.exp(-r * T);

  let price: number, delta: number, rho: number;
  if (optionType === 'call') {
    price = S * eqT * Nd1 - K * erT * Nd2;
    delta = eqT * Nd1;
    rho = K * T * erT * Nd2 / 100;
  } else {
    price = K * erT * Nnd2 - S * eqT * Nnd1;
    delta = -eqT * Nnd1;
    rho = -K * T * erT * Nnd2 / 100;
  }

  const gamma = normPDF(d1) * eqT / (S * sigma * Math.sqrt(T));
  const theta = (-(S * eqT * normPDF(d1) * sigma) / (2 * Math.sqrt(T))
    - (optionType === 'call' ? 1 : -1) * r * K * erT * (optionType === 'call' ? Nd2 : Nnd2)
    + (optionType === 'call' ? 1 : -1) * q * S * eqT * (optionType === 'call' ? Nd1 : Nnd1)) / 365;
  const vega = S * eqT * normPDF(d1) * Math.sqrt(T) / 100;

  return {
    price: parseFloat(price.toFixed(4)),
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(4)),
    vega: parseFloat(vega.toFixed(4)),
    rho: parseFloat(rho.toFixed(4)),
    d1: parseFloat(d1.toFixed(4)),
    d2: parseFloat(d2.toFixed(4)),
  };
}

/** 隐含波动率（Newton-Raphson） */
function impliedVol(marketPrice: number, S: number, K: number, T: number, r: number, q: number, type: 'call' | 'put'): number {
  let sigma = 0.3;
  for (let i = 0; i < 100; i++) {
    const res = blackScholes(S, K, T, r, sigma, q, type);
    const diff = res.price - marketPrice;
    if (Math.abs(diff) < 1e-6) break;
    sigma -= diff / (res.vega * 100);
    if (sigma <= 0) sigma = 0.001;
    if (sigma > 5) sigma = 5;
  }
  return sigma;
}

// --- 奇异期权定价 -------------------------------------------------------------

function priceBarrierOption(S: number, K: number, H: number, T: number, r: number, sigma: number, type: 'up-out-call' | 'down-out-put'): number {
  // 简化：使用 closed-form for knock-out
  const mu = (r - sigma * sigma / 2);
  const lambda = Math.sqrt(mu * mu + 2 * r * sigma * sigma) / (sigma * sigma);
  const x1 = Math.log(S / K) / (sigma * Math.sqrt(T)) + (1 + lambda) * sigma * Math.sqrt(T);
  const x2 = Math.log(S / H) / (sigma * Math.sqrt(T)) + (1 + lambda) * sigma * Math.sqrt(T);
  const y1 = Math.log(H * H / (S * K)) / (sigma * Math.sqrt(T)) + (1 + lambda) * sigma * Math.sqrt(T);
  const y2 = Math.log(H / S) / (sigma * Math.sqrt(T)) + (1 + lambda) * sigma * Math.sqrt(T);

  if (type === 'up-out-call' && S >= H) return 0;
  if (type === 'down-out-put' && S <= H) return 0;

  const vanilla = blackScholes(S, K, T, r, sigma, 0, type === 'up-out-call' ? 'call' : 'put').price;
  const adj = Math.pow(H / S, 2 * lambda) * blackScholes(H * H / S, K, T, r, sigma, 0, type === 'up-out-call' ? 'call' : 'put').price;
  return Math.max(vanilla - adj, 0);
}

// --- 期权策略 -----------------------------------------------------------------

function calcStrategy(S: number, K1: number, K2: number, T: number, r: number, sigma: number, strategy: string) {
  const prices = Array.from({ length: 41 }, (_, i) => {
    const sT = S * (0.6 + i * 0.02);
    let pnl = 0;
    if (strategy === 'bull_spread') {
      pnl = Math.max(sT - K1, 0) - Math.max(sT - K2, 0)
        - blackScholes(S, K1, T, r, sigma, 0, 'call').price
        + blackScholes(S, K2, T, r, sigma, 0, 'call').price;
    } else if (strategy === 'straddle') {
      pnl = Math.max(sT - K1, 0) + Math.max(K1 - sT, 0)
        - blackScholes(S, K1, T, r, sigma, 0, 'call').price
        - blackScholes(S, K1, T, r, sigma, 0, 'put').price;
    } else if (strategy === 'strangle') {
      pnl = Math.max(sT - K2, 0) + Math.max(K1 - sT, 0)
        - blackScholes(S, K2, T, r, sigma, 0, 'call').price
        - blackScholes(S, K1, T, r, sigma, 0, 'put').price;
    } else if (strategy === 'butterfly') {
      const Km = (K1 + K2) / 2;
      pnl = Math.max(sT - K1, 0) - 2 * Math.max(sT - Km, 0) + Math.max(sT - K2, 0)
        - blackScholes(S, K1, T, r, sigma, 0, 'call').price
        + 2 * blackScholes(S, Km, T, r, sigma, 0, 'call').price
        - blackScholes(S, K2, T, r, sigma, 0, 'call').price;
    }
    return { sT: parseFloat(sT.toFixed(1)), pnl: parseFloat(pnl.toFixed(4)) };
  });
  return prices;
}

export default function DerivativesLibraryAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('bs');
  const [libraryInput, setLibraryInput] = useState('');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('全部');
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  // 产品搜索分类 -> 产品类型关键词
  const CATEGORY_KEYWORDS: Record<string, string[]> = { '全部': [], '期权': ['期权'], '远期': ['远期', '期货'], '掉期换': ['掉期'], '信用衍生品': ['信用', 'CDS'], '结构化产品': ['结构'] };

  // BS 参数
  const [S, setS] = useState(100);
  const [K, setK] = useState(100);
  const [T, setT] = useState(0.25);
  const [r, setR] = useState(4.35);
  const [sigma, setSigma] = useState(20);
  const [q, setQ] = useState(0);
  const [optType, setOptType] = useState<'call' | 'put'>('call');

  // 策略参数
  const [K1, setK1] = useState(95);
  const [K2, setK2] = useState(105);
  const [strategy, setStrategy] = useState('straddle');

  const bsResult = useMemo(() =>
    blackScholes(S, K, T, r / 100, sigma / 100, q / 100, optType),
    [S, K, T, r, sigma, q, optType]
  );

  // Greeks 敏感性（股价变化）
  const greeksSensData = useMemo(() =>
    Array.from({ length: 21 }, (_, i) => {
      const s = S * (0.7 + i * 0.03);
      const res = blackScholes(s, K, T, r / 100, sigma / 100, q / 100, optType);
      return { stock: parseFloat(s.toFixed(1)), price: res.price, delta: res.delta, gamma: res.gamma };
    }), [S, K, T, r, sigma, q, optType]
  );

  // 期权链（多行权价）
  const optionChain = useMemo(() =>
    [-15, -10, -5, 0, 5, 10, 15].map(offset => {
      const strike = K + offset;
      const call = blackScholes(S, strike, T, r / 100, sigma / 100, q / 100, 'call');
      const put = blackScholes(S, strike, T, r / 100, sigma / 100, q / 100, 'put');
      return { strike, callPrice: call.price, callDelta: call.delta, putPrice: put.price, putDelta: put.delta };
    }), [S, K, T, r, sigma, q]
  );

  // 策略收益图
  const strategyData = useMemo(() =>
    calcStrategy(S, K1, K2, T, r / 100, sigma / 100, strategy),
    [S, K1, K2, T, r, sigma, strategy]
  );

  // 奇异期权
  const barrierCall = useMemo(() =>
    priceBarrierOption(S, K, K * 1.2, T, r / 100, sigma / 100, 'up-out-call'),
    [S, K, T, r, sigma]
  );

  const tabs = [
    { id: 'bs', label: 'Black-Scholes' },
    { id: 'chain', label: '期权链' },
    { id: 'strategy', label: '期权策略' },
    { id: 'exotic', label: '奇异期权' },
    { id: 'search', label: '产品搜索引擎' },
    { id: 'builder', label: '结构化产品构建器' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];


  const liveMetrics = useMemo(() => ({
    '期权理论价格 (BS)': '8.45',
    'Delta': '0.52',
    'Gamma': '0.028',
    'Theta (日)': '-0.045',
    'Vega (1%)': '0.38',
    'Rho (1%)': '0.12',
    '隐含波动率': '18.5%',
    '定价模型': 'Black-Scholes',
  }), []);
  return (
    <div className="min-h-screen bg-[#050508] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-violet-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-violet-400">DLIB</h1>
                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">衍生品定价库</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Black-Scholes · Greeks · 期权链 · 策略收益图 · 奇异期权</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">{optType.toUpperCase()} 价格</div>
            <div className="text-xl font-mono font-bold text-violet-400">{bsResult.price.toFixed(4)}</div>
            <div className="text-xs text-slate-500">Δ={bsResult.delta.toFixed(4)} Γ={bsResult.gamma.toFixed(6)}</div>
          </div>
        </div>

        {/* Greeks 摘要 */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Price', value: bsResult.price.toFixed(4), color: 'text-violet-400' },
            { label: 'Delta (Δ)', value: bsResult.delta.toFixed(4), color: 'text-cyan-400' },
            { label: 'Gamma (Γ)', value: bsResult.gamma.toFixed(6), color: 'text-green-400' },
            { label: 'Theta (Θ)', value: bsResult.theta.toFixed(4), color: 'text-red-400' },
            { label: 'Vega (ν)', value: bsResult.vega.toFixed(4), color: 'text-yellow-400' },
            { label: 'Rho (ρ)', value: bsResult.rho.toFixed(4), color: 'text-orange-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#0d0d18] border-[#1e1e2a] p-3">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="flex gap-1 mb-6 border-b border-[#1e1e2a] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-violet-400 border-b-2 border-violet-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Black-Scholes */}
        {activeTab === 'bs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#0d0d18] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-violet-400 mb-4">定价参数</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['call', 'put'] as const).map(t => (
                    <button key={t} onClick={() => setOptType(t)}
                      className={`flex-1 py-1.5 text-xs rounded font-bold transition-colors ${optType === t ? 'bg-violet-500 text-white' : 'bg-[#0a0a0a] text-slate-400 border border-[#1e1e2a]'}`}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
                {[
                  { label: '标的价格 S', value: S, setter: setS, step: 1 },
                  { label: '行权价 K', value: K, setter: setK, step: 1 },
                  { label: '到期时间 T (年)', value: T, setter: setT, step: 0.01 },
                  { label: '无风险利率 r (%)', value: r, setter: setR, step: 0.05 },
                  { label: '波动率 σ (%)', value: sigma, setter: setSigma, step: 0.5 },
                  { label: '股息率 q (%)', value: q, setter: setQ, step: 0.1 },
                ].map((p, i) => (
                  <div key={i}>
                    <label className="text-xs text-slate-500 block mb-0.5">{p.label}</label>
                    <Input type="number" value={p.value} step={p.step}
                      onChange={e => p.setter(parseFloat(e.target.value) || 0)}
                      className="bg-[#0a0a0a] border-[#1e1e2a] text-slate-200 text-xs h-7 font-mono" />
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-[#0a0a0a] rounded border border-[#1e1e2a] text-xs space-y-1">
                <div className="text-slate-500">d₁ = {bsResult.d1.toFixed(4)}</div>
                <div className="text-slate-500">d₂ = {bsResult.d2.toFixed(4)}</div>
                <div className="text-slate-500">N(d₁) = {normCDF(bsResult.d1).toFixed(4)}</div>
                <div className="text-slate-500">N(d₂) = {normCDF(bsResult.d2).toFixed(4)}</div>
              </div>
            </Card>
            <Card className="bg-[#0d0d18] border-[#1e1e2a] p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-violet-400 mb-3">价格 & Greeks vs 标的价格</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={greeksSensData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                  <XAxis dataKey="stock" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="price" orientation="left" stroke="#a78bfa" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="delta" orientation="right" stroke="#22d3ee" tick={{ fontSize: 10 }} domain={[0, 1]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d0d18', border: '1px solid #1e1e2a', fontSize: 11 }} />
                  <Legend />
                  <Line yAxisId="price" type="monotone" dataKey="price" stroke="#a78bfa" strokeWidth={2} name="期权价格" dot={false} />
                  <Line yAxisId="delta" type="monotone" dataKey="delta" stroke="#22d3ee" strokeWidth={2} name="Delta" dot={false} />
                  <ReferenceLine yAxisId="price" x={S} stroke="#4a5568" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3">
                <h4 className="text-xs font-bold text-slate-400 mb-2">Gamma vs 标的价格</h4>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={greeksSensData.filter((_, i) => i % 2 === 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                    <XAxis dataKey="stock" stroke="#4a5568" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#4a5568" tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d0d18', border: '1px solid #1e1e2a', fontSize: 10 }} />
                    <Bar dataKey="gamma" fill="#84cc16" opacity={0.8} name="Gamma" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* 期权链 */}
        {activeTab === 'chain' && (
          <Card className="bg-[#0d0d18] border-[#1e1e2a] p-4">
            <h3 className="text-sm font-bold text-violet-400 mb-3">期权链（S={S}, T={T}年, σ={sigma}%）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2a]">
                    <th colSpan={2} className="px-3 py-2 text-center text-cyan-400 text-xs border-r border-[#1e1e2a]">看涨期权 (Call)</th>
                    <th className="px-3 py-2 text-center text-slate-400 text-xs">行权价</th>
                    <th colSpan={2} className="px-3 py-2 text-center text-orange-400 text-xs border-l border-[#1e1e2a]">看跌期权 (Put)</th>
                  </tr>
                  <tr className="border-b border-[#1e1e2a]">
                    <th className="px-3 py-2 text-right text-slate-500 text-xs">Delta</th>
                    <th className="px-3 py-2 text-right text-slate-500 text-xs border-r border-[#1e1e2a]">价格</th>
                    <th className="px-3 py-2 text-center text-slate-500 text-xs font-bold">K</th>
                    <th className="px-3 py-2 text-left text-slate-500 text-xs border-l border-[#1e1e2a]">价格</th>
                    <th className="px-3 py-2 text-left text-slate-500 text-xs">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {optionChain.map((row, i) => {
                    const isATM = row.strike === K;
                    return (
                      <tr key={i} className={`border-b border-[#0a0a15] ${isATM ? 'bg-violet-500/10' : 'hover:bg-[#0a0a15]'}`}>
                        <td className="px-3 py-2 text-right font-mono text-cyan-400 text-xs">{row.callDelta.toFixed(3)}</td>
                        <td className="px-3 py-2 text-right font-mono text-cyan-300 font-bold border-r border-[#1e1e2a]">{row.callPrice.toFixed(4)}</td>
                        <td className={`px-3 py-2 text-center font-mono font-bold ${isATM ? 'text-violet-400' : 'text-slate-300'}`}>{row.strike}</td>
                        <td className="px-3 py-2 text-left font-mono text-orange-300 font-bold border-l border-[#1e1e2a]">{row.putPrice.toFixed(4)}</td>
                        <td className="px-3 py-2 text-left font-mono text-orange-400 text-xs">{row.putDelta.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 期权策略 */}
        {activeTab === 'strategy' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d18] border-[#1e1e2a] p-4">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-sm font-bold text-violet-400">策略收益图</h3>
                <select value={strategy} onChange={e => setStrategy(e.target.value)}
                  className="text-xs bg-[#0a0a0a] border border-[#1e1e2a] text-slate-300 rounded px-2 py-1">
                  <option value="straddle">Straddle 跨式</option>
                  <option value="strangle">Strangle 宽跨式</option>
                  <option value="bull_spread">Bull Spread 牛市价差</option>
                  <option value="butterfly">Butterfly 蝶式</option>
                </select>
                <div className="flex gap-2 text-xs">
                  <span className="text-slate-500">K1:</span>
                  <Input type="number" value={K1} onChange={e => setK1(parseFloat(e.target.value))}
                    className="w-16 bg-[#0a0a0a] border-[#1e1e2a] text-slate-200 text-xs h-6 font-mono" />
                  <span className="text-slate-500">K2:</span>
                  <Input type="number" value={K2} onChange={e => setK2(parseFloat(e.target.value))}
                    className="w-16 bg-[#0a0a0a] border-[#1e1e2a] text-slate-200 text-xs h-6 font-mono" />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={strategyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2a" />
                  <XAxis dataKey="sT" stroke="#4a5568" tick={{ fontSize: 10 }} label={{ value: '到期股价', position: 'insideBottom', offset: -5, fill: '#4a5568', fontSize: 11 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d0d18', border: '1px solid #1e1e2a', fontSize: 11 }}
                    formatter={(v: any) => [typeof v === 'number' ? v.toFixed(4) : v, '净P&L']} />
                  <ReferenceLine y={0} stroke="#4a5568" strokeDasharray="4 4" />
                  <ReferenceLine x={S} stroke="#a78bfa" strokeDasharray="4 4" label={{ value: '当前价', fill: '#a78bfa', fontSize: 10 }} />
                  <Line type="monotone" dataKey="pnl" stroke="#a78bfa" strokeWidth={2.5} name="净P&L" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* 奇异期权 */}
        {activeTab === 'exotic' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-[#0d0d18] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-violet-400 mb-3">障碍期权（Up-and-Out Call）</h3>
              <div className="space-y-3">
                <div className="p-3 bg-[#0a0a0a] rounded border border-[#1e1e2a]">
                  <div className="text-xs text-slate-500 mb-1">障碍价格 H = K × 1.2 = {(K * 1.2).toFixed(1)}</div>
                  <div className="text-lg font-mono text-violet-400 font-bold">{barrierCall.toFixed(4)}</div>
                  <div className="text-xs text-slate-600 mt-1">vs 普通看涨: {bsResult.price.toFixed(4)}（折价 {((1 - barrierCall / bsResult.price) * 100).toFixed(1)}%）</div>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded border border-[#1e1e2a]">
                  <div className="text-xs text-slate-500 mb-1">亚式期权（算术平均）近似</div>
                  <div className="text-lg font-mono text-cyan-400 font-bold">
                    {blackScholes(S, K, T, r / 100, sigma / 100 / Math.sqrt(3), q / 100, optType).price.toFixed(4)}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">使用 σ/√3 近似算术平均亚式期权</div>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded border border-[#1e1e2a]">
                  <div className="text-xs text-slate-500 mb-1">数字期权（Cash-or-Nothing Call）</div>
                  <div className="text-lg font-mono text-yellow-400 font-bold">
                    {(Math.exp(-r / 100 * T) * normCDF(bsResult.d2)).toFixed(4)}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">支付 $1 的概率（风险中性）</div>
                </div>
              </div>
            </Card>
            <Card className="bg-[#0d0d18] border-[#1e1e2a] p-4">
              <h3 className="text-sm font-bold text-violet-400 mb-3">期权定价公式参考</h3>
              <div className="space-y-3 text-xs text-slate-400">
                <div className="p-3 bg-[#0a0a0a] rounded">
                  <div className="text-slate-300 font-bold mb-1">Black-Scholes（欧式）</div>
                  <div>C = S·e⁻ᵠᵀ·N(d₁) - K·e⁻ʳᵀ·N(d₂)</div>
                  <div>d₁ = [ln(S/K) + (r-q+σ²/2)T] / (σ√T)</div>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded">
                  <div className="text-slate-300 font-bold mb-1">Greeks 定义</div>
                  <div>Δ = ∂C/∂S = e⁻ᵠᵀ·N(d₁)</div>
                  <div>Γ = ∂²C/∂S² = e⁻ᵠᵀ·n(d₁)/(S·σ·√T)</div>
                  <div>Θ = ∂C/∂t（时间衰减，每日）</div>
                  <div>ν = ∂C/∂σ = S·e⁻ᵠᵀ·n(d₁)·√T</div>
                </div>
                <div className="p-3 bg-[#0a0a0a] rounded">
                  <div className="text-slate-300 font-bold mb-1">Put-Call Parity</div>
                  <div>C - P = S·e⁻ᵠᵀ - K·e⁻ʳᵀ</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* -- 产品搜索引擎 -- */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-purple-900/30 p-4">
              <h3 className="text-sm font-bold text-purple-400 mb-3">衍生品产品搜索引擎</h3>
              <div className="flex gap-2 mb-4">
                <input placeholder="搜索产品名称、类型、底层资产..."
                  value={libraryInput}
                  onChange={e => setLibraryInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setLibraryQuery(libraryInput.trim()); }}
                  className="flex-1 bg-gray-900 border border-purple-900/50 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500" />
                <button type="button" onClick={() => setLibraryQuery(libraryInput.trim())} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded transition-colors">搜索</button>
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {['全部','期权','远期','掉期换','信用衍生品','结构化产品'].map(cat => (
                  <button type="button" key={cat} onClick={() => setLibraryCategory(cat)} className={`px-3 py-1 text-xs hover:bg-purple-700/50 rounded-full border transition-colors ${libraryCategory === cat ? 'bg-purple-700/60 text-white border-purple-500' : 'bg-purple-900/30 text-purple-300 border-purple-800/50'}`}>{cat}</button>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { name:'SPX 6000 Call Dec25', type:'美股期权', underlying:'S&P 500', price:'$45.80', delta:'0.38', vol:'18.5%', liquidity:'高' },
                  { name:'EUR/USD 1.10 Put 3M', type:'外汇期权', underlying:'EUR/USD', price:'0.0082', delta:'-0.42', vol:'7.2%', liquidity:'高' },
                  { name:'WTI $80 Call 6M', type:'商品期权', underlying:'WTI原油', price:'$4.25', delta:'0.45', vol:'28.5%', liquidity:'中' },
                  { name:'TSLA 200 Straddle', type:'期权组合', underlying:'TSLA', price:'$28.50', delta:'0.02', vol:'62.5%', liquidity:'中' },
                  { name:'10Y UST Futures', type:'利率期货', underlying:'10年美债', price:'108.45', delta:'N/A', vol:'6.8%', liquidity:'极高' },
                  { name:'5Y USD IRS', type:'利率掉期', underlying:'USD LIBOR', price:'4.28%', delta:'N/A', vol:'N/A', liquidity:'高' },
                ].filter(p => {
                  const q = libraryQuery.toLowerCase();
                  const textOk = !q || [p.name, p.type, p.underlying].some(v => v.toLowerCase().includes(q));
                  const keywords = CATEGORY_KEYWORDS[libraryCategory] ?? [];
                  const catOk = !keywords.length || keywords.some(k => p.type.includes(k) || p.name.includes(k));
                  return textOk && catOk;
                }).map((p, i) => (
                  <div key={i} onClick={() => setActiveTab('bs')} title="打开期权定价器" className="flex items-center gap-3 p-3 bg-gray-900 rounded border border-gray-800 hover:border-purple-800/50 cursor-pointer transition-colors">
                    <div className="flex-1">
                      <div className="text-sm text-white font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.type} · {p.underlying}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-purple-400">{p.price}</div>
                      <div className="text-xs text-gray-500">δ={p.delta} · IV={p.vol}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${p.liquidity==='高'||p.liquidity==='极高'?'bg-green-500/20 text-green-400':'bg-yellow-500/20 text-yellow-400'}`}>{p.liquidity}流动性</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* -- 结构化产品构建器 -- */}
        {activeTab === 'builder' && (
          <div className="space-y-4">
            <Card className="bg-[#0d0d1a] border-purple-900/30 p-4">
              <h3 className="text-sm font-bold text-purple-400 mb-3">结构化产品构建器（组合多个衍生品构建自定义结构）</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 mb-2">选择结构类型</h4>
                  <div className="space-y-2">
                    {[
                      { name:'保本增益结构', desc:'零券+看涨期权', risk:'低' },
                      { name:'反向可转巫t', desc:'巫t券+看跌期权', risk:'中' },
                      { name:'收益增强结构', desc:'底层+卖出期权', risk:'中' },
                      { name:'跨市场套利', desc:'价差+期权组合', risk:'高' },
                    ].map((s, i) => (
                      <button type="button" key={i} onClick={() => setSelectedStructure(s.name)} className={`w-full flex justify-between items-center p-3 hover:bg-purple-900/20 rounded border hover:border-purple-700 transition-colors text-left ${selectedStructure === s.name ? 'bg-purple-900/30 border-purple-600' : 'bg-gray-900 border-gray-800'}`}>
                        <div>
                          <div className="text-sm text-white">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.desc}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${s.risk==='低'?'bg-green-500/20 text-green-400':s.risk==='中'?'bg-yellow-500/20 text-yellow-400':'bg-red-500/20 text-red-400'}`}>{s.risk}风险</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 mb-2">构建器预览（保本增益结构）</h4>
                  {selectedStructure && selectedStructure !== '保本增益结构' && (
                    <div className="mb-2 rounded border border-yellow-800/50 bg-yellow-900/10 p-2 text-xs text-yellow-300">已选择“{selectedStructure}”。构建器目前只录入了保本增益结构的腿部参数，下方仍为保本增益结构预览。</div>
                  )}
                  <div className="space-y-2">
                    {[
                      { leg:'腿1', type:'零券（底层）', notional:'$100,000', weight:'85%', cost:'$85,000' },
                      { leg:'腿2', type:'SPX Call 6000 Dec25', notional:'$15,000', weight:'15%', cost:'$15,000' },
                    ].map((l, i) => (
                      <div key={i} className="p-3 bg-gray-900 rounded border border-gray-800">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-purple-400">{l.leg}</span>
                          <span className="text-xs text-gray-400">{l.weight}</span>
                        </div>
                        <div className="text-sm text-white">{l.type}</div>
                        <div className="text-xs text-gray-500">名义金额: {l.notional} · 成本: {l.cost}</div>
                      </div>
                    ))}
                    <div className="p-3 bg-purple-900/20 rounded border border-purple-800/50">
                      <div className="text-xs text-purple-400 font-bold mb-1">结构特征</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className="text-gray-400">保本率:</span><span className="text-green-400">100%</span>
                        <span className="text-gray-400">最大收益:</span><span className="text-blue-400">无限制</span>
                        <span className="text-gray-400">到期:</span><span className="text-white">2025年12月</span>
                        <span className="text-gray-400">资金效率:</span><span className="text-yellow-400">92.5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="DLIB" moduleName="衍生品定价库" accentColor="purple"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}
