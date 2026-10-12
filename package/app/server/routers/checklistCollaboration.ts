import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, protectedProcedure, publicProcedure, router } from '../_core/trpc';
import {
  batchReviewChecklistTemplateArchives,
  createChecklistVersionExportSignature,
  createChecklistSnapshot,
  deleteSovereignComparisonPreset,
  getChecklistSnapshotById,
  getChecklistTemplateById,
  getChecklistTemplatePermission,
  listChecklistArchiveReviewQueue,
  listChecklistMemberDirectory,
  listChecklistTemplateReviewSignatures,
  listChecklistShares,
  listChecklistSnapshots,
  listChecklistTemplateAuditEvents,
  listChecklistTemplatesForUser,
  listSovereignComparisonPresetShares,
  listSovereignComparisonPresets,
  revokeChecklistShare,
  revokeSovereignComparisonPresetShare,
  registerChecklistVersionExport,
  reviewChecklistTemplateArchive,
  saveChecklistShare,
  saveChecklistTemplate,
  saveSovereignComparisonPreset,
  shareSovereignComparisonPreset,
  setChecklistTemplateArchive,
  setChecklistTemplateRetention,
  verifyChecklistExportSignature,
} from '../db';

const moduleId = z.string().trim().min(2).max(32);
const checklistItems = z.array(z.string().trim().min(1).max(500)).min(1).max(30);
const templateInput = z.object({
  templateId: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(120),
  moduleId,
  items: checklistItems,
  isPublic: z.boolean().default(false),
});

function requireTemplateAccess(permission: 'owner' | 'editor' | 'viewer' | 'none', mode: 'view' | 'edit') {
  const allowed = mode === 'view' ? permission !== 'none' : permission === 'owner' || permission === 'editor';
  if (!allowed) throw new TRPCError({ code: 'FORBIDDEN', message: mode === 'edit' ? '您没有编辑该团队清单模板的权限。' : '您没有查看该团队清单模板的权限。' });
}

function asItems(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asCompleted(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item) && item >= 0) : [];
}

type ChecklistSnapshotComparable = { items: unknown; completedItems: unknown; note: string | null };

export function compareChecklistSnapshotContent(left: ChecklistSnapshotComparable, right: ChecklistSnapshotComparable) {
  const leftItems = asItems(left.items); const rightItems = asItems(right.items); const leftCompleted = new Set(asCompleted(left.completedItems)); const rightCompleted = new Set(asCompleted(right.completedItems));
  const maxItems = Math.max(leftItems.length, rightItems.length);
  const changes = Array.from({ length: maxItems }, (_, index) => {
    const leftItem = leftItems[index] ?? null; const rightItem = rightItems[index] ?? null; const leftDone = leftCompleted.has(index); const rightDone = rightCompleted.has(index);
    const textChanged = leftItem !== rightItem; const completedChanged = leftDone !== rightDone;
    const kind = leftItem === null ? 'added' : rightItem === null ? 'removed' : textChanged && completedChanged ? 'text_and_completion_changed' : textChanged ? 'text_changed' : 'completion_changed';
    return { index, leftItem, rightItem, leftCompleted: leftDone, rightCompleted: rightDone, textChanged, completedChanged, kind, changed: textChanged || completedChanged };
  }).filter((item) => item.changed);
  return { changes, noteChanged: (left.note ?? '') !== (right.note ?? '') };
}

