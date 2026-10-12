/**
 * 佑诚实时行情客户端：
 *  - 页面上所有组件订阅的代码合并成一次请求，每 3 秒刷新（页面隐藏时暂停）
 *  - K 线读取直接走独立请求，不被其他慢接口的批量请求拖住
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type Tick = {
  symbol: string;
  name: string | null;
  price: number;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  amount: number | null;
  time: number;
};
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number | null; s?: "pre" | "post" };
export type Period = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1w" | "1M";

export const UP = "#f2495c";
export const DOWN = "#1fbf75";
export const FLAT = "#94a3b8";
export const toneOf = (v: number | null | undefined) => (v == null || v === 0 ? FLAT : v > 0 ? UP : DOWN);

export async function ucGet<T>(path: string, input: unknown, signal?: AbortSignal): Promise<T> {
  const url = `/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetch(url, { credentials: "include", signal });
  const body = await res.json();
  if (!res.ok || body?.error) throw new Error(body?.error?.json?.message ?? `HTTP ${res.status}`);
  return body.result.data.json as T;
}

/* ------------------------------------------------------------ tick hub
 * 首选服务端推送（一个长连接，价格变了立刻推过来）；推送不可用时退回 3 秒轮询。 */
const POLL_MS = 3000;
const counts = new Map<string, number>();
let ticks: Record<string, Tick | null> = {};
let lastAt = 0;
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
const listeners = new Set<() => void>();
let es: EventSource | null = null;
let esKey = "";
let esFails = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function applyTicks(map: Record<string, Tick | null>, at: number) {
  const next = { ...ticks };
  for (const [k, v] of Object.entries(map)) if (v || !(k in next)) next[k] = v;
  ticks = next;
  lastAt = at;
  emit();
}

function streamable() {
  return typeof window !== "undefined" && typeof EventSource !== "undefined" && esFails < 3;
}

function reconnect() {
  reconnectTimer = null;
  const symbols = [...counts.keys()].sort();
  const key = symbols.join(",");
  if (key === esKey && es) return;
  es?.close();
  es = null;
  esKey = key;
  if (!symbols.length) return;
  const src = new EventSource(`/api/uc/quotes?symbols=${encodeURIComponent(key)}`, { withCredentials: true });
  es = src;
  src.addEventListener("ticks", (e) => {
    esFails = 0;
    try {
      const body = JSON.parse((e as MessageEvent).data) as { at: number; ticks: Record<string, Tick> };
      applyTicks(body.ticks, body.at);
    } catch {
      /* 忽略坏包 */
    }
  });
  src.onerror = () => {
    if (src.readyState === EventSource.CLOSED) {
      esFails += 1;
      if (es === src) {
        es = null;
        esKey = "";
      }
      if (!timer) timer = setTimeout(poll, 50);
    }
  };
}
function scheduleReconnect(delay: number) {
  if (!streamable()) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(reconnect, delay);
}

async function poll() {
  timer = null;
  const symbols = [...counts.keys()];
  if (!symbols.length) return;
  // 推送通道正常时，轮询只做兜底（每 15 秒一次，补首屏和断线期间的数据）
  const streaming = !!es && es.readyState === EventSource.OPEN;
  if (typeof document !== "undefined" && document.hidden) {
    timer = setTimeout(poll, POLL_MS);
    return;
  }
  if (!inflight) {
    inflight = true;
    try {
      const res = await ucGet<{ at: number; ticks: Record<string, Tick | null> }>("ucMarket.ticks", { symbols }, AbortSignal.timeout(15000));
      applyTicks(res.ticks, res.at);
    } catch {
      /* 下一轮重试 */
    } finally {
      inflight = false;
    }
  }
  if (counts.size) timer = setTimeout(poll, streaming ? 15000 : POLL_MS);
}

function subscribe(symbols: string[]) {
  let added = false;
  for (const s of symbols) {
    const n = counts.get(s) ?? 0;
    counts.set(s, n + 1);
    if (!n) added = true;
  }
  if (added) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(poll, 30);
    scheduleReconnect(300);
  } else if (!timer && !inflight) timer = setTimeout(poll, POLL_MS);
  return () => {
    let removed = false;
    for (const s of symbols) {
      const n = (counts.get(s) ?? 1) - 1;
      if (n <= 0) {
        counts.delete(s);
        removed = true;
      } else counts.set(s, n);
    }
    if (removed) scheduleReconnect(2000);
  };
}

