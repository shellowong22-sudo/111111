import { and, desc, eq, inArray, or } from 'drizzle-orm';
import {
  municipalIssuerEvidenceAuditEvents,
  municipalIssuerEvidenceDocumentTags,
  municipalIssuerEvidenceDocuments,
  municipalIssuerEvidenceSearchPresets,
  municipalIssuerEvidencePackages,
  municipalIssuerEvidenceReviews,
  municipalIssuerEvidenceShares,
  municipalIssuerEvidenceVersions,
  notifications,
  users,
} from '../drizzle/schema';
import { getDb } from './db';

export type MunicipalEvidencePermission = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'none';
type PackageStatus = 'draft' | 'submitted' | 'approved' | 'changes_requested';
type ReviewStatus = 'approved' | 'changes_requested';
type EvidenceExtract = { label: string; quotedText: string; note: string };
export type MunicipalEvidenceEmitted = { id: number; userId: number; title: string; content: string; type: 'alert' | 'info' };

function parseMunicipalEvidenceDocumentDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('MUNICIPAL_EVIDENCE_DOCUMENT_DATE_INVALID');
  return parsed;
}

async function permissionFor(packageId: number, userId: number): Promise<MunicipalEvidencePermission> {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const pkg = (await db.select({ userId: municipalIssuerEvidencePackages.userId }).from(municipalIssuerEvidencePackages).where(eq(municipalIssuerEvidencePackages.id, packageId)).limit(1))[0];
  if (!pkg) return 'none';
  if (pkg.userId === userId) return 'owner';
  const share = (await db.select({ permission: municipalIssuerEvidenceShares.permission }).from(municipalIssuerEvidenceShares).where(and(eq(municipalIssuerEvidenceShares.packageId, packageId), eq(municipalIssuerEvidenceShares.sharedWithUserId, userId))).limit(1))[0];
  return share?.permission ?? 'none';
}

function requirePermission(permission: MunicipalEvidencePermission, mode: 'view' | 'edit' | 'share' | 'review') {
  const allowed = mode === 'view' ? permission !== 'none' : mode === 'edit' ? permission === 'owner' || permission === 'editor' : mode === 'share' ? permission === 'owner' : permission === 'reviewer';
  if (!allowed) throw new Error(`FORBIDDEN_MUNICIPAL_EVIDENCE_${mode.toUpperCase()}`);
}

function cleanExtracts(value: EvidenceExtract[]) {
  return value.map((item) => ({ label: item.label.trim().slice(0, 120), quotedText: item.quotedText.trim().slice(0, 6000), note: item.note.trim().slice(0, 4000) })).filter((item) => item.quotedText);
}

function cleanTags(value: string[]) {
  return [...new Set(value.map((tag) => tag.trim().replace(/\s+/g, ' ')).filter((tag) => tag.length >= 1 && tag.length <= 80))].slice(0, 20);
}

async function attachDocumentTags<T extends { id: number }>(documents: T[]) {
  if (!documents.length) return documents.map((document) => ({ ...document, tags: [] as string[] }));
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select().from(municipalIssuerEvidenceDocumentTags).where(inArray(municipalIssuerEvidenceDocumentTags.documentId, documents.map((document) => document.id)));
  const tagsByDocument = new Map<number, string[]>();
  rows.forEach((row) => tagsByDocument.set(row.documentId, [...(tagsByDocument.get(row.documentId) ?? []), row.tag]));
  return documents.map((document) => ({ ...document, tags: tagsByDocument.get(document.id) ?? [] }));
}

async function getPackage(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const row = (await db.select().from(municipalIssuerEvidencePackages).where(eq(municipalIssuerEvidencePackages.id, packageId)).limit(1))[0];
  if (!row) throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_NOT_FOUND');
  return row;
}

function assertEditableStatus(status: PackageStatus) {
  if (status === 'submitted' || status === 'approved') throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_LOCKED_FOR_REVIEW');
}

