import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/sovereign/PanelKit";
import { trpc } from "@/lib/trpc";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Download, Filter, RefreshCw } from "lucide-react";
import { useModuleLiveFeed } from "@/hooks/useModuleLiveFeed";
import { collectOpenBBDatasetRows, readDatasetNumber, readDatasetText } from "@/lib/openbbDataset";

type Range = "1mo" | "3mo" | "6mo" | "1y";
type Point = { date: string; value: number };
type ObservationRow = {
  ticker: string;
  securityName?: string | null;
  status: "available" | "unavailable";
  price: number | null;
  changePct: number | null;
  currency: string | null;
  points: number;
  latestDate: string | null;
  history?: Point[];
};

function archivedEquityRows(items: ReturnType<typeof useModuleLiveFeed>["items"]): ObservationRow[] {
  const grouped = new Map<string, Map<string, number>>();
  const labels = new Map<string, string>();
  const names = new Map<string, string>();
  const currencies = new Map<string, string>();
  const snapshotChanges = new Map<string, number>();
  for (const row of collectOpenBBDatasetRows(items)) {
    const ticker = readDatasetText(row.values, ["symbol", "ticker", "标的"], "").toUpperCase();
    const date = readDatasetText(row.values, ["date", "观察期", "timestamp"], "");
    const aShareSnapshot = row.datasetLabel === "中国股票公开快照";
    // A verified cross-sectional spot observation is a price, not a daily
    // close. Other contracts still require an explicit OHLCV close, so
    // dividends, valuations and directory rows cannot become price history.
    const close = aShareSnapshot
      ? readDatasetNumber(row.values, ["value", "最新价"])
      : readDatasetNumber(row.values, ["close", "收盘价"]);
    if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(date) || close === null) continue;
    const history = grouped.get(ticker) ?? new Map<string, number>();
    history.set(date, close);
    grouped.set(ticker, history);
    labels.set(ticker, row.datasetLabel);
    const securityName = readDatasetText(row.values, ["security_name", "securityName", "name", "名称"], "");
    if (securityName) names.set(ticker, securityName);
    const currency = readDatasetText(row.values, ["currency", "币种"], "");
    if (currency || aShareSnapshot) currencies.set(ticker, currency || "CNY");
    if (aShareSnapshot) {
      const change = readDatasetNumber(row.values, ["change_pct", "涨跌幅"]);
      if (change !== null) snapshotChanges.set(ticker, change);
    }
  }
  return [...grouped.entries()].flatMap(([ticker, values]) => {
    const history = [...values.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }));
    const latest = history.at(-1);
    if (!latest) return [];
    const previous = history.at(-2)?.value ?? null;
    return [{
      ticker,
      securityName: names.get(ticker) ?? null,
      status: "available" as const,
      price: latest.value,
      changePct: previous && previous !== 0 ? ((latest.value - previous) / previous) * 100 : snapshotChanges.get(ticker) ?? null,
      currency: currencies.get(ticker) ?? (/台湾|台积电/.test(labels.get(ticker) ?? "") ? "TWD" : null),
      points: history.length,
      latestDate: latest.date,
      history,
    }];
  });
}

type EquityValuation = { pe: number; date: string; fiscalPeriod: string | null };

function archivedTaiwanValuations(items: ReturnType<typeof useModuleLiveFeed>["items"]) {
  const result = new Map<string, EquityValuation>();
  for (const row of collectOpenBBDatasetRows(items)) {
    if (row.datasetLabel !== "台湾股票估值指标") continue;
    const ticker = readDatasetText(row.values, ["symbol", "标的"], "").toUpperCase();
    const date = readDatasetText(row.values, ["date", "观察期"], "");
    const pe = readDatasetNumber(row.values, ["pe", "市盈率"]);
    if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(date) || pe === null || pe <= 0) continue;
    if ((result.get(ticker)?.date ?? "") > date) continue;
    result.set(ticker, {
      pe,
      date,
      fiscalPeriod: readDatasetText(row.values, ["fiscal_year_quarter"], "") || null,
    });
  }
  return result;
}

