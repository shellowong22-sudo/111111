/**
 * 全球市场热力地图（BMAP 页面）与外汇原控件交互桥（FXTF / FXC），全部基于实时行情与真实日线：
 *  - BMAP：各国股指本币 / 美元计价区间收益、汇率贡献、波动、回撤与 10 年期国债收益率的国家瓦片热力图与地区汇总
 *  - 交互桥：原面板按钮的“查看图表”打开真实 K 线；监控列表永久保存；矩阵单元格详情与导出使用实时交叉汇率
 */
import { useMemo, useState, type ReactNode } from "react";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, SymbolPane, useHub } from "@/uc/hubs/kit";
import { annVol, drawdown, f2, heat, mean, perf, sgn, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { Note, ROW, TD, TDL, TH, THL, tenorVal, useCurves } from "./LiveCommon";

const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";

/* ================================================================== 实时交叉汇率（经美元套算） */
export const CCYS = ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "NZD", "CAD", "CNH", "HKD", "SGD"];
export const CCY_ZH: Record<string, string> = { USD: "美元", EUR: "欧元", JPY: "日元", GBP: "英镑", CHF: "瑞郎", AUD: "澳元", NZD: "纽元", CAD: "加元", CNH: "离岸人民币", HKD: "港币", SGD: "新加坡元" };
/** 每种货币对美元的报价代码，inv = true 表示报价为“1 美元兑该货币” */
const USD_LEG: Record<string, { s: string; inv: boolean }> = { EUR: { s: "EURUSD", inv: false }, GBP: { s: "GBPUSD", inv: false }, AUD: { s: "AUDUSD", inv: false }, NZD: { s: "NZDUSD", inv: false }, JPY: { s: "USDJPY", inv: true }, CHF: { s: "USDCHF", inv: true }, CAD: { s: "USDCAD", inv: true }, CNH: { s: "USDCNH", inv: true }, HKD: { s: "USDHKD", inv: true }, SGD: { s: "USDSGD", inv: true } };
export const LEG_SYMBOLS = Object.values(USD_LEG).map((l) => l.s);
/** 1 单位货币值多少美元（今日 / 昨收） */
export function useUsdValues() {
  const t = useTicks(LEG_SYMBOLS);
  return useMemo(() => {
    const now: Record<string, number | null> = { USD: 1 }, prev: Record<string, number | null> = { USD: 1 };
    for (const [c, l] of Object.entries(USD_LEG)) {
      const p = t[l.s]?.price, pc = t[l.s]?.prevClose;
      now[c] = p ? (l.inv ? 1 / p : p) : null;
      prev[c] = pc ? (l.inv ? 1 / pc : pc) : null;
    }
    return { now, prev, ticks: t };
  }, [t]);
}
export function crossOf(v: { now: Record<string, number | null>; prev: Record<string, number | null> }, base: string, quote: string) {
  const a = v.now[base], b = v.now[quote], pa = v.prev[base], pb = v.prev[quote];
  const rate = a != null && b != null ? a / b : null;
  const prev = pa != null && pb != null ? pa / pb : null;
  return { rate, chg: rate != null && prev ? (rate / prev - 1) * 100 : null };
}
export const fmtRate = (v: number | null | undefined) => (v == null ? "—" : v >= 100 ? v.toFixed(2) : v >= 10 ? v.toFixed(3) : v >= 1 ? v.toFixed(4) : v.toFixed(5));
export const pairSymbol = (base: string, quote: string) => {
  const direct = `${base}${quote}`;
  return base === "USD" || quote === "USD" ? (USD_LEG[base === "USD" ? quote : base].inv === (base === "USD") ? direct : `${quote}${base}`) : direct;
};

