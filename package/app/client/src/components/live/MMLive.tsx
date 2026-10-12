/**
 * 货币市场分组 3 个小窗，互不重复：
 * PGM  货币市场项目发行（美国短期国库券一级发行：待发行日程、中标结果、认购倍数与定价、发行节奏）；
 * PBOC 中国人民银行与人民币货币市场（央行动态、交易所回购利率期限结构、人民币汇率、国债 ETF 与股债联动）；
 * 新闻研究（全球货币市场主题研究：美联储 / 回购流动性 / 短券 / 其他主要央行的主题聚类与情绪，结合实时短端利率与政策路径）。
 */
import { useMemo, useState } from "react";
import { DOWN, UP, fmtCompact, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, Seg, Spark, ago, useFeed, type News } from "@/uc/news/kit";
import { Bars, Lines, LiveBoard } from "@/uc/hubs/kit";
import { align, annVol, f2, heat, perf, rollingCorr, sgn, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead } from "@/uc/panels/kit";

type P = { onClose?: () => void };
const th = "text-[10px] text-slate-500";
const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示

/* ================================================================== PGM 短期国库券发行 */
type Auction = { cusip: string; type: string; term: string; reopening: boolean; announce: string; auction: string; issue: string; maturity: string; offering: number | null; coupon: number | null; highYield: number | null; highDiscount: number | null; btc: number | null; total: number | null; tendered: number | null; direct: number | null; indirect: number | null; dealer: number | null; allotted: number | null; tips: boolean; frn: boolean; closing: string };
type MM = { series: Record<string, Array<{ d: string; v: number; vol: number | null; p1: number | null; p99: number | null }>>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>; sofrStrip: Array<{ month: string; rate: number; chg: number | null; volume: number | null }> };
const TERM_ZH = (t: string) => t.replace(/-Week/, " 周").replace(/-Year/, " 年").replace(/-Month/, " 个月").replace(/-Day/, " 天");
const TYPE_ZH: Record<string, string> = { Bill: "国库券", Note: "中期国债", Bond: "长期国债", TIPS: "通胀保值", FRN: "浮息债", CMB: "现金管理券" };
const typeZh = (a: Auction) => (a.frn ? "浮息债" : a.tips ? "通胀保值" : TYPE_ZH[a.type] ?? a.type);
const BILL_TERMS = ["4-Week", "6-Week", "8-Week", "13-Week", "17-Week", "26-Week", "52-Week"];
const COL = ["#38bdf8", "#fbbf24", "#f472b6", "#34d399", "#a78bfa", "#fb923c", "#94a3b8"];
const bn = (v: number | null | undefined) => (v == null ? "—" : `${(v / 1e9).toFixed(1)}`);

