/**
 * WBF - 债券期货 (World Bond Futures)
 * 真实债券期货定价：CTD识别、转换因子、基差、期货理论价格
 * 期货价格 = (现货价格 - 持有收益) / 转换因子
 */
import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// --- 债券期货定价引擎 ---------------------------------------------------------

/**
 * 债券全价（含应计利息）
 * 使用标准债券定价公式：P = C/r * (1 - 1/(1+r)^n) + 100/(1+r)^n
 */
function bondFullPrice(coupon: number, ytm: number, maturityYears: number, frequency: number = 2): number {
  const r = ytm / frequency;
  const n = Math.round(maturityYears * frequency);
  const c = coupon / frequency;
  if (n <= 0) return 100;
  const pv = c * (1 - Math.pow(1 + r, -n)) / r + 100 * Math.pow(1 + r, -n);
  return pv;
}

/**
 * 转换因子（Conversion Factor）
 * 基于标准票息（6%）折现，将债券价格标准化
 * CF = 债券在标准票息下的价格 / 100
 */
function conversionFactor(coupon: number, maturityYears: number, standardCoupon: number = 0.06, frequency: number = 2): number {
  const price = bondFullPrice(coupon, standardCoupon, maturityYears, frequency);
  return price / 100;
}

/**
 * 应计利息
 * AI = 票息 × (距上次付息天数 / 付息周期天数)
 */
function accruedInterest(coupon: number, daysSinceLastCoupon: number, couponPeriodDays: number): number {
  return coupon * daysSinceLastCoupon / couponPeriodDays;
}

/**
 * 期货理论价格
 * F = (S + AI - PV(coupon)) × (1 + r × T) / CF
 * 其中 S = 净价，AI = 应计利息，r = 融资利率，T = 到期时间
 */
function futuresTheoreticalPrice(
  spotCleanPrice: number, coupon: number, ytm: number,
  maturityYears: number, repoRate: number, timeToDelivery: number,
  cf: number, daysSinceLastCoupon: number = 90
): number {
  const ai = accruedInterest(coupon, daysSinceLastCoupon, 180);
  const spotFullPrice = spotCleanPrice + ai;
  // 持有成本 = 融资成本 - 票息收入
  const financingCost = spotFullPrice * repoRate * timeToDelivery;
  const couponIncome = coupon / 2 * (timeToDelivery > 0.5 ? 1 : 0); // 简化：期间是否有付息
  const forwardFullPrice = spotFullPrice + financingCost - couponIncome;
  const futuresFullPrice = forwardFullPrice / cf;
  const aiAtDelivery = accruedInterest(coupon, daysSinceLastCoupon + timeToDelivery * 365, 180);
  return futuresFullPrice - aiAtDelivery / cf;
}

/**
 * 基差 = 现货净价 - 期货价格 × 转换因子
 */
function basis(spotCleanPrice: number, futuresPrice: number, cf: number): number {
  return spotCleanPrice - futuresPrice * cf;
}

/**
 * 修正久期（Modified Duration）
 */
function modifiedDuration(coupon: number, ytm: number, maturityYears: number, frequency: number = 2): number {
  const r = ytm / frequency;
  const n = Math.round(maturityYears * frequency);
  const c = coupon / frequency;
  let macaulay = 0;
  let price = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / frequency;
    const pv = c * Math.pow(1 + r, -i);
    macaulay += t * pv;
    price += pv;
  }
  const faceValue = 100 * Math.pow(1 + r, -n);
  macaulay += maturityYears * faceValue;
  price += faceValue;
  return macaulay / price / (1 + r);
}

// --- 可交割债券数据 -----------------------------------------------------------

interface DeliverableBond {
  cusip: string; coupon: number; maturity: string; maturityYears: number;
  ytm: number; cleanPrice: number; cf: number; basis: number; netBasis: number;
  duration: number; isCTD: boolean;
}

