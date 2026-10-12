import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('global market brief official facts boundary', () => {
  it('makes official source entries the default visible layer', () => {
    const source = read('client/src/components/MarketBriefPanel.tsx');
    const facts = read('client/src/components/OfficialMarketFactsBrief.tsx');
    expect(source).toContain('<OfficialMarketFactsBrief />');
    expect(source).toContain('data-market-brief-historical-boundary="true"');
    expect(source).toContain('情绪分数、影响方向、市场摘要、板块表现和“AI 建议”均不代表当前事实');
    expect(facts).toContain('trpc.newsResearch.getOfficialFeed.useQuery');
    expect(facts).toContain('不生成市场情绪、价格影响、热度或交易建议');
    expect(facts).toContain('来源定位：');
  });
});
