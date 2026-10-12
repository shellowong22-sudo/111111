/**
 * 股票 / ETF / 资金流 / 交易组（二）：全部实时数据，各面板角度互不重复。
 * DMMV 跨资产联动与收益率分解 · RSAN 地缘风险的市场定价 · TCON 期权交易控制台 · BCMP 美元利率衍生品目录
 * SRSK 主权风险监测 · WTWTR 新闻舆情与价格
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks, UP, DOWN } from "@/uc/market/live";
import { align, annVol, drawdown, perf, rets, useCloses, f2, sgn, heat, ncdf } from "@/uc/hubs/calc";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { FeedList, useFeed } from "@/uc/news/kit";
import { BTN, Chips, HEAD, INP, Mini, Note, ROW, Range, SignBar, TD, TDL, TH, THL, avg, betaOf, corrOf, downloadCsv, pctRank, sd, sret } from "./EqFlowKit";

type P = { onClose?: () => void };
const COLORS = ["#fbbf24", "#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#f97316"];
type UsCurve = { date: string; points: Array<{ tenor: string; value: number }> };
type Curves = { us: UsCurve[]; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
type Sov = { countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; spread1m: number | null; spread12m: number | null; chg1m: number | null; chg12m: number | null; hist: Array<{ d: string; y: number; s: number | null }> }> };
const tv = (c: UsCurve | undefined, t: string) => c?.points.find((p) => p.tenor === t)?.value ?? null;
const useCurves = () => usePolled<Curves>("ucHubs.curves", {}, 1800_000);

/* ================================================================== DMMV 跨资产联动与收益率分解 */
const BONDS: Array<[string, string]> = [["TLT", "美国长期国债"], ["IEF", "美国中期国债"], ["BWX", "国际国债"], ["EMB", "新兴市场美元债"], ["LQD", "投资级公司债"], ["HYG", "高收益债"]];
const RISK: Array<[string, string]> = [["SPY", "美股"], ["EFA", "海外发达股"], ["GC", "黄金"], ["DXY", "美元"], ["CL", "原油"], ["^TNX", "美10年收益率"]];
const HEDGES: Array<[string, string]> = [["TLT", "长期国债"], ["IEF", "中期国债"], ["GLD", "黄金 ETF"], ["UUP", "美元多头 ETF"], ["VIXY", "短期波动率期货 ETF"], ["SH", "标普反向 ETF"]];

export function EqDMMV({ onClose }: P) {
  const [tab, setTab] = useState("decomp");
  const cv = useCurves();
  const sov = usePolled<Sov>("ucHubs.sovereign", {}, 3600_000);
  const syms = [...new Set([...BONDS.map((b) => b[0]), ...RISK.map((r) => r[0]), ...HEDGES.map((h) => h[0])])];
  const pack = useCloses(tab === "decomp" ? [] : syms, 560);
  const [win, setWin] = useState("60");
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const R = useMemo(() => Object.fromEntries(syms.map((s) => [s, s === "^TNX" ? (m[s] ?? []).slice(1).map((v, i) => (v - m[s][i]) / 100) : sret(m[s] ?? [])])), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const us0 = cv.data?.us?.[0];
  const us1m = cv.data?.us?.[21];
  const de = sov.data?.countries.find((c) => c.code === "DE");
  return (
    <PanelShell code="DMMV" title="跨资产联动与收益率分解" onClose={onClose} tabs={[["decomp", "收益率分解"], ["corr", "跨资产相关"], ["roll", "滚动相关"], ["hedge", "对冲效率"]]} tab={tab} setTab={setTab}>
      {tab === "decomp" && <>
        <SectionHead title={`美国国债收益率分解${us0 ? `（${us0.date}）` : ""}`} />
        {us0 ? (() => { const y3 = tv(us0, "3M"), y2 = tv(us0, "2Y"), y10 = tv(us0, "10Y"), y30 = tv(us0, "30Y"); const parts: Array<[string, number | null, string]> = [["政策利率（3月）", y3, "#38bdf8"], ["政策路径（2年−3月）", y2 != null && y3 != null ? y2 - y3 : null, "#a78bfa"], ["期限溢价", y10 != null && y2 != null ? y10 - y2 : null, "#fbbf24"], ["超长端（30年−10年）", y30 != null && y10 != null ? y30 - y10 : null, "#f472b6"]]; return <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>成分</th><th className={TH}>当前(%)</th><th className={TH}>1个月前(%)</th><th className={TH}>变动(bp)</th><th className="px-2 text-left">贡献</th></tr></thead><tbody>{parts.map(([l, v, c], i) => { const prev = us1m ? [tv(us1m, "3M"), tv(us1m, "2Y") != null && tv(us1m, "3M") != null ? tv(us1m, "2Y")! - tv(us1m, "3M")! : null, tv(us1m, "10Y") != null && tv(us1m, "2Y") != null ? tv(us1m, "10Y")! - tv(us1m, "2Y")! : null, tv(us1m, "30Y") != null && tv(us1m, "10Y") != null ? tv(us1m, "30Y")! - tv(us1m, "10Y")! : null][i] : null; return <tr key={l} className={ROW}><td className={TDL}>{l}</td><td className={TD}>{f2(v, 2)}</td><td className={TD}>{f2(prev, 2)}</td><td className={TD} style={{ color: toneOf(v != null && prev != null ? v - prev : null) }}>{v != null && prev != null ? sgn((v - prev) * 100, 0, "") : "—"}</td><td className="px-2"><SignBar v={v} max={5} w={140} /><span className="ml-1 inline-block h-2 w-2" style={{ background: c }} /></td></tr>; })}<tr className={ROW}><td className={`${TDL} text-white`}>合计（10 年期收益率）</td><td className={`${TD} text-white`}>{f2(y10, 2)}</td><td className={TD}>{f2(tv(us1m, "10Y"), 2)}</td><td className={TD} /><td /></tr></tbody></table>; })() : <Empty loading={cv.loading} />}
        <SectionHead title="欧洲主权 10 年期：德国基准 + 国别利差" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>国家</th><th className={TH}>10年(%)</th><th className={TH}>德国基准</th><th className={TH}>国别利差(bp)</th><th className={TH}>利差占比</th><th className={TH}>1月变动(bp)</th><th className={TH}>12月变动(bp)</th><th className={TH}>日期</th></tr></thead>
          <tbody>{(sov.data?.countries ?? []).slice().sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0)).map((c) => <tr key={c.code} className={ROW}><td className={TDL}>{c.name}</td><td className={TD}>{f2(c.y, 2)}</td><td className={TD}>{f2(de?.y, 2)}</td><td className={TD}>{c.spread ?? "—"}</td><td className={TD}>{c.spread != null && c.y ? `${((c.spread / 100 / c.y) * 100).toFixed(0)}%` : "—"}</td><td className={TD} style={{ color: toneOf(c.chg1m) }}>{sgn(c.chg1m, 0, "")}</td><td className={TD} style={{ color: toneOf(c.chg12m) }}>{sgn(c.chg12m, 0, "")}</td><td className={`${TD} text-[10px] text-slate-500`}>{c.date}</td></tr>)}{!sov.data && <tr><td colSpan={8}><Empty loading={sov.loading} /></td></tr>}</tbody></table>
        <Note>美债为财政部每日面值收益率曲线；欧洲为各国央行月度长期利率（欧元区口径），利差相对德国。分解为会计拆分，用于观察收益率变动来自政策预期还是期限 / 信用溢价。</Note>
      </>}
      {tab === "corr" && <>
        <div className="flex items-center gap-2 px-2 py-1"><span className="text-[10px] text-slate-500">窗口</span><Chips value={win} options={[["60", "60 日"], ["120", "120 日"], ["250", "250 日"]]} onChange={setWin} /><span className="ml-auto text-[10px] text-slate-500">日收益相关系数（10 年期收益率用日变动）</span></div>
        {dates.length > 30 ? <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>债券 \ 风险资产</th>{RISK.map(([s, l]) => <th key={s} className={TH}>{l}</th>)}</tr></thead>
          <tbody>{BONDS.map(([b, bl]) => <tr key={b} className={ROW}><td className={TDL}>{bl}<span className="ml-1 font-mono text-[9px] text-slate-600">{b}</span></td>{RISK.map(([s]) => { const c = corrOf(R[b].slice(-Number(win)), R[s].slice(-Number(win))); return <td key={s} className={`${TD} text-white`} style={{ background: heat(c, 1) }}>{f2(c, 2)}</td>; })}</tr>)}</tbody></table> : <Empty loading={pack.loading} />}
        <Note>红色为正相关、绿色为负相关。债券与美股相关为负时，债券具备组合对冲作用；与 10 年期收益率高度负相关说明价格主要由利率驱动。</Note>
      </>}
      {tab === "roll" && (() => {
        const n = Math.min(500, dates.length - 1);
        const roll = (a: string, b: string) => { const ra = R[a] ?? [], rb = R[b] ?? []; const out: Array<number | null> = []; for (let i = ra.length - n; i < ra.length; i++) out.push(i >= 59 ? corrOf(ra.slice(i - 59, i + 1), rb.slice(i - 59, i + 1)) : null); return out; };
        return n > 60 ? <>
          <SectionHead title="60 日滚动相关：美股 vs 长债 / 黄金 / 美元" />
          <Lines series={[{ name: "美股−长债", color: "#38bdf8", values: roll("SPY", "TLT") }, { name: "美股−黄金", color: "#fbbf24", values: roll("SPY", "GC") }, { name: "美股−美元", color: "#a78bfa", values: roll("SPY", "DXY") }]} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={210} zero />
          <SectionHead title="60 日滚动相关：高收益债 vs 美股、长债 vs 原油" />
          <Lines series={[{ name: "高收益−美股", color: "#f97316", values: roll("HYG", "SPY") }, { name: "长债−原油", color: "#34d399", values: roll("TLT", "CL") }]} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={170} zero />
          <Note>股债相关由负转正，意味着通胀 / 利率冲击主导，传统股债组合的分散化效果减弱。</Note>
        </> : <Empty loading={pack.loading} />;
      })()}
      {tab === "hedge" && <>
        {dates.length > 60 ? (() => {
          const spy = R.SPY.slice(-250);
          const worst = spy.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]).slice(0, 25).map((x) => x[1]);
          const rows = HEDGES.map(([h, l]) => { const r = R[h].slice(-250); const c = corrOf(r, spy); const c60 = corrOf(R[h].slice(-60), R.SPY.slice(-60)); const ratio = c != null && sd(r) ? (-c * sd(spy)) / sd(r) : null; const down = avg(worst.map((i) => r[i] ?? 0)) * 100; return { h, l, beta: betaOf(r, spy), c, c60, ratio, vr: c != null ? c * c : null, down }; });
          return <>
            <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>对冲工具</th><th className={TH}>对美股贝塔</th><th className={TH}>相关(1年)</th><th className={TH}>相关(60日)</th><th className={TH}>最优对冲比例</th><th className={TH}>方差降低</th><th className={TH}>美股最差 10% 日均收益</th><th className={THL}>当前判断</th></tr></thead>
              <tbody>{rows.map((x) => { const st = x.c60 == null ? "—" : x.c60 < -0.3 ? "有效" : x.c60 < 0 ? "弱有效" : "失效（同向）"; return <tr key={x.h} className={ROW}><td className={TDL}>{x.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.h}</span></td><td className={TD}>{f2(x.beta, 2)}</td><td className={TD} style={{ background: heat(x.c, 1) }}>{f2(x.c, 2)}</td><td className={TD} style={{ background: heat(x.c60, 1) }}>{f2(x.c60, 2)}</td><td className={TD}>{x.ratio == null ? "—" : `${x.ratio.toFixed(2)} : 1`}</td><td className={TD}>{x.vr == null || (x.c ?? 0) > 0 ? "—" : `${(x.vr * 100).toFixed(0)}%`}</td><td className={TD} style={{ color: toneOf(x.down) }}>{sgn(x.down, 2)}</td><td className={`${TDL} ${st === "有效" ? "text-emerald-300" : st.startsWith("失效") ? "text-red-300" : "text-amber-300"}`}>{st}</td></tr>; })}</tbody></table>
            <Bars data={rows.map((x) => ({ k: x.l, v: x.down }))} fmt={(v) => `${v.toFixed(2)}%`} height={110} />
            <Note>最优对冲比例 = −相关 × 美股波动 ÷ 工具波动（每 1 元美股需配置的工具金额）；方差降低 = 相关系数平方（仅负相关时有意义）；“美股最差 10% 日”取近一年美股跌幅最大的 25 个交易日，看对冲工具同日平均表现。</Note>
          </>;
        })() : <Empty loading={pack.loading} />}
      </>}
    </PanelShell>
  );
}

