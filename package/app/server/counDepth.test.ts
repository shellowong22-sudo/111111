import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('client/src/components/COUNPanel.tsx', 'utf8');
const service = readFileSync('server/realDataService.ts', 'utf8');
const comparison = readFileSync('server/routers/sovereignComparison.ts', 'utf8');

describe('COUN 国家指南原面板内深度数据联动', () => {
  it('宏观接口保留四项多年序列而非仅返回单个最新值', () => {
    expect(service).toContain("fetchWorldBankIndicator('NY.GDP.MKTP.CD', countryCodes, 16)");
    expect(service).toContain('gdpUsd: gdpHistory');
    expect(service).toContain('debtGdpPct: debtHistory');
    expect(service).toContain('inflationPct: inflHistory');
    expect(service).toContain('currentAccountPct: caHistory');
    expect(service).not.toContain('createMacroContinuity');
    expect(service).toContain('const gdpHistory = sourceGdpHistory');
    expect(service).toContain('continuityFilled: false');
  });

  it('国家研究卡的七个核心数字均绑定自己的实际序列下钻', () => {
    for (const key of ['coverage', 'gdp', 'debt', 'inflation', 'account', 'yield', 'fx']) expect(panel).toContain(`${key}: { label:`);
    expect(panel).toContain('data-coun-series-view');
    expect(panel).toContain("setMetric('yield')");
    expect(panel).toContain("setMetric('fx')");
    expect(comparison).toContain('history: pairQuote?.history ?? []');
    expect(panel).toContain("refetchInterval: 15_000");
  });

  it('宏观比较在原卡片内部提供可切换柱形并可回到国家历史页', () => {
    expect(panel).toContain('点击国家柱形或表格数字进入该国历史下钻');
    expect(panel).toContain("setTab('profile')");
    expect(panel).not.toContain('国家韧性六维剖面');
  });
});
