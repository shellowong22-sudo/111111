import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';
import { ECONOMIC_API_CONTRACTS } from '../shared/economicApiContracts';
import { WORLD_BANK_CONTRACTS } from '../shared/worldBankContracts';
import { MANAGED_PUBLIC_DATASETS } from './adminPublicDatasetIngestion';
import { API_ALLOCATIONS, summarizeApiAllocations } from '../shared/apiAllocationRegistry';
import { GLOBAL_API_PROVIDER_CATALOG, GLOBAL_API_PROVIDER_SUMMARY, assertGlobalApiProviderCatalog } from '../shared/globalApiProviderCatalog';
import { GLOBAL_API_CANDIDATES, GLOBAL_API_CANDIDATE_SUMMARY, assertGlobalApiCandidateCatalog } from './globalApiCandidateCatalog';
const officialContracts=[
  ...ECONOMIC_API_CONTRACTS,
  ...WORLD_BANK_CONTRACTS,
  ...MANAGED_PUBLIC_DATASETS.map(dataset => ({
    id: dataset.dataContractId,
    primaryModuleId: dataset.moduleId,
  })),
];
type Operation = { id:string; operationId:string; primaryModuleId:string|null; executionState:string };
type Run = { endpointId:string; primaryModuleId?:string|null; status:string; completedAt:string|null; error:string|null };
type PersistedContract = { dataContractId:string; rowCount:number };
export function buildApiCoverage(operations:Operation[],runs:Run[],persistedContracts:PersistedContract[]=[]){
  assertGlobalApiProviderCatalog();
  assertGlobalApiCandidateCatalog();
  const persistedByContract=new Map(persistedContracts.map(item=>[item.dataContractId,Number(item.rowCount)||0]));
  const rows=ADMIN_DATA_MODULES.map(module=>{
    const allocation=API_ALLOCATIONS.find(item=>item.moduleId===module.id)!;
    const contracts=operations.filter(op=>op.primaryModuleId===module.id);
    const official=officialContracts.filter(op=>op.primaryModuleId===module.id);
    const ids=new Set([...contracts.map(op=>`catalog_${op.operationId}`),...contracts.map(op=>op.operationId),...official.map(op=>op.id)]);
    const history=runs.filter(run=>ids.has(run.endpointId));
    const successful=new Set(history.filter(run=>run.status==='succeeded').map(run=>run.endpointId));
    for(const contract of official){if((persistedByContract.get(contract.id)??0)>0) successful.add(contract.id);}
    const persistedObservationCount=official.reduce((sum,contract)=>sum+(persistedByContract.get(contract.id)??0),0);
    return {id:module.id,name:module.name,path:module.path,domain:module.domain,operationCount:contracts.length,officialCount:official.length,
      allocationId:allocation.allocationId,dataContractId:allocation.dataContractId,ownershipKey:allocation.ownershipKey,
      adapterKind:allocation.adapterKind,provider:allocation.provider,access:allocation.access,allocationStatus:allocation.status,
      refreshBoundary:allocation.refreshBoundary,ownedFields:allocation.ownedFields,limitation:allocation.limitation,
      verifiedOperationCount:successful.size,status:successful.size?'has_verified_query':contracts.length||official.length?'assigned_unverified':'unassigned',
      latestCheck:history[0]?.completedAt??null,lastError:history.find(run=>run.status==='failed')?.error??null,
      persistedObservationCount,contracts:[...contracts.map(op=>({id:op.id,state:op.executionState})),...official.map(op=>({id:op.id,state:'direct_adapter'}))]};
  });
  const allocationSummary=summarizeApiAllocations();
  const operationInterfaces=operations.map(operation=>({
    id:operation.operationId,
    primaryModuleId:operation.primaryModuleId,
    verified:runs.some(run=>
      run.status==='succeeded' &&
      (run.endpointId===operation.operationId||run.endpointId===`catalog_${operation.operationId}`)
    ),
  }));
  const officialInterfaces=officialContracts.map(contract=>({
    id:contract.id,
    primaryModuleId:contract.primaryModuleId,
    verified:(persistedByContract.get(contract.id)??0)>0||runs.some(run=>run.status==='succeeded'&&run.endpointId===contract.id),
  }));
  const runtimeInterfaces=[...operationInterfaces,...officialInterfaces];
  return {rows,totalModules:rows.length,assignedModules:rows.filter(r=>r.operationCount+r.officialCount>0).length,
    verifiedModules:rows.filter(r=>r.verifiedOperationCount>0).length,unassignedModules:rows.filter(r=>r.status==='unassigned').length,
    runtimeInterfaceCount:runtimeInterfaces.length,
    boundInterfaceCount:runtimeInterfaces.filter(item=>Boolean(item.primaryModuleId)).length,
    successfulInterfaceCount:runtimeInterfaces.filter(item=>Boolean(item.primaryModuleId)&&item.verified).length,
    unboundInterfaceCount:runtimeInterfaces.filter(item=>!item.primaryModuleId).length,
    openbbOperationCount:operationInterfaces.length,
    officialInterfaceCount:officialInterfaces.length,
    backendOnlyOperations:operations.filter(op=>!op.primaryModuleId).length,officialAdapterCount:officialContracts.length,
    allocationSummary,allocatedModules:allocationSummary.total,publicNoKeyModules:allocationSummary.publicAdapter,
    requiresKeyModules:allocationSummary.requiresKey,requiresLicenseModules:allocationSummary.requiresLicense,
    requiresUserDataModules:allocationSummary.requiresUserData,notConfiguredModules:allocationSummary.notConfigured,
    globalProviderCatalog: GLOBAL_API_PROVIDER_CATALOG.map(({ configured, ...provider }) => ({ ...provider, configured })),
    globalProviderSummary: GLOBAL_API_PROVIDER_SUMMARY,
    userCatalogSummary: GLOBAL_API_CANDIDATE_SUMMARY,
    userCatalogCandidates: GLOBAL_API_CANDIDATES.slice(0, 120),
    boundary:'验证状态基于保留的最近查询记录，不代表所有参数/子页面已通过；未登记子页不计入覆盖率。'};
}
