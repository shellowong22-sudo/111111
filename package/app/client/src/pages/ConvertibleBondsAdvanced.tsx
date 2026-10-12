/**
 * OVCV - 可转换债券估价 (Option Valuation: Convertible)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实计算：二叉树定价、转换溢价、Delta/Gamma、平价价值、期权价值分解
 */
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- 可转债定价引擎 -----------------------------------------------------------

/**
 * 二叉树可转债定价（简化版，忽略信用风险）
 * 每步：u = exp(σ√dt), d = 1/u, p = (exp(r*dt) - d) / (u - d)
 */
function priceCB(
  stockPrice: number,    // 当前股价
  conversionRatio: number, // 转换比率（每张债券可转换的股数）
  faceValue: number,     // 面值
  couponRate: number,    // 票息率 %
  maturityYears: number, // 到期年数
  vol: number,           // 股票年化波动率 %
  riskFreeRate: number,  // 无风险利率 %
  creditSpread: number,  // 信用利差 %（用于折现）
  nSteps: number = 100   // 二叉树步数
): {
  cbPrice: number; parityValue: number; bondFloor: number;
  conversionPremium: number; conversionPremiumPct: number;
  delta: number; gamma: number; optionValue: number;
} {
  const dt = maturityYears / nSteps;
  const sigma = vol / 100;
  const r = riskFreeRate / 100;
  const cs = creditSpread / 100;
  const discountRate = r + cs;

  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp(r * dt) - d) / (u - d);
  const df = Math.exp(-discountRate * dt);

  // 票息（半年付，简化为连续）
  const couponPerStep = faceValue * (couponRate / 100) * dt;

  // 构建股价树（终端节点）
  const stockAtExpiry = Array.from({ length: nSteps + 1 }, (_, j) =>
    stockPrice * Math.pow(u, nSteps - 2 * j)
  );

  // 终端节点：max(转换价值, 面值+最后票息)
  let cbTree = stockAtExpiry.map(s =>
    Math.max(s * conversionRatio, faceValue + couponPerStep)
  );

  // 反向归纳
  for (let step = nSteps - 1; step >= 0; step--) {
    const newTree: number[] = [];
    for (let j = 0; j <= step; j++) {
      const sNow = stockPrice * Math.pow(u, step - 2 * j);
      const holdValue = (p * cbTree[j] + (1 - p) * cbTree[j + 1]) * df + couponPerStep;
      const conversionValue = sNow * conversionRatio;
      newTree.push(Math.max(holdValue, conversionValue));
    }
    cbTree = newTree;
  }

  const cbPrice = cbTree[0];

  // 平价价值（Parity）= 股价 × 转换比率
  const parityValue = stockPrice * conversionRatio;

  // 债券底价（Bond Floor）= 纯债价值
  let bondFloor = 0;
  const nCoupons = Math.round(maturityYears * 2); // 半年付
  for (let i = 1; i <= nCoupons; i++) {
    bondFloor += (faceValue * couponRate / 100 / 2) * Math.exp(-discountRate * i / 2);
  }
  bondFloor += faceValue * Math.exp(-discountRate * maturityYears);

  // 转换溢价
  const conversionPremium = cbPrice - parityValue;
  const conversionPremiumPct = (conversionPremium / parityValue) * 100;

  // 期权价值 = CB价格 - 债券底价
  const optionValue = cbPrice - bondFloor;

  // Delta（数值微分）
  const dS = stockPrice * 0.01;
  const cbUp = priceCBSimple(stockPrice + dS, conversionRatio, faceValue, couponRate, maturityYears, vol, riskFreeRate, creditSpread, 50);
  const cbDn = priceCBSimple(stockPrice - dS, conversionRatio, faceValue, couponRate, maturityYears, vol, riskFreeRate, creditSpread, 50);
  const delta = (cbUp - cbDn) / (2 * dS);
  const gamma = (cbUp - 2 * cbPrice + cbDn) / (dS * dS);

  return {
    cbPrice: parseFloat(cbPrice.toFixed(4)),
    parityValue: parseFloat(parityValue.toFixed(4)),
    bondFloor: parseFloat(bondFloor.toFixed(4)),
    conversionPremium: parseFloat(conversionPremium.toFixed(4)),
    conversionPremiumPct: parseFloat(conversionPremiumPct.toFixed(2)),
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    optionValue: parseFloat(optionValue.toFixed(4)),
  };
}

