import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('social source evidence boundaries', () => {
  it('defaults SOCL, SOCI and TREN to distinct no-source evidence states', () => {
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/SocialSourceEvidenceDesk.tsx');
    expect(page).toContain('SocialSourceEvidenceDesk scope="social"');
    expect(page).toContain('SocialSourceEvidenceDesk scope="soci"');
    expect(page).toContain('SocialSourceEvidenceDesk scope="tren"');
    expect(page).toContain('data-social-historical-content="social"');
    expect(page).toContain('data-social-historical-content="soci"');
    expect(page).toContain('data-social-historical-content="tren"');
    expect(desk).toContain('不显示{item.focus}');
    expect(desk).toContain('不能计算提及量、热度、情绪、相关性或趋势');
  });
});
