/**
 * 信用 / CDS / 主权 组（一）：CDX 信用指数代理、全球信用风险脉冲、发行人信用分析、增信与担保机构、杠杆贷款与私募信贷、信用衍生分层定价。
 * 全部基于实时行情、真实日线、官方利率曲线、资金市场利率与监管文书；CDS 报价无公开来源，涉及 CDS 的部分一律为
 * “以实时美债曲线贴现 + 用户输入利差”的估值工具，不展示任何编造报价。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks, UP, DOWN } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, useHub, type BoardRow } from "@/uc/hubs/kit";
import { align, annVol, corr, f2, heat, ncdf, npdf, rets, sgn, std, useCloses, type Pack } from "@/uc/hubs/calc";
import { DocList, Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose?: () => void };

/* ================================================================== 公用 */
export type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }>; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
export const useCurves = () => usePolled<Curves>("ucHubs.curves", {}, 1800_000);
export type MM = { series: Record<string, Array<{ d: string; v: number; vol: number | null; p1: number | null; p99: number | null }>>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>; sofrStrip: Array<{ month: string; rate: number; chg: number | null; volume: number | null }> };
export const useMoneyMarket = () => usePolled<MM>("ucHubs.moneyMarket", {}, 900_000);
export type Filing = { id: string; company: string; ticker: string | null; form: string; date: string; items: string[]; url: string };
export const useFilings = (q: string, forms: string[], days: number) => usePolled<{ total: number; rows: Filing[] }>("ucHubs.edgar", q ? { q, forms, days } : null, 1800_000);
export type Bal = { symbol: string; asOf: string | null; assets: number | null; liabilities: number | null; debt: number | null; equity: number | null; cash: number | null; marketCap: number | null; preferred: number | null; interest: number | null; ebit: number | null };
export const useBalance = (symbols: string[]) => usePolled<Bal[]>("ucHubs.balance", symbols.length ? { symbols } : null, 6 * 3600_000);

const TENOR_Y: Record<string, number> = { "1M": 1 / 12, "6W": 1.5 / 12, "2M": 2 / 12, "3M": 0.25, "4M": 4 / 12, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3, "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30 };
export type Disc = { date: string; par: (t: number) => number; zc: (t: number) => number; df: (t: number) => number };
/** 最新美债收益率曲线 → 贴现函数（平价收益率线性插值，按半年复利近似换算为连续复利零息利率） */
export function discounter(c: Curves | null | undefined, shiftBp = 0): Disc | null {
  const row = c?.us?.[0];
  if (!row) return null;
  const pts = row.points.filter((p) => TENOR_Y[p.tenor] != null).map((p) => [TENOR_Y[p.tenor], p.value] as [number, number]).sort((a, b) => a[0] - b[0]);
  if (!pts.length) return null;
  const par = (t: number) => {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [t0, r0] = pts[i - 1];
        const [t1, r1] = pts[i];
        return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
      }
    }
    return pts[pts.length - 1][1];
  };
  const zc = (t: number) => 2 * Math.log(1 + (par(t) + shiftBp / 100) / 200);
  return { date: row.date, par: (t) => par(t) + shiftBp / 100, zc, df: (t: number) => Math.exp(-zc(t) * t) };
}

