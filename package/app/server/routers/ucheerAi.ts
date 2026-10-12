import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { analyzeNewsWithUcheerAi, chatWithUcheerAi, ChatInput, getUcheerAiStatus, NewsInput } from "../ucheerAi";
import { searchGlobalInformation } from "../ucheerAiSearch";
import { invokeOmniRouteMedia, listOmniRouteMediaModels } from "../omniRouteMedia";
import {
  deleteUcheerConversation, deleteUcheerMemory, distillUcheerConversation,
  getUcheerConversation, getUcheerMemoryDetails, getUcheerMemoryOverview, getUcheerMemoryTimeline,
  listUcheerConversations, listUcheerMemories, prepareUcheerTurn, rateUcheerAnswer,
  runUcheerMemoryMaintenance, saveUcheerTurn, searchUcheerMemoryIndex,
} from "../ucheerAiMemory";

export const ucheerAiRouter = router({
  status: publicProcedure.query(() => getUcheerAiStatus()),
  mediaModels: publicProcedure.query(() => listOmniRouteMediaModels()),
  workspace: publicProcedure.query(({ ctx }) => ({ authenticated: Boolean(ctx.user), persistent: Boolean(ctx.user) })),
  adminOverview: adminProcedure.query(() => getUcheerMemoryOverview()),
  adminMaintenance: adminProcedure.mutation(() => runUcheerMemoryMaintenance()),
  conversations: protectedProcedure.query(({ ctx }) => listUcheerConversations(ctx.user.id)),
  conversation: protectedProcedure.input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => getUcheerConversation(ctx.user.id, input.id)),
  deleteConversation: protectedProcedure.input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => deleteUcheerConversation(ctx.user.id, input.id)),
  memories: protectedProcedure.query(({ ctx }) => listUcheerMemories(ctx.user.id)),
  memorySearch: protectedProcedure.input(z.object({
    query: z.string().trim().min(1).max(240),
    limit: z.number().int().min(1).max(30).default(12),
  })).query(({ ctx, input }) => searchUcheerMemoryIndex(ctx.user.id, input.query, input.limit)),
  memoryDetails: protectedProcedure.input(z.object({
    ids: z.array(z.object({
      kind: z.enum(["memory", "message"]),
      id: z.number().int().positive(),
    })).min(1).max(30),
  })).query(({ ctx, input }) => getUcheerMemoryDetails(ctx.user.id, input.ids)),
  memoryTimeline: protectedProcedure.input(z.object({
    messageId: z.number().int().positive(),
    before: z.number().int().min(0).max(8).default(3),
    after: z.number().int().min(0).max(8).default(3),
  })).query(({ ctx, input }) => getUcheerMemoryTimeline(ctx.user.id, input.messageId, input.before, input.after)),
  deleteMemory: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => deleteUcheerMemory(ctx.user.id, input.id)),
  rateAnswer: protectedProcedure.input(z.object({
    messageId: z.number().int().positive(), feedback: z.enum(["helpful", "unhelpful"]),
  })).mutation(({ ctx, input }) => rateUcheerAnswer(ctx.user.id, input.messageId, input.feedback)),
  search: publicProcedure
    .input(z.object({ query: z.string().trim().min(1).max(240) }))
    .mutation(({ input }) => searchGlobalInformation(input.query)),
  chat: publicProcedure
    .input(ChatInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        const result = await chatWithUcheerAi(input, [], false);
        return { ...result, conversationId: null, assistantMessageId: null };
      }
      const message = [...input.messages].reverse().find(item => item.role === "user");
      if (!message) throw new Error("请先输入问题。");
      const prepared = await prepareUcheerTurn(ctx.user.id, input.conversationId, message.content);
      // For signed-in users, the server owns previous turns. Client-sent history
      // is never trusted to reconstruct another user's private conversation.
      const result = await chatWithUcheerAi({ ...input, messages: prepared.messages }, prepared.memories, true);
      if (result.status !== "available" || !result.reply) {
        return { ...result, conversationId: prepared.conversationId, assistantMessageId: null };
      }
      const assistantMessageId = await saveUcheerTurn(ctx.user.id, prepared.conversationId, message.content, result.reply);
      void distillUcheerConversation(ctx.user.id, prepared.conversationId)
        .catch(() => console.warn("[Ucheer AI] Memory distillation deferred."));
      return { ...result, conversationId: prepared.conversationId, assistantMessageId };
    }),
  /**
   * Media generation stays behind the existing Ucheer AI backend contract.
   * No provider URL, API key or new frontend module is exposed. The procedure
   * is authenticated because image/video/audio calls may consume an operator's
   * configured gateway quota.
   */
  generateMedia: protectedProcedure
    .input(z.object({
      kind: z.enum(["image", "video", "audio"]),
      model: z.string().trim().min(1).max(160),
      prompt: z.string().trim().max(6_000).optional(),
      text: z.string().trim().max(20_000).optional(),
      options: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(({ input }) => invokeOmniRouteMedia(input)),
  analyzeNews: publicProcedure
    .input(NewsInput)
    .mutation(({ input }) => analyzeNewsWithUcheerAi(input)),
});