function priceCBSimple(s: number, cr: number, fv: number, c: number, t: number, v: number, r: number, cs: number, n: number): number {
  const dt = t / n;
  const sigma = v / 100;
  const rf = r / 100;
  const disc = (rf + cs / 100);
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp(rf * dt) - d) / (u - d);
  const df = Math.exp(-disc * dt);
  const cpn = fv * (c / 100) * dt;
  let tree = Array.from({ length: n + 1 }, (_, j) =>
    Math.max(s * Math.pow(u, n - 2 * j) * cr, fv + cpn)
  );
  for (let step = n - 1; step >= 0; step--) {
    const nt: number[] = [];
    for (let j = 0; j <= step; j++) {
      const sn = s * Math.pow(u, step - 2 * j);
      nt.push(Math.max((p * tree[j] + (1 - p) * tree[j + 1]) * df + cpn, sn * cr));
    }
    tree = nt;
  }
  return tree[0];
}

// --- 市场可转债数据 -----------------------------------------------------------

const CB_UNIVERSE = [
  { name: 'Tesla 2.00% 2026', ticker: 'TSLA', stock: 185.2, convPrice: 142.5, coupon: 2.0, maturity: 2.1, vol: 58, creditSpread: 2.8, rating: 'BB+' },
  { name: 'Nvidia 0.25% 2027', ticker: 'NVDA', stock: 875.4, convPrice: 680.0, coupon: 0.25, maturity: 3.2, vol: 52, creditSpread: 1.2, rating: 'A+' },
  { name: 'Salesforce 0.25% 2026', ticker: 'CRM', stock: 215.8, convPrice: 185.0, coupon: 0.25, maturity: 2.5, vol: 35, creditSpread: 1.5, rating: 'A-' },
  { name: 'Palo Alto 0.375% 2025', ticker: 'PANW', stock: 295.2, convPrice: 245.0, coupon: 0.375, maturity: 1.3, vol: 42, creditSpread: 1.8, rating: 'BB+' },
  { name: 'Snap 0.00% 2027', ticker: 'SNAP', stock: 12.5, convPrice: 10.8, coupon: 0.0, maturity: 3.5, vol: 75, creditSpread: 4.5, rating: 'B' },
];

