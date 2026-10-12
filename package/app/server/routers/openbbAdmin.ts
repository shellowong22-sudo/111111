import { z } from 'zod';
import { adminProcedure, protectedProcedure, router } from '../_core/trpc';
import { ackOpenBBPush, cancelOpenBBJob, getOpenBBDashboard, pushOpenBBJob, retryOpenBBJob, startOpenBBJob } from '../openbbAdminService';
import { getOpenBBPriorityAWorkspace, pushOpenBBResult, refreshOpenBBPriorityARuntime, retryOpenBBQuery, runOpenBBQuery } from '../openbbPriorityAService';
import { getAkShareCatalog, getAkShareProviderStatus } from '../akshareMarketData';
import { MANAGED_PUBLIC_DATASETS, syncFinceptDatasets, syncManagedPublicDataset } from '../adminPublicDatasetIngestion';

const queryParams = z.record(z.string(), z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()])).default({});
export const openbbAdminRouter = router({
  dashboard: adminProcedure.query(({ctx}) => getOpenBBDashboard(ctx.user.id)),
  akshareCatalog: adminProcedure.query(() => getAkShareCatalog()),
  akshareStatus: adminProcedure.query(() => getAkShareProviderStatus()),
  akshareSyncAll: adminProcedure.mutation(async ({ ctx }) => {
    const datasets = MANAGED_PUBLIC_DATASETS.filter(item => item.id.startsWith('akshare-'));
    const results = [];
    for (const dataset of datasets) {
      try {
        results.push(await syncManagedPublicDataset(dataset.id, ctx.user.id));
      } catch (error) {
        results.push({
          id: dataset.id,
          status: 'failed' as const,
          reason: error instanceof Error ? error.message : String(error),
          archive: null,
        });
      }
    }
    return {
      completedAt: new Date().toISOString(),
      requested: datasets.length,
      succeeded: results.filter(item => item.status === 'available').length,
      failed: results.filter(item => item.status === 'failed' || item.status === 'unavailable').length,
      results,
    };
  }),
  finceptSyncAll: adminProcedure
    .input(z.object({ scope: z.enum(["fincept", "archive_backed"]).default("archive_backed") }).optional())
    .mutation(({ ctx, input }) => syncFinceptDatasets(ctx.user.id, input?.scope ?? "archive_backed")),
 priorityA: adminProcedure.query(({ctx}) => getOpenBBPriorityAWorkspace(ctx.user.id)),
 refreshRuntime: adminProcedure.mutation(() => refreshOpenBBPriorityARuntime()),
 query: adminProcedure.input(z.object({endpointId:z.string().min(1).max(260),catalogOperationId:z.string().min(1).max(240).optional(),params:queryParams,requestBody:z.unknown().optional()})).mutation(({ctx,input}) => runOpenBBQuery({...input,actorUserId:ctx.user.id})),
 retryQuery: adminProcedure.input(z.object({runId:z.string().regex(/^obbrun_[a-f0-9]{32}$/)})).mutation(({ctx,input}) => retryOpenBBQuery(input.runId,ctx.user.id)),
 pushResult: adminProcedure.input(z.object({runId:z.string().regex(/^obbrun_[a-f0-9]{32}$/),moduleIds:z.array(z.string()).min(1).max(140),recipientUserIds:z.array(z.number().int().positive()).min(1).max(200)})).mutation(({ctx,input}) => pushOpenBBResult({...input,actorUserId:ctx.user.id,operator:ctx.user.name||ctx.user.email||('管理员#'+ctx.user.id)})),
 start: adminProcedure.mutation(({ctx}) => startOpenBBJob(ctx.user.id)),
 cancel: adminProcedure.input(z.object({jobId:z.string()})).mutation(({input}) => cancelOpenBBJob(input.jobId)),
 retry: adminProcedure.input(z.object({jobId:z.string()})).mutation(({ctx,input}) => retryOpenBBJob(input.jobId,ctx.user.id)),
 push: adminProcedure.input(z.object({jobId:z.string(),moduleIds:z.array(z.string()).min(1).max(140),recipientUserIds:z.array(z.number().int().positive()).min(1).max(200)})).mutation(({ctx,input}) => pushOpenBBJob({...input,actorUserId:ctx.user.id,operator:ctx.user.name||ctx.user.email||('管理员#'+ctx.user.id)})),
 acknowledge: protectedProcedure.input(z.object({jobId:z.string(),pushId:z.string(),status:z.enum(['received','applied','failed']),receivedAt:z.string(),appliedAt:z.string().optional()})).mutation(({input}) => ackOpenBBPush(input)),
});
