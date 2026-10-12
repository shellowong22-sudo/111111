/**
 * 佑诚新闻（新闻与研究中心）。公开只读，不返回来源字段。
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { economicCalendar, macroSnapshot, newsSentiment, newsStats, newsTrends, queryNewsDeep, readArticle, readNewsItem, secFilings } from "../uc/news";

export const ucNewsRouter = router({
  feed: publicProcedure
    .input(z.object({
      cats: z.array(z.string().max(20)).max(8).optional(),
      region: z.string().max(20).optional(),
      lang: z.string().max(6).optional(),
      q: z.string().max(80).optional(),
      symbol: z.string().max(24).optional(),
      kind: z.enum(["flash", "article"]).optional(),
      tone: z.number().int().min(-1).max(1).optional(),
      sort: z.enum(["time", "score", "heat"]).optional(),
      limit: z.number().int().min(1).max(400).optional(),
      before: z.number().optional(),
      since: z.number().optional(),
      hours: z.number().min(1).max(96).optional(),
      dedupe: z.boolean().optional(),
    }).default({}))
    .query(async ({ input }) => ({ at: Date.now(), items: await queryNewsDeep(input) })),
  stats: publicProcedure.query(() => newsStats()),
  trends: publicProcedure.input(z.object({ hours: z.number().int().min(3).max(96).default(24) }).default({ hours: 24 })).query(({ input }) => newsTrends(input.hours)),
  sentiment: publicProcedure.input(z.object({ hours: z.number().int().min(3).max(96).default(24) }).default({ hours: 24 })).query(({ input }) => newsSentiment(input.hours)),
  article: publicProcedure.input(z.object({ url: z.string().url().max(2000) })).query(({ input }) => readArticle(input.url)),
  read: publicProcedure.input(z.object({ id: z.string().max(200).nullable(), url: z.string().max(2000).nullable() })).query(({ input }) => readNewsItem(input.id, input.url && /^https?:\/\//.test(input.url) ? input.url : null)),
  filings: publicProcedure.input(z.object({ symbol: z.string().min(1).max(24) })).query(({ input }) => secFilings(input.symbol)),
  macro: publicProcedure.query(() => macroSnapshot()),
  calendar: publicProcedure
    .input(z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(1).max(10).default(1) }))
    .query(({ input }) => economicCalendar(input.from, input.days)),
});