/** 标准正态分布逆函数（Acklam 有理逼近） */
export function ninv(p: number) {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const lastOf = <T,>(a: T[]): T | undefined => a[a.length - 1];
export const retN = (c: number[], n: number) => (c.length > n ? (c[c.length - 1] / c[c.length - 1 - n] - 1) * 100 : null);
export const ddFromHigh = (c: number[], n = 252) => { const s = c.slice(-n); return s.length ? (s[s.length - 1] / Math.max(...s) - 1) * 100 : null; };
export function ddSeries(c: number[]) { let hi = -Infinity; return c.map((v) => { hi = Math.max(hi, v); return (v / hi - 1) * 100; }); }
export function volSeries(c: number[], win: number) { const r = rets(c); return c.map((_, i) => (i < win ? null : std(r.slice(i - win, i)) * Math.sqrt(252) * 100)); }
export const pctRank = (arr: number[], v: number) => (arr.length ? (arr.filter((x) => x <= v).length / arr.length) * 100 : null);
export const closesOf = (pack: Pack | null | undefined, s: string) => (pack?.[s] ?? []).map((x) => x[1]);

export function NumIn({ label, value, onChange, step = 1, w = "w-16", suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; w?: string; suffix?: string }) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-slate-400">
      {label}
      <input type="number" step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} className={`${w} border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white`} />
      {suffix && <span className="text-slate-500">{suffix}</span>}
    </label>
  );
}
export const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
export const THEAD = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";
export const TR = "border-t border-[#0f1b29] hover:bg-[#0a1726]";
export const bp = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}bp`);

const CREDIT_RE = /违约|展期|债务重组|破产|评级|下调|降级|信用利差|高收益|垃圾债|城投|default|downgrade|bankrupt|chapter 11|restructur|credit spread|high[- ]yield|junk bond|distress|leveraged loan|private credit/i;
export function useCreditNews(re: RegExp = CREDIT_RE, hours = 168) {
  const f = useFeed({ cats: ["债券", "金融", "公司", "宏观"], limit: 400, hours }, 120_000);
  return { items: f.items.filter((n) => re.test(`${n.title} ${n.summary ?? ""}`)), loading: f.loading };
}
const rows = (list: Array<[string, string]>, group: string): BoardRow[] => list.map(([symbol, label]) => ({ symbol, label, group }));

/* ================================================================== CDX 信用指数代理 */
const CDX_BOARD: BoardRow[] = [
  ...rows([["LQD", "投资级公司债"], ["VCIT", "中期投资级"], ["IGSB", "短期投资级"], ["VCLT", "长期投资级"]], "投资级（IG）"),
  ...rows([["HYG", "高收益公司债"], ["JNK", "高收益（二）"], ["USHY", "高收益宽基"], ["SJNK", "短久期高收益"], ["ANGL", "堕落天使"]], "高收益（HY）"),
  ...rows([["EMB", "新兴市场美元主权"], ["EMHY", "新兴市场高收益"], ["VWOB", "新兴市场政府债"]], "新兴市场（EM）"),
  ...rows([["SHY", "1-3 年美债"], ["IEI", "3-7 年美债"], ["IEF", "7-10 年美债"], ["TLT", "20 年以上美债"]], "国债对冲腿"),
];
const CDX_HEDGE: Record<string, string> = { LQD: "IEF", VCIT: "IEI", IGSB: "SHY", VCLT: "TLT", HYG: "IEI", JNK: "IEI", USHY: "IEI", SJNK: "SHY", ANGL: "IEF", EMB: "IEF", EMHY: "IEI", VWOB: "IEF" };
const SLEEVES = [
  { k: "IG", name: "投资级", sym: "LQD", hedge: "IEF", color: "#38bdf8" },
  { k: "HY", name: "高收益", sym: "HYG", hedge: "IEI", color: "#f59e0b" },
  { k: "EM", name: "新兴市场", sym: "EMB", hedge: "IEF", color: "#a78bfa" },
];

export function CDXLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const [win, setWin] = useState("260");
  const [dur, setDur] = useState<Record<string, number>>({ LQD: 8.3, HYG: 3.2, EMB: 7.0, IEF: 7.4, IEI: 4.3 });
  const t = useTicks([...CDX_BOARD.map((r) => r.symbol), "^VIX"]);
  const cl = useCloses(["LQD", "HYG", "EMB", "IEF", "IEI", "SPY"], 600);
  const n = Number(win);
  const sl = useMemo(() => SLEEVES.map((s) => {
    const al = align(cl.data, [s.sym, s.hedge, "SPY"]);
    const c = al.m[s.sym] ?? [];
    const h = al.m[s.hedge] ?? [];
    const rc = rets(c);
    const rh = rets(h);
    const ratio = (dur[s.sym] || 1) / (dur[s.hedge] || 1);
    const ex = rc.map((r, i) => r - ratio * rh[i]);
    const exW = ex.slice(-n);
    let acc = 0;
    const cum = [0, ...exW.map((x) => (acc += x) * 100)];
    const dS = cum.map((v) => (-v / 100 / (dur[s.sym] || 1)) * 1e4);
    const sum = (k: number) => (ex.length >= k ? ex.slice(-k).reduce((a, b) => a + b, 0) * 100 : null);
    const raw = (k: number) => retN(c, k);
    const tsy = (k: number) => retN(h, k);
    const spy = rets(al.m.SPY ?? []);
    const cr = (k: number) => (ex.length >= k && spy.length >= k ? corr(ex.slice(-k), spy.slice(-k)) : null);
    return { ...s, dates: al.dates.slice(-(n + 1)), cum, dS, sum, raw, tsy, cr, ok: c.length > 30 };
  }), [cl.data, n, dur]);
  const ig = sl[0];
  const hy = sl[1];
  const durBar = (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1">
      <span className="text-[10px] text-slate-500">久期参数（年，可调）</span>
      {Object.keys(dur).map((k) => <NumIn key={k} label={k} value={dur[k]} step={0.1} w="w-12" onChange={(v) => setDur((d) => ({ ...d, [k]: v > 0 ? v : d[k] }))} />)}
      <span className="ml-auto"><Seg value={win} onChange={setWin} options={[["65", "3月"], ["130", "6月"], ["260", "1年"], ["520", "2年"]]} /></span>
    </div>
  );
  const kpis = (
    <Kpis items={sl.map((s) => [`${s.name} 隐含利差变动`, <span key={s.k} style={{ color: toneOf(lastOf(s.dS)) }}>{bp(lastOf(s.dS))}</span>, `窗口累计超额 ${sgn(lastOf(s.cum))}`] as [string, React.ReactNode, string]).concat([["高收益 − 投资级", bp(hy.ok && ig.ok ? (lastOf(hy.dS) ?? 0) - (lastOf(ig.dS) ?? 0) : null), "正值 = 高收益相对走阔"]])} />
  );
  return (
    <PanelShell code="CDX" title="CDX 信用指数" onClose={onClose} tabs={[["board", "指数行情"], ["excess", "超额表现"], ["spread", "隐含利差"]]} tab={tab} setTab={setTab} right={<span>VIX {fmtPrice(t["^VIX"]?.price)}</span>}>
      {tab === "board" && (
        <>
          <Kpis items={[["投资级（LQD）", fmtPrice(t.LQD?.price), fmtPct(t.LQD?.changePct)], ["高收益（HYG）", fmtPrice(t.HYG?.price), fmtPct(t.HYG?.changePct)], ["新兴市场（EMB）", fmtPrice(t.EMB?.price), fmtPct(t.EMB?.changePct)], ["高收益日超额", sgn(t.HYG?.changePct != null && t.IEI?.changePct != null ? t.HYG.changePct - t.IEI.changePct : null), "HYG − IEI，未做久期调整"]]} />
          <LiveBoard rows={CDX_BOARD} extra={[{ head: "相对国债", cell: (s) => { const h = CDX_HEDGE[s]; const v = h && t[s]?.changePct != null && t[h]?.changePct != null ? t[s]!.changePct! - t[h]!.changePct! : null; return <span style={{ color: toneOf(v) }}>{h ? sgn(v) : ""}</span>; } }]} />
          <Note>口径：信用 ETF 作为 CDX 投资级 / 高收益 / 新兴市场指数的现券代理；“相对国债”为当日涨跌幅减去期限相近的国债 ETF 涨跌幅，正值表示信用跑赢、利差收窄。</Note>
        </>
      )}
      {tab === "excess" && (
        <>
          {durBar}
          {kpis}
          <SectionHead title="久期对冲后的累计超额收益（%）" />
          <Lines series={sl.map((s) => ({ name: s.name, color: s.color, values: s.cum }))} xLabels={ig.dates.map((d) => d.slice(2))} height={200} zero fmt={(v) => v.toFixed(2)} />
          <SectionHead title="分窗口统计" />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">板块</th><th className="text-left">窗口</th><th className="text-right">信用总收益</th><th className="text-right">国债收益</th><th className="text-right">久期对冲超额</th><th className="px-2 text-right">隐含利差变动</th></tr></thead>
            <tbody>{sl.flatMap((s) => [5, 20, 60, 120, 250].map((k) => { const ex = s.sum(k); return <tr key={`${s.k}${k}`} className={TR}><td className="px-2 py-0.5" style={{ color: s.color }}>{k === 5 ? `${s.name}（${s.sym}/${s.hedge}）` : ""}</td><td className="text-slate-400">{k} 日</td><td className="text-right font-mono" style={{ color: toneOf(s.raw(k)) }}>{sgn(s.raw(k))}</td><td className="text-right font-mono" style={{ color: toneOf(s.tsy(k)) }}>{sgn(s.tsy(k))}</td><td className="text-right font-mono" style={{ color: toneOf(ex) }}>{sgn(ex)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(ex == null ? null : -ex) }}>{bp(ex == null ? null : (-ex / 100 / (dur[s.sym] || 1)) * 1e4)}</td></tr>; }))}</tbody>
          </table>
          {cl.loading && !cl.data && <Empty loading />}
          <Note>口径：超额收益 = 信用 ETF 日对数收益 − (信用久期 / 国债久期) × 国债 ETF 日对数收益，按日累加；久期为可调参数（默认取各基金近似有效久期）。</Note>
        </>
      )}
      {tab === "spread" && (
        <>
          {durBar}
          {kpis}
          <SectionHead title="隐含利差变动（bp，窗口起点为 0）" />
          <Lines series={[...sl.map((s) => ({ name: s.name, color: s.color, values: s.dS })), { name: "高收益 − 投资级", color: "#94a3b8", values: hy.dS.map((v, i) => (ig.dS[i] != null ? v - ig.dS[i] : null)), dash: true }]} xLabels={ig.dates.map((d) => d.slice(2))} height={210} zero fmt={(v) => v.toFixed(0)} />
          <SectionHead title="信用超额收益与美股的相关性" sub="相关性升高通常出现在风险事件期，信用与股票同涨同跌" />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">板块</th><th className="text-right">20 日</th><th className="text-right">60 日</th><th className="text-right">120 日</th><th className="px-2 text-right">250 日</th></tr></thead>
            <tbody>{sl.map((s) => <tr key={s.k} className={TR}><td className="px-2 py-0.5" style={{ color: s.color }}>{s.name}超额 vs 标普 500</td>{[20, 60, 120, 250].map((k) => <td key={k} className="text-right font-mono last:px-2" style={{ background: heat(s.cr(k), 1) }}>{f2(s.cr(k))}</td>)}</tr>)}</tbody>
          </table>
          <Note>隐含利差变动为现券 ETF 推算的利差代理，不是指数报价；高收益板块含违约与票息结转影响，长窗口下会系统性偏离真实利差。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== GCDS 全球信用风险脉冲 */
const PULSE: Array<[string, string, string | null, string]> = [
  ["LQD", "美国投资级", "IEF", "公司债"], ["VCIT", "中期投资级", "IEI", "公司债"], ["HYG", "美国高收益", "IEI", "公司债"], ["JNK", "高收益（二）", "IEI", "公司债"], ["ANGL", "堕落天使", "IEF", "公司债"], ["SJNK", "短久期高收益", "SHY", "公司债"],
  ["BKLN", "杠杆贷款", null, "贷款与结构化"], ["SRLN", "优先级贷款", null, "贷款与结构化"], ["JBBB", "BBB 级 CLO", null, "贷款与结构化"],
  ["EMB", "新兴市场美元主权", "IEF", "新兴市场与国际"], ["EMHY", "新兴市场高收益", "IEI", "新兴市场与国际"], ["HYXU", "国际高收益", "IEI", "新兴市场与国际"],
  ["CWB", "可转债", null, "混合与权益信用"], ["PFF", "优先股", null, "混合与权益信用"], ["BIZD", "商业发展公司", null, "混合与权益信用"],
  ["KRE", "区域银行", null, "银行与金融"], ["KBE", "银行股", null, "银行与金融"], ["XLF", "金融板块", null, "银行与金融"],
];
type CB = { code: string; name: string; stock: string; stockName: string; rating: string | null; price: number | null; changePct: number | null; premium: number | null; years: number; scale: number | null; amount: number | null; nearResale: boolean };

export function GCDSLive({ onClose }: P) {
  const [tab, setTab] = useState("pulse");
  const { pick } = useHub();
  const syms = useMemo(() => [...new Set([...PULSE.map((p) => p[0]), "IEF", "IEI", "SHY"])], []);
  const cl = useCloses(syms, 300);
  const t = useTicks([...PULSE.map((p) => p[0]), "^VIX", "^MOVE"]);
  const cb = usePolled<{ at: number; rows: CB[] }>("ucHubs.convertibles", tab === "cb" ? {} : null, 30_000);
  const table = useMemo(() => {
    const out = PULSE.map(([s, label, h, group]) => {
      const c = closesOf(cl.data, s);
      if (c.length < 60) return { s, label, group, h, ok: false as const };
      const vs = volSeries(c, 20).filter((v): v is number => v != null);
      const v20 = lastOf(vs) ?? null;
      let ex1m: number | null = null;
      let ex3m: number | null = null;
      if (h) {
        const al = align(cl.data, [s, h]);
        const a = al.m[s];
        const b = al.m[h];
        const d1 = retN(a, 21), d2 = retN(b, 21), d3 = retN(a, 63), d4 = retN(b, 63);
        ex1m = d1 != null && d2 != null ? d1 - d2 : null;
        ex3m = d3 != null && d4 != null ? d3 - d4 : null;
      }
      return { s, label, group, h, ok: true as const, r1m: retN(c, 21), r3m: retN(c, 63), ex1m, ex3m, dd: ddFromHigh(c, 252), v20, vPct: v20 != null ? pctRank(vs, v20) : null };
    });
    const good = out.filter((x) => x.ok) as Array<Extract<(typeof out)[number], { ok: true }>>;
    const rk = (vals: Array<number | null>) => { const arr = vals.filter((v): v is number => v != null); return (v: number | null) => (v == null || !arr.length ? null : (arr.filter((x) => x <= v).length / arr.length) * 100); };
    const rDD = rk(good.map((g) => (g.dd == null ? null : -g.dd)));
    const rV = rk(good.map((g) => g.vPct));
    const rR = rk(good.map((g) => { const m = g.ex1m ?? g.r1m; return m == null ? null : -m; }));
    return good.map((g) => {
      const parts = [rDD(g.dd == null ? null : -g.dd), rV(g.vPct), rR((g.ex1m ?? g.r1m) == null ? null : -(g.ex1m ?? g.r1m)!)].filter((v): v is number => v != null);
      return { ...g, score: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [cl.data]);
  const avgScore = table.length ? table.reduce((a, b) => a + (b.score ?? 0), 0) / table.length : null;
  const trend = useMemo(() => {
    const ss = ["HYG", "EMB", "BKLN", "KRE", "CWB"];
    const al = align(cl.data, ss);
    return { dates: al.dates, ser: ss.map((s, i) => ({ name: PULSE.find((p) => p[0] === s)?.[1] ?? s, color: ["#f59e0b", "#a78bfa", "#38bdf8", "#f472b6", "#34d399"][i], values: ddSeries(al.m[s] ?? []) })), vol: ss.map((s) => volSeries(al.m[s] ?? [], 20)) };
  }, [cl.data]);
  const cbStats = useMemo(() => {
    const list = (cb.data?.rows ?? []).filter((r) => r.price != null);
    const by: Record<string, CB[]> = {};
    for (const r of list) (by[r.rating || "无评级"] ??= []).push(r);
    const ORDER = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-", "BB+", "BB", "BB-", "B+", "B", "B-", "CCC", "CC", "C", "无评级"];
    const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const groups = Object.entries(by).map(([k, a]) => ({ k, n: a.length, med: med(a.map((x) => x.price!)), below100: (a.filter((x) => x.price! < 100).length / a.length) * 100, below90: (a.filter((x) => x.price! < 90).length / a.length) * 100, prem: med(a.filter((x) => x.premium != null).map((x) => x.premium!)), chg: a.reduce((s, x) => s + (x.changePct ?? 0), 0) / a.length })).sort((a, b) => (ORDER.indexOf(a.k) + 100 * +(ORDER.indexOf(a.k) < 0)) - (ORDER.indexOf(b.k) + 100 * +(ORDER.indexOf(b.k) < 0)));
    const low = [...list].sort((a, b) => a.price! - b.price!).slice(0, 30);
    return { n: list.length, below100: list.length ? (list.filter((x) => x.price! < 100).length / list.length) * 100 : null, groups, low };
  }, [cb.data]);
  return (
    <PanelShell code="GCDS" title="全球信用风险脉冲" onClose={onClose} tabs={[["pulse", "压力横截面"], ["trend", "回撤与波动"], ["cb", "转债信用分层"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["综合压力均值", avgScore != null ? avgScore.toFixed(0) : "—", "0~100，越高压力越大"], ["最受压板块", table[0]?.label ?? "—", table[0]?.score != null ? `压力 ${table[0].score.toFixed(0)}` : undefined], ["股票波动率指数", fmtPrice(t["^VIX"]?.price), fmtPct(t["^VIX"]?.changePct)], ["美债波动率指数", fmtPrice(t["^MOVE"]?.price), fmtPct(t["^MOVE"]?.changePct)]]} />
      {tab === "pulse" && (
        <>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">板块</th><th className="text-left">分组</th><th className="text-right">今日</th><th className="text-right">1 月</th><th className="text-right">3 月</th><th className="text-right">1 月超额</th><th className="text-right">距 52 周高</th><th className="text-right">20 日波动</th><th className="text-right">波动分位</th><th className="px-2 text-right">压力分</th></tr></thead>
            <tbody>
              {table.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className={`cursor-pointer ${TR}`}>
                <td className="px-2 py-0.5 text-slate-100">{r.label}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td>
                <td className="text-[10px] text-slate-500">{r.group}</td>
                <td className="text-right font-mono" style={{ color: toneOf(t[r.s]?.changePct) }}>{fmtPct(t[r.s]?.changePct)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.r1m) }}>{sgn(r.r1m)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.r3m) }}>{sgn(r.r3m)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.ex1m) }}>{r.h ? sgn(r.ex1m) : "—"}</td>
                <td className="text-right font-mono" style={{ background: heat(r.dd == null ? null : r.dd, 10) }}>{sgn(r.dd)}</td>
                <td className="text-right font-mono text-slate-300">{f2(r.v20, 1, "%")}</td>
                <td className="text-right font-mono" style={{ background: heat(r.vPct == null ? null : (r.vPct - 50) * 2, 100) }}>{f2(r.vPct, 0)}</td>
                <td className="px-2 text-right font-mono font-semibold" style={{ background: heat(r.score == null ? null : r.score - 50, 50) }}>{f2(r.score, 0)}</td>
              </tr>)}
              {!table.length && <tr><td colSpan={10}><Empty loading={cl.loading} /></td></tr>}
            </tbody>
          </table>
          <Note>压力分 = 三项横截面百分位的均值：距 52 周高点回撤深度、20 日波动率在自身一年历史中的分位、近 1 月久期对冲超额收益（无对冲腿的板块用原始收益）的负值。点击行查看 K 线。</Note>
        </>
      )}
      {tab === "trend" && (
        <>
          <SectionHead title="代表性信用板块：距历史高点回撤（%）" sub="近 300 个交易日" />
          <Lines series={trend.ser} xLabels={trend.dates.map((d) => d.slice(2))} height={190} fmt={(v) => v.toFixed(1)} />
          <SectionHead title="20 日年化波动率（%）" />
          <Lines series={trend.ser.map((s, i) => ({ ...s, values: trend.vol[i] }))} xLabels={trend.dates.map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(1)} />
        </>
      )}
      {tab === "cb" && (
        <>
          <Kpis items={[["在交易转债", String(cbStats.n || "—")], ["跌破面值占比", f2(cbStats.below100, 1, "%"), "价格 < 100 元"], ["最低价", cbStats.low[0] ? `${fmtPrice(cbStats.low[0].price)}` : "—", cbStats.low[0]?.name], ["更新", cb.data ? new Date(cb.data.at).toLocaleTimeString("zh-CN", { hour12: false }) : "—"]]} />
          <SectionHead title="按债项评级分层" />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">评级</th><th className="text-right">只数</th><th className="text-right">价格中位数</th><th className="text-right">跌破 100</th><th className="text-right">跌破 90</th><th className="text-right">溢价率中位</th><th className="px-2 text-right">今日平均涨跌</th></tr></thead>
            <tbody>{cbStats.groups.map((g) => <tr key={g.k} className={TR}><td className="px-2 py-0.5 text-slate-100">{g.k}</td><td className="text-right font-mono">{g.n}</td><td className="text-right font-mono">{f2(g.med)}</td><td className="text-right font-mono" style={{ background: heat(g.below100, 60) }}>{f2(g.below100, 1, "%")}</td><td className="text-right font-mono" style={{ background: heat(g.below90, 30) }}>{f2(g.below90, 1, "%")}</td><td className="text-right font-mono">{f2(g.prem, 1, "%")}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(g.chg) }}>{sgn(g.chg)}</td></tr>)}</tbody>
          </table>
          <SectionHead title="价格最低的 30 只转债（信用风险前沿）" />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">转债</th><th className="text-left">正股</th><th className="text-left">评级</th><th className="text-right">价格</th><th className="text-right">涨跌</th><th className="text-right">溢价率</th><th className="text-right">剩余年限</th><th className="px-2 text-right">规模</th></tr></thead>
            <tbody>{cbStats.low.map((r) => <tr key={r.code} onClick={() => pick(r.code)} className={`cursor-pointer ${TR}`}><td className="px-2 py-0.5 text-slate-100">{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.code}</span></td><td className="text-slate-400">{r.stockName}</td><td className="text-slate-300">{r.rating ?? "—"}</td><td className="text-right font-mono text-white">{fmtPrice(r.price)}</td><td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className="text-right font-mono">{f2(r.premium, 1, "%")}</td><td className="text-right font-mono">{f2(r.years, 2)}</td><td className="px-2 text-right font-mono text-slate-400">{r.scale != null ? `${f2(r.scale, 2)}亿` : "—"}</td></tr>)}</tbody>
          </table>
          {!cbStats.n && <Empty loading={cb.loading} />}
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== CREDANAL 发行人信用分析 */
const DEFAULT_PEERS = "F GM BA T VZ CCL OXY DAL INTC CHTR WBD AAL";
export function CREDANALLive({ onClose }: P) {
  const [tab, setTab] = useState("peer");
  const [input, setInput] = useState(DEFAULT_PEERS);
  const [list, setList] = useState(DEFAULT_PEERS);
  const [evt, setEvt] = useState("ch11");
  const { pick } = useHub();
  const syms = useMemo(() => [...new Set(list.toUpperCase().split(/[\s,，]+/).filter(Boolean))].slice(0, 20), [list]);
  const bal = useBalance(syms);
  const cl = useCloses(syms, 260);
  const cv = useCurves();
  const t = useTicks(syms);
  const rf = discounter(cv.data)?.zc(1) ?? null;
  const data = useMemo(() => syms.map((s) => {
    const b = bal.data?.find((x) => x.symbol === s);
    const c = closesOf(cl.data, s);
    const sE = annVol(c);
    const E = b?.marketCap ?? null;
    const D = b?.debt ?? null;
    let dd: number | null = null;
    let pd: number | null = null;
    if (E && D && D > 0 && sE != null && rf != null) {
      const se = sE / 100;
      const sD = 0.05 + 0.25 * se;
      const V = E + D;
      const sV = (E / V) * se + (D / V) * sD;
      dd = (Math.log(V / D) + (rf - 0.5 * sV * sV)) / sV;
      pd = ncdf(-dd) * 100;
    }
    return { s, b, sE, dd, pd, lev: E && D != null ? (D / E) * 100 : null, bookDE: b?.equity && b.debt != null ? b.debt / b.equity : null, cov: b?.ebit != null && b.interest ? b.ebit / Math.abs(b.interest) : null, cashDebt: b?.cash != null && b.debt ? (b.cash / b.debt) * 100 : null, liabA: b?.liabilities != null && b.assets ? (b.liabilities / b.assets) * 100 : null, net: b?.debt != null && b.cash != null ? b.debt - b.cash : null, r1y: retN(c, Math.min(250, c.length - 1)), dd1y: ddFromHigh(c) };
  }), [syms, bal.data, cl.data, rf]);
  const ranked = [...data].sort((a, b) => (b.pd ?? -1) - (a.pd ?? -1));
  const EVT: Record<string, [string, string[]]> = { ch11: ['"Chapter 11"', ["8-K"]], eod: ['"event of default"', ["8-K"]], forb: ['"forbearance agreement"', ["8-K"]], dist: ['"exchange offer" "senior notes"', ["8-K", "SC TO-I"]] };
  const f = useFilings(EVT[evt][0], EVT[evt][1], 60);
  const news = useCreditNews();
  return (
    <PanelShell code="CRDA" title="发行人信用分析" onClose={onClose} tabs={[["peer", "同业对比"], ["dd", "违约距离"], ["events", "违约事件文书"], ["news", "信用新闻"]]} tab={tab} setTab={setTab} right={rf != null ? <span>无风险利率（1 年）{(rf * 100).toFixed(2)}%</span> : null}>
      {(tab === "peer" || tab === "dd") && (
        <form onSubmit={(e) => { e.preventDefault(); setList(input); }} className="flex flex-wrap items-center gap-2 px-2 py-1">
          <span className="text-[10px] text-slate-500">发行人（美股代码，最多 20 个）</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} className="min-w-[260px] flex-1 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 font-mono text-[11px] text-white" />
          <button type="submit" className="border border-cyan-700 px-2 text-[11px] text-cyan-200">应用</button>
        </form>
      )}
      {tab === "peer" && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-[11px]">
              <thead className={THEAD}><tr><th className="px-2 py-1 text-left">发行人</th><th className="text-right">股价</th><th className="text-right">市值</th><th className="text-right">总债务</th><th className="text-right">净债务</th><th className="text-right">债务/市值</th><th className="text-right">账面负债权益比</th><th className="text-right">利息覆盖</th><th className="text-right">现金/债务</th><th className="text-right">负债/资产</th><th className="text-right">股价波动</th><th className="px-2 text-right">报告期</th></tr></thead>
              <tbody>
                {data.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className={`cursor-pointer ${TR}`}>
                  <td className="px-2 py-0.5 font-mono text-slate-100">{r.s}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(t[r.s]?.changePct) }}>{fmtPrice(t[r.s]?.price)}</td>
                  <td className="text-right font-mono">{fmtCompact(r.b?.marketCap)}</td>
                  <td className="text-right font-mono">{fmtCompact(r.b?.debt)}</td>
                  <td className="text-right font-mono">{fmtCompact(r.net)}</td>
                  <td className="text-right font-mono" style={{ background: heat(r.lev == null ? null : r.lev - 100, 200) }}>{f2(r.lev, 0, "%")}</td>
                  <td className="text-right font-mono">{f2(r.bookDE, 2, "x")}</td>
                  <td className="text-right font-mono" style={{ background: heat(r.cov == null ? null : 3 - r.cov, 3) }}>{f2(r.cov, 1, "x")}</td>
                  <td className="text-right font-mono">{f2(r.cashDebt, 0, "%")}</td>
                  <td className="text-right font-mono">{f2(r.liabA, 0, "%")}</td>
                  <td className="text-right font-mono">{f2(r.sE, 1, "%")}</td>
                  <td className="px-2 text-right font-mono text-[10px] text-slate-500">{r.b?.asOf ?? "—"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {bal.loading && !bal.data && <Empty loading />}
          <Note>财务数据取最近一期季报（利息覆盖 = 单季息税前利润 / 单季利息支出）；债务/市值以总债务与实时市值计算，反映市场化杠杆。点击行查看 K 线。</Note>
        </>
      )}
      {tab === "dd" && (
        <>
          <Kpis items={[["样本数", String(data.filter((d) => d.dd != null).length)], ["最低违约距离", ranked[0]?.dd != null ? `${ranked[0].s} ${ranked[0].dd.toFixed(2)}σ` : "—"], ["样本中位 1 年违约概率", (() => { const a = data.map((d) => d.pd).filter((v): v is number => v != null).sort((x, y) => x - y); return a.length ? `${a[Math.floor(a.length / 2)].toFixed(2)}%` : "—"; })()], ["无风险利率", rf != null ? `${(rf * 100).toFixed(2)}%` : "—", "1 年期美债零息"]]} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">发行人</th><th className="text-right">股价年化波动</th><th className="text-right">债务/市值</th><th className="text-right">违约距离</th><th className="w-[30%] px-2 text-left">违约距离</th><th className="text-right">模型 1 年违约概率</th><th className="text-right">1 年股价表现</th><th className="px-2 text-right">距 52 周高</th></tr></thead>
            <tbody>{ranked.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className={`cursor-pointer ${TR}`}>
              <td className="px-2 py-0.5 font-mono text-slate-100">{r.s}</td>
              <td className="text-right font-mono">{f2(r.sE, 1, "%")}</td>
              <td className="text-right font-mono">{f2(r.lev, 0, "%")}</td>
              <td className="text-right font-mono text-white">{f2(r.dd, 2)}</td>
              <td className="px-2"><div className="h-2 bg-[#0f1b29]"><div className="h-2" style={{ width: `${Math.min(100, Math.max(0, ((r.dd ?? 0) / 10) * 100))}%`, background: (r.dd ?? 0) < 2 ? UP : (r.dd ?? 0) < 4 ? "#f59e0b" : DOWN }} /></div></td>
              <td className="text-right font-mono" style={{ background: heat(r.pd, 5) }}>{r.pd != null ? `${r.pd < 0.01 ? "<0.01" : r.pd.toFixed(2)}%` : "—"}</td>
              <td className="text-right font-mono" style={{ color: toneOf(r.r1y) }}>{sgn(r.r1y)}</td>
              <td className="px-2 text-right font-mono" style={{ color: toneOf(r.dd1y) }}>{sgn(r.dd1y)}</td>
            </tr>)}</tbody>
          </table>
          <Note>口径：简化结构化模型（默顿框架，朴素估计）：资产价值 = 实时市值 + 总债务；资产波动 = 权益占比 × 股价一年波动 + 债务占比 × (5% + 25% × 股价波动)；违约点 = 总债务，期限 1 年，漂移取 1 年期美债利率。违约距离 &lt; 2 为高风险区。结果为模型估计，不是评级或市场报价。</Note>
        </>
      )}
      {tab === "events" && (
        <>
          <div className="flex items-center gap-2 px-2 py-1"><Seg value={evt} onChange={setEvt} options={[["ch11", "破产重整"], ["eod", "违约事件通知"], ["forb", "宽限 / 暂缓协议"], ["dist", "困境债务置换"]]} /><span className="ml-auto text-[10px] text-slate-500">{f.data ? `近 60 天 ${f.data.total} 份` : ""}</span></div>
          <DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: r.company, sub: `${r.form}${r.items.length ? ` · 事项 ${r.items.join(", ")}` : ""}${r.ticker ? ` · ${r.ticker}` : ""}`, date: r.date, url: r.url, tag: r.form }))} empty="近 60 天无此类文书" />
          <Note>8-K 事项 1.03 = 破产或接管，2.04 = 触发加速清偿的债务事件，1.01 = 重大协议（含宽限协议）。</Note>
        </>
      )}
      {tab === "news" && <FeedList items={news.items} loading={news.loading} empty="近 7 天无信用事件相关新闻" />}
    </PanelShell>
  );
}

/* ================================================================== CRMX 增信与担保机构 */
const GUARANTORS: Array<[string, string]> = [["AGO", "Assured Guaranty 债券保险"], ["MBI", "MBIA 债券保险"], ["RDN", "Radian 按揭保险"], ["MTG", "MGIC 按揭保险"], ["ESNT", "Essent 按揭保险"], ["NMIH", "NMI 按揭保险"], ["ACT", "Enact 按揭保险"]];
export function CRMXLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const syms = GUARANTORS.map((g) => g[0]);
  const bal = useBalance(syms);
  const cl = useCloses(syms, 260);
  const cv = useCurves();
  const disc = discounter(cv.data);
  const [notional, setNotional] = useState(10);
  const [tenor, setTenor] = useState(10);
  const [pre, setPre] = useState(180);
  const [post, setPost] = useState(95);
  const [prem, setPrem] = useState(40);
  const [docQ, setDocQ] = useState("fg");
  const DOCQ: Record<string, [string, string[]]> = { fg: ['"financial guaranty"', ["8-K", "10-Q"]], muni: ['"insured municipal"', ["8-K", "10-Q", "10-K"]], mi: ['"mortgage insurance" "risk-to-capital"', ["8-K", "10-Q"]] };
  const f = useFilings(DOCQ[docQ][0], DOCQ[docQ][1], 120);
  const ann = useMemo(() => { if (!disc) return null; let a = 0; for (let k = 1; k <= Math.round(tenor * 2); k++) a += 0.5 * disc.df(k / 2); return a; }, [disc, tenor]);
  const save = pre - post - prem;
  const pv = ann != null ? notional * 1e8 * (save / 1e4) * ann : null;
  const cap = useMemo(() => syms.map((s) => {
    const b = bal.data?.find((x) => x.symbol === s);
    const c = closesOf(cl.data, s);
    return { s, label: GUARANTORS.find((g) => g[0] === s)?.[1] ?? s, b, pb: b?.marketCap && b.equity ? b.marketCap / b.equity : null, de: b?.debt != null && b.equity ? (b.debt / b.equity) * 100 : null, la: b?.liabilities != null && b.assets ? (b.liabilities / b.assets) * 100 : null, vol: annVol(c), r1y: retN(c, Math.min(250, c.length - 1)), dd: ddFromHigh(c) };
  }), [bal.data, cl.data]);
  return (
    <PanelShell code="CRMX" title="增信与担保机构" onClose={onClose} tabs={[["board", "机构行情"], ["cap", "资本实力"], ["calc", "增信价值测算"], ["docs", "披露文书"]]} tab={tab} setTab={setTab}>
      {tab === "board" && (
        <>
          <LiveBoard rows={rows(GUARANTORS, "债券保险 / 按揭保险机构")} />
          <Note>增信机构的股价与波动是其担保能力的市场化信号：担保人股价大跌、波动飙升时，其承保债券的增信价值随之打折。</Note>
        </>
      )}
      {tab === "cap" && (
        <>
          <table className="w-full whitespace-nowrap text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">机构</th><th className="text-right">市值</th><th className="text-right">股东权益</th><th className="text-right">市净率</th><th className="text-right">总债务</th><th className="text-right">债务/权益</th><th className="text-right">负债/资产</th><th className="text-right">现金</th><th className="text-right">股价波动</th><th className="text-right">1 年表现</th><th className="px-2 text-right">报告期</th></tr></thead>
            <tbody>{cap.map((r) => <tr key={r.s} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.label}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className="text-right font-mono">{fmtCompact(r.b?.marketCap)}</td><td className="text-right font-mono">{fmtCompact(r.b?.equity)}</td><td className="text-right font-mono" style={{ background: heat(r.pb == null ? null : 1 - r.pb, 0.6) }}>{f2(r.pb, 2, "x")}</td><td className="text-right font-mono">{fmtCompact(r.b?.debt)}</td><td className="text-right font-mono">{f2(r.de, 0, "%")}</td><td className="text-right font-mono">{f2(r.la, 0, "%")}</td><td className="text-right font-mono">{fmtCompact(r.b?.cash)}</td><td className="text-right font-mono">{f2(r.vol, 1, "%")}</td><td className="text-right font-mono" style={{ color: toneOf(r.r1y) }}>{sgn(r.r1y)}</td><td className="px-2 text-right font-mono text-[10px] text-slate-500">{r.b?.asOf ?? "—"}</td></tr>)}</tbody>
          </table>
          {bal.loading && !bal.data && <Empty loading />}
          <SectionHead title="市净率对比" />
          <Bars data={cap.filter((r) => r.pb != null).map((r) => ({ k: r.s, v: r.pb! }))} fmt={(v) => `${v.toFixed(2)}x`} height={110} />
        </>
      )}
      {tab === "calc" && (
        <>
          <div className="flex flex-wrap items-center gap-3 px-2 py-2">
            <NumIn label="名义本金" value={notional} onChange={setNotional} suffix="亿" />
            <NumIn label="期限" value={tenor} onChange={(v) => setTenor(Math.min(30, Math.max(0.5, v)))} step={0.5} suffix="年" />
            <NumIn label="增信前利差" value={pre} onChange={setPre} suffix="bp" />
            <NumIn label="增信后利差" value={post} onChange={setPost} suffix="bp" />
            <NumIn label="保费" value={prem} onChange={setPrem} suffix="bp/年" />
          </div>
          <Kpis items={[["年度净节省", bp(save)], ["净节省现值", pv != null ? fmtCompact(pv) : "—", "按最新美债曲线贴现"], ["盈亏平衡保费", `${(pre - post).toFixed(0)}bp/年`, "保费高于此值增信不划算"], ["年金因子", f2(ann, 3), disc ? `曲线日期 ${disc.date}` : undefined]]} />
          <SectionHead title="敏感度：增信后利差 × 保费 → 净节省现值（亿）" />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">增信后利差 \ 保费</th>{[prem - 20, prem - 10, prem, prem + 10, prem + 20].map((p) => <th key={p} className="px-2 text-right">{p}bp</th>)}</tr></thead>
            <tbody>{[post - 30, post - 15, post, post + 15, post + 30].map((sp) => <tr key={sp} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{sp}bp</td>{[prem - 20, prem - 10, prem, prem + 10, prem + 20].map((p) => { const v = ann != null ? (notional * (pre - sp - p) * ann) / 1e4 : null; return <td key={p} className="px-2 text-right font-mono" style={{ background: heat(v == null ? null : -v, Math.max(0.01, notional * 0.05)) }}>{f2(v, 3)}</td>; })}</tr>)}</tbody>
          </table>
          <Note>口径：发行人视角，半年付息；净节省现值 = 名义本金 × (增信前利差 − 增信后利差 − 保费) × Σ 0.5 × 贴现因子，贴现因子取实时美债曲线。利差与保费为用户输入。</Note>
        </>
      )}
      {tab === "docs" && (
        <>
          <div className="flex items-center gap-2 px-2 py-1"><Seg value={docQ} onChange={setDocQ} options={[["fg", "债券保险"], ["muni", "市政债增信"], ["mi", "按揭保险资本"]]} /><span className="ml-auto text-[10px] text-slate-500">{f.data ? `近 120 天 ${f.data.total} 份` : ""}</span></div>
          <DocList loading={f.loading} rows={(f.data?.rows ?? []).map((r) => ({ id: r.id, title: r.company, sub: `${r.form}${r.items.length ? ` · 事项 ${r.items.join(", ")}` : ""}`, date: r.date, url: r.url, tag: r.form }))} empty="近 120 天无相关文书" />
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== LOANS 杠杆贷款与私募信贷 */
const LOAN_BOARD: BoardRow[] = [
  ...rows([["BKLN", "优先级贷款 ETF"], ["SRLN", "优先级贷款 ETF（二）"], ["FLBL", "浮息贷款 ETF"]], "杠杆贷款"),
  ...rows([["JAAA", "AAA 级 CLO"], ["JBBB", "BBB 级 CLO"], ["CLOZ", "BBB-B 级 CLO"]], "贷款抵押债（CLO）"),
  ...rows([["ARCC", "Ares 资本"], ["OBDC", "Blue Owl 资本"], ["BXSL", "黑石担保贷款"], ["FSK", "FS KKR 资本"], ["MAIN", "Main Street 资本"], ["HTGC", "Hercules 资本"], ["GBDC", "Golub 资本"], ["BIZD", "商业发展公司 ETF"]], "私募信贷（商业发展公司）"),
  ...rows([["HYG", "高收益公司债"], ["IEF", "7-10 年美债"]], "对比"),
];
const BDC = ["ARCC", "OBDC", "BXSL", "FSK", "MAIN", "HTGC", "GBDC"];
export function LOANSLive({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const [margin, setMargin] = useState(325);
  const [floor, setFloor] = useState(0.5);
  const mm = useMoneyMarket();
  const cl = useCloses(["BKLN", "HYG", "IEF", "JAAA", ...BDC], 540);
  const bal = useBalance(tab === "bdc" ? BDC : []);
  const sofr = lastOf(mm.data?.series.SOFR ?? []);
  const cmp = useMemo(() => {
    const ss = ["BKLN", "HYG", "IEF", "JAAA"];
    const al = align(cl.data, ss);
    const norm = (a: number[]) => a.map((v) => (v / a[0]) * 100);
    const r = Object.fromEntries(ss.map((s) => [s, rets(al.m[s] ?? [])]));
    const roll = (a: number[], b: number[], w: number) => a.map((_, i) => (i < w ? null : corr(a.slice(i - w, i), b.slice(i - w, i))));
    return { dates: al.dates, idx: ss.map((s, i) => ({ name: s, color: ["#38bdf8", "#f59e0b", "#94a3b8", "#34d399"][i], values: norm(al.m[s] ?? []) })), cLoan: [null, ...roll(r.BKLN, r.IEF, 60)], cHy: [null, ...roll(r.HYG, r.IEF, 60)], stats: ss.map((s) => ({ s, vol: annVol(al.m[s] ?? []), r1y: retN(al.m[s] ?? [], 250), dd: Math.min(...ddSeries(al.m[s] ?? [0])) })) };
  }, [cl.data]);
  const strip = (mm.data?.sofrStrip ?? []).map((p) => ({ ...p, coupon: Math.max(floor, p.rate) + margin / 100 }));
  const bdc = BDC.map((s) => { const b = bal.data?.find((x) => x.symbol === s); const c = closesOf(cl.data, s); return { s, b, pnav: b?.marketCap && b.equity ? b.marketCap / b.equity : null, lev: b?.debt != null && b.equity ? b.debt / b.equity : null, vol: annVol(c, 250), r1y: retN(c, 250), dd: ddFromHigh(c) }; });
  return (
    <PanelShell code="LOANS" title="杠杆贷款与私募信贷" onClose={onClose} tabs={[["board", "行情"], ["float", "浮息与固息"], ["coupon", "票息路径"], ["bdc", "商业发展公司估值"]]} tab={tab} setTab={setTab} right={sofr ? <span>SOFR {sofr.v.toFixed(2)}%（{sofr.d}）</span> : null}>
      {tab === "board" && <LiveBoard rows={LOAN_BOARD} />}
      {tab === "float" && (
        <>
          <Kpis items={cmp.stats.map((s) => [`${s.s} 1 年`, <span key={s.s} style={{ color: toneOf(s.r1y) }}>{sgn(s.r1y)}</span>, `波动 ${f2(s.vol, 1, "%")} · 最大回撤 ${f2(s.dd, 1, "%")}`] as [string, React.ReactNode, string])} />
          <SectionHead title="净值走势（起点为 100）" sub="贷款 / CLO 浮息，利率久期近零；高收益与国债为固息" />
          <Lines series={cmp.idx} xLabels={cmp.dates.map((d) => d.slice(2))} height={190} fmt={(v) => v.toFixed(1)} />
          <SectionHead title="60 日滚动相关性：与 7-10 年美债" />
          <Lines series={[{ name: "贷款 vs 美债", color: "#38bdf8", values: cmp.cLoan }, { name: "高收益 vs 美债", color: "#f59e0b", values: cmp.cHy }]} xLabels={cmp.dates.map((d) => d.slice(2))} height={150} zero fmt={(v) => v.toFixed(2)} />
        </>
      )}
      {tab === "coupon" && (
        <>
          <div className="flex flex-wrap items-center gap-3 px-2 py-2"><NumIn label="贷款利差" value={margin} onChange={setMargin} suffix="bp" /><NumIn label="基准利率下限" value={floor} step={0.25} onChange={setFloor} suffix="%" /></div>
          <Kpis items={[["SOFR 隔夜", sofr ? `${sofr.v.toFixed(2)}%` : "—", sofr?.d], ["当前全收益票息", sofr ? `${(Math.max(floor, sofr.v) + margin / 100).toFixed(2)}%` : "—"], ["一年后隐含票息", strip[3] ? `${strip[3].coupon.toFixed(2)}%` : "—", strip[3]?.month], ["期货条末端票息", lastOf(strip) ? `${lastOf(strip)!.coupon.toFixed(2)}%` : "—", lastOf(strip)?.month]]} />
          <SectionHead title="贷款票息路径（%）" />
          <Lines series={[{ name: "SOFR 期货隐含", color: "#94a3b8", values: strip.map((p) => p.rate) }, { name: "贷款全收益票息", color: "#38bdf8", values: strip.map((p) => p.coupon) }]} xLabels={strip.map((p) => p.month)} height={180} fmt={(v) => v.toFixed(2)} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">合约月</th><th className="text-right">隐含 SOFR</th><th className="text-right">日变动</th><th className="text-right">基准（含下限）</th><th className="text-right">全收益票息</th><th className="px-2 text-right">成交量</th></tr></thead>
            <tbody>{strip.map((p) => <tr key={p.month} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{p.month}</td><td className="text-right font-mono">{p.rate.toFixed(3)}%</td><td className="text-right font-mono" style={{ color: toneOf(p.chg) }}>{p.chg != null ? bp(p.chg * 100, 1) : "—"}</td><td className="text-right font-mono">{Math.max(floor, p.rate).toFixed(3)}%</td><td className="text-right font-mono text-white">{p.coupon.toFixed(3)}%</td><td className="px-2 text-right font-mono text-slate-400">{fmtCompact(p.volume)}</td></tr>)}</tbody>
          </table>
          {!strip.length && <Empty loading={mm.loading} />}
          <Note>口径：全收益票息 = max(基准下限, 期货隐含 3 个月 SOFR) + 贷款利差；利差与下限为用户输入，不含期限 SOFR 与复利 SOFR 的基差及期货凸性调整。</Note>
        </>
      )}
      {tab === "bdc" && (
        <>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">公司</th><th className="text-right">市值</th><th className="text-right">净资产</th><th className="text-right">市价 / 净资产</th><th className="text-right">债务 / 净资产</th><th className="text-right">1 年波动</th><th className="text-right">1 年表现</th><th className="text-right">距 52 周高</th><th className="px-2 text-right">报告期</th></tr></thead>
            <tbody>{bdc.map((r) => <tr key={r.s} className={TR}><td className="px-2 py-0.5 text-slate-100">{LOAN_BOARD.find((x) => x.symbol === r.s)?.label}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className="text-right font-mono">{fmtCompact(r.b?.marketCap)}</td><td className="text-right font-mono">{fmtCompact(r.b?.equity)}</td><td className="text-right font-mono" style={{ background: heat(r.pnav == null ? null : 1 - r.pnav, 0.3) }}>{f2(r.pnav, 2, "x")}</td><td className="text-right font-mono">{f2(r.lev, 2, "x")}</td><td className="text-right font-mono">{f2(r.vol, 1, "%")}</td><td className="text-right font-mono" style={{ color: toneOf(r.r1y) }}>{sgn(r.r1y)}</td><td className="text-right font-mono" style={{ color: toneOf(r.dd) }}>{sgn(r.dd)}</td><td className="px-2 text-right font-mono text-[10px] text-slate-500">{r.b?.asOf ?? "—"}</td></tr>)}</tbody>
          </table>
          {bal.loading && !bal.data && <Empty loading />}
          <Note>口径：净资产取最近季报股东权益，市价 / 净资产以实时市值计算；折价扩大通常领先于私募信贷组合的不良上升。监管杠杆上限约为 2 倍债务 / 净资产。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== CDERIV 信用衍生分层定价（单因子高斯 copula，大样本同质组合） */
const GRID = (() => { const xs: number[] = []; const ws: number[] = []; for (let i = 0; i <= 240; i++) { const m = -6 + i * 0.05; xs.push(m); ws.push(npdf(m)); } const s = ws.reduce((a, b) => a + b, 0); return { xs, ws: ws.map((w) => w / s) }; })();
function eMinL(p: number, rho: number, R: number, K: number) {
  if (p <= 0 || K <= 0) return 0;
  const a = ninv(p);
  const sr = Math.sqrt(rho);
  const s1 = Math.sqrt(1 - rho);
  let e = 0;
  for (let i = 0; i < GRID.xs.length; i++) e += Math.min((1 - R) * ncdf((a - sr * GRID.xs[i]) / s1), K) * GRID.ws[i];
  return e;
}
function priceTranche(lam: number, rho: number, R: number, A: number, D: number, T: number, df: (t: number) => number) {
  const dt = 0.25;
  let prot = 0, rpv = 0, prev = 0;
  for (let k = 1; k <= Math.round(T / dt); k++) {
    const t = k * dt;
    const p = 1 - Math.exp(-lam * t);
    const el = (eMinL(p, rho, R, D) - eMinL(p, rho, R, A)) / (D - A);
    const DF = df(t);
    prot += DF * (el - prev);
    rpv += dt * DF * (1 - (el + prev) / 2);
    prev = el;
  }
  return { el: prev * 100, prot, rpv, spread: rpv > 0 ? (prot / rpv) * 1e4 : null, up500: (prot - 0.05 * rpv) * 100 };
}
export function CDERIVLive({ onClose }: P) {
  const [tab, setTab] = useState("tranche");
  const [pd5, setPd5] = useState(8);
  const [rec, setRec] = useState(40);
  const [rho, setRho] = useState(30);
  const [T, setT] = useState(5);
  const [att, setAtt] = useState("0,3,7,15,100");
  const [clnS0, setClnS0] = useState(250);
  const [clnS1, setClnS1] = useState(250);
  const [clnT, setClnT] = useState(5);
  const cv = useCurves();
  const mm = useMoneyMarket();
  const disc = discounter(cv.data);
  const R = Math.min(0.95, Math.max(0, rec / 100));
  const lam = -Math.log(1 - Math.min(0.99, Math.max(0.0001, pd5 / 100))) / 5;
  const rh = Math.min(0.95, Math.max(0.01, rho / 100));
  const pts = useMemo(() => { const a = att.split(/[,，\s]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0 && x <= 100); const u = [...new Set(a)].sort((x, y) => x - y); return u.length >= 2 ? u : [0, 3, 7, 15, 100]; }, [att]);
  const tr = useMemo(() => (disc ? pts.slice(0, -1).map((A, i) => ({ A, D: pts[i + 1], ...priceTranche(lam, rh, R, A / 100, pts[i + 1] / 100, T, disc.df) })) : []), [disc, pts, lam, rh, R, T]);
  const idx = useMemo(() => (disc ? priceTranche(lam, rh, R, 0, 1, T, disc.df) : null), [disc, lam, rh, R, T]);
  const dist = useMemo(() => {
    const p = 1 - Math.exp(-lam * T);
    const a = ninv(p);
    const F = (x: number) => (x <= 0 ? 0 : x >= 1 - R ? 1 : ncdf((Math.sqrt(1 - rh) * ninv(x / (1 - R)) - a) / Math.sqrt(rh)));
    const nB = 25;
    const top = Math.min(1 - R, 0.5);
    return Array.from({ length: nB }, (_, i) => { const lo = (top * i) / nB, hi = (top * (i + 1)) / nB; return { k: `${(hi * 100).toFixed(1)}`, v: (F(hi) - F(lo)) * 100 }; });
  }, [lam, rh, R, T]);
  const sens = useMemo(() => (disc ? [5, 10, 15, 20, 30, 40, 50, 60, 70, 80].map((r) => ({ r, s: pts.slice(0, -1).map((A, i) => priceTranche(lam, r / 100, R, A / 100, pts[i + 1] / 100, T, disc.df).spread) })) : []), [disc, pts, lam, R, T]);
  const sofr = lastOf(mm.data?.series.SOFR ?? []);
  const cln = useMemo(() => {
    if (!disc) return null;
    const c = disc.par(clnT) / 100 + clnS0 / 1e4;
    const price = (s: number) => {
      const l = s / 1e4 / (1 - R);
      let v = 0, prevS = 1;
      for (let k = 1; k <= Math.round(clnT * 4); k++) { const t = k / 4; const S = Math.exp(-l * t); const DF = disc.df(t); v += (c / 4) * DF * S + R * DF * (prevS - S); prevS = S; }
      return (v + disc.df(clnT) * Math.exp(-l * clnT)) * 100;
    };
    const p = price(clnS1);
    return { c: c * 100, p, dv: price(clnS1 + 1) - p, floatC: sofr ? sofr.v + clnS0 / 100 : null };
  }, [disc, clnT, clnS0, clnS1, R, sofr]);
  const inputs = (
    <div className="flex flex-wrap items-center gap-3 px-2 py-2">
      <NumIn label="组合 5 年累计违约概率" value={pd5} step={0.5} onChange={setPd5} suffix="%" />
      <NumIn label="回收率" value={rec} onChange={setRec} suffix="%" />
      <NumIn label="资产相关性" value={rho} onChange={setRho} suffix="%" />
      <NumIn label="期限" value={T} step={0.25} onChange={(v) => setT(Math.min(10, Math.max(0.25, v)))} suffix="年" />
      <label className="flex items-center gap-1 text-[10px] text-slate-400">分层点（%）<input value={att} onChange={(e) => setAtt(e.target.value)} className="w-32 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 font-mono text-[11px] text-white" /></label>
    </div>
  );
  return (
    <PanelShell code="CDRV" title="信用衍生分层定价" onClose={onClose} tabs={[["tranche", "分层定价"], ["dist", "损失分布"], ["sens", "相关性敏感度"], ["cln", "信用关联票据"]]} tab={tab} setTab={setTab} right={disc ? <span>贴现曲线 {disc.date}</span> : null}>
      {tab !== "cln" && inputs}
      {tab === "tranche" && (
        <>
          <Kpis items={[["组合违约强度", `${(lam * 1e4).toFixed(0)}bp/年`, "由 5 年累计违约概率换算"], ["组合公允利差", idx?.spread != null ? `${idx.spread.toFixed(1)}bp` : "—", "0-100% 全层"], ["组合预期损失", idx ? `${idx.el.toFixed(2)}%` : "—", `${T} 年`], ["5 年期美债", disc ? `${disc.par(5).toFixed(3)}%` : "—"]]} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">分层</th><th className="text-right">厚度</th><th className="text-right">到期预期损失</th><th className="text-right">风险年金（RPV01）</th><th className="text-right">公允running利差</th><th className="px-2 text-right">500bp running 下前付</th></tr></thead>
            <tbody>{tr.map((x) => <tr key={x.A} className={TR}><td className="px-2 py-0.5 font-mono text-slate-100">{x.A}% – {x.D}%</td><td className="text-right font-mono">{x.D - x.A}%</td><td className="text-right font-mono" style={{ background: heat(x.el, 60) }}>{x.el.toFixed(2)}%</td><td className="text-right font-mono">{x.rpv.toFixed(3)}</td><td className="text-right font-mono text-white">{x.spread != null ? `${x.spread.toFixed(1)}bp` : "—"}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(x.up500) }}>{x.up500.toFixed(2)}%</td></tr>)}</tbody>
          </table>
          {!disc && <Empty loading={cv.loading} />}
          <Note>口径：大样本同质组合单因子高斯 copula（Vasicek）；违约时间服从常数违约强度；季度付息，贴现因子取实时美债曲线；违约概率、回收率、相关性均为用户输入的假设，非市场报价。</Note>
        </>
      )}
      {tab === "dist" && (
        <>
          <SectionHead title={`${T} 年组合损失分布（每柱概率 %，横轴为损失上限 %）`} sub={`回收率 ${rec}% · 相关性 ${rho}%`} />
          <Bars data={dist} fmt={(v) => `${v.toFixed(2)}%`} height={200} />
          <table className="w-full text-[11px]"><tbody>{[[1, "1%"], [5, "5%"], [10, "10%"]].map(([k, l]) => { const x = dist.reduce((acc, d) => (acc.done ? acc : acc.c + d.v >= 100 - (k as number) ? { c: acc.c + d.v, done: true, at: d.k } : { c: acc.c + d.v, done: false, at: d.k }), { c: 0, done: false, at: "" }); return <tr key={l as string} className={TR}><td className="px-2 py-0.5 text-slate-400">{l} 尾部分位损失（约）</td><td className="px-2 text-right font-mono text-white">≤ {x.at}%</td></tr>; })}</tbody></table>
          <Note>相关性越高，损失分布越向两端集中：权益层受益（违约集中出现在少数情景），高级层风险上升。</Note>
        </>
      )}
      {tab === "sens" && (
        <>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">相关性</th>{pts.slice(0, -1).map((A, i) => <th key={A} className="px-2 text-right">{A}–{pts[i + 1]}%</th>)}</tr></thead>
            <tbody>{sens.map((r) => <tr key={r.r} className={`${TR} ${Math.abs(r.r - rho) < 0.01 ? "bg-[#0d2236]" : ""}`}><td className="px-2 py-0.5 font-mono text-slate-300">{r.r}%</td>{r.s.map((v, i) => <td key={i} className="px-2 text-right font-mono">{v != null ? v.toFixed(1) : "—"}</td>)}</tr>)}</tbody>
          </table>
          <SectionHead title="各分层公允利差随相关性变化（各层以相关性 5% 时为 100 标准化）" />
          <Lines series={pts.slice(0, -1).map((A, i) => ({ name: `${A}–${pts[i + 1]}%`, color: ["#f2495c", "#f59e0b", "#38bdf8", "#34d399", "#a78bfa", "#94a3b8"][i % 6], values: sens.map((r) => (r.s[i] != null && sens[0].s[i] ? (r.s[i]! / sens[0].s[i]!) * 100 : null)) }))} xLabels={sens.map((r) => `${r.r}%`)} height={180} fmt={(v) => v.toFixed(0)} />
        </>
      )}
      {tab === "cln" && (
        <>
          <div className="flex flex-wrap items-center gap-3 px-2 py-2">
            <NumIn label="发行时参考利差" value={clnS0} onChange={setClnS0} suffix="bp" />
            <NumIn label="当前参考利差" value={clnS1} onChange={setClnS1} suffix="bp" />
            <NumIn label="期限" value={clnT} step={0.5} onChange={(v) => setClnT(Math.min(10, Math.max(0.5, v)))} suffix="年" />
            <NumIn label="回收率" value={rec} onChange={setRec} suffix="%" />
          </div>
          <Kpis items={[["固定票息（等价）", cln ? `${cln.c.toFixed(3)}%` : "—", `同期限美债 ${disc ? disc.par(clnT).toFixed(3) : "—"}% + 参考利差`], ["浮动票息（当前）", cln?.floatC != null ? `${cln.floatC.toFixed(3)}%` : "—", sofr ? `SOFR ${sofr.v.toFixed(2)}% + 参考利差` : undefined], ["票据估值", cln ? `${cln.p.toFixed(3)}` : "—", "每 100 面值"], ["利差 DV01", cln ? `${(cln.dv * 100).toFixed(2)} 分` : "—", "参考利差 +1bp 的价格变动"]]} />
          <Note>口径：信用关联票据 = 无风险票据 + 卖出参考主体信用保护；估值以常数违约强度（参考利差 / (1 − 回收率)）计算生存概率，按实时美债曲线贴现，违约时按回收率偿付。参考利差为用户输入。</Note>
        </>
      )}
    </PanelShell>
  );
}
