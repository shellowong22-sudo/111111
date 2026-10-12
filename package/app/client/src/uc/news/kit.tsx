/**
 * 新闻终端公用部件：数据钩子、行组件、标的标签、阅读器。
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DOWN, FLAT, UP, fmtPct, fmtPrice, toneOf, ucGet, usePolled, useTicks } from "@/uc/market/live";

export type News = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  time: number;
  lang: string;
  region: string;
  cats: string[];
  tone: 1 | 0 | -1;
  toneScore: number;
  tickers: string[];
  cluster: string;
  heat: number;
  score: number;
  kind: "flash" | "article";
};
export type FeedInput = { cats?: string[]; region?: string; lang?: string; q?: string; symbol?: string; kind?: "flash" | "article"; tone?: number; sort?: "time" | "score" | "heat"; limit?: number; hours?: number; dedupe?: boolean };

/* ------------------------------------------------------------------ 偏好 */
export type Prefs = { scale: number; refresh: number; langs: string[]; showSummary: boolean; home: string };
export const DEFAULT_PREFS: Prefs = { scale: 1, refresh: 30, langs: ["zh", "en", "ja", "de", "fr", "zh-TW", "ko"], showSummary: true, home: "top" };
export const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...(fallback as object), ...JSON.parse(raw) } as T : fallback;
  } catch {
    return fallback;
  }
};
export const readLocalList = <T,>(key: string, fallback: T[]): T[] => {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
export const writeLocal = (key: string, v: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 无痕模式不保存 */
  }
};

type Ctx = { prefs: Prefs; open: (n: News) => void; openSymbol: (s: string) => void; selected: string | null };
export const NewsCtx = createContext<Ctx>({ prefs: DEFAULT_PREFS, open: () => undefined, openSymbol: () => undefined, selected: null });
export const useNewsCtx = () => useContext(NewsCtx);

export function useFeed(input: FeedInput | null, everyMs?: number) {
  const { prefs } = useNewsCtx();
  const r = usePolled<{ at: number; items: News[] }>("ucNews.feed", input as Record<string, unknown> | null, everyMs ?? prefs.refresh * 1000);
  const items = useMemo(() => (r.data?.items ?? []).filter((n) => prefs.langs.includes(n.lang)), [r.data, prefs.langs]);
  return { items, loading: r.loading, at: r.data?.at ?? null };
}

/* ------------------------------------------------------------------ 格式 */
export function fmtTime(t: number, withDate = false) {
  const d = new Date(t);
  const now = new Date();
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!withDate && d.toDateString() === now.toDateString()) return hm;
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${hm}`;
}
export function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)}小时前`;
  return `${Math.floor(s / 86400)}天前`;
}
export const TONE_LABEL = { 1: "利好", 0: "中性", [-1]: "利空" } as Record<number, string>;
export const toneColor = (t: number) => (t > 0 ? UP : t < 0 ? DOWN : FLAT);
const LANG_LABEL: Record<string, string> = { zh: "中", en: "英", ja: "日", de: "德", fr: "法", "zh-TW": "繁", ko: "韩" };

