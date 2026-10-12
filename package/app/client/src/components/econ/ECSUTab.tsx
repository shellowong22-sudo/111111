import React, { useState, useContext, useEffect } from 'react';
import { EconomicDeliveryContext } from './EconomicDeliveryContext';
import { mergeEcsuDelivery } from '@shared/ecsuDelivery';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { alignSeries, seriesHistory, latestValue } from '@shared/economicObservations';
import { supplyChainAnalytics } from '@shared/supplyChainAnalytics';
import { inventoryAnalytics, laborAnalytics, productivityAnalytics } from '@shared/supplySideAnalytics';
import { EconomicTabs, EconomicTable, EconomicSeriesChart, EconomicSourceStatus, EconomicProvenance, EconomicUnavailable, useEconomicObservations, formatEconomic } from './EconomicObservationControls';

const tabs = ['经济意外指数','产能利用率','供应链压力指数','库存周期分析','劳动力市场供需','生产效率追踪'];
export default function ECSUTab() {
  const [active, setActive] = useState(0);
  const [pressureWindow, setPressureWindow] = useState(60);
  const sourceQuery = useEconomicObservations('ecsu');
  const delivery = useContext(EconomicDeliveryContext);
  const merged = mergeEcsuDelivery(sourceQuery.data, delivery.items, active);
  const appliedSignature = JSON.stringify(merged.applied);
  useEffect(() => { const keys = JSON.parse(appliedSignature) as string[]; if(keys.length) delivery.applied(keys); }, [appliedSignature, delivery.applied]);
  const query = { ...sourceQuery, data: merged.data };
  const history = (id: string) => seriesHistory(query.data, id);
  const capacity = alignSeries({ manufacturing: history('MCUMFN'), overall: history('TCU') });
  const inventory = inventoryAnalytics(query.data);
  const labor = laborAnalytics(query.data);
  const productivity = productivityAnalytics(query.data);
  const gscpi = history('GSCPI');
  const gscpiLatest = gscpi.at(-1)?.value ?? null;
  const gscpiSorted = [...gscpi].sort((a,b)=>a.value-b.value);
  const gscpiPercentile = gscpiLatest === null || !gscpiSorted.length ? null : gscpiSorted.filter(point => point.value <= gscpiLatest).length / gscpiSorted.length * 100;
  const gscpiPeak = gscpi.reduce((best, point) => point.value > (best?.value ?? -Infinity) ? point : best, null as typeof gscpi[number] | null);
  const pressure = supplyChainAnalytics(gscpi);
  const pressureRows = pressure.rows.slice(-pressureWindow);
  const pressureLatest = pressure.rows.at(-1);
  return <div className="bg-[#03090e] text-xs text-slate-200">
    <header className="flex justify-between border-b border-slate-700 px-3 py-2"><h1>经济意外/供给侧模块 (ECSUTab)</h1><span className="text-cyan-300">ECSU · 发布值与供给约束</span></header>
    <EconomicSourceStatus data={query.data} fetching={query.isFetching} error={Boolean(query.error)} refresh={()=>void query.refetch()}/>
    <dl className="flex flex-wrap divide-x divide-slate-800 border-b border-slate-800">{[['最新意外指数','— 缺少预期调查'],['产能利用率',formatEconomic(latestValue(query.data,'TCU'))+' %'],['供应链压力',gscpiLatest===null?'—':formatEconomic(gscpiLatest)+'σ'],['库存周期','库存销售比 '+formatEconomic(latestValue(query.data,'ISRATIO'))]].map(([label,value])=><div key={label} className="flex gap-3 px-3 py-2"><dt className="text-slate-500">{label}</dt><dd>{value}</dd></div>)}</dl>
    <EconomicTabs tabs={tabs} active={active} select={setActive}/>
    <main role="tabpanel" aria-label={tabs[active]} className="p-3">
      {active===0&&<><h2>经济意外指数</h2><EconomicUnavailable>花旗意外指数需授权序列；自建意外指数需发布前的预期调查、实际发布值及标准差。当前缺少这些配对，不使用随机数或产能数据代替。</EconomicUnavailable><EconomicTable rows={['发布前预期','首次发布实际值','历史预测误差标准差'].map(field=>({field,value:null,status:'未接入'}))} columns={[['field','必要字段'],['value','值'],['status','状态']]} label="意外指数输入"/></>}
      {active===1&&<><h2>产能利用率仪表盘</h2><p className="py-2 text-slate-500">美国月度制造业 / 整体产能利用率。服务业不在该统计口径内，保持缺失。</p><EconomicSeriesChart rows={capacity} fields={[['manufacturing','制造业'],['overall','整体']]} label="产能利用率历史"/><EconomicTable rows={capacity} columns={[['date','观察月份'],['manufacturing','制造业%'],['overall','整体%']]} label="产能利用率明细"/></>}
      {active===2&&<><h2>供应链压力指数</h2>
        <p className="py-2 text-slate-500">全球供应链压力指数（标准差）月度发布值。运输成本、库存水平、需求冲击和政策变化不是该总指数的独立贡献字段，缺少分项时保持空缺。</p>
        {gscpi.length?<>
          <div className="flex flex-wrap items-center gap-4 border-y border-slate-800 py-2">
            <label>观察窗口 <select aria-label="供应链观察窗口" className="border border-slate-600 bg-black" value={pressureWindow} onChange={e=>setPressureWindow(Number(e.target.value))}><option value={24}>最近24个月</option><option value={60}>最近60个月</option><option value={10000}>全部已接入</option></select></label>
            <span>观测月份 {gscpi.at(-1)?.date.slice(0,7)} · 发布版本 {query.data?.series.find(s=>s.id==='GSCPI')?.metadata?.vintage??'—'}</span>
          </div>
          <EconomicSeriesChart rows={pressureRows} fields={[["value","全球供应链压力（标准差）"]]} label="供应链压力历史曲线"/>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y border-slate-800 py-3">
            {[["最新观测",formatEconomic(gscpiLatest,2)+'σ'],["历史百分位",formatEconomic(gscpiPercentile,1)+'%'],["较上月变化",formatEconomic(pressureLatest?.delta,2)+'σ'],["近12个月峰值",formatEconomic(pressureLatest?.rollingPeak,2)+'σ'],["历史峰值",formatEconomic(gscpiPeak?.value,2)+'σ'],["峰值月份",gscpiPeak?.date??'—']].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <EconomicTable rows={pressureRows} columns={[["date","观测月份"],["value","压力指数σ"],["delta","月度变化σ"],["percentile","历史百分位%"],["rollingPeak","12个月峰值σ"],["peakGap","距12个月峰值σ"],["turn","压力转折"],["state","压力区间"]]} label="供应链压力观测明细"/>
          <p className="py-2 text-slate-500">百分位采用当前发布版本的全部 {gscpi.length} 条历史观测（≤当前值占比），包含后续修订，不代表当时可得信息。月度变化只匹配相邻自然月；12个月峰值要求连续12个月。字段入口可进一步查看高压持续区间。</p>
        </>:<EconomicUnavailable>当前不可读取供应链压力真实观测；不使用旧快照或随机数代替。</EconomicUnavailable>}
      </>}
      {active===3&&<><h2>库存周期分析</h2><p className="py-2 text-slate-500">美国 Census 工商库存/销售比率，季节调整。显示相邻发布期变化，不仅凭比率阈值推断“主动/被动补库存”。</p><EconomicSeriesChart rows={inventory} fields={[['ratio','库存/销售比率']]} label="库存周期历史"/><EconomicTable rows={inventory} columns={[['date','月份'],['ratio','库存/销售比率'],['change','相邻期变化'],['inventoryBillions','库存金额(十亿美元)'],['inventoryChange','库存月增减(十亿美元)'],['inventoryYoy','库存金额同比%']]} label="库存周期明细"/><p className="py-2 text-slate-500">库存金额为季调名义值；与销售比率按同月匹配，月增减仅使用相邻自然月，同比仅使用去年同月。缺期不补值，不用库存比率反推销售金额。</p></>}
      {active===4&&<><h2>劳动力市场供需</h2><p className="py-2 text-slate-500">BLS 同月职位空缺与失业率配对。职位空缺原单位千人换算为百万人；不同月份不拼接。</p><div className="h-64"><ResponsiveContainer><ScatterChart><CartesianGrid stroke="#1e293b"/><XAxis type="number" dataKey="vacancies" name="职位空缺(百万)"/><YAxis type="number" dataKey="unemployment" name="失业率" unit="%"/><Tooltip/><Scatter data={labor.filter(row=>row.vacancies!==null&&row.unemployment!==null)} fill="#22d3ee" isAnimationActive={false}/></ScatterChart></ResponsiveContainer></div><EconomicTable rows={labor} columns={[['date','月份'],['vacancies','职位空缺(百万)'],['unemployment','失业率%'],['unemployed','失业人数(百万)'],['tightness','每名失业者对应空缺数'],['vacancyGap','空缺减失业人数(百万)']]} label="劳动力配对"/></>}
      {active===5&&<><h2>生产效率追踪</h2><p className="py-2 text-slate-500">非农商业劳动生产率指数及同季度同比。全要素生产率尚未接入，不能将劳动生产率复制为全要素生产率。</p><EconomicSeriesChart rows={productivity} fields={[['laborProductivity','劳动生产率（2017=100）'],['outputIndex','实际产出（2017=100）'],['hoursIndex','总工时（2017=100）']]} label="生产效率历史"/><EconomicTable rows={productivity} columns={[['date','季度起始日'],['laborProductivity','劳动生产率指数'],['yoy','同比%'],['outputIndex','实际产出指数'],['hoursIndex','总工时指数'],['reconstructed','核算生产率'],['residual','公布值减核算值'],['outputContribution','产出环比对数贡献'],['hoursContribution','工时环比对数贡献'],['netLogGrowth','净环比对数变化%']]} label="生产效率明细"/></>}
    </main><EconomicProvenance data={query.data} group="ecsu" active={active}/>
  </div>;
}
