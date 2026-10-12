import {laggedGrowth, type EconomicSnapshot, type EconomicPoint} from './economicObservations';
import {taylorObservations} from './taylorModel';
import {centralBankDrilldown} from './centralBankDrilldown';
import {supplyChainAnalytics} from './supplyChainAnalytics';
type Drill={label:string;description:string;columns:Array<[string,string]>;rows:Array<Record<string,unknown>>};
const columns=(...values:Array<[string,string]>)=>values;
const yoy=(p:EconomicPoint,all:EconomicPoint[])=>{const old=all.find(q=>q.date===`${Number(p.date.slice(0,4))-1}${p.date.slice(4)}`);return old&&old.value!==0?(p.value/old.value-1)*100:null;};
export const ECONOMIC_DRILL_FIELDS={
 fdsp:[['WALCL','TREAST','WSHOMCB','WRESBAL','WTREGEN','WCURCIR'],['WALCL','TREAST','WSHOMCB'],['WRESBAL','IORB','DFF'],['RRPONTSYD','WLCFLPCL'],[],['WALCL']],
 cbrt:[['DFEDTARU','DFEDTARL','ECBDFR'],['DFEDTARU','ECBDFR'],['CPIAUCSL'],['DEXUSEU'],['ECBDFR'],[]],
 fcon:[['NFCI','ANFCI'],[],['NFCI','A191RL1Q225SBEA'],['BAMLC0A0CM','BAMLH0A0HYM2'],['NFCI','A191RL1Q225SBEA'],['NFCI','A191RL1Q225SBEA']],
 ecsu:[[],['TCU','MCUMFN'],['GSCPI'],['ISRATIO'],['JTSJOL','UNRATE'],['OPHNFB']],
 tayl:[['GDPC1','GDPPOT','CPIAUCSL','DFF'],['GDPC1','GDPPOT','CPIAUCSL','DFF'],['CPIAUCSL','GDPC1','GDPPOT'],['DFF'],['DFF'],[]],
} as const;
export function economicDrilldown(group:keyof typeof ECONOMIC_DRILL_FIELDS,id:string,data:EconomicSnapshot):Drill{
 if(group==='fdsp'||group==='cbrt')return centralBankDrilldown(group,id,data);
 const h=(id:string)=>data.series.find(s=>s.id===id)?.history??[];
 const points=h(id);
 if(group==='tayl'){
  const paired=taylorObservations(h('GDPC1'),h('GDPPOT'),h('CPIAUCSL'),h('DFF'));
  if(id==='CPIAUCSL')return {label:'通胀同比基期拆解',description:'逐月匹配去年同月基期；显示同比计算输入，缺基期不补值。',columns:columns(['date','当期月份'],['baseDate','同比基期'],['base','基期指数'],['index','当期指数'],['yoy','同比%']),rows:points.map(p=>({date:p.date,baseDate:`${Number(p.date.slice(0,4))-1}${p.date.slice(4)}`,base:points.find(q=>q.date===`${Number(p.date.slice(0,4))-1}${p.date.slice(4)}`)?.value??null,index:p.value,yoy:yoy(p,points)}))};
  if(id==='DFF')return {label:'政策偏离分解',description:'同季度日均有效利率减通胀，形成事后实际利率；不与最新日利率混算。',columns:columns(['date','配对季度'],['actual','季度实际利率%'],['inflation','季度通胀%'],['exPost','事后实际利率%']),rows:paired.map(p=>({date:p.date,actual:p.actual,inflation:p.inflation,exPost:p.actual-p.inflation}))};
  if(id==='GDPPOT')return {label:'潜在产出增长与修订检查',description:'潜在GDP是模型估计。单独检查同季度年度增长，不复制实际GDP水平表。',columns:columns(['date','季度'],['potentialGrowth','潜在产出同比%'],['actualGrowth','实际产出同比%'],['growthDifference','增长差百分点']),rows:points.map(p=>{const a=h('GDPC1').find(q=>q.date===p.date);const actual=a?yoy(a,h('GDPC1')):null;const potential=yoy(p,points);return {date:p.date,potentialGrowth:potential,actualGrowth:actual,growthDifference:actual===null||potential===null?null:actual-potential};})};
  return {label:'产出缺口配对核算',description:'同季度、同单位配对实际与潜在GDP，核算绝对缺口和百分比缺口。',columns:columns(['date','季度'],['actual','实际GDP'],['potential','潜在GDP'],['absoluteGap','绝对缺口'],['gap','产出缺口%']),rows:points.flatMap(p=>{const potential=h('GDPPOT').find(q=>q.date===p.date);return potential&&potential.value>0?[{date:p.date,actual:p.value,potential:potential.value,absoluteGap:p.value-potential.value,gap:(p.value/potential.value-1)*100}]:[];})};
 }
 if(group==='fcon'){
  if(id==='ANFCI')return {label:'经济条件调整差额',description:'同周调整指数减原指数，核验两种指数之间的差额；不是资产类别贡献归因。',columns:columns(['date','观察周'],['difference','调整指数减原指数'],['direction','差额方向']),rows:points.flatMap(p=>{const raw=h('NFCI').find(q=>q.date===p.date);return raw?[{date:p.date,difference:p.value-raw.value,direction:p.value>raw.value?'调整后更紧':p.value<raw.value?'调整后更松':'一致'}]:[];})};
  if(id==='NFCI'){
   const episodes:Array<Record<string,unknown>>=[];let start=-1;
   for(let i=0;i<=points.length;i++){if(i<points.length&&points[i].value>0){if(start<0)start=i;}else if(start>=0){const segment=points.slice(start,i);episodes.push({start:segment[0].date,end:segment.at(-1)!.date,weeks:segment.length,peak:Math.max(...segment.map(p=>p.value)),status:i===points.length?'仍处收紧区':'已退出收紧区'});start=-1;}}
   return {label:'金融条件收紧事件',description:'只列指数连续高于零的观察区间、持续观察数和峰值，不重复总指数时间序列。',columns:columns(['start','开始'],['end','末次收紧观察'],['weeks','周度观察数'],['peak','峰值标准差'],['status','状态']),rows:episodes};
  }
  if(id==='A191RL1Q225SBEA'){
   const pairs=laggedGrowth(h('NFCI'),points,2);
   return {label:'增长尾部条件分布',description:'按六个月前金融条件松紧分组，比较GDP增长分布；样本相关，不作因果归因。',columns:columns(['regime','金融条件组'],['samples','季度样本'],['negative','负增长季度'],['share','负增长占比%'],['mean','平均增长%']),rows:[['收紧',true],['宽松或中性',false]].map(([regime,tight])=>{const p=pairs.filter(p=>(p.x>0)===tight);return {regime,samples:p.length,negative:p.filter(v=>v.y<0).length,share:p.length?p.filter(v=>v.y<0).length/p.length*100:null,mean:p.length?p.reduce((s,v)=>s+v.y,0)/p.length:null};})};
  }
  if(id==='BAMLH0A0HYM2')return {label:'高收益相对投资级风险溢价',description:'同日高收益OAS减投资级OAS，核验信用层级风险溢价，不复制投资级分位分布。',columns:columns(['date','日期'],['premium','HY减IG百分点'],['ratio','HY与IG倍数']),rows:points.flatMap(p=>{const ig=h('BAMLC0A0CM').find(q=>q.date===p.date);return ig?[{date:p.date,premium:p.value-ig.value,ratio:ig.value>0?p.value/ig.value:null}]:[];})};
  const last=points.at(-1)?.value;
  return {label:'信用利差分位分布',description:'统计历史OAS分位数及当前值所处分位；不将IG与HY互相复制。',columns:columns(['quantile','分位'],['spread','OAS百分点'],['currentPercentile','当前历史百分位']),rows:[.1,.25,.5,.75,.9].map(q=>{const sorted=points.map(p=>p.value).sort((a,b)=>a-b);return {quantile:q*100,spread:sorted.length?sorted[Math.floor((sorted.length-1)*q)]:null,currentPercentile:last===undefined?null:points.filter(p=>p.value<=last).length/points.length*100};})};
 }
 if(id==='GSCPI'){
  return {label:'供应链高压持续区间',description:'按连续月份高于 +1 标准差识别观察区间。缺月中断，不跨缺失月份拼接；阈值仅为描述分组，非预测概率。',columns:columns(['start','起始月份'],['end','末次高压月'],['months','持续月数'],['peak','区间峰值σ'],['peakDate','峰值月份'],['endGap','末值减峰值σ'],['exitDate','回落至阈值月份'],['status','区间状态']),rows:supplyChainAnalytics(points).episodes};
 }
 if(id==='MCUMFN')return {label:'制造业相对产能缺口',description:'同月制造业利用率减整体利用率，衡量行业相对分化，不重复整体闲置比例。',columns:columns(['date','月份'],['spread','制造业减整体百分点'],['direction','相对状态']),rows:points.flatMap(p=>{const overall=h('TCU').find(q=>q.date===p.date);return overall?[{date:p.date,spread:p.value-overall.value,direction:p.value>overall.value?'高于整体':p.value<overall.value?'低于整体':'一致'}]:[];})};
 if(id==='TCU')return {label:'闲置产能与边际变化',description:'以100减利用率观察闲置比例，同时比较相邻期变化；不把闲置比例视为可立即投产能力。',columns:columns(['date','月份'],['slack','闲置比例%'],['momentum','利用率变化百分点'],['yearChange','同比变化百分点']),rows:points.map((p,i)=>{const base=points.find(q=>q.date===`${Number(p.date.slice(0,4))-1}${p.date.slice(4)}`);return {date:p.date,slack:100-p.value,momentum:i?p.value-points[i-1].value:null,yearChange:base?p.value-base.value:null};})};
 if(id==='ISRATIO')return {label:'库存销售比转折检验',description:'相邻变化的方向变化和三期均值偏离，不以单个阈值推断主动或被动库存周期。',columns:columns(['date','月份'],['mean3','三期均值'],['deviation','偏离三期均值'],['turn','变化方向']),rows:points.map((p,i)=>{const mean=i>=2?points.slice(i-2,i+1).reduce((s,q)=>s+q.value,0)/3:null;const d=i?p.value-points[i-1].value:null;return {date:p.date,mean3:mean,deviation:mean===null?null:p.value-mean,turn:d===null?'无基期':d>0?'上升':d<0?'下降':'持平'};})};
 if(id==='UNRATE')return {label:'失业率低点偏离',description:'失业率三个月均值与过去12个月该均值最低点之差；仅描述历史松弛程度，不自动判定衰退。',columns:columns(['date','月份'],['mean3','三个月均值%'],['low12','12个月均值低点%'],['gap','偏离低点百分点']),rows:points.map((p,i)=>{const avg=(end:number)=>points.slice(end-2,end+1).reduce((s,q)=>s+q.value,0)/3;const mean3=i>=2?avg(i):null;const low12=i>=13?Math.min(...Array.from({length:12},(_,n)=>avg(i-n))):null;return {date:p.date,mean3,low12,gap:mean3===null||low12===null?null:mean3-low12};})};
 if(id==='JTSJOL')return {label:'职位空缺边际需求',description:'按相邻月份和去年同月计算职位空缺数量变化；不复制贝弗里奇曲线的水平配对表。',columns:columns(['date','月份'],['monthly','相邻变化（千人）'],['annual','同比变化（千人）'],['direction','变化方向']),rows:points.map((p,i)=>{const base=points.find(q=>q.date===`${Number(p.date.slice(0,4))-1}${p.date.slice(4)}`);const monthly=i?p.value-points[i-1].value:null;return {date:p.date,monthly,annual:base?p.value-base.value:null,direction:monthly===null?'无基期':monthly>0?'上升':monthly<0?'下降':'持平'};})};
 return {label:'生产率季度动能',description:'对精确相邻季度计算环比及复合年化，不重复生产率指数和同比曲线。',columns:columns(['date','季度'],['quarterly','环比%'],['annualized','环比年化%']),rows:points.map(p=>{const priorDate=new Date(p.date+'T00:00:00Z');priorDate.setUTCMonth(priorDate.getUTCMonth()-3);const prior=points.find(q=>q.date===priorDate.toISOString().slice(0,10));return {date:p.date,quarterly:prior&&prior.value>0?(p.value/prior.value-1)*100:null,annualized:prior&&prior.value>0?((p.value/prior.value)**4-1)*100:null};})};
}
