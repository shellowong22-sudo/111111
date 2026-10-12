import { useState } from "react";
import { AlertCircle, Calculator, RefreshCw, ShieldCheck, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PricingRiskPanelProps {
  onClose?: () => void;
  title?: string;
}

/**
 * The previous version rendered fixed model accuracies, Greeks and risk limits.
 * This panel now uses the existing typed pricing API for calculations and
 * exposes an explicit boundary for account-level risk data that is not present.
 */
export default function PricingRiskPanel({ onClose, title = "定价与风险分析" }: PricingRiskPanelProps) {
  const [tab, setTab] = useState<"models" | "greeks" | "limits">("models");
  const [spot, setSpot] = useState("100");
  const [strike, setStrike] = useState("100");
  const [tenor, setTenor] = useState("0.25");
  const [rate, setRate] = useState("0.05");
  const [volatility, setVolatility] = useState("0.20");
  const [type, setType] = useState<"call" | "put">("call");

  const option = trpc.pricing.calcOptionPrice.useQuery(
    {
      S: Number(spot),
      K: Number(strike),
      T: Number(tenor),
      r: Number(rate),
      sigma: Number(volatility),
      type,
    },
    {
      enabled: [spot, strike, tenor, rate, volatility].every(value => Number(value) > 0),
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  );
  const depth = trpc.pricing.getLiquidityDepth.useQuery({ productId: "UST10Y" });
  const tabs = [
    ["models", "定价计算"],
    ["greeks", "Greeks"],
    ["limits", "风险边界"],
  ] as const;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0a0e1a] text-white text-xs">
      <div className="flex items-center justify-between border-b border-gray-700 bg-[#0d1220] px-3 py-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-bold text-violet-400">PRSK</span>
          <span className="text-gray-300">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void option.refetch()} className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white" title="重新计算">
            <RefreshCw className={`h-3.5 w-3.5 ${option.isFetching ? "animate-spin" : ""}`} />
          </button>
          {onClose && <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-700 px-3 py-1.5">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded px-2 py-1 text-[9px] font-medium ${tab === id ? "bg-violet-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "models" && (
          <div className="space-y-3">
            <div className="rounded border border-violet-900/60 bg-violet-950/20 p-2 text-[10px] text-violet-200">
              使用后端 `pricing.calcOptionPrice` 进行可复算 Black-Scholes 定价。这里的结果是模型计算，不是交易所报价，也不会伪称为实时市场价格。
            </div>
            <div className="grid grid-cols-2 gap-2 rounded bg-gray-900 p-3">
              {[
                ["标的价格", spot, setSpot],
                ["行权价", strike, setStrike],
                ["剩余年限", tenor, setTenor],
                ["无风险利率", rate, setRate],
                ["波动率", volatility, setVolatility],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="text-[9px] text-gray-400">
                  {label as string}
                  <input value={value as string} onChange={event => (setter as (next: string) => void)(event.target.value)} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white" />
                </label>
              ))}
              <label className="text-[9px] text-gray-400">
                期权类型
                <select value={type} onChange={event => setType(event.target.value as "call" | "put")} className="mt-0.5 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-white">
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </label>
            </div>
            {option.isLoading ? <div className="p-3 text-gray-500">正在计算…</div> : option.data ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  ["模型价格", option.data.price],
                  ["内在价值", option.data.intrinsicValue],
                  ["时间价值", option.data.timeValue],
                  ["盈亏平衡", option.data.breakeven],
                ].map(([label, value]) => <div key={label as string} className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[9px] text-gray-500">{label as string}</div><div className="mt-1 font-mono text-sm text-cyan-300">{Number(value).toFixed(6)}</div></div>)}
              </div>
            ) : <div className="p-3 text-amber-300">输入参数必须为正数。</div>}
          </div>
        )}

        {tab === "greeks" && (
          <div className="space-y-2">
            {option.data ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  ["Delta", option.data.delta],
                  ["Gamma", option.data.gamma],
                  ["Vega", option.data.vega],
                  ["Theta", option.data.theta],
                  ["Rho", option.data.rho],
                ].map(([label, value]) => <div key={label as string} className="rounded border border-gray-800 bg-gray-900 p-2"><div className="text-[9px] text-gray-500">{label as string}</div><div className="mt-1 font-mono text-sm text-violet-300">{Number(value).toFixed(6)}</div></div>)}
              </div>
            ) : <div className="p-3 text-gray-500">先输入有效参数。</div>}
            <div className="text-[10px] text-gray-500">Greeks 由当前参数实时重新计算，不代表交易所隐含波动率或账户风险敞口。</div>
          </div>
        )}

        {tab === "limits" && (
          <div className="space-y-3">
            <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[10px] leading-4 text-amber-200">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              账户级限额、VaR、Delta/Vega 敞口需要真实账户持仓和授权风险源；当前系统不生成固定数值。
            </div>
            {depth.data && (
              <div className="rounded border border-gray-800 bg-gray-900 p-3 text-[10px] text-gray-300">
                <AlertCircle className="mr-1 inline h-3.5 w-3.5 text-amber-300" />
                {depth.data.limitation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
