/**
 * 开盘前预热：在 A股 / 港股 / 美股（含盘前）开盘前 20 分钟内，把常用标的的报价、日 K、分钟 K 提前拉进内存缓存，
 * 并写入平台自有库；开盘第一秒用户打开页面时直接命中缓存。启动 60 秒后也预热一次。
 */
import { WEI_BOARDS, getKline, getTicks, parseSymbol } from "./market";

const EXTRA_HOT = ["SPY", "QQQ", "IWM", "DIA", "TLT", "IEF", "HYG", "LQD", "GLD", "SLV", "USO", "VNQ", "XLF", "XLK", "XLE", "SMH", "MBB", "PFF", "^VIX", "^TNX", "^IRX", "^MOVE", "CL", "GC", "SI", "HG", "NG", "ZN", "ZT", "ES", "NQ", "EURUSD", "USDJPY", "USDCNH", "DXY", "BTC", "ETH", "sh000001", "sz399001", "sh000300", "0700.HK", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"];
type Mkt = "CN" | "HK" | "US";
const OPEN: Array<{ m: Mkt; tz: string; hh: number; mm: number; label: string }> = [
  { m: "CN", tz: "Asia/Shanghai", hh: 9, mm: 30, label: "A股" },
  { m: "HK", tz: "Asia/Hong_Kong", hh: 9, mm: 30, label: "港股" },
  { m: "US", tz: "America/New_York", hh: 4, mm: 0, label: "美股盘前" },
  { m: "US", tz: "America/New_York", hh: 9, mm: 30, label: "美股" },
];
const done = new Set<string>();
export const warmLog: Array<{ at: number; label: string; symbols: number; ms: number; ticks: number }> = [];

function hotSymbols() {
  const all = new Set<string>(EXTRA_HOT);
  for (const b of Object.values(WEI_BOARDS)) for (const s of b.symbols) all.add(s);
  return [...all];
}
function marketOf(s: string): Mkt | "OTHER" {
  const p = parseSymbol(s);
  if (p.kind === "cn") return "CN";
  if (p.kind === "hk") return "HK";
  if (p.kind === "us") return "US";
  return "OTHER";
}
function localParts(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date());
  const g = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, h: Number(g("hour")) % 24, m: Number(g("minute")), wd: g("weekday") };
}

export async function warm(label: string, market: Mkt | "ALL") {
  const t0 = Date.now();
  const syms = hotSymbols().filter((s) => market === "ALL" || marketOf(s) === market || (market === "US" && marketOf(s) === "OTHER"));
  const ticks = await getTicks(syms, { budgetMs: 30_000 }).catch(() => ({} as Record<string, unknown>));
  // 日 K（两年）与分钟 K：并发 6
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < syms.length) {
      const s = syms[i++];
      await getKline(s, "1d", 520).catch(() => []);
      await getKline(s, "1m", 240).catch(() => []);
    }
  }));
  warmLog.push({ at: Date.now(), label, symbols: syms.length, ms: Date.now() - t0, ticks: Object.values(ticks).filter(Boolean).length });
  if (warmLog.length > 50) warmLog.shift();
}

let started = false;
export function startWarmup() {
  if (started) return;
  started = true;
  setTimeout(() => void warm("启动预热", "ALL"), 60_000).unref?.();
  setInterval(() => {
    for (const o of OPEN) {
      const p = localParts(o.tz);
      if (p.wd === "Sat" || p.wd === "Sun") continue;
      const mins = p.h * 60 + p.m, open = o.hh * 60 + o.mm;
      const key = `${o.label}|${p.date}`;
      if (mins >= open - 20 && mins < open && !done.has(key)) {
        done.add(key);
        void warm(`${o.label}开盘前预热`, o.m);
      }
    }
    if (done.size > 200) done.clear();
  }, 60_000).unref?.();
}
