import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('commentary evidence boundary', () => {
  it('defaults commentary to no-author and no-interaction evidence', () => {
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/CommentaryEvidenceDesk.tsx');
    expect(page).toContain('<CommentaryEvidenceDesk />');
    expect(page).toContain('data-commentary-historical-content="true"');
    expect(page).toContain('data-commentary-historical-boundary="true"');
    expect(desk).toContain('没有接入经授权的作者稿件');
    expect(desk).toContain('不能生成赞同率、反对率、阅读量或热门观点');
  });
});
