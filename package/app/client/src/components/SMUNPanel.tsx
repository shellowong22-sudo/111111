import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  Database,
  Search,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface Props {
  onClose?: () => void;
}

const ACCENT = "#f59e0b";
const tabs = ["profile", "radar", "debt", "compare"] as const;
const healthTabs = ["health", "debt", "tax"] as const;

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

function value(value: number | null | undefined, suffix = "") {
  return value == null ? "—" : value.toLocaleString() + suffix;
}

export default function SMUNPanel({ onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("profile");
  const [healthTab, setHealthTab] =
    useState<(typeof healthTabs)[number]>("health");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const query = trpc.municipalResearch.getSmunIssuerSearchStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const issuers = data?.issuers ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return issuers.filter(
      issuer =>
        !needle ||
        issuer.name.toLowerCase().includes(needle) ||
        (issuer.state ?? "").toLowerCase().includes(needle)
    );
  }, [issuers, search]);
  const selected =
    issuers.find(issuer => issuer.id === selectedId) ?? issuers[0] ?? null;
  const compareData = compareIds
    .map(id => issuers.find(issuer => issuer.id === id))
    .filter((issuer): issuer is NonNullable<typeof issuer> => Boolean(issuer));
  const selectedDebt = selected
    ? (data?.debtService ?? []).filter(row => row.issuerId === selected.id)
    : [];
  const city =
    (data?.cityHealth ?? []).find(item => item.city === selectedCity) ??
    data?.cityHealth[0] ??
    null;
  const radarData = selected
    ? [
        { subject: "养老金充足率", score: selected.pensionFundedPct },
        {
          subject: "储备基金",
          score:
            selected.reserveFundMonths == null
              ? null
              : Math.min(100, selected.reserveFundMonths * 4),
        },
        {
          subject: "收入增长",
          score:
            selected.revenueGrowthPct == null
              ? null
              : Math.min(100, selected.revenueGrowthPct * 12),
        },
        {
          subject: "债务可持续性",
          score:
            selected.debtServicePct == null
              ? null
              : Math.max(0, 100 - selected.debtServicePct * 4),
        },
        {
          subject: "就业环境",
          score:
            selected.unemploymentPct == null
              ? null
              : Math.max(0, 100 - selected.unemploymentPct * 10),
        },
      ]
    : [];
  const cityRadar = city
    ? [
        { subject: "财政平衡", score: city.fiscalBalance },
        { subject: "债务负担", score: city.debtBurden },
        { subject: "税收增长", score: city.taxGrowth },
        { subject: "就业率", score: city.employmentRate },
        { subject: "人口变化", score: city.populationChange },
      ]
    : [];
  const limitation =
    data?.limitation ??
    "正在检查发行人财务数据合同；失败时不会回退到评级、日历、指数或静态发行人样例。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            SMUN
          </span>
          <span className="text-sm font-semibold text-white">
            地方债发行人检索
          </span>
          <span className="text-xs text-gray-400">Municipal Issuer Search</span>
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
            {data?.dataContractId ?? "municipal-smun-issuer-search"} ·
            最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[38%] flex-col border-r border-gray-800">
          <div className="shrink-0 border-b border-gray-800 px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="搜索发行人/州..."
                className="w-full rounded border border-gray-700 bg-gray-800 py-1.5 pl-7 pr-3 text-xs text-gray-200 placeholder-gray-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.length ? (
              filtered.map(issuer => (
                <button
                  type="button"
                  key={issuer.id}
                  onClick={() => setSelectedId(issuer.id)}
                  className={cn(
                    "block w-full border-b border-gray-800/50 px-3 py-2.5 text-left",
                    selected?.id === issuer.id
                      ? "border-l-2 border-l-amber-500 bg-amber-500/10"
                      : "hover:bg-gray-800/40"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      {issuer.name}
                    </span>
                    <span className="font-mono text-[10px] text-amber-400">
                      {issuer.state ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      {issuer.type ?? "—"} · {issuer.sector ?? "—"}
                    </span>
                    <span className="font-mono text-[10px] text-blue-400">
                      {issuer.rating ?? "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[9px] text-gray-600">
                    <span>
                      未偿债务：
                      <span className="text-gray-400">
                        {issuer.outstandingDebtMillions == null
                          ? "—"
                          : "$" +
                            (issuer.outstandingDebtMillions / 1000).toFixed(1) +
                            "B"}
                      </span>
                    </span>
                    <span>
                      人均债务：
                      <span className="text-gray-400">
                        {issuer.debtPerCapita == null
                          ? "—"
                          : "$" + issuer.debtPerCapita.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4">
                <EmptyState
                  title="发行人清单未接入"
                  detail="需要获准的发行人身份、州、主体类型和财务披露。"
                />
              </div>
            )}
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <nav className="flex shrink-0 border-b border-gray-800 bg-gray-900">
            {tabs.map(item => (
              <button
                type="button"
                key={item}
                onClick={() => setTab(item)}
                className={cn(
                  "border-b-2 px-3 py-2 text-xs font-medium",
                  tab === item
                    ? "border-amber-400 text-amber-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                )}
              >
                {item === "profile"
                  ? "财务档案"
                  : item === "radar"
                    ? "健康雷达"
                    : item === "debt"
                      ? "债务结构"
                      : "横向对比"}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-auto p-4">
            {!selected ? (
              <EmptyState
                title="选择发行人查看详情"
                detail="当前未接入获准发行人基本面，因此不会显示固定州、市或评分。"
              />
            ) : tab === "profile" ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {selected.name}
                    </h3>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {selected.type ?? "—"} · {selected.state ?? "—"} ·{" "}
                      {selected.sector ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-gray-300">
                      {selected.healthScore ?? "—"}
                    </div>
                    <div className="text-[10px] text-gray-500">健康评分</div>
                  </div>
                </div>
                {selected.creditWatch && (
                  <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    信用观察状态已由获准数据标记；具体原因需读取对应披露事件。
                  </div>
                )}
                <div className="rounded border border-gray-800 bg-gray-900 p-3">
                  <div className="text-xs font-semibold text-white">
                    信用风险评估
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-gray-400">
                    本区只展示后端核验的评分和财务字段；没有评分方法、评级行动和披露证据时，不生成风险等级、核心优势、主要风险或投资建议。
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["穆迪/标普评级", selected.rating ?? "—"],
                    [
                      "未偿债务总额",
                      selected.outstandingDebtMillions == null
                        ? "—"
                        : "$" +
                          (selected.outstandingDebtMillions / 1000).toFixed(1) +
                          "B",
                    ],
                    [
                      "年发行规模",
                      selected.annualIssuanceMillions == null
                        ? "—"
                        : "$" +
                          (selected.annualIssuanceMillions / 1000).toFixed(1) +
                          "B",
                    ],
                    [
                      "人均债务",
                      selected.debtPerCapita == null
                        ? "—"
                        : "$" + selected.debtPerCapita.toLocaleString(),
                    ],
                    [
                      "人均GDP",
                      selected.gdpPerCapita == null
                        ? "—"
                        : "$" + selected.gdpPerCapita.toLocaleString(),
                    ],
                    ["人口", value(selected.population)],
                    ["养老金充足率", value(selected.pensionFundedPct, "%")],
                    [
                      "储备基金（月）",
                      value(selected.reserveFundMonths, "个月"),
                    ],
                    [
                      "债务/收入比",
                      selected.debtToRevenue == null
                        ? "—"
                        : (selected.debtToRevenue * 100).toFixed(0) + "%",
                    ],
                    ["利息覆盖倍数", value(selected.interestCoverage, "x")],
                    ["收入增长率", value(selected.revenueGrowthPct, "%")],
                    ["失业率", value(selected.unemploymentPct, "%")],
                  ].map(metric => (
                    <div
                      key={metric[0]}
                      className="rounded border border-gray-800 bg-gray-900 p-2"
                    >
                      <div className="text-[10px] text-gray-500">
                        {metric[0]}
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold text-white">
                        {metric[1]}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded border border-gray-800 bg-gray-900 p-3">
                  <div className="text-xs font-semibold text-white">
                    信用趋势
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400">
                    {selected.creditTrend ?? "未接入评级展望"}
                  </div>
                </div>
              </div>
            ) : tab === "radar" ? (
              <div>
                <h3 className="mb-4 text-sm font-semibold text-white">
                  {selected.name} — 财务健康雷达图
                </h3>
                {radarData.some(item => item.score != null) ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#1f2937" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        dataKey="score"
                        stroke={ACCENT}
                        fill={ACCENT}
                        fillOpacity={0.25}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="健康雷达未接入"
                    detail="需要养老金、储备、收入、债务负担和就业字段；缺项不以固定评分填充。"
                  />
                )}
              </div>
            ) : tab === "debt" ? (
              <div>
                <h3 className="mb-4 text-sm font-semibold text-white">
                  {selected.name} — 债务偿还计划（百万美元）
                </h3>
                {selectedDebt.length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={selectedDebt}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey="principalMillions"
                        fill="#f59e0b"
                        name="本金"
                        stackId="a"
                      />
                      <Bar
                        dataKey="interestMillions"
                        fill="#3b82f6"
                        name="利息"
                        stackId="a"
                      />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="债务偿还计划未接入"
                    detail="需要该发行人的逐年本金、利息与到期计划；不复用其他主体的固定偿债序列。"
                  />
                )}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    [
                      "总偿债",
                      selectedDebt.length
                        ? "$" +
                          selectedDebt
                            .reduce(
                              (sum, row) =>
                                sum +
                                (row.principalMillions ?? 0) +
                                (row.interestMillions ?? 0),
                              0
                            )
                            .toLocaleString() +
                          "M"
                        : "—",
                    ],
                    ["债务偿还/收入", value(selected.debtServicePct, "%")],
                    ["加权平均期限", "—"],
                  ].map(metric => (
                    <div
                      key={metric[0]}
                      className="rounded border border-gray-800 bg-gray-900 p-3 text-center"
                    >
                      <div className="text-[10px] text-gray-500">
                        {metric[0]}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold text-white">
                        {metric[1]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="mb-4 text-sm font-semibold text-white">
                  发行人横向对比
                </h3>
                <div className="mb-4 flex flex-wrap gap-2">
                  {issuers.map(issuer => (
                    <button
                      type="button"
                      key={issuer.id}
                      onClick={() =>
                        setCompareIds(ids =>
                          ids.includes(issuer.id)
                            ? ids.filter(id => id !== issuer.id)
                            : [...ids.slice(-3), issuer.id]
                        )
                      }
                      className={cn(
                        "rounded border px-2 py-1 font-mono text-[10px]",
                        compareIds.includes(issuer.id)
                          ? "border-amber-500 bg-amber-500/20 text-amber-400"
                          : "border-gray-700 bg-gray-800 text-gray-400"
                      )}
                    >
                      {issuer.state ?? issuer.name}
                    </button>
                  ))}
                </div>
                {compareData.length ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-2 py-2 text-left font-normal text-gray-500">
                          指标
                        </th>
                        {compareData.map(issuer => (
                          <th
                            key={issuer.id}
                            className="px-2 py-2 text-center font-mono font-bold text-amber-400"
                          >
                            {issuer.state ?? issuer.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["评级", "rating"],
                        ["健康评分", "healthScore"],
                        ["养老金充足率", "pensionFundedPct"],
                        ["储备基金", "reserveFundMonths"],
                        ["债务/收入", "debtToRevenue"],
                        ["利息覆盖", "interestCoverage"],
                        ["收入增长", "revenueGrowthPct"],
                        ["失业率", "unemploymentPct"],
                        ["人均债务", "debtPerCapita"],
                      ].map(([label, key]) => (
                        <tr key={key} className="border-b border-gray-800/50">
                          <td className="px-2 py-1.5 text-gray-500">{label}</td>
                          {compareData.map(issuer => (
                            <td
                              key={issuer.id}
                              className="px-2 py-1.5 text-center font-mono text-white"
                            >
                              {String(
                                issuer[key as keyof typeof issuer] ?? "—"
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState
                    title="请选择发行人进行横向对比"
                    detail="对比只使用各发行人自己的已接入字段，不生成缺失评分。"
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      <section className="m-4 rounded-lg border border-gray-800 bg-[#111827] p-4 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white">地方政府财务健康度仪</h3>
        </div>
        <div className="mb-4 flex border-b border-gray-700">
          {healthTabs.map(item => (
            <button
              type="button"
              key={item}
              onClick={() => setHealthTab(item)}
              className={cn(
                "border-b-2 px-4 py-2 text-sm",
                healthTab === item
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              )}
            >
              {item === "health"
                ? "财务健康度"
                : item === "debt"
                  ? "债务负担"
                  : "税收分析"}
            </button>
          ))}
        </div>

        {healthTab === "health" &&
          (city ? (
            <div>
              <select
                value={city.city}
                onChange={event => setSelectedCity(event.target.value)}
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white"
              >
                {(data?.cityHealth ?? []).map(item => (
                  <option key={item.city} value={item.city}>
                    {item.city}
                  </option>
                ))}
              </select>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={cityRadar}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    dataKey="score"
                    stroke="#60a5fa"
                    fill="#60a5fa"
                    fillOpacity={0.35}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="财务健康度未接入"
              detail="需要城市财政平衡、债务负担、税收、就业和人口变化的同一评分方法。"
            />
          ))}

        {healthTab === "debt" &&
          (data?.debtTaxCreditSpread.length ? (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-white">
                债务/税收 vs 信用利差气泡图
              </h4>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    dataKey="debtToRevenue"
                    name="债务/收入"
                  />
                  <YAxis
                    type="number"
                    dataKey="creditSpreadBps"
                    name="信用利差"
                  />
                  <ZAxis dataKey="population" range={[50, 500]} />
                  <Tooltip />
                  <Scatter data={data.debtTaxCreditSpread} fill="#60a5fa" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="债务负担未接入"
              detail="需要同城市同期债务/收入、信用利差和人口字段；不使用固定城市气泡样例。"
            />
          ))}

        {healthTab === "tax" && (
          <EmptyState
            title="税收分析未接入"
            detail="需要获准的税种结构、税基、历史收入和观测期；不保留示例占位文字或虚构税收图。"
          />
        )}
      </section>
    </div>
  );
}
