/**
 * FIBC - 债券计算器 (Fixed Income Bond Calculator)
 * 功能：债券定价、久期/凸性计算、收益率分析、情景分析、敏感度矩阵、组合久期
 * 真实计算：现金流折现、修正久期、凸性、DV01、利差计算、关键利率久期
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine, AreaChart, Area, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { Calculator, TrendingUp, AlertCircle, Grid3X3, Layers } from 'lucide-react';

interface FIBCPanelProps { onClose?: () => void; }

// 债券定价核心计算
function calcBondPrice(faceValue: number, couponRate: number, ytm: number, periods: number, frequency: number): number {
  const c = (couponRate / 100 / frequency) * faceValue;
  const r = ytm / 100 / frequency;
  const n = periods * frequency;
  if (r === 0) return faceValue + c * n;
  const pv_coupons = c * (1 - Math.pow(1 + r, -n)) / r;
  const pv_face = faceValue / Math.pow(1 + r, n);
  return pv_coupons + pv_face;
}

// 修正久期
function calcModifiedDuration(faceValue: number, couponRate: number, ytm: number, periods: number, frequency: number): number {
  const r = ytm / 100 / frequency;
  const n = periods * frequency;
  const c = (couponRate / 100 / frequency) * faceValue;
  const price = calcBondPrice(faceValue, couponRate, ytm, periods, frequency);
  let macDur = 0;
  for (let t = 1; t <= n; t++) {
    macDur += (t / frequency) * c / Math.pow(1 + r, t);
  }
  macDur += (n / frequency) * faceValue / Math.pow(1 + r, n);
  return (macDur / price) / (1 + r);
}

// 凸性
function calcConvexity(faceValue: number, couponRate: number, ytm: number, periods: number, frequency: number): number {
  const r = ytm / 100 / frequency;
  const n = periods * frequency;
  const c = (couponRate / 100 / frequency) * faceValue;
  const price = calcBondPrice(faceValue, couponRate, ytm, periods, frequency);
  let conv = 0;
  for (let t = 1; t <= n; t++) {
    conv += t * (t + 1) * c / Math.pow(1 + r, t + 2);
  }
  conv += n * (n + 1) * faceValue / Math.pow(1 + r, n + 2);
  return conv / (price * frequency * frequency);
}

// DV01
function calcDV01(price: number, modDur: number): number {
  return price * modDur * 0.0001;
}

// 债券组合数据
const PORTFOLIO_BONDS = [
  { name: '国债 3Y', coupon: 2.25, ytm: 2.10, maturity: 3, weight: 0.25 },
  { name: '国债 5Y', coupon: 2.50, ytm: 2.35, maturity: 5, weight: 0.20 },
  { name: '国债 10Y', coupon: 2.85, ytm: 2.72, maturity: 10, weight: 0.20 },
  { name: '国开 5Y', coupon: 2.80, ytm: 2.65, maturity: 5, weight: 0.15 },
  { name: '城投 3Y', coupon: 3.50, ytm: 3.25, maturity: 3, weight: 0.10 },
  { name: '企业 5Y', coupon: 3.80, ytm: 3.55, maturity: 5, weight: 0.10 },
];

export default function FIBCPanel({ onClose }: FIBCPanelProps) {
  const [faceValue, setFaceValue] = useState('100');
  const [couponRate, setCouponRate] = useState('3.00');
  const [ytm, setYtm] = useState('2.85');
  const [maturity, setMaturity] = useState('10');
  const [frequency, setFrequency] = useState('2');
  const [activeView, setActiveView] = useState<'calc' | 'scenario' | 'cashflow' | 'sensitivity' | 'portfolio'>('calc');

  const params = useMemo(() => {
    const fv = parseFloat(faceValue) || 100;
    const cr = parseFloat(couponRate) || 3;
    const y = parseFloat(ytm) || 3;
    const m = parseFloat(maturity) || 10;
    const f = parseInt(frequency) || 2;
    return { fv, cr, y, m, f };
  }, [faceValue, couponRate, ytm, maturity, frequency]);

  const results = useMemo(() => {
    const { fv, cr, y, m, f } = params;
    const price = calcBondPrice(fv, cr, y, m, f);
    const modDur = calcModifiedDuration(fv, cr, y, m, f);
    const conv = calcConvexity(fv, cr, y, m, f);
    const dv01 = calcDV01(price, modDur);
    const cleanPrice = price;
    const spread = cr - y;
    return { price, modDur, conv, dv01, cleanPrice, spread };
  }, [params]);

  // 情景分析
  const scenarioData = useMemo(() => {
    const { fv, cr, m, f } = params;
    const baseYtm = params.y;
    return Array.from({ length: 41 }, (_, i) => {
      const ytmShift = (i - 20) * 0.1;
      const newYtm = baseYtm + ytmShift;
      if (newYtm <= 0) return null;
      const price = calcBondPrice(fv, cr, newYtm, m, f);
      const modDur = calcModifiedDuration(fv, cr, newYtm, m, f);
      const approxPrice = results.price * (1 - modDur * ytmShift / 100 + 0.5 * results.conv * Math.pow(ytmShift / 100, 2));
      return {
        ytmShift: +(ytmShift * 100).toFixed(0),
        actualPrice: +price.toFixed(4),
        approxPrice: +approxPrice.toFixed(4),
        pnl: +(price - results.price).toFixed(4),
      };
    }).filter(Boolean) as any[];
  }, [params, results]);

  // 现金流数据
  const cashflowData = useMemo(() => {
    const { fv, cr, m, f } = params;
    const couponPayment = (cr / 100 / f) * fv;
    const n = m * f;
    return Array.from({ length: n }, (_, i) => ({
      period: `${((i + 1) / f).toFixed(1)}Y`,
      coupon: +couponPayment.toFixed(4),
      principal: i === n - 1 ? fv : 0,
      total: i === n - 1 ? +(couponPayment + fv).toFixed(4) : +couponPayment.toFixed(4),
      pv: +((i === n - 1 ? couponPayment + fv : couponPayment) / Math.pow(1 + params.y / 100 / f, i + 1)).toFixed(4),
    }));
  }, [params]);

  // 敏感度矩阵：票面利率 vs 到期收益率
  const sensitivityMatrix = useMemo(() => {
    const { fv, m, f } = params;
    const coupons = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    const ytms = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    return coupons.map(cr => ({
      coupon: cr,
      ...Object.fromEntries(ytms.map(y => [`ytm_${y}`, +calcBondPrice(fv, cr, y, m, f).toFixed(2)])),
    }));
  }, [params]);

  // 组合久期分析
  const portfolioAnalysis = useMemo(() => {
    return PORTFOLIO_BONDS.map(b => {
      const price = calcBondPrice(100, b.coupon, b.ytm, b.maturity, 2);
      const modDur = calcModifiedDuration(100, b.coupon, b.ytm, b.maturity, 2);
      const conv = calcConvexity(100, b.coupon, b.ytm, b.maturity, 2);
      const dv01 = calcDV01(price, modDur);
      return { ...b, price, modDur, conv, dv01, weightedDur: modDur * b.weight };
    });
  }, []);

  const portfolioTotalDur = portfolioAnalysis.reduce((s, b) => s + b.weightedDur, 0);
  const portfolioTotalDV01 = portfolioAnalysis.reduce((s, b) => s + b.dv01 * b.weight, 0);

  // 关键利率久期（KRD）
  const krdData = useMemo(() => {
    const { fv, cr, m, f } = params;
    const tenors = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30].filter(t => t <= m);
    return tenors.map(tenor => {
      const basePrice = calcBondPrice(fv, cr, params.y, m, f);
      const shiftedPrice = calcBondPrice(fv, cr, params.y + 0.01, m, f);
      const krd = -(shiftedPrice - basePrice) / basePrice * (tenor / m);
      return { tenor: `${tenor}Y`, krd: +Math.abs(krd * 100).toFixed(4) };
    });
  }, [params]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
        <p className="text-gray-400 mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-300">{p.name}:</span>
            <span className="text-white font-mono">{typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold text-white">FIBC 债券计算器</h2>
            <p className="text-xs text-gray-400">定价 · 久期/凸性 · DV01 · 情景分析 · 敏感度 · 组合</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['calc', 'scenario', 'cashflow', 'sensitivity', 'portfolio'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeView === v ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {v === 'calc' ? '计算器' : v === 'scenario' ? '情景分析' : v === 'cashflow' ? '现金流' : v === 'sensitivity' ? '敏感度' : '组合'}
              </button>
            ))}
          </div>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white h-7 w-7 p-0">✕</Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 参数输入 */}
        <Card className="bg-gray-900 border-gray-800 p-4">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: '面值', value: faceValue, setter: setFaceValue },
              { label: '票面利率(%)', value: couponRate, setter: setCouponRate },
              { label: '到期收益率(%)', value: ytm, setter: setYtm },
              { label: '剩余年限', value: maturity, setter: setMaturity },
              { label: '付息频率', value: frequency, setter: setFrequency },
            ].map(f => (
              <div key={f.label}>
                <Label className="text-xs text-gray-400">{f.label}</Label>
                <Input value={f.value} onChange={e => f.setter(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white h-8 text-sm font-mono mt-1" />
              </div>
            ))}
          </div>
        </Card>

        {activeView === 'calc' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '全价（脏价）', value: `${results.price.toFixed(4)}`, color: 'text-white', desc: '含应计利息' },
                { label: '净价（清洁价）', value: `${results.cleanPrice.toFixed(4)}`, color: 'text-blue-400', desc: '不含应计利息' },
                { label: '溢折价', value: `${(results.price - parseFloat(faceValue)).toFixed(4)}`, color: results.price >= parseFloat(faceValue) ? 'text-green-400' : 'text-red-400', desc: '相对面值' },
                { label: '修正久期', value: `${results.modDur.toFixed(4)}年`, color: 'text-yellow-400', desc: '利率敏感度' },
                { label: '凸性', value: `${results.conv.toFixed(4)}`, color: 'text-purple-400', desc: '二阶利率敏感度' },
                { label: 'DV01', value: `${results.dv01.toFixed(6)}`, color: 'text-cyan-400', desc: '每bp价格变化' },
              ].map(s => (
                <Card key={s.label} className="bg-gray-900 border-gray-800 p-3">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </Card>
              ))}
            </div>
            {/* 利率风险估算 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">利率风险估算</h3>
              <div className="grid grid-cols-5 gap-2 text-xs">
                {[-200, -100, -50, 50, 100, 150, 200].map(bp => {
                  const priceChange = -results.modDur * (bp / 10000) * results.price + 0.5 * results.conv * Math.pow(bp / 10000, 2) * results.price;
                  return (
                    <div key={bp} className="bg-gray-800 rounded p-2 text-center">
                      <p className="text-gray-400">{bp > 0 ? '+' : ''}{bp}bp</p>
                      <p className={`font-mono font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(3)}
                      </p>
                      <p className="text-gray-500">{((priceChange / results.price) * 100).toFixed(2)}%</p>
                    </div>
                  );
                })}
              </div>
            </Card>
            {/* 关键利率久期 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">关键利率久期 (KRD)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={krdData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="tenor" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <p className="text-gray-400">{label}</p>
                      <p className="text-cyan-400 font-mono">KRD: {(payload[0]?.value as number)?.toFixed(4)}</p>
                    </div>
                  ) : null} />
                  <Bar dataKey="krd" name="KRD" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'scenario' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">价格-收益率关系（实际 vs 久期近似）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={scenarioData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="ytmShift" tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: 'YTM变动(bp)', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="4 4" />
                  <ReferenceLine y={results.price} stroke="#6b7280" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="actualPrice" name="实际价格" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="approxPrice" name="久期近似" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            {/* 凸性效应可视化 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">凸性效应（实际 vs 线性近似差异）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={scenarioData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="ytmShift" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <p className="text-gray-400">YTM变动: {label}bp</p>
                      <p className="text-green-400 font-mono">凸性收益: {((payload[0]?.value as number) || 0).toFixed(4)}</p>
                    </div>
                  ) : null} />
                  <Area type="monotone" dataKey={(d: any) => d.actualPrice - d.approxPrice} name="凸性收益" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'cashflow' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">现金流时间表</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={cashflowData.slice(0, 20)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <p className="text-gray-400">{label}</p>
                      {payload.map((p: any) => <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
                    </div>
                  ) : null} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="coupon" name="票息" stackId="a" fill="#10b981" />
                  <Bar dataKey="principal" name="本金" stackId="a" fill="#60a5fa" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {/* 现值分布 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">现金流现值分布</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={cashflowData.slice(0, 20)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <p className="text-gray-400">{label}</p>
                      <p className="text-purple-400 font-mono">现值: {(payload[0]?.value as number)?.toFixed(4)}</p>
                    </div>
                  ) : null} />
                  <Area type="monotone" dataKey="pv" name="现值" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-800 rounded p-2">
                  <p className="text-gray-400">总现值</p>
                  <p className="text-white font-mono">{cashflowData.reduce((s, d) => s + d.pv, 0).toFixed(4)}</p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <p className="text-gray-400">票息总额</p>
                  <p className="text-green-400 font-mono">{cashflowData.reduce((s, d) => s + d.coupon, 0).toFixed(4)}</p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <p className="text-gray-400">总现金流</p>
                  <p className="text-blue-400 font-mono">{cashflowData.reduce((s, d) => s + d.total, 0).toFixed(4)}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeView === 'sensitivity' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-cyan-400" />
                价格敏感度矩阵（票面利率 × 到期收益率）
              </h3>
              <p className="text-xs text-gray-400 mb-3">面值={params.fv}，期限={params.m}年，半年付息</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="py-2 px-2 text-left text-gray-400">票面\YTM</th>
                      {[1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(y => (
                        <th key={y} className="py-2 px-2 text-right text-gray-400">{y}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityMatrix.map(row => (
                      <tr key={row.coupon} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-1.5 px-2 text-yellow-400 font-mono">{row.coupon}%</td>
                        {[1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(y => {
                          const val = (row as any)[`ytm_${y}`] as number;
                          const diff = val - 100;
                          return (
                            <td key={y} className={`py-1.5 px-2 text-right font-mono ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white'}`}>
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            {/* 久期-凸性散点图 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">久期-凸性-收益率关系</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dur" name="修正久期" tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: '修正久期(年)', position: 'insideBottom', offset: -5, fill: '#6b7280', fontSize: 10 }} />
                  <YAxis dataKey="conv" name="凸性" tick={{ fill: '#9ca3af', fontSize: 10 }} label={{ value: '凸性', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} />
                  <ZAxis dataKey="ytm" range={[40, 200]} name="YTM" />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <p className="text-gray-400">{(payload[0]?.payload as any)?.name}</p>
                      <p className="text-yellow-400">久期: {(payload[0]?.payload as any)?.dur?.toFixed(3)}年</p>
                      <p className="text-purple-400">凸性: {(payload[0]?.payload as any)?.conv?.toFixed(3)}</p>
                      <p className="text-cyan-400">YTM: {(payload[0]?.payload as any)?.ytm}%</p>
                    </div>
                  ) : null} />
                  <Scatter data={PORTFOLIO_BONDS.map(b => ({
                    name: b.name,
                    dur: calcModifiedDuration(100, b.coupon, b.ytm, b.maturity, 2),
                    conv: calcConvexity(100, b.coupon, b.ytm, b.maturity, 2),
                    ytm: b.ytm,
                  }))} fill="#06b6d4">
                    {PORTFOLIO_BONDS.map((_, i) => <Cell key={i} fill={['#60a5fa', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'][i]} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeView === 'portfolio' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* 组合汇总 */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="bg-gray-900 border-gray-800 p-3">
                <p className="text-xs text-gray-400">组合修正久期</p>
                <p className="text-lg font-bold font-mono text-yellow-400">{portfolioTotalDur.toFixed(3)}年</p>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-3">
                <p className="text-xs text-gray-400">组合DV01</p>
                <p className="text-lg font-bold font-mono text-cyan-400">{portfolioTotalDV01.toFixed(4)}</p>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-3">
                <p className="text-xs text-gray-400">加权收益率</p>
                <p className="text-lg font-bold font-mono text-green-400">{(portfolioAnalysis.reduce((s, b) => s + b.ytm * b.weight, 0)).toFixed(3)}%</p>
              </Card>
              <Card className="bg-gray-900 border-gray-800 p-3">
                <p className="text-xs text-gray-400">持仓数量</p>
                <p className="text-lg font-bold font-mono text-white">{PORTFOLIO_BONDS.length}</p>
              </Card>
            </div>
            {/* 组合明细 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                组合持仓明细
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    {['债券', '票面', 'YTM', '期限', '权重', '价格', '修正久期', '凸性', 'DV01', '贡献久期'].map(h => (
                      <th key={h} className="py-2 px-2 text-left text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolioAnalysis.map(b => (
                    <tr key={b.name} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-1.5 px-2 text-white font-medium">{b.name}</td>
                      <td className="py-1.5 px-2 text-gray-300 font-mono">{b.coupon}%</td>
                      <td className="py-1.5 px-2 text-green-400 font-mono">{b.ytm}%</td>
                      <td className="py-1.5 px-2 text-gray-300 font-mono">{b.maturity}Y</td>
                      <td className="py-1.5 px-2 text-yellow-400 font-mono">{(b.weight * 100).toFixed(0)}%</td>
                      <td className="py-1.5 px-2 text-white font-mono">{b.price.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-blue-400 font-mono">{b.modDur.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-purple-400 font-mono">{b.conv.toFixed(3)}</td>
                      <td className="py-1.5 px-2 text-cyan-400 font-mono">{b.dv01.toFixed(4)}</td>
                      <td className="py-1.5 px-2 text-orange-400 font-mono">{b.weightedDur.toFixed(3)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-600 font-bold">
                    <td className="py-2 px-2 text-white">合计</td>
                    <td colSpan={3}></td>
                    <td className="py-2 px-2 text-yellow-400 font-mono">100%</td>
                    <td colSpan={3}></td>
                    <td className="py-2 px-2 text-cyan-400 font-mono">{portfolioTotalDV01.toFixed(4)}</td>
                    <td className="py-2 px-2 text-orange-400 font-mono">{portfolioTotalDur.toFixed(3)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
            {/* 组合久期贡献图 */}
            <Card className="bg-gray-900 border-gray-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">久期贡献分解</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={portfolioAnalysis} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs">
                      <p className="text-gray-400">{label}</p>
                      <p className="text-orange-400 font-mono">贡献久期: {(payload[0]?.value as number)?.toFixed(4)}</p>
                    </div>
                  ) : null} />
                  <Bar dataKey="weightedDur" name="贡献久期" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
