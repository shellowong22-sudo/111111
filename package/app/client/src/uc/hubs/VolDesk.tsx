/**
 * 波动率与期权类页面：
 *  - VolScanner（/vca）：隐含波动率扫描（30 日隐波 / 实现波动率 / 隐波−实波 / 平台自有历史的隐波分位）· 波动率锥 · 波动率指数族
 *  - FxVolDesk（/wvol）：外汇实现波动率矩阵与波动率锥 · 外汇 ETF 期权隐含波动率 · 外汇波动率走势
 *  - FxOptionDesk（/ovml）：外汇 / 商品期权估值（Garman-Kohlhagen / Black-76，现价与利率实时代入）· 行权价阶梯 · 情景损益
 *  - DerivNewsDesk（/ni-drv）：衍生品与波动率新闻
 */
import { useMemo, useState } from "react";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { FeedList, SectionHead, Seg, useFeed } from "@/uc/news/kit";
import { Bars, HubShell, LiveBoard, Lines, useHub, type BoardRow } from "./kit";
import { align, f2, gbs, heat, rollingVol, sgn, useCloses } from "./calc";

type IvRow = { symbol: string; price: number | null; changePct: number | null; iv30: number | null; iv30Chg: number | null; rv20: number | null; rv60: number | null; rv120: number | null; ivRv: number | null; ivRank: number | null; ivPct: number | null; ivDays: number; fromHigh: number | null; cone: Array<{ n: number; min: number | null; p25: number | null; med: number | null; p75: number | null; max: number | null; now: number | null }> };

const UNIVERSES: Record<string, Array<[string, string]>> = {
  idx: [["^GSPC", "标普 500"], ["^NDX", "纳指 100"], ["^RUT", "罗素 2000"], ["SPY", "标普 ETF"], ["QQQ", "纳指 ETF"], ["IWM", "小盘 ETF"], ["DIA", "道指 ETF"], ["EEM", "新兴市场 ETF"], ["EFA", "发达市场 ETF"], ["FXI", "中国大盘 ETF"], ["KWEB", "中概互联 ETF"], ["EWJ", "日本 ETF"]],
  sector: [["XLK", "科技"], ["XLF", "金融"], ["XLE", "能源"], ["XLV", "医疗"], ["XLY", "可选消费"], ["XLP", "必需消费"], ["XLI", "工业"], ["XLU", "公用事业"], ["XLB", "材料"], ["XLRE", "地产"], ["XLC", "通信"], ["SMH", "半导体"], ["KRE", "地区银行"], ["XBI", "生物科技"]],
  mega: [["AAPL", "苹果"], ["MSFT", "微软"], ["NVDA", "英伟达"], ["AMZN", "亚马逊"], ["GOOGL", "谷歌"], ["META", "Meta"], ["TSLA", "特斯拉"], ["AVGO", "博通"], ["AMD", "AMD"], ["NFLX", "奈飞"], ["JPM", "摩根大通"], ["BABA", "阿里巴巴"], ["PDD", "拼多多"], ["COIN", "Coinbase"], ["MSTR", "Strategy"], ["PLTR", "Palantir"]],
  macro: [["TLT", "长期美债"], ["IEF", "中期美债"], ["HYG", "高收益债"], ["GLD", "黄金"], ["SLV", "白银"], ["USO", "原油"], ["UNG", "天然气"], ["FXE", "欧元"], ["FXY", "日元"], ["UUP", "美元"], ["IBIT", "比特币 ETF"]],
};
const UNI_LABEL: Record<string, string> = { idx: "指数与宽基", sector: "行业 ETF", mega: "大型个股", macro: "跨资产" };

