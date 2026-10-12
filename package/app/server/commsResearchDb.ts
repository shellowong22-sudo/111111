import { and, desc, eq, inArray, like, ne, or } from 'drizzle-orm';
import { commsResearchReminderEvents, commsResearchReminderRules, commsResearchThreadAuditEvents, commsResearchThreadMembers, commsResearchThreadMessages, commsResearchThreadVersionReviews, commsResearchThreadVersions, commsResearchThreads, notifications, users } from '../drizzle/schema';
import { getDb, listChecklistMemberDirectory } from './db';

export type CommsThreadPurpose = 'brief' | 'question' | 'handoff' | 'decision';
export type CommsThreadStatus = 'open' | 'acknowledged' | 'resolved';
export type CommsThreadPermission = 'viewer' | 'contributor';
export type CommsMessageType = 'note' | 'question' | 'decision';

export function isCommsDueReminderEligible(input: { dueAt: Date | null; status: CommsThreadStatus; leadHours: number }, now = new Date()) {
  return Boolean(input.dueAt && input.status !== 'resolved' && now.getTime() >= input.dueAt.getTime() - input.leadHours * 3_600_000);
}

type ThreadInput = { title: string; purpose: CommsThreadPurpose; moduleCode: string; classification: 'internal' | 'restricted'; dueAt: Date | null; initialBody: string; memberIds: number[]; leadHours: number; reminderActive: boolean };

async function resolveAccess(userId: number, threadId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const thread = (await db.select().from(commsResearchThreads).where(eq(commsResearchThreads.id, threadId)).limit(1))[0];
  if (!thread) throw new Error('COMMS_THREAD_NOT_FOUND');
  if (thread.ownerUserId === userId) return { thread, isOwner: true, permission: 'contributor' as const };
  const member = (await db.select().from(commsResearchThreadMembers).where(and(eq(commsResearchThreadMembers.threadId, threadId), eq(commsResearchThreadMembers.userId, userId))).limit(1))[0];
  if (!member) throw new Error('FORBIDDEN_COMMS_THREAD');
  return { thread, isOwner: false, permission: member.permission as CommsThreadPermission };
}

async function audit(threadId: number, actorUserId: number, action: 'created' | 'member_added' | 'message_posted' | 'acknowledged' | 'resolved', note?: string, targetUserId?: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(commsResearchThreadAuditEvents).values({ threadId, actorUserId, action, note: note?.slice(0, 500) ?? null, targetUserId: targetUserId ?? null });
}

export async function listCommsThreads(userId: number, input: { status?: CommsThreadStatus | 'all'; purpose?: CommsThreadPurpose | 'all'; query?: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const memberships = await db.select({ threadId: commsResearchThreadMembers.threadId, permission: commsResearchThreadMembers.permission }).from(commsResearchThreadMembers).where(eq(commsResearchThreadMembers.userId, userId));
  const sharedIds = memberships.map((row) => row.threadId); const access = sharedIds.length ? or(eq(commsResearchThreads.ownerUserId, userId), inArray(commsResearchThreads.id, sharedIds)) : eq(commsResearchThreads.ownerUserId, userId);
  const filters = [access]; if (input.status && input.status !== 'all') filters.push(eq(commsResearchThreads.status, input.status)); if (input.purpose && input.purpose !== 'all') filters.push(eq(commsResearchThreads.purpose, input.purpose)); if (input.query?.trim()) filters.push(like(commsResearchThreads.title, `%${input.query.trim()}%`));
  const rows = await db.select().from(commsResearchThreads).where(and(...filters)).orderBy(desc(commsResearchThreads.updatedAt)).limit(120);
  const membershipByThread = new Map(memberships.map((row) => [row.threadId, row.permission as CommsThreadPermission]));
  return rows.map((row) => ({ ...row, access: row.ownerUserId === userId ? 'owner' as const : membershipByThread.get(row.id) ?? 'viewer' }));
}

export async function createCommsThread(ownerUserId: number, input: ThreadInput) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const memberIds = [...new Set(input.memberIds)].filter((id) => id !== ownerUserId); if (memberIds.length) { const members = await db.select({ id: users.id }).from(users).where(inArray(users.id, memberIds)); if (members.length !== memberIds.length) throw new Error('COMMS_MEMBER_NOT_FOUND'); }
  const created = await db.insert(commsResearchThreads).values({ ownerUserId, title: input.title, purpose: input.purpose, moduleCode: input.moduleCode, classification: input.classification, dueAt: input.dueAt }); const threadId = Number((created as any)[0]?.insertId ?? (created as any).insertId); if (!Number.isInteger(threadId) || threadId <= 0) throw new Error('COMMS_THREAD_CREATE_FAILED');
  await db.insert(commsResearchThreadMessages).values({ threadId, authorUserId: ownerUserId, body: input.initialBody, messageType: input.purpose === 'decision' ? 'decision' : input.purpose === 'question' ? 'question' : 'note' });
  await audit(threadId, ownerUserId, 'created', `创建${input.purpose}研究分派`); await audit(threadId, ownerUserId, 'message_posted', '提交初始终端内研究内容');
  for (const memberId of memberIds) { await db.insert(commsResearchThreadMembers).values({ threadId, userId: memberId, permission: 'contributor' }); await audit(threadId, ownerUserId, 'member_added', '授予贡献权限', memberId); }
  if (input.dueAt) await db.insert(commsResearchReminderRules).values({ threadId, ownerUserId, leadHours: input.leadHours, isActive: input.reminderActive });
  return { id: threadId };
}

