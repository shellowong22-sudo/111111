import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from '../_core/trpc';
import { getTerminalSecurityAdminSummary, getTerminalWatermarkConfig, recordTerminalSecurityEvent, terminalSecurityEventTypes, updateTerminalWatermarkConfig } from '../terminalSecurityDb';

export const terminalSecurityRouter = router({
  recordDeterrenceEvent: protectedProcedure.input(z.object({ eventType: z.enum(terminalSecurityEventTypes), routePath: z.string().trim().min(1).max(255) })).mutation(({ ctx, input }) => recordTerminalSecurityEvent(ctx.user.id, input.eventType, input.routePath)),
  watermarkConfig: protectedProcedure.query(() => getTerminalWatermarkConfig()),
  adminWatermarkConfig: adminProcedure.query(() => getTerminalWatermarkConfig()),
  updateWatermarkConfig: adminProcedure.input(z.object({ isEnabled: z.boolean(), opacityPercent: z.number().int().min(15).max(70) })).mutation(({ ctx, input }) => updateTerminalWatermarkConfig(ctx.user.id, input)),
  adminSummary: adminProcedure.query(() => getTerminalSecurityAdminSummary()),
});
