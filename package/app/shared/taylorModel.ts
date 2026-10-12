import { alignSeries, type EconomicPoint } from './economicObservations';
export type TaylorParameters = { target:number; neutral:number; inflationWeight:number; outputWeight:number };
export function taylorRate(inflation:number, gap:number, p:TaylorParameters){
  if (![inflation,gap,p.target,p.neutral,p.inflationWeight,p.outputWeight].every(Number.isFinite)) return null;
  return p.neutral+inflation+p.inflationWeight*(inflation-p.target)+p.outputWeight*gap;
}
function quarter(date:string){return `${date.slice(0,4)}-Q${Math.floor((Number(date.slice(5,7))-1)/3)+1}`;}
export function taylorObservations(gdp:EconomicPoint[],potential:EconomicPoint[],cpi:EconomicPoint[],dff:EconomicPoint[]){
  const prior=new Map(cpi.map(p=>[p.date,p.value]));
  const inflation=cpi.flatMap(p=>{const value=prior.get(`${Number(p.date.slice(0,4))-1}${p.date.slice(4)}`);return value&&value>0?[{date:p.date,value:(p.value/value-1)*100}]:[];});
  const means=(points:EconomicPoint[],minimum:number)=>{
    const groups=new Map<string,EconomicPoint[]>();for(const p of points){const key=quarter(p.date);groups.set(key,[...(groups.get(key)??[]),p]);}
    return [...groups].flatMap(([date,rows])=>new Set(rows.map(p=>p.date.slice(0,7))).size>=minimum?[{date,value:rows.reduce((s,p)=>s+p.value,0)/rows.length}]:[]);
  };
  return alignSeries({gdp:gdp.map(p=>({...p,date:quarter(p.date)})),potential:potential.map(p=>({...p,date:quarter(p.date)})),inflation:means(inflation,3),actual:means(dff,3)},true)
    .filter(p=>(p.potential as number)>0).map(p=>({date:p.date,gdp:p.gdp as number,potential:p.potential as number,inflation:p.inflation as number,actual:p.actual as number,gap:((p.gdp as number)/(p.potential as number)-1)*100}));
}