export async function listMunicipalEvidencePackages(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const shares = await db.select({ packageId: municipalIssuerEvidenceShares.packageId, permission: municipalIssuerEvidenceShares.permission }).from(municipalIssuerEvidenceShares).where(eq(municipalIssuerEvidenceShares.sharedWithUserId, userId));
  const sharedIds = shares.map((row) => row.packageId);
  const sharedPermission = new Map(shares.map((row) => [row.packageId, row.permission]));
  const rows = await db.select({ id: municipalIssuerEvidencePackages.id, userId: municipalIssuerEvidencePackages.userId, name: municipalIssuerEvidencePackages.name, issuerName: municipalIssuerEvidencePackages.issuerName, issuerIdentifier: municipalIssuerEvidencePackages.issuerIdentifier, status: municipalIssuerEvidencePackages.status, approvalDeadlineAt: municipalIssuerEvidencePackages.approvalDeadlineAt, createdAt: municipalIssuerEvidencePackages.createdAt, updatedAt: municipalIssuerEvidencePackages.updatedAt, ownerName: users.name }).from(municipalIssuerEvidencePackages).innerJoin(users, eq(municipalIssuerEvidencePackages.userId, users.id)).where(or(eq(municipalIssuerEvidencePackages.userId, userId), ...(sharedIds.length ? [inArray(municipalIssuerEvidencePackages.id, sharedIds)] : []))).orderBy(desc(municipalIssuerEvidencePackages.updatedAt), municipalIssuerEvidencePackages.name);
  return rows.map((row) => ({ ...row, permission: row.userId === userId ? 'owner' as const : sharedPermission.get(row.id) ?? 'viewer' }));
}

export async function saveMunicipalEvidencePackage(userId: number, input: { packageId?: number; name: string; issuerName: string; issuerIdentifier?: string | null; approvalDeadlineAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const values = { name: input.name.trim().slice(0, 160), issuerName: input.issuerName.trim().slice(0, 240), issuerIdentifier: input.issuerIdentifier?.trim().slice(0, 80) || null, approvalDeadlineAt: input.approvalDeadlineAt ?? null, updatedAt: new Date() };
  if (!input.packageId) {
    const insert = await db.insert(municipalIssuerEvidencePackages).values({ userId, ...values, status: 'draft' });
    const packageId = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
    await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId, actorUserId: userId, action: 'created', note: '创建地方债发行人证据归档草稿' });
    return getPackage(packageId);
  }
  requirePermission(await permissionFor(input.packageId, userId), 'edit');
  const current = await getPackage(input.packageId); assertEditableStatus(current.status as PackageStatus);
  await db.update(municipalIssuerEvidencePackages).set({ ...values, status: 'draft' }).where(eq(municipalIssuerEvidencePackages.id, input.packageId));
  await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'updated', note: '更新发行人、归档名称或审批截止信息并回到草稿' });
  return getPackage(input.packageId);
}

export async function listMunicipalEvidenceDocuments(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'view');
  const documents = await db.select().from(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.packageId, packageId)).orderBy(desc(municipalIssuerEvidenceDocuments.documentDate), desc(municipalIssuerEvidenceDocuments.updatedAt));
  return attachDocumentTags(documents);
}

export async function saveMunicipalEvidenceDocumentTags(userId: number, input: { packageId: number; documentId: number; tags: string[] }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'edit');
  const pkg = await getPackage(input.packageId); assertEditableStatus(pkg.status as PackageStatus);
  const document = (await db.select({ id: municipalIssuerEvidenceDocuments.id, packageId: municipalIssuerEvidenceDocuments.packageId, title: municipalIssuerEvidenceDocuments.title }).from(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.id, input.documentId)).limit(1))[0];
  if (!document || document.packageId !== input.packageId) throw new Error('MUNICIPAL_EVIDENCE_DOCUMENT_NOT_FOUND');
  const tags = cleanTags(input.tags);
  await db.transaction(async (tx) => {
    await tx.delete(municipalIssuerEvidenceDocumentTags).where(eq(municipalIssuerEvidenceDocumentTags.documentId, input.documentId));
    if (tags.length) await tx.insert(municipalIssuerEvidenceDocumentTags).values(tags.map((tag) => ({ documentId: input.documentId, tag })));
    await tx.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'document_saved', note: `更新文件标签：${document.title}${tags.length ? `（${tags.join('、')}）` : '（已清空）'}` });
  });
  return { documentId: input.documentId, tags };
}

