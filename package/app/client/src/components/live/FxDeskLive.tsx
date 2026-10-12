/**
 * 外汇窗口（第一组，全部实时 / 真实数据计算）：
 *  - WCR    全球汇率：各货币名义 / 实际有效汇率、相对 10 年均值的估值偏离与分位、长期走势
 *  - WCRS   全球央行利率：28 个经济体政策利率、最近一次调整、通胀与实际利率、对美元利差、历史走势
 *  - FXCORR 外汇相关：货币间相关矩阵、滚动相关、货币与大类资产（股、金、油、美债）相关
 *  - FXSW   外汇策略工作台：利差 / 动量 / 低波三类因子的当前排序与真实历史回测
 */
import { useMemo, useState } from "react";
import { fmtPct, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { Seg } from "@/uc/news/kit";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { align, annVol, corr, f2, heat, mean, perf, rets, rollingCorr, sgn, std, useCloses, ytd } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";
import { MiniLine, Note, RangeBar, ROW, TD, TDL, TH, THL, type P } from "./LiveCommon";
import { fmtRate } from "./RatesFxLive3";

const COLORS = ["#38bdf8", "#f2495c", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#94a3b8", "#fb923c"];
const thead = "sticky top-0 z-10 bg-[#0a1726] text-[10px] text-slate-500";

/** 货币表：sym 为对美元报价代码，inv = true 表示“1 美元兑该货币” */
export type Ccy = { c: string; zh: string; sym: string; inv: boolean; r: string; cb: string; g10?: boolean };
export const FX_CCYS: Ccy[] = [
  { c: "EUR", zh: "欧元", sym: "EURUSD", inv: false, r: "欧洲", cb: "XM", g10: true },
  { c: "JPY", zh: "日元", sym: "USDJPY", inv: true, r: "亚太", cb: "JP", g10: true },
  { c: "GBP", zh: "英镑", sym: "GBPUSD", inv: false, r: "欧洲", cb: "GB", g10: true },
  { c: "CHF", zh: "瑞郎", sym: "USDCHF", inv: true, r: "欧洲", cb: "CH", g10: true },
  { c: "AUD", zh: "澳元", sym: "AUDUSD", inv: false, r: "亚太", cb: "AU", g10: true },
  { c: "NZD", zh: "纽元", sym: "NZDUSD", inv: false, r: "亚太", cb: "NZ", g10: true },
  { c: "CAD", zh: "加元", sym: "USDCAD", inv: true, r: "美洲", cb: "CA", g10: true },
  { c: "SEK", zh: "瑞典克朗", sym: "USDSEK", inv: true, r: "欧洲", cb: "SE", g10: true },
  { c: "NOK", zh: "挪威克朗", sym: "USDNOK", inv: true, r: "欧洲", cb: "NO", g10: true },
  { c: "CNH", zh: "离岸人民币", sym: "USDCNH", inv: true, r: "亚太", cb: "CN" },
  { c: "HKD", zh: "港币", sym: "USDHKD", inv: true, r: "亚太", cb: "HK" },
  { c: "SGD", zh: "新加坡元", sym: "USDSGD", inv: true, r: "亚太", cb: "" },
  { c: "KRW", zh: "韩元", sym: "USDKRW", inv: true, r: "亚太", cb: "KR" },
  { c: "INR", zh: "印度卢比", sym: "USDINR", inv: true, r: "亚太", cb: "IN" },
  { c: "IDR", zh: "印尼盾", sym: "USDIDR", inv: true, r: "亚太", cb: "ID" },
  { c: "THB", zh: "泰铢", sym: "USDTHB", inv: true, r: "亚太", cb: "TH" },
  { c: "MYR", zh: "林吉特", sym: "USDMYR", inv: true, r: "亚太", cb: "MY" },
  { c: "PHP", zh: "菲律宾比索", sym: "USDPHP", inv: true, r: "亚太", cb: "PH" },
  { c: "TWD", zh: "新台币", sym: "USDTWD", inv: true, r: "亚太", cb: "" },
  { c: "BRL", zh: "巴西雷亚尔", sym: "USDBRL", inv: true, r: "美洲", cb: "BR" },
  { c: "MXN", zh: "墨西哥比索", sym: "USDMXN", inv: true, r: "美洲", cb: "MX" },
  { c: "CLP", zh: "智利比索", sym: "USDCLP", inv: true, r: "美洲", cb: "CL" },
  { c: "COP", zh: "哥伦比亚比索", sym: "USDCOP", inv: true, r: "美洲", cb: "CO" },
  { c: "ZAR", zh: "南非兰特", sym: "USDZAR", inv: true, r: "中东非", cb: "ZA" },
  { c: "TRY", zh: "土耳其里拉", sym: "USDTRY", inv: true, r: "中东非", cb: "TR" },
  { c: "PLN", zh: "波兰兹罗提", sym: "USDPLN", inv: true, r: "欧洲", cb: "PL" },
  { c: "CZK", zh: "捷克克朗", sym: "USDCZK", inv: true, r: "欧洲", cb: "CZ" },
  { c: "HUF", zh: "匈牙利福林", sym: "USDHUF", inv: true, r: "欧洲", cb: "HU" },
];
/** 把报价序列换算成“1 单位货币值多少美元”（升 = 该货币对美元升值） */
export const usdVal = (c: Ccy, xs: number[]) => (c.inv ? xs.map((v) => 1 / v) : xs);
const ccyOf = (code: string) => FX_CCYS.find((x) => x.c === code);

/* ================================================================== WCR 全球汇率：有效汇率与估值 */
type Eer = { area: string; nominal: Array<{ d: string; v: number }>; real: Array<{ d: string; v: number }> };
const EER_OF: Record<string, string> = { USD: "US", SGD: "SG", TWD: "TW" };
const areaOf = (c: Ccy) => EER_OF[c.c] ?? c.cb;
const USD_ROW: Ccy = { c: "USD", zh: "美元", sym: "DXY", inv: false, r: "美洲", cb: "US", g10: true };
export function WcrLive({ onClose }: P) {
  const [tab, setTab] = useState("val");
  const [region, setRegion] = useState("全部");
  const [chosen, setChosen] = useState<string[]>(["USD", "EUR", "JPY", "CNH", "GBP"]);
  const eer = usePolled<{ rows: Eer[] }>("ucHubs.eer", {}, 6 * 3600_000);
  const all = [USD_ROW, ...FX_CCYS];
  const ticks = useTicks(all.map((c) => c.sym));
  const st = useMemo(() => {
    const o: Record<string, { reer: number | null; neer: number | null; d: string | null; dev: number | null; pct: number | null; r12: number | null; n3: number | null; hist: number[]; dates: string[] }> = {};
    for (const c of all) {
      const e = eer.data?.rows.find((r) => r.area === areaOf(c));
      if (!e) continue;
      const rv = e.real.map((x) => x.v), nv = e.nominal.map((x) => x.v);
      const last = rv.at(-1) ?? null, avg = rv.length >= 60 ? mean(rv.slice(-120)) : null;
      o[c.c] = { reer: last, neer: nv.at(-1) ?? null, d: (e.real.at(-1) ?? e.nominal.at(-1))?.d ?? null, dev: last != null && avg ? (last / avg - 1) * 100 : null, pct: last != null && rv.length ? (rv.filter((x) => x <= last).length / rv.length) * 100 : null, r12: perf(rv, 12), n3: perf(nv, 3), hist: rv, dates: e.real.map((x) => x.d) };
    }
    return o;
  }, [eer.data]);
  const dayChg = (c: Ccy) => { const p = ticks[c.sym]?.changePct; return p == null ? null : c.inv ? (1 / (1 + p / 100) - 1) * 100 : p; };
  const list = all.filter((c) => st[c.c] && (region === "全部" || (region === "G10" ? c.g10 : c.r === region)));
  const months = useMemo(() => [...new Set(chosen.flatMap((k) => st[k]?.dates ?? []))].sort(), [st, chosen]);
  const over = list.filter((c) => (st[c.c].dev ?? 0) > 10).map((c) => c.zh), under = list.filter((c) => (st[c.c].dev ?? 0) < -10).map((c) => c.zh);
  return (
    <PanelShell code="WCR" title="全球汇率 · 有效汇率与估值" onClose={onClose} tabs={[["val", "估值一览"], ["hist", "实际有效汇率走势"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["数据月份", list[0] ? st[list[0].c].d ?? "—" : "—"], ["相对 10 年均值高估 >10%", over.join("、") || "无"], ["低估 >10%", under.join("、") || "无"], ["美元实际有效汇率", f2(st.USD?.reer, 1), st.USD?.dev != null ? `偏离均值 ${sgn(st.USD.dev)}` : ""]]} />
      {!eer.data ? <Empty loading={eer.loading} text="有效汇率数据暂不可用" /> : (
        <>
          {tab === "val" && (
            <>
              <div className="px-2 py-1"><Seg value={region} options={["全部", "G10", "亚太", "欧洲", "美洲", "中东非"].map((x) => [x, x] as [string, string])} onChange={setRegion} /></div>
              <div className="overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className={thead}><tr><th className={THL}>货币</th><th className={TH}>实际有效汇率</th><th className={TH}>名义有效汇率</th><th className={TH}>偏离 10 年均值</th><th className={TH}>10 年分位</th><th className={THL}>估值判断</th><th className={TH}>实际·12 个月</th><th className={TH}>名义·3 个月</th><th className={TH}>今日对美元(实时)</th><th className={TH}>近 10 年</th></tr></thead>
                  <tbody>{[...list].sort((a, b) => (st[b.c].dev ?? 0) - (st[a.c].dev ?? 0)).map((c) => { const s = st[c.c]; const tag = s.dev == null ? "—" : s.dev > 10 ? "明显高估" : s.dev > 5 ? "偏高" : s.dev < -10 ? "明显低估" : s.dev < -5 ? "偏低" : "接近均值"; return (
                    <tr key={c.c} onClick={() => setChosen((x) => x.includes(c.c) ? x : [...x.slice(-7), c.c])} className={`${ROW} cursor-pointer`}>
                      <td className={`${TDL} text-slate-100`}>{c.zh} <span className="font-mono text-[10px] text-slate-500">{c.c}</span></td>
                      <td className={`${TD} text-white`}>{f2(s.reer, 1)}</td><td className={`${TD} text-slate-300`}>{f2(s.neer, 1)}</td>
                      <td className={TD} style={{ color: toneOf(s.dev), background: heat(s.dev, 20) }}>{sgn(s.dev, 1)}</td>
                      <td className={`${TD} text-slate-300`}>{f2(s.pct, 0, "%")}</td>
                      <td className={`${TDL} text-[10px] text-slate-300`}>{tag}</td>
                      <td className={TD} style={{ color: toneOf(s.r12) }}>{sgn(s.r12)}</td>
                      <td className={TD} style={{ color: toneOf(s.n3) }}>{sgn(s.n3)}</td>
                      <td className={TD} style={{ color: toneOf(c.c === "USD" ? ticks.DXY?.changePct : dayChg(c)) }}>{c.c === "USD" ? fmtPct(ticks.DXY?.changePct) : sgn(dayChg(c))}</td>
                      <td className={TD}><MiniLine values={s.hist} w={90} color={(s.dev ?? 0) >= 0 ? "#f2495c" : "#1fbf75"} /></td>
                    </tr>); })}</tbody>
                </table>
              </div>
              <SectionHead title="实际有效汇率相对 10 年均值的偏离" />
              <Bars data={list.filter((c) => st[c.c].dev != null).map((c) => ({ k: c.zh, v: st[c.c].dev! })).sort((a, b) => b.v - a.v)} fmt={(v) => `${v.toFixed(1)}%`} height={140} />
              <Note>有效汇率为宽口径贸易加权指数（月度）；实际有效汇率进一步按相对物价调整，上升 = 本币对贸易伙伴整体升值。点击行加入走势对比。「今日对美元」为实时双边汇率变动，仅作参照。</Note>
            </>
          )}
          {tab === "hist" && (
            <>
              <div className="flex flex-wrap gap-1 px-2 py-1">{all.filter((c) => st[c.c]).map((c) => <button type="button" key={c.c} onClick={() => setChosen((x) => x.includes(c.c) ? x.filter((y) => y !== c.c) : x.length >= 8 ? x : [...x, c.c])} className={`border px-1.5 py-0.5 text-[10px] ${chosen.includes(c.c) ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500 hover:text-slate-300"}`}>{c.zh}</button>)}</div>
              <Lines height={260} xLabels={months} fmt={(v) => v.toFixed(1)} series={chosen.filter((k) => st[k]).map((k, i) => { const m = new Map(st[k].dates.map((d, j) => [d, st[k].hist[j]])); return { name: ccyOf(k)?.zh ?? (k === "USD" ? "美元" : k), color: COLORS[i % COLORS.length], values: months.map((d) => m.get(d) ?? null) }; })} />
              <Note>实际有效汇率指数（2020 年 = 100），最多同时比较 8 种货币。</Note>
            </>
          )}
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== WCRS 全球央行利率 */
export type CbRow = { area: string; name: string; ccy: string; bank: string; rate: number | null; date: string | null; chg3m: number | null; chg12m: number | null; lastMove: { d: string; from: number; to: number } | null; cpi: number | null; cpiDate: string | null; real: number | null; hist: Array<{ d: string; v: number }>; cpiHist: Array<{ d: string; v: number }> };
export const useCbRates = () => usePolled<{ rows: CbRow[] }>("ucHubs.cbRates", {}, 3 * 3600_000);

export function WcrsLive({ onClose }: P) {
  const [tab, setTab] = useState("list");
  const [chosen, setChosen] = useState<string[]>(["US", "XM", "GB", "JP", "CN"]);
  const cb = useCbRates();
  const rows = cb.data?.rows ?? [];
  const us = rows.find((r) => r.area === "US");
  const easing = rows.filter((r) => (r.chg12m ?? 0) < 0).length, tightening = rows.filter((r) => (r.chg12m ?? 0) > 0).length;
  const months = useMemo(() => [...new Set(rows.filter((r) => chosen.includes(r.area)).flatMap((r) => r.hist.map((h) => h.d)))].sort(), [rows, chosen]);
  const valAt = (r: CbRow, d: string) => { let v: number | null = null; for (const h of r.hist) { if (h.d <= d) v = h.v; else break; } return v; };
  return (
    <PanelShell code="WCRS" title="全球央行政策利率" onClose={onClose} tabs={[["list", "利率一览"], ["hist", "利率走势"], ["real", "实际利率与利差"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["覆盖经济体", String(rows.length)], ["近 12 个月降息", `${easing} 家`], ["近 12 个月加息", `${tightening} 家`], ["美国政策利率", f2(us?.rate, 3, "%"), us?.date ?? ""], ["数据月份", rows[0]?.date ?? "—"]]} />
      {!rows.length ? <Empty loading={cb.loading} text="政策利率数据暂不可用" /> : (
        <>
          {tab === "list" && (
            <div className="overflow-auto">
              <table className="w-full text-[11px]">
                <thead className={thead}><tr><th className={THL}>经济体</th><th className={THL}>央行</th><th className={THL}>货币</th><th className={TH}>政策利率</th><th className={TH}>3 个月变动</th><th className={TH}>12 个月变动</th><th className={THL}>最近一次调整</th><th className={TH}>通胀(同比)</th><th className={TH}>实际利率</th><th className={TH}>对美元利差</th><th className={TH}>近 6 年</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.area} className={ROW}>
                    <td className={`${TDL} text-slate-100`}>{r.name}</td><td className={`${TDL} text-[10px] text-slate-400`}>{r.bank}</td><td className={`${TDL} font-mono text-[10px] text-slate-500`}>{r.ccy}</td>
                    <td className={`${TD} text-white`}>{f2(r.rate, 2, "%")}</td>
                    <td className={TD} style={{ color: toneOf(r.chg3m) }}>{r.chg3m ? `${r.chg3m > 0 ? "+" : ""}${(r.chg3m * 100).toFixed(0)}bp` : "—"}</td>
                    <td className={TD} style={{ color: toneOf(r.chg12m) }}>{r.chg12m ? `${r.chg12m > 0 ? "+" : ""}${(r.chg12m * 100).toFixed(0)}bp` : "—"}</td>
                    <td className={`${TDL} text-[10px]`} style={{ color: toneOf(r.lastMove ? r.lastMove.to - r.lastMove.from : null) }}>{r.lastMove ? `${r.lastMove.d} ${r.lastMove.to > r.lastMove.from ? "加息" : "降息"} ${Math.abs((r.lastMove.to - r.lastMove.from) * 100).toFixed(0)}bp` : "6 年内未调整"}</td>
                    <td className={`${TD} text-slate-300`}>{f2(r.cpi, 2, "%")}<span className="ml-1 text-[9px] text-slate-600">{r.cpiDate?.slice(2) ?? ""}</span></td>
                    <td className={TD} style={{ color: toneOf(r.real), background: heat(r.real, 6) }}>{f2(r.real, 2, "%")}</td>
                    <td className={TD} style={{ color: toneOf(r.rate != null && us?.rate != null ? r.rate - us.rate : null) }}>{r.rate != null && us?.rate != null && r.area !== "US" ? `${r.rate - us.rate > 0 ? "+" : ""}${((r.rate - us.rate) * 100).toFixed(0)}bp` : "—"}</td>
                    <td className={TD}><MiniLine values={r.hist.map((h) => h.v)} w={90} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {tab === "hist" && (
            <>
              <div className="flex flex-wrap gap-1 px-2 py-1">{rows.map((r) => <button type="button" key={r.area} onClick={() => setChosen((c) => c.includes(r.area) ? c.filter((x) => x !== r.area) : c.length >= 8 ? c : [...c, r.area])} className={`border px-1.5 py-0.5 text-[10px] ${chosen.includes(r.area) ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-500 hover:text-slate-300"}`}>{r.name}</button>)}</div>
              <Lines height={260} xLabels={months} fmt={(v) => `${v.toFixed(2)}%`} series={rows.filter((r) => chosen.includes(r.area)).map((r, i) => ({ name: r.name, color: COLORS[i % COLORS.length], values: months.map((d) => valAt(r, d)) }))} />
              <Note>月末政策利率，最多同时比较 8 个经济体。</Note>
            </>
          )}
          {tab === "real" && (
            <>
              <SectionHead title="实际政策利率" sub="实际利率越高，货币政策越紧" />
              <Bars data={rows.filter((r) => r.real != null).map((r) => ({ k: r.name, v: r.real! })).sort((a, b) => b.v - a.v)} fmt={(v) => `${v.toFixed(2)}%`} height={150} />
              <SectionHead title="与美国政策利率之差" sub="正值：持有该货币相对美元有利差收益（未扣除对冲成本）" />
              <Bars data={rows.filter((r) => r.rate != null && r.area !== "US" && us?.rate != null).map((r) => ({ k: r.name, v: r.rate! - us!.rate! })).sort((a, b) => b.v - a.v)} fmt={(v) => `${v.toFixed(2)}%`} height={150} />
            </>
          )}
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== FXCORR 外汇相关 */
const ASSETS: Array<[string, string]> = [["^GSPC", "标普500"], ["GC", "黄金"], ["CL", "原油"], ["^TNX", "美债10年"], ["DXY", "美元指数"], ["BTC", "比特币"]];
export function FxcorrLive({ onClose }: P) {
  const [tab, setTab] = useState("matrix");
  const [win, setWin] = useState<"63" | "126" | "252">("126");
  const [set, setSet] = useState<"g10" | "em">("g10");
  const [pair, setPair] = useState<[string, string]>(["AUD", "^GSPC"]);
  const ccys = FX_CCYS.filter((c) => (set === "g10" ? c.g10 || c.c === "CNH" : !c.g10)).slice(0, 14);
  const syms = [...FX_CCYS.map((c) => c.sym), ...ASSETS.map((a) => a[0])];
  const pack = useCloses(syms.slice(0, 60), 800);
  const series = useMemo(() => {
    if (!pack.data) return null;
    const keys = [...FX_CCYS.map((c) => c.sym), ...ASSETS.map((a) => a[0])].filter((s) => (pack.data![s] ?? []).length > 100);
    const al = align(pack.data, keys);
    const out: Record<string, number[]> = {};
    for (const c of FX_CCYS) if (al.m[c.sym]) out[c.c] = usdVal(c, al.m[c.sym]);
    for (const [s] of ASSETS) if (al.m[s]) out[s] = al.m[s];
    return { dates: al.dates, out };
  }, [pack.data]);
  const n = Number(win) + 1;
  const R = (k: string) => rets((series?.out[k] ?? []).slice(-n));
  const label = (k: string) => ccyOf(k)?.zh ?? ASSETS.find((a) => a[0] === k)?.[1] ?? k;
  const mat = series ? ccys.map((a) => ccys.map((b) => corr(R(a.c), R(b.c)))) : null;
  const assetMat = series ? ccys.map((c) => ASSETS.map(([s]) => (s === "^TNX" ? corr(R(c.c), (series.out[s] ?? []).slice(-n).slice(1).map((v, i) => v - series.out[s].slice(-n)[i])) : corr(R(c.c), R(s))))) : null;
  const roll = useMemo(() => {
    if (!series) return null;
    const a = series.out[pair[0]], b = series.out[pair[1]];
    if (!a || !b) return null;
    const ra = rets(a), rb = pair[1] === "^TNX" ? b.slice(1).map((v, i) => v - b[i]) : rets(b);
    return { dates: series.dates.slice(1), c60: rollingCorr(ra, rb, 60), c20: rollingCorr(ra, rb, 20) };
  }, [series, pair]);
  const cell = (v: number | null, onClick?: () => void) => <td onClick={onClick} className={`px-1 py-0.5 text-center font-mono ${onClick ? "cursor-pointer hover:outline hover:outline-1 hover:outline-cyan-600" : ""}`} style={{ background: heat(v, 1), color: "#e2e8f0" }}>{v == null ? "—" : v.toFixed(2)}</td>;
  return (
    <PanelShell code="FXCORR" title="外汇相关性" onClose={onClose} tabs={[["matrix", "货币间相关"], ["assets", "货币与资产"], ["rolling", "滚动相关"]]} tab={tab} setTab={setTab}
      right={<span className="flex items-center gap-1 text-[10px] text-slate-500">窗口 <Seg value={win} options={[["63", "3 月"], ["126", "6 月"], ["252", "1 年"]]} onChange={setWin} /></span>}>
      {!series ? <Empty loading={pack.loading} /> : (
        <>
          {tab !== "rolling" && <div className="px-2 py-1"><Seg value={set} options={[["g10", "G10 + 人民币"], ["em", "新兴市场货币"]]} onChange={setSet} /></div>}
          {tab === "matrix" && mat && (
            <div className="overflow-auto">
              <table className="text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL} />{ccys.map((c) => <th key={c.c} className="px-1 py-1 font-mono font-normal">{c.c}</th>)}</tr></thead>
                <tbody>{mat.map((row, i) => <tr key={ccys[i].c} className="border-t border-[#0f1b29]"><td className={`${TDL} text-slate-300`}>{ccys[i].zh}</td>{row.map((v, j) => i === j ? <td key={j} className="bg-[#0a1726] px-1 text-center text-slate-600">1</td> : <td key={j} className="p-0">{cell(v, () => { setPair([ccys[i].c, ccys[j].c]); setTab("rolling"); })}</td>)}</tr>)}</tbody></table>
              <Note>各货币统一为对美元价值（升 = 对美元升值）后计算日对数收益相关；点击单元格查看滚动相关。</Note>
            </div>
          )}
          {tab === "assets" && assetMat && (
            <div className="overflow-auto">
              <table className="w-full text-[11px]"><thead className="text-[10px] text-slate-500"><tr><th className={THL}>货币（对美元）</th>{ASSETS.map((a) => <th key={a[0]} className="px-1 py-1 font-normal">{a[1]}</th>)}<th className={THL}>属性</th></tr></thead>
                <tbody>{assetMat.map((row, i) => { const eq = row[0] ?? 0, au = row[1] ?? 0; const tag = eq > 0.3 ? "风险偏好型" : eq < -0.15 ? "避险型" : au > 0.4 ? "贵金属联动" : (row[2] ?? 0) > 0.3 ? "商品型" : "中性"; return <tr key={ccys[i].c} className="border-t border-[#0f1b29]"><td className={`${TDL} text-slate-300`}>{ccys[i].zh}</td>{row.map((v, j) => <td key={j} className="p-0">{cell(v, () => { setPair([ccys[i].c, ASSETS[j][0]]); setTab("rolling"); })}</td>)}<td className={`${TDL} text-[10px] text-slate-400`}>{tag}</td></tr>; })}</tbody></table>
              <Note>美债 10 年取收益率日变动（而非价格）；正相关表示资产上涨 / 收益率上行时该货币对美元走强。</Note>
            </div>
          )}
          {tab === "rolling" && (
            <>
              <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]">
                <select value={pair[0]} onChange={(e) => setPair([e.target.value, pair[1]])} className="border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-white">{FX_CCYS.map((c) => <option key={c.c} value={c.c}>{c.zh}</option>)}</select>
                <span className="text-slate-500">与</span>
                <select value={pair[1]} onChange={(e) => setPair([pair[0], e.target.value])} className="border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-white">{[...FX_CCYS.map((c) => [c.c, c.zh] as [string, string]), ...ASSETS].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </div>
              {roll ? <>
                <Kpis items={[["当前 60 日相关", f2(roll.c60.at(-1))], ["当前 20 日相关", f2(roll.c20.at(-1))], ["区间均值(60日)", f2(mean(roll.c60.filter((x): x is number => x != null)))], ["区间标准差", f2(std(roll.c60.filter((x): x is number => x != null)))]]} />
                <Lines height={240} zero xLabels={roll.dates} fmt={(v) => v.toFixed(2)} series={[{ name: "60 日", color: COLORS[0], values: roll.c60 }, { name: "20 日", color: COLORS[2], values: roll.c20, dash: true }]} />
                <Note>{label(pair[0])} 对美元与 {label(pair[1])} 的滚动相关（近 3 年）。</Note>
              </> : <Empty text="该组合暂无足够历史" />}
            </>
          )}
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== FXSW 外汇策略工作台 */
type Factor = "carry" | "mom" | "lowvol";
const FACTOR_ZH: Record<Factor, string> = { carry: "利差（套息）", mom: "动量（12-1 月）", lowvol: "低波动" };
export function FxswLive({ onClose }: P) {
  const [tab, setTab] = useState("rank");
  const [factor, setFactor] = useState<Factor>("carry");
  const [k, setK] = useState<"2" | "3">("3");
  const universe = FX_CCYS.filter((c) => c.g10);
  const pack = useCloses(universe.map((c) => c.sym), 1300);
  const cb = useCbRates();
  const ticks = useTicks(universe.map((c) => c.sym));
  const rateOf = (area: string, month?: string) => {
    const r = cb.data?.rows.find((x) => x.area === area);
    if (!r) return null;
    if (!month) return r.rate;
    let v: number | null = null; for (const h of r.hist) { if (h.d <= month) v = h.v; else break; } return v;
  };
  const model = useMemo(() => {
    if (!pack.data) return null;
    const al = align(pack.data, universe.map((c) => c.sym));
    if (al.dates.length < 300) return null;
    const val: Record<string, number[]> = {};
    for (const c of universe) val[c.c] = usdVal(c, al.m[c.sym]);
    const score = (f: Factor, i: number, c: Ccy): number | null => {
      const v = val[c.c];
      if (f === "carry") { const m = al.dates[i].slice(0, 7); const a = rateOf(c.cb, m), u = rateOf("US", m); return a != null && u != null ? a - u : null; }
      if (f === "mom") return i >= 252 ? (v[i - 21] / v[i - 252] - 1) * 100 : null;
      const w = v.slice(Math.max(0, i - 63), i + 1); return w.length > 40 ? -(std(rets(w)) * Math.sqrt(252) * 100) : null;
    };
    // 月度再平衡（每 21 个交易日），多前 k 名 / 空后 k 名，等权；收益 = 即期变动 + 利差计提（按政策利率差近似）
    const nk = Number(k);
    const eq = [1]; const dts = [al.dates[252]]; let longs: Ccy[] = [], shorts: Ccy[] = [];
    for (let i = 252; i < al.dates.length - 1; i++) {
      if ((i - 252) % 21 === 0) {
        const sc = universe.map((c) => ({ c, s: score(factor, i, c) })).filter((x) => x.s != null).sort((a, b) => b.s! - a.s!);
        if (sc.length >= nk * 2) { longs = sc.slice(0, nk).map((x) => x.c); shorts = sc.slice(-nk).map((x) => x.c); }
      }
      const m = al.dates[i].slice(0, 7);
      const leg = (c: Ccy) => { const v = val[c.c]; const spot = v[i + 1] / v[i] - 1; const a = rateOf(c.cb, m), u = rateOf("US", m); return spot + (a != null && u != null ? (a - u) / 100 / 252 : 0); };
      const r = longs.length ? mean(longs.map(leg)) - mean(shorts.map(leg)) : 0;
      eq.push(eq[eq.length - 1] * (1 + r / 2)); dts.push(al.dates[i + 1]);
    }
    const dr = eq.slice(1).map((v, i) => v / eq[i] - 1);
    const ann = (Math.pow(eq[eq.length - 1], 252 / Math.max(1, dr.length)) - 1) * 100;
    const vol = std(dr) * Math.sqrt(252) * 100;
    let peak = 1, mdd = 0; for (const v of eq) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
    const last = al.dates.length - 1;
    const now = universe.map((c) => ({ c, carry: score("carry", last, c), mom: score("mom", last, c), lowvol: score("lowvol", last, c) }));
    return { eq, dts, ann, vol, mdd: mdd * 100, sharpe: vol ? ann / vol : null, now, longs, shorts };
  }, [pack.data, cb.data, factor, k]);
  const ranked = model ? [...model.now].sort((a, b) => (b[factor] ?? -1e9) - (a[factor] ?? -1e9)) : [];
  const nk = Number(k);
  return (
    <PanelShell code="FXSW" title="外汇策略工作台" onClose={onClose} tabs={[["rank", "因子排序"], ["bt", "历史回测"]]} tab={tab} setTab={setTab}
      right={<span className="flex items-center gap-1 text-[10px] text-slate-500"><Seg value={factor} options={(Object.keys(FACTOR_ZH) as Factor[]).map((f) => [f, FACTOR_ZH[f]] as [Factor, string])} onChange={setFactor} /> 多空各 <Seg value={k} options={[["2", "2"], ["3", "3"]]} onChange={setK} /></span>}>
      {!model ? <Empty loading={pack.loading || cb.loading} text="历史数据不足" /> : (
        <>
          {tab === "rank" && (
            <>
              <table className="w-full text-[11px]">
                <thead className={thead}><tr><th className={THL}>排名</th><th className={THL}>货币</th><th className={TH}>实时报价</th><th className={TH}>今日</th><th className={TH}>对美元利差</th><th className={TH}>12-1 月动量</th><th className={TH}>63 日波动</th><th className={THL}>当前信号</th></tr></thead>
                <tbody>{ranked.map((x, i) => { const sig = i < nk ? "做多" : i >= ranked.length - nk ? "做空" : "—"; return (
                  <tr key={x.c.c} className={ROW}>
                    <td className={`${TDL} text-slate-500`}>{i + 1}</td><td className={`${TDL} text-slate-100`}>{x.c.zh} <span className="font-mono text-[10px] text-slate-500">{x.c.c}</span></td>
                    <td className={`${TD} text-white`}>{fmtRate(ticks[x.c.sym]?.price)}</td><td className={TD} style={{ color: toneOf(ticks[x.c.sym]?.changePct) }}>{fmtPct(ticks[x.c.sym]?.changePct)}</td>
                    <td className={TD} style={{ color: toneOf(x.carry) }}>{f2(x.carry, 2, "%")}</td>
                    <td className={TD} style={{ color: toneOf(x.mom) }}>{sgn(x.mom)}</td>
                    <td className={`${TD} text-slate-300`}>{x.lowvol == null ? "—" : `${(-x.lowvol).toFixed(1)}%`}</td>
                    <td className={`${TDL} font-bold`} style={{ color: sig === "做多" ? "#f2495c" : sig === "做空" ? "#1fbf75" : "#475569" }}>{sig}</td>
                  </tr>); })}</tbody>
              </table>
              <Note>G10 货币对美元；利差 = 该经济体政策利率 − 美国政策利率；动量 = 过去 12 个月至 1 个月前的对美元涨幅；低波动按 63 日年化波动由低到高排序。信号为横截面排序结果，不构成交易建议。</Note>
            </>
          )}
          {tab === "bt" && (
            <>
              <Kpis items={[["年化收益", sgn(model.ann)], ["年化波动", f2(model.vol, 1, "%")], ["夏普（无风险=0）", f2(model.sharpe)], ["最大回撤", sgn(model.mdd)], ["当前多头", model.longs.map((c) => c.c).join(" ")], ["当前空头", model.shorts.map((c) => c.c).join(" ")]]} />
              <SectionHead title={`${FACTOR_ZH[factor]} 多空组合净值`} sub={`每 21 个交易日按因子排序再平衡，多前 ${k} 名 / 空后 ${k} 名，等权`} />
              <Lines height={240} xLabels={model.dts} fmt={(v) => v.toFixed(3)} series={[{ name: "净值", color: COLORS[0], values: model.eq }]} />
              <Note>收益 = 即期汇率变动 + 按月度政策利率差计提的持有收益（近似远期点），未计交易成本；多空各占一半名义本金。</Note>
            </>
          )}
        </>
      )}
    </PanelShell>
  );
}
