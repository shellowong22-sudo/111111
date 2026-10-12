/**
 * WB — 全球债券市场（/bond-market）
 * 真实数据：美债每日曲线（两年历史）、欧元区 AAA 曲线、欧盟各国 10 年期国债（月度，对德利差）、
 * 美债期货各合约、美债拍卖日历与结果、美元货币市场利率与联邦基金期货隐含路径、
 * 债券 ETF / 收益率指数实时行情与日线。不再使用任何合成国家矩阵、CDS 或抖动数据。
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { fmtCompact, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { f2, heat, mean, std } from "@/uc/hubs/calc";
import { Bars, HubShell, LiveBoard, Lines, type BoardRow } from "@/uc/hubs/kit";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import { Linkage, Optimizer, RelValue, type Sov } from "./PageXBond2";

type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }>; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
type Fut = { root: string; name: string; unit: string; points: Array<{ code: string; month: string; price: number; change: number | null; changePct: number | null; volume: number | null }>; structure: string; slopePct: number | null };
type Auction = { cusip: string; type: string; term: string; reopening: boolean; announce: string; auction: string; issue: string; maturity: string; offering: number | null; coupon: number | null; highYield: number | null; highDiscount: number | null; btc: number | null; direct: number | null; indirect: number | null; dealer: number | null; tips: boolean; frn: boolean };
type MM = { series: Record<string, Array<{ d: string; v: number; vol: number | null }>>; target: { from: number | null; to: number | null }; path: Array<{ month: string; rate: number; chg: number | null; cuts: number | null }>; sofrStrip: Array<{ month: string; rate: number }> };

const TENORS = ["1M", "2M", "3M", "4M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
const EU_TENORS = ["3M", "1Y", "2Y", "5Y", "10Y", "20Y", "30Y"];
const FUNCS: Array<[string, string, string]> = [
  ["ytm-matrix", "WB", "收益率矩阵"],
  ["yield-curves", "GC", "曲线与利差"],
  ["gnn", "CORR", "跨市场联动"],
  ["optimizer", "PORT", "组合优化"],
  ["scatter", "RV", "主权相对价值"],
  ["auction", "AUCT", "拍卖与资金面"],
  ["ai-report", "RPT", "研判报告"],
];
const BOARD: BoardRow[] = [
  { symbol: "^IRX", label: "13 周国库券收益率", group: "美债收益率（实时）" }, { symbol: "^FVX", label: "5 年期收益率", group: "美债收益率（实时）" }, { symbol: "^TNX", label: "10 年期收益率", group: "美债收益率（实时）" }, { symbol: "^TYX", label: "30 年期收益率", group: "美债收益率（实时）" }, { symbol: "^MOVE", label: "美债期权隐含波动率", group: "美债收益率（实时）" },
  { symbol: "ZT", label: "2 年美债期货", group: "国债期货" }, { symbol: "ZF", label: "5 年美债期货", group: "国债期货" }, { symbol: "ZN", label: "10 年美债期货", group: "国债期货" }, { symbol: "ZB", label: "30 年美债期货", group: "国债期货" }, { symbol: "UB", label: "超长美债期货", group: "国债期货" },
  { symbol: "SHY", label: "美债 1–3 年", group: "债券 ETF" }, { symbol: "IEF", label: "美债 7–10 年", group: "债券 ETF" }, { symbol: "TLT", label: "美债 20 年以上", group: "债券 ETF" }, { symbol: "TIP", label: "通胀保值国债", group: "债券 ETF" }, { symbol: "BNDX", label: "全球综合（美元对冲）", group: "债券 ETF" }, { symbol: "BWX", label: "国际国债（未对冲）", group: "债券 ETF" }, { symbol: "EMB", label: "新兴市场美元债", group: "债券 ETF" }, { symbol: "LQD", label: "投资级公司债", group: "债券 ETF" }, { symbol: "HYG", label: "高收益公司债", group: "债券 ETF" },
];

const pt = (d: Curves["us"][number] | undefined, t: string) => d?.points.find((p) => p.tenor === t)?.value ?? null;
const bp = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? Math.round((a - b) * 100) : null);
const sbp = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v}`);

/* ------------------------------------------------------------------ 1 收益率矩阵 */
function Matrix({ curves, sov }: { curves: Curves | null; sov: Sov | null }) {
  const us = curves?.us ?? [];
  const now = us[0];
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"spread" | "y" | "chg1m" | "chg12m">("spread");
  const lags: Array<[string, number]> = [["1日", 1], ["1周", 5], ["1月", 21], ["3月", 63], ["6月", 126], ["1年", 250]];
  const countries = (sov?.countries ?? []).filter((c) => !q || c.name.includes(q) || c.code.toLowerCase().includes(q.toLowerCase()));
  const sorted = [...countries].sort((a, b) => ((b[sortKey] ?? -1e9) as number) - ((a[sortKey] ?? -1e9) as number));
  return (
    <div>
      <SectionHead title="美国国债：期限 × 变动矩阵（bp）" sub={now ? `收益率曲线日期 ${now.date}；分位 = 当前值在近一年中的位置` : undefined} />
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">收益率</th>{lags.map(([l]) => <th key={l} className="text-right">{l}</th>)}<th className="text-right">1年低</th><th className="text-right">1年高</th><th className="px-2 text-right">1年分位</th></tr></thead>
          <tbody>
            {TENORS.map((t) => {
              const v = pt(now, t);
              if (v == null) return null;
              const hist = us.slice(0, 251).map((d) => pt(d, t)).filter((x): x is number => x != null);
              const pct = hist.length ? (hist.filter((x) => x <= v).length / hist.length) * 100 : null;
              return (
                <tr key={t} className="border-t border-[#0f1b29]">
                  <td className="px-2 py-0.5 text-slate-200">{t}</td>
                  <td className="text-right font-mono text-white">{v.toFixed(2)}%</td>
                  {lags.map(([l, k]) => { const d = bp(v, pt(us[Math.min(k, us.length - 1)], t)); return <td key={l} className="text-right font-mono" style={{ background: heat(d, 60) }}>{sbp(d)}</td>; })}
                  <td className="text-right font-mono text-slate-400">{Math.min(...hist).toFixed(2)}</td>
                  <td className="text-right font-mono text-slate-400">{Math.max(...hist).toFixed(2)}</td>
                  <td className="px-2 text-right font-mono">{f2(pct, 0, "%")}</td>
                </tr>
              );
            })}
            {!now && <tr><td colSpan={11} className="px-2 py-6 text-slate-500">读取中…</td></tr>}
          </tbody>
        </table>
      </div>
      <SectionHead title="欧盟各国 10 年期国债（月度）" sub={sov?.countries[0] ? `数据月份 ${sov.countries[0].date}；利差为对德国，单位 bp；点击表头排序` : undefined} right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选国家" className="w-28 border border-[#1d3047] bg-[#07111c] px-1.5 py-0.5 text-[11px] text-white" />} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500">
          <tr>
            <th className="px-2 py-1 text-left">国家</th>
            {([["y", "10年收益率"], ["spread", "对德利差"]] as const).map(([k, l]) => <th key={k} onClick={() => setSortKey(k)} className={`cursor-pointer text-right ${sortKey === k ? "text-cyan-300" : ""}`}>{l}{sortKey === k ? " ▼" : ""}</th>)}
            <th className="text-right">利差 1月变</th><th className="text-right">利差 12月变</th>
            {([["chg1m", "收益率 1月变"], ["chg12m", "收益率 12月变"]] as const).map(([k, l]) => <th key={k} onClick={() => setSortKey(k)} className={`cursor-pointer text-right ${sortKey === k ? "text-cyan-300" : ""}`}>{l}{sortKey === k ? " ▼" : ""}</th>)}
            <th className="px-2 text-right">对美 10 年</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const month = us.filter((d) => d.date.slice(0, 7) === c.date.slice(0, 7)).map((d) => pt(d, "10Y")).filter((x): x is number => x != null);
            const us10 = month.length ? mean(month) : null;
            return (
              <tr key={c.code} className="border-t border-[#0f1b29]">
                <td className="px-2 py-0.5 text-slate-200">{c.name}<span className="ml-1 font-mono text-[9px] text-slate-600">{c.code}</span></td>
                <td className="text-right font-mono text-white">{c.y.toFixed(2)}%</td>
                <td className="text-right font-mono">{c.code === "DE" ? "基准" : c.spread ?? "—"}</td>
                <td className="text-right font-mono" style={{ background: heat(c.spread != null && c.spread1m != null ? c.spread - c.spread1m : null, 30) }}>{c.spread != null && c.spread1m != null ? sbp(c.spread - c.spread1m) : "—"}</td>
                <td className="text-right font-mono" style={{ background: heat(c.spread != null && c.spread12m != null ? c.spread - c.spread12m : null, 80) }}>{c.spread != null && c.spread12m != null ? sbp(c.spread - c.spread12m) : "—"}</td>
                <td className="text-right font-mono" style={{ background: heat(c.chg1m, 40) }}>{sbp(c.chg1m)}</td>
                <td className="text-right font-mono" style={{ background: heat(c.chg12m, 100) }}>{sbp(c.chg12m)}</td>
                <td className="px-2 text-right font-mono text-slate-300">{us10 != null ? sbp(Math.round((c.y - us10) * 100)) : "—"}</td>
              </tr>
            );
          })}
          {!sov && <tr><td colSpan={8} className="px-2 py-6 text-slate-500">读取中…</td></tr>}
        </tbody>
      </table>
      
      <SectionHead title="利率实时行情" sub="点任意行在右侧看实时 K 线" />
      <LiveBoard rows={BOARD} />
    </div>
  );
}

