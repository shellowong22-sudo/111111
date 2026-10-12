/**
 * 新闻与研究中心的各个功能视图。每个功能看的是不同的东西，不做同质化页面：
 *  TOP 头条排行 · FIRS 7×24 快讯 · CN 标的研究 · NI 行业主题 · BECO 宏观与央行 · READ 热度榜 · TREN 热词趋势
 *  SOCI 情绪雷达 · INTL 全球多语种 · OPIN 观点评论 · DOCS 公告申报 · BNEF 能源商品 · DAYB 每日简报 · MYN 我的新闻 · NLRT 新闻提醒 · NZPD 偏好设置
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import KlineChart from "@/uc/market/KlineChart";
import EconCalendar from "./EconCalendar";
import { DOWN, FLAT, UP, fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useLiveKline, useProfile, useTicks, type Period } from "@/uc/market/live";
import {
  DEFAULT_PREFS, FeedList, NewsRow, QuoteStrip, SectionHead, Seg, Spark, TONE_LABEL, ago, fmtTime, readLocalList, toneColor, useFeed, useNewsCtx, writeLocal,
  type News, type Prefs,
} from "./kit";

const CATS = ["宏观", "央行", "A股", "港股", "美股", "欧洲", "日本", "新兴市场", "外汇", "债券", "商品", "能源", "科技", "金融", "地产", "消费", "医药", "汽车", "加密", "公司", "IPO", "政策", "地缘", "观点"];

/* ================================================================== TOP 头条 */
export function TopView() {
  const [hours, setHours] = useState<"6" | "24" | "72">("24");
  const { items, loading } = useFeed({ sort: "score", hours: Number(hours), limit: 60, kind: "article" });
  const { open } = useNewsCtx();
  const lead = items[0];
  return (
    <div>
      <SectionHead title="头条要闻" sub="按事件热度、重要性、关联标的综合排序" right={<Seg value={hours} onChange={setHours} options={[["6", "6小时"], ["24", "24小时"], ["72", "3天"]]} />} />
      {lead && (
        <div role="button" tabIndex={0} onClick={() => open(lead)} className="cursor-pointer border-b border-[#1a2a3c] px-3 py-3 hover:bg-[#0a1726]">
          <div className="flex items-center gap-2 text-[10px]"><span className="bg-amber-500/20 px-1 font-semibold text-amber-300">头条</span><span className="font-mono text-slate-500">{fmtTime(lead.time, true)}</span>{lead.heat > 1 && <span className="text-orange-300">{lead.heat} 篇报道</span>}<span style={{ color: toneColor(lead.tone) }}>{TONE_LABEL[lead.tone]}</span></div>
          <div className="mt-1 text-[17px] font-semibold leading-snug text-white">{lead.title}</div>
          {lead.summary && <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-slate-400">{lead.summary}</p>}
        </div>
      )}
      <FeedList items={items.slice(1)} loading={loading} ranked />
    </div>
  );
}

/* ================================================================== FIRS 快讯 */
export function FlashView() {
  const [paused, setPaused] = useState(false);
  const [important, setImportant] = useState(false);
  const { items, loading } = useFeed(paused ? null : { kind: "flash", limit: 200, dedupe: false }, 15000);
  const frozen = useRef<News[]>([]);
  if (!paused) frozen.current = items;
  const list = (paused ? frozen.current : items).filter((n) => !important || n.heat > 1 || /突发|重磅|紧急|美联储|央行|降息|加息|关税|暴跌|大涨|CPI|GDP|非农/.test(n.title));
  const seen = useRef<Set<string>>(new Set());
  const fresh = new Set(list.filter((n) => seen.current.size && !seen.current.has(n.id)).map((n) => n.id));
  useEffect(() => {
    for (const n of list) seen.current.add(n.id);
  });
  const { open, selected } = useNewsCtx();
  return (
    <div>
      <SectionHead title="7×24 快讯" sub={`${list.length} 条 · 每 15 秒更新`} right={<>
        <label className="flex items-center gap-1"><input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />只看重要</label>
        <button type="button" onClick={() => setPaused((p) => !p)} className={`border px-1.5 ${paused ? "border-amber-600 text-amber-300" : "border-[#1d3047] text-slate-300"}`}>{paused ? "▶ 继续" : "❚❚ 暂停"}</button>
      </>} />
      {loading && !list.length && <div className="px-3 py-10 text-center text-[11px] text-slate-500">读取中…</div>}
      <ol className="relative ml-3 border-l border-[#1a2a3c]">
        {list.map((n) => (
          <li key={n.id} onClick={() => open(n)} className={`relative cursor-pointer py-1.5 pl-3 pr-2 ${selected === n.id ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"} ${fresh.has(n.id) ? "animate-pulse" : ""}`}>
            <span className="absolute -left-[4px] top-[11px] h-[7px] w-[7px] rounded-full" style={{ background: toneColor(n.tone) }} />
            <span className="mr-2 font-mono text-[10px] text-amber-300/80">{fmtTime(n.time)}</span>
            <span className="text-[12px] text-slate-100">{n.title}</span>
            {n.summary && n.summary !== n.title && <p className="mt-0.5 line-clamp-2 text-[10.5px] text-slate-500">{n.summary}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ================================================================== CN 标的研究 */
const POPULAR = ["AAPL", "NVDA", "TSLA", "MSFT", "0700.HK", "9988.HK", "600519.SH", "300750.SZ", "7203.T", "005930.KS", "GC", "CL", "BTC", "^GSPC", "000001.SH", "^HSI"];
type MarketNews = { id: string; title: string; summary: string | null; url: string | null; time: number; tone: 1 | 0 | -1; tags: string[] };
type Filings = { company: { name: string; industry: string | null; exchange: string | null } | null; filings: Array<{ form: string; label: string; date: string; description: string | null; url: string }> };

export function SymbolView({ symbol, setSymbol }: { symbol: string; setSymbol: (s: string) => void }) {
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState<Period>("1d");
  const k = useLiveKline(symbol, period, period === "1d" ? 260 : 300);
  const t = k.tick;
  const profile = useProfile(symbol);
  const mnews = usePolled<MarketNews[]>("ucMarket.news", { symbol, name: t?.name ?? undefined }, 120_000);
  const enews = useFeed({ symbol, limit: 60, hours: 96 });
  const isUs = /^[A-Z]{1,5}([.-][A-Z])?$/.test(symbol) && !["GC", "CL", "SI", "HG", "NG", "PL", "BTC", "ETH", "DXY", "ZN", "ES", "NQ", "YM", "RTY", "BRENT", "USDCNH", "EURUSD", "USDJPY"].includes(symbol);
  const filings = usePolled<Filings>("ucNews.filings", isUs ? { symbol } : null, 3600_000);
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const out: News[] = [];
    const add = (n: News) => {
      const key = n.title.slice(0, 24);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(n);
    };
    enews.items.forEach(add);
    (mnews.data ?? []).forEach((m) => add({ ...m, lang: /[一-鿿]/.test(m.title) ? "zh" : "en", region: "", cats: m.tags, toneScore: m.tone, tickers: [symbol], cluster: m.id, heat: 1, score: 0, kind: "article" }));
    return out.sort((a, b) => b.time - a.time);
  }, [enews.items, mnews.data, symbol]);
  const { open } = useNewsCtx();
  const c = toneOf(t?.changePct);
  const go = () => {
    const q = input.trim().toUpperCase();
    if (!q) return;
    setSymbol(/^\d{6}$/.test(q) ? `${q}.${/^[569]/.test(q) ? "SH" : "SZ"}` : /^\d{1,5}$/.test(q) ? `${q.padStart(4, "0").slice(-4)}.HK` : q);
    setInput("");
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1">
        <span className="text-[11px] font-semibold text-cyan-200">标的研究</span>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="代码：AAPL / 600519 / 0700 / 7203.T / GC" className="h-5 w-[210px] border border-[#1d3047] bg-[#050b13] px-1.5 font-mono text-[10px] text-slate-100 outline-none" />
        <span className="flex flex-wrap gap-x-2 text-[10px]">{POPULAR.map((s) => <button key={s} type="button" onClick={() => setSymbol(s)} className={s === symbol ? "text-cyan-200" : "text-slate-500 hover:text-slate-200"}>{s}</button>)}</span>
      </div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-[#050b13]">
          <div className="flex flex-wrap items-baseline gap-x-3 px-3 pt-2">
            <span className="text-[14px] font-semibold text-white">{profile.data?.name ?? t?.name ?? symbol}</span>
            <span className="font-mono text-[10px] text-slate-500">{symbol}</span>
            <span className="font-mono text-[20px] font-bold" style={{ color: c }}>{fmtPrice(t?.price)}</span>
            <span className="font-mono text-[12px]" style={{ color: c }}>{t?.change == null ? "" : `${t.change > 0 ? "+" : ""}${fmtPrice(t.change)}`} {fmtPct(t?.changePct)}</span>
            <span className="ml-auto"><Seg value={period} onChange={setPeriod} options={[["5m", "5分"], ["60m", "60分"], ["1d", "日K"], ["1w", "周K"]]} /></span>
          </div>
          {k.candles.length ? <KlineChart candles={k.candles} period={period} height={300} live overlay="MA" subs={["VOL", "MACD"]} signals /> : <div className="flex h-[300px] items-center justify-center text-[11px] text-slate-500">{k.loading ? "K线读取中…" : "暂无K线"}</div>}
        </div>
        <div className="bg-[#050b13]">
          <SectionHead title="基本面" sub={profile.data ? [profile.data.sector, profile.data.industry].filter(Boolean).join(" · ") : undefined} />
          <table className="w-full text-[11px]"><tbody>
            {(profile.data?.metrics ?? []).map((m) => (
              <tr key={m.key} className="border-b border-[#101b28]"><td className="px-3 py-1 text-slate-500">{m.label}</td><td className="px-3 text-right font-mono text-slate-100">{m.value == null ? "—" : m.key === "mcap" || m.key === "float" ? fmtCompact(m.value) : m.unit === "%" ? `${m.value.toFixed(2)}%` : Math.abs(m.value) > 1000 ? fmtCompact(m.value) : m.value.toFixed(2)}</td></tr>
            ))}
            {!profile.data && <tr><td className="px-3 py-4 text-slate-500">{profile.loading ? "读取中…" : "指数 / 商品 / 外汇以行情与新闻为主"}</td></tr>}
          </tbody></table>
          {filings.data?.filings?.length ? (
            <>
              <SectionHead title="最新公告" sub={filings.data.company?.industry ?? undefined} />
              {filings.data.filings.slice(0, 8).map((f) => (
                <div key={f.url} role="button" tabIndex={0} onClick={() => open({ id: f.url, title: `${filings.data!.company?.name ?? symbol} · ${f.label}（${f.form}）${f.description ? ` · ${f.description}` : ""}`, summary: null, url: f.url, time: Date.parse(f.date), lang: "en", region: "美国", cats: ["公司"], tone: 0, toneScore: 0, tickers: [symbol], cluster: f.url, heat: 1, score: 0, kind: "article" })} className="flex cursor-pointer gap-2 border-b border-[#101b28] px-3 py-1 text-[11px] hover:bg-[#0a1726]">
                  <span className="w-[72px] shrink-0 font-mono text-slate-500">{f.date}</span><span className="w-[46px] shrink-0 font-mono text-amber-300">{f.form}</span><span className="truncate text-slate-200">{f.label}{f.description ? ` · ${f.description}` : ""}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
      <SectionHead title="相关新闻" sub={`${merged.length} 条`} />
      <FeedList items={merged} loading={enews.loading && mnews.loading} empty="暂无相关新闻" />
    </div>
  );
}

/* ================================================================== NI 行业主题 */
const CAT_PROXY: Record<string, string[]> = {
  科技: ["XLK", "SMH", "NVDA", "688981.SH"], 金融: ["XLF", "JPM", "601318.SH", "0005.HK"], 能源: ["XLE", "CL", "NG", "601857.SH"], 医药: ["XLV", "LLY", "NVO"], 消费: ["XLY", "XLP", "600519.SH", "AMZN"],
  地产: ["XLRE", "VNQ"], 汽车: ["TSLA", "002594.SZ", "7203.T"], 加密: ["BTC", "ETH"], 商品: ["GC", "SI", "HG", "CL"], 外汇: ["DXY", "USDCNH", "EURUSD", "USDJPY"], 债券: ["ZN", "TLT"],
  美股: ["^GSPC", "^IXIC", "^DJI"], A股: ["000001.SH", "399001.SZ", "000300.SH"], 港股: ["^HSI", "^HSCE"], 欧洲: ["^STOXX50E", "^GDAXI", "^FTSE"], 日本: ["^N225", "USDJPY"], 新兴市场: ["EEM", "^BSESN", "^BVSP"],
  宏观: ["DXY", "ZN", "GC"], 央行: ["ZN", "DXY", "USDJPY"], 公司: ["^GSPC"], IPO: ["^IXIC"], 政策: ["000001.SH", "^GSPC"], 地缘: ["CL", "GC", "^VIX"], 观点: ["^GSPC"],
};
export function IndustryView() {
  const sentiment = usePolled<{ byCat: Array<{ key: string; count: number; pos: number; neg: number; index: number }> }>("ucNews.sentiment", { hours: 24 }, 120_000);
  const [cat, setCat] = useState("科技");
  const { items, loading } = useFeed({ cats: [cat], limit: 120, hours: 72 });
  const rows = CATS.map((c) => sentiment.data?.byCat.find((x) => x.key === c) ?? { key: c, count: 0, pos: 0, neg: 0, index: 0 });
  return (
    <div className="grid min-h-[600px] grid-cols-[180px_minmax(0,1fr)]">
      <div className="border-r border-[#1a2a3c]">
        <SectionHead title="行业 / 主题" sub="24h" />
        {rows.map((r) => (
          <button key={r.key} type="button" onClick={() => setCat(r.key)} className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-[#101b28] px-2 py-1 text-left text-[11px] ${cat === r.key ? "bg-[#0d2236] text-white" : "text-slate-300 hover:bg-[#0a1726]"}`}>
            <span>{r.key}</span><span className="font-mono text-[10px] text-slate-500">{r.count}</span><span className="w-[34px] text-right font-mono text-[10px]" style={{ color: toneOf(r.index) }}>{r.index > 0 ? "+" : ""}{r.index}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        <QuoteStrip symbols={CAT_PROXY[cat] ?? ["^GSPC"]} />
        <SectionHead title={`${cat} 新闻`} sub={`${items.length} 条 · 近3天`} />
        <FeedList items={items} loading={loading} />
      </div>
    </div>
  );
}

/* ================================================================== BECO 宏观与央行 */
type Macro = { curve: Array<{ tenor: string; value: number }>; curveDate: string | null; curvePrev: Array<{ tenor: string; value: number }>; rates: Array<{ key: string; label: string; value: number | null; date: string | null; unit: string }>; markets: Array<{ symbol: string; label: string; price: number | null; changePct: number | null }> };
function CurveChart({ now, prev }: { now: Macro["curve"]; prev: Macro["curve"] }) {
  const W = 440, H = 150, P = 28;
  if (now.length < 3) return <div className="px-3 py-6 text-[11px] text-slate-500">收益率曲线读取中…</div>;
  const all = [...now, ...prev].map((x) => x.value);
  const lo = Math.min(...all) - 0.1, hi = Math.max(...all) + 0.1;
  const x = (i: number) => P + (i / (now.length - 1)) * (W - P - 8);
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * (H - 30);
  const line = (arr: Macro["curve"]) => arr.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={P} x2={W - 8} y1={y(v)} y2={y(v)} stroke="#132233" /><text x={2} y={y(v) + 3} fontSize={8} fill="#5f7891">{v.toFixed(2)}</text></g>; })}
      {prev.length === now.length && <polyline points={line(prev)} fill="none" stroke="#64748b" strokeDasharray="3 3" />}
      <polyline points={line(now)} fill="none" stroke="#38bdf8" strokeWidth={1.6} />
      {now.map((p, i) => <g key={p.tenor}><circle cx={x(i)} cy={y(p.value)} r={2} fill="#38bdf8" /><text x={x(i)} y={H - 6} fontSize={8} textAnchor="middle" fill="#5f7891">{p.tenor}</text></g>)}
    </svg>
  );
}
export function MacroView() {
  const macro = usePolled<Macro>("ucNews.macro", {}, 300_000);
  const cb = useFeed({ cats: ["央行"], limit: 60, hours: 96 });
  const eco = useFeed({ cats: ["宏观"], limit: 80, hours: 72 });
  const m = macro.data;
  const spread = m?.curve.length ? (m.curve.find((x) => x.tenor === "10Y")?.value ?? 0) - (m.curve.find((x) => x.tenor === "2Y")?.value ?? 0) : null;
  return (
    <div>
      <QuoteStrip symbols={(m?.markets ?? []).map((x) => x.symbol).concat(m ? [] : ["DXY", "ZN", "^VIX", "GC", "CL", "USDCNH", "EURUSD", "USDJPY"])} labels={Object.fromEntries((m?.markets ?? []).map((x) => [x.symbol, x.label]))} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="bg-[#050b13]">
          <SectionHead title="美国国债收益率曲线" sub={m?.curveDate ? `${m.curveDate}（虚线为约一个月前）` : undefined} right={spread != null ? <span>10Y-2Y <b className="font-mono" style={{ color: spread < 0 ? DOWN : UP }}>{(spread * 100).toFixed(0)}bp</b>{spread < 0 ? " 倒挂" : ""}</span> : null} />
          <div className="px-2 py-1"><CurveChart now={m?.curve ?? []} prev={m?.curvePrev ?? []} /></div>
        </div>
        <div className="bg-[#050b13]">
          <SectionHead title="资金利率与通胀" />
          <table className="w-full text-[11px]"><tbody>
            {(m?.rates ?? []).map((r) => <tr key={r.key} className="border-b border-[#101b28]"><td className="px-3 py-1 text-slate-400">{r.label}</td><td className="text-right font-mono text-slate-100">{r.value == null ? "—" : `${r.value.toFixed(2)}${r.unit}`}</td><td className="px-3 text-right font-mono text-[10px] text-slate-500">{r.date}</td></tr>)}
            {!m && <tr><td className="px-3 py-4 text-slate-500">读取中…</td></tr>}
          </tbody></table>
        </div>
      </div>
      <div className="border-b border-[#1a2a3c] bg-[#050b13]"><EconCalendar /></div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="min-w-0 bg-[#050b13]"><SectionHead title="央行与货币政策" sub={`${cb.items.length} 条`} /><FeedList items={cb.items} loading={cb.loading} dense /></div>
        <div className="min-w-0 bg-[#050b13]"><SectionHead title="经济数据与宏观" sub={`${eco.items.length} 条`} /><FeedList items={eco.items} loading={eco.loading} dense /></div>
      </div>
    </div>
  );
}

/* ================================================================== READ 热度榜 */
export function HeatView() {
  const { items, loading } = useFeed({ sort: "heat", hours: 24, limit: 80 });
  const max = Math.max(1, ...items.map((n) => n.heat));
  const { open, selected } = useNewsCtx();
  return (
    <div>
      <SectionHead title="热度榜" sub="同一事件被多少篇报道覆盖 · 近24小时" />
      {loading && !items.length && <div className="px-3 py-10 text-center text-[11px] text-slate-500">读取中…</div>}
      {items.map((n, i) => (
        <div key={n.id} role="button" tabIndex={0} onClick={() => open(n)} className={`grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_120px] items-center gap-2 border-b border-[#111d2b] px-2 py-1.5 ${selected === n.id ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
          <span className={`font-mono text-[13px] font-bold ${i < 3 ? "text-amber-300" : "text-slate-500"}`}>{i + 1}</span>
          <span className="min-w-0"><span className="block truncate text-[12px] text-slate-100">{n.title}</span><span className="text-[10px] text-slate-500">首发 {ago(n.time)} · {n.cats.slice(0, 2).join(" · ")}</span></span>
          <span className="flex items-center gap-1"><span className="h-[6px] bg-orange-400/80" style={{ width: `${(n.heat / max) * 80}px` }} /><span className="font-mono text-[10px] text-orange-300">{n.heat}</span></span>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== TREN 热词趋势 */
type Trends = { terms: Array<{ term: string; count: number; tone: number; momentum: number; hours: number[] }>; volume: Array<{ t: number; n: number; pos: number; neg: number }> };
export function TrendView() {
  const [hours, setHours] = useState<"12" | "24" | "48">("24");
  const tr = usePolled<Trends>("ucNews.trends", { hours: Number(hours) }, 120_000);
  const [term, setTerm] = useState<string | null>(null);
  const isTicker = term?.startsWith("$");
  const { items, loading } = useFeed(term ? (isTicker ? { symbol: term.slice(1), limit: 80 } : { q: term, limit: 80, hours: Number(hours) }) : null);
  const vol = tr.data?.volume ?? [];
  const vmax = Math.max(1, ...vol.map((v) => v.n));
  return (
    <div>
      <SectionHead title="热词趋势" sub="标题词频按小时统计，点击查看相关报道" right={<Seg value={hours} onChange={setHours} options={[["12", "12h"], ["24", "24h"], ["48", "48h"]]} />} />
      <div className="flex h-[54px] items-end gap-px border-b border-[#1a2a3c] px-2 py-1" title="每小时新闻量（红：利好，绿：利空）">
        {vol.map((v) => (
          <div key={v.t} className="flex flex-1 flex-col justify-end" style={{ height: `${(v.n / vmax) * 44 + 2}px` }} title={`${fmtTime(v.t, true)} · ${v.n} 条`}>
            <div style={{ height: `${(v.pos / Math.max(1, v.n)) * 100}%`, background: UP, opacity: 0.8 }} />
            <div className="flex-1 bg-slate-600/60" />
            <div style={{ height: `${(v.neg / Math.max(1, v.n)) * 100}%`, background: DOWN, opacity: 0.8 }} />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <table className="w-full border-r border-[#1a2a3c] text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">热词</th><th className="text-right">次数</th><th className="text-right">动量</th><th className="px-2">走势</th><th className="pr-2 text-right">情绪</th></tr></thead>
          <tbody>
            {(tr.data?.terms ?? []).slice(0, 40).map((x) => (
              <tr key={x.term} onClick={() => setTerm(x.term)} className={`cursor-pointer border-t border-[#101b28] ${term === x.term ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                <td className="px-2 py-0.5 text-slate-100">{x.term}</td>
                <td className="text-right font-mono text-slate-300">{x.count}</td>
                <td className="text-right font-mono" style={{ color: x.momentum > 0 ? UP : x.momentum < 0 ? DOWN : FLAT }}>{x.momentum > 0 ? "▲" : x.momentum < 0 ? "▼" : "–"}{Math.abs(x.momentum)}</td>
                <td className="px-2"><Spark values={x.hours} /></td>
                <td className="pr-2 text-right font-mono" style={{ color: toneOf(x.tone) }}>{(x.tone * 100).toFixed(0)}</td>
              </tr>
            ))}
            {!tr.data && <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">统计中…</td></tr>}
          </tbody>
        </table>
        <div className="min-w-0">
          <SectionHead title={term ? `「${term}」相关报道` : "选择左侧热词"} sub={term ? `${items.length} 条` : undefined} />
          {term && <FeedList items={items} loading={loading} dense />}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== SOCI 情绪雷达 */
type Senti = { byCat: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; byRegion: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; tickers: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; series: Array<{ t: number; pos: number; neg: number; n: number }>; total: number };
function Diverging({ rows, onPick }: { rows: Senti["byCat"]; onPick?: (k: string) => void }) {
  return (
    <div>
      {rows.map((r) => (
        <div key={r.key} role="button" tabIndex={0} onClick={() => onPick?.(r.key)} className="grid cursor-pointer grid-cols-[86px_minmax(0,1fr)_40px_40px] items-center gap-2 border-b border-[#101b28] px-2 py-0.5 text-[11px] hover:bg-[#0a1726]">
          <span className="truncate text-slate-300">{r.key}</span>
          <span className="relative h-[8px] bg-[#0b1624]">
            <span className="absolute left-1/2 top-0 h-full w-px bg-slate-600" />
            <span className="absolute top-0 h-full" style={{ left: r.index >= 0 ? "50%" : `${50 + r.index / 2}%`, width: `${Math.abs(r.index) / 2}%`, background: toneOf(r.index) }} />
          </span>
          <span className="text-right font-mono" style={{ color: toneOf(r.index) }}>{r.index > 0 ? "+" : ""}{r.index}</span>
          <span className="text-right font-mono text-[10px] text-slate-500">{r.count}</span>
        </div>
      ))}
    </div>
  );
}
export function SentimentView() {
  const s = usePolled<Senti>("ucNews.sentiment", { hours: 24 }, 120_000);
  const [pick, setPick] = useState<{ kind: "cat" | "sym"; key: string } | null>(null);
  const feed = useFeed(pick ? (pick.kind === "cat" ? { cats: [pick.key], limit: 60, hours: 24 } : { symbol: pick.key, limit: 60, hours: 48 }) : null);
  const d = s.data;
  const pos = d?.series.reduce((a, b) => a + b.pos, 0) ?? 0;
  const neg = d?.series.reduce((a, b) => a + b.neg, 0) ?? 0;
  const idx = d ? Math.round(((pos - neg) / Math.max(1, d.total)) * 100) : 0;
  const smax = Math.max(1, ...(d?.series ?? []).map((x) => Math.max(x.pos, x.neg)));
  return (
    <div>
      <div className="flex items-center gap-4 border-b border-[#1a2a3c] bg-[#08121e] px-3 py-2">
        <div><div className="text-[10px] text-slate-500">全市场消息面情绪指数（24h）</div><div className="font-mono text-[26px] font-bold" style={{ color: toneOf(idx) }}>{idx > 0 ? "+" : ""}{idx}</div></div>
        <div className="text-[11px] text-slate-400">利好 <b className="font-mono" style={{ color: UP }}>{pos}</b> · 利空 <b className="font-mono" style={{ color: DOWN }}>{neg}</b> · 全部 <b className="font-mono text-slate-200">{d?.total ?? 0}</b></div>
        <svg viewBox={`0 0 ${(d?.series.length ?? 24) * 10} 40`} className="h-[40px] flex-1" preserveAspectRatio="none">
          {(d?.series ?? []).map((x, i) => <g key={x.t}><rect x={i * 10 + 1} y={20 - (x.pos / smax) * 19} width={8} height={(x.pos / smax) * 19} fill={UP} opacity={0.8} /><rect x={i * 10 + 1} y={20} width={8} height={(x.neg / smax) * 19} fill={DOWN} opacity={0.8} /></g>)}
          <line x1={0} x2={(d?.series.length ?? 24) * 10} y1={20} y2={20} stroke="#334155" />
        </svg>
      </div>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-3">
        <div className="bg-[#050b13]"><SectionHead title="按主题" /><Diverging rows={d?.byCat.slice(0, 24) ?? []} onPick={(k) => setPick({ kind: "cat", key: k })} /></div>
        <div className="bg-[#050b13]"><SectionHead title="按地区" /><Diverging rows={d?.byRegion ?? []} /></div>
        <div className="bg-[#050b13]"><SectionHead title="标的舆情" sub="被提及最多" /><Diverging rows={d?.tickers ?? []} onPick={(k) => setPick({ kind: "sym", key: k })} /></div>
      </div>
      {pick && <><SectionHead title={`${pick.key} · 舆情明细`} right={<button type="button" onClick={() => setPick(null)}>收起 ✕</button>} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </div>
  );
}

/* ================================================================== INTL 全球多语种 */
const REGIONS: Array<[string, string[]]> = [["中国", ["000001.SH", "399001.SZ", "000300.SH", "USDCNH"]], ["中国香港", ["^HSI", "^HSCE", "0700.HK", "9988.HK"]], ["美国", ["^GSPC", "^IXIC", "^DJI", "^VIX"]], ["欧洲", ["^STOXX50E", "^GDAXI", "^FCHI", "^FTSE"]], ["日本", ["^N225", "USDJPY", "7203.T", "6758.T"]], ["韩国", ["^KS11", "005930.KS", "000660.KS"]], ["中国台湾", ["^TWII", "2330.TW", "2317.TW"]], ["新兴市场", ["^BSESN", "^BVSP", "EEM"]], ["全球", ["^GSPC", "^HSI", "^N225", "^GDAXI", "GC", "CL", "DXY"]]];
export function GlobalView() {
  const [region, setRegion] = useState("美国");
  const [lang, setLang] = useState<string>("all");
  const { items, loading } = useFeed({ region, lang: lang === "all" ? undefined : lang, limit: 120, hours: 72 });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1">
        <Seg value={region} onChange={setRegion} options={REGIONS.map(([r]) => [r, r] as [string, string])} />
        <Seg value={lang} onChange={setLang} options={[["all", "全部语言"], ["zh", "中文"], ["en", "英文"], ["ja", "日文"], ["de", "德文"], ["fr", "法文"], ["zh-TW", "繁体"], ["ko", "韩文"]]} />
      </div>
      <QuoteStrip symbols={REGIONS.find(([r]) => r === region)?.[1] ?? []} />
      <FeedList items={items} loading={loading} empty="该地区 / 语言暂无新闻" />
    </div>
  );
}

/* ================================================================== OPIN 观点评论 */
export function OpinionView() {
  const { items, loading } = useFeed({ cats: ["观点"], limit: 100, hours: 96 });
  const [tone, setTone] = useState<"all" | "1" | "-1">("all");
  const list = items.filter((n) => tone === "all" || String(n.tone) === tone);
  const bull = items.filter((n) => n.tone > 0).length;
  const bear = items.filter((n) => n.tone < 0).length;
  return (
    <div>
      <SectionHead title="观点与评论" sub={`看多 ${bull} · 看空 ${bear} · 共 ${items.length} 篇`} right={<Seg value={tone} onChange={setTone} options={[["all", "全部"], ["1", "偏多"], ["-1", "偏空"]]} />} />
      <div className="divide-y divide-[#111d2b]">
        {loading && !list.length && <div className="px-3 py-10 text-center text-[11px] text-slate-500">读取中…</div>}
        {list.map((n) => <NewsRow key={n.id} n={n} showSummary />)}
      </div>
    </div>
  );
}

/* ================================================================== DOCS 公告申报 */
export function FilingsView() {
  const [symbol, setSymbol] = useState("AAPL");
  const [input, setInput] = useState("");
  const [form, setForm] = useState("all");
  const f = usePolled<Filings>("ucNews.filings", { symbol }, 3600_000);
  const { open } = useNewsCtx();
  const forms = [...new Set((f.data?.filings ?? []).map((x) => x.form))];
  const list = (f.data?.filings ?? []).filter((x) => form === "all" || x.form === form);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1">
        <span className="text-[11px] font-semibold text-cyan-200">上市公司公告</span>
        <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { setSymbol(input.trim()); setForm("all"); setInput(""); } }} placeholder="美股代码，如 MSFT / NVDA / BABA" className="h-5 w-[200px] border border-[#1d3047] bg-[#050b13] px-1.5 font-mono text-[10px] text-slate-100 outline-none" />
        {["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "BABA", "PDD", "JPM", "BRK-B"].map((s) => <button key={s} type="button" onClick={() => { setSymbol(s); setForm("all"); }} className={`text-[10px] ${s === symbol ? "text-cyan-200" : "text-slate-500 hover:text-slate-200"}`}>{s}</button>)}
      </div>
      {f.data?.company && <div className="flex flex-wrap gap-x-4 border-b border-[#1a2a3c] px-3 py-1.5 text-[11px]"><b className="text-white">{f.data.company.name}</b><span className="text-slate-400">{f.data.company.industry}</span><span className="text-slate-500">{f.data.company.exchange}</span></div>}
      {forms.length > 0 && <div className="flex flex-wrap gap-1 border-b border-[#1a2a3c] px-2 py-1"><Seg value={form} onChange={setForm} options={[["all", "全部"], ...forms.slice(0, 12).map((x) => [x, x] as [string, string])]} /></div>}
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">申报日</th><th className="text-left">类型</th><th className="text-left">说明</th><th className="px-2 text-left">报告期</th></tr></thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.url} onClick={() => open({ id: x.url, title: `${f.data?.company?.name ?? symbol} · ${x.label}（${x.form}）${x.description ? ` · ${x.description}` : ""}`, summary: null, url: x.url, time: Date.parse(x.date), lang: "en", region: "美国", cats: ["公司"], tone: 0, toneScore: 0, tickers: [symbol], cluster: x.url, heat: 1, score: 0, kind: "article" })} className="cursor-pointer border-t border-[#101b28] hover:bg-[#0a1726]">
              <td className="px-2 py-1 font-mono text-slate-400">{x.date}</td><td className="font-mono text-amber-300">{x.form}</td><td className="text-slate-200">{x.label}{x.description ? ` · ${x.description}` : ""}</td><td className="px-2 font-mono text-slate-500">{x.reportDate ?? ""}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">{f.loading ? "读取中…" : "没有查到该代码的申报（目前覆盖美国上市公司）"}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== BNEF 能源商品 */
const COMMODITIES = ["CL", "BRENT", "NG", "GC", "SI", "HG", "PL", "ZC", "ZS", "ZW"];
export function CommodityView() {
  const [sym, setSym] = useState("CL");
  const [period, setPeriod] = useState<Period>("1d");
  const k = useLiveKline(sym, period, 260);
  const ticks = useTicks(COMMODITIES);
  const { items, loading } = useFeed({ cats: ["能源", "商品"], limit: 100, hours: 72 });
  const NAMES: Record<string, string> = { CL: "WTI原油", BRENT: "布伦特", NG: "天然气", GC: "黄金", SI: "白银", HG: "铜", PL: "铂金", ZC: "玉米", ZS: "大豆", ZW: "小麦" };
  return (
    <div>
      <div className="flex min-w-0 overflow-x-auto border-b border-[#1a2a3c]">
        {COMMODITIES.map((s) => { const t = ticks[s]; const c = toneOf(t?.changePct); return (
          <button key={s} type="button" onClick={() => setSym(s)} className={`min-w-[92px] shrink-0 border-r border-[#13202f] px-2 py-1 text-left ${s === sym ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
            <div className="text-[10px] text-slate-400">{NAMES[s]}</div><div className="font-mono text-[12px] font-semibold" style={{ color: c }}>{fmtPrice(t?.price)}</div><div className="font-mono text-[10px]" style={{ color: c }}>{fmtPct(t?.changePct)}</div>
          </button>); })}
      </div>
      <SectionHead title={`${NAMES[sym]} K线`} right={<Seg value={period} onChange={setPeriod} options={[["60m", "60分"], ["1d", "日K"], ["1w", "周K"]]} />} />
      {k.candles.length ? <KlineChart candles={k.candles} period={period} height={260} live overlay="BOLL" subs={["VOL", "RSI"]} signals /> : <div className="flex h-[260px] items-center justify-center text-[11px] text-slate-500">{k.loading ? "K线读取中…" : "暂无K线"}</div>}
      <SectionHead title="能源与大宗商品新闻" sub={`${items.length} 条`} />
      <FeedList items={items} loading={loading} dense />
    </div>
  );
}

/* ================================================================== DAYB 每日简报 */
const BRIEF_INDEX = ["^GSPC", "^IXIC", "^DJI", "^STOXX50E", "^GDAXI", "^FTSE", "^N225", "^HSI", "000001.SH", "000300.SH", "^KS11", "^TWII", "DXY", "USDCNH", "GC", "CL", "BTC", "ZN"];
const BRIEF_SECTIONS: Array<[string, string[]]> = [["宏观与央行", ["央行", "宏观"]], ["中国市场", ["A股", "港股"]], ["美国市场", ["美股"]], ["欧洲与日本", ["欧洲", "日本"]], ["商品与外汇", ["商品", "能源", "外汇"]], ["科技与公司", ["科技", "公司"]]];
function BriefSection({ title, cats }: { title: string; cats: string[] }) {
  const { items } = useFeed({ cats, sort: "score", hours: 24, limit: 6, kind: "article" }, 300_000);
  return (
    <div className="min-w-0">
      <div className="border-b border-[#1a2a3c] px-2 py-1 text-[11px] font-semibold text-amber-200">{title}</div>
      {items.slice(0, 5).map((n) => <NewsRow key={n.id} n={n} dense />)}
      {!items.length && <div className="px-2 py-3 text-[10px] text-slate-600">暂无</div>}
    </div>
  );
}
export function BriefView() {
  const ticks = useTicks(BRIEF_INDEX);
  const s = usePolled<Senti>("ucNews.sentiment", { hours: 24 }, 300_000);
  const priced = BRIEF_INDEX.map((x) => ({ s: x, t: ticks[x] })).filter((x) => x.t?.changePct != null);
  const best = [...priced].sort((a, b) => b.t!.changePct! - a.t!.changePct!)[0];
  const worst = [...priced].sort((a, b) => a.t!.changePct! - b.t!.changePct!)[0];
  const ups = priced.filter((x) => x.t!.changePct! > 0).length;
  const total = s.data?.total ?? 0;
  const pos = s.data?.series.reduce((a, b) => a + b.pos, 0) ?? 0;
  const neg = s.data?.series.reduce((a, b) => a + b.neg, 0) ?? 0;
  const hotCat = s.data?.byCat[0];
  const summary = priced.length ? `截至 ${new Date().toLocaleString("zh-CN", { hour12: false })}，跟踪的 ${priced.length} 个主要指数与资产中 ${ups} 个上涨、${priced.length - ups} 个下跌；表现最好的是 ${best?.t?.name ?? best?.s}（${fmtPct(best?.t?.changePct)}），最弱的是 ${worst?.t?.name ?? worst?.s}（${fmtPct(worst?.t?.changePct)}）。过去 24 小时共 ${total} 条新闻，利好 ${pos} 条、利空 ${neg} 条，讨论最多的主题是「${hotCat?.key ?? "—"}」。` : "行情读取中…";
  const copy = () => { void navigator.clipboard?.writeText(`佑诚每日简报\n\n${summary}`); toast.success("简报摘要已复制"); };
  return (
    <div>
      <SectionHead title="每日简报" sub="根据实时行情与过去24小时新闻自动生成" right={<><button type="button" onClick={copy} className="hover:text-white">复制摘要</button><button type="button" onClick={() => window.print()} className="hover:text-white">打印</button></>} />
      <p className="border-b border-[#1a2a3c] px-3 py-2 text-[12px] leading-relaxed text-slate-200">{summary}</p>
      <table className="w-full border-b border-[#1a2a3c] text-[11px]">
        <tbody className="grid grid-cols-2 lg:grid-cols-3">
          {BRIEF_INDEX.map((x) => { const t = ticks[x]; return (
            <tr key={x} className="flex justify-between border-b border-r border-[#101b28] px-2 py-0.5"><td className="text-slate-400">{t?.name ?? x}</td><td className="font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)} {fmtPct(t?.changePct)}</td></tr>); })}
        </tbody>
      </table>
      <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2 xl:grid-cols-3">
        {BRIEF_SECTIONS.map(([t, c]) => <div key={t} className="bg-[#050b13]"><BriefSection title={t} cats={c} /></div>)}
      </div>
    </div>
  );
}

/* ================================================================== MYN 我的新闻 */
const WATCH_KEY = "uc.news.watch";
type Watch = { symbols: string[]; keywords: string[]; cats: string[] };
const DEFAULT_WATCH: Watch = { symbols: ["NVDA", "0700.HK", "600519.SH"], keywords: ["美联储"], cats: ["科技"] };
export function MyNewsView() {
  const [w, setW] = useState<Watch>(() => { try { return { ...DEFAULT_WATCH, ...JSON.parse(window.localStorage.getItem(WATCH_KEY) ?? "{}") }; } catch { return DEFAULT_WATCH; } });
  const [input, setInput] = useState("");
  useEffect(() => writeLocal(WATCH_KEY, w), [w]);
  const all = useFeed({ limit: 400, hours: 72 }, 60_000);
  const list = all.items.filter((n) => n.tickers.some((t) => w.symbols.includes(t)) || n.cats.some((c) => w.cats.includes(c)) || w.keywords.some((k) => `${n.title} ${n.summary ?? ""}`.toLowerCase().includes(k.toLowerCase())));
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (CATS.includes(v)) setW((x) => ({ ...x, cats: [...new Set([...x.cats, v])] }));
    else if (/^[\^A-Z0-9.\-=]{1,12}$/.test(v.toUpperCase()) && !/[一-鿿]/.test(v)) setW((x) => ({ ...x, symbols: [...new Set([...x.symbols, v.toUpperCase()])] }));
    else setW((x) => ({ ...x, keywords: [...new Set([...x.keywords, v])] }));
    setInput("");
  };
  const chip = (label: string, onRemove: () => void, color: string) => <span key={label} className="inline-flex items-center gap-1 border border-[#1d3047] px-1 text-[10px]" style={{ color }}>{label}<button type="button" onClick={onRemove} className="text-slate-500 hover:text-white">✕</button></span>;
  return (
    <div>
      <div className="space-y-1 border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-cyan-200">我的新闻</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="添加代码（AAPL）、关键词（降息）或主题（能源）回车" className="h-5 w-[280px] border border-[#1d3047] bg-[#050b13] px-1.5 text-[10px] text-slate-100 outline-none" />
          <span className="text-[10px] text-slate-500">匹配 {list.length} 条</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {w.symbols.map((s) => chip(s, () => setW((x) => ({ ...x, symbols: x.symbols.filter((y) => y !== s) })), "#7dd3fc"))}
          {w.keywords.map((s) => chip(`“${s}”`, () => setW((x) => ({ ...x, keywords: x.keywords.filter((y) => y !== s) })), "#fcd34d"))}
          {w.cats.map((s) => chip(`#${s}`, () => setW((x) => ({ ...x, cats: x.cats.filter((y) => y !== s) })), "#86efac"))}
        </div>
      </div>
      {w.symbols.length > 0 && <QuoteStrip symbols={w.symbols} />}
      <FeedList items={list} loading={all.loading} empty="还没有匹配的新闻，添加关注的代码、关键词或主题" />
    </div>
  );
}

/* ================================================================== NLRT 新闻提醒 */
export type AlertRule = { id: string; kind: "keyword" | "symbol" | "cat" | "tone"; value: string; on: boolean };
export const ALERT_KEY = "uc.news.alerts";
export const ALERT_LOG_KEY = "uc.news.alertlog";
export function AlertView({ log, clearLog }: { log: Array<{ at: number; rule: string; item: News }>; clearLog: () => void }) {
  const [rules, setRules] = useState<AlertRule[]>(() => readLocalList<AlertRule>(ALERT_KEY, [{ id: "r1", kind: "keyword", value: "降息", on: true }, { id: "r2", kind: "tone", value: "-1", on: false }]));
  const [kind, setKind] = useState<AlertRule["kind"]>("keyword");
  const [value, setValue] = useState("");
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  useEffect(() => { writeLocal(ALERT_KEY, rules); window.dispatchEvent(new Event("uc-news-alerts")); }, [rules]);
  const add = () => {
    const v = kind === "symbol" ? value.trim().toUpperCase() : value.trim();
    if (!v && kind !== "tone") return;
    setRules((r) => [...r, { id: `r${Date.now()}`, kind, value: kind === "tone" ? value || "-1" : v, on: true }]);
    setValue("");
  };
  const { open } = useNewsCtx();
  const label = (r: AlertRule) => r.kind === "keyword" ? `关键词「${r.value}」` : r.kind === "symbol" ? `标的 ${r.value}` : r.kind === "cat" ? `主题 #${r.value}` : r.value === "1" ? "任何重大利好" : "任何重大利空";
  return (
    <div>
      <SectionHead title="新闻提醒" sub="新新闻命中规则时弹出提醒（终端开着即生效）" right={perm !== "granted" && typeof Notification !== "undefined" ? <button type="button" onClick={() => void Notification.requestPermission().then(setPerm)} className="text-cyan-300 hover:text-white">开启桌面通知</button> : <span className="text-emerald-400">桌面通知已开启</span>} />
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1.5">
        <Seg value={kind} onChange={setKind} options={[["keyword", "关键词"], ["symbol", "标的"], ["cat", "主题"], ["tone", "情绪"]]} />
        {kind === "cat" ? <select value={value} onChange={(e) => setValue(e.target.value)} className="h-5 border border-[#1d3047] bg-[#050b13] text-[10px] text-slate-100">{["", ...CATS].map((c) => <option key={c} value={c}>{c || "选择主题"}</option>)}</select>
          : kind === "tone" ? <Seg value={value || "-1"} onChange={setValue} options={[["1", "重大利好"], ["-1", "重大利空"]]} />
          : <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={kind === "symbol" ? "如 NVDA / 600519.SH" : "如 关税 / 回购 / OPEC"} className="h-5 w-[180px] border border-[#1d3047] bg-[#050b13] px-1.5 text-[10px] text-slate-100 outline-none" />}
        <button type="button" onClick={add} className="border border-cyan-700 px-2 text-[10px] text-cyan-200 hover:bg-cyan-900/30">添加规则</button>
      </div>
      {rules.map((r) => (
        <div key={r.id} className="flex items-center justify-between border-b border-[#101b28] px-2 py-1 text-[11px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={r.on} onChange={(e) => setRules((x) => x.map((y) => (y.id === r.id ? { ...y, on: e.target.checked } : y)))} /><span className={r.on ? "text-slate-100" : "text-slate-500"}>{label(r)}</span></label>
          <button type="button" onClick={() => setRules((x) => x.filter((y) => y.id !== r.id))} className="text-[10px] text-slate-500 hover:text-red-300">删除</button>
        </div>
      ))}
      <SectionHead title="触发记录" sub={`${log.length} 条`} right={log.length ? <button type="button" onClick={clearLog} className="hover:text-white">清空</button> : null} />
      {log.map((l) => (
        <div key={`${l.at}-${l.item.id}`} role="button" tabIndex={0} onClick={() => open(l.item)} className="cursor-pointer border-b border-[#101b28] px-2 py-1 text-[11px] hover:bg-[#0a1726]">
          <span className="mr-2 font-mono text-[10px] text-slate-500">{fmtTime(l.at)}</span><span className="mr-2 text-amber-300">{l.rule}</span><span className="text-slate-100">{l.item.title}</span>
        </div>
      ))}
      {!log.length && <div className="px-3 py-6 text-center text-[11px] text-slate-500">还没有触发的提醒</div>}
    </div>
  );
}
export function ruleMatches(r: AlertRule, n: News) {
  if (!r.on) return false;
  const text = `${n.title} ${n.summary ?? ""}`.toLowerCase();
  if (r.kind === "keyword") return text.includes(r.value.toLowerCase());
  if (r.kind === "symbol") return n.tickers.includes(r.value);
  if (r.kind === "cat") return n.cats.includes(r.value);
  return n.tone === Number(r.value) && Math.abs(n.toneScore) >= 0.6 && (n.heat > 1 || n.kind === "flash");
}
export function ruleLabel(r: AlertRule) {
  return r.kind === "keyword" ? `「${r.value}」` : r.kind === "symbol" ? r.value : r.kind === "cat" ? `#${r.value}` : r.value === "1" ? "重大利好" : "重大利空";
}

/* ================================================================== NZPD 偏好设置 */
export function SettingsView({ prefs, setPrefs, codes }: { prefs: Prefs; setPrefs: (p: Prefs) => void; codes: Array<[string, string]> }) {
  const stats = usePolled<{ total: number; last24h: number; lastHour: number; newest: number; channelsOk: number; channels: number; byCat: Record<string, number> }>("ucNews.stats", {}, 60_000);
  const LANGS: Array<[string, string]> = [["zh", "中文"], ["en", "英文"], ["ja", "日文"], ["de", "德文"], ["fr", "法文"], ["zh-TW", "繁体中文"], ["ko", "韩文"]];
  const row = (label: string, ctl: React.ReactNode) => <div className="flex items-center justify-between border-b border-[#101b28] px-3 py-2 text-[11px]"><span className="text-slate-300">{label}</span>{ctl}</div>;
  return (
    <div className="max-w-[720px]">
      <SectionHead title="偏好设置" sub="保存在本机浏览器，立即生效" right={<button type="button" onClick={() => setPrefs(DEFAULT_PREFS)} className="hover:text-white">恢复默认</button>} />
      {row("字号", <Seg value={String(prefs.scale)} onChange={(v) => setPrefs({ ...prefs, scale: Number(v) })} options={[["0.9", "小"], ["1", "标准"], ["1.15", "大"], ["1.3", "特大"]]} />)}
      {row("自动刷新间隔", <Seg value={String(prefs.refresh)} onChange={(v) => setPrefs({ ...prefs, refresh: Number(v) })} options={[["15", "15秒"], ["30", "30秒"], ["60", "1分钟"], ["180", "3分钟"]]} />)}
      {row("列表显示摘要", <input type="checkbox" checked={prefs.showSummary} onChange={(e) => setPrefs({ ...prefs, showSummary: e.target.checked })} />)}
      {row("默认打开", <select value={prefs.home} onChange={(e) => setPrefs({ ...prefs, home: e.target.value })} className="h-5 border border-[#1d3047] bg-[#050b13] text-[10px] text-slate-100">{codes.map(([c, l]) => <option key={c} value={c}>{c.toUpperCase()} {l}</option>)}</select>)}
      <div className="border-b border-[#101b28] px-3 py-2 text-[11px]">
        <div className="mb-1 text-slate-300">新闻语言</div>
        <div className="flex flex-wrap gap-3">{LANGS.map(([v, l]) => <label key={v} className="flex items-center gap-1 text-slate-400"><input type="checkbox" checked={prefs.langs.includes(v)} onChange={(e) => setPrefs({ ...prefs, langs: e.target.checked ? [...prefs.langs, v] : prefs.langs.filter((x) => x !== v) })} />{l}</label>)}</div>
      </div>
      <SectionHead title="新闻库状态" />
      <div className="grid grid-cols-2 gap-x-6 px-3 py-2 text-[11px] sm:grid-cols-4">
        <div><div className="text-slate-500">库存</div><div className="font-mono text-[16px] text-white">{stats.data?.total ?? "—"}</div></div>
        <div><div className="text-slate-500">近24小时</div><div className="font-mono text-[16px] text-white">{stats.data?.last24h ?? "—"}</div></div>
        <div><div className="text-slate-500">近1小时</div><div className="font-mono text-[16px] text-white">{stats.data?.lastHour ?? "—"}</div></div>
        <div><div className="text-slate-500">在线频道</div><div className="font-mono text-[16px] text-white">{stats.data ? `${stats.data.channelsOk}/${stats.data.channels}` : "—"}</div></div>
      </div>
    </div>
  );
}
