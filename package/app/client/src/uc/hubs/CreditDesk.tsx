/**
 * 信用类页面：
 *  - CreditTerminal（/credit-ratings）：信用债看板（投资级 / 高收益 / 贷款 / 新兴市场）· 信用相对国债超额表现 · 评级梯度表现 · 信用新闻
 *  - SovereignDesk（/wcds）：欧洲主权 10 年期收益率与对德利差 · 利差历史 · 主权风险相关市场
 *  - CdsPricer（/cdsw）：信用违约互换估值（以实时美债曲线贴现，危险率模型）
 */
import { useMemo, useState } from "react";
import { fmtPct, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, useHub, type BoardRow } from "./kit";
import { align, annVol, drawdown, f2, heat, perf, sgn, useCloses } from "./calc";

const CREDIT_BOARD: BoardRow[] = [
  ...[["LQD", "投资级公司债"], ["VCIT", "中期投资级公司债"], ["VCSH", "短期投资级公司债"], ["IGLB", "长期投资级公司债"], ["QLTA", "AAA–A 级公司债"]].map(([s, l]) => ({ symbol: s, label: `${l} ETF`, group: "投资级" })),
  ...[["HYG", "高收益债"], ["JNK", "高收益债（二）"], ["SJNK", "短期高收益债"], ["ANGL", "堕落天使债"], ["USHY", "广义高收益债"]].map(([s, l]) => ({ symbol: s, label: `${l} ETF`, group: "高收益" })),
  ...[["BKLN", "优先级贷款"], ["SRLN", "优先级贷款（二）"], ["CWB", "可转债"], ["PFF", "优先股"]].map(([s, l]) => ({ symbol: s, label: `${l} ETF`, group: "贷款 / 可转债 / 优先股" })),
  ...[["EMB", "新兴市场美元主权债"], ["EMHY", "新兴市场高收益债"], ["EMLC", "新兴市场本币债"], ["CEMB", "新兴市场公司债"]].map(([s, l]) => ({ symbol: s, label: `${l} ETF`, group: "新兴市场" })),
  ...[["IEF", "7–10 年美债"], ["IEI", "3–7 年美债"], ["SHY", "1–3 年美债"]].map(([s, l]) => ({ symbol: s, label: `${l} ETF`, group: "对照：国债" })),
];
// 信用 vs 同久期国债：比值走高 = 信用跑赢 = 利差收窄
const PAIRS: Array<[string, string, string, string]> = [["HYG", "IEI", "高收益 / 3–7 年国债", "#f2495c"], ["LQD", "IEF", "投资级 / 7–10 年国债", "#38bdf8"], ["EMB", "IEF", "新兴美元债 / 7–10 年国债", "#fbbf24"], ["BKLN", "SHY", "贷款 / 1–3 年国债", "#a78bfa"], ["ANGL", "IEI", "堕落天使 / 3–7 年国债", "#34d399"]];