export async function addCommsThreadMember(ownerUserId: number, threadId: number, userId: number, permission: CommsThreadPermission) {
  const access = await resolveAccess(ownerUserId, threadId); if (!access.isOwner) throw new Error('FORBIDDEN_COMMS_THREAD_OWNER'); if (userId === ownerUserId) throw new Error('COMMS_OWNER_ALREADY_HAS_ACCESS');
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const member = (await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1))[0]; if (!member) throw new Error('COMMS_MEMBER_NOT_FOUND');
  await db.insert(commsResearchThreadMembers).values({ threadId, userId, permission }).onDuplicateKeyUpdate({ set: { permission } }); await audit(threadId, ownerUserId, 'member_added', permission === 'contributor' ? '授予贡献权限' : '授予查看权限', userId); return { threadId, userId, permission };
}

export async function getCommsThreadDetail(userId: number, threadId: number) {
  const access = await resolveAccess(userId, threadId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const [members, messages, auditRows, reminder] = await Promise.all([
    db.select().from(commsResearchThreadMembers).where(eq(commsResearchThreadMembers.threadId, threadId)),
    db.select().from(commsResearchThreadMessages).where(eq(commsResearchThreadMessages.threadId, threadId)).orderBy(desc(commsResearchThreadMessages.createdAt)).limit(300),
    db.select().from(commsResearchThreadAuditEvents).where(eq(commsResearchThreadAuditEvents.threadId, threadId)).orderBy(desc(commsResearchThreadAuditEvents.createdAt)).limit(160),
    access.isOwner ? db.select().from(commsResearchReminderRules).where(and(eq(commsResearchReminderRules.threadId, threadId), eq(commsResearchReminderRules.ownerUserId, userId))).limit(1) : Promise.resolve([]),
  ]);
  const ids = [...new Set([access.thread.ownerUserId, ...members.map((row) => row.userId), ...messages.map((row) => row.authorUserId), ...auditRows.map((row) => row.actorUserId), ...auditRows.flatMap((row) => row.targetUserId ? [row.targetUserId] : [])])]; const directory = ids.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, ids)) : [];
  return { thread: access.thread, access: access.isOwner ? 'owner' as const : access.permission, members, messages: messages.reverse(), audit: auditRows, directory, reminder: reminder[0] ?? null };
}

export async function postCommsThreadMessage(userId: number, input: { threadId: number; body: string; messageType: CommsMessageType }) {
  const access = await resolveAccess(userId, input.threadId); if (!access.isOwner && access.permission !== 'contributor') throw new Error('FORBIDDEN_COMMS_THREAD_WRITE'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const inserted = await db.insert(commsResearchThreadMessages).values({ threadId: input.threadId, authorUserId: userId, body: input.body, messageType: input.messageType }); const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId); await db.update(commsResearchThreads).set({ updatedAt: new Date() }).where(eq(commsResearchThreads.id, input.threadId)); await audit(input.threadId, userId, 'message_posted', `提交${input.messageType}记录`); return { id };
}

