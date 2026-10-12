/**
 * 利率类页面：
 *  - RatesDesk（/rate-trader、/multi-term-dashboard）：货币市场利率（SOFR/EFFR/TGCR/BGCR/OBFR）· 政策利率隐含路径 · 短端收益率 · 期限分组
 *  - AuctionDesk（/bond-trader）：美债拍卖日历 · 拍卖结果（认购倍数 / 中标收益率 / 投资者结构）· 认购倍数走势 · 债券交易看板
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, type BoardRow } from "./kit";
import { f2, heat } from "./calc";

type MMRow = { d: string; v: number; vol: number | null; p1: number | null; p99: number | null };
type MM = { series: Record<string, MMRow[]>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>; sofrStrip: Array<{ month: string; rate: number; chg: number | null; volume: number | null }> };
type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }>; spreads: unknown[] };
const MM_NAME: Record<string, string> = { SOFR: "担保隔夜融资利率", EFFR: "有效联邦基金利率", OBFR: "隔夜银行融资利率", TGCR: "三方回购一般担保利率", BGCR: "广义一般担保利率" };
const MM_COLOR: Record<string, string> = { SOFR: "#38bdf8", EFFR: "#fbbf24", OBFR: "#a78bfa", TGCR: "#34d399", BGCR: "#f472b6" };

function MoneyMarket({ mm }: { mm: MM | null }) {
  const [range, setRange] = useState("126");
  const n = Number(range);
  const keys = Object.keys(MM_NAME).filter((k) => mm?.series[k]?.length);
  const dates = mm?.series.SOFR?.slice(-n).map((r) => r.d) ?? [];
  const sofr = mm?.series.SOFR ?? [];
  return (
    <div>
      <SectionHead title="美元货币市场基准利率" sub={mm?.target.from != null ? `联邦基金目标区间 ${mm.target.from.toFixed(2)}% – ${mm.target.to?.toFixed(2)}%` : undefined} right={<Seg value={range} onChange={setRange} options={[["21", "1月"], ["63", "3月"], ["126", "半年"], ["260", "1年"]]} />} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">利率</th><th className="text-left">日期</th><th className="text-right">最新</th><th className="text-right">日变</th><th className="text-right">周变</th><th className="text-right">1% 分位</th><th className="text-right">99% 分位</th><th className="text-right">成交（十亿美元）</th><th className="px-2 text-right">与目标上限</th></tr></thead>
        <tbody>
          {keys.map((k) => {
            const s = mm!.series[k];
            const a = s[s.length - 1], b = s[s.length - 2], w = s[s.length - 6];
            const bp = (x?: MMRow) => (x ? Math.round((a.v - x.v) * 100) : null);
            return (
              <tr key={k} className="border-t border-[#0f1b29]">
                <td className="px-2 py-1"><b style={{ color: MM_COLOR[k] }}>{k}</b><span className="ml-1.5 text-[10px] text-slate-500">{MM_NAME[k]}</span></td>
                <td className="font-mono text-[10px] text-slate-500">{a.d}</td>
                <td className="text-right font-mono text-white">{a.v.toFixed(2)}%</td>
                <td className="text-right font-mono" style={{ color: toneOf(bp(b)) }}>{bp(b) == null ? "—" : `${bp(b)! > 0 ? "+" : ""}${bp(b)}bp`}</td>
                <td className="text-right font-mono" style={{ color: toneOf(bp(w)) }}>{bp(w) == null ? "—" : `${bp(w)! > 0 ? "+" : ""}${bp(w)}bp`}</td>
                <td className="text-right font-mono text-slate-400">{f2(a.p1)}</td><td className="text-right font-mono text-slate-400">{f2(a.p99)}</td>
                <td className="text-right font-mono text-slate-300">{a.vol == null ? "—" : a.vol.toLocaleString()}</td>
                <td className="px-2 text-right font-mono text-slate-300">{mm!.target.to != null ? `${Math.round((a.v - mm!.target.to) * 100)}bp` : "—"}</td>
              </tr>
            );
          })}
          {!mm && <tr><td colSpan={9} className="px-2 py-6 text-slate-500">读取中…</td></tr>}
        </tbody>
      </table>
      <SectionHead title="利率走势（%）" />
      <Lines series={keys.map((k) => { const map = new Map(mm!.series[k].map((r) => [r.d, r.v])); return { name: k, color: MM_COLOR[k], values: dates.map((d) => map.get(d) ?? null) }; })} xLabels={dates.map((d) => d.slice(5))} height={200} fmt={(v) => v.toFixed(2)} />
      <SectionHead title="SOFR 成交量（十亿美元）与 1%–99% 分布宽度" />
      <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
        <div className="bg-[#03070c]"><Bars data={sofr.slice(-60).map((r) => ({ k: r.d.slice(5), v: r.vol ?? 0 }))} fmt={(v) => v.toFixed(0)} height={130} /></div>
        <div className="bg-[#03070c]"><Lines series={[{ name: "分布宽度 bp", color: "#f472b6", values: sofr.slice(-60).map((r) => (r.p99 != null && r.p1 != null ? (r.p99 - r.p1) * 100 : null)) }]} xLabels={sofr.slice(-60).map((r) => r.d.slice(5))} height={130} fmt={(v) => v.toFixed(0)} /></div>
      </div>
      <div className="px-2 py-1 text-[10px] text-slate-500">回购利率（SOFR/TGCR/BGCR）贴近或高于联邦基金目标上限、分布变宽、成交放大，通常意味着美元流动性偏紧（季末、缴税日、国债发行结算日常见）。</div>
    </div>
  );
}

function PolicyPath({ mm }: { mm: MM | null }) {
  const mid = mm?.target.from != null && mm?.target.to != null ? (mm.target.from + mm.target.to) / 2 : null;
  const path = mm?.path ?? [];
  return (
    <div>
      <SectionHead title="联邦基金期货隐含政策利率路径" sub={mid != null ? `当前目标区间中值 ${mid.toFixed(3)}%；负数 = 累计降息次数（每次 25bp）` : undefined} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]">
          <Lines series={[{ name: "隐含利率 %", color: "#38bdf8", values: path.map((p) => p.rate) }, ...(mid != null ? [{ name: "当前中值", color: "#64748b", values: path.map(() => mid), dash: true }] : []), { name: "SOFR 期货隐含 %", color: "#fbbf24", values: path.map((p) => mm?.sofrStrip.find((s) => s.month === p.month)?.rate ?? null) }]} xLabels={path.map((p) => p.month.slice(2))} height={220} fmt={(v) => v.toFixed(2)} />
          <Bars data={path.map((p) => ({ k: p.month.slice(2), v: -(p.cuts ?? 0) }))} fmt={(v) => `${v.toFixed(2)} 次`} height={120} />
          
        </div>
        <div className="bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">合约月</th><th className="text-right">隐含利率</th><th className="text-right">日变</th><th className="text-right">较当前</th><th className="px-2 text-right">隐含调息</th></tr></thead>
            <tbody>
              {path.map((p) => (
                <tr key={p.month} className="border-t border-[#0f1b29]">
                  <td className="px-2 py-0.5 font-mono text-slate-200">{p.month}</td>
                  <td className="text-right font-mono text-white">{p.rate.toFixed(3)}%</td>
                  <td className="text-right font-mono" style={{ color: toneOf(p.chg) }}>{p.chg == null ? "—" : `${p.chg > 0 ? "+" : ""}${(p.chg * 100).toFixed(1)}bp`}</td>
                  <td className="text-right font-mono" style={{ background: heat(mid != null ? (p.rate - mid) * 100 : null, 100) }}>{mid != null ? `${Math.round((p.rate - mid) * 100)}bp` : "—"}</td>
                  <td className="px-2 text-right font-mono" style={{ color: toneOf(p.cuts != null ? -p.cuts : null) }}>{p.cuts == null ? "—" : p.cuts > 0.05 ? `降 ${p.cuts.toFixed(2)}` : p.cuts < -0.05 ? `加 ${(-p.cuts).toFixed(2)}` : "不变"}</td>
                </tr>
              ))}
              {!path.length && <tr><td colSpan={5} className="px-2 py-6 text-slate-500">{mm ? "联邦基金期货暂无报价" : "读取中…"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const SHORT = ["1M", "6W", "2M", "3M", "4M", "6M", "1Y", "2Y"];
function Bills({ curves }: { curves: Curves | null }) {
  const us = curves?.us ?? [];
  const now = us[0];
  const hist = us.slice(0, 260).reverse();
  return (
    <div>
      <SectionHead title="短端收益率（国库券至 2 年）" sub={now ? `最新 ${now.date}` : undefined} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">收益率</th><th className="text-right">1日</th><th className="text-right">1周</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="px-2 text-right">1年</th></tr></thead>
        <tbody>
          {SHORT.map((t) => {
            const v = now?.points.find((p) => p.tenor === t)?.value;
            if (v == null) return null;
            const d = (k: number) => { const o = us[Math.min(k, us.length - 1)]?.points.find((p) => p.tenor === t)?.value; return o != null ? Math.round((v - o) * 100) : null; };
            return <tr key={t} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-200">{t}</td><td className="text-right font-mono text-white">{v.toFixed(2)}%</td>{[1, 5, 21, 63, 250].map((k) => <td key={k} className="text-right font-mono last:px-2" style={{ background: heat(d(k), 50) }}>{d(k) == null ? "—" : `${d(k)! > 0 ? "+" : ""}${d(k)}`}</td>)}</tr>;
          })}
        </tbody>
      </table>
      <SectionHead title="3 个月 / 6 个月 / 2 年走势（%）" />
      <Lines series={[["3M", "#38bdf8"], ["6M", "#a78bfa"], ["2Y", "#fbbf24"]].map(([t, c]) => ({ name: t, color: c, values: hist.map((h) => h.points.find((p) => p.tenor === t)?.value ?? null) }))} xLabels={hist.map((h) => h.date.slice(5))} height={200} />
      <div className="px-2 py-1 text-[10px] text-slate-500">2 年收益率低于 3 个月，说明市场在为未来降息定价；两者差距越大，隐含降息幅度越大。</div>
    </div>
  );
}

const BUCKETS: Array<{ key: string; label: string; tenors: string[]; etf: string; etfLabel: string; fut?: string }> = [
  { key: "0-1y", label: "0–1 年", tenors: ["3M", "6M", "1Y"], etf: "BIL", etfLabel: "1–3 月国库券 ETF" },
  { key: "1-3y", label: "1–3 年", tenors: ["2Y", "3Y"], etf: "SHY", etfLabel: "1–3 年美债 ETF", fut: "ZT" },
  { key: "3-5y", label: "3–5 年", tenors: ["5Y"], etf: "IEI", etfLabel: "3–7 年美债 ETF", fut: "ZF=F" },
  { key: "5-7y", label: "5–7 年", tenors: ["7Y"], etf: "IEI", etfLabel: "3–7 年美债 ETF" },
  { key: "7-10y", label: "7–10 年", tenors: ["10Y"], etf: "IEF", etfLabel: "7–10 年美债 ETF", fut: "ZN" },
  { key: "10-20y", label: "10–20 年", tenors: ["20Y"], etf: "TLH", etfLabel: "10–20 年美债 ETF", fut: "TN=F" },
  { key: "20y+", label: "20 年以上", tenors: ["30Y"], etf: "TLT", etfLabel: "20 年以上美债 ETF", fut: "ZB=F" },
];
function Buckets({ curves }: { curves: Curves | null }) {
  const us = curves?.us ?? [];
  const ticks = useTicks([...new Set(BUCKETS.flatMap((b) => [b.etf, ...(b.fut ? [b.fut] : [])]))]);
  const avg = (k: number, tenors: string[]) => { const p = us[Math.min(k, us.length - 1)]?.points.filter((x) => tenors.includes(x.tenor)) ?? []; return p.length ? p.reduce((s, x) => s + x.value, 0) / p.length : null; };
  return (
    <div>
      <SectionHead title="期限分组（美债）" sub="每组：代表期限收益率与变动、对应 ETF 与国债期货的实时价格；点击进入该期限的详细数据" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限组</th><th className="text-left">代表期限</th><th className="text-right">收益率</th><th className="text-right">1周</th><th className="text-right">1月</th><th className="text-right">1年</th><th className="text-left pl-3">ETF</th><th className="text-right">价格</th><th className="text-right">涨跌幅</th><th className="text-left pl-3">期货</th><th className="text-right">涨跌幅</th><th className="px-2" /></tr></thead>
        <tbody>
          {BUCKETS.map((b) => {
            const v = avg(0, b.tenors);
            const d = (k: number) => { const o = avg(k, b.tenors); return v != null && o != null ? Math.round((v - o) * 100) : null; };
            const e = ticks[b.etf], f = b.fut ? ticks[b.fut] : null;
            return (
              <tr key={b.key} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
                <td className="px-2 py-1 font-semibold text-slate-100">{b.label}</td><td className="text-slate-400">{b.tenors.join(" / ")}</td>
                <td className="text-right font-mono text-white">{f2(v, 2, "%")}</td>
                {[5, 21, 250].map((k) => <td key={k} className="text-right font-mono" style={{ background: heat(d(k), 60) }}>{d(k) == null ? "—" : `${d(k)! > 0 ? "+" : ""}${d(k)}bp`}</td>)}
                <td className="pl-3 text-slate-300">{b.etf}<span className="ml-1 text-[9px] text-slate-500">{b.etfLabel}</span></td>
                <td className="text-right font-mono text-white">{fmtPrice(e?.price)}</td><td className="text-right font-mono" style={{ color: toneOf(e?.changePct) }}>{fmtPct(e?.changePct)}</td>
                <td className="pl-3 font-mono text-slate-400">{b.fut ?? "—"}</td><td className="text-right font-mono" style={{ color: toneOf(f?.changePct) }}>{f ? fmtPct(f.changePct) : "—"}</td>
                <td className="px-2 text-right"><Link href={`/rate-trader-by-term?term=${b.key}`} className="text-[10px] text-cyan-300 hover:underline">详细 ›</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const RATE_BOARD: BoardRow[] = [
  ...[["SR3=F", "3 个月 SOFR 期货"], ["ZQ=F", "联邦基金期货"], ["ZT", "2 年美债期货"], ["ZN", "10 年美债期货"]].map(([s, l]) => ({ symbol: s, label: l, group: "利率期货" })),
  ...[["^IRX", "13 周收益率"], ["^FVX", "5 年收益率"], ["^TNX", "10 年收益率"], ["^TYX", "30 年收益率"], ["^MOVE", "美债波动率"]].map(([s, l]) => ({ symbol: s, label: l, group: "收益率" })),
  ...[["BIL", "国库券 ETF"], ["SGOV", "0–3 月国库券 ETF"], ["USFR", "浮息国债 ETF"], ["TFLO", "浮息国债 ETF（二）"]].map(([s, l]) => ({ symbol: s, label: l, group: "现金类 ETF" })),
];

export function RatesDesk({ initial = "mm" }: { initial?: string }) {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? initial);
  const mm = usePolled<MM>("ucHubs.moneyMarket", ["mm", "path"].includes(func) ? {} : null, 600_000);
  const curves = usePolled<Curves>("ucHubs.curves", ["bills", "buckets"].includes(func) ? {} : null, 1800_000);
  const sofr = mm.data?.series.SOFR;
  return (
    <HubShell title="利率交易台" code="RATE" func={func} setFunc={setFunc}
      funcs={[["mm", "MMR", "货币市场利率"], ["path", "WIRP", "政策利率路径"], ["bills", "TBIL", "短端收益率"], ["buckets", "TERM", "期限分组"], ["board", "IRF", "利率期货看板"]]}
      right={sofr?.length ? <span>SOFR <b className="font-mono text-white">{sofr[sofr.length - 1].v.toFixed(2)}%</b></span> : null}>
      {func === "mm" && <MoneyMarket mm={mm.data} />}
      {func === "path" && <PolicyPath mm={mm.data} />}
      {func === "bills" && <Bills curves={curves.data} />}
      {func === "buckets" && <Buckets curves={curves.data} />}
      {func === "board" && <LiveBoard rows={RATE_BOARD} />}
    </HubShell>
  );
}

/* ================================================================== 美债拍卖 */
type Auction = { cusip: string; type: string; term: string; reopening: boolean; announce: string; auction: string; issue: string; maturity: string; offering: number | null; coupon: number | null; highYield: number | null; highDiscount: number | null; btc: number | null; total: number | null; tendered: number | null; direct: number | null; indirect: number | null; dealer: number | null; allotted: number | null; tips: boolean; frn: boolean; closing: string };
const TYPE_ZH: Record<string, string> = { Bill: "国库券", Note: "中期国债", Bond: "长期国债", TIPS: "通胀保值", FRN: "浮息债", CMB: "现金管理券" };
const typeZh = (a: Auction) => (a.tips ? "通胀保值" : a.frn ? "浮息债" : TYPE_ZH[a.type] ?? a.type);
const termZh = (t: string) => t.replace(/-Year/g, " 年").replace(/-Month/g, " 个月").replace(/-Week/g, " 周").replace(/-Day/g, " 天");