export async function searchMunicipalEvidenceDocuments(userId: number, input: { packageId: number; query?: string; tag?: string }) {
  requirePermission(await permissionFor(input.packageId, userId), 'view');
  const documents = await listMunicipalEvidenceDocuments(userId, input.packageId);
  const terms = (input.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const tag = input.tag?.trim().toLowerCase() ?? '';
  return documents.filter((document) => {
    const searchable = [document.title, document.sourceInstitution, document.sourceUrl, document.uploadedFileName ?? '', document.documentType, JSON.stringify(document.evidenceExtracts)].join(' ').toLowerCase();
    return (!terms.length || terms.every((term) => searchable.includes(term))) && (!tag || document.tags.some((item) => item.toLowerCase() === tag));
  });
}

const TAG_RULES: Array<{ tag: string; terms: string[] }> = [
  { tag: '预算', terms: ['预算', '收入', '支出', '税收'] }, { tag: '偿债', terms: ['偿债', '债务', '本金', '利息', '债券'] }, { tag: '流动性', terms: ['流动性', '现金', '备用金'] }, { tag: '审计', terms: ['审计', '审计报告'] }, { tag: '运营', terms: ['运营', '经营', '客流', '患者', '学生'] },
];

export async function suggestMunicipalEvidenceDocumentTags(userId: number, input: { packageId: number; documentIds: number[] }) {
  requirePermission(await permissionFor(input.packageId, userId), 'view');
  const selected = new Set(input.documentIds.slice(0, 100));
  const documents = await listMunicipalEvidenceDocuments(userId, input.packageId);
  return documents.filter((document) => selected.has(document.id)).map((document) => {
    const searchable = [document.title, document.sourceInstitution, document.uploadedFileName ?? '', JSON.stringify(document.evidenceExtracts)].join(' ').toLowerCase();
    const suggestedTags = TAG_RULES.filter((rule) => rule.terms.some((term) => searchable.includes(term))).map((rule) => rule.tag).filter((tag) => !document.tags.includes(tag));
    return { documentId: document.id, suggestedTags };
  });
}

export async function batchSaveMunicipalEvidenceDocumentTags(userId: number, input: { packageId: number; documentIds: number[]; tags: string[]; mode: 'add' | 'replace' | 'remove' }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'edit');
  const pkg = await getPackage(input.packageId); assertEditableStatus(pkg.status as PackageStatus);
  const documentIds = [...new Set(input.documentIds)].slice(0, 100); const tags = cleanTags(input.tags);
  if (!documentIds.length) throw new Error('MUNICIPAL_EVIDENCE_DOCUMENT_SELECTION_REQUIRED');
  const documents = await db.select({ id: municipalIssuerEvidenceDocuments.id, packageId: municipalIssuerEvidenceDocuments.packageId }).from(municipalIssuerEvidenceDocuments).where(inArray(municipalIssuerEvidenceDocuments.id, documentIds));
  if (documents.length !== documentIds.length || documents.some((document) => document.packageId !== input.packageId)) throw new Error('MUNICIPAL_EVIDENCE_DOCUMENT_NOT_FOUND');
  const tagRows = await db.select().from(municipalIssuerEvidenceDocumentTags).where(inArray(municipalIssuerEvidenceDocumentTags.documentId, documentIds));
  const existing = new Map<number, string[]>(); tagRows.forEach((row) => existing.set(row.documentId, [...(existing.get(row.documentId) ?? []), row.tag]));
  await db.transaction(async (tx) => {
    for (const documentId of documentIds) {
      const current = existing.get(documentId) ?? [];
      const next = input.mode === 'replace' ? tags : input.mode === 'add' ? cleanTags([...current, ...tags]) : current.filter((tag) => !tags.includes(tag));
      await tx.delete(municipalIssuerEvidenceDocumentTags).where(eq(municipalIssuerEvidenceDocumentTags.documentId, documentId));
      if (next.length) await tx.insert(municipalIssuerEvidenceDocumentTags).values(next.map((tag) => ({ documentId, tag })));
    }
    await tx.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'document_saved', note: `批量${input.mode === 'add' ? '添加' : input.mode === 'replace' ? '替换' : '移除'} ${documentIds.length} 份文件标签：${tags.join('、') || '无'}` });
  });
  return { documentIds, tags, mode: input.mode };
}

export async function listMunicipalEvidenceSearchPresets(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'view');
  return db.select().from(municipalIssuerEvidenceSearchPresets).where(and(eq(municipalIssuerEvidenceSearchPresets.userId, userId), eq(municipalIssuerEvidenceSearchPresets.packageId, packageId))).orderBy(desc(municipalIssuerEvidenceSearchPresets.updatedAt));
}