export async function updateCommsThreadStatus(userId: number, threadId: number, status: CommsThreadStatus) {
  const access = await resolveAccess(userId, threadId); if (status === 'resolved' && !access.isOwner) throw new Error('FORBIDDEN_COMMS_THREAD_OWNER'); if (!access.isOwner && access.permission !== 'contributor') throw new Error('FORBIDDEN_COMMS_THREAD_WRITE'); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.update(commsResearchThreads).set({ status, updatedAt: new Date() }).where(eq(commsResearchThreads.id, threadId)); await audit(threadId, userId, status === 'resolved' ? 'resolved' : 'acknowledged', status === 'resolved' ? '标记为已解决' : '确认已接收'); return { threadId, status };
}

export async function updateCommsThreadDue(ownerUserId: number, threadId: number, dueAt: Date | null) {
  const access = await resolveAccess(ownerUserId, threadId); if (!access.isOwner) throw new Error('FORBIDDEN_COMMS_THREAD_OWNER');
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.update(commsResearchThreads).set({ dueAt, updatedAt: new Date() }).where(eq(commsResearchThreads.id, threadId));
  return { threadId, dueAt };
}

export async function saveCommsReminderRule(ownerUserId: number, input: { threadId: number; leadHours: number; isActive: boolean }) {
  const access = await resolveAccess(ownerUserId, input.threadId); if (!access.isOwner) throw new Error('FORBIDDEN_COMMS_THREAD_OWNER'); if (!access.thread.dueAt) throw new Error('COMMS_REMINDER_NEEDS_DUE_DATE');
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  await db.insert(commsResearchReminderRules).values({ threadId: input.threadId, ownerUserId, leadHours: input.leadHours, isActive: input.isActive }).onDuplicateKeyUpdate({ set: { leadHours: input.leadHours, isActive: input.isActive, updatedAt: new Date() } });
  return { ...input };
}

export async function listCommsReminderEvents(userId: number, limit = 80) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select({ id: commsResearchReminderEvents.id, threadId: commsResearchReminderEvents.threadId, dueAt: commsResearchReminderEvents.dueAt, leadHours: commsResearchReminderEvents.leadHours, createdAt: commsResearchReminderEvents.createdAt, notificationId: commsResearchReminderEvents.notificationId, title: commsResearchThreads.title, moduleCode: commsResearchThreads.moduleCode, status: commsResearchThreads.status }).from(commsResearchReminderEvents).innerJoin(commsResearchThreads, eq(commsResearchReminderEvents.threadId, commsResearchThreads.id)).where(eq(commsResearchReminderEvents.userId, userId)).orderBy(desc(commsResearchReminderEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 120));
  return rows;
}

