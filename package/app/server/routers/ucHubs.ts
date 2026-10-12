/**
 * 专业页面实时数据（外汇 / 固定收益 / 衍生品）。公开只读，不返回来源字段。
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { sql } from "drizzle-orm";
import { cotReport, curves, fxReference, optionChain } from "../uc/hubs";
import { exec, parseJson, query } from "../uc/store";
import { symbolSearch, balanceSheets, ambsOperations, courtCounts, courtSearch, edgarSearch, fedRegister, fedRegisterStats, platformStats, regulatorPress, somaHoldings, spendingAgencies, spendingAgencyTrend, spendingAwards, spendingByState } from "../uc/hubs3";
import { analystView, dividends, realYieldCurve, cbRates, closesPack, effectiveRates, fomcStatements, mostActive, imfData, predictionMarkets, convertibles, cotCommodities, futuresCurve, futuresCurves, housing, ivScan, loadSeries, moneyMarket, sovereignSpreads, treasuryAuctions } from "../uc/hubs2";

export const ucHubsRouter = router({
  options: publicProcedure.input(z.object({ symbol: z.string().min(1).max(16), expiry: z.string().max(10).optional() })).query(({ input }) => optionChain(input.symbol, input.expiry)),
  fx: publicProcedure.query(() => fxReference()),
  cot: publicProcedure.query(() => cotReport()),
  curves: publicProcedure.query(() => curves()),
  futures: publicProcedure.input(z.object({ root: z.string().min(1).max(5) })).query(({ input }) => futuresCurve(input.root.toUpperCase())),
  futuresMany: publicProcedure.input(z.object({ roots: z.array(z.string().max(5)).max(30) })).query(({ input }) => futuresCurves(input.roots.map((r) => r.toUpperCase()))),
  moneyMarket: publicProcedure.query(() => moneyMarket()),
  auctions: publicProcedure.query(() => treasuryAuctions()),
  sovereign: publicProcedure.query(() => sovereignSpreads()),
  cotCommodities: publicProcedure.query(() => cotCommodities()),
  cbRates: publicProcedure.query(() => cbRates()),
  eer: publicProcedure.query(() => effectiveRates()),
  predict: publicProcedure.query(() => predictionMarkets()),
  fomc: publicProcedure.query(() => fomcStatements()),
  realCurve: publicProcedure.query(() => realYieldCurve()),
  analyst: publicProcedure.input(z.object({ symbol: z.string().min(1).max(12) })).query(({ input }) => analystView(input.symbol)),
  dividends: publicProcedure.input(z.object({ symbols: z.array(z.string().min(1).max(12)).max(20) })).query(({ input }) => dividends(input.symbols)),
  most: publicProcedure.input(z.object({ market: z.enum(["us", "cn", "hk"]) })).query(({ input }) => mostActive(input.market)),
  imf: publicProcedure.input(z.object({ codes: z.array(z.string().max(16)).min(1).max(10) })).query(({ input }) => imfData(input.codes)),
  ivScan: publicProcedure.input(z.object({ symbols: z.array(z.string().max(16)).max(60) })).query(({ input }) => ivScan(input.symbols)),
  closes: publicProcedure.input(z.object({ symbols: z.array(z.string().max(24)).max(60), days: z.number().int().min(30).max(2600).default(260) })).query(({ input }) => closesPack(input.symbols, input.days)),
  housing: publicProcedure.query(() => housing()),
  convertibles: publicProcedure.query(() => convertibles()),
  ambs: publicProcedure.query(() => ambsOperations()),
  soma: publicProcedure.query(() => somaHoldings()),
  edgar: publicProcedure.input(z.object({ q: z.string().min(1).max(200), forms: z.array(z.string().max(12)).max(12).default([]), days: z.number().int().min(1).max(730).default(90) })).query(({ input }) => edgarSearch(input.q, input.forms, input.days)),
  courts: publicProcedure.input(z.object({ q: z.string().min(1).max(200), type: z.enum(["r", "o"]).default("r"), days: z.number().int().min(1).max(3650).default(60) })).query(({ input }) => courtSearch(input.q, input.type, input.days)),
  courtCounts: publicProcedure.input(z.object({ topics: z.array(z.tuple([z.string().max(40), z.string().max(200)])).max(16), days: z.number().int().min(1).max(365).default(30) })).query(({ input }) => courtCounts(input.topics, input.days)),
  fedRegister: publicProcedure.input(z.object({ agency: z.string().max(80).optional(), type: z.string().max(12).optional(), q: z.string().max(200).optional(), per: z.number().int().max(100).optional() })).query(({ input }) => fedRegister(input)),
  fedRegisterStats: publicProcedure.input(z.object({ days: z.number().int().min(7).max(365).default(30) })).query(({ input }) => fedRegisterStats(input.days)),
  spendAgencies: publicProcedure.query(() => spendingAgencies()),
  spendTrend: publicProcedure.input(z.object({ code: z.string().max(8) })).query(({ input }) => spendingAgencyTrend(input.code)),
  spendAwards: publicProcedure.input(z.object({ days: z.number().int().min(1).max(365).default(30), kind: z.enum(["contracts", "grants"]).default("contracts") })).query(({ input }) => spendingAwards(input.days, input.kind)),
  spendStates: publicProcedure.input(z.object({ days: z.number().int().min(30).max(730).default(365) })).query(({ input }) => spendingByState(input.days)),
  press: publicProcedure.input(z.object({ keys: z.array(z.string().max(12)).max(10).optional() })).query(({ input }) => regulatorPress(input.keys)),
  platform: publicProcedure.query(() => platformStats()),
  search: publicProcedure.input(z.object({ q: z.string().min(1).max(60) })).query(({ input }) => symbolSearch(input.q)),
  balance: publicProcedure.input(z.object({ symbols: z.array(z.string().max(16)).max(20) })).query(({ input }) => balanceSheets(input.symbols)),
  /** 通用的个人保存项（检索条件、案卷关注等），永久保存在平台数据库 */
  saved: publicProcedure.input(z.object({ owner: z.string().min(6).max(64), key: z.string().min(1).max(24) })).query(async ({ input, ctx }) => {
    const owner = `${ctx.user ? `user:${ctx.user.id}` : `anon:${input.owner}`}#${input.key}`.slice(0, 64);
    const [row] = await query<{ data_json: string }>(sql`SELECT data_json FROM uc_portfolios WHERE owner = ${owner}`);
    return row ? parseJson(row.data_json, null) : null;
  }),
  save: publicProcedure.input(z.object({ owner: z.string().min(6).max(64), key: z.string().min(1).max(24), data: z.unknown() })).mutation(async ({ input, ctx }) => {
    const owner = `${ctx.user ? `user:${ctx.user.id}` : `anon:${input.owner}`}#${input.key}`.slice(0, 64);
    const json = JSON.stringify(input.data ?? null);
    if (json.length > 200_000) throw new Error("内容过大");
    await exec(sql`INSERT INTO uc_portfolios (owner, data_json) VALUES (${owner}, ${json}) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)`);
    return { ok: true };
  }),
  series: publicProcedure.input(z.object({ series: z.string().max(64), n: z.number().int().max(2000).default(500) })).query(({ input }) => loadSeries(input.series, input.n)),
  /** 组合：按浏览器生成的组合编号永久保存在平台数据库（登录用户用账号编号） */
  portfolio: publicProcedure.input(z.object({ owner: z.string().min(6).max(64) })).query(async ({ input, ctx }) => {
    const owner = ctx.user ? `user:${ctx.user.id}` : `anon:${input.owner}`;
    const [row] = await query<{ data_json: string }>(sql`SELECT data_json FROM uc_portfolios WHERE owner = ${owner}`);
    return row ? parseJson(row.data_json, null) : null;
  }),
  savePortfolio: publicProcedure.input(z.object({ owner: z.string().min(6).max(64), data: z.object({ holdings: z.array(z.object({ symbol: z.string().max(24), qty: z.number(), cost: z.number() })).max(200), benchmark: z.string().max(24), cash: z.number().default(0) }) })).mutation(async ({ input, ctx }) => {
    const owner = ctx.user ? `user:${ctx.user.id}` : `anon:${input.owner}`;
    await exec(sql`INSERT INTO uc_portfolios (owner, data_json) VALUES (${owner}, ${JSON.stringify(input.data)}) ON DUPLICATE KEY UPDATE data_json = VALUES(data_json)`);
    return { ok: true };
  }),
});
