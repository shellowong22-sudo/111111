/**
 * 宏观 / 国家组（实时数据版）：
 * COUN 国家指南（单一国家深度档案） · CountryMonitor 跨国市场监控（股市 / 汇率 / 主权利差 / 压力）
 * FOEC 一致预期与经济意外 · GCPI 全球通胀与实际利率 · PMI 全球采购经理指数 · MIPR 美国政策利率与期限
 * 数据：实时行情推送、真实日线计算、经济日历（实际 / 预期 / 前值）、年度官方宏观统计、货币市场利率、国债曲线。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, ucGet, usePolled, useTicks, UP, DOWN } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { align, annVol, corr, drawdown, f2, heat, perf, rets, rollingVol, sgn, useCloses, type Pack } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

export type P = { onClose?: () => void };

/* ================================================================== 公用 */
export const TH = "px-2 py-1 text-right font-normal";
export const THL = "px-2 py-1 text-left font-normal";
export const TD = "px-2 py-0.5 text-right font-mono";
export const TDL = "px-2 py-0.5 text-left";
export const ROW = "border-t border-[#0f1b29] hover:bg-[#0a1726]";
export const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
export const dayStr = (offset: number) => new Date(Date.now() + offset * 86400e3).toISOString().slice(0, 10);
/** 收益率类报价统一成百分数 */
export const yld = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v > 20 ? v / 10 : v);
export const closesOf = (pack: Pack | null | undefined, s: string) => (pack?.[s] ?? []).map((x) => x[1]);
/** 年初至今（按自身日线） */
export function ytdOf(pack: Pack | null | undefined, s: string) {
  const arr = pack?.[s] ?? [];
  if (arr.length < 2) return null;
  const y0 = Date.UTC(new Date().getUTCFullYear(), 0, 1);
  const base = [...arr].reverse().find(([t]) => t < y0)?.[1];
  return base ? (arr[arr.length - 1][1] / base - 1) * 100 : null;
}
export function pctRank(v: number | null | undefined, all: Array<number | null | undefined>) {
  const xs = all.filter((x): x is number => x != null && Number.isFinite(x));
  if (v == null || !Number.isFinite(v) || xs.length < 3) return null;
  return (xs.filter((x) => x < v).length / (xs.length - 1)) * 100;
}

export type Ctry = { code: string; zh: string; idx: string; fx: string; inv: boolean; ccy: string; etf: string; cal: string[]; sov?: string; q: string };
export const CTRY: Ctry[] = [
  { code: "US", zh: "美国", idx: "^GSPC", fx: "DXY", inv: false, ccy: "美元指数", etf: "SPY", cal: ["美国"], q: "美国 经济" },
  { code: "CN", zh: "中国", idx: "sh000300", fx: "USDCNH", inv: true, ccy: "美元/离岸人民币", etf: "MCHI", cal: ["中国"], q: "中国 经济" },
  { code: "JP", zh: "日本", idx: "^N225", fx: "USDJPY", inv: true, ccy: "美元/日元", etf: "EWJ", cal: ["日本"], q: "日本" },
  { code: "DE", zh: "德国", idx: "^GDAXI", fx: "EURUSD", inv: false, ccy: "欧元/美元", etf: "EWG", cal: ["德国", "欧元区"], sov: "DE", q: "德国" },
  { code: "GB", zh: "英国", idx: "^FTSE", fx: "GBPUSD", inv: false, ccy: "英镑/美元", etf: "EWU", cal: ["英国"], q: "英国" },
  { code: "FR", zh: "法国", idx: "^FCHI", fx: "EURUSD", inv: false, ccy: "欧元/美元", etf: "EWQ", cal: ["法国", "欧元区"], sov: "FR", q: "法国" },
  { code: "IT", zh: "意大利", idx: "FTSEMIB.MI", fx: "EURUSD", inv: false, ccy: "欧元/美元", etf: "EWI", cal: ["意大利", "欧元区"], sov: "IT", q: "意大利" },
  { code: "ES", zh: "西班牙", idx: "^IBEX", fx: "EURUSD", inv: false, ccy: "欧元/美元", etf: "EWP", cal: ["西班牙", "欧元区"], sov: "ES", q: "西班牙" },
  { code: "NL", zh: "荷兰", idx: "^AEX", fx: "EURUSD", inv: false, ccy: "欧元/美元", etf: "EWN", cal: ["欧元区"], sov: "NL", q: "荷兰" },
  { code: "CH", zh: "瑞士", idx: "^SSMI", fx: "USDCHF", inv: true, ccy: "美元/瑞郎", etf: "EWL", cal: ["瑞士"], q: "瑞士" },
  { code: "IN", zh: "印度", idx: "^BSESN", fx: "INR=X", inv: true, ccy: "美元/印度卢比", etf: "INDA", cal: ["印度"], q: "印度" },
  { code: "BR", zh: "巴西", idx: "^BVSP", fx: "BRL=X", inv: true, ccy: "美元/巴西雷亚尔", etf: "EWZ", cal: ["巴西"], q: "巴西" },
  { code: "MX", zh: "墨西哥", idx: "^MXX", fx: "MXN=X", inv: true, ccy: "美元/墨西哥比索", etf: "EWW", cal: ["墨西哥"], q: "墨西哥" },
  { code: "CA", zh: "加拿大", idx: "^GSPTSE", fx: "USDCAD", inv: true, ccy: "美元/加元", etf: "EWC", cal: ["加拿大"], q: "加拿大" },
  { code: "AU", zh: "澳大利亚", idx: "^AXJO", fx: "AUDUSD", inv: false, ccy: "澳元/美元", etf: "EWA", cal: ["澳大利亚"], q: "澳大利亚" },
  { code: "KR", zh: "韩国", idx: "^KS11", fx: "KRW=X", inv: true, ccy: "美元/韩元", etf: "EWY", cal: ["韩国"], q: "韩国" },
  { code: "SG", zh: "新加坡", idx: "^STI", fx: "SGD=X", inv: true, ccy: "美元/新加坡元", etf: "EWS", cal: ["新加坡"], q: "新加坡" },
  { code: "HK", zh: "中国香港", idx: "^HSI", fx: "HKD=X", inv: true, ccy: "美元/港元", etf: "EWH", cal: ["中国香港"], q: "香港" },
  { code: "ZA", zh: "南非", idx: "EZA", fx: "ZAR=X", inv: true, ccy: "美元/南非兰特", etf: "EZA", cal: ["南非"], q: "南非" },
];
export const zhOf = (code: string) => CTRY.find((c) => c.code === code)?.zh ?? code;

/** 年度官方宏观（各国最近公布年度）+ 股指年内表现 + 政策利率 */
export type HeatRow = { code: string; name: string; region: string; equityReturn: number; gdpGrowth: number | null; inflation: number | null; rate: number | null; riskScore: number | null; capitalFlow: number | null; debtGdp: number | null; vol1y: number | null; maxDrawdown1y: number | null; dataYear: string | null };
export const useHeat = (on = true) => usePolled<{ data: HeatRow[] }>("platformTools.getGlobalHeatMap", on ? { metric: "equityReturn" } : null, 1_800_000);

