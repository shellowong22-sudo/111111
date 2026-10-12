import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  getAgentReachDashboard,
  readAgentReachPublic,
  refreshAgentReachChannels,
  runAgentReachSkill,
  runAgentReachOperation,
  setAgentReachBackend,
} from "../agentReachService";
import { ingestCompanyKnowledge, listRecentAgentReachKnowledge, searchAgentReachKnowledge, setAgentReachKnowledgeApproval } from "../agentReachKnowledge";
import { authorizeAgentReachPublicSource, captureAgentReachPublicWebSource, connectAgentReachPublicNewsSource, listAgentReachModuleGrants, listAgentReachPublicSources, listDeliveredTopNewsArchive, registerAgentReachPublicSource, runAgentReachDailyDelivery, setAgentReachModuleGrant } from "../agentReachDelivery";
import { browseAgentReachKnowledge, getAgentReachKnowledgeDetail, getTerminalStorageInventory } from "../agentReachStorage";

export const agentReachAdminRouter = router({
  dashboard: adminProcedure.query(() => getAgentReachDashboard()),
  storageInventory: adminProcedure.query(() => getTerminalStorageInventory()),
  browseKnowledge: adminProcedure.input(z.object({
    page: z.number().int().min(1).max(100_000).default(1),
    pageSize: z.number().int().min(1).max(50).default(20),
    query: z.string().trim().max(120).default(""),
    source: z.enum(["all", "internal", "public"]).default("all"),
    approval: z.enum(["all", "approved", "private"]).default("all"),
  })).query(({ input }) => browseAgentReachKnowledge(input)),
  knowledgeDetail: adminProcedure.input(z.object({
    id: z.string().regex(/^ard_[a-f0-9]{32}$/),
  })).query(({ input }) => getAgentReachKnowledgeDetail(input.id)),
  recentKnowledge: adminProcedure.query(() => listRecentAgentReachKnowledge()),
  deliveryGrants: adminProcedure.query(() => listAgentReachModuleGrants()),
  publicSources: adminProcedure.query(() => listAgentReachPublicSources()),
  deliveredTopNewsArchive: adminProcedure.query(() => listDeliveredTopNewsArchive()),
  capturePublicWebSource: adminProcedure.input(z.object({
    websiteUrl: z.string().trim().url().max(1200),
  })).mutation(({ ctx, input }) => captureAgentReachPublicWebSource(input.websiteUrl, ctx.user.id)),
  registerPublicSource: adminProcedure.input(z.object({
    websiteUrl: z.string().trim().url().max(1200),
    rightsConfirmed: z.literal(true),
  })).mutation(({ ctx, input }) => registerAgentReachPublicSource(input.websiteUrl, ctx.user.id, input.rightsConfirmed)),
  authorizePublicSource: adminProcedure.input(z.object({
    sourceId: z.number().int().positive(), moduleId: z.string().min(1).max(96),
  })).mutation(({ ctx, input }) => authorizeAgentReachPublicSource(input.sourceId, input.moduleId, ctx.user.id)),
  connectPublicNewsSource: adminProcedure.input(z.object({
    websiteUrl: z.string().trim().url().max(1200),
    rightsConfirmed: z.literal(true),
  })).mutation(({ ctx, input }) => connectAgentReachPublicNewsSource(input.websiteUrl, ctx.user.id, input.rightsConfirmed)),
  setDeliveryGrant: adminProcedure.input(z.object({
    recordUuid: z.string().regex(/^ard_[a-f0-9]{32}$/),
    moduleId: z.string().min(1).max(96),
    enabled: z.boolean(),
    followRss: z.boolean().default(false),
  })).mutation(({ ctx, input }) => setAgentReachModuleGrant({ ...input, actorUserId: ctx.user.id })),
  runDailyDelivery: adminProcedure.mutation(() => runAgentReachDailyDelivery()),
  approveKnowledge: adminProcedure
    .input(z.object({ id: z.string().regex(/^ard_[a-f0-9]{32}$/), approved: z.boolean() }))
    .mutation(({ input }) => setAgentReachKnowledgeApproval(input.id, input.approved)),
  runSkill: adminProcedure
    .input(z.discriminatedUnion("channelId", [
      z.object({ channelId: z.literal("web"), input: z.string().trim().url().max(1800) }),
      z.object({ channelId: z.literal("rss"), input: z.string().trim().url().max(1800) }),
      z.object({ channelId: z.literal("github"), input: z.string().trim().min(1).max(180) }),
      z.object({ channelId: z.literal("bilibili"), input: z.string().trim().min(1).max(180) }),
      z.object({ channelId: z.literal("youtube"), input: z.string().trim().min(1).max(180) }),
      z.object({
        channelId: z.literal("xueqiu"),
        action: z.enum(["search", "quote", "hot-posts", "hot-stocks"]),
        input: z.string().trim().max(180),
      }),
      z.object({ channelId: z.literal("xiaohongshu"), input: z.string().trim().min(1).max(180) }),
      z.object({ channelId: z.literal("v2ex"), input: z.string().trim().max(180) }),
    ]))
    .mutation(({ input }) => runAgentReachSkill(input)),
  refresh: adminProcedure
    .input(z.object({ channelId: z.string().trim().min(1).max(80).optional() }).optional())
    .mutation(({ input }) => refreshAgentReachChannels(input?.channelId)),
  runOperation: adminProcedure
    .input(z.object({
      operation: z.enum(["doctor", "watch", "version", "check-update", "install-check"]),
    }))
    .mutation(({ input }) => runAgentReachOperation(input.operation)),
  readPublic: adminProcedure
    .input(z.object({
      mode: z.enum(["web", "rss"]),
      url: z.string().trim().url().max(1800),
    }))
    .mutation(({ input }) => readAgentReachPublic(input)),
  ingestCompanyInput: adminProcedure
    .input(z.object({
      title: z.string().trim().min(1).max(700),
      content: z.string().trim().min(20).max(60_000),
      sourceName: z.string().trim().max(255).optional(),
      sourceReference: z.string().trim().max(1_000).optional(),
      tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    }))
    .mutation(({ input }) => ingestCompanyKnowledge(input)),
  searchKnowledge: adminProcedure
    .input(z.object({ query: z.string().trim().min(1).max(240), limit: z.number().int().min(1).max(12).default(6) }))
    .query(({ input }) => searchAgentReachKnowledge(input.query, input.limit, true)),
  setBackend: adminProcedure
    .input(z.object({
      channelId: z.string().trim().min(1).max(80),
      backend: z.string().trim().min(1).max(120),
    }))
    .mutation(({ input }) => setAgentReachBackend(input)),
});