export async function listCommsReminderRules(userId: number, input: { state?: 'all' | 'active' | 'paused'; query?: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const rows = await db.select({ id: commsResearchReminderRules.id, threadId: commsResearchReminderRules.threadId, leadHours: commsResearchReminderRules.leadHours, isActive: commsResearchReminderRules.isActive, updatedAt: commsResearchReminderRules.updatedAt, title: commsResearchThreads.title, moduleCode: commsResearchThreads.moduleCode, dueAt: commsResearchThreads.dueAt, threadStatus: commsResearchThreads.status }).from(commsResearchReminderRules).innerJoin(commsResearchThreads, eq(commsResearchReminderRules.threadId, commsResearchThreads.id)).where(eq(commsResearchReminderRules.ownerUserId, userId)).orderBy(desc(commsResearchReminderRules.updatedAt)).limit(160);
  const query = input.query?.trim().toLowerCase() ?? '';
  return rows.filter((row) => (input.state === 'all' || !input.state || (input.state === 'active' ? row.isActive : !row.isActive)) && (!query || row.title.toLowerCase().includes(query) || row.moduleCode.toLowerCase().includes(query)));
}

export async function batchSetCommsReminderRules(ownerUserId: number, input: { ruleIds: number[]; isActive: boolean }) {
  const ids = [...new Set(input.ruleIds)].filter((id) => Number.isInteger(id) && id > 0); if (!ids.length) throw new Error('COMMS_REMINDER_RULES_REQUIRED');
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const owned = await db.select({ id: commsResearchReminderRules.id }).from(commsResearchReminderRules).where(and(eq(commsResearchReminderRules.ownerUserId, ownerUserId), inArray(commsResearchReminderRules.id, ids)));
  if (owned.length !== ids.length) throw new Error('FORBIDDEN_COMMS_REMINDER_RULE');
  await db.update(commsResearchReminderRules).set({ isActive: input.isActive, updatedAt: new Date() }).where(and(eq(commsResearchReminderRules.ownerUserId, ownerUserId), inArray(commsResearchReminderRules.id, ids)));
  return { updated: ids.length, isActive: input.isActive };
}

export async function listCommsReminderEventHistory(userId: number, input: { limit?: number; threadId?: number | null; status?: CommsThreadStatus | 'all'; from?: Date | null; to?: Date | null }) {
  const rows = await listCommsReminderEvents(userId, input.limit ?? 80);
  const from = input.from?.getTime() ?? null; const to = input.to ? new Date(input.to.getTime() + 86_400_000 - 1).getTime() : null;
  return rows.filter((row) => (!input.threadId || row.threadId === input.threadId) && (!input.status || input.status === 'all' || row.status === input.status) && (!from || row.createdAt.getTime() >= from) && (!to || row.createdAt.getTime() <= to));
}

export async function createCommsThreadVersion(ownerUserId: number, input: { threadId: number; summary: string }) {
  const access = await resolveAccess(ownerUserId, input.threadId); if (!access.isOwner) throw new Error('FORBIDDEN_COMMS_THREAD_OWNER'); if (access.thread.status !== 'resolved') throw new Error('COMMS_VERSION_REQUIRES_RESOLVED');
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const latest = (await db.select({ version: commsResearchThreadVersions.version }).from(commsResearchThreadVersions).where(eq(commsResearchThreadVersions.threadId, input.threadId)).orderBy(desc(commsResearchThreadVersions.version)).limit(1))[0];
  const version = (latest?.version ?? 0) + 1; const created = await db.insert(commsResearchThreadVersions).values({ threadId: input.threadId, ownerUserId, version, summary: input.summary, status: 'submitted', submittedAt: new Date() }); const id = Number((created as any)[0]?.insertId ?? (created as any).insertId); if (!Number.isInteger(id) || id <= 0) throw new Error('COMMS_VERSION_CREATE_FAILED');
  return { id, version, status: 'submitted' as const };
}

export async function listCommsThreadVersions(userId: number, threadId: number) {
  await resolveAccess(userId, threadId); const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const versions = await db.select().from(commsResearchThreadVersions).where(eq(commsResearchThreadVersions.threadId, threadId)).orderBy(desc(commsResearchThreadVersions.version)); const ids = versions.map((row) => row.id); const reviews = ids.length ? await db.select().from(commsResearchThreadVersionReviews).where(inArray(commsResearchThreadVersionReviews.versionId, ids)).orderBy(desc(commsResearchThreadVersionReviews.updatedAt)) : []; const reviewerIds = [...new Set(reviews.map((row) => row.reviewerUserId))]; const directory = reviewerIds.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, reviewerIds)) : [];
  return { versions, reviews, directory };
}

export async function reviewCommsThreadVersion(reviewerUserId: number, input: { versionId: number; decision: 'approved' | 'changes_requested'; note: string }) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const version = (await db.select().from(commsResearchThreadVersions).where(eq(commsResearchThreadVersions.id, input.versionId)).limit(1))[0]; if (!version) throw new Error('COMMS_VERSION_NOT_FOUND'); const access = await resolveAccess(reviewerUserId, version.threadId); if (access.isOwner) throw new Error('COMMS_VERSION_OWNER_CANNOT_REVIEW'); if (version.status !== 'submitted' && version.status !== 'changes_requested') throw new Error('COMMS_VERSION_NOT_REVIEWABLE');
  await db.insert(commsResearchThreadVersionReviews).values({ versionId: version.id, reviewerUserId, decision: input.decision, note: input.note || null }).onDuplicateKeyUpdate({ set: { decision: input.decision, note: input.note || null, updatedAt: new Date() } });
  const finalStatus = input.decision === 'changes_requested' ? 'changes_requested' : 'approved'; await db.update(commsResearchThreadVersions).set({ status: finalStatus, finalizedAt: finalStatus === 'approved' ? new Date() : null, updatedAt: new Date() }).where(eq(commsResearchThreadVersions.id, version.id));
  return { versionId: version.id, status: finalStatus };
}

