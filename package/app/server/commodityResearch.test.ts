import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMODITY_SERIES, enrichRegionalInventoryRows, parseCommodityFredCsv } from './routers/commodityResearch';

const root = resolve(import.meta.dirname, '..');
const text = (path: string) => readFileSync(resolve(root, path), 'utf8');
const digest = (path: string) => createHash('sha256').update(text(path)).digest('hex');

describe('commodity original-content protection and research layer', () => {
  it('keeps the original commodity panels at their protected baselines while removing the retired FDM entry', () => {
    expect(digest('client/src/components/OILSPanel.tsx')).toBe('1c9db4d48c7ad1aa6b015a20b763b44f9e16c6cc5bbda65bba24d7f79bc13348');
    expect(digest('client/src/components/CTMPanel.tsx')).toBe('553ba676a87f1059f1bafdede5cbfc67ed7a71a4b3b71bb1e40b496e6ed87f61');
    expect(digest('client/src/components/SEAGPanel.tsx')).toBe('1282b87c343917b8c37e51cdb440abe20b2f083a8640d4045b8b82f0b6f370f9');
    expect(digest('client/src/components/CCRVPanel.tsx')).toBe('ae65aa081934d794b94f03171a8aec695feada788e597c013a5dfc2b90965704');
    expect(digest('client/src/components/MAPPanel.tsx')).toBe('1d4d7995aeea1aa3bfaaef96268f5dab85ce481eb70e17f147e021aa0f04e7e3');
    expect(digest('client/src/components/CPLYPanel.tsx')).toBe('d4d560f9a172b45edbf5aba84bc7e74e3664d8f692782efc1712138e7d39dedc');
    expect(digest('client/src/components/COSYPanel.tsx')).toBe('ec8a650ac1c4f1496bf4fb00c6b5f558a22a85a1690e0cebbbd4103c8beced01');
    expect(digest('client/src/components/GPPanel.tsx')).toBe('e3e367d733a7fe6850516fbc997a083dc3920e8c0e2a91b0b2fedbf039390862');
  });

  it('parses only verifiable FRED observations and declares the intended public series', () => {
    expect(parseCommodityFredCsv('DATE,VALUE\n2026-01-01,70.5\n2026-01-02,.\n2026-01-03,')).toEqual([{ date: '2026-01-01', value: 70.5 }]);
    expect(COMMODITY_SERIES.map((row) => row.id)).toEqual(['DCOILWTICO', 'DCOILBRENTEU', 'DHHNGSP', 'PALLFNFINDEXQ', 'WCESTUS1', 'WPULEUS3']);
  });

  it('calculates four-week averages and national shares only from aligned, actual regional observations', () => {
    const rows = [
      { status: 'available' as const, latest: 100, observationDate: '2026-08-14', history: [{ date: '2026-07-24', value: 70 }, { date: '2026-07-31', value: 80 }, { date: '2026-08-07', value: 90 }, { date: '2026-08-14', value: 100 }] },
      { status: 'available' as const, latest: 300, observationDate: '2026-08-14', history: [{ date: '2026-07-24', value: 270 }, { date: '2026-07-31', value: 280 }, { date: '2026-08-07', value: 290 }, { date: '2026-08-14', value: 300 }] },
    ];
    const enriched = enrichRegionalInventoryRows(rows);
    expect(enriched[0]).toMatchObject({ fourWeekAverage: 85, fourWeekEndDate: '2026-08-14', nationalTotal: 400, nationalSharePercent: 25 });
    expect(enriched[1]).toMatchObject({ fourWeekAverage: 285, nationalTotal: 400, nationalSharePercent: 75 });
    const misaligned = enrichRegionalInventoryRows([{ ...rows[0], history: rows[0].history.slice(0, 3), latest: 90, observationDate: '2026-08-07' }, rows[1]]);
    expect(misaligned[0]).toMatchObject({ fourWeekAverage: null, nationalTotal: null, nationalSharePercent: null });
    expect(misaligned[1]).toMatchObject({ nationalTotal: null, nationalSharePercent: null });
  });

  it('matches four-week-average YoY only to the same region on the exact weekly date with complete actual windows', () => {
    const weeklyHistory = Array.from({ length: 56 }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, 3) + index * 7 * 86_400_000).toISOString().slice(0, 10), value: 100 + index }));
    const [enriched] = enrichRegionalInventoryRows([{ status: 'available' as const, latest: 155, observationDate: weeklyHistory[55]?.date ?? null, history: weeklyHistory }]);
    expect(enriched).toMatchObject({ fourWeekAverage: 153.5, priorYearDate: weeklyHistory[3]?.date, priorYearFourWeekAverage: 101.5, fourWeekAverageYoYAbsolute: 52, fourWeekAverageYoY: 51.232 });
    expect(enriched.fourWeekAverageYoYHistory.filter((row) => row.percent != null)).toEqual([{ date: weeklyHistory[55]?.date, currentAverage: 153.5, priorYearDate: weeklyHistory[3]?.date, priorYearAverage: 101.5, absolute: 52, percent: 51.232 }]);
    const [insufficient] = enrichRegionalInventoryRows([{ status: 'available' as const, latest: 154, observationDate: weeklyHistory[54]?.date ?? null, history: weeklyHistory.slice(0, 55) }]);
    expect(insufficient).toMatchObject({ fourWeekAverage: 152.5, priorYearDate: null, priorYearFourWeekAverage: null, fourWeekAverageYoYAbsolute: null, fourWeekAverageYoY: null });
    expect(insufficient.fourWeekAverageYoYHistory.filter((row) => row.percent != null)).toEqual([]);
  });

  it('adds research after original panels while preserving the nine commodity window routes and terminal-only boundaries', () => {
    const terminal = text('client/src/pages/Terminal.tsx'); const detail = text('client/src/pages/MenuItemDetail.tsx'); const layer = text('client/src/components/commodity/CommodityResearchLayer.tsx');
    expect(terminal).toContain('const preserveCommodity');
    for (const id of ['oils', 'ctm', 'seag', 'ccrv', 'map', 'cply', 'cosy', 'gp']) expect(terminal).toContain(`"${id}"`);
    expect(terminal).not.toContain('FDM 商品基础知识');
    expect(detail).not.toContain('FDMPanel');
    expect(layer).not.toContain('FDM');
    expect(detail).toContain('COMMODITY_RESEARCH_CODES');
    expect(detail).toContain('CommodityPreservedModule');
    expect(layer).toContain('WTI 与 Brent 基准价差观察');
    expect(layer).toContain('月度历史季节性分布');
    expect(layer).toContain('完整交割月期限曲线');
    expect(layer).toContain('共同日期标准化比较');
    expect(layer).toContain('终端不使用样例合约、缓存盘口、外部页面或随机数字替代缺失字段。');
    expect(layer).not.toMatch(/href=|window\.open|location\.href/);
  });

  it('keeps EIA operations and account watchlists as additive terminal-only research capabilities', () => {
    const router = text('server/routers/commodityResearch.ts'); const schema = text('drizzle/schema.ts'); const db = text('server/commodityResearchDb.ts'); const layer = text('client/src/components/commodity/CommodityResearchLayer.tsx'); const preserved = text('client/src/components/commodity/CommodityPreservedModule.tsx'); const regional = text('client/src/components/commodity/CommodityRegionalInventoryTools.tsx');
    expect(router).toContain('fetchEiaWeeklyPetroleumHistory');
    expect(text('server/eiaWeeklyPetroleum.ts')).toContain('hist_xls/${id}w.xls');
    expect(router).toContain('parseEiaHistoricalWorkbook');
    expect(router).toContain('getEnergyOperations');
    expect(router).toContain('refreshWatchlistAlerts');
    expect(schema).toContain('commodityWatchlists');
    expect(schema).toContain('commodityWatchlistAlertEvents');
    expect(schema).toContain('commodity_watchlist_user_name_uq');
    expect(schema).toContain('commodity_watchlist_alert_user_key_uq');
    expect(db).toContain('compareCommodityWatchSnapshots');
    expect(layer).toContain('EIA · 能源库存与炼厂利用率');
    expect(layer).toContain('账户级商品观察组合');
    expect(layer).toContain('立即检查变动');
    expect(layer).not.toMatch(/href=|window\.open|location\.href/);
    expect(preserved).toContain('RegionalInventoryPanel');
    expect(preserved).toContain('if (id === "COMM") return');
    expect(preserved).not.toContain('CommodityWatchlistTaxonomyPanel');
    const comm = text('client/src/components/markets/COMMPanel.tsx');
    expect(comm).toContain('CommodityWatchlistWorkspace');
    expect(comm).toContain('CommodityWatchlistTaxonomyPanel');
    expect(comm).toContain("signalView === 'watchlist'");
    expect(regional).not.toMatch(/href=|window\.open|location\.href/);
  });

  it('uses only EIA regional records and account-isolated grouping/tag management for the new additive tools', () => {
    const router = text('server/routers/commodityResearch.ts'); const schema = text('drizzle/schema.ts'); const db = text('server/commodityResearchDb.ts'); const regional = text('client/src/components/commodity/CommodityRegionalInventoryTools.tsx');
    for (const id of ['WCESTP11', 'WCESTP21', 'WCESTP31', 'WCESTP41', 'WCESTP51']) expect(router).toContain(id);
    expect(router).toContain('getRegionalInventory');
    expect(router).toContain('weekOverWeek');
    expect(router).toContain('yearOverYear');
    expect(router).toContain('fourWeekAverageYoY');
    expect(router).toContain('fourWeekAverageYoYHistory');
    expect(router).toContain('listWatchlistGroups');
    expect(router).toContain('createWatchlistGroup');
    expect(schema).toContain('commodityWatchlistGroups');
    expect(schema).toContain('groupId: int("group_id")');
    expect(schema).toContain('tags: json("tags")');
    expect(db).toContain('ensureOwnedGroup');
    expect(db).toContain('FORBIDDEN_COMMODITY_WATCHLIST_GROUP');
    expect(regional).toContain('地区级原油库存同比与环比');
    expect(regional).toContain('地区库存四周均值同比比较');
    expect(regional).toContain('四周均值同比历史轨迹');
    expect(regional).toContain('观察组合分组与标签');
    expect(regional).toContain('同比仅对相隔 52 个实际周度观察计算');
    expect(regional).not.toMatch(/href=|window\.open|location\.href/);
  });
});
