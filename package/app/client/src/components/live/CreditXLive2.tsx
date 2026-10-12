/**
 * 信用 / CDS / 主权 组（二）：主权债一级市场与流动性、主权利差隐含违约概率、单名 CDS 估值、主权利差压力测试、
 * SOFR 期货条与资金信用基差、欧元区主权利差热力矩阵。
 * 数据：美债拍卖结果与日历、欧洲各国 10 年期官方月度长期利率（对德利差）、实时美债曲线、纽约资金市场利率与利率期货、实时行情。
 * CDS 报价没有公开来源：CDS 估值一律以实时美债曲线贴现、由用户输入或从真实主权利差导入的利差驱动。
 */
import { useMemo, useState } from "react";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, Seg, useFeed } from "@/uc/news/kit";
import { Bars, LiveBoard, Lines, type BoardRow } from "@/uc/hubs/kit";
import { align, f2, heat, mean, sgn, std, useCloses } from "@/uc/hubs/calc";
import { Empty, Kpis, PanelShell, SectionHead, saveItem, useSaved } from "@/uc/panels/kit";
import { NumIn, Note, THEAD, TR, bp, discounter, lastOf, useCurves, useMoneyMarket, type Disc } from "./CreditXLive";

type P = { onClose?: () => void };

/* ================================================================== 公用：欧洲主权 */
type SovC = { code: string; name: string; date: string; y: number; spread: number | null; spread1m: number | null; spread12m: number | null; chg1m: number | null; chg12m: number | null; hist: Array<{ d: string; y: number; s: number | null }> };
const useSov = () => usePolled<{ countries: SovC[] }>("ucHubs.sovereign", {}, 6 * 3600_000);
const EURO = new Set(["AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"]);
const PERIPHERY = ["IT", "ES", "PT", "GR"];
const CORE = ["FR", "BE", "AT", "NL", "FI"];
const SOV_NOTE = "各国 10 年期国债收益率月度均值。";