export async function processCommsDueReminderNotifications(now = new Date()) {
  const db = await getDb(); if (!db) return [] as { id: number; userId: number; title: string; content: string; type: 'alert' }[];
  const rows = await db.select({ rule: commsResearchReminderRules, thread: commsResearchThreads }).from(commsResearchReminderRules).innerJoin(commsResearchThreads, eq(commsResearchReminderRules.threadId, commsResearchThreads.id)).where(and(eq(commsResearchReminderRules.isActive, true), ne(commsResearchThreads.status, 'resolved')));
  const emitted: { id: number; userId: number; title: string; content: string; type: 'alert' }[] = [];
  for (const row of rows) {
    const dueAt = row.thread.dueAt; if (!dueAt || !isCommsDueReminderEligible({ dueAt, status: row.thread.status as CommsThreadStatus, leadHours: row.rule.leadHours }, now)) continue;
    const key = `comms-due:${row.thread.id}:${dueAt.getTime()}:${row.rule.leadHours}`;
    const created = await db.transaction(async (tx) => {
      const duplicate = await tx.select({ id: commsResearchReminderEvents.id }).from(commsResearchReminderEvents).where(eq(commsResearchReminderEvents.notificationKey, key)).limit(1); if (duplicate[0]) return null;
      const overdue = now.getTime() > dueAt.getTime(); const content = overdue ? `研究分派“${row.thread.title}”已于 ${dueAt.toISOString()} 到期，当前状态为 ${row.thread.status === 'acknowledged' ? '已确认' : '待处理'}。请在终端内复核或标记解决。` : `研究分派“${row.thread.title}”将于 ${dueAt.toISOString()} 到期；当前状态为 ${row.thread.status === 'acknowledged' ? '已确认' : '待处理'}，提醒提前量为 ${row.rule.leadHours} 小时。`;
      const inserted = await tx.insert(commsResearchReminderEvents).values({ notificationKey: key, ruleId: row.rule.id, threadId: row.thread.id, userId: row.rule.ownerUserId, dueAt, leadHours: row.rule.leadHours }); const eventId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
      const notification = await tx.insert(notifications).values({ userId: row.rule.ownerUserId, title: overdue ? `研究分派已到期：${row.thread.title}` : `研究分派到期提醒：${row.thread.title}`, content, type: 'alert', relatedType: 'comms_research_due', relatedId: eventId }); const notificationId = Number((notification as any)[0]?.insertId ?? (notification as any).insertId);
      await tx.update(commsResearchReminderEvents).set({ notificationId }).where(eq(commsResearchReminderEvents.id, eventId)); return notificationId ? { id: notificationId, userId: row.rule.ownerUserId, title: overdue ? `研究分派已到期：${row.thread.title}` : `研究分派到期提醒：${row.thread.title}`, content, type: 'alert' as const } : null;
    });
    if (created) emitted.push(created);
  }
  return emitted;
}

