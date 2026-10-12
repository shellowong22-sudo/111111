import {useMemo,useState,useContext,useEffect} from 'react';
import {EconomicDeliveryContext} from './EconomicDeliveryContext';
import {mergeWfiiFxDelivery} from '@shared/wfiiFxDelivery';
import {WFII_FX_PAIRS,fxMetrics} from '@shared/wfiiFxAnalytics';
import {EconomicSeriesChart,EconomicSourceStatus,EconomicTable,formatEconomic,useEconomicObservations} from './EconomicObservationControls';

export default function WFIIFxView(){
  const query=useEconomicObservations('wfii-fx');
  const delivery=useContext(EconomicDeliveryContext);
  const merged=useMemo(()=>mergeWfiiFxDelivery(query.data?.series??[],delivery.items),[query.data,delivery.items]);
  const appliedSignature=merged.applied.join('|');
  useEffect(()=>{if(appliedSignature)delivery.applied(appliedSignature.split('|'));},[appliedSignature,delivery.applied]);
  const [selected,setSelected]=useState('EUR/USD');const [filter,setFilter]=useState('');
  const [window,setWindow]=useState(252);
  const rows=useMemo(()=>WFII_FX_PAIRS.map(([pair,id])=>{
    const series=merged.series.find(s=>s.id===id);
    return {pair,id,series,...fxMetrics(series?.history??[])};
  }),[merged]);
  const chosen=rows.find(r=>r.pair===selected)!;
  const history=chosen.points.slice(-window).map((p,i,all)=>({date:p.date,value:p.value,change:i?(p.value/all[i-1].value-1)*100:null}));
  const visible=rows.filter(r=>r.pair.toLowerCase().includes(filter.toLowerCase()));
  return <section aria-label="全球主要货币汇率矩阵（含技术指标）" className="border-y border-slate-700 text-xs">
    <h2 className="py-2">全球主要货币汇率矩阵（含技术指标）</h2>
    <EconomicSourceStatus data={query.data} fetching={query.isFetching} error={!!query.error} refresh={()=>void query.refetch()}/>
    <div className="flex flex-wrap items-center gap-3 py-2"><label>货币对筛选 <input aria-label="货币对筛选" className="border border-slate-600 bg-black px-2" value={filter} onChange={e=>setFilter(e.target.value)}/></label><span>{visible.length}/8 货币对 · 日度参考观察，非可成交报价</span></div>
    <div className="overflow-auto"><table className="w-full whitespace-nowrap text-right font-mono" aria-label="汇率技术指标"><thead><tr>{['货币对','最新价','日变化','YTD%','年化波动率','RSI','支撑位','阻力位','汇率制度','信号','观测期','状态'].map(h=><th key={h} className="border-b border-slate-600 p-2">{h}</th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.id} className={`border-b border-slate-800 ${selected===row.pair?'bg-cyan-950/40':''}`}>
      <td className="p-2"><button aria-pressed={selected===row.pair} className="text-cyan-300" onClick={()=>setSelected(row.pair)}>{row.pair}</button></td>
      {[row.rate,row.change,row.ytd,row.vol,row.rsi,row.support,row.resistance].map((v,i)=><td key={i} className="p-2">{formatEconomic(v,i===0||i>4?4:2)}</td>)}
      <td className="p-2">—</td><td className="p-2">{row.signal}</td><td className="p-2">{row.date??'—'}</td><td className="p-2">{row.series?.status==='available'?'日度已发布':query.isFetching?'读取中':'暂不可用'}</td>
    </tr>)}</tbody></table></div>
    {!visible.length&&<p role="status">无匹配货币对。</p>}
    <div className="flex flex-wrap gap-3 py-2"><strong>{selected} · 历史数据</strong><label>观察窗口 <select aria-label="汇率观察窗口" className="border border-slate-600 bg-black" value={window} onChange={e=>setWindow(Number(e.target.value))}><option value={63}>最近63条</option><option value={252}>最近252条</option><option value={10000}>全部已接入</option></select></label><span>日变化基期 {chosen.previousDate??'—'} · YTD基期 {chosen.yearBaseDate??'—'}</span></div>
    <EconomicSeriesChart rows={history} fields={[["value",selected]]} label="所选货币对历史曲线"/>
    <EconomicTable key={selected} rows={history} columns={[["date","观测期"],["value","参考汇率"],["change","相邻观察变化%"]]} label="汇率历史明细"/>
    <p className="border-t border-slate-700 py-2 text-slate-400"><strong>技术分析说明：</strong>RSI &gt; 70 超买（红色），RSI &lt; 30 超卖（绿色）。采用14期Wilder平滑。日变化为相邻已发布观察之差；YTD以去年末最后观察为基期。年化波动率使用20个对数收益的样本标准差×√252；支撑/阻力位取最近20条参考汇率最低/最高值，不代表交易建议。缺失观察不插值；汇率制度未接入可核验分类。</p>
  </section>;
}
