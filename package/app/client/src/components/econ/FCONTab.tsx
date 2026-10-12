import React, { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { alignSeries, seriesHistory, latestValue, periodLast, laggedGrowth, pearson } from '@shared/economicObservations';
import { EconomicTabs, EconomicTable, EconomicSeriesChart, EconomicSourceStatus, EconomicProvenance, EconomicUnavailable, useEconomicObservations, formatEconomic } from './EconomicObservationControls';

const tabs = ['历史走势', '分项贡献', 'FCI vs GDP', '信用利差', '传导时滞', '压力情景'];
export default function FCONTab() {
  const [active, setActive] = useState(0);
  const [tightening, setTightening] = useState(0.5);
  const query = useEconomicObservations('fcon');
  const history = (id: string) => seriesHistory(query.data, id);
  const fci = history('NFCI');
  const monthly = periodLast(fci);
  const last = monthly.at(-1); const previous = monthly.at(-2);
  const pairs = laggedGrowth(fci, history('A191RL1Q225SBEA'), 2);
  const correlation = pearson(pairs);
  const meanX = pairs.length ? pairs.reduce((sum, p) => sum + p.x, 0) / pairs.length : 0;
  const meanY = pairs.length ? pairs.reduce((sum, p) => sum + p.y, 0) / pairs.length : 0;
  const variance = pairs.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  const beta = pairs.length >= 12 && variance > 0 ? pairs.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0) / variance : null;
  const trend = alignSeries({ NFCI: fci, ANFCI: history('ANFCI') });
  const spreads = alignSeries({ igSpread: history('BAMLC0A0CM'), hySpread: history('BAMLH0A0HYM2') });
  const lagRows = Array.from({ length: 9 }, (_, lag) => {
    const points = laggedGrowth(fci, history('A191RL1Q225SBEA'), lag);
    return { lag: lag * 3, count: points.length, correlation: pearson(points) };
  });
  return <div className="bg-[#03090e] text-slate-200 text-xs">
    <header className="flex items-center justify-between border-b border-slate-700 px-3 py-2"><h1>金融条件指数模块 (FCONTab)</h1><span className="text-orange-300">FCON · 美国 · 官方历史观察</span></header>
    <EconomicSourceStatus data={query.data} fetching={query.isFetching} error={Boolean(query.error)} refresh={() => void query.refetch()}/>
    <dl className="flex flex-wrap divide-x divide-slate-800 border-b border-slate-800">{[
      ['当前FCI', formatEconomic(latestValue(query.data, 'NFCI'))],
      ['月度变化', formatEconomic(last && previous ? last.value - previous.value : null)],
      ['GDP相关性', formatEconomic(correlation)],
      ['信用利差', formatEconomic(latestValue(query.data, 'BAMLH0A0HYM2')) + ' %（HY）'],
    ].map(([label, value]) => <div key={label} className="flex gap-3 px-3 py-2"><dt className="text-slate-500">{label}</dt><dd>{value}</dd></div>)}</dl>
    <EconomicTabs tabs={tabs} active={active} select={setActive}/>
    <main role="tabpanel" aria-label={tabs[active]} className="p-3">
      {active === 0 && <><h2>综合金融条件指数历史走势</h2><p className="py-2 text-slate-500">Chicago Fed NFCI 与 ANFCI；GS FCI、Ucheer FCI 未接入授权源。正值表示较长期平均更紧，负值更松。月度变化按每月最后一条真实观测计算。</p><EconomicSeriesChart rows={trend} fields={[['NFCI','Chicago Fed NFCI'],['ANFCI','Chicago Fed ANFCI']]} label="金融条件历史"/><EconomicTable rows={trend} columns={[['date','观察日'],['NFCI','NFCI'],['ANFCI','ANFCI']]} label="金融条件历史明细"/></>}
      {active === 1 && <><h2>分项贡献瀑布图</h2><EconomicUnavailable>利率、信用利差、股票、汇率、房地产的贡献需要已发布的分项权重和贡献序列。当前公开总指数不包含这五项归因，不能将总指数拆成虚构贡献。</EconomicUnavailable><EconomicTable rows={['利率','信用利差','股票','汇率','房地产'].map(component => ({component,status:'缺少已验证分项贡献源',value:null}))} columns={[['component','分项'],['value','贡献'],['status','数据状态']]} label="贡献字段"/></>}
      {active === 2 && <><h2>金融条件vs经济增长 (FCI领先GDP 6个月)</h2><p className="py-2 text-slate-500">季度内 NFCI 实际观测均值，与两季度后的实际 GDP 季环比年化增长配对；{pairs.length} 对，Pearson r={formatEconomic(correlation)}。历史相关性不是因果关系或预测。</p><div className="h-64"><ResponsiveContainer><ScatterChart><CartesianGrid stroke="#1e293b"/><XAxis type="number" dataKey="x" name="NFCI"/><YAxis type="number" dataKey="y" name="GDP增长" unit="%"/><Tooltip cursor={{strokeDasharray:'3 3'}}/><Scatter data={pairs} fill="#fb923c" isAnimationActive={false}/></ScatterChart></ResponsiveContainer></div><EconomicTable rows={pairs} columns={[['date','GDP季度起始日'],['fciPeriod','FCI季度'],['x','NFCI均值'],['y','GDP增长%']]} label="FCI增长配对"/></>}
      {active === 3 && <><h2>信用利差矩阵 (各评级利差走势)</h2><p className="py-2 text-slate-500">美国投资级及高收益 OAS，单位百分点。EM利差：未接入，不以美国高收益替代。</p><EconomicSeriesChart rows={spreads} fields={[['igSpread','IG利差'],['hySpread','HY利差']]} label="信用利差"/><EconomicTable rows={spreads} columns={[['date','观察日'],['igSpread','IG利差%'],['hySpread','HY利差%']]} label="信用利差明细"/></>}
      {active === 4 && <><h2>传导时滞分析</h2><p className="py-2 text-slate-500">比较不同领先季度的 NFCI 均值与 GDP 增长相关系数。GDP影响、通胀影响的因果模型未校准，不输出影响估计。</p><EconomicTable rows={lagRows} columns={[['lag','领先月数'],['count','配对样本'],['correlation','Pearson r']]} label="时滞检验"/></>}
      {active === 5 && <><h2>压力情景模拟 (FCI收紧对GDP的冲击)</h2><p className="py-2 text-amber-300">用户情景计算，非机构预测：基于上方六个月配对样本的单变量 OLS 斜率。不是因果冲击测算。</p><div className="flex flex-wrap items-center gap-3 py-3"><label>FCI收紧幅度 <input aria-label="FCI收紧幅度" type="number" min="0" max="3" step="0.1" value={tightening} onChange={event => { const value=event.target.valueAsNumber; if(Number.isFinite(value)) setTightening(Math.max(0,Math.min(3,value))); }} className="w-20 border border-slate-600 bg-black px-2 py-1"/></label><input aria-label="调整FCI收紧幅度" type="range" min="0" max="3" step="0.1" value={tightening} onChange={event => setTightening(Number(event.target.value))}/></div>{beta === null ? <EconomicUnavailable>至少需要12组完整季度配对且 NFCI 有非零方差，当前不足，未生成情景结果。</EconomicUnavailable> : <EconomicTable rows={[{scenario:'基准情景',change:0,beta,samples:pairs.length},{scenario:'用户压力情景',change:beta*tightening,beta,samples:pairs.length}]} columns={[['scenario','情景'],['change','GDP增长差异(百分点)'],['beta','样本回归斜率'],['samples','样本数']]} label="压力情景结果"/>}</>}
    </main><EconomicProvenance data={query.data} group="fcon" active={active}/>
  </div>;
}
