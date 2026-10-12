import { describe, expect, it } from 'vitest';
import { ECONOMIC_DATA_SCOPES, economicModuleForOperation } from '../shared/economicDataScopes';
import { resolveAdminDataModulesForPath } from '../shared/adminDataModules';
import { distinctPublicItems, distinctPublicRows, uniqueEconomicDeliveries } from './adminModulePublicFeed';

const dataset = (value = 100) => ({ label: '观测数据', columns: ['date', 'value'], rows: [{ date: '2026-01-01', value }], metadata: { provider: 'oecd' } });
const row = (id: number, value = 100) => ({ id, moduleId: 'economic-ecst', contentKey: `econ:${id}`, title: `标题 ${id}`, body: `统计机构发布的观测记录，第 ${id} 次收集的经济资料。`, sourceKind: 'real', payload: { dataset: dataset(value) } });

describe('economic function delivery isolation', () => {
  it.each(ECONOMIC_DATA_SCOPES)('%s has one delivery owner on both existing routes', (tab) => {
    for (const path of [`/econ-hub?tab=${tab}`, `/terminal?module=economics&open=${tab}`]) {
      expect(resolveAdminDataModulesForPath(path).map(item => item.id)).toEqual([`economic-${tab}`]);
    }
  });
  it('never falls back to the terminal or hub for an unknown economic function', () => {
    expect(resolveAdminDataModulesForPath('/econ-hub?tab=missing')).toEqual([]);
    expect(resolveAdminDataModulesForPath('/terminal?module=economics&open=missing')).toEqual([]);
    expect(resolveAdminDataModulesForPath('/terminal?module=economics')).toEqual([]);
  });
  it('keeps the legacy hub available only at its explicit landing route', () => {
    expect(resolveAdminDataModulesForPath('/econ-hub').map(item => item.id)).toEqual(['econ-hub']);
    expect(resolveAdminDataModulesForPath('/terminal?module=economics&open=taylr').map(item => item.id)).toEqual(['economic-tayl']);
  });
  it('routes distinct OpenBB contracts by their actual economic purpose', () => {
    expect(economicModuleForOperation('/api/v1/economy/gdp/real')).toBe('economic-ecst');
    expect(economicModuleForOperation('/api/v1/economy/calendar')).toBe('economic-eco');
    expect(economicModuleForOperation('/api/v1/economy/fdi')).toBe('economic-wfii');
    expect(economicModuleForOperation('/api/v1/economy/unknown')).toBeNull();
  });
  it('deduplicates identical observations despite different descriptions and column order', () => {
    const first = row(1);
    const second = row(2);
    second.payload.dataset.columns.reverse();
    expect(distinctPublicRows([first, second])).toHaveLength(1);
    expect(distinctPublicItems([{ body: first.body, dataset: first.payload.dataset }, { body: second.body, dataset: second.payload.dataset }])).toHaveLength(1);
  });
  it('preserves different values even if summary and source endpoint are identical', () => {
    const first = { ...row(1, 100), sourceReference: 'https://example.org/series', body: '统计机构发布的经济观测序列。' };
    const second = { ...row(2, 200), sourceReference: 'https://example.org/series', body: first.body };
    expect(distinctPublicRows([first, second])).toHaveLength(2);
  });
  it('rejects renamed copies across economic workspaces without losing distinct observations', () => {
    const first = row(1);
    const copy = { ...row(2), moduleId: 'economic-ecwb' };
    const different = { ...row(3, 200), moduleId: 'economic-ecob' };
    const candidates = [first, copy, different];
    expect(uniqueEconomicDeliveries([copy], candidates)).toEqual([]);
    expect(uniqueEconomicDeliveries([first, different], candidates)).toEqual([first, different]);
  });
});
