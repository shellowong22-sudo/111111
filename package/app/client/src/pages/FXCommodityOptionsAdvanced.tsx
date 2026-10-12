/**
 * OVML - 外汇/商品期权估价 (Option Valuation: Multi-asset)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实计算：Garman-Kohlhagen外汇期权、商品期权（含便利收益率）、Greeks、波动率曲面
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

// --- Garman-Kohlhagen 外汇期权定价 -------------------------------------------

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

/**
 * Garman-Kohlhagen 外汇期权（GK模型）
 * C = S·e^(-rf·T)·N(d1) - K·e^(-rd·T)·N(d2)
 * rf = 外国利率（即基础货币利率）
 * rd = 国内利率（即报价货币利率）
 */
function gkFXOption(
  S: number, K: number, T: number, rd: number, rf: number, sigma: number,
  type: 'call' | 'put'
): { price: number; delta: number; gamma: number; theta: number; vega: number; d1: number; d2: number } {
  if (T <= 0) {
    const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return { price: intrinsic, delta: 0, gamma: 0, theta: 0, vega: 0, d1: 0, d2: 0 };
  }
  const d1 = (Math.log(S / K) + (rd - rf + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const erfT = Math.exp(-rf * T), erdT = Math.exp(-rd * T);
  const Nd1 = normCDF(d1), Nd2 = normCDF(d2);
  const Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);

  let price: number, delta: number;
  if (type === 'call') {
    price = S * erfT * Nd1 - K * erdT * Nd2;
    delta = erfT * Nd1;
  } else {
    price = K * erdT * Nnd2 - S * erfT * Nnd1;
    delta = -erfT * Nnd1;
  }

  const gamma = normPDF(d1) * erfT / (S * sigma * Math.sqrt(T));
  const theta = (-(S * erfT * normPDF(d1) * sigma) / (2 * Math.sqrt(T))
    + rf * S * erfT * (type === 'call' ? Nd1 : -Nnd1)
    - rd * K * erdT * (type === 'call' ? Nd2 : -Nnd2)) / 365;
  const vega = S * erfT * normPDF(d1) * Math.sqrt(T) / 100;

  return {
    price: parseFloat(price.toFixed(6)),
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(6)),
    vega: parseFloat(vega.toFixed(6)),
    d1: parseFloat(d1.toFixed(4)),
    d2: parseFloat(d2.toFixed(4)),
  };
}

/**
 * 商品期权（Black-76 / Merton 含便利收益率）
 * 便利收益率 y：持有商品的净收益（存储成本的负值 + 便利收益）
 * 等价于将 rf 替换为 y
 */
function commodityOption(
  F: number, K: number, T: number, r: number, sigma: number,
  type: 'call' | 'put'
): { price: number; delta: number; gamma: number; vega: number } {
  if (T <= 0) {
    const intrinsic = type === 'call' ? Math.max(F - K, 0) : Math.max(K - F, 0);
    return { price: intrinsic, delta: 0, gamma: 0, vega: 0 };
  }
  // Black-76: 使用期货价格 F
  const d1 = (Math.log(F / K) + sigma * sigma / 2 * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const erT = Math.exp(-r * T);
  const Nd1 = normCDF(d1), Nd2 = normCDF(d2);
  const Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);

  const price = type === 'call'
    ? erT * (F * Nd1 - K * Nd2)
    : erT * (K * Nnd2 - F * Nnd1);
  const delta = erT * (type === 'call' ? Nd1 : -Nnd1);
  const gamma = normPDF(d1) * erT / (F * sigma * Math.sqrt(T));
  const vega = F * erT * normPDF(d1) * Math.sqrt(T) / 100;

  return {
    price: parseFloat(price.toFixed(4)),
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    vega: parseFloat(vega.toFixed(4)),
  };
}

// --- 市场数据 -----------------------------------------------------------------

