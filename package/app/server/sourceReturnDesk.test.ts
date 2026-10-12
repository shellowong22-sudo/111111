import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('READ source-return boundary', () => {
  it('uses source-return counts instead of fabricated readership, popularity or rankings', () => {
    const desk = read('client/src/components/news/SourceReturnDesk.tsx');
    const hub = read('client/src/pages/NewsResearchHub.tsx');
    expect(desk).toContain('trpc.newsResearch.getOfficialFeed.useQuery');
    expect(desk).toContain('来源未提供');
    expect(desk).toContain('不估算、不排序、不补造');
    expect(desk).toContain('不把返回顺序解释为热度或排名');
    expect(desk).toContain('data-read-historical-boundary="true"');
    expect(hub).toContain('<SourceReturnDesk />');
    expect(hub).toContain('[&>div]:pointer-events-none [&>div]:select-none');
  });
});
