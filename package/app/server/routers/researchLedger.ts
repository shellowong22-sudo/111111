import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from '../_core/trpc';
import { pushNotificationToUser } from '../uploadAndSse';
import {
  createResearchLedgerEntry,
  getPendingResearchLedgerEntries,
  getResearchLedgerAuditEvents,
  getResearchLedgerEntriesForUser,
  getResearchLedgerEntryById,
  reviewResearchLedgerEntry,
} from '../db';

const ledgerEntryInput = z.object({
  moduleCode: z.string().trim().min(2).max(32),
  instrument: z.string().trim().min(1).max(255),
  purpose: z.string().trim().min(3).max(5_000),
  verifiedSource: z.string().trim().min(3).max(5_000),
  methodBasis: z.string().trim().min(3).max(5_000),
  complianceConfirmed: z.literal(true),
});

export const researchLedgerRouter = router({
  submit: protectedProcedure.input(ledgerEntryInput).mutation(async ({ ctx, input }) => {
    const result = await createResearchLedgerEntry({ ...input, userId: ctx.user.id });
    result.adminNotifications.forEach((notification) => pushNotificationToUser(notification.userId, notification));
    return { success: true, entryId: result.entryId, approvalDueAt: result.approvalDueAt, status: 'submitted' as const };
  }),

  mine: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(async ({ ctx, input }) => {
    return getResearchLedgerEntriesForUser(ctx.user.id, input.limit);
  }),

  pending: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50) })).query(async ({ input }) => {
    return getPendingResearchLedgerEntries(input.limit);
  }),

  audit: protectedProcedure.input(z.object({ entryId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const entry = await getResearchLedgerEntryById(input.entryId);
    if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: '研究登记不存在。' });
    if (entry.userId !== ctx.user.id && ctx.user.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: '无权查看该研究登记的审计记录。' });
    }
    return getResearchLedgerAuditEvents(input.entryId);
  }),

  review: adminProcedure.input(z.object({
    entryId: z.number().int().positive(),
    decision: z.enum(['approved', 'rejected']),
    reviewNote: z.string().trim().min(2).max(5_000),
  })).mutation(async ({ ctx, input }) => {
    const entry = await getResearchLedgerEntryById(input.entryId);
    if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: '研究登记不存在。' });
    if (entry.status !== 'submitted') throw new TRPCError({ code: 'CONFLICT', message: '该研究登记已完成审批，不能重复审批。' });
    const result = await reviewResearchLedgerEntry({ ...input, reviewerId: ctx.user.id });
    if (result.userNotification) pushNotificationToUser(result.userNotification.userId, result.userNotification);
    return { success: true, status: input.decision };
  }),
});
