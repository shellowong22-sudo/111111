import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  listChecklistMemberDirectory,
  listMortgageLedgerAudit,
  listMortgageLedgerSavedViews,
  listMortgageLedgerShares,
  listMortgageSharedLedgers,
  listMortgageTaxonomyTags,
  notifyMortgageLedgerReviewSubmitted,
  recordMortgageLedgerExport,
  revokeMortgageLedgerShare,
  revokeMortgageTaxonomyTagShare,
  reviewMortgageSharedLedger,
  saveMortgageLedgerSavedView,
  saveMortgageLedgerShare,
  saveMortgageSharedLedger,
  saveMortgageTaxonomyTag,
  saveMortgageTaxonomyTagShare,
  setMortgageLedgerReviewTiming,
  setMortgageTaxonomyTagAssignments,
  submitMortgageSharedLedger,
  deleteMortgageLedgerSavedView,
  importMbs21FhfaGeographicExposureCsv,
} from '../db';
import { pushNotificationToUser } from '../uploadAndSse';

const ledgerPermission = z.enum(['editor', 'reviewer', 'viewer']);

function mapMortgageLedgerError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const code = error.message;
  if (code === 'MORTGAGE_LEDGER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '抵押债账户级台账不存在或您已无访问权限。' });
  if (code === 'MORTGAGE_LEDGER_SHARE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到有效的抵押债台账成员授权。' });
  if (code === 'FORBIDDEN_MORTGAGE_LEDGER_ACCESS') throw new TRPCError({ code: 'FORBIDDEN', message: '当前权限不允许查看或修改该抵押债台账。' });
  if (code === 'FORBIDDEN_MORTGAGE_LEDGER_SHARE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅台账所有者可管理成员读写权限。' });
  if (code === 'FORBIDDEN_MORTGAGE_LEDGER_REVIEW') throw new TRPCError({ code: 'FORBIDDEN', message: '仅被授予审阅者权限的成员可执行批准或退回。' });
  if (code === 'FORBIDDEN_MORTGAGE_LEDGER_EXPORT') throw new TRPCError({ code: 'FORBIDDEN', message: '只读成员可以查看台账，但无导出权限。' });
  if (code === 'CANNOT_SHARE_MORTGAGE_LEDGER_WITH_OWNER') throw new TRPCError({ code: 'BAD_REQUEST', message: '台账所有者已拥有全部权限，无需重复授权。' });
  if (code === 'SHARED_USER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到目标团队成员。' });
  if (code === 'FORBIDDEN_MORTGAGE_TAG_VIEW' || code === 'FORBIDDEN_MORTGAGE_TAG_EDIT') throw new TRPCError({ code: 'FORBIDDEN', message: '当前权限不允许查看或编辑该团队分类标签。' });
  if (code === 'FORBIDDEN_MORTGAGE_TAG_MANAGE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅标签所有者可管理团队成员授权。' });
  if (code === 'MORTGAGE_TAG_NAME_REQUIRED' || code === 'MORTGAGE_VIEW_NAME_REQUIRED') throw new TRPCError({ code: 'BAD_REQUEST', message: '名称不能为空。' });
  if (code.startsWith('MBS21_CSV_VALIDATION:')) throw new TRPCError({ code: 'BAD_REQUEST', message: code.slice('MBS21_CSV_VALIDATION:'.length) });
  if (code === 'MBS21_IMPORT_REQUIRES_GEOGRAPHIC_LEDGER') throw new TRPCError({ code: 'BAD_REQUEST', message: 'FHFA 地理暴露 CSV 只能导入 MBS-21 地域暴露账户台账。' });
  throw error;
}