/* ------------------------------------------------------------------ 经济日历（多窗口拼接） */
export type EconEvent = { id: string; date: string; time: number | null; country: string; region: string; name: string; nameZh: string; actual: string | null; consensus: string | null; previous: string | null; importance: 1 | 2 | 3; surprise: number | null; released: boolean };
const calCache = new Map<string, { at: number; ttl: number; p: Promise<EconEvent[]> }>();
function calWindow(from: string, days: number) {
  const key = `${from}|${days}`;
  const hit = calCache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.p;
  const end = new Date(Date.parse(`${from}T00:00:00Z`) + (days - 1) * 86400e3).toISOString().slice(0, 10);
  const ttl = end < dayStr(-1) ? 6 * 3600e3 : 120e3;
  const p = ucGet<EconEvent[]>("ucNews.calendar", { from, days }, AbortSignal.timeout(40000)).catch(() => {
    calCache.delete(key);
    return [] as EconEvent[];
  });
  calCache.set(key, { at: Date.now(), ttl, p });
  return p;
}
/** back：回看天数；fwd：向后天数（含今天） */
export function useCalHistory(back: number, fwd: number, on = true) {
  const [st, setSt] = useState<{ key: string; events: EconEvent[]; loading: boolean }>({ key: "", events: [], loading: on });
  const key = `${back}|${fwd}|${on}`;
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const run = async () => {
      const wins: Array<[string, number]> = [];
      for (let off = -back; off < fwd; off += 10) wins.push([dayStr(off), Math.max(1, Math.min(10, fwd - off))]);
      const lists = await Promise.all(wins.map(([f, d]) => calWindow(f, d)));
      const seen = new Set<string>();
      const out: EconEvent[] = [];
      for (const e of lists.flat()) { if (seen.has(e.id)) continue; seen.add(e.id); out.push(e); }
      out.sort((a, b) => (a.time ?? Date.parse(`${a.date}T23:59:00Z`)) - (b.time ?? Date.parse(`${b.date}T23:59:00Z`)));
      if (alive) setSt({ key, events: out, loading: false });
    };
    setSt((s) => (s.key === key ? s : { key, events: [], loading: true }));
    void run();
    const t = setInterval(run, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, [key]);
  return st.key === key ? st : { key, events: [] as EconEvent[], loading: on };
}
export const numOf = (s: string | null | undefined) => {
  if (!s) return null;
  const m = /-?\d+(?:\.\d+)?/.exec(s.replace(/,/g, ""));
  return m ? Number(m[0]) : null;
};
export const INFL_RE = /CPI|PPI|PCE|Inflation|Price Index|Deflator/i;
export const INV_RE = /Unemployment|Jobless|Claims/i;
export const ACT_RE = /GDP|PMI|ISM|Retail|Industrial|Payroll|Employment|Unemployment|Jobless|Claims|ADP|JOLTS|Orders|Confidence|Sentiment|Sales|Housing|Building|Production|Trade Balance|Earnings/i;
/** 意外方向：+1 好于预期（对增长 / 就业）或高于预期（对通胀）；-1 相反 */
export function beatSign(e: EconEvent) {
  if (e.surprise == null || e.surprise === 0) return 0;
  const s = e.surprise > 0 ? 1 : -1;
  return INV_RE.test(e.name) ? -s : s;
}
const fmtTime = (e: EconEvent) => (e.time ? new Date(e.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");

export function CalTable({ rows, showRegion = true, max = 300 }: { rows: EconEvent[]; showRegion?: boolean; max?: number }) {
  if (!rows.length) return <Empty text="该区间暂无发布" />;
  return (
    <table className="w-full text-[11px]">
      <thead className="text-[10px] text-slate-500"><tr><th className={THL}>日期</th><th className={THL}>时间</th>{showRegion && <th className={THL}>国家</th>}<th className={THL}>指标</th><th className={TH}>实际</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>意外</th></tr></thead>
      <tbody>{rows.slice(0, max).map((e) => {
        const b = beatSign(e);
        return (
          <tr key={e.id} className={ROW}>
            <td className={`${TDL} font-mono text-[10px] text-slate-500`}>{e.date.slice(5)}</td>
            <td className={`${TDL} font-mono text-[10px] text-slate-500`}>{fmtTime(e)}</td>
            {showRegion && <td className={`${TDL} text-slate-300`}>{e.region}</td>}
            <td className={TDL}><span className={e.importance === 3 ? "text-amber-200" : "text-slate-200"}>{e.nameZh}</span></td>
            <td className={`${TD} text-white`}>{e.actual ?? "—"}</td>
            <td className={`${TD} text-slate-400`}>{e.consensus ?? "—"}</td>
            <td className={`${TD} text-slate-500`}>{e.previous ?? "—"}</td>
            <td className={TD} style={{ color: b > 0 ? UP : b < 0 ? DOWN : "#64748b" }}>{e.surprise == null ? "—" : `${e.surprise > 0 ? "+" : ""}${+e.surprise.toFixed(3)}`}</td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}

const ctryBtns = (code: string, set: (c: string) => void) => (
  <div className="flex flex-wrap gap-1 px-2 py-1">{CTRY.map((c) => <button key={c.code} type="button" onClick={() => set(c.code)} className={`border px-1.5 text-[10px] ${c.code === code ? "border-cyan-500 bg-[#0d2236] text-cyan-100" : "border-[#1d3047] text-slate-400 hover:text-white"}`}>{c.zh}</button>)}</div>
);

/* ================================================================== COUN 国家指南 */
export function MacroCOUN({ onClose }: P) {
  const [code, setCode] = useState("US");
  const [tab, setTab] = useState("ov");
  const c = CTRY.find((x) => x.code === code)!;
  const hm = useHeat();
  const rows = hm.data?.data ?? [];
  const me = rows.find((r) => r.code === code);
  const cal = useCalHistory(21, 8, tab === "ov");
  const syms = [c.idx, c.fx, c.etf, "^GSPC"].filter((s, i, a) => a.indexOf(s) === i);
  const pack = useCloses(tab === "mkt" || tab === "ov" ? syms : [], 520);
  const feed = useFeed(tab === "news" ? { q: c.q, limit: 80, hours: 96 } : null, 60_000);
  const sov = usePolled<{ countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; chg1m: number | null; chg12m: number | null }> }>("ucHubs.sovereign", c.sov ? {} : null, 3600_000);
  const sv = sov.data?.countries.find((x) => x.code === c.sov);
  const real = me?.rate != null && me?.inflation != null ? me.rate - me.inflation : null;
  const myCal = cal.events.filter((e) => c.cal.includes(e.region));
  const ix = closesOf(pack.data, c.idx);
  const fx = closesOf(pack.data, c.fx);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data, syms.join()]);
  const base = (arr: number[] | undefined, inv = false) => (arr && arr.length ? arr.map((v) => (inv ? arr[0] / v : v / arr[0]) * 100) : []);
  const rank = (k: keyof HeatRow) => { const v = me?.[k] as number | null | undefined; const all = rows.map((r) => r[k] as number | null); const xs = all.filter((x): x is number => x != null); return v == null ? "—" : `${xs.filter((x) => x > v).length + 1}/${xs.length}`; };
  const [sortK, setSortK] = useState<"gdpGrowth" | "inflation" | "rate" | "debtGdp" | "riskScore" | "equityReturn">("gdpGrowth");
  return (
    <PanelShell code="COUN" title={`国家指南 · ${c.zh}`} onClose={onClose} tabs={[["ov", "国家概览"], ["mkt", "市场表现"], ["cmp", "宏观横比"], ["news", "国家资讯"]]} tab={tab} setTab={setTab}>
      {ctryBtns(code, setCode)}
      {tab === "ov" && <>
        <Kpis items={[
          ["实际 GDP 增速", me?.gdpGrowth != null ? `${me.gdpGrowth.toFixed(1)}%` : "—", me?.dataYear ? `${me.dataYear} 年 · 排名 ${rank("gdpGrowth")}` : undefined],
          ["CPI 通胀", me?.inflation != null ? `${me.inflation.toFixed(1)}%` : "—", `排名 ${rank("inflation")}`],
          ["政策利率", me?.rate != null ? `${me.rate.toFixed(2)}%` : "—", real != null ? `实际利率 ${sgn(real, 2)}` : undefined],
          ["政府债务 / GDP", me?.debtGdp != null ? `${me.debtGdp.toFixed(1)}%` : "—", `排名 ${rank("debtGdp")}`],
          ["资本净流入", me?.capitalFlow != null ? `${me.capitalFlow.toFixed(1)} 十亿美元` : "—", "直接投资 + 股权证券投资"],
          ["股指年初至今", Number.isFinite(me?.equityReturn as number) ? sgn(me!.equityReturn, 1) : sgn(ytdOf(pack.data, c.idx), 1)],
          ["股指一年波动 / 回撤", `${f2(me?.vol1y, 1)}% / ${f2(me?.maxDrawdown1y, 1)}%`],
          ["综合风险分", me?.riskScore != null ? `${me.riskScore}` : "—", "0 低 · 100 高（样本内百分位）"],
        ]} />
        <SectionHead title="核心市场实时" sub={sv ? `10 年期国债 ${sv.y.toFixed(2)}%（${sv.date}）· 对德利差 ${sv.spread ?? "—"}bp · 月变动 ${sv.chg1m ?? "—"}bp` : undefined} />
        <LiveBoard rows={[{ symbol: c.idx, label: `${c.zh}基准股指` }, { symbol: c.fx, label: c.ccy }, { symbol: c.etf, label: `${c.zh}股票（美元计价）` }]} />
        <SectionHead title={`${c.zh}经济数据：近 3 周已公布 + 未来 1 周`} sub="意外：红色为强于预期（失业类指标取反），绿色为弱于预期" />
        {cal.loading && !myCal.length ? <Empty loading /> : <CalTable rows={[...myCal].reverse()} showRegion={c.cal.length > 1} />}
        <Note>宏观基线为该国最近一个已公布年度的官方年度统计；排名为在 {rows.length} 个主要经济体中的位次（由高到低）。</Note>
      </>}
      {tab === "mkt" && <>
        <Kpis items={[
          ["股指 1 月 / 3 月", `${sgn(perf(ix, 21), 1)} / ${sgn(perf(ix, 63), 1)}`],
          ["股指 1 年", sgn(perf(ix, 252), 1), `年化波动 ${f2(annVol(ix, 252), 1)}%`],
          [`本币 1 年（对美元）`, sgn(fx.length > 252 ? (c.inv ? fx[fx.length - 253] / fx[fx.length - 1] - 1 : fx[fx.length - 1] / fx[fx.length - 253] - 1) * 100 : null, 1), c.code === "US" ? "美元指数" : "正值 = 本币升值"],
          ["与标普日收益相关（1 年）", c.idx === "^GSPC" ? "—" : f2(corr(rets((m[c.idx] ?? []).slice(-253)), rets((m["^GSPC"] ?? []).slice(-253))), 2)],
        ]} />
        <SectionHead title="两年走势（起点为 100）" />
        {dates.length ? <Lines series={[{ name: `${c.zh}股指（本币）`, color: "#fbbf24", values: base(m[c.idx]) }, { name: `${c.zh}股票（美元）`, color: "#38bdf8", values: base(m[c.etf]) }, ...(c.code !== "US" ? [{ name: "本币强弱", color: "#a78bfa", values: base(m[c.fx], c.inv) }] : []), { name: "标普 500", color: "#64748b", values: base(m["^GSPC"]), dash: true }]} xLabels={dates.map((d) => d.slice(2))} height={220} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} />}
        <SectionHead title="股指回撤（距前高）" />
        {ix.length ? <Lines series={[{ name: "回撤 %", color: DOWN, values: drawdown(ix.slice(-504)).series }]} height={120} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} />}
      </>}
      {tab === "cmp" && <>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500">排序<Seg value={sortK} onChange={setSortK} options={[["gdpGrowth", "增速"], ["inflation", "通胀"], ["rate", "政策利率"], ["debtGdp", "债务"], ["riskScore", "风险分"], ["equityReturn", "股指"]]} /></div>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>经济体</th><th className={TH}>GDP 增速</th><th className={TH}>通胀</th><th className={TH}>政策利率</th><th className={TH}>实际利率</th><th className={TH}>债务/GDP</th><th className={TH}>资本流入(十亿$)</th><th className={TH}>股指年内</th><th className={TH}>1年波动</th><th className={TH}>风险分</th><th className={TH}>年度</th></tr></thead>
          <tbody>{[...rows].sort((a, b) => ((b[sortK] as number | null) ?? -1e9) - ((a[sortK] as number | null) ?? -1e9)).map((r) => {
            const rr = r.rate != null && r.inflation != null ? r.rate - r.inflation : null;
            return (
              <tr key={r.code} onClick={() => CTRY.some((x) => x.code === r.code) && setCode(r.code)} className={`${ROW} cursor-pointer ${r.code === code ? "bg-[#0d2236]" : ""}`}>
                <td className={`${TDL} text-slate-100`}>{zhOf(r.code)}</td>
                <td className={TD} style={{ background: heat(r.gdpGrowth != null ? r.gdpGrowth - 2 : null, 4) }}>{f2(r.gdpGrowth, 1)}</td>
                <td className={TD} style={{ background: heat(r.inflation != null ? r.inflation - 2 : null, 6) }}>{f2(r.inflation, 1)}</td>
                <td className={`${TD} text-slate-200`}>{f2(r.rate, 2)}</td>
                <td className={TD} style={{ color: toneOf(rr) }}>{sgn(rr, 2, "")}</td>
                <td className={`${TD} text-slate-300`}>{f2(r.debtGdp, 0)}</td>
                <td className={`${TD} text-slate-300`}>{f2(r.capitalFlow, 1)}</td>
                <td className={TD} style={{ color: toneOf(r.equityReturn) }}>{sgn(r.equityReturn, 1)}</td>
                <td className={`${TD} text-slate-400`}>{f2(r.vol1y, 1)}</td>
                <td className={TD} style={{ background: heat(r.riskScore != null ? r.riskScore - 50 : null, 50) }}>{r.riskScore ?? "—"}</td>
                <td className={`${TD} text-[10px] text-slate-500`}>{r.dataYear ?? "—"}</td>
              </tr>
            );
          })}{!rows.length && <tr><td colSpan={11}><Empty loading={hm.loading} /></td></tr>}</tbody>
        </table>
        <Note>实际利率 = 政策利率 − 年度通胀；风险分为股指一年波动、一年最大回撤、通胀、政府债务四项的样本内百分位均值。点击行切换国家。</Note>
      </>}
      {tab === "news" && <FeedList items={feed.items} loading={feed.loading} empty={`近 4 天暂无与${c.zh}相关的资讯`} />}
    </PanelShell>
  );
}

/* ================================================================== 国家监控：跨国市场 */
export function MacroCountryMonitor({ onClose }: P) {
  const [tab, setTab] = useState("eq");
  const fxs = [...new Set(CTRY.filter((c) => c.code !== "US").map((c) => c.fx))];
  const needEq = tab === "eq" || tab === "stress";
  const needFx = tab === "fx" || tab === "stress";
  const eqPack = useCloses(needEq ? CTRY.map((c) => c.idx) : [], 400);
  const fxPack = useCloses(needFx ? fxs : [], 400);
  const t = useTicks(tab === "eq" ? CTRY.map((c) => c.idx) : tab === "fx" ? fxs : tab === "sov" ? ["^TNX"] : []);
  const sov = usePolled<{ countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; spread1m: number | null; spread12m: number | null; chg1m: number | null; chg12m: number | null; hist: Array<{ d: string; y: number; s: number | null }> }> }>("ucHubs.sovereign", tab === "sov" ? {} : null, 3600_000);
  const { pick } = useHub();
  const [sortK, setSortK] = useState<"d" | "m1" | "ytd" | "volp">("d");
  const eqRows = CTRY.map((c) => {
    const cl = closesOf(eqPack.data, c.idx);
    const rv = rollingVol(cl.slice(-273), 20).filter((x): x is number => x != null);
    const v20 = rv[rv.length - 1] ?? null;
    const hi = cl.length ? Math.max(...cl.slice(-252)) : null;
    return { c, d: t[c.idx]?.changePct ?? null, w1: perf(cl, 5), m1: perf(cl, 21), m3: perf(cl, 63), ytd: ytdOf(eqPack.data, c.idx), v20, volp: pctRank(v20, rv), dd: hi && cl.length ? (cl[cl.length - 1] / hi - 1) * 100 : null };
  }).sort((a, b) => (b[sortK] ?? -1e9) - (a[sortK] ?? -1e9));
  const fxRows = fxs.map((s) => {
    const meta = CTRY.find((c) => c.fx === s)!;
    const cl = closesOf(fxPack.data, s);
    const loc = (n: number) => (cl.length > n ? (meta.inv ? cl[cl.length - 1 - n] / cl[cl.length - 1] - 1 : cl[cl.length - 1] / cl[cl.length - 1 - n] - 1) * 100 : null);
    const d = t[s]?.changePct ?? null;
    return { s, meta, names: CTRY.filter((c) => c.fx === s).map((c) => c.zh).join(" / "), d: d == null ? null : meta.inv ? -d : d, w1: loc(5), m1: loc(21), m3: loc(63), y1: loc(252), vol: annVol(cl, 20) };
  });
  const stress = CTRY.map((c) => {
    const e = eqRows.find((r) => r.c.code === c.code)!;
    const f = c.code === "US" ? null : fxRows.find((r) => r.s === c.fx) ?? null;
    return { c, eq1m: e.m1, fx1m: f?.m1 ?? null, volp: e.volp, dd: e.dd };
  });
  const scored = stress.map((r) => {
    const parts = [pctRank(r.eq1m != null ? -r.eq1m : null, stress.map((x) => (x.eq1m != null ? -x.eq1m : null))), pctRank(r.fx1m != null ? -r.fx1m : null, stress.map((x) => (x.fx1m != null ? -x.fx1m : null))), r.volp, pctRank(r.dd != null ? -r.dd : null, stress.map((x) => (x.dd != null ? -x.dd : null)))].filter((x): x is number => x != null);
    return { ...r, score: parts.length >= 2 ? parts.reduce((a, b) => a + b, 0) / parts.length : null };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const tnx = yld(t["^TNX"]?.price);
  const de = sov.data?.countries.find((x) => x.code === "DE");
  const top = (sov.data?.countries ?? []).filter((x) => x.code !== "DE").slice(0, 6);
  const colors = ["#f59e0b", "#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#94a3b8"];
  return (
    <PanelShell code="CMON" title="国家监控" onClose={onClose} tabs={[["eq", "股市"], ["fx", "汇率"], ["sov", "主权利差"], ["stress", "压力矩阵"]]} tab={tab} setTab={setTab}>
      {tab === "eq" && <>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500">排序<Seg value={sortK} onChange={setSortK} options={[["d", "今日"], ["m1", "1月"], ["ytd", "年内"], ["volp", "波动分位"]]} /><span>点击行查看 K 线</span></div>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>国家 / 基准股指</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>1周</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>年内</th><th className={TH}>20日波动</th><th className={TH}>波动1年分位</th><th className={TH}>距52周高</th></tr></thead>
          <tbody>{eqRows.map((r) => (
            <tr key={r.c.code} onClick={() => pick(r.c.idx)} className={`${ROW} cursor-pointer`}>
              <td className={TDL}><span className="text-slate-100">{r.c.zh}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{r.c.idx}</span></td>
              <td className={`${TD} text-white`}>{fmtPrice(t[r.c.idx]?.price)}</td>
              <td className={TD} style={{ color: toneOf(r.d) }}>{fmtPct(r.d)}</td>
              {[r.w1, r.m1, r.m3, r.ytd].map((v, i) => <td key={i} className={TD} style={{ background: heat(v, [3, 6, 10, 15][i]) }}>{sgn(v, 1)}</td>)}
              <td className={`${TD} text-slate-300`}>{f2(r.v20, 1)}</td>
              <td className={TD} style={{ background: heat(r.volp != null ? r.volp - 50 : null, 50) }}>{f2(r.volp, 0)}</td>
              <td className={`${TD}`} style={{ color: toneOf(r.dd) }}>{sgn(r.dd, 1)}</td>
            </tr>
          ))}</tbody>
        </table>
        {eqPack.loading && <Empty loading />}
      </>}
      {tab === "fx" && <>
        <SectionHead title="各国货币对美元（统一为本币视角：正值 = 本币升值）" sub="美元指数单独列示于美国" />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>货币</th><th className={THL}>经济体</th><th className={TH}>报价</th><th className={TH}>今日</th><th className={TH}>1周</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>1年</th><th className={TH}>20日波动</th></tr></thead>
          <tbody>{fxRows.map((r) => (
            <tr key={r.s} onClick={() => pick(r.s)} className={`${ROW} cursor-pointer`}>
              <td className={TDL}><span className="text-slate-100">{r.meta.ccy}</span></td>
              <td className={`${TDL} text-[10px] text-slate-400`}>{r.names}</td>
              <td className={`${TD} text-white`}>{fmtPrice(t[r.s]?.price, 4)}</td>
              <td className={TD} style={{ color: toneOf(r.d) }}>{fmtPct(r.d)}</td>
              {[r.w1, r.m1, r.m3, r.y1].map((v, i) => <td key={i} className={TD} style={{ background: heat(v, [1.5, 3, 5, 10][i]) }}>{sgn(v, 2)}</td>)}
              <td className={`${TD} text-slate-400`}>{f2(r.vol, 1)}</td>
            </tr>
          ))}</tbody>
        </table>
        <Bars data={fxRows.map((r) => ({ k: r.meta.ccy.replace(/^美元\//, "").replace(/\/美元$/, ""), v: r.m1 ?? 0 }))} fmt={(v) => `${v.toFixed(2)}%`} height={120} />
        {fxPack.loading && <Empty loading />}
      </>}
      {tab === "sov" && <>
        <Kpis items={[["美国 10 年期", tnx != null ? `${tnx.toFixed(3)}%` : "—", "实时"], ["德国 10 年期", de ? `${de.y.toFixed(2)}%` : "—", de?.date], ["美德利差", tnx != null && de ? `${Math.round((tnx - de.y) * 100)}bp` : "—", "美国实时 − 德国月度"], ["欧元区最高利差", top[0] ? `${top[0].name} ${top[0].spread}bp` : "—"]]} />
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>国家</th><th className={THL}>月份</th><th className={TH}>10年收益率</th><th className={TH}>对德利差bp</th><th className={TH}>利差1月前</th><th className={TH}>利差1年前</th><th className={TH}>收益率1月变动bp</th><th className={TH}>1年变动bp</th></tr></thead>
          <tbody>{(sov.data?.countries ?? []).map((r) => (
            <tr key={r.code} className={ROW}>
              <td className={`${TDL} text-slate-100`}>{r.name}</td><td className={`${TDL} font-mono text-[10px] text-slate-500`}>{r.date}</td>
              <td className={`${TD} text-white`}>{r.y.toFixed(2)}%</td>
              <td className={TD} style={{ background: heat(r.spread, 200) }}>{r.spread ?? "—"}</td>
              <td className={`${TD} text-slate-400`}>{r.spread1m ?? "—"}</td><td className={`${TD} text-slate-400`}>{r.spread12m ?? "—"}</td>
              <td className={TD} style={{ color: toneOf(r.chg1m) }}>{r.chg1m ?? "—"}</td><td className={TD} style={{ color: toneOf(r.chg12m) }}>{r.chg12m ?? "—"}</td>
            </tr>
          ))}{!sov.data && <tr><td colSpan={8}><Empty loading={sov.loading} /></td></tr>}</tbody>
        </table>
        <SectionHead title="对德利差历史（bp，月度）" />
        {top.length ? <Lines series={top.map((x, i) => ({ name: x.name, color: colors[i], values: x.hist.map((h) => h.s) }))} xLabels={top[0].hist.map((h) => h.d)} height={180} fmt={(v) => v.toFixed(0)} /> : <Empty loading={sov.loading} />}
      </>}
      {tab === "stress" && <>
        <Note>压力分（0–100）= 股指 1 月跌幅、本币 1 月贬值幅度、股指 20 日波动在自身一年中的分位、距 52 周高点回撤 四项在 19 个经济体中的百分位均值；越高代表市场压力越大。</Note>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>经济体</th><th className={TH}>股指1月</th><th className={TH}>本币1月</th><th className={TH}>波动分位</th><th className={TH}>距高点</th><th className={TH}>压力分</th><th className="px-2 text-left font-normal">压力</th></tr></thead>
          <tbody>{scored.map((r) => (
            <tr key={r.c.code} className={ROW}>
              <td className={`${TDL} text-slate-100`}>{r.c.zh}</td>
              <td className={TD} style={{ color: toneOf(r.eq1m) }}>{sgn(r.eq1m, 1)}</td>
              <td className={TD} style={{ color: toneOf(r.fx1m) }}>{r.c.code === "US" ? "—" : sgn(r.fx1m, 2)}</td>
              <td className={`${TD} text-slate-300`}>{f2(r.volp, 0)}</td>
              <td className={TD} style={{ color: toneOf(r.dd) }}>{sgn(r.dd, 1)}</td>
              <td className={`${TD} font-semibold text-white`} style={{ background: heat(r.score != null ? 50 - r.score : null, 50) }}>{f2(r.score, 0)}</td>
              <td className="px-2"><div className="h-2 bg-[#0f1b29]"><div className="h-2" style={{ width: `${r.score ?? 0}%`, background: (r.score ?? 0) > 60 ? DOWN : (r.score ?? 0) > 40 ? "#f59e0b" : "#334155" }} /></div></td>
            </tr>
          ))}</tbody>
        </table>
        {(eqPack.loading || fxPack.loading) && <Empty loading />}
      </>}
    </PanelShell>
  );
}

/* ================================================================== FOEC 一致预期与经济意外 */
export function MacroFOEC({ onClose }: P) {
  const [tab, setTab] = useState("next");
  const cal = useCalHistory(45, 10);
  const today = dayStr(0);
  const [imp, setImp] = useState<"all" | "hi">("hi");
  const next = cal.events.filter((e) => !e.released && e.date >= today && (e.consensus || e.previous) && (imp === "all" || e.importance >= 2));
  const past = cal.events.filter((e) => e.released && e.surprise != null && e.date <= today);
  const regions = useMemo(() => {
    const m = new Map<string, { n: number; beat: number; miss: number; inN: number; hot: number; cool: number }>();
    for (const e of past) {
      const r = m.get(e.region) ?? { n: 0, beat: 0, miss: 0, inN: 0, hot: 0, cool: 0 };
      const b = beatSign(e);
      if (INFL_RE.test(e.name)) { r.inN++; if (b > 0) r.hot++; if (b < 0) r.cool++; }
      else if (ACT_RE.test(e.name)) { r.n++; if (b > 0) r.beat++; if (b < 0) r.miss++; }
      m.set(e.region, r);
    }
    return [...m.entries()].map(([k, v]) => ({ k, ...v, idx: v.n ? ((v.beat - v.miss) / v.n) * 100 : null, inIdx: v.inN ? ((v.hot - v.cool) / v.inN) * 100 : null })).filter((r) => r.n + r.inN >= 3).sort((a, b) => b.n + b.inN - (a.n + a.inN));
  }, [past]);
  const [reg, setReg] = useState("美国");
  const cum = useMemo(() => {
    const days = [...new Set(past.map((e) => e.date))].sort();
    let s = 0, si = 0;
    const act: number[] = [], inf: number[] = [];
    for (const d of days) {
      for (const e of past) if (e.date === d && e.region === reg) { if (INFL_RE.test(e.name)) si += beatSign(e); else if (ACT_RE.test(e.name)) s += beatSign(e); }
      act.push(s); inf.push(si);
    }
    return { days, act, inf };
  }, [past, reg]);
  const gdp = cal.events.filter((e) => /GDP/i.test(e.name) && (e.actual || e.consensus));
  const hm = useHeat(tab === "gdp");
  return (
    <PanelShell code="FOEC" title="一致预期与经济意外" onClose={onClose} tabs={[["next", "即将公布·市场预期"], ["surp", "经济意外指数"], ["gdp", "增长：发布与年度基线"]]} tab={tab} setTab={setTab}>
      {tab === "next" && <>
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-500"><Seg value={imp} onChange={setImp} options={[["hi", "中高重要性"], ["all", "全部"]]} /><span>未来 10 天 {next.length} 项；预期变化 = 预期 − 前值（市场预期的边际方向）</span></div>
        {cal.loading && !next.length ? <Empty loading /> : (
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className={THL}>日期</th><th className={THL}>时间</th><th className={THL}>国家</th><th className={THL}>指标</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>预期变化</th><th className={THL}>预期方向</th></tr></thead>
            <tbody>{next.slice(0, 300).map((e) => {
              const c = numOf(e.consensus), p = numOf(e.previous);
              const d = c != null && p != null ? c - p : null;
              const dir = d == null ? "—" : Math.abs(d) < 1e-9 ? "持平" : INFL_RE.test(e.name) ? (d > 0 ? "通胀升温" : "通胀降温") : INV_RE.test(e.name) ? (d > 0 ? "就业转弱" : "就业改善") : d > 0 ? "改善" : "走弱";
              return (
                <tr key={e.id} className={ROW}>
                  <td className={`${TDL} font-mono text-[10px] text-slate-500`}>{e.date.slice(5)}</td><td className={`${TDL} font-mono text-[10px] text-slate-500`}>{fmtTime(e)}</td>
                  <td className={`${TDL} text-slate-300`}>{e.region}</td><td className={`${TDL} ${e.importance === 3 ? "text-amber-200" : "text-slate-200"}`}>{e.nameZh}</td>
                  <td className={`${TD} text-white`}>{e.consensus ?? "—"}</td><td className={`${TD} text-slate-500`}>{e.previous ?? "—"}</td>
                  <td className={TD} style={{ color: toneOf(d) }}>{d == null ? "—" : `${d > 0 ? "+" : ""}${+d.toFixed(3)}`}</td>
                  <td className={`${TDL} text-[10px] text-slate-400`}>{dir}</td>
                </tr>
              );
            })}{!next.length && <tr><td colSpan={8}><Empty text="未来 10 天暂无带预期值的发布" /></td></tr>}</tbody>
          </table>
        )}
      </>}
      {tab === "surp" && <>
        <Note>近 45 天已公布数据。增长意外指数 = （强于预期项数 − 弱于预期项数）÷ 增长与就业类发布数 × 100，失业类指标方向取反；通胀意外指数同口径（正值 = 通胀高于预期）。</Note>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>经济体</th><th className={TH}>增长类发布</th><th className={TH}>强于预期</th><th className={TH}>弱于预期</th><th className={TH}>增长意外指数</th><th className={TH}>通胀类发布</th><th className={TH}>通胀意外指数</th></tr></thead>
          <tbody>{regions.map((r) => (
            <tr key={r.k} onClick={() => setReg(r.k)} className={`${ROW} cursor-pointer ${r.k === reg ? "bg-[#0d2236]" : ""}`}>
              <td className={`${TDL} text-slate-100`}>{r.k}</td><td className={`${TD} text-slate-300`}>{r.n}</td><td className={TD} style={{ color: UP }}>{r.beat}</td><td className={TD} style={{ color: DOWN }}>{r.miss}</td>
              <td className={`${TD} font-semibold`} style={{ background: heat(r.idx, 80) }}>{f2(r.idx, 0)}</td><td className={`${TD} text-slate-300`}>{r.inN}</td>
              <td className={TD} style={{ background: heat(r.inIdx, 80) }}>{f2(r.inIdx, 0)}</td>
            </tr>
          ))}{!regions.length && <tr><td colSpan={7}><Empty loading={cal.loading} /></td></tr>}</tbody>
        </table>
        <SectionHead title={`${reg}：累计意外净值（逐日）`} sub="点击上表切换经济体" />
        {cum.days.length ? <Lines series={[{ name: "增长意外累计", color: "#fbbf24", values: cum.act }, { name: "通胀意外累计", color: "#f472b6", values: cum.inf }]} xLabels={cum.days.map((d) => d.slice(5))} height={160} fmt={(v) => v.toFixed(0)} zero /> : <Empty loading={cal.loading} />}
        <SectionHead title={`${reg}：已公布明细`} />
        <CalTable rows={past.filter((e) => e.region === reg).reverse()} showRegion={false} max={120} />
      </>}
      {tab === "gdp" && <>
        <SectionHead title="近 45 天及未来 10 天的 GDP 发布" />
        <CalTable rows={[...gdp].reverse()} />
        <SectionHead title="最近公布年度实际 GDP 增速（%）" />
        {hm.data?.data.length ? <Bars data={[...hm.data.data].filter((r) => r.gdpGrowth != null).sort((a, b) => b.gdpGrowth! - a.gdpGrowth!).map((r) => ({ k: zhOf(r.code), v: r.gdpGrowth! }))} fmt={(v) => `${v.toFixed(1)}%`} height={150} /> : <Empty loading={hm.loading} />}
      </>}
    </PanelShell>
  );
}

/* ================================================================== GCPI 全球通胀 */
export function MacroGCPI({ onClose }: P) {
  const [tab, setTab] = useState("tbl");
  const hm = useHeat();
  const cal = useCalHistory(100, 7);
  const infl = cal.events.filter((e) => INFL_RE.test(e.name));
  const cpiYoY = infl.filter((e) => e.actual && /CPI|Inflation Rate/i.test(e.name) && !/Core|MoM|PPI/i.test(e.name) && (/YoY/i.test(e.name) || /Inflation Rate/i.test(e.name)));
  const latestBy = (region: string) => [...cpiYoY].reverse().find((e) => e.region === region) ?? null;
  const rows = (hm.data?.data ?? []).map((r) => {
    const c = CTRY.find((x) => x.code === r.code);
    const m = c ? latestBy(c.cal[0]) : null;
    const mv = numOf(m?.actual);
    return { r, zh: zhOf(r.code), m, mv, real: r.rate != null ? r.rate - (mv ?? r.inflation ?? NaN) : null };
  }).sort((a, b) => (b.mv ?? b.r.inflation ?? -99) - (a.mv ?? a.r.inflation ?? -99));
  const regions = [...new Set(infl.map((e) => e.region))].slice(0, 10);
  const [reg, setReg] = useState("美国");
  const macro = usePolled<{ rates: Array<{ key: string; label: string; value: number | null; date: string | null }> }>("ucNews.macro", tab === "us" ? {} : null, 900_000);
  const hs = usePolled<{ bls: Array<{ id: string; name: string; points: Array<{ d: string; v: number }> }> }>("ucHubs.housing", tab === "us" ? {} : null, 3600_000);
  const pack = useCloses(tab === "us" ? ["TIP", "IEF"] : [], 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, ["TIP", "IEF"]), [pack.data]);
  const yoy = (pts: Array<{ d: string; v: number }>) => pts.map((p, i) => (i >= 12 ? (p.v / pts[i - 12].v - 1) * 100 : null)).slice(12);
  const cpiSeries = (hs.data?.bls ?? []).filter((s) => /^CUUR/.test(s.id));
  const usCpi = macro.data?.rates.find((x) => x.key === "CPI");
  const usRate = (hm.data?.data ?? []).find((r) => r.code === "US")?.rate ?? null;
  return (
    <PanelShell code="GCPI" title="全球通胀与实际利率" onClose={onClose} tabs={[["tbl", "通胀与实际利率"], ["rel", "通胀发布记录"], ["us", "美国通胀结构"]]} tab={tab} setTab={setTab}>
      {tab === "tbl" && <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>经济体</th><th className={TH}>最新月度 CPI 同比</th><th className={TH}>公布日</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>边际</th><th className={TH}>年度通胀</th><th className={TH}>政策利率</th><th className={TH}>实际政策利率</th></tr></thead>
          <tbody>{rows.map(({ r, zh, m: ev, mv, real }) => {
            const pv = numOf(ev?.previous);
            const d = mv != null && pv != null ? mv - pv : null;
            return (
              <tr key={r.code} className={ROW}>
                <td className={`${TDL} text-slate-100`}>{zh}</td>
                <td className={`${TD} font-semibold text-white`} style={{ background: heat(mv != null ? mv - 2 : null, 5) }}>{ev?.actual ?? "—"}</td>
                <td className={`${TD} text-[10px] text-slate-500`}>{ev?.date.slice(5) ?? "—"}</td>
                <td className={`${TD} text-slate-400`}>{ev?.consensus ?? "—"}</td>
                <td className={`${TD} text-slate-500`}>{ev?.previous ?? "—"}</td>
                <td className={TD} style={{ color: toneOf(d) }}>{d == null ? "—" : d > 0 ? "▲ 升温" : d < 0 ? "▼ 降温" : "持平"}</td>
                <td className={`${TD} text-slate-300`}>{f2(r.inflation, 1)}<span className="text-[9px] text-slate-600"> {r.dataYear ?? ""}</span></td>
                <td className={`${TD} text-slate-200`}>{f2(r.rate, 2)}</td>
                <td className={`${TD} font-semibold`} style={{ color: toneOf(real) }}>{real != null && Number.isFinite(real) ? sgn(real, 2, "") : "—"}</td>
              </tr>
            );
          })}{!rows.length && <tr><td colSpan={9}><Empty loading={hm.loading} /></td></tr>}</tbody>
        </table>
        <Note>实际政策利率 = 政策利率 − 最新月度 CPI 同比（近 100 天无月度发布时用最近年度通胀）。正值代表货币条件偏紧。</Note>
        <SectionHead title="实际政策利率（%）" />
        <Bars data={rows.filter((x) => x.real != null && Number.isFinite(x.real)).map((x) => ({ k: x.zh, v: x.real! }))} fmt={(v) => v.toFixed(2)} height={130} />
      </>}
      {tab === "rel" && <>
        <div className="flex items-center gap-2 px-2 py-1"><Seg value={reg} onChange={setReg} options={regions.map((r) => [r, r] as [string, string])} /></div>
        {cal.loading && !infl.length ? <Empty loading /> : <CalTable rows={infl.filter((e) => e.region === reg).reverse()} showRegion={false} />}
        <Note>含 CPI、核心 CPI、PPI、PCE 等全部物价类发布，近 100 天及未来一周；意外为实际 − 预期，红色为高于预期。</Note>
      </>}
      {tab === "us" && <>
        <Kpis items={[["CPI 同比", usCpi?.value != null ? `${usCpi.value.toFixed(2)}%` : "—", usCpi?.date ?? undefined], ["政策利率", usRate != null ? `${usRate.toFixed(2)}%` : "—"], ["实际政策利率", usRate != null && usCpi?.value != null ? sgn(usRate - usCpi.value, 2, "%") : "—"], ["通胀保值债 / 名义国债 1 年", sgn(perf(m.TIP ?? [], 252) != null && perf(m.IEF ?? [], 252) != null ? perf(m.TIP, 252)! - perf(m.IEF, 252)! : null, 2), "正值 = 通胀补偿走阔"]]} />
        <SectionHead title="居住类价格同比（%）" sub="住所、主要住所租金、业主等价租金" />
        {cpiSeries.length ? <Lines series={cpiSeries.map((s, i) => ({ name: s.name, color: ["#fbbf24", "#38bdf8", "#a78bfa"][i % 3], values: yoy(s.points) }))} xLabels={cpiSeries[0].points.slice(12).map((p) => p.d)} height={180} fmt={(v) => v.toFixed(1)} /> : <Empty loading={hs.loading} />}
        <SectionHead title="通胀保值债相对名义中期国债（比值，起点为 100）" sub="上升代表市场通胀补偿扩大" />
        {dates.length ? <Lines series={[{ name: "比值", color: "#f472b6", values: m.TIP.map((v, i) => (v / m.IEF[i]) / (m.TIP[0] / m.IEF[0]) * 100) }]} xLabels={dates.map((d) => d.slice(2))} height={150} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} />}
      </>}
    </PanelShell>
  );
}

/* ================================================================== PMI */
type PmiKind = "制造业" | "服务业" | "综合";
const pmiKind = (n: string): PmiKind | null => (/Composite/i.test(n) ? "综合" : /Services|Non-Manufacturing/i.test(n) ? "服务业" : /Manufacturing|ISM|PMI/i.test(n) ? "制造业" : null);
const pmiTag = (n: string) => `${/ISM/i.test(n) ? "ISM" : /Caixin|RatingDog/i.test(n) ? "财新" : /NBS|Official/i.test(n) ? "官方" : /Chicago/i.test(n) ? "芝加哥" : /S&P|HCOB|Jibun|Markit|Global/i.test(n) ? "标普全球" : ""}${/Flash|Prelim/i.test(n) ? "·初值" : ""}`;
export function MacroPMI({ onClose }: P) {
  const [tab, setTab] = useState("now");
  const cal = useCalHistory(130, 10);
  const pmis = cal.events.filter((e) => /PMI|ISM (Manufacturing|Non-Manufacturing|Services)/i.test(e.name) && !/Prices|Employment|New Orders|Inventories|Price/i.test(e.name));
  const series = useMemo(() => {
    const m = new Map<string, { key: string; region: string; kind: PmiKind; tag: string; items: EconEvent[] }>();
    for (const e of pmis) {
      const kind = pmiKind(e.name);
      if (!kind) continue;
      const tag = pmiTag(e.name);
      const key = `${e.region}|${kind}|${tag}`;
      const s = m.get(key) ?? { key, region: e.region, kind, tag, items: [] };
      s.items.push(e);
      m.set(key, s);
    }
    return [...m.values()];
  }, [pmis]);
  const latest = series.map((s) => {
    const rel = s.items.filter((e) => e.actual);
    const last = rel[rel.length - 1] ?? null;
    const up = s.items.find((e) => !e.actual && e.date >= dayStr(0)) ?? null;
    const a = numOf(last?.actual), p = numOf(last?.previous);
    return { s, last, up, a, p, chg: a != null && p != null ? a - p : null };
  }).filter((x) => x.last || x.up).sort((a, b) => a.s.region.localeCompare(b.s.region, "zh") || a.s.kind.localeCompare(b.s.kind, "zh"));
  const finals = latest.filter((x) => x.a != null && !x.s.tag.includes("初值"));
  const share = (k: PmiKind) => { const xs = finals.filter((x) => x.s.kind === k); return xs.length ? `${xs.filter((x) => x.a! >= 50).length}/${xs.length}` : "—"; };
  const avg = (k: PmiKind) => { const xs = finals.filter((x) => x.s.kind === k).map((x) => x.a!); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const improving = finals.filter((x) => (x.chg ?? 0) > 0).length;
  const [sel, setSel] = useState<string | null>(null);
  const cur = series.find((s) => s.key === sel) ?? series.find((s) => s.region === "美国" && s.kind === "制造业") ?? series[0];
  const hist = (cur?.items ?? []).filter((e) => e.actual);
  return (
    <PanelShell code="PMI" title="全球采购经理指数" onClose={onClose} tabs={[["now", "最新读数"], ["hist", "单项追踪"], ["mkt", "顺周期资产"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["制造业扩张经济体", share("制造业"), `均值 ${f2(avg("制造业"), 1)}`], ["服务业扩张经济体", share("服务业"), `均值 ${f2(avg("服务业"), 1)}`], ["综合扩张经济体", share("综合"), `均值 ${f2(avg("综合"), 1)}`], ["较前值改善", `${improving}/${finals.length}`, "近 130 天最新终值"]]} />
      {tab === "now" && <>
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>经济体</th><th className={THL}>口径</th><th className={TH}>公布日</th><th className={TH}>实际</th><th className={TH}>预期</th><th className={TH}>前值</th><th className={TH}>环比</th><th className={TH}>意外</th><th className={THL}>景气</th><th className={THL}>下次公布 / 预期</th></tr></thead>
          <tbody>{latest.map((x) => (
            <tr key={x.s.key} onClick={() => { setSel(x.s.key); setTab("hist"); }} className={`${ROW} cursor-pointer`}>
              <td className={`${TDL} text-slate-100`}>{x.s.region}</td>
              <td className={`${TDL} text-slate-300`}>{x.s.kind}{x.s.tag && <span className="ml-1 text-[9px] text-slate-500">{x.s.tag}</span>}</td>
              <td className={`${TD} text-[10px] text-slate-500`}>{x.last?.date.slice(5) ?? "—"}</td>
              <td className={`${TD} font-semibold`} style={{ background: heat(x.a != null ? x.a - 50 : null, 6), color: "#fff" }}>{x.last?.actual ?? "—"}</td>
              <td className={`${TD} text-slate-400`}>{x.last?.consensus ?? "—"}</td>
              <td className={`${TD} text-slate-500`}>{x.last?.previous ?? "—"}</td>
              <td className={TD} style={{ color: toneOf(x.chg) }}>{x.chg == null ? "—" : `${x.chg > 0 ? "+" : ""}${x.chg.toFixed(1)}`}</td>
              <td className={TD} style={{ color: toneOf(x.last?.surprise) }}>{x.last?.surprise == null ? "—" : `${x.last.surprise > 0 ? "+" : ""}${+x.last.surprise.toFixed(2)}`}</td>
              <td className={`${TDL} text-[10px]`} style={{ color: x.a == null ? "#64748b" : x.a >= 50 ? UP : DOWN }}>{x.a == null ? "—" : `${x.a >= 50 ? "扩张" : "收缩"}${x.chg == null ? "" : x.chg > 0 ? "·加快" : x.chg < 0 ? "·放缓" : ""}`}</td>
              <td className={`${TDL} text-[10px] text-slate-400`}>{x.up ? `${x.up.date.slice(5)} · ${x.up.consensus ?? "—"}` : "—"}</td>
            </tr>
          ))}{!latest.length && <tr><td colSpan={10}><Empty loading={cal.loading} text="近 130 天暂无采购经理指数发布" /></td></tr>}</tbody>
        </table>
        <Note>50 为荣枯线；初值单列且不计入扩散统计。点击行查看该口径的逐月追踪。</Note>
      </>}
      {tab === "hist" && <>
        <div className="flex flex-wrap gap-1 px-2 py-1">{series.map((s) => <button key={s.key} type="button" onClick={() => setSel(s.key)} className={`border px-1.5 text-[10px] ${cur?.key === s.key ? "border-cyan-500 text-cyan-100" : "border-[#1d3047] text-slate-400"}`}>{s.region}{s.kind}{s.tag ? `·${s.tag}` : ""}</button>)}</div>
        {cur && hist.length ? <>
          <SectionHead title={`${cur.region}${cur.kind} PMI${cur.tag ? `（${cur.tag}）` : ""}：实际 vs 预期`} />
          <Lines series={[{ name: "实际", color: "#fbbf24", values: hist.map((e) => numOf(e.actual)) }, { name: "预期", color: "#64748b", values: hist.map((e) => numOf(e.consensus)), dash: true }, { name: "荣枯线", color: "#334155", values: hist.map(() => 50), dash: true }]} xLabels={hist.map((e) => e.date.slice(5))} height={170} fmt={(v) => v.toFixed(1)} />
          <CalTable rows={[...cur.items].reverse()} showRegion={false} />
        </> : <Empty loading={cal.loading} />}
      </>}
      {tab === "mkt" && <>
        <SectionHead title="与制造业景气高度相关的实时资产" sub="铜、原油、澳元、工业与原材料板块、韩国与沪深股指" />
        <LiveBoard rows={[{ symbol: "HG", label: "铜", group: "商品" }, { symbol: "CL", label: "WTI 原油", group: "商品" }, { symbol: "AUDUSD", label: "澳元/美元", group: "汇率" }, { symbol: "XLI", label: "美国工业板块", group: "股票" }, { symbol: "XLB", label: "美国原材料板块", group: "股票" }, { symbol: "^KS11", label: "韩国综指", group: "股票" }, { symbol: "sh000300", label: "沪深 300", group: "股票" }] as BoardRow[]} />
      </>}
    </PanelShell>
  );
}

/* ================================================================== MIPR 美国政策利率与期限 */
type MMRow = { d: string; v: number; vol: number | null; p1: number | null; p99: number | null };
type MM = { series: Record<string, MMRow[]>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>; sofrStrip: Array<{ month: string; rate: number; chg: number | null; volume: number | null }> };
type Macro = { curve: Array<{ tenor: string; value: number }>; curveDate: string | null; curvePrev: Array<{ tenor: string; value: number }>; rates: Array<{ key: string; label: string; value: number | null; date: string | null; unit: string }> };
export function MacroMIPR({ onClose }: P) {
  const [tab, setTab] = useState("policy");
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 600_000);
  const macro = usePolled<Macro>("ucNews.macro", {}, 900_000);
  const fx = usePolled<{ policy: Array<{ bank: string; rate: number | null; date: string | null }> }>("ucHubs.fx", tab === "policy" ? {} : null, 1800_000);
  const hm = useHeat(tab === "policy");
  const t = useTicks(["^IRX", "^FVX", "^TNX", "^TYX", "ZT", "ZN"]);
  const s = mm.data?.series ?? {};
  const last = (k: string) => s[k]?.[s[k].length - 1] ?? null;
  const mid = mm.data?.target.from != null && mm.data?.target.to != null ? (mm.data.target.from + mm.data.target.to) / 2 : null;
  const sofr = last("SOFR"), effr = last("EFFR");
  const n = 130;
  const dates = (s.SOFR ?? []).slice(-n).map((r) => r.d);
  const at = (k: string) => { const mp = new Map((s[k] ?? []).map((r) => [r.d, r.v])); return dates.map((d) => mp.get(d) ?? null); };
  const cv = macro.data?.curve ?? [];
  const pv = macro.data?.curvePrev ?? [];
  const tv = (arr: Array<{ tenor: string; value: number }>, k: string) => arr.find((x) => x.tenor === k)?.value ?? null;
  const spread = (a: string, b: string, arr = cv) => { const x = tv(arr, a), y = tv(arr, b); return x != null && y != null ? Math.round((x - y) * 100) : null; };
  const cpi = macro.data?.rates.find((x) => x.key === "CPI")?.value ?? null;
  const y10 = yld(t["^TNX"]?.price) ?? tv(cv, "10Y");
  const path = mm.data?.path ?? [];
  const endYear = path.filter((p) => p.month.startsWith(String(new Date().getFullYear()))).slice(-1)[0];
  return (
    <PanelShell code="MIPR" title="美国政策利率与期限传导" onClose={onClose} tabs={[["policy", "政策与短端"], ["term", "期限与实际利率"], ["path", "会议隐含路径"]]} tab={tab} setTab={setTab} right={<span>曲线 {macro.data?.curveDate ?? "—"}</span>}>
      <Kpis items={[["联邦基金目标区间", mm.data?.target.from != null ? `${mm.data.target.from.toFixed(2)}–${mm.data.target.to?.toFixed(2)}%` : "—"], ["有效联邦基金利率", effr ? `${effr.v.toFixed(2)}%` : "—", effr?.d], ["担保隔夜融资利率", sofr ? `${sofr.v.toFixed(2)}%` : "—", sofr && effr ? `与有效利率差 ${Math.round((sofr.v - effr.v) * 100)}bp` : undefined], ["10 年期 − CPI 同比", y10 != null && cpi != null ? sgn(y10 - cpi, 2, "%") : "—", cpi != null ? `CPI ${cpi.toFixed(2)}%` : undefined]]} />
      {tab === "policy" && <>
        <SectionHead title="隔夜利率走廊（近半年，%）" sub="有效联邦基金 / 担保隔夜融资 / 三方回购" />
        {dates.length ? <Lines series={[{ name: "有效联邦基金", color: "#fbbf24", values: at("EFFR") }, { name: "担保隔夜融资", color: "#38bdf8", values: at("SOFR") }, { name: "三方回购", color: "#a78bfa", values: at("TGCR") }, ...(mm.data?.target.to != null ? [{ name: "区间上限", color: "#475569", values: dates.map(() => mm.data!.target.to), dash: true }, { name: "区间下限", color: "#475569", values: dates.map(() => mm.data!.target.from), dash: true }] : [])]} xLabels={dates.map((d) => d.slice(5))} height={190} fmt={(v) => v.toFixed(2)} /> : <Empty loading={mm.loading} />}
        <SectionHead title="主要央行政策利率" />
        <table className="w-full text-[11px]"><tbody>
          {(fx.data?.policy ?? []).map((p) => <tr key={p.bank} className={ROW}><td className={`${TDL} text-slate-100`}>{p.bank}</td><td className={`${TD} text-white`}>{f2(p.rate, 2, "%")}</td><td className={`${TD} text-[10px] text-slate-500`}>{p.date ?? "—"}</td></tr>)}
          {(hm.data?.data ?? []).filter((r) => r.rate != null && r.code !== "US").sort((a, b) => b.rate! - a.rate!).map((r) => <tr key={r.code} className={ROW}><td className={`${TDL} text-slate-300`}>{zhOf(r.code)}</td><td className={`${TD} text-slate-200`}>{f2(r.rate, 2, "%")}</td><td className={`${TD} text-[10px] text-slate-500`}>{r.inflation != null ? `实际 ${sgn(r.rate! - r.inflation, 2, "")}` : ""}</td></tr>)}
        </tbody></table>
      </>}
      {tab === "term" && <>
        <SectionHead title="国债收益率曲线：最新 vs 约一个月前（%）" />
        {cv.length ? <Lines series={[{ name: "最新", color: "#fbbf24", values: cv.map((p) => p.value) }, { name: "约一月前", color: "#64748b", values: cv.map((p) => tv(pv, p.tenor)), dash: true }]} xLabels={cv.map((p) => p.tenor)} height={180} fmt={(v) => v.toFixed(2)} /> : <Empty loading={macro.loading} />}
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className={THL}>期限利差</th><th className={TH}>最新 bp</th><th className={TH}>约一月前 bp</th><th className={TH}>变化</th><th className={THL}>形态</th></tr></thead>
          <tbody>{([["3M", "10Y", "3 月 − 10 年（衰退信号）"], ["2Y", "10Y", "2 年 − 10 年"], ["5Y", "30Y", "5 年 − 30 年"], ["1M", "2Y", "1 月 − 2 年（政策预期）"]] as Array<[string, string, string]>).map(([a, b, l]) => {
            const now = spread(b, a), before = spread(b, a, pv);
            return <tr key={l} className={ROW}><td className={`${TDL} text-slate-200`}>{l}</td><td className={`${TD} text-white`}>{now ?? "—"}</td><td className={`${TD} text-slate-400`}>{before ?? "—"}</td><td className={TD} style={{ color: toneOf(now != null && before != null ? now - before : null) }}>{now != null && before != null ? `${now - before > 0 ? "+" : ""}${now - before}` : "—"}</td><td className={`${TDL} text-[10px] text-slate-400`}>{now == null ? "—" : now < 0 ? "倒挂" : now < 30 ? "平坦" : "正常向上"}{now != null && before != null ? (now > before ? " · 陡峭化" : now < before ? " · 平坦化" : "") : ""}</td></tr>;
          })}</tbody>
        </table>
        <SectionHead title="实时收益率与国债期货" />
        <table className="w-full text-[11px]"><tbody>{([["^IRX", "13 周"], ["^FVX", "5 年"], ["^TNX", "10 年"], ["^TYX", "30 年"]] as Array<[string, string]>).map(([k, l]) => <tr key={k} className={ROW}><td className={`${TDL} text-slate-200`}>{l}</td><td className={`${TD} text-white`}>{f2(yld(t[k]?.price), 3, "%")}</td><td className={TD} style={{ color: toneOf(t[k]?.change) }}>{t[k]?.change != null ? `${t[k]!.change! > 0 ? "+" : ""}${(Math.abs(t[k]!.price) > 20 ? t[k]!.change! * 10 : t[k]!.change! * 100).toFixed(1)}bp` : "—"}</td><td className={`${TD} text-[10px] text-slate-500`}>实际收益率 {cpi != null && yld(t[k]?.price) != null ? sgn(yld(t[k]?.price)! - cpi, 2, "%") : "—"}</td></tr>)}
          {([["ZT", "2 年期国债期货"], ["ZN", "10 年期国债期货"]] as Array<[string, string]>).map(([k, l]) => <tr key={k} className={ROW}><td className={`${TDL} text-slate-200`}>{l}</td><td className={`${TD} text-white`}>{fmtPrice(t[k]?.price)}</td><td className={TD} style={{ color: toneOf(t[k]?.changePct) }}>{fmtPct(t[k]?.changePct)}</td><td /></tr>)}
        </tbody></table>
        <Note>实际收益率 = 名义收益率 − 最新 CPI 同比（事后口径）。</Note>
      </>}
      {tab === "path" && <>
        <Kpis items={[["当前区间中值", mid != null ? `${mid.toFixed(3)}%` : "—"], ["年底隐含利率", endYear ? `${endYear.rate.toFixed(3)}%` : "—", endYear?.month], ["年底隐含降息次数", endYear?.cuts != null ? `${endYear.cuts.toFixed(2)} 次` : "—", "每次 25bp"], ["最远月隐含", path.length ? `${path[path.length - 1].rate.toFixed(3)}%` : "—", path[path.length - 1]?.month]]} />
        {path.length ? <>
          <Lines series={[{ name: "联邦基金期货隐含 %", color: "#38bdf8", values: path.map((p) => p.rate) }, ...(mid != null ? [{ name: "当前中值", color: "#64748b", values: path.map(() => mid), dash: true }] : [])]} xLabels={path.map((p) => p.month)} height={170} fmt={(v) => v.toFixed(2)} />
          <Bars data={path.map((p) => ({ k: p.month.slice(2), v: -(p.cuts ?? 0) }))} fmt={(v) => `${v.toFixed(2)} 次`} height={110} />
          <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>合约月</th><th className={TH}>隐含利率</th><th className={TH}>今日变动 bp</th><th className={TH}>相对当前 累计降息次数</th></tr></thead>
            <tbody>{path.map((p) => <tr key={p.month} className={ROW}><td className={`${TDL} font-mono text-slate-200`}>{p.month}</td><td className={`${TD} text-white`}>{p.rate.toFixed(3)}%</td><td className={TD} style={{ color: toneOf(p.chg) }}>{p.chg != null ? (p.chg * 100).toFixed(1) : "—"}</td><td className={`${TD} text-cyan-200`}>{f2(p.cuts, 2)}</td></tr>)}</tbody></table>
        </> : <Empty loading={mm.loading} text="利率期货暂无报价" />}
        <Note>隐含利率 = 100 − 联邦基金期货价格；累计降息次数 = （当前区间中值 − 隐含利率）÷ 0.25。</Note>
      </>}
    </PanelShell>
  );
}
