/**
 * 佑诚实时行情（WEI 行情综合大屏）。公开只读，不返回来源字段。
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getKline, getText, getTicks, parseSymbol, qqCode, WEI_BOARDS, displayName, type UcPeriod } from "../uc/market";
import { getNews, getProfile, getSession, getSessions } from "../uc/marketInfo";

const period = z.enum(["1m", "5m", "15m", "30m", "60m", "1d", "1w", "1M"]);
const symbol = z.string().trim().min(1).max(24);

export const ucMarketRouter = router({
  boards: publicProcedure.query(() =>
    Object.entries(WEI_BOARDS).map(([id, b]) => ({ id, label: b.label, symbols: b.symbols.map((s) => ({ symbol: s, name: displayName(s) })) })),
  ),

  ticks: publicProcedure.input(z.object({ symbols: z.array(symbol).max(400) })).query(async ({ input }) => {
    const ticks = await getTicks(input.symbols);
    return { at: Date.now(), ticks };
  }),

  kline: publicProcedure
    .input(z.object({ symbol, period: period.default("1d"), limit: z.number().int().min(20).max(2600).default(240) }))
    .query(async ({ input }) => {
      const candles = await getKline(input.symbol, input.period as UcPeriod, input.limit);
      return { symbol: input.symbol, period: input.period, at: Date.now(), candles };
    }),

  /** 增量 K 线：只返回 since 之后（含）的 K 线，前端拼接到已有序列末尾 */
  klineTail: publicProcedure
    .input(z.object({ symbol, period: period.default("1d"), limit: z.number().int().min(20).max(2600).default(240), since: z.number() }))
    .query(async ({ input }) => {
      const candles = await getKline(input.symbol, input.period as UcPeriod, input.limit);
      return { at: Date.now(), candles: candles.filter((c) => c.t >= input.since).slice(-60) };
    }),


  /** 盘口：A股 / 港股五档（实时），美股为全国最优买卖价与挂单量 */
  depth: publicProcedure.input(z.object({ symbol })).query(async ({ input }) => {
    const p = parseSymbol(input.symbol);
    const code = qqCode(p);
    if ((p.kind === "cn" || p.kind === "hk") && code) {
      const text = await getText(`https://qt.gtimg.cn/q=${code}`, { Referer: "https://gu.qq.com/" }, "gbk", 5000).catch(() => "");
      const m = /="([^"]*)"/.exec(text);
      const f = m ? m[1].split("~") : [];
      const n = (i: number) => { const v = Number(f[i]); return Number.isFinite(v) ? v : 0; };
      const unit = p.kind === "cn" ? 100 : 1;
      const bids = [0, 1, 2, 3, 4].map((i) => ({ px: n(9 + i * 2), qty: n(10 + i * 2) * unit })).filter((x) => x.px > 0);
      const asks = [0, 1, 2, 3, 4].map((i) => ({ px: n(19 + i * 2), qty: n(20 + i * 2) * unit })).filter((x) => x.px > 0);
      return { symbol: input.symbol, at: Date.now(), levels: 5, last: n(3), bids, asks };
    }
    if (p.kind === "us") {
      const j = await getText(`https://cdn.cboe.com/api/global/delayed_quotes/quotes/${encodeURIComponent(p.code.replace(/_/g, "."))}.json`, {}, "utf-8", 8000).then((t) => JSON.parse(t)?.data).catch(() => null);
      const bids = j?.bid ? [{ px: Number(j.bid), qty: Number(j.bid_size ?? 0) * 100 }] : [];
      const asks = j?.ask ? [{ px: Number(j.ask), qty: Number(j.ask_size ?? 0) * 100 }] : [];
      return { symbol: input.symbol, at: Date.now(), levels: 1, last: Number(j?.current_price ?? 0), bids, asks };
    }
    const t = (await getTicks([input.symbol], { budgetMs: 3000 }))[input.symbol];
    return { symbol: input.symbol, at: Date.now(), levels: 0, last: t?.price ?? 0, bids: [], asks: [] };
  }),
  sessions: publicProcedure.input(z.object({ symbols: z.array(symbol).max(60) })).query(({ input }) => getSessions(input.symbols)),
  session: publicProcedure.input(z.object({ symbol })).query(({ input }) => getSession(input.symbol).catch(() => null)),
  news: publicProcedure.input(z.object({ symbol, name: z.string().max(60).optional() })).query(({ input }) => getNews(input.symbol, input.name).catch(() => [])),
  profile: publicProcedure.input(z.object({ symbol })).query(({ input }) => getProfile(input.symbol).catch(() => null)),
});