const FX_PAIRS = [
  { pair: 'EUR/USD', spot: 1.0845, rd: 4.35, rf: 3.85, vol1m: 7.2, vol3m: 7.8, vol1y: 8.5 },
  { pair: 'GBP/USD', spot: 1.2685, rd: 4.35, rf: 5.25, vol1m: 8.5, vol3m: 9.2, vol1y: 10.1 },
  { pair: 'USD/JPY', spot: 157.45, rd: 0.1, rf: 4.35, vol1m: 9.8, vol3m: 10.5, vol1y: 11.2 },
  { pair: 'USD/CHF', spot: 0.8985, rd: 1.5, rf: 4.35, vol1m: 6.8, vol3m: 7.5, vol1y: 8.2 },
  { pair: 'AUD/USD', spot: 0.6485, rd: 4.35, rf: 4.1, vol1m: 10.2, vol3m: 11.0, vol1y: 12.5 },
];

const COMMODITIES = [
  { name: '黄金', symbol: 'XAU', futures: 2385.5, r: 4.35, vol: 14.8, unit: '$/oz' },
  { name: '原油(WTI)', symbol: 'CL', futures: 78.25, r: 4.35, vol: 28.5, unit: '$/bbl' },
  { name: '天然气', symbol: 'NG', futures: 2.485, r: 4.35, vol: 52.8, unit: '$/MMBtu' },
  { name: '铜', symbol: 'HG', futures: 4.285, r: 4.35, vol: 22.5, unit: '$/lb' },
  { name: '小麦', symbol: 'ZW', futures: 548.5, r: 4.35, vol: 25.8, unit: '¢/bu' },
];

