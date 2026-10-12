import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  DatabaseZap,
  Gauge,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";
import {
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";

const stateLabel = {
  available: "来源可读",
  partial: "部分可读",
  unavailable: "暂不可读",
  not_observed: "尚未采样",
  manual: "人工核验",
} as const;
const stateClass = {
  available: "text-emerald-300",
  partial: "text-amber-300",
  unavailable: "text-rose-300",
  not_observed: "text-slate-500",
  manual: "text-violet-300",
} as const;

function availabilityPercent(
  rows: Array<{ status: "available" | "unavailable" }>
) {
  return rows.length
    ? Math.round(
        (rows.filter(row => row.status === "available").length / rows.length) *
          100
      )
    : null;
}

function medianLatency(rows: Array<{ latencyMs: number | null }>) {
  const values = rows
    .flatMap(row => (typeof row.latencyMs === "number" ? [row.latencyMs] : []))
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : Math.round((values[middle - 1] + values[middle]) / 2);
}

export function SourceAvailabilityHistory() {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const query = trpc.moneyMarketResearch.listSourceAvailabilityHistory.useQuery(
    { days },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );
  const rows = query.data ?? [];
  const bySource = useMemo(() => {
    const map = new Map<string, typeof rows>();
    rows.forEach(row =>
      map.set(row.sourceId, [...(map.get(row.sourceId) ?? []), row])
    );
    return [...map.entries()].map(([sourceId, items]) => ({
      sourceId,
      label: items.at(-1)?.sourceLabel ?? sourceId,
      items,
      availability: availabilityPercent(items),
      medianLatency: medianLatency(items),
      latest: items.at(-1) ?? null,
    }));
  }, [rows]);
  const chart = useMemo(() => {
    const points = new Map<string, Record<string, string | number | null>>();
    rows.forEach(row => {
      const at = new Date(row.sampledAt).toISOString();
      const item = points.get(at) ?? {
        sampledAt: at.slice(5, 16).replace("T", " "),
      };
      item[row.sourceId] = row.status === "available" ? 100 : 0;
      points.set(at, item);
    });
    return [...points.values()];
  }, [rows]);
  const latencyChart = useMemo(() => {
    const points = new Map<string, Record<string, string | number | null>>();
    rows.forEach(row => {
      const at = new Date(row.sampledAt).toISOString();
      const item = points.get(at) ?? {
        sampledAt: at.slice(5, 16).replace("T", " "),
      };
      item[row.sourceId] = row.latencyMs;
      points.set(at, item);
    });
    return [...points.values()];
  }, [rows]);
  return (
    <Card
      title="SOURCE · 公开来源可用率历史"
      action={<LineChartIcon className="h-4 w-4 text-cyan-300" />}
    >
      <p className="mb-3 text-[11px] text-slate-500">
        仅记录终端实际读取公开来源时的可用或不可用结果，按来源与小时去重。读取延迟是从终端发起请求至完成解析的实测耗时，不等同于上游数据发布时间或市场实时性。
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {([7, 14, 30] as const).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setDays(value)}
            className={`rounded border px-2 py-1 text-[11px] transition-colors duration-150 ${days === value ? "border-cyan-700 bg-cyan-950/50 text-cyan-100" : "border-slate-800 text-slate-500 hover:text-slate-300"}`}
          >
            {value} 日
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <LoadingState text="读取实际探测历史…" />
      ) : !rows.length ? (
        <p className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-500">
          尚无历史探测记录。下一次公开快照读取或既有小时扫描完成后才会形成首个真实样本；系统不会补写模拟可用率。
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {bySource.map(source => (
              <Metric
                key={source.sourceId}
                label={source.label}
                value={
                  source.availability == null ? "—" : `${source.availability}%`
                }
                sub={
                  source.latest?.latencyMs == null
                    ? "等待首个实际延迟样本"
                    : `最近读取 ${source.latest.latencyMs} ms`
                }
                tone={
                  source.latest?.status === "available" ? "info" : "neutral"
                }
              />
            ))}
          </div>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="sampledAt"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  minTickGap={32}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={value => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                  }}
                  formatter={(value: number) => [`${value}%`, "可用性"]}
                />
                {bySource.map((source, index) => (
                  <Line
                    key={source.sourceId}
                    type="stepAfter"
                    dataKey={source.sourceId}
                    name={source.label}
                    stroke={
                      ["#22d3ee", "#a78bfa", "#f59e0b", "#34d399", "#fb7185"][
                        index % 5
                      ]
                    }
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyChart}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="sampledAt"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  minTickGap={32}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={value => `${value}ms`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                  }}
                  formatter={(value: number) => [`${value} ms`, "实测读取延迟"]}
                />
                {bySource.map((source, index) => (
                  <Line
                    key={source.sourceId}
                    type="monotone"
                    dataKey={source.sourceId}
                    name={source.label}
                    stroke={
                      ["#22d3ee", "#a78bfa", "#f59e0b", "#34d399", "#fb7185"][
                        index % 5
                      ]
                    }
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="p-2">来源</th>
                  <th className="p-2">样本</th>
                  <th className="p-2">可用率</th>
                  <th className="p-2">最近 / 中位延迟</th>
                  <th className="p-2">最近探测</th>
                  <th className="p-2">最近结果</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map(source => (
                  <tr
                    key={source.sourceId}
                    className="border-t border-slate-800"
                  >
                    <td className="p-2 text-cyan-100">{source.label}</td>
                    <td className="p-2">{source.items.length}</td>
                    <td className="p-2">
                      {source.availability == null
                        ? "—"
                        : `${source.availability}%`}
                    </td>
                    <td className="p-2 text-slate-300">
                      {source.latest?.latencyMs == null
                        ? "—"
                        : `${source.latest.latencyMs} / ${source.medianLatency ?? "—"} ms`}
                    </td>
                    <td className="p-2 text-slate-400">
                      {source.latest
                        ? new Date(source.latest.sampledAt).toLocaleString()
                        : "—"}
                    </td>
                    <td
                      className={`p-2 ${source.latest?.status === "available" ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {source.latest?.status === "available"
                        ? "可读"
                        : "不可读"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

export function MoneyMarketModuleDiagnostics() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = trpc.moneyMarketResearch.listModuleDiagnostics.useQuery(
    { days },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );
  const modules = query.data?.modules ?? [];
  const used = modules.filter(item => (item.openCount ?? 0) > 0);
  const totalOpens = used.reduce((sum, item) => sum + (item.openCount ?? 0), 0);
  const impaired = modules.filter(
    item => item.status === "partial" || item.status === "unavailable"
  ).length;
  return (
    <Card
      title="SOURCE · 模块使用与运行诊断"
      action={<Gauge className="h-4 w-4 text-violet-300" />}
    >
      <p className="mb-3 text-[11px] text-slate-500">
        只分析当前账户真实打开过的模块，刷新和短时重复进入按十五分钟桶去重。运行状态只引用最近真实公开来源探测；无结构化来源的用户输入或原件核验模块明确标为人工核验。
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {([7, 30, 90] as const).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setDays(value)}
            className={`rounded border px-2 py-1 text-[11px] transition-colors duration-150 ${days === value ? "border-violet-700 bg-violet-950/50 text-violet-100" : "border-slate-800 text-slate-500 hover:text-slate-300"}`}
          >
            {value} 日
          </button>
        ))}
      </div>
      {query.isLoading ? (
        <LoadingState text="生成当前账户模块诊断…" />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric
              label="实际打开次数"
              value={String(totalOpens)}
              tone="info"
            />
            <Metric label="已使用模块" value={String(used.length)} />
            <Metric
              label="来源待复核模块"
              value={String(impaired)}
              tone={impaired ? "warn" : "neutral"}
            />
          </div>
          <div className="mt-3 h-48">
            {used.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={used
                    .sort((a, b) => (b.openCount ?? 0) - (a.openCount ?? 0))
                    .slice(0, 12)}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #334155",
                    }}
                  />
                  <Bar dataKey="openCount" name="实际打开次数" fill="#a78bfa" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-700 text-xs text-slate-500">
                当前账户尚无模块打开记录；首次实际进入模块后才会计入诊断。
              </div>
            )}
          </div>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="p-2">模块</th>
                  <th className="p-2">实际打开</th>
                  <th className="p-2">依赖来源</th>
                  <th className="p-2">最近探测</th>
                  <th className="p-2">运行状态</th>
                </tr>
              </thead>
              <tbody>
                {modules.map(item => (
                  <tr key={item.moduleId} className="border-t border-slate-800">
                    <td className="p-2 text-violet-100">{item.label}</td>
                    <td className="p-2">{item.openCount ?? 0}</td>
                    <td className="p-2 text-slate-400">
                      {item.dependencyCount
                        ? `${item.availableSourceCount}/${item.observedSourceCount || item.dependencyCount}`
                        : "—"}
                    </td>
                    <td className="p-2 text-slate-400">
                      {item.latestProbeAt
                        ? new Date(item.latestProbeAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className={`p-2 ${stateClass[item.status]}`}>
                      <Activity className="mr-1 inline h-3 w-3" />
                      {stateLabel[item.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
