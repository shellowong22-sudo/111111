import { and, desc, eq } from 'drizzle-orm';
import { preferredResearchAuditEvents, preferredResearchEvidence, preferredResearchPackages } from '../drizzle/schema';
import { getDb } from './db';

export type PreferredEvidenceExtract = { label: string; quotedText: string; note: string };
export type PreferredDocumentType = 'prospectus' | 'annual_report' | 'quarterly_report' | 'current_report' | 'security_registration' | 'other_official';

function parsePreferredDocumentDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('PREFERRED_RESEARCH_DOCUMENT_DATE_INVALID');
  return parsed;
}

async function ownedPackage(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const pkg = (await db.select().from(preferredResearchPackages).where(eq(preferredResearchPackages.id, packageId)).limit(1))[0];
  if (!pkg) throw new Error('PREFERRED_RESEARCH_PACKAGE_NOT_FOUND');
  if (pkg.userId !== userId) throw new Error('FORBIDDEN_PREFERRED_RESEARCH_PACKAGE');
  return pkg;
}

function assertEditable(status: string) {
  if (status === 'submitted' || status === 'approved') throw new Error('PREFERRED_RESEARCH_PACKAGE_LOCKED');
}

export async function listPreferredResearchPackages(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  return db.select().from(preferredResearchPackages).where(eq(preferredResearchPackages.userId, userId)).orderBy(desc(preferredResearchPackages.updatedAt), preferredResearchPackages.name);
}

export async function savePreferredResearchPackage(userId: number, input: { packageId?: number; name: string; issuerName: string; cik?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const values = { name: input.name.trim().slice(0, 160), issuerName: input.issuerName.trim().slice(0, 240), cik: input.cik?.trim().padStart(10, '0').slice(-10) || null, updatedAt: new Date() };
  if (!input.packageId) {
    const insert = await db.insert(preferredResearchPackages).values({ userId, ...values, status: 'draft' });
    const packageId = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
    await db.insert(preferredResearchAuditEvents).values({ packageId, actorUserId: userId, action: 'created', note: '创建优先股研究证据包草稿' });
    return (await db.select().from(preferredResearchPackages).where(eq(preferredResearchPackages.id, packageId)).limit(1))[0];
  }
  const pkg = await ownedPackage(userId, input.packageId); assertEditable(pkg.status);
  await db.update(preferredResearchPackages).set({ ...values, status: 'draft' }).where(eq(preferredResearchPackages.id, input.packageId));
  await db.insert(preferredResearchAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'updated', note: '更新优先股研究包主体或识别信息并回到草稿' });
  return (await db.select().from(preferredResearchPackages).where(eq(preferredResearchPackages.id, input.packageId)).limit(1))[0];
}

export async function listPreferredResearchEvidence(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ownedPackage(userId, packageId);
  return db.select().from(preferredResearchEvidence).where(eq(preferredResearchEvidence.packageId, packageId)).orderBy(desc(preferredResearchEvidence.documentDate), desc(preferredResearchEvidence.updatedAt));
}

export async function savePreferredResearchEvidence(userId: number, input: { packageId: number; sourceUrl: string; title: string; sourceInstitution: string; documentType: PreferredDocumentType; documentDate?: string | null; documentFingerprint: string; evidenceExtracts: PreferredEvidenceExtract[]; retrievedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const pkg = await ownedPackage(userId, input.packageId); assertEditable(pkg.status);
  const extracts = input.evidenceExtracts.map((item) => ({ label: item.label.trim().slice(0, 120), quotedText: item.quotedText.trim().slice(0, 6000), note: item.note.trim().slice(0, 4000) })).filter((item) => item.quotedText);
  if (!extracts.length) throw new Error('PREFERRED_RESEARCH_EVIDENCE_EXTRACT_REQUIRED');
  const values = { sourceUrl: input.sourceUrl.trim(), title: input.title.trim().slice(0, 240), sourceInstitution: input.sourceInstitution.trim().slice(0, 160), documentType: input.documentType, documentDate: parsePreferredDocumentDate(input.documentDate), documentFingerprint: input.documentFingerprint, evidenceExtracts: extracts, retrievedAt: input.retrievedAt, updatedAt: new Date() };
  const existing = (await db.select().from(preferredResearchEvidence).where(and(eq(preferredResearchEvidence.packageId, input.packageId), eq(preferredResearchEvidence.documentFingerprint, input.documentFingerprint))).limit(1))[0];
  if (existing) {
    await db.update(preferredResearchEvidence).set(values).where(eq(preferredResearchEvidence.id, existing.id));
    await db.insert(preferredResearchAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'evidence_saved', note: `更新证据摘录：${values.title}` });
    return { ...(await db.select().from(preferredResearchEvidence).where(eq(preferredResearchEvidence.id, existing.id)).limit(1))[0], created: false };
  }
  const insert = await db.insert(preferredResearchEvidence).values({ packageId: input.packageId, ...values });
  const id = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
  await db.insert(preferredResearchAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'evidence_saved', note: `归档官方来源和终端证据片段：${values.title}` });
  return { ...(await db.select().from(preferredResearchEvidence).where(eq(preferredResearchEvidence.id, id)).limit(1))[0], created: true };
}

export async function removePreferredResearchEvidence(userId: number, packageId: number, evidenceId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const pkg = await ownedPackage(userId, packageId); assertEditable(pkg.status);
  const evidence = (await db.select().from(preferredResearchEvidence).where(eq(preferredResearchEvidence.id, evidenceId)).limit(1))[0];
  if (!evidence || evidence.packageId !== packageId) throw new Error('PREFERRED_RESEARCH_EVIDENCE_NOT_FOUND');
  await db.delete(preferredResearchEvidence).where(eq(preferredResearchEvidence.id, evidenceId));
  await db.insert(preferredResearchAuditEvents).values({ packageId, actorUserId: userId, action: 'evidence_removed', note: `移除证据摘录：${evidence.title}` });
  return { packageId, evidenceId, removed: true };
}

export async function listPreferredResearchAudit(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await ownedPackage(userId, packageId);
  return db.select().from(preferredResearchAuditEvents).where(eq(preferredResearchAuditEvents.packageId, packageId)).orderBy(desc(preferredResearchAuditEvents.createdAt)).limit(100);
}

export async function submitPreferredResearchPackage(userId: number, packageId: number, note?: string | null) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const pkg = await ownedPackage(userId, packageId);
  if (!['draft', 'changes_requested'].includes(pkg.status)) throw new Error('PREFERRED_RESEARCH_PACKAGE_NOT_SUBMITTABLE');
  const evidence = await db.select({ id: preferredResearchEvidence.id }).from(preferredResearchEvidence).where(eq(preferredResearchEvidence.packageId, packageId));
  if (!evidence.length) throw new Error('PREFERRED_RESEARCH_PACKAGE_REQUIRES_EVIDENCE');
  await db.transaction(async (tx) => {
    await tx.update(preferredResearchPackages).set({ status: 'submitted', updatedAt: new Date() }).where(eq(preferredResearchPackages.id, packageId));
    await tx.insert(preferredResearchAuditEvents).values({ packageId, actorUserId: userId, action: 'submitted', note: note?.trim().slice(0, 500) || `提交 ${evidence.length} 项终端证据摘录供后续审阅` });
    await tx.insert(preferredResearchAuditEvents).values({ packageId, actorUserId: userId, action: 'status_changed', note: '研究包状态转为 submitted' });
  });
  return { packageId, status: 'submitted' as const, evidenceCount: evidence.length };
}
