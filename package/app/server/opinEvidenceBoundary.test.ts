import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('OPIN evidence boundary', () => {
  it('defaults OPIN to branded-content evidence state and disables fixed opinion cards', () => {
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/CommentaryEvidenceDesk.tsx');
    expect(page).toContain('<CommentaryEvidenceDesk scope="opin" />');
    expect(page).toContain('data-opin-historical-content="true"');
    expect(page).toContain('data-opin-historical-boundary="true"');
    expect(desk).toContain("scope?: 'commentary' | 'opin'");
    expect(desk).toContain('没有接入经授权的品牌观点内容');
  });
});
