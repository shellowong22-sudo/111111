import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  FileSearch,
  Filter,
  Search,
  ShieldAlert,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge, LoadingState } from "@/components/sovereign/PanelKit";

import {
  EnvironmentObservationDesk,
  TickerObservationDesk,
  ResearchSplit,
} from "./StockObservationDesk";
import EqbtRiskWorkbench from "./EqbtRiskWorkbench";
import EtfRelativeWorkbench from "./EtfRelativeWorkbench";
import ImapRelationWorkbench from "./ImapRelationWorkbench";
import StockFactorLabWorkspace from "./StockFactorLabWorkspace";
import IndexBenchmarkWorkbench from "./IndexBenchmarkWorkbench";

type ModuleId =
  | "wei"
  | "ftw"
  | "imap"
  | "evts"
  | "top"
  | "tren"
  | "eqs"
  | "eqbt"
  | "ds"
  | "bi-stox"
  | "res"
  | "in"
  | "tlts"
  | "port"
  | "moso"
  | "etf"
  | "fsrc"
  | "pe"
  | "emsx"
  | "cact"
  | "ma"
  | "ipo"
  | "factorlab";
type SecForm =
  | "10-K"
  | "10-Q"
  | "8-K"
  | "424B2"
  | "424B3"
  | "424B5"
  | "S-3"
  | "S-1"
  | "S-1/A"
  | "S-4"
  | "DEFM14A";
const SEC_FORM_OPTIONS = [
  "8-K",
  "10-K",
  "10-Q",
  "S-1",
  "S-1/A",
  "S-3",
  "S-4",
  "424B2",
  "424B3",
  "424B5",
  "DEFM14A",
] as const satisfies readonly SecForm[];
const isSecForm = (value: string): value is SecForm =>
  (SEC_FORM_OPTIONS as readonly string[]).includes(value);
export const STOCK_MODULE_META: Record<
  ModuleId,
  {
    code: string;
    title: string;
    focus: string;
    category: "public" | "input" | "restricted" | "governance";
  }
> = {
  wei: {
    code: "WEI",
    title: "股市环境横截面",
    focus: "用 FRED 实际历史观察呈现股市、波动率、利率和信用环境。",
    category: "public",
  },
  ftw: {
    code: "FTW",
    title: "关注证券日频观察",
    focus: "按用户明确代码读取公共日频收盘观察与当期市场字段。",
    category: "public",
  },
  imap: {
    code: "IMAP",
    title: "跨市场变化关系",
    focus:
      "以相同起止观察日配对股市、波动率、利率与信用变化；每对关系只呈现一次，矩阵联动散点和证据。",
    category: "public",
  },
  evts: {
    code: "EVTS",
    title: "公开申报日历",
    focus: "按 SEC 实际申报日期与用户选择的表单类别建立事件时间线。",
    category: "public",
  },
  top: {
    code: "TOP",
    title: "近期公开文件",
    focus: "展示主体最近实际可读的八份 SEC 公开文件快照。",
    category: "public",
  },
  tren: {
    code: "TREN",
    title: "申报表单趋势",
    focus: "按月统计 SEC 实际申报，而不构造新闻热度。",
    category: "public",
  },
  eqs: {
    code: "EQS",
    title: "透明观察篮子",
    focus: "对用户输入代码展示公共日频观察，不生成排名。",
    category: "public",
  },
  eqbt: {
    code: "EQBT",
    title: "已实现区间观察",
    focus: "仅展示透明时间窗口下的历史收盘变化。",
    category: "public",
  },
  ds: {
    code: "DS",
    title: "SEC 文件证据定位",
    focus: "在终端内提取关键词附近的受限长度原文。",
    category: "public",
  },
  "bi-stox": {
    code: "BI STOX",
    title: "行业与报告期事实",
    focus: "读取 SEC 行业分类与标准化公司事实。",
    category: "public",
  },
  res: {
    code: "RES",
    title: "终端内研究路径",
    focus: "将主体、文件、环境和观察路径串联在本终端。",
    category: "governance",
  },
  in: {
    code: "IN",
    title: "指数环境参照",
    focus: "选择并查看一项实际读取的指数、波动率、利率或信用环境序列。",
    category: "public",
  },
  tlts: {
    code: "TLTS",
    title: "暴露资料完备性",
    focus: "仅核验用户显式输入的主体、行业与权重。",
    category: "input",
  },
  port: {
    code: "PORT",
    title: "权重集中度审阅",
    focus: "用透明输入呈现集中度，不建议配置。",
    category: "input",
  },
  moso: {
    code: "MOSO",
    title: "期权市场资料边界",
    focus: "未接入可再分发期权链、盘口与订单流。",
    category: "restricted",
  },
  etf: {
    code: "ETF",
    title: "ETF 相对价格研究",
    focus:
      "对齐两只明确选择的 ETF 交易价格，比较相对表现与区间超额变化；不把市场价格当作基金净值。",
    category: "public",
  },
  fsrc: {
    code: "FSRC",
    title: "观察清单资料覆盖",
    focus:
      "检查用户清单的实际可读状态、观测时点和历史覆盖，并保存账户级覆盖快照。",
    category: "public",
  },
  pe: {
    code: "PE",
    title: "私募资料边界",
    focus: "未接入可再分发私募估值与基金数据。",
    category: "restricted",
  },
  emsx: {
    code: "EMSX",
    title: "交易前资料闸门",
    focus: "核验用户输入资料，不发送订单。",
    category: "input",
  },
  cact: {
    code: "CACT",
    title: "公司公开事件目录",
    focus: "读取 SEC 实际表单、日期与文件名。",
    category: "public",
  },
  ma: {
    code: "MA",
    title: "并购文件核验",
    focus: "筛选 SEC 并购相关表单，不生成套利结论。",
    category: "public",
  },
  ipo: {
    code: "IPO",
    title: "公开发行文件时间线",
    focus: "筛选 SEC 发行申报日期，不构造定价。",
    category: "public",
  },
  factorlab: {
    code: "FACTOR LAB",
    title: "滞后因子回归",
    focus:
      "以可核验的共同观察区间执行单因子 OLS、滞后比较及残差诊断；单位、样本和模型限制明确展示。",
    category: "governance",
  },
};
const tooltip = {
  contentStyle: {
    background: "#020617",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 11,
  },
};