function ConeChart({ row }: { row: IvRow | undefined }) {
  if (!row) return <div className="px-2 py-6 text-[11px] text-slate-500">选择标的</div>;
  const c = row.cone.filter((x) => x.max != null);
  if (!c.length) return <div className="px-2 py-6 text-[11px] text-slate-500">历史不足</div>;
  return (
    <div>
      <SectionHead title={`${row.symbol} 波动率锥（过去一年滚动实现波动率分布，%）`} sub={row.iv30 != null ? `当前 30 日隐波 ${row.iv30.toFixed(1)}%` : undefined} />
      <Lines series={[
        { name: "最高", color: "#f2495c", values: c.map((x) => x.max), dash: true },
        { name: "75%", color: "#fb923c", values: c.map((x) => x.p75) },
        { name: "中位", color: "#94a3b8", values: c.map((x) => x.med) },
        { name: "25%", color: "#34d399", values: c.map((x) => x.p25) },
        { name: "最低", color: "#1fbf75", values: c.map((x) => x.min), dash: true },
        { name: "当前实现", color: "#38bdf8", values: c.map((x) => x.now) },
        ...(row.iv30 != null ? [{ name: "30日隐波", color: "#fbbf24", values: c.map(() => row.iv30) }] : []),
      ]} xLabels={c.map((x) => `${x.n}日`)} height={200} fmt={(v) => v.toFixed(1)} />
      
    </div>
  );
}

function IvTable({ rows, labels, onPick, sel }: { rows: IvRow[]; labels: Record<string, string>; onPick: (s: string) => void; sel: string | null }) {
  const [sort, setSort] = useState<keyof IvRow>("ivRv");
  const list = [...rows].sort((a, b) => ((b[sort] as number | null) ?? -1e9) - ((a[sort] as number | null) ?? -1e9));
  const th = (k: keyof IvRow, l: string) => <th className="cursor-pointer text-right hover:text-white" onClick={() => setSort(k)}>{l}{sort === k ? " ▼" : ""}</th>;
  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-[#0a1726] text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">标的</th><th className="text-right">价格</th>{th("changePct", "涨跌幅")}{th("iv30", "30日隐波")}{th("iv30Chg", "隐波日变")}{th("rv20", "20日实波")}{th("rv60", "60日实波")}{th("ivRv", "隐波−实波")}{th("ivPct", "隐波分位")}{th("fromHigh", "距52周高")}</tr></thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.symbol} onClick={() => onPick(r.symbol)} className={`cursor-pointer border-t border-[#0f1b29] ${sel === r.symbol ? "bg-[#0d2236]" : "hover:bg-[#0a1726]"}`}>
            <td className="px-2 py-0.5 text-slate-100">{labels[r.symbol] ?? r.symbol}<span className="ml-1 font-mono text-[9px] text-slate-600">{r.symbol}</span></td>
            <td className="text-right font-mono text-white">{fmtPrice(r.price)}</td>
            <td className="text-right font-mono" style={{ color: toneOf(r.changePct) }}>{fmtPct(r.changePct)}</td>
            <td className="text-right font-mono text-amber-200">{f2(r.iv30, 1)}</td>
            <td className="text-right font-mono" style={{ color: toneOf(r.iv30Chg) }}>{sgn(r.iv30Chg, 2, "")}</td>
            <td className="text-right font-mono text-slate-300">{f2(r.rv20, 1)}</td>
            <td className="text-right font-mono text-slate-400">{f2(r.rv60, 1)}</td>
            <td className="text-right font-mono" style={{ background: heat(r.ivRv, 12) }}>{sgn(r.ivRv, 1, "")}</td>
            <td className="text-right font-mono text-slate-300">{r.ivPct == null ? <span className="text-[9px] text-slate-600">累积中 {r.ivDays} 天</span> : `${r.ivPct.toFixed(0)}%`}</td>
            <td className="px-2 text-right font-mono text-slate-400">{sgn(r.fromHigh, 1)}</td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={10} className="px-2 py-6 text-slate-500">读取期权隐波与日线…</td></tr>}
      </tbody>
    </table>
  );
}

