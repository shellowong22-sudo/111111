import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

interface PortfolioAnalysisPanelProps {
  title: string;
}

function value(value: number | null | undefined, suffix = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`
    : "—";
}

/**
 * Portfolio analytics must be driven by the portfolio router. There is no
 * bundled demo allocation, fixed return curve, or fabricated risk score.
 */
export default function PortfolioAnalysisPanel({ title }: PortfolioAnalysisPanelProps) {
  const { data: holdings, isLoading } = trpc.portfolio.getHoldings.useQuery();
  const { data: risk } = trpc.portfolio.getRiskMetrics.useQuery();

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">正在读取组合数据…</div>;
  }

  if (!holdings?.available) {
    return (
      <Card className="m-6 border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base text-amber-200">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">
          {holdings?.limitation ?? "没有可核验的用户持仓、成本和基准序列。请先配置经纪商/托管行授权或导入账本。"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-full bg-background p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">数据来自当前账户连接，不展示静态示例。</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">总资产</CardTitle></CardHeader><CardContent className="text-xl font-mono">{value(holdings.totalValue)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">成本</CardTitle></CardHeader><CardContent className="text-xl font-mono">{value(holdings.totalCost)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">总盈亏</CardTitle></CardHeader><CardContent className="text-xl font-mono">{value(holdings.totalPnl)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">持仓数</CardTitle></CardHeader><CardContent className="text-xl font-mono">{holdings.holdings.length}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">风险指标</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>VaR 95% <span className="font-mono">{value(risk?.var95)}</span></div>
          <div>波动率 <span className="font-mono">{value(risk?.volatility, "%")}</span></div>
          <div>Beta <span className="font-mono">{value(risk?.beta)}</span></div>
          <div>最大回撤 <span className="font-mono">{value(risk?.maxDrawdown, "%")}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">持仓明细</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left p-2">标的</th><th className="text-right p-2">数量</th><th className="text-right p-2">现价</th><th className="text-right p-2">市值</th></tr></thead>
              <tbody>
                {holdings.holdings.map((holding: any) => (
                  <tr key={holding.id ?? holding.symbol} className="border-b border-border/50">
                    <td className="p-2 font-mono">{holding.symbol}</td>
                    <td className="p-2 text-right">{value(holding.quantity)}</td>
                    <td className="p-2 text-right">{value(holding.currentPrice)}</td>
                    <td className="p-2 text-right">{value(holding.marketValue ?? holding.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
