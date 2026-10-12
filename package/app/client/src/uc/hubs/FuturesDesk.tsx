/**
 * 期货类页面：
 *  - CommodityTerminal（/glco、/commodity-prices）：全品种主力看板 · 期限结构（升贴水）· 商品机构持仓（管理基金净头寸）· 商品新闻
 *  - MetalsDesk（/precious-metals）：贵金属与矿业股 · 比价（金银比 / 金铜比 / 金油比）· 多币种金价 · 期限结构 · 持仓 · 新闻
 *  - BondFuturesDesk（/wbf）：美债期货各合约 · SOFR / 联邦基金期货条 · 国债期货机构持仓
 * 数据全部实时拉取；点击任一行在右侧看实时 K 线。
 */
import { useMemo, useState } from "react";
import { DOWN, UP, fmtCompact, fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, Spark, useFeed } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, useHub, type BoardRow } from "./kit";
import { CotView } from "./FxTerminal";
import { align, f2, perf, sgn, useCloses } from "./calc";

export type Curve = { root: string; name: string; unit: string; structure: string; slopePct: number | null; points: Array<{ code: string; month: string; price: number; prev: number | null; change: number | null; changePct: number | null; volume: number | null }> };
type CotRow = { key: string; name: string; date: string; oi: number; oiChg: number; mmLong: number; mmShort: number; mmNet: number; mmNetChg: number; mmNetPctOi: number; pmNet: number; swapNet: number; pmNetChg: number; swapNetChg: number; mmSpread: number; hist: Array<{ d: string; v: number }> };

const fmtFut = (v: number | null | undefined) => fmtPrice(v);

