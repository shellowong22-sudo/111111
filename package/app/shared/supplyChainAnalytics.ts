import type { EconomicPoint } from './economicObservations';

const monthIndex = (date: string) => Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;
export function supplyChainAnalytics(points: EconomicPoint[]) {
  const history = [...points].sort((a,b)=>a.date.localeCompare(b.date));
  const monthMap = new Map(history.map(p=>[monthIndex(p.date),p]));
  const values = history.map(p=>p.value);
  const rows = history.map(p=>{
    const month = monthIndex(p.date);
    const previous = monthMap.get(month-1);
    const previous2 = monthMap.get(month-2);
    const window = Array.from({length:12},(_,i)=>monthMap.get(month-i));
    const rollingPeak = window.every(Boolean)?Math.max(...window.map(v=>v!.value)):null;
    const delta = previous ? p.value-previous.value : null;
    const priorDelta = previous&&previous2 ? previous.value-previous2.value : null;
    return {date:p.date,value:p.value,delta,percentile:values.filter(v=>v<=p.value).length/values.length*100,
      rollingPeak,peakGap:rollingPeak===null?null:p.value-rollingPeak,
      turn:delta===null||priorDelta===null?'基期不足':priorDelta>0&&delta<0?'由升转降':priorDelta<0&&delta>0?'由降转升':delta>0?'上升':delta<0?'下降':'持平',
      state:p.value>1?'高于 +1σ':p.value>0?'0 至 +1σ':p.value<0?'低于 0σ':'0σ'};
  });
  const episodes:Array<{start:string;end:string;months:number;peak:number;peakDate:string;endGap:number;exitDate:string|null;status:string}>=[];
  let current:EconomicPoint[]=[];
  const finish=(status:string,exitDate:string|null)=>{
    if(!current.length)return;
    const peak=current.reduce((best,p)=>p.value>best.value?p:best);
    episodes.push({start:current[0].date,end:current.at(-1)!.date,months:current.length,peak:peak.value,peakDate:peak.date,endGap:current.at(-1)!.value-peak.value,exitDate,status});
    current=[];
  };
  for(const p of history){
    if(current.length&&monthIndex(p.date)-monthIndex(current.at(-1)!.date)!==1)finish('缺月中断',null);
    if(p.value>1)current.push(p);
    else finish('已降至阈值以内',p.date);
  }
  finish('截至末次观察仍高于阈值',null);
  return {rows,episodes};
}
