import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { addCommsThreadMember, batchSetCommsReminderRules, createCommsThread, createCommsThreadVersion, getCommsThreadDetail, getCommsWorkload, getCommsWorkloadTrend, listCommsMemberDirectory, listCommsReminderEventHistory, listCommsReminderEvents, listCommsReminderRules, listCommsThreadVersions, listCommsThreads, postCommsThreadMessage, reviewCommsThreadVersion, saveCommsReminderRule, updateCommsThreadDue, updateCommsThreadStatus } from '../commsResearchDb';

const purpose = z.enum(['brief', 'question', 'handoff', 'decision']);
const status = z.enum(['open', 'acknowledged', 'resolved']);
const messageType = z.enum(['note', 'question', 'decision']);

function mapCommsError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'COMMS_UNAVAILABLE';
  if (message === 'COMMS_THREAD_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '研究分派不存在或当前账户无访问权限。' });
  if (message.startsWith('FORBIDDEN_COMMS')) throw new TRPCError({ code: 'FORBIDDEN', message: '当前账户没有执行此协作操作的权限。' });
  if (message === 'COMMS_MEMBER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到目标成员。' });
  if (message === 'COMMS_OWNER_ALREADY_HAS_ACCESS') throw new TRPCError({ code: 'BAD_REQUEST', message: '创建者已具备完整访问权限。' });
  if (message === 'COMMS_REMINDER_NEEDS_DUE_DATE') throw new TRPCError({ code: 'BAD_REQUEST', message: '请先为研究分派设置到期时间，再启用提醒。' });
  if (message === 'COMMS_REMINDER_RULES_REQUIRED') throw new TRPCError({ code: 'BAD_REQUEST', message: '请选择至少一条当前账户拥有的提醒规则。' });
  if (message === 'COMMS_VERSION_REQUIRES_RESOLVED') throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已解决的研究分派可以提交版本摘要。' });
  if (message === 'COMMS_VERSION_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到版本摘要或当前账户无访问权限。' });
  if (message === 'COMMS_VERSION_OWNER_CANNOT_REVIEW') throw new TRPCError({ code: 'FORBIDDEN', message: '分派创建者不能确认自己的版本摘要。' });
  if (message === 'COMMS_VERSION_NOT_REVIEWABLE') throw new TRPCError({ code: 'BAD_REQUEST', message: '当前版本不处于可审阅状态。' });
  throw error;
}

export const commsResearchRouter = router({
  memberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80).default(''), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => listCommsMemberDirectory(ctx.user.id, input.query, input.limit)),
  listThreads: protectedProcedure.input(z.object({ status: status.or(z.literal('all')).default('all'), purpose: purpose.or(z.literal('all')).default('all'), query: z.string().trim().max(180).default('') })).query(({ ctx, input }) => listCommsThreads(ctx.user.id, input)),
  getThread: protectedProcedure.input(z.object({ threadId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getCommsThreadDetail(ctx.user.id, input.threadId); } catch (error) { return mapCommsError(error); } }),
  createThread: protectedProcedure.input(z.object({ title: z.string().trim().min(2).max(180), purpose, moduleCode: z.string().trim().min(2).max(32).default('COMMS'), classification: z.enum(['internal', 'restricted']).default('internal'), dueAt: z.date().nullable().optional(), leadHours: z.union([z.literal(24), z.literal(48), z.literal(72)]).default(24), reminderActive: z.boolean().default(true), initialBody: z.string().trim().min(2).max(12_000), memberIds: z.array(z.number().int().positive()).max(20).default([]) })).mutation(async ({ ctx, input }) => { try { return await createCommsThread(ctx.user.id, { ...input, dueAt: input.dueAt ?? null }); } catch (error) { return mapCommsError(error); } }),
  addMember: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), userId: z.number().int().positive(), permission: z.enum(['viewer', 'contributor']) })).mutation(async ({ ctx, input }) => { try { return await addCommsThreadMember(ctx.user.id, input.threadId, input.userId, input.permission); } catch (error) { return mapCommsError(error); } }),
  postMessage: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), body: z.string().trim().min(1).max(12_000), messageType })).mutation(async ({ ctx, input }) => { try { return await postCommsThreadMessage(ctx.user.id, input); } catch (error) { return mapCommsError(error); } }),
  updateStatus: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), status })).mutation(async ({ ctx, input }) => { try { return await updateCommsThreadStatus(ctx.user.id, input.threadId, input.status); } catch (error) { return mapCommsError(error); } }),
  updateDue: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), dueAt: z.date().nullable() })).mutation(async ({ ctx, input }) => { try { return await updateCommsThreadDue(ctx.user.id, input.threadId, input.dueAt); } catch (error) { return mapCommsError(error); } }),
  saveReminderRule: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), leadHours: z.union([z.literal(24), z.literal(48), z.literal(72)]), isActive: z.boolean() })).mutation(async ({ ctx, input }) => { try { return await saveCommsReminderRule(ctx.user.id, input); } catch (error) { return mapCommsError(error); } }),
  listReminderEvents: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(120).default(40) })).query(({ ctx, input }) => listCommsReminderEvents(ctx.user.id, input.limit)),
  listReminderRules: protectedProcedure.input(z.object({ state: z.enum(['all', 'active', 'paused']).default('all'), query: z.string().trim().max(180).default('') })).query(({ ctx, input }) => listCommsReminderRules(ctx.user.id, input)),
  batchSetReminderRules: protectedProcedure.input(z.object({ ruleIds: z.array(z.number().int().positive()).min(1).max(100), isActive: z.boolean() })).mutation(async ({ ctx, input }) => { try { return await batchSetCommsReminderRules(ctx.user.id, input); } catch (error) { return mapCommsError(error); } }),
  listReminderHistory: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(120).default(60), threadId: z.number().int().positive().nullable().optional(), status: status.or(z.literal('all')).default('all'), from: z.date().nullable().optional(), to: z.date().nullable().optional() })).query(({ ctx, input }) => listCommsReminderEventHistory(ctx.user.id, input)),
  createVersion: protectedProcedure.input(z.object({ threadId: z.number().int().positive(), summary: z.string().trim().min(4).max(12_000) })).mutation(async ({ ctx, input }) => { try { return await createCommsThreadVersion(ctx.user.id, input); } catch (error) { return mapCommsError(error); } }),
  listVersions: protectedProcedure.input(z.object({ threadId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listCommsThreadVersions(ctx.user.id, input.threadId); } catch (error) { return mapCommsError(error); } }),
  reviewVersion: protectedProcedure.input(z.object({ versionId: z.number().int().positive(), decision: z.enum(['approved', 'changes_requested']), note: z.string().trim().max(1000).default('') })).mutation(async ({ ctx, input }) => { try { return await reviewCommsThreadVersion(ctx.user.id, input); } catch (error) { return mapCommsError(error); } }),
  getWorkload: protectedProcedure.query(({ ctx }) => getCommsWorkload(ctx.user.id)),
  getWorkloadTrend: protectedProcedure.input(z.object({ from: z.date(), to: z.date() }).refine((value) => value.to.getTime() >= value.from.getTime() && value.to.getTime() - value.from.getTime() <= 366 * 86_400_000, { message: '日期区间必须介于 0 至 366 天。' })).query(({ ctx, input }) => getCommsWorkloadTrend(ctx.user.id, input)),
});
