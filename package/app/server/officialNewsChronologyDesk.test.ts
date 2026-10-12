import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('NH official publication chronology boundary', () => {
  it('uses source publication chronology and removes automatic pseudo-live scrolling', () => {
    const desk = read('client/src/components/news/OfficialNewsChronologyDesk.tsx');
    const hub = read('client/src/pages/NewsResearchHub.tsx');
    expect(desk).toContain('trpc.newsResearch.getOfficialFeed.useQuery');
    expect(desk).toContain('官方发布序列');
    expect(desk).toContain('官方发布时间倒序排列');
    expect(desk).toContain('data-nh-historical-boundary="true"');
    expect(desk).toContain('不是秒级新闻流、独家优先级、市场影响等级');
    expect(hub).toContain('<OfficialNewsChronologyDesk />');
    expect(hub).toContain('[&>div]:pointer-events-none [&>div]:select-none');
    expect(hub).not.toContain('滚动新闻自动滚动');
    expect(hub).not.toContain('el.scrollTop += 1');
  });
});