/** 单个品种的期限结构图 + 合约表 */
export function TermStructure({ curve, compact }: { curve: Curve | null | undefined; compact?: boolean }) {
  const { pick } = useHub();
  if (!curve) return <div className="px-3 py-6 text-[11px] text-slate-500">读取中…</div>;
  const pts = curve.points;
  if (!pts.length) return <div className="px-3 py-6 text-[11px] text-slate-500">{curve.name}：暂无可交易合约报价</div>;
  const vals = pts.map((p) => p.price);
  const prevs = pts.map((p) => p.prev).filter((v): v is number => v != null);
  const lo = Math.min(...vals, ...prevs), hi = Math.max(...vals, ...prevs);
  const W = 520, H = compact ? 120 : 190, L = 46;
  const x = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (W - L - 12);
  const y = (v: number) => 8 + ((hi - v) / Math.max(1e-9, hi - lo)) * (H - 30);
  const slopeTone = curve.slopePct == null ? "#94a3b8" : curve.slopePct > 0 ? "#fbbf24" : "#38bdf8";
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 px-2 pt-1 text-[11px]">
        <b className="text-white">{curve.name}</b><span className="font-mono text-[10px] text-slate-500">{curve.root} · {curve.unit}</span>
        <span className="ml-auto text-[10px]" style={{ color: slopeTone }}>{curve.structure}{curve.slopePct != null ? ` ${sgn(curve.slopePct)}` : ""}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, 0.5, 1].map((f) => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#132233" /><text x={2} y={y(v) + 3} fontSize={9} fill="#5f7891">{fmtFut(v)}</text></g>; })}
        <polyline points={pts.filter((p) => p.prev != null).map((p) => `${x(pts.indexOf(p))},${y(p.prev!)}`).join(" ")} fill="none" stroke="#475569" strokeDasharray="3 3" strokeWidth={1} />
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.price)}`).join(" ")} fill="none" stroke={slopeTone} strokeWidth={1.8} />
        {pts.map((p, i) => <g key={p.code}><circle cx={x(i)} cy={y(p.price)} r={2.4} fill={toneOf(p.changePct)} /><text x={x(i)} y={H - 4} fontSize={8.5} textAnchor="middle" fill="#7d93a8">{p.month.slice(2).replace("-", "/")}</text></g>)}
      </svg>
      {!compact && (
        <table className="w-full text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">合约</th><th className="text-left">交割月</th><th className="text-right">最新</th><th className="text-right">涨跌幅</th><th className="text-right">较近月</th><th className="text-right">年化价差</th><th className="px-2 text-right">成交量</th></tr></thead>
          <tbody>
            {pts.map((p, i) => {
              const base = pts[0].price;
              const spread = i ? ((p.price - base) / base) * 100 : null;
              const months = i ? (Date.parse(`${p.month}-15`) - Date.parse(`${pts[0].month}-15`)) / (30.4 * 86400_000) : 0;
              const ann = spread != null && months > 0 ? (spread / months) * 12 : null;
              return (
                <tr key={p.code} className="border-t border-[#0f1b29] hover:bg-[#0a1726]">
                  <td className="px-2 py-0.5 font-mono text-slate-200">{p.code}</td><td className="text-slate-400">{p.month}</td>
                  <td className="text-right font-mono text-white">{fmtFut(p.price)}</td>
                  <td className="text-right font-mono" style={{ color: toneOf(p.changePct) }}>{fmtPct(p.changePct)}</td>
                  <td className="text-right font-mono text-slate-300">{spread == null ? "近月" : sgn(spread)}</td>
                  <td className="text-right font-mono" style={{ color: ann == null ? undefined : ann > 0 ? "#fbbf24" : "#38bdf8" }}>{ann == null ? "—" : sgn(ann, 1)}</td>
                  <td className="px-2 text-right font-mono text-slate-400">{fmtCompact(p.volume)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!compact && <div className="px-2 py-1 text-[10px] text-slate-500">实线为最新期限结构，虚线为前一交易日。远月高于近月（升水）通常反映库存充裕或持有成本；近月高于远月（贴水）通常反映现货偏紧。<button type="button" className="ml-2 text-cyan-300 hover:underline" onClick={() => pick(`${curve.root}=F`)}>主力K线 ›</button></div>}
    </div>
  );
}

/** 期限结构总览：多品种小图 + 升贴水排行 */
function CurveGrid({ roots }: { roots: string[] }) {
  const [sel, setSel] = useState(roots[0]);
  const many = usePolled<Curve[]>("ucHubs.futuresMany", { roots }, 120_000);
  const list = many.data ?? [];
  const cur = list.find((c) => c.root === sel);
  const ranked = [...list].filter((c) => c.slopePct != null).sort((a, b) => (b.slopePct ?? 0) - (a.slopePct ?? 0));
  return (
    <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 bg-[#03070c]">
        <SectionHead title="期限结构" sub={many.loading && !list.length ? "读取各合约报价…" : `${list.length} 个品种`} right={<select value={sel} onChange={(e) => setSel(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-[11px] text-slate-200">{roots.map((r) => <option key={r} value={r}>{list.find((c) => c.root === r)?.name ?? r}</option>)}</select>} />
        <TermStructure curve={cur ?? (many.data ? { root: sel, name: sel, unit: "", structure: "—", slopePct: null, points: [] } : null)} />
      </div>
      <div className="min-w-0 bg-[#03070c]">
        <SectionHead title="升贴水排行（最远合约相对近月）" />
        <Bars data={ranked.map((c) => ({ k: c.name.replace(/\s/g, ""), v: c.slopePct ?? 0 }))} fmt={(v) => `${v.toFixed(1)}%`} height={150} />
        <table className="w-full text-[11px]">
          <tbody>
            {ranked.map((c) => (
              <tr key={c.root} onClick={() => setSel(c.root)} className={`cursor-pointer border-t border-[#0f1b29] ${sel === c.root ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                <td className="px-2 py-0.5 text-slate-200">{c.name}</td>
                <td className="text-right font-mono text-white">{fmtFut(c.points[0]?.price)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(c.points[0]?.changePct) }}>{fmtPct(c.points[0]?.changePct)}</td>
                <td className="text-right text-[10px] text-slate-400">{c.structure.replace(/（.*）/, "")}</td>
                <td className="px-2 text-right font-mono" style={{ color: (c.slopePct ?? 0) > 0 ? "#fbbf24" : "#38bdf8" }}>{sgn(c.slopePct, 1)}</td>
                <td className="px-2"><TermStructureSpark c={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const TermStructureSpark = ({ c }: { c: Curve }) => <Spark values={c.points.map((p) => p.price)} width={80} height={16} color={(c.slopePct ?? 0) > 0 ? "#fbbf24" : "#38bdf8"} />;

/** 商品机构持仓（分类报告：管理基金 / 生产商 / 互换商） */
export function CotCommodity({ keys }: { keys?: string[] }) {
  const cot = usePolled<{ rows: CotRow[] }>("ucHubs.cotCommodities", {}, 3600_000);
  const rows = (cot.data?.rows ?? []).filter((r) => !keys || keys.includes(r.key));
  const [sel, setSel] = useState<string | null>(null);
  const cur = rows.find((r) => r.key === sel) ?? rows[0];
  return (
    <div>
      <SectionHead title="商品机构持仓（期货，周度）" sub={rows[0] ? `报告日 ${rows[0].date} · 管理基金 = 对冲基金/CTA 等投机资金` : cot.loading ? "读取中…" : "暂无"} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[11px]">
          <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">品种</th><th className="text-right">持仓量</th><th className="text-right">周变动</th><th className="text-right">管理基金多</th><th className="text-right">管理基金空</th><th className="text-right">净头寸</th><th className="text-right">净头寸周变</th><th className="text-right">净/持仓</th><th className="text-right">生产商净</th><th className="text-right">互换商净</th><th className="px-2">净头寸走势</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} onClick={() => setSel(r.key)} className={`cursor-pointer border-t border-[#0f1b29] ${cur?.key === r.key ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
                <td className="px-2 py-0.5 text-slate-100">{r.name}</td>
                <td className="text-right font-mono text-slate-300">{fmtCompact(r.oi)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.oiChg) }}>{r.oiChg > 0 ? "+" : ""}{fmtCompact(r.oiChg)}</td>
                <td className="text-right font-mono text-red-300">{fmtCompact(r.mmLong)}</td>
                <td className="text-right font-mono text-emerald-300">{fmtCompact(r.mmShort)}</td>
                <td className="text-right font-mono font-semibold" style={{ color: r.mmNet >= 0 ? UP : DOWN }}>{r.mmNet > 0 ? "+" : ""}{fmtCompact(r.mmNet)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.mmNetChg) }}>{r.mmNetChg > 0 ? "+" : ""}{fmtCompact(r.mmNetChg)}</td>
                <td className="text-right font-mono text-slate-300">{f2(r.mmNetPctOi, 1, "%")}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.pmNet) }}>{fmtCompact(r.pmNet)}</td>
                <td className="text-right font-mono" style={{ color: toneOf(r.swapNet) }}>{fmtCompact(r.swapNet)}</td>
                <td className="px-2">{r.hist.length > 1 ? <Spark values={r.hist.map((h) => h.v)} width={90} height={16} color={r.mmNet >= 0 ? UP : DOWN} /> : <span className="text-[9px] text-slate-600">逐周累积</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cur && (
        <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
          <div className="bg-[#03070c]"><SectionHead title={`${cur.name}：各类机构净头寸`} /><Bars data={[{ k: "管理基金", v: cur.mmNet }, { k: "生产商", v: cur.pmNet }, { k: "互换商", v: cur.swapNet }]} height={130} /></div>
          <div className="bg-[#03070c]"><SectionHead title={`${cur.name}：本周变化`} /><Bars data={[{ k: "管理基金", v: cur.mmNetChg }, { k: "生产商", v: cur.pmNetChg }, { k: "互换商", v: cur.swapNetChg }, { k: "持仓量", v: cur.oiChg }]} height={130} /></div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== 商品终端 */
const COMM_BOARD: BoardRow[] = [
  ...[["CL", "WTI 原油"], ["BRENT", "布伦特原油"], ["NG", "天然气"], ["RB=F", "RBOB 汽油"], ["HO=F", "取暖油"]].map(([s, l]) => ({ symbol: s, label: l, group: "能源" })),
  ...[["GC", "黄金"], ["SI", "白银"], ["PL", "铂金"], ["PA=F", "钯金"], ["HG", "铜"], ["ALI=F", "铝"]].map(([s, l]) => ({ symbol: s, label: l, group: "金属" })),
  ...[["ZC", "玉米"], ["ZS", "大豆"], ["ZW", "小麦"], ["ZM=F", "豆粕"], ["ZL=F", "豆油"], ["ZO=F", "燕麦"], ["ZR=F", "稻米"]].map(([s, l]) => ({ symbol: s, label: l, group: "谷物与油籽" })),
  ...[["KC=F", "咖啡"], ["SB=F", "原糖"], ["CC=F", "可可"], ["CT=F", "棉花"], ["OJ=F", "橙汁"], ["LBS=F", "木材"]].map(([s, l]) => ({ symbol: s, label: l, group: "软商品" })),
  ...[["LE=F", "活牛"], ["GF=F", "饲牛"], ["HE=F", "瘦肉猪"]].map(([s, l]) => ({ symbol: s, label: l, group: "畜产品" })),
  ...[["DBC", "综合商品 ETF"], ["GSG", "高盛商品指数 ETF"], ["USO", "原油 ETF"], ["UNG", "天然气 ETF"], ["DBA", "农产品 ETF"], ["CPER", "铜 ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "商品 ETF" })),
];
const COMM_ROOTS = ["CL", "BZ", "NG", "RB", "HO", "GC", "SI", "HG", "PL", "ZC", "ZS", "ZW", "KC", "SB", "CC", "CT", "LE", "HE"];
const PERF_SYMS: Array<[string, string]> = [["CL", "WTI"], ["BRENT", "布油"], ["NG", "天然气"], ["GC", "黄金"], ["SI", "白银"], ["HG", "铜"], ["PL", "铂金"], ["ZC", "玉米"], ["ZS", "大豆"], ["ZW", "小麦"], ["KC=F", "咖啡"], ["SB=F", "原糖"], ["CC=F", "可可"], ["CT=F", "棉花"], ["LE=F", "活牛"], ["HE=F", "瘦肉猪"]];

function PerfMatrix({ syms }: { syms: Array<[string, string]> }) {
  const pack = useCloses(syms.map(([s]) => s), 400);
  const ticks = useTicks(syms.map(([s]) => s));
  const { pick } = useHub();
  const rows = useMemo(() => syms.map(([s, l]) => {
    const c = (pack.data?.[s] ?? []).map((x) => x[1]);
    const hi = c.length ? Math.max(...c.slice(-252)) : null, lo = c.length ? Math.min(...c.slice(-252)) : null;
    const px = ticks[s]?.price ?? c[c.length - 1];
    return { s, l, d1: ticks[s]?.changePct ?? null, w1: perf(c, 5), m1: perf(c, 21), m3: perf(c, 63), m6: perf(c, 126), y1: perf(c, 252), pos: hi && lo && px ? ((px - lo) / Math.max(1e-9, hi - lo)) * 100 : null };
  }), [pack.data, ticks, syms]);
  const cell = (v: number | null, scale: number) => <td className="text-right font-mono" style={{ background: v == null ? undefined : v > 0 ? `rgba(242,73,92,${0.08 + Math.min(1, Math.abs(v) / scale) * 0.5})` : `rgba(31,191,117,${0.08 + Math.min(1, Math.abs(v) / scale) * 0.5})`, color: "#f1f5f9" }}>{sgn(v, 1)}</td>;
  return (
    <div>
      <SectionHead title="区间涨跌与 52 周位置" sub={pack.loading && !pack.data ? "读取日线…" : "按日线计算，今日为实时"} />
      <table className="w-full text-[11px]">
        <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">品种</th><th className="text-right">今日</th><th className="text-right">1周</th><th className="text-right">1月</th><th className="text-right">3月</th><th className="text-right">6月</th><th className="text-right">1年</th><th className="px-2 text-left">52周区间位置</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.s} onClick={() => pick(r.s)} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
              <td className="px-2 py-0.5 text-slate-100">{r.l}</td>{cell(r.d1, 4)}{cell(r.w1, 8)}{cell(r.m1, 15)}{cell(r.m3, 25)}{cell(r.m6, 35)}{cell(r.y1, 50)}
              <td className="px-2"><div className="relative h-2 w-28 bg-[#0f1b29]"><div className="absolute top-0 h-2 w-1 bg-cyan-300" style={{ left: `${Math.max(0, Math.min(100, r.pos ?? 0))}%` }} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommodityTerminal({ initial = "board" }: { initial?: string }) {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? initial);
  const feed = useFeed(func === "news" ? { cats: ["商品", "能源"], limit: 150, hours: 72 } : null);
  const t = useTicks(["CL", "GC", "HG"]);
  return (
    <HubShell title="全球商品" code="GLCO" func={func} setFunc={setFunc}
      funcs={[["board", "CMDTY", "全品种行情"], ["perf", "CPRF", "区间表现"], ["curve", "CRV", "期限结构"], ["cot", "COTD", "机构持仓"], ["news", "CN", "商品新闻"]]}
      right={<span>原油 <b className="font-mono" style={{ color: toneOf(t.CL?.changePct) }}>{fmtPrice(t.CL?.price)}</b> · 黄金 <b className="font-mono" style={{ color: toneOf(t.GC?.changePct) }}>{fmtPrice(t.GC?.price)}</b> · 铜 <b className="font-mono" style={{ color: toneOf(t.HG?.changePct) }}>{fmtPrice(t.HG?.price)}</b></span>}>
      {func === "board" && <LiveBoard rows={COMM_BOARD} />}
      {func === "perf" && <PerfMatrix syms={PERF_SYMS} />}
      {func === "curve" && <CurveGrid roots={COMM_ROOTS} />}
      {func === "cot" && <CotCommodity />}
      {func === "news" && <><SectionHead title="商品与能源新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}

/* ================================================================== 贵金属 */
const METAL_BOARD: BoardRow[] = [
  ...[["GC", "COMEX 黄金"], ["SI", "COMEX 白银"], ["PL", "铂金"], ["PA=F", "钯金"], ["HG", "铜"]].map(([s, l]) => ({ symbol: s, label: l, group: "期货主力" })),
  ...[["GLD", "黄金 ETF"], ["IAU", "黄金 ETF（低费率）"], ["SLV", "白银 ETF"], ["PPLT", "铂金 ETF"], ["sh518880", "华安黄金 ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "实物 ETF" })),
  ...[["GDX", "金矿股 ETF"], ["GDXJ", "小型金矿股 ETF"], ["SIL", "银矿股 ETF"], ["NEM", "纽蒙特"], ["AEM", "伊格尔矿业"], ["GOLD", "巴里克"], ["WPM", "惠顿贵金属"], ["2899.HK", "紫金矿业"], ["sh600547", "山东黄金"], ["sh600489", "中金黄金"]].map(([s, l]) => ({ symbol: s, label: l, group: "矿业股" })),
];
function Ratios() {
  const syms = ["GC", "SI", "HG", "CL", "PL", "SPY"];
  const pack = useCloses(syms, 760);
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const [range, setRange] = useState("500");
  const n = Number(range);
  const R = (a: string, b: string, k = 1) => (m[a] ?? []).map((v, i) => (m[b]?.[i] ? (v / m[b][i]) * k : null)).slice(-n);
  const defs: Array<[string, string, Array<number | null>, string]> = [
    ["金银比", "#fbbf24", R("GC", "SI"), "历史均值约 60–70；高位意味白银相对便宜"],
    ["金铂比", "#a78bfa", R("GC", "PL"), "铂金工业属性强，比值走高反映避险压过工业需求"],
    ["金铜比", "#f472b6", R("GC", "HG"), "常被视为经济预期的反向指标，与美债长端收益率走势相反"],
    ["金油比", "#38bdf8", R("GC", "CL"), "上升代表避险需求强于增长需求"],
    ["金价/标普", "#34d399", R("GC", "SPY", 1), "黄金相对股票的强弱"],
  ];
  return (
    <div>
      <SectionHead title="贵金属比价" right={<Seg value={range} onChange={setRange} options={[["63", "3月"], ["126", "半年"], ["250", "1年"], ["500", "2年"]]} />} />
      <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-2">
        {defs.map(([name, color, vals, note]) => {
          const v = vals.filter((x): x is number => x != null);
          const last = v[v.length - 1], avg = v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
          const pct = v.length ? (v.filter((x) => x <= last).length / v.length) * 100 : null;
          return (
            <div key={name} className="bg-[#03070c]">
              <div className="flex items-baseline gap-2 px-2 pt-1 text-[11px]"><b className="text-white">{name}</b><span className="font-mono text-[14px]" style={{ color }}>{f2(last, 2)}</span><span className="text-[10px] text-slate-500">区间均值 {f2(avg, 2)} · 分位 {f2(pct, 0, "%")}</span></div>
              <Lines series={[{ name, color, values: vals }]} xLabels={dates.slice(-n).map((d) => d.slice(2))} height={130} />
              <div className="px-2 pb-1 text-[10px] text-slate-500">{note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function GoldFx() {
  const t = useTicks(["GC", "EURUSD", "USDJPY", "GBPUSD", "USDCNH", "USDCHF", "AUDUSD", "USDINR", "USDTRY"]);
  const g = t.GC?.price;
  const rows: Array<[string, string, number | null, number | null]> = [
    ["美元", "USD/盎司", g ?? null, t.GC?.changePct ?? null],
    ["欧元", "EUR/盎司", g && t.EURUSD?.price ? g / t.EURUSD.price : null, t.GC?.changePct != null && t.EURUSD?.changePct != null ? t.GC.changePct - t.EURUSD.changePct : null],
    ["日元", "JPY/盎司", g && t.USDJPY?.price ? g * t.USDJPY.price : null, t.GC?.changePct != null && t.USDJPY?.changePct != null ? t.GC.changePct + t.USDJPY.changePct : null],
    ["英镑", "GBP/盎司", g && t.GBPUSD?.price ? g / t.GBPUSD.price : null, t.GC?.changePct != null && t.GBPUSD?.changePct != null ? t.GC.changePct - t.GBPUSD.changePct : null],
    ["人民币", "CNY/克", g && t.USDCNH?.price ? (g * t.USDCNH.price) / 31.1035 : null, t.GC?.changePct != null && t.USDCNH?.changePct != null ? t.GC.changePct + t.USDCNH.changePct : null],
    ["瑞郎", "CHF/盎司", g && t.USDCHF?.price ? g * t.USDCHF.price : null, t.GC?.changePct != null && t.USDCHF?.changePct != null ? t.GC.changePct + t.USDCHF.changePct : null],
    ["澳元", "AUD/盎司", g && t.AUDUSD?.price ? g / t.AUDUSD.price : null, t.GC?.changePct != null && t.AUDUSD?.changePct != null ? t.GC.changePct - t.AUDUSD.changePct : null],
    ["印度卢比", "INR/10克", g && t.USDINR?.price ? (g * t.USDINR.price * 10) / 31.1035 : null, t.GC?.changePct != null && t.USDINR?.changePct != null ? t.GC.changePct + t.USDINR.changePct : null],
    ["土耳其里拉", "TRY/克", g && t.USDTRY?.price ? (g * t.USDTRY.price) / 31.1035 : null, t.GC?.changePct != null && t.USDTRY?.changePct != null ? t.GC.changePct + t.USDTRY.changePct : null],
  ];
  return (
    <div>
      <SectionHead title="多币种金价（实时换算）" sub="由 COMEX 黄金与实时汇率计算；涨跌为本币计价的近似变化" />
      <table className="w-full text-[11px]">
        <tbody>{rows.map(([c, u, v, chg]) => <tr key={c} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-100">{c}</td><td className="text-[10px] text-slate-500">{u}</td><td className="text-right font-mono text-white">{v == null ? "—" : v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(chg) }}>{fmtPct(chg)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
export function MetalsDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "board");
  const curves = usePolled<Curve[]>("ucHubs.futuresMany", func === "curve" ? { roots: ["GC", "SI", "PL", "PA", "HG"] } : null, 120_000);
  const feed = useFeed(func === "news" ? { q: "gold OR silver OR 黄金 OR 白银 OR 贵金属 OR platinum", limit: 150, hours: 96 } : null);
  const t = useTicks(["GC", "SI"]);
  const gs = t.GC?.price && t.SI?.price ? t.GC.price / t.SI.price : null;
  return (
    <HubShell title="贵金属" code="PMET" func={func} setFunc={setFunc}
      funcs={[["board", "XAU", "行情与矿业股"], ["ratio", "RATIO", "比价分析"], ["fx", "XAUFX", "多币种金价"], ["curve", "CRV", "期限结构"], ["cot", "COTD", "机构持仓"], ["news", "GN", "贵金属新闻"]]}
      right={<span>黄金 <b className="font-mono" style={{ color: toneOf(t.GC?.changePct) }}>{fmtPrice(t.GC?.price)}</b> · 金银比 <b className="font-mono text-amber-200">{f2(gs, 2)}</b></span>}>
      {func === "board" && <LiveBoard rows={METAL_BOARD} />}
      {func === "ratio" && <Ratios />}
      {func === "fx" && <GoldFx />}
      {func === "curve" && <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">{(curves.data ?? []).map((c) => <div key={c.root} className="bg-[#03070c]"><TermStructure curve={c} /></div>)}{!curves.data && <div className="bg-[#03070c] px-3 py-6 text-[11px] text-slate-500">读取各合约…</div>}</div>}
      {func === "cot" && <CotCommodity keys={["GC", "SI", "PL", "PA", "HG"]} />}
      {func === "news" && <><SectionHead title="贵金属新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}

/* ================================================================== 全球债券期货 */
const BF_BOARD: BoardRow[] = [
  ...[["ZT", "2 年美债期货"], ["ZF=F", "5 年美债期货"], ["ZN", "10 年美债期货"], ["TN=F", "超 10 年美债期货"], ["ZB=F", "30 年美债期货"], ["UB=F", "超长美债期货"]].map(([s, l]) => ({ symbol: s, label: l, group: "美国国债期货" })),
  ...[["SR3=F", "3 个月 SOFR 期货"], ["ZQ=F", "联邦基金期货"]].map(([s, l]) => ({ symbol: s, label: l, group: "短期利率期货" })),
  ...[["^IRX", "13 周美债收益率"], ["^FVX", "5 年美债收益率"], ["^TNX", "10 年美债收益率"], ["^TYX", "30 年美债收益率"], ["^MOVE", "美债波动率"]].map(([s, l]) => ({ symbol: s, label: l, group: "对应收益率" })),
];
export function BondFuturesDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "board");
  const tsy = usePolled<Curve[]>("ucHubs.futuresMany", func === "roll" ? { roots: ["ZT", "ZF", "ZN", "ZB", "UB"] } : null, 120_000);
  const stir = usePolled<Curve[]>("ucHubs.futuresMany", func === "stir" ? { roots: ["SR3", "ZQ"] } : null, 120_000);
  const t = useTicks(["ZN", "^TNX"]);
  return (
    <HubShell title="全球债券期货" code="WBF" func={func} setFunc={setFunc}
      funcs={[["board", "WBF", "期货看板"], ["roll", "ROLL", "移仓价差"], ["stir", "STIR", "短期利率期货条"], ["cot", "COT", "机构持仓"]]}
      right={<span>10 年期货 <b className="font-mono" style={{ color: toneOf(t.ZN?.changePct) }}>{fmtPrice(t.ZN?.price)}</b> · 10Y <b className="font-mono text-white">{fmtPrice(t["^TNX"]?.price)}%</b></span>}>
      {func === "board" && <LiveBoard rows={BF_BOARD} />}
      {func === "roll" && (
        <div>
          <SectionHead title="各期限国债期货：近月 / 次月 / 远月" sub="正值意味移仓需付出升水" />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">品种</th><th className="text-left">近月</th><th className="text-right">价格</th><th className="text-left">次月</th><th className="text-right">价格</th><th className="text-right">移仓价差</th><th className="text-right">涨跌幅</th><th className="px-2 text-right">成交量（近/次）</th></tr></thead>
            <tbody>
              {(tsy.data ?? []).map((c) => { const a = c.points[0], b = c.points[1]; return (
                <tr key={c.root} className="border-t border-[#0f1b29]"><td className="px-2 py-1 text-slate-100">{c.name}</td><td className="font-mono text-slate-400">{a?.code ?? "—"}</td><td className="text-right font-mono text-white">{fmtPrice(a?.price)}</td><td className="font-mono text-slate-400">{b?.code ?? "—"}</td><td className="text-right font-mono text-white">{fmtPrice(b?.price)}</td><td className="text-right font-mono" style={{ color: toneOf(a && b ? b.price - a.price : null) }}>{a && b ? (b.price - a.price).toFixed(4) : "—"}</td><td className="text-right font-mono" style={{ color: toneOf(a?.changePct) }}>{fmtPct(a?.changePct)}</td><td className="px-2 text-right font-mono text-slate-400">{fmtCompact(a?.volume)} / {fmtCompact(b?.volume)}</td></tr>
              ); })}
              {!tsy.data && <tr><td colSpan={8} className="px-2 py-6 text-slate-500">读取各合约…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {func === "stir" && <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-2">{(stir.data ?? []).map((c) => <div key={c.root} className="bg-[#03070c]"><TermStructure curve={c} /><div className="px-2 pb-2 text-[10px] text-slate-400">隐含利率 = 100 − 价格：{c.points.slice(0, 8).map((p) => `${p.month.slice(2)} ${(100 - p.price).toFixed(2)}%`).join(" · ")}</div></div>)}</div>}
      {func === "cot" && <CotView filter={(x) => ["ZT", "ZF", "ZN", "ZB", "TN", "UB", "SR3", "ZQ"].includes(x)} />}
    </HubShell>
  );
}
