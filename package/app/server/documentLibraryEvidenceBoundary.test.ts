import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('document library evidence boundary', () => {
  it('defaults DOCS to no-file evidence and disables fixed download library content', () => {
    const page = read('client/src/pages/NewsResearchHub.tsx');
    const desk = read('client/src/components/news/DocumentLibraryEvidenceDesk.tsx');
    expect(page).toContain('<DocumentLibraryEvidenceDesk />');
    expect(page).toContain('data-docs-historical-content="true"');
    expect(page).toContain('data-docs-historical-boundary="true"');
    expect(desk).toContain('没有导入可验证文件');
    expect(desk).toContain('无法提供查看、下载、收藏或下载统计');
  });
});
