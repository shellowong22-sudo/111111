import { useMemo, useState } from "react";
import { AlertTriangle, Database, DollarSign, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
const tabs = ["bids", "depth", "liquidity", "execution"] as const;

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

function liquidityClass(value: string | null) {
  if (value === "High")
    return "border-green-500/30 bg-green-500/20 text-green-400";
  if (value === "Medium")
    return "border-amber-500/30 bg-amber-500/20 text-amber-400";
  return "border-gray-600 bg-gray-700/50 text-gray-400";
}

function scoreColor(score: number | null) {
  if (score == null) return "#374151";
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export default function MBWDPanel({ onClose }: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("bids");
  const [selectedCusip, setSelectedCusip] = useState<string | null>(null);
  const status = trpc.municipalResearch.getMbwdBidWantedStatus.useQuery(
    undefined,
    { staleTime: 60_000, refetchInterval: 60_000 }
  );
  const data = status.data;
  const inquiries = data?.inquiries ?? [];
  const selected =
    inquiries.find(inquiry => inquiry.cusip === selectedCusip) ?? null;
  const selectedDepth = useMemo(
    () =>
      data?.depth.filter(
        row => row.cusip === (selected?.cusip ?? selectedCusip)
      ) ?? [],
    [data?.depth, selected?.cusip, selectedCusip]
  );
  const totalSize = inquiries.reduce(
    (sum, inquiry) => sum + inquiry.sizeThousands,
    0
  );
  const dealerCounts = inquiries.map(inquiry => inquiry.bids.length);
  const averageDealerCount = dealerCounts.length
    ? dealerCounts.reduce((sum, count) => sum + count, 0) / dealerCounts.length
    : null;
  const limitation =
    data?.limitation ??
    "正在检查地方债询价数据契约；失败时不会回退到固定报价、模拟深度或其他地方债数据。";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-950 text-gray-100">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" style={{ color: ACCENT }} />
          <span
            className="font-mono text-sm font-bold"
            style={{ color: ACCENT }}
          >
            MBWD
          </span>
          <span className="text-sm font-semibold text-white">
            地方债买价询价
          </span>
          <span className="text-xs text-gray-400">Municipal Bid-Wanted</span>
          <span className="rounded border border-slate-600 bg-slate-700/30 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            未接入
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
            {data?.dataContractId ?? "municipal-mbwd-bid-wanted"} · 最近检查：
            {data?.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
          </p>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-gray-800">
        {[
          {
            label: "活跃询价",
            value: inquiries.length ? `${inquiries.length}笔` : "—",
            sub: inquiries.length
              ? `$${(totalSize / 1000).toFixed(1)}M总量`
              : "无可核验请求",
          },
          {
            label: "平均买卖价差",
            value: "—",
            sub: "需要同证券双边深度",
          },
          {
            label: "最高超额报价",
            value: dealerCounts.length ? `${Math.max(...dealerCounts)}家` : "—",
            sub: "仅统计真实回报",
          },
          {
            label: "市场流动性指数",
            value: "—",
            sub:
              averageDealerCount == null
                ? "无可核验流动性样本"
                : `平均 ${averageDealerCount.toFixed(1)} 家回报`,
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
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            )}
          >
            {item === "bids"
              ? "实时报价"
              : item === "depth"
                ? "市场深度"
                : item === "liquidity"
                  ? "流动性热力图"
                  : "最优执行"}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === "bids" &&
          (inquiries.length ? (
            inquiries.map(inquiry => {
              const orderedBids = [...inquiry.bids].sort(
                (left, right) => right.price - left.price
              );
              const bestBid = orderedBids[0];
              return (
                <button
                  type="button"
                  key={inquiry.requestId}
                  onClick={() => setSelectedCusip(inquiry.cusip)}
                  className={cn(
                    "block w-full border-b border-gray-800/50 p-3 text-left transition-colors",
                    selectedCusip === inquiry.cusip
                      ? "border-l-2 border-l-amber-500 bg-amber-500/10"
                      : "hover:bg-gray-800/30"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white">
                        {inquiry.issuer}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-gray-500">
                        {inquiry.cusip}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-[10px]",
                          liquidityClass(inquiry.liquidity)
                        )}
                      >
                        {inquiry.liquidity ?? "—"}
                      </span>
                      <span className="font-mono text-xs text-gray-400">
                        ${inquiry.sizeThousands}K
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-gray-400">
                      票面{" "}
                      <b className="font-mono text-white">
                        {inquiry.couponPct == null
                          ? "—"
                          : `${inquiry.couponPct}%`}
                      </b>
                    </span>
                    <span className="text-gray-400">
                      到期{" "}
                      <b className="font-mono text-white">
                        {inquiry.maturity ?? "—"}
                      </b>
                    </span>
                    <span className="text-gray-400">
                      评级{" "}
                      <b className="font-mono text-blue-400">
                        {inquiry.rating ?? "—"}
                      </b>
                    </span>
                    <span className="text-gray-400">
                      最优报价{" "}
                      <b className="font-mono text-green-400">
                        {bestBid
                          ? `${bestBid.price.toFixed(2)}${bestBid.yieldPct == null ? "" : ` (${bestBid.yieldPct.toFixed(2)}%)`}`
                          : "—"}
                      </b>
                    </span>
                    <span className="text-gray-400">
                      上次成交{" "}
                      <b className="font-mono text-gray-300">
                        {inquiry.lastTradePrice == null
                          ? "—"
                          : `${inquiry.lastTradePrice.toFixed(2)} @ ${inquiry.lastTradeAt ?? "—"}`}
                      </b>
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState
              title="实时报价未接入"
              detail="需要获准的地方债询价请求及交易商逐笔回报。当前没有可执行报价，不生成 CUSIP、交易商、价格、收益率或成交时间。"
            />
          ))}

        {tab === "depth" && (
          <div className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">
              市场深度图 — {selected?.issuer ?? "未选择询价"}
            </h3>
            <p className="mb-4 text-[10px] text-gray-400">
              绿色=买盘，红色=卖盘。深度仅显示获准的同一证券盘口。
            </p>
            {selectedDepth.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={selectedDepth} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="price"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #374151",
                    }}
                  />
                  <Bar dataKey="bidSizeThousands" fill="#10b981" name="买盘" />
                  <Bar dataKey="askSizeThousands" fill="#ef4444" name="卖盘" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="市场深度未接入"
                detail="需要与当前 CUSIP 同源、同时间的买卖盘价位与数量。当前不把成交记录或其他证券深度复制到这里。"
              />
            )}
          </div>
        )}

        {tab === "liquidity" && (
          <div className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-white">
              地方债流动性热力图（按期限×板块）
            </h3>
            <p className="mb-4 text-[10px] text-gray-400">
              仅依据获准的询价响应率、报价数和执行样本计算，不根据固定分数推断。
            </p>
            {data?.liquidityMatrix.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="px-3 py-2 text-left font-normal text-gray-500">
                        期限
                      </th>
                      {["一般义务(GO)", "收益债(Revenue)", "教育", "医疗"].map(
                        header => (
                          <th
                            key={header}
                            className="px-3 py-2 text-center font-normal text-gray-500"
                          >
                            {header}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.liquidityMatrix.map(row => (
                      <tr
                        key={row.term}
                        className="border-b border-gray-800/50"
                      >
                        <td className="px-3 py-2 font-mono text-amber-400">
                          {row.term}
                        </td>
                        {[
                          row.generalObligationScore,
                          row.revenueScore,
                          row.educationScore,
                          row.healthcareScore,
                        ].map((score, index) => (
                          <td key={index} className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className="h-3 w-3 rounded-sm"
                                style={{ backgroundColor: scoreColor(score) }}
                              />
                              <span className="font-mono text-white">
                                {score ?? "—"}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="流动性热力图未接入"
                detail="需要按期限和板块聚合的真实询价响应与执行样本。当前不生成 0–100 分数或颜色结论。"
              />
            )}
          </div>
        )}

        {tab === "execution" && (
          <div className="space-y-4 p-4">
            <h3 className="text-sm font-semibold text-white">最优执行分析</h3>
            {data?.executionAnalyses.length ? (
              data.executionAnalyses.map(analysis => (
                <div
                  key={analysis.requestId}
                  className="rounded border border-gray-800 bg-gray-900 p-3"
                >
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-gray-500">最优报价</p>
                      <p className="font-mono font-bold text-green-400">
                        {analysis.bestPrice.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">最差报价</p>
                      <p className="font-mono text-red-400">
                        {analysis.worstPrice.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">价格改善</p>
                      <p className="font-mono text-amber-400">
                        {analysis.improvementPct.toFixed(3)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500">报价商数</p>
                      <p className="font-mono text-white">
                        {analysis.dealerCount}家
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="最优执行分析未接入"
                detail="需要同一询价的完整交易商回报、时间戳与最终执行结果。样本缺失时不计算价格改善，也不发布交易商数量或执行时段建议。"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
