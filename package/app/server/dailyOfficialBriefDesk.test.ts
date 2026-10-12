import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('BTDY official daily brief boundary', () => {
  it('uses official publication chronology and actual macro observations without creating a daily market scenario', () => {
    const desk = read('client/src/components/news/DailyOfficialBriefDesk.tsx');
    const hub = read('client/src/pages/NewsResearchHub.tsx');
    expect(desk).toContain('trpc.newsResearch.getOfficialFeed.useQuery');
    expect(desk).toContain('trpc.legacyMarketData.getEconomicCalendarOfficialObservations.useQuery');
    expect(desk).toContain('本次读取的近期官方发布');
    expect(desk).toContain('实际宏观观察（按观察日）');
    expect(desk).toContain('不使用“今晚公布”、市场预期、意外值、降息概率、市场反应或编辑精选');
    expect(desk).toContain('data-btdy-historical-boundary="true"');
    expect(hub).toContain('<DailyOfficialBriefDesk />');
    expect(hub).toContain('[&>div]:pointer-events-none [&>div]:select-none');
  });
});
