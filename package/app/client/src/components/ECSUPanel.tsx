import React, { useState } from 'react';
import { EconomicTabs, EconomicTable, EconomicUnavailable } from './econ/EconomicObservationControls';
interface ECSUPanelProps { onClose?: () => void; }
const regions = ['美国','欧元区','中国','日本','英国'];
export default function ECSUPanel({ onClose }: ECSUPanelProps) {
  const [active,setActive]=useState(0);
  const [region,setRegion]=useState('美国');
  const rows=regions.map(region=>({region,score:null,prev:null,change:null,trend:'未计算',key:'缺少发布前预期、首次发布值和历史预测误差'}));
  return <div className="flex h-full flex-col overflow-auto bg-[#03090e] text-xs text-slate-200">
    <header className="flex justify-between border-b border-slate-700 px-3 py-2"><h2>ECSU 经济意外指数</h2>{onClose&&<button aria-label="关闭经济意外指数" onClick={onClose}>✕</button>}</header>
    <p className="border-b border-slate-800 px-3 py-2">正值 = 经济数据好于预期 | 负值 = 差于预期</p>
    <EconomicTabs tabs={['当前评分','历史走势']} active={active} select={setActive}/>
    <main role="tabpanel" aria-label={active===0?'当前评分':'历史走势'} className="p-3">
      {active===0?<EconomicTable rows={rows} columns={[['region','区域'],['score','评分'],['prev','前值'],['change','变动'],['trend','趋势'],['key','驱动因素/数据状态']]} label="当前评分"/>:<><h3>主要经济体意外指数走势</h3><label className="block py-2">区域 <select aria-label="意外指数区域" value={region} onChange={e=>setRegion(e.target.value)} className="border border-slate-600 bg-black">{regions.map(r=><option key={r}>{r}</option>)}</select></label><EconomicUnavailable>{region}：未接入可核验意外指数历史，不绘制随机曲线。</EconomicUnavailable></>}
      <EconomicUnavailable>花旗意外指数需要授权序列；自建指数需要同一口径的发布前调查、首次公布实际值与误差标准化方法。原有地区、评分、趋势和历史入口保留，缺少数据时不生成数值。</EconomicUnavailable>
    </main>
  </div>;
}
