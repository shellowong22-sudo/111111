import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Database, TrendingUp, X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
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
const tabs = ["curve", "history", "ratio", "arbitrage"] as const;
const comparisonTabs = [
  "term_structure",
  "ratio_history",
  "tax_equivalent",
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

export default function AAAPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("curve");
  const [comparisonTab, setComparisonTab] =
    useState<(typeof comparisonTabs)[number]>("term_structure");
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const query = trpc.municipalResearch.getAaaMunicipalCurveStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const curve = data?.curve ?? [];
  const history = data?.history ?? [];

  useEffect(() => {
    if (!selectedTerm && curve[0]) setSelectedTerm(curve[0].term);
  }, [curve, selectedTerm]);

  const y5 = curve.find(point => point.term === "5Y");
  const y10 = curve.find(point => point.term === "10Y");
  const y30 = curve.find(point => point.term === "30Y");
  const y2 = curve.find(point => point.term === "2Y");
  const ratio10 =
    y10?.municipalYieldPct != null &&
    y10.treasuryYieldPct != null &&
    y10.treasuryYieldPct !== 0
      ? (y10.municipalYieldPct / y10.treasuryYieldPct) * 100
      : null;
  const slope =
    y2?.municipalYieldPct != null && y30?.municipalYieldPct != null
      ? (y30.municipalYieldPct - y2.municipalYieldPct) * 100
      : null;
  const limitation =
    data?.limitation ??
    "正在检查 AAA 地方债基准曲线合同；失败时不会回退到指数、评级或静态曲线。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            AAA
          </span>
          <span className="text-sm font-semibold text-white">
            BVAL AAA 地方债收益率曲线
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

      <div className="flex items-start gap-2 border-b border-amber-900/70 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-amber-300/70">
            {data?.dataContractId ?? "municipal-aaa-benchmark-curve"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-5 border-b border-gray-800">
        {[
          ["AAA 10Y", percent(y10?.municipalYieldPct), "同期限基准"],
          ["AAA 5Y", percent(y5?.municipalYieldPct), "同期限基准"],
          ["AAA 30Y", percent(y30?.municipalYieldPct), "同期限基准"],
          [
            "10Y/UST比率",
            ratio10 == null ? "—" : ratio10.toFixed(1) + "%",
            "同日配对计算",
          ],
          [
            "曲线斜率(2-30Y)",
            slope == null ? "—" : slope.toFixed(0) + "bps",
            "30Y减2Y",
          ],
        ].map((metric, index) => (
          <div
            key={metric[0]}
            className={cn(
              "border-r border-gray-800/60 px-3 py-2",
              index === 4 && "border-r-0"
            )}
          >
            <div className="text-[10px] text-gray-500">{metric[0]}</div>
            <div className="font-mono text-sm font-bold text-white">
              {metric[1]}
            </div>
            <div className="text-[10px] text-gray-500">{metric[2]}</div>
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
              "border-b-2 px-4 py-2 text-xs font-medium",
              tab === item
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "curve"
              ? "期限结构"
              : item === "history"
                ? "历史走势"
                : item === "ratio"
                  ? "比率分析"
                  : "套利信号"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "curve" && (
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">
              AAA BVAL 收益率曲线 vs 国债
            </h3>
            {curve.length ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      dataKey="term"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                    />
                    <YAxis
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
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
                      dataKey="municipalYieldPct"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      name="AAA BVAL"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="treasuryYieldPct"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="美国国债"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="previousMunicipalYieldPct"
                      stroke="#6b7280"
                      strokeDasharray="4 4"
                      name="昨日AAA"
                      connectNulls={false}
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
                <table className="mt-4 w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {[
                        "期限",
                        "AAA BVAL",
                        "国债收益率",
                        "利差(bps)",
                        "较昨日",
                        "较上周",
                      ].map(header => (
                        <th
                          key={header}
                          className="px-2 py-1.5 text-left font-normal text-gray-500"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {curve.map(point => (
                      <tr
                        key={point.term}
                        onClick={() => setSelectedTerm(point.term)}
                        className={cn(
                          "cursor-pointer border-b border-gray-800/50",
                          selectedTerm === point.term
                            ? "bg-amber-500/10"
                            : "hover:bg-gray-800/30"
                        )}
                      >
                        <td className="px-2 py-1.5 font-mono font-bold text-amber-400">
                          {point.term}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-green-400">
                          {percent(point.municipalYieldPct)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-blue-400">
                          {percent(point.treasuryYieldPct)}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-gray-300">
                          {point.spreadBps ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-gray-400">
                          {point.municipalYieldPct == null ||
                          point.previousMunicipalYieldPct == null
                            ? "—"
                            : (
                                point.municipalYieldPct -
                                point.previousMunicipalYieldPct
                              ).toFixed(2) + "%"}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-gray-400">
                          {point.municipalYieldPct == null ||
                          point.priorWeekMunicipalYieldPct == null
                            ? "—"
                            : (
                                point.municipalYieldPct -
                                point.priorWeekMunicipalYieldPct
                              ).toFixed(2) + "%"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <EmptyState
                title="AAA期限结构未接入"
                detail="需要获准的 AAA 市政估值点、同日同期限国债和历史修订。当前不从 MBIX、SLGS 或静态曲线搬运。"
              />
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">
              AAA BVAL 历史收益率走势
            </h3>
            {history.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                    }}
                  />
                  <Line dataKey="y1Pct" stroke="#10b981" name="1Y" />
                  <Line dataKey="y5Pct" stroke="#3b82f6" name="5Y" />
                  <Line dataKey="y10Pct" stroke="#f59e0b" name="10Y" />
                  <Line dataKey="y30Pct" stroke="#8b5cf6" name="30Y" />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="AAA历史走势未接入"
                detail="需要方法一致的多期限历史和观测日期；不生成固定 30 日序列。"
              />
            )}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {data?.forecasts.length ? (
                data.forecasts.map(item => (
                  <div
                    key={item.horizon}
                    className="rounded border border-gray-800 bg-gray-900 p-3"
                  >
                    <div className="text-[10px] text-gray-500">
                      {item.horizon} 10Y预测
                    </div>
                    <div className="mt-1 font-mono text-base font-bold text-amber-400">
                      {percent(item.y10Pct)}
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      区间：{percent(item.lowPct)} - {percent(item.highPct)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      置信度：
                      {item.confidencePct == null
                        ? "—"
                        : item.confidencePct.toFixed(0) + "%"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3">
                  <EmptyState
                    title="收益率预测未接入"
                    detail="没有获准模型、训练窗口和校准记录时，不显示固定预测区间或置信度。"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "ratio" && (
          <div className="p-4">
            <h3 className="mb-1 text-sm font-semibold text-white">
              AAA/UST 比率分析（地方债相对价值核心指标）
            </h3>
            
            {history.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ratio10Pct"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.12}
                    name="10Y比率"
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="比率历史未接入"
                detail="需要同日 10Y AAA 与国债配对历史；不显示固定强买、警戒或减持区间。"
              />
            )}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["5Y", "10Y", "30Y"].map(term => {
                const point = curve.find(item => item.term === term);
                const ratio =
                  point?.municipalYieldPct != null &&
                  point.treasuryYieldPct != null &&
                  point.treasuryYieldPct !== 0
                    ? (point.municipalYieldPct / point.treasuryYieldPct) * 100
                    : null;
                return (
                  <div
                    key={term}
                    className="rounded border border-gray-800 bg-gray-900 p-3"
                  >
                    <div className="font-mono font-bold text-amber-400">
                      {term}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      AAA/UST：{ratio == null ? "—" : ratio.toFixed(1) + "%"}
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      税等价(37%)：
                      {point?.municipalYieldPct == null
                        ? "—"
                        : (point.municipalYieldPct / 0.63).toFixed(2) + "%"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "arbitrage" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              套利信号与交易建议
            </h3>
            {data?.relativeValueSignals.length ? (
              <div className="space-y-3">
                {data.relativeValueSignals.map(signal => (
                  <div
                    key={signal.term + signal.observedAt}
                    className="rounded border border-gray-800 bg-gray-900 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">
                        {signal.term}
                      </span>
                      <span className="text-xs text-gray-300">
                        {signal.signal} · {signal.strength ?? "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-400">
                      {signal.reason}
                    </p>
                    <p className="mt-1 text-[9px] text-gray-600">
                      {signal.observedAt} ·
                      {signal.ratioPct == null
                        ? " 比率—"
                        : " 比率" + signal.ratioPct.toFixed(1) + "%"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="套利信号未接入"
                detail="缺少获准估值、历史分布、交易成本和模型证据时，不生成买卖方向、期限配置或智能综合建议。"
              />
            )}
          </div>
        )}

        <section className="m-4 rounded-lg border border-gray-800 bg-[#111827] p-4 shadow-xl">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">
              AAA地方债 vs 国债收益率比较仪
            </h3>
          </div>
          <div className="mb-4 flex border-b border-gray-700">
            {comparisonTabs.map(item => (
              <button
                type="button"
                key={item}
                onClick={() => setComparisonTab(item)}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm",
                  comparisonTab === item
                    ? "border-purple-400 text-purple-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                {item === "term_structure"
                  ? "展期结构"
                  : item === "ratio_history"
                    ? "比値历史"
                    : "税收等价"}
              </button>
            ))}
          </div>

          {comparisonTab === "term_structure" &&
            (curve.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-white">
                  AAA地方债展期结构 vs 等期国债收益率对比
                </h4>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis dataKey="term" />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip />
                    <Area
                      dataKey="municipalYieldPct"
                      stroke="#a78bfa"
                      fill="#a78bfa"
                      fillOpacity={0.3}
                      name="AAA地方债"
                    />
                    <Area
                      dataKey="treasuryYieldPct"
                      stroke="#60a5fa"
                      fill="#60a5fa"
                      fillOpacity={0.3}
                      name="等期国债"
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="展期结构未接入"
                detail="需要同日同期限的 AAA 市政和国债配对点。"
              />
            ))}

          {comparisonTab === "ratio_history" &&
            (history.length ? (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-white">
                  地方债对国债收益率比値历史变化 + 税收等价收益率 (10Y)
                </h4>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      dataKey="ratio10Pct"
                      stroke="#f59e0b"
                      name="AAA/UST比率"
                    />
                    <Legend />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="比値历史未接入"
                detail="需要同日配对的 10Y 比率历史；不再由固定比率推算税等价历史。"
              />
            ))}

          {comparisonTab === "tax_equivalent" && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-white">
                当前税收等价收益率分析 (基于AAA地方债)
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {["5Y", "10Y", "30Y"].map(term => {
                  const point = curve.find(item => item.term === term);
                  return (
                    <div
                      key={term}
                      className="rounded border border-gray-700 bg-gray-800 p-3"
                    >
                      <div className="text-xs text-gray-400">
                        {term} AAA地方债
                      </div>
                      <div className="mt-1 font-mono text-base font-bold text-amber-400">
                        {percent(point?.municipalYieldPct)}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        税等价(37%)：
                        {point?.municipalYieldPct == null
                          ? "—"
                          : (point.municipalYieldPct / 0.63).toFixed(2) + "%"}
                      </div>
                      <div className="text-xs text-gray-500">
                        税等价(24%)：
                        {point?.municipalYieldPct == null
                          ? "—"
                          : (point.municipalYieldPct / 0.76).toFixed(2) + "%"}
                      </div>
                    </div>
                  );
                })}
              </div>
              
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
