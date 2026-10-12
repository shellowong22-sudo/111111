import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  stockNceoWatchlistCollectionLayouts,
  stockNceoWatchlistCollections,
  stockNceoWatchlistItems,
  stockNceoWatchlistLayouts,
} from '../../drizzle/schema';
import { getDb } from '../db';
import { protectedProcedure, router } from '../_core/trpc';

const sourceBoundary = '股票／NCEO 观察池仅保存登录用户主动维护的研究偏好和模型描述；不代表券商账户、真实持仓、交易所成交、可执行委托或监管报送。';
const defaultCollectionName = '默认研究观察池';
const itemInput = z.object({
  itemType: z.enum(['stock', 'nceo_model']),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.^=-]{1,15}$/),
  displayName: z.string().trim().min(1).max(160),
  optionSide: z.enum(['call', 'put']).nullable().optional(),
  expiryDays: z.number().int().min(1).max(365).nullable().optional(),
  collectionId: z.number().int().positive().nullable().optional(),
});
const collectionInput = z.object({ name: z.string().trim().min(1).max(64), description: z.string().trim().max(160).nullable().optional() });
const columnsSchema = z.array(z.enum(['symbol', 'kind', 'modelStatus', 'sourceStatus', 'updatedAt'])).min(2).max(5).transform((values) => [...new Set(values)]);

function collectionCondition(collectionId: number | null) {
  return collectionId == null ? isNull(stockNceoWatchlistItems.collectionId) : eq(stockNceoWatchlistItems.collectionId, collectionId);
}

function sameItem(row: { itemType: 'stock' | 'nceo_model'; symbol: string; optionSide: 'call' | 'put' | null; expiryDays: number | null; collectionId: number | null }, input: z.infer<typeof itemInput>) {
  return row.itemType === input.itemType
    && row.symbol === input.symbol
    && row.collectionId === (input.collectionId ?? null)
    && (input.itemType === 'stock' || (row.optionSide === (input.optionSide ?? 'call') && row.expiryDays === (input.expiryDays ?? 30)));
}

