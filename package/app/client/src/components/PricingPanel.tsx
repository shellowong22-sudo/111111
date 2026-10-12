/** PRICE — 主权债现金流定价与执行核验。 */
import React, { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts';
import { PanelShell, Card, Metric, Badge, LoadingState, chartTooltipStyle } from './sovereign/PanelKit';
import { Calculator, ClipboardCheck, Database, ShieldCheck } from 'lucide-react';

const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const formatPct = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;

export default function PricingPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('valuation');
  const [productId, setProductId] = useState<'UST2Y' | 'UST5Y' | 'UST10Y' | 'UST30Y'>('UST10Y');
  const [notional, setNotional] = useState(10_000_000);
  const [couponPct, setCouponPct] = useState(4);
  const [yieldOverridePct, setYieldOverridePct] = useState('');
  const [accrualDays, setAccrualDays] = useState(76);
  const products = trpc.pricing.listProducts.useQuery();
  const priceInput = useMemo(() => ({
    productId,
    notional,
    couponRate: couponPct / 100,
    ...(yieldOverridePct.trim() ? { yieldRate: Number(yieldOverridePct) / 100 } : {}),
    frequency: 2 as const,
  }), [couponPct, notional, productId, yieldOverridePct]);
  const pricing = trpc.pricing.price.useQuery(priceInput, { refetchOnWindowFocus: false });
  const execution = trpc.pricing.getLiquidityDepth.useQuery({ productId });
  const refetch = () => { pricing.refetch(); execution.refetch(); };
  const accruedInterest = notional * couponPct / 100 / 2 * Math.min(182, Math.max(0, accrualDays)) / 182;
  const valuationRange = useMemo(() => {
    const baseYield = yieldOverridePct.trim() ? Number(yieldOverridePct) : Number(pricing.data?.curveYieldPct ?? 4);
    const duration = Number(pricing.data?.valuation.modifiedDuration ?? 0);
    const convexity = duration * duration * .85;
    const baseValue = Number(pricing.data?.valuation.presentValue ?? notional);
    return [-100,-75,-50,-25,0,25,50,75,100].map((bp) => ({ bp, value: baseValue * (1-duration*bp/10000+.5*convexity*(bp/10000)**2), yield: baseYield+bp/100 }));
  }, [notional, pricing.data, yieldOverridePct]);
  const tabs = [{ id: 'valuation', label: '现金流估值' }, { id: 'execution', label: '执行核验' }];

  return (
    <PanelShell ticker="PRICE" title="定价" subtitle="主权债固定现金流折现、久期敏感性与执行核验"
      onClose={onClose} onRefresh={refetch} tabs={tabs} activeTab={tab} onTabChange={setTab}>
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
        <label className="text-[10px] text-slate-500">期限模板<select value={productId} onChange={(event) => setProductId(event.target.value as typeof productId)} className="mt-1 w-full rounded border border-slate-700 bg-[#0d1219] px-2 py-1.5 text-[11px] text-amber-400 outline-none focus:border-amber-500">{(products.data?.products ?? []).map((product: any) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label className="text-[10px] text-slate-500">名义本金（USD）<input type="number" min="1" value={notional} onChange={(event) => setNotional(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded border border-slate-700 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-amber-500" /></label>
        <label className="text-[10px] text-slate-500">票息（%）<input type="number" min="0" max="25" step="0.01" value={couponPct} onChange={(event) => setCouponPct(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded border border-slate-700 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-amber-500" /></label>
        <label className="text-[10px] text-slate-500">收益率覆盖（%，可选）<input type="number" min="0" max="25" step="0.01" value={yieldOverridePct} onChange={(event) => setYieldOverridePct(event.target.value)} placeholder="默认 FRED 曲线" className="mt-1 w-full rounded border border-slate-700 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-500" /></label>
        <label className="text-[10px] text-slate-500">距上次付息（日）<input type="number" min="0" max="182" value={accrualDays} onChange={(event) => setAccrualDays(Math.max(0,Math.min(182,Number(event.target.value)||0)))} className="mt-1 w-full rounded border border-slate-700 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-amber-500" /></label>
      </div>

      {tab === 'valuation' && (pricing.isLoading || !pricing.data ? <LoadingState /> : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><Database className="h-3.5 w-3.5 text-cyan-400" /><span>收益率来源：{pricing.data.yieldSource}</span><span>·</span><span>曲线参考：{pricing.data.curveYieldPct?.toFixed(2) ?? '—'}%</span><span>·</span><span>{new Date(pricing.data.timestamp).toLocaleString()}</span></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6"><Metric label="净现金流现值" value={formatMoney(pricing.data.valuation.presentValue)} trend={valuationRange.map((row)=>row.value)} tone="warn" /><Metric label="应计利息" value={formatMoney(accruedInterest)} trend={[0,30,60,90,120,150,182].map((day)=>notional*couponPct/100/2*day/182)} tone="info"/><Metric label="全价估值" value={formatMoney(pricing.data.valuation.presentValue+accruedInterest)} trend={valuationRange.map((row)=>row.value+accruedInterest)} tone="pos"/><Metric label="净价 / 100" value={pricing.data.valuation.cleanPricePer100.toFixed(3)} tone="info" /><Metric label="修正久期" value={pricing.data.valuation.modifiedDuration.toFixed(3)} tone="info" /><Metric label="DV01" value={formatMoney(pricing.data.valuation.dv01)} tone="neg" /></div>
          <Card title="估值口径"><p className="text-[11px] leading-5 text-slate-300">{pricing.data.methodology}</p><p className="mt-2 text-[10px] text-slate-500">现金流频率：半年付息 · Macaulay 久期：{pricing.data.valuation.macaulayDuration.toFixed(3)} 年 · 所有结果均由当前输入重新计算。</p></Card>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><Card title="现金流与折现现值"><ResponsiveContainer width="100%" height={220}><BarChart data={pricing.data.valuation.cashflows}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 9 }} /><YAxis tick={{ fill: '#475569', fontSize: 9 }} tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`} /><Tooltip {...chartTooltipStyle()} formatter={(value: number) => formatMoney(value)} /><RBar dataKey="pv" name="折现现值" fill="#22d3ee" /></BarChart></ResponsiveContainer></Card><Card title="收益率反解与估值区间"><ResponsiveContainer width="100%" height={220}><LineChart data={valuationRange}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="yield" tick={{fill:'#64748b',fontSize:9}} unit="%"/><YAxis tick={{fill:'#64748b',fontSize:9}} tickFormatter={(value)=>`${(Number(value)/1e6).toFixed(1)}M`}/><Tooltip {...chartTooltipStyle()} formatter={(value:number)=>formatMoney(value)}/><ReferenceLine x={valuationRange.find((row)=>row.bp===0)?.yield} stroke="#f59e0b"/><Line dataKey="value" name="净现金流现值" stroke="#22d3ee" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer></Card><Card title="平行收益率冲击"><div className="space-y-2">{pricing.data.yieldShockScenarios.map((scenario: any) => <div key={scenario.yieldShiftBps} className="flex items-center justify-between rounded border border-slate-800 bg-[#0d1219] px-3 py-2 text-[11px]"><span className="text-slate-400">{scenario.yieldShiftBps >= 0 ? '+' : ''}{scenario.yieldShiftBps} bp</span><span className="text-slate-200">现值 {formatMoney(scenario.presentValue)}</span><span className={scenario.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatMoney(scenario.pnl)}</span></div>)}</div></Card><Card title="估值核对链"><div className="space-y-2 text-[11px]">{[['现金流完整性',pricing.data.valuation.cashflows.length?'已通过':'待检查'],['收益率口径',yieldOverridePct?'自定义收益率':'曲线基准'],['应计区间',`${accrualDays}/182 天`],['全价与净价桥接',formatMoney(accruedInterest)]].map(([label,value])=><div key={label} className="flex justify-between rounded border border-slate-800 p-2"><span className="text-slate-500">{label}</span><span className="text-cyan-300">{value}</span></div>)}</div></Card></div>
        </div>
      ))}

      {tab === 'execution' && (execution.isLoading || !execution.data ? <LoadingState /> : (
        <div className="space-y-3"><Card title="公开数据边界"><div className="flex gap-2 text-[11px] text-amber-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>{execution.data.limitation}</p></div></Card><Card title={`${execution.data.product.name} 执行前核验清单`}><div className="space-y-2">{execution.data.checklist.map((item: any, index: number) => <div key={item.step} className="flex gap-3 rounded border border-slate-800 bg-[#0d1219] px-3 py-2"><span className="font-mono text-cyan-400">{String(index + 1).padStart(2, '0')}</span><div><div className="text-[11px] font-semibold text-slate-200">{item.step}</div><p className="mt-0.5 text-[10px] leading-4 text-slate-400">{item.question}</p></div></div>)}</div></Card><div className="flex items-center gap-2 text-[10px] text-slate-500"><ClipboardCheck className="h-3.5 w-3.5 text-cyan-400" />状态：<Badge tone="warn">{execution.data.status}</Badge> 系统不连接券商、不提交订单，所有执行须在授权与合规流程内完成。</div></div>
      ))}
    </PanelShell>
  );
}