function ResearchSection({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border-y border-slate-800 ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-800 px-2 py-2">
          <h4 className="text-xs text-cyan-100">{title}</h4>
          {action}
        </header>
      )}
      <div className="min-w-0 px-2 py-2">{children}</div>
    </section>
  );
}

function Environment() {
  return <EnvironmentObservationDesk />;
}

function TickerExplorer({
  label = "证券报价观察",
  defaultTicker = "AAPL",
  returnOnly = false,
  focus,
}: {
  label?: string;
  defaultTicker?: string;
  returnOnly?: boolean;
  focus?: "quote" | "volume" | "curve" | "etf" | "range";
}) {
  const resolvedFocus =
    focus ??
    (label.startsWith("ETF")
      ? "etf"
      : label.startsWith("EQBT")
        ? "range"
        : "quote");
  return (
    <TickerObservationDesk
      title={label}
      defaultTicker={defaultTicker}
      initialView={returnOnly ? "curve" : "history"}
      focus={resolvedFocus}
    />
  );
}

function Watchlist() {
  const [text, setText] = useState("AAPL,MSFT,SPY");
  const [submitted, setSubmitted] = useState(["AAPL", "MSFT", "SPY"]);
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: submitted, range: "3mo", includeHistory: true },
    { staleTime: 30_000 }
  );
  const returnedRows = (query.data?.rows ?? []) as Array<any>;
  const returnedByTicker = new Map(
    returnedRows.map(row => [String(row.ticker), row])
  );
  const rows = submitted.map(ticker =>
    returnedByTicker.get(ticker) ?? {
      ticker,
      status: query.isLoading ? "loading" : "unavailable",
      price: null,
      changePct: null,
      currency: null,
      points: 0,
      latestDate: null,
      source: null,
      retrievedAt: null,
      history: [],
    }
  );
  const available = rows.filter(row => row.status === "available" && row.history?.length);
  const selectedRow = rows.find(row => row.ticker === selectedTicker) ?? rows[0];
  const selectedHistory = (selectedRow?.history ?? []) as Array<any>;
  const selectedSummary = useMemo(() => {
    if (!selectedHistory.length) return null;
    const highs = selectedHistory.map(point => Number(point.high)).filter(Number.isFinite);
    const lows = selectedHistory.map(point => Number(point.low)).filter(Number.isFinite);
    const last = selectedHistory.at(-1);
    return {
      rangeHigh: highs.length ? Math.max(...highs) : null,
      rangeLow: lows.length ? Math.min(...lows) : null,
      latestVolume: Number.isFinite(Number(last?.volume)) ? Number(last.volume) : null,
      firstDate: selectedHistory[0]?.date ?? null,
      lastDate: last?.date ?? null,
    };
  }, [selectedHistory]);
  const chart = useMemo(() => {
    const points = new Map<string, Record<string, number | string>>();
    for (const row of available) {
      const first = Number(row.history?.[0]?.value);
      if (!Number.isFinite(first) || first <= 0) continue;
      for (const point of row.history ?? []) {
        const value = Number(point.value);
        if (!Number.isFinite(value)) continue;
        const item: Record<string, number | string> = points.get(point.date) ?? { date: point.date };
        item[row.ticker] = Number(((value / first) * 100).toFixed(4));
        points.set(point.date, item);
      }
    }
    return Array.from(points.values()).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-90);
  }, [available]);
  useEffect(() => {
    if (!rows.some(row => row.ticker === selectedTicker) && rows[0]) setSelectedTicker(rows[0].ticker);
  }, [rows, selectedTicker]);
  return (
    <ResearchSection title="EQS · 股票横截面与逐日成交工作台">
      <div role="toolbar" className="flex flex-wrap items-end gap-2 border-b border-slate-800 pb-2">
        <label className="min-w-64 flex-1 text-[10px] text-slate-500">
          代码清单（最多 10 个，逗号分隔）
          <input
            value={text}
            onChange={event => setText(event.target.value.toUpperCase())}
            className="input-terminal mt-1 w-full text-xs"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setSubmitted(
              text
                .split(",")
                .map(item => item.trim())
                .filter(Boolean)
                .slice(0, 10)
            )
          }
          className="border border-cyan-900 px-3 py-2 text-xs text-cyan-200"
        >
          读取清单
        </button>
        <span className="pb-2 text-[10px] text-slate-500">
          3 个月 · 日频 · {query.isFetching ? "正在刷新" : "读取完成"}
        </span>
      </div>
      <div className="mt-2 overflow-x-auto" aria-label="EQS 股票行情矩阵">
          <table className="min-w-[960px] w-full text-left text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th>代码</th>
                <th>状态</th>
                <th>最新收盘</th>
                <th>前收变化</th>
                <th>区间高</th>
                <th>区间低</th>
                <th>最近成交量</th>
                <th>历史点数</th>
                <th>截至</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => {
                const history = (row.history ?? []) as Array<any>;
                const highs = history.map(point => Number(point.high)).filter(Number.isFinite);
                const lows = history.map(point => Number(point.low)).filter(Number.isFinite);
                const volume = history.length ? Number(history.at(-1)?.volume) : null;
                return (
                <tr key={row.ticker} onClick={() => setSelectedTicker(row.ticker)} className={`border-t border-slate-800 ${selectedTicker === row.ticker ? "bg-cyan-950/30" : "hover:bg-slate-900"}`}>
                  <td className="py-2 font-mono text-cyan-200"><button type="button" className="text-left" onClick={() => setSelectedTicker(row.ticker)}>{row.ticker}</button></td>
                  <td>
                    <Badge tone={row.status === "available" ? "pos" : row.status === "loading" ? "info" : "warn"}>
                      {row.status === "available" ? "实际可读" : row.status === "loading" ? "读取中" : "暂不可读"}
                    </Badge>
                  </td>
                  <td>
                    {row.price == null ? "—" : `${Number(row.price).toFixed(2)} ${row.currency ?? ""}`}
                  </td>
                  <td
                    className={
                      row.changePct >= 0 ? "text-emerald-300" : "text-rose-300"
                    }
                  >
                    {row.changePct == null
                      ? "—"
                      : `${Number(row.changePct).toFixed(2)}%`}
                  </td>
                  <td>{highs.length ? Math.max(...highs).toFixed(2) : "—"}</td>
                  <td>{lows.length ? Math.min(...lows).toFixed(2) : "—"}</td>
                  <td>{Number.isFinite(volume) ? Number(volume).toLocaleString() : "—"}</td>
                  <td>{row.points}</td>
                  <td>{row.latestDate ?? "—"}</td>
                  <td className="max-w-56 truncate text-slate-500">{row.source ?? "来源未取得"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
      </div>
      {query.isLoading && <LoadingState text="正在读取清单；证券代码已登记，行情字段等待来源返回…" />}
      {query.isError && <p role="alert" className="border-t border-slate-800 p-3 text-xs text-amber-200">公共日频接口读取失败；矩阵保留不可读状态，不延用旧值冒充当前数据。</p>}
      <div className="mt-2 border-y border-slate-800" aria-label="EQS 横截面归一化表现图">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-2 py-2 text-[10px] text-slate-400">
          <span>横截面归一化路径 · 各证券首个有效收盘=100</span>
          <span>{available.length} / {rows.length} 条序列可绘制</span>
        </div>
        {chart.length > 1 ? <div className="h-56 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid stroke="#1e293b" strokeDasharray="2 3" /><XAxis dataKey="date" minTickGap={22} tick={{ fill: "#94a3b8", fontSize: 9 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 9 }} /><Tooltip {...tooltip} /><Line dataKey={selectedTicker} name={`${selectedTicker} 归一化`} stroke="#22d3ee" dot={false} isAnimationActive={false} />{available.filter(row => row.ticker !== selectedTicker).map((row, index) => <Line key={row.ticker} dataKey={row.ticker} name={`${row.ticker} 归一化`} stroke={["#a78bfa", "#f59e0b", "#34d399", "#fb7185"][index % 4]} dot={false} strokeOpacity={0.75} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div> : <p className="px-3 py-12 text-center text-xs text-amber-200">当前清单没有足够的实际历史序列，横截面图不补值。</p>}
        <p className="px-2 pb-2 text-[10px] text-slate-500">同一公共日频来源、共同观察日；这是价格路径比较，不是总回报、评级或交易筛选。</p>
      </div>
      <div className="mt-2 grid min-w-0 gap-0 border-y border-slate-800 xl:grid-cols-[1.45fr_.85fr]" aria-label="EQS 个股 OHLCV 深度视图">
        <section className="min-w-0 border-b border-slate-800 xl:border-b-0 xl:border-r">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-2 py-2 text-[10px] text-slate-400">
            <span>{selectedTicker} · 收盘与成交量联动</span>
            <span>{selectedSummary ? `${selectedSummary.firstDate} → ${selectedSummary.lastDate}` : "序列不可读"}</span>
          </header>
          {selectedHistory.length > 1 ? (
            <div className="h-60 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={selectedHistory}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
                  <XAxis dataKey="date" minTickGap={24} tick={{ fill: "#94a3b8", fontSize: 9 }} />
                  <YAxis yAxisId="price" tick={{ fill: "#94a3b8", fontSize: 9 }} domain={["auto", "auto"]} />
                  <YAxis yAxisId="volume" orientation="right" tick={{ fill: "#64748b", fontSize: 8 }} width={44} />
                  <Tooltip {...tooltip} />
                  <Bar yAxisId="volume" dataKey="volume" name="成交量" fill="#164e63" fillOpacity={0.7} isAnimationActive={false} />
                  <Line yAxisId="price" dataKey="close" name="收盘" stroke="#22d3ee" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="px-3 py-16 text-center text-xs text-amber-200">{selectedTicker} 当前没有足够的实际 OHLCV 序列，不补绘样例曲线。</p>
          )}
        </section>
        <section className="min-w-0">
          <header className="border-b border-slate-800 px-2 py-2 text-[10px] text-slate-400">区间统计与最近 12 个观察日</header>
          <table className="w-full text-left text-[10px]">
            <tbody>
              <tr className="border-b border-slate-800"><th className="p-2 font-normal text-slate-500">区间高 / 低</th><td className="p-2 font-mono">{selectedSummary?.rangeHigh == null ? "—" : selectedSummary.rangeHigh.toFixed(2)} / {selectedSummary?.rangeLow == null ? "—" : selectedSummary.rangeLow.toFixed(2)}</td></tr>
              <tr className="border-b border-slate-800"><th className="p-2 font-normal text-slate-500">最近成交量</th><td className="p-2 font-mono">{selectedSummary?.latestVolume == null ? "—" : selectedSummary.latestVolume.toLocaleString()}</td></tr>
              <tr className="border-b border-slate-800"><th className="p-2 font-normal text-slate-500">时效 / 质量</th><td className="p-2">历史/延迟 · {selectedRow?.quality ?? "不可读"}</td></tr>
              <tr className="border-b border-slate-800"><th className="p-2 font-normal text-slate-500">服务器读取 UTC</th><td className="p-2">{selectedRow?.retrievedAt ?? "—"}</td></tr>
            </tbody>
          </table>
          <div className="max-h-40 overflow-auto">
            <table className="w-full text-right text-[10px]">
              <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-1 text-left">日期</th><th>开</th><th>高</th><th>低</th><th>收</th><th className="pr-2">量</th></tr></thead>
              <tbody>{selectedHistory.slice(-12).reverse().map(point => <tr key={point.date} className="border-t border-slate-800"><td className="p-1 text-left">{point.date}</td><td>{point.open == null ? "—" : Number(point.open).toFixed(2)}</td><td>{point.high == null ? "—" : Number(point.high).toFixed(2)}</td><td>{point.low == null ? "—" : Number(point.low).toFixed(2)}</td><td className="text-cyan-200">{Number(point.close ?? point.value).toFixed(2)}</td><td className="pr-2">{point.volume == null ? "—" : Number(point.volume).toLocaleString()}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        {query.data?.sourceBoundary}
      </p>
    </ResearchSection>
  );
}

function IssuerExplorer({
  mode = "events",
}: {
  mode?: "events" | "facts" | "excerpt" | "ma" | "ipo" | "trend" | "top";
}) {
  const [draft, setDraft] = useState("AAPL");
  const [cik, setCik] = useState("");
  const [keyword, setKeyword] = useState("merger");
  const search = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: draft || "A", limit: 8 },
    { enabled: draft.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000 }
  );
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000 }
  );
  const facts = trpc.stockMarketResearch.getCompanyFacts.useQuery(
    { cik: cik || "0" },
    { enabled: mode === "facts" && Boolean(cik), staleTime: 60_000 }
  );
  const [selected, setSelected] = useState<any>(null);
  const excerpt = trpc.stockMarketResearch.getFilingExcerpt.useQuery(
    {
      cik: cik || "0",
      accessionNumber: selected?.accessionNumber ?? "0000000000",
      primaryDocument: selected?.primaryDocument ?? "pending.htm",
      keyword,
    },
    {
      enabled:
        mode === "excerpt" &&
        Boolean(selected?.accessionNumber && selected?.primaryDocument) &&
        keyword.length >= 2,
    }
  );
  const forms =
    mode === "ma"
      ? new Set(["S-4", "DEFM14A", "8-K"])
      : mode === "ipo"
        ? new Set(["S-1", "S-1/A", "424B2", "424B3", "424B5"])
        : null;
  const records = (filings.data?.filings ?? []).filter(
    (row: any) => !forms || forms.has(row.form)
  );
  const trend = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((row: any) => {
      const month = row.filingDate?.slice(0, 7);
      if (month) map.set(month, (map.get(month) ?? 0) + 1);
    });
    return Array.from(map, ([month, count]) => ({ month, count }));
  }, [records]);
  return (
    <ResearchSection
      title={
        mode === "facts"
          ? "SEC 行业与报告期事实"
          : mode === "excerpt"
            ? "SEC 文件证据定位"
            : mode === "ma"
              ? "SEC 并购文件核验"
              : mode === "ipo"
                ? "SEC 公开发行文件时间线"
                : mode === "trend"
                  ? "SEC 申报表单趋势"
                  : mode === "top"
                    ? "近期 SEC 公开文件"
                    : "SEC 公开申报事件目录"
      }
      action={<FileSearch className="h-3.5 w-3.5 text-cyan-300" />}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] text-slate-500">
          主体名称、代码或 CIK
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            className="input-terminal mt-1 w-44 text-xs"
          />
        </label>
      </div>
      <div className="mt-2 max-h-32 overflow-auto border-y border-slate-800">
        {search.isLoading ? (
          <LoadingState text="正在读取 SEC 主体目录…" />
        ) : (
          (search.data?.results ?? []).map((row: any) => (
            <button
              type="button"
              key={row.cik}
              onClick={() => {
                setCik(row.cik);
                setDraft(row.ticker);
                setSelected(null);
              }}
              className={`block w-full border-b border-slate-800 p-2 text-left hover:bg-slate-900 ${cik === row.cik ? "bg-cyan-950/30" : ""}`}
            >
              <b className="font-mono text-xs text-cyan-200">{row.ticker}</b>
              <span className="ml-2 text-[10px] text-slate-500">
                CIK {row.cik} · {row.name}
              </span>
            </button>
          ))
        )}
      </div>
      {!cik ? (
        <p className="mt-3 text-xs text-slate-500">
          选择主体后，终端将在此读取实际 SEC 公开资料。
        </p>
      ) : mode === "facts" ? (
        facts.isLoading ? (
          <LoadingState text="正在读取 SEC XBRL 公司事实…" />
        ) : (
          <>
            <div className="mt-3 text-xs text-slate-300">
              {facts.data?.issuer?.name ?? "—"} · CIK {cik}
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-[650px] w-full text-left text-[10px]">
                <thead className="text-slate-500">
                  <tr>
                    <th>事实</th>
                    <th>报告期</th>
                    <th>值</th>
                    <th>表单</th>
                    <th>申报日</th>
                  </tr>
                </thead>
                <tbody>
                  {(facts.data?.metrics ?? []).flatMap((metric: any) =>
                    metric.observations
                      .slice(-3)
                      .map((row: any, index: number) => (
                        <tr
                          key={`${metric.id}-${index}`}
                          className="border-t border-slate-800"
                        >
                          <td className="py-1.5 text-cyan-200">
                            {metric.label}
                          </td>
                          <td>{row.end ?? "—"}</td>
                          <td>
                            {row.value ?? "—"} {metric.unit}
                          </td>
                          <td>{row.form ?? "—"}</td>
                          <td>{row.filed ?? "—"}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              {facts.data?.sourceBoundary}
            </p>
          </>
        )
      ) : filings.isLoading ? (
        <LoadingState text="正在读取 SEC 申报目录…" />
      ) : (
        <>
          {mode === "trend" && (
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                  />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" name="申报数量" fill="#22d3ee" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {mode === "excerpt" && (
            <label className="mt-3 block text-[10px] text-slate-500">
              关键词
              <input
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                className="input-terminal mt-1 w-full text-xs"
              />
            </label>
          )}
          <div className="mt-3 max-h-56 overflow-auto divide-y divide-slate-800 border-y border-slate-800">
            {records.map((row: any) => (
              <button
                type="button"
                key={`${row.accessionNumber}-${row.primaryDocument}`}
                onClick={() => setSelected(row)}
                className="block w-full p-2 text-left hover:bg-slate-900"
              >
                <div className="flex justify-between">
                  <b className="font-mono text-xs text-amber-200">{row.form}</b>
                  <span className="text-[10px] text-slate-500">
                    {row.filingDate ?? "—"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {row.primaryDocument ?? "主文件未返回"} · {row.category}
                </p>
              </button>
            ))}
            {!records.length && (
              <p className="p-3 text-xs text-slate-500">
                当前主体未返回匹配的实际申报记录。
              </p>
            )}
          </div>
          {mode === "excerpt" && selected && (
            <div className="mt-3 border-y border-slate-800 bg-slate-950/20 p-3">
              {excerpt.isLoading ? (
                <LoadingState text="正在提取 SEC 原文片段…" />
              ) : excerpt.data?.status === "available" ? (
                <>
                  <p className="whitespace-pre-wrap text-xs leading-6 text-slate-300">
                    {excerpt.data.excerpt}
                  </p>
                  <p className="mt-2 text-[10px] text-cyan-200">
                    {excerpt.data.sourceBoundary}
                  </p>
                </>
              ) : (
                <p className="text-xs text-amber-200">
                  {excerpt.data?.sourceBoundary}
                </p>
              )}
            </div>
          )}
          <p className="mt-2 text-[10px] text-slate-500">
            {filings.data?.sourceBoundary}
          </p>
        </>
      )}
    </ResearchSection>
  );
}

function InputGate({ mode }: { mode: "exposure" | "portfolio" | "execution" }) {
  const [issuer, setIssuer] = useState("");
  const [sector, setSector] = useState("");
  const [weight, setWeight] = useState("");
  const [action, setAction] = useState("");
  const numericWeight = weight.trim() ? Number(weight) : null;
  const validWeight =
    numericWeight != null &&
    Number.isFinite(numericWeight) &&
    numericWeight >= 0 &&
    (mode === "execution" || numericWeight <= 100);
  const fields = [
    { label: "主体 / 代码", value: issuer, set: setIssuer },
    {
      label: mode === "execution" ? "研究方向 / 目的" : "行业 / 分类",
      value: mode === "execution" ? action : sector,
      set: mode === "execution" ? setAction : setSector,
    },
    {
      label: mode === "execution" ? "数量（仅记录）" : "用户输入权重（%）",
      value: weight,
      set: setWeight,
    },
  ];
  return (
    <ResearchSection
      title={
        mode === "execution"
          ? "EMSX · 交易前资料检查"
          : mode === "portfolio"
            ? "PORT · 透明权重集中度"
            : "TLTS · 暴露资料检查"
      }
    >
      <table className="w-full text-left text-[11px]">
        <thead className="text-slate-500">
          <tr>
            <th className="p-2">字段</th>
            <th className="p-2">用户输入</th>
            <th className="p-2">校验</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.label} className="border-t border-slate-800">
              <th className="p-2 font-normal text-slate-400">{field.label}</th>
              <td className="p-2">
                <input
                  aria-label={field.label}
                  value={field.value}
                  onChange={event => field.set(event.target.value)}
                  type={index === 2 ? "number" : "text"}
                  className="input-terminal h-7 w-full text-xs"
                />
              </td>
              <td className="p-2 text-slate-500">
                {index === 2
                  ? validWeight
                    ? "数值有效"
                    : weight
                      ? "超出范围 / 数值无效"
                      : "待输入"
                  : field.value.trim()
                    ? "已填写"
                    : "待输入"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {mode === "portfolio" && validWeight && (
        <div className="h-40 border-t border-slate-800 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { label: "用户输入权重", value: numericWeight },
                { label: "未分配部分", value: 100 - numericWeight! },
              ]}
            >
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
              />
              <Tooltip {...tooltip} />
              <Bar
                dataKey="value"
                name="输入权重"
                fill="#22d3ee"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="border-t border-slate-800 p-2 text-[10px] text-slate-500">
        仅验证当前用户输入，不作为账户持仓、交易指令、风险模型或市场数据。不发送订单。
      </p>
    </ResearchSection>
  );
}

function Restricted({ title, body }: { title: string; body: string }) {
  return (
    <ResearchSection
      title={title}
      action={<ShieldAlert className="h-3.5 w-3.5 text-amber-300" />}
    >
      <div className="border-y border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">
        {body}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        终端不会以旧页面样式、缓存样本、替代指数或随机数字填补这些字段。
      </p>
    </ResearchSection>
  );
}

function IndexReferencePanel() {
  return <IndexBenchmarkWorkbench />;
}

function FactorAvailabilityPanel() {
  const query = trpc.stockMarketResearch.getEnvironment.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const rows = query.data?.series ?? [];
  return (
    <ResearchSection title="FACTOR LAB · 环境因子可用性矩阵">
      <p className="text-xs text-slate-400">
        本入口只审计公开环境序列是否可读、观测时点和历史覆盖，不生成因子收益、IC、IR、拥挤度、回测或预测。
      </p>
      {query.isLoading ? (
        <LoadingState text="正在核验公开环境序列可用性…" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[620px] w-full text-left text-[10px]">
            <thead className="text-slate-500">
              <tr>
                <th>环境序列</th>
                <th>类别</th>
                <th>状态</th>
                <th>最近观测</th>
                <th>历史点数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="py-2 text-cyan-200">{row.label}</td>
                  <td>{row.group ?? "—"}</td>
                  <td>
                    <Badge tone={row.status === "available" ? "pos" : "warn"}>
                      {row.status === "available" ? "实际可读" : "暂不可读"}
                    </Badge>
                  </td>
                  <td>{row.observationDate ?? "—"}</td>
                  <td>{row.history?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        {query.data?.sourceBoundary}
      </p>
    </ResearchSection>
  );
}

function WatchlistCoveragePanel() {
  const [text, setText] = useState("AAPL,MSFT,SPY");
  const [submitted, setSubmitted] = useState(["AAPL", "MSFT", "SPY"]);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: submitted, range: "3mo" },
    { staleTime: 30_000 }
  );
  return (
    <ResearchSection title="FSRC · 观察清单资料覆盖">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-[10px] text-slate-500">
          代码清单（最多 10 个，逗号分隔）
          <input
            value={text}
            onChange={event => setText(event.target.value.toUpperCase())}
            className="input-terminal mt-1 w-full text-xs"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setSubmitted(
              text
                .split(",")
                .map(item => item.trim())
                .filter(Boolean)
                .slice(0, 10)
            )
          }
          className="border border-cyan-900 px-3 py-2 text-xs text-cyan-200"
        >
          核验覆盖
        </button>
      </div>
      {query.isLoading ? (
        <LoadingState text="正在核验清单资料覆盖…" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[600px] w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th>代码</th>
                <th>读取状态</th>
                <th>历史点数</th>
                <th>最近观测</th>
                <th>资料结论</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.rows ?? []).map((row: any) => (
                <tr key={row.ticker} className="border-t border-slate-800">
                  <td className="py-2 font-mono text-cyan-200">{row.ticker}</td>
                  <td>
                    <Badge tone={row.status === "available" ? "pos" : "warn"}>
                      {row.status === "available" ? "实际可读" : "暂不可读"}
                    </Badge>
                  </td>
                  <td>{row.points}</td>
                  <td>{row.latestDate ?? "—"}</td>
                  <td className="text-slate-400">
                    {row.status === "available"
                      ? "可进入后续终端观察"
                      : "保持真实空状态"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        本入口不展示价格、涨跌或排名；仅核验公开日频观察是否具备后续阅读条件。
      </p>
    </ResearchSection>
  );
}

function FilingEventTimeline() {
  const [draft, setDraft] = useState("AAPL");
  const [cik, setCik] = useState("");
  const search = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: draft || "A", limit: 8 },
    { enabled: draft.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000 }
  );
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000 }
  );
  const events = (filings.data?.filings ?? []).filter(
    (row: any) => row.category === "event"
  );
  return (
    <ResearchSection title="EVTS · SEC 公开申报事件时间线">
      <label className="text-[10px] text-slate-500">
        主体名称、代码或 CIK
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          className="input-terminal mt-1 w-48 text-xs"
        />
      </label>
      <div className="mt-2 max-h-28 overflow-auto border-y border-slate-800">
        {(search.data?.results ?? []).map((row: any) => (
          <button
            type="button"
            key={row.cik}
            onClick={() => {
              setCik(row.cik);
              setDraft(row.ticker);
            }}
            className={`block w-full border-b border-slate-800 p-2 text-left text-xs hover:bg-slate-900 ${cik === row.cik ? "bg-cyan-950/30" : ""}`}
          >
            <span className="font-mono text-cyan-200">{row.ticker}</span>
            <span className="ml-2 text-slate-500">{row.name}</span>
          </button>
        ))}
      </div>
      {!cik ? (
        <p className="mt-3 text-xs text-slate-500">
          选择主体后显示实际 8-K 类公开事件时间线。
        </p>
      ) : filings.isLoading ? (
        <LoadingState text="正在读取 SEC 公开事件…" />
      ) : (
        <div className="mt-3 space-y-1">
          {events.map((row: any) => (
            <div
              key={`${row.accessionNumber}-${row.primaryDocument}`}
              className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-800 px-2 py-1.5 text-xs"
            >
              <span>
                <b className="font-mono text-amber-200">{row.form}</b>
                <span className="ml-2 text-slate-400">
                  {row.primaryDocument ?? "主文件未返回"}
                </span>
              </span>
              <span className="text-slate-500">{row.filingDate ?? "—"}</span>
            </div>
          ))}
          {!events.length && (
            <p className="border-y border-slate-800 p-3 text-xs text-slate-500">
              当前主体未返回实际公开事件表单；不生成事件、新闻或市场影响替代内容。
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        仅按 SEC 实际表单、日期和主文件呈现事件目录，不推断事件影响。
      </p>
    </ResearchSection>
  );
}

function LatestFilingSnapshot() {
  const [draft, setDraft] = useState("AAPL");
  const [cik, setCik] = useState("");
  const search = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: draft || "A", limit: 8 },
    { enabled: draft.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000 }
  );
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000 }
  );
  const latest = (filings.data?.filings ?? []).slice(0, 8);
  return (
    <ResearchSection title="TOP · 最近实际可读公开文件">
      <label className="text-[10px] text-slate-500">
        主体名称、代码或 CIK
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          className="input-terminal mt-1 w-48 text-xs"
        />
      </label>
      <div className="mt-2 max-h-28 overflow-auto border-y border-slate-800">
        {(search.data?.results ?? []).map((row: any) => (
          <button
            type="button"
            key={row.cik}
            onClick={() => {
              setCik(row.cik);
              setDraft(row.ticker);
            }}
            className={`block w-full border-b border-slate-800 p-2 text-left text-xs hover:bg-slate-900 ${cik === row.cik ? "bg-cyan-950/30" : ""}`}
          >
            <span className="font-mono text-cyan-200">{row.ticker}</span>
            <span className="ml-2 text-slate-500">{row.name}</span>
          </button>
        ))}
      </div>
      {!cik ? (
        <p className="mt-3 text-xs text-slate-500">
          选择主体后显示最近实际可读的公开文件快照。
        </p>
      ) : filings.isLoading ? (
        <LoadingState text="正在读取最近公开文件…" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[560px] w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th>表单</th>
                <th>申报日</th>
                <th>文件</th>
                <th>目录类别</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((row: any) => (
                <tr
                  key={`${row.accessionNumber}-${row.primaryDocument}`}
                  className="border-t border-slate-800"
                >
                  <td className="py-2 font-mono text-amber-200">{row.form}</td>
                  <td>{row.filingDate ?? "—"}</td>
                  <td className="text-slate-400">
                    {row.primaryDocument ?? "主文件未返回"}
                  </td>
                  <td>{row.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        本快照只保留最近八份实际 SEC 文件，完整目录请使用
        CACT，不与事件日历重复。
      </p>
    </ResearchSection>
  );
}

function IndexedPricePath() {
  return (
    <TickerObservationDesk
      title="IMAP · 指数化历史路径"
      initialView="curve"
      focus="curve"
    />
  );
}

function PriceVolumePath() {
  return (
    <TickerObservationDesk
      title="IMAP · 量价联动"
      initialView="volume"
      focus="volume"
    />
  );
}

function EvtsFilterTimeline() {
  const { isAuthenticated } = useAuth();
  const [draft, setDraft] = useState("AAPL");
  const [cik, setCik] = useState("");
  const [forms, setForms] = useState<SecForm[]>(["8-K"]);
  const restored = useRef(false);
  const preference = trpc.stockMarketResearch.getEvtsFormPreference.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 60_000 }
  );
  const savePreference =
    trpc.stockMarketResearch.saveEvtsFormPreference.useMutation();
  useEffect(() => {
    if (isAuthenticated && preference.data && !restored.current) {
      const restoredForms = preference.data.forms.filter(isSecForm);
      setForms(restoredForms.length ? restoredForms : ["8-K"]);
      restored.current = true;
    }
  }, [isAuthenticated, preference.data]);
  const search = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: draft || "A", limit: 8 },
    { enabled: draft.trim().length >= 2, staleTime: 6 * 60 * 60 * 1000 }
  );
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000 }
  );
  const records = (filings.data?.filings ?? []).filter((row: any) =>
    forms.includes(row.form)
  );
  const options = SEC_FORM_OPTIONS;
  const toggle = (form: SecForm) =>
    setForms(current =>
      current.includes(form)
        ? current.length > 1
          ? current.filter(item => item !== form)
          : current
        : [...current, form]
    );
  return (
    <ResearchSection title="EVTS · SEC 表单筛选事件时间线">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label className="text-[10px] text-slate-500">
          主体名称、代码或 CIK
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            className="input-terminal mt-1 w-48 text-xs"
          />
        </label>
        {isAuthenticated ? (
          <button
            type="button"
            disabled={savePreference.isPending}
            onClick={() => savePreference.mutate({ forms })}
            className="border border-violet-800 px-2 py-1.5 text-[10px] text-violet-100 disabled:opacity-50"
          >
            {savePreference.isPending ? "保存中…" : "保存当前筛选"}
          </button>
        ) : (
          <Badge tone="warn">登录后保存筛选</Badge>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {options.map(form => (
          <button
            type="button"
            key={form}
            onClick={() => toggle(form)}
            className={`rounded border px-2 py-1 font-mono text-[10px] ${forms.includes(form) ? "border-cyan-700 bg-cyan-950/50 text-cyan-100" : "border-slate-700 text-slate-500"}`}
          >
            {form}
          </button>
        ))}
      </div>
      {savePreference.isSuccess && (
        <p className="mt-2 text-[10px] text-emerald-300">
          SEC 表单筛选已保存至当前账户。
        </p>
      )}
      {savePreference.isError && (
        <p className="mt-2 text-[10px] text-rose-300">
          筛选暂未保存；当前终端筛选仍保留在本窗口。
        </p>
      )}
      {preference.isError && isAuthenticated && (
        <p className="mt-2 text-[10px] text-amber-200">
          无法读取已保存筛选，已保留默认 8-K 筛选且不替代 SEC 记录。
        </p>
      )}
      <div className="mt-2 max-h-28 overflow-auto border-y border-slate-800">
        {search.isLoading ? (
          <LoadingState text="正在读取 SEC 主体目录…" />
        ) : (
          (search.data?.results ?? []).map((row: any) => (
            <button
              type="button"
              key={row.cik}
              onClick={() => {
                setCik(row.cik);
                setDraft(row.ticker);
              }}
              className={`block w-full border-b border-slate-800 p-2 text-left text-xs hover:bg-slate-900 ${cik === row.cik ? "bg-cyan-950/30" : ""}`}
            >
              <span className="font-mono text-cyan-200">{row.ticker}</span>
              <span className="ml-2 text-slate-500">{row.name}</span>
            </button>
          ))
        )}
      </div>
      {!cik ? (
        <p className="mt-3 text-xs text-slate-500">
          选择主体后显示与所选 SEC 表单完全匹配的实际申报时间线。
        </p>
      ) : filings.isLoading ? (
        <LoadingState text="正在读取 SEC 公开申报目录…" />
      ) : (
        <div className="mt-3 space-y-1">
          {records.map((row: any) => (
            <div
              key={`${row.accessionNumber}-${row.primaryDocument}`}
              className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-800 px-2 py-1.5 text-xs"
            >
              <span>
                <b className="font-mono text-amber-200">{row.form}</b>
                <span className="ml-2 text-slate-400">
                  {row.primaryDocument ?? "主文件未返回"}
                </span>
              </span>
              <span className="text-slate-500">{row.filingDate ?? "—"}</span>
            </div>
          ))}
          {!records.length && (
            <p className="border-y border-slate-800 p-3 text-xs text-slate-500">
              当前主体未返回与所选表单匹配的实际 SEC
              申报；不生成事件、新闻或市场影响替代内容。
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        只保存当前账户选择的表单类别；申报目录继续按需从 SEC
        读取，不保存正文或推断事件影响。
      </p>
    </ResearchSection>
  );
}

function AccountFsrcWatchlist() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [text, setText] = useState("AAPL,MSFT,SPY");
  const [submitted, setSubmitted] = useState(["AAPL", "MSFT", "SPY"]);
  const [changes, setChanges] = useState<any[]>([]);
  const restored = useRef(false);
  const persisted = trpc.stockMarketResearch.getFsrcWatchlist.useQuery(
    undefined,
    { enabled: isAuthenticated, staleTime: 30_000 }
  );
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: submitted, range: "3mo" },
    { staleTime: 30_000 }
  );
  const save = trpc.stockMarketResearch.saveFsrcWatchlist.useMutation({
    onSuccess: result => {
      setSubmitted(result.tickers);
      setText(result.tickers.join(","));
      setChanges(result.coverageChanges);
      utils.stockMarketResearch.getFsrcWatchlist.invalidate();
    },
  });
  const refresh = trpc.stockMarketResearch.refreshFsrcWatchlist.useMutation({
    onSuccess: result => {
      if (result.status === "available") {
        setChanges(result.coverageChanges);
        utils.stockMarketResearch.getFsrcWatchlist.invalidate();
        utils.stockMarketResearch.getWatchlistObservations.invalidate();
      }
    },
  });
  useEffect(() => {
    if (isAuthenticated && persisted.data?.exists && !restored.current) {
      const next = persisted.data.tickers;
      setSubmitted(next);
      setText(next.join(","));
      restored.current = true;
    }
  }, [isAuthenticated, persisted.data]);
  const applyDraft = () =>
    setSubmitted(
      text
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 10)
    );
  const changeText = (change: any) =>
    change.type === "coverage_lost"
      ? `${change.ticker}：公开覆盖由可读变为暂不可读`
      : change.type === "coverage_restored"
        ? `${change.ticker}：公开覆盖恢复可读`
        : `${change.ticker}：历史覆盖点数由 ${change.before.points} 缩短至 ${change.after.points}`;
  return (
    <ResearchSection title="FSRC · 账户级观察清单与资料覆盖">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-[10px] text-slate-500">
          代码清单（最多 10 个，逗号分隔）
          <input
            value={text}
            onChange={event => setText(event.target.value.toUpperCase())}
            className="input-terminal mt-1 w-full text-xs"
          />
        </label>
        <button
          type="button"
          onClick={applyDraft}
          className="border border-cyan-900 px-3 py-2 text-xs text-cyan-200"
        >
          核验覆盖
        </button>
        {isAuthenticated ? (
          <>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  tickers: text
                    .split(",")
                    .map(item => item.trim())
                    .filter(Boolean)
                    .slice(0, 10),
                })
              }
              className="border border-violet-800 px-3 py-2 text-xs text-violet-100 disabled:opacity-50"
            >
              {save.isPending ? "保存中…" : "保存至账户"}
            </button>
            <button
              type="button"
              disabled={refresh.isPending || !persisted.data?.exists}
              onClick={() => refresh.mutate()}
              className="rounded border border-amber-800 px-3 py-2 text-xs text-amber-100 disabled:opacity-50"
            >
              {refresh.isPending ? "检查中…" : "检查覆盖变化"}
            </button>
          </>
        ) : (
          <Badge tone="warn">登录后保存清单</Badge>
        )}
      </div>
      {save.isSuccess && (
        <p className="mt-2 text-[10px] text-emerald-300">
          清单与当前覆盖快照已保存至当前账户。
        </p>
      )}
      {save.isError && (
        <p className="mt-2 text-[10px] text-rose-300">
          清单暂未保存；当前核验结果仍保留在此窗口。
        </p>
      )}
      {refresh.data?.status === "missing" && (
        <p className="mt-2 text-[10px] text-amber-200">
          {refresh.data.sourceBoundary}
        </p>
      )}
      {persisted.isError && isAuthenticated && (
        <p className="mt-2 text-[10px] text-amber-200">
          无法读取账户已保存清单；已保留当前窗口输入，不以示例清单替代。
        </p>
      )}
      {changes.length > 0 && (
        <div className="mt-3 border-y border-amber-700 bg-amber-950/30 p-3">
          <b className="text-xs text-amber-100">覆盖变化提醒</b>
          {changes.map((change, index) => (
            <p
              key={`${change.ticker}-${index}`}
              className="mt-1 text-[11px] text-amber-200"
            >
              {changeText(change)}
            </p>
          ))}
        </div>
      )}
      {query.isLoading ? (
        <LoadingState text="正在核验清单资料覆盖…" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[600px] w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th>代码</th>
                <th>读取状态</th>
                <th>历史点数</th>
                <th>最近观测</th>
                <th>资料结论</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.rows ?? []).map((row: any) => (
                <tr key={row.ticker} className="border-t border-slate-800">
                  <td className="py-2 font-mono text-cyan-200">{row.ticker}</td>
                  <td>
                    <Badge tone={row.status === "available" ? "pos" : "warn"}>
                      {row.status === "available" ? "实际可读" : "暂不可读"}
                    </Badge>
                  </td>
                  <td>{row.points}</td>
                  <td>{row.latestDate ?? "—"}</td>
                  <td className="text-slate-400">
                    {row.status === "available"
                      ? "可进入后续终端观察"
                      : "保持真实空状态"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        账户只保存代码及覆盖快照，不保存价格或完整历史。提醒仅在可读性改变或历史覆盖缩短时出现，不以价格变化制造提醒。
      </p>
    </ResearchSection>
  );
}

function ResearchPath({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const steps = [
    [
      "FTW",
      "ftw",
      "证券报价与日频历史",
      "读取证券代码、报价字段和同源价格序列",
    ],
    ["CACT", "cact", "公司公开事件", "核验 SEC 表单、申报日与文件标识"],
    ["DS", "ds", "原文证据", "按关键词定位受限长度原文片段"],
    [
      "BI STOX",
      "bi-stox",
      "报告期事实",
      "核对 XBRL 字段、财年、报告期和申报版本",
    ],
    ["IN", "in", "环境参照", "阅读指数、波动率、利率与信用日频观察"],
  ];
  return (
    <ResearchSection title="RES · 研究指令路径">
      <table className="w-full text-left text-[11px]">
        <thead className="text-slate-500">
          <tr>
            <th className="p-2">步骤 / 功能</th>
            <th className="p-2">研究任务</th>
            <th className="p-2">数据职责</th>
            <th className="p-2">执行</th>
          </tr>
        </thead>
        <tbody>
          {steps.map(([code, id, label, purpose], index) => (
            <tr key={id} className="border-t border-slate-800">
              <td className="p-2 font-mono text-cyan-200">
                {index + 1} · {code}
              </td>
              <td className="p-2 text-slate-300">{label}</td>
              <td className="p-2 text-[10px] text-slate-500">{purpose}</td>
              <td className="p-2">
                <button
                  type="button"
                  disabled={!onNavigate}
                  onClick={() => onNavigate?.(id)}
                  className="border border-cyan-900 px-2 py-1 text-[10px] text-cyan-200 disabled:opacity-40"
                >
                  打开
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResearchSection>
  );
}

export default function StockMarketResearchLayer({
  moduleId,
  onNavigate,
}: {
  moduleId: string;
  onNavigate?: (targetId: string) => void;
}) {
  const id = moduleId as ModuleId;
  const meta = STOCK_MODULE_META[id] ?? STOCK_MODULE_META.wei;
  let body: React.ReactNode;
  if (id === "wei") body = <Environment />;
  else if (id === "in") body = <IndexReferencePanel />;
  else if (id === "ftw")
    body = <TickerExplorer label="FTW · 关注证券日频观察" />;
  else if (id === "imap") body = <ImapRelationWorkbench />;
  else if (id === "etf") body = <EtfRelativeWorkbench />;
  else if (id === "eqbt") body = <EqbtRiskWorkbench />;
  else if (id === "eqs") body = <Watchlist />;
  else if (id === "fsrc") body = <AccountFsrcWatchlist />;
  else if (id === "evts") body = <EvtsFilterTimeline />;
  else if (id === "cact") body = <IssuerExplorer />;
  else if (id === "top") body = <LatestFilingSnapshot />;
  else if (id === "tren") body = <IssuerExplorer mode="trend" />;
  else if (id === "ds") body = <IssuerExplorer mode="excerpt" />;
  else if (id === "bi-stox") body = <IssuerExplorer mode="facts" />;
  else if (id === "ma") body = <IssuerExplorer mode="ma" />;
  else if (id === "ipo") body = <IssuerExplorer mode="ipo" />;
  else if (id === "res") body = <ResearchPath onNavigate={onNavigate} />;
  else if (id === "tlts") body = <InputGate mode="exposure" />;
  else if (id === "port") body = <InputGate mode="portfolio" />;
  else if (id === "emsx") body = <InputGate mode="execution" />;
  else if (id === "moso")
    body = (
      <Restricted
        title="MOSO · 期权链与订单流资料边界"
        body="未接入可再分发期权链、Greeks、盘口、逐笔成交或订单流。保持真实空状态，不构造活跃合约、隐含波动率或流量结论。"
      />
    );
  else if (id === "pe")
    body = (
      <Restricted
        title="PE · 私募市场资料边界"
        body="未接入可再分发私募估值、基金净值、交易价格、融资条款或投资者名册。保持真实空状态。"
      />
    );
  else if (id === "factorlab") body = <StockFactorLabWorkspace />;
  else
    body = (
      <ResearchSection title="终端内资料边界">
        <p className="text-xs text-slate-400">
          当前入口保持原功能完整可见；新增资料请通过上方研究路径在本终端内核验。
        </p>
      </ResearchSection>
    );
  return (
    <section aria-label={`${meta.code} 数据职责`} className="min-w-0 px-2 py-2">
      <p className="mb-2 text-[10px] leading-5 text-slate-400">{meta.focus}</p>
      {body}
    </section>
  );
}
