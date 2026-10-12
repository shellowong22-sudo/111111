import { describe,it,expect } from 'vitest';
import { ECONOMIC_API_CONTRACTS } from '../shared/economicApiContracts';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import { buildApiCoverage } from './apiCoverage';
import { buildOpenBBApiCatalog,normalizeOpenBBResult,OPENBB_ENDPOINTS,deliverOpenBBDataset } from './openbbPriorityAService';
import { deliveryDatasetIdentity } from '../shared/deliveryDatasetIdentity';
import { toPublicFeedDataset } from './adminModulePublicFeed';
import { taylorObservations,taylorRate } from '../shared/taylorModel';
import { MANAGED_PUBLIC_DATASETS } from './adminPublicDatasetIngestion';
describe('API coverage and observation ownership',()=>{
 it('rejects cross-function or multiple owners before any database write',async()=>{
  const def=OPENBB_ENDPOINTS.find(d=>d.id==='official_worldbank_BX.KLT.DINV.CD.WD')!;
  const base={dataset:normalizeOpenBBResult(def,{}, {results:[{date:'2024-01-01',value:10}]}),sourceRunId:'test',recipientUserIds:[1],actorUserId:1,operator:'test'};
  await expect(deliverOpenBBDataset({...base,moduleIds:['economic-wfii','economic-ectr']})).rejects.toThrow('SINGLE_OWNER');
  await expect(deliverOpenBBDataset({...base,moduleIds:['economic-ectr']})).rejects.toThrow('CANONICAL_MODULE_ONLY');
 });
 it('registers each official series once and assigns an existing owner',()=>{
  expect(ECONOMIC_API_CONTRACTS.length).toBeGreaterThan(20);
  expect(new Set(ECONOMIC_API_CONTRACTS.map(c=>c.seriesId)).size).toBe(ECONOMIC_API_CONTRACTS.length);
  for(const c of ECONOMIC_API_CONTRACTS)expect(ADMIN_DATA_MODULES.some(m=>m.id===c.primaryModuleId)).toBe(true);
 });
 it('keeps unknown operations unassigned instead of putting generic data on market pages',()=>{
  const c=buildOpenBBApiCatalog({paths:{'/api/v1/unknown/feature':{get:{operationId:'unknown',responses:{200:{}}}}}});
  expect(c.operations[0].primaryModuleId).toBeNull();
 });
 it('does not claim configured contracts were successfully queried',()=>{
  const c=buildApiCoverage([],[]);expect(c.verifiedModules).toBe(0);expect(c.unassignedModules).toBeGreaterThan(0);
  const x=buildApiCoverage([],[{endpointId:ECONOMIC_API_CONTRACTS[0].id,status:'succeeded',completedAt:'2026-09-19',error:null}]);expect(x.verifiedModules).toBe(1);
 });
 it('reports bound and successful runtime interfaces separately from module allocation',()=>{
  const operations=[
   {id:'GET /api/v1/equity/price/historical',operationId:'equity_price_historical',primaryModuleId:'equity-market',executionState:'controlled_ready'},
   {id:'GET /api/v1/coverage/providers',operationId:'coverage_providers',primaryModuleId:null,executionState:'controlled_ready'},
  ];
  const coverage=buildApiCoverage(operations,[{endpointId:'catalog_equity_price_historical',status:'succeeded',completedAt:'2026-09-23',error:null}]);
  expect(coverage).toMatchObject({
   openbbOperationCount:2,
   boundInterfaceCount:expect.any(Number),
   successfulInterfaceCount:1,
   unboundInterfaceCount:1,
  });
  expect(coverage.runtimeInterfaceCount).toBe(coverage.openbbOperationCount+coverage.officialInterfaceCount);
  expect(coverage.boundInterfaceCount).toBeGreaterThan(coverage.successfulInterfaceCount-1);
 });
 it('counts immutable observations as verified only for their canonical frontend owner',()=>{
  const dataset=MANAGED_PUBLIC_DATASETS.find(item=>item.id==='eia-us-ng-storage')!;
  const coverage=buildApiCoverage([],[],[{dataContractId:dataset.dataContractId,rowCount:520}]);
  const owner=coverage.rows.find(row=>row.id===dataset.moduleId)!;
  expect(owner.status).toBe('has_verified_query');
  expect(owner.persistedObservationCount).toBe(520);
  expect(coverage.rows.filter(row=>row.persistedObservationCount>0)).toHaveLength(1);
 });
 it('blocks reordered and renamed datasets but preserves another symbol or changed observation',()=>{
  const def=OPENBB_ENDPOINTS.find(d=>d.id==='equity_price_historical')!;
  const a=normalizeOpenBBResult(def,{symbol:'AAPL',provider:'test'},{results:[{date:'2026-01-01',close:1},{date:'2026-01-02',close:2}]});
  const b=normalizeOpenBBResult({...def,id:'alias',label:'different'},{provider:'test',symbol:'AAPL'},{results:[{close:2,date:'2026-01-02'},{close:1,date:'2026-01-01'}]});
  expect(a.metadata.checksum).toBe(b.metadata.checksum);
  expect(normalizeOpenBBResult(def,{symbol:'MSFT',provider:'test'},{results:a.rows}).metadata.checksum).not.toBe(a.metadata.checksum);
  expect(normalizeOpenBBResult(def,a.params,{results:[{date:'2026-01-01',close:99}]}).metadata.checksum).not.toBe(a.metadata.checksum);
 });
 it('does not dedupe different tails just because transport previews match',()=>{
  const def=OPENBB_ENDPOINTS[0];const rows=Array.from({length:600},(_,n)=>({date:String(n),value:n}));
  const a=normalizeOpenBBResult(def,{}, {results:rows});const b=normalizeOpenBBResult(def,{}, {results:[...rows.slice(0,599),{date:'599',value:1000}]});
  const left=toPublicFeedDataset(a),right=toPublicFeedDataset(b);
  expect(left?.rows).toEqual(right?.rows);expect(deliveryDatasetIdentity(left)).not.toBe(deliveryDatasetIdentity(right));
 });
});
describe('Taylor model economics',()=>{
 it('uses GDP level gap, full same-quarter inflation and actual rates',()=>{
  const cpi=['01','02','03'].flatMap(m=>[{date:`2023-${m}-01`,value:100},{date:`2024-${m}-01`,value:103}]);
  const rates=['01','02','03'].map(m=>({date:`2024-${m}-01`,value:4}));
  const p=taylorObservations([{date:'2024-01-01',value:102}],[{date:'2024-01-01',value:100}],cpi,rates);
  expect(p).toHaveLength(1);expect(p[0].gap).toBeCloseTo(2);expect(p[0].inflation).toBeCloseTo(3);
  expect(taylorRate(p[0].inflation,p[0].gap,{target:2,neutral:.5,inflationWeight:.5,outputWeight:.5})).toBeCloseTo(5);
  expect(taylorObservations([{date:'2024-01-01',value:102}],[{date:'2024-01-01',value:100}],cpi.slice(0,4),rates)).toHaveLength(0);
 });
 it('rejects missing inputs and reacts independently to neutral rate',()=>{
  expect(taylorRate(NaN,1,{target:2,neutral:.5,inflationWeight:.5,outputWeight:.5})).toBeNull();
  expect(taylorRate(3,2,{target:2,neutral:1.5,inflationWeight:.5,outputWeight:.5})).toBeCloseTo(6);
 });
});
