import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('CN company-news evidence boundary', () => {
  it('uses the imported listing and strictly related public-news interface before showing company news', () => {
    const desk = read('client/src/components/news/CompanyNewsDesk.tsx');
    const hub = read('client/src/pages/NewsResearchHub.tsx');
    expect(desk).toContain('trpc.equityListings.list.useQuery');
    expect(desk).toContain('trpc.equityListings.news.useQuery');
    expect(desk).toContain('关联代码');
    expect(desk).toContain('不自动打开第三方网页');
    expect(desk).toContain('不生成替代标题、公司事件或市场反应');
    expect(desk).toContain('data-company-news-historical-boundary="true"');
    expect(hub).toContain('<CompanyNewsDesk />');
    expect(hub).toContain('[&>div]:pointer-events-none [&>div]:select-none');
  });
});
