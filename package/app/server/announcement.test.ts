import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const schema = readFileSync(resolve(root, 'drizzle/schema.ts'), 'utf8');
const migration = readFileSync(resolve(root, 'drizzle/0030_bent_zodiak.sql'), 'utf8');
const router = readFileSync(resolve(root, 'server/routers/announcement.ts'), 'utf8');

describe('全局公告持久化', () => {
  it('定义并迁移公告表、发布状态和到期字段', () => {
    expect(schema).toContain('export const announcements = mysqlTable("announcements"');
    expect(schema).toContain('expiresAt: timestamp("expiresAt")');
    expect(schema).toContain('publishedAt: timestamp("publishedAt")');
    expect(migration).toContain('CREATE TABLE `announcements`');
    expect(migration).toContain('announcements_status_expires_idx');
  });

  it('公开查询只读取已发布且未到期的公告', () => {
    expect(router).toContain("WHERE status = 'published'");
    expect(router).toContain('expiresAt IS NULL OR expiresAt > NOW()');
    expect(router).toContain('ORDER BY priority DESC, publishedAt DESC');
  });
});
