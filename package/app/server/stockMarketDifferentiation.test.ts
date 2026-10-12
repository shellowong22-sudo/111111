import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
const router = readFileSync(resolve(root, 'server/routers/stockMarketResearch.ts'), 'utf8');
const dataService = readFileSync(resolve(root, 'server/realDataService.ts'), 'utf8');

describe('stock market in-place workflow differentiation', () => {
  it('keeps legacy identifiers on their original routes and original distinct components', () => {
    const originalMappings = {
      gf: 'GFPanel',
      gipo: 'GIPOPanel',
      corr: 'CORRPanel',
      most: 'MOSTPanel',
      anr: 'ANRPanel',
      rv: 'RVPanel',
      ddis: 'DDISPanel',
      omon: 'OMONPanel',
      cact: 'CACTPanel',
      ipo: 'IPOPanel',
      weif: 'WEIFPanel',
      rrg: 'RRGPanel',
      ds: 'DSPanel',
      'bi-stox': 'BIPanel',
      port: 'PORTPanel',
      fsrc: 'FSRCPanel',
    } as const;
    for (const [id, component] of Object.entries(originalMappings)) {
      expect(terminal).toContain(`preserveStock('${id}', <${component}`);
    }
    expect(terminal).not.toContain('<StockLegacyLivePanel');
    expect(terminal).not.toContain('<StockMarketResearchLayer');
  });

  it('retains all 33 unique catalog entries', async () => {
    const { STOCK_CAPABILITIES } = await import('../shared/threeModuleCapabilityCatalog');
    expect(STOCK_CAPABILITIES).toHaveLength(33);
    expect(new Set(STOCK_CAPABILITIES.map(item => item.id)).size).toBe(33);
  });

  it('keeps the existing real-data contracts available for in-place enrichment', () => {
    expect(dataService).toContain('export interface YahooChartPoint extends YieldPoint {');
    expect(router).toContain('history: item.history.slice(-120)');
    expect(router).toContain('getEvtsFormPreference: protectedProcedure');
    expect(router).toContain('saveEvtsFormPreference: protectedProcedure');
    expect(router).toContain('getFsrcWatchlist: protectedProcedure');
    expect(router).toContain('saveFsrcWatchlist: protectedProcedure');
    expect(router).toContain('refreshFsrcWatchlist: protectedProcedure');
    expect(router).toContain('compareCoverage');
  });
});