export const checklistCollaborationRouter = router({
  listTemplates: protectedProcedure.input(z.object({ moduleId, includeArchived: z.boolean().default(false) })).query(({ ctx, input }) => listChecklistTemplatesForUser(ctx.user.id, input.moduleId, input.includeArchived)),

  listComparisonPresets: protectedProcedure.query(({ ctx }) => listSovereignComparisonPresets(ctx.user.id)),

  verifyExportSignature: publicProcedure.input(z.object({ researchId: z.string().trim().regex(/^SR-[A-Z0-9-]+$/), verificationCode: z.string().trim().regex(/^CHK-[A-F0-9]{32}$/) })).mutation(({ input }) => verifyChecklistExportSignature(input)),

  saveComparisonPreset: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80), countries: z.array(z.enum(['US', 'DE', 'JP', 'GB', 'FR', 'IT', 'ES', 'CN', 'BR', 'IN', 'MX', 'AU', 'CA', 'KR', 'BE', 'CH', 'DK', 'NL', 'NO', 'NZ', 'PL', 'PT', 'SE'])).min(2).max(6).refine((items) => new Set(items).size === items.length, '国家不可重复') })).mutation(({ ctx, input }) => saveSovereignComparisonPreset(ctx.user.id, input)),

  deleteComparisonPreset: protectedProcedure.input(z.object({ presetId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await deleteSovereignComparisonPreset(ctx.user.id, input.presetId)) }; }
    catch (error) { if (error instanceof Error && error.message === 'FORBIDDEN_COMPARISON_PRESET') throw new TRPCError({ code: 'FORBIDDEN', message: '仅预设创建者可以删除该收藏。' }); throw error; }
  }),

  shareComparisonPreset: protectedProcedure.input(z.object({ presetId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await shareSovereignComparisonPreset(ctx.user.id, input)) }; }
    catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_COMPARISON_PRESET') throw new TRPCError({ code: 'FORBIDDEN', message: '仅预设创建者可以管理团队共享。' });
      if (error instanceof Error && error.message === 'SHARED_USER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到目标账户，请核对账户编号。' });
      if (error instanceof Error && error.message === 'CANNOT_SHARE_PRESET_WITH_OWNER') throw new TRPCError({ code: 'BAD_REQUEST', message: '预设创建者已拥有完整访问权限，无需共享。' });
      throw error;
    }
  }),

  listComparisonPresetShares: protectedProcedure.input(z.object({ presetId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await listSovereignComparisonPresetShares(ctx.user.id, input.presetId); }
    catch (error) { if (error instanceof Error && error.message === 'FORBIDDEN_COMPARISON_PRESET') throw new TRPCError({ code: 'FORBIDDEN', message: '仅预设创建者可以查看共享成员。' }); throw error; }
  }),

  revokeComparisonPresetShare: protectedProcedure.input(z.object({ presetId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await revokeSovereignComparisonPresetShare(ctx.user.id, input.presetId, input.sharedWithUserId)) }; }
    catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_COMPARISON_PRESET') throw new TRPCError({ code: 'FORBIDDEN', message: '仅预设创建者可以撤销团队共享。' });
      if (error instanceof Error && error.message === 'COMPARISON_PRESET_SHARE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到该成员的有效预设共享授权。' });
      throw error;
    }
  }),

  memberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)),

  saveTemplate: protectedProcedure.input(templateInput).mutation(async ({ ctx, input }) => {
    if (input.templateId) {
      const template = await getChecklistTemplateById(input.templateId);
      if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: '研究清单模板不存在。' });
    }
    try {
      return { success: true, ...(await saveChecklistTemplate(ctx.user.id, input)) };
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_EDIT') throw new TRPCError({ code: 'FORBIDDEN', message: '您没有编辑该团队清单模板的权限。' });
      if (error instanceof Error && error.message === 'TEMPLATE_ARCHIVED') throw new TRPCError({ code: 'BAD_REQUEST', message: '该模板已归档；请先由创建者恢复后再编辑。' });
      throw error;
    }
  }),

  shareTemplate: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), canEdit: z.boolean() })).mutation(async ({ ctx, input }) => {
    try {
      return { success: true, ...(await saveChecklistShare(ctx.user.id, input)) };
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_SHARE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可管理共享授权。' });
      if (error instanceof Error && error.message === 'SHARED_USER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到目标账户，请核对账户编号。' });
      if (error instanceof Error && error.message === 'CANNOT_SHARE_WITH_OWNER') throw new TRPCError({ code: 'BAD_REQUEST', message: '模板创建者已拥有完整编辑权限，无需重复共享。' });
      if (error instanceof Error && error.message === 'TEMPLATE_ARCHIVED') throw new TRPCError({ code: 'BAD_REQUEST', message: '该模板已归档；请先恢复后再设置共享权限。' });
      throw error;
    }
  }),

  revokeShare: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return { success: true, ...(await revokeChecklistShare(ctx.user.id, input.templateId, input.sharedWithUserId)) };
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_SHARE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可撤销共享授权。' });
      if (error instanceof Error && error.message === 'PUBLIC_TEMPLATE_STILL_DISCOVERABLE') throw new TRPCError({ code: 'BAD_REQUEST', message: '请先关闭“登录账户可发现”，再撤销指定账户访问，以确保其即时失去读取权限。' });
      if (error instanceof Error && error.message === 'SHARE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到该账户的有效共享授权。' });
      throw error;
    }
  }),

  setTemplateArchive: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), archived: z.boolean(), retentionDays: z.number().int().min(7).max(3650).nullable().default(null) })).mutation(async ({ ctx, input }) => {
    try {
      return { success: true, ...(await setChecklistTemplateArchive(ctx.user.id, input.templateId, input.archived, input.archived ? input.retentionDays : null)) };
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_ARCHIVE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可归档或恢复模板。' });
      throw error;
    }
  }),

  setArchiveRetention: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), retentionDays: z.number().int().min(7).max(3650).nullable() })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await setChecklistTemplateRetention(ctx.user.id, input.templateId, input.retentionDays)) }; }
    catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_ARCHIVE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可设置归档保留期限。' });
      if (error instanceof Error && error.message === 'TEMPLATE_NOT_ARCHIVED') throw new TRPCError({ code: 'BAD_REQUEST', message: '仅归档模板可设置保留期限。' });
      throw error;
    }
  }),

  archiveReviewQueue: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50), filter: z.enum(['all', 'due_soon', 'overdue']).default('all') })).query(({ input }) => listChecklistArchiveReviewQueue(input.limit, input.filter)),

  reviewArchiveTemplate: adminProcedure.input(z.object({ templateId: z.number().int().positive(), decision: z.enum(['approved', 'changes_requested']), reviewNote: z.string().trim().min(2).max(5_000) })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await reviewChecklistTemplateArchive(ctx.user.id, input)) }; }
    catch (error) {
      if (error instanceof Error && error.message === 'ARCHIVE_REVIEW_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到待审的归档模板。' });
      if (error instanceof Error && error.message === 'ARCHIVE_REVIEW_NOT_PENDING') throw new TRPCError({ code: 'BAD_REQUEST', message: '该模板已完成审阅或不在待审状态。' });
      throw error;
    }
  }),

  batchReviewArchiveTemplates: adminProcedure.input(z.object({ templateIds: z.array(z.number().int().positive()).min(1).max(50), decision: z.enum(['approved', 'changes_requested']), reviewNote: z.string().trim().min(2).max(5_000) })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await batchReviewChecklistTemplateArchives(ctx.user.id, input)) }; }
    catch (error) {
      if (error instanceof Error && error.message === 'ARCHIVE_REVIEW_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '所选模板中存在不存在或不再归档的项目。' });
      if (error instanceof Error && error.message === 'ARCHIVE_REVIEW_NOT_PENDING') throw new TRPCError({ code: 'BAD_REQUEST', message: '所选模板中存在已完成审阅的项目，请刷新队列后重试。' });
      if (error instanceof Error && error.message === 'ARCHIVE_REVIEW_RETENTION_MISMATCH') throw new TRPCError({ code: 'BAD_REQUEST', message: '批量审阅仅支持保留期限完全一致的归档模板；请按 30 天、1 年或长期保留等相同期限分别处理。' });
      throw error;
    }
  }),

  listShares: protectedProcedure.input(z.object({ templateId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try { return await listChecklistShares(ctx.user.id, input.templateId); }
    catch (error) { if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_SHARE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可查看共享授权。' }); throw error; }
  }),

  listTemplateAudit: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(30) })).query(async ({ ctx, input }) => {
    try { return await listChecklistTemplateAuditEvents(ctx.user.id, input.templateId, input.limit); }
    catch (error) { if (error instanceof Error && error.message === 'FORBIDDEN_TEMPLATE_ARCHIVE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可查看模板治理记录。' }); throw error; }
  }),

  listTemplateReviewSignatures: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), limit: z.number().int().min(1).max(50).default(20) })).query(async ({ ctx, input }) => {
    requireTemplateAccess(await getChecklistTemplatePermission(input.templateId, ctx.user.id), 'view');
    return listChecklistTemplateReviewSignatures(input.templateId, input.limit);
  }),

  saveSnapshot: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), moduleId, completedItems: z.array(z.number().int().min(0)).max(30), note: z.string().trim().max(5_000).default('') })).mutation(async ({ ctx, input }) => {
    const template = await getChecklistTemplateById(input.templateId);
    if (!template) throw new TRPCError({ code: 'NOT_FOUND', message: '研究清单模板不存在。' });
    if (template.archivedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: '该模板已归档；请先恢复后再保存版本。' });
    if (template.moduleId !== input.moduleId) throw new TRPCError({ code: 'BAD_REQUEST', message: '模板与当前主权债研究模块不匹配。' });
    const permission = await getChecklistTemplatePermission(template.id, ctx.user.id);
    requireTemplateAccess(permission, 'edit');
    const validItems = asItems(template.items);
    const completedItems = input.completedItems.filter((item) => item < validItems.length);
    return { success: true, ...(await createChecklistSnapshot({ userId: ctx.user.id, templateId: template.id, moduleId: input.moduleId, items: validItems, completedItems, note: input.note })) };
  }),

  listSnapshots: protectedProcedure.input(z.object({ templateId: z.number().int().positive(), moduleId, limit: z.number().int().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
    const permission = await getChecklistTemplatePermission(input.templateId, ctx.user.id);
    requireTemplateAccess(permission, 'view');
    return listChecklistSnapshots(input.templateId, input.moduleId, input.limit);
  }),

  compareSnapshots: protectedProcedure.input(z.object({ leftSnapshotId: z.number().int().positive(), rightSnapshotId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const [left, right] = await Promise.all([getChecklistSnapshotById(input.leftSnapshotId), getChecklistSnapshotById(input.rightSnapshotId)]);
    if (!left || !right) throw new TRPCError({ code: 'NOT_FOUND', message: '指定的研究清单版本不存在。' });
    if (left.templateId !== right.templateId || left.moduleId !== right.moduleId) throw new TRPCError({ code: 'BAD_REQUEST', message: '只能比较同一模板、同一研究模块的两个版本。' });
    requireTemplateAccess(await getChecklistTemplatePermission(left.templateId, ctx.user.id), 'view');
    return { left, right, ...compareChecklistSnapshotContent(left, right) };
  }),

  prepareVersionExport: protectedProcedure.input(z.object({ leftSnapshotId: z.number().int().positive(), rightSnapshotId: z.number().int().positive(), exportFormat: z.enum(['csv', 'pdf']) })).query(async ({ ctx, input }) => {
    const [left, right] = await Promise.all([getChecklistSnapshotById(input.leftSnapshotId), getChecklistSnapshotById(input.rightSnapshotId)]);
    if (!left || !right || left.templateId !== right.templateId || left.moduleId !== right.moduleId) throw new TRPCError({ code: 'BAD_REQUEST', message: '导出签名只能用于同一模板、同一研究模块的两个版本。' });
    requireTemplateAccess(await getChecklistTemplatePermission(left.templateId, ctx.user.id), 'view');
    const issuedAt = new Date().toISOString();
    try { return { issuedAt, ...createChecklistVersionExportSignature({ userId: ctx.user.id, templateId: left.templateId, moduleId: left.moduleId, leftSnapshotId: left.id, rightSnapshotId: right.id, exportFormat: input.exportFormat, issuedAt }) }; }
    catch (error) { if (error instanceof Error && error.message === 'EXPORT_SIGNING_UNAVAILABLE') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '当前环境未配置导出签名服务。' }); throw error; }
  }),

  registerVersionExport: protectedProcedure.input(z.object({ leftSnapshotId: z.number().int().positive(), rightSnapshotId: z.number().int().positive(), exportFormat: z.enum(['csv', 'pdf']), issuedAt: z.string().datetime(), verificationCode: z.string().trim().regex(/^CHK-[A-F0-9]{32}$/) })).mutation(async ({ ctx, input }) => {
    const [left, right] = await Promise.all([getChecklistSnapshotById(input.leftSnapshotId), getChecklistSnapshotById(input.rightSnapshotId)]);
    if (!left || !right || left.templateId !== right.templateId || left.moduleId !== right.moduleId) throw new TRPCError({ code: 'BAD_REQUEST', message: '下载登记只能用于同一模板、同一研究模块的两个版本。' });
    requireTemplateAccess(await getChecklistTemplatePermission(left.templateId, ctx.user.id), 'view');
    try { return { success: true, ...(await registerChecklistVersionExport({ userId: ctx.user.id, templateId: left.templateId, moduleId: left.moduleId, leftSnapshotId: left.id, rightSnapshotId: right.id, exportFormat: input.exportFormat, issuedAt: input.issuedAt, verificationCode: input.verificationCode })) }; }
    catch (error) { if (error instanceof Error && error.message === 'EXPORT_SIGNATURE_INVALID') throw new TRPCError({ code: 'BAD_REQUEST', message: '签名校验码无效或不属于当前账户与版本组合。' }); throw error; }
  }),
});
