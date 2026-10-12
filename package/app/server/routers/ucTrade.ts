/**
 * 平台自有交易系统（模拟账户、实时行情成交）。订单、成交、持仓、资金、清算交收、事件流水全部存库。
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { account, cancelOrder, events, fills, orders, placeOrder, positions, summary } from "../uc/trade";

const ownerIn = z.object({ owner: z.string().min(6).max(64) });
const who = (ctx: { user?: { id: number | string } | null }, owner: string) => (ctx.user ? `user:${ctx.user.id}` : `anon:${owner}`);

export const ucTradeRouter = router({
  orders: publicProcedure.input(ownerIn).query(({ input, ctx }) => orders(who(ctx as any, input.owner))),
  fills: publicProcedure.input(ownerIn).query(({ input, ctx }) => fills(who(ctx as any, input.owner))),
  events: publicProcedure.input(ownerIn).query(({ input, ctx }) => events(who(ctx as any, input.owner))),
  positions: publicProcedure.input(ownerIn).query(({ input, ctx }) => positions(who(ctx as any, input.owner))),
  account: publicProcedure.input(ownerIn).query(({ input, ctx }) => account(who(ctx as any, input.owner))),
  summary: publicProcedure.input(ownerIn).query(({ input, ctx }) => summary(who(ctx as any, input.owner))),
  place: publicProcedure.input(ownerIn.extend({
    account: z.string().max(32).optional(), symbol: z.string().min(1).max(24), side: z.enum(["B", "S"]), type: z.enum(["MKT", "LMT", "STP"]),
    qty: z.number().positive().max(1e9), limitPx: z.number().positive().nullable().optional(), stopPx: z.number().positive().nullable().optional(),
    tif: z.enum(["DAY", "GTC", "IOC"]).optional(), strategy: z.string().max(32).nullable().optional(), note: z.string().max(200).nullable().optional(),
  })).mutation(({ input, ctx }) => placeOrder({ ...input, owner: who(ctx as any, input.owner) })),
  cancel: publicProcedure.input(ownerIn.extend({ id: z.number().int() })).mutation(({ input, ctx }) => cancelOrder(who(ctx as any, input.owner), input.id)),
});
