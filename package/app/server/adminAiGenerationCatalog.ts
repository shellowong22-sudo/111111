import { desc } from 'drizzle-orm';
import {
  ADMIN_AI_GENERATION_CATALOG_CODES,
  type AdminAiGenerationCatalogCode,
  type AdminAiGenerationCatalogStatus,
} from '@shared/adminAiGenerationCatalog';
import { adminAiGenerationCatalogEvents, adminAiGenerationCatalogSettings } from '../drizzle/schema';
import { getDb } from './db';

const catalogCodeSet = new Set<string>(ADMIN_AI_GENERATION_CATALOG_CODES);

function normalizeCodes(codes: readonly string[]): AdminAiGenerationCatalogCode[] {
  const unique = [...new Set(codes.map((code) => code.trim().toUpperCase()))];
  if (!unique.length) throw new Error('AI_GENERATION_CATALOG_SELECTION_EMPTY');
  if (unique.some((code) => !catalogCodeSet.has(code))) throw new Error('AI_GENERATION_CATALOG_CODE_INVALID');
  return unique as AdminAiGenerationCatalogCode[];
}

export async function listAdminAiGenerationCatalogSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminAiGenerationCatalogSettings).orderBy(desc(adminAiGenerationCatalogSettings.updatedAt));
}

export async function listAdminAiGenerationCatalogEvents(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminAiGenerationCatalogEvents).orderBy(desc(adminAiGenerationCatalogEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

export async function updateAdminAiGenerationCatalogSettings(input: {
  codes: readonly string[];
  status: AdminAiGenerationCatalogStatus;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const codes = normalizeCodes(input.codes);
  const now = new Date();
  await db.insert(adminAiGenerationCatalogSettings).values(codes.map((catalogCode) => ({
    catalogCode,
    status: input.status,
    updatedByUserId: input.actorUserId,
    updatedAt: now,
  }))).onDuplicateKeyUpdate({ set: { status: input.status, updatedByUserId: input.actorUserId, updatedAt: now } });
  await db.insert(adminAiGenerationCatalogEvents).values(codes.map((catalogCode) => ({
    catalogCode,
    action: input.status,
    actorUserId: input.actorUserId,
    detail: `管理员将 AI 生成目录项 ${catalogCode} 标记为${input.status === 'enabled' ? '已启用' : input.status === 'disabled' ? '已禁用' : '已从 AI 生成目录隐藏'}；原新闻与研究模块、文章和任务未被删除。`,
  })));
  return { updatedCodes: codes, status: input.status };
}
