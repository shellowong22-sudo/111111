import React,{useContext,useEffect,useMemo,useState} from 'react';
import {EconomicDeliveryContext} from './EconomicDeliveryContext';
import {useEconomicObservations,EconomicSeriesChart,EconomicSourceStatus,EconomicTable,formatEconomic} from './EconomicObservationControls';
import {mergeWfiiStressDelivery} from '@shared/wfiiStressDelivery';
import {stressHistory} from '@shared/wfiiStressAnalytics';

const LEGACY = [
  ['美国 FSI','STLFSI4','美国金融压力指数','信用利差、流动性与融资条件的综合观察'],
  ['VIX 恐慌指数','VIXCLS','VIX 波动率指数','权益波动率观察，不等同于风险概率'],
  ['欧元区 FSI',null,'欧元区金融压力','欧元区专属序列尚未接入'],
  ['新兴市场 FSI',null,'新兴市场金融压力','新兴市场专属序列尚未接入'],
  ['MOVE 债券波动',null,'MOVE 债券波动','债券波动率专属序列尚未接入'],
  ['美元指数 DXY',null,'美元指数 DXY','DXY专属序列未接入，不能用其他美元汇率替代'],
] as const;

export default function WFIIFinancialStressView(){
 const query=useEconomicObservations('wfii-stress');
 const delivery=useContext(EconomicDeliveryContext);
 const [selected,setSelected]=useState('美国 FSI');const [window,setWindow]=useState(52);
 const merged=useMemo(()=>mergeWfiiStressDelivery(query.data,delivery.items),[query.data,delivery.items]);
 const real=useMemo(()=>new Map(merged.data?.series.map(s=>[s.id,stressHistory(s.history)])??[]),[merged.data]);
 const selectedId=LEGACY.find(([label])=>label===selected)?.[1];
 const chosen=merged.data?.series.find(s=>s.id===selectedId);
 const history=(real.get(selectedId??'')??[]).slice(-window);
 const applied=merged.applied.filter(key=>delivery.items.find(i=>i.itemKey===key)?.dataset?.rows.some(r=>r.series===selectedId&&history.some(p=>p.date===r.date)));
 useEffect(()=>{if(applied.length)delivery.applied(applied);},[applied.join('|'),delivery.applied]);
 const latest=(id:string|null)=>id?real.get(id)?.at(-1):undefined;
 const rows=LEGACY.map(([label,id,,desc])=>{const p=latest(id);const series=merged.data?.series.find(s=>s.id===id);return {label,date:p?.date??'—',unit:series?.unit??'—',value:p?.value??null,previous:p?.previous??null,change:p?.change??null,percentile:p?.percentile??null,status:p?series!.frequency:id?'暂不可用':'未接入',desc};});
 return <section aria-label="全球金融压力指数" className="space-y-3 border-y border-slate-700 text-xs">
  <h2 className="py-2">金融压力指数对比</h2>
  <EconomicSourceStatus data={merged.data} fetching={query.isFetching} error={!!query.error} refresh={()=>void query.refetch()}/>
  <p className="px-2 text-slate-400">真实序列仅在可核验频率内展示；年度或月度数据不会伪装成逐笔行情。百分位为过去52个可用观察的描述性排名，不代表未来概率。</p>
  <div className="overflow-auto"><table aria-label="金融压力指标" className="w-full whitespace-nowrap"><thead><tr>{['指标','最新值','前值','变动','52期百分位','单位','观测期','状态','说明'].map(h=><th key={h} className="border-b border-slate-600 p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.label} className={`border-b border-slate-800 ${selected===r.label?'bg-cyan-950/40':''}`}><td className="p-2"><button aria-pressed={selected===r.label} onClick={()=>setSelected(r.label)} className="text-cyan-300">{r.label}</button></td>{[r.value,r.previous,r.change,r.percentile].map((v,i)=><td key={i} className="p-2 font-mono">{formatEconomic(v,i===3?1:3)}</td>)}<td className="p-2">{r.unit}</td><td className="p-2">{r.date}</td><td className="p-2">{r.status}</td><td className="p-2 text-slate-400">{r.desc}</td></tr>)}</tbody></table></div>
  <div className="flex gap-3 p-2"><strong>{selected} · {chosen?.unit??'未接入'}</strong><label>观察窗口 <select aria-label="压力观察窗口" className="bg-black border border-slate-600" value={window} onChange={e=>setWindow(Number(e.target.value))}><option value={52}>最近52条</option><option value={252}>最近252条</option><option value={10000}>全部已接入</option></select></label></div>
  <EconomicSeriesChart rows={history} fields={[["value",`${selected}（${chosen?.unit??'—'}）`]]} label="可核验金融压力历史"/>
  <EconomicTable key={selected} rows={history} columns={[["date","观测期"],["value","当前值"],["previousDate","前值观测期"],["previous","前值"],["change","相邻观察变动"],["percentile","52期百分位"],["high","52期最高"],["low","52期最低"],["samples","窗口样本数"]]} label="金融压力历史明细"/>
  <p className="border-t border-slate-700 px-2 py-2 text-slate-400"><strong>综合评估：</strong>全球金融压力的区域比较、MOVE 与 DXY 仍需各自专属序列；本页不使用静态常量补齐，不把美国 FSI 或 VIX 复制为其他地区指标。</p>
  <details className="px-2 pb-2 text-slate-500"><summary>原有评述（未注明观测期，不作为当前判断）</summary><p>全球金融压力处于中低水平，美国FSI处于低压区，欧元区受能源和财政压力略高。新兴市场受美元走强和资本外流影响，压力相对较高。VIX回落至18.5表明市场情绪趋于稳定，但MOVE指数仍显示利率不确定性。</p><p>美国 FSI：信用利差收窄，流动性充裕；欧元区 FSI：能源价格和财政压力上升；新兴市场 FSI：美元走强引发资本外流压力；VIX 恐慌指数：市场情绪趋于稳定；MOVE 债券波动：利率不确定性仍较高；美元指数 DXY：美元相对强势，新兴市场承压。</p></details>
 </section>;
}