function mergeEquityObservation(live: ObservationRow | undefined, archived: ObservationRow | undefined, ticker: string): ObservationRow {
  const byDate = new Map<string, number>();
  archived?.history?.forEach(point => byDate.set(point.date, point.value));
  live?.history?.forEach(point => byDate.set(point.date, point.value));
  const history = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }));
  const latest = history.at(-1);
  const previous = history.at(-2)?.value ?? null;
  if (latest) return {
    ticker,
    securityName: archived?.currency === "TWD"
      ? archived.securityName ?? live?.securityName ?? null
      : live?.securityName ?? archived?.securityName ?? null,
    status: "available",
    price: latest.value,
    changePct: previous && previous !== 0 ? ((latest.value - previous) / previous) * 100 : live?.changePct ?? archived?.changePct ?? null,
    currency: live?.currency ?? archived?.currency ?? null,
    points: history.length,
    latestDate: latest.date,
    history,
  };
  return live ?? archived ?? { ticker, securityName: null, status: "unavailable", price: null, changePct: null, currency: null, points: 0, latestDate: null, history: [] };
}

const RANGE_POINTS: Record<Range, number> = {
  "1mo": 21,
  "3mo": 63,
  "6mo": 126,
  "1y": 252,
};
const tooltip = {
  contentStyle: {
    background: "#020617",
    border: "1px solid #334155",
    color: "#e2e8f0",
    fontSize: 11,
  },
};

function dailyReturns(history: Point[]) {
  const result: number[] = [];
  for (let index = 1; index < history.length; index += 1) {
    const before = Number(history[index - 1]?.value);
    const after = Number(history[index]?.value);
    if (Number.isFinite(before) && before > 0 && Number.isFinite(after)) {
      result.push(after / before - 1);
    }
  }
  return result;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1)
  );
}

