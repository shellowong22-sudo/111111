import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { inventoryAnalytics, laborAnalytics, productivityAnalytics } from '../../shared/supplySideAnalytics';
import { ECONOMIC_API_CONTRACTS } from '../../shared/economicApiContracts';

const response = await fetch('http://localhost:4173/api/trpc/legacyMarketData.getEconomicObservations?input=' + encodeURIComponent(JSON.stringify({ json: { group: 'ecsu' } })), { signal: AbortSignal.timeout(60_000) });
assert.equal(response.status, 200);
const data = (await response.json()).result.data.json;
assert.equal(data.series.length, 11);
for (const id of ['BUSINV', 'UNEMPLOY', 'OUTNFB', 'HOANBS']) {
  const series = data.series.find((s: any) => s.id === id);
  assert.equal(series.status, 'available', `${id}: ${series.error}`);
  assert.ok(series.history.length > 30);
  assert.ok(series.checksum, `${id}: missing archive checksum`);
}
const inventory = inventoryAnalytics(data), labor = laborAnalytics(data), productivity = productivityAnalytics(data);
assert.ok(inventory.some(r => r.inventoryYoy !== null));
assert.ok(labor.some(r => r.tightness !== null));
assert.ok(productivity.some(r => r.netLogGrowth !== null));
const evidence = {
  checkedAt: new Date().toISOString(),
  series: data.series.map((s: any) => ({ id: s.id, observations: s.history.length, status: s.status, checksum: s.checksum, retrievedAt: s.retrievedAt })),
  contracts: ECONOMIC_API_CONTRACTS.filter(c => ['BUSINV','UNEMPLOY','OUTNFB','HOANBS'].includes(c.seriesId)).map(c => ({ id: c.id, owner: c.primaryModuleId, path: c.path })),
  inventory: { rows: inventory.length, latest: inventory.at(-1) },
  labor: { rows: labor.length, latest: labor.at(-1), latestPaired: labor.filter(r => r.tightness !== null).at(-1) },
  productivity: { rows: productivity.length, latest: productivity.at(-1) },
};
await writeFile('recovery-evidence/api-expansion-20260919/supply-side-live.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
