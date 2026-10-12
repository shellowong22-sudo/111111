import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const router = readFileSync(resolve(import.meta.dirname, 'routers/announcement.ts'), 'utf8');
const page = readFileSync(resolve(import.meta.dirname, '../client/src/pages/admin/AdminAnnouncements.tsx'), 'utf8');
const schema = readFileSync(resolve(import.meta.dirname, '../drizzle/schema.ts'), 'utf8');

describe('公告发布前验收', () => {
  it('保存草稿版本、验收字段和追加式验收事件', () => {
    expect(schema).toContain('draftRevision: int("draftRevision")');
    expect(schema).toContain('announcementAcceptanceEvents');
    expect(router).toContain('previewForAcceptance');
    expect(router).toContain('acceptForPublication');
    expect(router).toContain("'confirmed'");
  });

  it('发布仅允许已确认的当前草稿版本，编辑后会使验收失效', () => {
    expect(router).toContain('acceptedRevision !== item.draftRevision');
    expect(router).toContain('draftRevision = draftRevision + 1');
    expect(router).toContain('acceptedRevision = NULL');
    expect(page).toContain('公告发布前验收');
    expect(page).toContain('确认验收 v');
  });
});