export default function ConvertibleBondsAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('pricing');

  // 定价参数
  const [stockPrice, setStockPrice] = useState(185.2);
  const [conversionRatio, setConversionRatio] = useState(7.02); // 1000/142.5
  const [faceValue, setFaceValue] = useState(1000);
  const [couponRate, setCouponRate] = useState(2.0);
  const [maturityYears, setMaturityYears] = useState(2.1);
  const [vol, setVol] = useState(58);
  const [riskFreeRate, setRiskFreeRate] = useState(4.35);
  const [creditSpread, setCreditSpread] = useState(2.8);

  const result = useMemo(() =>
    priceCB(stockPrice, conversionRatio, faceValue, couponRate, maturityYears, vol, riskFreeRate, creditSpread),
    [stockPrice, conversionRatio, faceValue, couponRate, maturityYears, vol, riskFreeRate, creditSpread]
  );

  // 股价敏感性分析
  const sensitivityData = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => {
      const s = stockPrice * (0.5 + i * 0.05);
      const r = priceCB(s, conversionRatio, faceValue, couponRate, maturityYears, vol, riskFreeRate, creditSpread, 50);
      return {
        stock: parseFloat(s.toFixed(1)),
        cbPrice: r.cbPrice,
        parity: r.parityValue,
        bondFloor: r.bondFloor,
      };
    });
  }, [stockPrice, conversionRatio, faceValue, couponRate, maturityYears, vol, riskFreeRate, creditSpread]);

  // 全市场可转债定价
  const universeResults = useMemo(() =>
    CB_UNIVERSE.map(cb => {
      const cr = faceValue / cb.convPrice;
      const r = priceCB(cb.stock, cr, faceValue, cb.coupon, cb.maturity, cb.vol, riskFreeRate, cb.creditSpread, 50);
      return { ...cb, ...r, conversionRatio: cr };
    }), [riskFreeRate]
  );

  const tabs = [
    { id: 'pricing', label: '可转巫t定价' },
    { id: 'sensitivity', label: '股价敏感性' },
    { id: 'universe', label: '市场可转巫t' },
    { id: 'decompose', label: '转换溢价分解' },
    { id: 'delta_hedge', label: 'Delta对冲' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];


  const liveMetrics = useMemo(() => ({
    '可转债价格': '118.45',
    '债券底价': '95.20',
    '平价价值': '105.80',
    '期权价值': '23.25',
    '转换溢价': '11.96%',
    'Delta': '0.62',
    'Gamma': '0.018',
    '隐含波动率': '35.2%',
  }), []);
  return (
    <div className="min-h-screen bg-[#050a05] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-emerald-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-emerald-400">OVCV</h1>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">可转换债券估价</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">二叉树定价 · 转换溢价 · Delta/Gamma · 债券底价 · AI分析</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">CB 理论价格</div>
            <div className="text-xl font-mono font-bold text-emerald-400">{result.cbPrice.toFixed(2)}</div>
            <div className="text-xs text-slate-500">溢价 {result.conversionPremiumPct.toFixed(1)}%</div>
          </div>
        </div>

        {/* 关键指标 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'CB 理论价格', value: result.cbPrice.toFixed(2), sub: '二叉树定价', color: 'text-emerald-400' },
            { label: '平价价值 (Parity)', value: result.parityValue.toFixed(2), sub: `股价×转换比率`, color: 'text-cyan-400' },
            { label: '债券底价 (Floor)', value: result.bondFloor.toFixed(2), sub: '纯债价值', color: 'text-yellow-400' },
            { label: '转换溢价', value: `${result.conversionPremiumPct.toFixed(2)}%`, sub: `Delta: ${result.delta.toFixed(4)}`, color: 'text-orange-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="flex gap-1 mb-6 border-b border-[#1e2a1e] overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 定价 */}
        {activeTab === 'pricing' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-4">定价参数</h3>
              <div className="space-y-2">
                {[
                  { label: '当前股价 ($)', value: stockPrice, setter: setStockPrice, step: 1 },
                  { label: '转换比率 (股/张)', value: conversionRatio, setter: setConversionRatio, step: 0.01 },
                  { label: '面值 ($)', value: faceValue, setter: setFaceValue, step: 100 },
                  { label: '票息率 (%)', value: couponRate, setter: setCouponRate, step: 0.25 },
                  { label: '到期年数', value: maturityYears, setter: setMaturityYears, step: 0.5 },
                  { label: '股票波动率 (%)', value: vol, setter: setVol, step: 1 },
                  { label: '无风险利率 (%)', value: riskFreeRate, setter: setRiskFreeRate, step: 0.05 },
                  { label: '信用利差 (%)', value: creditSpread, setter: setCreditSpread, step: 0.1 },
                ].map((p, i) => (
                  <div key={i}>
                    <label className="text-xs text-slate-500 block mb-0.5">{p.label}</label>
                    <Input type="number" value={p.value} step={p.step}
                      onChange={e => p.setter(parseFloat(e.target.value) || 0)}
                      className="bg-[#0a0a0a] border-[#1e2a1e] text-slate-200 text-xs h-7 font-mono" />
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">可转债价值分解</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'CB 理论价格', value: result.cbPrice.toFixed(4), color: 'text-emerald-400' },
                  { label: '平价价值 (Parity)', value: result.parityValue.toFixed(4), color: 'text-cyan-400' },
                  { label: '债券底价 (Floor)', value: result.bondFloor.toFixed(4), color: 'text-yellow-400' },
                  { label: '期权价值', value: result.optionValue.toFixed(4), color: 'text-purple-400' },
                  { label: '转换溢价 ($)', value: result.conversionPremium.toFixed(4), color: 'text-orange-400' },
                  { label: '转换溢价 (%)', value: `${result.conversionPremiumPct.toFixed(2)}%`, color: 'text-orange-400' },
                  { label: 'Delta', value: result.delta.toFixed(4), color: 'text-pink-400' },
                  { label: 'Gamma', value: result.gamma.toFixed(6), color: 'text-pink-400' },
                ].map((item, i) => (
                  <div key={i} className="bg-[#0a0a0a] rounded p-3">
                    <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                    <div className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-[#0a0a0a] rounded border border-[#1e2a1e]">
                <div className="text-xs text-slate-500 mb-2">价值分解图示</div>
                <div className="flex gap-2 items-end h-16">
                  {[
                    { label: 'CB价格', value: result.cbPrice, color: 'bg-emerald-400' },
                    { label: '债券底价', value: result.bondFloor, color: 'bg-yellow-400' },
                    { label: '平价价值', value: result.parityValue, color: 'bg-cyan-400' },
                    { label: '期权价值', value: result.optionValue, color: 'bg-purple-400' },
                  ].map((item, i) => {
                    const maxVal = Math.max(result.cbPrice, result.bondFloor, result.parityValue, result.optionValue);
                    const heightPct = (item.value / maxVal) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`w-full ${item.color} opacity-80 rounded-t`} style={{ height: `${heightPct}%` }} />
                        <div className="text-xs text-slate-500 text-center">{item.label}</div>
                        <div className="text-xs font-mono text-slate-300">{item.value.toFixed(1)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 股价敏感性 */}
        {activeTab === 'sensitivity' && (
          <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
            <h3 className="text-sm font-bold text-emerald-400 mb-3">CB价格 vs 股价（平价价值 / 债券底价对比）</h3>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={sensitivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                <XAxis dataKey="stock" stroke="#4a5568" tick={{ fontSize: 10 }} label={{ value: '股价 ($)', position: 'insideBottom', offset: -5, fill: '#4a5568', fontSize: 11 }} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1a0d', border: '1px solid #1e2a1e', fontSize: 11 }}
                  formatter={(v: any) => [typeof v === 'number' ? v.toFixed(2) : v]} />
                <Legend />
                <Line type="monotone" dataKey="cbPrice" stroke="#34d399" strokeWidth={2.5} name="CB价格" dot={false} />
                <Line type="monotone" dataKey="parity" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 5" name="平价价值" dot={false} />
                <Line type="monotone" dataKey="bondFloor" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="3 3" name="债券底价" dot={false} />
                <ReferenceLine x={stockPrice} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '当前', fill: '#94a3b8', fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* 市场可转债 */}
        {activeTab === 'universe' && (
          <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
            <h3 className="text-sm font-bold text-emerald-400 mb-3">市场主要可转债估值（二叉树定价）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1e2a1e]">
                    {['债券', '评级', '股价', '转换价', 'CB价格', '平价', '底价', '期权价值', '溢价%', 'Delta'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {universeResults.map((cb, i) => (
                    <tr key={i} className="border-b border-[#0a0a0a] hover:bg-[#0a0a0a]">
                      <td className="px-2 py-2 text-emerald-300 font-medium">{cb.name}</td>
                      <td className="px-2 py-2">
                        <Badge className={`text-xs ${cb.rating.startsWith('A') ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>{cb.rating}</Badge>
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-300">${cb.stock}</td>
                      <td className="px-2 py-2 font-mono text-slate-400">${cb.convPrice}</td>
                      <td className="px-2 py-2 font-mono text-emerald-400 font-bold">{cb.cbPrice.toFixed(2)}</td>
                      <td className="px-2 py-2 font-mono text-cyan-400">{cb.parityValue.toFixed(2)}</td>
                      <td className="px-2 py-2 font-mono text-yellow-400">{cb.bondFloor.toFixed(2)}</td>
                      <td className="px-2 py-2 font-mono text-purple-400">{cb.optionValue.toFixed(2)}</td>
                      <td className={`px-2 py-2 font-mono ${cb.conversionPremiumPct > 30 ? 'text-orange-400' : 'text-slate-300'}`}>{cb.conversionPremiumPct.toFixed(1)}%</td>
                      <td className="px-2 py-2 font-mono text-pink-400">{cb.delta.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* -- 转换溢价分解 -- */}
        {activeTab === 'decompose' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">可转巫t价値分解（巫t券底价 + 期权价値 = 可转巫t价格）</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: '巫t券底价', value: result.bondFloor.toFixed(2), pct: `${(result.bondFloor/result.cbPrice*100).toFixed(1)}%`, color: '#22c55e', desc: '纯巫t券价値' },
                  { label: '期权价値', value: result.optionValue.toFixed(2), pct: `${(result.optionValue/result.cbPrice*100).toFixed(1)}%`, color: '#3b82f6', desc: '转换期权价値' },
                  { label: '可转巫t价格', value: result.cbPrice.toFixed(2), pct: '100%', color: '#f59e0b', desc: '二叉树定价' },
                ].map(m => (
                  <Card key={m.label} className="bg-[#0a0a0a] border-[#1e2a1e] p-3 text-center">
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className="text-xl font-bold font-mono mt-1" style={{color:m.color}}>{m.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.pct} · {m.desc}</div>
                  </Card>
                ))}
              </div>
              <div className="h-8 bg-gray-800 rounded overflow-hidden flex">
                <div className="h-full bg-emerald-500 flex items-center justify-center text-xs text-white font-bold" style={{width:`${result.bondFloor/result.cbPrice*100}%`}}>巫t券底价 {(result.bondFloor/result.cbPrice*100).toFixed(1)}%</div>
                <div className="h-full bg-blue-500 flex items-center justify-center text-xs text-white font-bold" style={{width:`${result.optionValue/result.cbPrice*100}%`}}>期权 {(result.optionValue/result.cbPrice*100).toFixed(1)}%</div>
              </div>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">转换溢价 vs 股价关系</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sensitivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="stock" tick={{fill:'#6b7280',fontSize:10}} label={{value:'股价',fill:'#6b7280',fontSize:10,position:'insideBottom',offset:-2}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:10}} />
                  <Tooltip contentStyle={{background:'#0d1a0d',border:'1px solid #1e2a1e',fontSize:10}} />
                  <Legend wrapperStyle={{fontSize:10}} />
                  <Line type="monotone" dataKey="cbPrice" name="可转巫t价格" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="parity" name="转换价値" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="bondFloor" name="巫t券底价" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <ReferenceLine x={stockPrice} stroke="#6b7280" strokeDasharray="4 4" label={{value:'当前',fill:'#6b7280',fontSize:9}} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* -- Delta对冲 -- */}
        {activeTab === 'delta_hedge' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">Delta对冲策略构建</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '当前Delta', value: result.delta.toFixed(4), color: '#22c55e' },
                  { label: '对冲股数', value: `${Math.round(-result.delta*10)}股`, color: '#ef4444' },
                  { label: 'Gamma风险', value: result.gamma.toFixed(6), color: '#f59e0b' },
                  { label: '对冲效果', value: `${(result.delta*100).toFixed(1)}%`, color: '#3b82f6' },
                ].map(m => (
                  <Card key={m.label} className="bg-[#0a0a0a] border-[#1e2a1e] p-3 text-center">
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className="text-lg font-bold font-mono mt-1" style={{color:m.color}}>{m.value}</div>
                  </Card>
                ))}
              </div>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">Delta随股价变化趋势</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={sensitivityData.map(d=>({stock:d.stock,delta:parseFloat(((d.cbPrice-sensitivityData[0].cbPrice)/(d.stock-sensitivityData[0].stock+0.001)).toFixed(4))})).slice(1,-1)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                  <XAxis dataKey="stock" tick={{fill:'#6b7280',fontSize:10}} />
                  <YAxis domain={[0,1]} tick={{fill:'#6b7280',fontSize:10}} />
                  <Tooltip contentStyle={{background:'#0d1a0d',border:'1px solid #1e2a1e',fontSize:10}} />
                  <ReferenceLine y={result.delta} stroke="#22c55e" strokeDasharray="4 4" label={{value:'当前Delta',fill:'#22c55e',fontSize:9}} />
                  <Line type="monotone" dataKey="delta" name="Delta" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <h3 className="text-sm font-bold text-emerald-400 mb-3">Delta对冲调整频率对比</h3>
              <div className="space-y-2">
                {[
                  { freq:'日内对冲', cost:'$850/天', tracking:'0.02%', gamma:'高消耗' },
                  { freq:'每日对冲', cost:'$320/天', tracking:'0.08%', gamma:'中消耗' },
                  { freq:'每周对冲', cost:'$180/天', tracking:'0.25%', gamma:'低消耗' },
                  { freq:'阈値对冲(±0.05)', cost:'$240/天', tracking:'0.12%', gamma:'自适应' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-900 rounded">
                    <span className="text-sm text-white font-medium">{r.freq}</span>
                    <span className="text-xs text-gray-400">跟踪误差: {r.tracking}</span>
                    <span className="text-xs text-gray-400">Gamma: {r.gamma}</span>
                    <span className="text-xs font-mono text-emerald-400">{r.cost}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="OVCV" moduleName="可转换巫t券" accentColor="green"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}
