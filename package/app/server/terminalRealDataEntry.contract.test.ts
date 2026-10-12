import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAdminDataModulesForPath } from '@shared/adminDataModules';
import { FINMIND_MODULE_BINDINGS } from '@shared/finmindModuleBindings';

describe('existing terminal entries own their permanent datasets', () => {
  it.each([
    ['/deri', 'deri'],
    ['/terminal?open=eqs&module=stocks', 'stock-eqs'],
    ['/index-hub?panel=WEI', 'index-hub'],
    ['/menu-item/COMM', 'commodity-market'],
  ])('maps %s to %s', (path, moduleId) => {
    expect(resolveAdminDataModulesForPath(path).map(module => module.id)).toContain(moduleId);
  });

  it('assigns FinMind stock and futures contracts to the visible EQS and DERI entries', () => {
    expect(FINMIND_MODULE_BINDINGS.filter(binding => /StockPrice|StockPER|StockDividend/.test(binding.dataset)).every(binding => binding.moduleId === 'stock-eqs')).toBe(true);
    expect(FINMIND_MODULE_BINDINGS.find(binding => binding.dataset === 'TaiwanFuturesDaily')?.moduleId).toBe('deri');
  });

  it('removes the old DERI overview route and commodity empty slots', () => {
    const app = readFileSync('client/src/App.tsx', 'utf8');
    const derivatives = readFileSync('client/src/components/DerivativesMenu.tsx', 'utf8');
    const commodities = readFileSync('client/src/components/CommoditiesMenu.tsx', 'utf8');
    expect(app).toContain('<Route path={"/deri"} component={DerivativesEnhanced} />');
    expect(app).not.toContain('<Route path={"/_derivatives-enhanced"}');
    expect(app).not.toContain('DERIAdvanced');
    expect(derivatives).toContain("{ num: 26, code: 'DERI', name: 'FinMind 期货'");
    for (const name of ['石油', '天然气', '电力', '煤炭', '可再生能源', '排放', '金属', '农业', '海运']) {
      expect(commodities).not.toContain(`name: '${name}'`);
    }
  });

  it('uses durable observations in EQS, WEI and COMM without fixed quote samples', () => {
    const eqs = readFileSync('client/src/components/EQSPanel.tsx', 'utf8');
    const wei = readFileSync('client/src/components/index-panels/WEIPanel.tsx', 'utf8');
    const comm = readFileSync('client/src/components/markets/COMMPanel.tsx', 'utf8');
    expect(eqs).toContain('archivedEquityRows(archiveDelivery.items)');
    expect(wei).toContain("useModuleLiveFeed('/index-hub?panel=WEI', true)");
    expect(comm).toContain("useModuleLiveFeed('/menu-item/COMM', true)");
    expect(wei).not.toContain('模拟数据');
    expect(comm).not.toContain('Math.random');
    expect(comm).not.toContain('useTickingPrices');
  });
});
