/**
 * 个性化工作台（/workspace）：收藏 / 固定 / 排序常用图表，布局按个人永久保存。
 * 每张图都接真实数据：美债与欧元区曲线、期限利差、货币市场利率、美债拍卖、期权链隐含波动率、日线收盘价、实时行情。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fmtPct, fmtPrice, toneOf, usePolled, useTicks } from "@/uc/market/live";
import { useCloses, align, perf, heat, f2 } from "@/uc/hubs/calc";
import { Bars, HubContext, Lines, SymbolPane, useHub } from "@/uc/hubs/kit";
import { saveItem, useSaved } from "@/uc/panels/kit";

type Timeframe = "1W" | "1M" | "3M" | "6M" | "1Y";
const TF_DAYS: Record<Timeframe, number> = { "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };
type CsvRows = Array<Array<string | number | null>>;
type Report = (rows: CsvRows) => void;

type Curves = { us: Array<{ date: string; points: Array<{ tenor: string; value: number }> }>; eu: Array<{ tenor: string; value: number }>; euDate: string | null; spreads: Array<{ date: string; s2s10: number | null; s3m10: number | null; s5s30: number | null; y10: number | null; y2: number | null }> };
type MM = { series: Record<string, Array<{ d: string; v: number }>>; target: { from: number | null; to: number | null } };
type Auction = { cusip: string; type: string; term: string; auction: string; highYield: number | null; btc: number | null; indirect: number | null; dealer: number | null; offering: number | null };
type Opt = { spot: number; expiry: string; expiries: string[]; chain: Array<{ strike: number; call: { iv: number } | null; put: { iv: number } | null }>; term: Array<{ exp: string; iv: number | null }>; stats: { atmIv: number | null; skew25: number | null } };
type Sov = { countries: Array<{ code: string; name: string; date: string; y: number; spread: number | null; chg12m: number | null }> };

const iv100 = (v: number | null | undefined) => (v == null || v <= 0 ? null : v < 3 ? v * 100 : v);
const Note = ({ children }: { children: React.ReactNode }) => (void children, null); // 方法说明 / 计算口径不在界面展示
const Loading = ({ text = "读取中…" }: { text?: string }) => <div className="flex h-[180px] items-center justify-center text-[11px] text-slate-500">{text}</div>;

/* ------------------------------------------------------------------ 各图 */
const CURVE_TENORS = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "20Y", "30Y"];
function YieldCurve({ tf, report }: { tf: Timeframe; report: Report }) {
  const c = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const us = c.data?.us ?? [];
  const now = us[0], ago = us[Math.min(TF_DAYS[tf], us.length - 1)];
  const get = (d: typeof now | undefined, t: string) => d?.points.find((p) => p.tenor === t)?.value ?? null;
  const eu = (t: string) => c.data?.eu.find((p) => p.tenor === t)?.value ?? null;
  useEffect(() => { if (now) report([["期限", `美债 ${now.date}`, `美债 ${ago?.date ?? ""}`, `欧元区AAA ${c.data?.euDate ?? ""}`], ...CURVE_TENORS.map((t) => [t, get(now, t), get(ago, t), eu(t)])]); }, [c.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!now) return <Loading text={c.loading ? undefined : "暂无曲线"} />;
  return (
    <div>
      <Lines series={[{ name: `美债 ${now.date.slice(5)}`, color: "#38bdf8", values: CURVE_TENORS.map((t) => get(now, t)) }, { name: `美债 ${ago?.date.slice(5) ?? ""}`, color: "#64748b", values: CURVE_TENORS.map((t) => get(ago, t)), dash: true }, { name: "欧元区 AAA", color: "#34d399", values: CURVE_TENORS.map(eu) }]} xLabels={CURVE_TENORS} height={170} fmt={(v) => v.toFixed(2)} />
      <div className="grid grid-cols-4 gap-px bg-[#1a2a3c] text-[10px]">
        {["2Y", "5Y", "10Y", "30Y"].map((t) => { const a = get(now, t), b = get(ago, t); const d = a != null && b != null ? Math.round((a - b) * 100) : null; return <div key={t} className="bg-[#050b13] px-1.5 py-0.5"><span className="text-slate-500">{t} </span><span className="font-mono text-white">{f2(a)}</span> <span className="font-mono" style={{ color: toneOf(d) }}>{d == null ? "" : `${d > 0 ? "+" : ""}${d}bp`}</span></div>; })}
      </div>
    </div>
  );
}

function TermSpreads({ tf, report }: { tf: Timeframe; report: Report }) {
  const c = usePolled<Curves>("ucHubs.curves", {}, 1800_000);
  const s = (c.data?.spreads ?? []).slice(-Math.max(TF_DAYS[tf], 10));
  useEffect(() => { if (s.length) report([["日期", "2s10s(bp)", "3m10y(bp)", "5s30(bp)"], ...s.map((r) => [r.date, r.s2s10, r.s3m10, r.s5s30])]); }, [c.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.length) return <Loading text={c.loading ? undefined : "暂无数据"} />;
  return (
    <div>
      <Lines series={[{ name: "2s10s", color: "#fbbf24", values: s.map((r) => r.s2s10) }, { name: "3m10y", color: "#38bdf8", values: s.map((r) => r.s3m10) }, { name: "5s30", color: "#a78bfa", values: s.map((r) => r.s5s30) }]} xLabels={s.map((r) => r.date.slice(5))} height={180} fmt={(v) => v.toFixed(0)} zero />
      <Note>单位 bp；跌破 0 为倒挂。区间内 2s10s 变化 {(() => { const a = s[0]?.s2s10, b = s[s.length - 1]?.s2s10; return a != null && b != null ? `${b - a > 0 ? "+" : ""}${b - a}bp（${b - a > 0 ? "陡峭化" : "平坦化"}）` : "—"; })()}</Note>
    </div>
  );
}

const CREDIT = ["LQD", "HYG", "IEF", "EMB"];
function CreditPremium({ tf, report }: { tf: Timeframe; report: Report }) {
  const pack = useCloses(CREDIT, 300);
  const { dates, m } = useMemo(() => align(pack.data, CREDIT), [pack.data]);
  const n = Math.min(TF_DAYS[tf], dates.length - 1);
  const rel = (s: string) => { if (n < 2) return []; const a = m[s].slice(-n - 1), b = m.IEF.slice(-n - 1); return a.map((v, i) => ((v / a[0]) / (b[i] / b[0]) - 1) * 100); };
  const d = dates.slice(-n - 1);
  const hy = rel("HYG"), ig = rel("LQD"), em = rel("EMB");
  useEffect(() => { if (d.length > 2) report([["日期", "高收益超额(%)", "投资级超额(%)", "新兴市场超额(%)"], ...d.map((x, i) => [x, +hy[i].toFixed(3), +ig[i].toFixed(3), +em[i].toFixed(3)])]); }, [pack.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  if (n < 2) return <Loading text={pack.loading ? undefined : "暂无日线"} />;
  return (
    <div>
      <Lines series={[{ name: "高收益", color: "#f2495c", values: hy }, { name: "投资级", color: "#38bdf8", values: ig }, { name: "新兴市场", color: "#fbbf24", values: em }]} xLabels={d.map((x) => x.slice(5))} height={180} fmt={(v) => `${v.toFixed(2)}%`} zero />
      <Note>相对 7–10 年国债 ETF 的累计超额收益：上行 = 信用利差收窄 / 风险偏好改善；下行 = 信用风险溢价扩大。</Note>
    </div>
  );
}

function VolSmile({ report }: { report: Report }) {
  const [exp, setExp] = useState<string | undefined>(undefined);
  const o = usePolled<Opt | null>("ucHubs.options", exp ? { symbol: "SPY", expiry: exp } : { symbol: "SPY" }, 120_000);
  const d = o.data;
  const rows = (d?.chain ?? []).filter((r) => d && Math.abs(r.strike / d.spot - 1) <= 0.12);
  useEffect(() => { if (rows.length) report([["行权价", "看涨IV(%)", "看跌IV(%)"], ...rows.map((r) => [r.strike, iv100(r.call?.iv), iv100(r.put?.iv)])]); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Loading text={o.loading ? undefined : "期权链暂不可用"} />;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 px-2 text-[10px]">
        <span className="text-slate-500">标普 500 ETF 到期日</span>
        {d.expiries.filter((e) => e >= new Date().toISOString().slice(0, 10)).slice(0, 6).map((e) => <button key={e} type="button" onClick={() => setExp(e)} className={`border px-1 font-mono ${d.expiry === e ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-400"}`}>{e.slice(5)}</button>)}
      </div>
      <Lines series={[{ name: "看跌 IV", color: "#1fbf75", values: rows.map((r) => iv100(r.put?.iv)) }, { name: "看涨 IV", color: "#f2495c", values: rows.map((r) => iv100(r.call?.iv)) }]} xLabels={rows.map((r) => String(r.strike))} height={160} fmt={(v) => v.toFixed(1)} />
      <Note>现价 {fmtPrice(d.spot)} · 平值 IV {f2(iv100(d.stats.atmIv), 1, "%")} · 25Δ 偏斜 {f2(d.stats.skew25 != null ? iv100(Math.abs(d.stats.skew25)) : null, 1)}（看跌减看涨）</Note>
    </div>
  );
}

const SECTORS: Array<[string, string]> = [["XLK", "科技"], ["XLF", "金融"], ["XLV", "医疗"], ["XLY", "可选消费"], ["XLP", "必需消费"], ["XLE", "能源"], ["XLI", "工业"], ["XLB", "材料"], ["XLU", "公用事业"], ["XLRE", "房地产"], ["XLC", "通信"]];
function SectorPerf({ tf, report }: { tf: Timeframe; report: Report }) {
  const syms = SECTORS.map(([s]) => s);
  const pack = useCloses(syms, 300);
  const { m } = useMemo(() => align(pack.data, syms), [pack.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = SECTORS.map(([s, l]) => ({ k: l, v: perf(m[s] ?? [], TF_DAYS[tf]) })).filter((x): x is { k: string; v: number } => x.v != null).sort((a, b) => b.v - a.v);
  useEffect(() => { if (data.length) report([["板块", `${tf} 收益率(%)`], ...data.map((x) => [x.k, +x.v.toFixed(3)])]); }, [pack.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data.length) return <Loading text={pack.loading ? undefined : "暂无日线"} />;
  const max = Math.max(...data.map((x) => Math.abs(x.v))) || 1;
  return (
    <div className="px-2 py-1">
      {data.map((x) => (
        <div key={x.k} className="flex items-center gap-2 py-px text-[10px]">
          <span className="w-14 shrink-0 text-slate-300">{x.k}</span>
          <div className="relative h-3 flex-1 bg-[#07111c]"><div className="absolute top-0 h-3" style={{ left: x.v >= 0 ? "50%" : `${50 - (Math.abs(x.v) / max) * 50}%`, width: `${(Math.abs(x.v) / max) * 50}%`, background: x.v >= 0 ? "#f2495c" : "#1fbf75" }} /><div className="absolute left-1/2 top-0 h-3 w-px bg-slate-600" /></div>
          <span className="w-14 text-right font-mono" style={{ color: toneOf(x.v) }}>{x.v > 0 ? "+" : ""}{x.v.toFixed(2)}%</span>
        </div>
      ))}
      <Note>美股行业板块 ETF 区间涨跌幅（按日收盘价）。</Note>
    </div>
  );
}

function AuctionDemand({ tf, report }: { tf: Timeframe; report: Report }) {
  const a = usePolled<{ results: Auction[] }>("ucHubs.auctions", {}, 900_000);
  const cutoff = new Date(Date.now() - TF_DAYS[tf] * 1.45 * 86400_000).toISOString().slice(0, 10);
  const rows = (a.data?.results ?? []).filter((r) => r.auction >= cutoff && r.btc != null && r.type !== "CMB").slice().reverse();
  useEffect(() => { if (rows.length) report([["拍卖日", "品种", "期限", "中标收益率(%)", "认购倍数", "间接投标(%)", "一级交易商(%)", "发行额"], ...rows.map((r) => [r.auction, r.type, r.term, r.highYield, r.btc, r.indirect, r.dealer, r.offering])]); }, [a.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return <Loading text={a.loading ? undefined : "区间内无拍卖结果"} />;
  const avg = rows.reduce((s, r) => s + r.btc!, 0) / rows.length;
  return (
    <div>
      <Bars data={rows.map((r) => ({ k: `${r.auction.slice(5)} ${r.term}`, v: +(r.btc! - avg).toFixed(3) }))} fmt={(v) => `${(v + avg).toFixed(2)} 倍`} height={130} />
      <Lines series={[{ name: "间接投标 %", color: "#38bdf8", values: rows.map((r) => r.indirect) }, { name: "一级交易商 %", color: "#fbbf24", values: rows.map((r) => r.dealer) }]} height={90} fmt={(v) => v.toFixed(0)} />
      <Note>柱为各场认购倍数相对区间均值 {avg.toFixed(2)} 倍的偏离（红 = 需求强于均值）；间接投标多为海外官方与机构，交易商被动承接比例高说明需求偏弱。逐日债券资金流向无公开数据，故以拍卖需求刻画。</Note>
    </div>
  );
}

function NormalizedLines({ syms, labels, colors, tf, report, note }: { syms: string[]; labels: string[]; colors: string[]; tf: Timeframe; report: Report; note: string }) {
  const pack = useCloses(syms, 300);
  const { dates, m } = useMemo(() => align(pack.data, syms), [pack.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Math.min(TF_DAYS[tf], dates.length - 1);
  const d = dates.slice(-n - 1);
  const ser = syms.map((s) => { const c = (m[s] ?? []).slice(-n - 1); return c.map((v) => (v / c[0]) * 100); });
  useEffect(() => { if (n > 1) report([["日期", ...labels], ...d.map((x, i) => [x, ...ser.map((s) => +s[i].toFixed(3))])]); }, [pack.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  if (n < 2) return <Loading text={pack.loading ? undefined : "暂无日线"} />;
  return <div><Lines series={syms.map((_, i) => ({ name: labels[i], color: colors[i], values: ser[i] }))} xLabels={d.map((x) => x.slice(5))} height={180} fmt={(v) => v.toFixed(1)} /><Note>{note}</Note></div>;
}

const HEAT: Array<[string, string]> = [["^GSPC", "标普500"], ["^NDX", "纳指100"], ["^DJI", "道指"], ["^RUT", "罗素2000"], ["sh000001", "上证指数"], ["sh000300", "沪深300"], ["sz399001", "深证成指"], ["^HSI", "恒生指数"], ["^N225", "日经225"], ["^GDAXI", "德国DAX"], ["^FTSE", "富时100"], ["^FCHI", "法国CAC40"], ["^KS11", "韩国综指"], ["^TWII", "台湾加权"], ["^BSESN", "印度SENSEX"], ["^AXJO", "澳洲200"]];
function EquityHeat({ report }: { report: Report }) {
  const t = useTicks(HEAT.map(([s]) => s));
  const { pick } = useHub();
  const any = HEAT.some(([s]) => t[s]);
  useEffect(() => { if (any) report([["指数", "代码", "最新", "涨跌幅(%)"], ...HEAT.map(([s, l]) => [l, s, t[s]?.price ?? null, t[s]?.changePct ?? null])]); }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!any) return <Loading />;
  return (
    <div className="grid grid-cols-4 gap-px bg-[#1a2a3c]">
      {HEAT.map(([s, l]) => <button key={s} type="button" onClick={() => pick(s)} className="px-1 py-1.5 text-left" style={{ background: heat(t[s]?.changePct, 2.5) ?? "#050b13" }}><div className="truncate text-[10px] text-slate-200">{l}</div><div className="font-mono text-[11px] text-white">{fmtPct(t[s]?.changePct)}</div><div className="font-mono text-[9px] text-slate-400">{fmtPrice(t[s]?.price)}</div></button>)}
    </div>
  );
}

function RatesMonitor({ tf, report }: { tf: Timeframe; report: Report }) {
  const mm = usePolled<MM>("ucHubs.moneyMarket", {}, 600_000);
  const t = useTicks(["^IRX", "^FVX", "^TNX", "^TYX"]);
  const n = Math.max(TF_DAYS[tf], 10);
  const sofr = (mm.data?.series.SOFR ?? []).slice(-n);
  const map = (k: string) => new Map((mm.data?.series[k] ?? []).map((r) => [r.d, r.v]));
  const effr = map("EFFR"), tgcr = map("TGCR");
  useEffect(() => { if (sofr.length) report([["日期", "SOFR", "EFFR", "TGCR"], ...sofr.map((r) => [r.d, r.v, effr.get(r.d) ?? null, tgcr.get(r.d) ?? null])]); }, [mm.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  const tg = mm.data?.target;
  return (
    <div>
      <div className="grid grid-cols-4 gap-px bg-[#1a2a3c] text-[10px]">{[["^IRX", "13周"], ["^FVX", "5年"], ["^TNX", "10年"], ["^TYX", "30年"]].map(([s, l]) => <div key={s} className="bg-[#050b13] px-1.5 py-0.5"><span className="text-slate-500">{l} </span><span className="font-mono text-white">{fmtPrice(t[s]?.price)}</span> <span className="font-mono" style={{ color: toneOf(t[s]?.change) }}>{t[s]?.change == null ? "" : `${t[s]!.change! > 0 ? "+" : ""}${(t[s]!.change! * 100).toFixed(1)}bp`}</span></div>)}</div>
      {sofr.length ? <Lines series={[{ name: "SOFR", color: "#38bdf8", values: sofr.map((r) => r.v) }, { name: "EFFR", color: "#fbbf24", values: sofr.map((r) => effr.get(r.d) ?? null) }, { name: "TGCR", color: "#34d399", values: sofr.map((r) => tgcr.get(r.d) ?? null) }, ...(tg?.to != null ? [{ name: "目标上限", color: "#64748b", values: sofr.map(() => tg.to), dash: true }] : [])]} xLabels={sofr.map((r) => r.d.slice(5))} height={150} fmt={(v) => v.toFixed(2)} /> : <Loading text={mm.loading ? undefined : "暂无数据"} />}
      <Note>上方为美债收益率实时报价，下方为隔夜融资基准利率（%）{tg?.from != null ? `；联邦基金目标区间 ${tg.from.toFixed(2)}–${tg.to?.toFixed(2)}%` : ""}。</Note>
    </div>
  );
}

function VixTerm({ tf, report }: { tf: Timeframe; report: Report }) {
  const syms = ["^VIX", "^VIX3M"];
  const pack = useCloses(syms, 300);
  const t = useTicks(["^VIX", "^VIX3M", "^VVIX", "^SKEW"]);
  const { dates, m } = useMemo(() => align(pack.data, syms), [pack.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Math.min(Math.max(TF_DAYS[tf], 10), dates.length);
  const d = dates.slice(-n), v = (m["^VIX"] ?? []).slice(-n), v3 = (m["^VIX3M"] ?? []).slice(-n);
  const ratio = v.map((x, i) => x / v3[i]);
  useEffect(() => { if (n > 2) report([["日期", "VIX", "VIX3M", "VIX/VIX3M"], ...d.map((x, i) => [x, v[i], v3[i], +ratio[i].toFixed(4)])]); }, [pack.data, tf]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = t["^VIX"]?.price != null && t["^VIX3M"]?.price ? t["^VIX"]!.price / t["^VIX3M"]!.price : null;
  return (
    <div>
      <div className="grid grid-cols-4 gap-px bg-[#1a2a3c] text-[10px]">{[["^VIX", "VIX"], ["^VIX3M", "VIX3M"], ["^VVIX", "VVIX"], ["^SKEW", "SKEW"]].map(([s, l]) => <div key={s} className="bg-[#050b13] px-1.5 py-0.5"><span className="text-slate-500">{l} </span><span className="font-mono text-white">{fmtPrice(t[s]?.price)}</span> <span className="font-mono" style={{ color: toneOf(t[s]?.changePct) }}>{fmtPct(t[s]?.changePct)}</span></div>)}</div>
      {n > 2 ? <Lines series={[{ name: "VIX/VIX3M", color: "#f472b6", values: ratio }, { name: "1.0", color: "#64748b", values: ratio.map(() => 1), dash: true }]} xLabels={d.map((x) => x.slice(5))} height={150} fmt={(x) => x.toFixed(2)} /> : <Loading text={pack.loading ? undefined : "暂无日线"} />}
      <Note>实时比值 {f2(live, 3)}：低于 1 为正常升水，高于 1 为期限结构倒挂（短期恐慌）。</Note>
    </div>
  );
}

function SovSpreads({ report }: { report: Report }) {
  const s = usePolled<Sov>("ucHubs.sovereign", {}, 3600_000);
  const rows = (s.data?.countries ?? []).filter((c) => c.code !== "DE" && c.spread != null).slice(0, 14);
  useEffect(() => { if (rows.length) report([["国家", "月份", "10年收益率(%)", "对德利差(bp)", "12个月变动(bp)"], ...rows.map((c) => [c.name, c.date, c.y, c.spread, c.chg12m])]); }, [s.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return <Loading text={s.loading ? undefined : "暂无数据"} />;
  return (
    <div>
      <Bars data={rows.map((c) => ({ k: c.name, v: c.spread! }))} fmt={(v) => `${v.toFixed(0)}bp`} height={130} />
      <div className="flex flex-wrap gap-x-3 px-2 text-[10px]">{rows.slice(0, 8).map((c) => <span key={c.code}><span className="text-slate-400">{c.name}</span> <span className="font-mono text-white">{c.spread}</span><span className="font-mono" style={{ color: toneOf(c.chg12m) }}>（12月 {c.chg12m == null ? "—" : `${c.chg12m > 0 ? "+" : ""}${c.chg12m}`}）</span></span>)}</div>
      <Note>欧盟各国 10 年期国债收益率（月度）减德国同期限，单位 bp；单名主权 CDS 无公开数据，以对德利差衡量主权信用风险。</Note>
    </div>
  );
}

/* ------------------------------------------------------------------ 卡片目录 */
type Def = { title: string; category: string; tf: boolean; symbols: string[]; render: (tf: Timeframe, report: Report) => React.ReactNode };
const CATALOG: Record<string, Def> = {
  "yield-curve": { title: "美债 / 欧元区 AAA 收益率曲线", category: "主权债", tf: true, symbols: [], render: (tf, r) => <YieldCurve tf={tf} report={r} /> },
  "credit-spread": { title: "信用风险溢价（相对国债超额收益）", category: "信用债", tf: true, symbols: CREDIT, render: (tf, r) => <CreditPremium tf={tf} report={r} /> },
  "vol-surface": { title: "期权隐含波动率微笑", category: "衍生品", tf: false, symbols: ["SPY"], render: (_tf, r) => <VolSmile report={r} /> },
  "sector-perf": { title: "行业板块收益率对比", category: "股票", tf: true, symbols: SECTORS.map(([s]) => s), render: (tf, r) => <SectorPerf tf={tf} report={r} /> },
  "macro-radar": { title: "美债期限利差（2s10s / 3m10y / 5s30）", category: "利率", tf: true, symbols: [], render: (tf, r) => <TermSpreads tf={tf} report={r} /> },
  "bond-flow": { title: "美债拍卖需求（认购倍数 / 投标结构）", category: "资金面", tf: true, symbols: [], render: (tf, r) => <AuctionDemand tf={tf} report={r} /> },
  "fx-rate": { title: "主要汇率走势（起点为 100）", category: "外汇", tf: true, symbols: ["EURUSD", "USDJPY", "USDCNH", "GBPUSD", "DXY"], render: (tf, r) => <NormalizedLines syms={["DXY", "EURUSD", "USDJPY", "USDCNH", "GBPUSD"]} labels={["美元指数", "欧元/美元", "美元/日元", "美元/离岸人民币", "英镑/美元"]} colors={["#e2e8f0", "#38bdf8", "#f472b6", "#f2495c", "#a78bfa"]} tf={tf} report={r} note="各汇率按区间起点归一为 100。" /> },
  commodity: { title: "大宗商品价格监控（起点为 100）", category: "大宗商品", tf: true, symbols: ["CL", "GC", "HG", "NG", "SI"], render: (tf, r) => <NormalizedLines syms={["CL", "GC", "SI", "HG", "NG"]} labels={["WTI 原油", "黄金", "白银", "铜", "天然气"]} colors={["#fbbf24", "#facc15", "#cbd5e1", "#fb923c", "#38bdf8"]} tf={tf} report={r} note="期货主力连续合约，按区间起点归一为 100。" /> },
  "equity-heatmap": { title: "全球股指热力图", category: "股票", tf: false, symbols: HEAT.map(([s]) => s), render: (_tf, r) => <EquityHeat report={r} /> },
  "rates-monitor": { title: "美元利率监控", category: "利率", tf: true, symbols: ["^IRX", "^FVX", "^TNX", "^TYX"], render: (tf, r) => <RatesMonitor tf={tf} report={r} /> },
  "vix-term": { title: "VIX 期限结构", category: "衍生品", tf: true, symbols: ["^VIX", "^VIX3M", "^VVIX", "^SKEW"], render: (tf, r) => <VixTerm tf={tf} report={r} /> },
  "credit-cds": { title: "欧元区主权利差（对德国 10 年）", category: "信用市场", tf: false, symbols: [], render: (_tf, r) => <SovSpreads report={r} /> },
};
const DEFAULT_IDS = ["yield-curve", "credit-spread", "vol-surface", "sector-perf", "macro-radar", "bond-flow"];
const EXTRA_IDS = ["fx-rate", "commodity", "equity-heatmap", "rates-monitor", "vix-term", "credit-cds"];

interface ChartCard { id: string; pinned: boolean; starred: boolean; tf: Timeframe }
const DEFAULT_CARDS: ChartCard[] = [
  { id: "yield-curve", pinned: true, starred: true, tf: "1Y" },
  { id: "credit-spread", pinned: true, starred: true, tf: "3M" },
  { id: "vol-surface", pinned: false, starred: true, tf: "1M" },
  { id: "sector-perf", pinned: true, starred: false, tf: "1M" },
  { id: "macro-radar", pinned: false, starred: true, tf: "1Y" },
  { id: "bond-flow", pinned: false, starred: false, tf: "3M" },
];

/* ------------------------------------------------------------------ 主组件 */
export default function PersonalWorkspaceLive() {
  const [picked, setPicked] = useState<string | null>(null);
  const saved = useSaved<{ cards: ChartCard[] }>("workspace");
  const [cards, setCards] = useState<ChartCard[]>(DEFAULT_CARDS);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"pinned" | "starred" | "all">("pinned");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const rowsRef = useRef<Record<string, CsvRows>>({});

  useEffect(() => {
    if (loaded || saved.loading) return;
    const list = saved.data?.cards?.filter((c) => CATALOG[c.id]);
    if (list?.length) setCards(list);
    setLoaded(true);
  }, [saved.data, saved.loading, loaded]);

  const update = useCallback((fn: (prev: ChartCard[]) => ChartCard[]) => {
    setCards((prev) => {
      const next = fn(prev);
      void saveItem("workspace", { cards: next }).catch(() => toast.error("布局保存失败"));
      return next;
    });
  }, []);

  const toggle = (id: string, key: "pinned" | "starred") => {
    const c = cards.find((x) => x.id === id);
    update((prev) => prev.map((x) => (x.id === id ? { ...x, [key]: !x[key] } : x)));
    toast.success(key === "pinned" ? (c?.pinned ? "已从看板移除" : "已固定到看板") : c?.starred ? "已取消收藏" : "已收藏");
  };
  const move = (id: string, dir: -1 | 1) => update((prev) => { const i = prev.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= prev.length) return prev; const n = [...prev]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const remove = (id: string) => update((prev) => prev.filter((x) => x.id !== id));
  const exportCSV = (card: ChartCard) => {
    const rows = rowsRef.current[card.id];
    if (!rows?.length) return toast.error("数据尚未就绪");
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${CATALOG[card.id].title}_${card.tf}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const reporters = useMemo(() => Object.fromEntries(Object.keys(CATALOG).map((id) => [id, (rows: CsvRows) => { rowsRef.current[id] = rows; }])) as Record<string, Report>, []);

  const display = cards.filter((c) => (activeTab === "pinned" ? c.pinned : activeTab === "starred" ? c.starred : true));
  const pinnedCount = cards.filter((c) => c.pinned).length;
  const starredCount = cards.filter((c) => c.starred).length;
  const symbolCount = new Set(cards.flatMap((c) => CATALOG[c.id]?.symbols ?? [])).size;

  return (
    <HubContext.Provider value={{ pick: setPicked, picked }}>
      <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[#03070c] text-slate-200">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1">
          <span className="font-mono text-[11px] text-amber-300">WKSP</span>
          <span className="text-[13px] font-semibold text-white">个性化工作台</span>
          <span className="text-[10px] text-slate-500">收藏、固定并排列常用图表；布局自动永久保存</span>
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => { setRefreshKey((k) => k + 1); toast.success("已重新拉取全部图表数据"); }} className="border border-[#1d3047] px-2 py-0.5 text-[11px] text-slate-300 hover:text-white">刷新数据</button>
            <button type="button" onClick={() => setShowAdd((v) => !v)} className={`border px-2 py-0.5 text-[11px] ${showAdd ? "border-cyan-600 text-cyan-200" : "border-[#1d3047] text-slate-300 hover:text-white"}`}>添加图表</button>
          </span>
        </div>

        {showAdd && (
          <div className="border-b border-[#1a2a3c] bg-[#050b13]">
            <table className="w-full text-[11px]">
              <tbody>
                {[...DEFAULT_IDS, ...EXTRA_IDS].map((id) => {
                  const added = cards.some((c) => c.id === id);
                  return (
                    <tr key={id} className="border-t border-[#0f1b29]">
                      <td className="w-20 px-2 py-0.5 text-[10px] text-slate-500">{CATALOG[id].category}</td>
                      <td className="text-slate-200">{CATALOG[id].title}</td>
                      <td className="px-2 text-right">{added ? <span className="text-[10px] text-slate-600">已在工作台</span> : <button type="button" onClick={() => { update((prev) => [...prev, { id, pinned: true, starred: false, tf: "3M" }]); toast.success(`已添加「${CATALOG[id].title}」并固定到看板`); }} className="border border-cyan-700 px-2 text-[10px] text-cyan-200">添加</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] sm:grid-cols-4">
          {([["已固定图表", pinnedCount], ["已收藏图表", starredCount], ["工作台图表", cards.length], ["跟踪标的", symbolCount]] as Array<[string, number]>).map(([k, v]) => <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div></div>)}
        </div>

        <nav className="flex border-b border-[#1a2a3c] bg-[#050b13]">
          {([["pinned", `已固定（${pinnedCount}）`], ["starred", `已收藏（${starredCount}）`], ["all", `全部（${cards.length}）`]] as Array<[typeof activeTab, string]>).map(([id, l]) => <button key={id} type="button" onClick={() => setActiveTab(id)} className={`border-r border-[#111d2b] px-2.5 py-1 text-[11px] ${activeTab === id ? "bg-[#0d2236] text-white shadow-[inset_0_-2px_0_#22d3ee]" : "text-slate-400 hover:bg-[#0a1726]"}`}>{l}</button>)}
        </nav>

        <div className={`grid min-h-0 flex-1 ${picked ? "lg:grid-cols-[minmax(0,1fr)_minmax(380px,36%)]" : ""}`}>
          <div className="min-w-0">
            {display.length === 0 ? (
              <div className="px-3 py-12 text-[11px] text-slate-500">暂无{activeTab === "pinned" ? "固定" : "收藏"}的图表，在“全部”中点击 固定 / 收藏。</div>
            ) : (
              <div key={refreshKey} className="grid grid-cols-1 gap-px bg-[#1a2a3c] md:grid-cols-2 2xl:grid-cols-3">
                {display.map((card) => {
                  const def = CATALOG[card.id];
                  const idx = cards.findIndex((c) => c.id === card.id);
                  return (
                    <div key={card.id} className="bg-[#03070c]">
                      <div className="flex items-center gap-1 border-b border-[#0f1b29] bg-[#060d16] px-2 py-1">
                        <span className="text-[10px] text-slate-500">{def.category}</span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">{def.title}</span>
                        <button type="button" title="前移" disabled={idx <= 0} onClick={() => move(card.id, -1)} className="px-1 text-[11px] text-slate-500 hover:text-white disabled:opacity-30">◀</button>
                        <button type="button" title="后移" disabled={idx >= cards.length - 1} onClick={() => move(card.id, 1)} className="px-1 text-[11px] text-slate-500 hover:text-white disabled:opacity-30">▶</button>
                        <button type="button" onClick={() => toggle(card.id, "starred")} className={`px-1 text-[11px] ${card.starred ? "text-yellow-300" : "text-slate-600 hover:text-yellow-300"}`}>{card.starred ? "★" : "☆"}</button>
                        <button type="button" onClick={() => toggle(card.id, "pinned")} className={`px-1 text-[10px] ${card.pinned ? "text-cyan-300" : "text-slate-600 hover:text-cyan-300"}`}>{card.pinned ? "已固定" : "固定"}</button>
                        <button type="button" onClick={() => exportCSV(card)} className="px-1 text-[10px] text-slate-500 hover:text-emerald-300">导出</button>
                        <button type="button" onClick={() => remove(card.id)} className="px-1 text-[10px] text-slate-600 hover:text-rose-300">移除</button>
                      </div>
                      {def.tf && (
                        <div className="flex gap-px px-2 pt-1">
                          {(Object.keys(TF_DAYS) as Timeframe[]).map((t) => <button key={t} type="button" onClick={() => update((prev) => prev.map((c) => (c.id === card.id ? { ...c, tf: t } : c)))} className={`px-1.5 text-[10px] ${card.tf === t ? "bg-cyan-800/50 text-cyan-50" : "text-slate-500 hover:text-white"}`}>{t}</button>)}
                        </div>
                      )}
                      <div className="pb-2">{def.render(card.tf, reporters[card.id])}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {picked && <div className="min-h-[480px] border-l border-[#1a2a3c] bg-[#050a11]"><SymbolPane symbol={picked} onClose={() => setPicked(null)} /></div>}
        </div>
      </div>
    </HubContext.Provider>
  );
}
