import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('third-party source evidence boundary', () => {
  it('defaults 3RD to no-source-rating evidence and disables fixed ranking content', () => {
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/ThirdPartySourceEvidenceDesk.tsx');
    expect(page).toContain('<ThirdPartySourceEvidenceDesk />');
    expect(page).toContain('data-third-party-historical-content="true"');
    expect(page).toContain('data-third-party-historical-boundary="true"');
    expect(desk).toContain('没有接入经授权的第三方内容源');
    expect(desk).toContain('不能形成可信度排名、质量分或来源新闻流');
  });
});