/* ================================================================== RSAN 地缘风险的市场定价 */
const HAVEN: Array<[string, string, string, number]> = [["GC", "黄金", "避险", 1], ["^GVZ", "黄金波动率", "避险", 1], ["USDJPY", "美元兑日元", "避险", -1], ["USDCHF", "美元兑瑞郎", "避险", -1], ["TLT", "美国长债", "避险", 1], ["^VIX", "美股波动率", "避险", 1], ["CL", "WTI 原油", "能源", 1], ["BRENT", "布伦特原油", "能源", 1], ["NG", "天然气", "能源", 1], ["^OVX", "原油波动率", "能源", 1], ["ITA", "美国军工 ETF", "军工", 1], ["LMT", "洛克希德马丁", "军工", 1], ["NOC", "诺斯罗普格鲁曼", "军工", 1], ["RTX", "雷神技术", "军工", 1], ["ZW", "小麦", "粮食", 1], ["ZC", "玉米", "粮食", 1]];
type Senti = { byCat: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; series: Array<{ t: number; pos: number; neg: number; n: number }>; total: number };

export function EqRSAN({ onClose }: P) {
  const [tab, setTab] = useState("price");
  const syms = HAVEN.map((h) => h[0]);
  const t = useTicks(syms);
  const pack = useCloses([...syms, "SPY", "XLE"], 400);
  const feed = useFeed(tab === "news" ? { cats: ["地缘"], limit: 80, hours: 72, sort: "time" } : null, 60_000);
  const [hrs, setHrs] = useState("24");
  const senti = usePolled<Senti>("ucNews.sentiment", { hours: Number(hrs) }, 300_000);
  const { pick } = useHub();
  const rows = useMemo(() => HAVEN.map(([s, l, g, sign]) => {
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    const r = rets(c.slice(-61));
    const vol = r.length > 10 ? Math.sqrt(r.reduce((a, x) => a + x * x, 0) / r.length) * 100 : null;
    const d = t[s]?.changePct ?? null;
    return { s, l, g, sign, d, z: d != null && vol ? d / vol : null, w1: perf(c, 5), m1: perf(c, 21), m3: perf(c, 63), pct: pctRank(c.slice(-252), t[s]?.price ?? c[c.length - 1]) };
  }), [pack.data, t]);
  const stress = (() => { const z = rows.filter((r) => r.z != null).map((r) => (r.z ?? 0) * r.sign); return z.length ? avg(z) : null; })();
  const geo = senti.data?.byCat.find((c) => c.key === "地缘");
  return (
    <PanelShell code="RSAN" title="地缘风险的市场定价" onClose={onClose} tabs={[["price", "避险资产异动"], ["rel", "军工与能源相对"], ["comm", "商品冲击"], ["news", "地缘新闻与情绪"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["市场避险压力", <span key="s" style={{ color: toneOf(stress) }}>{f2(stress, 2)}</span>, "各资产异动倍数按避险方向平均"], ["黄金", fmtPrice(t.GC?.price), fmtPct(t.GC?.changePct)], ["布伦特", fmtPrice(t.BRENT?.price), fmtPct(t.BRENT?.changePct)], ["地缘新闻情绪", geo ? `${geo.index}` : "—", geo ? `${hrs} 小时 ${geo.count} 条（利好 ${geo.pos} / 利空 ${geo.neg}）` : undefined]]} />
      {tab === "price" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>资产</th><th className={THL}>类别</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>异动倍数</th><th className={TH}>1周</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>1年分位</th></tr></thead>
          <tbody>{[...rows].sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0)).map((r) => <tr key={r.s} onClick={() => pick(r.s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{r.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className="px-2 text-[10px] text-slate-500">{r.g}</td><td className={TD}>{fmtPrice(t[r.s]?.price)}</td><td className={TD} style={{ color: toneOf(r.d) }}>{fmtPct(r.d)}</td><td className={`${TD} text-white`} style={{ background: heat(r.z, 3) }}>{f2(r.z, 2)}</td><td className={TD} style={{ color: toneOf(r.w1) }}>{sgn(r.w1)}</td><td className={TD} style={{ color: toneOf(r.m1) }}>{sgn(r.m1)}</td><td className={TD} style={{ color: toneOf(r.m3) }}>{sgn(r.m3)}</td><td className={TD}>{f2(r.pct, 0, "%")}</td></tr>)}</tbody></table>
        <Note>异动倍数 = 今日涨跌 ÷ 近 60 日日波动；|倍数| &gt; 2 为显著异动。市场避险压力把黄金、长债、波动率、能源、军工上涨与日元 / 瑞郎升值统一记为正向后取平均，用于衡量市场为地缘事件支付的风险溢价，不是事件概率。</Note>
      </>}
      {tab === "rel" && (() => {
        const { dates, m } = align(pack.data ?? null, ["ITA", "XLE", "SPY", "BRENT", "CL"]);
        const n = Math.min(252, dates.length);
        if (n < 20) return <Empty loading={pack.loading} />;
        const rel = (a: string) => m[a].slice(-n).map((v, i) => (v / m[a][m[a].length - n]) / (m.SPY[m.SPY.length - n + i] / m.SPY[m.SPY.length - n]) * 100);
        const bw = m.BRENT.slice(-n).map((v, i) => v - m.CL[m.CL.length - n + i]);
        return <>
          <SectionHead title="相对美股强弱（起点 100）：军工 ETF、能源板块" />
          <Lines series={[{ name: "军工 / 美股", color: "#f97316", values: rel("ITA") }, { name: "能源 / 美股", color: "#fbbf24", values: rel("XLE") }]} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={190} fmt={(v) => v.toFixed(1)} />
          <SectionHead title="布伦特与 WTI 价差（美元 / 桶）" />
          <Lines series={[{ name: "布伦特−WTI", color: "#38bdf8", values: bw }]} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={150} fmt={(v) => v.toFixed(2)} />
          <Kpis items={[["军工相对 1 年", sgn(rel("ITA")[n - 1] - 100)], ["能源相对 1 年", sgn(rel("XLE")[n - 1] - 100)], ["布伦特−WTI", f2(bw[n - 1], 2), `1年分位 ${f2(pctRank(bw, bw[n - 1]), 0, "%")}`], ["军工与原油相关", f2(corrOf(sret(m.ITA.slice(-n)), sret(m.CL.slice(-n))), 2), "日收益，1 年"]]} />
        </>;
      })()}
      {tab === "comm" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>商品</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>当前波动</th><th className={TH}>波动 1 年分位</th><th className="px-2">1年区间</th></tr></thead>
          <tbody>{HAVEN.filter((h) => ["能源", "粮食"].includes(h[2]) || h[0] === "GC").filter((h) => !h[0].startsWith("^")).map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const vols: number[] = []; for (let i = 21; i < c.length; i++) { const v = annVol(c.slice(i - 21, i + 1)); if (v != null) vols.push(v); } const vNow = annVol(c.slice(-22)); const y = c.slice(-252); return <tr key={s} onClick={() => pick(s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{l}</td><td className={TD}>{fmtPrice(t[s]?.price)}</td><td className={TD} style={{ color: toneOf(t[s]?.changePct) }}>{fmtPct(t[s]?.changePct)}</td><td className={TD} style={{ color: toneOf(perf(c, 21)) }}>{sgn(perf(c, 21))}</td><td className={TD} style={{ color: toneOf(perf(c, 63)) }}>{sgn(perf(c, 63))}</td><td className={TD}>{f2(vNow, 1, "%")}</td><td className={TD} style={{ background: heat(((pctRank(vols.slice(-252), vNow) ?? 50) - 50) / 50, 1) }}>{f2(pctRank(vols.slice(-252), vNow), 0, "%")}</td><td className="px-2"><Range lo={y.length ? Math.min(...y) : null} hi={y.length ? Math.max(...y) : null} v={t[s]?.price ?? c[c.length - 1]} /></td></tr>; })}</tbody></table>
        <Note>供给中断规模没有可核验的公开实时数据；本页以价格动量与 21 日波动率在近一年中的分位衡量地缘冲击在商品上的定价程度，分位越高说明不确定性溢价越大。</Note>
      </>}
      {tab === "news" && <>
        <div className="flex items-center gap-2 px-2 py-1"><span className="text-[10px] text-slate-500">情绪统计窗口</span><Chips value={hrs} options={[["24", "24 小时"], ["48", "48 小时"], ["72", "72 小时"]]} onChange={setHrs} /></div>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>新闻分类</th><th className={TH}>条数</th><th className={TH}>利好</th><th className={TH}>利空</th><th className={TH}>情绪指数</th><th className="px-2" /></tr></thead>
          <tbody>{(senti.data?.byCat ?? []).filter((c) => ["地缘", "能源", "商品", "政策", "外汇", "宏观"].includes(c.key)).map((c) => <tr key={c.key} className={ROW}><td className={TDL}>{c.key}</td><td className={TD}>{c.count}</td><td className={TD} style={{ color: UP }}>{c.pos}</td><td className={TD} style={{ color: DOWN }}>{c.neg}</td><td className={TD} style={{ color: toneOf(c.index) }}>{c.index}</td><td className="px-2"><SignBar v={c.index} max={100} /></td></tr>)}</tbody></table>
        <SectionHead title="地缘政治新闻（72 小时）" />
        <FeedList items={feed.items} loading={feed.loading} empty="暂无地缘政治新闻" />
      </>}
    </PanelShell>
  );
}

/* ================================================================== TCON 期权交易控制台 */
type OptRow = { strike: number; type: "C" | "P"; bid: number; ask: number; last: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; volume: number };
type Chain = { symbol: string; spot: number; changePct: number; iv30: number; iv30Change: number; expiries: string[]; expiry: string; chain: Array<{ strike: number; call: OptRow | null; put: OptRow | null }>; maxPain: number; gex: Array<{ strike: number; gex: number }>; stats: { callVolume: number; putVolume: number; callOi: number; putOi: number; pcVolumeAll: number; pcOiAll: number; atmIv: number | null; skew25: number | null; netGex: number }; term: Array<{ exp: string; iv: number | null; oi: number }>; unusual: Array<OptRow & { exp: string }> } | null;
type IvRow = { symbol: string; price: number | null; iv30: number | null; iv30Chg: number | null; rv20: number | null; rv60: number | null; ivRv: number | null; ivRank: number | null; ivPct: number | null; ivDays: number };
const ivp = (v: number | null | undefined) => (v == null || !Number.isFinite(v) || v <= 0 ? null : v > 3 ? v : v * 100);
const OPT_SYMS: Array<[string, string]> = [["SPY", "标普500 ETF"], ["QQQ", "纳指100 ETF"], ["IWM", "罗素2000 ETF"], ["AAPL", "苹果"], ["NVDA", "英伟达"], ["TSLA", "特斯拉"], ["MSFT", "微软"], ["GLD", "黄金 ETF"], ["TLT", "长债 ETF"]];
const MONEY = [0.85, 0.9, 0.95, 0.975, 1, 1.025, 1.05, 1.1, 1.15];
const dte = (exp: string) => Math.max(0.5, (Date.parse(`${exp}T20:00:00Z`) - Date.now()) / 86400e3);
const mid = (o: OptRow | null | undefined) => (o ? (o.bid > 0 && o.ask > 0 ? (o.bid + o.ask) / 2 : o.last) : null);
function ivAt(c: Chain, m: number) {
  if (!c?.chain.length) return null;
  const K = c.spot * m;
  const row = c.chain.reduce((a, b) => (Math.abs(b.strike - K) < Math.abs(a.strike - K) ? b : a));
  const o = K < c.spot ? row.put ?? row.call : row.call ?? row.put;
  return ivp(o?.iv) ?? ivp((K < c.spot ? row.call : row.put)?.iv);
}

function TCONView({ onClose }: P) {
  const [tab, setTab] = useState("surface");
  const [sym, setSym] = useState("SPY");
  const main = usePolled<Chain>("ucHubs.options", { symbol: sym }, 60_000);
  const today = new Date().toISOString().slice(0, 10);
  const exps = (main.data?.expiries ?? []).filter((e) => e >= today);
  const pickIdx = [0, 1, 2, 4, 7, 11].map((i) => exps[Math.min(i, exps.length - 1)]).filter((e, i, a) => e && a.indexOf(e) === i);
  const s0 = usePolled<Chain>("ucHubs.options", pickIdx[0] ? { symbol: sym, expiry: pickIdx[0] } : null, 120_000);
  const s1 = usePolled<Chain>("ucHubs.options", pickIdx[1] ? { symbol: sym, expiry: pickIdx[1] } : null, 120_000);
  const s2 = usePolled<Chain>("ucHubs.options", pickIdx[2] ? { symbol: sym, expiry: pickIdx[2] } : null, 120_000);
  const s3 = usePolled<Chain>("ucHubs.options", pickIdx[3] ? { symbol: sym, expiry: pickIdx[3] } : null, 120_000);
  const s4 = usePolled<Chain>("ucHubs.options", pickIdx[4] ? { symbol: sym, expiry: pickIdx[4] } : null, 120_000);
  const s5 = usePolled<Chain>("ucHubs.options", pickIdx[5] ? { symbol: sym, expiry: pickIdx[5] } : null, 120_000);
  const surf = [s0, s1, s2, s3, s4, s5].map((x) => x.data).filter((x): x is NonNullable<Chain> => !!x);
  const [exp, setExp] = useState<string | null>(null);
  const curExp = exp && exps.includes(exp) ? exp : exps[1] ?? exps[0] ?? null;
  const ch = usePolled<Chain>("ucHubs.options", curExp ? { symbol: sym, expiry: curExp } : null, 60_000);
  const scan = usePolled<IvRow[]>("ucHubs.ivScan", tab === "signal" ? { symbols: OPT_SYMS.map((x) => x[0]).concat(["AMZN", "META", "GOOGL", "XLE", "EEM"]) } : null, 300_000);
  const [strat, setStrat] = useState("straddle");
  const c = ch.data;
  const spot = c?.spot ?? main.data?.spot ?? null;
  const atm = c?.stats.atmIv != null ? ivp(c.stats.atmIv) : null;
  return (
    <PanelShell code="TCON" title="期权交易控制台" onClose={onClose} tabs={[["surface", "波动率曲面"], ["greeks", "动态 Greeks"], ["pnl", "策略盈亏分布"], ["cone", "隐含波动锥"], ["signal", "实战信号"]]} tab={tab} setTab={setTab}>
      <div className="flex flex-wrap items-center gap-2 px-2 py-1"><Chips value={sym} options={OPT_SYMS} onChange={(v) => { setSym(v); setExp(null); }} /></div>
      <Kpis items={[["标的价格", fmtPrice(main.data?.spot), main.data ? fmtPct(main.data.changePct) : undefined], ["30 日隐含波动", f2(ivp(main.data?.iv30), 2, "%"), main.data ? `变动 ${sgn(main.data.iv30Change, 2, "")}` : undefined], ["认沽 / 认购（成交量）", f2(main.data?.stats.pcVolumeAll, 2), `持仓量 ${f2(main.data?.stats.pcOiAll, 2)}`], ["最大痛点", fmtPrice(c?.maxPain ?? main.data?.maxPain), curExp ?? undefined]]} />
      {tab === "surface" && <>
        <SectionHead title="隐含波动率曲面（行：行权价 / 现价；列：到期日）" />
        {surf.length ? <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>K / S</th>{surf.map((x) => <th key={x.expiry} className={TH}>{x.expiry.slice(2)}<div className="text-[9px] text-slate-600">{dte(x.expiry).toFixed(0)} 天</div></th>)}</tr></thead>
          <tbody>{MONEY.map((mm) => <tr key={mm} className={ROW}><td className={`${TDL} font-mono ${mm === 1 ? "text-amber-300" : ""}`}>{(mm * 100).toFixed(1)}%</td>{surf.map((x) => { const v = ivAt(x, mm); const a = ivp(x.stats.atmIv); return <td key={x.expiry} className={`${TD} text-white`} style={{ background: heat(v != null && a != null ? (v - a) / Math.max(1, a) : null, 0.4) }}>{f2(v, 1)}</td>; })}</tr>)}
            <tr className={ROW}><td className={`${TDL} text-slate-400`}>25Δ 偏度</td>{surf.map((x) => <td key={x.expiry} className={TD}>{f2(ivp(x.stats.skew25 != null ? Math.abs(x.stats.skew25) : null) != null && x.stats.skew25 != null ? (x.stats.skew25 > 3 || x.stats.skew25 < -3 ? x.stats.skew25 : x.stats.skew25 * 100) : null, 2)}</td>)}</tr></tbody></table> : <Empty loading={main.loading || s0.loading} text="该标的暂无期权数据" />}
        <SectionHead title="平值隐含波动期限结构" />
        {(main.data?.term?.length ?? 0) > 1 ? <Lines series={[{ name: "平值 IV(%)", color: "#fbbf24", values: main.data!.term.map((x) => ivp(x.iv)) }]} xLabels={main.data!.term.map((x) => x.exp.slice(5))} height={150} fmt={(v) => v.toFixed(1)} /> : <Empty loading={main.loading} />}
        <Note>颜色表示相对同到期平值波动的溢价（红高绿低）；低于现价的行权价取认沽、高于现价取认购。25Δ 偏度 = 25Δ 认沽 IV − 25Δ 认购 IV（百分点），正值表示下行保护更贵。</Note>
      </>}
      {tab === "greeks" && <>
        <div className="flex flex-wrap items-center gap-1 px-2 py-1"><span className="text-[10px] text-slate-500">到期日</span>{exps.slice(0, 12).map((e) => <button key={e} type="button" onClick={() => setExp(e)} className={`border px-1.5 text-[10px] ${curExp === e ? "border-cyan-500 text-cyan-100" : "border-[#1d3047] text-slate-400"}`}>{e.slice(5)}</button>)}</div>
        {c ? <>
          <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={TH}>认购 IV</th><th className={TH}>Δ</th><th className={TH}>Γ</th><th className={TH}>Θ</th><th className={TH}>Vega</th><th className={TH}>买/卖</th><th className={TH}>持仓</th><th className="px-2 py-1 text-center font-normal text-amber-300">行权价</th><th className={TH}>持仓</th><th className={TH}>买/卖</th><th className={TH}>Vega</th><th className={TH}>Θ</th><th className={TH}>Γ</th><th className={TH}>Δ</th><th className={TH}>认沽 IV</th></tr></thead>
            <tbody>{c.chain.filter((r) => Math.abs(r.strike / c.spot - 1) < 0.08).map((r) => { const itmC = r.strike < c.spot; return <tr key={r.strike} className={ROW}><td className={TD} style={{ background: itmC ? "#0b1a28" : undefined }}>{f2(ivp(r.call?.iv), 1)}</td><td className={TD}>{f2(r.call?.delta, 3)}</td><td className={TD}>{f2(r.call?.gamma, 4)}</td><td className={TD}>{f2(r.call?.theta, 3)}</td><td className={TD}>{f2(r.call?.vega, 3)}</td><td className={`${TD} text-[10px]`}>{r.call ? `${r.call.bid.toFixed(2)}/${r.call.ask.toFixed(2)}` : "—"}</td><td className={TD}>{fmtCompact(r.call?.oi)}</td><td className="px-2 text-center font-mono text-amber-200">{r.strike}</td><td className={TD}>{fmtCompact(r.put?.oi)}</td><td className={`${TD} text-[10px]`}>{r.put ? `${r.put.bid.toFixed(2)}/${r.put.ask.toFixed(2)}` : "—"}</td><td className={TD}>{f2(r.put?.vega, 3)}</td><td className={TD}>{f2(r.put?.theta, 3)}</td><td className={TD}>{f2(r.put?.gamma, 4)}</td><td className={TD}>{f2(r.put?.delta, 3)}</td><td className={TD} style={{ background: !itmC ? "#0b1a28" : undefined }}>{f2(ivp(r.put?.iv), 1)}</td></tr>; })}</tbody></table>
          <SectionHead title="伽马敞口（做市商视角，每 1% 标的变动对应名义金额）" right={<span className="text-[10px] text-slate-500">净 GEX {fmtCompact(c.stats.netGex)}</span>} />
          <Bars data={c.gex.filter((g) => Math.abs(g.strike / c.spot - 1) < 0.1).map((g) => ({ k: String(g.strike), v: g.gex }))} height={130} />
        </> : <Empty loading={ch.loading} />}
      </>}
      {tab === "pnl" && <StratPnl c={c} atm={atm} strat={strat} setStrat={setStrat} loading={ch.loading} />}
      {tab === "cone" && (() => {
        const term = (main.data?.term ?? []).filter((x) => ivp(x.iv) != null && x.exp >= today).map((x) => ({ d: dte(x.exp), v: ivp(x.iv)! / 100 }));
        if (!term.length || spot == null) return <Empty loading={main.loading} />;
        const maxD = Math.min(365, term[term.length - 1].d);
        const days = Array.from({ length: 41 }, (_, i) => (maxD * i) / 40);
        const volAt = (d: number) => { if (d <= term[0].d) return term[0].v; for (let i = 1; i < term.length; i++) if (d <= term[i].d) { const a = term[i - 1], b = term[i]; return a.v + ((b.v - a.v) * (d - a.d)) / (b.d - a.d); } return term[term.length - 1].v; };
        const band = (z: number) => days.map((d) => spot * Math.exp(z * volAt(d) * Math.sqrt(d / 365) - 0.5 * volAt(d) ** 2 * (d / 365)));
        return <>
          <SectionHead title={`${sym} 隐含价格区间（按期限结构 IV 推算的 ±1σ / ±2σ）`} />
          <Lines series={[{ name: "+2σ", color: "#f2495c", values: band(2), dash: true }, { name: "+1σ", color: "#f97316", values: band(1) }, { name: "中位", color: "#e2e8f0", values: band(0) }, { name: "−1σ", color: "#34d399", values: band(-1) }, { name: "−2σ", color: "#1fbf75", values: band(-2), dash: true }]} xLabels={days.map((d) => `${d.toFixed(0)}天`)} height={220} fmt={(v) => v.toFixed(1)} />
          <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>期限</th><th className={TH}>IV</th><th className={TH}>−2σ</th><th className={TH}>−1σ</th><th className={TH}>+1σ</th><th className={TH}>+2σ</th><th className={TH}>±1σ 幅度</th></tr></thead>
            <tbody>{[7, 30, 60, 90, 180].filter((d) => d <= maxD + 1).map((d) => { const v = volAt(d); const q = (z: number) => spot * Math.exp(z * v * Math.sqrt(d / 365)); return <tr key={d} className={ROW}><td className={TDL}>{d} 天</td><td className={TD}>{(v * 100).toFixed(1)}%</td><td className={TD}>{fmtPrice(q(-2))}</td><td className={TD}>{fmtPrice(q(-1))}</td><td className={TD}>{fmtPrice(q(1))}</td><td className={TD}>{fmtPrice(q(2))}</td><td className={TD}>±{(v * Math.sqrt(d / 365) * 100).toFixed(1)}%</td></tr>; })}</tbody></table>
          <Note>以实时期权平值隐含波动的期限结构，按对数正态分布推算未来价格分位（不含漂移），替代随机路径模拟：结果确定、可复核。</Note>
        </>;
      })()}
      {tab === "signal" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>标的</th><th className={TH}>IV30</th><th className={TH}>RV20</th><th className={TH}>IV − RV</th><th className={TH}>IV 区间位置</th><th className={TH}>IV 分位</th><th className={TH}>样本天数</th><th className={THL}>信号</th></tr></thead>
          <tbody>{(scan.data ?? []).map((r) => { const iv = ivp(r.iv30), rv = ivp(r.rv20); const spread = iv != null && rv != null ? iv - rv : null; const sig = r.ivRank != null && spread != null ? (r.ivRank > 70 && spread > 3 ? "隐波偏贵：卖出波动率（备兑 / 卖出跨式）" : r.ivRank < 25 && spread < 0 ? "隐波偏便宜：买入波动率（买入跨式 / 日历价差）" : "中性") : spread != null ? (spread > 5 ? "隐波高于实波" : spread < -2 ? "隐波低于实波" : "中性") : "—"; return <tr key={r.symbol} onClick={() => { setSym(r.symbol); setTab("surface"); }} className={`${ROW} cursor-pointer`}><td className={`${TDL} font-mono text-cyan-200`}>{r.symbol}</td><td className={TD}>{f2(iv, 1)}</td><td className={TD}>{f2(rv, 1)}</td><td className={TD} style={{ color: toneOf(spread) }}>{sgn(spread, 1, "")}</td><td className={TD}>{f2(r.ivRank, 0, "%")}</td><td className={TD}>{f2(r.ivPct, 0, "%")}</td><td className={TD}>{r.ivDays}</td><td className={`${TDL} ${sig.startsWith("隐波偏贵") ? "text-red-300" : sig.startsWith("隐波偏便宜") ? "text-emerald-300" : "text-slate-400"}`}>{sig}</td></tr>; })}{!scan.data && <tr><td colSpan={8}><Empty loading={scan.loading} /></td></tr>}</tbody></table>
        <SectionHead title={`${sym} 异常成交（成交量 > 500 且 > 1.5 倍持仓量）`} />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>到期</th><th className={TH}>行权价</th><th className={THL}>类型</th><th className={TH}>成交量</th><th className={TH}>持仓量</th><th className={TH}>IV</th><th className={TH}>Δ</th><th className={TH}>最新价</th></tr></thead>
          <tbody>{(main.data?.unusual ?? []).map((u, i) => <tr key={i} className={ROW}><td className={`${TDL} font-mono`}>{u.exp}</td><td className={TD}>{u.strike}</td><td className={TDL} style={{ color: u.type === "C" ? UP : DOWN }}>{u.type === "C" ? "认购" : "认沽"}</td><td className={TD}>{fmtCompact(u.volume)}</td><td className={TD}>{fmtCompact(u.oi)}</td><td className={TD}>{f2(ivp(u.iv), 1)}</td><td className={TD}>{f2(u.delta, 2)}</td><td className={TD}>{f2(u.last, 2)}</td></tr>)}{!main.data?.unusual?.length && <tr><td colSpan={8}><Empty loading={main.loading} text="暂无异常成交" /></td></tr>}</tbody></table>
        <Note>IV 区间位置 = 当前 30 日隐波在平台累计的历史隐波区间中的位置（样本天数不足 20 时不判定），信号规则：位置 &gt; 70% 且 IV−RV &gt; 3 个百分点 → 偏贵；位置 &lt; 25% 且 IV &lt; RV → 偏便宜。点击行切换到该标的的曲面。</Note>
      </>}
    </PanelShell>
  );
}
export const EqTCON = TCONView;

function StratPnl({ c, atm, strat, setStrat, loading }: { c: Chain; atm: number | null; strat: string; setStrat: (s: string) => void; loading: boolean }) {
  if (!c || atm == null) return <Empty loading={loading} />;
  const S = c.spot;
  const near = (k: number) => c.chain.reduce((a, b) => (Math.abs(b.strike - k) < Math.abs(a.strike - k) ? b : a));
  const A = near(S), U5 = near(S * 1.05), D5 = near(S * 0.95), U10 = near(S * 1.1), D10 = near(S * 0.9);
  type Leg = { kind: "C" | "P" | "S"; k: number; q: number; px: number | null };
  const legs: Record<string, [string, Leg[]]> = {
    straddle: ["买入平值跨式", [{ kind: "C", k: A.strike, q: 1, px: mid(A.call) }, { kind: "P", k: A.strike, q: 1, px: mid(A.put) }]],
    bull: ["牛市认购价差", [{ kind: "C", k: A.strike, q: 1, px: mid(A.call) }, { kind: "C", k: U5.strike, q: -1, px: mid(U5.call) }]],
    covered: ["备兑认购", [{ kind: "S", k: S, q: 1, px: S }, { kind: "C", k: U5.strike, q: -1, px: mid(U5.call) }]],
    protect: ["保护性认沽", [{ kind: "S", k: S, q: 1, px: S }, { kind: "P", k: D5.strike, q: 1, px: mid(D5.put) }]],
    condor: ["卖出铁鹰", [{ kind: "P", k: D10.strike, q: 1, px: mid(D10.put) }, { kind: "P", k: D5.strike, q: -1, px: mid(D5.put) }, { kind: "C", k: U5.strike, q: -1, px: mid(U5.call) }, { kind: "C", k: U10.strike, q: 1, px: mid(U10.call) }]],
  };
  const [name, L] = legs[strat];
  if (L.some((l) => l.px == null)) return <Empty text="该到期日部分合约缺少报价" />;
  const T = dte(c.expiry) / 365, v = atm / 100;
  const pay = (x: number) => L.reduce((a, l) => a + l.q * ((l.kind === "C" ? Math.max(0, x - l.k) : l.kind === "P" ? Math.max(0, l.k - x) : x) - (l.px ?? 0)), 0);
  const grid = Array.from({ length: 81 }, (_, i) => S * (0.7 + (0.6 * i) / 80));
  const cdf = (x: number) => ncdf((Math.log(x / S) + 0.5 * v * v * T) / (v * Math.sqrt(T)));
  let ev = 0, pop = 0;
  for (let i = 1; i < grid.length; i++) { const p = cdf(grid[i]) - cdf(grid[i - 1]); const pl = pay((grid[i] + grid[i - 1]) / 2); ev += p * pl; if (pl > 0) pop += p; }
  const be = grid.filter((x, i) => i > 0 && Math.sign(pay(x)) !== Math.sign(pay(grid[i - 1])));
  const pls = grid.map(pay);
  return <>
    <div className="px-2 py-1"><Chips value={strat} options={Object.entries(legs).map(([k, [l]]) => [k, l] as [string, string])} onChange={setStrat} /></div>
    <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>腿</th><th className={TH}>方向</th><th className={TH}>行权价</th><th className={TH}>价格（中间价）</th></tr></thead>
      <tbody>{L.map((l, i) => <tr key={i} className={ROW}><td className={TDL}>{l.kind === "S" ? "标的" : l.kind === "C" ? "认购" : "认沽"}</td><td className={TD} style={{ color: l.q > 0 ? UP : DOWN }}>{l.q > 0 ? "买入" : "卖出"}</td><td className={TD}>{l.kind === "S" ? "—" : l.k}</td><td className={TD}>{f2(l.px, 2)}</td></tr>)}</tbody></table>
    <Kpis items={[["策略", name, `到期 ${c.expiry}`], ["期望损益（每股）", <span key="e" style={{ color: toneOf(ev) }}>{ev.toFixed(2)}</span>, `平值 IV ${atm.toFixed(1)}%`], ["盈利概率", `${(pop * 100).toFixed(1)}%`], ["盈亏平衡点", be.length ? be.map((x) => x.toFixed(1)).join(" / ") : "—"]]} />
    <Lines series={[{ name: "到期损益（每股）", color: "#fbbf24", values: pls }]} xLabels={grid.map((x) => x.toFixed(0))} height={190} fmt={(x) => x.toFixed(1)} zero />
    <Bars data={grid.slice(1).filter((_, i) => i % 2 === 0).map((x, i) => ({ k: x.toFixed(0), v: (cdf(x) - cdf(grid[i * 2])) * 100 }))} fmt={(x) => `${x.toFixed(2)}%`} height={90} />
    <Note>到期损益按实时期权中间价计算；价格分布采用平值隐含波动的对数正态分布（无漂移）解析积分得到，上图为损益曲线，下图为到期价格落在各区间的概率。</Note>
  </>;
}

/* ================================================================== BCMP 美元利率衍生品目录 */
type MM = { series: Record<string, Array<{ d: string; v: number; vol: number | null }>>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>; sofrStrip: Array<{ month: string; rate: number; chg: number | null; volume: number | null }> };
type FutC = { root: string; name: string; unit: string; structure: string; slopePct: number | null; points: Array<{ code: string; month: string; price: number; change: number | null; changePct: number | null; volume: number | null }> };
const MENU: Array<[string, string, string]> = [["strip", "1", "SOFR 期货条（隐含远期利率）"], ["path", "2", "联邦基金期货隐含政策路径"], ["basis", "3", "SOFR 基差（对 EFFR / 三方回购）"], ["fwd", "4", "远期利率矩阵"], ["curve", "5", "美国国债曲线"], ["spread", "6", "期限利差"], ["tfut", "7", "美国国债期货"]];
const TY: Record<string, number> = { "1M": 1 / 12, "2M": 2 / 12, "3M": 0.25, "4M": 4 / 12, "6M": 0.5, "1Y": 1, "2Y": 2, "3Y": 3, "5Y": 5, "7Y": 7, "10Y": 10, "20Y": 20, "30Y": 30 };

export function EqBCMP({ onClose }: P) {
  const [node, setNode] = useState("strip");
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 900_000);
  const cv = useCurves();
  const tf = usePolled<FutC[]>("ucHubs.futuresMany", node === "tfut" ? { roots: ["ZT", "ZF", "ZN", "ZB", "UB"] } : null, 120_000);
  const mid0 = mm.data?.target.from != null && mm.data?.target.to != null ? (mm.data.target.from + mm.data.target.to) / 2 : null;
  const us = cv.data?.us ?? [];
  const yAt = (c: UsCurve | undefined, t: number) => { if (!c) return null; const p = c.points.map((x) => [TY[x.tenor], x.value] as [number, number]).filter(([a]) => a != null).sort((a, b) => a[0] - b[0]); if (!p.length) return null; if (t <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (t <= p[i][0]) { const [t0, r0] = p[i - 1], [t1, r1] = p[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0); } return p[p.length - 1][1]; };
  const fwd = (c: UsCurve | undefined, a: number, b: number) => { const ya = yAt(c, a), yb = yAt(c, b); if (ya == null || yb == null) return null; return (((1 + yb / 100) ** b / (1 + ya / 100) ** a) ** (1 / (b - a)) - 1) * 100; };
  return (
    <PanelShell code="BCMP" title="美元利率衍生品目录" onClose={onClose} right={mid0 != null ? <span>政策利率区间中值 {mid0.toFixed(3)}%</span> : null}>
      <div className="grid min-h-[420px] grid-cols-[220px_minmax(0,1fr)] gap-px bg-[#1a2a3c]">
        <div className="bg-[#050b13]">{MENU.map(([id, n, l]) => <button key={id} type="button" onClick={() => setNode(id)} className={`flex w-full items-center gap-2 border-b border-[#0f1b29] px-2 py-1 text-left text-[11px] ${node === id ? "bg-[#0d2236] text-white" : "text-slate-300 hover:bg-[#0a1726]"}`}><span className="font-mono text-amber-300">{n})</span>{l}</button>)}
          <Note>掉期做市报价无公开实时来源，本目录以交易所利率期货与国债曲线推算对应的远期利率与政策预期。</Note></div>
        <div className="bg-[#03070c]">
          {node === "strip" && <>{mm.data?.sofrStrip?.length ? <>
            <Lines series={[{ name: "隐含 3 个月 SOFR(%)", color: "#38bdf8", values: mm.data.sofrStrip.map((x) => x.rate) }]} xLabels={mm.data.sofrStrip.map((x) => x.month.slice(2))} height={180} fmt={(v) => v.toFixed(2)} />
            <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>合约月</th><th className={TH}>隐含利率(%)</th><th className={TH}>日变动(bp)</th><th className={TH}>相对当前政策中值(bp)</th><th className={TH}>成交量</th></tr></thead>
              <tbody>{mm.data.sofrStrip.map((x) => <tr key={x.month} className={ROW}><td className={`${TDL} font-mono`}>{x.month}</td><td className={TD}>{x.rate.toFixed(3)}</td><td className={TD} style={{ color: toneOf(x.chg) }}>{x.chg == null ? "—" : sgn(x.chg * 100, 1, "")}</td><td className={TD} style={{ color: toneOf(mid0 != null ? x.rate - mid0 : null) }}>{mid0 != null ? sgn((x.rate - mid0) * 100, 0, "") : "—"}</td><td className={TD}>{fmtCompact(x.volume)}</td></tr>)}</tbody></table></> : <Empty loading={mm.loading} />}</>}
          {node === "path" && <>{mm.data?.path?.length ? <>
            <Bars data={mm.data.path.map((x) => ({ k: x.month.slice(2), v: -(x.cuts ?? 0) }))} fmt={(v) => `${v.toFixed(2)} 次`} height={140} />
            <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>月份</th><th className={TH}>隐含利率(%)</th><th className={TH}>日变动(bp)</th><th className={TH}>隐含累计降息（25bp 次）</th></tr></thead>
              <tbody>{mm.data.path.map((x) => <tr key={x.month} className={ROW}><td className={`${TDL} font-mono`}>{x.month}</td><td className={TD}>{x.rate.toFixed(3)}</td><td className={TD} style={{ color: toneOf(x.chg) }}>{x.chg == null ? "—" : sgn(x.chg * 100, 1, "")}</td><td className={TD} style={{ color: toneOf(x.cuts == null ? null : -x.cuts) }}>{f2(x.cuts, 2)}</td></tr>)}</tbody></table>
            <Note>隐含利率 = 100 − 30 天联邦基金期货价格；累计降息次数 = (当前目标区间中值 − 隐含利率) ÷ 25bp，柱状图向下为降息。</Note></> : <Empty loading={mm.loading} />}</>}
          {node === "basis" && (() => {
            const s = mm.data?.series ?? {};
            const em = new Map((s.EFFR ?? []).map((x) => [x.d, x.v])); const tm = new Map((s.TGCR ?? []).map((x) => [x.d, x.v]));
            const rows = (s.SOFR ?? []).filter((x) => em.has(x.d) && tm.has(x.d)).slice(-180).map((x) => ({ d: x.d, se: (x.v - em.get(x.d)!) * 100, st: (x.v - tm.get(x.d)!) * 100, vol: x.vol }));
            if (!rows.length) return <Empty loading={mm.loading} />;
            const l = rows[rows.length - 1];
            return <>
              <Kpis items={[["SOFR − EFFR", `${l.se.toFixed(0)}bp`, l.d], ["SOFR − TGCR", `${l.st.toFixed(0)}bp`], ["SOFR 成交量", l.vol != null ? `${l.vol} 十亿美元` : "—"], ["SOFR−EFFR 半年分位", f2(pctRank(rows.map((r) => r.se), l.se), 0, "%")]]} />
              <Lines series={[{ name: "SOFR−EFFR(bp)", color: "#fbbf24", values: rows.map((r) => r.se) }, { name: "SOFR−TGCR(bp)", color: "#38bdf8", values: rows.map((r) => r.st) }]} xLabels={rows.map((r) => r.d.slice(5))} height={190} fmt={(v) => v.toFixed(0)} zero />
              <Note>SOFR 高于 EFFR 说明担保融资（回购）比无担保拆借更紧张，常见于季末、缴税日与国债大量发行结算日；这是 SOFR/EFFR 基差掉期定价的核心驱动。</Note>
            </>;
          })()}
          {node === "fwd" && (() => {
            const c0 = us[0], c1 = us[21];
            if (!c0) return <Empty loading={cv.loading} />;
            const starts = [0, 1, 2, 3, 5, 10], tenors = [1, 2, 5, 10];
            return <>
              <SectionHead title={`远期利率矩阵（%，${c0.date}）：行 = 起始年，列 = 期限`} />
              <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>起始 \ 期限</th>{tenors.map((n) => <th key={n} className={TH}>{n} 年</th>)}</tr></thead>
                <tbody>{starts.map((a) => <tr key={a} className={ROW}><td className={`${TDL} font-mono`}>{a === 0 ? "即期" : `${a} 年后`}</td>{tenors.map((n) => { const f = a === 0 ? yAt(c0, n) : fwd(c0, a, a + n); const p = a === 0 ? yAt(c1, n) : fwd(c1, a, a + n); return <td key={n} className={TD}>{a + n > 30 ? "—" : <>{f2(f, 3)}<span className="ml-1 text-[9px]" style={{ color: toneOf(f != null && p != null ? f - p : null) }}>{f != null && p != null ? sgn((f - p) * 100, 0, "") : ""}</span></>}</td>; })}</tr>)}</tbody></table>
              <Note>由财政部面值收益率曲线（线性插值，按年复利近似）推算，右侧小字为相对 1 个月前的变动（bp）。5 年后 5 年远期常被用作长期通胀与中性利率预期的观察指标。</Note>
            </>;
          })()}
          {node === "curve" && (() => {
            const c0 = us[0], c1 = us[21], c2 = us[Math.min(us.length - 1, 250)];
            if (!c0) return <Empty loading={cv.loading} />;
            const ten = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
            return <>
              <Lines series={[{ name: `今日 ${c0.date}`, color: "#fbbf24", values: ten.map((x) => tv(c0, x)) }, { name: "1 月前", color: "#38bdf8", values: ten.map((x) => tv(c1, x)), dash: true }, { name: "1 年前", color: "#64748b", values: ten.map((x) => tv(c2, x)), dash: true }]} xLabels={ten} height={190} fmt={(v) => v.toFixed(2)} />
              <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>期限</th><th className={TH}>今日</th><th className={TH}>1月变动(bp)</th><th className={TH}>1年变动(bp)</th></tr></thead>
                <tbody>{ten.map((x) => { const a = tv(c0, x), b = tv(c1, x), d = tv(c2, x); return <tr key={x} className={ROW}><td className={`${TDL} font-mono`}>{x}</td><td className={TD}>{f2(a, 3)}</td><td className={TD} style={{ color: toneOf(a != null && b != null ? a - b : null) }}>{a != null && b != null ? sgn((a - b) * 100, 0, "") : "—"}</td><td className={TD} style={{ color: toneOf(a != null && d != null ? a - d : null) }}>{a != null && d != null ? sgn((a - d) * 100, 0, "") : "—"}</td></tr>; })}</tbody></table>
            </>;
          })()}
          {node === "spread" && <>{cv.data?.spreads?.length ? <>
            <Lines series={[{ name: "2s10s(bp)", color: "#fbbf24", values: cv.data.spreads.map((x) => x.s2s10) }, { name: "3m10y(bp)", color: "#38bdf8", values: cv.data.spreads.map((x) => x.s3m10) }, { name: "5s30s(bp)", color: "#a78bfa", values: cv.data.spreads.map((x) => x.s5s30) }]} xLabels={cv.data.spreads.map((x) => x.date.slice(2))} height={210} fmt={(v) => v.toFixed(0)} zero />
            <Kpis items={(["s2s10", "s3m10", "s5s30"] as const).map((k) => { const arr = cv.data!.spreads.map((x) => x[k]).filter((v): v is number => v != null); const l = arr[arr.length - 1]; return [k === "s2s10" ? "2 年 − 10 年" : k === "s3m10" ? "3 月 − 10 年" : "5 年 − 30 年", l != null ? `${l}bp` : "—", `一年分位 ${f2(pctRank(arr, l), 0, "%")}`] as [string, string, string]; })} />
          </> : <Empty loading={cv.loading} />}</>}
          {node === "tfut" && <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>品种</th><th className={THL}>合约</th><th className={TH}>价格</th><th className={TH}>涨跌</th><th className={TH}>涨跌幅</th><th className={TH}>成交量</th></tr></thead>
            <tbody>{(tf.data ?? []).filter(Boolean).flatMap((c) => c.points.map((p, i) => <tr key={`${c.root}${p.code}`} className={ROW}><td className={TDL}>{i === 0 ? c.name : ""}</td><td className={`${TDL} font-mono`}>{p.code}<span className="ml-1 text-[9px] text-slate-500">{p.month}</span></td><td className={TD}>{p.price.toFixed(4)}</td><td className={TD} style={{ color: toneOf(p.change) }}>{p.change == null ? "—" : `${p.change > 0 ? "+" : ""}${(p.change * 32).toFixed(1)}/32`}</td><td className={TD} style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td><td className={TD}>{fmtCompact(p.volume)}</td></tr>))}{!tf.data && <tr><td colSpan={6}><Empty loading={tf.loading} /></td></tr>}</tbody></table>}
        </div>
      </div>
    </PanelShell>
  );
}

/* ================================================================== SRSK 主权风险监测 */
const EM: Array<[string, string]> = [["EMB", "新兴市场美元主权债"], ["EMLC", "新兴市场本币债"], ["EWZ", "巴西"], ["EWW", "墨西哥"], ["TUR", "土耳其"], ["EZA", "南非"], ["INDA", "印度"], ["FXI", "中国大盘"], ["EIDO", "印尼"], ["ECH", "智利"], ["ARGT", "阿根廷"], ["EWY", "韩国"]];
type Reg = { id: string; at: string; factor: string; evidence: string; owner: string; status: "open" | "reviewed" };

export function EqSRSK({ onClose }: P) {
  const [tab, setTab] = useState("eu");
  const sov = usePolled<Sov>("ucHubs.sovereign", {}, 3600_000);
  const pack = useCloses(EM.map((e) => e[0]).concat(["SPY"]), 800);
  const t = useTicks(EM.map((e) => e[0]));
  const cv = useCurves();
  const saved = useSaved<Reg[]>("srskreg");
  const [list, setList] = useState<Reg[] | null>(null);
  const regs = list ?? saved.data ?? [];
  const persist = (n: Reg[]) => { setList(n); void saveItem("srskreg", n); };
  const [f, setF] = useState({ factor: "", evidence: "", owner: "" });
  const [selC, setSelC] = useState("IT");
  const { pick } = useHub();
  const countries = (sov.data?.countries ?? []).slice().sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0));
  const cur = countries.find((c) => c.code === selC) ?? countries[0];
  return (
    <PanelShell code="SRSK" title="主权风险监测" onClose={onClose} tabs={[["eu", "欧洲主权利差"], ["em", "新兴市场压力"], ["us", "美国期限风险"], ["reg", `风险登记（${regs.length}）`]]} tab={tab} setTab={setTab}>
      {tab === "eu" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>国家</th><th className={TH}>10年(%)</th><th className={TH}>对德利差(bp)</th><th className={TH}>1月前</th><th className={TH}>12月前</th><th className={TH}>1月变动</th><th className={TH}>12月变动</th><th className={TH}>利差历史分位</th><th className="px-2">利差走势</th></tr></thead>
          <tbody>{countries.map((c) => { const hs = c.hist.map((h) => h.s).filter((v): v is number => v != null); return <tr key={c.code} onClick={() => setSelC(c.code)} className={`${ROW} cursor-pointer ${cur?.code === c.code ? "bg-[#0d2236]" : ""}`}><td className={TDL}>{c.name}</td><td className={TD}>{f2(c.y, 2)}</td><td className={`${TD} text-white`}>{c.spread ?? "—"}</td><td className={TD}>{c.spread1m ?? "—"}</td><td className={TD}>{c.spread12m ?? "—"}</td><td className={TD} style={{ color: toneOf(c.spread != null && c.spread1m != null ? c.spread - c.spread1m : null) }}>{c.spread != null && c.spread1m != null ? sgn(c.spread - c.spread1m, 0, "") : "—"}</td><td className={TD} style={{ color: toneOf(c.spread != null && c.spread12m != null ? c.spread - c.spread12m : null) }}>{c.spread != null && c.spread12m != null ? sgn(c.spread - c.spread12m, 0, "") : "—"}</td><td className={TD} style={{ background: heat(((pctRank(hs, c.spread) ?? 50) - 50) / 50, 1) }}>{f2(pctRank(hs, c.spread), 0, "%")}</td><td className="px-2"><Mini values={hs.slice(-36)} color="#fbbf24" /></td></tr>; })}{!countries.length && <tr><td colSpan={9}><Empty loading={sov.loading} /></td></tr>}</tbody></table>
        {cur && <><SectionHead title={`${cur.name}：10 年期收益率与对德利差（月度）`} /><Lines series={[{ name: "10年收益率(%)", color: "#38bdf8", values: cur.hist.map((h) => h.y) }, { name: "对德利差(%)", color: "#fbbf24", values: cur.hist.map((h) => (h.s == null ? null : h.s / 100)) }]} xLabels={cur.hist.map((h) => h.d)} height={180} fmt={(v) => v.toFixed(2)} /></>}
        <Note>欧元区口径的月度长期国债收益率；利差相对德国。点击国家查看历史。</Note>
      </>}
      {tab === "em" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>市场代理</th><th className={TH}>最新</th><th className={TH}>今日</th><th className={TH}>20日</th><th className={TH}>3年最差 20 日</th><th className={TH}>当前回撤</th><th className={TH}>3年最大回撤</th><th className={TH}>年化波动</th><th className={TH}>对美股贝塔</th><th className={TH}>压力指数</th></tr></thead>
          <tbody>{EM.map(([s, l]) => { const c = (pack.data?.[s] ?? []).map((x) => x[1]); const sp = (pack.data?.SPY ?? []).map((x) => x[1]); let worst: number | null = null; for (let i = 20; i < c.length; i++) { const r = (c[i] / c[i - 20] - 1) * 100; worst = worst == null ? r : Math.min(worst, r); } const r20 = perf(c, 20); const dd = c.length ? drawdown(c) : null; const stress = r20 != null && worst != null && worst < 0 ? Math.max(0, Math.min(100, (r20 / worst) * 100)) : null; return <tr key={s} onClick={() => pick(s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td><td className={TD}>{fmtPrice(t[s]?.price)}</td><td className={TD} style={{ color: toneOf(t[s]?.changePct) }}>{fmtPct(t[s]?.changePct)}</td><td className={TD} style={{ color: toneOf(r20) }}>{sgn(r20)}</td><td className={`${TD} text-emerald-300`}>{sgn(worst, 1)}</td><td className={TD}>{dd ? sgn(dd.now, 1) : "—"}</td><td className={TD}>{dd ? sgn(dd.max, 1) : "—"}</td><td className={TD}>{f2(annVol(c.slice(-253)), 1, "%")}</td><td className={TD}>{f2(betaOf(sret(c.slice(-253)), sret(sp.slice(-253))), 2)}</td><td className={`${TD} text-white`} style={{ background: heat(stress == null ? null : stress / 100, 1) }}>{f2(stress, 0)}</td></tr>; })}</tbody></table>
        <Note>压力指数 = 近 20 日收益 ÷ 3 年内最差 20 日收益 × 100（0 = 无压力，100 = 达到 3 年最差水平），以可交易的主权债与国别股票 ETF 作为市场代理；主权信用违约掉期没有公开实时数据，未使用。</Note>
      </>}
      {tab === "us" && <>{cv.data?.spreads?.length ? (() => { const sp = cv.data.spreads; const l = sp[sp.length - 1]; return <>
        <Kpis items={[["10 年期", f2(l.y10, 2, "%"), l.date], ["2 年期", f2(l.y2, 2, "%")], ["2s10s", l.s2s10 != null ? `${l.s2s10}bp` : "—", l.s2s10 != null && l.s2s10 < 0 ? "倒挂" : "正常"], ["5s30s", l.s5s30 != null ? `${l.s5s30}bp` : "—"]]} />
        <Lines series={[{ name: "10年(%)", color: "#38bdf8", values: sp.map((x) => x.y10) }, { name: "2年(%)", color: "#a78bfa", values: sp.map((x) => x.y2) }]} xLabels={sp.map((x) => x.date.slice(2))} height={170} fmt={(v) => v.toFixed(2)} />
        <Lines series={[{ name: "2s10s(bp)", color: "#fbbf24", values: sp.map((x) => x.s2s10) }, { name: "5s30s(bp)", color: "#f472b6", values: sp.map((x) => x.s5s30) }]} xLabels={sp.map((x) => x.date.slice(2))} height={150} fmt={(v) => v.toFixed(0)} zero />
        <Note>美国作为全球无风险基准，长端期限溢价上升（5s30s 走阔）往往反映财政供给与可持续性担忧，是主权风险的另一视角。</Note></>; })() : <Empty loading={cv.loading} />}</>}
      {tab === "reg" && <>
        <div className="grid gap-1 px-2 py-1 md:grid-cols-[1fr_2fr_1fr_auto]"><input value={f.factor} onChange={(e) => setF({ ...f, factor: e.target.value })} placeholder="风险因子（如：意大利预算赤字）" className={INP} /><input value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} placeholder="证据 / 观察（如：对德利差 1 月走阔 25bp）" className={INP} /><input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="负责人" className={INP} /><button type="button" onClick={() => { if (!f.factor.trim() || !f.evidence.trim()) return; persist([{ id: `${Date.now().toString(36)}`, at: new Date().toISOString(), factor: f.factor.trim(), evidence: f.evidence.trim(), owner: f.owner.trim() || "—", status: "open" }, ...regs]); setF({ factor: "", evidence: "", owner: "" }); }} className={BTN}>登记</button></div>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>时间</th><th className={THL}>风险因子</th><th className={THL}>证据</th><th className={THL}>负责人</th><th className={THL}>状态</th><th className={TH} /></tr></thead>
          <tbody>{regs.map((r) => <tr key={r.id} className={ROW}><td className={`${TDL} font-mono text-[10px]`}>{r.at.slice(0, 16).replace("T", " ")}</td><td className={TDL}>{r.factor}</td><td className={`${TDL} text-slate-300`}>{r.evidence}</td><td className={TDL}>{r.owner}</td><td className={TDL}><button type="button" onClick={() => persist(regs.map((x) => (x.id === r.id ? { ...x, status: x.status === "open" ? "reviewed" : "open" } : x)))} className={r.status === "open" ? "text-amber-300" : "text-emerald-300"}>{r.status === "open" ? "待复核" : "已复核"}</button></td><td className="px-2 text-right"><button type="button" onClick={() => persist(regs.filter((x) => x.id !== r.id))} className="text-[10px] text-slate-500 hover:text-red-300">删除</button></td></tr>)}{!regs.length && <tr><td colSpan={6}><Empty loading={saved.loading} text="暂无登记，在上方填写后点击“登记”" /></td></tr>}</tbody></table>
        <div className="flex gap-2 px-2 py-1"><button type="button" disabled={!regs.length} onClick={() => downloadCsv("主权风险登记.csv", [["时间", "风险因子", "证据", "负责人", "状态"], ...regs.map((r) => [r.at, r.factor, r.evidence, r.owner, r.status === "open" ? "待复核" : "已复核"])])} className={`${BTN} disabled:opacity-40`}>导出 CSV</button><span className="text-[10px] text-slate-500">登记内容永久保存在平台数据库</span></div>
      </>}
    </PanelShell>
  );
}