export async function saveMunicipalEvidenceSearchPreset(userId: number, input: { packageId: number; id?: number; name: string; query?: string | null; tag?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'view');
  const values = { name: input.name.trim(), query: input.query?.trim() || null, tag: input.tag?.trim() || null, updatedAt: new Date() };
  if (input.id) {
    const existing = (await db.select({ id: municipalIssuerEvidenceSearchPresets.id }).from(municipalIssuerEvidenceSearchPresets).where(and(eq(municipalIssuerEvidenceSearchPresets.id, input.id), eq(municipalIssuerEvidenceSearchPresets.userId, userId), eq(municipalIssuerEvidenceSearchPresets.packageId, input.packageId))).limit(1))[0];
    if (!existing) throw new Error('MUNICIPAL_EVIDENCE_SEARCH_PRESET_NOT_FOUND');
    await db.update(municipalIssuerEvidenceSearchPresets).set(values).where(eq(municipalIssuerEvidenceSearchPresets.id, input.id));
  } else await db.insert(municipalIssuerEvidenceSearchPresets).values({ userId, packageId: input.packageId, ...values });
  return (await db.select().from(municipalIssuerEvidenceSearchPresets).where(and(eq(municipalIssuerEvidenceSearchPresets.userId, userId), eq(municipalIssuerEvidenceSearchPresets.packageId, input.packageId), eq(municipalIssuerEvidenceSearchPresets.name, values.name))).limit(1))[0];
}

export async function deleteMunicipalEvidenceSearchPreset(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const result = await db.delete(municipalIssuerEvidenceSearchPresets).where(and(eq(municipalIssuerEvidenceSearchPresets.id, id), eq(municipalIssuerEvidenceSearchPresets.userId, userId)));
  return Number(result[0]?.affectedRows ?? 0) > 0;
}

export async function saveMunicipalEvidenceDocument(userId: number, input: { packageId: number; sourceUrl: string; title: string; sourceInstitution: string; documentType: 'official_statement' | 'annual_financial' | 'operating_disclosure' | 'event_notice' | 'rating_material' | 'other_official'; documentDate?: string | null; documentFingerprint: string; evidenceExtracts: EvidenceExtract[]; retrievedAt: Date; storageKey?: string | null; storageUrl?: string | null; uploadedFileName?: string | null; uploadedMimeType?: string | null; uploadedSizeBytes?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'edit');
  const pkg = await getPackage(input.packageId); assertEditableStatus(pkg.status as PackageStatus);
  const extracts = cleanExtracts(input.evidenceExtracts);
  if (!extracts.length && !input.storageKey) throw new Error('MUNICIPAL_EVIDENCE_EXTRACT_REQUIRED');
  const values = { sourceUrl: input.sourceUrl.trim(), storageKey: input.storageKey?.trim() || null, storageUrl: input.storageUrl?.trim() || null, uploadedFileName: input.uploadedFileName?.trim().slice(0, 255) || null, uploadedMimeType: input.uploadedMimeType?.trim().slice(0, 160) || null, uploadedSizeBytes: input.uploadedSizeBytes ?? null, title: input.title.trim().slice(0, 240), sourceInstitution: input.sourceInstitution.trim().slice(0, 160), documentType: input.documentType, documentDate: parseMunicipalEvidenceDocumentDate(input.documentDate), documentFingerprint: input.documentFingerprint, evidenceExtracts: extracts, retrievedAt: input.retrievedAt, updatedAt: new Date() };
  const existing = (await db.select().from(municipalIssuerEvidenceDocuments).where(and(eq(municipalIssuerEvidenceDocuments.packageId, input.packageId), eq(municipalIssuerEvidenceDocuments.documentFingerprint, input.documentFingerprint))).limit(1))[0];
  if (existing) {
    await db.update(municipalIssuerEvidenceDocuments).set(values).where(eq(municipalIssuerEvidenceDocuments.id, existing.id));
    await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'document_saved', note: `${values.storageKey ? '更新用户上传文件' : '更新已归档文件'}：${values.title}` });
    return { ...(await db.select().from(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.id, existing.id)).limit(1))[0], created: false };
  }
  const insert = await db.insert(municipalIssuerEvidenceDocuments).values({ packageId: input.packageId, ...values });
  const id = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
  await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'document_saved', note: values.storageKey ? `归档用户上传的文件副本：${values.title}${extracts.length ? '（含核验证据）' : '（待补充核验证据）'}` : `归档官方文件链接和证据片段：${values.title}` });
  return { ...(await db.select().from(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.id, id)).limit(1))[0], created: true };
}

