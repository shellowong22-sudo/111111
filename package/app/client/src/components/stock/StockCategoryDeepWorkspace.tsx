import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  ResearchSplit,
  TickerObservationDesk,
} from "./StockObservationDesk";

export type StockCategoryWorkspaceId =
  | "8"
  | "15"
  | "18"
  | "19"
  | "21"
  | "25"
  | "27"
  | "31"
  | "32";

const WORKSPACES: Array<{
  id: StockCategoryWorkspaceId;
  code: string;
  title: string;
  responsibility: string;
}> = [
  { id: "8", code: "", title: "Top-Down分析", responsibility: "用户证券篮子的涨跌参与度与横截面分布" },
  { id: "15", code: "", title: "投资组合管理与风险", responsibility: "账户输入仓位的集中度审阅" },
  { id: "18", code: "", title: "分析 IBM US Equity", responsibility: "证券级日频 OHLCV 与区间路径" },
  { id: "19", code: "", title: "股票衍生品", responsibility: "透明情景下的期权敏感性曲面" },
  { id: "21", code: "", title: "基金", responsibility: "用户基金观察池的覆盖与价格序列" },
  { id: "25", code: "", title: "股票交易", responsibility: "订单字段、风控规则与执行前闸门" },
  { id: "27", code: "", title: "资本市场活动", responsibility: "SEC 主体申报时间线与表单结构" },
  { id: "31", code: "", title: "客户管理解决方案", responsibility: "授权、来源与交付控制矩阵" },
  { id: "32", code: "", title: "因子研究与量化策略", responsibility: "用户输入因子的截面排序与权重归因" },
];

const buttonClass =
  "border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40";
const inputClass = "input-terminal h-7 min-w-0 px-2 text-[11px]";
const tooltip = {
  contentStyle: {
    background: "#070d18",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 11,
  },
};

export default function StockCategoryDeepWorkspace({
  initialId = "8",
}: {
  initialId?: StockCategoryWorkspaceId;
}) {
  const active = initialId;
  const item = WORKSPACES.find(entry => entry.id === active) ?? WORKSPACES[0];
  return (
    <section
      className="min-w-0 bg-[#070d16] text-xs text-slate-200"
      data-stock-category-deep-workspace
      aria-label="股票分类数据工作台"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-950 px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <b className="font-mono text-cyan-200">{item.code}</b>
          <span>{item.title}</span>
          <span className="truncate text-[10px] text-slate-500">
            唯一数据职责：{item.responsibility}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">
          公共历史/账户输入分域 · 缺失不补值 · 非可执行报价
        </span>
      </header>
      <div role="region" aria-label={`${item.title}数据扩充`} className="min-w-0">
        {active === "8" && <MarketBreadthAnalysis />}
        {active === "15" && <PortfolioRisk />}
        {active === "18" && <SingleEquityAnalysis />}
        {active === "19" && <EquityDerivatives />}
        {active === "21" && <FundCoverage />}
        {active === "25" && <EquityTradeGate />}
        {active === "27" && <CapitalMarkets />}
        {active === "31" && <ClientSolutions />}
        {active === "32" && <FactorResearch />}
      </div>
    </section>
  );
}