const VIX_BOARD: BoardRow[] = [
  ...[["^VIX9D", "9 日波动率指数"], ["^VIX", "VIX 恐慌指数"], ["^VIX3M", "3 个月波动率指数"], ["^VIX6M", "6 个月波动率指数"], ["^VVIX", "VIX 的波动率"], ["^SKEW", "尾部风险指数"]].map(([s, l]) => ({ symbol: s, label: l, group: "股票波动率" })),
  ...[["^MOVE", "美债波动率"], ["^OVX", "原油波动率"], ["^GVZ", "黄金波动率"], ["^VXN", "纳指波动率"], ["^RVX", "罗素 2000 波动率"]].map(([s, l]) => ({ symbol: s, label: l, group: "跨资产波动率" })),
  ...[["VX", "VIX 期货"], ["VIXY", "VIX 短期期货 ETF"], ["SVXY", "反向 VIX ETF"]].map(([s, l]) => ({ symbol: s, label: l, group: "波动率交易品种" })),
];
function VixTerm() {
  const t = useTicks(["^VIX9D", "^VIX", "^VIX3M", "^VIX6M"]);
  const pts: Array<[string, number | null | undefined]> = [["9日", t["^VIX9D"]?.price], ["30日", t["^VIX"]?.price], ["3月", t["^VIX3M"]?.price], ["6月", t["^VIX6M"]?.price]];
  const ratio = t["^VIX"]?.price && t["^VIX3M"]?.price ? t["^VIX"].price / t["^VIX3M"].price : null;
  return (
    <div className="grid gap-px bg-[#1a2a3c] md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="bg-[#03070c]"><SectionHead title="VIX 期限结构（实时）" /><Lines series={[{ name: "波动率指数", color: "#fbbf24", values: pts.map((p) => p[1] ?? null) }]} xLabels={pts.map((p) => p[0])} height={150} fmt={(v) => v.toFixed(2)} /></div>
      <div className="bg-[#03070c] p-2 text-[11px]">
        <div className="text-slate-400">VIX / VIX3M</div>
        <div className="font-mono text-[22px]" style={{ color: ratio == null ? undefined : ratio > 1 ? "#1fbf75" : "#e2e8f0" }}>{f2(ratio, 3)}</div>
        <div className="mt-1 text-[10px] leading-relaxed text-slate-500">{ratio == null ? "" : ratio > 1 ? "期限结构倒挂：短期恐慌高于中期，市场处于压力状态。" : ratio > 0.9 ? "期限结构趋平：警惕波动放大。" : "正常升水结构：市场情绪平稳。"}</div>
      </div>
    </div>
  );
}

export function VolScanner() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "scan");
  const [uni, setUni] = useState("idx");
  const list = UNIVERSES[uni];
  const labels = Object.fromEntries(Object.values(UNIVERSES).flat());
  const iv = usePolled<IvRow[]>("ucHubs.ivScan", func === "scan" || func === "cone" ? { symbols: list.map(([s]) => s) } : null, 180_000);
  const [sel, setSel] = useState<string | null>(null);
  const { pick } = useHub();
  const rows = iv.data ?? [];
  const cur = rows.find((r) => r.symbol === sel) ?? rows[0];
  const feed = useFeed(func === "news" ? { q: "volatility OR VIX OR options OR 波动率 OR 期权", limit: 120, hours: 72 } : null);
  return (
    <HubShell title="波动率分析" code="VCA" func={func} setFunc={setFunc}
      funcs={[["scan", "IVSC", "隐波扫描"], ["cone", "VCON", "波动率锥"], ["vix", "VIXT", "波动率指数族"], ["news", "VOLN", "波动率新闻"]]}
      right={<Seg value={uni} onChange={setUni} options={Object.entries(UNI_LABEL) as Array<[string, string]>} />}>
      {func === "scan" && <><SectionHead title={`隐含波动率扫描 · ${UNI_LABEL[uni]}`} sub="点击表头排序；隐波分位基于平台每日自动入库的隐波历史，满 20 个交易日后启用" /><IvTable rows={rows} labels={labels} sel={cur?.symbol ?? null} onPick={(s) => { setSel(s); pick(s); }} /></>}
      {func === "cone" && (
        <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="bg-[#03070c]">{rows.map((r) => <button key={r.symbol} type="button" onClick={() => setSel(r.symbol)} className={`flex w-full justify-between border-b border-[#0f1b29] px-2 py-1 text-[11px] ${cur?.symbol === r.symbol ? "bg-[#0d2236] text-white" : "text-slate-300 hover:bg-[#0a1726]"}`}><span>{labels[r.symbol] ?? r.symbol}</span><span className="font-mono text-amber-200">{f2(r.iv30, 1)}</span></button>)}</div>
          <div className="bg-[#03070c]"><ConeChart row={cur} /><Bars data={(cur?.cone ?? []).map((c) => ({ k: `${c.n}日`, v: c.now ?? 0, v2: c.med ?? 0 }))} label={["当前实现", "历史中位"]} fmt={(v) => v.toFixed(1)} height={120} /></div>
        </div>
      )}
      {func === "vix" && <><VixTerm /><LiveBoard rows={VIX_BOARD} /></>}
      {func === "news" && <><SectionHead title="波动率与期权新闻" sub={`${feed.items.length} 条`} /><FeedList items={feed.items} loading={feed.loading} dense /></>}
    </HubShell>
  );
}