/* ------------------------------------------------------------------ 标的标签（实时涨跌） */
const SYMBOL_NAME: Record<string, string> = {
  GC: "黄金", CL: "原油", BRENT: "布油", SI: "白银", HG: "铜", NG: "天然气", BTC: "比特币", ETH: "以太坊", DXY: "美元指数", USDCNH: "离岸人民币", USDJPY: "美元日元", EURUSD: "欧元美元",
  "^GSPC": "标普500", "^IXIC": "纳指", "^DJI": "道指", "^HSI": "恒指", "000001.SH": "上证", "000300.SH": "沪深300", "399006.SZ": "创业板", "^N225": "日经", "^GDAXI": "DAX", "^FTSE": "富时", ZN: "美债期货", "^VIX": "VIX",
};
export function TickerChips({ symbols, max = 4 }: { symbols: string[]; max?: number }) {
  const list = symbols.slice(0, max);
  const ticks = useTicks(list);
  const { openSymbol } = useNewsCtx();
  if (!list.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {list.map((s) => {
        const t = ticks[s];
        return (
          <button key={s} type="button" onClick={(e) => { e.stopPropagation(); openSymbol(s); }} className="font-mono text-[10px] hover:underline" style={{ color: toneOf(t?.changePct) }} title={`查看 ${s} 行情、K线与新闻`}>
            {SYMBOL_NAME[s] ?? s}{t ? ` ${fmtPct(t.changePct)}` : ""}
          </button>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ 新闻行 */
export function NewsRow({ n, rank, showSummary, dense }: { n: News; rank?: number; showSummary?: boolean; dense?: boolean }) {
  const { open, selected, prefs } = useNewsCtx();
  const active = selected === n.id;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open(n)}
      onKeyDown={(e) => e.key === "Enter" && open(n)}
      className={`group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-x-2 border-b border-[#111d2b] px-2 ${dense ? "py-1" : "py-1.5"} ${active ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}
    >
      <div className="flex w-[54px] flex-col items-start pt-0.5">
        <span className="font-mono text-[10px] text-slate-500">{rank != null ? <b className="mr-1 text-amber-300">{rank}</b> : null}{fmtTime(n.time)}</span>
        <span className="mt-0.5 h-[3px] w-full" style={{ background: toneColor(n.tone), opacity: n.tone ? 0.9 : 0.25 }} title={TONE_LABEL[n.tone]} />
      </div>
      <div className="min-w-0">
        <div className={`leading-snug ${active ? "text-white" : "text-slate-200 group-hover:text-white"}`} style={{ fontSize: `${12 * prefs.scale}px` }}>
          {n.kind === "flash" && <span className="mr-1 text-[10px] font-semibold text-amber-300">快讯</span>}
          {n.title}
        </div>
        {(showSummary ?? prefs.showSummary) && n.summary && !dense && <p className="mt-0.5 line-clamp-2 text-slate-500" style={{ fontSize: `${10.5 * prefs.scale}px` }}>{n.summary}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
          <span style={{ color: toneColor(n.tone) }}>{TONE_LABEL[n.tone]}</span>
          {n.heat > 1 && <span className="text-orange-300" title="同一事件的报道数量">热度 {n.heat}</span>}
          {n.lang !== "zh" && <span className="text-slate-600">{LANG_LABEL[n.lang] ?? n.lang}</span>}
          {n.cats.slice(0, 3).map((c) => <span key={c} className="text-cyan-600">{c}</span>)}
          <TickerChips symbols={n.tickers} max={3} />
        </div>
      </div>
    </div>
  );
}

export function FeedList({ items, loading, empty = "暂无新闻", ranked, dense, max = 200 }: { items: News[]; loading?: boolean; empty?: string; ranked?: boolean; dense?: boolean; max?: number }) {
  if (loading && !items.length) return <div className="px-3 py-10 text-center text-[11px] text-slate-500">读取中…</div>;
  if (!items.length) return <div className="px-3 py-10 text-center text-[11px] text-slate-500">{empty}</div>;
  return <div>{items.slice(0, max).map((n, i) => <NewsRow key={n.id} n={n} rank={ranked ? i + 1 : undefined} dense={dense} />)}</div>;
}

/* ------------------------------------------------------------------ 小部件 */
export function SectionHead({ title, right, sub }: { title: string; right?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1">
      <span className="flex items-baseline gap-2"><span className="text-[11px] font-semibold tracking-wide text-cyan-200">{title}</span>{sub && <span className="text-[10px] text-slate-500">{sub}</span>}</span>
      <span className="flex items-center gap-1 text-[10px] text-slate-500">{right}</span>
    </div>
  );
}
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <span className="inline-flex border border-[#1d3047]">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`px-1.5 py-0.5 text-[10px] ${value === v ? "bg-cyan-700/40 text-cyan-50" : "text-slate-400 hover:bg-[#0c1d2f] hover:text-slate-100"}`}>{l}</button>
      ))}
    </span>
  );
}
export function Spark({ values, width = 90, height = 18, color = "#38bdf8" }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 2) - 1).toFixed(1)}`).join(" ");
  return <svg width={width} height={height} className="shrink-0"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} /></svg>;
}
export function QuoteStrip({ symbols, labels }: { symbols: string[]; labels?: Record<string, string> }) {
  const ticks = useTicks(symbols);
  const { openSymbol } = useNewsCtx();
  return (
    <div className="flex min-w-0 overflow-x-auto border-b border-[#1a2a3c] bg-[#060d16]">
      {symbols.map((s) => {
        const t = ticks[s];
        const c = toneOf(t?.changePct);
        return (
          <button key={s} type="button" onClick={() => openSymbol(s)} className="min-w-[104px] shrink-0 border-r border-[#13202f] px-2 py-1 text-left hover:bg-[#0b1a2a]">
            <div className="truncate text-[10px] text-slate-400">{labels?.[s] ?? SYMBOL_NAME[s] ?? t?.name ?? s}</div>
            <div className="font-mono text-[12px] font-semibold" style={{ color: c }}>{fmtPrice(t?.price)}</div>
            <div className="font-mono text-[10px]" style={{ color: c }}>{fmtPct(t?.changePct)}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ 阅读器 */
type Article = { title: string | null; text: string; url: string; related?: Array<{ id: string; title: string; time: number }> };
export function Reader({ item, onClose }: { item: News; onClose: () => void }) {
  const [state, setState] = useState<{ id: string; loading: boolean; article: Article | null; error: string | null }>({ id: item.id, loading: false, article: null, error: null });
  const { prefs } = useNewsCtx();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!item.url && !item.id) {
      setState({ id: item.id, loading: false, article: null, error: null });
      return;
    }
    let alive = true;
    setState({ id: item.id, loading: true, article: null, error: null });
    ucGet<Article>("ucNews.read", { id: item.id, url: item.url }, AbortSignal.timeout(60000))
      .then((a) => alive && setState({ id: item.id, loading: false, article: a, error: null }))
      .catch((e) => alive && setState({ id: item.id, loading: false, article: null, error: e instanceof Error ? e.message : "正文读取失败" }));
    return () => {
      alive = false;
    };
  }, [item.id, item.url, retry]);
  const paras = (state.article?.text ?? "").split(/\n\n+/).filter(Boolean);
  const copy = () => {
    const text = `${item.title}\n${fmtTime(item.time, true)}\n\n${state.article?.text ?? item.summary ?? ""}\n\n${item.url ?? ""}`;
    void navigator.clipboard?.writeText(text);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[#1a2a3c] bg-[#08121e] px-3 py-1">
        <span className="text-[11px] font-semibold text-cyan-200">阅读</span>
        <span className="flex items-center gap-2 text-[10px]">
          <button type="button" onClick={copy} className="text-slate-400 hover:text-white">复制全文</button>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">关闭 ✕</button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-slate-500">
          <span className="font-mono">{fmtTime(item.time, true)}</span>
          <span style={{ color: toneColor(item.tone) }}>{TONE_LABEL[item.tone]}（{(item.toneScore * 100).toFixed(0)}）</span>
          {item.heat > 1 && <span className="text-orange-300">{item.heat} 篇相关报道</span>}
          <span>{item.region}</span>
          {item.cats.map((c) => <span key={c} className="text-cyan-500">#{c}</span>)}
        </div>
        <h2 className="mt-2 font-semibold leading-snug text-white" style={{ fontSize: `${17 * prefs.scale}px` }}>{state.article?.title && state.article.title.length > item.title.length / 2 && item.lang !== "zh" ? state.article.title : item.title}</h2>
        {item.tickers.length > 0 && (
          <div className="mt-2 border-y border-[#16263a] py-1.5">
            <span className="mr-2 text-[10px] text-slate-500">关联标的</span>
            <TickerChips symbols={item.tickers} max={6} />
          </div>
        )}
        {item.summary && <p className="mt-3 border-l-2 border-cyan-700 pl-2 leading-relaxed text-slate-300" style={{ fontSize: `${12.5 * prefs.scale}px` }}>{item.summary}</p>}
        <div className="mt-3 space-y-3 leading-relaxed text-slate-200" style={{ fontSize: `${13 * prefs.scale}px` }}>
          {state.loading && <p className="text-[11px] text-slate-500">正文提取中…</p>}
          {state.error && !item.summary && <p className="text-[11px] text-slate-500">该篇正文暂时无法提取，稍后重试。</p>}
          {state.error && <button type="button" onClick={() => setRetry((n) => n + 1)} className="text-[11px] text-cyan-300 hover:text-white">重新提取正文</button>}
          {paras.map((p, i) => (/^#{1,3}\s/.test(p) ? <h3 key={i} className="pt-1 font-semibold text-white">{p.replace(/^#+\s*/, "")}</h3> : <p key={i} className="whitespace-pre-wrap">{p.replace(/^\s*[*-]\s+/gm, "• ")}</p>))}
        </div>
        {!!state.article?.related?.length && (
          <div className="mt-4 border-t border-[#16263a] pt-2">
            <div className="mb-1 text-[10px] text-slate-500">同一事件的其他报道</div>
            {state.article.related.map((r) => <div key={r.id} className="py-0.5 text-[11px] text-slate-400"><span className="mr-2 font-mono text-[10px] text-slate-600">{fmtTime(r.time)}</span>{r.title}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

export { UP, DOWN, FLAT };

/** 终端内阅读抽屉：任何页面点新闻都在这里看全文，不跳转外部网站 */
export function ReaderDrawer({ item, onClose }: { item: News | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-[640px] border-l border-[#1a2a3c] bg-[#050a11] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Reader item={item} onClose={onClose} />
      </div>
    </div>
  );
}

/** 把简单的新闻条目（标题 / 摘要 / 链接 / 时间 / 情绪）转成阅读器格式 */
export function toNews(x: { id: string; title: string; summary?: string | null; url?: string | null; time: number; tone?: number; tags?: string[] }, tickers: string[] = []): News {
  const tone = (x.tone ?? 0) > 0 ? 1 : (x.tone ?? 0) < 0 ? -1 : 0;
  return { id: x.id, title: x.title, summary: x.summary ?? null, url: x.url ?? null, time: x.time, lang: /[\u4e00-\u9fff]/.test(x.title) ? "zh" : "en", region: "", cats: x.tags ?? [], tone, toneScore: tone, tickers, cluster: x.id, heat: 1, score: 0, kind: "article" };
}
