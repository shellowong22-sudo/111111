import { syncManagedPublicDataset } from '../../server/adminPublicDatasetIngestion';

const ids = [
  'fred-us-commercial-crude-inventory',
  'fred-us-refinery-utilization',
] as const;

const results = [];
for (const id of ids) {
  const result = await syncManagedPublicDataset(id, null);
  results.push({
    id,
    status: result.status,
    observedAt: 'observedAt' in result ? result.observedAt : null,
    archive: result.archive,
    reason: result.reason,
  });
}

console.log(JSON.stringify(results, null, 2));
process.exit(0);