/* ================================================================== BMAP 全球市场热力地图 */
type Mkt = { c: string; n: string; r: string; eq: string; fx: string | null; inv: boolean; sov?: string };
const BMAP_MKTS: Mkt[] = [
  { c: "US", n: "美国", r: "美洲", eq: "^GSPC", fx: null, inv: false }, { c: "CA", n: "加拿大", r: "美洲", eq: "^GSPTSE", fx: "USDCAD", inv: true },
  { c: "BR", n: "巴西", r: "美洲", eq: "^BVSP", fx: "USDBRL", inv: true }, { c: "MX", n: "墨西哥", r: "美洲", eq: "^MXX", fx: "USDMXN", inv: true },
  { c: "GB", n: "英国", r: "欧洲", eq: "^FTSE", fx: "GBPUSD", inv: false }, { c: "DE", n: "德国", r: "欧洲", eq: "^GDAXI", fx: "EURUSD", inv: false, sov: "DE" },
  { c: "FR", n: "法国", r: "欧洲", eq: "^FCHI", fx: "EURUSD", inv: false, sov: "FR" }, { c: "IT", n: "意大利", r: "欧洲", eq: "FTSEMIB.MI", fx: "EURUSD", inv: false, sov: "IT" },
  { c: "ES", n: "西班牙", r: "欧洲", eq: "^IBEX", fx: "EURUSD", inv: false, sov: "ES" }, { c: "NL", n: "荷兰", r: "欧洲", eq: "^AEX", fx: "EURUSD", inv: false, sov: "NL" },
  { c: "CH", n: "瑞士", r: "欧洲", eq: "^SSMI", fx: "USDCHF", inv: true }, { c: "SE", n: "瑞典", r: "欧洲", eq: "^OMX", fx: "USDSEK", inv: true, sov: "SE" },
  { c: "JP", n: "日本", r: "亚太", eq: "^N225", fx: "USDJPY", inv: true }, { c: "CN", n: "中国", r: "亚太", eq: "sh000300", fx: "USDCNH", inv: true },
  { c: "HK", n: "中国香港", r: "亚太", eq: "^HSI", fx: "USDHKD", inv: true }, { c: "TW", n: "中国台湾", r: "亚太", eq: "^TWII", fx: "USDTWD", inv: true },
  { c: "KR", n: "韩国", r: "亚太", eq: "^KS11", fx: "USDKRW", inv: true }, { c: "IN", n: "印度", r: "亚太", eq: "^BSESN", fx: "USDINR", inv: true },
  { c: "AU", n: "澳大利亚", r: "亚太", eq: "^AXJO", fx: "AUDUSD", inv: false }, { c: "SG", n: "新加坡", r: "亚太", eq: "^STI", fx: "USDSGD", inv: true },
];
const BMAP_SYMS = [...new Set(BMAP_MKTS.flatMap((m) => [m.eq, ...(m.fx ? [m.fx] : [])]))];
const PERIODS: Array<[string, string, number]> = [["1d", "今日", 0], ["1w", "1 周", 5], ["1m", "1 月", 21], ["3m", "3 月", 63], ["ytd", "年内", -1], ["1y", "1 年", 252]];
const METRICS: Array<[string, string]> = [["loc", "本币收益"], ["usd", "美元计价收益"], ["fx", "汇率贡献"], ["vol", "60 日波动"], ["dd", "距一年高点"], ["y10", "10 年国债收益率"]];
type Sov = { countries: Array<{ code: string; y: number; date: string; chg1m: number | null }> };

