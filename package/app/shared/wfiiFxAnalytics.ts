import type {EconomicPoint, EconomicSeriesId} from './economicObservations';

export const WFII_FX_PAIRS = [
  ['EUR/USD','DEXUSEU'],['USD/JPY','DEXJPUS'],['GBP/USD','DEXUSUK'],
  ['USD/CNY','DEXCHUS'],['AUD/USD','DEXUSAL'],['USD/CHF','DEXSZUS'],
  ['USD/KRW','DEXKOUS'],['USD/BRL','DEXBZUS'],
] as const satisfies ReadonlyArray<readonly [string,EconomicSeriesId]>;

/** H.10 daily reference observations, not executable quotes. No interpolation. */
export function fxMetrics(input:EconomicPoint[]) {
  const unique=new Map<string,number>();
  for(const p of input) if(Number.isFinite(p.value)&&p.value>0) unique.set(p.date,p.value);
  const points=[...unique].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}));
  const last=points.at(-1);const previous=points.at(-2);
  const year=last?.date.slice(0,4);
  const yearBase=points.filter(p=>p.date.slice(0,4)===String(Number(year)-1)).at(-1);
  const recent=points.slice(-21);
  const returns=recent.slice(1).map((p,i)=>Math.log(p.value/recent[i].value));
  const mean=returns.reduce((sum,r)=>sum+r,0)/(returns.length||1);
  const vol=returns.length===20?Math.sqrt(returns.reduce((sum,r)=>sum+(r-mean)**2,0)/19)*Math.sqrt(252)*100:null;
  let rsi:number|null=null;
  if(points.length>=15){
    const deltas=points.slice(1).map((p,i)=>p.value-points[i].value);
    let gain=deltas.slice(0,14).reduce((s,d)=>s+Math.max(d,0),0)/14;
    let loss=deltas.slice(0,14).reduce((s,d)=>s+Math.max(-d,0),0)/14;
    for(const d of deltas.slice(14)){gain=(gain*13+Math.max(d,0))/14;loss=(loss*13+Math.max(-d,0))/14;}
    rsi=gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
  }
  const window=points.slice(-20);
  return {points,date:last?.date??null,rate:last?.value??null,previousDate:previous?.date??null,
    change:last&&previous?(last.value/previous.value-1)*100:null,
    ytd:last&&yearBase?(last.value/yearBase.value-1)*100:null,yearBaseDate:yearBase?.date??null,
    vol,rsi,support:window.length===20?Math.min(...window.map(p=>p.value)):null,
    resistance:window.length===20?Math.max(...window.map(p=>p.value)):null,
    signal:rsi===null?'数据不足':rsi>70?'超买':rsi<30?'超卖':'中性'};
}