export const stockNceoWatchlistRouter = router({
  getBoard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, items: [], collections: [], layout: null, collectionLayouts: [], sourceBoundary: '数据库当前不可用；不会以浏览器缓存伪造已保存的观察池或布局。' };
    const [items, collections, layouts, collectionLayouts] = await Promise.all([
      db.select().from(stockNceoWatchlistItems).where(eq(stockNceoWatchlistItems.userId, ctx.user.id)).orderBy(asc(stockNceoWatchlistItems.displayOrder), asc(stockNceoWatchlistItems.id)).limit(64),
      db.select().from(stockNceoWatchlistCollections).where(eq(stockNceoWatchlistCollections.userId, ctx.user.id)).orderBy(asc(stockNceoWatchlistCollections.name)).limit(24),
      db.select().from(stockNceoWatchlistLayouts).where(eq(stockNceoWatchlistLayouts.userId, ctx.user.id)).limit(1),
      db.select().from(stockNceoWatchlistCollectionLayouts).where(eq(stockNceoWatchlistCollectionLayouts.userId, ctx.user.id)).limit(24),
    ]);
    return { status: 'available' as const, items, collections, layout: layouts[0] ?? null, collectionLayouts, defaultCollectionName, sourceBoundary };
  }),

  createCollection: protectedProcedure.input(collectionInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, collectionId: null, sourceBoundary: '数据库当前不可用；未创建研究观察池。' };
    const existing = await db.select({ id: stockNceoWatchlistCollections.id }).from(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.userId, ctx.user.id), eq(stockNceoWatchlistCollections.name, input.name))).limit(1);
    if (existing[0]) return { status: 'existing' as const, collectionId: existing[0].id, sourceBoundary };
    const now = new Date();
    const write = await db.insert(stockNceoWatchlistCollections).values({ userId: ctx.user.id, name: input.name, description: input.description ?? null, createdAt: now, updatedAt: now });
    return { status: 'available' as const, collectionId: Number((write as unknown as { insertId?: number }).insertId ?? 0) || null, sourceBoundary };
  }),

  renameCollection: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(64), description: z.string().trim().max(160).nullable().optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未重命名研究观察池。' };
    const [owned, duplicate] = await Promise.all([
      db.select({ id: stockNceoWatchlistCollections.id }).from(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.id, input.id), eq(stockNceoWatchlistCollections.userId, ctx.user.id))).limit(1),
      db.select({ id: stockNceoWatchlistCollections.id }).from(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.userId, ctx.user.id), eq(stockNceoWatchlistCollections.name, input.name))).limit(1),
    ]);
    if (!owned[0]) return { status: 'missing' as const, sourceBoundary };
    if (duplicate[0] && duplicate[0].id !== input.id) return { status: 'existing' as const, sourceBoundary: '当前登录用户已有同名研究观察池；未重命名。' };
    await db.update(stockNceoWatchlistCollections).set({ name: input.name, description: input.description ?? null, updatedAt: new Date() }).where(and(eq(stockNceoWatchlistCollections.id, input.id), eq(stockNceoWatchlistCollections.userId, ctx.user.id)));
    return { status: 'available' as const, sourceBoundary };
  }),

  deleteCollection: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未删除研究观察池。' };
    const owned = await db.select({ id: stockNceoWatchlistCollections.id }).from(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.id, input.id), eq(stockNceoWatchlistCollections.userId, ctx.user.id))).limit(1);
    if (!owned[0]) return { status: 'missing' as const, sourceBoundary };
    const now = new Date();
    await db.update(stockNceoWatchlistItems).set({ collectionId: null, updatedAt: now }).where(and(eq(stockNceoWatchlistItems.userId, ctx.user.id), eq(stockNceoWatchlistItems.collectionId, input.id)));
    await db.delete(stockNceoWatchlistCollectionLayouts).where(and(eq(stockNceoWatchlistCollectionLayouts.userId, ctx.user.id), eq(stockNceoWatchlistCollectionLayouts.collectionId, input.id)));
    await db.delete(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.id, input.id), eq(stockNceoWatchlistCollections.userId, ctx.user.id)));
    return { status: 'available' as const, sourceBoundary };
  }),

  addItem: protectedProcedure.input(itemInput).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, itemId: null, sourceBoundary: '数据库当前不可用；未保存观察条目，也未替换为本地伪持久化。' };
    const collectionId = input.collectionId ?? null;
    if (collectionId != null) {
      const collection = await db.select({ id: stockNceoWatchlistCollections.id }).from(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.id, collectionId), eq(stockNceoWatchlistCollections.userId, ctx.user.id))).limit(1);
      if (!collection[0]) return { status: 'missing_collection' as const, itemId: null, sourceBoundary: '目标研究观察池不存在或不属于当前登录用户；未保存条目。' };
    }
    const existingItems = await db.select({ id: stockNceoWatchlistItems.id, itemType: stockNceoWatchlistItems.itemType, symbol: stockNceoWatchlistItems.symbol, optionSide: stockNceoWatchlistItems.optionSide, expiryDays: stockNceoWatchlistItems.expiryDays, collectionId: stockNceoWatchlistItems.collectionId, displayOrder: stockNceoWatchlistItems.displayOrder }).from(stockNceoWatchlistItems).where(eq(stockNceoWatchlistItems.userId, ctx.user.id)).limit(64);
    const existing = existingItems.find((row) => sameItem(row, { ...input, collectionId }));
    if (existing) return { status: 'existing' as const, itemId: existing.id, sourceBoundary };
    const currentItems = existingItems.filter((row) => row.collectionId === collectionId);
    const maxOrder = currentItems.length ? Math.max(...currentItems.map((row) => row.displayOrder)) : -1;
    const now = new Date();
    const itemKey = `${collectionId ?? 'default'}:${input.itemType}:${input.symbol}:${input.optionSide ?? 'na'}:${input.expiryDays ?? 'na'}`;
    const write = await db.insert(stockNceoWatchlistItems).values({ userId: ctx.user.id, collectionId, itemKey, itemType: input.itemType, symbol: input.symbol, displayName: input.displayName, optionSide: input.optionSide ?? null, expiryDays: input.expiryDays ?? null, displayOrder: maxOrder + 1, metadata: { basis: 'user-selected research observation only', createdFrom: input.itemType === 'stock' ? 'stock cockpit' : 'NCEO model cockpit' }, createdAt: now, updatedAt: now });
    return { status: 'available' as const, itemId: Number((write as unknown as { insertId?: number }).insertId ?? 0) || null, sourceBoundary };
  }),

  removeItem: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未移除观察条目。' };
    const write = await db.delete(stockNceoWatchlistItems).where(and(eq(stockNceoWatchlistItems.id, input.id), eq(stockNceoWatchlistItems.userId, ctx.user.id)));
    const removed = Number((write as unknown as { affectedRows?: number }).affectedRows ?? 0) > 0;
    return { status: removed ? 'available' as const : 'missing' as const, sourceBoundary };
  }),

  reorderItems: protectedProcedure.input(z.object({ collectionId: z.number().int().positive().nullable(), itemIds: z.array(z.number().int().positive()).min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未保存观察条目顺序。' };
    const rows = await db.select({ id: stockNceoWatchlistItems.id }).from(stockNceoWatchlistItems).where(and(eq(stockNceoWatchlistItems.userId, ctx.user.id), collectionCondition(input.collectionId))).limit(64);
    const matches = rows.filter((row) => input.itemIds.includes(row.id));
    if (matches.length !== input.itemIds.length) return { status: 'invalid' as const, sourceBoundary: '观察池顺序包含不存在、非当前用户或不属于当前观察池的条目；未保存。' };
    const now = new Date();
    await Promise.all(input.itemIds.map((id, displayOrder) => db.update(stockNceoWatchlistItems).set({ displayOrder, updatedAt: now }).where(and(eq(stockNceoWatchlistItems.id, id), eq(stockNceoWatchlistItems.userId, ctx.user.id), collectionCondition(input.collectionId)))));
    return { status: 'available' as const, sourceBoundary };
  }),

  saveLayout: protectedProcedure.input(z.object({ collectionId: z.number().int().positive().nullable(), gridColumns: z.enum(['1', '2', '3', '4']), visibleColumns: columnsSchema, layoutName: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { status: 'unavailable' as const, sourceBoundary: '数据库当前不可用；未保存观察屏风布局。' };
    const now = new Date();
    if (input.collectionId == null) {
      const existing = await db.select({ id: stockNceoWatchlistLayouts.id }).from(stockNceoWatchlistLayouts).where(eq(stockNceoWatchlistLayouts.userId, ctx.user.id)).limit(1);
      if (existing[0]) await db.update(stockNceoWatchlistLayouts).set({ gridColumns: input.gridColumns, visibleColumns: input.visibleColumns, layoutName: input.layoutName, updatedAt: now }).where(and(eq(stockNceoWatchlistLayouts.id, existing[0].id), eq(stockNceoWatchlistLayouts.userId, ctx.user.id)));
      else await db.insert(stockNceoWatchlistLayouts).values({ userId: ctx.user.id, gridColumns: input.gridColumns, visibleColumns: input.visibleColumns, layoutName: input.layoutName, createdAt: now, updatedAt: now });
      return { status: 'available' as const, sourceBoundary };
    }
    const collection = await db.select({ id: stockNceoWatchlistCollections.id }).from(stockNceoWatchlistCollections).where(and(eq(stockNceoWatchlistCollections.id, input.collectionId), eq(stockNceoWatchlistCollections.userId, ctx.user.id))).limit(1);
    if (!collection[0]) return { status: 'missing' as const, sourceBoundary: '目标研究观察池不存在或不属于当前登录用户；未保存布局。' };
    const existing = await db.select({ id: stockNceoWatchlistCollectionLayouts.id }).from(stockNceoWatchlistCollectionLayouts).where(and(eq(stockNceoWatchlistCollectionLayouts.userId, ctx.user.id), eq(stockNceoWatchlistCollectionLayouts.collectionId, input.collectionId))).limit(1);
    if (existing[0]) await db.update(stockNceoWatchlistCollectionLayouts).set({ gridColumns: input.gridColumns, visibleColumns: input.visibleColumns, layoutName: input.layoutName, updatedAt: now }).where(and(eq(stockNceoWatchlistCollectionLayouts.id, existing[0].id), eq(stockNceoWatchlistCollectionLayouts.userId, ctx.user.id)));
    else await db.insert(stockNceoWatchlistCollectionLayouts).values({ userId: ctx.user.id, collectionId: input.collectionId, gridColumns: input.gridColumns, visibleColumns: input.visibleColumns, layoutName: input.layoutName, createdAt: now, updatedAt: now });
    return { status: 'available' as const, sourceBoundary };
  }),
});