export function BmapPage() {
  const [metric, setMetric] = useState("loc");
  const [period, setPeriod] = useState("1m");
  const cl = useCloses(BMAP_SYMS, 300);
  const ticks = useTicks(BMAP_SYMS);
  const sov = usePolled<Sov>("ucHubs.sovereign", {}, 6 * 3600_000);
  const cv = useCurves();
  const { pick } = useHub();
  const n = PERIODS.find((p) => p[0] === period)![2];
  const rows = useMemo(() => BMAP_MKTS.map((m) => {
    const pts = cl.data?.[m.eq] ?? [];
    const c = pts.map((x) => x[1]).filter((v) => v > 0);
    const dates = pts.map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10));
    const fxc = m.fx ? (cl.data?.[m.fx] ?? []).map((x) => x[1]).filter((v) => v > 0) : [];
    const fxDates = m.fx ? (cl.data?.[m.fx] ?? []).map((x) => new Date(x[0] + 8 * 3600_000).toISOString().slice(0, 10)) : [];
    const te = ticks[m.eq], tf = m.fx ? ticks[m.fx] : null;
    const loc = n === 0 ? te?.changePct ?? null : n < 0 ? ytd(c, dates) : perf(c, n);
    const fxRaw = !m.fx ? 0 : n === 0 ? tf?.changePct ?? null : n < 0 ? ytd(fxc, fxDates) : perf(fxc, n);
    const fx = fxRaw == null ? null : m.inv ? (1 / (1 + fxRaw / 100) - 1) * 100 : fxRaw;
    const usd = loc != null && fx != null ? ((1 + loc / 100) * (1 + fx / 100) - 1) * 100 : null;
    const y10 = m.c === "US" ? tenorVal(cv.data?.us[0], "10Y") : m.sov ? sov.data?.countries.find((x) => x.code === m.sov)?.y ?? null : null;
    return { ...m, price: te?.price ?? c[c.length - 1] ?? null, loc, fx, usd, vol: annVol(c, 60), dd: c.length > 20 ? drawdown(c.slice(-252)).now : null, y10, spark: c.slice(-63) };
  }), [cl.data, ticks, n, sov.data, cv.data]);
  const val = (r: (typeof rows)[number]) => (metric === "loc" ? r.loc : metric === "usd" ? r.usd : metric === "fx" ? r.fx : metric === "vol" ? r.vol : metric === "dd" ? r.dd : r.y10);
  const isPct = metric !== "y10";
  const scale = metric === "vol" ? 30 : metric === "dd" ? 20 : metric === "y10" ? 5 : n === 0 ? 2 : n === 5 ? 4 : n === 21 ? 8 : 15;
  const tone = (v: number | null) => (v == null ? undefined : metric === "vol" ? heat(v - 18, 15) : metric === "y10" ? heat(v - 3, 3) : heat(v, scale));
  const regions = ["美洲", "欧洲", "亚太"];
  const ranked = rows.filter((r) => val(r) != null).sort((a, b) => (val(b) ?? 0) - (val(a) ?? 0));
  const best = ranked[0], worst = ranked[ranked.length - 1];
  const showPeriod = ["loc", "usd", "fx"].includes(metric);
  return (
    <div className="h-[calc(100vh-56px)] min-h-[640px]">
      <PanelShell code="BMAP" title="全球市场热力地图" tabs={METRICS} tab={metric} setTab={setMetric} right={<span>{BMAP_MKTS.length} 个市场</span>}>
        {showPeriod && <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><span className="text-[10px] text-slate-500">区间</span><Seg value={period} onChange={setPeriod} options={PERIODS.map(([k, l]) => [k, l] as [string, string])} /></div>}
        <Kpis items={[["最强", best ? best.n : "—", best ? `${f2(val(best), 2, isPct ? "%" : "%")}` : undefined], ["最弱", worst ? worst.n : "—", worst ? `${f2(val(worst), 2, "%")}` : undefined], ["全球等权平均", ranked.length ? `${f2(mean(ranked.map((r) => val(r)!)), 2, "%")}` : "—", `${ranked.length} 个市场有数据`], ["美国 10 年期国债", f2(tenorVal(cv.data?.us[0], "10Y"), 3, "%"), cv.data?.us[0]?.date]]} />
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-3">
          {regions.map((rg) => (
            <div key={rg} className="bg-[#03070c]">
              <div className="flex items-center justify-between bg-[#07111c] px-2 py-0.5 text-[10px]"><span className="font-semibold text-cyan-300">{rg}</span><span className="font-mono text-slate-400">均值 {(() => { const v = rows.filter((r) => r.r === rg && val(r) != null).map((r) => val(r)!); return v.length ? f2(mean(v), 2, "%") : "—"; })()}</span></div>
              <div className="grid grid-cols-3 gap-px p-px sm:grid-cols-4">
                {rows.filter((r) => r.r === rg).map((r) => { const v = val(r); return (
                  <button key={r.c} type="button" onClick={() => pick(r.eq)} title={`${r.n} ${r.eq}`} className="bg-[#08121e] px-1.5 py-1 text-left hover:outline hover:outline-1 hover:outline-cyan-500" style={{ background: tone(v) }}>
                    <div className="text-[10px] text-slate-200">{r.n}</div>
                    <div className="font-mono text-[12px] font-semibold text-white">{v == null ? "—" : `${metric === "y10" ? v.toFixed(2) : `${v > 0 && metric !== "vol" ? "+" : ""}${v.toFixed(2)}`}%`}</div>
                    <div className="font-mono text-[9px] text-slate-400">{fmtPrice(r.price)}</div>
                  </button>
                ); })}
              </div>
            </div>
          ))}
        </div>
        <SectionHead title={`排名：${METRICS.find((m) => m[0] === metric)![1]}${showPeriod ? `（${PERIODS.find((p) => p[0] === period)![1]}）` : ""}`} />
        {ranked.length ? <Bars data={ranked.map((r) => ({ k: r.n, v: val(r)! }))} fmt={(v) => `${v.toFixed(2)}%`} height={150} /> : <Empty loading={cl.loading} />}
        <table className="w-full text-[11px]">
          <thead className={thead}><tr><th className={THL}>市场</th><th className={THL}>地区</th><th className={TH}>指数</th><th className={TH}>本币收益</th><th className={TH}>汇率贡献</th><th className={TH}>美元计价</th><th className={TH}>60 日波动</th><th className={TH}>距一年高点</th><th className={TH}>10 年国债</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.c} onClick={() => pick(r.eq)} className={`cursor-pointer ${ROW}`}><td className={`${TDL} text-slate-100`}>{r.n}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.eq}</span></td><td className={`${TDL} text-slate-500`}>{r.r}</td><td className={`${TD} text-white`}>{fmtPrice(r.price)}</td><td className={TD} style={{ color: toneOf(r.loc) }}>{sgn(r.loc)}</td><td className={TD} style={{ color: toneOf(r.fx) }}>{r.fx ? sgn(r.fx) : r.c === "US" ? "—" : sgn(r.fx)}</td><td className={TD} style={{ background: heat(r.usd, scale) }}>{sgn(r.usd)}</td><td className={`${TD} text-slate-300`}>{f2(r.vol, 1, "%")}</td><td className={TD} style={{ color: toneOf(r.dd) }}>{f2(r.dd, 1, "%")}</td><td className={`${TD} text-amber-200`}>{f2(r.y10, 2, "%")}</td></tr>)}</tbody>
        </table>
        <Note>美元计价收益 = (1 + 本币收益) × (1 + 汇率贡献) − 1；汇率贡献为该货币对美元的升贬值。10 年期国债收益率：美国为每日收盘曲线，欧洲国家为最新月度长期利率，其余市场暂无公开逐日数据。点瓦片或行查看指数 K 线。</Note>
      </PanelShell>
    </div>
  );
}

