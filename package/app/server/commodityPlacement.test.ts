import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

describe('commodity data belongs to its original workbench', () => {
  it('does not append unrelated EIA and account sections beneath COMM', () => {
    const wrapper = source('client/src/components/commodity/CommodityPreservedModule.tsx');
    const comm = source('client/src/components/markets/COMMPanel.tsx');
    expect(wrapper).toContain('if (id === "COMM") return');
    expect(wrapper).not.toContain('CommodityWatchlistTaxonomyPanel');
    expect(comm).toContain("signalView === 'watchlist'");
    expect(comm).toContain('<CommodityWatchlistWorkspace />');
    expect(comm).toContain('<CommodityWatchlistTaxonomyPanel />');
  });

  it('keeps PADD regional inventory only with OILS, without repeating its national EIA feed', () => {
    const wrapper = source('client/src/components/commodity/CommodityPreservedModule.tsx');
    const oils = source('client/src/components/OILSPanel.tsx');
    expect(wrapper).toContain('if (id === "OILS") return');
    expect(wrapper.match(/<RegionalInventoryPanel \/>/g)).toHaveLength(1);
    expect(oils).toContain('getEnergyOperations.useQuery');
    expect(oils).toContain('WTI 持仓结构');
  });
});
