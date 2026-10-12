import { useState } from "react";
import { AlertTriangle, Database, Shield, X } from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface Props {
  onClose?: () => void;
}

const ACCENT = "#10b981";
const tabs = ["distribution", "migration", "spread", "default"] as const;

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

export default function CDRAPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("distribution");
  const status = trpc.municipalResearch.getCdraCreditRatingStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = status.data;
  const distribution = data?.ratingDistribution ?? [];
  const investmentGradeCount = distribution
    .filter(row => !/^B[a-z]?|^C|^D/i.test(row.rating))
    .reduce((sum, row) => sum + row.count, 0);
  const totalCount = distribution.reduce((sum, row) => sum + row.count, 0);
  const highGradeCount = distribution
    .filter(row => /AAA|AA|Aaa|Aa/.test(row.rating))
    .reduce((sum, row) => sum + row.count, 0);
  const latestAction = data?.ratingActions.at(-1);
  const limitation =
    data?.limitation ??
    "正在检查市政债评级数据契约；失败时不会回退到固定分布、迁移概率或违约率。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            CDRA
          </span>
          <span className="text-sm font-semibold text-white">信用评级分析</span>
          <span className="text-xs text-gray-400">Credit Rating Analysis</span>
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

      <div className="flex items-start gap-2 border-b border-emerald-900/70 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>{limitation}</p>
          <p className="mt-1 text-[10px] text-emerald-300/70">
            {data?.dataContractId ?? "municipal-cdra-credit-ratings"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "投资级占比",
            value: totalCount
              ? `${((investmentGradeCount / totalCount) * 100).toFixed(1)}%`
              : "—",
            sub: "BBB-及以上",
          },
          {
            label: "AAA/AA占比",
            value: totalCount
              ? `${((highGradeCount / totalCount) * 100).toFixed(1)}%`
              : "—",
            sub: "以接入评级口径计算",
          },
          {
            label: "本月升级",
            value: latestAction ? `${latestAction.upgrades}笔` : "—",
            sub: "需正式评级行动",
          },
          {
            label: "本月降级",
            value: latestAction ? `${latestAction.downgrades}笔` : "—",
            sub: "需正式评级行动",
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
            <div className="font-mono text-sm font-bold text-green-400">
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
                ? "border-green-400 text-green-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "distribution"
              ? "评级分布"
              : item === "migration"
                ? "迁移矩阵"
                : item === "spread"
                  ? "利差分析"
                  : "违约历史"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "distribution" && (
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">
              评级分布（按债券数量）
            </h3>
            {distribution.length ? (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={distribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis
                      type="number"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="rating"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid #374151",
                      }}
                    />
                    <Bar dataKey="count" name="债券数量" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-1.5">
                  {distribution
                    .filter(row => row.spreadBps != null)
                    .map(row => (
                      <div key={row.rating} className="flex items-center gap-2">
                        <span className="w-20 text-[10px] text-gray-400">
                          {row.rating}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded bg-gray-800">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${Math.min(100, Math.max(0, row.spreadBps ?? 0))}%`,
                            }}
                          />
                        </div>
                        <span className="w-14 text-right font-mono text-[10px] text-white">
                          {row.spreadBps == null ? "—" : `+${row.spreadBps}bps`}
                        </span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="评级分布未接入"
                detail="需要获准的逐券评级、评级日期和证券母体。当前不以静态数量或发行日历推算投资级占比。"
              />
            )}
          </div>
        )}

        {tab === "migration" && (
          <div className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">
              1年期评级迁移矩阵（%）
            </h3>
            <p className="mb-4 text-[10px] text-gray-400">
              迁移概率必须来自注明样本期和评级口径的正式研究资料。
            </p>
            {data?.migrationMatrix.length ? (
              <>
                <table className="mb-4 w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-3 py-2 text-left font-normal text-gray-500">
                        当前评级
                      </th>
                      {["→AAA", "→AA", "→A", "→BBB", "→投机级"].map(header => (
                        <th
                          key={header}
                          className="px-3 py-2 text-center font-normal text-gray-500"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.migrationMatrix.map(row => (
                      <tr
                        key={row.fromRating}
                        className="border-b border-gray-800/50"
                      >
                        <td className="px-3 py-2 font-mono font-bold text-amber-400">
                          {row.fromRating}
                        </td>
                        {[
                          row.toAAA,
                          row.toAA,
                          row.toA,
                          row.toBBB,
                          row.toBelowInvestmentGrade,
                        ].map((value, index) => (
                          <td
                            key={index}
                            className="px-3 py-2 text-center font-mono"
                          >
                            {value.toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.ratingActions.length ? (
                  <>
                    <h3 className="mb-3 text-sm font-semibold text-white">
                      月度升降级趋势
                    </h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.ratingActions}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                          dataKey="period"
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                        />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111827",
                            border: "1px solid #374151",
                          }}
                        />
                        <Bar dataKey="upgrades" fill="#10b981" name="升级" />
                        <Bar dataKey="downgrades" fill="#ef4444" name="降级" />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="迁移矩阵未接入"
                detail="需要统一评级标尺、样本期、期初与期末评级以及升级/降级事件。当前不生成维持率或月度行动。"
              />
            )}
          </div>
        )}

        {tab === "spread" && (
          <div className="p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              各评级利差历史走势（vs AAA，bps）
            </h3>
            {data?.spreadHistory.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.spreadHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="aaSpreadBps"
                    stroke="#34d399"
                    strokeWidth={2}
                    name="AA利差"
                  />
                  <Line
                    type="monotone"
                    dataKey="aSpreadBps"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="A利差"
                  />
                  <Line
                    type="monotone"
                    dataKey="bbbSpreadBps"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="BBB利差"
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="评级利差历史未接入"
                detail="需要同日期、期限、税务和结构口径的逐券收益率及评级。当前不把其他信用曲线或固定 bps 序列填入，也不发布配置建议。"
              />
            )}
          </div>
        )}

        {tab === "default" && (
          <div className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">
              地方债历史违约率（%）
            </h3>
            <p className="mb-4 text-[10px] text-gray-400">
              每个统计值必须同时注明评级组、累计期限和样本起止期。
            </p>
            {data?.defaultHistory.length ? (
              <div className="grid grid-cols-2 gap-3">
                {data.defaultHistory.map(row => (
                  <div
                    key={`${row.ratingGroup}-${row.horizonYears}`}
                    className="rounded border border-gray-800 bg-gray-900 p-3"
                  >
                    <div className="text-[10px] text-gray-500">
                      {row.ratingGroup} {row.horizonYears}年累计违约率
                    </div>
                    <div className="mt-1 font-mono text-base font-bold text-green-400">
                      {row.cumulativeDefaultPct.toFixed(2)}%
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      样本：{row.sampleStart ?? "—"} 至 {row.sampleEnd ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="违约历史未接入"
                detail="需要可核验的违约定义、评级组、累计期限和完整样本期。当前不显示固定零值或“从未违约”等无法审计结论。"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
