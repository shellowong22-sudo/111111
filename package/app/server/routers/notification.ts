import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { pushNotificationToUser, pushUnreadCountToUser } from "../uploadAndSse";

export const notificationRouter = router({
  // 获取当前用户的通知列表
  list: protectedProcedure
    .input(z.object({
      filter: z.enum(['all', 'unread', 'read', 'due_soon']).optional().default('all'),
      page: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(50).optional().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, unreadCount: 0 };

      const offset = (input.page - 1) * input.pageSize;
      const readFilter = input.filter === 'unread'
        ? sql`AND isRead = 0`
        : input.filter === 'read'
          ? sql`AND isRead = 1`
          : input.filter === 'due_soon'
          ? sql`AND type = 'alert' AND relatedType IN ('checklist_export', 'checklist_template_archive', 'financing_calendar_event', 'mmflow_delivery_deadline')`
            : sql``;

      const [rows] = await db.execute(sql`
        SELECT * FROM notifications
        WHERE userId = ${ctx.user.id} ${readFilter}
        ORDER BY createdAt DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `) as any;

      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as total FROM notifications
        WHERE userId = ${ctx.user.id} ${readFilter}
      `) as any;

      const [unreadResult] = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM notifications
        WHERE userId = ${ctx.user.id} AND isRead = 0
      `) as any;

      const [dueSoonResult] = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM notifications
        WHERE userId = ${ctx.user.id}
          AND type = 'alert'
          AND relatedType IN ('checklist_export', 'checklist_template_archive', 'financing_calendar_event', 'mmflow_delivery_deadline')
      `) as any;

      return {
        items: rows || [],
        total: Number(countResult?.[0]?.total || 0),
        unreadCount: Number(unreadResult?.[0]?.cnt || 0),
        dueSoonCount: Number(dueSoonResult?.[0]?.cnt || 0),
      };
    }),

  // 获取未读通知数量
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };

    const [result] = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM notifications
      WHERE userId = ${ctx.user.id} AND isRead = 0
    `) as any;

    return { count: Number(result?.[0]?.cnt || 0) };
  }),

  // 标记单条通知为已读
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      await db.execute(sql`
        UPDATE notifications SET isRead = 1
        WHERE id = ${input.id} AND userId = ${ctx.user.id}
      `);
      // Push updated unread count via SSE
      const [unreadResult] = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM notifications
        WHERE userId = ${ctx.user.id} AND isRead = 0
      `) as any;
      pushUnreadCountToUser(ctx.user.id, Number(unreadResult?.[0]?.cnt || 0));
      return { success: true };
    }),

  // 标记所有通知为已读
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

    await db.execute(sql`
      UPDATE notifications SET isRead = 1
      WHERE userId = ${ctx.user.id} AND isRead = 0
    `);
    // Push updated unread count via SSE
    pushUnreadCountToUser(ctx.user.id, 0);
    return { success: true };
  }),

  // 删除单条通知
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      await db.execute(sql`
        DELETE FROM notifications WHERE id = ${input.id} AND userId = ${ctx.user.id}
      `);
      return { success: true };
    }),

  // 清空所有已读通知
  clearRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

    await db.execute(sql`
      DELETE FROM notifications WHERE userId = ${ctx.user.id} AND isRead = 1
    `);
    return { success: true };
  }),

  // 获取通知偏好设置
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { announcements: true, systemAlerts: true, marketAlerts: true, infoMessages: true };

    const [rows] = await db.execute(sql`
      SELECT * FROM notification_preferences WHERE userId = ${ctx.user.id}
    `) as any;

    if (!rows || rows.length === 0) {
      return { announcements: true, systemAlerts: true, marketAlerts: true, infoMessages: true };
    }

    const pref = rows[0];
    return {
      announcements: Boolean(pref.announcements),
      systemAlerts: Boolean(pref.systemAlerts),
      marketAlerts: Boolean(pref.marketAlerts),
      infoMessages: Boolean(pref.infoMessages),
    };
  }),

  // 更新通知偏好设置
  updatePreferences: protectedProcedure
    .input(z.object({
      announcements: z.boolean().optional(),
      systemAlerts: z.boolean().optional(),
      marketAlerts: z.boolean().optional(),
      infoMessages: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库不可用' });

      const now = Date.now();
      // Check if preferences exist
      const [existing] = await db.execute(sql`
        SELECT id FROM notification_preferences WHERE userId = ${ctx.user.id}
      `) as any;

      if (existing && existing.length > 0) {
        await db.execute(sql`
          UPDATE notification_preferences SET
            announcements = ${input.announcements !== undefined ? (input.announcements ? 1 : 0) : sql`announcements`},
            systemAlerts = ${input.systemAlerts !== undefined ? (input.systemAlerts ? 1 : 0) : sql`systemAlerts`},
            marketAlerts = ${input.marketAlerts !== undefined ? (input.marketAlerts ? 1 : 0) : sql`marketAlerts`},
            infoMessages = ${input.infoMessages !== undefined ? (input.infoMessages ? 1 : 0) : sql`infoMessages`},
            updatedAt = ${now}
          WHERE userId = ${ctx.user.id}
        `);
      } else {
        await db.execute(sql`
          INSERT INTO notification_preferences (userId, announcements, systemAlerts, marketAlerts, infoMessages, createdAt, updatedAt)
          VALUES (
            ${ctx.user.id},
            ${input.announcements !== undefined ? (input.announcements ? 1 : 0) : 1},
            ${input.systemAlerts !== undefined ? (input.systemAlerts ? 1 : 0) : 1},
            ${input.marketAlerts !== undefined ? (input.marketAlerts ? 1 : 0) : 1},
            ${input.infoMessages !== undefined ? (input.infoMessages ? 1 : 0) : 1},
            ${now},
            ${now}
          )
        `);
      }

      return { success: true };
    }),
});

// 工具函数：为所有用户创建通知（管理员发布公告时调用）
export async function createNotificationForAllUsers(
  title: string,
  content: string,
  type: 'announcement' | 'system' | 'alert' | 'info' = 'announcement',
  relatedId?: number,
  relatedType?: string
) {
  const db = await getDb();
  if (!db || typeof (db as any).execute !== 'function') return { recipientCount: 0 };

  const preferenceField = type === 'announcement' ? 'announcements' : type === 'alert' ? 'systemAlerts' : type === 'info' ? 'infoMessages' : 'systemAlerts';
  const [users] = await db.execute(sql`
    SELECT u.id, COALESCE(np.announcements, 1) AS announcements,
      COALESCE(np.systemAlerts, 1) AS systemAlerts,
      COALESCE(np.marketAlerts, 1) AS marketAlerts,
      COALESCE(np.infoMessages, 1) AS infoMessages
    FROM users u LEFT JOIN notification_preferences np ON np.userId = u.id
  `) as any;
  if (!users || users.length === 0) return { recipientCount: 0 };

  let recipientCount = 0;
  for (const user of users as any[]) {
    if (Number(user[preferenceField]) === 0) continue;
    const inserted = await db.execute(sql`
      INSERT INTO notifications (userId, title, content, type, relatedId, relatedType)
      VALUES (${user.id}, ${title.slice(0, 255)}, ${content.slice(0, 4000)}, ${type}, ${relatedId ?? null}, ${relatedType ?? null})
    `) as any;
    const notificationId = Number(inserted?.[0]?.insertId ?? inserted?.insertId ?? 0);
    const [unreadRows] = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM notifications WHERE userId = ${user.id} AND isRead = 0
    `) as any;
    pushNotificationToUser(user.id, { id: notificationId, title: title.slice(0, 255), content: content.slice(0, 4000), type });
    pushUnreadCountToUser(user.id, Number(unreadRows?.[0]?.cnt ?? 0));
    recipientCount += 1;
  }
  return { recipientCount };
}
