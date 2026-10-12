import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('international news evidence boundary', () => {
  it('reads actual language-filtered feeds and inline bodies without fabricating translations', () => {
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/InternationalNewsEvidenceDesk.tsx');
    expect(page).toContain('<InternationalNewsEvidenceDesk />');
    expect(page).toContain('data-international-news-historical-content="true"');
    expect(page).toContain('data-international-news-historical-boundary="true"');
    expect(desk).toContain('trpc.newsResearch.getGlobalFeed.useQuery({ language');
    expect(desk).toContain('refetchInterval: 60_000');
    expect(desk).toContain('未启用自动翻译');
    expect(desk).toContain('<InlineNewsDocument key={detail.key}');
    expect(desk).not.toMatch(/href=|window.open|Math.random/);
  });
});
