import { TrendingUp, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PortfolioPanelProps {
  title: string;
}

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : "—";
}

/**
 * The portfolio panel is account-backed. It must not present a built-in
 * AAPL/MSFT/GOOGL demo portfolio when no account connector is configured.
 */
export default function PortfolioPanel({ title }: PortfolioPanelProps) {
  const { data, isLoading } = trpc.portfolio.getHoldings.useQuery();
  const holdings = data?.holdings ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
      </div>

      {isLoading ? (
        <div className="p-3 text-xs text-muted-foreground">正在读取账户持仓…</div>
      ) : !data?.available ? (
        <div className="m-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <div className="font-semibold mb-1">没有可核验的账户持仓</div>
          <div className="text-slate-400">
            {data?.limitation ?? "请配置经纪商/托管行授权或导入账本；系统不会显示示例持仓。"}
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-border p-2 bg-card/50 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Value:</span>
              <span className="font-mono font-semibold text-foreground">{money(data.totalValue)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Gain/Loss:</span>
              <span className="font-mono font-semibold text-foreground">{money(data.totalPnl)}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-muted/20 border-b border-border">
                <tr>
                  {["Symbol", "Qty", "Avg Price", "Current", "Value", "Gain/Loss"].map(label => (
                    <th key={label} className="px-2 py-1 text-right font-mono font-semibold text-accent">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((position: any) => {
                  const gain = position.gainLoss ?? position.unrealizedPnl ?? null;
                  return (
                    <tr key={position.id ?? position.symbol} className="border-b border-border/30">
                      <td className="px-2 py-1 text-left font-mono font-semibold text-accent">{position.symbol}</td>
                      <td className="px-2 py-1 text-right font-mono">{position.quantity ?? "—"}</td>
                      <td className="px-2 py-1 text-right font-mono">{money(position.avgPrice)}</td>
                      <td className="px-2 py-1 text-right font-mono">{money(position.currentPrice)}</td>
                      <td className="px-2 py-1 text-right font-mono">{money(position.value ?? position.marketValue)}</td>
                      <td className={`px-2 py-1 text-right font-mono ${typeof gain === "number" && gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                        <span className="inline-flex items-center gap-1">{typeof gain === "number" && gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{money(gain)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