export function useTicks(symbols: string[]) {
  const key = symbols.join("|");
  useEffect(() => subscribe(key ? key.split("|") : []), [key]);
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  return useMemo(() => {
    const out: Record<string, Tick | null | undefined> = {};
    for (const s of symbols) out[s] = ticks[s];
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
export function useTick(symbol: string | null | undefined) {
  const map = useTicks(symbol ? [symbol] : []);
  return symbol ? map[symbol] ?? null : null;
}
export const ticksUpdatedAt = () => lastAt;

/* ------------------------------------------------------------ K 线 */
const PERIOD_MS: Record<Period, number> = { "1m": 60e3, "5m": 300e3, "15m": 900e3, "30m": 1800e3, "60m": 3600e3, "1d": 86400e3, "1w": 7 * 86400e3, "1M": 31 * 86400e3 };
const REFRESH_MS: Record<Period, number> = { "1m": 20e3, "5m": 30e3, "15m": 60e3, "30m": 60e3, "60m": 120e3, "1d": 120e3, "1w": 300e3, "1M": 300e3 };
const klineStore = new Map<string, { at: number; candles: Candle[] }>();

export function useKline(symbol: string | null, period: Period, limit = 240) {
  const key = symbol ? `${symbol}|${period}|${limit}` : "";
  const [state, setState] = useState<{ key: string; candles: Candle[]; loading: boolean; error: string | null }>(() => ({
    key,
    candles: klineStore.get(key)?.candles ?? [],
    loading: !!symbol && !klineStore.has(key),
    error: null,
  }));
  useEffect(() => {
    if (!symbol) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;
    const cached = klineStore.get(key);
    setState({ key, candles: cached?.candles ?? [], loading: !cached, error: null });
    let full = 0;
    const load = async () => {
      try {
        const prev = klineStore.get(key)?.candles ?? [];
        // 已有序列时只取增量（最后一根及之后），每 20 次做一次全量校准
        if (prev.length > 5 && full++ % 20 !== 0) {
          const since = prev[prev.length - 1].t;
          const res = await ucGet<{ candles: Candle[] }>("ucMarket.klineTail", { symbol, period, limit, since }, AbortSignal.timeout(15000));
          if (!alive) return;
          const merged = res.candles.length ? [...prev.filter((c) => c.t < res.candles[0].t), ...res.candles].slice(-limit) : prev;
          klineStore.set(key, { at: Date.now(), candles: merged });
          setState({ key, candles: merged, loading: false, error: null });
          if (alive) t = setTimeout(load, REFRESH_MS[period]);
          return;
        }
        const res = await ucGet<{ candles: Candle[] }>("ucMarket.kline", { symbol, period, limit }, AbortSignal.timeout(20000));
        if (!alive) return;
        klineStore.set(key, { at: Date.now(), candles: res.candles });
        setState({ key, candles: res.candles, loading: false, error: res.candles.length ? null : "暂无K线" });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "读取失败" }));
      }
      if (alive) t = setTimeout(load, REFRESH_MS[period]);
    };
    if (!cached || Date.now() - cached.at > REFRESH_MS[period] / 2) void load();
    else t = setTimeout(load, REFRESH_MS[period]);
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
  }, [key, symbol, period, limit]);
  return state.key === key ? state : { key, candles: [], loading: !!symbol, error: null };
}

/** 把最新报价并入最后一根 K 线：同一周期内更新收/高/低，跨周期则新开一根，K 线因此随行情实时跳动。 */
export function mergeTick(candles: Candle[], tick: Tick | null | undefined, period: Period): Candle[] {
  if (!candles.length || !tick || !Number.isFinite(tick.price)) return candles;
  const last = candles[candles.length - 1];
  const p = tick.price;
  const intraday = period.endsWith("m") && period !== "1M";
  if (intraday) {
    const span = PERIOD_MS[period];
    const bucket = Math.floor(tick.time / span) * span;
    if (bucket > last.t + span - 1 && tick.time - last.t < 4 * 3600e3) {
      return [...candles.slice(-999), { t: bucket, o: last.c, h: Math.max(last.c, p), l: Math.min(last.c, p), c: p, v: null }];
    }
  } else if (period === "1d") {
    const dayOf = (ms: number) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
    if (dayOf(tick.time) > dayOf(last.t) && tick.time > last.t) {
      const o = tick.open ?? last.c;
      return [...candles, { t: tick.time, o, h: Math.max(tick.high ?? p, o, p), l: Math.min(tick.low ?? p, o, p), c: p, v: tick.volume }];
    }
  }
  if (tick.time < last.t - PERIOD_MS[period]) return candles;
  const merged: Candle = { ...last, c: p, h: Math.max(last.h, p), l: Math.min(last.l, p) };
  if (period === "1d") {
    if (tick.high != null && tick.high > 0) merged.h = Math.max(merged.h, tick.high);
    if (tick.low != null && tick.low > 0) merged.l = Math.min(merged.l, tick.low);
    if (tick.volume != null) merged.v = tick.volume;
  }
  return [...candles.slice(0, -1), merged];
}

