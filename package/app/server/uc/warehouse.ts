/**
 * 平台自有数据仓库：所有采集到的数据清洗去重后写进自己的数据库，永久保存。
 *  - uc_news：每一条新闻（含提取到的正文）
 *  - uc_kline：每一个标的、每一个周期的 K 线（上游没数据或变慢时直接从库里出）
 *  - uc_tick_minute：订阅标的的分钟级行情快照（自建分时历史）
 * 写入都是批量、异步的，不拖慢前端请求。
 */
import { sql } from "drizzle-orm";
import { exec, query } from "./store";

type NewsRow = { id: string; cluster: string; title: string; summary: string | null; url: string | null; time: number; lang: string; region: string; cats: string[]; tone: number; toneScore: number; tickers: string[]; kind: string; feed: string };
type Candle = { t: number; o: number; h: number; l: number; c: number; v: number | null; s?: string };

let dbOk = true;
const guard = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  if (!dbOk) return fallback;
  try {
    return await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/未连接|ECONNREFUSED|not connected/i.test(msg)) {
      dbOk = false;
      setTimeout(() => (dbOk = true), 60_000).unref?.();
    }
    return fallback;
  }
};

/* ------------------------------------------------------------------ 新闻 */
const newsQueue: NewsRow[] = [];
export function archiveNews(items: NewsRow[]) {
  newsQueue.push(...items);
}
async function flushNews() {
  while (newsQueue.length) {
    const batch = newsQueue.splice(0, 200);
    await guard(() => exec(sql`INSERT IGNORE INTO uc_news (id, cluster, title, summary, url, published_at, lang, region, cats, tone, tone_score, tickers, kind, feed) VALUES ${sql.join(
      batch.map((n) => sql`(${n.id}, ${n.cluster}, ${n.title.slice(0, 400)}, ${n.summary}, ${n.url?.slice(0, 1500) ?? null}, ${n.time}, ${n.lang}, ${n.region}, ${n.cats.join(",")}, ${n.tone}, ${n.toneScore}, ${n.tickers.join(",")}, ${n.kind}, ${n.feed})`),
      sql`, `,
    )}`), null);
  }
}
export async function saveArticleBody(id: string, body: string) {
  await guard(() => exec(sql`UPDATE uc_news SET body = ${body.slice(0, 200000)} WHERE id = ${id}`), null);
}
export async function loadArticleBody(id: string): Promise<string | null> {
  const rows = await guard(() => query<{ body: string | null }>(sql`SELECT body FROM uc_news WHERE id = ${id}`), []);
  return rows[0]?.body ?? null;
}
const fromRow = (r: any): NewsRow => ({
  id: r.id, cluster: r.cluster, title: r.title, summary: r.summary, url: r.url, time: Number(r.published_at), lang: r.lang, region: r.region,
  cats: r.cats ? String(r.cats).split(",").filter(Boolean) : [], tone: Number(r.tone), toneScore: Number(r.tone_score), tickers: r.tickers ? String(r.tickers).split(",").filter(Boolean) : [], kind: r.kind, feed: r.feed,
});
export async function loadNewsSince(since: number): Promise<NewsRow[]> {
  const rows = await guard(() => query(sql`SELECT id, cluster, title, summary, url, published_at, lang, region, cats, tone, tone_score, tickers, kind, feed FROM uc_news WHERE published_at >= ${since} ORDER BY published_at DESC LIMIT 20000`), []);
  return rows.map(fromRow);
}
/** 历史检索（超过内存保留期的旧新闻） */
export async function searchArchive(opts: { q?: string; symbol?: string; cat?: string; before?: number; limit?: number }): Promise<NewsRow[]> {
  const conds = [sql`1 = 1`];
  if (opts.before) conds.push(sql`published_at < ${opts.before}`);
  if (opts.q) conds.push(sql`(title LIKE ${`%${opts.q}%`} OR summary LIKE ${`%${opts.q}%`})`);
  if (opts.symbol) conds.push(sql`FIND_IN_SET(${opts.symbol}, tickers) > 0`);
  if (opts.cat) conds.push(sql`FIND_IN_SET(${opts.cat}, cats) > 0`);
  const rows = await guard(() => query(sql`SELECT id, cluster, title, summary, url, published_at, lang, region, cats, tone, tone_score, tickers, kind, feed FROM uc_news WHERE ${sql.join(conds, sql` AND `)} ORDER BY published_at DESC LIMIT ${Math.min(500, opts.limit ?? 100)}`), []);
  return rows.map(fromRow);
}

