import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STOCK_CAPABILITIES } from '../shared/threeModuleCapabilityCatalog';

const root = resolve(import.meta.dirname, '..');
const originalIds = ['wei', 'ftw', 'imap', 'evts', 'top', 'tren', 'eqs', 'eqbt', 'ds', 'bi-stox', 'res', 'in', 'tlts', 'port', 'moso', 'etf', 'fsrc', 'pe', 'emsx', 'cact', 'ma', 'ipo', 'factorlab'];

describe('stock market original-content protection', () => {
  it('renders the frozen 33-item catalog instead of maintaining a second menu definition', () => {
    const menu = readFileSync(resolve(root, 'client/src/components/StockMarketMenu.tsx'), 'utf8');
    expect(STOCK_CAPABILITIES).toHaveLength(33);
    expect(menu).toContain('STOCK_CAPABILITIES.slice');
    expect(menu).not.toMatch(/const\s+items\s*=/);
  });

  it('keeps every catalog target routable and removes the superseded numeric duplicates', () => {
    const terminal = readFileSync(resolve(root, 'client/src/pages/Terminal.tsx'), 'utf8');
    for (const id of STOCK_CAPABILITIES.map(item => item.id)) expect(terminal).toContain(`'${id}':`);
    expect(terminal).not.toContain("'1': { title: 'MKT 市场观测'");
    expect(terminal).not.toContain("'32': { title: 'QSTR 因子研究与量化策略'");
    expect((terminal.match(/preserveStock\('/g) ?? []).length).toBeGreaterThanOrEqual(33);
    expect(terminal).toContain('const winId = `st-${itemId}`');
  });

  it('keeps only the original component and appends no generic analysis surface', () => {
    const wrapper = readFileSync(resolve(root, 'client/src/components/stock/StockMarketPreservedModule.tsx'), 'utf8');
    expect(wrapper).toContain('{original}');
    expect(wrapper).not.toContain('StockCapabilityAnalysisTool');
    expect(wrapper).not.toContain('data-stock-analysis-in-place');
    expect(wrapper).not.toContain('StockMarketResearchLayer');
    expect(wrapper).not.toContain('ResearchModuleWorkspace');
    expect(wrapper).not.toContain('StockResearchLayoutWorkspace');
    expect(wrapper).not.toMatch(/role="tab"|role="tabpanel"/);
    expect(wrapper).not.toMatch(/href=|window\.open|location\.href/);
  });
});
