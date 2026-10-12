type Observation = {country_code:string;date:string;indicator:string;value:number};
const EXPORTS='NE.EXP.GNFS.CD', IMPORTS='NE.IMP.GNFS.CD', BALANCE='NE.RSB.GNFS.CD';
/** Nominal annual trade only: no cross-country or missing-year forward fill. */
export function tradeYearAnalytics(observations:Observation[],country:string,year:string) {
  const values = new Map<string,number|null>();
  for(const row of observations) {
    if(row.country_code!==country||!Number.isFinite(row.value))continue;
    const key=`${row.indicator}|${row.date}`;
    // Exact duplicates are idempotent. Conflicting observations are not picked arbitrarily.
    if(values.has(key)&&values.get(key)!==row.value)values.set(key,null);
    else if(!values.has(key))values.set(key,row.value);
  }
  const at=(indicator:string,period:string)=>values.get(`${indicator}|${period}-01-01`)??null;
  const exports=at(EXPORTS,year),imports=at(IMPORTS,year),balance=at(BALANCE,year);
  const growth=(indicator:string,current:number|null)=>{
    const prior=at(indicator,String(Number(year)-1));
    return current===null||prior===null||prior<=0?null:100*(current/prior-1);
  };
  const computedBalance=exports===null||imports===null?null:exports-imports;
  return {
    exportsYoy:growth(EXPORTS,exports),importsYoy:growth(IMPORTS,imports),
    coverage:exports===null||imports===null||imports<=0?null:100*exports/imports,
    balanceResidual:balance===null||computedBalance===null?null:(balance-computedBalance)/1e9,
  };
}
