import { useEffect, useState } from "react";
import { AlertTriangle, Atom, BarChart2, Database, X } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
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
const views = ["overview", "curve", "sector"] as const;
const analysisTabs = [
  "decomposition",
  "subIndexScores",
  "historicalPercentile",
] as const;

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center">
      <Database className="mx-auto h-7 w-7 text-slate-600" />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mx-auto mt-2 max-w-3xl text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function percent(value: number | null | undefined) {
  return value == null ? "—" : value.toFixed(2) + "%";
}

export default function MBIXPanel({ onClose }: Props) {
  const [view, setView] = useState<(typeof views)[number]>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysisTab, setAnalysisTab] =
    useState<(typeof analysisTabs)[number]>("decomposition");
  const query = trpc.municipalResearch.getMbixMunicipalIndexStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const indices = data?.indices ?? [];

  useEffect(() => {
    if (!selectedId && indices[0]) setSelectedId(indices[0].id);
  }, [indices, selectedId]);

  const selected =
    indices.find(index => index.id === selectedId) ?? indices[0] ?? null;
  const limitation =
    data?.limitation ??
    "正在检查地方债指数数据合同；失败时不会回退到评级、成交或静态指数样例。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            MBIX
          </span>
          <span className="text-sm font-semibold text-white">
            最新地方债指数
          </span>
          <span className="ml-2 text-[10px] text-gray-500">
            Municipal Bond Index Monitor
          </span>
          <span className="rounded border border-slate-600 bg-slate-700/30 px-2 py-0.5 text-[10px] text-slate-400">
            {data?.dataStatus === "restricted" ? "未接入" : "检查中"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded border border-gray-700">
            {views.map(item => (
              <button
                type="button"
                key={item}
                onClick={() => setView(item)}
                className={cn(
                  "px-3 py-1 text-xs",
                  view === item
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {item === "overview"
                  ? "总览"
                  : item === "curve"
                    ? "期限结构"
                    : "行业利差"}
              </button>
            ))}
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
        </div>
      </header>

      <div className="flex items-start gap-2 border-b border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            {data?.dataContractId ?? "municipal-mbix-index-monitor"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 gap-2 overflow-x-auto border-b border-gray-800 bg-gray-900/50 px-4 py-2">
        {indices.length
          ? indices.slice(0, 4).map(index => (
              <button
                type="button"
                key={index.id}
                onClick={() => setSelectedId(index.id)}
                className={cn(
                  "rounded border p-2 text-left",
                  selected?.id === index.id
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                )}
              >
                <div className="truncate text-[10px] text-gray-400">
                  {index.name}
                </div>
                <div className="mt-0.5 font-mono text-lg font-bold text-white">
                  {percent(index.yieldPct)}
                </div>
                <div className="font-mono text-[11px] text-gray-400">
                  {index.changePct == null
                    ? "—"
                    : (index.changePct > 0 ? "+" : "") +
                      index.changePct.toFixed(2) +
                      "%"}
                </div>
                <div className="mt-0.5 text-[9px] text-gray-500">
                  OAS：
                  {index.oasBps == null ? "—" : "+" + index.oasBps + "bps"} ·
                  Dur：
                  {index.durationYears == null
                    ? "—"
                    : index.durationYears.toFixed(1) + "Y"}
                </div>
              </button>
            ))
          : ["指数一", "指数二", "指数三", "指数四"].map(label => (
              <div
                key={label}
                className="rounded border border-gray-800 bg-gray-900 p-2"
              >
                <div className="text-[10px] text-gray-500">{label}</div>
                <div className="mt-1 font-mono text-lg text-gray-600">—</div>
                <div className="text-[9px] text-gray-600">未接入指数</div>
              </div>
            ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 overflow-auto border-r border-gray-800">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 border-b border-gray-800 bg-gray-900">
              <tr>
                <th className="px-2 py-1.5 text-left text-gray-400">指数</th>
                <th className="px-2 py-1.5 text-right text-gray-400">收益率</th>
                <th className="px-2 py-1.5 text-right text-gray-400">变动</th>
              </tr>
            </thead>
            <tbody>
              {indices.length ? (
                indices.map(index => (
                  <tr
                    key={index.id}
                    onClick={() => setSelectedId(index.id)}
                    className={cn(
                      "cursor-pointer border-b border-gray-800/50",
                      selected?.id === index.id
                        ? "bg-amber-500/10"
                        : "hover:bg-gray-800/50"
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <div className="font-semibold text-white">{index.id}</div>
                      <div className="truncate text-[9px] text-gray-500">
                        {index.name}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-amber-400">
                      {percent(index.yieldPct)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-400">
                      {index.changePct == null
                        ? "—"
                        : index.changePct.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="p-5 text-center text-gray-600">
                    指数清单未接入
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {view === "overview" && (
            <div className="space-y-3">
              <div className="rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-3 text-xs font-semibold text-gray-300">
                  收益率历史走势（近30日）
                </h3>
                {data?.history.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#a0aec0", fontSize: 10 }}
                      />
                      <YAxis
                        tick={{ fill: "#a0aec0", fontSize: 10 }}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="aaa"
                        stroke="#fcd34d"
                        name="AAA"
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="aa"
                        stroke="#60a5fa"
                        name="AA"
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="a"
                        stroke="#34d399"
                        name="A"
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="bbb"
                        stroke="#ef4444"
                        name="BBB"
                        connectNulls={false}
                      />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="指数历史未接入"
                    detail="需要同一指数方法和估值时点的历史序列；不使用评级页面或固定曲线替代。"
                  />
                )}
              </div>
              <div className="rounded border border-gray-800 bg-gray-900 p-3">
                <h3 className="mb-3 text-xs font-semibold text-gray-300">
                  最新指数成分
                </h3>
                {indices.length ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {indices.map(index => (
                      <div
                        key={index.id}
                        className="flex items-center justify-between border-b border-gray-800 pb-1"
                      >
                        <span className="text-gray-400">
                          {index.name} ({index.rating ?? "—"})
                        </span>
                        <span className="font-mono text-white">
                          {percent(index.yieldPct)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="指数成分未接入"
                    detail="需要获准的指数成分、评级、市值和成分数量；不生成总市值或总券数。"
                  />
                )}
              </div>
            </div>
          )}

          {view === "curve" && (
            <div className="rounded border border-gray-800 bg-gray-900 p-3">
              <h3 className="mb-3 text-xs font-semibold text-gray-300">
                期限结构
              </h3>
              {data?.termStructure.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.termStructure}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis
                      dataKey="term"
                      tick={{ fill: "#a0aec0", fontSize: 10 }}
                    />
                    <YAxis
                      tick={{ fill: "#a0aec0", fontSize: 10 }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid #374151",
                      }}
                    />
                    <Line dataKey="aaa" stroke="#fcd34d" name="AAA" />
                    <Line dataKey="aa" stroke="#60a5fa" name="AA" />
                    <Line dataKey="a" stroke="#34d399" name="A" />
                    <Line dataKey="bbb" stroke="#ef4444" name="BBB" />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="期限结构未接入"
                  detail="需要同一指数族的期限分桶和估值方法；不搬用信用评级利差或静态收益率。"
                />
              )}
            </div>
          )}

          {view === "sector" && (
            <div className="rounded border border-gray-800 bg-gray-900 p-3">
              <h3 className="mb-3 text-xs font-semibold text-gray-300">
                行业利差
              </h3>
              {data?.sectorSpread.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.sectorSpread}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis
                      dataKey="sector"
                      tick={{ fill: "#a0aec0", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "#a0aec0", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid #374151",
                      }}
                    />
                    <Bar dataKey="oasBps" name="OAS利差" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="行业利差未接入"
                  detail="需要指数行业分类、成分市值和同口径 OAS；不推断风险等级或生成下沉建议。"
                />
              )}
            </div>
          )}

          <section className="mt-4 border-t border-gray-800 bg-[#0d1117] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Atom className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-bold text-purple-400">
                地方债指数因子归因分析仪
              </h2>
            </div>
            <div className="mb-4 flex overflow-hidden rounded border border-gray-700">
              {analysisTabs.map(item => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setAnalysisTab(item)}
                  className={cn(
                    "px-4 py-2 text-sm",
                    analysisTab === item
                      ? "bg-purple-600/30 text-purple-300"
                      : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                  )}
                >
                  {item === "decomposition"
                    ? "指数分解"
                    : item === "subIndexScores"
                      ? "子指数得分"
                      : "历史分位"}
                </button>
              ))}
            </div>

            {analysisTab === "decomposition" &&
              (data?.factorAttribution.length ? (
                <div className="rounded border border-gray-800 bg-[#111827] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-300">
                    地方债指数收益率因子分解（月度）
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={data.factorAttribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                      <XAxis
                        dataKey="period"
                        tick={{ fill: "#a0aec0", fontSize: 10 }}
                      />
                      <YAxis tick={{ fill: "#a0aec0", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                        }}
                      />
                      <ReferenceLine y={0} stroke="#4b5563" />
                      <Area
                        dataKey="interestContributionPct"
                        fill="#3b82f6"
                        stroke="#3b82f6"
                        name="利率贡献"
                      />
                      <Bar
                        dataKey="creditContributionPct"
                        fill="#10b981"
                        name="信用贡献"
                      />
                      <Line
                        dataKey="totalReturnPct"
                        stroke="#f59e0b"
                        name="总收益率"
                      />
                      <Legend />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="指数分解未接入"
                  detail="需要可审计的指数总收益、利率贡献和信用贡献；不以固定月度数值填充。"
                />
              ))}

            {analysisTab === "subIndexScores" &&
              (data?.subIndexScores.length ? (
                <div className="rounded border border-gray-800 bg-[#111827] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-300">
                    地方债子指数多维度得分
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={data.subIndexScores}>
                      <PolarGrid stroke="#4b5563" />
                      <PolarAngleAxis
                        dataKey="indexName"
                        tick={{ fill: "#a0aec0", fontSize: 10 }}
                      />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar
                        name="久期"
                        dataKey="duration"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.2}
                      />
                      <Radar
                        name="信用"
                        dataKey="credit"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.2}
                      />
                      <Radar
                        name="流动性"
                        dataKey="liquidity"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.2}
                      />
                      <Radar
                        name="评级稳定性"
                        dataKey="ratingStability"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.2}
                      />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="子指数得分未接入"
                  detail="需要明确评分方法、输入样本与观测日期；不生成固定久期、信用或流动性评分。"
                />
              ))}

            {analysisTab === "historicalPercentile" &&
              (data?.historicalPercentile.length ? (
                <div className="grid grid-cols-2 gap-4">
                  {data.historicalPercentile.map(item => (
                    <div
                      key={item.period}
                      className="flex items-center justify-between rounded border border-gray-700 p-2"
                    >
                      <span className="text-gray-400">过去 {item.period}</span>
                      <span className="font-mono text-lg text-white">
                        {item.percentile == null
                          ? "—"
                          : item.percentile.toFixed(0) + "% 分位"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="历史分位未接入"
                  detail="需要足够长且方法一致的指数历史；不显示固定 1Y、3Y、5Y、10Y 分位。"
                />
              ))}
          </section>
        </div>
      </div>
    </div>
  );
}