export async function removeMunicipalEvidenceDocument(userId: number, packageId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'edit');
  const pkg = await getPackage(packageId); assertEditableStatus(pkg.status as PackageStatus);
  const document = (await db.select({ title: municipalIssuerEvidenceDocuments.title, packageId: municipalIssuerEvidenceDocuments.packageId }).from(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.id, documentId)).limit(1))[0];
  if (!document || document.packageId !== packageId) throw new Error('MUNICIPAL_EVIDENCE_DOCUMENT_NOT_FOUND');
  await db.transaction(async (tx) => {
    await tx.delete(municipalIssuerEvidenceDocumentTags).where(eq(municipalIssuerEvidenceDocumentTags.documentId, documentId));
    await tx.delete(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.id, documentId));
  });
  await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId, actorUserId: userId, action: 'document_removed', note: `移除归档文件：${document.title}` });
  return { packageId, documentId, removed: true };
}

export async function listMunicipalEvidenceShares(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'view');
  return db.select({ id: municipalIssuerEvidenceShares.id, sharedWithUserId: municipalIssuerEvidenceShares.sharedWithUserId, permission: municipalIssuerEvidenceShares.permission, userName: users.name, userEmail: users.email }).from(municipalIssuerEvidenceShares).innerJoin(users, eq(municipalIssuerEvidenceShares.sharedWithUserId, users.id)).where(eq(municipalIssuerEvidenceShares.packageId, packageId));
}

export async function saveMunicipalEvidenceShare(userId: number, input: { packageId: number; sharedWithUserId: number; permission: 'viewer' | 'editor' | 'reviewer' }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'share');
  if (input.sharedWithUserId === userId) throw new Error('CANNOT_SHARE_MUNICIPAL_EVIDENCE_WITH_OWNER');
  const member = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.sharedWithUserId)).limit(1))[0];
  if (!member) throw new Error('MUNICIPAL_EVIDENCE_MEMBER_NOT_FOUND');
  await db.insert(municipalIssuerEvidenceShares).values(input).onDuplicateKeyUpdate({ set: { permission: input.permission, updatedAt: new Date() } });
  await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'shared', targetUserId: input.sharedWithUserId, note: `授予成员 ${input.permission} 权限` });
  return input;
}

export async function revokeMunicipalEvidenceShare(userId: number, packageId: number, sharedWithUserId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'share');
  await db.delete(municipalIssuerEvidenceShares).where(and(eq(municipalIssuerEvidenceShares.packageId, packageId), eq(municipalIssuerEvidenceShares.sharedWithUserId, sharedWithUserId)));
  await db.insert(municipalIssuerEvidenceAuditEvents).values({ packageId, actorUserId: userId, action: 'share_revoked', targetUserId: sharedWithUserId, note: '撤销成员归档访问权限' });
  return { packageId, sharedWithUserId, revoked: true };
}

export async function listMunicipalEvidenceReviews(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'view');
  return db.select({ id: municipalIssuerEvidenceReviews.id, reviewerUserId: municipalIssuerEvidenceReviews.reviewerUserId, status: municipalIssuerEvidenceReviews.status, reviewNote: municipalIssuerEvidenceReviews.reviewNote, reviewedAt: municipalIssuerEvidenceReviews.reviewedAt, updatedAt: municipalIssuerEvidenceReviews.updatedAt, reviewerName: users.name }).from(municipalIssuerEvidenceReviews).innerJoin(users, eq(municipalIssuerEvidenceReviews.reviewerUserId, users.id)).where(eq(municipalIssuerEvidenceReviews.packageId, packageId)).orderBy(desc(municipalIssuerEvidenceReviews.updatedAt));
}

export async function listMunicipalEvidenceVersions(userId: number, packageId: number) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'view');
  return db.select({ id: municipalIssuerEvidenceVersions.id, packageId: municipalIssuerEvidenceVersions.packageId, version: municipalIssuerEvidenceVersions.version, documentSnapshot: municipalIssuerEvidenceVersions.documentSnapshot, status: municipalIssuerEvidenceVersions.status, snapshotAt: municipalIssuerEvidenceVersions.snapshotAt, actorUserId: municipalIssuerEvidenceVersions.actorUserId, actorName: users.name, note: municipalIssuerEvidenceVersions.note }).from(municipalIssuerEvidenceVersions).leftJoin(users, eq(municipalIssuerEvidenceVersions.actorUserId, users.id)).where(eq(municipalIssuerEvidenceVersions.packageId, packageId)).orderBy(desc(municipalIssuerEvidenceVersions.version));
}