function Relative() {
  const syms = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];
  const pack = useCloses(syms, 760);
  const [range, setRange] = useState("250");
  const n = Number(range);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const series = PAIRS.map(([a, b, name, color]) => {
    const r = (m[a] ?? []).map((v, i) => v / m[b][i]).slice(-n);
    const base = r[0];
    return { name, color, a, b, values: r.map((v) => (base ? (v / base - 1) * 100 : null)), raw: r };
  });
  return (
    <div>
      <SectionHead title="信用相对同久期国债的超额表现（%）" right={<Seg value={range} onChange={setRange} options={[["63", "3月"], ["126", "半年"], ["250", "1年"], ["500", "2年"]]} />} />
      <Lines zero series={series.map((s) => ({ name: s.name, color: s.color, values: s.values }))} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={240} fmt={(v) => v.toFixed(1)} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">组合</th><th className="text-right">1周</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="text-right">距区间高点</th><th className="px-2 text-left">信号</th></tr></thead>
        <tbody>
          {series.map((s) => {
            const full = (m[s.a] ?? []).map((v, i) => v / m[s.b][i]);
            const dd = drawdown(full.slice(-n)).now;
            const m1 = perf(full, 21);
            return (
              <tr key={s.name} className="border-t border-[#0f1b29]">
                <td className="px-2 py-1" style={{ color: s.color }}>{s.name}</td>
                {[5, 21, 63, 250].map((k) => { const v = perf(full, k); return <td key={k} className="text-right font-mono" style={{ background: heat(v, k < 30 ? 2 : 6) }}>{sgn(v)}</td>; })}
                <td className="text-right font-mono text-slate-300">{sgn(dd)}</td>
                <td className="px-2 text-[10px]" style={{ color: dd < -3 ? "#1fbf75" : (m1 ?? 0) > 0 ? "#f2495c" : "#94a3b8" }}>{dd < -3 ? "利差明显走阔，避险" : (m1 ?? 0) > 0 ? "利差收窄，风险偏好" : "震荡"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const LADDER: Array<[string, string]> = [["QLTA", "AAA–A"], ["LQD", "投资级综合"], ["ANGL", "堕落天使（BB）"], ["HYG", "高收益综合"], ["SJNK", "短期高收益"], ["EMHY", "新兴高收益"]];
function Ladder() {
  const syms = LADDER.map(([s]) => s);
  const pack = useCloses(syms, 400);
  const ticks = useTicks(syms);
  const rows = syms.map((s, i) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); return { s, l: LADDER[i][1], d1: ticks[s]?.changePct ?? null, m1: perf(c, 21), m3: perf(c, 63), y1: perf(c, 252), vol: annVol(c, 63), dd: c.length ? drawdown(c.slice(-252)).max : null }; });
  return (
    <div>
      <SectionHead title="评级梯度：价格表现与风险" sub="由高评级到低评级排列；低评级跑输高评级通常是信用周期转弱的早期信号" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">评级层级</th><th className="text-left">代表</th><th className="text-right">今日</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">1年</th><th className="text-right">3月波动率</th><th className="px-2 text-right">1年最大回撤</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.s} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-100">{r.l}</td><td className="font-mono text-slate-400">{r.s}</td><td className="text-right font-mono" style={{ color: toneOf(r.d1) }}>{fmtPct(r.d1)}</td>{[r.m1, r.m3, r.y1].map((v, i) => <td key={i} className="text-right font-mono" style={{ background: heat(v, [2, 4, 8][i]) }}>{sgn(v)}</td>)}<td className="text-right font-mono text-slate-300">{f2(r.vol, 1, "%")}</td><td className="px-2 text-right font-mono text-emerald-300">{sgn(r.dd)}</td></tr>)}</tbody>
      </table>
      <Bars data={rows.map((r) => ({ k: r.l, v: r.m3 ?? 0, v2: r.y1 ?? 0 }))} label={["3 个月", "1 年"]} fmt={(v) => `${v.toFixed(2)}%`} height={140} />
    </div>
  );
}

export function CreditTerminal() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "board");
  const feed = useFeed(func === "news" ? { q: "credit OR 信用 OR 违约 OR 评级 OR high yield OR downgrade OR 债务", limit: 150, hours: 96 } : null);
  const t = useTicks(["HYG", "LQD"]);
  return (
    <HubShell title="信用市场" code="CRDT" func={func} setFunc={setFunc}
      funcs={[["board", "CRBD", "信用债看板"], ["rel", "CRSP", "信用相对表现"], ["ladder", "RATG", "评级梯度"], ["news", "CRN", "信用与评级新闻"]]}
      right={<span>高收益 <b className="font-mono" style={{ color: toneOf(t.HYG?.changePct) }}>{fmtPct(t.HYG?.changePct)}</b> · 投资级 <b className="font-mono" style={{ color: toneOf(t.LQD?.changePct) }}>{fmtPct(t.LQD?.changePct)}</b></span>}>
      {func === "board" && <LiveBoard rows={CREDIT_BOARD} />}
      {func === "rel" && <Relative />}
      {func === "ladder" && <Ladder />}
      {func === "news" && <><SectionHead title="信用、违约与评级新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}

/* ================================================================== 欧洲主权利差 */
type Sov = { countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; spread1m: number | null; spread12m: number | null; chg1m: number | null; chg12m: number | null; hist: Array<{ d: string; y: number; s: number | null }> }> };
const SOV_BOARD: BoardRow[] = [
  ...[["EWI", "意大利"], ["EWP", "西班牙"], ["EWG", "德国"], ["EWQ", "法国"], ["EWU", "英国"], ["GREK", "希腊"], ["EWN", "荷兰"], ["EIRL", "爱尔兰"]].map(([s, l]) => ({ symbol: s, label: `${l}股市 ETF`, group: "欧洲国别股市" })),
  ...[["EURUSD", "欧元/美元"], ["EURCHF", "欧元/瑞郎"], ["EURGBP", "欧元/英镑"]].map(([s, l]) => ({ symbol: s, label: l, group: "欧元汇率" })),
  ...[["EUFN", "欧洲金融股 ETF"], ["BNDX", "国际债券（对冲）ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "欧洲金融与债券" })),
];
export function SovereignDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "table");
  const sov = usePolled<Sov>("ucHubs.sovereign", ["table", "hist"].includes(func) ? {} : null, 6 * 3600_000);
  const [sel, setSel] = useState<string[]>(["IT", "FR", "ES", "GR"]);
  const list = sov.data?.countries ?? [];
  const de = list.find((c) => c.code === "DE");
  const feed = useFeed(func === "news" ? { cats: ["欧洲", "债券"], limit: 120, hours: 96 } : null);
  const COLORS = ["#f2495c", "#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#f472b6"];
  const dates = de?.hist.map((h) => h.d) ?? [];
  return (
    <HubShell title="主权信用风险" code="WCDS" func={func} setFunc={setFunc}
      funcs={[["table", "SOVR", "主权利差"], ["hist", "SPRD", "利差历史"], ["board", "EUMK", "相关市场"], ["news", "EUN", "欧洲债务新闻"]]}
      right={de ? <span>德国 10 年 <b className="font-mono text-white">{de.y.toFixed(2)}%</b>（{de.date}）</span> : null}>
      {func === "table" && (
        <div>
          <SectionHead title="欧洲主权 10 年期收益率与对德利差（月度）" sub={de ? `截至 ${de.date}；利差 = 本国 − 德国（bp）` : "读取中…"} />
          <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="overflow-x-auto bg-[#03070c]">
              <table className="w-full text-[11px]">
                <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">国家</th><th className="text-right">10 年收益率</th><th className="text-right">对德利差</th><th className="text-right">利差 1 月变</th><th className="text-right">利差 1 年变</th><th className="text-right">收益率 1 年变</th><th className="px-2 text-center">对比</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.code} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
                      <td className="px-2 py-0.5 text-slate-100">{c.name}<span className="ml-1 font-mono text-[9px] text-slate-500">{c.code}</span></td>
                      <td className="text-right font-mono text-white">{c.y.toFixed(2)}%</td>
                      <td className="text-right font-mono" style={{ background: heat(c.spread, 250) }}>{c.spread == null ? "—" : c.spread}</td>
                      <td className="text-right font-mono" style={{ color: toneOf(c.spread != null && c.spread1m != null ? c.spread - c.spread1m : null) }}>{c.spread != null && c.spread1m != null ? `${c.spread - c.spread1m > 0 ? "+" : ""}${c.spread - c.spread1m}` : "—"}</td>
                      <td className="text-right font-mono" style={{ color: toneOf(c.spread != null && c.spread12m != null ? c.spread - c.spread12m : null) }}>{c.spread != null && c.spread12m != null ? `${c.spread - c.spread12m > 0 ? "+" : ""}${c.spread - c.spread12m}` : "—"}</td>
                      <td className="text-right font-mono" style={{ color: toneOf(c.chg12m) }}>{c.chg12m == null ? "—" : `${c.chg12m > 0 ? "+" : ""}${c.chg12m}bp`}</td>
                      <td className="px-2 text-center"><input type="checkbox" checked={sel.includes(c.code)} onChange={() => setSel((s) => (s.includes(c.code) ? s.filter((x) => x !== c.code) : [...s, c.code].slice(-6)))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-[#03070c]"><SectionHead title="对德利差排行（bp）" /><Bars data={list.filter((c) => c.code !== "DE" && c.spread != null).map((c) => ({ k: c.name, v: c.spread! }))} fmt={(v) => v.toFixed(0)} height={220} /></div>
          </div>
        </div>
      )}
      {func === "hist" && (
        <div>
          <SectionHead title="对德利差历史（bp，近 5 年月度）" sub="在「主权利差」表中勾选国家进行对比" />
          <Lines series={sel.map((code, i) => { const c = list.find((x) => x.code === code); const map = new Map(c?.hist.map((h) => [h.d, h.s]) ?? []); return { name: c?.name ?? code, color: COLORS[i % COLORS.length], values: dates.map((d) => map.get(d) ?? null) }; })} xLabels={dates.map((d) => d.slice(2))} height={240} fmt={(v) => v.toFixed(0)} />
          <SectionHead title="10 年期收益率（%）" />
          <Lines series={[...(de ? [{ name: "德国", color: "#94a3b8", values: de.hist.map((h) => h.y) }] : []), ...sel.map((code, i) => { const c = list.find((x) => x.code === code); const map = new Map(c?.hist.map((h) => [h.d, h.y]) ?? []); return { name: c?.name ?? code, color: COLORS[i % COLORS.length], values: dates.map((d) => map.get(d) ?? null) }; })]} xLabels={dates.map((d) => d.slice(2))} height={200} />
        </div>
      )}
      {func === "board" && <LiveBoard rows={SOV_BOARD} />}
      {func === "news" && <><SectionHead title="欧洲债务与主权新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}

/* ================================================================== CDS 估值 */
type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }> };
const TENOR_Y: Record<string, number> = { "1M": 1 / 12, "6W": 1.5 / 12, "2M": 2 / 12, "3M": 0.25, "4M": 4 / 12, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3, "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30 };
function zeroFn(points: Array<{ tenor: string; value: number }>) {
  const p = points.map((x) => [TENOR_Y[x.tenor], x.value / 100] as [number, number]).filter(([t]) => t != null).sort((a, b) => a[0] - b[0]);
  return (t: number) => {
    if (!p.length) return 0.04;
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const [t0, r0] = p[i - 1], [t1, r1] = p[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); }
    return p[p.length - 1][1];
  };
}
function priceCds(spreadBp: number, rec: number, years: number, couponBp: number, zero: (t: number) => number) {
  const lam = spreadBp / 10000 / Math.max(0.01, 1 - rec);
  const n = Math.max(1, Math.round(years * 4));
  let rpv01 = 0, prot = 0, prevQ = 1;
  const flows: Array<{ t: number; df: number; q: number; pd: number; prem: number; protPv: number }> = [];
  for (let i = 1; i <= n; i++) {
    const t = i / 4;
    const df = Math.exp(-zero(t) * t);
    const q = Math.exp(-lam * t);
    const dfm = Math.exp(-zero(t - 0.125) * (t - 0.125));
    const premPv = 0.25 * df * (q + prevQ) / 2;
    const protPv = (1 - rec) * dfm * (prevQ - q);
    rpv01 += premPv;
    prot += protPv;
    flows.push({ t, df, q, pd: prevQ - q, prem: premPv * (couponBp / 10000), protPv });
    prevQ = q;
  }
  const par = (prot / rpv01) * 10000;
  const upfront = ((par - couponBp) / 10000) * rpv01;
  return { lam, rpv01, prot, par, upfront, flows };
}
export function CdsPricer() {
  const curves = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const { pick } = useHub();
  const [spread, setSpread] = useState(150);
  const [rec, setRec] = useState(40);
  const [years, setYears] = useState(5);
  const [coupon, setCoupon] = useState(100);
  const [notional, setNotional] = useState(10_000_000);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const curve = curves.data?.us[0];
  const zero = useMemo(() => zeroFn(curve?.points ?? []), [curve]);
  const r = useMemo(() => priceCds(spread, rec / 100, years, coupon, zero), [spread, rec, years, coupon, zero]);
  const bump = useMemo(() => priceCds(spread + 1, rec / 100, years, coupon, zero), [spread, rec, years, coupon, zero]);
  const sign = side === "buy" ? 1 : -1;
  const cs01 = (bump.upfront - r.upfront) * notional * sign;
  const term = [1, 2, 3, 5, 7, 10].map((y) => ({ y, q: Math.exp(-r.lam * y) }));
  const grid = [-100, -50, -25, 0, 25, 50, 100, 200].map((d) => ({ d, pv: priceCds(Math.max(1, spread + d), rec / 100, years, coupon, zero).upfront * notional * sign }));
  const inp = "w-24 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white";
  const [func, setFunc] = useState("price");
  return (
    <HubShell title="信用违约互换估值" code="CDSW" func={func} setFunc={setFunc} funcs={[["price", "CDSW", "估值与风险"], ["flows", "CFLW", "现金流明细"]]}
      right={curve ? <span>贴现曲线：美债 {curve.date}（实时更新）</span> : <span>读取贴现曲线…</span>}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="bg-[#03070c] p-2 text-[11px]">
          <SectionHead title="合约条款" />
          {([["方向", null], ["名义本金（美元）", [notional, setNotional, 1_000_000]], ["市场报价利差（bp）", [spread, setSpread, 5]], ["标准票息（bp）", null], ["期限（年）", [years, setYears, 1]], ["回收率（%）", [rec, setRec, 5]]] as Array<[string, [number, (v: number) => void, number] | null]>).map(([label, ctl]) => (
            <div key={label} className="flex items-center justify-between border-b border-[#0f1b29] py-1">
              <span className="text-slate-400">{label}</span>
              {label === "方向" ? <Seg value={side} onChange={setSide} options={[["buy", "买保护"], ["sell", "卖保护"]]} /> : label.startsWith("标准票息") ? <Seg value={String(coupon)} onChange={(v) => setCoupon(Number(v))} options={[["100", "100"], ["500", "500"]]} /> : <input type="number" step={ctl![2]} value={ctl![0]} onChange={(e) => ctl![1](Number(e.target.value) || 0)} className={inp} />}
            </div>
          ))}
          
          <div className="mt-2 flex flex-wrap gap-1">{["HYG", "LQD", "EMB", "KRE"].map((s) => <button key={s} type="button" onClick={() => pick(s)} className="border border-[#1d3047] px-1.5 text-[10px] text-cyan-300 hover:bg-[#0a1726]">{s} K线</button>)}</div>
        </div>
        <div className="min-w-0 bg-[#03070c]">
          {func === "price" ? <>
            <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] md:grid-cols-4">
              {[["前端费用（占本金）", `${(r.upfront * 100 * sign).toFixed(3)}%`], ["前端费用（美元）", Math.round(r.upfront * notional * sign).toLocaleString()], ["平价利差", `${r.par.toFixed(1)} bp`], ["风险年金 RPV01", r.rpv01.toFixed(4)], ["CS01（利差 +1bp）", Math.round(cs01).toLocaleString()], ["危险率 λ", `${(r.lam * 100).toFixed(3)}%`], [`${years} 年累计违约概率`, `${((1 - Math.exp(-r.lam * years)) * 100).toFixed(2)}%`], ["保护腿现值", `${(r.prot * 100).toFixed(3)}%`]].map(([k, v]) => (
                <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div></div>
              ))}
            </div>
            <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
              <div className="bg-[#03070c]"><SectionHead title="生存概率 / 累计违约概率" /><Lines series={[{ name: "生存概率 %", color: "#38bdf8", values: term.map((x) => x.q * 100) }, { name: "累计违约 %", color: "#f2495c", values: term.map((x) => (1 - x.q) * 100) }]} xLabels={term.map((x) => `${x.y}Y`)} height={170} fmt={(v) => v.toFixed(1)} /></div>
              <div className="bg-[#03070c]"><SectionHead title={`利差情景下的盯市损益（${side === "buy" ? "买保护" : "卖保护"}，美元）`} /><Bars data={grid.map((g) => ({ k: `${g.d > 0 ? "+" : ""}${g.d}bp`, v: g.pv }))} height={170} /></div>
            </div>
          </> : (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-right">时点（年）</th><th className="text-right">贴现因子</th><th className="text-right">生存概率</th><th className="text-right">区间违约概率</th><th className="text-right">票息现值</th><th className="px-2 text-right">保护腿现值</th></tr></thead>
              <tbody>{r.flows.map((f) => <tr key={f.t} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-right font-mono text-slate-300">{f.t.toFixed(2)}</td><td className="text-right font-mono text-slate-300">{f.df.toFixed(5)}</td><td className="text-right font-mono text-white">{(f.q * 100).toFixed(3)}%</td><td className="text-right font-mono text-red-300">{(f.pd * 100).toFixed(3)}%</td><td className="text-right font-mono text-slate-300">{Math.round(f.prem * notional).toLocaleString()}</td><td className="px-2 text-right font-mono text-slate-300">{Math.round(f.protPv * notional).toLocaleString()}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </HubShell>
  );
}