export function PGMLive({ onClose }: P) {
  const [tab, setTab] = useState("up");
  const [scope, setScope] = useState("bill");
  const a = usePolled<{ upcoming: Auction[]; results: Auction[] }>("ucHubs.auctions", {}, 900_000);
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 1800_000);
  const up = (a.data?.upcoming ?? []).filter((x) => scope === "all" || x.type === "Bill");
  const bills = (a.data?.results ?? []).filter((x) => x.type === "Bill");
  const sofr = mm.data?.series.SOFR ?? [];
  const sofrAt = (d: string) => { let v: number | null = null; for (const r of sofr) { if (r.d <= d) v = r.v; else break; } return v; };
  const last4w = bills.filter((x) => Date.parse(x.auction) > Date.now() - 28 * 86400e3);
  const avg = (k: keyof Auction, arr = last4w) => { const v = arr.map((x) => x[k] as number | null).filter((x): x is number => x != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const nextWeek = (a.data?.upcoming ?? []).filter((x) => x.type === "Bill" && Date.parse(x.auction) < Date.now() + 8 * 86400e3);
  const latest13 = bills.find((x) => x.term === "13-Week");
  const spread13 = latest13?.highYield != null && sofrAt(latest13.auction) != null ? (latest13.highYield - sofrAt(latest13.auction)!) * 100 : null;
  const terms = BILL_TERMS.filter((t) => bills.some((x) => x.term === t));
  const dates = [...new Set(bills.map((x) => x.auction))].sort();
  const weekly = useMemo(() => {
    const m = new Map<string, { gross: number; mat: number }>();
    for (const x of bills) { const d = new Date(`${x.issue}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); const k = d.toISOString().slice(0, 10); const e = m.get(k) ?? { gross: 0, mat: 0 }; e.gross += x.total ?? 0; m.set(k, e); }
    return [...m.entries()].sort((p, q) => p[0].localeCompare(q[0])).slice(-16).map(([k, v]) => ({ k: k.slice(5), v: v.gross / 1e9 }));
  }, [a.data]);
  return (
    <PanelShell code="PGM" title="货币市场项目发行 · 美国短期国库券" onClose={onClose} tabs={[["up", "待发行日程"], ["res", "中标结果"], ["px", "认购与定价"], ["flow", "发行节奏"]]} tab={tab} setTab={setTab} right={<span>美国财政部一级发行</span>}>
      <Kpis items={[["未来一周国库券计划发行", nextWeek.length ? `$${bn(nextWeek.reduce((s, x) => s + (x.offering ?? 0), 0))} 十亿` : "—", `${nextWeek.length} 场拍卖`], ["近 4 周平均认购倍数", f2(avg("btc"), 2), `${last4w.length} 场国库券拍卖`], ["13 周中标利率 − SOFR", spread13 == null ? "—" : <span style={{ color: toneOf(spread13) }}>{spread13 > 0 ? "+" : ""}{spread13.toFixed(1)} bp</span>, latest13 ? `${latest13.auction} 中标 ${f2(latest13.highYield, 3, "%")}` : undefined], ["近 4 周一级交易商获配", f2(avg("dealer"), 1, "%"), `间接投标 ${f2(avg("indirect"), 1, "%")}`]]} />
      {tab === "up" && <>
        <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><Seg value={scope} onChange={setScope} options={[["bill", "仅国库券"], ["all", "全部品种"]]} /><span className="text-[10px] text-slate-500">{up.length} 场</span></div>
        <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">品种</th><th className="text-left">期限</th><th className="text-right">计划发行（十亿美元）</th><th className="text-left pl-3">公告日</th><th className="text-left">发行日</th><th className="text-left">到期日</th><th className="px-2 text-left">续发</th></tr></thead>
          <tbody>{up.map((x) => <tr key={x.cusip + x.auction} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-200">{x.auction}</td><td className="text-slate-100">{typeZh(x)}</td><td className="text-slate-300">{TERM_ZH(x.term)}</td><td className="text-right font-mono text-white">{bn(x.offering)}</td><td className="pl-3 font-mono text-[10px] text-slate-500">{x.announce}</td><td className="font-mono text-[10px] text-slate-400">{x.issue}</td><td className="font-mono text-[10px] text-slate-400">{x.maturity}</td><td className="px-2 text-slate-500">{x.reopening ? "是" : ""}</td></tr>)}
            {!up.length && <tr><td colSpan={8}><Empty loading={a.loading} text="暂无已公告的待发行拍卖" /></td></tr>}</tbody></table>
      </>}
      {tab === "res" && <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">期限</th><th className="text-right">中标贴现率</th><th className="text-right">中标投资收益率</th><th className="text-right">同日 SOFR</th><th className="text-right">认购倍数</th><th className="text-right">发行（十亿）</th><th className="text-right">直接</th><th className="text-right">间接</th><th className="text-right">交易商</th><th className="px-2 text-right">尾部配售</th></tr></thead>
        <tbody>{bills.map((x) => { const s = sofrAt(x.auction); return <tr key={x.cusip + x.auction} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-300">{x.auction}</td><td className="text-slate-100">{TERM_ZH(x.term)}</td><td className="text-right font-mono text-slate-300">{f2(x.highDiscount, 3, "%")}</td><td className="text-right font-mono text-white">{f2(x.highYield, 3, "%")}</td><td className="text-right font-mono text-slate-400">{f2(s, 2, "%")}</td><td className="text-right font-mono" style={{ background: heat(x.btc != null ? (x.btc - 2.8) * 10 : null, 8) }}>{f2(x.btc, 2)}</td><td className="text-right font-mono text-slate-200">{bn(x.total)}</td><td className="text-right font-mono text-slate-400">{f2(x.direct, 1)}</td><td className="text-right font-mono text-slate-300">{f2(x.indirect, 1)}</td><td className="text-right font-mono" style={{ color: (x.dealer ?? 0) > 25 ? "#fbbf24" : "#cbd5e1" }}>{f2(x.dealer, 1)}</td><td className="px-2 text-right font-mono text-slate-500">{f2(x.allotted, 2, "%")}</td></tr>; })}
          {!bills.length && <tr><td colSpan={11}><Empty loading={a.loading} /></td></tr>}</tbody></table>}
      {tab === "px" && <>
        <SectionHead title="各期限认购倍数（近 120 天）" />
        {dates.length > 1 ? <Lines series={terms.map((t, i) => ({ name: TERM_ZH(t), color: COL[i % COL.length], values: dates.map((d) => bills.find((x) => x.term === t && x.auction === d)?.btc ?? null) }))} xLabels={dates.map((d) => d.slice(5))} height={170} /> : <Empty loading={a.loading} />}
        <SectionHead title="中标利率 vs SOFR（13 周 / 26 周）" sub="国库券相对担保隔夜融资的定价" />
        {dates.length > 1 ? <Lines series={[{ name: "13 周中标", color: "#fbbf24", values: dates.map((d) => bills.find((x) => x.term === "13-Week" && x.auction === d)?.highYield ?? null) }, { name: "26 周中标", color: "#f472b6", values: dates.map((d) => bills.find((x) => x.term === "26-Week" && x.auction === d)?.highYield ?? null) }, { name: "SOFR", color: "#38bdf8", values: dates.map((d) => sofrAt(d)), dash: true }]} xLabels={dates.map((d) => d.slice(5))} height={150} fmt={(v) => v.toFixed(3)} /> : null}
        <SectionHead title="各期限最近一次发行" />
        <table className="w-full text-[11px]"><tbody>{terms.map((t) => { const x = bills.find((b) => b.term === t)!; return <tr key={t} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{TERM_ZH(t)}</td><td className="font-mono text-[10px] text-slate-500">{x.auction}</td><td className="text-right font-mono text-white">{f2(x.highYield, 3, "%")}</td><td className="text-right font-mono text-slate-300">倍数 {f2(x.btc, 2)}</td><td className="px-2 text-right font-mono text-slate-400">${bn(x.total)} 十亿</td></tr>; })}</tbody></table>
      </>}
      {tab === "flow" && <>
        <SectionHead title="每周国库券发行总额（按发行日所在周，十亿美元）" />
        {weekly.length ? <Bars data={weekly} fmt={(v) => v.toFixed(0)} height={160} /> : <Empty loading={a.loading} />}
        <SectionHead title="近 4 周投资者结构（平均获配占比）" />
        <Bars data={[{ k: "直接投标", v: avg("direct") ?? 0 }, { k: "间接投标（含境外官方）", v: avg("indirect") ?? 0 }, { k: "一级交易商", v: avg("dealer") ?? 0 }]} fmt={(v) => `${v.toFixed(1)}%`} height={110} />
        <Note>国库券发行放量通常吸收货币基金与隔夜逆回购资金，留意与 SOFR 的利差变化。</Note>
      </>}
    </PanelShell>
  );
}

/* ================================================================== PBOC 中国人民银行 */
const REPO_SH: Array<[string, string, number]> = [["sh204001", "GC001", 1], ["sh204002", "GC002", 2], ["sh204003", "GC003", 3], ["sh204004", "GC004", 4], ["sh204007", "GC007", 7], ["sh204014", "GC014", 14], ["sh204028", "GC028", 28], ["sh204091", "GC091", 91], ["sh204182", "GC182", 182]];
const REPO_SZ: Array<[string, string]> = [["sz131810", "R-001"], ["sz131811", "R-002"], ["sz131801", "R-007"], ["sz131802", "R-014"]];
const BONDS: Array<[string, string]> = [["sh511260", "十年国债ETF"], ["sh511010", "五年国债ETF"], ["sh511090", "三十年国债ETF"], ["sh000012", "上证国债指数"], ["sh000013", "上证企业债指数"]];
const TOPIC_CN: Array<[string, string, RegExp | null]> = [["all", "全部", null], ["omo", "公开市场", /逆回购|MLF|中期借贷|公开市场|国债买卖|买断式|净投放|净回笼|SLF/i], ["rate", "利率与LPR", /LPR|贷款市场报价|降息|政策利率|利率/i], ["rrr", "准备金", /准备金|降准/i], ["fx", "汇率", /人民币|汇率|中间价|外汇/i], ["credit", "信贷与社融", /社融|信贷|M2|货币供应|贷款/i]];
export function PBOCLive({ onClose }: P) {
  const [tab, setTab] = useState("news");
  const [topic, setTopic] = useState("all");
  const [fxWin, setFxWin] = useState("250");
  const feed = useFeed({ cats: ["央行"], region: "中国", sort: "time", hours: 96, limit: 200, dedupe: true }, 120_000);
  const feedAll = useFeed({ q: "人民银行", sort: "time", hours: 96, limit: 100, dedupe: true }, 180_000);
  const items = useMemo(() => { const m = new Map<string, News>(); for (const n of [...feed.items, ...feedAll.items]) m.set(n.id, n); return [...m.values()].sort((a, b) => b.time - a.time); }, [feed.items, feedAll.items]);
  const re = TOPIC_CN.find((t) => t[0] === topic)![2];
  const shown = re ? items.filter((n) => re.test(`${n.title} ${n.summary ?? ""}`)) : items;
  const t = useTicks(["USDCNH", "USDCNY", "sh204001", "sh204007", "sz131810", "sh511260", "sh000300"]);
  const cnh = t.USDCNH?.price, cny = t.USDCNY?.price;
  const repo = useTicks(REPO_SH.map(([s]) => s));
  const fxSyms = ["USDCNH", "USDCNY", "DXY"];
  const fxPack = useCloses(tab === "fx" ? fxSyms : [], 800);
  const fx = useMemo(() => { const r = align(fxPack.data ?? null, (fxPack.data?.USDCNY?.length ?? 0) > 30 ? ["USDCNH", "USDCNY"] : ["USDCNH"]); return { dates: r.dates, m: { USDCNH: r.m.USDCNH ?? [], USDCNY: r.m.USDCNY ?? [] } }; }, [fxPack.data]);
  const fxd = useMemo(() => align(fxPack.data ?? null, ["USDCNH", "DXY"]), [fxPack.data]);
  const bSyms = [...BONDS.map(([s]) => s), "sh000300"];
  const bPack = useCloses(tab === "bond" ? bSyms : [], 800);
  const ETF3 = BONDS.slice(0, 3).map(([x]) => x).filter((x) => (bPack.data?.[x]?.length ?? 0) > 60);
  const bd = useMemo(() => align(bPack.data ?? null, ETF3), [bPack.data, ETF3.join()]);
  const sb = useMemo(() => align(bPack.data ?? null, ["sh000300", "sh511260"]), [bPack.data]);
  const n = Number(fxWin);
  return (
    <PanelShell code="PBOC" title="中国人民银行 · 人民币货币市场" onClose={onClose} tabs={[["news", "央行动态"], ["repo", "资金面"], ["fx", "人民币汇率"], ["bond", "国债与股债联动"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["美元 / 离岸人民币", fmtPrice(cnh, 4), cnh && t.USDCNH?.changePct != null ? `${t.USDCNH.changePct > 0 ? "+" : ""}${t.USDCNH.changePct.toFixed(2)}%` : undefined], ["离岸 − 在岸价差", cnh && cny ? <span style={{ color: toneOf(cnh - cny) }}>{((cnh - cny) * 10000).toFixed(0)} 点</span> : "—", cny ? `在岸 ${fmtPrice(cny, 4)}` : undefined], ["上交所隔夜回购 GC001", t.sh204001?.price ? `${t.sh204001.price.toFixed(3)}%` : "—", t.sh204007?.price ? `7 天 GC007 ${t.sh204007.price.toFixed(3)}%` : undefined], ["十年国债ETF", fmtPrice(t.sh511260?.price, 3), t.sh511260?.changePct != null ? `${t.sh511260.changePct > 0 ? "+" : ""}${t.sh511260.changePct.toFixed(2)}%` : undefined]]} />
      {tab === "news" && <>
        <div className="flex items-center gap-2 border-b border-[#1a2a3c] px-2 py-1"><Seg value={topic} onChange={setTopic} options={TOPIC_CN.map(([k, l]) => [k, l] as [string, string])} /><span className="text-[10px] text-slate-500">近 4 天 {shown.length} 条</span></div>
        <FeedList items={shown} loading={feed.loading && !items.length} empty="该主题近 4 天暂无动态" max={80} />
      </>}
      {tab === "repo" && <>
        <SectionHead title="上交所国债回购利率期限结构（实时）" sub="交易所质押式回购成交利率，反映非银机构的短端资金价格" />
        <Bars data={REPO_SH.map(([s, l]) => ({ k: l, v: repo[s]?.price ?? 0 }))} fmt={(v) => `${v.toFixed(3)}%`} height={130} />
        <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">品种</th><th className="text-right">期限（天）</th><th className="text-right">最新利率</th><th className="text-right">较昨收</th><th className="text-right">日内高</th><th className="text-right">日内低</th><th className="px-2 text-right">成交额</th></tr></thead>
          <tbody>{REPO_SH.map(([s, l, d]) => { const x = repo[s]; const ch = x?.price != null && x.prevClose ? (x.price - x.prevClose) * 100 : null; return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{l}</td><td className="text-right font-mono text-slate-400">{d}</td><td className="text-right font-mono text-white">{f2(x?.price, 3, "%")}</td><td className="text-right font-mono" style={{ color: toneOf(ch) }}>{ch == null ? "—" : `${ch > 0 ? "+" : ""}${ch.toFixed(0)} bp`}</td><td className="text-right font-mono text-slate-400">{f2(x?.high, 3)}</td><td className="text-right font-mono text-slate-400">{f2(x?.low, 3)}</td><td className="px-2 text-right font-mono text-slate-300">{fmtCompact(x?.amount)}</td></tr>; })}</tbody></table>
        <SectionHead title="深交所回购与场内货币基金" />
        <LiveBoard showMini={false} rows={[...REPO_SZ.map(([symbol, label]) => ({ symbol, label, group: "深交所质押式回购" })), { symbol: "sh511990", label: "场内货币基金（一）", group: "场内货币基金" }, { symbol: "sh511880", label: "场内货币基金（二）", group: "场内货币基金" }]} />
        <Note>回购品种的“价格”即年化利率（%）；月末、季末与缴税期通常出现利率冲高。</Note>
      </>}
      {tab === "fx" && <>
        <div className="flex justify-end border-b border-[#1a2a3c] px-2 py-1"><Seg value={fxWin} onChange={setFxWin} options={[["63", "3 月"], ["250", "1 年"], ["500", "2 年"]]} /></div>
        {fx.dates.length > 30 ? <>
          <Kpis items={[["离岸人民币 1 月", sgn(perf(fx.m.USDCNH, 21)), "正值 = 人民币贬值"], ["离岸人民币 3 月", sgn(perf(fx.m.USDCNH, 63))], ["20 日实现波动", f2(annVol(fx.m.USDCNH, 20), 2, "%"), `60 日 ${f2(annVol(fx.m.USDCNH, 60), 2, "%")}`], ["美元指数 3 月", sgn(perf((fxPack.data?.DXY ?? []).map((x) => x[1]), 63))]]} />
          <SectionHead title="美元 / 人民币：离岸 vs 在岸" />
          <Lines series={[{ name: "离岸", color: "#fbbf24", values: fx.m.USDCNH.slice(-n) }, ...(fx.m.USDCNY.length ? [{ name: "在岸", color: "#38bdf8", values: fx.m.USDCNY.slice(-n) }] : [])]} xLabels={fx.dates.slice(-n).map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(4)} />
          {fx.m.USDCNY.length > 0 && <SectionHead title="离岸与在岸人民币价差（点）" />}
          {fx.m.USDCNY.length > 0 && <Lines zero series={[{ name: "价差", color: "#f472b6", values: fx.m.USDCNH.slice(-n).map((v, i) => (v - fx.m.USDCNY.slice(-n)[i]) * 10000) }]} xLabels={fx.dates.slice(-n).map((d) => d.slice(2))} height={120} fmt={(v) => v.toFixed(0)} />}
          <SectionHead title="离岸人民币与美元指数 60 日滚动相关" />
          <Lines zero series={[{ name: "相关系数", color: "#a78bfa", values: rollingCorr(fxd.m.USDCNH ?? [], fxd.m.DXY ?? [], 60).slice(-n) }]} xLabels={fxd.dates.slice(-n).map((d) => d.slice(2))} height={110} />
        </> : <Empty loading={fxPack.loading} />}
      </>}
      {tab === "bond" && <>
        <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">品种</th><th className="text-right">1 月</th><th className="text-right">3 月</th><th className="text-right">6 月</th><th className="text-right">1 年</th><th className="px-2 text-right">年化波动</th></tr></thead>
          <tbody>{BONDS.map(([s, l]) => { const c = (bPack.data?.[s] ?? []).map((x) => x[1]); return <tr key={s} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-100">{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td>{[21, 63, 126, 252].map((k) => <td key={k} className="text-right font-mono" style={{ background: heat(perf(c, k), k / 25) }}>{sgn(perf(c, k))}</td>)}<td className="px-2 text-right font-mono text-slate-400">{f2(annVol(c, 126), 2)}</td></tr>; })}</tbody></table>
        {bd.dates.length > 60 || bPack.loading ? (bd.dates.length > 60 ? <>
          <SectionHead title="国债 ETF 走势（起点为 100）" />
          <Lines series={BONDS.slice(0, 3).filter(([s]) => ETF3.includes(s)).map(([s, l], i) => { const c = bd.m[s].slice(-500); return { name: l, color: COL[i], values: c.map((v) => (v / c[0]) * 100) }; })} xLabels={bd.dates.slice(-500).map((d) => d.slice(2))} height={170} fmt={(v) => v.toFixed(1)} />
          <SectionHead title="股债跷跷板：沪深 300 与十年国债ETF 60 日滚动相关" sub="负相关越深，股债轮动越明显" />
          <Lines zero series={[{ name: "相关系数", color: "#fbbf24", values: rollingCorr(sb.m.sh000300 ?? [], sb.m.sh511260 ?? [], 60).slice(-500) }]} xLabels={sb.dates.slice(-500).map((d) => d.slice(2))} height={120} />
        </> : <Empty loading />) : <Empty text="国债 ETF 历史数据暂不可用" />}
      </>}
    </PanelShell>
  );
}

/* ================================================================== 货币市场新闻研究 */
const TOPICS: Array<[string, string, RegExp]> = [
  ["fed", "美联储政策", /美联储|联储|FOMC|鲍威尔|联邦基金|\bFed\b|Federal Reserve|Powell/i],
  ["liq", "回购与流动性", /回购|流动性|SOFR|准备金|资金面|\brepo\b|liquidity|reserves|standing repo/i],
  ["bill", "短券与货币基金", /国库券|短债|短期国债|货币基金|T-bill|\bbills?\b|money market fund|money-market/i],
  ["ecb", "欧洲央行", /欧洲央行|欧央行|拉加德|\bECB\b|Lagarde/i],
  ["boj", "日本央行", /日本央行|日银|植田|\bBOJ\b|Bank of Japan|Ueda/i],
  ["oth", "其他央行", /英国央行|英格兰银行|\bBOE\b|Bank of England|加拿大央行|Bank of Canada|澳洲联储|\bRBA\b|瑞士央行|\bSNB\b|新西兰联储|\bRBNZ\b/i],
];
export function MMNewsResearchLive({ onClose }: P) {
  const [tab, setTab] = useState("fed");
  const feed = useFeed({ cats: ["央行", "债券"], sort: "time", hours: 72, limit: 400, dedupe: true }, 120_000);
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 1800_000);
  const now = Date.now();
  const stats = useMemo(() => TOPICS.map(([id, name, re]) => {
    const list = feed.items.filter((n) => re.test(`${n.title} ${n.summary ?? ""}`));
    const pos = list.filter((n) => n.tone > 0).length, neg = list.filter((n) => n.tone < 0).length;
    const buckets = Array.from({ length: 12 }, () => 0);
    for (const n of list) { const b = 11 - Math.floor((now - n.time) / (6 * 3600e3)); if (b >= 0 && b < 12) buckets[b]++; }
    const last24 = list.filter((n) => n.time > now - 86400e3).length;
    return { id, name, list, pos, neg, idx: list.length ? Math.round(((pos - neg) / list.length) * 100) : null, buckets, last24, prev: list.length - last24, latest: list[0] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [feed.items]);
  const cur = stats.find((s) => s.id === tab)!;
  const s = mm.data?.series ?? {};
  const last = (k: string) => s[k]?.[s[k].length - 1];
  const prev = (k: string) => s[k]?.[s[k].length - 2];
  const d1 = (k: string) => (last(k) && prev(k) ? (last(k)!.v - prev(k)!.v) * 100 : null);
  const tg = mm.data?.target;
  const path = mm.data?.path ?? [];
  return (
    <PanelShell code="NEWS" title="货币市场新闻研究" onClose={onClose} tabs={TOPICS.map(([id, name]) => [id, name] as [string, string])} tab={tab} setTab={setTab} right={<span>近 72 小时 · {feed.items.length} 条央行与债市新闻</span>}>
      <Kpis items={[["SOFR", last("SOFR") ? `${last("SOFR")!.v.toFixed(2)}%` : "—", d1("SOFR") != null ? `${d1("SOFR")! > 0 ? "+" : ""}${d1("SOFR")!.toFixed(0)} bp · ${last("SOFR")!.d}` : undefined], ["有效联邦基金利率", last("EFFR") ? `${last("EFFR")!.v.toFixed(2)}%` : "—", tg?.from != null ? `目标区间 ${tg.from.toFixed(2)}–${tg.to?.toFixed(2)}%` : undefined], ["SOFR − 准备金上限", last("SOFR") && tg?.to != null ? <span style={{ color: last("SOFR")!.v > tg.to ? UP : DOWN }}>{((last("SOFR")!.v - tg.to) * 100).toFixed(0)} bp</span> : "—", "接近或高于上限 = 资金偏紧"], ["期货隐含降息次数", path.length ? f2(path[Math.min(path.length - 1, 11)].cuts, 1) : "—", path.length ? `至 ${path[Math.min(path.length - 1, 11)].month}（每次 25bp）` : undefined]]} />
      <SectionHead title="主题热度与情绪" sub="点击切换主题" />
      <table className="w-full text-[11px]"><thead className={th}><tr><th className="px-2 py-1 text-left">主题</th><th className="text-right">72 小时</th><th className="text-right">近 24 小时</th><th className="text-right">前 48 小时</th><th className="text-right">利好 / 利空</th><th className="text-right">情绪指数</th><th className="px-2">热度走势</th><th className="px-2 text-left">最新</th></tr></thead>
        <tbody>{stats.map((x) => <tr key={x.id} onClick={() => setTab(x.id)} className={`cursor-pointer border-t border-[#0f1b29] ${x.id === tab ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}><td className="px-2 py-0.5 text-slate-100">{x.name}</td><td className="text-right font-mono text-white">{x.list.length}</td><td className="text-right font-mono text-slate-300">{x.last24}</td><td className="text-right font-mono text-slate-500">{x.prev}</td><td className="text-right font-mono"><span style={{ color: UP }}>{x.pos}</span> / <span style={{ color: DOWN }}>{x.neg}</span></td><td className="text-right font-mono" style={{ background: heat(x.idx, 60) }}>{x.idx == null ? "—" : `${x.idx > 0 ? "+" : ""}${x.idx}`}</td><td className="px-2"><Spark values={x.buckets} width={80} /></td><td className="px-2 text-[10px] text-slate-500">{x.latest ? ago(x.latest.time) : "—"}</td></tr>)}</tbody></table>
      <SectionHead title={`${cur.name} · 研究线索`} right={<span>{cur.list.length} 条</span>} />
      <FeedList items={cur.list} loading={feed.loading} empty="近 72 小时该主题暂无新闻" max={60} />
      {tab === "fed" && path.length > 0 && <>
        <SectionHead title="联邦基金期货隐含利率路径" sub="与新闻叙事对照：叙事转鸽而路径未动，往往意味着市场已定价" />
        <Bars data={path.slice(0, 12).map((p) => ({ k: p.month, v: p.rate }))} fmt={(v) => `${v.toFixed(3)}%`} height={120} />
      </>}
      {tab === "liq" && (s.SOFR?.length ?? 0) > 20 && <>
        <SectionHead title="担保隔夜利率与成交量（近 60 个交易日）" />
        <Lines series={[{ name: "SOFR", color: "#fbbf24", values: s.SOFR.slice(-60).map((r) => r.v) }, { name: "三方回购", color: "#38bdf8", values: (s.TGCR ?? []).slice(-60).map((r) => r.v) }, { name: "SOFR 99 分位", color: "#f472b6", values: s.SOFR.slice(-60).map((r) => r.p99), dash: true }]} xLabels={s.SOFR.slice(-60).map((r) => r.d.slice(5))} height={140} fmt={(v) => v.toFixed(2)} />
        <SectionHead title="SOFR 成交量（十亿美元，近 30 个交易日）" />
        <Bars data={s.SOFR.slice(-30).map((r) => ({ k: r.d.slice(5), v: r.vol ?? 0 }))} fmt={(v) => v.toFixed(0)} height={90} />
      </>}
    </PanelShell>
  );
}