/* ================================================================== 外汇原控件交互桥 */
type BridgeModule = "FXTF" | "FXC";
function tickerFromEvent(target: Element) {
  const text = target.closest("div")?.textContent ?? "";
  return text.match(/\b[A-Z]{6}\b/)?.[0] ?? null;
}
function matrixCellFromEvent(target: Element) {
  const cell = target.closest("td");
  const table = cell?.closest("table");
  const row = cell?.parentElement;
  if (!cell || !table || !row || (cell as HTMLTableCellElement).cellIndex === 0) return null;
  const quote = row.firstElementChild?.textContent?.trim();
  const headers = [...table.querySelectorAll("thead th")].map((h) => h.textContent?.trim() ?? "");
  const base = headers[(cell as HTMLTableCellElement).cellIndex];
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote ?? "")) return null;
  return { base, quote: quote! };
}
function downloadCsv(name: string, text: string) {
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function ForexBridge({ moduleId, children }: { moduleId: BridgeModule; children: ReactNode }) {
  const [selected, setSelected] = useState("EURUSD");
  const saved = useSaved<string[]>("fx-bridge-watch");
  const [local, setLocal] = useState<string[] | null>(null);
  const watch = local ?? saved.data ?? [];
  const [chart, setChart] = useState<string | null>(null);
  const [action, setAction] = useState<"view" | "output" | "settings" | null>(null);
  const [cell, setCell] = useState<{ base: string; quote: string } | null>(null);
  const [refreshAt, setRefreshAt] = useState<string | null>(null);
  const [cols, setCols] = useState<string[]>(["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "CAD", "CNH"]);
  const v = useUsdValues();
  const wt = useTicks(watch);
  const persist = async (next: string[]) => { setLocal(next); await saveItem("fx-bridge-watch", next); };
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handle = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (target.closest("[data-bridge-ui]")) return;
    const button = target.closest("button");
    const label = button?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (moduleId === "FXTF") {
      if (!button) { const tk = tickerFromEvent(target); if (tk) setSelected(tk); return; }
      if (label.includes("添加到监控列表")) { stop(e); if (!watch.includes(selected)) void persist([...watch, selected]); return; }
      if (label.includes("查看图表")) { stop(e); setChart(selected); }
      return;
    }
    if (label === "刷新") { stop(e); setRefreshAt(new Date().toLocaleTimeString("zh-CN", { hour12: false })); return; }
    if (label.includes("96) 视图")) { stop(e); setAction("view"); return; }
    if (label.includes("97) 输出")) { stop(e); setAction("output"); return; }
    if (label.includes("98) 设定")) { stop(e); setAction("settings"); return; }
    if (!button) { const d = matrixCellFromEvent(target); if (d) { setCell(d); setAction("view"); } }
  };
  const exportMatrix = () => {
    const head = ["基准\\报价", ...cols].join(",");
    const lines = cols.map((b) => [b, ...cols.map((q) => (b === q ? "1" : fmtRate(crossOf(v, b, q).rate)))].join(","));
    downloadCsv(`交叉汇率_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.csv`, [head, ...lines].join("\n"));
  };
  const dismiss = () => { setChart(null); setAction(null); setCell(null); };
  const cx = cell ? crossOf(v, cell.base, cell.quote) : null;
  return (
    <div className="relative h-full" onClickCapture={handle}>
      {children}
      {moduleId === "FXTF" && watch.length > 0 && (
        <div data-bridge-ui className="absolute bottom-2 right-2 z-20 w-[260px] border border-[#1d3047] bg-[#050b13]/95 text-[11px]">
          <div className="flex items-center justify-between border-b border-[#1a2a3c] px-2 py-1"><span className="text-cyan-300">监控列表（已永久保存）</span><span className="text-[10px] text-slate-500">点代码看图</span></div>
          {watch.map((s) => { const t = wt[s]; return <div key={s} className="flex items-center gap-2 border-t border-[#0f1b29] px-2 py-0.5"><button type="button" onClick={() => setChart(s)} className="font-mono text-slate-100 hover:text-cyan-300">{s}</button><span className="ml-auto font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPrice(t?.price)}</span><span className="w-14 text-right font-mono" style={{ color: toneOf(t?.changePct) }}>{fmtPct(t?.changePct)}</span><button type="button" onClick={() => void persist(watch.filter((x) => x !== s))} className="text-slate-500 hover:text-white" aria-label={`移除 ${s}`}>✕</button></div>; })}
        </div>
      )}
      {(chart || action) && (
        <div data-bridge-ui role="dialog" aria-modal="true" className="absolute inset-2 z-30 flex flex-col overflow-hidden border border-[#1d3047] bg-[#03070c] text-slate-200 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1 text-[12px]"><span className="font-mono text-amber-300">{chart ? "图表" : "FXC"}</span><span className="text-white">{chart ? chart : action === "view" ? (cell ? `${cell.base}/${cell.quote} 单元格详情` : "矩阵视图") : action === "output" ? "矩阵输出" : "矩阵设定"}</span>{refreshAt && <span className="text-[10px] text-slate-500">最后刷新 {refreshAt}</span>}<button type="button" onClick={dismiss} className="ml-auto px-1 text-slate-400 hover:text-white">✕</button></div>
          <div className="min-h-0 flex-1 overflow-auto">
            {chart && <div className="h-full min-h-[360px]"><SymbolPane symbol={chart} onClose={dismiss} /></div>}
            {!chart && action === "view" && <>
              {cell && cx && <Kpis items={[[`${CCY_ZH[cell.base] ?? cell.base} / ${CCY_ZH[cell.quote] ?? cell.quote}`, fmtRate(cx.rate)], ["今日涨跌", <span style={{ color: toneOf(cx.chg) }}>{fmtPct(cx.chg)}</span>], ["反向报价", fmtRate(cx.rate ? 1 / cx.rate : null)], ["K 线", <button type="button" onClick={() => setChart(pairSymbol(cell.base, cell.quote))} className="text-[12px] text-cyan-300 hover:underline">打开</button>]]} />}
              <MatrixTable cols={cols} v={v} onCell={(b, q) => setCell({ base: b, quote: q })} />
            </>}
            {!chart && action === "output" && <div className="p-2 text-[11px]"><MatrixTable cols={cols} v={v} onCell={() => undefined} /><button type="button" onClick={exportMatrix} className="mt-2 border border-[#1d3047] px-2 py-0.5 text-cyan-200 hover:bg-[#0a1726]">下载当前实时矩阵 CSV</button></div>}
            {!chart && action === "settings" && <div className="p-2 text-[11px]"><div className="mb-1 text-slate-400">矩阵包含的货币（视图与输出共用）</div><div className="flex flex-wrap gap-1">{CCYS.map((c) => <button key={c} type="button" onClick={() => setCols((x) => (x.includes(c) ? (x.length > 2 ? x.filter((y) => y !== c) : x) : [...x, c]))} className={`border px-2 py-0.5 font-mono ${cols.includes(c) ? "border-cyan-600 bg-[#0d2236] text-cyan-100" : "border-[#1d3047] text-slate-400"}`}>{c} {CCY_ZH[c]}</button>)}</div></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function MatrixTable({ cols, v, onCell }: { cols: string[]; v: ReturnType<typeof useUsdValues>; onCell: (base: string, quote: string) => void }) {
  return (
    <table className="w-full text-[11px]">
      <thead className={thead}><tr><th className={THL}>基准 \ 报价</th>{cols.map((c) => <th key={c} className={TH}>{c}</th>)}</tr></thead>
      <tbody>{cols.map((b) => <tr key={b} className={ROW}><td className={`${TDL} font-mono text-slate-100`}>{b}<span className="ml-1 text-[9px] text-slate-500">{CCY_ZH[b]}</span></td>{cols.map((q) => { if (b === q) return <td key={q} className={`${TD} text-slate-600`}>—</td>; const x = crossOf(v, b, q); return <td key={q} onClick={() => onCell(b, q)} className={`${TD} cursor-pointer hover:outline hover:outline-1 hover:outline-cyan-600`} style={{ background: heat(x.chg, 1) }}>{fmtRate(x.rate)}</td>; })}</tr>)}</tbody>
    </table>
  );
}
