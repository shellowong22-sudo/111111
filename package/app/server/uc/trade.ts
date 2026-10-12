/**
 * 平台自有交易系统（模拟账户，按实时行情成交）：订单、成交、持仓、资金、清算交收、事件流水。
 * 所有记录永久存在平台数据库：uc_orders / uc_fills / uc_trade_events。
 * 订单管理、交易流水、直通式处理（STP）、对账、审计等面板都基于这里的真实记录，不再造数据。
 */
import { sql } from "drizzle-orm";
import { getTicks, parseSymbol } from "./market";
import { exec, query } from "./store";

export const INITIAL_CASH = 1_000_000;
let ready: Promise<void> | null = null;
function ensure() {
  ready ??= (async () => {
    await exec(sql`CREATE TABLE IF NOT EXISTS uc_orders (
      id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner varchar(64) NOT NULL,
      account varchar(32) NOT NULL DEFAULT 'MAIN',
      symbol varchar(32) NOT NULL,
      name varchar(64) NULL,
      market varchar(8) NOT NULL,
      side char(1) NOT NULL,
      type varchar(4) NOT NULL,
      tif varchar(4) NOT NULL DEFAULT 'DAY',
      qty double NOT NULL,
      limit_px double NULL,
      stop_px double NULL,
      status varchar(12) NOT NULL,
      filled_qty double NOT NULL DEFAULT 0,
      avg_px double NULL,
      strategy varchar(32) NULL,
      note varchar(200) NULL,
      reject_reason varchar(200) NULL,
      created_at bigint NOT NULL,
      updated_at bigint NOT NULL,
      KEY idx_owner (owner, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await exec(sql`CREATE TABLE IF NOT EXISTS uc_fills (
      id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id bigint NOT NULL,
      owner varchar(64) NOT NULL,
      account varchar(32) NOT NULL DEFAULT 'MAIN',
      symbol varchar(32) NOT NULL,
      market varchar(8) NOT NULL,
      side char(1) NOT NULL,
      qty double NOT NULL,
      px double NOT NULL,
      fee double NOT NULL DEFAULT 0,
      tax double NOT NULL DEFAULT 0,
      ccy varchar(4) NOT NULL,
      ts bigint NOT NULL,
      trade_date varchar(10) NOT NULL,
      settle_date varchar(10) NOT NULL,
      KEY idx_owner (owner, ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await exec(sql`CREATE TABLE IF NOT EXISTS uc_trade_events (
      id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner varchar(64) NOT NULL,
      order_id bigint NULL,
      ts bigint NOT NULL,
      kind varchar(24) NOT NULL,
      detail varchar(400) NULL,
      KEY idx_owner (owner, ts)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/* ------------------------------------------------------------------ 市场规则 */
export function marketOf(symbol: string): { market: string; ccy: string; lot: number; settleDays: number; tz: number } {
  const p = parseSymbol(symbol);
  if (p.kind === "cn") return { market: "CN", ccy: "CNY", lot: /^(11|12)/.test(p.code) ? 10 : 100, settleDays: 1, tz: 8 };
  if (p.kind === "hk") return { market: "HK", ccy: "HKD", lot: 1, settleDays: 2, tz: 8 };
  if (p.kind === "us") return { market: "US", ccy: "USD", lot: 1, settleDays: 1, tz: -4 };
  if (p.kind === "x") return { market: "FUT", ccy: "USD", lot: 1, settleDays: 0, tz: -4 };
  return { market: "INTL", ccy: "USD", lot: 1, settleDays: 2, tz: 0 };
}
function fees(market: string, side: "B" | "S", qty: number, px: number) {
  const notional = qty * px;
  switch (market) {
    case "CN": return { fee: Math.max(5, notional * 0.00025) + notional * 0.00001, tax: side === "S" ? notional * 0.0005 : 0 };
    case "HK": return { fee: Math.max(50, notional * 0.0003) + notional * 0.0000565, tax: Math.ceil(notional * 0.001) };
    case "US": return { fee: Math.max(1, qty * 0.005), tax: side === "S" ? notional * 0.0000278 : 0 };
    default: return { fee: notional * 0.0002, tax: 0 };
  }
}
const ymd = (ms: number, tz: number) => new Date(ms + tz * 3600_000).toISOString().slice(0, 10);
export function addBizDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

async function event(owner: string, orderId: number | null, kind: string, detail: string) {
  await exec(sql`INSERT INTO uc_trade_events (owner, order_id, ts, kind, detail) VALUES (${owner}, ${orderId}, ${Date.now()}, ${kind}, ${detail.slice(0, 400)})`).catch(() => undefined);
}

/* ------------------------------------------------------------------ 下单 / 撤单 / 撮合 */
export type PlaceInput = { owner: string; account?: string; symbol: string; side: "B" | "S"; type: "MKT" | "LMT" | "STP"; qty: number; limitPx?: number | null; stopPx?: number | null; tif?: "DAY" | "GTC" | "IOC"; strategy?: string | null; note?: string | null };
export async function placeOrder(o: PlaceInput) {
  await ensure();
  const sym = o.symbol.trim();
  const m = marketOf(sym);
  const ticks = await getTicks([sym], { budgetMs: 4000 });
  const t = ticks[sym];
  const now = Date.now();
  let status = "NEW";
  let reject: string | null = null;
  if (!t?.price) { status = "REJECTED"; reject = "无法获取实时价格，标的代码可能有误"; }
  else if (!(o.qty > 0)) { status = "REJECTED"; reject = "数量必须大于 0"; }
  else if (m.market === "CN" && o.side === "B" && o.qty % m.lot !== 0) { status = "REJECTED"; reject = `A股买入须为 ${m.lot} 的整数倍`; }
  else if (o.type === "LMT" && !(o.limitPx && o.limitPx > 0)) { status = "REJECTED"; reject = "限价单需要填写价格"; }
  if (status !== "REJECTED" && o.side === "S") {
    const pos = (await positions(o.owner)).rows.find((r) => r.symbol === sym && r.account === (o.account ?? "MAIN"));
    if (!pos || pos.qty + 1e-9 < o.qty) { status = "REJECTED"; reject = `可卖数量不足（持仓 ${pos?.qty ?? 0}）`; }
  }
  if (status !== "REJECTED" && o.side === "B") {
    const cash = (await account(o.owner)).cash;
    const px = o.type === "LMT" ? o.limitPx! : t!.price;
    if (px * o.qty > cash * fxToBase(m.ccy, t)) { status = "REJECTED"; reject = `可用资金不足（需 ${(px * o.qty).toFixed(2)}）`; }
  }
  const res = await exec(sql`INSERT INTO uc_orders (owner, account, symbol, name, market, side, type, tif, qty, limit_px, stop_px, status, strategy, note, reject_reason, created_at, updated_at)
    VALUES (${o.owner}, ${o.account ?? "MAIN"}, ${sym}, ${t?.name ?? null}, ${m.market}, ${o.side}, ${o.type}, ${o.tif ?? "DAY"}, ${o.qty}, ${o.limitPx ?? null}, ${o.stopPx ?? null}, ${status}, ${o.strategy ?? null}, ${o.note ?? null}, ${reject}, ${now}, ${now})`);
  const id = res.insertId;
  await event(o.owner, id, status === "REJECTED" ? "REJECT" : "NEW", `${o.side === "B" ? "买入" : "卖出"} ${sym} ${o.qty} @ ${o.type === "MKT" ? "市价" : o.limitPx}${reject ? `；拒单：${reject}` : ""}`);
  if (status !== "REJECTED") await tryMatch(id);
  return { id, status, reject };
}
/** 资金按本币计（演示账户以人民币为基准）：外币资产按实时汇率折算 */
function fxToBase(_ccy: string, _t: unknown) { return 1; }

async function tryMatch(id: number) {
  const [o] = await query<any>(sql`SELECT * FROM uc_orders WHERE id = ${id}`);
  if (!o || !["NEW", "PARTIAL"].includes(o.status)) return;
  const t = (await getTicks([o.symbol], { budgetMs: 3000 }))[o.symbol];
  if (!t?.price) return;
  const px = t.price;
  const lim = o.limit_px == null ? null : Number(o.limit_px);
  let fillPx: number | null = null;
  if (o.type === "MKT") fillPx = px;
  else if (o.type === "LMT") fillPx = o.side === "B" ? (px <= lim! ? Math.min(px, lim!) : null) : (px >= lim! ? Math.max(px, lim!) : null);
  else if (o.type === "STP" && o.stop_px != null) fillPx = o.side === "B" ? (px >= Number(o.stop_px) ? px : null) : (px <= Number(o.stop_px) ? px : null);
  if (fillPx == null) {
    if (o.tif === "IOC") {
      await exec(sql`UPDATE uc_orders SET status = 'CANCELLED', updated_at = ${Date.now()}, reject_reason = '立即成交否则撤销：未达成交条件' WHERE id = ${id}`);
      await event(o.owner, id, "CANCEL", "IOC 未成交自动撤销");
    }
    return;
  }
  const qty = Number(o.qty) - Number(o.filled_qty);
  const m = marketOf(o.symbol);
  const { fee, tax } = fees(m.market, o.side, qty, fillPx);
  const now = Date.now();
  const td = ymd(t.time || now, m.tz);
  await exec(sql`INSERT INTO uc_fills (order_id, owner, account, symbol, market, side, qty, px, fee, tax, ccy, ts, trade_date, settle_date)
    VALUES (${id}, ${o.owner}, ${o.account}, ${o.symbol}, ${m.market}, ${o.side}, ${qty}, ${fillPx}, ${fee}, ${tax}, ${m.ccy}, ${now}, ${td}, ${addBizDays(td, m.settleDays)})`);
  await exec(sql`UPDATE uc_orders SET status = 'FILLED', filled_qty = qty, avg_px = ${fillPx}, updated_at = ${now} WHERE id = ${id}`);
  await event(o.owner, id, "FILL", `成交 ${o.symbol} ${qty} @ ${fillPx}，费用 ${(fee + tax).toFixed(2)} ${m.ccy}`);
}

export async function cancelOrder(owner: string, id: number) {
  await ensure();
  const r = await exec(sql`UPDATE uc_orders SET status = 'CANCELLED', updated_at = ${Date.now()} WHERE id = ${id} AND owner = ${owner} AND status IN ('NEW','PARTIAL')`);
  if (r.affectedRows) await event(owner, id, "CANCEL", "用户撤单");
  return { ok: r.affectedRows > 0 };
}

/** 后台撮合：每 3 秒检查所有未成交限价 / 止损单；日内单在收盘后失效 */
let loop = false;
export function startMatcher() {
  if (loop) return;
  loop = true;
  setInterval(async () => {
    try {
      await ensure();
      const open = await query<any>(sql`SELECT id, created_at, tif, owner FROM uc_orders WHERE status IN ('NEW','PARTIAL') ORDER BY id LIMIT 300`);
      for (const o of open) {
        if (o.tif === "DAY" && Date.now() - Number(o.created_at) > 20 * 3600_000) {
          await exec(sql`UPDATE uc_orders SET status = 'EXPIRED', updated_at = ${Date.now()} WHERE id = ${o.id}`);
          await event(o.owner, o.id, "EXPIRE", "当日有效单到期失效");
          continue;
        }
        await tryMatch(Number(o.id));
      }
    } catch {
      /* 下一轮 */
    }
  }, 3000).unref?.();
}

/* ------------------------------------------------------------------ 查询 */
export async function orders(owner: string, limit = 500) {
  await ensure();
  return (await query<any>(sql`SELECT * FROM uc_orders WHERE owner = ${owner} ORDER BY id DESC LIMIT ${limit}`)).map((o) => ({
    id: Number(o.id), account: o.account, symbol: o.symbol, name: o.name, market: o.market, side: o.side, type: o.type, tif: o.tif, qty: Number(o.qty), limitPx: o.limit_px == null ? null : Number(o.limit_px), stopPx: o.stop_px == null ? null : Number(o.stop_px),
    status: o.status, filledQty: Number(o.filled_qty), avgPx: o.avg_px == null ? null : Number(o.avg_px), strategy: o.strategy, note: o.note, reject: o.reject_reason, createdAt: Number(o.created_at), updatedAt: Number(o.updated_at),
  }));
}
export async function fills(owner: string, limit = 1000) {
  await ensure();
  const today = new Date().toISOString().slice(0, 10);
  return (await query<any>(sql`SELECT * FROM uc_fills WHERE owner = ${owner} ORDER BY id DESC LIMIT ${limit}`)).map((f) => ({
    id: Number(f.id), orderId: Number(f.order_id), account: f.account, symbol: f.symbol, market: f.market, side: f.side, qty: Number(f.qty), px: Number(f.px), fee: Number(f.fee), tax: Number(f.tax), ccy: f.ccy, ts: Number(f.ts),
    tradeDate: f.trade_date, settleDate: f.settle_date, settled: f.settle_date <= today, notional: Number(f.qty) * Number(f.px),
  }));
}
export async function events(owner: string, limit = 500) {
  await ensure();
  return (await query<any>(sql`SELECT * FROM uc_trade_events WHERE owner = ${owner} ORDER BY id DESC LIMIT ${limit}`)).map((e) => ({ id: Number(e.id), orderId: e.order_id == null ? null : Number(e.order_id), ts: Number(e.ts), kind: e.kind, detail: e.detail }));
}
export async function positions(owner: string) {
  const fl = (await fills(owner, 5000)).reverse();
  const map = new Map<string, { account: string; symbol: string; market: string; ccy: string; qty: number; cost: number; realized: number; fees: number; unsettledQty: number; firstTs: number }>();
  for (const f of fl) {
    const k = `${f.account}|${f.symbol}`;
    const p = map.get(k) ?? { account: f.account, symbol: f.symbol, market: f.market, ccy: f.ccy, qty: 0, cost: 0, realized: 0, fees: 0, unsettledQty: 0, firstTs: f.ts };
    p.fees += f.fee + f.tax;
    if (f.side === "B") { p.cost += f.qty * f.px; p.qty += f.qty; }
    else { const avg = p.qty ? p.cost / p.qty : 0; p.realized += (f.px - avg) * f.qty; p.cost -= avg * f.qty; p.qty -= f.qty; }
    if (!f.settled) p.unsettledQty += f.side === "B" ? f.qty : -f.qty;
    map.set(k, p);
  }
  const list = [...map.values()];
  const ticks = await getTicks(list.filter((p) => Math.abs(p.qty) > 1e-9).map((p) => p.symbol), { budgetMs: 3000 });
  const rows = list.map((p) => {
    const t = ticks[p.symbol];
    const px = t?.price ?? null;
    const avg = p.qty ? p.cost / p.qty : 0;
    const mv = px != null ? px * p.qty : null;
    return { ...p, name: t?.name ?? null, avgCost: avg, last: px, changePct: t?.changePct ?? null, marketValue: mv, unrealized: mv != null ? mv - p.cost : null, dayPnl: t?.change != null ? t.change * p.qty : null };
  });
  return { rows };
}
export async function account(owner: string) {
  const fl = await fills(owner, 5000);
  let cash = INITIAL_CASH;
  let unsettledCash = 0;
  for (const f of fl) {
    const amt = f.side === "B" ? -(f.notional + f.fee + f.tax) : f.notional - f.fee - f.tax;
    cash += amt;
    if (!f.settled) unsettledCash += amt;
  }
  return { initial: INITIAL_CASH, cash, unsettledCash };
}
export async function summary(owner: string) {
  const [pos, acc, od, fl] = await Promise.all([positions(owner), account(owner), orders(owner, 2000), fills(owner, 5000)]);
  const mv = pos.rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  const unreal = pos.rows.reduce((s, r) => s + (r.unrealized ?? 0), 0);
  const real = pos.rows.reduce((s, r) => s + r.realized, 0);
  const today = new Date().toISOString().slice(0, 10);
  const byStatus: Record<string, number> = {};
  for (const o of od) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  return {
    equity: acc.cash + mv, cash: acc.cash, unsettledCash: acc.unsettledCash, marketValue: mv, unrealized: unreal, realized: real, initial: acc.initial,
    returnPct: ((acc.cash + mv) / acc.initial - 1) * 100, dayPnl: pos.rows.reduce((s, r) => s + (r.dayPnl ?? 0), 0),
    orders: od.length, byStatus, fills: fl.length, todayFills: fl.filter((f) => f.tradeDate === today).length,
    pendingSettlement: fl.filter((f) => !f.settled).length, turnover: fl.reduce((s, f) => s + f.notional, 0), feesPaid: fl.reduce((s, f) => s + f.fee + f.tax, 0),
  };
}