/* ================================================================== SOVM 主权债一级市场与流动性 */
type Auc = { cusip: string; type: string; term: string; reopening: boolean; announce: string; auction: string; issue: string; maturity: string; offering: number | null; coupon: number | null; highYield: number | null; highDiscount: number | null; btc: number | null; total: number | null; tendered: number | null; direct: number | null; indirect: number | null; dealer: number | null; allotted: number | null; tips: boolean; frn: boolean; closing: string };
const TYPE_ZH: Record<string, string> = { Bill: "国库券", Note: "中期国债", Bond: "长期国债", CMB: "现金管理券", TIPS: "通胀保值债", FRN: "浮息债" };
const termZh = (s: string) => s.replace(/-Week/g, "周").replace(/-Year/g, "年").replace(/-Month/g, "个月").replace(/-Day/g, "天").replace(/\s+/g, "");
const aucName = (a: Auc) => `${termZh(a.term)}${a.tips ? "通胀保值债" : a.frn ? "浮息债" : TYPE_ZH[a.type] ?? a.type}${a.reopening ? "（续发）" : ""}`;
const GOV_BOARD: BoardRow[] = [
  ...[["SHV", "短期国库券"], ["SHY", "1-3 年美债"], ["IEI", "3-7 年美债"], ["IEF", "7-10 年美债"], ["TLH", "10-20 年美债"], ["TLT", "20 年以上美债"], ["GOVT", "美债综合"], ["TIP", "通胀保值美债"]].map(([symbol, label]) => ({ symbol, label, group: "美国国债" })),
  ...[["BWX", "国际国债（非美）"], ["IGOV", "发达市场国债（非美）"], ["BNDX", "国际债券（美元对冲）"], ["EMB", "新兴市场美元主权"], ["EMLC", "新兴市场本币主权"]].map(([symbol, label]) => ({ symbol, label, group: "国际主权" })),
  ...[["^IRX", "13 周美债收益率"], ["^FVX", "5 年美债收益率"], ["^TNX", "10 年美债收益率"], ["^TYX", "30 年美债收益率"]].map(([symbol, label]) => ({ symbol, label, group: "收益率" })),
];
export function SOVMLive({ onClose }: P) {
  const [tab, setTab] = useState("res");
  const [kind, setKind] = useState("coupon");
  const a = usePolled<{ upcoming: Auc[]; results: Auc[] }>("ucHubs.auctions", {}, 1200_000);
  const t = useTicks(GOV_BOARD.map((r) => r.symbol));
  const cl = useCloses(["^TNX", "^MOVE"], 560);
  const res = (a.data?.results ?? []).filter((x) => (kind === "all" ? true : kind === "bill" ? x.type === "Bill" || x.type === "CMB" : x.type !== "Bill" && x.type !== "CMB"));
  const demand = useMemo(() => {
    const by: Record<string, Auc[]> = {};
    for (const x of a.data?.results ?? []) if (x.btc != null && !x.reopening) (by[aucName(x)] ??= []).push(x);
    return Object.entries(by).filter(([, v]) => v.length >= 2).map(([k, v]) => {
      const s = [...v].sort((p, q) => q.auction.localeCompare(p.auction));
      const avg = (f: (z: Auc) => number | null) => { const arr = s.slice(1).map(f).filter((z): z is number => z != null); return arr.length ? mean(arr) : null; };
      return { k, n: s.length, last: s[0], btcAvg: avg((z) => z.btc), indAvg: avg((z) => z.indirect), dlrAvg: avg((z) => z.dealer), bill: s[0].type === "Bill" || s[0].type === "CMB" };
    }).sort((p, q) => q.last.auction.localeCompare(p.last.auction));
  }, [a.data]);
  const vol = useMemo(() => {
    const al = align(cl.data, ["^TNX", "^MOVE"]);
    const y = al.m["^TNX"] ?? [];
    const d = y.slice(1).map((v, i) => (v - y[i]) * 100);
    const rv = y.map((_, i) => (i < 21 ? null : std(d.slice(i - 21, i)) * Math.sqrt(252)));
    return { dates: al.dates, rv, move: al.m["^MOVE"] ?? [] };
  }, [cl.data]);
  const rvLast = lastOf(vol.rv.filter((v): v is number => v != null));
  const mvLast = lastOf(vol.move);
  const nextA = a.data?.upcoming?.[0];
  return (
    <PanelShell code="SOVM" title="主权债一级市场与流动性" onClose={onClose} tabs={[["res", "拍卖结果"], ["demand", "需求强弱"], ["cal", "拍卖日历"], ["liq", "二级市场"], ["vol", "波动压力"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["10 年美债", t["^TNX"]?.price != null ? `${t["^TNX"].price.toFixed(3)}%` : "—", fmtPct(t["^TNX"]?.changePct)], ["下一场拍卖", nextA ? aucName(nextA) : "—", nextA ? `${nextA.auction} · ${fmtCompact(nextA.offering)} 美元` : undefined], ["美债隐含波动", f2(mvLast, 1, "bp"), "年化"], ["10 年实现波动（21 日）", f2(rvLast, 1, "bp"), rvLast && mvLast ? `隐含/实现 ${(mvLast / rvLast).toFixed(2)}` : undefined]]} />
      {tab === "res" && (
        <>
          <div className="flex items-center gap-2 px-2 py-1"><Seg value={kind} onChange={setKind} options={[["coupon", "附息债"], ["bill", "国库券"], ["all", "全部"]]} /><span className="ml-auto text-[10px] text-slate-500">近 120 天 {res.length} 场</span></div>
          <div className="max-h-[460px] overflow-auto">
            <table className="w-full whitespace-nowrap text-[11px]">
              <thead className={THEAD}><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">品种</th><th className="text-right">发行额</th><th className="text-right">中标利率</th><th className="text-right">投标倍数</th><th className="text-right">间接投标</th><th className="text-right">直接投标</th><th className="text-right">交易商承接</th><th className="px-2 text-right">到期</th></tr></thead>
              <tbody>{res.slice(0, 80).map((x) => <tr key={`${x.cusip}${x.auction}`} className={TR}><td className="px-2 py-0.5 font-mono text-slate-400">{x.auction}</td><td className="text-slate-100">{aucName(x)}</td><td className="text-right font-mono">{fmtCompact(x.offering)}</td><td className="text-right font-mono text-white">{f2(x.highYield ?? x.highDiscount, 3, "%")}</td><td className="text-right font-mono">{f2(x.btc, 2)}</td><td className="text-right font-mono">{f2(x.indirect, 1, "%")}</td><td className="text-right font-mono">{f2(x.direct, 1, "%")}</td><td className="text-right font-mono" style={{ background: heat(x.dealer == null ? null : x.dealer - 15, 25) }}>{f2(x.dealer, 1, "%")}</td><td className="px-2 text-right font-mono text-slate-500">{x.maturity}</td></tr>)}</tbody>
            </table>
          </div>
          {!res.length && <Empty loading={a.loading} />}
        </>
      )}
      {tab === "demand" && (
        <>
          <table className="w-full whitespace-nowrap text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">品种（新发）</th><th className="text-right">场次</th><th className="text-left">最近一场</th><th className="text-right">投标倍数</th><th className="text-right">前几场均值</th><th className="text-right">差</th><th className="text-right">间接投标</th><th className="text-right">均值</th><th className="text-right">交易商承接</th><th className="px-2 text-right">均值</th></tr></thead>
            <tbody>{demand.map((r) => { const d = r.last.btc != null && r.btcAvg != null ? r.last.btc - r.btcAvg : null; const dd = r.last.dealer != null && r.dlrAvg != null ? r.last.dealer - r.dlrAvg : null; return <tr key={r.k} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.k}</td><td className="text-right font-mono text-slate-400">{r.n}</td><td className="font-mono text-slate-400">{r.last.auction}</td><td className="text-right font-mono text-white">{f2(r.last.btc, 2)}</td><td className="text-right font-mono text-slate-400">{f2(r.btcAvg, 2)}</td><td className="text-right font-mono" style={{ color: toneOf(d) }}>{d != null ? `${d > 0 ? "+" : ""}${d.toFixed(2)}` : "—"}</td><td className="text-right font-mono">{f2(r.last.indirect, 1, "%")}</td><td className="text-right font-mono text-slate-400">{f2(r.indAvg, 1, "%")}</td><td className="text-right font-mono" style={{ background: heat(dd, 10) }}>{f2(r.last.dealer, 1, "%")}</td><td className="px-2 text-right font-mono text-slate-400">{f2(r.dlrAvg, 1, "%")}</td></tr>; })}</tbody>
          </table>
          <SectionHead title="附息债：最近一场投标倍数相对前几场均值" />
          <Bars data={demand.filter((r) => !r.bill && r.last.btc != null && r.btcAvg != null).map((r) => ({ k: r.k.replace(/中期国债|长期国债/, ""), v: r.last.btc! - r.btcAvg! }))} fmt={(v) => v.toFixed(2)} height={120} />
          <Note>交易商承接比例高于均值（红色）表示终端投资者需求不足、需由一级交易商兜底，通常对应拍卖“尾差”与二级收益率上行压力。</Note>
        </>
      )}
      {tab === "cal" && (
        <table className="w-full whitespace-nowrap text-[11px]">
          <thead className={THEAD}><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">品种</th><th className="text-right">发行额（美元）</th><th className="text-right">公告日</th><th className="text-right">发行日</th><th className="text-right">到期日</th><th className="px-2 text-right">截标时间</th></tr></thead>
          <tbody>
            {(a.data?.upcoming ?? []).map((x) => <tr key={`${x.cusip}${x.auction}${x.term}`} className={TR}><td className="px-2 py-0.5 font-mono text-white">{x.auction}</td><td className="text-slate-100">{aucName(x)}</td><td className="text-right font-mono">{fmtCompact(x.offering)}</td><td className="text-right font-mono text-slate-400">{x.announce}</td><td className="text-right font-mono text-slate-400">{x.issue}</td><td className="text-right font-mono text-slate-400">{x.maturity}</td><td className="px-2 text-right font-mono text-slate-500">{x.closing || "—"}</td></tr>)}
            {!(a.data?.upcoming ?? []).length && <tr><td colSpan={7}><Empty loading={a.loading} text="暂无已公告的拍卖" /></td></tr>}
          </tbody>
        </table>
      )}
      {tab === "liq" && (
        <>
          <LiveBoard rows={GOV_BOARD} extra={[{ head: "成交额", cell: (s) => <span className="text-slate-300">{s.startsWith("^") ? "" : fmtCompact(t[s]?.amount ?? (t[s]?.volume != null && t[s]?.price ? t[s]!.volume! * t[s]!.price : null))}</span> }]} />
          <Note>主权债 ETF 的成交额与日内振幅可作为现券二级市场流动性的实时代理；点击行查看 K 线。</Note>
        </>
      )}
      {tab === "vol" && (
        <>
          <SectionHead title="美债隐含波动 vs 10 年收益率实现波动（年化 bp）" />
          <Lines series={[{ name: "隐含波动", color: "#f59e0b", values: vol.move }, { name: "21 日实现波动", color: "#38bdf8", values: vol.rv }]} xLabels={vol.dates.map((d) => d.slice(2))} height={210} fmt={(v) => v.toFixed(0)} />
          <Note>实现波动 = 10 年美债收益率日变动（bp）21 日标准差 × √252。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== SOVR 主权利差隐含违约概率 */
const pdOf = (s: number | null, R: number, T: number) => (s == null ? null : (1 - Math.exp(-(Math.max(0, s) / 1e4 / (1 - R)) * T)) * 100);
export function SOVRLive({ onClose }: P) {
  const [tab, setTab] = useState("rank");
  const [rec, setRec] = useState(40);
  const [sel, setSel] = useState("IT");
  const sov = useSov();
  const R = Math.min(0.9, Math.max(0, rec / 100));
  const list = (sov.data?.countries ?? []).filter((c) => c.code !== "DE");
  const euro = list.filter((c) => EURO.has(c.code));
  const other = list.filter((c) => !EURO.has(c.code));
  const cur = list.find((c) => c.code === sel) ?? euro[0];
  const tier = (p: number | null) => (p == null ? "—" : p >= 10 ? "高" : p >= 4 ? "中" : p >= 1.5 ? "关注" : "低");
  const feed = useFeed(tab === "news" ? { cats: ["欧洲", "债券"], limit: 300, hours: 168 } : null, 120_000);
  const names = euro.map((c) => c.name).join("|");
  const re = new RegExp(`主权|国债|评级|赤字|债务|sovereign|bond yield|spread|BTP|Bund|OAT|downgrade|rating${names ? `|${names}` : ""}`, "i");
  const top = [...euro].sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0)).slice(0, 8);
  const row = (c: SovC) => {
    const p5 = pdOf(c.spread, R, 5);
    const p5a = pdOf(c.spread12m, R, 5);
    return <tr key={c.code} onClick={() => { setSel(c.code); setTab("hist"); }} className={`cursor-pointer ${TR}`}>
      <td className="px-2 py-0.5 text-slate-100">{c.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{c.code}</span></td>
      <td className="text-right font-mono">{c.y.toFixed(2)}%</td>
      <td className="text-right font-mono text-white">{c.spread ?? "—"}</td>
      <td className="text-right font-mono" style={{ color: toneOf(c.spread != null && c.spread1m != null ? c.spread - c.spread1m : null) }}>{c.spread != null && c.spread1m != null ? bp(c.spread - c.spread1m) : "—"}</td>
      <td className="text-right font-mono" style={{ color: toneOf(c.spread != null && c.spread12m != null ? c.spread - c.spread12m : null) }}>{c.spread != null && c.spread12m != null ? bp(c.spread - c.spread12m) : "—"}</td>
      <td className="text-right font-mono">{c.spread != null ? `${((Math.max(0, c.spread) / (1 - R))).toFixed(0)}bp` : "—"}</td>
      <td className="text-right font-mono">{f2(pdOf(c.spread, R, 1), 2, "%")}</td>
      <td className="text-right font-mono" style={{ background: heat(p5, 15) }}>{f2(p5, 2, "%")}</td>
      <td className="text-right font-mono">{f2(pdOf(c.spread, R, 10), 2, "%")}</td>
      <td className="text-right font-mono" style={{ color: toneOf(p5 != null && p5a != null ? p5 - p5a : null) }}>{p5 != null && p5a != null ? sgn(p5 - p5a, 2, "pt") : "—"}</td>
      <td className="px-2 text-right">{tier(p5)}</td>
    </tr>;
  };
  const head = <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th><th className="text-right">10 年收益率</th><th className="text-right">对德利差 bp</th><th className="text-right">1 月变动</th><th className="text-right">12 月变动</th><th className="text-right">隐含违约强度</th><th className="text-right">1 年</th><th className="text-right">5 年累计</th><th className="text-right">10 年累计</th><th className="text-right">5 年较一年前</th><th className="px-2 text-right">分级</th></tr></thead>;
  return (
    <PanelShell code="SOVR" title="主权利差隐含违约概率" onClose={onClose} tabs={[["rank", "违约概率排名"], ["hist", "国别历史"], ["curve", "累计违约曲线"], ["news", "主权新闻"]]} tab={tab} setTab={setTab} right={<NumIn label="回收率" value={rec} onChange={setRec} w="w-12" suffix="%" />}>
      {tab === "rank" && (
        <>
          <Kpis items={[["最高 5 年违约概率", euro[0] ? `${euro[0].name} ${f2(pdOf(euro[0].spread, R, 5), 2, "%")}` : "—", euro[0] ? `对德利差 ${euro[0].spread}bp` : undefined], ["欧元区中位利差", (() => { const a = euro.map((c) => c.spread).filter((v): v is number => v != null).sort((x, y) => x - y); return a.length ? `${a[Math.floor(a.length / 2)]}bp` : "—"; })()], ["德国 10 年", (() => { const de = sov.data?.countries.find((c) => c.code === "DE"); return de ? `${de.y.toFixed(2)}%` : "—"; })(), "无风险基准"], ["数据月份", euro[0]?.date ?? "—"]]} />
          <SectionHead title="欧元区成员国" />
          <table className="w-full whitespace-nowrap text-[11px]">{head}<tbody>{euro.map(row)}</tbody></table>
          {!!other.length && <><SectionHead title="非欧元区欧洲国家" sub="利差含汇率与通胀溢价，不能直接解读为违约风险" /><table className="w-full whitespace-nowrap text-[11px]">{head}<tbody>{other.map(row)}</tbody></table></>}
          {!list.length && <Empty loading={sov.loading} />}
          <Note>口径：违约强度 λ = 对德利差 / (1 − 回收率)，累计违约概率 = 1 − e^(−λT)。以德国国债为无风险基准，利差中还含流动性与再定价溢价，所得为风险中性上限估计，不是 CDS 报价。{SOV_NOTE}点击行查看该国历史。</Note>
        </>
      )}
      {tab === "hist" && (
        <>
          <div className="flex items-center gap-2 px-2 py-1"><span className="text-[10px] text-slate-500">国家</span><select value={cur?.code ?? ""} onChange={(e) => setSel(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-[11px] text-white">{list.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
          {cur ? (
            <>
              <Kpis items={[["10 年收益率", `${cur.y.toFixed(2)}%`, cur.date], ["对德利差", `${cur.spread ?? "—"}bp`, `5 年区间 ${Math.min(...cur.hist.map((h) => h.s ?? Infinity))} ~ ${Math.max(...cur.hist.map((h) => h.s ?? -Infinity))}bp`], ["5 年累计违约概率", f2(pdOf(cur.spread, R, 5), 2, "%")], ["一年前", f2(pdOf(cur.spread12m, R, 5), 2, "%"), cur.spread12m != null ? `利差 ${cur.spread12m}bp` : undefined]]} />
              <SectionHead title={`${cur.name}：对德利差（bp）与 10 年收益率（%）`} />
              <Lines series={[{ name: "对德利差 bp", color: "#f59e0b", values: cur.hist.map((h) => h.s) }]} xLabels={cur.hist.map((h) => h.d)} height={150} fmt={(v) => v.toFixed(0)} />
              <Lines series={[{ name: "10 年收益率 %", color: "#38bdf8", values: cur.hist.map((h) => h.y) }]} xLabels={cur.hist.map((h) => h.d)} height={120} />
              <SectionHead title="隐含 5 年累计违约概率（%）" />
              <Lines series={[{ name: "5 年累计", color: "#f2495c", values: cur.hist.map((h) => pdOf(h.s, R, 5)) }]} xLabels={cur.hist.map((h) => h.d)} height={130} />
            </>
          ) : <Empty loading={sov.loading} />}
        </>
      )}
      {tab === "curve" && (
        <>
          <SectionHead title="利差最高的 8 个欧元区国家：累计违约概率期限曲线（%）" />
          <Lines series={top.map((c, i) => ({ name: c.name, color: ["#f2495c", "#f59e0b", "#fbbf24", "#a78bfa", "#38bdf8", "#34d399", "#94a3b8", "#f472b6"][i], values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((T) => pdOf(c.spread, R, T)) }))} xLabels={["1Y", "2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "9Y", "10Y"]} height={220} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th>{[1, 2, 3, 5, 7, 10].map((T) => <th key={T} className="text-right last:px-2">{T} 年</th>)}</tr></thead>
            <tbody>{top.map((c) => <tr key={c.code} className={TR}><td className="px-2 py-0.5 text-slate-100">{c.name}</td>{[1, 2, 3, 5, 7, 10].map((T) => <td key={T} className="text-right font-mono last:px-2">{f2(pdOf(c.spread, R, T), 2, "%")}</td>)}</tr>)}</tbody>
          </table>
        </>
      )}
      {tab === "news" && <FeedList items={feed.items.filter((n) => re.test(`${n.title} ${n.summary ?? ""}`))} loading={feed.loading} empty="近 7 天无欧洲主权相关新闻" />}
    </PanelShell>
  );
}

/* ================================================================== WCDS 单名 CDS 估值与期限结构 */
const CDS_TEN = [1, 2, 3, 5, 7, 10];
function survFn(lams: number[], tens: number[]) {
  return (t: number) => {
    let acc = 0;
    let prev = 0;
    for (let i = 0; i < tens.length; i++) {
      if (t <= tens[i]) return Math.exp(-(acc + lams[i] * (t - prev)));
      acc += lams[i] * (tens[i] - prev);
      prev = tens[i];
    }
    return Math.exp(-(acc + lams[lams.length - 1] * (t - prev)));
  };
}
function legs(S: (t: number) => number, df: (t: number) => number, T: number, R: number) {
  const n = Math.max(1, Math.round(T * 4));
  const h = T / n;
  let rpv = 0, prot = 0, prevS = 1;
  for (let k = 1; k <= n; k++) {
    const t = k * h;
    const s = S(t);
    const d = df(t);
    rpv += h * d * (s + prevS) / 2;
    prot += (1 - R) * d * (prevS - s);
    prevS = s;
  }
  return { rpv, prot };
}
function bootstrap(spreads: number[], R: number, df: (t: number) => number) {
  const lams: number[] = [];
  for (let i = 0; i < CDS_TEN.length; i++) {
    let lo = 1e-7, hi = 5;
    for (let it = 0; it < 60; it++) {
      const mid = (lo + hi) / 2;
      const { rpv, prot } = legs(survFn([...lams, mid], CDS_TEN.slice(0, i + 1)), df, CDS_TEN[i], R);
      if (prot - (spreads[i] / 1e4) * rpv > 0) hi = mid; else lo = mid;
    }
    lams.push((lo + hi) / 2);
  }
  return lams;
}
function cdsValue(spreads: number[], R: number, disc: Disc, M: number, C: number) {
  const lams = bootstrap(spreads, R, disc.df);
  const S = survFn(lams, CDS_TEN);
  const { rpv, prot } = legs(S, disc.df, M, R);
  return { lams, S, rpv, prot, par: rpv > 0 ? (prot / rpv) * 1e4 : null, mtm: prot - (C / 1e4) * rpv };
}
type CdsCurve = { name: string; spreads: number[]; rec: number };
const CDS_KEY = "creditx.cds.curves";
export function WCDSLive({ onClose }: P) {
  const [tab, setTab] = useState("val");
  const [spreads, setSpreads] = useState<number[] | null>(null);
  const [src, setSrc] = useState<string>("");
  const [rec, setRec] = useState(40);
  const [M, setM] = useState(5);
  const [C, setC] = useState(100);
  const [notional, setNotional] = useState(10);
  const [side, setSide] = useState("buy");
  const [name, setName] = useState("");
  const [local, setLocal] = useState<CdsCurve[] | null>(null);
  const cv = useCurves();
  const sov = useSov();
  const saved = useSaved<CdsCurve[]>(CDS_KEY);
  const lib = local ?? saved.data ?? [];
  const disc = discounter(cv.data);
  const discUp = discounter(cv.data, 1);
  const it = sov.data?.countries.find((c) => c.code === "IT");
  const sp = spreads ?? (it?.spread != null ? CDS_TEN.map(() => Math.max(1, it.spread!)) : null);
  const srcLabel = spreads ? src || "自定义输入" : it ? `意大利对德利差 ${it.spread}bp（平坦，${it.date}）` : "";
  const R = Math.min(0.95, Math.max(0, rec / 100));
  const sgnSide = side === "buy" ? 1 : -1;
  const v = useMemo(() => (sp && disc ? cdsValue(sp, R, disc, M, C) : null), [sp, disc, R, M, C]);
  const cs01 = useMemo(() => (sp && disc && v ? cdsValue(sp.map((x) => x + 1), R, disc, M, C).mtm - v.mtm : null), [sp, disc, v, R, M, C]);
  const ir01 = useMemo(() => (sp && discUp && v ? cdsValue(sp, R, discUp, M, C).mtm - v.mtm : null), [sp, discUp, v, R, M, C]);
  const N = notional * 1e6;
  const scen = useMemo(() => (sp && disc ? [-100, -50, -25, 0, 25, 50, 100, 200, 300].map((d) => { const x = cdsValue(sp.map((s) => Math.max(1, s + d)), R, disc, M, C); return { d, par: x.par, mtm: x.mtm }; }) : []), [sp, disc, R, M, C]);
  const setOne = (i: number, val: number) => { const base = sp ?? CDS_TEN.map(() => 100); setSpreads(base.map((x, j) => (j === i ? Math.max(1, val) : x))); setSrc("自定义输入"); };
  const doSave = async () => { if (!sp || !name.trim()) return; const next = [...lib.filter((c) => c.name !== name.trim()), { name: name.trim(), spreads: sp, rec }]; setLocal(next); await saveItem(CDS_KEY, next); };
  const doDel = async (n: string) => { const next = lib.filter((c) => c.name !== n); setLocal(next); await saveItem(CDS_KEY, next); };
  const curveBar = (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
      <span className="text-[10px] text-slate-500">利差曲线（bp）</span>
      {CDS_TEN.map((T, i) => <NumIn key={T} label={`${T}Y`} value={sp?.[i] ?? NaN} onChange={(x) => setOne(i, x)} w="w-14" />)}
      <NumIn label="回收率" value={rec} onChange={setRec} w="w-12" suffix="%" />
      <span className="text-[10px] text-slate-500">来源：{srcLabel || "—"}</span>
    </div>
  );
  return (
    <PanelShell code="WCDS" title="单名 CDS 估值与期限结构" onClose={onClose} tabs={[["val", "估值"], ["term", "期限结构"], ["scen", "利差情景"], ["lib", "曲线导入与保存"]]} tab={tab} setTab={setTab} right={disc ? <span>贴现：美债曲线 {disc.date}</span> : null}>
      {curveBar}
      {tab === "val" && (
        <>
          <div className="flex flex-wrap items-center gap-3 px-2 pb-1.5">
            <Seg value={side} onChange={setSide} options={[["buy", "买入保护"], ["sell", "卖出保护"]]} />
            <NumIn label="名义本金" value={notional} onChange={setNotional} suffix="百万" />
            <NumIn label="到期" value={M} step={0.25} onChange={(x) => setM(Math.min(10, Math.max(0.25, x)))} suffix="年" />
            <Seg value={String(C)} onChange={(x) => setC(Number(x))} options={[["100", "票息 100bp"], ["500", "票息 500bp"], ["25", "票息 25bp"], ["1000", "票息 1000bp"]]} />
          </div>
          <Kpis items={[["平价利差", v?.par != null ? `${v.par.toFixed(1)}bp` : "—", `${M} 年`], ["前付（占名义）", v ? `${(v.mtm * 100 * sgnSide).toFixed(3)}%` : "—", side === "buy" ? "正 = 买方支付" : "正 = 卖方收取"], ["前付金额", v ? fmtCompact(v.mtm * N * sgnSide) : "—", "美元"], ["风险年金 RPV01", v ? v.rpv.toFixed(4) : "—", "每 1 单位名义、每年 1 单位利差"]]} />
          <Kpis items={[["CS01（+1bp）", cs01 != null ? fmtCompact(cs01 * N * sgnSide) : "—", "持仓损益"], ["IR01（曲线 +1bp）", ir01 != null ? fmtCompact(ir01 * N * sgnSide) : "—", "持仓损益"], ["违约跳跃损益", v ? fmtCompact(((1 - R) - v.mtm) * N * sgnSide) : "—", "立即违约时（扣除当前估值）"], [`${M} 年生存概率`, v ? `${(v.S(M) * 100).toFixed(2)}%` : "—", v ? `累计违约 ${((1 - v.S(M)) * 100).toFixed(2)}%` : undefined]]} />
          {!sp && <Empty loading={sov.loading} text="请输入利差曲线" />}
          <Note>口径：分段常数违约强度自举（1/2/3/5/7/10 年平价利差），季度付息含应计近似，违约在区间末结算；贴现因子取实时美债收益率曲线（平价收益率近似零息）。利差为用户输入或由真实主权对德利差导入，不是 CDS 市场报价。</Note>
        </>
      )}
      {tab === "term" && v && (
        <>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">平价利差</th><th className="text-right">区间违约强度</th><th className="text-right">生存概率</th><th className="text-right">累计违约</th><th className="text-right">区间条件违约</th><th className="text-right">贴现因子</th><th className="px-2 text-right">美债利率</th></tr></thead>
            <tbody>{CDS_TEN.map((T, i) => { const s0 = i ? v.S(CDS_TEN[i - 1]) : 1; const s1 = v.S(T); return <tr key={T} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{T}Y</td><td className="text-right font-mono text-white">{sp![i].toFixed(0)}bp</td><td className="text-right font-mono">{(v.lams[i] * 1e4).toFixed(0)}bp</td><td className="text-right font-mono">{(s1 * 100).toFixed(2)}%</td><td className="text-right font-mono" style={{ background: heat((1 - s1) * 100, 40) }}>{((1 - s1) * 100).toFixed(2)}%</td><td className="text-right font-mono">{(((s0 - s1) / s0) * 100).toFixed(2)}%</td><td className="text-right font-mono">{disc!.df(T).toFixed(4)}</td><td className="px-2 text-right font-mono text-slate-400">{disc!.par(T).toFixed(3)}%</td></tr>; })}</tbody>
          </table>
          <SectionHead title="生存概率与累计违约概率（%）" />
          <Lines series={[{ name: "生存概率", color: "#1fbf75", values: Array.from({ length: 41 }, (_, k) => v.S(k / 4) * 100) }, { name: "累计违约", color: "#f2495c", values: Array.from({ length: 41 }, (_, k) => (1 - v.S(k / 4)) * 100) }]} xLabels={Array.from({ length: 41 }, (_, k) => `${(k / 4).toFixed(1)}Y`)} height={170} fmt={(x) => x.toFixed(1)} />
          <SectionHead title="区间违约强度（bp/年）" />
          <Bars data={CDS_TEN.map((T, i) => ({ k: `${i ? CDS_TEN[i - 1] : 0}-${T}Y`, v: v.lams[i] * 1e4 }))} fmt={(x) => `${x.toFixed(0)}bp`} height={110} />
        </>
      )}
      {tab === "scen" && (
        <>
          <SectionHead title={`整条曲线平移情景（${side === "buy" ? "买入" : "卖出"}保护 ${notional} 百万，${M} 年，票息 ${C}bp）`} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">平移</th><th className="text-right">平价利差</th><th className="text-right">估值（占名义）</th><th className="text-right">估值金额</th><th className="px-2 text-right">相对当前损益</th></tr></thead>
            <tbody>{scen.map((s) => { const base = scen.find((x) => x.d === 0); const pnl = base ? (s.mtm - base.mtm) * N * sgnSide : null; return <tr key={s.d} className={`${TR} ${s.d === 0 ? "bg-[#0d2236]" : ""}`}><td className="px-2 py-0.5 font-mono text-slate-300">{bp(s.d)}</td><td className="text-right font-mono">{f2(s.par, 1, "bp")}</td><td className="text-right font-mono">{(s.mtm * 100 * sgnSide).toFixed(3)}%</td><td className="text-right font-mono">{fmtCompact(s.mtm * N * sgnSide)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(pnl) }}>{pnl != null ? fmtCompact(pnl) : "—"}</td></tr>; })}</tbody>
          </table>
          <Bars data={scen.map((s) => ({ k: `${s.d}`, v: ((s.mtm - (scen.find((x) => x.d === 0)?.mtm ?? 0)) * N * sgnSide) / 1e4 }))} fmt={(x) => `${x.toFixed(1)}万`} height={110} />
        </>
      )}
      {tab === "lib" && (
        <>
          <SectionHead title="从主权利差导入" sub={SOV_NOTE} />
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {(sov.data?.countries ?? []).filter((c) => c.code !== "DE" && c.spread != null && EURO.has(c.code)).map((c) => <button key={c.code} type="button" onClick={() => { setSpreads(CDS_TEN.map(() => Math.max(1, c.spread!))); setSrc(`${c.name}对德利差 ${c.spread}bp（平坦，${c.date}）`); }} className="border border-[#1d3047] px-1.5 py-0.5 text-[11px] text-slate-200 hover:bg-[#0a1726]">{c.name} <span className="font-mono text-slate-500">{c.spread}</span></button>)}
            {!sov.data && <Empty loading={sov.loading} />}
          </div>
          <SectionHead title="我的曲线库（永久保存）" />
          <form onSubmit={(e) => { e.preventDefault(); void doSave(); }} className="flex items-center gap-2 px-2 pb-1">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="曲线名称（如：某发行人 2026-10）" className="w-64 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" />
            <button type="submit" disabled={!sp || !name.trim()} className="border border-cyan-700 px-2 text-[11px] text-cyan-200 disabled:opacity-40">保存当前曲线</button>
          </form>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">名称</th>{CDS_TEN.map((T) => <th key={T} className="text-right">{T}Y</th>)}<th className="text-right">回收率</th><th className="px-2 text-right">操作</th></tr></thead>
            <tbody>
              {lib.map((c) => <tr key={c.name} className={TR}><td className="px-2 py-0.5 text-slate-100">{c.name}</td>{c.spreads.map((s, i) => <td key={i} className="text-right font-mono">{s}</td>)}<td className="text-right font-mono">{c.rec}%</td><td className="px-2 text-right"><button type="button" onClick={() => { setSpreads(c.spreads); setRec(c.rec); setSrc(`曲线库：${c.name}`); setTab("val"); }} className="mr-2 text-cyan-300">载入</button><button type="button" onClick={() => void doDel(c.name)} className="text-slate-500 hover:text-red-300">删除</button></td></tr>)}
              {!lib.length && <tr><td colSpan={CDS_TEN.length + 3}><Empty loading={saved.loading && !local} text="尚未保存曲线" /></td></tr>}
            </tbody>
          </table>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== WCDM 主权利差压力测试 */
export function WCDMLive({ onClose }: P) {
  const [tab, setTab] = useState("scen");
  const [ref, setRef] = useState("IT");
  const [shock, setShock] = useState(100);
  const [bund, setBund] = useState(0);
  const sov = useSov();
  const de = sov.data?.countries.find((c) => c.code === "DE");
  const euro = (sov.data?.countries ?? []).filter((c) => EURO.has(c.code) && c.code !== "DE" && c.hist.filter((h) => h.s != null).length > 24);
  const calc = useMemo(() => {
    const refC = euro.find((c) => c.code === ref);
    if (!refC) return [];
    const rmap = new Map(refC.hist.filter((h) => h.s != null).map((h) => [h.d, h.s!]));
    return euro.map((c) => {
      const h = c.hist.filter((x) => x.s != null && rmap.has(x.d));
      const dx: number[] = [], dr: number[] = [];
      for (let i = 1; i < h.length; i++) { dx.push(h[i].s! - h[i - 1].s!); dr.push(rmap.get(h[i].d)! - rmap.get(h[i - 1].d)!); }
      const mx = mean(dx), mr = mean(dr);
      const cov = dx.reduce((a, v, i) => a + (v - mx) * (dr[i] - mr), 0) / Math.max(1, dx.length - 1);
      const vr = std(dr) ** 2;
      const beta = vr > 0 ? cov / vr : null;
      const cr = std(dx) > 0 && std(dr) > 0 ? cov / (std(dx) * std(dr)) : null;
      const full = c.hist.filter((x) => x.s != null);
      const ext = [1, 3, 12].map((k) => { let wMax = -Infinity, wAt = "", tMin = Infinity, tAt = ""; for (let i = k; i < full.length; i++) { const d = full[i].s! - full[i - k].s!; if (d > wMax) { wMax = d; wAt = `${full[i - k].d}→${full[i].d}`; } if (d < tMin) { tMin = d; tAt = `${full[i - k].d}→${full[i].d}`; } } return { k, wMax: Number.isFinite(wMax) ? wMax : null, wAt, tMin: Number.isFinite(tMin) ? tMin : null, tAt }; });
      const proj = c.spread != null && beta != null ? c.spread + beta * shock : null;
      return { c, beta, cr, vol: std(dx), ext, proj, projY: proj != null && de ? de.y + bund / 100 + proj / 100 : null };
    }).sort((a, b) => (b.c.spread ?? 0) - (a.c.spread ?? 0));
  }, [euro, ref, shock, bund, de]);
  const histScen = useMemo(() => {
    const refC = euro.find((c) => c.code === ref);
    if (!refC) return null;
    const h = refC.hist.filter((x) => x.s != null);
    let best = -Infinity, i0 = -1;
    for (let i = 3; i < h.length; i++) { const d = h[i].s! - h[i - 3].s!; if (d > best) { best = d; i0 = i; } }
    if (i0 < 0) return null;
    const d0 = h[i0 - 3].d, d1 = h[i0].d;
    return { d0, d1, rows: euro.map((c) => { const a = c.hist.find((x) => x.d === d0)?.s; const b = c.hist.find((x) => x.d === d1)?.s; const dd = a != null && b != null ? b - a : null; return { c, dd, after: c.spread != null && dd != null ? c.spread + dd : null }; }).sort((x, y) => (y.dd ?? 0) - (x.dd ?? 0)) };
  }, [euro, ref]);
  const refName = euro.find((c) => c.code === ref)?.name ?? ref;
  return (
    <PanelShell code="WCDM" title="主权利差压力测试" onClose={onClose} tabs={[["scen", "传导情景"], ["hist", "历史情景重演"], ["ext", "历史极值"], ["beta", "敏感度"]]} tab={tab} setTab={setTab}>
      <div className="flex flex-wrap items-center gap-3 px-2 py-1.5">
        <span className="text-[10px] text-slate-500">冲击源</span>
        <Seg value={ref} onChange={setRef} options={[["IT", "意大利"], ["FR", "法国"], ["ES", "西班牙"], ["GR", "希腊"], ["BE", "比利时"]]} />
        {tab === "scen" && <><NumIn label={`${refName}利差冲击`} value={shock} onChange={setShock} suffix="bp" /><NumIn label="德国收益率冲击" value={bund} onChange={setBund} suffix="bp" /></>}
      </div>
      {tab === "scen" && (
        <>
          <Kpis items={[["德国 10 年", de ? `${de.y.toFixed(2)}%` : "—", de ? `情景后 ${(de.y + bund / 100).toFixed(2)}%` : undefined], [`${refName}利差`, `${calc.find((r) => r.c.code === ref)?.c.spread ?? "—"}bp`, `情景后 ${f2(calc.find((r) => r.c.code === ref)?.proj, 0, "bp")}`], ["平均传导系数", f2(mean(calc.filter((r) => r.c.code !== ref && r.beta != null).map((r) => r.beta!)), 2)], ["情景后最高收益率", (() => { const m = [...calc].sort((a, b) => (b.projY ?? 0) - (a.projY ?? 0))[0]; return m?.projY != null ? `${m.c.name} ${m.projY.toFixed(2)}%` : "—"; })()]]} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th><th className="text-right">当前利差</th><th className="text-right">传导系数 β</th><th className="text-right">利差变动</th><th className="text-right">情景利差</th><th className="text-right">当前收益率</th><th className="px-2 text-right">情景收益率</th></tr></thead>
            <tbody>{calc.map((r) => <tr key={r.c.code} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.c.name}</td><td className="text-right font-mono">{r.c.spread ?? "—"}bp</td><td className="text-right font-mono">{f2(r.beta, 2)}</td><td className="text-right font-mono" style={{ background: heat(r.beta != null ? r.beta * shock : null, Math.max(10, Math.abs(shock))) }}>{bp(r.beta != null ? r.beta * shock : null)}</td><td className="text-right font-mono text-white">{f2(r.proj, 0, "bp")}</td><td className="text-right font-mono">{r.c.y.toFixed(2)}%</td><td className="px-2 text-right font-mono text-white">{f2(r.projY, 2, "%")}</td></tr>)}</tbody>
          </table>
          {!calc.length && <Empty loading={sov.loading} />}
          <Note>口径：传导系数 β = 各国月度利差变动对冲击源月度利差变动的回归斜率（近 5 年）；情景利差 = 当前利差 + β × 冲击；情景收益率 = 德国收益率（含冲击）+ 情景利差。{SOV_NOTE}</Note>
        </>
      )}
      {tab === "hist" && (
        histScen ? (
          <>
            <Kpis items={[["重演区间", `${histScen.d0} → ${histScen.d1}`, `${refName}近 5 年最大 3 个月走阔`], [`${refName}走阔`, bp(histScen.rows.find((r) => r.c.code === ref)?.dd ?? null)], ["受冲击最大", histScen.rows[0] ? histScen.rows[0].c.name : "—", bp(histScen.rows[0]?.dd ?? null)], ["受冲击最小", lastOf(histScen.rows)?.c.name ?? "—", bp(lastOf(histScen.rows)?.dd ?? null)]]} />
            <Bars data={histScen.rows.filter((r) => r.dd != null).map((r) => ({ k: r.c.code, v: r.dd! }))} fmt={(x) => `${x.toFixed(0)}bp`} height={130} />
            <table className="w-full text-[11px]">
              <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th><th className="text-right">当时利差变动</th><th className="text-right">当前利差</th><th className="px-2 text-right">重演后利差</th></tr></thead>
              <tbody>{histScen.rows.map((r) => <tr key={r.c.code} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.c.name}</td><td className="text-right font-mono" style={{ color: toneOf(r.dd) }}>{bp(r.dd)}</td><td className="text-right font-mono">{r.c.spread ?? "—"}bp</td><td className="px-2 text-right font-mono text-white">{f2(r.after, 0, "bp")}</td></tr>)}</tbody>
            </table>
            <Note>以真实历史区间内各国的实际利差变动叠加到当前利差，不做模型外推。</Note>
          </>
        ) : <Empty loading={sov.loading} />
      )}
      {tab === "ext" && (
        <table className="w-full whitespace-nowrap text-[11px]">
          <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th>{[1, 3, 12].map((k) => <th key={k} colSpan={2} className="text-right">{k} 个月最大走阔 / 区间</th>)}<th className="px-2 text-right">12 个月最大收窄</th></tr></thead>
          <tbody>{calc.map((r) => <tr key={r.c.code} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.c.name}</td>{r.ext.map((e) => [<td key={`a${e.k}`} className="text-right font-mono" style={{ background: heat(e.wMax, 80) }}>{bp(e.wMax)}</td>, <td key={`b${e.k}`} className="pl-1 text-right font-mono text-[10px] text-slate-500">{e.wAt}</td>])}<td className="px-2 text-right font-mono" style={{ color: toneOf(e12(r.ext)) }}>{bp(e12(r.ext))}</td></tr>)}</tbody>
        </table>
      )}
      {tab === "beta" && (
        <>
          <Bars data={calc.filter((r) => r.beta != null && r.c.code !== ref).map((r) => ({ k: r.c.code, v: r.beta! }))} fmt={(x) => x.toFixed(2)} height={130} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th><th className="text-right">β</th><th className="text-right">相关系数</th><th className="text-right">解释度 R²</th><th className="px-2 text-right">月度利差变动波动</th></tr></thead>
            <tbody>{calc.map((r) => <tr key={r.c.code} className={TR}><td className="px-2 py-0.5 text-slate-100">{r.c.name}</td><td className="text-right font-mono">{f2(r.beta, 2)}</td><td className="text-right font-mono" style={{ background: heat(r.cr, 1) }}>{f2(r.cr, 2)}</td><td className="text-right font-mono">{r.cr != null ? `${(r.cr * r.cr * 100).toFixed(0)}%` : "—"}</td><td className="px-2 text-right font-mono">{f2(r.vol, 1, "bp")}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </PanelShell>
  );
}
const e12 = (ext: Array<{ k: number; tMin: number | null }>) => ext.find((e) => e.k === 12)?.tMin ?? null;

/* ================================================================== EDSF SOFR 期货条与资金信用基差 */
const BANKS: BoardRow[] = [
  ...[["JPM", "摩根大通"], ["BAC", "美国银行"], ["C", "花旗"], ["WFC", "富国银行"], ["GS", "高盛"], ["MS", "摩根士丹利"]].map(([symbol, label]) => ({ symbol, label, group: "大型银行" })),
  ...[["KRE", "区域银行 ETF"], ["KBE", "银行 ETF"], ["XLF", "金融板块 ETF"], ["SPY", "标普 500 ETF"]].map(([symbol, label]) => ({ symbol, label, group: "板块" })),
];
const yearsTo = (month: string) => (Date.parse(`${month}-15T00:00:00Z`) - Date.now()) / (365.25 * 86400_000);
export function EDSFLive({ onClose }: P) {
  const [tab, setTab] = useState("strip");
  const [t1, setT1] = useState(6);
  const [t2, setT2] = useState(9);
  const mm = useMoneyMarket();
  const cv = useCurves();
  const disc = discounter(cv.data);
  const t = useTicks(BANKS.map((b) => b.symbol));
  const s = mm.data?.series ?? {};
  const sofr = lastOf(s.SOFR ?? []);
  const effr = lastOf(s.EFFR ?? []);
  const strip = mm.data?.sofrStrip ?? [];
  const path = mm.data?.path ?? [];
  const fwd = (a: number, b: number) => (disc && b > a ? ((disc.df(Math.max(0, a)) / disc.df(b) - 1) / (b - Math.max(0, a))) * 100 : null);
  const futAt = (yr: number) => { const pts = strip.map((p) => ({ x: yearsTo(p.month) + 0.125, r: p.rate })).filter((p) => p.x > 0); if (!pts.length) return null; if (yr <= pts[0].x) return pts[0].r; for (let i = 1; i < pts.length; i++) if (yr <= pts[i].x) return pts[i - 1].r + ((pts[i].r - pts[i - 1].r) * (yr - pts[i - 1].x)) / (pts[i].x - pts[i - 1].x); return lastOf(pts)!.r; };
  const spreads = useMemo(() => {
    const m = (k: string) => new Map((s[k] ?? []).map((x) => [x.d, x]));
    const S = m("SOFR"), E = m("EFFR"), T = m("TGCR"), O = m("OBFR");
    const dates = [...S.keys()].sort();
    return dates.map((d) => { const so = S.get(d)!; return { d, ef: E.get(d) ? (E.get(d)!.v - so.v) * 100 : null, tg: T.get(d) ? (so.v - T.get(d)!.v) * 100 : null, ob: O.get(d) && E.get(d) ? (O.get(d)!.v - E.get(d)!.v) * 100 : null, disp: so.p99 != null && so.p1 != null ? (so.p99 - so.p1) * 100 : null, vol: so.vol }; });
  }, [mm.data]);
  const statOf = (k: "ef" | "tg" | "ob" | "disp") => { const a = spreads.map((x) => x[k]).filter((v): v is number => v != null); return { last: lastOf(a) ?? null, avg20: a.length ? mean(a.slice(-20)) : null, min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null }; };
  const SP: Array<["ef" | "tg" | "ob" | "disp", string, string]> = [["ef", "无担保 − 有担保（EFFR − SOFR）", "#f59e0b"], ["tg", "SOFR − 三方回购（TGCR）", "#38bdf8"], ["ob", "隔夜银行融资 − 联邦基金（OBFR − EFFR）", "#a78bfa"], ["disp", "SOFR 成交分布宽度（99 − 1 分位）", "#f2495c"]];
  const lastCuts = lastOf(path.filter((p) => p.cuts != null));
  return (
    <PanelShell code="EDSF" title="SOFR 期货条与资金信用基差" onClose={onClose} tabs={[["strip", "期货条"], ["fund", "资金利差"], ["fra", "合成远期利率"], ["bank", "银行信用"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["SOFR", sofr ? `${sofr.v.toFixed(2)}%` : "—", sofr ? `${sofr.d} · 成交 ${f2(sofr.vol, 0)}0 亿` : undefined], ["EFFR", effr ? `${effr.v.toFixed(2)}%` : "—", mm.data?.target.from != null ? `目标区间 ${mm.data.target.from}–${mm.data.target.to}%` : undefined], ["期货隐含降息次数", lastCuts?.cuts != null ? `${lastCuts.cuts.toFixed(2)} 次` : "—", lastCuts ? `至 ${lastCuts.month}（25bp/次）` : undefined], ["期货条末端利率", lastOf(strip) ? `${lastOf(strip)!.rate.toFixed(3)}%` : "—", lastOf(strip)?.month]]} />
      {tab === "strip" && (
        <>
          <SectionHead title="3 个月 SOFR 期货隐含利率与 30 天联邦基金期货隐含路径（%）" />
          <Lines series={[{ name: "3 个月 SOFR 期货", color: "#38bdf8", values: strip.map((p) => p.rate) }, ...(sofr ? [{ name: "当前 SOFR", color: "#64748b", values: strip.map(() => sofr.v), dash: true }] : [])]} xLabels={strip.map((p) => p.month)} height={170} fmt={(v) => v.toFixed(2)} />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">合约月</th><th className="text-right">隐含利率</th><th className="text-right">日变动</th><th className="text-right">相邻跨期价差</th><th className="text-right">相对当前 SOFR</th><th className="px-2 text-right">成交量</th></tr></thead>
            <tbody>{strip.map((p, i) => <tr key={p.month} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{p.month}</td><td className="text-right font-mono text-white">{p.rate.toFixed(3)}%</td><td className="text-right font-mono" style={{ color: toneOf(p.chg) }}>{p.chg != null ? bp(p.chg * 100, 1) : "—"}</td><td className="text-right font-mono">{i ? bp((p.rate - strip[i - 1].rate) * 100, 1) : "—"}</td><td className="text-right font-mono" style={{ background: heat(sofr ? (p.rate - sofr.v) * 100 : null, 100) }}>{sofr ? bp((p.rate - sofr.v) * 100, 1) : "—"}</td><td className="px-2 text-right font-mono text-slate-400">{fmtCompact(p.volume)}</td></tr>)}</tbody>
          </table>
          <SectionHead title="30 天联邦基金期货：逐月隐含利率与累计降息次数" />
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">月份</th><th className="text-right">隐含利率</th><th className="text-right">日变动</th><th className="px-2 text-right">累计降息（25bp）</th></tr></thead>
            <tbody>{path.map((p) => <tr key={p.month} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{p.month}</td><td className="text-right font-mono">{p.rate.toFixed(3)}%</td><td className="text-right font-mono" style={{ color: toneOf(p.chg) }}>{p.chg != null ? bp(p.chg * 100, 1) : "—"}</td><td className="px-2 text-right font-mono text-white">{f2(p.cuts, 2)}</td></tr>)}</tbody>
          </table>
          {!strip.length && <Empty loading={mm.loading} />}
        </>
      )}
      {tab === "fund" && (
        <>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">利差</th><th className="text-right">最新</th><th className="text-right">20 日均值</th><th className="text-right">一年最低</th><th className="px-2 text-right">一年最高</th></tr></thead>
            <tbody>{SP.map(([k, l, c]) => { const x = statOf(k); return <tr key={k} className={TR}><td className="px-2 py-0.5" style={{ color: c }}>{l}</td><td className="text-right font-mono text-white">{f2(x.last, 1, "bp")}</td><td className="text-right font-mono">{f2(x.avg20, 1, "bp")}</td><td className="text-right font-mono text-slate-400">{f2(x.min, 1, "bp")}</td><td className="px-2 text-right font-mono text-slate-400">{f2(x.max, 1, "bp")}</td></tr>; })}</tbody>
          </table>
          <SectionHead title="资金市场利差（bp，近一年）" />
          <Lines series={SP.map(([k, l, c]) => ({ name: l, color: c, values: spreads.map((x) => x[k]) }))} xLabels={spreads.map((x) => x.d.slice(2))} height={220} zero fmt={(v) => v.toFixed(0)} />
        </>
      )}
      {tab === "fra" && (
        <>
          <div className="flex flex-wrap items-center gap-3 px-2 py-1.5"><NumIn label="起始" value={t1} onChange={(v) => setT1(Math.max(0, Math.min(60, v)))} suffix="个月" /><NumIn label="结束" value={t2} onChange={(v) => setT2(Math.max(1, Math.min(72, v)))} suffix="个月" /></div>
          {(() => { const a = t1 / 12, b = Math.max(t2, t1 + 1) / 12; const tf = fwd(a, b); const ff = futAt((a + b) / 2); return <Kpis items={[["国债曲线远期利率", f2(tf, 3, "%"), `${t1}×${Math.max(t2, t1 + 1)} 月`], ["SOFR 期货隐含", f2(ff, 3, "%")], ["期货 − 国债远期", tf != null && ff != null ? bp((ff - tf) * 100, 1) : "—", "正 = 担保融资利率高于国债远期"], ["曲线日期", disc?.date ?? "—"]]} />; })()}
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">SOFR 合约</th><th className="text-right">起始（年）</th><th className="text-right">期货隐含</th><th className="text-right">国债远期（3 个月）</th><th className="px-2 text-right">基差</th></tr></thead>
            <tbody>{strip.map((p) => { const a = Math.max(0, yearsTo(p.month)); const tf = fwd(a, a + 0.25); return <tr key={p.month} className={TR}><td className="px-2 py-0.5 font-mono text-slate-300">{p.month}</td><td className="text-right font-mono text-slate-400">{a.toFixed(2)}</td><td className="text-right font-mono">{p.rate.toFixed(3)}%</td><td className="text-right font-mono">{f2(tf, 3, "%")}</td><td className="px-2 text-right font-mono" style={{ background: heat(tf != null ? (p.rate - tf) * 100 : null, 40) }}>{tf != null ? bp((p.rate - tf) * 100, 1) : "—"}</td></tr>; })}</tbody>
          </table>
          <Note>口径：国债远期由实时美债收益率曲线（平价收益率近似零息）推算的简单远期利率；期货隐含利率 = 100 − 期货价格，未做凸性调整。基差反映担保融资（SOFR）与国债之间的利差及期限溢价。</Note>
        </>
      )}
      {tab === "bank" && (
        <>
          <LiveBoard rows={BANKS} extra={[{ head: "相对大盘", cell: (x) => { const v = x !== "SPY" && t[x]?.changePct != null && t.SPY?.changePct != null ? t[x]!.changePct! - t.SPY!.changePct! : null; return <span style={{ color: toneOf(v) }}>{x === "SPY" ? "" : sgn(v)}</span>; } }]} />
          <Note>银行股相对大盘的超额表现与上方资金利差共同刻画银行体系信用：资金利差走阔且银行股跑输，是融资压力的典型组合。</Note>
        </>
      )}
    </PanelShell>
  );
}

/* ================================================================== EFSF 欧元区主权利差热力矩阵 */
const EU_BOARD: BoardRow[] = [
  ...[["FEZ", "欧元区蓝筹 ETF"], ["EWG", "德国 ETF"], ["EWQ", "法国 ETF"], ["EWI", "意大利 ETF"], ["EWP", "西班牙 ETF"], ["EUFN", "欧洲金融 ETF"]].map(([symbol, label]) => ({ symbol, label, group: "欧元区风险资产" })),
  ...[["EURUSD", "欧元/美元"], ["BWX", "国际国债（非美）"], ["IGOV", "发达市场国债（非美）"]].map(([symbol, label]) => ({ symbol, label, group: "汇率与国债" })),
];
export function EFSFLive({ onClose }: P) {
  const [tab, setTab] = useState("heat");
  const [n, setN] = useState("24");
  const sov = useSov();
  const euro = (sov.data?.countries ?? []).filter((c) => EURO.has(c.code) && c.code !== "DE");
  const months = useMemo(() => { const all = [...new Set(euro.flatMap((c) => c.hist.map((h) => h.d)))].sort(); return all.slice(-Number(n)); }, [euro, n]);
  const allMonths = useMemo(() => [...new Set(euro.flatMap((c) => c.hist.map((h) => h.d)))].sort(), [euro]);
  const at = (c: SovC, d: string) => c.hist.find((h) => h.d === d)?.s ?? null;
  const maxS = Math.max(50, ...euro.map((c) => c.spread ?? 0));
  const disp = useMemo(() => allMonths.map((d) => {
    const vals = euro.map((c) => at(c, d)).filter((v): v is number => v != null);
    const avg = (codes: string[]) => { const a = codes.map((k) => euro.find((c) => c.code === k)).filter((c): c is SovC => !!c).map((c) => at(c, d)).filter((v): v is number => v != null); return a.length ? mean(a) : null; };
    const p = avg(PERIPHERY), co = avg(CORE);
    const it = euro.find((c) => c.code === "IT"), fr = euro.find((c) => c.code === "FR");
    const itv = it ? at(it, d) : null, frv = fr ? at(fr, d) : null;
    return { d, sd: vals.length > 2 ? std(vals) : null, pc: p != null && co != null ? p - co : null, itfr: itv != null && frv != null ? itv - frv : null };
  }), [allMonths, euro]);
  const signals = useMemo(() => euro.flatMap((c) => {
    const h = c.hist.filter((x) => x.s != null);
    if (h.length < 13) return [];
    const d = h.slice(1).map((x, i) => x.s! - h[i].s!);
    const sdv = std(d.slice(0, -1));
    const z = sdv > 0 ? lastOf(d)! / sdv : 0;
    let streak = 0;
    const sg = Math.sign(lastOf(d)!);
    for (let i = d.length - 1; i >= 0 && Math.sign(d[i]) === sg && sg !== 0; i--) streak++;
    const vals = h.map((x) => x.s!);
    const pct = (vals.filter((v) => v <= lastOf(vals)!).length / vals.length) * 100;
    const out: Array<{ c: SovC; kind: string; level: number; text: string }> = [];
    if (Math.abs(z) >= 2) out.push({ c, kind: z > 0 ? "急剧扩张" : "急剧收窄", level: Math.abs(z), text: `最近一月利差变动 ${bp(lastOf(d)!)}，为历史月度波动的 ${z.toFixed(1)} 倍标准差` });
    if (streak >= 3) out.push({ c, kind: sg > 0 ? "持续扩张" : "持续收窄", level: streak / 2, text: `已连续 ${streak} 个月${sg > 0 ? "走阔" : "收窄"}，累计 ${bp(vals[vals.length - 1] - vals[vals.length - 1 - streak])}` });
    if (pct >= 90) out.push({ c, kind: "5 年高位", level: 1.2, text: `当前利差 ${lastOf(vals)}bp，处于 5 年分布 ${pct.toFixed(0)}% 分位` });
    if (pct <= 10) out.push({ c, kind: "5 年低位", level: 1, text: `当前利差 ${lastOf(vals)}bp，处于 5 年分布 ${pct.toFixed(0)}% 分位` });
    return out;
  }).sort((a, b) => b.level - a.level), [euro]);
  const lastD = lastOf(disp);
  return (
    <PanelShell code="EFSF" title="欧元区主权利差热力矩阵" onClose={onClose} tabs={[["heat", "热力矩阵"], ["disp", "分化程度"], ["sig", "预警信号"], ["live", "实时风险资产"]]} tab={tab} setTab={setTab}>
      <Kpis items={[["横截面离散度", f2(lastD?.sd, 0, "bp"), lastD?.d], ["外围 − 核心", f2(lastD?.pc, 0, "bp"), "意西葡希 − 法比奥荷芬"], ["意大利 − 法国", f2(lastD?.itfr, 0, "bp")], ["当前预警", String(signals.length), signals[0] ? `${signals[0].c.name}：${signals[0].kind}` : "无"]]} />
      {tab === "heat" && (
        <>
          <div className="flex items-center gap-2 px-2 py-1"><Seg value={n} onChange={setN} options={[["12", "12 个月"], ["24", "24 个月"], ["36", "36 个月"], ["61", "5 年"]]} /></div>
          <div className="overflow-x-auto">
            <table className="text-[10px]">
              <thead className={THEAD}><tr><th className="sticky left-0 bg-[#0a1726] px-2 py-1 text-left">国家</th>{months.map((m) => <th key={m} className="px-1 font-mono font-normal">{m.slice(2)}</th>)}<th className="px-2 text-right">12 月变动</th></tr></thead>
              <tbody>{euro.map((c) => <tr key={c.code} className="border-t border-[#0f1b29]"><td className="sticky left-0 whitespace-nowrap bg-[#03070c] px-2 py-0.5 text-[11px] text-slate-100">{c.name}</td>{months.map((m) => { const v = at(c, m); return <td key={m} className="px-1 text-center font-mono text-slate-100" style={{ background: heat(v, maxS) }}>{v ?? ""}</td>; })}<td className="px-2 text-right font-mono" style={{ color: toneOf(c.spread != null && c.spread12m != null ? c.spread - c.spread12m : null) }}>{c.spread != null && c.spread12m != null ? bp(c.spread - c.spread12m) : "—"}</td></tr>)}</tbody>
            </table>
          </div>
          {!euro.length && <Empty loading={sov.loading} />}
          <Note>{SOV_NOTE}颜色深浅按全体最大利差标准化，红 = 高于德国，绿 = 低于德国。</Note>
        </>
      )}
      {tab === "disp" && (
        <>
          <SectionHead title="欧元区利差分化（bp，月度）" />
          <Lines series={[{ name: "横截面标准差", color: "#f59e0b", values: disp.map((x) => x.sd) }, { name: "外围 − 核心", color: "#f2495c", values: disp.map((x) => x.pc) }, { name: "意大利 − 法国", color: "#38bdf8", values: disp.map((x) => x.itfr) }]} xLabels={disp.map((x) => x.d)} height={220} zero fmt={(v) => v.toFixed(0)} />
          <SectionHead title="各国 12 个月利差变动（bp）" />
          <Bars data={euro.filter((c) => c.spread != null && c.spread12m != null).map((c) => ({ k: c.code, v: c.spread! - c.spread12m! }))} fmt={(v) => `${v.toFixed(0)}bp`} height={120} />
        </>
      )}
      {tab === "sig" && (
        <>
          <table className="w-full text-[11px]">
            <thead className={THEAD}><tr><th className="px-2 py-1 text-left">国家</th><th className="text-left">信号</th><th className="px-2 text-left">依据</th></tr></thead>
            <tbody>
              {signals.map((s, i) => <tr key={`${s.c.code}${i}`} className={TR}><td className="px-2 py-0.5 text-slate-100">{s.c.name}</td><td style={{ color: /扩张|高位/.test(s.kind) ? "#f2495c" : "#1fbf75" }}>{s.kind}</td><td className="px-2 text-slate-400">{s.text}</td></tr>)}
              {!signals.length && <tr><td colSpan={3}><Empty loading={sov.loading} text="当前无触发信号" /></td></tr>}
            </tbody>
          </table>
          <Note>规则：最近一月利差变动超过该国历史月度变动 2 倍标准差 → 急剧扩张 / 收窄；同向变动连续 ≥ 3 个月 → 持续扩张 / 收窄；当前利差位于 5 年分布 90% 以上或 10% 以下 → 高位 / 低位。</Note>
        </>
      )}
      {tab === "live" && (
        <>
          <LiveBoard rows={EU_BOARD} />
          <Note>主权利差为月度数据，日内变化通过欧元区国别股票、金融股与欧元汇率的实时行情跟踪：意大利、西班牙相对德国股票走弱常领先于利差走阔。</Note>
        </>
      )}
    </PanelShell>
  );
}

export { fmtPrice };