function MarketBreadthAnalysis() {
  const [draft, setDraft] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: tickers.length ? tickers : ["INVALID"], range: "3mo", includeHistory: false },
    { enabled: tickers.length > 0, staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true },
  );
  const rows = query.data?.rows ?? [];
  const available = rows.filter((row: any) => row.status === "available" && Number.isFinite(Number(row.changePct)));
  const advancers = available.filter((row: any) => Number(row.changePct) > 0).length;
  const decliners = available.filter((row: any) => Number(row.changePct) < 0).length;
  const unchanged = available.length - advancers - decliners;
  const average = available.length ? available.reduce((sum: number, row: any) => sum + Number(row.changePct), 0) / available.length : null;
  const distribution = [
    { bucket: "≤-2%", count: available.filter((row: any) => Number(row.changePct) <= -2).length },
    { bucket: "-2~-0.5%", count: available.filter((row: any) => Number(row.changePct) > -2 && Number(row.changePct) < -0.5).length },
    { bucket: "-0.5~0.5%", count: available.filter((row: any) => Number(row.changePct) >= -0.5 && Number(row.changePct) <= 0.5).length },
    { bucket: "0.5~2%", count: available.filter((row: any) => Number(row.changePct) > 0.5 && Number(row.changePct) < 2).length },
    { bucket: "≥2%", count: available.filter((row: any) => Number(row.changePct) >= 2).length },
  ];
  const apply = () => setTickers(Array.from(new Set(draft.toUpperCase().split(/[\s,;]+/).map(value => value.replace(/[^A-Z0-9.^=-]/g, "")).filter(Boolean))).slice(0, 20));
  return <>
    <div role="toolbar" className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2">
      <label className="min-w-64 flex-1 text-[10px] text-slate-400">证券篮子（最多 20 个代码）<input aria-label="市场宽度证券篮子" value={draft} onChange={event => setDraft(event.target.value)} placeholder="输入代码，以逗号分隔" className={`${inputClass} mt-1 w-full`} /></label>
      <button type="button" onClick={apply} disabled={!draft.trim() || query.isFetching} className={buttonClass}><RefreshCw className={`mr-1 inline h-3 w-3 ${query.isFetching ? "animate-spin" : ""}`} />计算篮子宽度</button>
    </div>
    <ResearchSplit
      label="证券篮子宽度与分布"
      left={<table className="w-full text-right text-[10px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">证券 / 来源</th><th>变化</th><th>状态</th><th className="pr-2">观察日</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.ticker} className="border-t border-slate-800"><td className="p-2 text-left"><b className="font-mono text-cyan-200">{row.ticker}</b><span className="block max-w-52 truncate text-[9px] text-slate-600">{row.source ?? "来源未取得"}</span></td><td className={`font-mono ${Number(row.changePct) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{row.changePct == null ? "—" : `${format(row.changePct)}%`}</td><td>{row.status === "available" ? "可读" : "不可读"}</td><td className="pr-2 text-slate-500">{row.latestDate ?? "—"}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="p-3 text-left text-amber-200">{query.isFetching ? "正在读取证券篮子…" : "输入证券篮子后计算；不显示预置证券或全市场假数据。"}</td></tr>}</tbody></table>}
      right={<div className="min-w-0"><table className="w-full text-left text-[10px]"><tbody>{[["上涨", advancers], ["下跌", decliners], ["持平", unchanged], ["不可读", Math.max(0, rows.length - available.length)], ["平均变化", average == null ? "—" : `${format(average)}%`]].map(([label, value]) => <tr key={String(label)} className="border-b border-slate-800"><th className="w-32 p-2 font-normal text-slate-500">{label}</th><td className="p-2 font-mono">{value}</td></tr>)}</tbody></table><div className="h-72 p-2">{available.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={distribution}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="bucket" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Bar dataKey="count" name="证券数" fill="#22d3ee" isAnimationActive={false} /></BarChart></ResponsiveContainer> : <State text="取得至少一个有效日频变化后显示收益分布。" />}</div></div>}
    />
    <StatusLine text={`${query.data?.sourceBoundary ?? "尚未提交证券篮子"} · 这是用户篮子宽度，不代表完整交易所或全市场宽度。`} />
  </>;
}

function PortfolioRisk() {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parsePositions(text), [text]);
  const total = parsed.rows.reduce((sum, row) => sum + row.weight, 0);
  const rows = total > 0
    ? parsed.rows.map(row => ({ ...row, normalized: (row.weight / total) * 100 })).sort((a, b) => b.normalized - a.normalized)
    : [];
  const hhi = rows.reduce((sum, row) => sum + (row.normalized / 100) ** 2, 0);
  return (
    <ResearchSplit
      label="仓位与集中度"
      left={<div><div className="border-b border-slate-800 p-2"><label className="text-[10px] text-slate-400">账户仓位 JSON（ticker、weight；只在本页计算）<textarea aria-label="股票组合仓位输入" value={text} onChange={event => setText(event.target.value)} placeholder='[{"ticker":"...","weight":...}]' className="input-terminal mt-1 min-h-32 w-full font-mono text-[11px]" /></label>{parsed.error && <p role="alert" className="pt-2 text-amber-200">{parsed.error}</p>}</div><table className="w-full text-right text-[11px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">证券</th><th>原始权重</th><th className="pr-2">归一权重</th></tr></thead><tbody>{rows.map(row => <tr key={row.ticker} className="border-t border-slate-800 font-mono"><td className="p-2 text-left text-cyan-200">{row.ticker}</td><td>{format(row.weight, 2)}</td><td className="pr-2">{format(row.normalized, 2)}%</td></tr>)}{!rows.length && <tr><td colSpan={3} className="p-3 text-left text-slate-500">等待账户仓位；不显示示例持仓。</td></tr>}</tbody></table></div>}
      right={<div><table className="w-full text-left text-[10px]"><tbody>{[["输入权重合计", format(total, 2)], ["最大单一权重", rows.length ? `${format(rows[0].normalized, 2)}%` : "—"], ["HHI 集中度", rows.length ? format(hhi, 4) : "—"], ["有效持仓数", rows.length]].map(([label, value]) => <tr key={String(label)} className="border-b border-slate-800"><th className="w-40 p-2 font-normal text-slate-500">{label}</th><td className="p-2 font-mono text-slate-100">{value}</td></tr>)}</tbody></table><div className="h-72 p-2">{rows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="ticker" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Bar dataKey="normalized" name="归一权重 %" fill="#22d3ee" isAnimationActive={false} /></BarChart></ResponsiveContainer> : <State text="输入有效仓位后显示集中度柱状图。" />}</div><StatusLine text="未提供收益、协方差、基准和账户估值时，不生成 VaR、绩效或配置建议。" /></div>}
    />
  );
}

function SingleEquityAnalysis() {
  return <TickerObservationDesk defaultTicker="IBM" title="单一证券 OHLCV 与区间研究" initialView="history" focus="range" />;
}

function EquityDerivatives() {
  const [spot, setSpot] = useState("");
  const [strike, setStrike] = useState("");
  const [volatility, setVolatility] = useState("");
  const [days, setDays] = useState("");
  const [rate, setRate] = useState("");
  const [optionType, setOptionType] = useState<"call" | "put">("call");
  const values = [spot, strike, volatility, days, rate].map(Number);
  const valid = values.slice(0, 4).every(value => Number.isFinite(value) && value > 0) && Number.isFinite(values[4]);
  const result = valid ? blackScholes(values[0], values[1], values[2] / 100, values[3] / 365, values[4] / 100, optionType === "call") : null;
  const path = useMemo(() => valid ? [-20, -15, -10, -5, 0, 5, 10, 15, 20].map(shock => ({ shock, spot: values[0] * (1 + shock / 100), price: blackScholes(values[0] * (1 + shock / 100), values[1], values[2] / 100, values[3] / 365, values[4] / 100, optionType === "call").price })) : [], [valid, spot, strike, volatility, days, rate, optionType]);
  return <>
    <div role="toolbar" className="grid grid-cols-2 gap-2 border-b border-slate-800 p-2 sm:grid-cols-3 xl:grid-cols-6">
      {[["现货情景", spot, setSpot], ["行权价", strike, setStrike], ["波动率 %", volatility, setVolatility], ["剩余天数", days, setDays], ["利率 %", rate, setRate]].map(([label, value, setter]) => <label key={String(label)} className="text-[10px] text-slate-400">{String(label)}<input aria-label={String(label)} type="number" value={String(value)} onChange={event => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} className={`${inputClass} mt-1 w-full`} /></label>)}
      <label className="text-[10px] text-slate-400">类型<select value={optionType} onChange={event => setOptionType(event.target.value as "call" | "put")} className={`${inputClass} mt-1 w-full`}><option value="call">Call</option><option value="put">Put</option></select></label>
    </div>
    <ResearchSplit label="期权敏感性" left={<table className="w-full text-right text-[11px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">模型输出</th><th className="pr-2">值</th></tr></thead><tbody>{[["理论权利金", result?.price], ["Delta", result?.delta], ["Gamma", result?.gamma], ["Vega / 1%", result?.vega]].map(([label, value]) => <tr key={String(label)} className="border-t border-slate-800"><td className="p-2 text-left text-slate-400">{label}</td><td className="pr-2 font-mono">{typeof value === "number" ? format(value, 6) : "—"}</td></tr>)}<tr className="border-t border-slate-800"><td className="p-2 text-left text-slate-400">市场期权链 / 隐波面</td><td className="pr-2 text-amber-200">数据源未配置</td></tr></tbody></table>} right={<div className="h-[420px] p-2">{path.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={path}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="shock" unit="%" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Line dataKey="price" name="理论权利金" stroke="#a78bfa" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <State text="输入完整情景后显示权利金—现货冲击曲线；不生成默认模型值。" />}</div>} />
    <StatusLine text="Black–Scholes 仅用于用户输入情景的可复核敏感性计算；不构成可交易报价。" />
  </>;
}

function FundCoverage() {
  const [draft, setDraft] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: tickers.length ? tickers : ["SPY"], range: "1y", includeHistory: true },
    { enabled: tickers.length > 0, staleTime: 30_000, refetchInterval: 60_000, refetchOnReconnect: true }
  );
  const rows = query.data?.rows ?? [];
  const active = rows.find((row: any) => row.ticker === selected) ?? rows[0];
  const apply = () => {
    const next = Array.from(new Set(draft.toUpperCase().split(/[\s,;]+/).map(value => value.replace(/[^A-Z0-9.^=-]/g, "")).filter(Boolean))).slice(0, 10);
    setTickers(next);
    setSelected(next[0] ?? "");
  };
  return <>
    <div role="toolbar" className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><input aria-label="基金观察代码" value={draft} onChange={event => setDraft(event.target.value)} placeholder="输入已知基金/ETF代码，逗号分隔" className={`${inputClass} min-w-64 flex-1`} /><button type="button" onClick={apply} disabled={!draft.trim()} className={buttonClass}>读取观察池</button><button type="button" onClick={() => void query.refetch()} disabled={!tickers.length || query.isFetching} className={buttonClass}>刷新</button></div>
    <ResearchSplit label="基金覆盖矩阵" left={<table className="w-full text-right text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">代码</th><th>状态</th><th>末值</th><th>变化%</th><th className="pr-2">观察日</th></tr></thead><tbody>{rows.map((row: any) => <tr key={row.ticker} className={`border-t border-slate-800 ${active?.ticker === row.ticker ? "bg-cyan-950/30" : ""}`}><td className="p-2 text-left"><button type="button" onClick={() => setSelected(row.ticker)} className="font-mono text-cyan-200">{row.ticker}</button></td><td>{row.status === "available" ? "可读" : "不可读"}</td><td className="font-mono">{format(row.price)}</td><td className="font-mono">{format(row.changePct)}</td><td className="pr-2 text-slate-500">{row.latestDate ?? "—"}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-3 text-left text-slate-500">等待用户输入基金代码；不预置基金排名或收益。</td></tr>}</tbody></table>} right={<div className="h-[420px] p-2">{active?.history?.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={active.history}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="date" minTickGap={24} tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Line dataKey="value" name={`${active.ticker} 日频价格`} stroke="#34d399" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <State text="选择有历史覆盖的基金代码后显示价格序列。净值、持仓、费率和份额来源未配置时保持空缺。" />}</div>} />
    <StatusLine text={query.data?.sourceBoundary ?? "基金代码尚未提交；证券级公开日频价格不等于基金官方净值。"} />
  </>;
}

function EquityTradeGate() {
  const [order, setOrder] = useState({ symbol: "", side: "", quantity: "", limitPrice: "", account: "" });
  const checks = [
    ["证券标识", /^[A-Z0-9.^=-]{1,15}$/.test(order.symbol), "1–15位代码"],
    ["买卖方向", order.side === "BUY" || order.side === "SELL", "BUY / SELL"],
    ["数量", Number(order.quantity) > 0, "必须大于0"],
    ["限价", Number(order.limitPrice) > 0, "必须大于0"],
    ["账户", order.account.trim().length > 0, "必须绑定授权账户"],
  ] as const;
  const ready = checks.every(([, ok]) => ok);
  return <ResearchSplit label="订单与风控规则" left={<div><div className="grid grid-cols-2 gap-2 border-b border-slate-800 p-2">{[["symbol", "证券代码"], ["quantity", "数量"], ["limitPrice", "限价"], ["account", "账户标识"]].map(([key, label]) => <label key={key} className="text-[10px] text-slate-400">{label}<input aria-label={label} value={order[key as keyof typeof order]} onChange={event => setOrder(current => ({ ...current, [key]: key === "symbol" ? event.target.value.toUpperCase() : event.target.value }))} className={`${inputClass} mt-1 w-full`} /></label>)}<label className="col-span-2 text-[10px] text-slate-400">方向<select aria-label="买卖方向" value={order.side} onChange={event => setOrder(current => ({ ...current, side: event.target.value }))} className={`${inputClass} mt-1 w-full`}><option value="">未选择</option><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label></div><p className="p-2 text-[10px] text-slate-500">这里只做字段完整性校验；订单不会发送至经纪商。</p></div>} right={<div><table className="w-full text-left text-[11px]"><thead className="text-slate-500"><tr><th className="p-2">规则</th><th>状态</th><th>要求</th></tr></thead><tbody>{checks.map(([label, ok, rule]) => <tr key={label} className="border-t border-slate-800"><td className="p-2">{label}</td><td className={ok ? "text-emerald-300" : "text-amber-200"}>{ok ? "通过" : "未通过"}</td><td className="text-slate-500">{rule}</td></tr>)}</tbody></table><div role="status" className={`border-t border-slate-800 p-3 ${ready ? "text-emerald-300" : "text-amber-200"}`}>{ready ? "字段闸门通过；经纪商、权限和实时价格仍未配置，禁止送单。" : "字段闸门未通过；不会显示假成功状态。"}</div></div>} />;
}

function CapitalMarkets() {
  const [draft, setDraft] = useState("");
  const [selectedCik, setSelectedCik] = useState("");
  const search = trpc.stockMarketResearch.searchIssuers.useQuery({ query: draft || "_", limit: 8 }, { enabled: draft.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000 });
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery({ cik: selectedCik || "0" }, { enabled: Boolean(selectedCik), staleTime: 60_000 });
  const rows = filings.data?.filings ?? [];
  const summary = useMemo(() => Object.entries(rows.reduce((map: Record<string, number>, row: any) => { map[row.form] = (map[row.form] ?? 0) + 1; return map; }, {})).map(([form, count]) => ({ form, count })), [rows]);
  return <><div role="toolbar" className="flex items-center gap-2 border-b border-slate-800 p-2"><input aria-label="资本市场主体搜索" value={draft} onChange={event => setDraft(event.target.value)} placeholder="公司、代码或 CIK" className={`${inputClass} flex-1`} /><span className="text-[10px] text-slate-500">来源 SEC EDGAR</span></div><ResearchSplit label="申报活动" left={<div><div className="max-h-32 overflow-auto border-b border-slate-800">{(search.data?.results ?? []).map((issuer: any) => <button type="button" key={issuer.cik} onClick={() => setSelectedCik(issuer.cik)} className={`block w-full border-t border-slate-800 p-2 text-left ${selectedCik === issuer.cik ? "bg-cyan-950/30" : "hover:bg-slate-900"}`}><b className="font-mono text-cyan-200">{issuer.ticker}</b><span className="ml-2 text-slate-400">{issuer.name}</span><span className="ml-2 font-mono text-[9px] text-slate-600">CIK {issuer.cik}</span></button>)}</div><div className="max-h-[285px] overflow-auto"><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">表单</th><th>申报日</th><th>主文件 / 编号</th></tr></thead><tbody>{rows.map((row: any) => <tr key={`${row.accessionNumber}-${row.primaryDocument}`} className="border-t border-slate-800"><td className="p-2 font-mono text-amber-200">{row.form}</td><td>{row.filingDate ?? "—"}</td><td className="max-w-44 truncate text-slate-400">{row.primaryDocument ?? "—"}<span className="block font-mono text-[9px] text-slate-600">{row.accessionNumber ?? "—"}</span></td></tr>)}{!rows.length && <tr><td colSpan={3} className="p-3 text-slate-500">{selectedCik ? "当前来源没有返回匹配申报。" : "选择主体后读取实际申报。"}</td></tr>}</tbody></table></div></div>} right={<div className="h-[420px] p-2">{summary.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="form" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Bar dataKey="count" name="实际申报数" fill="#f59e0b" isAnimationActive={false} /></BarChart></ResponsiveContainer> : <State text="选择 SEC 主体后按实际表单目录显示结构；不把目录数量解释为融资强度。" />}</div>} /><StatusLine text={filings.data?.sourceBoundary ?? search.data?.sourceBoundary ?? "等待主体选择；不生成示例发行事件。"} /></>;
}

function ClientSolutions() {
  const [mandate, setMandate] = useState("");
  const [checks, setChecks] = useState({ identity: false, entitlement: false, source: false, approval: false });
  const rows = [["客户身份", "identity", "身份与租户一致"], ["数据授权", "entitlement", "资料许可覆盖交付对象"], ["来源追踪", "source", "每个字段保留来源与时点"], ["人工审批", "approval", "交付前完成审计确认"]] as const;
  const ready = mandate.trim().length >= 3 && rows.every(([, key]) => checks[key]);
  return <ResearchSplit label="客户交付控制" left={<div className="p-2"><label className="text-[10px] text-slate-400">授权范围标签（仅本页）<input aria-label="客户授权范围" value={mandate} onChange={event => setMandate(event.target.value)} className={`${inputClass} mt-1 w-full`} placeholder="输入租户内授权范围" /></label><p className="mt-3 text-[10px] leading-5 text-slate-500">本区不连接外部 CRM、不创建客户记录、不发送消息；只记录交付闸门状态。</p></div>} right={<div><table className="w-full text-left text-[11px]"><thead className="text-slate-500"><tr><th className="p-2">控制项</th><th>状态</th><th>判定口径</th></tr></thead><tbody>{rows.map(([label, key, rule]) => <tr key={key} className="border-t border-slate-800"><td className="p-2"><label className="flex items-center gap-2"><input type="checkbox" checked={checks[key]} onChange={event => setChecks(current => ({ ...current, [key]: event.target.checked }))} />{label}</label></td><td className={checks[key] ? "text-emerald-300" : "text-amber-200"}>{checks[key] ? "已核验" : "待核验"}</td><td className="text-slate-500">{rule}</td></tr>)}</tbody></table><div role="status" className={`border-t border-slate-800 p-3 ${ready ? "text-emerald-300" : "text-amber-200"}`}>{ready ? "交付闸门完整，可进入人工复核。" : "交付闸门未完成，不生成客户结论。"}</div></div>} />;
}

function FactorResearch() {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseFactors(text), [text]);
  const totalWeight = parsed.rows.reduce((sum, row) => sum + row.weight, 0);
  const rows = [...parsed.rows].sort((a, b) => b.value - a.value).map((row, index) => ({ ...row, rank: index + 1, contribution: totalWeight > 0 ? row.value * row.weight / totalWeight : null }));
  const weighted = rows.reduce((sum, row) => sum + (row.contribution ?? 0), 0);
  return <ResearchSplit label="因子截面" left={<div><div className="border-b border-slate-800 p-2"><label className="text-[10px] text-slate-400">因子 JSON（ticker、value、weight；仅透明输入）<textarea aria-label="因子数据输入" value={text} onChange={event => setText(event.target.value)} placeholder='[{"ticker":"...","value":...,"weight":...}]' className="input-terminal mt-1 min-h-32 w-full font-mono text-[11px]" /></label>{parsed.error && <p role="alert" className="pt-2 text-amber-200">{parsed.error}</p>}</div><table className="w-full text-right text-[10px]"><thead className="text-slate-500"><tr><th className="p-2 text-left">排名 / 证券</th><th>因子值</th><th>权重</th><th className="pr-2">贡献</th></tr></thead><tbody>{rows.map(row => <tr key={row.ticker} className="border-t border-slate-800 font-mono"><td className="p-2 text-left text-cyan-200">{row.rank} · {row.ticker}</td><td>{format(row.value)}</td><td>{format(row.weight)}</td><td className="pr-2">{format(row.contribution)}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="p-3 text-left text-slate-500">等待用户输入因子截面；不加载示例策略。</td></tr>}</tbody></table></div>} right={<div><table className="w-full text-left text-[10px]"><tbody><tr className="border-b border-slate-800"><th className="w-40 p-2 font-normal text-slate-500">加权因子分数</th><td className="p-2 font-mono">{rows.length ? format(weighted) : "—"}</td></tr><tr className="border-b border-slate-800"><th className="p-2 font-normal text-slate-500">有效截面</th><td className="p-2 font-mono">{rows.length}</td></tr></tbody></table><div className="h-72 p-2">{rows.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="ticker" tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Bar dataKey="value" name="因子值" fill="#a78bfa" isAnimationActive={false} /></BarChart></ResponsiveContainer> : <State text="输入有效截面后显示排序图。" />}</div><StatusLine text="未读取未来收益，不计算 IC、IR、回测收益或实盘信号。" /></div>} />;
}

function parsePositions(text: string): { rows: Array<{ ticker: string; weight: number }>; error: string } {
  if (!text.trim()) return { rows: [], error: "" };
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) return { rows: [], error: "必须是 JSON 数组。" };
    const rows = value.map(row => ({ ticker: String(row.ticker ?? "").trim().toUpperCase().slice(0, 24), weight: Number(row.weight) })).filter(row => row.ticker && Number.isFinite(row.weight) && row.weight >= 0).slice(0, 100);
    return { rows, error: rows.length || !value.length ? "" : "没有可计算的非负权重记录。" };
  } catch {
    return { rows: [], error: "JSON 格式无效。" };
  }
}

function parseFactors(text: string): { rows: Array<{ ticker: string; value: number; weight: number }>; error: string } {
  if (!text.trim()) return { rows: [], error: "" };
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) return { rows: [], error: "必须是 JSON 数组。" };
    const rows = value.map(row => ({ ticker: String(row.ticker ?? "").trim().toUpperCase().slice(0, 24), value: Number(row.value), weight: Number(row.weight) })).filter(row => row.ticker && Number.isFinite(row.value) && Number.isFinite(row.weight) && row.weight >= 0).slice(0, 100);
    return { rows, error: rows.length || !value.length ? "" : "没有可计算的有效记录。" };
  } catch {
    return { rows: [], error: "JSON 格式无效。" };
  }
}

function blackScholes(spot: number, strike: number, volatility: number, time: number, rate: number, call: boolean) {
  if (!(spot > 0 && strike > 0 && volatility > 0 && time > 0)) return { price: null, delta: null, gamma: null, vega: null };
  const d1 = (Math.log(spot / strike) + (rate + volatility * volatility / 2) * time) / (volatility * Math.sqrt(time));
  const d2 = d1 - volatility * Math.sqrt(time);
  const nd1 = normalCdf(d1); const nd2 = normalCdf(d2); const pdf = Math.exp(-(d1 * d1) / 2) / Math.sqrt(2 * Math.PI); const discount = Math.exp(-rate * time);
  return { price: call ? spot * nd1 - strike * discount * nd2 : strike * discount * normalCdf(-d2) - spot * normalCdf(-d1), delta: call ? nd1 : nd1 - 1, gamma: pdf / (spot * volatility * Math.sqrt(time)), vega: spot * pdf * Math.sqrt(time) / 100 };
}
function normalCdf(value: number) { const sign = value < 0 ? -1 : 1; const x = Math.abs(value) / Math.sqrt(2); const t = 1 / (1 + 0.3275911 * x); const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t; return 0.5 * (1 + sign * (1 - polynomial * Math.exp(-x * x))); }
function format(value: unknown, digits = 4) { return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—"; }
function State({ text }: { text: string }) { return <div role="status" className="p-3 text-[10px] text-slate-500">{text}</div>; }
function StatusLine({ text }: { text: string }) { return <div className="border-t border-slate-800 px-2 py-2 text-[9px] leading-5 text-slate-500">{text}</div>; }