export async function compareMunicipalEvidenceVersions(userId: number, input: { packageId: number; leftVersion: number; rightVersion: number }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'view');
  const rows = await db.select().from(municipalIssuerEvidenceVersions).where(eq(municipalIssuerEvidenceVersions.packageId, input.packageId));
  const left = rows.find((row) => row.version === input.leftVersion); const right = rows.find((row) => row.version === input.rightVersion);
  if (!left || !right) throw new Error('MUNICIPAL_EVIDENCE_VERSION_NOT_FOUND');
  const asItems = (value: unknown) => Array.isArray(value) ? value.map((item) => ({ title: String((item as any).title ?? ''), documentFingerprint: String((item as any).documentFingerprint ?? ''), documentType: String((item as any).documentType ?? ''), sourceUrl: String((item as any).sourceUrl ?? '') })).filter((item) => item.documentFingerprint) : [];
  const leftItems = asItems(left.documentSnapshot); const rightItems = asItems(right.documentSnapshot); const leftIds = new Set(leftItems.map((item) => item.documentFingerprint)); const rightIds = new Set(rightItems.map((item) => item.documentFingerprint));
  return { left, right, added: rightItems.filter((item) => !leftIds.has(item.documentFingerprint)), removed: leftItems.filter((item) => !rightIds.has(item.documentFingerprint)), unchanged: rightItems.filter((item) => leftIds.has(item.documentFingerprint)) };
}

export async function listMunicipalEvidenceAudit(userId: number, packageId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'view');
  return db.select({ id: municipalIssuerEvidenceAuditEvents.id, action: municipalIssuerEvidenceAuditEvents.action, note: municipalIssuerEvidenceAuditEvents.note, createdAt: municipalIssuerEvidenceAuditEvents.createdAt, actorUserId: municipalIssuerEvidenceAuditEvents.actorUserId, actorName: users.name, targetUserId: municipalIssuerEvidenceAuditEvents.targetUserId }).from(municipalIssuerEvidenceAuditEvents).innerJoin(users, eq(municipalIssuerEvidenceAuditEvents.actorUserId, users.id)).where(eq(municipalIssuerEvidenceAuditEvents.packageId, packageId)).orderBy(desc(municipalIssuerEvidenceAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
}

export async function submitMunicipalEvidencePackage(userId: number, packageId: number, note?: string | null) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(packageId, userId), 'edit');
  const pkg = await getPackage(packageId);
  if (!['draft', 'changes_requested'].includes(pkg.status)) throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_NOT_SUBMITTABLE');
  const reviewers = await db.select().from(municipalIssuerEvidenceShares).where(and(eq(municipalIssuerEvidenceShares.packageId, packageId), eq(municipalIssuerEvidenceShares.permission, 'reviewer')));
  if (!reviewers.length) throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_REQUIRES_REVIEWER');
  const documents = await db.select().from(municipalIssuerEvidenceDocuments).where(eq(municipalIssuerEvidenceDocuments.packageId, packageId));
  if (!documents.length) throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_REQUIRES_DOCUMENT');
  if (!documents.some((document) => Array.isArray(document.evidenceExtracts) && document.evidenceExtracts.length > 0)) throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_REQUIRES_VERIFIED_DOCUMENT');
  const snapshot = documents.map((document) => ({ id: document.id, title: document.title, sourceUrl: document.sourceUrl, sourceInstitution: document.sourceInstitution, documentType: document.documentType, documentDate: document.documentDate ? document.documentDate.toISOString().slice(0, 10) : null, documentFingerprint: document.documentFingerprint }));
  await db.transaction(async (tx) => {
    const rows = await tx.select({ version: municipalIssuerEvidenceVersions.version }).from(municipalIssuerEvidenceVersions).where(eq(municipalIssuerEvidenceVersions.packageId, packageId));
    const version = Math.max(0, ...rows.map((row) => row.version)) + 1;
    await tx.update(municipalIssuerEvidencePackages).set({ status: 'submitted', updatedAt: new Date() }).where(eq(municipalIssuerEvidencePackages.id, packageId));
    await tx.delete(municipalIssuerEvidenceReviews).where(eq(municipalIssuerEvidenceReviews.packageId, packageId));
    await tx.insert(municipalIssuerEvidenceVersions).values({ packageId, version, documentSnapshot: snapshot, status: 'submitted', actorUserId: userId, note: note?.trim().slice(0, 500) || `第 ${version} 次提交审阅时的文件指纹快照` });
    await tx.insert(municipalIssuerEvidenceAuditEvents).values({ packageId, actorUserId: userId, action: 'submitted', note: `提交 ${snapshot.length} 份文件审阅并冻结版本 ${version}` });
  });
  const emitted: MunicipalEvidenceEmitted[] = [];
  for (const reviewer of reviewers) {
    const title = `发行人证据待审：${pkg.issuerName}`;
    const content = `证据包“${pkg.name}”已提交，含 ${documents.length} 份官方文件链接和可核验证据片段。请在地方债发行人工作区审阅。`;
    const insert = await db.insert(notifications).values({ userId: reviewer.sharedWithUserId, title, content, type: 'info', relatedType: 'municipal_issuer_evidence_review', relatedId: packageId });
    const id = Number((insert as any)[0]?.insertId ?? (insert as any).insertId); if (id) emitted.push({ id, userId: reviewer.sharedWithUserId, title, content, type: 'info' });
  }
  return { packageId, status: 'submitted' as const, emitted };
}