/* ================================================================== WTWTR 新闻舆情与价格 */
type Trends = { terms: Array<{ term: string; count: number; tone: number; momentum: number; hours: number[] }>; volume: Array<{ t: number; n: number; pos: number; neg: number }> };
type Senti2 = { tickers: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; series: Array<{ t: number; pos: number; neg: number; n: number }>; byRegion: Array<{ key: string; count: number; pos: number; neg: number; index: number }>; total: number };

export function EqWTWTR({ onClose }: P) {
  const [tab, setTab] = useState("tick");
  const [hrs, setHrs] = useState("24");
  const s = usePolled<Senti2>("ucNews.sentiment", { hours: Number(hrs) }, 120_000);
  const tr = usePolled<Trends>("ucNews.trends", { hours: Number(hrs) }, 180_000);
  const feed = useFeed(tab === "hot" ? { sort: "heat", limit: 60, hours: Number(hrs), cats: ["美股", "A股", "港股", "公司", "科技"] } : null, 60_000);
  const tk = (s.data?.tickers ?? []).slice(0, 30);
  const t = useTicks(tk.map((x) => x.key));
  const { pick } = useHub();
  const agree = tk.filter((x) => t[x.key]?.changePct != null && x.index !== 0);
  const hit = agree.filter((x) => Math.sign(x.index) === Math.sign(t[x.key]!.changePct!)).length;
  return (
    <PanelShell code="WTWTR" title="市场舆情与价格" onClose={onClose} tabs={[["tick", "热门标的舆情"], ["trend", "情绪走势"], ["terms", "热词"], ["hot", "高热度快讯"]]} tab={tab} setTab={setTab} right={<Chips value={hrs} options={[["24", "24h"], ["48", "48h"], ["72", "72h"]]} onChange={setHrs} />}>
      <Kpis items={[["统计新闻条数", s.data ? `${s.data.total}` : "—", `${hrs} 小时`], ["被提及标的", `${s.data?.tickers.length ?? 0} 只`], ["舆情与价格同向率", agree.length ? `${((hit / agree.length) * 100).toFixed(0)}%` : "—", `${agree.length} 只可比`], ["整体情绪", (() => { const p = (s.data?.series ?? []).reduce((a, x) => a + x.pos, 0), n = (s.data?.series ?? []).reduce((a, x) => a + x.neg, 0); return p + n ? `${Math.round(((p - n) / (p + n)) * 100)}` : "—"; })(), "−100 全利空 ~ +100 全利好"]]} />
      {tab === "tick" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>标的</th><th className={TH}>提及</th><th className={TH}>利好</th><th className={TH}>利空</th><th className={TH}>舆情指数</th><th className="px-2" /><th className={TH}>最新价</th><th className={TH}>今日涨跌</th><th className={THL}>舆情 vs 价格</th></tr></thead>
          <tbody>{tk.map((x) => { const k = t[x.key]; const d = k?.changePct ?? null; const rel = d == null || x.index === 0 ? "—" : Math.sign(d) === Math.sign(x.index) ? "同向" : "背离"; return <tr key={x.key} onClick={() => pick(x.key)} className={`${ROW} cursor-pointer`}><td className={TDL}>{k?.name ?? x.key}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.key}</span></td><td className={TD}>{x.count}</td><td className={TD} style={{ color: UP }}>{x.pos}</td><td className={TD} style={{ color: DOWN }}>{x.neg}</td><td className={TD} style={{ color: toneOf(x.index) }}>{x.index}</td><td className="px-2"><SignBar v={x.index} max={100} /></td><td className={TD}>{fmtPrice(k?.price)}</td><td className={TD} style={{ color: toneOf(d) }}>{fmtPct(d)}</td><td className={`${TDL} ${rel === "背离" ? "text-amber-300" : "text-slate-400"}`}>{rel}</td></tr>; })}{!tk.length && <tr><td colSpan={9}><Empty loading={s.loading} /></td></tr>}</tbody></table>
        <Note>口径：基于平台实时汇聚的全网财经新闻流（自动识别标的与利好 / 利空），不含社交媒体帖子；舆情指数 = (利好 − 利空) ÷ 提及条数 × 100。“背离”表示新闻情绪与当日价格方向相反，值得关注。</Note>
      </>}
      {tab === "trend" && <>
        <SectionHead title="每小时利好（红）/ 利空（绿）新闻条数" />
        {s.data?.series?.length ? <Bars data={s.data.series.map((x) => ({ k: new Date(x.t).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit" }) + "时", v: x.pos, v2: x.neg }))} fmt={(v) => `${v} 条`} height={150} label={["利好", "利空"]} /> : <Empty loading={s.loading} />}
        <SectionHead title="每小时净情绪" />
        {s.data?.series?.length ? <Lines series={[{ name: "净情绪", color: "#fbbf24", values: s.data.series.map((x) => x.pos - x.neg) }, { name: "新闻量", color: "#64748b", values: s.data.series.map((x) => x.n), dash: true }]} xLabels={s.data.series.map((x) => new Date(x.t).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" }))} height={160} fmt={(v) => v.toFixed(0)} zero /> : null}
        <SectionHead title="按地区" />
        <table className="w-full text-[11px]"><tbody>{(s.data?.byRegion ?? []).slice(0, 10).map((r) => <tr key={r.key} className={ROW}><td className={TDL}>{r.key}</td><td className={TD}>{r.count} 条</td><td className={TD} style={{ color: toneOf(r.index) }}>{r.index}</td><td className="px-2"><SignBar v={r.index} max={100} /></td></tr>)}</tbody></table>
      </>}
      {tab === "terms" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>热词</th><th className={TH}>出现</th><th className={TH}>热度动量</th><th className={TH}>平均情绪</th><th className="px-2">逐小时</th></tr></thead>
          <tbody>{(tr.data?.terms ?? []).slice(0, 40).map((x) => <tr key={x.term} onClick={() => { if (x.term.startsWith("$")) pick(x.term.slice(1)); }} className={`${ROW} ${x.term.startsWith("$") ? "cursor-pointer" : ""}`}><td className={`${TDL} ${x.term.startsWith("$") ? "font-mono text-cyan-200" : "text-slate-100"}`}>{x.term}</td><td className={TD}>{x.count}</td><td className={TD} style={{ color: toneOf(x.momentum) }}>{x.momentum > 0 ? `+${x.momentum}` : x.momentum}</td><td className={TD} style={{ color: toneOf(x.tone) }}>{x.tone.toFixed(2)}</td><td className="px-2"><Mini values={x.hours} color={x.momentum > 0 ? "#f2495c" : "#38bdf8"} /></td></tr>)}{!tr.data && <tr><td colSpan={5}><Empty loading={tr.loading} /></td></tr>}</tbody></table>
        <Note>热度动量 = 最近四分之一时段出现次数 − 最早四分之一时段出现次数；以 $ 开头的为识别出的证券代码，点击查看 K 线。</Note>
      </>}
      {tab === "hot" && <FeedList items={feed.items} loading={feed.loading} ranked empty="暂无高热度新闻" />}
    </PanelShell>
  );
}
