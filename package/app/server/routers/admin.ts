/**
 * 后台管理系统路由 - 仅管理员可访问
 * 与用户前台严格分离的独立管理 API
 */
import { adminProcedure, router } from '../_core/trpc';
import { z } from 'zod';
import { adminListChecklistExportRecords, getDb } from '../db';
import { users } from '../../drizzle/schema';
import { eq, like, or, sql, desc, count } from 'drizzle-orm';
import { writeAdminSecurityAudit } from '../adminSecurityDb';

const marketDataColumnMap = {
  symbol: 'symbol',
  name: 'name',
  market: 'market',
  price: 'price',
  changeVal: 'change_val',
  changePct: 'change_pct',
  volume: 'volume',
} as const;

export function getMarketDataAssignments(fields: Record<string, unknown>) {
  return Object.entries(fields)
    .filter(([key, value]) => value !== undefined && key in marketDataColumnMap)
    .map(([key, value]) => ({
      column: marketDataColumnMap[key as keyof typeof marketDataColumnMap],
      value,
    }));
}

export const adminRouter = router({
  listChecklistExportRecords: adminProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(30), userId: z.number().int().positive().optional(), moduleId: z.string().trim().min(2).max(32).optional(), exportFormat: z.enum(['csv', 'pdf']).optional(), dateFrom: z.string().date().optional(), dateTo: z.string().date().optional() })).query(async ({ input }) => {
    const dateFrom = input.dateFrom ? new Date(`${input.dateFrom}T00:00:00.000Z`) : undefined;
    const dateTo = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999Z`) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('起始日期不能晚于结束日期。');
    const result = await adminListChecklistExportRecords({ userId: input.userId, moduleId: input.moduleId, exportFormat: input.exportFormat, dateFrom, dateTo }, input.pageSize, (input.page - 1) * input.pageSize);
    return { ...result, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(Number(result.total) / input.pageSize)) };
  }),

  exportChecklistExportRecords: adminProcedure.input(z.object({ userId: z.number().int().positive().optional(), moduleId: z.string().trim().min(2).max(32).optional(), exportFormat: z.enum(['csv', 'pdf']).optional(), dateFrom: z.string().date().optional(), dateTo: z.string().date().optional() })).mutation(async ({ input }) => {
    const dateFrom = input.dateFrom ? new Date(`${input.dateFrom}T00:00:00.000Z`) : undefined;
    const dateTo = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999Z`) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('起始日期不能晚于结束日期。');
    const result = await adminListChecklistExportRecords({ userId: input.userId, moduleId: input.moduleId, exportFormat: input.exportFormat, dateFrom, dateTo }, 5000, 0);
    return { data: result.data, total: Number(result.total), truncated: Number(result.total) > result.data.length };
  }),

  // ==================== 系统概览 ====================
  dashboard: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // 用户统计
    const [userStats] = await db.select({
      total: count(),
      admins: sql<number>`SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END)`,
    }).from(users);

    // 最近注册用户
    const recentUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    }).from(users).orderBy(desc(users.createdAt)).limit(5);

        // 市场数据统计
    const marketResult = await db.execute(sql`
      SELECT 
        COUNT(*) as totalProducts,
        COUNT(DISTINCT market) as marketTypes,
        SUM(CASE WHEN CAST(change_pct AS DECIMAL(10,4)) > 0 THEN 1 ELSE 0 END) as risers,
        SUM(CASE WHEN CAST(change_pct AS DECIMAL(10,4)) < 0 THEN 1 ELSE 0 END) as fallers
      FROM market_data
    `);
    const marketStats = (marketResult as any)[0]?.[0] || {};
    // 今日活跃用户（最近24小时登录）
    const activeResult = await db.execute(sql`
      SELECT COUNT(*) as activeToday 
      FROM users 
      WHERE lastSignedIn >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    const activeStats = (activeResult as any)[0]?.[0] || {};
    return {
      users: {
        total: userStats?.total || 0,
        admins: Number(userStats?.admins) || 0,
        activeToday: Number(activeStats?.activeToday) || 0,
      },
      market: {
        totalProducts: Number(marketStats?.totalProducts) || 0,
        marketTypes: Number(marketStats?.marketTypes) || 0,
        risers: Number(marketStats?.risers) || 0,
        fallers: Number(marketStats?.fallers) || 0,
      },
      recentUsers,
      serverInfo: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  }),

  // ==================== 用户管理 ====================
  listUsers: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      role: z.enum(['all', 'admin', 'user', 'trader', 'risk_manager']).default('all'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const offset = (input.page - 1) * input.pageSize;
      let conditions: any[] = [];

      if (input.search) {
        conditions.push(
          or(
            like(users.name, `%${input.search}%`),
            like(users.email, `%${input.search}%`),
            like(users.openId, `%${input.search}%`)
          )
        );
      }
      if (input.role !== 'all') {
        conditions.push(eq(users.role, input.role));
      }

      // Build query
      let query = db.select().from(users).orderBy(desc(users.createdAt)).limit(input.pageSize).offset(offset);
      let countQuery = db.select({ total: count() }).from(users);

      if (conditions.length > 0) {
        const where = conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`;
        query = query.where(where) as any;
        countQuery = countQuery.where(where) as any;
      }

      const [data, [totalResult]] = await Promise.all([query, countQuery]);

      return {
        data,
        total: totalResult?.total || 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((totalResult?.total || 0) / input.pageSize),
      };
    }),

  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      role: z.enum(['admin', 'user', 'trader', 'risk_manager']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      if (input.userId === ctx.user.id) { await writeAdminSecurityAudit({ actorUserId: ctx.user.id, targetUserId: input.userId, action: 'legacy_role_change', result: 'blocked', reason: '系统阻止自我角色变更' }); throw new Error('不得变更自己的角色。'); }
      const target = (await db.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target) throw new Error('目标用户不存在。');
      if (target.role === 'admin' && input.role !== 'admin') { const [admins] = await db.select({ count: count() }).from(users).where(eq(users.role, 'admin')); if (Number(admins?.count ?? 0) <= 1) { await writeAdminSecurityAudit({ actorUserId: ctx.user.id, targetUserId: input.userId, action: 'legacy_role_change', result: 'blocked', reason: '最后管理员保护' }); throw new Error('系统必须至少保留一位管理员。'); } }
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      await writeAdminSecurityAudit({ actorUserId: ctx.user.id, targetUserId: input.userId, action: 'legacy_role_change', result: 'allowed', reason: '遗留管理页面角色变更', metadata: { from: target.role, to: input.role } });
      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      if (input.userId === ctx.user.id) { await writeAdminSecurityAudit({ actorUserId: ctx.user.id, targetUserId: input.userId, action: 'legacy_user_delete', result: 'blocked', reason: '系统阻止自我删除' }); throw new Error('不得删除自己的账户。'); }
      const target = (await db.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target) throw new Error('目标用户不存在。');
      if (target.role === 'admin') { const [admins] = await db.select({ count: count() }).from(users).where(eq(users.role, 'admin')); if (Number(admins?.count ?? 0) <= 1) { await writeAdminSecurityAudit({ actorUserId: ctx.user.id, targetUserId: input.userId, action: 'legacy_user_delete', result: 'blocked', reason: '最后管理员保护' }); throw new Error('系统必须至少保留一位管理员。'); } }
      await db.delete(users).where(eq(users.id, input.userId));
      await writeAdminSecurityAudit({ actorUserId: ctx.user.id, targetUserId: input.userId, action: 'legacy_user_delete', result: 'allowed', reason: '遗留管理页面账户删除', metadata: { targetRole: target.role } });
      return { success: true };
    }),

  // ==================== 市场数据管理 ====================
  listMarketData: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      market: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const offset = (input.page - 1) * input.pageSize;
      let whereClause = sql`1=1`;

      if (input.search) {
        whereClause = sql`${whereClause} AND (symbol LIKE ${`%${input.search}%`} OR name LIKE ${`%${input.search}%`})`;
      }
      if (input.market) {
        whereClause = sql`${whereClause} AND market = ${input.market}`;
      }

      const [dataResult, countResult] = await Promise.all([
        db.execute(sql`SELECT * FROM market_data WHERE ${whereClause} ORDER BY updated_at DESC LIMIT ${input.pageSize} OFFSET ${offset}`),
        db.execute(sql`SELECT COUNT(*) as total FROM market_data WHERE ${whereClause}`),
      ]);

      // drizzle execute returns [rows, fields] format
      const rows = (dataResult as any)[0] || [];
      const countRows = (countResult as any)[0] || [];
      const total = Number(countRows[0]?.total) || 0;

      // Map snake_case DB columns to camelCase for frontend
      const data = rows.map((r: any) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        market: r.market,
        price: r.price,
        changeVal: r.change_val,
        changePct: r.change_pct,
        volume: r.volume,
        updatedAt: r.updated_at,
      }));

      return {
        data,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  createMarketData: adminProcedure
    .input(z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      market: z.enum(['stock', 'bond', 'forex', 'commodity', 'index', 'derivative', 'option', 'fund']),
      price: z.string().default('0'),
      changeVal: z.string().default('0'),
      changePct: z.string().default('0'),
      volume: z.string().default('0'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db.execute(sql`
        INSERT INTO market_data (symbol, name, market, price, change_val, change_pct, volume, updated_at)
        VALUES (${input.symbol}, ${input.name}, ${input.market}, ${input.price}, ${input.changeVal}, ${input.changePct}, ${input.volume}, NOW())
      `);
      return { success: true };
    }),

  updateMarketData: adminProcedure
    .input(z.object({
      id: z.number(),
      symbol: z.string().optional(),
      name: z.string().optional(),
      market: z.enum(['stock', 'bond', 'forex', 'commodity', 'index', 'derivative', 'option', 'fund']).optional(),
      price: z.string().optional(),
      changeVal: z.string().optional(),
      changePct: z.string().optional(),
      volume: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const { id, ...fields } = input;
      const assignments = getMarketDataAssignments(fields);
      if (assignments.length === 0) return { success: true };

      await db.execute(sql`
        UPDATE market_data
        SET ${sql.join(
          [...assignments.map(({ column, value }) => sql`${sql.raw(column)} = ${value}`), sql`updated_at = NOW()`],
          sql`, `,
        )}
        WHERE id = ${id}
      `);

      return { success: true };
    }),

  deleteMarketData: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db.execute(sql`DELETE FROM market_data WHERE id = ${input.id}`);
      return { success: true };
    }),

  batchDeleteMarketData: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      for (const id of input.ids) {
        await db.execute(sql`DELETE FROM market_data WHERE id = ${id}`);
      }
      return { success: true, deleted: input.ids.length };
    }),

  // ==================== 系统监控 ====================
  systemHealth: adminProcedure.query(async () => {
    const db = await getDb();
    const dbHealthy = !!db;
    let dbLatency = 0;

    if (db) {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      dbLatency = Date.now() - start;
    }

    const mem = process.memoryUsage();

    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      database: {
        connected: dbHealthy,
        latencyMs: dbLatency,
      },
      server: {
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
      memory: {
        rss: formatBytes(mem.rss),
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
        external: formatBytes(mem.external),
        heapUsedPercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      },
    };
  }),

  // 获取系统日志（最近操作记录）
  getActivityLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // 获取最近登录记录作为活动日志
      const recentLogins = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(desc(users.lastSignedIn)).limit(input.limit);

      return recentLogins.map(u => ({
        type: 'login' as const,
        user: u.name || u.email || `User #${u.id}`,
        timestamp: u.lastSignedIn,
        detail: `用户 ${u.name || u.email} 登录系统`,
      }));
        }),

  // ==================== 品种分类统计 ====================
  marketStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    const [rows] = await db.execute(
      sql`SELECT market, COUNT(*) as count FROM market_data GROUP BY market ORDER BY count DESC`
    ) as any;
    return (rows || []).map((r: any) => ({
      market: r.market,
      count: Number(r.count),
    }));
  }),
});
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时 ${mins}分钟`;
  if (hours > 0) return `${hours}小时 ${mins}分钟`;
  return `${mins}分钟`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
