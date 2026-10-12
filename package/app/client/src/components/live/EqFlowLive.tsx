/**
 * 股票 / ETF / 资金流 / 交易组（一）：全部实时数据，各面板角度互不重复。
 * TFLO 成交额与资金方向 · WETF 固定收益 ETF 成交异动 / 利率敏感度 · MKTOV 信用市场概览 · RUNZ 债券 ETF 实时报价单
 * IMGR 平台持仓库存与风险 · TRPV 三方回购抵押品池 · PICK 可转债新发行日历与定价
 */
import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useProfile, useTicks, useKline, UP, DOWN } from "@/uc/market/live";
import { align, annVol, perf, useCloses, f2, sgn, heat } from "@/uc/hubs/calc";
import { Bars, Lines, useHub } from "@/uc/hubs/kit";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { FillsTable, OrdersTable, OrderTicket, useFills, useOrders, usePositions, useSummary, MARKET_ZH, type Position } from "@/uc/trade/kit";
import { BTN, Chips, HEAD, INP, Mini, Note, ROW, Range, SignBar, TD, TDL, TH, THL, avg, betaOf, corrOf, dayOf, diffs, flowStats, pctRank, sret, useBars, useDepths, zScore, type Depth } from "./EqFlowKit";

type P = { onClose?: () => void };
type U = { s: string; l: string; g: string };

/* ================================================================== TFLO 成交额与资金方向 */
const FLOW_U: U[] = [
  { s: "AAPL", l: "苹果", g: "美股" }, { s: "MSFT", l: "微软", g: "美股" }, { s: "NVDA", l: "英伟达", g: "美股" }, { s: "AMZN", l: "亚马逊", g: "美股" }, { s: "GOOGL", l: "谷歌", g: "美股" }, { s: "META", l: "Meta", g: "美股" }, { s: "TSLA", l: "特斯拉", g: "美股" }, { s: "AVGO", l: "博通", g: "美股" }, { s: "JPM", l: "摩根大通", g: "美股" }, { s: "SPY", l: "标普500 ETF", g: "美股" }, { s: "QQQ", l: "纳指100 ETF", g: "美股" },
  { s: "sh600519", l: "贵州茅台", g: "A股" }, { s: "sh600036", l: "招商银行", g: "A股" }, { s: "sz000858", l: "五粮液", g: "A股" }, { s: "sz300750", l: "宁德时代", g: "A股" }, { s: "sh601318", l: "中国平安", g: "A股" }, { s: "sh601899", l: "紫金矿业", g: "A股" }, { s: "sh600900", l: "长江电力", g: "A股" }, { s: "sz002594", l: "比亚迪", g: "A股" }, { s: "sh688981", l: "中芯国际", g: "A股" }, { s: "sh510300", l: "沪深300 ETF", g: "A股" },
  { s: "0700.HK", l: "腾讯控股", g: "港股" }, { s: "9988.HK", l: "阿里巴巴", g: "港股" }, { s: "3690.HK", l: "美团", g: "港股" }, { s: "1299.HK", l: "友邦保险", g: "港股" }, { s: "0005.HK", l: "汇丰控股", g: "港股" }, { s: "0941.HK", l: "中国移动", g: "港股" }, { s: "1810.HK", l: "小米集团", g: "港股" }, { s: "2800.HK", l: "盈富基金", g: "港股" },
  { s: "LQD", l: "投资级公司债 ETF", g: "信用债ETF" }, { s: "HYG", l: "高收益债 ETF", g: "信用债ETF" }, { s: "JNK", l: "高收益债 ETF B", g: "信用债ETF" }, { s: "VCIT", l: "中期公司债 ETF", g: "信用债ETF" }, { s: "VCSH", l: "短期公司债 ETF", g: "信用债ETF" }, { s: "EMB", l: "新兴市场美元债 ETF", g: "信用债ETF" }, { s: "BKLN", l: "杠杆贷款 ETF", g: "信用债ETF" },
];
const CCY: Record<string, string> = { 美股: "美元", A股: "人民币", 港股: "港元", 信用债ETF: "美元" };

