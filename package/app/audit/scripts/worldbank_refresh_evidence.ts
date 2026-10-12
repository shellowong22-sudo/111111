import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

async function panel(group: string, refresh = false) {
  const input = encodeURIComponent(JSON.stringify({ json: { group, refresh } }));
  const response = await fetch(`http://localhost:4173/api/trpc/legacyMarketData.getWorldBankPanel?input=${input}`, { signal: AbortSignal.timeout(60_000) });
  assert.equal(response.status, 200);
  return (await response.json()).result.data.json;
}
const before = await panel('wfii');
const cached = await panel('wfii');
assert.equal(cached.retrievedAt, before.retrievedAt, 'Cache must preserve acquisition time');
// Exercise the documented manual-refresh cooldown before checking new acquisition.
await new Promise(resolve => setTimeout(resolve, 5100));
const refreshed = await panel('wfii', true);
const after = await panel('wfii');
assert.equal(after.retrievedAt, refreshed.retrievedAt);
assert.ok(Date.parse(refreshed.retrievedAt) > Date.parse(before.retrievedAt));
const trade = await panel('ectr');
const summarize = (data: any) => ({
  group: data.group, retrievedAt: data.retrievedAt, frequency: data.frequency,
  series: data.series.map((s: any) => {
    assert.equal(s.status, 'available', `${s.id}: ${s.error}`);
    assert.ok(s.retrievedAt);
    const keys = s.rows.map((r: any) => `${r.indicator}|${r.country_code}|${r.date}`);
    assert.equal(new Set(keys).size, keys.length, `${s.id}: duplicate observation`);
    return { id: s.id, indicator: s.indicator, observations: s.rows.length, countries: new Set(s.rows.map((r: any) => r.country_code)).size, retrievedAt: s.retrievedAt };
  }),
});
const capital = summarize(refreshed), goods = summarize(trade);
assert.equal(capital.series.filter((s: any) => goods.series.some((g: any) => g.indicator === s.indicator)).length, 0);
const evidence = { checkedAt: new Date().toISOString(), before: before.retrievedAt, cached: cached.retrievedAt, refreshed: refreshed.retrievedAt, after: after.retrievedAt, capital, trade: goods, cacheStable: true, manualRefreshFetched: true, duplicateObservationCount: 0, sharedIndicatorCount: 0 };
await writeFile('recovery-evidence/api-expansion-20260919/worldbank-refresh-live.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
