import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../_core/trpc';
import {
  compareCreditResearchPackageVersions,
  createCreditResearchPackageRevision,
  listChecklistMemberDirectory,
  listCreditResearchPackageAudit,
  listCreditResearchPackageSignatures,
  listCreditResearchPackageShares,
  listCreditResearchPackageTemplates,
  listCreditResearchPackages,
  listCreditSharedWorkpapers,
  listCreditWorkpaperAudit,
  listCreditWorkpaperShares,
  revokeCreditResearchPackageShare,
  revokeCreditWorkpaperShare,
  reviewCreditSharedWorkpaper,
  saveCreditResearchPackage,
  saveCreditResearchPackageShare,
  saveCreditResearchPackageTemplate,
  saveCreditSharedWorkpaper,
  saveCreditWorkpaperShare,
  signCreditResearchPackage,
  submitCreditSharedWorkpaper,
} from '../db';

const sectionList = z.array(z.string().trim().min(1).max(180)).min(1).max(16).refine((items) => new Set(items.map((item) => item.toLowerCase())).size === items.length, '模板章节不可重复');
const packageStatusAction = z.enum(['submitted', 'approved', 'changes_requested']);
const collaborationPermission = z.enum(['editor', 'reviewer', 'viewer']);

function mapCreditCollaborationError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const message = error.message;
  if (message === 'CREDIT_PACKAGE_NOT_FOUND' || message === 'CREDIT_WORKPAPER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '信用研究对象不存在或已无权访问。' });
  if (message === 'FORBIDDEN_CREDIT_PACKAGE_ACCESS' || message === 'FORBIDDEN_CREDIT_WORKPAPER_ACCESS') throw new TRPCError({ code: 'FORBIDDEN', message: '您没有查看或编辑该信用研究对象的权限。' });
  if (message === 'FORBIDDEN_CREDIT_PACKAGE_SHARE' || message === 'FORBIDDEN_CREDIT_WORKPAPER_SHARE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅创建者可以管理团队共享权限。' });
  if (message === 'FORBIDDEN_CREDIT_PACKAGE_REVIEW' || message === 'FORBIDDEN_CREDIT_WORKPAPER_REVIEW') throw new TRPCError({ code: 'FORBIDDEN', message: '仅被授予审阅者权限的账户可以执行审批或退回。' });
  if (message === 'CREDIT_PACKAGE_APPROVED_LOCKED') throw new TRPCError({ code: 'BAD_REQUEST', message: '研究包已批准并冻结；如需修订，请创建后续版本。' });
  if (message === 'CREDIT_PACKAGE_REVISION_REQUIRES_APPROVAL') throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已批准研究包可以创建后续修订版本。' });
  if (message === 'CREDIT_PACKAGE_VERSION_NOT_LINKED') throw new TRPCError({ code: 'BAD_REQUEST', message: '只能比较同一修订链中的研究包版本。' });
  if (message === 'INVALID_CREDIT_APPROVAL_DUE_AT') throw new TRPCError({ code: 'BAD_REQUEST', message: '审批截止时间必须晚于当前时间。' });
  if (message === 'CREDIT_PACKAGE_NOT_SUBMITTED') throw new TRPCError({ code: 'BAD_REQUEST', message: '研究包必须先由所有者或编辑者提交签名，审阅者才可审批或退回。' });
  if (message === 'CREDIT_SIGNATURE_UNAVAILABLE') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '当前环境未配置内部签名服务。' });
  if (message === 'CANNOT_SHARE_CREDIT_PACKAGE_WITH_OWNER' || message === 'CANNOT_SHARE_CREDIT_WORKPAPER_WITH_OWNER') throw new TRPCError({ code: 'BAD_REQUEST', message: '创建者已拥有完整权限，无需重复授权。' });
  if (message === 'CREDIT_PACKAGE_SHARE_NOT_FOUND' || message === 'CREDIT_WORKPAPER_SHARE_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到有效的团队共享授权。' });
  if (message === 'FORBIDDEN_CREDIT_PACKAGE_TEMPLATE') throw new TRPCError({ code: 'FORBIDDEN', message: '仅模板创建者可以更新该研究包模板。' });
  if (message === 'SHARED_USER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到目标团队成员。' });
  throw error;
}

