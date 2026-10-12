/**
 * 定价与风险 · 运营与情报五个面板：策略回测（BKT）、智能预警（ALT）、公告情报（ANN）、定价审计（AUD）、系统集成（INT）。
 * 数据：真实日线、实时行情、清洗后的新闻流、证监会披露、平台自有交易事件与运行指标。
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, ucGet, usePolled, useTicks, type Tick } from "@/uc/market/live";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { f2, heat, sgn, useCloses } from "@/uc/hubs/calc";
import { FeedList, Seg, useFeed, type News } from "@/uc/news/kit";
import { EventsList, fmtTs, KIND_ZH, STATUS_ZH, useEvents, useOrders } from "@/uc/trade/kit";
import { DocList, Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { avg, nm, Note, pct, quantile, sd, sret, TH, TR } from "./PricingKit";
import { SymInput } from "./PricingLive";

const dayKey = (t: number) => new Date(t + 8 * 3600_000).toISOString().slice(0, 10);

/* ================================================================== BKT 策略回测 */
type Strat = "ma" | "mom" | "boll" | "rsi";
const STRAT: Record<Strat, { name: string; a: [string, number[]]; b: [string, number[]]; def: [number, number]; desc: string }> = {
  ma: { name: "均线交叉", a: ["短均线", [5, 10, 20, 30, 50]], b: ["长均线", [60, 100, 150, 200, 250]], def: [20, 100], desc: "短均线在长均线之上持有，否则空仓" },
  mom: { name: "时序动量", a: ["回看天数", [20, 60, 120, 180, 250]], b: ["跳过近期天数", [0, 5, 10, 21]], def: [120, 5], desc: "过去 a 日至 b 日的收益为正则持有（经典 12−1 动量）" },
  boll: { name: "布林带均值回归", a: ["窗口", [10, 20, 30, 50]], b: ["带宽倍数", [1.5, 2, 2.5, 3]], def: [20, 2], desc: "收盘跌破下轨买入，回到中轨卖出" },
  rsi: { name: "相对强弱反转", a: ["买入阈值", [20, 25, 30, 35]], b: ["卖出阈值", [55, 60, 70, 80]], def: [30, 70], desc: "14 日相对强弱低于买入阈值买入，高于卖出阈值卖出" },
};
function signal(c: number[], s: Strat, a: number, b: number) {
  const n = c.length, pos = new Array(n).fill(0);
  if (s === "ma") {
    let sa = 0, sb = 0;
    for (let i = 0; i < n; i++) { sa += c[i]; sb += c[i]; if (i >= a) sa -= c[i - a]; if (i >= b) sb -= c[i - b]; if (i >= Math.max(a, b) - 1) pos[i] = sa / a > sb / b ? 1 : 0; }
  } else if (s === "mom") {
    for (let i = a; i < n; i++) pos[i] = c[i - b] / c[i - a] - 1 > 0 ? 1 : 0;
  } else if (s === "boll") {
    let hold = 0;
    for (let i = a - 1; i < n; i++) { const w = c.slice(i - a + 1, i + 1); const m = avg(w), d = sd(w); if (!hold && c[i] < m - b * d) hold = 1; else if (hold && c[i] >= m) hold = 0; pos[i] = hold; }
  } else {
    let up = 0, dn = 0, hold = 0;
    for (let i = 1; i < n; i++) {
      const ch = c[i] - c[i - 1];
      if (i <= 14) { up += Math.max(ch, 0) / 14; dn += Math.max(-ch, 0) / 14; } else { up = (up * 13 + Math.max(ch, 0)) / 14; dn = (dn * 13 + Math.max(-ch, 0)) / 14; }
      if (i < 14) continue;
      const rsi = dn ? 100 - 100 / (1 + up / dn) : 100;
      if (!hold && rsi < a) hold = 1; else if (hold && rsi > b) hold = 0;
      pos[i] = hold;
    }
  }
  return pos;
}
function runBt(c: number[], pos: number[], costBps: number) {
  const r: number[] = [];
  let trades = 0;
  for (let i = 1; i < c.length; i++) { const turn = Math.abs(pos[i - 1] - (pos[i - 2] ?? 0)); if (turn) trades++; r.push(pos[i - 1] * (c[i] / c[i - 1] - 1) - (turn * costBps) / 1e4); }
  return { r, trades };
}
function stats(r: number[]) {
  if (r.length < 20) return null;
  let e = 1, pk = 1, mdd = 0;
  const eq = r.map((x) => { e *= 1 + x; pk = Math.max(pk, e); mdd = Math.min(mdd, e / pk - 1); return e; });
  const yrs = r.length / 252;
  const cagr = Math.pow(e, 1 / yrs) - 1;
  const vol = sd(r) * Math.sqrt(252);
  const neg = r.filter((x) => x < 0);
  const dvol = Math.sqrt(neg.reduce((a, x) => a + x * x, 0) / Math.max(1, r.length)) * Math.sqrt(252);
  return { eq, cagr, vol, sharpe: vol ? (avg(r) * 252) / vol : 0, sortino: dvol ? (avg(r) * 252) / dvol : 0, mdd, calmar: mdd ? cagr / Math.abs(mdd) : 0, total: e - 1 };
}