export async function getCommsWorkload(userId: number) {
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE');
  const memberships = await db.select({ threadId: commsResearchThreadMembers.threadId, userId: commsResearchThreadMembers.userId, permission: commsResearchThreadMembers.permission }).from(commsResearchThreadMembers).where(eq(commsResearchThreadMembers.userId, userId));
  const sharedIds = memberships.map((row) => row.threadId); const access = sharedIds.length ? or(eq(commsResearchThreads.ownerUserId, userId), inArray(commsResearchThreads.id, sharedIds)) : eq(commsResearchThreads.ownerUserId, userId);
  const threads = await db.select().from(commsResearchThreads).where(access).orderBy(desc(commsResearchThreads.updatedAt)).limit(500); const ids = threads.map((row) => row.id); if (!ids.length) return { total: 0, status: [], modules: [], members: [], boundary: '当前账户没有创建或获授权访问的实际研究分派；不使用本地演示消息、联系人或社区内容替代。' };
  const allMembers = await db.select().from(commsResearchThreadMembers).where(inArray(commsResearchThreadMembers.threadId, ids)); const people = [...new Set([...threads.map((row) => row.ownerUserId), ...allMembers.map((row) => row.userId)])]; const directory = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, people)); const names = new Map(directory.map((row) => [row.id, row.name ?? `账户 ${row.id}`]));
  const status = ['open', 'acknowledged', 'resolved'].map((value) => ({ status: value, count: threads.filter((row) => row.status === value).length })); const moduleMap = new Map<string, { moduleCode: string; total: number; open: number; acknowledged: number; resolved: number }>(); const memberMap = new Map<number, { userId: number; name: string; total: number; open: number; acknowledged: number; resolved: number; dueSoon: number }>(); const now = Date.now(); const byThread = new Map<number, typeof allMembers>(); for (const member of allMembers) byThread.set(member.threadId, [...(byThread.get(member.threadId) ?? []), member]);
  for (const thread of threads) { const module = moduleMap.get(thread.moduleCode) ?? { moduleCode: thread.moduleCode, total: 0, open: 0, acknowledged: 0, resolved: 0 }; module.total += 1; module[thread.status] += 1; moduleMap.set(thread.moduleCode, module); const assigned = new Set([thread.ownerUserId, ...(byThread.get(thread.id) ?? []).map((member) => member.userId)]); for (const memberId of assigned) { const aggregate = memberMap.get(memberId) ?? { userId: memberId, name: names.get(memberId) ?? `账户 ${memberId}`, total: 0, open: 0, acknowledged: 0, resolved: 0, dueSoon: 0 }; aggregate.total += 1; aggregate[thread.status] += 1; if (thread.dueAt && thread.dueAt.getTime() >= now && thread.dueAt.getTime() <= now + 3 * 86_400_000 && thread.status !== 'resolved') aggregate.dueSoon += 1; memberMap.set(memberId, aggregate); } }
  return { total: threads.length, status, modules: [...moduleMap.values()].sort((a, b) => b.total - a.total || a.moduleCode.localeCompare(b.moduleCode)), members: [...memberMap.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)), boundary: '统计仅聚合当前账户实际创建或获授权访问的研究分派及其真实成员授权；不推断团队容量、工时或绩效。' };
}

export async function getCommsWorkloadTrend(userId: number, input: { from: Date; to: Date }) {
  const visible = await listCommsThreads(userId, { status: 'all', purpose: 'all', query: '' }); const ids = visible.map((row) => row.id); if (!ids.length) return { rows: [], boundary: '当前账户没有创建或获授权访问的实际研究分派；没有可绘制的趋势记录。' };
  const db = await getDb(); if (!db) throw new Error('DATABASE_UNAVAILABLE'); const events = await db.select().from(commsResearchThreadAuditEvents).where(inArray(commsResearchThreadAuditEvents.threadId, ids)).orderBy(desc(commsResearchThreadAuditEvents.createdAt)).limit(3000); const start = input.from.getTime(); const end = input.to.getTime() + 86_400_000 - 1; const buckets = new Map<string, { date: string; created: number; activity: number; resolved: number }>();
  for (const event of events) { const at = event.createdAt.getTime(); if (at < start || at > end) continue; const date = event.createdAt.toISOString().slice(0, 10); const bucket = buckets.get(date) ?? { date, created: 0, activity: 0, resolved: 0 }; if (event.action === 'created') bucket.created += 1; else if (event.action === 'resolved') bucket.resolved += 1; else bucket.activity += 1; buckets.set(date, bucket); }
  return { rows: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)), boundary: '趋势仅使用当前账户可见分派的实际审计事件日期；无事件日期不插值，活动数不等同于工时、产能或绩效。' };
}

export { listChecklistMemberDirectory as listCommsMemberDirectory };
