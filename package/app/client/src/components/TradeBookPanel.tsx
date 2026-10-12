import { AlertCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface TradeBookPanelProps {
  title: string;
}

const REFERENCE_TICKERS = ["AAPL", "MSFT", "NVDA", "SPY"];

/**
 * A trade blotter must never manufacture fills or P&L. Until an authorised
 * account/broker connector is configured this panel exposes the live public
 * market reference and an explicit empty account state.
 */
export default function TradeBookPanel({ title }: TradeBookPanelProps) {
  const observations = trpc.stockMarketResearch.getWatchlistObservations.useQuery(
    { tickers: REFERENCE_TICKERS, range: "1mo", includeHistory: true },
    {
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0e1a] text-white text-xs">
      <div className="flex items-center justify-between border-b border-gray-700 bg-[#0d1220] px-3 py-2">
        <div>
          <div className="font-bold text-sm text-cyan-300">{title}</div>
          <div className="text-[9px] text-gray-500">真实账户成交账本 / 公开行情参考</div>
        </div>
        <button
          type="button"
          onClick={() => void observations.refetch()}
          className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
          title="刷新公开行情"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${observations.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="border-b border-amber-900/60 bg-amber-950/20 p-3 text-[10px] leading-4 text-amber-200">
        <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
        当前没有可核验的账户授权、订单、成交回执或成本基础。原先的 AAPL/MSFT 等示例交易已移除；系统不会把静态样本当成真实交易。
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="mb-2 text-[10px] text-gray-400">公开行情参考（不代表持仓、订单或可执行报价）</div>
        <table className="w-full border-collapse text-[10px]">
          <thead className="border-b border-gray-700 text-gray-400">
            <tr>
              <th className="px-2 py-1 text-left">代码</th>
              <th className="px-2 py-1 text-left">状态</th>
              <th className="px-2 py-1 text-right">最新观察</th>
              <th className="px-2 py-1 text-right">涨跌</th>
              <th className="px-2 py-1 text-left">观察日</th>
            </tr>
          </thead>
          <tbody>
            {(observations.data?.rows ?? []).map((row: any) => (
              <tr key={row.ticker} className="border-b border-gray-800">
                <td className="px-2 py-1 font-mono text-cyan-300">{row.ticker}</td>
                <td className="px-2 py-1">{row.status === "available" ? <span className="text-emerald-300">实际可读</span> : <span className="text-gray-500">不可用</span>}</td>
                <td className="px-2 py-1 text-right font-mono">{row.price ?? "—"} {row.currency ?? ""}</td>
                <td className={`px-2 py-1 text-right font-mono ${Number(row.changePct) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{row.changePct == null ? "—" : `${Number(row.changePct) >= 0 ? "+" : ""}${Number(row.changePct).toFixed(2)}%`}</td>
                <td className="px-2 py-1 text-gray-500">{row.latestDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!observations.isLoading && !(observations.data?.rows ?? []).length && (
          <div className="mt-3 rounded border border-gray-800 p-3 text-[10px] text-gray-500">
            公开行情源没有返回可验证观察；不生成空白交易记录或替代价格。
          </div>
        )}
      </div>
    </div>
  );
}
