import React, { useMemo, useState } from "react";
import {
  Treemap,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AlertTriangle, Database, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ResultDistributionData {
  state: string;
  size: number;
  rating: string | null;
  count: number;
  fill: string;
}

interface MigrationTrendData {
  month: string;
  upgrades: number;
  downgrades: number;
  stable: number;
}

interface StateComparisonData {
  state: string;
  totalIssuance: number;
  avgRating: number;
  upgradeRatio: number;
}

const EMPTY_TEXT = {
  distribution:
    "需要逐券目录、州、面值与评级字段后，才能按当前检索结果形成分布；不使用 CDRA 的全市场评级统计。",
  migration:
    "需要与当前命中 CUSIP 对应的评级行动记录后，才能显示迁移趋势；不复制评级研究页面的趋势。",
  comparison:
    "需要同一检索条件下各州命中证券的面值、数量和评级行动后，才能比较；不使用静态州样例。",
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-96 flex-col items-center justify-center rounded border border-dashed border-gray-700 bg-[#0d1117] p-8 text-center">
      <Database className="h-8 w-8 text-gray-600" />
      <p className="mt-3 text-sm font-semibold text-gray-200">
        当前检索没有可验证结果
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500">{text}</p>
    </div>
  );
}

const MSRCPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<
    "distribution" | "migration" | "comparison"
  >("distribution");
  const [search, setSearch] = useState("");
  const query = trpc.municipalResearch.getMsrcSecuritySearchStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = query.data;
  const needle = search.trim().toLowerCase();
  const securities = useMemo(
    () =>
      (data?.securities ?? []).filter(item =>
        [item.cusip, item.issuer, item.state, item.securityType, item.rating]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(needle))
      ),
    [data?.securities, needle]
  );
  const ratingDistributionData: ResultDistributionData[] = (
    data?.resultDistribution ?? []
  ).map((item, index) => ({
    state: item.state,
    size: item.parAmountMillions,
    rating: item.leadingRating,
    count: item.securityCount,
    fill: ["#38bdf8", "#22c55e", "#f59e0b", "#a78bfa"][index % 4],
  }));
  const migrationTrendData: MigrationTrendData[] = (
    data?.matchedRatingChanges ?? []
  ).map(item => ({
    month: item.period,
    upgrades: item.upgrades,
    downgrades: item.downgrades,
    stable: item.unchanged,
  }));
  const stateComparisonData: StateComparisonData[] = (
    data?.stateComparison ?? []
  ).map(item => ({
    state: item.state,
    totalIssuance: item.matchedParAmountMillions,
    avgRating: item.averageRatingScore ?? Number.NaN,
    upgradeRatio: item.upgradeRatio ?? Number.NaN,
  }));

  const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, value, state, rating, fill } = props;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke="#0d1117"
          strokeWidth={1}
        />
        {width > 30 && height > 20 && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight="bold"
          >
            {state}
          </text>
        )}
        {width > 30 && height > 35 && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 15}
            textAnchor="middle"
            fill="#ccc"
            fontSize={10}
          >
            {rating ?? "—"} ({value}M)
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="h-full overflow-auto bg-[#080d16] text-gray-100">
      <header className="flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <Search className="h-4 w-4 text-purple-400" />
        <span className="font-mono text-sm font-bold text-purple-300">
          MSRC
        </span>
        <span className="text-sm font-semibold">地方债检索</span>
        <span className="rounded border border-gray-700 px-2 py-0.5 text-[10px] text-gray-400">
          {data?.dataStatus === "restricted"
            ? "未接入"
            : query.isFetching
              ? "检查中"
              : "—"}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="关闭 MSRC"
            onClick={onClose}
            className="ml-auto p-1 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <div className="border-b border-gray-800 p-3">
        <label className="relative block max-w-xl">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="搜索 CUSIP、发行人、州、证券类型或评级"
            className="h-8 w-full border border-gray-700 bg-black pl-8 pr-3 text-xs text-gray-200 placeholder:text-gray-600"
          />
        </label>
        <p className="mt-2 text-[10px] text-gray-500">
          当前命中 {securities.length} 只证券 · 合同{" "}
          {data?.dataContractId ?? "municipal-msrc-security-search"}
        </p>
      </div>
      <div className="flex items-start gap-2 border-b border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          {data?.limitation ??
            "正在检查逐券地方债检索合同；失败时不会回退到评级研究、发行人档案或静态省份样例。"}
        </p>
      </div>
      <div className="m-4 rounded border border-gray-800 bg-[#111827] p-4 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <span className="inline-block w-4 h-4 bg-purple-500 rounded-full mr-2"></span>
          <Search className="mr-2 h-6 w-6 text-purple-400" />
          地方债信用评级分布仪
        </h2>

        <div className="flex border-b border-gray-700 mb-4">
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === "distribution" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-200"}`}
            onClick={() => setActiveTab("distribution")}
          >
            评级分布
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === "migration" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-200"}`}
            onClick={() => setActiveTab("migration")}
          >
            迁移趋势
          </button>
          <button
            className={`py-2 px-4 text-sm font-medium ${activeTab === "comparison" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-200"}`}
            onClick={() => setActiveTab("comparison")}
          >
            州对比
          </button>
        </div>

        {activeTab === "distribution" &&
          (ratingDistributionData.length ? (
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={ratingDistributionData}
                  dataKey="size"
                  aspectRatio={4 / 3}
                  stroke="#0d1117"
                  fill="#8884d8"
                  content={<CustomTreemapContent />}
                >
                  <Tooltip formatter={(value: number) => `${value}M`} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text={EMPTY_TEXT.distribution} />
          ))}

        {activeTab === "migration" &&
          (migrationTrendData.length ? (
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={migrationTrendData}
                  margin={{
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 20,
                  }}
                >
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: "#ccc" }} />
                  <YAxis tick={{ fill: "#ccc" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#333",
                      border: "none",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#fff" }} />
                  <Area
                    type="monotone"
                    dataKey="stable"
                    fill="#82ca9d"
                    stroke="#82ca9d"
                    name="稳定"
                  />
                  <Bar
                    dataKey="upgrades"
                    barSize={20}
                    fill="#8884d8"
                    name="上调"
                  />
                  <Line
                    type="monotone"
                    dataKey="downgrades"
                    stroke="#ff7300"
                    name="下调"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState text={EMPTY_TEXT.migration} />
          ))}

        {activeTab === "comparison" &&
          (stateComparisonData.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      州名
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      总发行规模 (亿)
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      平均评级 (1-4)
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      评级上调率
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#0d1117] divide-y divide-gray-700">
                  {stateComparisonData.map(data => (
                    <tr key={data.state}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {data.state}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {data.totalIssuance}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {Number.isFinite(data.avgRating)
                          ? data.avgRating.toFixed(1)
                          : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {Number.isFinite(data.upgradeRatio)
                          ? `${(data.upgradeRatio * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text={EMPTY_TEXT.comparison} />
          ))}
      </div>
    </div>
  );
};

export default MSRCPanel;
