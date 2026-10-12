import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('NI official topic-search boundary', () => {
  it('performs keyword lookup against returned official records without inventing topic heat or sentiment', () => {
    const desk = read('client/src/components/news/OfficialTopicSearchDesk.tsx');
    const hub = read('client/src/pages/NewsResearchHub.tsx');
    expect(desk).toContain('trpc.newsResearch.getOfficialFeed.useQuery');
    expect(desk).toContain('enabled: Boolean(keyword.trim())');
    expect(desk).toContain('不是主题热度、讨论量、情绪、关联度或 30 天趋势');
    expect(desk).toContain('不使用预设主题、热度、趋势或推荐作为默认结果');
    expect(desk).toContain('data-ni-historical-boundary="true"');
    expect(hub).toContain('<OfficialTopicSearchDesk />');
    expect(hub).toContain('[&>div]:pointer-events-none [&>div]:select-none');
  });
});