function AuctionTable({ rows, done }: { rows: Auction[]; done?: boolean }) {
  const [type, setType] = useState("all");
  const list = rows.filter((a) => type === "all" || typeZh(a) === type);
  const types = [...new Set(rows.map(typeZh))];
  return (
    <div>
      <div className="flex flex-wrap gap-1 px-2 py-1">{["all", ...types].map((t) => <button key={t} type="button" onClick={() => setType(t)} className={`border px-1.5 text-[10px] ${type === t ? "border-cyan-500 text-cyan-200" : "border-[#1d3047] text-slate-400"}`}>{t === "all" ? "全部" : t}</button>)}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">品种</th><th className="text-left">期限</th><th className="text-right">发行规模</th>{done ? <><th className="text-right">中标收益率</th><th className="text-right">票息</th><th className="text-right">认购倍数</th><th className="text-right">间接（海外）</th><th className="text-right">直接</th><th className="text-right">一级交易商</th><th className="text-right">高位配售</th></> : <><th className="text-left">公告日</th><th className="text-left">发行日</th><th className="text-left">到期日</th><th className="text-left">截止（美东）</th></>}<th className="px-2 text-left">代码</th></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={`${a.cusip}-${a.auction}`} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
                <td className="px-2 py-0.5 font-mono text-slate-200">{a.auction}</td><td className="text-slate-300">{typeZh(a)}{a.reopening ? <span className="ml-1 text-[9px] text-amber-300">续发</span> : null}</td><td className="text-slate-300">{termZh(a.term)}</td>
                <td className="text-right font-mono text-slate-200">{a.offering ? `${fmtCompact(a.offering)}` : "—"}</td>
                {done ? <>
                  <td className="text-right font-mono text-white">{a.highYield != null ? `${a.highYield.toFixed(3)}%` : a.highDiscount != null ? `${a.highDiscount.toFixed(3)}%` : "—"}</td>
                  <td className="text-right font-mono text-slate-400">{a.coupon != null ? `${a.coupon.toFixed(3)}%` : "—"}</td>
                  <td className="text-right font-mono font-semibold" style={{ color: a.btc == null ? undefined : a.btc >= 2.6 ? "#f2495c" : a.btc < 2.3 ? "#1fbf75" : "#e2e8f0" }}>{f2(a.btc, 2)}</td>
                  <td className="text-right font-mono text-slate-200">{f2(a.indirect, 1, "%")}</td><td className="text-right font-mono text-slate-300">{f2(a.direct, 1, "%")}</td><td className="text-right font-mono text-slate-300">{f2(a.dealer, 1, "%")}</td><td className="text-right font-mono text-slate-400">{f2(a.allotted, 1, "%")}</td>
                </> : <>
                  <td className="font-mono text-slate-400">{a.announce}</td><td className="font-mono text-slate-400">{a.issue}</td><td className="font-mono text-slate-400">{a.maturity}</td><td className="font-mono text-slate-400">{a.closing || "—"}</td>
                </>}
                <td className="px-2 font-mono text-[10px] text-slate-500">{a.cusip}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={12} className="px-2 py-6 text-slate-500">暂无</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function BtcTrend({ rows }: { rows: Auction[] }) {
  const terms = useMemo(() => {
    const by = new Map<string, Auction[]>();
    for (const a of rows) if (a.btc != null && !a.tips && !a.frn && a.type !== "CMB") { const k = `${typeZh(a)} ${termZh(a.term)}`; by.set(k, [...(by.get(k) ?? []), a]); }
    return [...by.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
  }, [rows]);
  const [sel, setSel] = useState<string | null>(null);
  const cur = terms.find(([k]) => k === sel) ?? terms[0];
  const list = cur ? [...cur[1]].reverse() : [];
  return (
    <div>
      <SectionHead title="同期限拍卖对比" right={<select value={cur?.[0] ?? ""} onChange={(e) => setSel(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-[11px] text-slate-200">{terms.map(([k]) => <option key={k}>{k}</option>)}</select>} />
      <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
        <div className="bg-[#03070c]"><Lines series={[{ name: "认购倍数", color: "#38bdf8", values: list.map((a) => a.btc) }]} xLabels={list.map((a) => a.auction.slice(5))} height={160} /></div>
        <div className="bg-[#03070c]"><Lines series={[{ name: "中标收益率 %", color: "#fbbf24", values: list.map((a) => a.highYield ?? a.highDiscount) }, { name: "间接认购占比 %", color: "#a78bfa", values: list.map((a) => a.indirect) }]} xLabels={list.map((a) => a.auction.slice(5))} height={160} /></div>
      </div>
      <div className="px-2 py-1 text-[10px] text-slate-500">认购倍数高、间接（含海外央行）占比高、一级交易商被动接券少，意味着需求强；反之说明需求疲弱，常伴随收益率上行。</div>
    </div>
  );
}
const BOND_BOARD: BoardRow[] = [
  ...[["^IRX", "13 周"], ["^FVX", "5 年"], ["^TNX", "10 年"], ["^TYX", "30 年"]].map(([s, l]) => ({ symbol: s, label: `美债收益率 ${l}`, group: "美债收益率" })),
  ...[["SHY", "1–3 年美债"], ["IEI", "3–7 年美债"], ["IEF", "7–10 年美债"], ["TLH", "10–20 年美债"], ["TLT", "20 年以上美债"], ["GOVT", "全期限美债"], ["TIP", "通胀保值债"], ["STIP", "短期通胀保值债"]].map(([s, l]) => ({ symbol: s, label: `${l} ETF`, group: "国债 ETF" })),
  ...[["sh511260", "十年国债 ETF"], ["sh511010", "国债 ETF"], ["sh511090", "三十年国债 ETF"], ["sh511360", "短融 ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "中国债券 ETF" })),
];
export function AuctionDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "up");
  const a = usePolled<{ upcoming: Auction[]; results: Auction[] }>("ucHubs.auctions", ["up", "res", "trend"].includes(func) ? {} : null, 900_000);
  const feed = useFeed(func === "news" ? { cats: ["债券"], limit: 120, hours: 96 } : null);
  const next = a.data?.upcoming[0];
  return (
    <HubShell title="债券交易台" code="BOND" func={func} setFunc={setFunc}
      funcs={[["up", "AUCT", "拍卖日历"], ["res", "AUCR", "拍卖结果"], ["trend", "BTC", "需求对比"], ["board", "BTMM", "债券看板"], ["news", "BN", "债市新闻"]]}
      right={next ? <span>下一场 <b className="text-white">{next.auction} {typeZh(next)} {termZh(next.term)}</b></span> : null}>
      {func === "up" && <><SectionHead title="即将拍卖" sub={a.data ? `${a.data.upcoming.length} 场` : "读取中…"} /><AuctionTable rows={a.data?.upcoming ?? []} /></>}
      {func === "res" && <><SectionHead title="近 4 个月拍卖结果" sub={a.data ? `${a.data.results.length} 场` : "读取中…"} /><AuctionTable rows={a.data?.results ?? []} done /></>}
      {func === "trend" && <BtcTrend rows={a.data?.results ?? []} />}
      {func === "board" && <LiveBoard rows={BOND_BOARD} />}
      {func === "news" && <><SectionHead title="债市新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}