/* ------------------------------------------------------------------ K 线 */
const klineQueue = new Map<string, { symbol: string; period: string; candles: Candle[] }>();
export function archiveKline(symbol: string, period: string, candles: Candle[]) {
  if (!candles.length) return;
  klineQueue.set(`${symbol}|${period}`, { symbol, period, candles });
}
async function flushKline() {
  for (const [key, job] of [...klineQueue.entries()]) {
    klineQueue.delete(key);
    for (let i = 0; i < job.candles.length; i += 400) {
      const batch = job.candles.slice(i, i + 400).filter((c) => [c.o, c.h, c.l, c.c].every((x) => Number.isFinite(x)));
      if (!batch.length) continue;
      await guard(() => exec(sql`INSERT INTO uc_kline (symbol, period, t, o, h, l, c, v, s) VALUES ${sql.join(batch.map((c) => sql`(${job.symbol}, ${job.period}, ${c.t}, ${c.o}, ${c.h}, ${c.l}, ${c.c}, ${c.v}, ${c.s ?? null})`), sql`, `)}
        ON DUPLICATE KEY UPDATE o = VALUES(o), h = VALUES(h), l = VALUES(l), c = VALUES(c), v = VALUES(v), s = VALUES(s)`), null);
    }
  }
}
export async function loadKline(symbol: string, period: string, limit: number): Promise<Candle[]> {
  const rows = await guard(() => query<{ t: number; o: number; h: number; l: number; c: number; v: number | null; s: string | null }>(sql`SELECT t, o, h, l, c, v, s FROM uc_kline WHERE symbol = ${symbol} AND period = ${period} ORDER BY t DESC LIMIT ${limit}`), []);
  return rows.reverse().map((r) => ({ t: Number(r.t), o: Number(r.o), h: Number(r.h), l: Number(r.l), c: Number(r.c), v: r.v == null ? null : Number(r.v), ...(r.s ? { s: r.s } : {}) }));
}

/** 由平台自有的分钟行情快照合成 K 线（上游无分时 / 历史的市场使用） */
export async function loadTickBars(symbol: string, minutes: number, limit: number): Promise<Candle[]> {
  const span = minutes * 60000;
  const rows = await guard(() => query<{ minute: number; price: number; volume: number | null }>(sql`SELECT minute, price, volume FROM uc_tick_minute WHERE symbol = ${symbol} ORDER BY minute DESC LIMIT ${Math.min(20000, limit * minutes)}`), []);
  const bars = new Map<number, Candle>();
  for (const r of rows.reverse()) {
    const t = Math.floor(Number(r.minute) / span) * span;
    const px = Number(r.price);
    const b = bars.get(t);
    if (!b) bars.set(t, { t, o: px, h: px, l: px, c: px, v: null });
    else { b.h = Math.max(b.h, px); b.l = Math.min(b.l, px); b.c = px; }
  }
  return [...bars.values()].slice(-limit);
}

/* ------------------------------------------------------------------ 分钟行情快照 */
const tickBuffer = new Map<string, { symbol: string; minute: number; price: number; pct: number | null; vol: number | null }>();
export function archiveTick(symbol: string, time: number, price: number, pct: number | null, vol: number | null) {
  if (!Number.isFinite(price) || price <= 0) return;
  const minute = Math.floor(time / 60000) * 60000;
  tickBuffer.set(`${symbol}|${minute}`, { symbol, minute, price, pct, vol });
}
async function flushTicks() {
  const rows = [...tickBuffer.values()];
  tickBuffer.clear();
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await guard(() => exec(sql`INSERT INTO uc_tick_minute (symbol, minute, price, change_pct, volume) VALUES ${sql.join(batch.map((r) => sql`(${r.symbol}, ${r.minute}, ${r.price}, ${r.pct}, ${r.vol})`), sql`, `)}
      ON DUPLICATE KEY UPDATE price = VALUES(price), change_pct = VALUES(change_pct), volume = VALUES(volume)`), null);
  }
}

