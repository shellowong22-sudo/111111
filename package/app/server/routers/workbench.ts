import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { workbenchPanels } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";

export const workbenchRouter = router({
  /**
   * 获取用户的工作台面板列表
   */
  getPanels: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db || !ctx.user) throw new Error("Database or user not available");
    
    const panels = await db
      .select()
      .from(workbenchPanels)
      .where(eq(workbenchPanels.userId, ctx.user.id))
      .orderBy(workbenchPanels.pinned, workbenchPanels.position);

    return panels.map((p) => ({
      id: p.id,
      panelCode: p.panelCode,
      panelName: p.panelName,
      panelType: p.panelType,
      icon: p.icon,
      position: p.position,
      pinned: p.pinned === 1,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }),

  /**
   * 添加面板到工作台
   */
  addPanel: protectedProcedure
    .input(
      z.object({
        panelCode: z.string().min(1).max(50),
        panelName: z.string().min(1).max(255),
        panelType: z.enum([
          "bond",
          "equity",
          "derivative",
          "commodity",
          "index",
          "economic",
        ]),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error("Database or user not available");
      
      // 检查面板是否已存在
      const existing = await db
        .select()
        .from(workbenchPanels)
        .where(
          and(
            eq(workbenchPanels.userId, ctx.user.id),
            eq(workbenchPanels.panelCode, input.panelCode)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error("Panel already exists in workbench");
      }

      // 获取最大位置
      const maxPosition = await db
        .select({ maxPos: workbenchPanels.position })
        .from(workbenchPanels)
        .where(eq(workbenchPanels.userId, ctx.user.id))
        .orderBy(workbenchPanels.position);

      const nextPosition =
        maxPosition.length > 0
          ? Math.max(...maxPosition.map((p) => p.maxPos || 0)) + 1
          : 0;

      await db.insert(workbenchPanels).values({
        userId: ctx.user.id,
        panelCode: input.panelCode,
        panelName: input.panelName,
        panelType: input.panelType,
        icon: input.icon,
        position: nextPosition,
        pinned: 0,
      });

      return {
        panelCode: input.panelCode,
        panelName: input.panelName,
        panelType: input.panelType,
        icon: input.icon,
        position: nextPosition,
        pinned: false,
      };
    }),

  /**
   * 从工作台移除面板
   */
  removePanel: protectedProcedure
    .input(z.object({ panelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error("Database or user not available");
      
      await db
        .delete(workbenchPanels)
        .where(
          and(
            eq(workbenchPanels.id, input.panelId),
            eq(workbenchPanels.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * 更新面板位置
   */
  updatePosition: protectedProcedure
    .input(
      z.object({
        panelId: z.number(),
        position: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error("Database or user not available");
      
      await db
        .update(workbenchPanels)
        .set({ position: input.position })
        .where(
          and(
            eq(workbenchPanels.id, input.panelId),
            eq(workbenchPanels.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),

  /**
   * 切换面板固定状态
   */
  togglePin: protectedProcedure
    .input(z.object({ panelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error("Database or user not available");
      
      // 获取当前状态
      const panel = await db
        .select()
        .from(workbenchPanels)
        .where(
          and(
            eq(workbenchPanels.id, input.panelId),
            eq(workbenchPanels.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (panel.length === 0) {
        throw new Error("Panel not found");
      }

      const newPinned = panel[0].pinned === 1 ? 0 : 1;

      await db
        .update(workbenchPanels)
        .set({ pinned: newPinned })
        .where(
          and(
            eq(workbenchPanels.id, input.panelId),
            eq(workbenchPanels.userId, ctx.user.id)
          )
        );

      return { pinned: newPinned === 1 };
    }),

  /**
   * 批量更新面板位置（用于拖拽排序）
   */
  updatePositions: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            panelId: z.number(),
            position: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || !ctx.user) throw new Error("Database or user not available");
      
      for (const update of input.updates) {
        await db
          .update(workbenchPanels)
          .set({ position: update.position })
          .where(
            and(
              eq(workbenchPanels.id, update.panelId),
              eq(workbenchPanels.userId, ctx.user.id)
            )
          );
      }

      return { success: true };
    }),
});