function maximumDrawdown(history: Point[]) {
  let peak = -Infinity;
  let drawdown = 0;
  for (const point of history) {
    const value = Number(point.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    peak = Math.max(peak, value);
    drawdown = Math.min(drawdown, value / peak - 1);
  }
  return drawdown * 100;
}

function csvCell(value: unknown) {
  const source = String(value ?? "");
  const protectedValue = /^[=+\-@]/.test(source) ? `'${source}` : source;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

function downloadCsv(name: string, rows: unknown[][]) {
  const payload = `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([payload], { type: "text/csv;charset=utf-8" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function alignSeries(rows: ObservationRow[], selected: string[]) {
  const usable = rows.filter(
    row => selected.includes(row.ticker) && (row.history?.length ?? 0) > 1
  );
  if (!usable.length) return [];
  const maps = usable.map(
    row => new Map((row.history ?? []).map(point => [point.date, point.value]))
  );
  const commonDates = [...maps[0].keys()]
    .filter(date => maps.every(map => map.has(date)))
    .sort();
  if (commonDates.length < 2) return [];
  const firstValues = maps.map(map => Number(map.get(commonDates[0])));
  return commonDates.map(date => {
    const record: Record<string, string | number> = { date };
    usable.forEach((row, index) => {
      const value = Number(maps[index].get(date));
      record[row.ticker] = Number(
        ((value / firstValues[index]) * 100).toFixed(4)
      );
    });
    const nonBenchmark = usable.filter(row => row.ticker !== "SPY");
    const constituents = nonBenchmark.length ? nonBenchmark : usable;
    record.portfolio = Number(
      (
        constituents.reduce(
          (sum, row) => sum + Number(record[row.ticker]),
          0
        ) / constituents.length
      ).toFixed(4)
    );
    return record;
  });
}

export default function EQSPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState("screener");
  const [range, setRange] = useState<Range>("3mo");
  const [draft, setDraft] = useState("AAPL,MSFT,NVDA,SPY");
  const [tickers, setTickers] = useState(["AAPL", "MSFT", "NVDA", "SPY"]);
  const [selected, setSelected] = useState(["AAPL", "MSFT", "NVDA"]);
  const archivedUniverseApplied = useRef(false);
  const tickerSelectionTouched = useRef(false);
  const [readableOnly, setReadableOnly] = useState(false);
  const [minimumCoverage, setMinimumCoverage] = useState("0");
  const [maximumPe, setMaximumPe] = useState("");
  const [minimumRoe, setMinimumRoe] = useState("");
  const [maximumDebt, setMaximumDebt] = useState("");
  const [universeQuery, setUniverseQuery] = useState("");
  const [debouncedUniverseQuery, setDebouncedUniverseQuery] = useState("");
  const [universePage, setUniversePage] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUniverseQuery(universeQuery.trim());
      setUniversePage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [universeQuery]);
  const universe = trpc.stockMarketResearch.searchEqsUniverse.useQuery(
    { query: debouncedUniverseQuery, page: universePage, limit: 30 },
    { enabled: activeTab === "screener", staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const archiveDelivery = useModuleLiveFeed("/terminal?open=eqs&module=stocks", true);
  const query = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers, range, includeHistory: true },
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    }
  );
  const fundamentals =
    trpc.stockMarketResearch.getWatchlistFundamentals.useQuery(
      { tickers },
      {
        staleTime: 5 * 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      }
    );
  const breadth = trpc.stockMarketResearch.getMarketBreadth.useQuery(
    undefined,
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  );
  const archivedRows = useMemo(() => archivedEquityRows(archiveDelivery.items), [archiveDelivery.items]);
  const taiwanValuations = useMemo(() => archivedTaiwanValuations(archiveDelivery.items), [archiveDelivery.items]);
  useEffect(() => {
    if (
      archivedUniverseApplied.current ||
      tickerSelectionTouched.current ||
      archivedRows.length === 0
    ) return;
    const archivedTickers = Array.from(
      new Set(archivedRows.map(row => row.ticker).filter(Boolean))
    ).slice(0, 20);
    if (!archivedTickers.length) return;
    archivedUniverseApplied.current = true;
    setDraft(archivedTickers.join(","));
    setTickers(archivedTickers);
    setSelected(archivedTickers.slice(0, 6));
  }, [archivedRows]);
  const liveRows = (query.data?.rows ?? []) as ObservationRow[];
  const rawRows = useMemo(() => tickers.map(ticker => mergeEquityObservation(
    liveRows.find(row => row.ticker === ticker),
    archivedRows.find(row => row.ticker === ticker),
    ticker,
  )), [archivedRows, liveRows, tickers]);
  const fundamentalRows = (fundamentals.data?.rows ?? []) as Array<any>;
  const topAdvancers =
    breadth.data?.status === "available" ? breadth.data.topAdvancers : [];
  const topDecliners =
    breadth.data?.status === "available" ? breadth.data.topDecliners : [];
  const analytics = useMemo(
    () =>
      rawRows.map(row => {
        const history = row.history ?? [];
        const returns = dailyReturns(history);
        const first = history[0]?.value;
        const last = history.at(-1)?.value;
        const rangeReturn =
          first && last && first > 0 ? (last / first - 1) * 100 : null;
        const volatility = standardDeviation(returns);
        const coverage = Math.min(
          100,
          (row.points / RANGE_POINTS[range]) * 100
        );
        const fundamental = fundamentalRows.find(
          item => item.ticker === row.ticker
        );
        const snapshot = fundamental?.snapshot;
        const annualEps = Number(snapshot?.annualEps);
        const calculatedPe =
          row.price != null && Number.isFinite(annualEps) && annualEps > 0
            ? row.price / annualEps
            : null;
        const valuation = taiwanValuations.get(row.ticker);
        const simplePe = valuation?.pe ?? calculatedPe;
        const fundamentalFields = [
          simplePe,
          snapshot?.roePct,
          snapshot?.annualEpsGrowthPct,
          snapshot?.liabilitiesToAssetsPct,
        ];
        return {
          ...row,
          rangeReturn,
          volatility:
            volatility == null ? null : volatility * Math.sqrt(252) * 100,
          drawdown: history.length > 1 ? maximumDrawdown(history) : null,
          coverage,
          cik: fundamental?.cik ?? null,
          issuerName: fundamental?.issuerName ?? null,
          simplePe,
          peBasis: valuation ? `估值观察 ${valuation.date}` : calculatedPe != null ? "收盘价/年度 EPS" : null,
          roePct: snapshot?.roePct ?? null,
          epsGrowthPct: snapshot?.annualEpsGrowthPct ?? null,
          liabilitiesToAssetsPct: snapshot?.liabilitiesToAssetsPct ?? null,
          fiscalPeriodEnd: valuation?.fiscalPeriod ?? snapshot?.fiscalPeriodEnd ?? null,
          filedAt: snapshot?.filedAt ?? null,
          marketCapitalization:
            row.price != null && Number.isFinite(Number(snapshot?.sharesOutstanding))
              ? row.price * Number(snapshot.sharesOutstanding)
              : null,
          fundamentalCoveragePct:
            (fundamentalFields.filter(value => value != null).length /
              fundamentalFields.length) *
            100,
        };
      }),
    [rawRows, fundamentalRows, taiwanValuations, range]
  );
  const rows = analytics.filter(row => {
    if (readableOnly && row.status !== "available") return false;
    if (row.coverage < (Number(minimumCoverage) || 0)) return false;
    if (maximumPe && (row.simplePe == null || row.simplePe > Number(maximumPe)))
      return false;
    if (minimumRoe && (row.roePct == null || row.roePct < Number(minimumRoe)))
      return false;
    if (
      maximumDebt &&
      (row.liabilitiesToAssetsPct == null ||
        row.liabilitiesToAssetsPct > Number(maximumDebt))
    )
      return false;
    return true;
  });
  const aligned = useMemo(
    () => alignSeries(rawRows, selected),
    [rawRows, selected]
  );
  const scatter = rows
    .filter(row => row.rangeReturn != null && row.volatility != null)
    .map(row => ({
      ticker: row.ticker,
      return: Number(row.rangeReturn?.toFixed(4)),
      volatility: Number(row.volatility?.toFixed(4)),
      points: row.points,
    }));
  const fundamentalScatter = rows
    .filter(
      row =>
        row.simplePe != null &&
        row.roePct != null &&
        row.marketCapitalization != null
    )
    .map(row => ({
      ticker: row.ticker,
      pe: Number(row.simplePe?.toFixed(4)),
      roe: Number(row.roePct?.toFixed(4)),
      marketCapitalization: row.marketCapitalization,
      fiscalPeriodEnd: row.fiscalPeriodEnd,
    }));
  const hasBenchmark = aligned.some(point => typeof point.SPY === "number");
  const latestAligned = aligned.at(-1);
  const firstAligned = aligned[0];
  const portfolioReturn = latestAligned
    ? Number(latestAligned.portfolio) - 100
    : null;
  const benchmarkReturn =
    hasBenchmark && latestAligned ? Number(latestAligned.SPY) - 100 : null;

  const applyTickers = () => {
    tickerSelectionTouched.current = true;
    const next = Array.from(
      new Set(
        draft
          .toUpperCase()
          .split(",")
          .map(value => value.trim().replace(/[^A-Z0-9.^=-]/g, ""))
          .filter(Boolean)
      )
    ).slice(0, 20);
    if (!next.length) return;
    setTickers(next);
    setSelected(previous =>
      previous.filter(ticker => next.includes(ticker)).slice(0, 6)
    );
  };

  const addUniverseTicker = (ticker: string) => {
    tickerSelectionTouched.current = true;
    setTickers(previous => {
      if (previous.includes(ticker) || previous.length >= 20) return previous;
      const next = [...previous, ticker];
      setDraft(next.join(","));
      return next;
    });
  };

  const toggle = (ticker: string) => {
    setSelected(previous =>
      previous.includes(ticker)
        ? previous.filter(value => value !== ticker)
        : [...previous, ticker].slice(-6)
    );
  };

  const exportObservations = () =>
    downloadCsv("eqs-public-observations.csv", [
      [
        "ticker",
        "status",
        "latest",
        "currency",
        "previousCloseChangePct",
        "rangeReturnPct",
        "annualizedVolatilityPct",
        "maxDrawdownPct",
        "historyPoints",
        "coveragePct",
        "observationDate",
        "source",
        "dataMode",
        "simpleAnnualPe",
        "annualRoePct",
        "annualEpsGrowthPct",
        "liabilitiesToAssetsPct",
        "fiscalPeriodEnd",
        "filedAt",
        "fundamentalSource",
      ],
      ...rows.map(row => [
        row.ticker,
        row.status,
        row.price,
        row.currency,
        row.changePct,
        row.rangeReturn,
        row.volatility,
        row.drawdown,
        row.points,
        row.coverage,
        row.latestDate,
        "public daily market observation",
        "historical/delayed",
        row.simplePe,
        row.roePct,
        row.epsGrowthPct,
        row.liabilitiesToAssetsPct,
        row.fiscalPeriodEnd,
        row.filedAt,
        fundamentals.data?.sourceLabel,
      ]),
    ]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950 font-mono text-xs text-slate-200">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-cyan-950 px-3 py-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-cyan-300" />
          <b className="text-sm text-cyan-200">EQS 股票筛选</b>
        </div>
        {onClose && (
          <button onClick={onClose} className="px-2 text-slate-400 hover:text-white">
            关闭
          </button>
        )}
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["观察日", breadth.data?.observedAt ?? "—", "text-cyan-200"],
          [`${breadth.data?.marketScope ?? "股票"}数`, breadth.data?.status === "available" ? breadth.data.total.toLocaleString() : "—", "text-slate-100"],
          ["上涨", breadth.data?.status === "available" ? breadth.data.advancing.toLocaleString() : "—", "text-emerald-300"],
          ["下跌", breadth.data?.status === "available" ? breadth.data.declining.toLocaleString() : "—", "text-rose-300"],
          ["平盘/缺少涨跌", breadth.data?.status === "available" ? breadth.data.unchanged.toLocaleString() : "—", "text-amber-200"],
          ["成交量", breadth.data?.totalVolume == null ? "—" : breadth.data.totalVolume.toLocaleString(), "text-slate-100"],
          ["成交额", breadth.data?.totalTradeValue == null ? "—" : breadth.data.totalTradeValue.toLocaleString(), "text-slate-100"],
          ["状态", breadth.data?.status === "available" ? "已归档汇总" : "等待观察", breadth.data?.status === "available" ? "text-emerald-300" : "text-amber-200"],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-[#03090e] px-2 py-1.5">
            <div className="text-[9px] text-slate-500">{label}</div>
            <div className={`mt-0.5 truncate text-[11px] ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {(topAdvancers.length > 0 || topDecliners.length > 0) && (
          <div className="grid shrink-0 gap-2 border-b border-slate-800 bg-[#03090e] px-3 py-2 lg:grid-cols-2">
            {[
              { title: "涨幅靠前（已归档观察）", items: topAdvancers, color: "text-emerald-300" },
              { title: "跌幅靠前（已归档观察）", items: topDecliners, color: "text-rose-300" },
            ].map(({ title, items, color }) => (
              <div key={title} className="min-w-0">
                <div className="mb-1 text-[9px] text-slate-500">{title}</div>
                <div className="flex gap-2 overflow-x-auto">
                  {items.map(item => (
                    <div
                      key={`${title}-${item.symbol}`}
                      className="min-w-[132px] border border-slate-800 bg-slate-950 px-2 py-1"
                    >
                      <div className="truncate text-[10px] text-cyan-200">
                        {item.symbol} {item.name ?? ""}
                      </div>
                      <div className={`mt-0.5 text-[11px] ${color}`}>
                        {item.changePct == null
                          ? item.change.toFixed(2)
                          : `${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(2)}%`}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {item.value == null ? "价格未提供" : item.value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      <div
        role="toolbar"
        className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2"
      >
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <label>
              A 股证券检索（代码或名称）
              <Input
                value={universeQuery}
                onChange={event => setUniverseQuery(event.target.value)}
                placeholder="例如 sh600000 / 浦发银行"
                className="mt-1 h-7 w-56 border-slate-700 bg-black text-xs"
              />
            </label>
            <span>观察日 {universe.data?.observedAt ?? "—"} · 匹配 {universe.data?.total ?? 0} 只 · 日频</span>
            <Button type="button" variant="outline" className="h-7 border-slate-700 bg-transparent text-xs"
              disabled={universePage === 0 || universe.isFetching}
              onClick={() => setUniversePage(page => Math.max(0, page - 1))}>上一页</Button>
            <span>第 {universePage + 1} 页</span>
            <Button type="button" variant="outline" className="h-7 border-slate-700 bg-transparent text-xs"
              disabled={!universe.data || (universePage + 1) * 30 >= universe.data.total || universe.isFetching}
              onClick={() => setUniversePage(page => page + 1)}>下一页</Button>
          </div>
          {universe.isError && <p className="mt-1 text-amber-300">证券目录暂不可读：{universe.error.message}</p>}
          <div className="mt-1 flex max-h-16 flex-wrap gap-1 overflow-auto">
            {universe.data?.rows.map(item => (
              <button key={item.ticker} type="button"
                disabled={tickers.length >= 20 && !tickers.includes(item.ticker)}
                onClick={() => addUniverseTicker(item.ticker)}
                className="border border-slate-700 px-1.5 py-0.5 text-[10px] text-cyan-200 hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                title={`${item.securityName ?? item.ticker} · ${item.observationDate} · ${item.currency} ${item.price}`}>
                {item.ticker} {item.securityName ?? ""} {tickers.includes(item.ticker) ? "✓" : "+"}
              </button>
            ))}
          </div>
        </div>
        <label className="min-w-64 flex-1 text-[10px] text-slate-500">
          证券代码（最多 20 个）
          <Input
            value={draft}
            onChange={event => {
              tickerSelectionTouched.current = true;
              setDraft(event.target.value);
            }}
            className="mt-1 h-7 border-slate-700 bg-black text-xs"
          />
        </label>
        <label className="text-[10px] text-slate-500">
          观察窗口
          <select
            value={range}
            onChange={event => setRange(event.target.value as Range)}
            className="input-terminal mt-1 h-7 text-xs"
          >
            <option value="1mo">1 个月</option>
            <option value="3mo">3 个月</option>
            <option value="6mo">6 个月</option>
            <option value="1y">1 年</option>
          </select>
        </label>
        <Button
          type="button"
          onClick={applyTickers}
          className="h-7 border border-cyan-900 bg-transparent px-3 text-xs text-cyan-200"
        >
          读取
        </Button>
        <Button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="h-7 border border-slate-700 bg-transparent px-2 text-xs text-slate-300"
        >
          <RefreshCw
            className={`mr-1 h-3 w-3 ${query.isFetching ? "animate-spin" : ""}`}
          />
          刷新
        </Button>
        <Button
          type="button"
          onClick={exportObservations}
          disabled={!rows.length}
          className="h-7 border border-slate-700 bg-transparent px-2 text-xs text-slate-300"
        >
          <Download className="mr-1 h-3 w-3" />
          CSV
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="h-8 shrink-0 justify-start rounded-none border-b border-slate-800 bg-transparent px-0">
          {[
            ["screener", "多维筛选"],
            ["scoring", "量化打分（质量）"],
            ["scatter", "回报—波动散点"],
            ["backtest", "已实现组合路径"],
          ].map(([id, label]) => (
            <TabsTrigger
              key={id}
              value={id}
              className="h-8 rounded-none border-r border-slate-800 px-3 text-xs data-[state=active]:bg-cyan-950/30 data-[state=active]:text-cyan-200"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="screener"
          className="m-0 min-h-0 flex-1 overflow-auto"
        >
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-800 p-2">
            <label className="flex items-center gap-1 text-[10px] text-slate-400">
              <input
                type="checkbox"
                checked={readableOnly}
                onChange={event => setReadableOnly(event.target.checked)}
              />
              仅可读
            </label>
            <label className="flex items-center gap-2 text-[10px] text-slate-400">
              最低覆盖率
              <input
                type="number"
                min="0"
                max="100"
                value={minimumCoverage}
                onChange={event => setMinimumCoverage(event.target.value)}
                className="input-terminal h-6 w-16 text-xs"
              />
              %
            </label>
            <label className="flex items-center gap-2 text-[10px] text-slate-400">
            市盈率≤
              <input
                type="number"
                min="0"
                value={maximumPe}
                onChange={event => setMaximumPe(event.target.value)}
                placeholder="不限"
                className="input-terminal h-6 w-16 text-xs"
              />
            </label>
            <label className="flex items-center gap-2 text-[10px] text-slate-400">
              年度 ROE≥
              <input
                type="number"
                value={minimumRoe}
                onChange={event => setMinimumRoe(event.target.value)}
                placeholder="不限"
                className="input-terminal h-6 w-16 text-xs"
              />%
            </label>
            <label className="flex items-center gap-2 text-[10px] text-slate-400">
              负债/资产≤
              <input
                type="number"
                min="0"
                max="100"
                value={maximumDebt}
                onChange={event => setMaximumDebt(event.target.value)}
                placeholder="不限"
                className="input-terminal h-6 w-16 text-xs"
              />%
            </label>
            <span className="text-[10px] text-slate-500">
              点击行选择最多 6 条序列；筛选不生成全市场排名。
            </span>
          </div>
          {query.isLoading && archivedRows.length === 0 ? (
            <LoadingState text="正在读取公共日频观察…" />
          ) : query.isError && archivedRows.length === 0 ? (
            <p className="p-4 text-amber-200">
              接口读取失败：{query.error.message}
            </p>
          ) : (
            <table className="w-full min-w-[1280px] text-left">
              <thead className="sticky top-0 bg-slate-950 text-slate-500">
                <tr>
                  {[
                    "选择",
                    "代码",
                    "证券名称",
                    "状态",
                    "最新观察",
                    "币种",
                    "前收变化",
                    "窗口变化",
                    "年化波动",
                    "最大回撤",
                    "市盈率",
                    "年度 ROE",
                    "年度 EPS 增速",
                    "负债/资产",
                    "点数/覆盖",
                    "价格观察日 / 财报期",
                  ].map(label => (
                    <th
                      key={label}
                      className="border-b border-slate-700 p-2 font-normal"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.ticker}
                    onClick={() => toggle(row.ticker)}
                    className={`${selected.includes(row.ticker) ? "bg-cyan-950/25" : ""} cursor-pointer border-b border-slate-800 hover:bg-slate-900`}
                  >
                    <td className="p-2">
                      {selected.includes(row.ticker) ? "●" : "○"}
                    </td>
                    <td className="p-2 font-bold text-cyan-200">
                      {row.ticker}
                    </td>
                    <td className="p-2 text-slate-300">
                      {row.securityName ?? "名称待交易所返回"}
                    </td>
                    <td
                      className={`p-2 ${row.status === "available" ? "text-emerald-300" : "text-amber-200"}`}
                    >
                      {row.status === "available" ? "实际可读" : "不可读"}
                    </td>
                    <td className="p-2 text-right">
                      {row.price?.toFixed(2) ?? "—"}
                    </td>
                    <td className="p-2">{row.currency ?? "—"}</td>
                    <td
                      className={`p-2 text-right ${(row.changePct ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {row.changePct == null
                        ? "—"
                        : `${row.changePct.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      {row.rangeReturn == null
                        ? "—"
                        : `${row.rangeReturn.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      {row.volatility == null
                        ? "—"
                        : `${row.volatility.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right text-rose-300">
                      {row.drawdown == null
                        ? "—"
                        : `${row.drawdown.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      {row.simplePe == null ? "未取得" : <>{row.simplePe.toFixed(2)}<span className="block text-[9px] text-slate-500">{row.peBasis}</span></>}
                    </td>
                    <td className="p-2 text-right">
                      {row.roePct == null ? "未取得" : `${row.roePct.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      {row.epsGrowthPct == null
                        ? "未取得"
                        : `${row.epsGrowthPct.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      {row.liabilitiesToAssetsPct == null
                        ? "未取得"
                        : `${row.liabilitiesToAssetsPct.toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      {row.points} / {row.coverage.toFixed(0)}%
                    </td>
                    <td className="p-2">
                      {row.latestDate ?? "—"} / {row.fiscalPeriodEnd ?? "—"}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td
                      colSpan={15}
                      className="p-6 text-center text-amber-200"
                    >
                      当前筛选没有实际可读记录；不补静态样本。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent
          value="scoring"
          className="m-0 min-h-0 flex-1 overflow-auto p-2"
        >
          <p className="mb-2 text-[10px] text-slate-400">
            两项分数只衡量“价格历史点覆盖率”和“基本面字段覆盖率”；台湾股票的市盈率采用交易所估值日频观察，其余财务字段仍按可用的财报口径显示。不是估值优劣、预测或买卖评分。
          </p>
          {rows.length ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="ticker"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <Tooltip {...tooltip} />
                    <ReferenceLine
                      y={80}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                    />
                    <Bar
                      dataKey="coverage"
                      name="历史覆盖率"
                      fill="#22d3ee"
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="fundamentalCoveragePct"
                      name="SEC 基本面字段覆盖率"
                      fill="#a78bfa"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-2 w-full text-left">
                <thead className="text-slate-500">
                  <tr>
                    <th className="p-2">代码</th>
                    <th>实际点数</th>
                    <th>窗口预期点数</th>
                    <th>覆盖率</th>
                    <th>基本面字段覆盖</th>
                    <th>基本面报告期</th>
                    <th>数据用途</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.ticker} className="border-t border-slate-800">
                      <td className="p-2 text-cyan-200">{row.ticker}</td>
                      <td>{row.points}</td>
                      <td>{RANGE_POINTS[range]}</td>
                      <td>{row.coverage.toFixed(1)}%</td>
                      <td>{row.fundamentalCoveragePct.toFixed(1)}%</td>
                      <td>{row.fiscalPeriodEnd ?? "—"}</td>
                      <td className="text-slate-400">覆盖充分性核验</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="p-6 text-amber-200">没有可评分的实际历史记录。</p>
          )}
        </TabsContent>

        <TabsContent
          value="scatter"
          className="m-0 min-h-0 flex-1 overflow-auto p-2"
        >
          <p className="mb-2 text-[10px] text-slate-400">
            横轴为同一窗口实际日收益年化波动，纵轴为实际区间价格变化，气泡大小仅代表历史点数。
          </p>
          {scatter.length ? (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="volatility"
                      name="年化波动"
                      unit="%"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="return"
                      name="窗口变化"
                      unit="%"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <ZAxis
                      type="number"
                      dataKey="points"
                      range={[80, 300]}
                      name="历史点数"
                    />
                    <ReferenceLine y={0} stroke="#64748b" />
                    <Tooltip {...tooltip} cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter
                      data={scatter}
                      fill="#22d3ee"
                      isAnimationActive={false}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <table className="w-full text-left">
                <thead className="text-slate-500">
                  <tr>
                    <th className="p-2">代码</th>
                    <th>窗口变化</th>
                    <th>年化波动</th>
                    <th>最大回撤</th>
                    <th>样本</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter(row => row.rangeReturn != null)
                    .map(row => (
                      <tr
                        key={row.ticker}
                        className="border-t border-slate-800"
                      >
                        <td className="p-2 text-cyan-200">{row.ticker}</td>
                        <td>{row.rangeReturn?.toFixed(2)}%</td>
                        <td>{row.volatility?.toFixed(2)}%</td>
                        <td>{row.drawdown?.toFixed(2)}%</td>
                        <td>{row.points}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <section className="mt-4 border-y border-slate-800">
                <header className="border-b border-slate-800 p-2 text-[10px] text-slate-400">
                  SEC 年度基本面截面 · 横轴简单年度 P/E，纵轴年度 ROE，气泡大小为公共价格×SEC 流通股数
                </header>
                {fundamentalScatter.length ? (
                  <>
                    <div className="h-72 p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            type="number"
                            dataKey="pe"
                            name="简单年度 P/E"
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                          />
                          <YAxis
                            type="number"
                            dataKey="roe"
                            name="年度 ROE"
                            unit="%"
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                          />
                          <ZAxis
                            type="number"
                            dataKey="marketCapitalization"
                            range={[90, 360]}
                            name="简单市值"
                          />
                          <ReferenceLine y={0} stroke="#64748b" />
                          <Tooltip
                            {...tooltip}
                            cursor={{ strokeDasharray: "3 3" }}
                          />
                          <Scatter
                            data={fundamentalScatter}
                            fill="#a78bfa"
                            isAnimationActive={false}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <table className="w-full text-left">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="p-2">代码</th>
                          <th>简单年度 P/E</th>
                          <th>年度 ROE</th>
                          <th>报告期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundamentalScatter.map(row => (
                          <tr
                            key={row.ticker}
                            className="border-t border-slate-800"
                          >
                            <td className="p-2 text-cyan-200">{row.ticker}</td>
                            <td>{row.pe.toFixed(2)}</td>
                            <td>{row.roe.toFixed(2)}%</td>
                            <td>{row.fiscalPeriodEnd ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="p-6 text-amber-200">
                    当前证券没有同时可读的正年度稀释 EPS、年度净利润、股东权益、流通股数与公共价格；不绘制静态因子图。
                  </p>
                )}
              </section>
            </>
          ) : (
            <p className="p-6 text-amber-200">
              实际历史点不足，不能绘制回报—波动散点。
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="backtest"
          className="m-0 min-h-0 flex-1 overflow-auto p-2"
        >
          <div className="mb-2 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <tbody>
                <tr className="border-y border-slate-800">
                  <th className="p-2 font-normal text-slate-500">组合口径</th>
                  <td className="p-2">
                    所选且可读证券，首个共同观察日等权归一化为 100
                  </td>
                  <th className="p-2 font-normal text-slate-500">组合变化</th>
                  <td className="p-2">
                    {portfolioReturn == null
                      ? "—"
                      : `${portfolioReturn.toFixed(2)}%`}
                  </td>
                  <th className="p-2 font-normal text-slate-500">SPY 参照</th>
                  <td className="p-2">
                    {benchmarkReturn == null
                      ? "未取得"
                      : `${benchmarkReturn.toFixed(2)}%`}
                  </td>
                </tr>
                <tr className="border-b border-slate-800">
                  <th className="p-2 font-normal text-slate-500">共同起点</th>
                  <td className="p-2">{firstAligned?.date ?? "—"}</td>
                  <th className="p-2 font-normal text-slate-500">共同终点</th>
                  <td className="p-2">{latestAligned?.date ?? "—"}</td>
                  <th className="p-2 font-normal text-slate-500">数据模式</th>
                  <td className="p-2">历史/延迟</td>
                </tr>
              </tbody>
            </table>
          </div>
          {aligned.length > 1 ? (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aligned}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      minTickGap={24}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip {...tooltip} />
                    <Legend />
                    <Line
                      dataKey="portfolio"
                      name="等权观察组合"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {hasBenchmark && (
                      <Line
                        dataKey="SPY"
                        name="SPY 价格参照"
                        stroke="#f59e0b"
                        dot={false}
                        strokeDasharray="4 3"
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                这是已实现价格路径观察，不含股息、交易成本、公司行动调整、幸存者偏差修正或未来信息控制，因此不宣称为策略回测。
              </p>
            </>
          ) : (
            <p className="p-6 text-amber-200">
              所选证券没有至少两个共同实际观察日，不能生成组合路径。
            </p>
          )}
        </TabsContent>
      </Tabs>
      <footer className="shrink-0 border-t border-slate-800 px-2 py-1 text-[10px] text-slate-500">
        行情、估值和财报采用各自的观察日及披露口径；台湾股票市盈率为交易所日频估值，
        其他可用市盈率为价格除以年度 EPS，两者不等同 TTM 或一致预期。
        页面自动刷新，缺少有效观察时保持空值，不生成交易信号。
      </footer>
    </div>
  );
}