function calcDeliverables(futuresPrice: number, repoRate: number, timeToDelivery: number): DeliverableBond[] {
  const bonds = [
    { cusip: '912828YY3', coupon: 2.875, maturity: '2028-05-15', maturityYears: 4.0, ytm: 4.32 },
    { cusip: '912828ZT3', coupon: 3.125, maturity: '2028-11-15', maturityYears: 4.5, ytm: 4.35 },
    { cusip: '91282CAA3', coupon: 0.625, maturity: '2030-05-15', maturityYears: 6.0, ytm: 4.42 },
    { cusip: '91282CBB0', coupon: 1.125, maturity: '2031-02-15', maturityYears: 6.7, ytm: 4.45 },
    { cusip: '91282CCC8', coupon: 1.875, maturity: '2032-02-15', maturityYears: 7.7, ytm: 4.48 },
    { cusip: '91282CDD5', coupon: 2.750, maturity: '2032-08-15', maturityYears: 8.2, ytm: 4.50 },
    { cusip: '91282CEE2', coupon: 3.500, maturity: '2033-02-15', maturityYears: 8.7, ytm: 4.52 },
    { cusip: '91282CFF9', coupon: 3.875, maturity: '2033-08-15', maturityYears: 9.2, ytm: 4.53 },
  ];

  const results: DeliverableBond[] = bonds.map(b => {
    const cleanPrice = bondFullPrice(b.coupon, b.ytm, b.maturityYears);
    const cf = conversionFactor(b.coupon, b.maturityYears);
    const theoreticalFutures = futuresTheoreticalPrice(cleanPrice, b.coupon, b.ytm, b.maturityYears, repoRate, timeToDelivery, cf);
    const basisVal = basis(cleanPrice, futuresPrice, cf);
    const netBasis = basisVal - (cleanPrice * repoRate * timeToDelivery - b.coupon / 2 * (timeToDelivery > 0.5 ? 1 : 0));
    const duration = modifiedDuration(b.coupon, b.ytm, b.maturityYears);
    return {
      cusip: b.cusip, coupon: b.coupon, maturity: b.maturity, maturityYears: b.maturityYears,
      ytm: b.ytm, cleanPrice: parseFloat(cleanPrice.toFixed(4)), cf: parseFloat(cf.toFixed(6)),
      basis: parseFloat(basisVal.toFixed(4)), netBasis: parseFloat(netBasis.toFixed(4)),
      duration: parseFloat(duration.toFixed(4)), isCTD: false,
    };
  });

  // CTD：净基差最小（最接近0）的债券
  const minNetBasis = Math.min(...results.map(r => Math.abs(r.netBasis)));
  results.forEach(r => { r.isCTD = Math.abs(r.netBasis) === minNetBasis; });

  return results;
}

// --- 主要期货合约 -------------------------------------------------------------

const FUTURES_CONTRACTS = [
  { name: 'ZN (10Y T-Note)', exchange: 'CME', price: 108.25, lastChange: -0.125, openInterest: 4250000, volume: 685000, repoRate: 5.31 },
  { name: 'ZB (30Y T-Bond)', exchange: 'CME', price: 118.50, lastChange: -0.250, openInterest: 1850000, volume: 245000, repoRate: 5.28 },
  { name: 'ZF (5Y T-Note)', exchange: 'CME', price: 106.75, lastChange: -0.062, openInterest: 6850000, volume: 1250000, repoRate: 5.35 },
  { name: 'ZT (2Y T-Note)', exchange: 'CME', price: 102.25, lastChange: -0.031, openInterest: 3450000, volume: 850000, repoRate: 5.38 },
  { name: 'FGBL (Bund)', exchange: 'Eurex', price: 131.85, lastChange: +0.150, openInterest: 1250000, volume: 425000, repoRate: 3.72 },
  { name: 'FGBM (Bobl)', exchange: 'Eurex', price: 115.42, lastChange: +0.080, openInterest: 850000, volume: 185000, repoRate: 3.68 },
];