export function LiveBacktest() {
  const [sym, setSym] = useState("sh000300");
  const [st, setSt] = useState<Strat>("ma");
  const [pa, setPa] = useState(20);
  const [pb, setPb] = useState(100);
  const [cost, setCost] = useState(5);
  const [tab, setTab] = useState("eq");
  const pack = useCloses([sym], 2600);
  const ser = pack.data?.[sym] ?? [];
  const c = ser.map((x) => x[1]);
  const dates = ser.map((x) => dayKey(x[0]));
  const cfg = STRAT[st];
  const res = useMemo(() => {
    if (c.length < 300) return null;
    const pos = signal(c, st, pa, pb);
    const { r, trades } = runBt(c, pos, cost);
    const bh = c.slice(1).map((v, i) => v / c[i] - 1);
    const start = st === "ma" || st === "mom" ? Math.max(...cfg.a[1], ...cfg.b[1]) : 60;
    const S = stats(r.slice(start)), B = stats(bh.slice(start));
    const exposure = avg(pos.slice(start));
    // 逐笔交易
    const tr: Array<{ in: string; out: string | null; ret: number; days: number }> = [];
    let entry = -1;
    for (let i = start; i < pos.length; i++) { if (pos[i] && entry < 0) entry = i; if ((!pos[i] || i === pos.length - 1) && entry >= 0) { const exit = pos[i] ? i : i; tr.push({ in: dates[entry], out: pos[i] ? null : dates[exit], ret: c[exit] / c[entry] - 1, days: exit - entry }); entry = -1; } }
    const mon = new Map<string, number>();
    r.slice(start).forEach((x, i) => { const k = dates[start + i + 1].slice(0, 7); mon.set(k, (1 + (mon.get(k) ?? 0)) * (1 + x) - 1); });
    const grid = cfg.a[1].map((a) => cfg.b[1].map((b) => { if (st === "ma" && a >= b) return null; if (st === "rsi" && a >= b) return null; const rr = runBt(c, signal(c, st, a, b), cost).r.slice(start); return stats(rr)?.sharpe ?? null; }));
    const costs = [0, 2, 5, 10, 20, 50].map((k) => ({ k, s: stats(runBt(c, pos, k).r.slice(start)) }));
    return { S, B, trades, exposure, tr, mon, grid, costs, start };
  }, [c.length, c[c.length - 1], st, pa, pb, cost]);
  const years = res ? [...new Set([...res.mon.keys()].map((k) => k.slice(0, 4)))].sort().reverse() : [];
  const choose = (s: Strat) => { setSt(s); setPa(STRAT[s].def[0]); setPb(STRAT[s].def[1]); };
  const wins = res ? res.tr.filter((t) => t.ret > 0).length : 0;
  return (
    <PanelShell code="BKT" title="策略回测引擎（真实日线，收盘信号）" tabs={[["eq", "净值与绩效"], ["sens", "参数敏感性"], ["mon", "月度收益"], ["cost", "交易成本与成交明细"]]} tab={tab} setTab={setTab}>
      <SymInput value={sym} onChange={setSym} quick={[["sh000300", "沪深300"], ["sh000905", "中证500"], ["SPY", "标普ETF"], ["QQQ", "纳指ETF"], ["2800.HK", "盈富基金"], ["GLD", "黄金ETF"], ["TLT", "长期美债ETF"], ["BTC", "比特币"]]} />
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
        <Seg value={st} options={(Object.keys(STRAT) as Strat[]).map((k) => [k, STRAT[k].name])} onChange={choose} />
        <label className="flex items-center gap-1 text-slate-400">{cfg.a[0]}<select value={pa} onChange={(e) => setPa(Number(e.target.value))} className="border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white">{cfg.a[1].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="flex items-center gap-1 text-slate-400">{cfg.b[0]}<select value={pb} onChange={(e) => setPb(Number(e.target.value))} className="border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white">{cfg.b[1].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="flex items-center gap-1 text-slate-400">单边成本（基点）<input type="number" value={cost} onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))} className="w-14 border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white" /></label>
        <span className="text-[10px] text-slate-500">{cfg.desc}</span>
      </div>
      {!res || !res.S || !res.B ? <Empty loading={pack.loading} text="日线不足（至少 300 个交易日）" /> : (
        <>
          <Kpis items={[["年化收益", <span style={{ color: toneOf(res.S.cagr) }}>{pct(res.S.cagr)}</span>, `买入持有 ${pct(res.B.cagr)}`], ["夏普比率", f2(res.S.sharpe, 2), `买入持有 ${f2(res.B.sharpe, 2)} · 索提诺 ${f2(res.S.sortino, 2)}`], ["最大回撤", pct(res.S.mdd), `买入持有 ${pct(res.B.mdd)}`], ["交易次数", String(res.trades), `持仓时间占比 ${pct(res.exposure, 0)} · 胜率 ${res.tr.length ? pct(wins / res.tr.length, 0) : "—"}`]]} />
          {tab === "eq" && <>
            <SectionHead title="策略净值 vs 买入持有" sub={`${dates[res.start + 1]} 至 ${dates[dates.length - 1]}`} />
            <Lines series={[{ name: "策略", color: "#fbbf24", values: res.S.eq }, { name: "买入持有", color: "#64748b", values: res.B.eq }]} xLabels={dates.slice(res.start + 1).map((d) => d.slice(2))} height={220} fmt={(v) => v.toFixed(2)} />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">指标</th><th className="text-right">策略</th><th className="px-2 text-right">买入持有</th></tr></thead>
              <tbody>{([["累计收益", pct(res.S.total), pct(res.B.total)], ["年化收益", pct(res.S.cagr), pct(res.B.cagr)], ["年化波动", pct(res.S.vol), pct(res.B.vol)], ["夏普比率", f2(res.S.sharpe, 2), f2(res.B.sharpe, 2)], ["索提诺比率", f2(res.S.sortino, 2), f2(res.B.sortino, 2)], ["最大回撤", pct(res.S.mdd), pct(res.B.mdd)], ["卡玛比率", f2(res.S.calmar, 2), f2(res.B.calmar, 2)]] as Array<[string, string, string]>).map(([k, a, b]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-300">{k}</td><td className="text-right font-mono text-amber-200">{a}</td><td className="px-2 text-right font-mono text-slate-400">{b}</td></tr>)}</tbody></table>
          </>}
          {tab === "sens" && <>
            <SectionHead title={`参数网格夏普比率（${cfg.a[0]} × ${cfg.b[0]}）`} />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">{cfg.a[0]} \ {cfg.b[0]}</th>{cfg.b[1].map((b) => <th key={b} className="text-right">{b}</th>)}</tr></thead>
              <tbody>{cfg.a[1].map((a, i) => <tr key={a} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{a}</td>{res.grid[i].map((v, j) => <td key={j} onClick={() => { setPa(a); setPb(cfg.b[1][j]); }} className={`cursor-pointer px-2 text-right font-mono ${a === pa && cfg.b[1][j] === pb ? "outline outline-1 outline-amber-400" : ""}`} style={{ background: heat(v != null ? v - (res.B.sharpe ?? 0) : null, 0.8) }}>{v == null ? "—" : v.toFixed(2)}</td>)}</tr>)}</tbody></table>
            <Note>颜色表示相对买入持有夏普（{f2(res.B.sharpe, 2)}）的高低。点击单元格切换到该参数组合。</Note>
          </>}
          {tab === "mon" && <>
            <SectionHead title="月度收益（%）" />
            <div className="overflow-x-auto"><table className="w-full text-[10px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">年份</th>{Array.from({ length: 12 }, (_, i) => <th key={i} className="text-right">{i + 1}月</th>)}<th className="px-2 text-right">全年</th></tr></thead>
              <tbody>{years.map((y) => { const ms = Array.from({ length: 12 }, (_, i) => res.mon.get(`${y}-${String(i + 1).padStart(2, "0")}`) ?? null); const yr = ms.reduce<number>((a, v) => (1 + a) * (1 + (v ?? 0)) - 1, 0); return <tr key={y} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{y}</td>{ms.map((v, i) => <td key={i} className="px-1 text-right font-mono" style={{ background: heat(v != null ? v * 100 : null, 8) }}>{v == null ? "" : (v * 100).toFixed(1)}</td>)}<td className="px-2 text-right font-mono font-semibold" style={{ color: toneOf(yr) }}>{(yr * 100).toFixed(1)}</td></tr>; })}</tbody></table></div>
            <Bars data={[...res.mon.entries()].slice(-36).map(([k, v]) => ({ k: k.slice(2), v: v * 100 }))} height={110} fmt={(v) => `${v.toFixed(1)}%`} />
          </>}
          {tab === "cost" && <>
            <SectionHead title="交易成本敏感性（单边基点）" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">成本</th><th className="text-right">年化收益</th><th className="text-right">夏普</th><th className="text-right">最大回撤</th><th className="px-2 text-right">成本年化拖累</th></tr></thead>
              <tbody>{res.costs.map((x) => <tr key={x.k} className={`${TR} ${x.k === cost ? "bg-[#0b1a2a]" : ""}`}><td className="px-2 py-0.5 font-mono text-slate-300">{x.k}</td><td className="text-right font-mono" style={{ color: toneOf(x.s?.cagr) }}>{pct(x.s?.cagr)}</td><td className="text-right font-mono text-slate-200">{f2(x.s?.sharpe, 2)}</td><td className="text-right font-mono text-emerald-300">{pct(x.s?.mdd)}</td><td className="px-2 text-right font-mono text-slate-400">{x.s && res.costs[0].s ? pct(res.costs[0].s.cagr - x.s.cagr) : "—"}</td></tr>)}</tbody></table>
            <SectionHead title={`逐笔交易（${res.tr.length} 笔，胜率 ${res.tr.length ? pct(wins / res.tr.length, 0) : "—"}）`} />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">买入</th><th className="text-left">卖出</th><th className="text-right">持有天数</th><th className="px-2 text-right">收益</th></tr></thead>
              <tbody>{[...res.tr].reverse().slice(0, 80).map((t) => <tr key={t.in} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{t.in}</td><td className="font-mono text-slate-300">{t.out ?? <span className="text-amber-300">持有中</span>}</td><td className="text-right font-mono text-slate-400">{t.days}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(t.ret) }}>{pct(t.ret)}</td></tr>)}</tbody></table>
          </>}
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== ALT 智能预警 */
const WL: Array<[string, string, string]> = [["SPY", "标普500ETF", "股票"], ["QQQ", "纳指100ETF", "股票"], ["sh000300", "沪深300", "股票"], ["sh000001", "上证指数", "股票"], ["2800.HK", "盈富基金", "股票"], ["TLT", "20年+美债ETF", "利率"], ["HYG", "高收益债ETF", "信用"], ["LQD", "投资级债ETF", "信用"], ["GLD", "黄金ETF", "商品"], ["CL", "WTI原油", "商品"], ["HG", "铜", "商品"], ["DXY", "美元指数", "外汇"], ["USDCNH", "美元/离岸人民币", "外汇"], ["USDJPY", "美元/日元", "外汇"], ["EURUSD", "欧元/美元", "外汇"], ["BTC", "比特币", "加密"], ["^VIX", "波动率指数", "波动率"]];
type Alert = { lv: 3 | 2 | 1; sym: string; cat: string; msg: string; val: string };
type MyAlert = { id: string; symbol: string; op: ">=" | "<="; px: number; note: string; createdAt: number };
const LV: Record<number, [string, string]> = { 3: ["严重", "#f87171"], 2: ["警告", "#fbbf24"], 1: ["提示", "#38bdf8"] };

export function LiveAlerts() {
  const [tab, setTab] = useState("live");
  const extra = ["^VIX3M", "^IRX", "^TNX"];
  const all = [...WL.map((w) => w[0]), ...extra];
  const pack = useCloses(all, 300);
  const ticks = useTicks(all);
  const { pick } = useHub();
  const saved = useSaved<MyAlert[]>("pricing.alerts");
  const [mine, setMine] = useState<MyAlert[] | null>(null);
  useEffect(() => { if (!saved.loading && mine == null) setMine(saved.data ?? []); }, [saved.loading]);
  const myTicks = useTicks((mine ?? []).map((m) => m.symbol));
  const [ns, setNs] = useState("sh600519"); const [op, setOp] = useState<">=" | "<=">(">="); const [px, setPx] = useState<number | "">(""); const [note, setNote] = useState("");
  const persist = (next: MyAlert[]) => { setMine(next); void saveItem("pricing.alerts", next); };
  const metrics = useMemo(() => WL.map(([s, l, cat]) => {
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    const t = ticks[s];
    const r = sret(c);
    const s20 = r.length > 21 ? sd(r.slice(-20)) * 100 : null;
    const px0 = t?.price ?? c[c.length - 1];
    const hist = c.slice(-253, -1);
    const hi = hist.length ? Math.max(...hist) : null, lo = hist.length ? Math.min(...hist) : null;
    const ma200 = c.length >= 200 ? avg(c.slice(-200)) : null;
    const prev = t?.prevClose ?? c[c.length - 2];
    const r5 = c.length > 6 && px0 ? px0 / c[c.length - 6] - 1 : null;
    return { s, l, cat, t, z: s20 && t?.changePct != null ? t.changePct / s20 : null, s20, hi, lo, ma200, prev, px: px0, r5, fromHi: hi && px0 ? px0 / hi - 1 : null, fromLo: lo && px0 ? px0 / lo - 1 : null, vsMa: ma200 && px0 ? px0 / ma200 - 1 : null };
  }), [pack.data, ticks]);
  const alerts = useMemo(() => {
    const out: Alert[] = [];
    for (const m of metrics) {
      if (m.z != null && Math.abs(m.z) >= 2) out.push({ lv: Math.abs(m.z) >= 3 ? 3 : 2, sym: m.s, cat: "价格异动", msg: `${m.l} 单日${m.z > 0 ? "上涨" : "下跌"}达 ${Math.abs(m.z).toFixed(1)} 倍日波动`, val: fmtPct(m.t?.changePct) });
      if (m.hi && m.px && m.px >= m.hi) out.push({ lv: 2, sym: m.s, cat: "突破", msg: `${m.l} 创近一年新高`, val: fmtPrice(m.px) });
      if (m.lo && m.px && m.px <= m.lo) out.push({ lv: 2, sym: m.s, cat: "突破", msg: `${m.l} 创近一年新低`, val: fmtPrice(m.px) });
      if (m.ma200 && m.prev && m.px && (m.prev - m.ma200) * (m.px - m.ma200) < 0) out.push({ lv: 1, sym: m.s, cat: "趋势", msg: `${m.l} ${m.px > m.ma200 ? "上穿" : "下穿"} 200 日均线`, val: fmtPrice(m.ma200) });
      if (m.r5 != null && m.s20 && Math.abs(m.r5 * 100) >= 2 * m.s20 * Math.sqrt(5)) out.push({ lv: 1, sym: m.s, cat: "趋势", msg: `${m.l} 5 日累计${m.r5 > 0 ? "上涨" : "下跌"}显著`, val: pct(m.r5) });
    }
    const vix = ticks["^VIX"]?.price, v3 = ticks["^VIX3M"]?.price, tnx = ticks["^TNX"]?.price, irx = ticks["^IRX"]?.price;
    if (vix != null) { if (vix >= 30) out.push({ lv: 3, sym: "^VIX", cat: "波动率", msg: "股市波动率指数高于 30：恐慌区间", val: vix.toFixed(2) }); else if (vix >= 20) out.push({ lv: 2, sym: "^VIX", cat: "波动率", msg: "股市波动率指数高于 20：紧张区间", val: vix.toFixed(2) }); }
    if (vix && v3 && vix / v3 > 1) out.push({ lv: 2, sym: "^VIX3M", cat: "波动率", msg: "波动率期限结构倒挂（1月 > 3月）", val: (vix / v3).toFixed(3) });
    if (tnx != null && irx != null && tnx - irx < 0) out.push({ lv: 1, sym: "^TNX", cat: "利率", msg: "10年−3月美债利差倒挂", val: `${((tnx - irx) * 100).toFixed(0)} 基点` });
    const hyg = metrics.find((m) => m.s === "HYG");
    if (hyg?.r5 != null && hyg.r5 <= -0.02) out.push({ lv: 2, sym: "HYG", cat: "信用", msg: "高收益债 5 日下跌超过 2%：信用压力", val: pct(hyg.r5) });
    const cnh = metrics.find((m) => m.s === "USDCNH");
    if (cnh?.r5 != null && Math.abs(cnh.r5) >= 0.01) out.push({ lv: 1, sym: "USDCNH", cat: "外汇", msg: `离岸人民币 5 日${cnh.r5 > 0 ? "贬值" : "升值"}超过 1%`, val: pct(cnh.r5) });
    return out.sort((a, b) => b.lv - a.lv);
  }, [metrics, ticks]);
  const cats = Object.entries(alerts.reduce<Record<string, number>>((a, x) => { a[x.cat] = (a[x.cat] ?? 0) + 1; return a; }, {}));
  const trig = (m: MyAlert, t: Tick | null | undefined) => (t?.price == null ? null : m.op === ">=" ? t.price >= m.px : t.price <= m.px);
  const firedMine = (mine ?? []).filter((m) => trig(m, myTicks[m.symbol])).length;
  return (
    <PanelShell code="ALT" title="智能预警（规则引擎，实时计算）" tabs={[["live", `触发中（${alerts.length}）`], ["matrix", "规则矩阵"], ["mine", `我的价格提醒（${firedMine}/${mine?.length ?? 0}）`]]} tab={tab} setTab={setTab} right={<span>严重 {alerts.filter((a) => a.lv === 3).length} · 警告 {alerts.filter((a) => a.lv === 2).length} · 提示 {alerts.filter((a) => a.lv === 1).length}</span>}>
      {tab === "live" && <>
        <Kpis items={[["触发规则", String(alerts.length), `覆盖 ${WL.length} 个标的 + 宏观规则`], ...cats.slice(0, 3).map(([k, v]) => [k, String(v), "条"] as [string, string, string])]} />
        <table className="w-full text-[11px]">
          <thead className={TH}><tr><th className="px-2 py-1 text-left">级别</th><th className="text-left">类别</th><th className="text-left">预警内容</th><th className="px-2 text-right">当前值</th></tr></thead>
          <tbody>{alerts.map((a, i) => <tr key={i} onClick={() => pick(a.sym)} className={`${TR} cursor-pointer hover:bg-[#0a1726]`}><td className="px-2 py-0.5" style={{ color: LV[a.lv][1] }}>● {LV[a.lv][0]}</td><td className="text-slate-400">{a.cat}</td><td className="text-slate-100">{a.msg}</td><td className="px-2 text-right font-mono text-slate-200">{a.val}</td></tr>)}{!alerts.length && <tr><td colSpan={4}><Empty loading={pack.loading} text="当前没有规则被触发" /></td></tr>}</tbody>
        </table>
        <Note>规则：单日涨跌 ≥ 2 倍近 20 日日波动（≥3 倍为严重）；突破近一年高 / 低点；穿越 200 日均线；5 日累计涨跌显著；股市波动率 ≥ 20 / 30；波动率期限倒挂；10年−3月利差倒挂；高收益债 5 日跌超 2%；离岸人民币 5 日波动超 1%。</Note>
      </>}
      {tab === "matrix" && <>
        <SectionHead title="各标的规则指标（红 / 绿越深越接近触发）" />
        <table className="w-full text-[11px]">
          <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">类别</th><th className="text-right">最新</th><th className="text-right">涨跌幅</th><th className="text-right">异动倍数</th><th className="text-right">距一年高点</th><th className="text-right">距一年低点</th><th className="text-right">相对 200 日线</th><th className="px-2 text-right">5 日</th></tr></thead>
          <tbody>{metrics.map((m) => <tr key={m.s} onClick={() => pick(m.s)} className={`${TR} cursor-pointer hover:bg-[#0a1726]`}><td className="px-2 py-0.5 text-slate-100">{m.l}</td><td className="text-slate-500">{m.cat}</td><td className="text-right font-mono text-white">{fmtPrice(m.px)}</td><td className="text-right font-mono" style={{ color: toneOf(m.t?.changePct) }}>{fmtPct(m.t?.changePct)}</td><td className="text-right font-mono" style={{ background: heat(m.z, 3) }}>{f2(m.z, 2)}</td><td className="text-right font-mono" style={{ background: heat(m.fromHi != null ? (m.fromHi + 0.05) * 100 : null, 5) }}>{pct(m.fromHi, 1)}</td><td className="text-right font-mono" style={{ background: heat(m.fromLo != null ? -(0.05 - m.fromLo) * 100 : null, 5) }}>{pct(m.fromLo, 1)}</td><td className="text-right font-mono" style={{ color: toneOf(m.vsMa) }}>{pct(m.vsMa, 1)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(m.r5) }}>{pct(m.r5, 2)}</td></tr>)}</tbody>
        </table>
      </>}
      {tab === "mine" && <>
        <form onSubmit={(e) => { e.preventDefault(); if (!ns.trim() || px === "") return; persist([...(mine ?? []), { id: `${Date.now()}`, symbol: ns.trim(), op, px: Number(px), note: note.trim(), createdAt: Date.now() }]); setPx(""); setNote(""); }} className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1 text-[11px]">
          <span className="text-slate-400">标的</span><input value={ns} onChange={(e) => setNs(e.target.value)} className="w-28 border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white" />
          <Seg value={op} options={[[">=", "价格 ≥"], ["<=", "价格 ≤"]]} onChange={setOp} />
          <input type="number" step="any" value={px} onChange={(e) => setPx(e.target.value === "" ? "" : Number(e.target.value))} placeholder="目标价" className="w-24 border border-[#1d3047] bg-[#07111c] px-1 font-mono text-white" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" className="w-40 border border-[#1d3047] bg-[#07111c] px-1 text-white" />
          <button className="border border-cyan-700 px-2 text-cyan-200">添加提醒</button>
          <span className="ml-auto text-[10px] text-slate-500">提醒永久保存在平台数据库，打开本页即按实时行情判断</span>
        </form>
        <table className="w-full text-[11px]">
          <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">条件</th><th className="text-right">最新价</th><th className="text-right">距离</th><th className="text-left pl-2">状态</th><th className="text-left">备注</th><th className="text-left">创建</th><th className="px-2" /></tr></thead>
          <tbody>{(mine ?? []).map((m) => { const t = myTicks[m.symbol]; const f = trig(m, t); return <tr key={m.id} className={TR}><td className="cursor-pointer px-2 py-0.5 text-slate-100" onClick={() => pick(m.symbol)}>{t?.name ?? nm(m.symbol)}<span className="ml-1 font-mono text-[9px] text-slate-600">{m.symbol}</span></td><td className="font-mono text-slate-300">{m.op === ">=" ? "≥" : "≤"} {m.px}</td><td className="text-right font-mono text-white">{fmtPrice(t?.price)}</td><td className="text-right font-mono text-slate-400">{t?.price ? pct(m.px / t.price - 1) : "—"}</td><td className="pl-2" style={{ color: f ? "#f87171" : "#64748b" }}>{f == null ? "等待行情" : f ? "● 已触发" : "未触发"}</td><td className="text-slate-400">{m.note}</td><td className="font-mono text-[10px] text-slate-500">{fmtTs(m.createdAt)}</td><td className="px-2 text-right"><button type="button" onClick={() => persist((mine ?? []).filter((x) => x.id !== m.id))} className="text-[10px] text-slate-500 hover:text-red-300">删除</button></td></tr>; })}{!(mine ?? []).length && <tr><td colSpan={8}><Empty loading={saved.loading} text="还没有价格提醒" /></td></tr>}</tbody>
        </table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== ANN 公告情报 */
type SecFiling = { form: string; label: string; date: string; reportDate: string | null; description: string | null; url: string };
type Edgar = { total: number; rows: Array<{ id: string; company: string; ticker: string | null; form: string; date: string; items: string[]; url: string }> };
const EDQ: Array<[string, string, string]> = [["agree", "重大合同", '"material definitive agreement"'], ["officer", "高管变动", '"departure of directors" OR "appointment of certain officers"'], ["restate", "财报不可依赖", '"non-reliance on previously issued financial statements"'], ["acq", "并购完成", '"completion of acquisition or disposition of assets"'], ["guid", "业绩披露", '"results of operations and financial condition"']];

function EventStudy({ sym, filings }: { sym: string; filings: SecFiling[] }) {
  const pack = useCloses([sym, "SPY"], 1300);
  const rows = useMemo(() => {
    const a = (pack.data?.[sym] ?? []).map(([t, c]) => [dayKey(t), c] as [string, number]);
    const b = new Map((pack.data?.SPY ?? []).map(([t, c]) => [dayKey(t), c]));
    if (a.length < 30) return [];
    return filings.filter((f) => /^(10-K|10-Q|8-K)$/.test(f.form)).map((f) => {
      const i0 = a.findIndex(([d]) => d >= f.date);
      if (i0 < 1) return null;
      const pre = a[i0 - 1];
      const at = (k: number) => a[Math.min(a.length - 1, i0 + k)];
      const ex = (k: number) => { const x = at(k); if (i0 + k >= a.length) return null; const bp = b.get(pre[0]), bx = b.get(x[0]); const r = x[1] / pre[1] - 1; return { r, ex: bp && bx ? r - (bx / bp - 1) : null }; };
      return { f, d1: ex(0), d5: ex(4) };
    }).filter((x): x is NonNullable<typeof x> => !!x);
  }, [pack.data, filings, sym]);
  const by = ["10-K", "10-Q", "8-K"].map((form) => { const xs = rows.filter((r) => r.f.form === form); const e = xs.map((x) => x.d1?.ex).filter((v): v is number => v != null); return { form, n: xs.length, avg: e.length ? avg(e) : null, absAvg: e.length ? avg(e.map(Math.abs)) : null, up: e.filter((v) => v > 0).length }; });
  return (
    <>
      <SectionHead title="公告事件研究：披露后股价反应（相对标普500超额）" />
      <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">类型</th><th className="text-right">样本</th><th className="text-right">首日平均超额</th><th className="text-right">首日平均绝对超额</th><th className="px-2 text-right">首日超额为正</th></tr></thead>
        <tbody>{by.map((b) => <tr key={b.form} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{b.form}</td><td className="text-right font-mono text-slate-400">{b.n}</td><td className="text-right font-mono" style={{ color: toneOf(b.avg) }}>{pct(b.avg)}</td><td className="text-right font-mono text-amber-200">{pct(b.absAvg)}</td><td className="px-2 text-right font-mono text-slate-300">{b.n ? `${b.up}/${b.n}` : "—"}</td></tr>)}</tbody></table>
      <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">披露日</th><th className="text-left">类型</th><th className="text-left">说明</th><th className="text-right">首日涨跌</th><th className="text-right">首日超额</th><th className="text-right">5 日涨跌</th><th className="px-2 text-right">5 日超额</th></tr></thead>
        <tbody>{rows.slice(0, 40).map((r, i) => <tr key={i} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{r.f.date}</td><td className="font-mono text-cyan-200">{r.f.form}</td><td className="text-slate-400">{r.f.label}</td><td className="text-right font-mono" style={{ color: toneOf(r.d1?.r) }}>{pct(r.d1?.r)}</td><td className="text-right font-mono" style={{ background: heat(r.d1?.ex != null ? r.d1.ex * 100 : null, 5) }}>{pct(r.d1?.ex)}</td><td className="text-right font-mono" style={{ color: toneOf(r.d5?.r) }}>{pct(r.d5?.r)}</td><td className="px-2 text-right font-mono" style={{ background: heat(r.d5?.ex != null ? r.d5.ex * 100 : null, 8) }}>{pct(r.d5?.ex)}</td></tr>)}{!rows.length && <tr><td colSpan={7}><Empty loading={pack.loading} /></td></tr>}</tbody></table>
    </>
  );
}

export function LiveAnnouncements() {
  const [tab, setTab] = useState("flow");
  const [cat, setCat] = useState("公司");
  const [sym, setSym] = useState("AAPL");
  const [eq, setEq] = useState("agree");
  const flow = useFeed(tab === "flow" ? { cats: [cat], limit: 120, hours: 48 } : null, 60_000);
  const all = useFeed(tab === "sent" ? { limit: 400, hours: 24 } : null, 120_000);
  const fil = usePolled<{ company: { name: string; ticker: string; industry: string | null; exchange: string | null } | null; filings: SecFiling[] }>("ucNews.filings", tab === "filing" ? { symbol: sym } : null, 1800_000);
  const q = EDQ.find((x) => x[0] === eq)!;
  const ed = usePolled<Edgar>("ucHubs.edgar", tab === "8k" ? { q: q[2], forms: ["8-K"], days: 30 } : null, 1800_000);
  const sent = useMemo(() => {
    const items: News[] = all.items;
    const m = new Map<string, { n: number; pos: number; neg: number; tone: number }>();
    items.forEach((n) => (n.cats.length ? n.cats : ["其他"]).forEach((c) => { const o = m.get(c) ?? { n: 0, pos: 0, neg: 0, tone: 0 }; o.n++; if (n.tone > 0) o.pos++; if (n.tone < 0) o.neg++; o.tone += n.toneScore ?? n.tone; m.set(c, o); }));
    const now = Date.now();
    const hours = Array.from({ length: 24 }, (_, i) => { const from = now - (24 - i) * 3600e3, to = from + 3600e3; const xs = items.filter((n) => n.time >= from && n.time < to); return { k: new Date(to).getHours().toString().padStart(2, "0"), v: xs.length, tone: xs.length ? avg(xs.map((n) => n.tone)) : 0 }; });
    const tick = new Map<string, { n: number; tone: number }>();
    items.forEach((n) => n.tickers.forEach((t) => { const o = tick.get(t) ?? { n: 0, tone: 0 }; o.n++; o.tone += n.tone; tick.set(t, o); }));
    return { cats: [...m.entries()].sort((a, b) => b[1].n - a[1].n), hours, tickers: [...tick.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20), total: items.length, pos: items.filter((n) => n.tone > 0).length, neg: items.filter((n) => n.tone < 0).length };
  }, [all.items]);
  const { pick } = useHub();
  return (
    <PanelShell code="ANN" title="公告与资讯情报" tabs={[["flow", "情报流"], ["sent", "情绪与热度"], ["filing", "公司公告与事件研究"], ["8k", "重大事项检索"]]} tab={tab} setTab={setTab}>
      {tab === "flow" && <>
        <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1"><Seg value={cat} options={["公司", "政策", "央行", "宏观", "IPO", "金融", "地缘", "A股", "港股", "美股"].map((c) => [c, c] as [string, string])} onChange={setCat} /><span className="ml-auto text-[10px] text-slate-500">近 48 小时 · {flow.items.length} 条 · 点击在终端内阅读</span></div>
        <FeedList items={flow.items} loading={flow.loading} />
      </>}
      {tab === "sent" && <>
        <Kpis items={[["24 小时资讯", String(sent.total), "清洗去重后"], ["利好", String(sent.pos), sent.total ? pct(sent.pos / sent.total, 0) : ""], ["利空", String(sent.neg), sent.total ? pct(sent.neg / sent.total, 0) : ""], ["净情绪", sent.total ? sgn(((sent.pos - sent.neg) / sent.total) * 100, 1) : "—"]]} />
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
          <div className="bg-[#03070c]">
            <SectionHead title="按主题：数量与情绪" />
            <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">主题</th><th className="text-right">条数</th><th className="text-right">利好</th><th className="text-right">利空</th><th className="px-2 text-right">净情绪</th></tr></thead>
              <tbody>{sent.cats.map(([k, v]) => { const net = (v.pos - v.neg) / v.n; return <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-100">{k}</td><td className="text-right font-mono text-slate-300">{v.n}</td><td className="text-right font-mono text-red-300">{v.pos}</td><td className="text-right font-mono text-emerald-300">{v.neg}</td><td className="px-2 text-right font-mono" style={{ background: heat(net * 100, 50) }}>{sgn(net * 100, 0)}</td></tr>; })}{!sent.total && <tr><td colSpan={5}><Empty loading={all.loading} /></td></tr>}</tbody></table>
          </div>
          <div className="bg-[#03070c]">
            <SectionHead title="逐小时资讯量（近 24 小时）" />
            <Bars data={sent.hours.map((h) => ({ k: `${h.k}时`, v: h.v }))} height={110} fmt={(v) => String(Math.round(v))} />
            <SectionHead title="最受关注标的" />
            <table className="w-full text-[11px]"><tbody>{sent.tickers.map(([t, v]) => <tr key={t} onClick={() => pick(t)} className={`${TR} cursor-pointer hover:bg-[#0a1726]`}><td className="px-2 py-0.5 text-slate-100">{nm(t)}<span className="ml-1 font-mono text-[9px] text-slate-600">{t}</span></td><td className="text-right font-mono text-slate-300">{v.n} 条</td><td className="px-2 text-right font-mono" style={{ color: toneOf(v.tone) }}>{v.tone > 0 ? "偏利好" : v.tone < 0 ? "偏利空" : "中性"}</td></tr>)}</tbody></table>
          </div>
        </div>
      </>}
      {tab === "filing" && <>
        <SymInput value={sym} onChange={setSym} quick={[["AAPL", "苹果"], ["MSFT", "微软"], ["NVDA", "英伟达"], ["TSLA", "特斯拉"], ["JPM", "摩根大通"], ["BABA", "阿里巴巴"]]} />
        {fil.data?.company && <div className="border-b border-[#1a2a3c] px-2 py-1 text-[11px] text-slate-300">{fil.data.company.name}<span className="ml-2 text-slate-500">{fil.data.company.industry ?? ""} {fil.data.company.exchange ?? ""}</span></div>}
        <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title="最新公告" sub="点击在终端内阅读" /><DocList loading={fil.loading} empty="未找到该公司的披露（仅支持美国上市公司）" rows={(fil.data?.filings ?? []).slice(0, 60).map((f, i) => ({ id: `${sym}-${i}-${f.date}`, title: `${f.label}${f.description ? ` · ${f.description}` : ""}`, sub: f.reportDate ? `报告期 ${f.reportDate}` : undefined, date: f.date, url: f.url, tag: f.form }))} /></div>
          <div className="bg-[#03070c]">{fil.data?.filings?.length ? <EventStudy sym={sym} filings={fil.data.filings} /> : <Empty loading={fil.loading} />}</div>
        </div>
      </>}
      {tab === "8k" && <>
        <div className="flex flex-wrap items-center gap-1 border-b border-[#1a2a3c] px-2 py-1"><Seg value={eq} options={EDQ.map(([k, l]) => [k, l] as [string, string])} onChange={setEq} /><span className="ml-auto text-[10px] text-slate-500">近 30 天 8-K 全文检索 · {ed.data?.total ?? "—"} 份</span></div>
        <DocList loading={ed.loading} rows={(ed.data?.rows ?? []).map((r) => ({ id: r.id, title: `${r.company}${r.ticker ? `（${r.ticker}）` : ""}`, sub: r.items.length ? `事项 ${r.items.join(", ")}` : undefined, date: r.date, url: r.url, tag: r.form }))} />
      </>}
    </PanelShell>
  );
}

/* ================================================================== AUD 定价审计 */
type Plat = { uptimeSec: number; node: string; cpus: number; load: number[]; sysMemTotal: number; sysMemFree: number; rss: number; heapUsed: number; heapTotal: number; streamClients: number; cacheEntries: number; warehouse: { news: number; kline: number; ticks: number; klineSymbols: number; partitions: Record<string, string> } | null; feeds: { total: number; online: number; items: number }; lines: Array<{ line: string; ok: boolean; lastOkSec: number | null; fails: number }>; procs: Array<{ name: string; area: string; n: number; err: number; avg: number; max: number; lastSec: number }>; areas: Array<{ area: string; n: number; err: number; avg: number }>; perMinute: number[]; warm: Array<{ at: number; label: string; symbols: number; ms: number; ticks: number }> };
const AUD_SYMS: Array<[string, string]> = [["sh600519", "A股"], ["sz000001", "A股"], ["sh510300", "A股"], ["sh000300", "A股"], ["0700.HK", "港股"], ["2800.HK", "港股"], ["AAPL", "美股"], ["SPY", "美股"], ["^GSPC", "美股"], ["^TNX", "利率"], ["^VIX", "波动率"], ["CL", "期货"], ["GC", "期货"], ["ES", "期货"], ["EURUSD", "外汇"], ["USDCNH", "外汇"], ["USDJPY", "外汇"], ["BTC", "加密"], ["7203.T", "其他市场"]];

export function LiveAudit() {
  const [tab, setTab] = useState("quote");
  const syms = AUD_SYMS.map((x) => x[0]);
  const ticks = useTicks(syms);
  const pack = useCloses(syms, 30);
  const plat = usePolled<Plat>("ucHubs.platform", tab === "api" ? {} : null, 15_000);
  const ev = useEvents();
  const od = useOrders();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  const checks = syms.map((s) => {
    const t = ticks[s];
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    const ok1 = t ? t.price > 0 && Number.isFinite(t.price) : null;
    const ok2 = t && t.high != null && t.low != null && t.high > 0 ? t.price <= t.high * 1.0001 && t.price >= t.low * 0.9999 && t.low <= t.high : null;
    const ok3 = t && t.prevClose && t.change != null ? Math.abs(t.price - t.prevClose - t.change) <= Math.max(1e-6, t.price * 2e-4) : null;
    const ok4 = t && t.prevClose && t.changePct != null ? Math.abs(((t.price / t.prevClose - 1) * 100) - t.changePct) < 0.05 : null;
    const devs = t?.prevClose ? c.slice(-2).map((v) => Math.abs(v / t.prevClose! - 1) * 1e4) : [];
    const dev = devs.length ? Math.min(...devs) : null;
    const ok5 = dev == null ? null : dev < 10;
    const age = t?.time ? (now - t.time) / 1000 : null;
    const pass = [ok1, ok2, ok3, ok4, ok5].filter((x) => x === true).length, tot = [ok1, ok2, ok3, ok4, ok5].filter((x) => x != null).length;
    return { s, t, ok1, ok2, ok3, ok4, ok5, dev, age, pass, tot };
  });
  const allPass = checks.reduce((a, x) => a + x.pass, 0), allTot = checks.reduce((a, x) => a + x.tot, 0);
  const mark = (v: boolean | null) => <span style={{ color: v == null ? "#475569" : v ? "#34d399" : "#f87171" }}>{v == null ? "—" : v ? "通过" : "异常"}</span>;
  const evs = ev.data ?? [];
  const kinds = Object.entries(evs.reduce<Record<string, number>>((a, e) => { a[e.kind] = (a[e.kind] ?? 0) + 1; return a; }, {}));
  const rej = (od.data ?? []).filter((o) => o.status === "REJECTED");
  const procs = [...(plat.data?.procs ?? [])].sort((a, b) => b.max - a.max);
  return (
    <PanelShell code="AUD" title="定价审计：报价校验、接口时延与操作留痕" tabs={[["quote", "报价一致性校验"], ["api", "接口时延审计"], ["trail", "交易操作留痕"]]} tab={tab} setTab={setTab} right={<span>校验通过率 <b className="font-mono text-emerald-300">{allTot ? pct(allPass / allTot, 1) : "—"}</b></span>}>
      {tab === "quote" && <>
        <SectionHead title="逐标的报价校验" />
        <table className="w-full text-[11px]">
          <thead className={TH}><tr><th className="px-2 py-1 text-left">标的</th><th className="text-left">市场</th><th className="text-right">现价</th><th className="text-right">昨收</th><th className="text-center">①</th><th className="text-center">②</th><th className="text-center">③</th><th className="text-center">④</th><th className="text-center">⑤</th><th className="text-right">昨收偏差</th><th className="text-right">报价时间</th><th className="px-2 text-right">报价龄</th></tr></thead>
          <tbody>{checks.map((x, i) => <tr key={x.s} className={TR}><td className="px-2 py-0.5 text-slate-100">{x.t?.name ?? nm(x.s)}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.s}</span></td><td className="text-slate-500">{AUD_SYMS[i][1]}</td><td className="text-right font-mono text-white">{fmtPrice(x.t?.price)}</td><td className="text-right font-mono text-slate-400">{fmtPrice(x.t?.prevClose)}</td><td className="text-center">{mark(x.ok1)}</td><td className="text-center">{mark(x.ok2)}</td><td className="text-center">{mark(x.ok3)}</td><td className="text-center">{mark(x.ok4)}</td><td className="text-center">{mark(x.ok5)}</td><td className="text-right font-mono text-slate-400">{x.dev == null ? "—" : `${x.dev.toFixed(1)}`}</td><td className="text-right font-mono text-[10px] text-slate-500">{x.t?.time ? fmtTs(x.t.time) : "—"}</td><td className="px-2 text-right font-mono" style={{ color: x.age == null ? undefined : x.age < 60 ? "#34d399" : x.age < 900 ? "#fbbf24" : "#64748b" }}>{x.age == null ? "—" : x.age < 60 ? `${x.age.toFixed(0)} 秒` : x.age < 3600 ? `${(x.age / 60).toFixed(0)} 分` : `${(x.age / 3600).toFixed(1)} 小时`}</td></tr>)}</tbody>
        </table>
        <Note>报价龄 &gt; 15 分钟通常对应休市；交易时段内的长报价龄或校验异常会被标红，应在定价前人工复核。</Note>
      </>}
      {tab === "api" && <>
        <Kpis items={[["接口种类", String(plat.data?.procs.length ?? "—"), "近一次重启以来"], ["累计调用", fmtCompact(plat.data?.procs.reduce((a, p) => a + p.n, 0)), ""], ["错误率", plat.data ? pct(plat.data.procs.reduce((a, p) => a + p.err, 0) / Math.max(1, plat.data.procs.reduce((a, p) => a + p.n, 0)), 2) : "—"], ["超时风险接口", String(procs.filter((p) => p.avg > 3000).length), "平均耗时 > 3 秒"]]} />
        <table className="w-full text-[11px]">
          <thead className={TH}><tr><th className="px-2 py-1 text-left">接口</th><th className="text-left">领域</th><th className="text-right">调用次数</th><th className="text-right">平均耗时</th><th className="text-right">最大耗时</th><th className="text-right">错误</th><th className="text-right">错误率</th><th className="text-right">最近调用</th><th className="px-2 text-left">评级</th></tr></thead>
          <tbody>{procs.map((p) => { const er = p.n ? p.err / p.n : 0; const g = er > 0.1 || p.avg > 5000 ? ["不达标", "#f87171"] : er > 0.02 || p.avg > 2000 ? ["关注", "#fbbf24"] : ["达标", "#34d399"]; return <tr key={p.name} className={TR}><td className="px-2 py-0.5 font-mono text-slate-200">{p.name}</td><td className="text-slate-400">{p.area}</td><td className="text-right font-mono text-slate-300">{p.n}</td><td className="text-right font-mono" style={{ background: heat(p.avg / 100 - 10, 30) }}>{p.avg.toFixed(0)} 毫秒</td><td className="text-right font-mono text-slate-400">{p.max.toFixed(0)}</td><td className="text-right font-mono text-slate-400">{p.err}</td><td className="text-right font-mono text-slate-300">{pct(er, 1)}</td><td className="text-right font-mono text-slate-500">{p.lastSec} 秒前</td><td className="px-2" style={{ color: g[1] }}>{g[0]}</td></tr>; })}{!plat.data && <tr><td colSpan={9}><Empty loading={plat.loading} /></td></tr>}</tbody>
        </table>
        <Note>评级标准：平均耗时 ≤ 2 秒且错误率 ≤ 2% 为达标；平均耗时 &gt; 5 秒或错误率 &gt; 10% 为不达标。按最大耗时排序。</Note>
      </>}
      {tab === "trail" && <>
        <Kpis items={[["事件总数", String(evs.length), "平台模拟账户"], ...kinds.slice(0, 2).map(([k, v]) => [KIND_ZH[k] ?? k, String(v), "条"] as [string, string, string]), ["拒单", String(rej.length), rej.length ? "见下方原因" : "无"]]} />
        <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="bg-[#03070c]"><SectionHead title="委托 / 成交 / 撤单事件流水（不可篡改，按时间倒序）" /><EventsList rows={evs} /></div>
          <div className="bg-[#03070c]"><SectionHead title="拒单原因审计" /><table className="w-full text-[11px]"><tbody>{rej.map((o) => <tr key={o.id} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-slate-500">{fmtTs(o.createdAt)}</td><td className="text-slate-200">{o.symbol} {o.side === "B" ? "买" : "卖"} {o.qty}</td><td className="px-2 text-red-300">{o.reject ?? STATUS_ZH[o.status]}</td></tr>)}{!rej.length && <tr><td><Empty text="没有拒单记录" /></td></tr>}</tbody></table></div>
        </div>
      </>}
    </PanelShell>
  );
}

/* ================================================================== INT 系统集成 */
export function LiveIntegration() {
  const [tab, setTab] = useState("ov");
  const plat = usePolled<Plat>("ucHubs.platform", {}, 10_000);
  const [lat, setLat] = useState<Array<{ at: number; ms: number; ok: boolean }>>([]);
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const t0 = performance.now();
      let ok = true;
      try { await ucGet("ucMarket.ticks", { symbols: ["SPY", "sh000300", "EURUSD"] }, AbortSignal.timeout(15000)); } catch { ok = false; }
      if (alive) setLat((l) => [...l.slice(-59), { at: Date.now(), ms: performance.now() - t0, ok }]);
    };
    void ping();
    const t = setInterval(() => void ping(), 10_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const d = plat.data;
  const okLat = lat.filter((x) => x.ok).map((x) => x.ms);
  const up = d ? `${Math.floor(d.uptimeSec / 86400)}天${Math.floor((d.uptimeSec % 86400) / 3600)}时${Math.floor((d.uptimeSec % 3600) / 60)}分` : "—";
  return (
    <PanelShell code="INT" title="系统集成：数据线路、吞吐与端到端延迟" tabs={[["ov", "运行总览"], ["lines", "行情线路"], ["store", "数据仓库与资讯源"], ["lat", "端到端延迟"]]} tab={tab} setTab={setTab} right={d ? <span>已运行 {up}</span> : null}>
      <Kpis items={[["实时推送连接", String(d?.streamClients ?? "—"), "行情推送长连接"], ["行情线路", d ? `${d.lines.filter((l) => l.ok).length}/${d.lines.length} 正常` : "—"], ["资讯源在线", d ? `${d.feeds.online}/${d.feeds.total}` : "—", d ? `累计 ${fmtCompact(d.feeds.items)} 条` : ""], ["端到端延迟（中位）", okLat.length ? `${(quantile(okLat, 0.5) ?? 0).toFixed(0)} 毫秒` : "—", okLat.length ? `95分位 ${(quantile(okLat, 0.95) ?? 0).toFixed(0)} 毫秒` : "本页每 10 秒实测"]]} />
      {!d && <Empty loading={plat.loading} />}
      {d && tab === "ov" && <>
        <SectionHead title="近 60 分钟接口调用量（次/分钟）" />
        <Bars data={d.perMinute.map((v, i) => ({ k: `${i - 59}分`, v }))} height={120} fmt={(v) => String(Math.round(v))} />
        <SectionHead title="按领域汇总" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">领域</th><th className="text-right">调用</th><th className="text-right">平均耗时</th><th className="text-right">错误</th><th className="px-2 text-right">可用率</th></tr></thead>
          <tbody>{d.areas.map((a) => <tr key={a.area} className={TR}><td className="px-2 py-0.5 text-slate-100">{a.area}</td><td className="text-right font-mono text-slate-300">{fmtCompact(a.n)}</td><td className="text-right font-mono text-slate-300">{a.avg.toFixed(0)} 毫秒</td><td className="text-right font-mono text-slate-400">{a.err}</td><td className="px-2 text-right font-mono" style={{ color: a.n && a.err / a.n > 0.05 ? "#f87171" : "#34d399" }}>{a.n ? pct(1 - a.err / a.n, 2) : "—"}</td></tr>)}</tbody></table>
        <SectionHead title="服务资源" />
        <table className="w-full text-[11px]"><tbody>{([["处理器核数", String(d.cpus)], ["系统负载（1/5/15 分钟）", d.load.map((x) => x.toFixed(2)).join(" / ")], ["系统内存使用", pct(1 - d.sysMemFree / d.sysMemTotal, 1)], ["服务常驻内存", `${(d.rss / 1048576).toFixed(0)} MB`], ["堆内存", `${(d.heapUsed / 1048576).toFixed(0)} / ${(d.heapTotal / 1048576).toFixed(0)} MB`], ["缓存条目", fmtCompact(d.cacheEntries)], ["运行时", d.node]] as Array<[string, string]>).map(([k, v]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-400">{k}</td><td className="px-2 text-right font-mono text-slate-100">{v}</td></tr>)}</tbody></table>
      </>}
      {d && tab === "lines" && <>
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">线路</th><th className="text-left">状态</th><th className="text-right">距上次成功</th><th className="px-2 text-right">连续失败</th></tr></thead>
          <tbody>{d.lines.map((l) => <tr key={l.line} className={TR}><td className="px-2 py-0.5 text-slate-100">{l.line}</td><td style={{ color: l.ok ? "#34d399" : "#f87171" }}>{l.ok ? "● 正常" : "● 暂停（自动切换备用线路）"}</td><td className="text-right font-mono text-slate-300">{l.lastOkSec == null ? "—" : `${l.lastOkSec} 秒`}</td><td className="px-2 text-right font-mono text-slate-400">{l.fails}</td></tr>)}</tbody></table>
        <SectionHead title="热点行情预热记录" />
        <table className="w-full text-[11px]"><thead className={TH}><tr><th className="px-2 py-1 text-left">时间</th><th className="text-left">批次</th><th className="text-right">标的数</th><th className="text-right">成功报价</th><th className="text-right">成功率</th><th className="px-2 text-right">耗时</th></tr></thead>
          <tbody>{d.warm.map((w) => <tr key={w.at} className={TR}><td className="px-2 py-0.5 font-mono text-[10px] text-slate-500">{fmtTs(w.at)}</td><td className="text-slate-300">{w.label}</td><td className="text-right font-mono text-slate-300">{w.symbols}</td><td className="text-right font-mono text-slate-300">{w.ticks}</td><td className="text-right font-mono" style={{ color: w.symbols && w.ticks / w.symbols < 0.8 ? "#fbbf24" : "#34d399" }}>{w.symbols ? pct(w.ticks / w.symbols, 0) : "—"}</td><td className="px-2 text-right font-mono text-slate-400">{(w.ms / 1000).toFixed(1)} 秒</td></tr>)}{!d.warm.length && <tr><td colSpan={6}><Empty text="暂无预热记录" /></td></tr>}</tbody></table>
      </>}
      {d && tab === "store" && <>
        <Kpis items={[["K 线记录", fmtCompact(d.warehouse?.kline), `${d.warehouse?.klineSymbols ?? "—"} 个标的`], ["分钟行情记录", fmtCompact(d.warehouse?.ticks)], ["资讯入库", fmtCompact(d.warehouse?.news)], ["资讯源", `${d.feeds.online}/${d.feeds.total} 在线`, "3 小时内有成功抓取"]]} />
        <SectionHead title="分区维护状态" />
        <table className="w-full text-[11px]"><tbody>{Object.entries(d.warehouse?.partitions ?? {}).map(([k, v]) => <tr key={k} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{k}</td><td className="px-2 text-slate-400">{v}</td></tr>)}{!Object.keys(d.warehouse?.partitions ?? {}).length && <tr><td><Empty text="暂无分区信息" /></td></tr>}</tbody></table>
        <Note>K 线按年分区、分钟行情按日分区，只新增分区、不删除历史数据；平台自有时间序列（隐波、利率等）逐日累积。</Note>
      </>}
      {tab === "lat" && <>
        <SectionHead title="浏览器 → 平台 → 行情 的往返延迟（毫秒，每 10 秒实测一次）" />
        <Lines series={[{ name: "往返延迟", color: "#22d3ee", values: lat.map((x) => (x.ok ? x.ms : null)) }]} xLabels={lat.map((x) => new Date(x.at).toLocaleTimeString("zh-CN", { hour12: false }))} height={180} fmt={(v) => v.toFixed(0)} />
        <table className="w-full text-[11px]"><tbody>{([["样本数", String(lat.length)], ["失败次数", String(lat.filter((x) => !x.ok).length)], ["最小", okLat.length ? `${Math.min(...okLat).toFixed(0)} 毫秒` : "—"], ["中位", okLat.length ? `${(quantile(okLat, 0.5) ?? 0).toFixed(0)} 毫秒` : "—"], ["95 分位", okLat.length ? `${(quantile(okLat, 0.95) ?? 0).toFixed(0)} 毫秒` : "—"], ["最大", okLat.length ? `${Math.max(...okLat).toFixed(0)} 毫秒` : "—"], ["抖动（标准差）", okLat.length > 2 ? `${sd(okLat).toFixed(0)} 毫秒` : "—"]] as Array<[string, string]>).map(([k, v]) => <tr key={k} className={TR}><td className="px-2 py-0.5 text-slate-400">{k}</td><td className="px-2 text-right font-mono text-slate-100">{v}</td></tr>)}</tbody></table>
        <Note>测量内容：一次三市场（美股 / A股 / 外汇）实时报价请求的完整往返，包含网络、平台处理与报价读取，反映当前终端实际可感知的定价延迟。</Note>
      </>}
    </PanelShell>
  );
}

