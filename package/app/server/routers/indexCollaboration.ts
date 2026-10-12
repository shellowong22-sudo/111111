import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure, router } from '../_core/trpc';
import { listIndexBasketAudit, listIndexBasketShares, listIndexBaskets, listPublicIndexConstituentArchive, revokeIndexBasketShare, saveIndexBasket, saveIndexBasketShare, searchIndexBasketMembers } from '../indexCollaborationDb';
import { getIndexEventWeightImpact, importOfficialIndexWeights, listOfficialIndexWeightImports } from '../indexWeightImportDb';

const componentSchema = z.object({ ticker: z.string().trim().min(1).max(20), name: z.string().trim().min(1).max(240), weight: z.number().positive().max(100) });
const basketSchema = z.object({ basketId: z.number().int().positive().optional(), moduleId: z.string().trim().min(1).max(32).default('CIXB'), name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).nullable().optional(), components: z.array(componentSchema).min(1).max(80) });
const officialWeightImportSchema = z.object({ indexId: z.string().trim().min(1).max(64).default('NASDAQ-100'), sourceLabel: z.string().trim().min(2).max(160), sourceUrl: z.string().trim().url().max(1000), sourceDate: z.string().date(), sourceFilename: z.string().trim().min(1).max(240), rows: z.array(z.object({ ticker: z.string().trim().min(1).max(20), name: z.string().trim().min(1).max(240), weightPct: z.number().finite().positive().max(100) })).min(1).max(500) });

function mapError(error: unknown): never {
  if (!(error instanceof Error)) throw error; const message = error.message;
  if (message === 'INDEX_BASKET_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '指数篮子不存在或已无权访问。' });
  if (message.startsWith('FORBIDDEN_INDEX_BASKET_')) throw new TRPCError({ code: 'FORBIDDEN', message: message.endsWith('SHARE') ? '仅篮子所有者可以管理共享权限。' : '您没有访问或编辑该指数篮子的权限。' });
  if (message === 'INDEX_BASKET_COMPONENTS_INVALID') throw new TRPCError({ code: 'BAD_REQUEST', message: '每个成分必须有有效代码、名称和 0–100 的正权重。' });
  if (message === 'INDEX_BASKET_COMPONENT_DUPLICATE') throw new TRPCError({ code: 'BAD_REQUEST', message: '篮子中不能重复使用同一代码。' });
  if (message === 'INDEX_BASKET_WEIGHTS_NOT_100') throw new TRPCError({ code: 'BAD_REQUEST', message: '篮子成分权重合计必须为 100%。' });
  if (message === 'INDEX_BASKET_NAME_REQUIRED') throw new TRPCError({ code: 'BAD_REQUEST', message: '请填写篮子名称。' });
  if (message === 'CANNOT_SHARE_INDEX_BASKET_WITH_OWNER') throw new TRPCError({ code: 'BAD_REQUEST', message: '所有者已拥有完整权限，无需重复授权。' });
  if (message === 'INDEX_BASKET_MEMBER_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '未找到可授权的团队成员。' });
  if (message === 'INDEX_EVENT_NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND', message: '该指数成分变更事件不存在。' });
  if (message === 'INDEX_WEIGHT_SOURCE_URL_INVALID') throw new TRPCError({ code: 'BAD_REQUEST', message: '请填写有效的官方 HTTPS 来源地址。' });
  if (message === 'INDEX_WEIGHT_SOURCE_NOT_OFFICIAL') throw new TRPCError({ code: 'BAD_REQUEST', message: '权重表来源必须为 Nasdaq 或 Nasdaq Global Indexes 官方地址。' });
  if (message === 'INDEX_WEIGHT_SOURCE_DATE_INVALID') throw new TRPCError({ code: 'BAD_REQUEST', message: '请填写官方权重表对应的有效日期。' });
  if (message === 'INDEX_WEIGHT_ROWS_INVALID') throw new TRPCError({ code: 'BAD_REQUEST', message: 'CSV 必须包含有效且不重复的 ticker、name、weightPct 行。' });
  if (message === 'INDEX_WEIGHT_TICKER_DUPLICATE') throw new TRPCError({ code: 'BAD_REQUEST', message: '官方权重表中不能出现重复代码。' });
  if (message === 'INDEX_WEIGHT_TOTAL_INVALID') throw new TRPCError({ code: 'BAD_REQUEST', message: '官方权重表的 weightPct 合计必须在 99.95% 至 100.05% 之间。' });
  if (message === 'INDEX_WEIGHT_IMPORT_METADATA_REQUIRED') throw new TRPCError({ code: 'BAD_REQUEST', message: '请填写指数、来源名称和原始文件名。' });
  if (message === 'INDEX_WEIGHT_IMPORT_DUPLICATE') throw new TRPCError({ code: 'CONFLICT', message: '该账户已导入完全相同的官方权重表。' });
  throw error;
}

export const indexCollaborationRouter = router({
  getConstituentArchive: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(12) }).default({ limit: 12 })).query(({ input }) => listPublicIndexConstituentArchive(input.limit)),
  memberDirectory: protectedProcedure.input(z.object({ query: z.string().trim().max(80), limit: z.number().int().min(1).max(30).default(12) })).query(({ ctx, input }) => searchIndexBasketMembers(ctx.user.id, input.query, input.limit)),
  listBaskets: protectedProcedure.query(({ ctx }) => listIndexBaskets(ctx.user.id)),
  saveBasket: protectedProcedure.input(basketSchema).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveIndexBasket(ctx.user.id, input)) }; } catch (error) { return mapError(error); } }),
  listBasketShares: protectedProcedure.input(z.object({ basketId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await listIndexBasketShares(ctx.user.id, input.basketId); } catch (error) { return mapError(error); } }),
  shareBasket: protectedProcedure.input(z.object({ basketId: z.number().int().positive(), sharedWithUserId: z.number().int().positive(), permission: z.enum(['viewer', 'editor']) })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await saveIndexBasketShare(ctx.user.id, input)) }; } catch (error) { return mapError(error); } }),
  revokeBasketShare: protectedProcedure.input(z.object({ basketId: z.number().int().positive(), sharedWithUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await revokeIndexBasketShare(ctx.user.id, input.basketId, input.sharedWithUserId)) }; } catch (error) { return mapError(error); } }),
  listBasketAudit: protectedProcedure.input(z.object({ basketId: z.number().int().positive(), limit: z.number().int().min(1).max(100).default(60) })).query(async ({ ctx, input }) => { try { return await listIndexBasketAudit(ctx.user.id, input.basketId, input.limit); } catch (error) { return mapError(error); } }),
  listOfficialWeightImports: protectedProcedure.input(z.object({ indexId: z.string().trim().min(1).max(64).default('NASDAQ-100') }).default({ indexId: 'NASDAQ-100' })).query(({ ctx, input }) => listOfficialIndexWeightImports(ctx.user.id, input.indexId)),
  importOfficialWeights: protectedProcedure.input(officialWeightImportSchema).mutation(async ({ ctx, input }) => { try { return { success: true, ...(await importOfficialIndexWeights(ctx.user.id, input)) }; } catch (error) { return mapError(error); } }),
  getEventWeightImpact: protectedProcedure.input(z.object({ eventId: z.number().int().positive() })).query(async ({ ctx, input }) => { try { return await getIndexEventWeightImpact(ctx.user.id, input.eventId); } catch (error) { return mapError(error); } }),
});
