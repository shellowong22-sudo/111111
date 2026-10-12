/**
 * 专业页面公用外壳：顶栏 + 功能条 + 主区 + 右侧标的K线（点任意标的即在右侧看实时K线与买卖点）。
 */
import { createContext, useContext, useState } from "react";
import KlineChart from "@/uc/market/KlineChart";
import { fmtCompact, fmtPct, fmtPrice, toneOf, useLiveKline, useTicks, type Period } from "@/uc/market/live";
import { MiniKline } from "@/uc/market/WeiInsights";
import { DEFAULT_PREFS, NewsCtx, ReaderDrawer, type News } from "@/uc/news/kit";

type HubCtx = { pick: (s: string) => void; picked: string | null };
export const HubContext = createContext<HubCtx>({ pick: () => undefined, picked: null });
export const useHub = () => useContext(HubContext);

export function SymbolPane({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("1d");
  const k = useLiveKline(symbol, period, period === "1d" ? 260 : 400);
  const t = k.tick;
  const c = toneOf(t?.changePct);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-[#1a2a3c] bg-[#08121e] px-2 py-1">
        <span className="flex items-baseline gap-2"><b className="text-[12px] text-white">{t?.name ?? symbol}</b><span className="font-mono text-[10px] text-slate-500">{symbol}</span></span>
        <button type="button" onClick={onClose} className="text-[11px] text-slate-400 hover:text-white">✕</button>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 px-2 py-1">
        <span className="font-mono text-[20px] font-bold" style={{ color: c }}>{fmtPrice(t?.price)}</span>
        <span className="font-mono text-[12px]" style={{ color: c }}>{t?.change == null ? "" : `${t.change > 0 ? "+" : ""}${fmtPrice(t.change)}`} {fmtPct(t?.changePct)}</span>
        <span className="ml-auto flex border border-[#1d3047] text-[10px]">{(["5m", "60m", "1d", "1w"] as Period[]).map((p) => <button key={p} type="button" onClick={() => setPeriod(p)} className={`px-1.5 ${period === p ? "bg-cyan-700/40 text-cyan-50" : "text-slate-400"}`}>{({ "5m": "5分", "60m": "60分", "1d": "日K", "1w": "周K" } as Record<string, string>)[p]}</button>)}</span>
      </div>
      <div className="grid grid-cols-4 gap-x-2 px-2 pb-1 text-[10px]">
        {[["开", t?.open], ["高", t?.high], ["低", t?.low], ["昨收", t?.prevClose]].map(([l, v]) => <div key={String(l)} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="font-mono text-slate-200">{fmtPrice(v as number | null | undefined)}</span></div>)}
      </div>
      <div className="min-h-0 flex-1">{k.candles.length ? <KlineChart candles={k.candles} period={period} height={420} live overlay="BOLL" subs={["VOL", "MACD", "RSI"]} signals /> : <div className="flex h-[200px] items-center justify-center text-[11px] text-slate-500">{k.loading ? "K线读取中…" : "暂无K线"}</div>}</div>
    </div>
  );
}

/** 页面内任何新闻都在终端里打开阅读；新闻里的标的点击后在右侧看 K 线 */
function NewsProvider({ children, pick }: { children: React.ReactNode; pick: (s: string) => void }) {
  const [reading, setReading] = useState<News | null>(null);
  return (
    <NewsCtx.Provider value={{ prefs: DEFAULT_PREFS, open: setReading, openSymbol: pick, selected: reading?.id ?? null }}>
      {children}
      <ReaderDrawer item={reading} onClose={() => setReading(null)} />
    </NewsCtx.Provider>
  );
}

export function HubShell({ title, code, funcs, func, setFunc, right, children }: { title: string; code: string; funcs: Array<[string, string, string]>; func: string; setFunc: (f: string) => void; right?: React.ReactNode; children: React.ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <HubContext.Provider value={{ pick: setPicked, picked }}>
      <NewsProvider pick={setPicked}>
      <div className="flex h-[calc(100vh-56px)] min-h-[640px] flex-col bg-[#03070c] text-slate-200">
        <div className="flex items-center gap-3 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1">
          <span className="font-mono text-[11px] text-amber-300">{code}</span>
          <span className="text-[13px] font-semibold text-white">{title}</span>
          <span className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">{right}<span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />实时</span></span>
        </div>
        <nav className="flex min-w-0 overflow-x-auto border-b border-[#1a2a3c] bg-[#050b13]">
          {funcs.map(([id, c, label]) => (
            <button key={id} type="button" onClick={() => setFunc(id)} className={`shrink-0 border-r border-[#111d2b] px-2.5 py-1 text-left ${func === id ? "bg-[#0d2236] shadow-[inset_0_-2px_0_#22d3ee]" : "hover:bg-[#0a1726]"}`}>
              <span className={`block font-mono text-[10px] ${func === id ? "text-amber-300" : "text-amber-300/60"}`}>{c}</span>
              <span className={`block text-[11px] ${func === id ? "text-white" : "text-slate-400"}`}>{label}</span>
            </button>
          ))}
        </nav>
        <div className={`grid min-h-0 flex-1 ${picked ? "lg:grid-cols-[minmax(0,1fr)_minmax(380px,40%)]" : ""}`}>
          <div className="min-h-0 overflow-y-auto">{children}</div>
          {picked && <div className="min-h-0 border-l border-[#1a2a3c] bg-[#050a11]"><SymbolPane symbol={picked} onClose={() => setPicked(null)} /></div>}
        </div>
      </div>
      </NewsProvider>
    </HubContext.Provider>
  );
}

export type BoardRow = { symbol: string; label?: string; group?: string };
export function LiveBoard({ rows, extra, showMini = true }: { rows: BoardRow[]; extra?: Array<{ head: string; cell: (s: string) => React.ReactNode }>; showMini?: boolean }) {
  const ticks = useTicks(rows.map((r) => r.symbol));
  const { pick, picked } = useHub();
  let lastGroup = "";
  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500">
        <tr><th className="px-2 py-1 text-left">名称</th><th className="text-right">最新</th><th className="text-right">涨跌</th><th className="text-right">涨跌幅</th><th className="text-right">最高</th><th className="text-right">最低</th>{extra?.map((e) => <th key={e.head} className="text-right">{e.head}</th>)}{showMini && <th className="px-2">日K</th>}<th className="px-2 text-right">时间</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const t = ticks[r.symbol];
          const c = toneOf(t?.changePct);
          const head = r.group && r.group !== lastGroup ? (lastGroup = r.group) : null;
          return [
            head ? <tr key={`g-${head}`}><td colSpan={9 + (extra?.length ?? 0)} className="bg-[#07111c] px-2 py-0.5 text-[10px] font-semibold text-cyan-300">{head}</td></tr> : null,
            <tr key={r.symbol} onClick={() => pick(r.symbol)} className={`cursor-pointer border-t border-[#0f1b29] ${picked === r.symbol ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
              <td className="px-2 py-1"><span className="text-slate-100">{r.label ?? t?.name ?? r.symbol}</span><span className="ml-1.5 font-mono text-[9px] text-slate-600">{r.symbol}</span></td>
              <td className="text-right font-mono font-semibold" style={{ color: c }}>{fmtPrice(t?.price)}</td>
              <td className="text-right font-mono" style={{ color: c }}>{t?.change == null ? "—" : `${t.change > 0 ? "+" : ""}${fmtPrice(t.change)}`}</td>
              <td className="text-right font-mono" style={{ color: c }}>{fmtPct(t?.changePct)}</td>
              <td className="text-right font-mono text-slate-400">{fmtPrice(t?.high)}</td>
              <td className="text-right font-mono text-slate-400">{fmtPrice(t?.low)}</td>
              {extra?.map((e) => <td key={e.head} className="text-right font-mono">{e.cell(r.symbol)}</td>)}
              {showMini && <td className="px-2 py-0.5"><MiniKline symbol={r.symbol} /></td>}
              <td className="px-2 text-right font-mono text-[10px] text-slate-500">{t?.time ? new Date(t.time).toLocaleTimeString("zh-CN", { hour12: false }) : "—"}</td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
}

export function Bars({ data, height = 140, fmt = (v: number) => fmtCompact(v), label }: { data: Array<{ k: string; v: number; v2?: number }>; height?: number; fmt?: (v: number) => string; label?: [string, string] }) {
  const max = Math.max(1e-9, ...data.map((d) => Math.max(Math.abs(d.v), Math.abs(d.v2 ?? 0))));
  const hasNeg = data.some((d) => d.v < 0 || (d.v2 ?? 0) < 0);
  const H = height - 16;
  const zero = hasNeg ? H / 2 : H;
  const w = 100 / Math.max(1, data.length);
  return (
    <div>
      {label && <div className="flex gap-3 px-2 text-[10px]"><span className="text-red-300">■ {label[0]}</span>{data.some((d) => d.v2 != null) && <span className="text-emerald-300">■ {label[1]}</span>}</div>}
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <line x1={0} x2={100} y1={zero} y2={zero} stroke="#334155" strokeWidth={0.2} />
        {data.map((d, i) => {
          const h1 = (Math.abs(d.v) / max) * (hasNeg ? H / 2 : H);
          const h2 = d.v2 != null ? (Math.abs(d.v2) / max) * (hasNeg ? H / 2 : H) : 0;
          return (
            <g key={d.k}>
              <title>{`${d.k}：${fmt(d.v)}${d.v2 != null ? ` / ${fmt(d.v2)}` : ""}`}</title>
              <rect x={i * w + w * 0.1} width={d.v2 != null ? w * 0.38 : w * 0.8} y={d.v >= 0 ? zero - h1 : zero} height={Math.max(0.3, h1)} fill={d.v >= 0 ? "#f2495c" : "#1fbf75"} opacity={0.85} />
              {d.v2 != null && <rect x={i * w + w * 0.52} width={w * 0.38} y={d.v2 >= 0 ? zero - h2 : zero} height={Math.max(0.3, h2)} fill="#1fbf75" opacity={0.85} />}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between px-1 font-mono text-[9px] text-slate-500">{data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 8)) === 0).map((d) => <span key={d.k}>{d.k}</span>)}</div>
    </div>
  );
}

export function Lines({ series, height = 180, fmt = (v: number) => v.toFixed(2), xLabels, zero }: { series: Array<{ name: string; color: string; values: Array<number | null>; dash?: boolean }>; height?: number; fmt?: (v: number) => string; xLabels?: string[]; zero?: boolean }) {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v)));
  if (!all.length) return <div className="px-2 py-6 text-[11px] text-slate-500">读取中…</div>;
  let lo = Math.min(...all, zero ? 0 : Infinity);
  let hi = Math.max(...all, zero ? 0 : -Infinity);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad;
  hi += pad;
  const n = Math.max(...series.map((s) => s.values.length));
  const W = 600;
  const H = height;
  const x = (i: number) => 34 + (i / Math.max(1, n - 1)) * (W - 40);
  const y = (v: number) => 6 + ((hi - v) / (hi - lo)) * (H - 22);
  return (
    <div>
      <div className="flex flex-wrap gap-3 px-2 text-[10px]">{series.map((s) => <span key={s.name} style={{ color: s.color }}>━ {s.name} {(() => { const last = [...s.values].reverse().find((v) => v != null); return last != null ? fmt(last) : ""; })()}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={34} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#132233" /><text x={2} y={y(v) + 3} fontSize={9} fill="#5f7891">{fmt(v)}</text></g>; })}
        {zero && lo < 0 && hi > 0 && <line x1={34} x2={W - 6} y1={y(0)} y2={y(0)} stroke="#64748b" strokeDasharray="3 3" />}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth={1.4} strokeDasharray={s.dash ? "4 3" : undefined} />;
        })}
        {xLabels && [0, 0.25, 0.5, 0.75, 1].map((f) => { const i = Math.round(f * (n - 1)); return <text key={f} x={x(i)} y={H - 3} fontSize={9} textAnchor="middle" fill="#5f7891">{xLabels[i]}</text>; })}
      </svg>
    </div>
  );
}
