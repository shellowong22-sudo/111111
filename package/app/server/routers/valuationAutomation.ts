import { parse as parseCookie } from 'cookie';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { COOKIE_NAME } from '../../shared/const';
import { createHeartbeatJob, updateHeartbeatJob } from '../_core/heartbeat';
import { protectedProcedure, router } from '../_core/trpc';
import { VALUATION_AUTOMATION_PRODUCTS, getValuationAutomationStatus, runValuationAutomation, saveValuationAutomationSettings, setValuationAutomationTask } from '../valuationAutomationDb';

function validField(value: string, minimum: number, maximum: number) { return value.split(',').every((part) => { const [base, step] = part.split('/'); if (part.split('/').length > 2 || (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1 || Number(step) > maximum - minimum + 1))) return false; if (base === '*') return true; const range = base.match(/^(\d+)(?:-(\d+))?$/); if (!range) return false; const start = Number(range[1]); const end = range[2] === undefined ? start : Number(range[2]); return start >= minimum && end <= maximum && start <= end; }); }
export function isValidValuationAutomationCron(value: string) { const parts = value.trim().split(/\s+/); return parts.length === 6 && [[0, 59], [0, 59], [0, 23], [1, 31], [1, 12], [0, 7]].every(([minimum, maximum], index) => validField(parts[index] ?? '', minimum, maximum)); }
const cronExpression = z.string().trim().max(64).refine(isValidValuationAutomationCron, 'Cron 必须是语法有效的 6 个 UTC 字段。');
const settingsInput = z.object({ productId: z.enum(VALUATION_AUTOMATION_PRODUCTS), notional: z.number().finite().positive().max(10_000_000_000), couponRate: z.number().finite().min(0).max(0.25), frequency: z.union([z.literal(1), z.literal(2)]), cronExpression });

export const valuationAutomationRouter = router({
  getStatus: protectedProcedure.query(({ ctx }) => getValuationAutomationStatus(ctx.user.id)),
  saveSettings: protectedProcedure.input(settingsInput).mutation(async ({ ctx, input }) => {
    const current = await getValuationAutomationStatus(ctx.user.id);
    if (process.env.NODE_ENV === 'production' && current.setting.isEnabled && current.setting.scheduleCronTaskUid) {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
      await updateHeartbeatJob(current.setting.scheduleCronTaskUid, { cron: input.cronExpression, path: '/api/scheduled/valuationAutomation', payload: {}, description: `账户私有 FRED 国债曲线固定票息估值更新：${input.productId}` }, sessionToken);
    }
    return saveValuationAutomationSettings(ctx.user.id, input);
  }),
  refreshNow: protectedProcedure.mutation(({ ctx }) => runValuationAutomation(ctx.user.id, 'manual')),
  setScheduleEnabled: protectedProcedure.input(z.object({ enable: z.boolean() })).mutation(async ({ ctx, input }) => {
    if (process.env.NODE_ENV !== 'production') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '周期任务只能在站点部署后启用；开发预览不会创建不可达任务。' });
    const status = await getValuationAutomationStatus(ctx.user.id);
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? '')[COOKIE_NAME] ?? '';
    const description = `账户私有 FRED 国债曲线固定票息估值更新：${status.setting.productId}`;
    if (!status.setting.scheduleCronTaskUid) {
      if (!input.enable) return setValuationAutomationTask(ctx.user.id, null, false);
      const job = await createHeartbeatJob({ name: `valuation-automation-${ctx.user.id}`, cron: status.setting.cronExpression, path: '/api/scheduled/valuationAutomation', payload: {}, description }, sessionToken);
      return setValuationAutomationTask(ctx.user.id, job.taskUid, true);
    }
    await updateHeartbeatJob(status.setting.scheduleCronTaskUid, { cron: status.setting.cronExpression, enable: input.enable, path: '/api/scheduled/valuationAutomation', payload: {}, description }, sessionToken);
    return setValuationAutomationTask(ctx.user.id, status.setting.scheduleCronTaskUid, input.enable);
  }),
});