/* ------------------------------------------------------------------ 2 曲线与利差 */
function CurvesView({ curves, futs }: { curves: Curves | null; futs: Fut[] | null }) {
  const [cmp, setCmp] = useState("21");
  const us = curves?.us ?? [];
  const now = us[0], ago = us[Math.min(Number(cmp), us.length - 1)];
  const [range, setRange] = useState("260");
  const sp = (curves?.spreads ?? []).slice(-Number(range));
  const stat = (k: "s2s10" | "s3m10" | "s5s30") => {
    const v = (curves?.spreads ?? []).map((r) => r[k]).filter((x): x is number => x != null);
    const last = v[v.length - 1];
    const sd = std(v);
    return { last, min: Math.min(...v), max: Math.max(...v), z: sd ? (last - mean(v)) / sd : null, chg: v.length > 21 ? last - v[v.length - 22] : null };
  };
  const euMap = new Map((curves?.eu ?? []).map((p) => [p.tenor, p.value]));
  return (
    <div>
      <SectionHead title="收益率曲线：美债（今 vs 过去）与欧元区 AAA" sub={now ? `美债 ${now.date} · 欧元区 ${curves?.euDate ?? "—"}` : undefined} right={<Seg value={cmp} onChange={setCmp} options={[["5", "1周前"], ["21", "1月前"], ["63", "3月前"], ["250", "1年前"]]} />} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-[#03070c]">
          <Lines series={[{ name: `美债 ${now?.date ?? ""}`, color: "#38bdf8", values: TENORS.map((t) => pt(now, t)) }, { name: `美债 ${ago?.date ?? ""}`, color: "#64748b", values: TENORS.map((t) => pt(ago, t)), dash: true }, { name: "欧元区 AAA", color: "#34d399", values: TENORS.map((t) => euMap.get(t) ?? null) }]} xLabels={TENORS} height={220} />
          <Bars data={TENORS.filter((t) => pt(now, t) != null && pt(ago, t) != null).map((t) => ({ k: t, v: bp(pt(now, t), pt(ago, t))! }))} fmt={(v) => `${v}bp`} height={100} />
          
        </div>
        <div className="bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">期限</th><th className="text-right">美债</th><th className="text-right">欧元区AAA</th><th className="px-2 text-right">美−欧（bp）</th></tr></thead>
            <tbody>{EU_TENORS.map((t) => { const a = pt(now, t), b = euMap.get(t) ?? null; return <tr key={t} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{t}</td><td className="text-right font-mono">{f2(a)}</td><td className="text-right font-mono">{f2(b)}</td><td className="px-2 text-right font-mono" style={{ background: heat(bp(a, b), 250) }}>{sbp(bp(a, b))}</td></tr>; })}</tbody>
          </table>
          <div className="px-2 py-1 text-[10px] text-slate-500">跨大西洋利差决定欧元资金买美债的对冲后收益，利差越大美债对欧洲投资者越有吸引力（未扣对冲成本）。</div>
        </div>
      </div>
      <SectionHead title="期限利差（bp）" right={<Seg value={range} onChange={setRange} options={[["63", "3月"], ["126", "半年"], ["260", "1年"]]} />} />
      <Lines series={[{ name: "2s10s", color: "#fbbf24", values: sp.map((r) => r.s2s10) }, { name: "3m10y", color: "#38bdf8", values: sp.map((r) => r.s3m10) }, { name: "5s30", color: "#a78bfa", values: sp.map((r) => r.s5s30) }]} xLabels={sp.map((r) => r.date.slice(5))} height={190} fmt={(v) => v.toFixed(0)} zero />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">利差</th><th className="text-right">最新</th><th className="text-right">1月变动</th><th className="text-right">1年低</th><th className="text-right">1年高</th><th className="px-2 text-right">1年 Z 分数</th></tr></thead>
        <tbody>{(["s2s10", "s3m10", "s5s30"] as const).map((k) => { const s = stat(k); return <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 text-slate-200">{{ s2s10: "10年 − 2年", s3m10: "10年 − 3月", s5s30: "30年 − 5年" }[k]}</td><td className="text-right font-mono text-white">{Number.isFinite(s.last) ? s.last : "—"}</td><td className="text-right font-mono" style={{ color: toneOf(s.chg) }}>{sbp(s.chg)}</td><td className="text-right font-mono text-slate-400">{Number.isFinite(s.min) ? s.min : "—"}</td><td className="text-right font-mono text-slate-400">{Number.isFinite(s.max) ? s.max : "—"}</td><td className="px-2 text-right font-mono">{f2(s.z, 2)}</td></tr>; })}</tbody>
      </table>
      <SectionHead title="美债期货各合约（期限结构）" sub="价格为点数" />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">品种</th><th className="text-left">合约</th><th className="text-right">价格</th><th className="text-right">涨跌</th><th className="text-right">涨跌幅</th><th className="text-right">成交量</th><th className="px-2 text-right">跨期价差</th></tr></thead>
        <tbody>
          {(futs ?? []).flatMap((f) => f.points.map((p, i) => (
            <tr key={p.code} className="border-t border-[#0f1b29]">
              <td className="px-2 py-0.5 text-slate-200">{i === 0 ? f.name : ""}</td>
              <td className="font-mono text-slate-400">{p.code} · {p.month}</td>
              <td className="text-right font-mono text-white">{fmtPrice(p.price, 4)}</td>
              <td className="text-right font-mono" style={{ color: toneOf(p.change) }}>{p.change == null ? "—" : `${p.change > 0 ? "+" : ""}${p.change.toFixed(4)}`}</td>
              <td className="text-right font-mono" style={{ color: toneOf(p.changePct) }}>{f2(p.changePct, 2, "%")}</td>
              <td className="text-right font-mono text-slate-300">{fmtCompact(p.volume)}</td>
              <td className="px-2 text-right font-mono text-slate-400">{i > 0 ? (p.price - f.points[0].price).toFixed(4) : "—"}</td>
            </tr>
          )))}
          {!futs && <tr><td colSpan={7} className="px-2 py-6 text-slate-500">读取中…</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ 6 拍卖与资金面 */
function AuctionView({ auctions, mm }: { auctions: { upcoming: Auction[]; results: Auction[] } | null; mm: MM | null }) {
  const [kind, setKind] = useState("Note");
  const res = (auctions?.results ?? []).filter((a) => kind === "all" || a.type === kind);
  // 同品种同期限上一场的中标利率与认购倍数，用来衡量本场需求
  const prevOf = (a: Auction) => (auctions?.results ?? []).find((b) => b.type === a.type && b.term === a.term && b.auction < a.auction);
  const terms = [...new Set((auctions?.results ?? []).filter((a) => a.type === "Note" || a.type === "Bond").map((a) => a.term))];
  const tg = mm?.target;
  return (
    <div>
      <SectionHead title="即将拍卖" sub={`${auctions?.upcoming.length ?? 0} 场`} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">品种</th><th className="text-left">期限</th><th className="text-left">公告日</th><th className="text-left">发行日</th><th className="text-left">到期日</th><th className="px-2 text-right">发行额</th></tr></thead>
        <tbody>
          {(auctions?.upcoming ?? []).slice(0, 20).map((a) => <tr key={a.cusip + a.auction} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-amber-200">{a.auction}</td><td className="text-slate-300">{a.type}{a.tips ? " · TIPS" : a.frn ? " · 浮息" : ""}{a.reopening ? " · 续发" : ""}</td><td className="text-slate-200">{a.term}</td><td className="font-mono text-slate-500">{a.announce}</td><td className="font-mono text-slate-500">{a.issue}</td><td className="font-mono text-slate-500">{a.maturity}</td><td className="px-2 text-right font-mono">{a.offering ? fmtCompact(a.offering) : "待公告"}</td></tr>)}
          {!auctions && <tr><td colSpan={7} className="px-2 py-6 text-slate-500">读取中…</td></tr>}
        </tbody>
      </table>
      <SectionHead title="拍卖结果（近 120 天）" right={<Seg value={kind} onChange={setKind} options={[["Note", "中期国债"], ["Bond", "长期国债"], ["Bill", "国库券"], ["all", "全部"]]} />} />
      <div className="max-h-[360px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">拍卖日</th><th className="text-left">期限</th><th className="text-right">中标利率</th><th className="text-right">较上场</th><th className="text-right">认购倍数</th><th className="text-right">较上场</th><th className="text-right">直接</th><th className="text-right">间接</th><th className="text-right">交易商</th><th className="px-2 text-right">发行额</th></tr></thead>
          <tbody>
            {res.slice(0, 80).map((a) => {
              const p = prevOf(a);
              const y = a.highYield ?? a.highDiscount, py = p ? p.highYield ?? p.highDiscount : null;
              return (
                <tr key={a.cusip + a.auction} className="border-t border-[#0f1b29]">
                  <td className="px-2 py-0.5 font-mono text-slate-400">{a.auction}</td><td className="text-slate-200">{a.term}{a.reopening ? " 续" : ""}</td>
                  <td className="text-right font-mono text-white">{f2(y, 3, "%")}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(bp(y, py)) }}>{sbp(bp(y, py))}</td>
                  <td className="text-right font-mono">{f2(a.btc, 2)}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(a.btc != null && p?.btc != null ? a.btc - p.btc : null) }}>{a.btc != null && p?.btc != null ? `${a.btc - p.btc > 0 ? "+" : ""}${(a.btc - p.btc).toFixed(2)}` : "—"}</td>
                  <td className="text-right font-mono text-slate-400">{f2(a.direct, 1)}</td><td className="text-right font-mono text-slate-300">{f2(a.indirect, 1)}</td><td className="text-right font-mono" style={{ background: heat(a.dealer != null ? a.dealer - 15 : null, 20) }}>{f2(a.dealer, 1)}</td>
                  <td className="px-2 text-right font-mono text-slate-400">{fmtCompact(a.offering)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SectionHead title="中长期国债各期限认购倍数" />
      <Lines series={terms.slice(0, 6).map((t, i) => { const rs = (auctions?.results ?? []).filter((a) => a.term === t && (a.type === "Note" || a.type === "Bond")).slice().reverse(); return { name: t, color: ["#38bdf8", "#fbbf24", "#a78bfa", "#34d399", "#f472b6", "#fb923c"][i], values: rs.map((a) => a.btc) }; })} height={150} />
      <div className="px-2 text-[10px] text-slate-500">交易商被动承接比例偏高（红色）意味着终端需求不足；间接投标多为海外官方与资管机构。</div>
      <SectionHead title="资金面：隔夜利率与政策路径" sub={tg?.from != null ? `联邦基金目标区间 ${tg.from.toFixed(2)}–${tg.to?.toFixed(2)}%` : undefined} />
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">
        <div className="bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">利率</th><th className="text-left">日期</th><th className="text-right">最新</th><th className="text-right">5日变</th><th className="px-2 text-right">与目标上限</th></tr></thead>
            <tbody>{["SOFR", "EFFR", "TGCR", "BGCR", "OBFR"].map((k) => { const s = mm?.series[k] ?? []; const a = s[s.length - 1], b = s[s.length - 6]; if (!a) return null; return <tr key={k} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-semibold text-slate-200">{k}</td><td className="font-mono text-slate-500">{a.d}</td><td className="text-right font-mono text-white">{a.v.toFixed(2)}%</td><td className="text-right font-mono" style={{ color: toneOf(bp(a.v, b?.v)) }}>{sbp(bp(a.v, b?.v))}</td><td className="px-2 text-right font-mono">{tg?.to != null ? sbp(bp(a.v, tg.to)) : "—"}</td></tr>; })}</tbody>
          </table>
        </div>
        <div className="bg-[#03070c]">
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">联邦基金期货月</th><th className="text-right">隐含利率</th><th className="text-right">日变</th><th className="px-2 text-right">隐含调息（次）</th></tr></thead>
            <tbody>{(mm?.path ?? []).slice(0, 12).map((p) => <tr key={p.month} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-300">{p.month}</td><td className="text-right font-mono text-white">{p.rate.toFixed(3)}%</td><td className="text-right font-mono" style={{ color: toneOf(p.chg) }}>{p.chg == null ? "—" : `${(p.chg * 100).toFixed(1)}bp`}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(p.cuts != null ? -p.cuts : null) }}>{p.cuts == null ? "—" : p.cuts > 0.05 ? `降 ${p.cuts.toFixed(2)}` : p.cuts < -0.05 ? `加 ${(-p.cuts).toFixed(2)}` : "不变"}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 7 研判报告 */
function ReportView({ curves, sov, auctions, mm }: { curves: Curves | null; sov: Sov | null; auctions: { upcoming: Auction[]; results: Auction[] } | null; mm: MM | null }) {
  const [report, setReport] = useState("");
  const gen = trpc.derivatives.ai.generateRiskReport.useMutation();
  const t = useTicks(["^TNX", "^MOVE", "TLT", "HYG"]);
  const feed = useFeed({ cats: ["债券", "央行"], limit: 60, hours: 48 });
  const facts = useMemo(() => {
    const us = curves?.us ?? [];
    const now = us[0], m1 = us[Math.min(21, us.length - 1)];
    if (!now) return null;
    const y2 = pt(now, "2Y"), y10 = pt(now, "10Y"), y30 = pt(now, "30Y"), y3m = pt(now, "3M");
    const d2 = bp(y2, pt(m1, "2Y")), d10 = bp(y10, pt(m1, "10Y"));
    const shape = d2 != null && d10 != null ? (d2 > 0 && d10 > 0 ? (d2 > d10 ? "熊平" : "熊陡") : d2 < 0 && d10 < 0 ? (d2 < d10 ? "牛陡" : "牛平") : d10 > d2 ? "扭曲陡峭化" : "扭曲平坦化") : "—";
    const it = sov?.countries.find((c) => c.code === "IT"), fr = sov?.countries.find((c) => c.code === "FR");
    const notes = (auctions?.results ?? []).filter((a) => a.type === "Note" || a.type === "Bond").slice(0, 8);
    const btcAvg = notes.length ? mean(notes.map((a) => a.btc ?? 0)) : null;
    const dealerAvg = notes.length ? mean(notes.map((a) => a.dealer ?? 0)) : null;
    const lastPath = mm?.path[Math.min(11, (mm?.path.length ?? 1) - 1)];
    const eu10 = curves?.eu.find((p) => p.tenor === "10Y")?.value ?? null;
    return { date: now.date, y3m, y2, y10, y30, d2, d10, shape, s2s10: bp(y10, y2), s3m10: bp(y10, y3m), eu10, tsy_eu: bp(y10, eu10), it, fr, btcAvg, dealerAvg, cuts12: lastPath?.cuts ?? null, pathMonth: lastPath?.month ?? null };
  }, [curves, sov, auctions, mm]);

  const bullets = facts ? [
    `美债曲线（${facts.date}）：2 年 ${f2(facts.y2)}%、10 年 ${f2(facts.y10)}%、30 年 ${f2(facts.y30)}%；近一月 2 年 ${sbp(facts.d2)}bp、10 年 ${sbp(facts.d10)}bp，形态为「${facts.shape}」。`,
    `期限利差：2s10s ${sbp(facts.s2s10)}bp、3m10y ${sbp(facts.s3m10)}bp${facts.s3m10 != null && facts.s3m10 < 0 ? "，短端仍倒挂" : facts.s2s10 != null && facts.s2s10 > 0 ? "，曲线已恢复正斜率" : ""}。`,
    facts.eu10 != null ? `跨大西洋：欧元区 AAA 10 年 ${f2(facts.eu10)}%，美债较其高 ${sbp(facts.tsy_eu)}bp。` : null,
    facts.it ? `欧元区外围：意大利对德利差 ${facts.it.spread}bp（12 个月 ${sbp(facts.it.spread != null && facts.it.spread12m != null ? facts.it.spread - facts.it.spread12m : null)}bp）${facts.fr ? `，法国 ${facts.fr.spread}bp（12 个月 ${sbp(facts.fr.spread != null && facts.fr.spread12m != null ? facts.fr.spread - facts.fr.spread12m : null)}bp）` : ""}。` : null,
    facts.btcAvg != null ? `供给与需求：最近 8 场中长期国债拍卖平均认购倍数 ${facts.btcAvg.toFixed(2)}，交易商承接 ${facts.dealerAvg?.toFixed(1)}%。` : null,
    facts.cuts12 != null ? `政策预期：联邦基金期货隐含至 ${facts.pathMonth} 累计${facts.cuts12 >= 0 ? `降息 ${facts.cuts12.toFixed(2)}` : `加息 ${(-facts.cuts12).toFixed(2)}`} 次（每次 25bp）。` : null,
    t["^MOVE"]?.price != null ? `波动：美债期权隐含波动率指数 ${fmtPrice(t["^MOVE"].price)}（日变 ${f2(t["^MOVE"].changePct, 2, "%")}）。` : null,
  ].filter((x): x is string => !!x) : [];

  const run = async () => {
    if (!facts) return;
    try {
      const r = await gen.mutateAsync({
        module: "WB",
        moduleName: "全球债券市场",
        metrics: Object.fromEntries(Object.entries({
          曲线日期: facts.date, 美债3M: facts.y3m, 美债2Y: facts.y2, 美债10Y: facts.y10, 美债30Y: facts.y30, 近一月2Y变动bp: facts.d2, 近一月10Y变动bp: facts.d10, 曲线形态: facts.shape,
          利差2s10s_bp: facts.s2s10, 利差3m10y_bp: facts.s3m10, 欧元区AAA10Y: facts.eu10, 美欧10Y利差bp: facts.tsy_eu,
          意大利对德利差bp: facts.it?.spread ?? null, 法国对德利差bp: facts.fr?.spread ?? null, 中长期拍卖平均认购倍数: facts.btcAvg != null ? +facts.btcAvg.toFixed(2) : null,
          交易商承接比例: facts.dealerAvg != null ? +facts.dealerAvg.toFixed(1) : null, 隐含调息次数: facts.cuts12, MOVE: t["^MOVE"]?.price ?? null, TLT涨跌幅: t.TLT?.changePct ?? null, HYG涨跌幅: t.HYG?.changePct ?? null,
        }).filter(([, v]) => v != null)) as Record<string, string | number>,
      });
      setReport(typeof r.report === "string" ? r.report : JSON.stringify(r.report));
    } catch {
      toast.error("报告生成失败，请重试");
    }
  };
  const exportTxt = () => {
    const content = `全球债券市场研判\n生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}\n\n要点：\n${bullets.map((b) => `· ${b}`).join("\n")}\n\n${report}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `全球债券研判_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="bg-[#03070c]">
        <SectionHead title="数据要点（自动计算）" right={<span className="flex gap-2"><button type="button" onClick={() => void run()} disabled={!facts || gen.isPending} className="border border-violet-700 px-2 text-[11px] text-violet-200 disabled:opacity-40">{gen.isPending ? "生成中…" : "生成研判报告"}</button><button type="button" onClick={exportTxt} disabled={!facts} className="border border-[#1d3047] px-2 text-[11px] text-slate-300 disabled:opacity-40">导出文本</button></span>} />
        {facts ? <ul className="space-y-1 px-3 py-1 text-[12px] leading-relaxed text-slate-200">{bullets.map((b) => <li key={b}>· {b}</li>)}</ul> : <div className="px-3 py-6 text-[11px] text-slate-500">读取中…</div>}
        {report && <div className="m-2 whitespace-pre-wrap border border-violet-900/50 bg-[#0a0716] p-3 text-[12px] leading-relaxed text-slate-200">{report}</div>}
        {!report && <div className="px-3 py-2 text-[10px] text-slate-500">“生成研判报告”会把上述实时计算指标交给智能分析生成文字研判，仅供参考。</div>}
      </div>
      <div className="bg-[#03070c]">
        <SectionHead title="债券与央行快讯（48 小时）" />
        <div className="max-h-[560px] overflow-y-auto"><FeedList items={feed.items} loading={feed.loading} dense /></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 主组件 */
export default function BondMarketLive() {
  const [func, setFunc] = useState("ytm-matrix");
  const curves = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const sov = usePolled<Sov>("ucHubs.sovereign", ["ytm-matrix", "scatter", "ai-report"].includes(func) ? {} : null, 3600_000);
  const futs = usePolled<Fut[]>("ucHubs.futuresMany", func === "yield-curves" ? { roots: ["ZT", "ZF", "ZN", "ZB", "UB"] } : null, 60_000);
  const auctions = usePolled<{ upcoming: Auction[]; results: Auction[] }>("ucHubs.auctions", ["auction", "ai-report"].includes(func) ? {} : null, 900_000);
  const mm = usePolled<MM>("ucHubs.moneyMarket", ["auction", "ai-report"].includes(func) ? {} : null, 600_000);
  const tnx = useTicks(["^TNX"])["^TNX"];
  const now = curves.data?.us[0];
  return (
    <HubShell
      title="全球债券市场"
      code="WB"
      funcs={FUNCS}
      func={func}
      setFunc={setFunc}
      right={
        <span className="flex items-center gap-3 font-mono">
          {now && <span>曲线 {now.date}</span>}
          {now && <span>2s10s <b className="text-white">{sbp(bp(pt(now, "10Y"), pt(now, "2Y")))}bp</b></span>}
          {tnx && <span>10年 <b style={{ color: toneOf(tnx.change) }}>{fmtPrice(tnx.price)}</b></span>}
        </span>
      }
    >
      {func === "ytm-matrix" && <Matrix curves={curves.data} sov={sov.data} />}
      {func === "yield-curves" && <CurvesView curves={curves.data} futs={futs.data} />}
      {func === "gnn" && <Linkage />}
      {func === "optimizer" && <Optimizer />}
      {func === "scatter" && <RelValue sov={sov.data} />}
      {func === "auction" && <AuctionView auctions={auctions.data} mm={mm.data} />}
      {func === "ai-report" && <ReportView curves={curves.data} sov={sov.data} auctions={auctions.data} mm={mm.data} />}
    </HubShell>
  );
}