export function useLiveKline(symbol: string | null, period: Period, limit = 240) {
  const k = useKline(symbol, period, limit);
  const tick = useTick(symbol);
  const candles = useMemo(() => mergeTick(k.candles, tick, period), [k.candles, tick, period]);
  return { ...k, candles, tick };
}

export function fmtPrice(v: number | null | undefined, digits?: number) {
  if (v == null || !Number.isFinite(v)) return "—";
  const d = digits ?? (Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 2 : 4);
  return v.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtCompact(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}万亿`;
  if (a >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(v / 1e4).toFixed(2)}万`;
  return v.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}
export function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

/** 价格变化闪烁：返回 'up' | 'down' | null，持续 700ms */
export function useFlash(value: number | null | undefined) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [prev, setPrev] = useState(value);
  useEffect(() => {
    if (value == null || prev == null || value === prev) {
      setPrev(value);
      return;
    }
    setFlash(value > prev ? "up" : "down");
    setPrev(value);
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return flash;
}

/** 证券清单代码 → 行情代码（服务端会把各国交易所后缀自动换算成可查询的代码） */
export function listingToSymbol(countryCode: string, symbol: string) {
  const s = symbol.toUpperCase().trim();
  if (countryCode === "US") return s.replace(/\.(N|O|A|OQ)$/, "");
  return s;
}

/* ------------------------------------------------------------ 盘前盘后 / 新闻 / 基本面 */
export type SessionInfo = {
  state: "pre" | "regular" | "post" | "closed";
  regular: { price: number | null; prevClose: number | null; time: number | null };
  pre: { price: number; change: number; changePct: number; time: number; high: number; low: number } | null;
  post: { price: number; change: number; changePct: number; time: number; high: number; low: number } | null;
};
export type NewsItem = { id: string; title: string; summary: string | null; url: string | null; time: number; tone: 1 | 0 | -1; tags: string[] };
export type Profile = {
  symbol: string;
  name: string | null;
  currency: string | null;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  metrics: Array<{ key: string; label: string; value: number | null; unit?: string }>;
  financials: Array<{ label: string; unit: string; points: Array<{ period: string; value: number }> }>;
};

export function usePolled<T>(path: string, input: Record<string, unknown> | null, everyMs: number) {
  const key = input ? JSON.stringify(input) : "";
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean }>({ key, data: null, loading: !!input });
  useEffect(() => {
    if (!input) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout> | null = null;
    setState((s) => (s.key === key ? s : { key, data: null, loading: true }));
    let got = false;
    let fails = 0;
    const load = async () => {
      let ok = false;
      try {
        const data = await ucGet<T>(path, input, AbortSignal.timeout(30000));
        if (alive) setState({ key, data, loading: false });
        got = true;
        ok = true;
        fails = 0;
      } catch {
        fails++;
        // 首次还没拿到数据时不立即熄灭加载态：服务端首次汇总较慢，短间隔重试（结果会在服务端缓存）
        if (alive && (got || fails >= 4)) setState((s) => ({ ...s, key, loading: false }));
      }
      if (alive && !ok && !got && fails < 4) t = setTimeout(load, 3000);
      else if (alive && !(typeof document !== "undefined" && document.hidden)) t = setTimeout(load, everyMs);
      else if (alive) t = setTimeout(load, everyMs * 2);
    };
    void load();
    return () => {
      alive = false;
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, everyMs]);
  return state.key === key ? state : { key, data: null, loading: !!input };
}
export const useSession = (symbol: string | null) => usePolled<SessionInfo | null>("ucMarket.session", symbol ? { symbol } : null, 15_000);
export const useNews = (symbol: string | null, name?: string | null) => usePolled<NewsItem[]>("ucMarket.news", symbol ? { symbol, name: name ?? undefined } : null, 120_000);
export const useProfile = (symbol: string | null) => usePolled<Profile | null>("ucMarket.profile", symbol ? { symbol } : null, 300_000);
