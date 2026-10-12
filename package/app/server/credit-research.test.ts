import { describe, expect, it } from 'vitest';
import { parseFredCreditOasCsv } from './routers/creditResearch';

describe('信用债公开研究数据', () => {
  it('仅从 FRED CSV 的有效观测生成指数 OAS，不为缺失值生成代理数据', () => {
    const result = parseFredCreditOasCsv('observation_date,BAMLC0A0CM\n2026-08-14,0.80\n2026-08-15,.\n2026-08-16,0.82\n', {
      id: 'BAMLC0A0CM', label: '美国投资级综合 OAS', bucket: 'IG', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLC0A0CM',
    });
    expect(result).toMatchObject({ observationDate: '2026-08-16', valuePct: 0.82, valueBps: 82, changeBps: 2, status: 'available' });
    expect(result.history).toHaveLength(2);
    expect(result.limitation).toContain('不是单券报价');
  });

  it('公开研究路由保留 AAA、AA 与 BBB 的 FRED 分评级 OAS，并不将其称作 CDS', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./routers/creditResearch.ts', import.meta.url), 'utf8');
    expect(source).toContain('BAMLC0A1CAAA');
    expect(source).toContain('BAMLC0A2CAA');
    expect(source).toContain('BAMLC0A4CBBB');
    expect(source).toContain('不是单券报价、可成交价差或 CDS 点位');
  });

  it('FRED OAS 快照以短期缓存和并发合并降低等待，但不改变公开来源', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('./routers/creditResearch.ts', import.meta.url), 'utf8');
    expect(source).toContain('const CREDIT_OAS_CACHE_MS = 30_000');
    expect(source).toContain('cachedCreditOasSnapshot');
    expect(source).toContain('activeCreditOasSnapshot');
    expect(source).toContain('Promise.all(FRED_CREDIT_SERIES.map(fetchFredCreditOas))');
  });
});
