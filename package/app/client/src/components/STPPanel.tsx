import { AlertCircle, RefreshCw, ShieldAlert, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface STPPanelProps {
  onClose?: () => void;
  title?: string;
}

/**
 * Straight-through processing requires an authorised order/settlement feed.
 * The former panel used random hourly volumes and fixed success rates. Keep
 * the existing entry point, but show the real availability boundary instead.
 */
export default function STPPanel({ onClose, title = "STP 直通处理监控" }: STPPanelProps) {
  const risk = trpc.trading.getRiskMetrics.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0e1a] text-white text-xs">
      <div className="flex items-center justify-between border-b border-gray-700 bg-[#0d1220] px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">STP</span>
          <span className="text-gray-300">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void risk.refetch()} className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white" title="刷新状态">
            <RefreshCw className={`h-3.5 w-3.5 ${risk.isFetching ? "animate-spin" : ""}`} />
          </button>
          {onClose && <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[10px] leading-4 text-amber-200">
          <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
          当前没有可核验的经纪商订单、成交回报、结算状态或 STP 事件流。系统已移除原先的随机处理量、失败数和成功率，不把演示数字显示成生产数据。
        </div>
        {risk.data && (
          <div className="mt-3 rounded border border-gray-800 bg-gray-900 p-3 text-[10px] text-gray-400">
            <div className="mb-2 text-gray-300">风险源状态</div>
            <div className="text-amber-300">{risk.data.limitation}</div>
            <div className="mt-2 text-gray-600">检查时间：{risk.data.asOf}</div>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {["今日处理", "STP率", "失败", "平均时延"].map(label => (
            <div key={label} className="rounded border border-gray-800 bg-gray-900 p-2">
              <div className="text-[9px] text-gray-500">{label}</div>
              <div className="mt-1 font-mono text-sm text-gray-600">—</div>
              <div className="mt-1 text-[8px] text-gray-600">未接入真实事件流</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