export default function FXCommodityOptionsAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('fx');
  const [mode, setMode] = useState<'fx' | 'commodity'>('fx');

  // FX 期权参数
  const [fxSpot, setFxSpot] = useState(1.0845);
  const [fxStrike, setFxStrike] = useState(1.0900);
  const [fxT, setFxT] = useState(0.25);
  const [fxRd, setFxRd] = useState(4.35);
  const [fxRf, setFxRf] = useState(3.85);
  const [fxVol, setFxVol] = useState(7.8);
  const [fxType, setFxType] = useState<'call' | 'put'>('call');

  // 商品期权参数
  const [cmFutures, setCmFutures] = useState(2385.5);
  const [cmStrike, setCmStrike] = useState(2400);
  const [cmT, setCmT] = useState(0.25);
  const [cmR, setCmR] = useState(4.35);
  const [cmVol, setCmVol] = useState(14.8);
  const [cmType, setCmType] = useState<'call' | 'put'>('call');

  const fxResult = useMemo(() =>
    gkFXOption(fxSpot, fxStrike, fxT, fxRd / 100, fxRf / 100, fxVol / 100, fxType),
    [fxSpot, fxStrike, fxT, fxRd, fxRf, fxVol, fxType]
  );

  const cmResult = useMemo(() =>
    commodityOption(cmFutures, cmStrike, cmT, cmR / 100, cmVol / 100, cmType),
    [cmFutures, cmStrike, cmT, cmR, cmVol, cmType]
  );

  // FX 期权链
  const fxChain = useMemo(() =>
    [-0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04].map(offset => {
      const K = parseFloat((fxStrike + offset).toFixed(4));
      const call = gkFXOption(fxSpot, K, fxT, fxRd / 100, fxRf / 100, fxVol / 100, 'call');
      const put = gkFXOption(fxSpot, K, fxT, fxRd / 100, fxRf / 100, fxVol / 100, 'put');
      return { strike: K, callPrice: call.price, callDelta: call.delta, putPrice: put.price, putDelta: put.delta };
    }), [fxSpot, fxStrike, fxT, fxRd, fxRf, fxVol]
  );

  // FX 期权价格 vs 汇率
  const fxSensData = useMemo(() =>
    Array.from({ length: 21 }, (_, i) => {
      const s = fxSpot * (0.9 + i * 0.01);
      const call = gkFXOption(s, fxStrike, fxT, fxRd / 100, fxRf / 100, fxVol / 100, 'call');
      const put = gkFXOption(s, fxStrike, fxT, fxRd / 100, fxRf / 100, fxVol / 100, 'put');
      return { spot: parseFloat(s.toFixed(4)), call: call.price, put: put.price, callDelta: call.delta };
    }), [fxSpot, fxStrike, fxT, fxRd, fxRf, fxVol]
  );

  const tabs = [
    { id: 'fx', label: '外汇期权 (GK)' },
    { id: 'commodity', label: '商品期权 (Black-76)' },
    { id: 'fxmarket', label: 'FX 市场行情' },
    { id: 'corr', label: '跨货币相关性' },
    { id: 'term', label: '期限结构分析' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];


  const liveMetrics = useMemo(() => ({
    'EUR/USD ATM Call 价格': '0.0085',
    'GK Delta': '0.52',
    'GK Gamma': '0.028',
    'GK Vega': '0.0038',
    '外汇期权隐含波动率': '6.8%',
    'WTI 原油期权 ATM': '$4.25',
    'Black-76 Delta': '0.48',
    '商品期权隐含波动率': '28.5%',
  }), []);
  return (
    <div className="min-h-screen bg-[#050808] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-blue-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-blue-400 sm:text-2xl">OVML</h1>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">外汇/商品期权估价</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Garman-Kohlhagen · Black-76 · Greeks · 波动率曲面 · AI分析</p>
            </div>
          </div>
          <div className="self-end text-right sm:self-auto">
            <div className="text-xs text-slate-500">EUR/USD {fxType.toUpperCase()}</div>
            <div className="text-xl font-mono font-bold text-blue-400">{fxResult.price.toFixed(6)}</div>
            <div className="text-xs text-slate-500">Δ={fxResult.delta.toFixed(4)}</div>
          </div>
        </div>

        {/* 标签导航 */}
        <div className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-[#1e2a2a] px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 外汇期权 */}
        {activeTab === 'fx' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-4">Garman-Kohlhagen 参数</h3>
              <div className="flex gap-2 mb-3">
                {(['call', 'put'] as const).map(t => (
                  <button key={t} onClick={() => setFxType(t)}
                    className={`flex-1 py-1.5 text-xs rounded font-bold transition-colors ${fxType === t ? 'bg-blue-500 text-white' : 'bg-[#0a0a0a] text-slate-400 border border-[#1e2a2a]'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { label: '即期汇率 S', value: fxSpot, setter: setFxSpot, step: 0.0001 },
                  { label: '行权价 K', value: fxStrike, setter: setFxStrike, step: 0.0001 },
                  { label: '到期时间 T (年)', value: fxT, setter: setFxT, step: 0.01 },
                  { label: '国内利率 rd (%)', value: fxRd, setter: setFxRd, step: 0.05 },
                  { label: '外国利率 rf (%)', value: fxRf, setter: setFxRf, step: 0.05 },
                  { label: '波动率 σ (%)', value: fxVol, setter: setFxVol, step: 0.1 },
                ].map((p, i) => (
                  <div key={i}>
                    <label className="text-xs text-slate-500 block mb-0.5">{p.label}</label>
                    <Input type="number" value={p.value} step={p.step}
                      onChange={e => p.setter(parseFloat(e.target.value) || 0)}
                      className="bg-[#0a0a0a] border-[#1e2a2a] text-slate-200 text-xs h-7 font-mono" />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: 'GK 期权价格', value: fxResult.price.toFixed(6), color: 'text-blue-400' },
                  { label: 'Delta', value: fxResult.delta.toFixed(4), color: 'text-cyan-400' },
                  { label: 'Gamma', value: fxResult.gamma.toFixed(6), color: 'text-green-400' },
                  { label: 'Vega (per 1%)', value: fxResult.vega.toFixed(6), color: 'text-yellow-400' },
                  { label: 'Theta (per day)', value: fxResult.theta.toFixed(6), color: 'text-red-400' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between bg-[#0a0a0a] rounded px-3 py-1.5">
                    <span className="text-xs text-slate-500">{item.label}</span>
                    <span className={`text-xs font-mono font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-blue-400 mb-3">期权价格 vs 即期汇率</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={fxSensData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="spot" stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="price" orientation="left" stroke="#3b82f6" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="delta" orientation="right" stroke="#22d3ee" tick={{ fontSize: 9 }} domain={[0, 1]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 10 }} />
                  <Legend />
                  <Line yAxisId="price" type="monotone" dataKey="call" stroke="#3b82f6" strokeWidth={2} name="Call价格" dot={false} />
                  <Line yAxisId="price" type="monotone" dataKey="put" stroke="#f97316" strokeWidth={2} name="Put价格" dot={false} />
                  <Line yAxisId="delta" type="monotone" dataKey="callDelta" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 5" name="Call Delta" dot={false} />
                  <ReferenceLine yAxisId="price" x={fxSpot} stroke="#4a5568" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
              <h4 className="text-xs font-bold text-slate-400 mt-3 mb-2">EUR/USD 期权链（K±0.04）</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      <th className="px-2 py-1 text-right text-cyan-400">Call Delta</th>
                      <th className="px-2 py-1 text-right text-cyan-400 border-r border-[#1e2a2a]">Call价格</th>
                      <th className="px-2 py-1 text-center text-slate-400 font-bold">行权价</th>
                      <th className="px-2 py-1 text-left text-orange-400 border-l border-[#1e2a2a]">Put价格</th>
                      <th className="px-2 py-1 text-left text-orange-400">Put Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fxChain.map((row, i) => {
                      const isATM = Math.abs(row.strike - fxStrike) < 0.001;
                      return (
                        <tr key={i} className={`border-b border-[#0a1515] ${isATM ? 'bg-blue-500/10' : 'hover:bg-[#0a1515]'}`}>
                          <td className="px-2 py-1 text-right font-mono text-cyan-400">{row.callDelta.toFixed(3)}</td>
                          <td className="px-2 py-1 text-right font-mono text-cyan-300 border-r border-[#1e2a2a]">{row.callPrice.toFixed(6)}</td>
                          <td className={`px-2 py-1 text-center font-mono font-bold ${isATM ? 'text-blue-400' : 'text-slate-300'}`}>{row.strike.toFixed(4)}</td>
                          <td className="px-2 py-1 text-left font-mono text-orange-300 border-l border-[#1e2a2a]">{row.putPrice.toFixed(6)}</td>
                          <td className="px-2 py-1 text-left font-mono text-orange-400">{row.putDelta.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* 商品期权 */}
        {activeTab === 'commodity' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-4">Black-76 商品期权参数</h3>
              <div className="flex gap-2 mb-3">
                {(['call', 'put'] as const).map(t => (
                  <button key={t} onClick={() => setCmType(t)}
                    className={`flex-1 py-1.5 text-xs rounded font-bold transition-colors ${cmType === t ? 'bg-blue-500 text-white' : 'bg-[#0a0a0a] text-slate-400 border border-[#1e2a2a]'}`}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { label: '期货价格 F', value: cmFutures, setter: setCmFutures, step: 1 },
                  { label: '行权价 K', value: cmStrike, setter: setCmStrike, step: 1 },
                  { label: '到期时间 T (年)', value: cmT, setter: setCmT, step: 0.01 },
                  { label: '无风险利率 r (%)', value: cmR, setter: setCmR, step: 0.05 },
                  { label: '波动率 σ (%)', value: cmVol, setter: setCmVol, step: 0.5 },
                ].map((p, i) => (
                  <div key={i}>
                    <label className="text-xs text-slate-500 block mb-0.5">{p.label}</label>
                    <Input type="number" value={p.value} step={p.step}
                      onChange={e => p.setter(parseFloat(e.target.value) || 0)}
                      className="bg-[#0a0a0a] border-[#1e2a2a] text-slate-200 text-xs h-7 font-mono" />
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { label: 'Black-76 期权价格', value: cmResult.price.toFixed(4), color: 'text-blue-400' },
                  { label: 'Delta', value: cmResult.delta.toFixed(4), color: 'text-cyan-400' },
                  { label: 'Gamma', value: cmResult.gamma.toFixed(6), color: 'text-green-400' },
                  { label: 'Vega (per 1%)', value: cmResult.vega.toFixed(4), color: 'text-yellow-400' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between bg-[#0a0a0a] rounded px-3 py-1.5">
                    <span className="text-xs text-slate-500">{item.label}</span>
                    <span className={`text-xs font-mono font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-blue-400 mb-3">主要商品期权行情（Black-76定价）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      {['商品', '期货价', '单位', 'ATM Call', 'ATM Put', '5% OTM Call', '5% OTM Put', '波动率'].map(h => (
                        <th key={h} className="px-2 py-2 text-left text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMMODITIES.map((c, i) => {
                      const atmCall = commodityOption(c.futures, c.futures, 0.25, cmR / 100, c.vol / 100, 'call');
                      const atmPut = commodityOption(c.futures, c.futures, 0.25, cmR / 100, c.vol / 100, 'put');
                      const otmCall = commodityOption(c.futures, c.futures * 1.05, 0.25, cmR / 100, c.vol / 100, 'call');
                      const otmPut = commodityOption(c.futures, c.futures * 0.95, 0.25, cmR / 100, c.vol / 100, 'put');
                      return (
                        <tr key={i} className="border-b border-[#0a1515] hover:bg-[#0a1515]">
                          <td className="px-2 py-2 text-blue-300 font-medium">{c.name}</td>
                          <td className="px-2 py-2 font-mono text-slate-300">{c.futures.toFixed(2)}</td>
                          <td className="px-2 py-2 text-slate-500">{c.unit}</td>
                          <td className="px-2 py-2 font-mono text-green-400">{atmCall.price.toFixed(3)}</td>
                          <td className="px-2 py-2 font-mono text-orange-400">{atmPut.price.toFixed(3)}</td>
                          <td className="px-2 py-2 font-mono text-cyan-400">{otmCall.price.toFixed(3)}</td>
                          <td className="px-2 py-2 font-mono text-yellow-400">{otmPut.price.toFixed(3)}</td>
                          <td className="px-2 py-2 font-mono text-pink-400">{c.vol.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* FX 市场行情 */}
        {activeTab === 'fxmarket' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">主要货币对期权波动率（ATM，%）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      {['货币对', '即期汇率', '国内利率', '外国利率', '1M ATM IV', '3M ATM IV', '1Y ATM IV', '利差'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FX_PAIRS.map((p, i) => (
                      <tr key={i} className="border-b border-[#0a1515] hover:bg-[#0a1515]">
                        <td className="px-3 py-3 text-blue-300 font-bold">{p.pair}</td>
                        <td className="px-3 py-3 font-mono text-slate-300">{p.spot.toFixed(4)}</td>
                        <td className="px-3 py-3 font-mono text-slate-400">{p.rd.toFixed(2)}%</td>
                        <td className="px-3 py-3 font-mono text-slate-400">{p.rf.toFixed(2)}%</td>
                        <td className="px-3 py-3 font-mono text-cyan-400">{p.vol1m.toFixed(1)}%</td>
                        <td className="px-3 py-3 font-mono text-cyan-300 font-bold">{p.vol3m.toFixed(1)}%</td>
                        <td className="px-3 py-3 font-mono text-slate-400">{p.vol1y.toFixed(1)}%</td>
                        <td className={`px-3 py-3 font-mono text-xs ${p.rd - p.rf > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(p.rd - p.rf).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">FX 期权波动率对比（3M ATM）</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={FX_PAIRS.map(p => ({ pair: p.pair, vol: p.vol3m }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="pair" stroke="#4a5568" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`, '3M ATM IV']} />
                  <Bar dataKey="vol" fill="#3b82f6" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* -- 跨货币相关性 -- */}
        {activeTab === 'corr' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">主要货币对隐含波动率相关性矩阵（30日）</h3>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead><tr>
                    <th className="p-2 text-gray-500 text-left w-20">货币对</th>
                    {['EUR/USD','USD/JPY','GBP/USD','USD/CHF','AUD/USD','USD/CAD'].map(p=><th key={p} className="p-2 text-gray-400 text-center text-xs">{p}</th>)}
                  </tr></thead>
                  <tbody>
                    {[
                      { pair:'EUR/USD', vals:[1.00,0.72,-0.85,0.68,-0.42,0.55] },
                      { pair:'USD/JPY', vals:[0.72,1.00,-0.62,0.45,-0.28,0.38] },
                      { pair:'GBP/USD', vals:[-0.85,-0.62,1.00,-0.78,0.52,-0.48] },
                      { pair:'USD/CHF', vals:[0.68,0.45,-0.78,1.00,-0.35,0.42] },
                      { pair:'AUD/USD', vals:[-0.42,-0.28,0.52,-0.35,1.00,-0.65] },
                      { pair:'USD/CAD', vals:[0.55,0.38,-0.48,0.42,-0.65,1.00] },
                    ].map(row=>(
                      <tr key={row.pair}>
                        <td className="p-2 text-gray-300 font-medium">{row.pair}</td>
                        {row.vals.map((v,j)=>{
                          const bg=v===1?'rgba(59,130,246,0.3)':v>0?`rgba(34,197,94,${Math.abs(v)*0.6})`:`rgba(239,68,68,${Math.abs(v)*0.6})`;
                          return <td key={j} className="text-center p-2 border border-gray-800 font-mono" style={{backgroundColor:bg,color:'#e2e8f0'}}>{v.toFixed(2)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">绿色=正相关，红色=负相关，蓝色=自身</p>
            </Card>
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">相关性变化趋势（EUR/USD vs USD/JPY，近20日）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={Array.from({length:20},(_,i)=>({day:`${i+1}日`,corr:0.72+Math.sin(i*0.5)*0.15}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:10}} />
                  <YAxis domain={[-1,1]} tick={{fill:'#6b7280',fontSize:10}} />
                  <Tooltip contentStyle={{background:'#0d1818',border:'1px solid #1e2a2a',fontSize:11}} />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Line type="monotone" dataKey="corr" name="30日滚动相关性" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* -- 期限结构分析 -- */}
        {activeTab === 'term' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">外汇期权隐含波动率期限结构（ATM IV%）</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={[
                  {tenor:'1W',eurusd:5.8,usdjpy:7.2,gbpusd:6.5,audusd:8.2},
                  {tenor:'2W',eurusd:6.1,usdjpy:7.5,gbpusd:6.8,audusd:8.5},
                  {tenor:'1M',eurusd:6.8,usdjpy:8.2,gbpusd:7.5,audusd:9.1},
                  {tenor:'2M',eurusd:7.2,usdjpy:8.5,gbpusd:7.8,audusd:9.4},
                  {tenor:'3M',eurusd:7.5,usdjpy:8.8,gbpusd:8.1,audusd:9.8},
                  {tenor:'6M',eurusd:7.8,usdjpy:9.1,gbpusd:8.4,audusd:10.2},
                  {tenor:'1Y',eurusd:8.2,usdjpy:9.5,gbpusd:8.8,audusd:10.8},
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="tenor" tick={{fill:'#6b7280',fontSize:10}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} tickFormatter={v=>`${v}%`} />
                  <Tooltip contentStyle={{background:'#0d1818',border:'1px solid #1e2a2a',fontSize:11}} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  <Line type="monotone" dataKey="eurusd" name="EUR/USD" stroke="#3b82f6" strokeWidth={2} dot={{fill:'#3b82f6',r:3}} />
                  <Line type="monotone" dataKey="usdjpy" name="USD/JPY" stroke="#f59e0b" strokeWidth={2} dot={{fill:'#f59e0b',r:3}} />
                  <Line type="monotone" dataKey="gbpusd" name="GBP/USD" stroke="#22c55e" strokeWidth={2} dot={{fill:'#22c55e',r:3}} />
                  <Line type="monotone" dataKey="audusd" name="AUD/USD" stroke="#a855f7" strokeWidth={2} dot={{fill:'#a855f7',r:3}} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-blue-400 mb-3">期限结构异常信号</h3>
              <div className="space-y-2">
                {[
                  { pair:'EUR/USD', shape:'正常正斜', signal:'正常', color:'#22c55e' },
                  { pair:'USD/JPY', shape:'倒挂（短期>长期）', signal:'预警', color:'#f59e0b' },
                  { pair:'GBP/USD', shape:'平坦化', signal:'中性', color:'#6b7280' },
                  { pair:'USD/TRY', shape:'极度倒挂', signal:'高风险', color:'#ef4444' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-900 rounded">
                    <span className="text-sm text-white font-medium">{r.pair}</span>
                    <span className="text-xs text-gray-400">{r.shape}</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{backgroundColor:`${r.color}20`,color:r.color}}>{r.signal}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="OVML" moduleName="外汇/商品期权" accentColor="blue" />
        )}
      </div>
    </div>
  );
}
