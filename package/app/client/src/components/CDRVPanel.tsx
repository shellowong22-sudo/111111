import { useState } from "react";
import { Activity, AlertTriangle, Database, X } from "lucide-react";
import {
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

const ACCENT = "#06b6d4";
const tabs = ["quotes", "history", "risk"] as const;

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="m-4 rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function formatRate(value: number | null | undefined) {
  return value == null ? "—" : `${value.toFixed(2)}%`;
}

function riskTone(level: string) {
  const normalized = level.toLowerCase();
  if (normalized.includes("high") || normalized.includes("高")) {
    return "border-red-500/30 bg-red-500/10 text-red-400";
  }
  if (normalized.includes("medium") || normalized.includes("中")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
}

export default function CDRVPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("quotes");
  const status =
    trpc.municipalResearch.getCdrvVariableRateDemandStatus.useQuery(undefined, {
      staleTime: 60_000,
      refetchInterval: 60_000,
    });
  const data = status.data;
  const securities = data?.securities ?? [];
  const history = data?.rateHistory ?? [];
  const latestHistory = history.at(-1);
  const ratio =
    latestHistory?.portfolioRatePct != null &&
    latestHistory.benchmarkRatePct != null &&
    latestHistory.benchmarkRatePct !== 0
      ? (latestHistory.portfolioRatePct / latestHistory.benchmarkRatePct) * 100
      : null;
  const limitation =
    data?.limitation ??
    "正在检查变动利率需求票据数据契约；失败时不会回退到其他地方债模块或静态行情。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            CDRV
          </span>
          <span className="text-sm font-semibold text-white">
            地方债变动利率
          </span>
          <span className="text-xs text-gray-400">
            Variable Rate Demand Notes
          </span>
          <span className="rounded border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-[10px] text-slate-400">
            {data?.dataStatus === "restricted" ? "未接入" : "检查中"}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex items-start gap-2 border-b border-cyan-900/70 bg-cyan-950/20 px-4 py-3 text-xs text-cyan-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-cyan-300/70">
            {data?.dataContractId ?? "municipal-cdrv-variable-rate-demand"}
            {" · 最近检查："}
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "SIFMA指数",
            value: formatRate(latestHistory?.benchmarkRatePct),
            sub: latestHistory?.period ?? "未接入基准观测",
          },
          {
            label: "平均VRDN利率",
            value: formatRate(latestHistory?.portfolioRatePct),
            sub: latestHistory?.period ?? "未接入组合观测",
          },
          {
            label: "VRDN/SIFMA比率",
            value: ratio == null ? "—" : `${ratio.toFixed(1)}%`,
            sub: ratio == null ? "缺少同周期配对数据" : "同周期计算",
          },
          {
            label: "活跃VRDN数量",
            value: securities.length ? `${securities.length}只` : "—",
            sub: data?.observedAt ?? "未接入逐券清单",
          },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "border-r border-gray-800/60 px-3 py-2",
              index === 3 && "border-r-0"
            )}
          >
            <div className="text-[10px] text-gray-500">{metric.label}</div>
            <div className="font-mono text-sm font-bold text-white">
              {metric.value}
            </div>
            <div className="text-[10px] text-gray-500">{metric.sub}</div>
          </div>
        ))}
      </div>

      <nav className="flex shrink-0 border-b border-gray-800 bg-gray-900">
        {tabs.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "border-b-2 px-4 py-2 text-xs font-medium transition-colors",
              tab === item
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "quotes"
              ? "实时报价"
              : item === "history"
                ? "利率历史"
                : "风险分析"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "quotes" &&
          (securities.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  {[
                    "CUSIP",
                    "发行人",
                    "规模",
                    "当前利率",
                    "较昨日",
                    "重置频率",
                    "流动性提供商",
                    "到期",
                    "评级",
                    "下次重置",
                  ].map(header => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-2 py-2 text-left font-normal text-gray-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {securities.map(security => {
                  const change =
                    security.currentRatePct != null &&
                    security.previousRatePct != null
                      ? security.currentRatePct - security.previousRatePct
                      : null;
                  return (
                    <tr
                      key={security.cusip}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-2 py-2 font-mono text-[10px] text-gray-400">
                        {security.cusip}
                      </td>
                      <td className="px-2 py-2 text-[11px] font-semibold text-white">
                        {security.issuer}
                      </td>
                      <td className="px-2 py-2 font-mono text-white">
                        $${security.sizeMillions.toFixed(1)}M
                      </td>
                      <td className="px-2 py-2 font-mono font-bold text-cyan-400">
                        {formatRate(security.currentRatePct)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 font-mono",
                          change == null
                            ? "text-gray-500"
                            : change > 0
                              ? "text-red-400"
                              : "text-green-400"
                        )}
                      >
                        {change == null
                          ? "—"
                          : `${change > 0 ? "▲" : change < 0 ? "▼" : ""}${Math.abs(change).toFixed(2)}%`}
                      </td>
                      <td className="px-2 py-2 text-gray-300">
                        {security.resetFrequency ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-gray-300">
                        {security.liquidityProvider ?? "—"}
                      </td>
                      <td className="px-2 py-2 font-mono text-[10px] text-gray-400">
                        {security.liquidityExpiry ?? "—"}
                      </td>
                      <td className="px-2 py-2 font-mono text-blue-400">
                        {security.rating ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-gray-400">
                        {security.nextReset ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title="实时报价未接入"
              detail="需要获准的逐券 CUSIP、发行人、规模、重置利率和流动性支持字段。当前不复用其他 VRDN 页面或静态报价。"
            />
          ))}

        {tab === "history" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              VRDN利率 vs SIFMA vs SOFR（近6周）
            </h3>
            {history.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    tickFormatter={value => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                    }}
                    formatter={value =>
                      value == null ? "—" : `${Number(value).toFixed(2)}%`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmarkRatePct"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    name="SIFMA指数"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fundingRatePct"
                    stroke="#6b7280"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 4"
                    name="SOFR"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolioRatePct"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    name="VRDN平均"
                    connectNulls={false}
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="利率历史未接入"
                detail="需要同周期的 VRDN 重置利率、SIFMA 基准和 SOFR 观测。当前不拼接 BMA、SLGS 或其他模块历史序列。"
              />
            )}
          </div>
        )}

        {tab === "risk" && (
          <div className="space-y-4 p-4">
            <h3 className="text-sm font-semibold text-white">VRDN风险分析</h3>
            {data?.riskAssessments.length ? (
              data.riskAssessments.map(assessment => (
                <div
                  key={assessment.id}
                  className={cn(
                    "rounded border p-3",
                    riskTone(assessment.level)
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {assessment.title}
                    </span>
                    <span className="rounded bg-black/20 px-2 py-0.5 text-[10px] font-bold">
                      {assessment.level}
                    </span>
                  </div>
                  <p className="text-[10px] leading-5 text-gray-300">
                    {assessment.detail}
                  </p>
                  <p className="mt-1 text-[9px] text-gray-500">
                    {assessment.observedAt} · 证据 {assessment.evidenceCount} 条
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title="风险分析未接入"
                detail="需要逐券重置、流动性支持到期、评级行动和模式转换事件。当前不生成风险等级、续约提醒或配置建议。"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