export function EqTFLO({ onClose }: P) {
  const [tab, setTab] = useState("board");
  const [grp, setGrp] = useState("全部");
  const syms = FLOW_U.map((u) => u.s);
  const bars = useBars(syms, 70, "1d", 180_000);
  const t = useTicks(syms);
  const { pick } = useHub();
  const rows = useMemo(() => FLOW_U.map((u) => ({ ...u, f: flowStats(bars.data[u.s]), closes: (bars.data[u.s] ?? []).slice(-20).map((b) => b.c) })), [bars.data]);
  const groups = ["美股", "A股", "港股", "信用债ETF"];
  const shown = rows.filter((r) => grp === "全部" || r.g === grp);
  const sum = groups.map((g) => {
    const rs = rows.filter((r) => r.g === g && r.f.turnover != null);
    const tot = rs.reduce((a, r) => a + (r.f.turnover ?? 0), 0);
    const up = rs.reduce((a, r) => a + ((t[r.s]?.changePct ?? 0) > 0 ? r.f.turnover ?? 0 : 0), 0);
    const net = rs.reduce((a, r) => a + Math.sign(t[r.s]?.changePct ?? 0) * (r.f.turnover ?? 0), 0);
    return { g, tot, upShare: tot ? up / tot : null, net, rvol: rs.length ? avg(rs.map((r) => r.f.rvol ?? 0)) : null, dir5: rs.length ? avg(rs.map((r) => r.f.dir5 ?? 0)) : null };
  });
  const [sel, setSel] = useState("NVDA");
  return (
    <PanelShell code="TFLO" title="成交额与资金方向" onClose={onClose} tabs={[["board", "市场资金方向"], ["intra", "分时资金流"], ["rank", "资金流排行"]]} tab={tab} setTab={setTab}>
      {tab === "board" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>市场</th><th className={TH}>估算成交额</th><th className={TH}>上涨成交占比</th><th className={TH}>今日净方向额</th><th className={TH}>平均相对量</th><th className={TH}>5日资金方向</th><th className={TH} /></tr></thead>
          <tbody>{sum.map((s) => <tr key={s.g} onClick={() => setGrp(s.g)} className={`${ROW} cursor-pointer`}><td className={TDL}>{s.g}<span className="ml-1 text-[9px] text-slate-600">{CCY[s.g]}</span></td><td className={TD}>{fmtCompact(s.tot)}</td><td className={TD} style={{ color: toneOf((s.upShare ?? 0.5) - 0.5) }}>{s.upShare == null ? "—" : `${(s.upShare * 100).toFixed(1)}%`}</td><td className={TD} style={{ color: toneOf(s.net) }}>{fmtCompact(s.net)}</td><td className={TD}>{f2(s.rvol, 2, "x")}</td><td className={TD} style={{ color: toneOf(s.dir5) }}>{f2(s.dir5, 2)}</td><td className="px-2"><SignBar v={s.dir5} max={0.6} /></td></tr>)}</tbody></table>
        <div className="flex items-center gap-2 px-2 py-1"><Chips value={grp} options={[["全部", "全部"], ...groups.map((g) => [g, g] as [string, string])]} onChange={setGrp} /><span className="ml-auto text-[10px] text-slate-500">点行查看 K 线</span></div>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>名称</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>估算成交额</th><th className={TH}>相对量</th><th className={TH}>5日方向</th><th className={TH}>20日方向</th><th className={TH}>CMF20</th><th className={TH}>MFI14</th><th className="px-2">20日</th></tr></thead>
          <tbody>{shown.map((r) => { const k = t[r.s]; return <tr key={r.s} onClick={() => pick(r.s)} className={`${ROW} cursor-pointer`}><td className={TDL}><span className="text-slate-100">{r.l}</span><span className="ml-1 font-mono text-[9px] text-slate-600">{r.s}</span></td><td className={TD} style={{ color: toneOf(k?.changePct) }}>{fmtPrice(k?.price)}</td><td className={TD} style={{ color: toneOf(k?.changePct) }}>{fmtPct(k?.changePct)}</td><td className={TD}>{fmtCompact(r.f.turnover)}</td><td className={TD} style={{ background: heat((r.f.rvol ?? 1) - 1, 1.5) }}>{f2(r.f.rvol, 2, "x")}</td><td className={TD} style={{ color: toneOf(r.f.dir5) }}>{f2(r.f.dir5, 2)}</td><td className={TD} style={{ color: toneOf(r.f.dir20) }}>{f2(r.f.dir20, 2)}</td><td className={TD} style={{ color: toneOf(r.f.cmf20) }}>{f2(r.f.cmf20, 3)}</td><td className={TD} style={{ color: (r.f.mfi14 ?? 50) > 80 ? UP : (r.f.mfi14 ?? 50) < 20 ? DOWN : undefined }}>{f2(r.f.mfi14, 1)}</td><td className="px-2"><Mini values={r.closes} color={toneOf(r.f.dir20)} /></td></tr>; })}
            {!shown.length && <tr><td colSpan={10}><Empty loading={bars.loading} /></td></tr>}</tbody></table>
        <Note>口径：估算成交额 = 最近交易日成交量 × 收盘价（本币）；资金方向 = Σ(成交额 × 当日涨跌方向) ÷ Σ成交额（-1 全部流出 ~ +1 全部流入）；CMF20 为蔡金资金流，MFI14 为资金流量指数（&gt;80 过热，&lt;20 超卖）；相对量 = 最近成交量 ÷ 前 20 日均量。均由日线成交数据计算，非交易所逐笔主动买卖统计。</Note>
      </>}
      {tab === "intra" && <IntraFlow sel={sel} setSel={setSel} />}
      {tab === "rank" && (() => {
        const ok = rows.filter((r) => r.f.dir5 != null);
        const top = [...ok].sort((a, b) => (b.f.dir5 ?? 0) - (a.f.dir5 ?? 0));
        const hot = [...rows].filter((r) => (r.f.rvol ?? 0) >= 1.3).sort((a, b) => (b.f.rvol ?? 0) - (a.f.rvol ?? 0));
        return <>
          <SectionHead title="5 日资金方向：持续流入（左）与持续流出（右）" />
          <Bars data={[...top.slice(0, 8), ...top.slice(-8)].map((r) => ({ k: r.l, v: r.f.dir5 ?? 0 }))} fmt={(v) => v.toFixed(2)} height={150} />
          <SectionHead title="成交异动：相对量 ≥ 1.3 倍" />
          <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>名称</th><th className={THL}>市场</th><th className={TH}>涨跌幅</th><th className={TH}>相对量</th><th className={TH}>估算成交额</th><th className={TH}>20日均额</th><th className={TH}>今日方向额</th></tr></thead>
            <tbody>{hot.map((r) => <tr key={r.s} onClick={() => pick(r.s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{r.l}</td><td className="px-2 text-[10px] text-slate-500">{r.g}</td><td className={TD} style={{ color: toneOf(t[r.s]?.changePct) }}>{fmtPct(t[r.s]?.changePct)}</td><td className={`${TD} text-amber-300`}>{f2(r.f.rvol, 2, "x")}</td><td className={TD}>{fmtCompact(r.f.turnover)}</td><td className={TD}>{fmtCompact(r.f.avgTurnover20)}</td><td className={TD} style={{ color: toneOf(r.f.signed) }}>{fmtCompact(r.f.signed)}</td></tr>)}
              {!hot.length && <tr><td colSpan={7}><Empty loading={bars.loading} text="当前没有成交量显著放大的标的" /></td></tr>}</tbody></table>
        </>;
      })()}
    </PanelShell>
  );
}

function IntraFlow({ sel, setSel }: { sel: string; setSel: (s: string) => void }) {
  const k = useKline(sel, "5m", 240);
  const day = k.candles.length ? dayOf(k.candles[k.candles.length - 1].t) : null;
  const bars = k.candles.filter((c) => dayOf(c.t) === day && (c.v ?? 0) > 0);
  const flows = bars.map((c) => ({ t: c.t, amt: (c.v ?? 0) * c.c, dir: Math.sign(c.c - c.o), c }));
  let cum = 0;
  const cumLine = flows.map((f) => (cum += f.dir * f.amt));
  const inflow = flows.filter((f) => f.dir > 0).reduce((a, f) => a + f.amt, 0);
  const outflow = flows.filter((f) => f.dir < 0).reduce((a, f) => a + f.amt, 0);
  const big = [...flows].sort((a, b) => b.amt - a.amt).slice(0, 10);
  const u = FLOW_U.find((x) => x.s === sel);
  const tm = (t: number) => new Date(t).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
  return <>
    <div className="flex flex-wrap items-center gap-2 px-2 py-1 text-[11px]"><span className="text-slate-500">标的</span><select value={sel} onChange={(e) => setSel(e.target.value)} className={INP}>{FLOW_U.map((x) => <option key={x.s} value={x.s}>{x.g} · {x.l}</option>)}</select><span className="text-[10px] text-slate-500">{day ? `交易日 ${day} · 5 分钟线 ${bars.length} 根` : ""}</span></div>
    <Kpis items={[["阳线成交额（流入）", fmtCompact(inflow), CCY[u?.g ?? "美股"]], ["阴线成交额（流出）", fmtCompact(outflow)], ["净流入", <span key="n" style={{ color: toneOf(inflow - outflow) }}>{fmtCompact(inflow - outflow)}</span>], ["净额占比", inflow + outflow ? `${(((inflow - outflow) / (inflow + outflow)) * 100).toFixed(1)}%` : "—"]]} />
    {flows.length ? <>
      <SectionHead title="累计净流入（按 5 分钟 K 线方向）" />
      <Lines series={[{ name: "累计净流入", color: "#fbbf24", values: cumLine }]} xLabels={flows.map((f) => tm(f.t))} height={170} fmt={(v) => fmtCompact(v)} zero />
      <SectionHead title="每根 K 线方向成交额" />
      <Bars data={flows.map((f) => ({ k: tm(f.t), v: f.dir * f.amt }))} height={110} />
      <SectionHead title="成交额最大的 10 根 K 线" />
      <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>时间</th><th className={TH}>开</th><th className={TH}>收</th><th className={TH}>成交量</th><th className={TH}>成交额</th><th className={TH}>方向</th></tr></thead>
        <tbody>{big.map((f) => <tr key={f.t} className={ROW}><td className={`${TDL} font-mono`}>{tm(f.t)}</td><td className={TD}>{fmtPrice(f.c.o)}</td><td className={TD}>{fmtPrice(f.c.c)}</td><td className={TD}>{fmtCompact(f.c.v)}</td><td className={TD}>{fmtCompact(f.amt)}</td><td className={TD} style={{ color: f.dir > 0 ? UP : f.dir < 0 ? DOWN : undefined }}>{f.dir > 0 ? "流入" : f.dir < 0 ? "流出" : "平"}</td></tr>)}</tbody></table>
    </> : <Empty loading={k.loading} text="该标的暂无当日分钟成交数据" />}
    <Note>口径：阳线（收 &gt; 开）的成交额计为流入，阴线计为流出，用于观察盘中资金节奏；不是逐笔主动买卖统计。</Note>
  </>;
}

/* ================================================================== WETF 固定收益 ETF */
const FI_U: U[] = [
  { s: "BIL", l: "1-3 月国债", g: "美国国债" }, { s: "SHY", l: "1-3 年国债", g: "美国国债" }, { s: "IEI", l: "3-7 年国债", g: "美国国债" }, { s: "IEF", l: "7-10 年国债", g: "美国国债" }, { s: "TLT", l: "20 年以上国债", g: "美国国债" }, { s: "GOVT", l: "国债综合", g: "美国国债" }, { s: "TIP", l: "通胀保值国债", g: "美国国债" },
  { s: "VCSH", l: "短期公司债", g: "美国信用" }, { s: "VCIT", l: "中期公司债", g: "美国信用" }, { s: "LQD", l: "投资级公司债", g: "美国信用" }, { s: "HYG", l: "高收益债", g: "美国信用" }, { s: "BKLN", l: "杠杆贷款", g: "美国信用" }, { s: "MUB", l: "市政债", g: "美国信用" },
  { s: "AGG", l: "美国综合债", g: "综合与海外" }, { s: "BND", l: "美国综合债 B", g: "综合与海外" }, { s: "BNDX", l: "国际债（对冲）", g: "综合与海外" }, { s: "EMB", l: "新兴市场美元债", g: "综合与海外" },
  { s: "sh511260", l: "十年国债 ETF", g: "中国" }, { s: "sh511010", l: "国债 ETF", g: "中国" }, { s: "sh511030", l: "公司债 ETF", g: "中国" }, { s: "sh511360", l: "短融 ETF", g: "中国" }, { s: "sh511880", l: "货币 ETF", g: "中国" },
];
const LADDERS: Record<string, string[]> = { 国债梯队: ["BIL", "SHY", "IEI", "IEF", "TLT"], 信用梯队: ["VCSH", "VCIT", "LQD", "HYG", "BKLN"], 海外与通胀: ["AGG", "BNDX", "EMB", "TIP"], 中国债券: ["sh511260", "sh511010", "sh511030", "sh511360"] };
const COLORS = ["#fbbf24", "#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#f97316"];

export function EqWETF({ onClose }: P) {
  const [tab, setTab] = useState("flow");
  const syms = FI_U.map((u) => u.s);
  const t = useTicks(syms);
  const bars = useBars(syms, 70, "1d", 300_000);
  const pack = useCloses([...syms, "^TNX", "SPY"], 420);
  const [sel, setSel] = useState("TLT");
  const prof = useProfile(sel);
  const { pick } = useHub();
  const [lad, setLad] = useState("国债梯队");
  const sens = useMemo(() => {
    const us = FI_U.filter((u) => u.g !== "中国").map((u) => u.s);
    const { m } = align(pack.data ?? null, [...us, "^TNX", "SPY"]);
    const dy = diffs((m["^TNX"] ?? []).slice(-253)).map((v) => v / 100);
    const eq = sret((m.SPY ?? []).slice(-253));
    return Object.fromEntries(us.map((s) => {
      const r = sret((m[s] ?? []).slice(-253));
      const b = betaOf(r, dy);
      const c = corrOf(r, dy);
      return [s, { dur: b == null ? null : -b, r2: c == null ? null : c * c, eqBeta: betaOf(r, eq), eqCorr: corrOf(r, eq), vol: annVol((m[s] ?? []).slice(-253)) }];
    }));
  }, [pack.data]);
  return (
    <PanelShell code="WETF" title="固定收益 ETF" onClose={onClose} tabs={[["flow", "成交异动"], ["dur", "利率敏感度"], ["cmp", "梯队走势"]]} tab={tab} setTab={setTab}>
      {tab === "flow" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>ETF</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>估算成交额</th><th className={TH}>20日均额</th><th className={TH}>相对量</th><th className={TH}>5日方向</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>1年</th><th className="px-2">52周区间</th></tr></thead>
          <tbody>{FI_U.map((u, i) => { const f = flowStats(bars.data[u.s]); const c = (pack.data?.[u.s] ?? []).map((x) => x[1]); const y1 = c.slice(-252); const head = i === 0 || FI_U[i - 1].g !== u.g; return [head ? <tr key={`g${u.g}`}><td colSpan={11} className="bg-[#07111c] px-2 py-0.5 text-[10px] text-cyan-300">{u.g}</td></tr> : null, <tr key={u.s} onClick={() => setSel(u.s)} onDoubleClick={() => pick(u.s)} className={`${ROW} cursor-pointer ${sel === u.s ? "bg-[#0d2236]" : ""}`}><td className={TDL}>{u.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{u.s}</span></td><td className={TD}>{fmtPrice(t[u.s]?.price)}</td><td className={TD} style={{ color: toneOf(t[u.s]?.changePct) }}>{fmtPct(t[u.s]?.changePct)}</td><td className={TD}>{fmtCompact(f.turnover)}</td><td className={TD}>{fmtCompact(f.avgTurnover20)}</td><td className={TD} style={{ background: heat((f.rvol ?? 1) - 1, 1.5) }}>{f2(f.rvol, 2, "x")}</td><td className={TD} style={{ color: toneOf(f.dir5) }}>{f2(f.dir5, 2)}</td>{[21, 63, 252].map((n) => <td key={n} className={TD} style={{ color: toneOf(perf(c, n)) }}>{sgn(perf(c, n))}</td>)}<td className="px-2"><Range lo={y1.length ? Math.min(...y1) : null} hi={y1.length ? Math.max(...y1) : null} v={t[u.s]?.price ?? c[c.length - 1]} /></td></tr>]; })}</tbody></table>
        <SectionHead title={`${FI_U.find((u) => u.s === sel)?.l ?? sel} 概要`} right={<button type="button" onClick={() => pick(sel)} className="text-[10px] text-cyan-300 hover:underline">K 线 ›</button>} />
        <table className="w-full text-[11px]"><tbody>{(prof.data?.metrics ?? []).map((m) => <tr key={m.key} className={ROW}><td className={TDL}>{m.key === "mcap" ? "基金规模（市值）" : m.label}</td><td className={TD}>{m.value == null ? "—" : Math.abs(m.value) >= 1e6 ? fmtCompact(m.value) : `${m.value.toFixed(2)}${m.unit ?? ""}`}</td></tr>)}{!prof.data?.metrics?.length && <tr><td><Empty loading={prof.loading} text="暂无该 ETF 的规模数据" /></td></tr>}</tbody></table>
        <Note>点击行查看规模等概要，双击打开 K 线。相对量 = 最近成交量 ÷ 前 20 日均量；5 日方向为成交额按涨跌方向加权的净占比。</Note>
      </>}
      {tab === "dur" && <>
        <SectionHead title="实证久期：ETF 日收益对美国 10 年期收益率日变动的回归（近 1 年）" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>ETF</th><th className={TH}>实证久期</th><th className={TH}>拟合度 R²</th><th className={TH}>+25bp 估算</th><th className={TH}>-25bp 估算</th><th className={TH}>股票贝塔</th><th className={TH}>股债相关</th><th className={TH}>年化波动</th></tr></thead>
          <tbody>{FI_U.filter((u) => u.g !== "中国").map((u) => { const x = sens[u.s]; return <tr key={u.s} onClick={() => pick(u.s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{u.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{u.s}</span></td><td className={`${TD} text-amber-200`}>{f2(x?.dur, 2)}</td><td className={TD}>{f2(x?.r2, 2)}</td><td className={TD} style={{ color: toneOf(x?.dur == null ? null : -x.dur * 0.25) }}>{x?.dur == null ? "—" : sgn(-x.dur * 0.25)}</td><td className={TD} style={{ color: toneOf(x?.dur == null ? null : x.dur * 0.25) }}>{x?.dur == null ? "—" : sgn(x.dur * 0.25)}</td><td className={TD}>{f2(x?.eqBeta, 3)}</td><td className={TD} style={{ color: toneOf(x?.eqCorr) }}>{f2(x?.eqCorr, 2)}</td><td className={TD}>{f2(x?.vol, 1, "%")}</td></tr>; })}</tbody></table>
        <Bars data={FI_U.filter((u) => u.g !== "中国").map((u) => ({ k: u.s, v: sens[u.s]?.dur ?? 0 }))} fmt={(v) => v.toFixed(2)} height={120} />
        <Note>实证久期 = −β（ETF 日收益 ~ 10 年期收益率日变动），反映市场实际表现出的利率敏感度；信用类 ETF 的拟合度较低，说明其价格更多受利差与股票风险驱动（见股票贝塔）。中国债券 ETF 不适用美债收益率回归，未列入。</Note>
      </>}
      {tab === "cmp" && (() => {
        const list = LADDERS[lad];
        const { dates, m } = align(pack.data ?? null, list);
        const n = Math.min(252, dates.length);
        return <>
          <div className="px-2 py-1"><Chips value={lad} options={Object.keys(LADDERS).map((k) => [k, k] as [string, string])} onChange={setLad} /></div>
          {n > 5 ? <Lines series={list.map((s, i) => ({ name: FI_U.find((u) => u.s === s)?.l ?? s, color: COLORS[i % COLORS.length], values: m[s].slice(-n).map((v) => (v / m[s][m[s].length - n]) * 100) }))} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={220} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} />}
          <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>ETF</th><th className={TH}>1年收益</th><th className={TH}>年化波动</th><th className={TH}>收益/波动</th><th className={TH}>最大回撤</th></tr></thead>
            <tbody>{list.map((s) => { const c = (m[s] ?? []).slice(-n); const r = perf(c, Math.max(1, c.length - 1)); const v = annVol(c); let pk = -Infinity, dd = 0; for (const x of c) { pk = Math.max(pk, x); dd = Math.min(dd, x / pk - 1); } return <tr key={s} className={ROW}><td className={TDL}>{FI_U.find((u) => u.s === s)?.l ?? s}</td><td className={TD} style={{ color: toneOf(r) }}>{sgn(r)}</td><td className={TD}>{f2(v, 1, "%")}</td><td className={TD}>{r != null && v ? f2(r / v, 2) : "—"}</td><td className={`${TD} text-emerald-300`}>{c.length ? sgn(dd * 100, 1) : "—"}</td></tr>; })}</tbody></table>
        </>;
      })()}
    </PanelShell>
  );
}

/* ================================================================== MKTOV 信用市场概览 */
type OasSeries = { id: string; label: string; bucket: string; observationDate: string | null; valuePct: number | null; valueBps: number | null; changeBps: number | null; history: Array<{ date: string; valuePct: number }> };
const CREDIT_ETF: U[] = [{ s: "VCSH", l: "短期投资级", g: "IG" }, { s: "VCIT", l: "中期投资级", g: "IG" }, { s: "LQD", l: "投资级综合", g: "IG" }, { s: "IGIB", l: "中期投资级 B", g: "IG" }, { s: "ANGL", l: "堕落天使", g: "HY" }, { s: "HYG", l: "高收益综合", g: "HY" }, { s: "JNK", l: "高收益 B", g: "HY" }, { s: "USHY", l: "高收益宽基", g: "HY" }, { s: "BKLN", l: "杠杆贷款", g: "贷款" }, { s: "EMB", l: "新兴市场美元债", g: "新兴" }];
const BUCKET_ZH: Record<string, string> = { IG: "投资级综合", AAA: "AAA 级", AA: "AA 级", BBB: "BBB 级", HY: "高收益综合" };

export function EqMKTOV({ onClose }: P) {
  const [tab, setTab] = useState("oas");
  const oas = usePolled<{ asOf: string; series: OasSeries[] }>("creditResearch.getOasSnapshot", {}, 900_000);
  const ser = (oas.data?.series ?? []).filter((s) => s.valueBps != null);
  const by = (b: string) => ser.find((s) => s.bucket === b);
  const syms = CREDIT_ETF.map((u) => u.s);
  const t = useTicks(syms);
  const depth = useDepths(tab === "liq" ? syms : [], 15_000);
  const bars = useBars(syms, 260, "1d", 600_000);
  const { pick } = useHub();
  const hy = by("HY"), ig = by("IG"), bbb = by("BBB"), aa = by("AA");
  const qual = (() => {
    if (!hy || !ig) return [] as Array<{ d: string; v: number }>;
    const igm = new Map(ig.history.map((p) => [p.date, p.valuePct]));
    return hy.history.filter((p) => igm.has(p.date)).map((p) => ({ d: p.date, v: (p.valuePct - igm.get(p.date)!) * 100 }));
  })();
  return (
    <PanelShell code="MKTOV" title="信用市场概览" onClose={onClose} tabs={[["oas", "信用利差"], ["liq", "流动性监控"], ["crowd", "拥挤度"], ["rating", "评级分层"]]} tab={tab} setTab={setTab} right={oas.data?.series?.[0]?.observationDate ? <span>利差日期 {oas.data.series[0].observationDate}</span> : null}>
      {tab === "oas" && <>
        <Kpis items={[["投资级 OAS", ig?.valueBps != null ? `${ig.valueBps.toFixed(0)}bp` : "—", ig?.changeBps != null ? `日变动 ${sgn(ig.changeBps, 1, "bp")}` : undefined], ["高收益 OAS", hy?.valueBps != null ? `${hy.valueBps.toFixed(0)}bp` : "—", hy?.changeBps != null ? `日变动 ${sgn(hy.changeBps, 1, "bp")}` : undefined], ["高收益 − 投资级", hy?.valueBps != null && ig?.valueBps != null ? `${(hy.valueBps - ig.valueBps).toFixed(0)}bp` : "—", "质量利差"], ["BBB − AA", bbb?.valueBps != null && aa?.valueBps != null ? `${(bbb.valueBps - aa.valueBps).toFixed(0)}bp` : "—", "评级溢价"]]} />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>指数</th><th className={TH}>OAS</th><th className={TH}>日变动</th><th className={TH}>30日变动</th><th className={TH}>90日低</th><th className={TH}>90日高</th><th className={TH}>90日分位</th><th className="px-2">位置</th><th className="px-2">走势</th></tr></thead>
          <tbody>{ser.map((s) => { const h = s.history.map((p) => p.valuePct * 100); const lo = Math.min(...h), hi = Math.max(...h); const m30 = h.length > 22 ? h[h.length - 1] - h[h.length - 23] : null; return <tr key={s.id} className={ROW}><td className={TDL}>{BUCKET_ZH[s.bucket] ?? s.label}</td><td className={`${TD} text-white`}>{s.valueBps!.toFixed(0)}</td><td className={TD} style={{ color: toneOf(s.changeBps) }}>{sgn(s.changeBps, 1, "")}</td><td className={TD} style={{ color: toneOf(m30) }}>{sgn(m30, 1, "")}</td><td className={TD}>{h.length ? lo.toFixed(0) : "—"}</td><td className={TD}>{h.length ? hi.toFixed(0) : "—"}</td><td className={TD}>{f2(pctRank(h, s.valueBps), 0, "%")}</td><td className="px-2"><Range lo={lo} hi={hi} v={s.valueBps} /></td><td className="px-2"><Mini values={h} color="#fbbf24" /></td></tr>; })}
            {!ser.length && <tr><td colSpan={9}><Empty loading={oas.loading} text="利差数据暂不可用" /></td></tr>}</tbody></table>
        {ig && hy && <><SectionHead title="近 90 个交易日信用利差（bp）" /><Lines series={[{ name: "投资级", color: "#38bdf8", values: ig.history.map((p) => p.valuePct * 100) }, ...(bbb ? [{ name: "BBB", color: "#a78bfa", values: bbb.history.map((p) => p.valuePct * 100) }] : []), { name: "高收益", color: "#f97316", values: hy.history.map((p) => p.valuePct * 100) }]} xLabels={hy.history.map((p) => p.date.slice(5))} height={190} fmt={(v) => v.toFixed(0)} /></>}
        <Note>OAS 为美国公司债指数的期权调整利差（日度，收盘后更新），反映信用风险补偿；不是单只债券的可成交报价。</Note>
      </>}
      {tab === "liq" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>ETF</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>买一</th><th className={TH}>卖一</th><th className={TH}>价差(bp)</th><th className={TH}>买量</th><th className={TH}>卖量</th><th className={TH}>相对量</th><th className={TH}>估算成交额</th></tr></thead>
          <tbody>{CREDIT_ETF.map((u) => { const d = depth[u.s]; const b = d?.bids[0], a = d?.asks[0]; const sp = b && a ? ((a.px - b.px) / ((a.px + b.px) / 2)) * 1e4 : null; const f = flowStats(bars.data[u.s]?.slice(-60)); return <tr key={u.s} onClick={() => pick(u.s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{u.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{u.s}</span></td><td className={TD}>{fmtPrice(t[u.s]?.price)}</td><td className={TD} style={{ color: toneOf(t[u.s]?.changePct) }}>{fmtPct(t[u.s]?.changePct)}</td><td className={`${TD} text-red-300`}>{fmtPrice(b?.px)}</td><td className={`${TD} text-emerald-300`}>{fmtPrice(a?.px)}</td><td className={TD} style={{ color: sp != null && sp > 5 ? "#fbbf24" : undefined }}>{f2(sp, 2)}</td><td className={TD}>{fmtCompact(b?.qty)}</td><td className={TD}>{fmtCompact(a?.qty)}</td><td className={TD} style={{ background: heat((f.rvol ?? 1) - 1, 1.5) }}>{f2(f.rvol, 2, "x")}</td><td className={TD}>{fmtCompact(f.turnover)}</td></tr>; })}</tbody></table>
        <Note>买一 / 卖一为全国最优报价与挂单量（每 15 秒刷新，非交易时段可能为空）；价差(bp) = (卖一 − 买一) ÷ 中间价。价差扩大与相对量放大同时出现，通常意味着信用市场流动性趋紧。</Note>
      </>}
      {tab === "crowd" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>ETF</th><th className={TH}>20日资金方向</th><th className={TH}>成交热度</th><th className={TH}>偏离50日线</th><th className={TH}>偏离 z 值</th><th className={THL}>状态</th></tr></thead>
          <tbody>{CREDIT_ETF.map((u) => { const c = bars.data[u.s] ?? []; const f = flowStats(c); const v = c.map((b) => b.v ?? 0); const heatV = v.length > 60 ? avg(v.slice(-5)) / Math.max(1, avg(v.slice(-60))) : null; const cl = c.map((b) => b.c); const devs = cl.map((x, i) => (i >= 49 ? x / avg(cl.slice(i - 49, i + 1)) - 1 : null)).filter((x): x is number => x != null); const dev = devs.length ? devs[devs.length - 1] : null; const z = zScore(devs, dev); const state = f.dir20 != null && heatV != null && z != null ? (f.dir20 > 0.3 && heatV > 1.2 && z > 1.5 ? "多头拥挤" : f.dir20 < -0.3 && heatV > 1.2 && z < -1.5 ? "抛售拥挤" : "正常") : "—"; return <tr key={u.s} onClick={() => pick(u.s)} className={`${ROW} cursor-pointer`}><td className={TDL}>{u.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{u.s}</span></td><td className={TD} style={{ color: toneOf(f.dir20) }}>{f2(f.dir20, 2)}</td><td className={TD} style={{ background: heat((heatV ?? 1) - 1, 1) }}>{f2(heatV, 2, "x")}</td><td className={TD} style={{ color: toneOf(dev) }}>{dev == null ? "—" : sgn(dev * 100)}</td><td className={TD} style={{ background: heat(z, 3) }}>{f2(z, 2)}</td><td className={`${TDL} ${state === "正常" ? "text-slate-400" : "text-amber-300"}`}>{state}</td></tr>; })}</tbody></table>
        <Note>拥挤度判定规则：20 日资金方向 &gt; 0.3、近 5 日均量 ÷ 近 60 日均量 &gt; 1.2、价格偏离 50 日线的 z 值 &gt; 1.5 同时满足记为“多头拥挤”，反向同时满足记为“抛售拥挤”；z 值以近一年的偏离分布计算。</Note>
      </>}
      {tab === "rating" && <>
        <SectionHead title="各评级 OAS：当前（红）与 90 个交易日前（绿）" />
        <Bars data={ser.map((s) => ({ k: BUCKET_ZH[s.bucket] ?? s.bucket, v: s.valueBps ?? 0, v2: s.history.length ? s.history[0].valuePct * 100 : 0 }))} fmt={(v) => `${v.toFixed(0)}bp`} height={150} label={["当前", "90日前"]} />
        <SectionHead title="高收益与投资级利差（bp）" />
        {qual.length ? <Lines series={[{ name: "HY − IG", color: "#f97316", values: qual.map((x) => x.v) }]} xLabels={qual.map((x) => x.d.slice(5))} height={160} fmt={(v) => v.toFixed(0)} /> : <Empty loading={oas.loading} />}
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>评级层级 ETF</th><th className={TH}>1月</th><th className={TH}>3月</th><th className={TH}>1年</th><th className={TH}>年化波动</th></tr></thead>
          <tbody>{CREDIT_ETF.map((u) => { const c = (bars.data[u.s] ?? []).map((b) => b.c); return <tr key={u.s} className={ROW}><td className={TDL}>{u.l}<span className="ml-1 text-[9px] text-slate-500">{u.g}</span></td>{[21, 63, 250].map((n) => <td key={n} className={TD} style={{ color: toneOf(perf(c, n)) }}>{sgn(perf(c, n))}</td>)}<td className={TD}>{f2(annVol(c), 1, "%")}</td></tr>; })}</tbody></table>
      </>}
    </PanelShell>
  );
}

/* ================================================================== RUNZ 债券 ETF 实时报价单 */
const RUN_U: U[] = [
  { s: "SHY", l: "1-3 年国债", g: "美国" }, { s: "IEI", l: "3-7 年国债", g: "美国" }, { s: "IEF", l: "7-10 年国债", g: "美国" }, { s: "TLT", l: "20 年以上国债", g: "美国" }, { s: "TIP", l: "通胀保值国债", g: "美国" }, { s: "VCIT", l: "中期公司债", g: "美国" }, { s: "LQD", l: "投资级公司债", g: "美国" }, { s: "HYG", l: "高收益债", g: "美国" }, { s: "JNK", l: "高收益债 B", g: "美国" }, { s: "EMB", l: "新兴市场美元债", g: "美国" }, { s: "MUB", l: "市政债", g: "美国" },
  { s: "sh511260", l: "十年国债 ETF", g: "中国" }, { s: "sh511010", l: "国债 ETF", g: "中国" }, { s: "sh511030", l: "公司债 ETF", g: "中国" }, { s: "sh511360", l: "短融 ETF", g: "中国" }, { s: "sh511880", l: "货币 ETF", g: "中国" },
];
const spreadBp = (d?: Depth) => { const b = d?.bids[0], a = d?.asks[0]; return b && a && a.px > 0 && b.px > 0 ? ((a.px - b.px) / ((a.px + b.px) / 2)) * 1e4 : null; };

export function EqRUNZ({ onClose }: P) {
  const [tab, setTab] = useState("runs");
  const [mkt, setMkt] = useState("全部");
  const syms = RUN_U.map((u) => u.s);
  const depth = useDepths(syms, 10_000);
  const t = useTicks(syms);
  const [hist, setHist] = useState<Record<string, Array<{ t: number; bp: number }>>>({});
  useEffect(() => {
    const now = Date.now();
    setHist((h) => {
      const next = { ...h };
      for (const s of syms) { const bp = spreadBp(depth[s]); if (bp != null) { const arr = next[s] ?? []; if (!arr.length || arr[arr.length - 1].t < now - 5000) next[s] = [...arr.slice(-359), { t: now, bp }]; } }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);
  const [sel, setSel] = useState("IEF");
  const fills = useFills();
  const orders = useOrders();
  const shown = RUN_U.filter((u) => mkt === "全部" || u.g === mkt);
  const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  return (
    <PanelShell code="RUNZ" title="债券 ETF 实时报价单" onClose={onClose} tabs={[["runs", "实时报价"], ["spread", "价差走势"], ["trade", "下单与成交"]]} tab={tab} setTab={setTab}>
      {tab === "runs" && <>
        <div className="flex items-center gap-2 px-2 py-1"><Chips value={mkt} options={[["全部", "全部"], ["美国", "美国"], ["中国", "中国"]]} onChange={setMkt} /><span className="ml-auto text-[10px] text-slate-500">每 10 秒刷新盘口 · 点击行选中并可在“下单与成交”中交易</span></div>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>品种</th><th className={TH}>买价</th><th className={TH}>卖价</th><th className={TH}>中间价</th><th className={TH}>价差(bp)</th><th className={TH}>买量</th><th className={TH}>卖量</th><th className={TH}>盘口失衡</th><th className={TH}>最新成交</th><th className={TH}>涨跌幅</th><th className={THL}>价差状态</th><th className={TH}>盘口时间</th></tr></thead>
          <tbody>{shown.map((u) => { const d = depth[u.s]; const b = d?.bids[0], a = d?.asks[0]; const bp = spreadBp(d); const bq = (d?.bids ?? []).reduce((x, y) => x + y.qty, 0), aq = (d?.asks ?? []).reduce((x, y) => x + y.qty, 0); const imb = bq + aq ? (bq - aq) / (bq + aq) : null; const m = med((hist[u.s] ?? []).map((x) => x.bp)); const st = bp == null || m == null || (hist[u.s]?.length ?? 0) < 3 ? "—" : bp > m * 1.5 ? "扩大" : bp < m * 0.75 ? "收窄" : "正常"; return <tr key={u.s} onClick={() => setSel(u.s)} className={`${ROW} cursor-pointer ${sel === u.s ? "bg-[#0d2236]" : ""}`}><td className={TDL}>{u.l}<span className="ml-1 font-mono text-[9px] text-slate-600">{u.s}</span></td><td className={`${TD} text-red-300`}>{fmtPrice(b?.px, 3)}</td><td className={`${TD} text-emerald-300`}>{fmtPrice(a?.px, 3)}</td><td className={TD}>{b && a ? fmtPrice((b.px + a.px) / 2, 3) : "—"}</td><td className={TD}>{f2(bp, 2)}</td><td className={TD}>{fmtCompact(b?.qty)}</td><td className={TD}>{fmtCompact(a?.qty)}</td><td className="px-2 text-right"><SignBar v={imb} /></td><td className={TD}>{fmtPrice(t[u.s]?.price, 3)}</td><td className={TD} style={{ color: toneOf(t[u.s]?.changePct) }}>{fmtPct(t[u.s]?.changePct)}</td><td className={`${TDL} ${st === "扩大" ? "text-amber-300" : st === "收窄" ? "text-cyan-300" : "text-slate-400"}`}>{st}</td><td className={`${TD} text-[10px] text-slate-500`}>{d?.at ? new Date(d.at).toLocaleTimeString("zh-CN", { hour12: false }) : "—"}</td></tr>; })}</tbody></table>
        <Note>美国品种为全国最优一档报价，中国品种为交易所五档盘口（买量 / 卖量为五档合计）。价差状态以本窗口打开以来实测价差的中位数为基准：高于 1.5 倍为扩大，低于 0.75 倍为收窄。盘口失衡 = (买量 − 卖量) ÷ (买量 + 卖量)。</Note>
      </>}
      {tab === "spread" && (() => {
        const list = shown.filter((u) => (hist[u.s]?.length ?? 0) > 1).slice(0, 6);
        const n = Math.max(0, ...list.map((u) => hist[u.s].length));
        return <>
          <div className="px-2 py-1"><Chips value={mkt} options={[["全部", "全部"], ["美国", "美国"], ["中国", "中国"]]} onChange={setMkt} /></div>
          {list.length ? <Lines series={list.map((u, i) => ({ name: u.l, color: COLORS[i % COLORS.length], values: [...new Array(Math.max(0, n - hist[u.s].length)).fill(null), ...hist[u.s].map((x) => x.bp)] }))} height={220} fmt={(v) => v.toFixed(1)} /> : <Empty text="正在采样盘口价差（每 10 秒一次），稍候即显示走势" />}
          <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>品种</th><th className={TH}>样本数</th><th className={TH}>最新</th><th className={TH}>最小</th><th className={TH}>中位</th><th className={TH}>最大</th></tr></thead>
            <tbody>{shown.map((u) => { const h = (hist[u.s] ?? []).map((x) => x.bp); return <tr key={u.s} className={ROW}><td className={TDL}>{u.l}</td><td className={TD}>{h.length}</td><td className={TD}>{f2(h[h.length - 1], 2)}</td><td className={TD}>{h.length ? Math.min(...h).toFixed(2) : "—"}</td><td className={TD}>{f2(med(h), 2)}</td><td className={TD}>{h.length ? Math.max(...h).toFixed(2) : "—"}</td></tr>; })}</tbody></table>
          <Note>价差走势为本窗口打开后实测盘口的逐次记录（bp），关闭窗口后重新开始。</Note>
        </>;
      })()}
      {tab === "trade" && <>
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="bg-[#03070c]"><SectionHead title={`按报价下单：${RUN_U.find((u) => u.s === sel)?.l ?? sel}`} /><OrderTicket key={sel} initial={sel} strategy="RUNZ" compact /></div>
          <div className="bg-[#03070c]"><SectionHead title="本报价单品种的委托" /><OrdersTable rows={(orders.data ?? []).filter((o) => syms.includes(o.symbol))} max={60} /><SectionHead title="成交回报" /><FillsTable rows={(fills.data ?? []).filter((f) => syms.includes(f.symbol))} max={80} /></div>
        </div>
        <Note>委托进入平台交易系统，按实时行情撮合，成交记录永久保存。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== IMGR 平台持仓库存与风险 */
const BENCH_OF = (m: string) => (m === "CN" ? "sh000300" : m === "HK" ? "^HSI" : "SPY");
function useFxToCny() {
  const fx = useTicks(["USDCNH", "USDHKD", "EURUSD", "USDJPY", "GBPUSD"]);
  return (ccy: string) => {
    const usd = fx.USDCNH?.price ?? null;
    if (ccy === "CNY" || ccy === "RMB") return 1;
    if (!usd) return null;
    if (ccy === "USD") return usd;
    if (ccy === "HKD") return fx.USDHKD?.price ? usd / fx.USDHKD.price : null;
    if (ccy === "EUR") return fx.EURUSD?.price ? usd * fx.EURUSD.price : null;
    if (ccy === "GBP") return fx.GBPUSD?.price ? usd * fx.GBPUSD.price : null;
    if (ccy === "JPY") return fx.USDJPY?.price ? usd / fx.USDJPY.price : null;
    return null;
  };
}

export function EqIMGR({ onClose }: P) {
  const [tab, setTab] = useState("inv");
  const pos = usePositions();
  const sum = useSummary();
  const fills = useFills();
  const toCny = useFxToCny();
  const rows: Position[] = (pos.data?.rows ?? []).filter((r) => r.qty !== 0);
  const syms = [...new Set([...rows.map((r) => r.symbol), "SPY", "sh000300", "^HSI", "^TNX"])].slice(0, 60);
  const pack = useCloses(tab === "risk" ? syms : [], 300);
  const [rate, setRate] = useState(25);
  const [eq, setEq] = useState(-5);
  const mvCny = (r: Position) => { const k = toCny(r.ccy); return r.marketValue != null && k != null ? r.marketValue * k : null; };
  const total = rows.reduce((a, r) => a + (mvCny(r) ?? 0), 0);
  const risk = useMemo(() => {
    const { m } = align(pack.data ?? null, syms);
    const dy = diffs((m["^TNX"] ?? []).slice(-253)).map((v) => v / 100);
    return Object.fromEntries(rows.map((r) => {
      const re = sret((m[r.symbol] ?? []).slice(-253));
      const be = sret((m[BENCH_OF(r.market)] ?? []).slice(-253));
      const b = betaOf(re, be);
      const d = betaOf(re, dy);
      return [r.symbol, { beta: b, dur: d == null ? null : -d, vol: annVol((m[r.symbol] ?? []).slice(-253)) }];
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.data, rows.map((r) => r.symbol).join()]);
  const byDay = useMemo(() => {
    const mp = new Map<string, { buy: number; sell: number; fee: number; n: number }>();
    for (const f of fills.data ?? []) { const e = mp.get(f.tradeDate) ?? { buy: 0, sell: 0, fee: 0, n: 0 }; const k = toCny(f.ccy) ?? 1; if (f.side === "B") e.buy += f.notional * k; else e.sell += f.notional * k; e.fee += (f.fee + f.tax) * k; e.n++; mp.set(f.tradeDate, e); }
    return [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fills.data]);
  const s = sum.data;
  return (
    <PanelShell code="IMGR" title="持仓库存与风险" onClose={onClose} tabs={[["inv", "持仓库存"], ["pnl", "盈亏与交易"], ["risk", "风险汇总"]]} tab={tab} setTab={setTab} right={<span>平台模拟账户</span>}>
      <Kpis items={[["账户权益", fmtCompact(s?.equity)], ["持仓市值", fmtCompact(s?.marketValue)], ["浮动盈亏", <span key="u" style={{ color: toneOf(s?.unrealized) }}>{fmtCompact(s?.unrealized)}</span>], ["当日盈亏", <span key="d" style={{ color: toneOf(s?.dayPnl) }}>{fmtCompact(s?.dayPnl)}</span>, s ? `累计收益 ${sgn(s.returnPct)}` : undefined]]} />
      {tab === "inv" && <>
        {rows.length ? <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>标的</th><th className={THL}>市场</th><th className={TH}>数量</th><th className={TH}>待交收</th><th className={TH}>成本价</th><th className={TH}>最新</th><th className={TH}>涨跌幅</th><th className={TH}>市值(本币)</th><th className={TH}>折人民币</th><th className={TH}>权重</th><th className={TH}>浮动盈亏</th><th className={TH}>当日盈亏</th><th className={TH}>已实现</th></tr></thead>
          <tbody>{rows.map((r) => { const c = mvCny(r); return <tr key={`${r.account}${r.symbol}`} className={ROW}><td className={TDL}>{r.name ?? r.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td><td className="px-2 text-[10px] text-slate-500">{MARKET_ZH[r.market] ?? r.market}</td><td className={TD}>{r.qty.toLocaleString()}</td><td className={TD}>{r.unsettledQty ? r.unsettledQty.toLocaleString() : "—"}</td><td className={TD}>{fmtPrice(r.avgCost)}</td><td className={TD}>{fmtPrice(r.last)}</td><td className={TD} style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className={TD}>{fmtCompact(r.marketValue)} <span className="text-[9px] text-slate-600">{r.ccy}</span></td><td className={TD}>{fmtCompact(c)}</td><td className={TD}>{c != null && total ? `${((c / total) * 100).toFixed(1)}%` : "—"}</td><td className={TD} style={{ color: toneOf(r.unrealized) }}>{fmtCompact(r.unrealized)}</td><td className={TD} style={{ color: toneOf(r.dayPnl) }}>{fmtCompact(r.dayPnl)}</td><td className={TD} style={{ color: toneOf(r.realized) }}>{fmtCompact(r.realized)}</td></tr>; })}</tbody></table>
          : <Empty loading={pos.loading} text="平台模拟账户暂无持仓，可在下方直接下单建立库存" />}
        <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[320px_minmax(0,1fr)]"><div className="bg-[#03070c]"><SectionHead title="调整库存（下单）" /><OrderTicket initial={rows[0]?.symbol ?? "IEF"} strategy="IMGR" compact /></div>
          <div className="bg-[#03070c]"><SectionHead title="持仓集中度（折人民币）" />{rows.length ? <Bars data={[...rows].sort((a, b) => (mvCny(b) ?? 0) - (mvCny(a) ?? 0)).slice(0, 12).map((r) => ({ k: r.name ?? r.symbol, v: mvCny(r) ?? 0 }))} height={150} /> : <Empty text="—" />}</div></div>
      </>}
      {tab === "pnl" && <>
        <Kpis items={[["已实现盈亏", fmtCompact(s?.realized)], ["累计手续费与税", fmtCompact(s?.feesPaid)], ["累计成交额", fmtCompact(s?.turnover)], ["待交收资金", fmtCompact(s?.unsettledCash)]]} />
        <SectionHead title="近 30 个交易日买入（红）/ 卖出（绿）成交额（折人民币）" />
        {byDay.length ? <Bars data={byDay.map(([d, e]) => ({ k: d.slice(5), v: e.buy, v2: e.sell }))} height={150} label={["买入", "卖出"]} /> : <Empty loading={fills.loading} text="暂无成交记录" />}
        <SectionHead title="各标的盈亏拆分" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>标的</th><th className={TH}>已实现</th><th className={TH}>浮动</th><th className={TH}>合计</th><th className={TH}>费用</th></tr></thead>
          <tbody>{(pos.data?.rows ?? []).map((r) => <tr key={`p${r.account}${r.symbol}`} className={ROW}><td className={TDL}>{r.name ?? r.symbol}</td><td className={TD} style={{ color: toneOf(r.realized) }}>{fmtCompact(r.realized)}</td><td className={TD} style={{ color: toneOf(r.unrealized) }}>{fmtCompact(r.unrealized)}</td><td className={TD} style={{ color: toneOf(r.realized + (r.unrealized ?? 0)) }}>{fmtCompact(r.realized + (r.unrealized ?? 0))}</td><td className={TD}>{fmtCompact(r.fees)}</td></tr>)}</tbody></table>
        <SectionHead title="逐日交易汇总" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>交易日</th><th className={TH}>笔数</th><th className={TH}>买入额</th><th className={TH}>卖出额</th><th className={TH}>费用</th></tr></thead>
          <tbody>{[...byDay].reverse().map(([d, e]) => <tr key={d} className={ROW}><td className={`${TDL} font-mono`}>{d}</td><td className={TD}>{e.n}</td><td className={TD}>{fmtCompact(e.buy)}</td><td className={TD}>{fmtCompact(e.sell)}</td><td className={TD}>{fmtCompact(e.fee)}</td></tr>)}</tbody></table>
      </>}
      {tab === "risk" && <>
        <div className="flex flex-wrap items-center gap-4 px-2 py-1 text-[11px]"><label className="flex items-center gap-2"><span className="text-slate-500">利率平行冲击</span><input type="range" min={-100} max={100} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} /><span className="w-14 font-mono text-white">{rate > 0 ? "+" : ""}{rate}bp</span></label><label className="flex items-center gap-2"><span className="text-slate-500">股市冲击</span><input type="range" min={-20} max={20} step={1} value={eq} onChange={(e) => setEq(Number(e.target.value))} /><span className="w-12 font-mono text-white">{eq > 0 ? "+" : ""}{eq}%</span></label></div>
        {rows.length ? (() => {
          const list = rows.map((r) => { const x = risk[r.symbol]; const mv = mvCny(r) ?? 0; const dv01 = x?.dur != null ? mv * x.dur * 1e-4 : null; const pl = mv * ((x?.beta ?? 0) * eq / 100) - (dv01 ?? 0) * rate; return { r, x, mv, dv01, pl }; });
          const tot = list.reduce((a, y) => a + y.pl, 0);
          return <>
            <Kpis items={[["组合市值（折人民币）", fmtCompact(total)], ["组合 DV01", fmtCompact(list.reduce((a, y) => a + (y.dv01 ?? 0), 0)), "每 1bp 利率上行的估算损益"], ["情景损益", <span key="pl" style={{ color: toneOf(tot) }}>{fmtCompact(tot)}</span>], ["情景损益占比", total ? sgn((tot / total) * 100) : "—"]]} />
            <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>标的</th><th className={TH}>市值(人民币)</th><th className={TH}>对基准贝塔</th><th className={TH}>实证久期</th><th className={TH}>DV01</th><th className={TH}>年化波动</th><th className={TH}>情景损益</th></tr></thead>
              <tbody>{list.map((y) => <tr key={`r${y.r.symbol}`} className={ROW}><td className={TDL}>{y.r.name ?? y.r.symbol}<span className="ml-1 text-[9px] text-slate-500">对 {BENCH_OF(y.r.market) === "SPY" ? "标普" : BENCH_OF(y.r.market) === "^HSI" ? "恒指" : "沪深300"}</span></td><td className={TD}>{fmtCompact(y.mv)}</td><td className={TD}>{f2(y.x?.beta, 2)}</td><td className={TD}>{f2(y.x?.dur, 2)}</td><td className={TD}>{fmtCompact(y.dv01)}</td><td className={TD}>{f2(y.x?.vol, 1, "%")}</td><td className={TD} style={{ color: toneOf(y.pl) }}>{fmtCompact(y.pl)}</td></tr>)}</tbody></table>
          </>;
        })() : <Empty loading={pos.loading} text="暂无持仓" />}
        <Note>贝塔与实证久期由近 1 年日收益回归得到（股票对所在市场基准、全部持仓对美国 10 年期收益率日变动）；情景损益 = 市值 × 贝塔 × 股市冲击 − DV01 × 利率冲击，各币种按实时汇率折算人民币。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== TRPV 三方回购抵押品池 */
const BOND_ETF = new Set(["BIL", "SHY", "IEI", "IEF", "TLT", "GOVT", "TIP", "VCSH", "VCIT", "LQD", "HYG", "JNK", "BKLN", "MUB", "AGG", "BND", "BNDX", "EMB", "IGIB", "USHY", "ANGL", "SGOV", "sh511260", "sh511010", "sh511030", "sh511360", "sh511880"]);
type Cls = "现金" | "国债/债券ETF" | "美股" | "港股" | "A股" | "其他";
const classOf = (p: Position): Cls => (BOND_ETF.has(p.symbol) ? "国债/债券ETF" : p.market === "US" ? "美股" : p.market === "HK" ? "港股" : p.market === "CN" ? "A股" : "其他");
const DEFAULT_HC: Record<Cls, number> = { 现金: 0, "国债/债券ETF": 5, 美股: 15, 港股: 20, A股: 20, 其他: 100 };
type MM = { series: Record<string, Array<{ d: string; v: number; vol: number | null; p1: number | null; p99: number | null }>>; target: { from: number | null; to: number | null } };

export function EqTRPV() {
  const [tab, setTab] = useState("pool");
  const pos = usePositions();
  const sum = useSummary();
  const toCny = useFxToCny();
  const saved = useSaved<Record<Cls, number>>("trpvhc");
  const [hc, setHc] = useState<Record<Cls, number> | null>(null);
  useEffect(() => { if (!saved.loading && hc == null) setHc({ ...DEFAULT_HC, ...(saved.data ?? {}) }); }, [saved.loading, saved.data, hc]);
  const H = hc ?? DEFAULT_HC;
  const rows = (pos.data?.rows ?? []).filter((r) => r.qty > 0);
  const bars = useBars(rows.map((r) => r.symbol).slice(0, 40), 30, "1d", 900_000);
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 1800_000);
  const [term, setTerm] = useState(7);
  const usd = toCny("USD");
  const pool = rows.map((r) => {
    const cls = classOf(r);
    const k = toCny(r.ccy);
    const mv = r.marketValue != null && k != null ? r.marketValue * k : 0;
    const adv = avg((bars.data[r.symbol] ?? []).slice(-21, -1).map((b) => b.v ?? 0));
    const days = adv > 0 ? r.qty / (adv * 0.2) : null;
    return { r, cls, mv, cv: mv * (1 - (H[cls] ?? 100) / 100), days };
  });
  const cash = sum.data ? Math.max(0, sum.data.cash) : 0;
  const totMv = pool.reduce((a, x) => a + x.mv, 0) + cash;
  const totCv = pool.reduce((a, x) => a + x.cv, 0) + cash;
  const flag = (x: (typeof pool)[number]) => (H[x.cls] >= 100 ? "不合格" : (x.days != null && x.days > 3) || (totMv && x.mv / totMv > 0.25) ? "需复核" : "合格");
  const tg = mm.data?.series?.TGCR ?? [];
  const tgLast = tg[tg.length - 1]?.v ?? null;
  const persist = (next: Record<Cls, number>) => { setHc(next); void saveItem("trpvhc", next); };
  const byCls = (Object.keys(DEFAULT_HC) as Cls[]).map((c) => ({ c, mv: c === "现金" ? cash : pool.filter((x) => x.cls === c).reduce((a, x) => a + x.mv, 0), cv: c === "现金" ? cash : pool.filter((x) => x.cls === c).reduce((a, x) => a + x.cv, 0) })).filter((x) => x.mv > 0);
  return (
    <PanelShell code="TRPV" title="三方回购抵押品池" tabs={[["pool", "抵押品池"], ["rates", "回购利率"], ["conc", "集中度与折扣率"]]} tab={tab} setTab={setTab} right={<span>平台模拟账户</span>}>
      <Kpis items={[["抵押品市值（折人民币）", fmtCompact(totMv)], ["折后可融资额", fmtCompact(totCv)], ["加权折扣率", totMv ? `${((1 - totCv / totMv) * 100).toFixed(2)}%` : "—"], ["三方回购利率", tgLast != null ? `${tgLast.toFixed(2)}%` : "—", "美元三方一般担保回购"]]} />
      {tab === "pool" && <>
        {pool.length || cash ? <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>抵押品</th><th className={THL}>类别</th><th className={TH}>数量</th><th className={TH}>市值(人民币)</th><th className={TH}>折扣率</th><th className={TH}>折后价值</th><th className={TH}>变现天数</th><th className={TH}>占比</th><th className={THL}>合格性</th></tr></thead>
          <tbody>
            {cash ? <tr className={ROW}><td className={TDL}>现金</td><td className="px-2 text-[10px] text-slate-500">现金</td><td className={TD}>—</td><td className={TD}>{fmtCompact(cash)}</td><td className={TD}>{H.现金}%</td><td className={TD}>{fmtCompact(cash * (1 - H.现金 / 100))}</td><td className={TD}>0</td><td className={TD}>{totMv ? `${((cash / totMv) * 100).toFixed(1)}%` : "—"}</td><td className={`${TDL} text-emerald-300`}>合格</td></tr> : null}
            {pool.map((x) => { const fl = flag(x); return <tr key={x.r.symbol} className={ROW}><td className={TDL}>{x.r.name ?? x.r.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{x.r.symbol}</span></td><td className="px-2 text-[10px] text-slate-500">{x.cls}</td><td className={TD}>{x.r.qty.toLocaleString()}</td><td className={TD}>{fmtCompact(x.mv)}</td><td className={TD}>{H[x.cls]}%</td><td className={TD}>{fmtCompact(x.cv)}</td><td className={TD}>{f2(x.days, 1)}</td><td className={TD}>{totMv ? `${((x.mv / totMv) * 100).toFixed(1)}%` : "—"}</td><td className={`${TDL} ${fl === "合格" ? "text-emerald-300" : fl === "需复核" ? "text-amber-300" : "text-red-300"}`}>{fl}</td></tr>; })}
          </tbody></table> : <Empty loading={pos.loading} text="平台模拟账户暂无可作抵押的持仓" />}
        <Note>抵押品池取自平台模拟账户的实时持仓与现金，市值按实时价格与汇率折算人民币（现金按账户币种计）；变现天数 = 持仓数量 ÷ (近 20 日日均成交量 × 20% 参与率)。超过 3 天或单一抵押品占比超过 25% 记为“需复核”。折扣率为平台设定参数，可在“集中度与折扣率”页调整并永久保存。</Note>
      </>}
      {tab === "rates" && <>
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>参考利率</th><th className={TH}>最新</th><th className={TH}>日期</th><th className={TH}>1% 分位</th><th className={TH}>99% 分位</th><th className={TH}>成交量(十亿美元)</th><th className={TH}>20日变动(bp)</th><th className="px-2">走势</th></tr></thead>
          <tbody>{[["SOFR", "担保隔夜融资利率"], ["TGCR", "三方一般担保回购利率"], ["BGCR", "广义一般担保回购利率"], ["EFFR", "有效联邦基金利率"], ["OBFR", "隔夜银行融资利率"]].map(([k, l]) => { const s = mm.data?.series?.[k] ?? []; const x = s[s.length - 1]; const p = s[s.length - 21]; return <tr key={k} className={ROW}><td className={TDL}>{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{k}</span></td><td className={`${TD} text-white`}>{f2(x?.v, 2, "%")}</td><td className={`${TD} text-[10px] text-slate-500`}>{x?.d ?? "—"}</td><td className={TD}>{f2(x?.p1, 2)}</td><td className={TD}>{f2(x?.p99, 2)}</td><td className={TD}>{x?.vol ?? "—"}</td><td className={TD} style={{ color: toneOf(x && p ? x.v - p.v : null) }}>{x && p ? sgn((x.v - p.v) * 100, 0, "") : "—"}</td><td className="px-2"><Mini values={s.slice(-60).map((y) => y.v)} /></td></tr>; })}</tbody></table>
        {(mm.data?.series?.SOFR?.length ?? 0) > 5 && <Lines series={[{ name: "SOFR", color: "#38bdf8", values: (mm.data!.series.SOFR ?? []).slice(-120).map((y) => y.v) }, { name: "TGCR", color: "#fbbf24", values: (mm.data!.series.TGCR ?? []).slice(-120).map((y) => y.v) }, { name: "EFFR", color: "#a78bfa", values: (mm.data!.series.EFFR ?? []).slice(-120).map((y) => y.v) }]} xLabels={(mm.data!.series.SOFR ?? []).slice(-120).map((y) => y.d.slice(5))} height={170} fmt={(v) => v.toFixed(2)} />}
        <SectionHead title="抵押品池融资利息成本" right={<Chips value={String(term)} options={[["1", "隔夜"], ["7", "7 天"], ["30", "30 天"], ["90", "90 天"]]} onChange={(v) => setTerm(Number(v))} />} />
        <Kpis items={[["可融资额（折美元）", usd ? fmtCompact(totCv / usd) : "—"], ["期限", `${term} 天`], ["年化利率（三方回购）", f2(tgLast, 2, "%")], ["利息成本（美元）", usd && tgLast != null ? fmtCompact((totCv / usd) * (tgLast / 100) * term / 360) : "—", "实际/360 计息"]]} />
      </>}
      {tab === "conc" && <>
        <SectionHead title="按类别：抵押品市值（红）与折后价值（绿）" />
        {byCls.length ? <Bars data={byCls.map((x) => ({ k: x.c, v: x.mv, v2: x.cv }))} height={150} label={["市值", "折后"]} /> : <Empty loading={pos.loading} />}
        <SectionHead title="折扣率设定（平台参数，永久保存）" />
        <table className="w-full text-[11px]"><tbody>{(Object.keys(DEFAULT_HC) as Cls[]).map((c) => <tr key={c} className={ROW}><td className={TDL}>{c}</td><td className={TD}><input type="number" min={0} max={100} value={H[c]} onChange={(e) => persist({ ...H, [c]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className={`${INP} w-16 text-right`} /> %</td><td className="px-2 text-[10px] text-slate-500">{H[c] >= 100 ? "不接受为抵押品" : `每 100 元市值可融资 ${(100 - H[c]).toFixed(0)} 元`}</td></tr>)}</tbody></table>
        <div className="px-2 py-1"><button type="button" onClick={() => persist({ ...DEFAULT_HC })} className={BTN}>恢复默认折扣率</button></div>
      </>}
    </PanelShell>
  );
}

/* ================================================================== PICK 可转债新发行日历与定价 */
type CbRow = { code: string; name: string; stock: string; stockName: string; convPrice: number; rating: string | null; expire: string; listing: string | null; scale: number | null; price: number | null; changePct: number | null; amount: number | null; stockPrice: number | null; stockChg: number | null; convValue: number | null; premium: number | null; doubleLow: number | null; years: number | null };

export function EqPICK({ onClose }: P) {
  const [tab, setTab] = useState("cal");
  const cb = usePolled<{ at: number; rows: CbRow[] }>("ucHubs.convertibles", {}, 30_000);
  const rows = cb.data?.rows ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const pending = rows.filter((r) => !r.listing || r.listing > today);
  const recent = rows.filter((r) => r.listing && r.listing <= today).sort((a, b) => (b.listing ?? "").localeCompare(a.listing ?? ""));
  const [rating, setRating] = useState("全部");
  const ratings = [...new Set(rows.map((r) => r.rating ?? "无评级"))].sort();
  const months = useMemo(() => {
    const mp = new Map<string, { n: number; s: number }>();
    for (const r of rows) { if (!r.listing) continue; const k = r.listing.slice(0, 7); const e = mp.get(k) ?? { n: 0, s: 0 }; e.n++; e.s += r.scale ?? 0; mp.set(k, e); }
    return [...mp.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-24);
  }, [rows]);
  const newest = recent.slice(0, 6);
  const pack = useCloses(tab === "trend" ? newest.map((r) => r.code) : [], 120);
  const { pick } = useHub();
  const byRating = ratings.map((g) => { const rs = rows.filter((r) => (r.rating ?? "无评级") === g && r.premium != null); const pr = rs.map((r) => r.premium!).sort((a, b) => a - b); return { g, n: rs.length, prem: pr.length ? pr[Math.floor(pr.length / 2)] : null, price: rs.length ? avg(rs.map((r) => r.price ?? 0)) : null, scale: rs.reduce((a, r) => a + (r.scale ?? 0), 0) }; });
  const list = (rating === "全部" ? recent : recent.filter((r) => (r.rating ?? "无评级") === rating)).slice(0, 80);
  return (
    <PanelShell code="PICK" title="新发行日历与定价（可转债）" onClose={onClose} tabs={[["cal", "发行日历"], ["size", "发行规模"], ["price", "定价分析"], ["trend", "新券走势"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["存续可转债", `${rows.length} 只`], ["待上市", `${pending.length} 只`], ["近 30 日上市", `${recent.filter((r) => (Date.now() - Date.parse(r.listing!)) / 86400e3 <= 30).length} 只`], ["全市场溢价率中位数", (() => { const p = rows.map((r) => r.premium).filter((v): v is number => v != null).sort((a, b) => a - b); return p.length ? `${p[Math.floor(p.length / 2)].toFixed(1)}%` : "—"; })()]]} />
      {tab === "cal" && <>
        <SectionHead title="待上市（已发行、尚未挂牌）" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>代码</th><th className={THL}>名称</th><th className={THL}>正股</th><th className={THL}>评级</th><th className={TH}>规模(亿)</th><th className={TH}>转股价</th><th className={TH}>正股价</th><th className={TH}>转股价值</th><th className={TH}>到期</th></tr></thead>
          <tbody>{pending.map((r) => <tr key={r.code} onClick={() => pick(r.stock)} className={`${ROW} cursor-pointer`}><td className={`${TDL} font-mono text-cyan-200`}>{r.code}</td><td className={TDL}>{r.name}</td><td className={TDL}>{r.stockName}</td><td className="px-2 text-[10px] text-amber-200">{r.rating ?? "—"}</td><td className={TD}>{f2(r.scale, 2)}</td><td className={TD}>{fmtPrice(r.convPrice)}</td><td className={TD} style={{ color: toneOf(r.stockChg) }}>{fmtPrice(r.stockPrice)}</td><td className={TD}>{f2(r.convValue, 2)}</td><td className={`${TD} text-[10px]`}>{r.expire}</td></tr>)}{!pending.length && <tr><td colSpan={9}><Empty loading={cb.loading} text="当前没有待上市可转债" /></td></tr>}</tbody></table>
        <SectionHead title="最近上市" right={<Chips value={rating} options={[["全部", "全部"], ...ratings.map((g) => [g, g] as [string, string])]} onChange={setRating} />} />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>上市日</th><th className={THL}>名称</th><th className={THL}>评级</th><th className={TH}>规模(亿)</th><th className={TH}>现价</th><th className={TH}>涨跌幅</th><th className={TH}>转股溢价率</th><th className={TH}>双低值</th><th className={TH}>成交额</th><th className={TH}>剩余年限</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.code} onClick={() => pick(r.code)} className={`${ROW} cursor-pointer`}><td className={`${TDL} font-mono text-[10px]`}>{r.listing}</td><td className={TDL}>{r.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.code}</span></td><td className="px-2 text-[10px] text-amber-200">{r.rating ?? "—"}</td><td className={TD}>{f2(r.scale, 2)}</td><td className={TD}>{fmtPrice(r.price)}</td><td className={TD} style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td><td className={TD}>{f2(r.premium, 2, "%")}</td><td className={TD}>{f2(r.doubleLow, 1)}</td><td className={TD}>{fmtCompact(r.amount)}</td><td className={TD}>{f2(r.years, 2)}</td></tr>)}</tbody></table>
        <Note>地方政府债逐笔发行与簿记数据无公开实时来源，本页改为交易所可转债的新发行日历与二级定价（条款 + 实时价格），口径为全市场存续券。</Note>
      </>}
      {tab === "size" && <>
        <SectionHead title="近 24 个月按上市月份统计：发行规模（亿元）" />
        {months.length ? <Bars data={months.map(([k, e]) => ({ k: k.slice(2), v: e.s }))} fmt={(v) => `${v.toFixed(1)}亿`} height={160} /> : <Empty loading={cb.loading} />}
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>月份</th><th className={TH}>上市只数</th><th className={TH}>规模合计(亿)</th><th className={TH}>平均规模(亿)</th></tr></thead>
          <tbody>{[...months].reverse().map(([k, e]) => <tr key={k} className={ROW}><td className={`${TDL} font-mono`}>{k}</td><td className={TD}>{e.n}</td><td className={TD}>{e.s.toFixed(2)}</td><td className={TD}>{e.n ? (e.s / e.n).toFixed(2) : "—"}</td></tr>)}</tbody></table>
        <Note>统计口径为当前仍存续的可转债，已到期或已摘牌的券不计入。</Note>
      </>}
      {tab === "price" && <>
        <SectionHead title="按评级：溢价率中位数与平均价格" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>评级</th><th className={TH}>只数</th><th className={TH}>溢价率中位数</th><th className={TH}>平均价格</th><th className={TH}>存量规模(亿)</th></tr></thead>
          <tbody>{byRating.map((x) => <tr key={x.g} className={ROW}><td className={`${TDL} text-amber-200`}>{x.g}</td><td className={TD}>{x.n}</td><td className={TD}>{f2(x.prem, 2, "%")}</td><td className={TD}>{f2(x.price, 2)}</td><td className={TD}>{x.scale.toFixed(1)}</td></tr>)}</tbody></table>
        <SectionHead title="近 90 日上市新券：规模与溢价率" />
        <table className="w-full text-[11px]"><thead className={HEAD}><tr><th className={THL}>名称</th><th className={THL}>评级</th><th className={TH}>规模(亿)</th><th className={TH}>现价</th><th className={TH}>溢价率</th><th className={TH}>相对同评级中位</th><th className={TH}>正股涨跌</th></tr></thead>
          <tbody>{recent.filter((r) => (Date.now() - Date.parse(r.listing!)) / 86400e3 <= 90).map((r) => { const ref = byRating.find((x) => x.g === (r.rating ?? "无评级"))?.prem ?? null; const rel = r.premium != null && ref != null ? r.premium - ref : null; return <tr key={r.code} onClick={() => pick(r.code)} className={`${ROW} cursor-pointer`}><td className={TDL}>{r.name}</td><td className="px-2 text-[10px] text-amber-200">{r.rating ?? "—"}</td><td className={TD}>{f2(r.scale, 2)}</td><td className={TD}>{fmtPrice(r.price)}</td><td className={TD}>{f2(r.premium, 2, "%")}</td><td className={TD} style={{ color: toneOf(rel == null ? null : -rel) }}>{sgn(rel, 2, "pp")}</td><td className={TD} style={{ color: toneOf(r.stockChg) }}>{fmtPct(r.stockChg)}</td></tr>; })}</tbody></table>
        <Note>转股溢价率 = 转债价格 ÷ 转股价值 − 1；“相对同评级中位”为负表示比同评级券更便宜。</Note>
      </>}
      {tab === "trend" && (() => {
        const ok = newest.filter((r) => (pack.data?.[r.code]?.length ?? 0) > 1);
        const n = Math.max(0, ...ok.map((r) => pack.data![r.code].length));
        return <>
          <SectionHead title="最近上市 6 只新券：上市以来价格（面值 100）" />
          {ok.length ? <Lines series={ok.map((r, i) => { const c = pack.data![r.code].map((x) => x[1]); return { name: r.name, color: COLORS[i % COLORS.length], values: [...new Array(n - c.length).fill(null), ...c] }; })} height={220} fmt={(v) => v.toFixed(1)} /> : <Empty loading={pack.loading} text="新券上市时间较短，暂无足够日线" />}
          <table className="w-full text-[11px]"><tbody>{newest.map((r) => { const c = (pack.data?.[r.code] ?? []).map((x) => x[1]); return <tr key={r.code} onClick={() => pick(r.code)} className={`${ROW} cursor-pointer`}><td className={TDL}>{r.name}</td><td className={`${TD} text-[10px]`}>{r.listing}</td><td className={TD}>首日收盘 {f2(c[0], 2)}</td><td className={TD}>最新 {fmtPrice(r.price)}</td><td className={TD} style={{ color: toneOf(c.length && r.price ? r.price - c[0] : null) }}>{c.length && r.price ? sgn((r.price / c[0] - 1) * 100) : "—"}</td></tr>; })}</tbody></table>
        </>;
      })()}
    </PanelShell>
  );
}