export async function warehouseStats() {
  const one = async (table: string) => (await guard(() => query<{ n: number }>(sql.raw(`SELECT COUNT(*) AS n FROM ${table}`)), []))[0]?.n ?? 0;
  const [news, kline, ticks] = await Promise.all([one("uc_news"), one("uc_kline"), one("uc_tick_minute")]);
  const sym = (await guard(() => query<{ n: number }>(sql`SELECT COUNT(DISTINCT symbol) AS n FROM uc_kline`), []))[0]?.n ?? 0;
  return { news: Number(news), kline: Number(kline), ticks: Number(ticks), klineSymbols: Number(sym), partitions: partitionStatus };
}

/* ------------------------------------------------------------------ 按日分区（分钟行情）/ 按年分区（K 线） */
const DAY = 86400_000;
const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY;
const pname = (ms: number, yearly: boolean) => `p${new Date(ms).toISOString().slice(0, yearly ? 4 : 10).replace(/-/g, "")}`;
async function partitionsOf(table: string) {
  const rows = await query<{ name: string | null; descr: string | null }>(sql`SELECT PARTITION_NAME AS name, PARTITION_DESCRIPTION AS descr FROM information_schema.PARTITIONS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}`);
  return rows.filter((r) => r.name).map((r) => ({ name: String(r.name), upper: r.descr === "MAXVALUE" ? Infinity : Number(r.descr) }));
}
/** 分钟行情表：每天一个分区（向后预建 7 天）；K 线表：每年一个分区。只建新分区，不删除任何历史数据。 */
export async function ensurePartitions() {
  const status: Record<string, string> = {};
  for (const [table, col, yearly] of [["uc_tick_minute", "minute", false], ["uc_kline", "t", true]] as Array<[string, string, boolean]>) {
    try {
      const parts = await partitionsOf(table);
      const now = Date.now();
      const step = (ms: number) => (yearly ? Date.UTC(new Date(ms).getUTCFullYear() + 1, 0, 1) : dayStart(ms) + DAY);
      const horizon = yearly ? Date.UTC(new Date(now).getUTCFullYear() + 2, 0, 1) : dayStart(now) + 8 * DAY;
      if (!parts.length) {
        const [mn] = await query<{ m: number | null }>(sql.raw(`SELECT MIN(${col}) AS m FROM ${table}`));
        let start = Number(mn?.m ?? now);
        if (!Number.isFinite(start) || start <= 0) start = now;
        start = yearly ? Date.UTC(Math.max(1970, new Date(start).getUTCFullYear()), 0, 1) : dayStart(start);
        const defs: string[] = [];
        for (let b = start; b < horizon; ) { const nx = step(b); defs.push(`PARTITION ${pname(b, yearly)} VALUES LESS THAN (${nx})`); b = nx; if (defs.length > 400) break; }
        defs.push("PARTITION pmax VALUES LESS THAN MAXVALUE");
        await exec(sql.raw(`ALTER TABLE ${table} PARTITION BY RANGE (${col}) (${defs.join(", ")})`));
        status[table] = `已分区 ${defs.length} 个`;
        continue;
      }
      const finite = parts.filter((p) => Number.isFinite(p.upper));
      let top = finite.length ? Math.max(...finite.map((p) => p.upper)) : now;
      const add: string[] = [];
      while (top < horizon && add.length < 400) { const nx = step(top); add.push(`PARTITION ${pname(top, yearly)} VALUES LESS THAN (${nx})`); top = nx; }
      if (add.length && parts.some((p) => p.name === "pmax")) await exec(sql.raw(`ALTER TABLE ${table} REORGANIZE PARTITION pmax INTO (${add.join(", ")}, PARTITION pmax VALUES LESS THAN MAXVALUE)`));
      status[table] = `${parts.length + add.length} 个分区${add.length ? `（新增 ${add.length}）` : ""}`;
    } catch (error) {
      status[table] = `分区未启用：${error instanceof Error ? error.message.slice(0, 120) : String(error)}`;
    }
  }
  partitionStatus = status;
  return status;
}
export let partitionStatus: Record<string, string> = {};

let started = false;
export function startWarehouse() {
  if (started) return;
  started = true;
  setTimeout(() => void ensurePartitions(), 45_000).unref?.();
  setInterval(() => void ensurePartitions(), 6 * 3600_000).unref?.();
  setInterval(() => void flushNews().then(flushKline).then(flushTicks).catch(() => undefined), 20_000).unref?.();
}
