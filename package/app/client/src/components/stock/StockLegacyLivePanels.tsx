import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Database, RefreshCw, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  EnvironmentObservationDesk,
  ObservationViews,
  ResearchSplit,
  TickerObservationDesk,
} from "./StockObservationDesk";

export type StockLegacyLiveMode =
  | "gf"
  | "gipo"
  | "corr"
  | "most"
  | "anr"
  | "rv"
  | "ddis"
  | "omon"
  | "weif"
  | "rrg"
  | "port"
  | "ds"
  | "bi-stox"
  | "fsrc"
  | "cact"
  | "ipo";

type WatchRow = {
  ticker: string;
  status: "available" | "unavailable";
  price: number | null;
  changePct: number | null;
  currency: string | null;
  points: number;
  latestDate: string | null;
  source: string | null;
  retrievedAt: string | null;
  history: Array<{ date: string; value: number; volume?: number | null }>;
};
type Issuer = { cik: string; ticker: string; name: string };
type Filing = {
  form: string;
  filingDate: string | null;
  accessionNumber: string | null;
  primaryDocument: string | null;
  category: string;
};
type FactMetric = {
  id: string;
  label: string;
  unit: string;
  latestObservationDate: string;
  totalObservations: number;
  observations: Array<{
    id: string;
    start: string | null;
    end: string;
    filed: string | null;
    form: string;
    value: number;
    periodType: string;
    accessionNumber: string | null;
  }>;
};

const meta: Record<StockLegacyLiveMode, { code: string; name: string; duty: string }> = {
  gf: { code: "GF", name: "基本面图表", duty: "SEC XBRL 事实、报告期与市场价格分域核验" },
  gipo: { code: "GIPO", name: "日内价格图", duty: "日内来源就绪度与公共日频价格边界" },
  corr: { code: "CORR", name: "我的相关系数矩阵", duty: "共同观察日收益相关性与样本审计" },
  most: { code: "MOST", name: "最活跃证券", duty: "用户限定证券池的实际成交量覆盖排序" },
  anr: { code: "ANR", name: "分析师建议", duty: "一致预期许可边界与公开证据核验" },
  rv: { code: "RV", name: "相对价值", duty: "两证券共同观察日的相对价格路径" },
  ddis: { code: "DDIS", name: "股息分配", duty: "公司行动来源就绪度与 SEC 披露证据" },
  omon: { code: "OMON", name: "期权行情", duty: "期权链许可状态与标的实际价格联动" },
  weif: { code: "WEIF", name: "全球股指期货", duty: "期货许可状态与公开宏观基准观察" },
  rrg: { code: "RRG", name: "相对旋转图", duty: "实际日频价格的相对强度与动量轨迹" },
  port: { code: "PORT", name: "投资组合与风险分析", duty: "透明持仓输入、价格覆盖与集中度复算" },
  ds: { code: "DS", name: "文件检索", duty: "SEC 主文件定位、关键词检索与原文证据" },
  "bi-stox": { code: "BI STOX", name: "佑诚行业研究", duty: "同一主体的 SEC XBRL 指标与申报版本" },
  fsrc: { code: "FSRC", name: "基金筛选", duty: "用户限定基金代码的来源覆盖、时效与历史深度" },
  cact: { code: "CACT", name: "公司大事检索", duty: "SEC 事件申报时间线与公司行动数据边界" },
  ipo: { code: "IPO", name: "股票发行", duty: "IPO 注册文件版本、日期和来源证据" },
};

const tip = {
  contentStyle: {
    background: "#07111d",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 10,
  },
};
const input = "h-7 border border-slate-700 bg-black px-2 font-mono text-[11px] text-slate-200 outline-none focus:border-cyan-700";
const button = "inline-flex h-7 items-center gap-1 border border-slate-700 px-2 text-[10px] text-slate-300 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40";

function Shell({ mode, onClose, status, children }: { mode: StockLegacyLiveMode; onClose?: () => void; status: string; children: React.ReactNode }) {
  const item = meta[mode];
  return <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#05080d] font-mono text-xs text-slate-200" aria-label={`${item.code} ${item.name}`}>
    <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2">
      <div className="min-w-0"><b className="text-sm text-cyan-200">{item.code}</b><span className="ml-2 text-slate-200">{item.name}</span><span className="ml-2 text-[10px] text-slate-500">{item.duty}</span></div>
      <div className="ml-2 flex shrink-0 items-center gap-2"><span role="status" className="text-[9px] text-slate-500">{status}</span>{onClose && <button type="button" aria-label={`关闭${item.name}`} onClick={onClose} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>}</div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    <footer className="shrink-0 border-t border-slate-800 px-3 py-1 text-[9px] leading-5 text-slate-500">唯一职责：{item.duty}。所有数值保留来源、观察日和非实时边界；缺失字段不补静态样例。</footer>
  </section>;
}

function percentReturns(history: WatchRow["history"]) {
  return history.slice(1).flatMap((point, index) => {
    const previous = history[index]?.value;
    return Number.isFinite(point.value) && previous > 0
      ? [{ date: point.date, value: point.value / previous - 1 }]
      : [];
  });
}

