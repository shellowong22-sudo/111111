import {getEconomicObservations} from '../../server/economicObservationService';
import {WFII_FX_PAIRS,fxMetrics} from '../../shared/wfiiFxAnalytics';
import {writeFile} from 'node:fs/promises';
const data=await getEconomicObservations('wfii-fx');
const rows=WFII_FX_PAIRS.map(([pair,id])=>{
 const s=data.series.find(s=>s.id===id)!;const m=fxMetrics(s.history);
 return {pair,id,status:s.status,error:s.error,observations:m.points.length,observedAt:m.date,rate:m.rate,dailyChange:m.change,ytd:m.ytd,volatility:m.vol,rsi:m.rsi,sourceUrl:s.sourceUrl,retrievedAt:s.retrievedAt};
});
await writeFile('recovery-evidence/api-expansion-20260919/wfii-fx-live.json',JSON.stringify({checkedAt:new Date().toISOString(),rows},null,2));
console.log(JSON.stringify(rows,null,2));
if(rows.some(r=>r.status!=='available'))process.exitCode=1;
