import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
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
import { FileSpreadsheet, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type View = "income" | "margins" | "balance" | "yoy" | "health";
type Observation = {
  id: string;
  start: string | null;
  end: string;
  periodType: string;
  value: number;
  form: string;
  filed: string | null;
};
type Metric = {
  id: string;
  label: string;
  unit: string;
  observations: Observation[];
};
const companies = ["AAPL", "MSFT", "GOOGL", "META", "NVDA"];
const views: Array<{ id: View; label: string }> = [
  { id: "income", label: "利润表" },
  { id: "margins", label: "利润率趋势" },
  { id: "balance", label: "资产负债" },
  { id: "yoy", label: "同比增速" },
  { id: "health", label: "财务健康" },
];
const control =
  "h-7 border border-slate-700 bg-black px-2 text-[10px] text-slate-200";
const fmt = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : "—";

export default function FSRCPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<View>("income");
  const [ticker, setTicker] = useState("AAPL");
  const [cik, setCik] = useState("");
  const issuers = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: ticker, limit: 6 },
    {
      enabled: ticker.trim().length >= 2,
      staleTime: 6 * 60 * 60 * 1000,
      retry: false,
    }
  );
  useEffect(() => {
    const exact = issuers.data?.results?.find(
      (item: any) => item.ticker?.toUpperCase() === ticker.trim().toUpperCase()
    );
    if (!cik && exact?.cik) setCik(exact.cik);
  }, [issuers.data, ticker, cik]);
  const facts = trpc.stockMarketResearch.getCompanyFacts.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 5 * 60_000, retry: false }
  );
  const metrics = (facts.data?.metrics ?? []) as Metric[];
  const byId = useMemo(
    () => new Map(metrics.map(metric => [metric.id, metric])),
    [metrics]
  );
  const revenue =
    byId.get("RevenueFromContractWithCustomerExcludingAssessedTax") ??
    byId.get("Revenues");
  const netIncome = byId.get("NetIncomeLoss");
  const eps = byId.get("EarningsPerShareDiluted");
  const assets = byId.get("Assets");
  const liabilities = byId.get("Liabilities");
  const equity = byId.get("StockholdersEquity");
  const annual = (metric?: Metric) =>
    (metric?.observations ?? []).filter(row => row.periodType === "annual");
  const quarterly = (metric?: Metric) =>
    (metric?.observations ?? []).filter(row => row.periodType === "quarter");
  const incomePeriods = useMemo(
    () => mergePeriods([revenue, netIncome, eps], "quarter"),
    [revenue, netIncome, eps]
  );
  const annualPeriods = useMemo(
    () => mergePeriods([revenue, netIncome, eps], "annual"),
    [revenue, netIncome, eps]
  );
  const balancePeriods = useMemo(
    () => mergePeriods([assets, liabilities, equity], "instant"),
    [assets, liabilities, equity]
  );
  const marginRows = annualPeriods.map(row => ({
    end: row.end,
    netMargin: ratio(
      row.NetIncomeLoss,
      row.RevenueFromContractWithCustomerExcludingAssessedTax ?? row.Revenues
    ),
  }));
  const yoyRows = annualPeriods.map((row, index, all) => ({
    end: row.end,
    revenueYoy: growth(
      row.RevenueFromContractWithCustomerExcludingAssessedTax ?? row.Revenues,
      index
        ? (all[index - 1].RevenueFromContractWithCustomerExcludingAssessedTax ??
            all[index - 1].Revenues)
        : null
    ),
    incomeYoy: growth(
      row.NetIncomeLoss,
      index ? all[index - 1].NetIncomeLoss : null
    ),
    epsYoy: growth(
      row.EarningsPerShareDiluted,
      index ? all[index - 1].EarningsPerShareDiluted : null
    ),
  }));
  const latestBalance = balancePeriods.at(-1);
  const latestAnnual = annualPeriods.at(-1);
  const healthRows = [
    [
      "负债/资产",
      ratio(latestBalance?.Liabilities, latestBalance?.Assets),
      "%",
      "同一观察日 SEC 事实",
    ],
    [
      "净资产占比",
      ratio(latestBalance?.StockholdersEquity, latestBalance?.Assets),
      "%",
      "同一观察日 SEC 事实",
    ],
    [
      "净利率",
      ratio(
        latestAnnual?.NetIncomeLoss,
        latestAnnual?.RevenueFromContractWithCustomerExcludingAssessedTax ??
          latestAnnual?.Revenues
      ),
      "%",
      "同一年度 SEC 事实",
    ],
    ["毛利率", null, "%", "当前标准化字段未接入"],
    ["自由现金流", null, "USD", "当前标准化字段未接入"],
  ] as const;
  const loading = issuers.isFetching || facts.isFetching;

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-black font-mono text-xs text-emerald-300"
      aria-label="FSRC 财务报告解析"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-emerald-950 px-2 py-2">
        <FileSpreadsheet className="h-4 w-4 text-violet-300" />
        <b className="text-violet-300">FSRC</b>
        <span className="text-emerald-700">
          财务报告解析 · 多维财务指标 · 同比环比
        </span>
        <span role="status" className="text-[10px] text-slate-500">
          {loading
            ? "正在读取 SEC XBRL"
            : cik
              ? `${(facts.data?.issuer as any)?.name ?? ticker} · CIK ${cik}`
              : "等待主体"}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="关闭 FSRC"
            onClick={onClose}
            className="ml-auto p-1 text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <div
        role="toolbar"
        className="flex flex-wrap items-center gap-1 border-b border-slate-800 p-2"
      >
        {companies.map(value => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setTicker(value);
              setCik("");
            }}
            className={`${control} ${ticker === value ? "border-violet-500 text-violet-200" : ""}`}
          >
            {value}
          </button>
        ))}
        <input
          aria-label="FSRC 公司代码"
          value={ticker}
          onChange={event => {
            setTicker(event.target.value.toUpperCase());
            setCik("");
          }}
          className={`${control} ml-1 w-32`}
        />
        <button
          type="button"
          onClick={() => {
            void issuers.refetch();
            void facts.refetch();
          }}
          className={`${control} inline-flex items-center gap-1`}
        >
          <RefreshCw className="h-3 w-3" />
          刷新来源
        </button>
      </div>
      <nav
        role="tablist"
        aria-label="FSRC 原功能"
        className="flex overflow-x-auto border-b border-emerald-950"
      >
        {views.map(view => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === view.id}
            key={view.id}
            onClick={() => setActiveTab(view.id)}
            className={`border-r border-slate-800 px-3 py-2 text-[10px] ${activeTab === view.id ? "border-b-2 border-b-violet-400 text-violet-200" : "text-emerald-700"}`}
          >
            {view.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "income" && (
          <DataSplit
            table={
              <PeriodTable
                rows={incomePeriods}
                columns={[
                  [
                    "RevenueFromContractWithCustomerExcludingAssessedTax",
                    revenue?.label ?? "营业收入",
                  ],
                  ["NetIncomeLoss", netIncome?.label ?? "净利润"],
                  ["EarningsPerShareDiluted", eps?.label ?? "稀释每股收益"],
                ]}
              />
            }
            chart={
              <SeriesChart
                rows={incomePeriods}
                keys={[
                  [
                    "RevenueFromContractWithCustomerExcludingAssessedTax",
                    "营业收入",
                  ],
                  ["NetIncomeLoss", "净利润"],
                ]}
              />
            }
            empty="当前 SEC XBRL 未返回可合并的季度利润表事实。"
          />
        )}
        {activeTab === "margins" && (
          <DataSplit
            table={
              <SimpleTable
                rows={marginRows}
                columns={[
                  ["end", "报告期"],
                  ["netMargin", "净利率 %"],
                ]}
              />
            }
            chart={
              <SeriesChart
                rows={marginRows}
                keys={[["netMargin", "净利率 %"]]}
              />
            }
            empty="需同一年度的营业收入和净利润后才能计算净利率；毛利字段未接入时不补值。"
          />
        )}
        {activeTab === "balance" && (
          <DataSplit
            table={
              <PeriodTable
                rows={balancePeriods}
                columns={[
                  ["Assets", "资产总额"],
                  ["Liabilities", "负债总额"],
                  ["StockholdersEquity", "股东权益"],
                ]}
              />
            }
            chart={
              <SeriesChart
                rows={balancePeriods}
                keys={[
                  ["Assets", "资产总额"],
                  ["Liabilities", "负债总额"],
                  ["StockholdersEquity", "股东权益"],
                ]}
              />
            }
            empty="当前 SEC XBRL 未返回可合并的资产负债事实。"
          />
        )}
        {activeTab === "yoy" && (
          <DataSplit
            table={
              <SimpleTable
                rows={yoyRows}
                columns={[
                  ["end", "年度"],
                  ["revenueYoy", "营收同比 %"],
                  ["incomeYoy", "净利润同比 %"],
                  ["epsYoy", "EPS 同比 %"],
                ]}
              />
            }
            chart={
              <SeriesChart
                rows={yoyRows}
                keys={[
                  ["revenueYoy", "营收同比 %"],
                  ["incomeYoy", "净利润同比 %"],
                  ["epsYoy", "EPS 同比 %"],
                ]}
              />
            }
            empty="至少需要两个同口径年度事实后计算同比；不混用季度和年度。"
          />
        )}
        {activeTab === "health" && (
          <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(420px,1fr)_minmax(0,1fr)]">
            <table className="h-fit w-full text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  {["指标", "实际值", "单位", "口径/状态"].map(label => (
                    <th key={label} className="p-2 font-normal">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {healthRows.map(([label, value, unit, note]) => (
                  <tr key={label} className="border-t border-slate-800">
                    <td className="p-2 text-violet-200">{label}</td>
                    <td>{fmt(value)}</td>
                    <td>{unit}</td>
                    <td
                      className={
                        value == null ? "text-amber-200" : "text-slate-500"
                      }
                    >
                      {note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-800 p-4 text-[10px] leading-6 text-slate-400 lg:border-l lg:border-t-0">
              财务健康页只显示可由当前 SEC
              事实复算的比率。缺少现金流、毛利、利息、短期债务或行业基准时，不输出综合分、雷达面积、买卖评级或健康等级。
            </div>
          </div>
        )}
      </div>
      <footer className="border-t border-emerald-950 px-2 py-1.5 text-[9px] leading-5 text-slate-500">
        来源：SEC EDGAR XBRL companyfacts ·
        不同报告期和申报版本分别保留；本页不使用固定财务数组。
        {facts.data?.sourceBoundary ? ` ${facts.data.sourceBoundary}` : ""}
      </footer>
    </section>
  );
}

type PeriodRow = { end: string; [key: string]: string | number | null };
function mergePeriods(
  metrics: Array<Metric | undefined>,
  periodType: string
): PeriodRow[] {
  const map = new Map<string, PeriodRow>();
  metrics.forEach(metric =>
    (metric?.observations ?? [])
      .filter(row => row.periodType === periodType)
      .forEach(row => {
        const current = map.get(row.end) ?? { end: row.end };
        current[metric!.id] = row.value;
        current[`${metric!.id}:filed`] = row.filed;
        map.set(row.end, current);
      })
  );
  return [...map.values()]
    .sort((a, b) => a.end.localeCompare(b.end))
    .slice(-16);
}
function ratio(numerator: unknown, denominator: unknown) {
  const a = Number(numerator);
  const b = Number(denominator);
  return Number.isFinite(a) && Number.isFinite(b) && b !== 0
    ? Number(((a / b) * 100).toFixed(4))
    : null;
}
function growth(value: unknown, previous: unknown) {
  const a = Number(value);
  const b = Number(previous);
  return Number.isFinite(a) && Number.isFinite(b) && b !== 0
    ? Number(((a / b - 1) * 100).toFixed(4))
    : null;
}
function DataSplit({
  table,
  chart,
  empty,
}: {
  table: ReactNode;
  chart: ReactNode;
  empty: string;
}) {
  return (
    <div className="grid min-h-[440px] grid-cols-1 lg:grid-cols-[minmax(420px,1fr)_minmax(0,1fr)]">
      <div className="overflow-auto border-b border-slate-800 lg:border-b-0 lg:border-r">{table}</div>
      <div className="h-[430px] p-2">
        {chart}
        <p className="px-2 text-[9px] leading-5 text-slate-500">{empty}</p>
      </div>
    </div>
  );
}
function PeriodTable({
  rows,
  columns,
}: {
  rows: PeriodRow[];
  columns: Array<[string, string]>;
}) {
  return (
    <table className="w-full min-w-[620px] text-left text-[10px]">
      <thead className="text-slate-500">
        <tr>
          <th className="p-2 font-normal">报告期</th>
          {columns.map(([, label]) => (
            <th key={label} className="p-2 font-normal">
              {label}
            </th>
          ))}
          <th className="p-2 font-normal">申报日</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.end} className="border-t border-slate-800">
            <td className="p-2">{row.end}</td>
            {columns.map(([key]) => (
              <td key={key}>{fmt(row[key])}</td>
            ))}
            <td className="text-slate-500">
              {columns.map(([key]) => row[`${key}:filed`]).find(Boolean) ?? "—"}
            </td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td
              colSpan={columns.length + 2}
              className="p-5 text-center text-amber-200"
            >
              当前无可显示事实。
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
function SimpleTable({
  rows,
  columns,
}: {
  rows: PeriodRow[];
  columns: Array<[string, string]>;
}) {
  return (
    <table className="w-full min-w-[520px] text-left text-[10px]">
      <thead className="text-slate-500">
        <tr>
          {columns.map(([, label]) => (
            <th key={label} className="p-2 font-normal">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.end}-${index}`} className="border-t border-slate-800">
            {columns.map(([key]) => (
              <td key={key} className="p-2">
                {key === "end" ? row[key] : fmt(row[key])}
              </td>
            ))}
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td
              colSpan={columns.length}
              className="p-5 text-center text-amber-200"
            >
              当前无可复算数据。
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
function SeriesChart({
  rows,
  keys,
}: {
  rows: PeriodRow[];
  keys: Array<[string, string]>;
}) {
  const available = rows.some(row =>
    keys.some(([key]) => typeof row[key] === "number")
  );
  return available ? (
    <ResponsiveContainer width="100%" height="88%">
      <LineChart data={rows}>
        <CartesianGrid stroke="#052e16" strokeDasharray="2 3" />
        <XAxis
          dataKey="end"
          minTickGap={24}
          tick={{ fill: "#6ee7b7", fontSize: 9 }}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fill: "#6ee7b7", fontSize: 9 }}
        />
        <Tooltip />
        <Legend />
        {keys.map(([key, label], index) => (
          <Line
            key={key}
            dataKey={key}
            name={label}
            stroke={["#a78bfa", "#22d3ee", "#f59e0b"][index % 3]}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  ) : (
    <p role="status" className="p-4 text-slate-500">
      当前没有足够实际事实绘图。
    </p>
  );
}
