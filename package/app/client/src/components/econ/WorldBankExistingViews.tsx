import React,{useState,useContext,useEffect} from 'react';
import {EconomicDeliveryContext} from './EconomicDeliveryContext';
import {worldBankDeliveryOwner,mergeWorldBankDelivery,worldBankRenderedDeliveryKeys} from '@shared/worldBankDelivery';
import {trpc} from '@/lib/trpc';
import {WORLD_BANK_COUNTRIES} from '@shared/worldBankContracts';
import {tradeYearAnalytics} from '@shared/worldBankTradeAnalytics';
import {EconomicSeriesChart,EconomicTable} from './EconomicObservationControls';
import {BarChart,Bar,CartesianGrid,Legend,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

// Replaces only the body of an existing tab. No new navigation or delivery panel.
export function WorldBankExistingView({mode}:{mode:'balance'|'flows'|'fdi'}){
 const group=mode==='balance'?'ectr':'wfii';
 const query=trpc.legacyMarketData.getWorldBankPanel.useQuery({group},{staleTime:3600_000,refetchInterval:3600_000,retry:false});
 const utils=trpc.useUtils();
 const [refreshing,setRefreshing]=useState(false);const [refreshError,setRefreshError]=useState(false);
 const refreshData=async()=>{
  setRefreshing(true);setRefreshError(false);
  try{
   await utils.legacyMarketData.getWorldBankPanel.cancel({group});
    const data=await utils.client.legacyMarketData.getWorldBankPanel.query({group,refresh:true});
    setRefreshError(data.series.some(s=>s.status==='unavailable'));
    utils.legacyMarketData.getWorldBankPanel.setData({group},previous=>({...data,series:data.series.map(s=>{
    const prior=previous?.series.find(p=>p.id===s.id);
    return s.status==='unavailable'&&prior?.rows.length?{...prior,status:s.status,error:s.error}:s;
   })}));
  }catch{setRefreshError(true);}finally{setRefreshing(false);}
 };
 const [country,setCountry]=useState(mode==='fdi'?'ALL':'USA');const [year,setYear]=useState('');
 const delivery=useContext(EconomicDeliveryContext);
 const owned=delivery.items.filter(item=>worldBankDeliveryOwner(item)===`economic-${group}`);
 const merged=mergeWorldBankDelivery(query.data,owned,group);
 const series=merged.series;
 const values=(id:string)=>series.find(s=>s.indicator===id)?.rows??[];
 const definitions: Array<[string,string,string]>=mode==='balance'?
  [['NE.EXP.GNFS.CD','exports','货物及服务出口'],['NE.IMP.GNFS.CD','imports','货物及服务进口'],['NE.RSB.GNFS.CD','balance','货物及服务贸易差额']]:
  [['BX.KLT.DINV.CD.WD','inflow','直接投资净流入'],['BM.KLT.DINV.CD.WD','outflow','直接投资净流出'],['BN.KLT.PTXL.CD','portfolio','证券投资净额']];
 const allRows=series.flatMap(s=>s.rows);const years=[...new Set(allRows.map(r=>r.date.slice(0,4)))].sort().reverse();const selectedYear=year||years[0]||'';
 const appliedSignature=JSON.stringify(worldBankRenderedDeliveryKeys(merged.accepted,mode,country,selectedYear));
 useEffect(()=>{const keys=JSON.parse(appliedSignature) as string[];if(query.data&&keys.length)delivery.applied(keys);},[query.data,appliedSignature,delivery.applied]);
 const name=(code:string)=>allRows.find(r=>r.country_code===code)?.country??code;
 const at=(id:string,code:string,date:string)=>values(id).find(r=>r.country_code===code&&r.date===date)?.value??null;
 const billions=(n:number|null)=>n===null?null:n/1e9;
 const dates=[...new Set(allRows.filter(r=>r.country_code===country).map(r=>r.date))].sort();
 const history=dates.map(date=>Object.fromEntries([['date',date.slice(0,4)],...definitions.map(([id,key])=>[key,billions(at(id,country,date))])]));
 const comparison=WORLD_BANK_COUNTRIES.map(code=>({...Object.fromEntries([['country',name(code)],['code',code],['year',selectedYear],...definitions.map(([id,key])=>[key,billions(at(id,code,`${selectedYear}-01-01`))])]),...(mode==='balance'?tradeYearAnalytics(allRows,code,selectedYear):{})}));
 const rankings=WORLD_BANK_COUNTRIES.map(code=>{
  const current=at('BX.KLT.DINV.CD.WD',code,`${selectedYear}-01-01`);const prior=at('BX.KLT.DINV.CD.WD',code,`${Number(selectedYear)-1}-01-01`);
  return {country:name(code),code,year:selectedYear,fdi:billions(current),prior:billions(prior),growth:current===null||prior===null||prior<=0?null:(current/prior-1)*100,attractiveness:null,share:null,sector:null,status:current===null?'本期未发布':prior===null?'前期未发布':prior<=0?'前期非正值，不计算同比':'同口径年度比较'};
 }).sort((a,b)=>(b.fdi??-Infinity)-(a.fdi??-Infinity));
 const title=mode==='balance'?'主要经济体贸易差额趋势（24个月，十亿美元）':mode==='flows'?'全球资本净流动（十亿美元）':'全球 FDI 流入排名（$B）';
 const rankedSelection=country==='ALL'?rankings:rankings.filter(r=>r.code===country);
 return <div className="text-xs text-slate-200 bg-slate-950">
  <header className="flex flex-wrap items-center gap-3 border-y border-slate-700 p-2"><h2>{title}</h2><label>国家 <select aria-label="国际数据国家" value={country} onChange={e=>setCountry(e.target.value)} className="bg-black border border-slate-600">{mode==='fdi'&&<option value="ALL">全部40国家/地区</option>}{WORLD_BANK_COUNTRIES.map(code=><option key={code} value={code}>{name(code)} ({code})</option>)}</select></label><label>比较年度 <select aria-label="国际数据年度" value={selectedYear} onChange={e=>setYear(e.target.value)} className="bg-black border border-slate-600">{years.map(y=><option key={y}>{y}</option>)}</select></label><button disabled={query.isFetching||refreshing} onClick={()=>void refreshData()} className="border border-slate-600 px-2">{query.isFetching||refreshing?'读取中…':'刷新数据'}</button></header>
  {refreshError&&<p role="alert">刷新失败，保留已有数据，请重试。</p>}
  <p role="status" className="border-b border-slate-800 p-2 text-amber-300">{query.error?'请求失败；请重试。':`${series.filter(s=>s.status==='available').length}/3 序列可用`} · 年度统计，单位十亿美元；{mode==='balance'?'原月度标题保留，本次接入为年度观察，不作为24个月或实时值。':'年度发布，不代表实时跨境成交。'}查询 {query.data?.retrievedAt??'—'}；未发布值为空，各国仅按同一年比较。</p>
  {mode==='balance'?<><EconomicSeriesChart rows={history} fields={definitions.map(([,key,label])=>[key,label])} label="所选国家年度贸易趋势"/><EconomicTable rows={comparison} columns={[["country","国家"],["year","年度"],["exports","出口($B)"],["imports","进口($B)"],["balance","差额($B)"],["exportsYoy","出口同比%"],["importsYoy","进口同比%"],["coverage","出口/进口覆盖率%"],["balanceResidual","差额核对残差($B)"]]} label="国家年度贸易比较"/></>:
   mode==='flows'?<><h3 className="p-2">FDI vs 证券投资流入对比</h3><EconomicSeriesChart rows={history} fields={definitions.map(([,key,label])=>[key,label])} label="所选国家资本流动历史"/><EconomicTable rows={comparison} columns={[["country","国家"],["year","年度"],["inflow","FDI流入($B)"],["outflow","FDI流出($B)"],["portfolio","证券投资净额($B)"]]} label="国家年度资本流动"/><p className="p-2 text-slate-400">证券投资净额沿用国际收支来源符号；原证券投资流入尚未接入，不将净额冒充流入，不与FDI简单相加冒充全部资本流动。</p><h3 className="p-2">新兴市场 vs 发达市场资本流动趋势（12个月）</h3><p className="p-2 text-amber-300">发达市场流入、新兴市场流入、新兴市场净流入：月度区域汇总尚未接入，不将40国年度数据改标为全球月度数据。</p></>:
   <><div aria-label="全球 FDI 流入排名对比图" className="h-64 border-b border-slate-700"><ResponsiveContainer width="100%" height="100%"><BarChart data={rankedSelection.filter(r=>r.fdi!==null).slice(0,12)}><CartesianGrid stroke="#1e293b"/><XAxis dataKey="code"/><YAxis/><Tooltip contentStyle={{background:'#020617',border:'1px solid #334155'}}/><Legend/><Bar dataKey="fdi" name={`${selectedYear||'本期'}年FDI($B)`} fill="#8b5cf6" isAnimationActive={false}/><Bar dataKey="prior" name={`${selectedYear?Number(selectedYear)-1:'上期'}年FDI($B)`} fill="#475569" isAnimationActive={false}/></BarChart></ResponsiveContainer></div><p className="p-1 text-slate-500">图显示所选国家或本期可用前12名；全部国家保留在原明细表。原全球占比、主要行业、吸引力评分字段保留，未接入时为空。</p><EconomicTable initialSort="fdi" rows={rankedSelection} columns={[["country","国家"],["year","年度"],["fdi",`${selectedYear||'本期'}年FDI($B)`],["prior",`${selectedYear?Number(selectedYear)-1:'上期'}年FDI($B)`],["growth","同比增速"],["share","全球占比"],["sector","主要行业"],["attractiveness","吸引力评分"],["status","状态"]]} label="全球FDI年度排名"/><h3 className="p-2">投资吸引力 vs FDI增速散点图</h3><p className="p-2 text-amber-300">投资吸引力评分尚未接入，保留原分析位置与字段；不以虚构评分绘制散点。</p></>}
  <details className="border-t border-slate-700 p-2"><summary>字段、观测期与更新记录</summary>{series.map(s=><p key={s.id}>{s.label} · {s.unit} · {s.rows.length} 条 · 末次观测 {s.rows.at(-1)?.date??'—'} · {s.error?'暂不可用':'可用'}</p>)}{owned.length>0&&<p>接收数据按指标、国家、观测期合并，不重复展示。</p>}</details>
 </div>;
}