/* ================================================================== 外汇波动率 */
const FX_PAIRS: Array<[string, string]> = [["EURUSD", "欧元/美元"], ["USDJPY", "美元/日元"], ["GBPUSD", "英镑/美元"], ["AUDUSD", "澳元/美元"], ["USDCAD", "美元/加元"], ["USDCHF", "美元/瑞郎"], ["NZDUSD", "纽元/美元"], ["USDCNH", "美元/离岸人民币"], ["EURJPY", "欧元/日元"], ["GBPJPY", "英镑/日元"], ["EURGBP", "欧元/英镑"], ["USDMXN", "美元/墨西哥比索"], ["USDZAR", "美元/南非兰特"], ["USDTRY", "美元/土耳其里拉"]];
const FX_ETF: Array<[string, string]> = [["FXE", "欧元"], ["FXY", "日元"], ["FXB", "英镑"], ["FXA", "澳元"], ["FXC", "加元"], ["FXF", "瑞郎"], ["UUP", "美元指数"], ["CEW", "新兴市场货币"]];
export function FxVolDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "matrix");
  const syms = FX_PAIRS.map(([s]) => s);
  const pack = useCloses(syms, 520);
  const etf = usePolled<IvRow[]>("ucHubs.ivScan", func === "implied" ? { symbols: FX_ETF.map(([s]) => s) } : null, 300_000);
  const cones = usePolled<IvRow[]>("ucHubs.ivScan", func === "cone" ? { symbols: syms.slice(0, 8) } : null, 600_000);
  const [sel, setSel] = useState("EURUSD");
  const [range, setRange] = useState("250");
  const { dates, m } = useMemo(() => align(pack.data ?? null, syms), [pack.data]);
  const vol = (s: string, n: number) => { const c = m[s] ?? []; const r = rollingVol(c, n); return r[r.length - 1] ?? null; };
  const rv = (s: string, w: number) => rollingVol(m[s] ?? [], w).slice(-Number(range));
  const { pick } = useHub();
  return (
    <HubShell title="外汇波动率" code="WVOL" func={func} setFunc={setFunc}
      funcs={[["matrix", "FXVM", "实现波动率矩阵"], ["trend", "FXVT", "波动率走势"], ["cone", "FXVC", "波动率锥"], ["implied", "FXIV", "外汇 ETF 隐波"]]}
      right={<span>欧元 20 日实波 <b className="font-mono text-white">{f2(vol("EURUSD", 20), 2, "%")}</b></span>}>
      {func === "matrix" && (
        <div>
          <SectionHead title="主要货币对实现波动率（年化 %）" sub={pack.loading && !pack.data ? "读取日线…" : `截至 ${dates[dates.length - 1] ?? "—"}；颜色越深 = 相对 1 年均值越高`} />
          <table className="w-full text-[11px]">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-left">货币对</th><th className="text-right">10日</th><th className="text-right">20日</th><th className="text-right">60日</th><th className="text-right">120日</th><th className="text-right">250日</th><th className="text-right">20日 − 250日</th><th className="px-2 text-left">20日实波走势</th></tr></thead>
            <tbody>
              {FX_PAIRS.map(([s, l]) => {
                const v = [10, 20, 60, 120, 250].map((n) => vol(s, n));
                const r20 = rollingVol(m[s] ?? [], 20).slice(-120).filter((x): x is number => x != null);
                const d = v[1] != null && v[4] != null ? v[1] - v[4] : null;
                return (
                  <tr key={s} onClick={() => { setSel(s); pick(s); }} className="cursor-pointer border-t border-[#0f1b29] hover:bg-[#0a1726]">
                    <td className="px-2 py-0.5 text-slate-100">{l}<span className="ml-1 font-mono text-[9px] text-slate-600">{s}</span></td>
                    {v.map((x, i) => <td key={i} className="text-right font-mono text-slate-200">{f2(x, 2)}</td>)}
                    <td className="text-right font-mono" style={{ background: heat(d, 5) }}>{sgn(d, 2, "")}</td>
                    <td className="px-2"><svg viewBox="0 0 100 16" className="h-4 w-24">{r20.length > 1 && <polyline fill="none" stroke="#38bdf8" strokeWidth={1} points={r20.map((x, i) => `${(i / (r20.length - 1)) * 100},${16 - ((x - Math.min(...r20)) / Math.max(1e-9, Math.max(...r20) - Math.min(...r20))) * 15}`).join(" ")} />}</svg></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {func === "trend" && (
        <div>
          <SectionHead title="滚动实现波动率（%）" right={<span className="flex gap-2"><select value={sel} onChange={(e) => setSel(e.target.value)} className="border border-[#1d3047] bg-[#07111c] px-1 text-[11px] text-slate-200">{FX_PAIRS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}</select><Seg value={range} onChange={setRange} options={[["126", "半年"], ["250", "1年"], ["500", "2年"]]} /></span>} />
          <Lines series={[{ name: "10日", color: "#f472b6", values: rv(sel, 10) }, { name: "20日", color: "#38bdf8", values: rv(sel, 20) }, { name: "60日", color: "#fbbf24", values: rv(sel, 60) }]} xLabels={dates.slice(-Number(range)).map((d) => d.slice(2))} height={240} />
          <SectionHead title="主要货币对 20 日实波对比" />
          <Lines series={[["EURUSD", "#38bdf8"], ["USDJPY", "#f2495c"], ["GBPUSD", "#a78bfa"], ["USDCNH", "#fbbf24"]].map(([s, c]) => ({ name: s, color: c, values: rv(s, 20) }))} xLabels={dates.slice(-Number(range)).map((d) => d.slice(2))} height={200} />
        </div>
      )}
      {func === "cone" && (
        <div className="grid gap-px bg-[#1a2a3c] xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="bg-[#03070c]">{syms.slice(0, 8).map((s) => <button key={s} type="button" onClick={() => setSel(s)} className={`block w-full border-b border-[#0f1b29] px-2 py-1 text-left text-[11px] ${sel === s ? "bg-[#0d2236] text-white" : "text-slate-300 hover:bg-[#0a1726]"}`}>{FX_PAIRS.find(([x]) => x === s)?.[1]}</button>)}</div>
          <div className="bg-[#03070c]"><ConeChart row={(cones.data ?? []).find((r) => r.symbol === sel) ?? cones.data?.[0]} /></div>
        </div>
      )}
      {func === "implied" && <><SectionHead title="外汇 ETF 期权 30 日隐含波动率" sub="以挂牌货币 ETF 的期权隐波作为对应货币的隐含波动参考" /><IvTable rows={etf.data ?? []} labels={Object.fromEntries(FX_ETF)} sel={null} onPick={(s) => pick(s)} /></>}
    </HubShell>
  );
}

/* ================================================================== 外汇 / 商品期权估值 */
const UNDERLYING: Array<{ s: string; l: string; kind: "fx" | "fut"; dom: string; for?: string }> = [
  { s: "EURUSD", l: "欧元/美元", kind: "fx", dom: "USD", for: "EUR" }, { s: "USDJPY", l: "美元/日元", kind: "fx", dom: "JPY", for: "USD" }, { s: "GBPUSD", l: "英镑/美元", kind: "fx", dom: "USD", for: "GBP" },
  { s: "AUDUSD", l: "澳元/美元", kind: "fx", dom: "USD", for: "AUD" }, { s: "USDCNH", l: "美元/离岸人民币", kind: "fx", dom: "CNH", for: "USD" }, { s: "USDCHF", l: "美元/瑞郎", kind: "fx", dom: "CHF", for: "USD" },
  { s: "GC", l: "黄金期货", kind: "fut", dom: "USD" }, { s: "SI", l: "白银期货", kind: "fut", dom: "USD" }, { s: "CL", l: "WTI 原油期货", kind: "fut", dom: "USD" }, { s: "NG", l: "天然气期货", kind: "fut", dom: "USD" }, { s: "HG", l: "铜期货", kind: "fut", dom: "USD" }, { s: "ZC", l: "玉米期货", kind: "fut", dom: "USD" },
];
/** 货币 → 央行政策利率所在经济体 */
const CB_AREA: Record<string, string> = { USD: "US", EUR: "XM", JPY: "JP", GBP: "GB", AUD: "AU", CHF: "CH", CNH: "CN", CAD: "CA", NZD: "NZ" };
export function FxOptionDesk() {
  const [u, setU] = useState(UNDERLYING[0].s);
  const und = UNDERLYING.find((x) => x.s === u)!;
  const t = useTicks([u]);
  const S = t[u]?.price ?? null;
  const cb = usePolled<{ rows: Array<{ area: string; rate: number | null }> }>("ucHubs.cbRates", {}, 3 * 3600_000);
  const pack = useCloses([u], 300);
  const closes = (pack.data?.[u] ?? []).map((x) => x[1]);
  const rv = (() => { const r = rollingVol(closes, 30); return r[r.length - 1] ?? null; })();
  const [days, setDays] = useState(30);
  const [volIn, setVolIn] = useState<number | null>(null);
  const [kIn, setKIn] = useState<number | null>(null);
  const [type, setType] = useState<"C" | "P">("C");
  const [qty, setQty] = useState(1_000_000);
  const policy = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [c, a] of Object.entries(CB_AREA)) { const r = cb.data?.rows.find((x) => x.area === a)?.rate; if (r != null) out[c] = r; }
    return out;
  }, [cb.data]);
  const rd = (policy[und.dom] ?? policy.USD ?? 0) / 100;
  const rf = und.kind === "fx" ? (policy[und.for!] ?? policy.USD ?? 0) / 100 : rd;
  const vol = (volIn ?? rv ?? 10) / 100;
  const K = kIn ?? (S ? +S.toPrecision(5) : 0);
  const T = days / 365;
  const b = und.kind === "fx" ? rd - rf : 0;
  const res = S ? gbs(type, S, K, T, rd, b, vol) : null;
  const fwd = S ? S * Math.exp(b * T) : null;
  const ladder = S ? [0.9, 0.95, 0.97, 0.99, 1, 1.01, 1.03, 1.05, 1.1].map((m) => { const k = +(S * m).toPrecision(5); return { k, c: gbs("C", S, k, T, rd, b, vol), p: gbs("P", S, k, T, rd, b, vol) }; }) : [];
  const scen = S && res ? [-0.05, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.05].map((d) => ({ d, pnl: (gbs(type, S * (1 + d), K, Math.max(0, T - 1 / 365), rd, b, vol).price - res.price) * qty })) : [];
  const inp = "w-28 border border-[#1d3047] bg-[#07111c] px-1 py-0.5 text-right font-mono text-[11px] text-white";
  const [func, setFunc] = useState("price");
  return (
    <HubShell title="外汇与商品期权估值" code="OVML" func={func} setFunc={setFunc} funcs={[["price", "OVML", "单笔估值"], ["ladder", "STRK", "行权价阶梯"], ["scen", "SCEN", "情景损益"]]}
      right={<span>{und.l} <b className="font-mono" style={{ color: toneOf(t[u]?.changePct) }}>{fmtPrice(S)}</b></span>}>
      <div className="grid gap-px bg-[#1a2a3c] lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="bg-[#03070c] p-2 text-[11px]">
          <SectionHead title="参数（现价与利率实时代入）" />
          <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">标的</span><select value={u} onChange={(e) => { setU(e.target.value); setKIn(null); setVolIn(null); }} className="border border-[#1d3047] bg-[#07111c] px-1 text-[11px] text-slate-200">{UNDERLYING.map((x) => <option key={x.s} value={x.s}>{x.l}</option>)}</select></div>
          <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">类型</span><Seg value={type} onChange={setType} options={[["C", "看涨"], ["P", "看跌"]]} /></div>
          <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">行权价</span><input type="number" value={K || ""} step={S ? +(S / 200).toPrecision(2) : 0.01} onChange={(e) => setKIn(Number(e.target.value) || null)} className={inp} /></div>
          <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">剩余天数</span><input type="number" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className={inp} /></div>
          <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">波动率 %</span><input type="number" step={0.5} value={volIn ?? (rv != null ? +rv.toFixed(2) : "")} onChange={(e) => setVolIn(Number(e.target.value) || null)} className={inp} /></div>
          <div className="flex items-center justify-between border-b border-[#0f1b29] py-1"><span className="text-slate-400">名义数量</span><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className={inp} /></div>
          <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
            <div>现价 {fmtPrice(S)} · 远期 {fmtPrice(fwd)}</div>
            <div>{und.kind === "fx" ? `本币 ${und.dom} 利率 ${(rd * 100).toFixed(2)}% · 外币 ${und.for} 利率 ${(rf * 100).toFixed(2)}%` : `无风险利率 ${(rd * 100).toFixed(2)}%（期货期权按 Black-76）`}</div>
            <div>默认波动率 = 30 日实现波动率 {f2(rv, 2, "%")}，可手动覆盖</div>
          </div>
        </div>
        <div className="min-w-0 bg-[#03070c]">
          {func === "price" && res && (
            <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] md:grid-cols-4">
              {[["期权价格", fmtPrice(res.price)], ["占现价", `${((res.price / S!) * 100).toFixed(3)}%`], ["总权利金", Math.round(res.price * qty).toLocaleString()], ["Delta", res.delta.toFixed(4)], ["Gamma", res.gamma.toFixed(5)], ["Vega（1%）", res.vega.toFixed(5)], ["Theta（日）", res.theta.toFixed(5)], ["Rho（1%）", res.rho.toFixed(5)], ["Delta 对冲量", Math.round(-res.delta * qty).toLocaleString()], ["盈亏平衡", fmtPrice(type === "C" ? K + res.price : K - res.price)], ["内在价值", fmtPrice(Math.max(0, type === "C" ? S! - K : K - S!))], ["时间价值", fmtPrice(res.price - Math.max(0, type === "C" ? S! - K : K - S!))]].map(([k, v]) => (
                <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div></div>
              ))}
            </div>
          )}
          {func === "price" && !res && <div className="px-3 py-6 text-[11px] text-slate-500">等待实时报价…</div>}
          {func === "ladder" && (
            <table className="w-full text-[11px]">
              <thead className="text-[10px] text-slate-500"><tr><th className="px-2 py-1 text-right">看涨价格</th><th className="text-right">看涨 Delta</th><th className="text-center">行权价</th><th className="text-right">看跌价格</th><th className="text-right">看跌 Delta</th><th className="px-2 text-right">Vega</th></tr></thead>
              <tbody>{ladder.map((r) => <tr key={r.k} className={`border-t border-[#0f1b29] ${S && Math.abs(r.k / S - 1) < 0.005 ? "bg-[#0d2236]" : ""}`}><td className="px-2 py-0.5 text-right font-mono text-red-300">{fmtPrice(r.c.price)}</td><td className="text-right font-mono text-slate-300">{r.c.delta.toFixed(3)}</td><td className="text-center font-mono text-white">{fmtPrice(r.k)}</td><td className="text-right font-mono text-emerald-300">{fmtPrice(r.p.price)}</td><td className="text-right font-mono text-slate-300">{r.p.delta.toFixed(3)}</td><td className="px-2 text-right font-mono text-slate-400">{r.c.vega.toFixed(5)}</td></tr>)}</tbody>
            </table>
          )}
          {func === "scen" && <><SectionHead title="持有 1 天后，标的价格变动下的损益" /><Bars data={scen.map((s) => ({ k: `${s.d > 0 ? "+" : ""}${(s.d * 100).toFixed(0)}%`, v: s.pnl }))} height={200} /><table className="w-full text-[11px]"><tbody>{scen.map((s) => <tr key={s.d} className="border-t border-[#0f1b29]"><td className="px-2 py-0.5 font-mono text-slate-300">{s.d > 0 ? "+" : ""}{(s.d * 100).toFixed(0)}%</td><td className="font-mono text-slate-400">{fmtPrice(S ? S * (1 + s.d) : null)}</td><td className="px-2 text-right font-mono" style={{ color: toneOf(s.pnl) }}>{Math.round(s.pnl).toLocaleString()}</td></tr>)}</tbody></table></>}
        </div>
      </div>
    </HubShell>
  );
}

/* ================================================================== 衍生品新闻 */
const NEWS_TABS: Array<[string, string, Record<string, unknown>]> = [
  ["all", "全部衍生品", { q: "options OR futures OR derivatives OR 期货 OR 期权 OR 衍生品 OR swap", limit: 200, hours: 72 }],
  ["vol", "波动率", { q: "VIX OR volatility OR 波动率", limit: 150, hours: 96 }],
  ["rates", "利率衍生品", { q: "rate futures OR SOFR OR swaps OR 利率互换 OR treasury futures OR 国债期货", limit: 150, hours: 96 }],
  ["cmdty", "商品期货", { cats: ["商品", "能源"], limit: 150, hours: 72 }],
  ["fx", "外汇", { cats: ["外汇"], limit: 150, hours: 72 }],
  ["crypto", "加密衍生品", { cats: ["加密"], limit: 150, hours: 72 }],
];
export function DerivNewsDesk() {
  const [func, setFunc] = useState(() => new URLSearchParams(window.location.search).get("fn") ?? "all");
  const tab = NEWS_TABS.find(([k]) => k === func) ?? NEWS_TABS[0];
  const feed = useFeed(tab[2] as never);
  return (
    <HubShell title="衍生品新闻" code="NI DRV" func={func} setFunc={setFunc} funcs={NEWS_TABS.map(([k, l]) => [k, k.toUpperCase(), l])} right={<span>{feed.items.length} 条</span>}>
      <FeedList items={feed.items} loading={feed.loading} dense />
    </HubShell>
  );
}