export default function BondFutures() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'pricer' | 'ctd' | 'basis' | 'sensitivity' | 'ai'>('pricer');
  const [selectedContract, setSelectedContract] = useState(0);
  const [futuresPrice, setFuturesPrice] = useState('108.25');
  const [repoRate, setRepoRate] = useState('5.31');
  const [timeToDelivery, setTimeToDelivery] = useState('0.25');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const generateStrategy = trpc.derivatives.ai.generateStrategy.useMutation();

  const deliverables = useMemo(() => {
    const fp = parseFloat(futuresPrice), rr = parseFloat(repoRate) / 100, ttd = parseFloat(timeToDelivery);
    if ([fp, rr, ttd].some(v => isNaN(v)) || fp <= 0) return [];
    return calcDeliverables(fp, rr, ttd);
  }, [futuresPrice, repoRate, timeToDelivery]);

  const ctd = deliverables.find(d => d.isCTD);

  const sensitivityData = useMemo(() => {
    const rr = parseFloat(repoRate) / 100, ttd = parseFloat(timeToDelivery);
    return Array.from({ length: 21 }, (_, i) => {
      const fp = 100 + i * 0.5;
      const dels = calcDeliverables(fp, rr, ttd);
      const ctdBond = dels.find(d => d.isCTD);
      return {
        futuresPrice: fp.toFixed(1),
        ctdBasis: ctdBond ? ctdBond.basis : 0,
        ctdCF: ctdBond ? ctdBond.cf : 0,
      };
    });
  }, [repoRate, timeToDelivery]);

  const handleAI = useCallback(async () => {
    if (!ctd) return;
    setAiLoading(true);
    try {
      const contract = FUTURES_CONTRACTS[selectedContract];
      const causalEvent = `${contract.name} 期货价格 ${futuresPrice}，CTD债券 ${ctd.cusip} 票息 ${ctd.coupon}% 到期 ${ctd.maturity}，转换因子 ${ctd.cf}，基差 ${ctd.basis}，净基差 ${ctd.netBasis}，分析期货定价和对冲策略`;
      const res = await generateStrategy.mutateAsync({ module: 'WBF', moduleName: '债券期货', causalEvent });
      setAiResult(typeof res.strategy === 'string' ? res.strategy : JSON.stringify(res.strategy));
    } catch { toast.error('AI 分析失败'); }
    finally { setAiLoading(false); }
  }, [ctd, selectedContract, futuresPrice, generateStrategy]);

  const tabs = [
    { id: 'pricer' as const, label: '定价引擎' },
    { id: 'ctd' as const, label: 'CTD 分析' },
    { id: 'basis' as const, label: '基差分析' },
    { id: 'sensitivity' as const, label: '敏感性' },
    { id: 'ai' as const, label: '🧠 AI 智能体' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="border-b border-[#1e2a1e] bg-[#0d1a0d] px-4 py-2 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="text-lime-400 p-1">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-lime-400 font-bold text-sm">WBF</span>
        <span className="text-gray-500 text-xs">债券期货 · World Bond Futures</span>
        <Badge variant="outline" className="text-xs border-lime-800 text-lime-400 ml-auto">
          {FUTURES_CONTRACTS[selectedContract].name}
        </Badge>
      </div>

      <div className="border-b border-[#1e2a1e] px-4 flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-lime-400 text-lime-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'pricer' && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 space-y-3">
              <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4 space-y-3">
                <div className="text-lime-400 text-xs font-bold">期货合约选择</div>
                <div className="space-y-1">
                  {FUTURES_CONTRACTS.map((c, i) => (
                    <button key={i} onClick={() => { setSelectedContract(i); setFuturesPrice(c.price.toString()); setRepoRate(c.repoRate.toString()); }}
                      className={`w-full px-2 py-1.5 text-xs rounded border text-left ${selectedContract === i ? 'border-lime-500 text-lime-400 bg-lime-950' : 'border-gray-700 text-gray-500'}`}>
                      <div className="flex justify-between">
                        <span className="font-bold">{c.name.split(' ')[0]}</span>
                        <span className={c.lastChange >= 0 ? 'text-green-400' : 'text-red-400'}>{c.price.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 text-xs mt-0.5">
                        <span>{c.exchange}</span>
                        <span>OI: {(c.openInterest / 1e6).toFixed(1)}M</span>
                      </div>
                    </button>
                  ))}
                </div>
                {[
                  { label: '期货价格', val: futuresPrice, set: setFuturesPrice },
                  { label: '回购利率 (%)', val: repoRate, set: setRepoRate },
                  { label: '交割时间 (年)', val: timeToDelivery, set: setTimeToDelivery },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <div className="text-gray-500 text-xs mb-1">{label}</div>
                    <Input value={val} onChange={e => set(e.target.value)}
                      className="bg-[#0a0a0a] border-[#1e2a1e] text-lime-300 text-xs h-7 font-mono" />
                  </div>
                ))}
              </Card>
            </div>

            <div className="col-span-8 space-y-3">
              {ctd ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'CTD 债券', value: ctd.cusip, sub: `票息 ${ctd.coupon}% 到期 ${ctd.maturity}`, color: 'text-lime-400' },
                      { label: '转换因子 (CF)', value: ctd.cf.toFixed(6), sub: '基于6%标准票息折现', color: 'text-yellow-400' },
                      { label: '基差', value: ctd.basis.toFixed(4), sub: `净价 - 期货×CF = ${ctd.basis.toFixed(4)}`, color: 'text-blue-400' },
                    ].map(item => (
                      <Card key={item.label} className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                        <div className="text-gray-500 text-xs">{item.label}</div>
                        <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                        <div className="text-gray-500 text-xs mt-1">{item.sub}</div>
                      </Card>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'CTD 净价', value: `${ctd.cleanPrice.toFixed(4)}`, sub: '现货市场净价', color: 'text-green-400' },
                      { label: 'CTD 修正久期', value: `${ctd.duration.toFixed(4)} 年`, sub: '利率敏感性', color: 'text-purple-400' },
                      { label: '净基差', value: ctd.netBasis.toFixed(4), sub: '基差 - 持有成本', color: ctd.netBasis >= 0 ? 'text-green-400' : 'text-red-400' },
                    ].map(item => (
                      <Card key={item.label} className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                        <div className="text-gray-500 text-xs">{item.label}</div>
                        <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                        <div className="text-gray-500 text-xs mt-1">{item.sub}</div>
                      </Card>
                    ))}
                  </div>
                  <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                    <div className="text-lime-400 text-xs font-bold mb-2">期货定价公式</div>
                    <div className="bg-[#0a0a0a] rounded p-3 text-xs font-mono space-y-1">
                      <div className="text-gray-400">期货理论价格 = (现货全价 + 融资成本 - 票息收入) / 转换因子</div>
                      <div className="text-gray-400">基差 = 现货净价 - 期货价格 × 转换因子</div>
                      <div className="text-gray-400">净基差 = 基差 - 持有成本（融资成本 - 票息收入）</div>
                      <div className="text-lime-300 mt-2">
                        = ({ctd.cleanPrice.toFixed(2)} + {(ctd.cleanPrice * parseFloat(repoRate) / 100 * parseFloat(timeToDelivery)).toFixed(4)}) / {ctd.cf.toFixed(6)}
                      </div>
                      <div className="text-lime-300">
                        基差 = {ctd.cleanPrice.toFixed(4)} - {parseFloat(futuresPrice).toFixed(4)} × {ctd.cf.toFixed(6)} = {ctd.basis.toFixed(4)}
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                    <div className="text-lime-400 text-xs font-bold mb-2">合约规格</div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[
                        ['合约', FUTURES_CONTRACTS[selectedContract].name],
                        ['交易所', FUTURES_CONTRACTS[selectedContract].exchange],
                        ['期货价格', parseFloat(futuresPrice).toFixed(3)],
                        ['日变动', `${FUTURES_CONTRACTS[selectedContract].lastChange >= 0 ? '+' : ''}${FUTURES_CONTRACTS[selectedContract].lastChange}`],
                        ['持仓量', `${(FUTURES_CONTRACTS[selectedContract].openInterest / 1e6).toFixed(2)}M`],
                        ['成交量', `${(FUTURES_CONTRACTS[selectedContract].volume / 1e3).toFixed(0)}K`],
                        ['回购利率', `${repoRate}%`],
                        ['交割时间', `${timeToDelivery}年`],
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
                <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-8 text-center">
                  <div className="text-gray-500 text-sm">请输入有效参数以计算期货定价</div>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ctd' && (
          <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
            <div className="text-lime-400 text-xs font-bold mb-2">可交割债券分析（CTD 识别）</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#1e2a1e]">
                    {['CUSIP', '票息', '到期日', '到期年限', 'YTM', '净价', '转换因子', '基差', '净基差', '修正久期', 'CTD'].map(h => (
                      <th key={h} className="text-right py-1.5 px-2 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deliverables.map((d, i) => (
                    <tr key={i} className={`border-b border-[#0d1a0d] ${d.isCTD ? 'bg-lime-950/30' : 'hover:bg-[#1e2a1e]/30'}`}>
                      <td className={`py-1.5 px-2 font-mono ${d.isCTD ? 'text-lime-400 font-bold' : 'text-gray-300'}`}>{d.cusip}</td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{d.coupon}%</td>
                      <td className="py-1.5 px-2 text-right text-gray-300">{d.maturity}</td>
                      <td className="py-1.5 px-2 text-right text-gray-400">{d.maturityYears}Y</td>
                      <td className="py-1.5 px-2 text-right text-blue-400 font-mono">{d.ytm}%</td>
                      <td className="py-1.5 px-2 text-right text-gray-200 font-mono">{d.cleanPrice.toFixed(4)}</td>
                      <td className="py-1.5 px-2 text-right text-yellow-400 font-mono">{d.cf.toFixed(6)}</td>
                      <td className="py-1.5 px-2 text-right font-mono" style={{ color: Math.abs(d.basis) < 0.1 ? '#22c55e' : '#9ca3af' }}>{d.basis.toFixed(4)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${d.netBasis >= 0 ? 'text-green-400' : 'text-red-400'}`}>{d.netBasis.toFixed(4)}</td>
                      <td className="py-1.5 px-2 text-right text-purple-400 font-mono">{d.duration.toFixed(4)}</td>
                      <td className="py-1.5 px-2 text-right">
                        {d.isCTD ? <span className="text-lime-400 font-bold text-xs">★ CTD</span> : <span className="text-gray-600 text-xs">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              CTD（最廉交割券）= 净基差最小的债券，即对空头方最有利的交割选择
            </div>
          </Card>
        )}

        {activeTab === 'basis' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
              <div className="text-lime-400 text-xs font-bold mb-1">各可交割债券基差对比</div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deliverables.map(d => ({ name: d.coupon + '%', basis: d.basis, netBasis: d.netBasis, isCTD: d.isCTD }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#0d1a0d', border: '1px solid #1e2a1e', fontSize: 9 }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <ReferenceLine y={0} stroke="#374151" />
                    <Bar dataKey="basis" name="基差" fill="#84cc16" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="netBasis" name="净基差" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
              <div className="text-lime-400 text-xs font-bold mb-1">基差随期货价格变化</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensitivityData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a1e" />
                    <XAxis dataKey="futuresPrice" tick={{ fill: '#6b7280', fontSize: 8 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
                    <Tooltip contentStyle={{ background: '#0d1a0d', border: '1px solid #1e2a1e', fontSize: 9 }} />
                    <ReferenceLine x={futuresPrice} stroke="#84cc16" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="ctdBasis" stroke="#84cc16" strokeWidth={2} dot={false} name="CTD基差" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'sensitivity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                <div className="text-lime-400 text-xs font-bold mb-2">DV01 对冲比率</div>
                {ctd && (
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'CTD 修正久期', value: `${ctd.duration.toFixed(4)} 年` },
                      { label: 'CTD DV01 (每$100)', value: `$${(ctd.cleanPrice * ctd.duration / 10000).toFixed(4)}` },
                      { label: '期货 DV01 (每张)', value: `$${(ctd.cleanPrice * ctd.duration / 10000 * 100000 / ctd.cf).toFixed(2)}` },
                      { label: '对冲比率 (每$1M债券)', value: `${(1000000 / (ctd.cleanPrice * ctd.duration / 10000 * 100000 / ctd.cf)).toFixed(2)} 张期货` },
                    ].map(({ label: k, value: v }) => (
                      <div key={k} className="flex justify-between bg-[#0a0a0a] rounded p-2">
                        <span className="text-gray-500">{k}</span>
                        <span className="text-lime-300 font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                <div className="text-lime-400 text-xs font-bold mb-2">利率情景分析</div>
                {ctd && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-[#1e2a1e]">
                        <th className="text-left py-1">利率变动</th>
                        <th className="text-right py-1">CTD价格变化</th>
                        <th className="text-right py-1">期货价格变化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[-100, -50, -25, 0, 25, 50, 100].map(bp => {
                        const priceChange = -ctd.duration * ctd.cleanPrice * bp / 10000;
                        const futuresChange = priceChange / ctd.cf;
                        return (
                          <tr key={bp} className="border-b border-[#0d1a0d]">
                            <td className="py-1 text-gray-400">{bp >= 0 ? '+' : ''}{bp}bp</td>
                            <td className={`py-1 text-right font-mono ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(4)}</td>
                            <td className={`py-1 text-right font-mono ${futuresChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{futuresChange >= 0 ? '+' : ''}{futuresChange.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            {ctd && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'CTD 债券', value: ctd.cusip, color: 'text-lime-400' },
                  { label: '转换因子', value: ctd.cf.toFixed(6), color: 'text-yellow-400' },
                  { label: '基差', value: ctd.basis.toFixed(4), color: 'text-blue-400' },
                  { label: '修正久期', value: `${ctd.duration.toFixed(4)}Y`, color: 'text-purple-400' },
                ].map(item => (
                  <Card key={item.label} className="bg-[#0d1a0d] border-[#1e2a1e] p-2 text-center">
                    <div className="text-gray-500 text-xs">{item.label}</div>
                    <div className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
                  </Card>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '感知层（期货市场信号）', items: [`${FUTURES_CONTRACTS[selectedContract].name} 持仓量 ${(FUTURES_CONTRACTS[selectedContract].openInterest / 1e6).toFixed(1)}M 张`, `日变动 ${FUTURES_CONTRACTS[selectedContract].lastChange >= 0 ? '+' : ''}${FUTURES_CONTRACTS[selectedContract].lastChange}`, `CTD 债券：${ctd?.cusip || '-'} 票息 ${ctd?.coupon || '-'}%`, `基差 ${ctd?.basis.toFixed(4) || '-'}（${(ctd?.basis || 0) > 0 ? '正基差' : '负基差'}）`] },
                { label: '推理层（CTD 因果分析）', items: [`CTD 选择：净基差最小 = ${ctd?.netBasis.toFixed(4) || '-'}`, `转换因子 ${ctd?.cf.toFixed(6) || '-'}：${(ctd?.cf || 1) < 1 ? '折价债券' : '溢价债券'}`, `利率上升 → CTD 切换至低票息长久期债券`, `基差收敛 → 交割日基差趋向0`] },
                { label: '执行层（期货策略）', items: [`DV01 对冲：每$1M债券需 ${ctd ? (1000000 / (ctd.cleanPrice * ctd.duration / 10000 * 100000 / ctd.cf)).toFixed(1) : '-'} 张期货`, `基差交易：买现货卖期货（正基差收窄时盈利）`, `CTD 切换风险：监控可交割债券利差变化`, `滚动策略：在交割月前展期至下一合约`] },
              ].map(panel => (
                <Card key={panel.label} className="bg-[#0d1a0d] border-[#1e2a1e] p-3">
                  <div className="text-lime-400 text-xs font-bold mb-2">{panel.label}</div>
                  <ul className="space-y-1">
                    {panel.items.map((item, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                        <span className="text-lime-500 mt-0.5">›</span>{item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <Card className="bg-[#0d1a0d] border-[#1e2a1e] p-4">
              <div className="text-lime-400 text-xs font-bold mb-3">AI 债券期货策略分析</div>
              <Button onClick={handleAI} disabled={aiLoading || !ctd}
                className="bg-lime-700 hover:bg-lime-600 text-white text-xs h-8 px-4 mb-3">
                {aiLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                {aiLoading ? '分析中...' : '生成期货策略报告'}
              </Button>
              {aiResult ? (
                <div className="bg-[#0a0a0a] rounded border border-[#1e2a1e] p-3 text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{aiResult}</div>
              ) : (
                <div className="text-gray-600 text-xs text-center py-4">点击按钮，AI 将基于 CTD 分析和基差数据给出专业期货策略建议</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
