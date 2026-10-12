import { z } from 'zod';
import { adminProcedure, router } from '../_core/trpc';
import { getAdminSecurityOverview, listAdminSecurityAudits, listManagedUsersForSecurity, securelyChangeManagedRole, writeAdminSecurityAudit } from '../adminSecurityDb';

const reason = z.string().trim().min(8, '请填写至少 8 个字符的操作原因。').max(500);
export const adminSecurityRouter = router({
  overview: adminProcedure.query(() => getAdminSecurityOverview()),
  listManagedUsers: adminProcedure.query(() => listManagedUsersForSecurity()),
  listAudits: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(30) })).query(({ input }) => listAdminSecurityAudits(input.limit)),
  recordSecurityReview: adminProcedure.input(z.object({ reason })).mutation(async ({ ctx, input }) => { await writeAdminSecurityAudit({ actorUserId: ctx.user.id, action: 'security_review', result: 'allowed', reason: input.reason, metadata: { scope: 'admin_console' } }); return { success: true }; }),
  changeManagedRole: adminProcedure.input(z.object({ targetUserId: z.number().int().positive(), role: z.enum(['admin', 'user', 'trader', 'risk_manager']), confirmation: z.literal('CHANGE_ROLE'), reason })).mutation(({ ctx, input }) => securelyChangeManagedRole(ctx.user.id, input)),
});