export async function saveMunicipalEvidenceReview(userId: number, input: { packageId: number; status: ReviewStatus; reviewNote?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('DATABASE_UNAVAILABLE');
  requirePermission(await permissionFor(input.packageId, userId), 'review');
  const pkg = await getPackage(input.packageId);
  if (pkg.status !== 'submitted') throw new Error('MUNICIPAL_EVIDENCE_PACKAGE_NOT_UNDER_REVIEW');
  const reviewValues = { packageId: input.packageId, reviewerUserId: userId, status: input.status, reviewNote: input.reviewNote?.trim().slice(0, 6000) || null, reviewedAt: new Date(), updatedAt: new Date() };
  await db.insert(municipalIssuerEvidenceReviews).values(reviewValues).onDuplicateKeyUpdate({ set: { status: reviewValues.status, reviewNote: reviewValues.reviewNote, reviewedAt: reviewValues.reviewedAt, updatedAt: reviewValues.updatedAt } });
  const reviewerShares = await db.select().from(municipalIssuerEvidenceShares).where(and(eq(municipalIssuerEvidenceShares.packageId, input.packageId), eq(municipalIssuerEvidenceShares.permission, 'reviewer')));
  const reviews = await db.select().from(municipalIssuerEvidenceReviews).where(eq(municipalIssuerEvidenceReviews.packageId, input.packageId));
  const nextStatus: PackageStatus = reviews.some((item) => item.status === 'changes_requested') ? 'changes_requested' : reviewerShares.every((share) => reviews.some((item) => item.reviewerUserId === share.sharedWithUserId && item.status === 'approved')) ? 'approved' : 'submitted';
  await db.transaction(async (tx) => {
    await tx.update(municipalIssuerEvidencePackages).set({ status: nextStatus, updatedAt: new Date() }).where(eq(municipalIssuerEvidencePackages.id, input.packageId));
    await tx.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'reviewed', note: `审阅结论：${input.status}${reviewValues.reviewNote ? `；${reviewValues.reviewNote.slice(0, 160)}` : ''}` });
    if (nextStatus !== 'submitted') await tx.insert(municipalIssuerEvidenceAuditEvents).values({ packageId: input.packageId, actorUserId: userId, action: 'status_changed', note: `证据包状态转为 ${nextStatus}` });
  });
  const title = `发行人证据审阅更新：${pkg.issuerName}`;
  const content = `证据包“${pkg.name}”收到${input.status === 'approved' ? '批准' : '调整请求'}；当前状态为 ${nextStatus}。`;
  const insert = await db.insert(notifications).values({ userId: pkg.userId, title, content, type: nextStatus === 'changes_requested' ? 'alert' : 'info', relatedType: 'municipal_issuer_evidence_review', relatedId: input.packageId });
  const id = Number((insert as any)[0]?.insertId ?? (insert as any).insertId);
  return { packageId: input.packageId, status: nextStatus, emitted: id ? [{ id, userId: pkg.userId, title, content, type: nextStatus === 'changes_requested' ? 'alert' as const : 'info' as const }] : [] };
}
