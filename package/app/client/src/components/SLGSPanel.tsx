/** SLGS official Treasury rate workspace. Each view has one distinct data contract. */
import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calculator,
  DollarSign,
  Layers,
  Lightbulb,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface Props {
  onClose?: () => void;
}
const ACCENT = "#f59e0b";
const TERMS = [
  { label: "1天", months: 0 },
  { label: "1周", months: null },
  { label: "2周", months: null },
  { label: "3周", months: null },
  { label: "1月", months: 1 },
  { label: "2月", months: 2 },
  { label: "3月", months: 3 },
  { label: "6月", months: 6 },
  { label: "9月", months: 9 },
  { label: "1年", months: 12 },
  { label: "2年", months: 24 },
  { label: "3年", months: 36 },
  { label: "4年", months: 48 },
  { label: "5年", months: 60 },
  { label: "7年", months: 84 },
  { label: "10年", months: 120 },
  { label: "15年", months: 180 },
  { label: "20年", months: 240 },
  { label: "25年", months: 300 },
  { label: "30年", months: 360 },
] as const;
const fmt = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2)}%`;
const tip = {
  contentStyle: {
    background: "#111827",
    border: "1px solid #374151",
    fontSize: 11,
  },
};

export default function SLGSPanel({ onClose }: Props) {
  const [view, setView] = useState<"rates" | "history" | "arbitrage">("rates");
  const [investAmount, setInvestAmount] = useState(100);
  const [investTerm, setInvestTerm] = useState("10年");
  const [issuerYield, setIssuerYield] = useState("");
  const [deepView, setDeepView] = useState<
    "extension" | "comparison" | "opportunities"
  >("extension");
  const rateSnapshot = trpc.municipalResearch.getSlgsRateSnapshot.useQuery(
    undefined,
    {
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
    }
  );
  const term = TERMS.find(item => item.label === investTerm);
  const history = trpc.municipalResearch.getSlgsRateHistory.useQuery(
    { months: term?.months ?? 0 },
    {
      enabled: term?.months != null,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );
  const rows = useMemo(() => {
    const demand = rateSnapshot.data?.demandRates.at(-1);
    const previousDemand = rateSnapshot.data?.demandRates.at(-2);
    const timeDates = [
      ...new Set(
        (rateSnapshot.data?.timeRates ?? []).map(row => row.recordDate)
      ),
    ].sort();
    const latestDate = timeDates.at(-1);
    const previousDate = timeDates.at(-2);
    const official = (rateSnapshot.data?.timeRates ?? []).filter(
      row => row.recordDate === latestDate
    );
    const previous = (rateSnapshot.data?.timeRates ?? []).filter(
      row => row.recordDate === previousDate
    );
    return TERMS.map(item => {
      const found =
        item.months === 0
          ? undefined
          : official.find(row => row.monthsFrom === item.months);
      const prior =
        item.months === 0
          ? undefined
          : previous.find(row => row.monthsFrom === item.months);
      return {
        ...item,
        type: item.months === 0 ? "Demand" : "Time",
        rate:
          item.months === 0
            ? (demand?.annualizedEffectiveRate ?? null)
            : (found?.rate ?? null),
        previousRate:
          item.months === 0
            ? (previousDemand?.annualizedEffectiveRate ?? null)
            : (prior?.rate ?? null),
        change:
          item.months === 0
            ? demand && previousDemand
              ? demand.annualizedEffectiveRate -
                previousDemand.annualizedEffectiveRate
              : null
            : found && prior
              ? found.rate - prior.rate
              : null,
        recordDate:
          item.months === 0
            ? (demand?.recordDate ?? null)
            : (found?.recordDate ?? null),
      };
    });
  }, [rateSnapshot.data]);
  const selected = rows.find(item => item.label === investTerm);
  const principal =
    (Number.isFinite(investAmount) ? investAmount : 0) * 1_000_000;
  const annual =
    selected?.rate == null ? null : (principal * selected.rate) / 100;
  const years =
    selected?.months == null
      ? null
      : selected.months === 0
        ? 1 / 365
        : selected.months / 12;
  const selectedTermIncome =
    annual == null || years == null ? null : annual * years;
  const inputYield = Number(issuerYield);
  const scenario =
    issuerYield.trim() !== "" &&
    Number.isFinite(inputYield) &&
    selected?.rate != null;
  const spread = scenario ? inputYield - selected!.rate! : null;
  const scenarioK = spread == null ? null : (principal * spread) / 100 / 1000;
  const latestDate = rateSnapshot.data?.timeRates.at(-1)?.recordDate ?? null;
  const priorDate = rateSnapshot.data?.timeRates
    .map(row => row.recordDate)
    .filter(date => date !== latestDate)
    .at(-1);
  const displayedMonths = useMemo<Set<number>>(
    () =>
      new Set(TERMS.flatMap(row => (row.months == null ? [] : [row.months]))),
    []
  );
  const curve = useMemo(
    () =>
      (rateSnapshot.data?.timeRates ?? [])
        .filter(row => row.recordDate === latestDate)
        .filter(
          row => row.monthsFrom <= 360 && !displayedMonths.has(row.monthsFrom)
        )
        .map(row => ({
          term:
            row.monthsFrom < 12
              ? `${row.monthsFrom}M`
              : `${(row.monthsFrom / 12).toFixed(1)}Y`,
          months: row.monthsFrom,
          rate: row.rate,
        })),
    [displayedMonths, latestDate, rateSnapshot.data?.timeRates]
  );
  const priorRates = useMemo(
    () =>
      new Map(
        (rateSnapshot.data?.timeRates ?? [])
          .filter(row => row.recordDate === priorDate)
          .map(row => [row.monthsFrom, row.rate])
      ),
    [priorDate, rateSnapshot.data?.timeRates]
  );
  const changes = curve.map(row => ({
    ...row,
    change:
      priorRates.get(row.months) == null
        ? null
        : row.rate - priorRates.get(row.months)!,
  }));
  const demandHistory = (rateSnapshot.data?.demandRates ?? [])
    .slice(-60)
    .map(row => ({
      date: row.recordDate,
      rate: row.annualizedEffectiveRate,
      factor: row.dailyFactor * 100_000,
    }));
  const historyRows = (history.data?.observations ?? []).map(row => ({
    date: row.recordDate,
    rate:
      "annualizedEffectiveRate" in row ? row.annualizedEffectiveRate : row.rate,
  }));
  const demandRate = rows.find(row => row.months === 0)?.rate;
  const tenYearRate = rows.find(row => row.months === 120)?.rate;
  const asOf =
    [
      ...(rateSnapshot.data?.demandRates ?? []),
      ...(rateSnapshot.data?.timeRates ?? []),
    ]
      .map(row => row.recordDate)
      .sort()
      .at(-1) ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            SLGS
          </span>
          <span className="text-sm font-semibold text-white">
            国债和市政债利率
          </span>
          <span className="ml-2 text-[10px] text-gray-500">
            State and Local Government Series
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-gray-700">
            {(["rates", "history", "arbitrage"] as const).map(item => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={cn(
                  "px-3 py-1 text-xs",
                  view === item
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {item === "rates"
                  ? "SLGS利率表"
                  : item === "history"
                    ? "历史对比"
                    : "套利分析"}
              </button>
            ))}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-gray-800 bg-gray-900/50 px-4 py-2">
        {[
          {
            label: "SLGS 活期",
            value: fmt(demandRate),
            color: "text-amber-400",
          },
          {
            label: "SLGS 10年",
            value: fmt(tenYearRate),
            color: "text-blue-400",
          },
          { label: "官方观察日", value: asOf ?? "—", color: "text-green-400" },
          {
            label: "数据状态",
            value: rateSnapshot.isFetching
              ? "更新中"
              : asOf
                ? "已发布"
                : "未接入",
            color: "text-white",
          },
        ].map(item => (
          <div
            key={item.label}
            className="rounded bg-gray-800/60 p-2 text-center"
          >
            <div className={cn("font-mono text-base font-bold", item.color)}>
              {item.value}
            </div>
            <div className="mt-0.5 text-[9px] text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {view === "rates" && (
          <div className="flex gap-0">
            <table className="flex-1 text-[11px]">
              <thead className="sticky top-0 border-b border-gray-800 bg-gray-900">
                <tr>
                  {["期限", "SLGS利率", "前日", "变动", "类型", "操作"].map(
                    header => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left font-medium text-gray-400"
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-gray-800/50 hover:bg-gray-800/50",
                      index % 2 === 0 ? "bg-gray-950" : "bg-gray-900/30"
                    )}
                  >
                    <td className="px-3 py-2 font-mono font-bold text-white">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-base font-bold text-amber-400">
                      {fmt(row.rate)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-400">
                      {fmt(row.previousRate)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono",
                        row.change == null || row.change === 0
                          ? "text-gray-500"
                          : row.change > 0
                            ? "text-red-400"
                            : "text-green-400"
                      )}
                    >
                      {row.change == null || row.change === 0
                        ? "—"
                        : `${row.change > 0 ? "+" : ""}${row.change.toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px]",
                          row.type === "Demand"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-blue-500/20 text-blue-400"
                        )}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setInvestTerm(row.label)}
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px]",
                          investTerm === row.label
                            ? "bg-amber-500/30 text-amber-300"
                            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                        )}
                      >
                        {investTerm === row.label ? "已选" : "选择"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="w-64 shrink-0 border-l border-gray-800 bg-gray-900 p-3">
              <div className="mb-3 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-gray-300">
                  SLGS收益计算器
                </span>
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] text-gray-500">
                  投资金额（$M）
                  <input
                    type="number"
                    min="0"
                    value={investAmount}
                    onChange={event =>
                      setInvestAmount(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 font-mono text-sm text-white"
                  />
                </label>
                <div>
                  <span className="text-[10px] text-gray-500">
                    投资期限（已选: {investTerm}）
                  </span>
                  <div className="mt-1 rounded border border-amber-500/30 bg-gray-800 p-2">
                    <span className="font-mono font-bold text-amber-400">
                      {fmt(selected?.rate)}
                    </span>
                    <span className="ml-2 text-[10px] text-gray-400">
                      官方年利率
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-gray-700 pt-2">
                  {[
                    { label: "年利息收入", value: annual },
                    {
                      label: "月利息收入",
                      value: annual == null ? null : annual / 12,
                    },
                    { label: "所选期限利息", value: selectedTermIncome },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="flex justify-between gap-2"
                    >
                      <span className="text-[10px] text-gray-500">
                        {item.label}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-amber-400">
                        {item.value == null
                          ? "—"
                          : `$${Math.round(item.value).toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2 text-[10px] text-blue-300">
                  仅按当前官方年化利率和用户输入金额作单利测算；周期限没有官方表字段时显示“—”。
                </div>
              </div>
            </div>
          </div>
        )}
        {view === "history" && (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2 rounded border border-gray-800 bg-gray-900 p-3">
              <span className="text-xs text-gray-400">历史期限</span>
              <select
                value={investTerm}
                onChange={event => setInvestTerm(event.target.value)}
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white"
              >
                {TERMS.map(item => (
                  <option key={item.label}>{item.label}</option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500">
                {term?.months == null
                  ? "官方日利率表没有周期限字段"
                  : `${historyRows.length} 条已清洗观察`}
              </span>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900 p-3">
              <h3 className="mb-3 text-xs font-semibold text-gray-300">
                {investTerm} · SLGS 官方历史利率
              </h3>
              {historyRows.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={historyRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={v => `${v}%`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={tip}
                      formatter={(value: number) => [
                        `${value.toFixed(2)}%`,
                        "SLGS利率",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-gray-500">
                  {history.isFetching
                    ? "正在读取已发布历史…"
                    : "该期限暂无可核验官方历史，不使用其他期限或地方债序列替代。"}
                </div>
              )}
            </div>
          </div>
        )}
        {view === "arbitrage" && (
          <div className="space-y-4 p-4">
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="text-[11px] text-amber-300">
                  <strong>套利限制说明：</strong>
                  该工作区只计算用户输入收益率与所选官方 SLGS
                  利率的算术差，不判断项目合规性，也不生成示例项目或发行人数据。
                </div>
              </div>
            </div>
            <div className="grid gap-3 rounded border border-gray-800 bg-gray-900 p-3 md:grid-cols-3">
              <label className="text-[10px] text-gray-500">
                用户输入债券收益率（%）
                <input
                  type="number"
                  step="0.01"
                  value={issuerYield}
                  onChange={event => setIssuerYield(event.target.value)}
                  placeholder="请输入"
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 font-mono text-sm text-white"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                再投资规模（$M）
                <input
                  type="number"
                  min="0"
                  value={investAmount}
                  onChange={event =>
                    setInvestAmount(Number(event.target.value))
                  }
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 font-mono text-sm text-white"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                SLGS期限
                <select
                  value={investTerm}
                  onChange={event => setInvestTerm(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white"
                >
                  {TERMS.map(item => (
                    <option key={item.label}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="overflow-hidden rounded border border-gray-800 bg-gray-900">
              <div className="border-b border-gray-800 px-3 py-2 text-xs font-semibold text-gray-300">
                套利合规案例分析
              </div>
              <table className="w-full text-[11px]">
                <thead className="border-b border-gray-800 bg-gray-900/80">
                  <tr>
                    {[
                      "项目",
                      "债券收益率",
                      "SLGS利率",
                      "套利空间",
                      "再投资规模($M)",
                      "年节省($K)",
                      "合规状态",
                    ].map(header => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-400"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenario ? (
                    <tr className="border-b border-gray-800/50">
                      <td className="px-3 py-2 font-semibold text-white">
                        用户输入测算
                      </td>
                      <td className="px-3 py-2 font-mono text-amber-400">
                        {fmt(inputYield)}
                      </td>
                      <td className="px-3 py-2 font-mono text-blue-400">
                        {fmt(selected?.rate)}
                      </td>
                      <td className="px-3 py-2 font-mono text-red-400">
                        {fmt(spread)}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-300">
                        {investAmount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-green-400">
                        {scenarioK == null
                          ? "—"
                          : scenarioK.toLocaleString(undefined, {
                              maximumFractionDigits: 1,
                            })}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-400">
                          需专业审查
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-gray-500"
                      >
                        输入债券收益率并选择有官方利率的期限后显示测算；不提供虚构案例。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="mt-4 rounded-lg bg-[#111827] p-4 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">
              SLGS利率展期结构投资仪
            </h3>
          </div>
          <div className="mb-4 flex overflow-hidden rounded border border-gray-700">
            {(["extension", "comparison", "opportunities"] as const).map(
              tab => (
                <button
                  key={tab}
                  onClick={() => setDeepView(tab)}
                  className={cn(
                    "px-4 py-2 text-sm",
                    deepView === tab
                      ? "bg-purple-500/20 text-purple-400"
                      : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  {tab === "extension"
                    ? "展期结构"
                    : tab === "comparison"
                      ? "利率对比"
                      : "投资机会"}
                </button>
              )
            )}
          </div>
          {deepView === "extension" && (
            <div className="rounded border border-gray-800 bg-gray-900 p-3">
              <h4 className="mb-3 text-sm font-semibold text-gray-300">
                官方完整月度期限曲线抽样 · {latestDate ?? "—"}
              </h4>
              {curve.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="term"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      minTickGap={20}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={v => `${v}%`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={tip}
                      formatter={(value: number) => [
                        `${value.toFixed(2)}%`,
                        "SLGS利率",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      name="SLGS利率"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-gray-500">
                  未取得官方期限曲线。
                </div>
              )}
            </div>
          )}
          {deepView === "comparison" && (
            <div className="rounded border border-gray-800 bg-gray-900 p-3">
              <h4 className="mb-3 text-sm font-semibold text-gray-300">
                期限曲线日变动 · 百分点
              </h4>
              {changes.some(row => row.change != null) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={changes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="term"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      minTickGap={20}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={tip} />
                    <Bar dataKey="change" name="日变动" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-gray-500">
                  暂无两个连续发布日的同期限记录。
                </div>
              )}
            </div>
          )}
          {deepView === "opportunities" && (
            <div className="rounded border border-gray-800 bg-gray-900 p-4">
              <div className="mb-3 flex items-center gap-2 text-green-400">
                <Lightbulb className="h-4 w-4" />
                <h4 className="text-sm font-semibold">
                  活期利率与每日因子观察
                </h4>
              </div>
              {demandHistory.length ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={demandHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      minTickGap={28}
                    />
                    <YAxis
                      yAxisId="rate"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={v => `${v}%`}
                      domain={["auto", "auto"]}
                    />
                    <YAxis
                      yAxisId="factor"
                      orientation="right"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                    />
                    <Tooltip contentStyle={tip} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line
                      yAxisId="rate"
                      type="monotone"
                      dataKey="rate"
                      name="年化有效利率(%)"
                      stroke="#10b981"
                      dot={false}
                    />
                    <Line
                      yAxisId="factor"
                      type="monotone"
                      dataKey="factor"
                      name="每日因子×100000"
                      stroke="#60a5fa"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-gray-500">
                  暂无活期利率和每日因子记录。
                </div>
              )}
              <p className="mt-2 text-[10px] text-gray-500">
                该标签只展示独立的活期存款数据契约；不生成机会排名、买卖建议或地方债项目。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
