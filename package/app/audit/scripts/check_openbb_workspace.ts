import { getOpenBBPriorityAWorkspace } from '../../server/openbbPriorityAService';

const workspace = await getOpenBBPriorityAWorkspace();
console.log(JSON.stringify({
  runtime: workspace.runtime,
  apiCatalog: {
    operationCount: workspace.apiCatalog.operationCount,
    statusCode: workspace.apiCatalog.statusCode,
  },
  coverage: {
    runtimeInterfaceCount: workspace.coverage.runtimeInterfaceCount,
    openbbOperationCount: workspace.coverage.openbbOperationCount,
    officialInterfaceCount: workspace.coverage.officialInterfaceCount,
    totalModules: workspace.coverage.totalModules,
    allocatedModules: workspace.coverage.allocatedModules,
    assignedModules: workspace.coverage.assignedModules,
    unassignedModules: workspace.coverage.unassignedModules,
    verifiedModules: workspace.coverage.verifiedModules,
    persistedObservationCount: workspace.coverage.rows.reduce((sum, row) => sum + Number(row.persistedObservationCount ?? 0), 0),
  },
  automation: workspace.automation,
}, null, 2));
process.exit(0);