export const mortgageCollaborationRouter = router({
  memberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)),
  listLedgers: protectedProcedure.input(z.object({ moduleId: z.string().trim().min(1).max(32).optional() })).query(({ ctx, input }) => listMortgageSharedLedgers(ctx.user.id, input.moduleId)),
  listSavedViews: protectedProcedure.input(z.object({ moduleId: z.string().trim().min(1).max(32) })).query(({ ctx, input }) => listMortgageLedgerSavedViews(ctx.user.id, input.moduleId)),
  saveSavedView: protectedProcedure.input(z.object({ moduleId: z.string().trim().min(1).max(32), name: z.string().trim().min(1).max(96), config: z.object({ query: z.string().max(160).optional(), statuses: z.array(z.string().max(64)).max(12).optional(), sourceOnly: z.boolean().optional(), sort: z.array(z.object({ key: z.enum(['identifier', 'status', 'observedAt', 'sourceUrl']), direction: z.enum(['asc', 'desc']) })).max(4).optional(), visibleColumns: z.array(z.string().max(32)).max(12).optional() }) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveMortgageLedgerSavedView(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  deleteSavedView: protectedProcedure.input(z.object({ viewId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteMortgageLedgerSavedView(ctx.user.id, input.viewId)),
  saveLedger: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive().optional(), moduleId: z.string().trim().min(1).max(32), localStorageKey: z.string().trim().min(1).max(96).nullable().optional(), name: z.string().trim().min(2).max(160), payload: z.unknown(), isLocalMigration: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await saveMortgageSharedLedger(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); }
  }),
  listShares: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listMortgageLedgerShares(ctx.user.id, input.ledgerId); } catch (error) { return mapMortgageLedgerError(error); } }),
  shareLedger: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), permission: ledgerPermission })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveMortgageLedgerShare(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  revokeShare: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await revokeMortgageLedgerShare(ctx.user.id, input.ledgerId, input.sharedWithUserId)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  setReviewTiming: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive(), reviewDueAt: z.date().nullable(), reviewReminderHours: z.number().int().min(1).max(168).default(24) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await setMortgageLedgerReviewTiming(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  submitForReview: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive(), note: z.string().trim().max(6_000).default('') })).mutation(async ({ ctx, input }) => { try { const result = await submitMortgageSharedLedger(ctx.user.id, input.ledgerId, input.note); const emitted = await notifyMortgageLedgerReviewSubmitted(input.ledgerId, ctx.user.id); for (const notification of emitted) pushNotificationToUser(notification.userId, notification); return { success: true, ...result, notified: emitted.length }; } catch (error) { return mapMortgageLedgerError(error); } }),
  reviewLedger: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive(), decision: z.enum(['approved', 'changes_requested']), reviewNote: z.string().trim().min(2).max(6_000) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await reviewMortgageSharedLedger(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  listAudit: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive(), limit: z.number().int().min(1).max(120).default(80) })).query(async ({ ctx, input }) => { try { return await listMortgageLedgerAudit(ctx.user.id, input.ledgerId, input.limit); } catch (error) { return mapMortgageLedgerError(error); } }),
  authorizeCsvExport: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await recordMortgageLedgerExport(ctx.user.id, input.ledgerId, 'csv')) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  importMbs21FhfaCsv: protectedProcedure.input(z.object({ ledgerId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(160), rows: z.array(z.object({ region: z.string().max(120), exposureWeightPct: z.number().finite(), hpiChangePct: z.number().finite().nullable().optional(), observationDate: z.string().max(16), sourceUrl: z.string().max(1_000), sourceLabel: z.string().max(120).optional() })).min(1).max(2_000) })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await importMbs21FhfaGeographicExposureCsv(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); }
  }),
  listTaxonomyTags: protectedProcedure.query(({ ctx }) => listMortgageTaxonomyTags(ctx.user.id)),
  saveTaxonomyTag: protectedProcedure.input(z.object({ tagId: z.number().int().positive().optional(), name: z.string().trim().min(1).max(64), color: z.enum(['cyan', 'violet', 'amber', 'emerald', 'rose']).default('cyan') })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveMortgageTaxonomyTag(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  setTaxonomyTagAssignments: protectedProcedure.input(z.object({ tagId: z.number().int().positive(), categoryKeys: z.array(z.string().trim().min(1).max(48)).max(24) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await setMortgageTaxonomyTagAssignments(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  shareTaxonomyTag: protectedProcedure.input(z.object({ tagId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), canEdit: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveMortgageTaxonomyTagShare(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
  revokeTaxonomyTagShare: protectedProcedure.input(z.object({ tagId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await revokeMortgageTaxonomyTagShare(ctx.user.id, input)) }; } catch (error) { return mapMortgageLedgerError(error); } }),
});