function commonReturns(left: WatchRow, right: WatchRow) {
  const a = new Map(percentReturns(left.history).map(row => [row.date, row.value]));
  return percentReturns(right.history).flatMap(row => a.has(row.date) ? [{ date: row.date, left: a.get(row.date)!, right: row.value }] : []);
}

function correlation(left: WatchRow, right: WatchRow) {
  const rows = commonReturns(left, right);
  if (rows.length < 3) return null;
  const meanA = rows.reduce((sum, row) => sum + row.left, 0) / rows.length;
  const meanB = rows.reduce((sum, row) => sum + row.right, 0) / rows.length;
  const covariance = rows.reduce((sum, row) => sum + (row.left - meanA) * (row.right - meanB), 0);
  const varianceA = rows.reduce((sum, row) => sum + (row.left - meanA) ** 2, 0);
  const varianceB = rows.reduce((sum, row) => sum + (row.right - meanB) ** 2, 0);
  return varianceA > 0 && varianceB > 0 ? covariance / Math.sqrt(varianceA * varianceB) : null;
}

function parseTickers(value: string) {
  return Array.from(new Set(value.toUpperCase().split(/[\s,;]+/).map(item => item.replace(/[^A-Z0-9.^=-]/g, "")).filter(Boolean))).slice(0, 10);
}