export const creditCollaborationRouter = router({
  memberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listChecklistMemberDirectory(ctx.user.id, input.query, input.limit)),

  listPackageTemplates: protectedProcedure.query(({ ctx }) => listCreditResearchPackageTemplates(ctx.user.id)),
  savePackageTemplate: protectedProcedure.input(z.object({ templateId: z.number().int().positive().optional(), name: z.string().trim().min(2).max(120), sections: sectionList, isDefault: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await saveCreditResearchPackageTemplate(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); }
  }),

  listPackages: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(100) })).query(({ ctx, input }) => listCreditResearchPackages(ctx.user.id, input.limit)),
  savePackage: protectedProcedure.input(z.object({ packageId: z.number().int().positive().optional(), templateId: z.number().int().positive().nullable().optional(), title: z.string().trim().min(2).max(180), researchQuestion: z.string().trim().min(2).max(12_000), asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), sourceUrl: z.string().url().max(2_000), note: z.string().trim().max(12_000).nullable().optional(), sections: sectionList, approvalDueAt: z.string().trim().min(16).max(40).nullable().optional(), approvalReminderDays: z.number().int().min(1).max(30).default(3) })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await saveCreditResearchPackage(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); }
  }),
  createPackageRevision: protectedProcedure.input(z.object({ approvedPackageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await createCreditResearchPackageRevision(ctx.user.id, input.approvedPackageId)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  comparePackageVersions: protectedProcedure.input(z.object({ leftPackageId: z.number().int().positive(), rightPackageId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await compareCreditResearchPackageVersions(ctx.user.id, input); } catch (error) { return mapCreditCollaborationError(error); } }),
  listPackageShares: protectedProcedure.input(z.object({ packageId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listCreditResearchPackageShares(ctx.user.id, input.packageId); } catch (error) { return mapCreditCollaborationError(error); } }),
  sharePackage: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), permission: collaborationPermission })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveCreditResearchPackageShare(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  revokePackageShare: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await revokeCreditResearchPackageShare(ctx.user.id, input.packageId, input.sharedWithUserId)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  signPackage: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), action: packageStatusAction, attestation: z.string().trim().min(12).max(2_000), note: z.string().trim().max(6_000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    try { return { success: true, ...(await signCreditResearchPackage(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); }
  }),
  listPackageSignatures: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(50) })).query(async ({ ctx, input }) => { try { return await listCreditResearchPackageSignatures(ctx.user.id, input.packageId, input.limit); } catch (error) { return mapCreditCollaborationError(error); } }),
  listPackageAudit: protectedProcedure.input(z.object({ packageId: z.number().int().positive(), limit: z.number().int().min(1).max(120).default(80) })).query(async ({ ctx, input }) => { try { return await listCreditResearchPackageAudit(ctx.user.id, input.packageId, input.limit); } catch (error) { return mapCreditCollaborationError(error); } }),

  listWorkpapers: protectedProcedure.input(z.object({ moduleId: z.string().trim().min(1).max(32).optional() })).query(({ ctx, input }) => listCreditSharedWorkpapers(ctx.user.id, input.moduleId)),
  saveWorkpaper: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive().optional(), moduleId: z.string().trim().min(1).max(32), name: z.string().trim().min(2).max(160), payload: z.unknown() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveCreditSharedWorkpaper(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  listWorkpaperShares: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listCreditWorkpaperShares(ctx.user.id, input.workpaperId); } catch (error) { return mapCreditCollaborationError(error); } }),
  shareWorkpaper: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), permission: collaborationPermission })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveCreditWorkpaperShare(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  revokeWorkpaperShare: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await revokeCreditWorkpaperShare(ctx.user.id, input.workpaperId, input.sharedWithUserId)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  submitWorkpaper: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive(), note: z.string().trim().max(6_000).default('') })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await submitCreditSharedWorkpaper(ctx.user.id, input.workpaperId, input.note)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  reviewWorkpaper: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive(), decision: z.enum(['approved', 'changes_requested']), reviewNote: z.string().trim().min(2).max(6_000) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await reviewCreditSharedWorkpaper(ctx.user.id, input)) }; } catch (error) { return mapCreditCollaborationError(error); } }),
  listWorkpaperAudit: protectedProcedure.input(z.object({ workpaperId: z.number().int().positive(), limit: z.number().int().min(1).max(120).default(80) })).query(async ({ ctx, input }) => { try { return await listCreditWorkpaperAudit(ctx.user.id, input.workpaperId, input.limit); } catch (error) { return mapCreditCollaborationError(error); } }),
});
