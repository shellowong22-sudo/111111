import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createNotificationForAllUsers } from "./notification";

export const announcementRouter = router({
  // 公开接口：获取已发布的公告列表（前台展示用）
  getPublished: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const [rows] = await db.execute(sql`
      SELECT id, title, content, type, priority, publishedAt, expiresAt
      FROM announcements
      WHERE status = 'published'
        AND (expiresAt IS NULL OR expiresAt > NOW())
      ORDER BY priority DESC, publishedAt DESC
      LIMIT 10
    `) as any;
    return rows || [];
  }),

  // Admin：读取草稿的发布前预览，并记录实际预览操作以便验收追溯。
  previewForAcceptance: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可验收公告' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });
      const [rows] = await db.execute(sql`SELECT * FROM announcements WHERE id = ${input.id} LIMIT 1`) as any;
      const item = rows?.[0];
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: '公告不存在' });
      await db.execute(sql`
        INSERT INTO announcement_acceptance_events (announcementId, revision, action, actorUserId, actorUserName)
        VALUES (${item.id}, ${item.draftRevision}, 'previewed', ${ctx.user.id}, ${ctx.user.name || 'Admin'})
      `);
      return item;
    }),

  // Admin：确认当前草稿版本。后续任何保存都会使确认失效。
  acceptForPublication: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), acceptanceNote: z.string().trim().max(800).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可验收公告' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });
      const [rows] = await db.execute(sql`SELECT id, status, draftRevision FROM announcements WHERE id = ${input.id} LIMIT 1`) as any;
      const item = rows?.[0];
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: '公告不存在' });
      if (item.status !== 'draft') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '仅草稿可进行发布验收' });
      const note = input.acceptanceNote ?? null;
      await db.execute(sql`
        UPDATE announcements
        SET acceptedRevision = ${item.draftRevision}, acceptanceNote = ${note}, acceptedAt = NOW(),
            acceptedById = ${ctx.user.id}, acceptedByName = ${ctx.user.name || 'Admin'}
        WHERE id = ${item.id}
      `);
      await db.execute(sql`
        INSERT INTO announcement_acceptance_events (announcementId, revision, action, actorUserId, actorUserName, note)
        VALUES (${item.id}, ${item.draftRevision}, 'confirmed', ${ctx.user.id}, ${ctx.user.name || 'Admin'}, ${note})
      `);
      return { acceptedRevision: item.draftRevision };
    }),

  // Admin：读取当前公告的验收轨迹。
  listAcceptanceEvents: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可查看验收记录' });
      const db = await getDb();
      if (!db) return [];
      const [rows] = await db.execute(sql`
        SELECT revision, action, actorUserName, note, createdAt
        FROM announcement_acceptance_events
        WHERE announcementId = ${input.id}
        ORDER BY createdAt DESC, id DESC
        LIMIT 30
      `) as any;
      return rows || [];
    }),

  // Admin：获取所有公告列表
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['all', 'draft', 'published', 'archived']).optional().default('all'),
      page: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(50).optional().default(20),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
      }
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const offset = (input.page - 1) * input.pageSize;
      const statusFilter = input.status !== 'all'
        ? sql`AND status = ${input.status}`
        : sql``;

      const [rows] = await db.execute(sql`
        SELECT * FROM announcements
        WHERE 1=1 ${statusFilter}
        ORDER BY createdAt DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;

      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as total FROM announcements WHERE 1=1 ${statusFilter}
      `) as any;

      return {
        items: rows || [],
        total: countResult?.[0]?.total || 0,
      };
    }),

  // Admin：创建公告
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      content: z.string().min(1),
      type: z.enum(['info', 'warning', 'urgent', 'maintenance']).default('info'),
      priority: z.number().min(0).max(100).default(0),
      expiresAt: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      const expiresAt = input.expiresAt ? sql`${input.expiresAt}` : sql`NULL`;
      await db.execute(sql`
        INSERT INTO announcements (title, content, type, priority, status, authorId, authorName, expiresAt)
        VALUES (${input.title}, ${input.content}, ${input.type}, ${input.priority}, 'draft', ${ctx.user.id}, ${ctx.user.name || 'Admin'}, ${expiresAt})
      `);
      return { success: true };
    }),

  // Admin：编辑公告
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(255),
      content: z.string().min(1),
      type: z.enum(['info', 'warning', 'urgent', 'maintenance']).default('info'),
      priority: z.number().min(0).max(100).default(0),
      expiresAt: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      const expiresAt = input.expiresAt ? sql`${input.expiresAt}` : sql`NULL`;
      await db.execute(sql`
        UPDATE announcements
        SET title = ${input.title}, content = ${input.content}, type = ${input.type},
            priority = ${input.priority}, expiresAt = ${expiresAt},
            status = 'draft', publishedAt = NULL, draftRevision = draftRevision + 1,
            acceptedRevision = NULL, acceptanceNote = NULL, acceptedAt = NULL,
            acceptedById = NULL, acceptedByName = NULL
        WHERE id = ${input.id}
      `);
      return { success: true };
    }),

  // Admin：发布公告
  publish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      const [rows] = await db.execute(sql`SELECT id, status, draftRevision, acceptedRevision FROM announcements WHERE id = ${input.id} LIMIT 1`) as any;
      const item = rows?.[0];
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: '公告不存在' });
      if (item.status !== 'draft' || item.acceptedRevision !== item.draftRevision) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '请先预览并确认当前草稿版本，编辑后需重新验收' });
      }
      await db.execute(sql`
        UPDATE announcements SET status = 'published', publishedAt = NOW() WHERE id = ${input.id}
      `);

      // 获取公告标题和内容，为所有用户创建通知
      const [ann] = await db.execute(sql`SELECT title, content FROM announcements WHERE id = ${input.id}`) as any;
      if (ann && ann[0]) {
        const { title, content } = ann[0];
        await createNotificationForAllUsers(
          `新公告: ${title}`,
          content.substring(0, 200),
          'announcement',
          input.id,
          'announcement'
        );
      }

      return { success: true };
    }),

  // Admin：下线公告
  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      await db.execute(sql`
        UPDATE announcements SET status = 'archived' WHERE id = ${input.id}
      `);
      return { success: true };
    }),

  // Admin：删除公告
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: '仅管理员可访问' });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      await db.execute(sql`DELETE FROM announcements WHERE id = ${input.id}`);
      return { success: true };
    }),
});