function UniverseWorkbench({ mode, onClose }: { mode: "corr" | "most" | "rrg" | "fsrc"; onClose?: () => void }) {
  const defaults = mode === "fsrc" ? "SPY,QQQ,IWM,EFA,TLT" : "AAPL,MSFT,NVDA,SPY,QQQ";
  const [draft, setDraft] = useState(defaults);
  const [tickers, setTickers] = useState(parseTickers(defaults));
  const [selected, setSelected] = useState(tickers[0]);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery({ tickers, range: "1y", includeHistory: true }, { staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true, retry: false });
  const rows = (query.data?.rows ?? []) as WatchRow[];
  const available = rows.filter(row => row.status === "available" && row.history.length > 1);
  const selectedRow = rows.find(row => row.ticker === selected) ?? available[0];
  const submit = (event: FormEvent) => { event.preventDefault(); const next = parseTickers(draft); if (next.length) { setTickers(next); setSelected(next[0]); } };
  const volumeRanks = useMemo(() => available.map(row => {
    const volumes = row.history.map(point => point.volume).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const latest = volumes.at(-1) ?? null;
    const average = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : null;
    return { ...row, latestVolume: latest, averageVolume: average, volumeRatio: latest != null && average ? latest / average : null };
  }).sort((a, b) => (b.latestVolume ?? -1) - (a.latestVolume ?? -1)), [available]);
  const rrg = useMemo(() => available.flatMap(row => {
    const points = row.history.map(point => point.value).filter(value => value > 0);
    if (points.length < 45) return [];
    const last = points.at(-1)!; const one = points.at(-22)!; const two = points.at(-44)!;
    return [{ ticker: row.ticker, strength: (last / one - 1) * 100, momentum: ((last / one) / (one / two) - 1) * 100, points: points.length }];
  }), [available]);
  return <Shell mode={mode} onClose={onClose} status={query.isFetching ? "正在刷新公共日频观察" : query.isError ? "来源读取失败" : `${available.length}/${rows.length} 可读`}>
    <form role="toolbar" onSubmit={submit} className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><label className="min-w-64 flex-1 text-[10px] text-slate-500">限定证券池（最多10个）<input aria-label={`${meta[mode].code}证券池`} value={draft} onChange={event => setDraft(event.target.value)} className={`${input} ml-2 min-w-56`} /></label><button type="submit" disabled={!parseTickers(draft).length || query.isFetching} className={button}><RefreshCw className="h-3 w-3" />读取并去重</button><span className="text-[9px] text-slate-500">非全市场排名 · 每60秒核验</span></form>
    {query.isLoading ? <p role="status" className="p-6 text-slate-500">正在读取实际公共日频历史…</p> : query.isError ? <p role="alert" className="p-6 text-amber-200">公共来源读取失败；旧观察不得继续标记为实时。</p> : mode === "corr" ? <ResearchSplit label="相关矩阵与样本明细" left={<div className="overflow-auto"><table className="w-full min-w-[470px] text-center text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">收益相关</th>{available.map(row => <th key={row.ticker}>{row.ticker}</th>)}</tr></thead><tbody>{available.map(left => <tr key={left.ticker} className="border-t border-slate-800"><th className="p-2 text-left text-cyan-200">{left.ticker}</th>{available.map(right => { const value = left.ticker === right.ticker ? 1 : correlation(left, right); return <td key={right.ticker} className="p-2 font-mono" style={{ background: value == null ? "#111827" : value >= 0 ? `rgba(16,185,129,${Math.abs(value) * .45})` : `rgba(244,63,94,${Math.abs(value) * .45})` }}>{value == null ? "—" : value.toFixed(4)}</td>; })}</tr>)}</tbody></table></div>} right={<div className="p-3"><h3 className="mb-2 text-cyan-200">共同观察日审计</h3><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="py-2">证券对</th><th>共同收益日</th><th>相关系数</th><th>截至</th></tr></thead><tbody>{available.slice(0, 1).flatMap(left => available.slice(1).map(right => { const samples = commonReturns(left, right); return <tr key={right.ticker} className="border-t border-slate-800"><td className="py-2 text-cyan-200">{left.ticker}/{right.ticker}</td><td>{samples.length}</td><td>{correlation(left, right)?.toFixed(4) ?? "—"}</td><td>{samples.at(-1)?.date ?? "—"}</td></tr>; }))}</tbody></table><p className="mt-3 text-[10px] leading-5 text-slate-500">按共同日期的简单日收益计算 Pearson 相关；至少3个共同收益日。缺日不前填，不把价格水平直接相关。</p></div>} /> : mode === "most" ? <div className="grid min-h-[430px] lg:grid-cols-[1.1fr_.9fr]"><div className="overflow-auto border-r border-slate-800"><table className="w-full min-w-[650px] text-right text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">排名 / 证券</th><th>最新实际成交量</th><th>窗口均量</th><th>量比</th><th>收盘变化%</th><th className="p-2">观察日 / 来源</th></tr></thead><tbody>{volumeRanks.map((row, index) => <tr key={row.ticker} className="border-t border-slate-800"><td className="p-2 text-left text-cyan-200">{index + 1} · {row.ticker}</td><td>{row.latestVolume?.toLocaleString() ?? "—"}</td><td>{row.averageVolume?.toFixed(0) ?? "—"}</td><td>{row.volumeRatio?.toFixed(3) ?? "—"}</td><td>{row.changePct?.toFixed(4) ?? "—"}</td><td className="p-2">{row.latestDate ?? "—"}<span className="block text-slate-500">{row.source ?? "来源未返回"}</span></td></tr>)}</tbody></table></div><div className="h-[420px] p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={volumeRanks}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="ticker" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tip} /><Bar dataKey="latestVolume" name="最新实际日成交量" fill="#22d3ee" isAnimationActive={false} /></BarChart></ResponsiveContainer><p className="text-[9px] text-slate-500">只在用户输入证券池中排序，不声称全市场最活跃。</p></div></div> : mode === "rrg" ? <div className="grid min-h-[430px] lg:grid-cols-[.72fr_1.28fr]"><div className="overflow-auto border-r border-slate-800"><table className="w-full text-right text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">证券</th><th>近21观测强度%</th><th>动量变化%</th><th className="p-2">样本</th></tr></thead><tbody>{rrg.map(row => <tr key={row.ticker} className="border-t border-slate-800"><td className="p-2 text-left text-cyan-200">{row.ticker}</td><td>{row.strength.toFixed(4)}</td><td>{row.momentum.toFixed(4)}</td><td className="p-2">{row.points}</td></tr>)}</tbody></table><p className="p-2 text-[9px] leading-5 text-slate-500">横轴=最近21个有效观察的价格变化；纵轴=最近窗口相对上一窗口的变化。不是指数供应商 RRG 方法，也不生成交易象限。</p></div><div className="h-[420px] p-3">{rrg.length ? <ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke="#1e293b" /><XAxis type="number" dataKey="strength" name="相对强度" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis type="number" dataKey="momentum" name="动量变化" tick={{ fill: "#94a3b8", fontSize: 9 }} /><ZAxis range={[65, 65]} /><Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} /><Scatter data={rrg} name="实际价格窗口" fill="#a78bfa" /></ScatterChart></ResponsiveContainer> : <p role="status" className="p-6 text-amber-200">至少需要45个有效日频观察才能定位。</p>}</div></div> : <ResearchSplit label="基金覆盖与价格历史" left={<div className="overflow-auto"><table className="w-full min-w-[520px] text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">基金代码</th><th>来源状态</th><th>历史点数</th><th>最新观察</th><th>来源</th></tr></thead><tbody>{rows.map(row => <tr key={row.ticker} className={`border-t border-slate-800 ${selectedRow?.ticker === row.ticker ? "bg-cyan-950/30" : ""}`}><td className="p-2"><button type="button" onClick={() => setSelected(row.ticker)} className="text-cyan-200">{row.ticker}</button></td><td className={row.status === "available" ? "text-emerald-300" : "text-amber-200"}>{row.status === "available" ? "可读" : "不可读"}</td><td>{row.points}</td><td>{row.latestDate ?? "—"}</td><td>{row.source ?? "—"}</td></tr>)}</tbody></table><p className="p-2 text-[9px] leading-5 text-slate-500">筛选维度限定为代码、覆盖、时效和历史深度；基金分类、费用、净值、持仓和资金流来源未配置时不伪造。</p></div>} right={selectedRow ? <ObservationViews id={`FSRC:${selectedRow.ticker}`} title={`${selectedRow.ticker} 基金交易价格`} history={selectedRow.history} unit={selectedRow.currency ?? "币种未返回"} source={selectedRow.source ?? "来源未返回"} observedAt={selectedRow.latestDate} queriedAt={selectedRow.retrievedAt} initialView="history" allowedViews={["history", "curve", "distribution", "rows"]} /> : <p role="status" className="p-6 text-amber-200">没有可读基金价格历史。</p>} />}
  </Shell>;
}

function RelativeValuePanel({ onClose }: { onClose?: () => void }) {
  const [draftLeft, setDraftLeft] = useState("AAPL"); const [draftRight, setDraftRight] = useState("MSFT");
  const [pair, setPair] = useState<[string, string]>(["AAPL", "MSFT"]);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery({ tickers: pair, range: "1y", includeHistory: true }, { staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true, retry: false });
  const rows = (query.data?.rows ?? []) as WatchRow[]; const left = rows[0]; const right = rows[1];
  const path = useMemo(() => { if (!left || !right) return []; const map = new Map(left.history.map(row => [row.date, row.value])); const joined = right.history.flatMap(row => map.has(row.date) ? [{ date: row.date, left: map.get(row.date)!, right: row.value }] : []); const start = joined[0]; return start && start.left > 0 && start.right > 0 ? joined.map(row => ({ date: row.date, left: row.left / start.left * 100, right: row.right / start.right * 100, spread: row.left / start.left * 100 - row.right / start.right * 100 })) : []; }, [left, right]);
  const submit = (event: FormEvent) => { event.preventDefault(); const tickers = parseTickers(`${draftLeft},${draftRight}`); if (tickers.length === 2) setPair([tickers[0], tickers[1]]); };
  return <Shell mode="rv" onClose={onClose} status={query.isFetching ? "正在刷新共同窗口" : query.isError ? "来源读取失败" : `${path.length} 个共同观察日`}><form onSubmit={submit} role="toolbar" className="flex flex-wrap gap-2 border-b border-slate-800 p-2"><input aria-label="相对价值证券A" value={draftLeft} onChange={e => setDraftLeft(e.target.value)} className={input} /><span className="self-center text-slate-600">对</span><input aria-label="相对价值证券B" value={draftRight} onChange={e => setDraftRight(e.target.value)} className={input} /><button type="submit" className={button}>对齐实际历史</button></form>{path.length ? <ResearchSplit label="相对价格路径与共同日明细" left={<table className="w-full text-right text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">观察日</th><th>{pair[0]}=100</th><th>{pair[1]}=100</th><th className="p-2">相对差</th></tr></thead><tbody>{[...path].reverse().slice(0, 80).map(row => <tr key={row.date} className="border-t border-slate-800"><td className="p-2 text-left">{row.date}</td><td>{row.left.toFixed(4)}</td><td>{row.right.toFixed(4)}</td><td className="p-2">{row.spread.toFixed(4)}</td></tr>)}</tbody></table>} right={<div className="h-[420px] p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={path}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="date" minTickGap={26} tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tip} /><Legend /><Line dataKey="left" name={`${pair[0]} 起点=100`} stroke="#22d3ee" dot={false} isAnimationActive={false} /><Line dataKey="right" name={`${pair[1]} 起点=100`} stroke="#fbbf24" dot={false} isAnimationActive={false} /><Line dataKey="spread" name="相对差" stroke="#a78bfa" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>} /> : <p role="status" className="p-6 text-amber-200">两证券需要同币种语义下的共同有效日频观察；当前不足，不生成价差。</p>}<p className="border-t border-slate-800 p-2 text-[9px] text-slate-500">仅比较各自起点归一化价格路径；不等同配对交易、估值价差、协整或可执行套利。</p></Shell>;
}

function BoundaryPanel({ mode, onClose }: { mode: "gipo" | "omon" | "weif"; onClose?: () => void }) {
  const [tab, setTab] = useState<"evidence" | "required">("evidence");
  const definitions = mode === "gipo" ? [
    ["分钟时间戳", "未配置", "交易所或许可分钟行情"], ["成交价/量", "未配置", "逐笔或聚合成交源"], ["买卖价", "未配置", "许可报价源"], ["公共日频收盘", "可按代码读取", "现有公共历史通道"],
  ] : mode === "omon" ? [
    ["合约代码", "未配置", "OPRA/交易所许可"], ["到期日/行权价", "未配置", "期权主数据"], ["Bid/Ask/成交/持仓", "未配置", "许可期权链"], ["标的日频价格", "可按代码读取", "现有公共历史通道"],
  ] : [
    ["期货合约代码", "未配置", "期货交易所许可"], ["结算价/基差", "未配置", "结算与现货基准"], ["持仓/成交量", "未配置", "交易所统计"], ["宏观基准历史", "可读取", "FRED 公开历史"],
  ];
  return <Shell mode={mode} onClose={onClose} status={mode === "weif" ? "期货源未配置 · FRED基准可读" : "许可明细源未配置"}><nav role="tablist" aria-label={`${meta[mode].code}子页面`} className="flex border-b border-slate-800"><button type="button" role="tab" aria-selected={tab === "evidence"} onClick={() => setTab("evidence")} className={`border-r border-slate-800 px-3 py-2 text-[10px] ${tab === "evidence" ? "bg-cyan-950/40 text-cyan-200" : "text-slate-500"}`}>{mode === "weif" ? "公开基准观察" : "标的价格证据"}</button><button type="button" role="tab" aria-selected={tab === "required"} onClick={() => setTab("required")} className={`border-r border-slate-800 px-3 py-2 text-[10px] ${tab === "required" ? "bg-cyan-950/40 text-cyan-200" : "text-slate-500"}`}>专业字段就绪度</button></nav>{tab === "evidence" ? mode === "weif" ? <EnvironmentObservationDesk initialSeries="SP500" initialView="curve" mode="index" /> : <TickerObservationDesk defaultTicker={mode === "omon" ? "AAPL" : "SPY"} title={mode === "omon" ? "期权标的日频证据" : "日内图的日频校验基线"} initialView={mode === "omon" ? "history" : "curve"} focus={mode === "omon" ? "quote" : "range"} /> : <div className="overflow-auto"><table className="w-full min-w-[700px] text-left text-[11px]"><thead className="text-slate-500"><tr><th className="p-3">字段</th><th>当前状态</th><th>唯一来源要求</th><th className="p-3">处理</th></tr></thead><tbody>{definitions.map(([field, status, source]) => <tr key={field} className="border-t border-slate-800"><td className="p-3 text-cyan-200">{field}</td><td className={status === "未配置" ? "text-amber-200" : "text-emerald-300"}>{status}</td><td>{source}</td><td className="p-3">{status === "未配置" ? "保持空值并禁用相关计算" : "保留来源、频率和观察日"}</td></tr>)}</tbody></table><p className="p-3 text-[10px] leading-5 text-slate-500">本页不使用随机路径、固定期权链或过期合约。配置合法许可源后，字段将在原页面位置增量接入。</p></div>}</Shell>;
}

function PortfolioPanel({ onClose }: { onClose?: () => void }) {
  const [draft, setDraft] = useState("");
  const parsed = useMemo(() => {
    if (!draft.trim()) return { rows: [] as Array<{ ticker: string; weight: number }>, error: "" };
    try { const value = JSON.parse(draft); if (!Array.isArray(value)) return { rows: [], error: "持仓必须是 JSON 数组。" }; const seen = new Set<string>(); const rows = value.flatMap(item => { const ticker = String(item?.ticker ?? "").trim().toUpperCase().replace(/[^A-Z0-9.^=-]/g, "").slice(0, 15); const weight = Number(item?.weight); if (!ticker || !Number.isFinite(weight) || weight < 0 || seen.has(ticker)) return []; seen.add(ticker); return [{ ticker, weight }]; }).slice(0, 10); return { rows, error: rows.length || !value.length ? "" : "没有有效且唯一的非负权重持仓。" }; } catch { return { rows: [], error: "JSON 格式无效。" }; }
  }, [draft]);
  const tickers = parsed.rows.map(row => row.ticker);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery({ tickers: tickers.length ? tickers : ["INVALID"], range: "1y", includeHistory: true }, { enabled: tickers.length > 0, retry: false, staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true });
  const observations = (query.data?.rows ?? []) as WatchRow[]; const map = new Map(observations.map(row => [row.ticker, row]));
  const rows = parsed.rows.map(row => ({ ...row, observation: map.get(row.ticker), contribution: (map.get(row.ticker)?.changePct ?? 0) * row.weight / 100 }));
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0); const hhi = rows.reduce((sum, row) => sum + (row.weight / Math.max(totalWeight, 1)) ** 2, 0);
  return <Shell mode="port" onClose={onClose} status={!rows.length ? "等待账户持仓输入" : query.isFetching ? "正在刷新持仓价格" : `${observations.filter(row => row.status === "available").length}/${rows.length} 价格可读`}><div className="grid min-h-[430px] lg:grid-cols-[.72fr_1.28fr]"><div className="border-r border-slate-800 p-3"><label className="text-[10px] leading-5 text-slate-500">持仓 JSON（ticker、weight；不上传、不保存）<textarea aria-label="PORT持仓输入" value={draft} onChange={event => setDraft(event.target.value)} placeholder='[{"ticker":"AAPL","weight":40}]' className={`${input} mt-2 min-h-44 w-full py-2`} /></label>{parsed.error && <p role="alert" className="mt-2 text-amber-200">{parsed.error}</p>}<table className="mt-3 w-full text-left text-[10px]"><tbody><tr className="border-t border-slate-800"><th className="p-2 font-normal text-slate-500">输入权重</th><td>{totalWeight.toFixed(4)}%</td></tr><tr className="border-t border-slate-800"><th className="p-2 font-normal text-slate-500">集中度 HHI</th><td>{rows.length ? hhi.toFixed(6) : "—"}</td></tr><tr className="border-t border-slate-800"><th className="p-2 font-normal text-slate-500">未覆盖权重</th><td>{Math.max(0, 100 - totalWeight).toFixed(4)}%</td></tr></tbody></table></div><div className="overflow-auto"><table className="w-full min-w-[720px] text-right text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">证券</th><th>权重%</th><th>最新日频收盘</th><th>日变化%</th><th>贡献百分点</th><th>观察日</th><th className="p-2">来源状态</th></tr></thead><tbody>{rows.map(row => <tr key={row.ticker} className="border-t border-slate-800"><td className="p-2 text-left text-cyan-200">{row.ticker}</td><td>{row.weight.toFixed(4)}</td><td>{row.observation?.price?.toFixed(4) ?? "—"}</td><td>{row.observation?.changePct?.toFixed(4) ?? "—"}</td><td>{row.observation?.status === "available" ? row.contribution.toFixed(6) : "—"}</td><td>{row.observation?.latestDate ?? "—"}</td><td className="p-2">{row.observation?.status === "available" ? <span className="text-emerald-300">{row.observation.source}</span> : <span className="text-amber-200">不可读</span>}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="p-6 text-left text-slate-500">等待账户级持仓输入；不加载演示组合。</td></tr>}</tbody></table><div className="h-[260px] p-3">{rows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="ticker" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tip} /><Bar dataKey="weight" name="输入权重%" fill="#22d3ee" /><Bar dataKey="contribution" name="日变化贡献百分点" fill="#a78bfa" /></BarChart></ResponsiveContainer> : null}</div></div></div><p className="border-t border-slate-800 p-2 text-[9px] leading-5 text-slate-500">日贡献=输入权重×公共日频收盘变化；不等同账户收益、PnL、VaR 或归因。数量、成本、现金、汇率、基准和交易记录未输入时不补算。</p></Shell>;
}

function SecEvidencePanel({ mode, onClose }: { mode: "gf" | "anr" | "ddis" | "ds" | "bi-stox" | "cact" | "ipo"; onClose?: () => void }) {
  const defaults: Record<typeof mode, string> = { gf: "AAPL", anr: "MSFT", ddis: "KO", ds: "AAPL", "bi-stox": "NVDA", cact: "AAPL", ipo: "RDDT" };
  const [draft, setDraft] = useState(defaults[mode]); const [queryText, setQueryText] = useState(defaults[mode]); const [selected, setSelected] = useState<Issuer | null>(null);
  const [selectedFilingKey, setSelectedFilingKey] = useState(""); const [keyword, setKeyword] = useState("risk"); const [selectedMetricId, setSelectedMetricId] = useState("");
  const search = trpc.stockMarketResearch.searchIssuers.useQuery({ query: queryText || "_", limit: 10 }, { enabled: queryText.trim().length >= 2, staleTime: 60_000, retry: false });
  useEffect(() => { if (!selected && search.data?.results?.length) setSelected(search.data.results[0]); }, [search.data?.results, selected]);
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery({ cik: selected?.cik ?? "0" }, { enabled: Boolean(selected?.cik), staleTime: 60_000, retry: false });
  const facts = trpc.stockMarketResearch.getCompanyFacts.useQuery({ cik: selected?.cik ?? "0" }, { enabled: Boolean(selected?.cik) && (mode === "gf" || mode === "bi-stox"), staleTime: 60_000, retry: false });
  const quote = trpc.stockMarketResearch.getTickerObservation.useQuery({ ticker: selected?.ticker ?? "INVALID", range: "1y", assetClass: "stocks" }, { enabled: Boolean(selected?.ticker) && ["gf", "anr", "ddis"].includes(mode), staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true, retry: false });
  const allFilings = (filings.data?.filings ?? []) as Filing[]; const metrics = (facts.data?.metrics ?? []) as FactMetric[];
  useEffect(() => { if (!selectedMetricId && metrics.length) setSelectedMetricId(metrics[0].id); }, [metrics, selectedMetricId]);
  const selectedMetric = metrics.find(row => row.id === selectedMetricId) ?? metrics[0];
  const filter = mode === "ipo" ? (row: Filing) => ["S-1", "S-1/A", "424B2", "424B3", "424B5"].includes(row.form) : mode === "cact" ? (row: Filing) => ["8-K", "DEFM14A", "10-K", "10-Q"].includes(row.form) : mode === "ddis" ? (row: Filing) => ["8-K", "10-K", "10-Q", "DEFM14A"].includes(row.form) : () => true;
  const visibleFilings = allFilings.filter(filter);
  const filingKey = selectedFilingKey || visibleFilings[0]?.accessionNumber || ""; const selectedFiling = visibleFilings.find(row => row.accessionNumber === filingKey) ?? visibleFilings[0];
  const excerpt = trpc.stockMarketResearch.getFilingExcerpt.useQuery({ cik: selected?.cik ?? "0", accessionNumber: selectedFiling?.accessionNumber ?? "0000000000", primaryDocument: selectedFiling?.primaryDocument ?? "missing.htm", keyword }, { enabled: mode === "ds" && Boolean(selected?.cik && selectedFiling?.accessionNumber && selectedFiling?.primaryDocument && keyword.trim().length >= 2), retry: false });
  const submit = (event: FormEvent) => { event.preventDefault(); setSelected(null); setSelectedFilingKey(""); setSelectedMetricId(""); setQueryText(draft.trim()); };
  const busy = search.isFetching || filings.isFetching || facts.isFetching || quote.isFetching || excerpt.isFetching;
  const status = busy ? "正在读取 SEC / 公共观察" : search.isError || filings.isError || facts.isError || quote.isError ? "来源部分失败" : selected ? `CIK ${selected.cik}` : "等待主体选择";
  return <Shell mode={mode} onClose={onClose} status={status}><form role="toolbar" onSubmit={submit} className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><Search className="h-3 w-3 text-slate-500" /><label className="text-[10px] text-slate-500">SEC 主体或代码<input aria-label={`${meta[mode].code}主体检索`} value={draft} onChange={event => setDraft(event.target.value)} className={`${input} ml-2`} /></label><button type="submit" disabled={draft.trim().length < 2 || search.isFetching} className={button}>检索主体</button><button type="button" disabled={busy} onClick={() => { void search.refetch(); void filings.refetch(); if (mode === "gf" || mode === "bi-stox") void facts.refetch(); if (["gf", "anr", "ddis"].includes(mode)) void quote.refetch(); }} className={button}><RefreshCw className="h-3 w-3" />刷新证据</button>{selected && <span className="text-[9px] text-cyan-200">{selected.ticker} · {selected.name}</span>}</form>{(search.data?.results?.length ?? 0) > 1 && <div className="flex gap-1 overflow-x-auto border-b border-slate-800 p-1">{search.data!.results.map(row => <button key={row.cik} type="button" onClick={() => { setSelected(row); setSelectedMetricId(""); setSelectedFilingKey(""); }} className={`shrink-0 border px-2 py-1 text-[9px] ${selected?.cik === row.cik ? "border-cyan-700 text-cyan-200" : "border-slate-800 text-slate-500"}`}>{row.ticker} · {row.name}</button>)}</div>}{!selected ? <p role="status" className="p-6 text-slate-500">输入至少两个字符并选择唯一 SEC 上市主体。</p> : mode === "gf" || mode === "bi-stox" ? <ResearchSplit label="基本面事实与报告期曲线" left={<div><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">指标 / 唯一字段</th><th>观察数</th><th>最近报告期</th><th className="p-2">单位</th></tr></thead><tbody>{metrics.map(row => <tr key={row.id} className={`border-t border-slate-800 ${selectedMetric?.id === row.id ? "bg-cyan-950/30" : ""}`}><td className="p-2"><button type="button" onClick={() => setSelectedMetricId(row.id)} className="text-left text-cyan-200">{row.label}<span className="block font-mono text-[9px] text-slate-500">SEC:{row.id}</span></button></td><td>{row.totalObservations}</td><td>{row.latestObservationDate}</td><td className="p-2">{row.unit}</td></tr>)}{!facts.isLoading && !metrics.length && <tr><td colSpan={4} className="p-6 text-amber-200">SEC XBRL 当前没有可读标准化事实；不填估值倍数或行业样例。</td></tr>}</tbody></table>{mode === "bi-stox" && <p className="p-2 text-[9px] leading-5 text-slate-500">行业横截面需要同 SIC、同指标、同报告期的多主体样本；当前页只展示已选择主体，不伪造同业平均或预测。</p>}</div>} right={selectedMetric ? <div><div className="h-[310px] p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={selectedMetric.observations}><CartesianGrid stroke="#1e293b" /><XAxis dataKey="end" minTickGap={24} tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tip} /><Line dataKey="value" name={`${selectedMetric.label} ${selectedMetric.unit}`} stroke="#22d3ee" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div><table className="w-full text-right text-[9px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">报告期 / 申报</th><th>数值</th><th>表单</th><th className="p-2">申报日 / 版本</th></tr></thead><tbody>{[...selectedMetric.observations].reverse().slice(0, 12).map(row => <tr key={row.id} className="border-t border-slate-800"><td className="p-2 text-left">{row.start ?? "时点"} → {row.end}</td><td>{row.value.toLocaleString()}</td><td>{row.form}</td><td className="p-2">{row.filed ?? "—"}<span className="block text-slate-500">{row.accessionNumber ?? "—"}</span></td></tr>)}</tbody></table></div> : <p role="status" className="p-6 text-slate-500">选择指标查看报告期曲线。</p>} /> : mode === "ds" ? <ResearchSplit label="申报目录与正文证据" left={<div className="overflow-auto"><table className="w-full min-w-[540px] text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">申报日</th><th>表单</th><th>主文件</th><th className="p-2">文件编号</th></tr></thead><tbody>{visibleFilings.map(row => <tr key={`${row.accessionNumber}-${row.primaryDocument}`} className={`border-t border-slate-800 ${selectedFiling?.accessionNumber === row.accessionNumber ? "bg-cyan-950/30" : ""}`}><td className="p-2">{row.filingDate ?? "—"}</td><td><button type="button" onClick={() => setSelectedFilingKey(row.accessionNumber ?? "")} className="text-cyan-200">{row.form}</button></td><td>{row.primaryDocument ?? "—"}</td><td className="p-2 font-mono text-slate-500">{row.accessionNumber ?? "—"}</td></tr>)}</tbody></table></div>} right={<div><div className="flex items-center gap-2 border-b border-slate-800 p-2"><label className="text-[10px] text-slate-500">原文关键词<input aria-label="DS原文关键词" value={keyword} onChange={event => setKeyword(event.target.value)} className={`${input} ml-2`} /></label><span className="text-[9px] text-slate-500">当前 {selectedFiling?.form ?? "—"} · {selectedFiling?.filingDate ?? "—"}</span></div>{excerpt.isLoading ? <p role="status" className="p-6 text-slate-500">正在读取 SEC 主文件并定位关键词…</p> : excerpt.isError ? <p role="alert" className="p-6 text-amber-200">主文件读取失败；没有替代摘要。</p> : excerpt.data?.excerpt ? <article className="max-h-[470px] overflow-auto whitespace-pre-wrap p-3 text-[10px] leading-5 text-slate-300">{excerpt.data.excerpt}</article> : <p role="status" className="p-6 text-slate-500">输入至少2个字符；未命中时保持空结果。</p>}</div>} /> : <div className="overflow-auto"><table className="w-full min-w-[920px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">申报日</th><th>表单</th><th>业务证据</th><th>主文件</th><th>文件编号</th><th className="p-2">状态</th></tr></thead><tbody>{visibleFilings.map(row => <tr key={`${row.accessionNumber}-${row.primaryDocument}`} className="border-t border-slate-800"><td className="p-2">{row.filingDate ?? "—"}</td><td className="font-semibold text-cyan-200">{row.form}</td><td>{mode === "ipo" ? /S-1/.test(row.form) ? "注册声明及修订版本" : "发行相关招股文件" : mode === "cact" ? row.form === "8-K" ? "重大事项申报，需读取正文确定事件" : "定期或股东资料时间线" : mode === "ddis" ? "潜在分红/股东事项证据，目录本身不等同公司行动" : "公开披露证据，不等同分析师一致预期"}</td><td>{row.primaryDocument ?? "—"}</td><td className="font-mono text-slate-500">{row.accessionNumber ?? "—"}</td><td className="p-2 text-emerald-300">SEC 可核验</td></tr>)}{!filings.isLoading && !visibleFilings.length && <tr><td colSpan={6} className="p-6 text-amber-200">该主体当前没有符合本功能口径的申报，不加载样例事件。</td></tr>}</tbody></table><div className="border-t border-slate-800 p-3"><h3 className="text-cyan-200">来源就绪度</h3><table className="mt-2 w-full max-w-[900px] text-left text-[10px]"><tbody>{(mode === "anr" ? [["分析师评级/目标价", "许可一致预期源未配置"], ["评级历史和机构明细", "许可一致预期源未配置"], ["SEC 申报证据", `${visibleFilings.length}条可读`], ["标的公共日频价格", quote.data?.status === "available" ? `可读 · ${quote.data.observation?.observationDate}` : "不可读"]] : mode === "ddis" ? [["除息日/登记日/支付日", "结构化公司行动源未配置"], ["每股股息/币种/税务", "结构化公司行动源未配置"], ["SEC 潜在披露证据", `${visibleFilings.length}条可读`], ["标的公共日频价格", quote.data?.status === "available" ? `可读 · ${quote.data.observation?.observationDate}` : "不可读"]] : mode === "cact" ? [["SEC 事件申报目录", `${visibleFilings.length}条可读`], ["公司行动结构化类型", "事件正文解析源未配置"], ["生效日/除权参数", "公司行动许可源未配置"]] : [["注册声明版本", `${visibleFilings.length}条可读`], ["发行价区间/股数", "招股书字段解析未配置"], ["承销分配/锁定期", "发行数据许可源未配置"], ["上市首日表现", "须在挂牌后读取实际价格，不预填"]]).map(([field, state]) => <tr key={field} className="border-t border-slate-800"><th className="w-56 p-2 font-normal text-slate-500">{field}</th><td className={String(state).includes("未配置") ? "text-amber-200" : "text-emerald-300"}>{state}</td></tr>)}</tbody></table></div></div>}</Shell>;
}

export default function StockLegacyLivePanel({ mode, onClose }: { mode: StockLegacyLiveMode; onClose?: () => void }) {
  if (mode === "corr" || mode === "most" || mode === "rrg" || mode === "fsrc") return <UniverseWorkbench mode={mode} onClose={onClose} />;
  if (mode === "rv") return <RelativeValuePanel onClose={onClose} />;
  if (mode === "gipo" || mode === "omon" || mode === "weif") return <BoundaryPanel mode={mode} onClose={onClose} />;
  if (mode === "port") return <PortfolioPanel onClose={onClose} />;
  return <SecEvidencePanel mode={mode} onClose={onClose} />;
}
