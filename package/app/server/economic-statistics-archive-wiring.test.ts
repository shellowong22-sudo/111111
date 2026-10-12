import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('../client/src/pages/EconomicDataHub.tsx', import.meta.url), 'utf8');
describe('original ECST archive wiring', () => {
  it('keeps the original statistics entry and all twelve indicator labels', () => {
    expect(source).toContain('value="ecst"');
    for (const label of ['美国GDP增速（季环比年化）','中国GDP增速（同比）','欧元区GDP增速（季环比）','日本GDP增速（季环比年化）','美国CPI（同比）','美国核心PCE（同比）','欧元区HICP（同比）','中国CPI（同比）','美国失业率','美国非农就业（万人）','欧元区失业率','日本失业率']) expect(source).toContain(label);
  });
  it('has unique contract queries and no old static ECST arrays', () => {
    const contracts = [...source.matchAll(/archivedPublicDataset\.useQuery\(\{ dataContractId: '([^']+)'/g)].map(match => match[1]);
    expect(contracts).toHaveLength(10);
    expect(new Set(contracts).size).toBe(10);
    expect(contracts).toContain('macro.ea21.real-gdp.qoq.sca.v1');
    expect(contracts).toContain('macro.jp.real-gdp.qoq-annualized.v1');
    expect(contracts).toContain('labor.jp.unemployment.15-64.sa.v1');
    expect(contracts).not.toContain('labor.eu27.unemployment.eurostat.monthly.v1');
    expect(contracts).not.toContain('rates.us.sofr.fred.v1');
    expect(source).not.toContain('ECST_INDICATORS');
    expect(source).not.toContain('MULTI_COUNTRY_GDP');
  });
  it('opens the selected statistic history internally, with refresh and explicit vintage', () => {
    expect(source).toContain('onClick={() => setEcstSelected(ind.name)}');
    expect(source).toContain('projectStatisticHistory');
    expect(source).toContain('ecstDetail.history');
    expect(source).toContain('时效以观察期为准');
    expect(source).not.toContain('最新记录保存');
    expect(source).not.toContain('最近采集成功');
    expect(source).toContain('refetchInterval: 60_000');
    expect(source).toContain('ecst-statistic-dialog sm:max-w-3xl');
    const css = readFileSync(new URL('../client/src/index.css', import.meta.url), 'utf8');
    expect(css).toContain('[data-slot="dialog-content"].ecst-statistic-dialog');
  });
});
