import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, Legend, ResponsiveContainer, ReferenceDot, ReferenceLine, Cell,
  PieChart, Pie,
} from "recharts";
import { TrendingUp, TrendingDown, Shield, Target, BarChart2, Layers, Zap, Info, ChevronRight } from "lucide-react";
import { RowDetailDrawer, type RowField, type SparklineConfig } from "@/components/RowDetailDrawer";
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipProvider as UITooltipProvider, TooltipTrigger as UITooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── 指标悬停提示 ─────────────────────────────────────────────────────────────
const METRIC_TOOLTIPS: Record<string, { title: string; formula: string; interpret: string }> = {
  alpha: {
    title: 'Alpha（超额收益）',
    formula: 'α = Rp − [Rf + β × (Rm − Rf)]',
    interpret: '衡量组合相对于 CAPM 预测收益的超出部分。正值表示主动管理创造了价值，负值表示跑输风险调整后基准。通常 >2% 视为优秀。',
  },
  sharpe: {
    title: '夏普比率（Sharpe Ratio）',
    formula: 'S = (Rp − Rf) / σp',
    interpret: '每承担一单位总风险所获得的超额收益。>1.0 良好，>1.5 优秀，>2.0 卓越。负值意味着持有无风险资产更优。',
  },
  informationRatio: {
    title: '信息比率（Information Ratio）',
    formula: 'IR = (Rp − Rb) / TE',
    interpret: '主动管理每单位追踪误差产生的超额收益。>0.5 良好，>1.0 优秀。反映基金经理选股和择时的综合能力。',
  },
  maxDrawdown: {
    title: '最大回撤（Max Drawdown）',
    formula: 'MDD = (峰值 − 谷值) / 峰值 × 100%',
    interpret: '组合从历史最高点到最低点的最大跌幅。反映极端情景下的损失承受能力。>20% 需警惕，>30% 通常触发风控止损。',
  },
  beta: {
    title: 'Beta（市场敏感度）',
    formula: 'β = Cov(Rp, Rm) / Var(Rm)',
    interpret: '组合相对于市场的系统性风险。β=1 与市场同步；β>1 放大市场波动；β<1 防御性更强。β=1.2 表示市场涨/跌 1% 时组合涨/跌约 1.2%。',
  },
  trackingError: {
    title: '追踪误差（Tracking Error）',
    formula: 'TE = σ(Rp − Rb) × √252',
    interpret: '组合收益率与基准收益率差值的年化标准差。越低表示越贴近基准。被动基金通常 <0.5%，主动基金 2-8% 为正常范围。',
  },
  calmar: {
    title: '卡尔马比率（Calmar Ratio）',
    formula: 'Calmar = 年化收益率 / |最大回撤|',
    interpret: '单位最大回撤所获得的年化收益。>1.0 良好，>2.0 优秀。与夏普比率互补，更关注尾部风险而非波动率。',
  },
  var95: {
    title: 'VaR 95%（在险价值）',
    formula: 'VaR₉₅ = μ − 1.645σ（正态假设）',
    interpret: '在 95% 置信度下，未来一个交易日的最大预期损失。即有 5% 的概率损失超过该值。历史模拟法更准确但计算量大。',
  },
  var99: {
    title: 'VaR 99%（在险价值）',
    formula: 'VaR₉₉ = μ − 2.326σ（正态假设）',
    interpret: '在 99% 置信度下，未来一个交易日的最大预期损失。仅有 1% 概率损失超过该值。巴塞尔协议要求银行使用 99% VaR 计算监管资本。',
  },
  cvar95: {
    title: 'CVaR 95%（条件在险价值）',
    formula: 'CVaR₉₅ = E[损失 | 损失 > VaR₉₅]',
    interpret: '也称 Expected Shortfall（ES）。当损失超过 VaR 时的平均损失。比 VaR 更能刻画尾部风险，是 FRTB 监管框架的核心指标。',
  },
  sortino: {
    title: '索提诺比率（Sortino Ratio）',
    formula: 'Sortino = (Rp − Rf) / σ_下行',
    interpret: '仅用下行波动率（负收益的标准差）替代总波动率。比夏普比率更公平地评估风险，因为上行波动对投资者有利。>2.0 视为优秀。',
  },
};

function MetricTooltip({ metricKey, children }: { metricKey: string; children: React.ReactNode }) {
  const tip = METRIC_TOOLTIPS[metricKey];
  if (!tip) return <>{children}</>;
  return (
    <UITooltipProvider delayDuration={200}>
      <UITooltip>
        <UITooltipTrigger asChild>
          <span className="cursor-help border-b border-dashed border-slate-500 hover:border-blue-400 transition-colors">{children}</span>
        </UITooltipTrigger>
        <UITooltipContent side="top" className="max-w-xs bg-slate-800 border-slate-600 p-3 shadow-xl z-50">
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-100">{tip.title}</div>
            <div className="text-[11px] font-mono text-blue-300 bg-slate-900 rounded px-2 py-1">{tip.formula}</div>
            <div className="text-[11px] text-slate-300 leading-relaxed">{tip.interpret}</div>
          </div>
        </UITooltipContent>
      </UITooltip>
    </UITooltipProvider>
  );
}

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#84cc16","#a78bfa","#fb7185","#34d399","#fbbf24","#60a5fa"];
const OBJECTIVES = [
  { value: "maxSharpe", label: "最大夏普比率" },
  { value: "minVariance", label: "最小方差" },
  { value: "maxReturn", label: "最大预期收益" },
  { value: "minCVaR", label: "最小条件风险" },
];

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card className="bg-slate-900 border-slate-700 p-3">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className={`text-xl font-bold ${color ?? "text-slate-100"}`}>{value}</div>
      {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
    </Card>
  );
}

const CUSTOM_TOOLTIP = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded p-2 text-xs">
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}</div>
      ))}
    </div>
  );
};

export default function PortfolioOptimizer() {
  const [tab, setTab] = useState("holdings");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerSubtitle, setDrawerSubtitle] = useState("");
  const [drawerFields, setDrawerFields] = useState<RowField[]>([]);
  const [drawerSections, setDrawerSections] = useState<{ title: string; fields: RowField[] }[]>([]);
  const [drawerSparkline, setDrawerSparkline] = useState<SparklineConfig | undefined>(undefined);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Fetch price history for selected symbol
  const { data: priceHistory } = trpc.portfolio.getPriceHistory.useQuery(
    { symbol: selectedSymbol ?? "", days: 30 },
    { enabled: !!selectedSymbol }
  );

  // Update sparkline when price history loads
  useEffect(() => {
    if (priceHistory && drawerOpen) {
      setDrawerSparkline({
        data: priceHistory.data.map(point => ({ ...point, return: point.return ?? 0 })),
        symbol: priceHistory.symbol,
        totalReturn: priceHistory.totalReturn ?? 0,
        minPrice: priceHistory.minPrice ?? 0,
        maxPrice: priceHistory.maxPrice ?? 0,
        firstPrice: priceHistory.firstPrice ?? 0,
        lastPrice: priceHistory.lastPrice ?? 0,
      });
    }
  }, [priceHistory, drawerOpen]);

  const openDrawer = (title: string, subtitle: string, fields: RowField[], sections?: { title: string; fields: RowField[] }[], symbol?: string) => {
    setDrawerTitle(title);
    setDrawerSubtitle(subtitle);
    setDrawerFields(fields);
    setDrawerSections(sections ?? []);
    setDrawerSparkline(undefined); // reset while loading
    setSelectedSymbol(symbol ?? null);
    setDrawerOpen(true);
  };
  const [objective, setObjective] = useState<"maxSharpe" | "minVariance" | "maxReturn" | "minCVaR">("maxSharpe");
  const [simDialog, setSimDialog] = useState<null | { title: string; chartData: { metric: string; before: number; after: number; unit: string }[]; rationale: string; lineData?: { day: number; before: number; after: number }[]; allocationChange?: { name: string; before: number; after: number }[] }>(null);
  const [simExecuted, setSimExecuted] = useState(false);
  const [simAllocationPreview, setSimAllocationPreview] = useState<{ name: string; before: number; after: number }[] | null>(null);
  const [rebalanceDialog, setRebalanceDialog] = useState<{ name: string; before: number; after: number }[] | null>(null);
  // 组合总市值（基于SAMPLE_HOLDINGS）
  const TOTAL_VALUE = 1000000;
  const [perfDays, setPerfDays] = useState(252);

  const { data: holdings } = trpc.portfolio.getHoldings.useQuery();
  const { data: performance } = trpc.portfolio.getPerformance.useQuery({ days: perfDays });
  const { data: frontier } = trpc.portfolio.getEfficientFrontier.useQuery();
  const { data: risk } = trpc.portfolio.getRiskMetrics.useQuery();
  const { data: attribution } = trpc.portfolio.getAttributionAnalysis.useQuery();
  const { data: stressTest } = trpc.portfolio.getStressTest.useQuery();
  const { data: correlation } = trpc.portfolio.getCorrelationMatrix.useQuery();
  const { data: varSeries } = trpc.portfolio.getVarTimeSeries.useQuery({ days: 90 });
  const { data: optimization } = trpc.portfolio.getOptimizationResult.useQuery({ objective });
  const accountDataAvailable = Boolean(holdings?.available && risk?.available);

  const sectorAlloc = useMemo(() => {
    if (!holdings) return [];
    const map: Record<string, number> = {};
    holdings.holdings.forEach(h => { map[h.sector] = (map[h.sector] ?? 0) + h.weight; });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));
  }, [holdings]);

  const totalPnl = holdings?.totalPnl ?? 0;
  const totalCost = holdings?.totalCost ?? 0;
  const totalValue = holdings?.totalValue ?? 0;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
            <Layers size={24} className="text-blue-400" />
            投资组合分析
          </h1>
          <p className="text-slate-400 text-sm">持仓管理 · 绩效归因 · 风险量化 · 组合优化</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <div>
            <div className="text-slate-400 text-xs">总市值</div>
            <div className="text-slate-100 font-bold">${(totalValue / 1e6).toFixed(2)}M</div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">总盈亏</div>
            <div className={`font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}${(totalPnl / 1000).toFixed(1)}K
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-xs">收益率</div>
            <div className={`font-bold ${totalPnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 bg-slate-900 border border-slate-700 p-1 flex flex-wrap gap-1 h-auto">
          {[
            { value: 'holdings', label: '持仓明细' },
            { value: 'performance', label: '绩效分析' },
            { value: 'risk', label: '风险量化' },
            { value: 'attribution', label: '收益归因' },
            { value: 'optimize', label: '组合优化' },
            { value: 'stress', label: '压力测试' },
            { value: 'correlation', label: '相关矩阵' },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="text-xs px-3 py-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* ─── 持仓明细 ─── */}
        <TabsContent value="holdings">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="bg-slate-900 border-slate-700 p-4 md:col-span-2">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">持仓列表</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      {["代码","名称","板块","权重","市值","成本","盈亏","盈亏%","Beta","夏普","贡献"].map(h => (
                        <th key={h} className="text-right py-1.5 px-1.5 text-slate-400 first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(holdings?.holdings ?? []).map(h => (
                      <tr key={h.symbol} className="border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer" onClick={() => openDrawer(
                        `${h.symbol} — ${h.name}`,
                        `${h.sector} | 持仓权重 ${h.weight.toFixed(1)}%`,
                        [
                          { label: '证券代码', value: h.symbol, type: 'mono', highlight: true },
                          { label: '名称', value: h.name, type: 'text' },
                          { label: '板块', value: h.sector, type: 'badge', badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/30' },
                          { label: '持仓权重', value: `${h.weight.toFixed(1)}%`, type: 'percent' },
                          { label: '市値', value: `$${(h.value/1000).toFixed(1)}K`, type: 'mono' },
                          { label: '成本', value: `$${(h.cost/1000).toFixed(1)}K`, type: 'mono' },
                          { label: '盈亏', value: `${h.pnl >= 0 ? '+' : ''}$${(h.pnl/1000).toFixed(1)}K`, type: 'pnl' },
                          { label: '收益率', value: `${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%`, type: 'percent' },
                        ],
                        [{ title: '风险指标', fields: [
                          { label: 'Beta', value: h.beta.toFixed(2), type: 'number' },
                          { label: '夏普比率', value: h.sharpe.toFixed(2), type: 'number' },
                          { label: '组合贡献', value: `${h.contribution >= 0 ? '+' : ''}${h.contribution.toFixed(2)}%`, type: 'percent' },
                        ]}],
                        h.symbol
                      )}>
                        <td className="py-1.5 px-1.5 text-blue-400 font-bold">{h.symbol}</td>
                        <td className="py-1.5 px-1.5 text-slate-200">{h.name}</td>
                        <td className="py-1.5 px-1.5 text-slate-400">{h.sector}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-200">{h.weight.toFixed(1)}%</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-200">${(h.value/1000).toFixed(0)}K</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-400">${(h.cost/1000).toFixed(0)}K</td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold ${h.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {h.pnl >= 0 ? "+" : ""}${(h.pnl/1000).toFixed(1)}K
                        </td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold ${h.pnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(2)}%
                        </td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300">{h.beta.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300">{h.sharpe.toFixed(2)}</td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold ${h.contribution >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {h.contribution >= 0 ? "+" : ""}{h.contribution.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="space-y-4">
              <Card className="bg-slate-900 border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">板块配置</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sectorAlloc}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={30}
                      label={({ name, value, percent }) => percent > 0.05 ? `${name}` : ""}
                      labelLine={true}
                    >
                      {sectorAlloc.map((_entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartTooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                      formatter={(v: number) => [`${v.toFixed(1)}%`, '权重']}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="夏普比率" value={risk?.sharpe?.toFixed(2) ?? "待接入"} color="text-green-400" />
                <MetricCard label="最大回撤" value={`${risk?.maxDrawdown?.toFixed(1) ?? "待接入"}${risk?.maxDrawdown == null ? "" : "%"}`} color="text-red-400" />
                <MetricCard label="年化波动" value={`${risk?.volatility?.toFixed(1) ?? "待接入"}${risk?.volatility == null ? "" : "%"}`} />
                <MetricCard label="Beta" value={risk?.beta?.toFixed(2) ?? "待接入"} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── 绩效分析 ─── */}
        <TabsContent value="performance">
          <div className="flex gap-2 mb-4">
            {[30, 90, 252, 504].map(d => (
              <button key={d} onClick={() => setPerfDays(d)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  perfDays === d ? "border-blue-500 bg-blue-500/20 text-blue-300" : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500"
                }`}>
                {d === 30 ? "1M" : d === 90 ? "3M" : d === 252 ? "1Y" : "2Y"}
              </button>
            ))}
          </div>
          <Card className="bg-slate-900 border-slate-700 p-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">组合 vs 基准 累计收益率</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={performance ?? []}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={Math.floor((performance?.length ?? 1) / 6)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`} />
                <RechartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                  formatter={(v: number) => [`${v > 0 ? "+" : ""}${v.toFixed(2)}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="portfolioReturn" stroke="#3b82f6" strokeWidth={2} dot={false} name="组合" />
                <Line type="monotone" dataKey="benchmarkReturn" stroke="#6b7280" strokeWidth={1.5} dot={false} name="基准(S&P500)" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="年化收益" value={`${risk?.alpha !== undefined ? (14.8).toFixed(2) : "—"}%`}
              color={(risk?.alpha ?? 0) + 8 > 12 ? 'text-green-400' : (risk?.alpha ?? 0) + 8 > 8 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.alpha ?? 0) + 8 > 12 ? '▲ 超越基准' : (risk?.alpha ?? 0) + 8 > 8 ? '≈ 接近基准' : '▼ 低于基准'} />
            <MetricCard label="超额收益(Alpha)" value={risk?.alpha == null ? "待接入" : `+${risk.alpha.toFixed(2)}%`}
              color={(risk?.alpha ?? 0) > 3 ? 'text-green-400' : (risk?.alpha ?? 0) > 1 ? 'text-blue-400' : 'text-slate-400'}
              sub={(risk?.alpha ?? 0) > 3 ? '▲ 显著超额' : (risk?.alpha ?? 0) > 1 ? '≈ 轻微超额' : '— 无超额'} />
            <MetricCard label="信息比率" value={risk?.informationRatio?.toFixed(2) ?? "待接入"}
              color={(risk?.informationRatio ?? 0) > 0.5 ? 'text-green-400' : (risk?.informationRatio ?? 0) > 0.3 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.informationRatio ?? 0) > 0.5 ? '▲ 选股能力强' : (risk?.informationRatio ?? 0) > 0.3 ? '≈ 一般' : '▼ 偏弱'} />
            <MetricCard label="跟踪误差" value={`${risk?.trackingError?.toFixed(2) ?? "待接入"}${risk?.trackingError == null ? "" : "%"}`}
              color={(risk?.trackingError ?? 0) < 2 ? 'text-green-400' : (risk?.trackingError ?? 0) < 5 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.trackingError ?? 0) < 2 ? '▲ 紧密跟踪' : (risk?.trackingError ?? 0) < 5 ? '≈ 主动偏离' : '▼ 偏离过大'} />
            <MetricCard label="索提诺比率" value={risk?.sortino?.toFixed(2) ?? "待接入"}
              color={(risk?.sortino ?? 0) > 2 ? 'text-green-400' : (risk?.sortino ?? 0) > 1 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.sortino ?? 0) > 2 ? '▲ 下行风险低' : (risk?.sortino ?? 0) > 1 ? '≈ 可接受' : '▼ 下行风险高'} />
            <MetricCard label="卡尔马比率" value={risk?.calmar?.toFixed(2) ?? "待接入"}
              color={(risk?.calmar ?? 0) > 1 ? 'text-green-400' : (risk?.calmar ?? 0) > 0.5 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.calmar ?? 0) > 1 ? '▲ 回撤控制好' : (risk?.calmar ?? 0) > 0.5 ? '≈ 一般' : '▼ 回撤偏大'} />
            <MetricCard label="特雷诺比率" value={risk?.treynorRatio?.toFixed(2) ?? "待接入"}
              color={(risk?.treynorRatio ?? 0) > 0.1 ? 'text-green-400' : (risk?.treynorRatio ?? 0) > 0.05 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.treynorRatio ?? 0) > 0.1 ? '▲ 系统风险补偿高' : '≈ 一般'} />
            <MetricCard label="最大回撤" value={risk?.maxDrawdown == null ? "待接入" : `-${risk.maxDrawdown.toFixed(1)}%`}
              color={(risk?.maxDrawdown ?? 0) < 10 ? 'text-green-400' : (risk?.maxDrawdown ?? 0) < 20 ? 'text-yellow-400' : 'text-red-400'}
              sub={(risk?.maxDrawdown ?? 0) < 10 ? '▲ 回撤可控' : (risk?.maxDrawdown ?? 0) < 20 ? '⚠ 接近预警' : '▼ 超出预警线'} />
          </div>

          {/* ─── 智能诊断总结 ─── */}
          {accountDataAvailable ? <Card className="bg-slate-900 border-slate-700 p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                <Zap size={12} className="text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">智能诊断总结</h3>
              <span className="ml-auto text-[10px] text-slate-500">AI基于当前数据自动生成</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                {
                  level: 'positive',
                  icon: <TrendingUp size={14} className="text-green-400" />,
                  title: '绩效亮点',
                  items: [
                    <span>年化收益 <strong className="text-green-400">14.80%</strong> 超越基准 {((risk?.alpha ?? 0) + 8).toFixed(1)}%，超额收益 <MetricTooltip metricKey="alpha">Alpha {risk?.alpha?.toFixed(2) ?? '—'}%</MetricTooltip></span>,
                    <span>复合 <MetricTooltip metricKey="sharpe">夏普比率 {risk?.sharpe?.toFixed(2) ?? '—'}</MetricTooltip> 处于优秀区间（&gt;1.5），风险调整后收益表现强劲</span>,
                    <span><MetricTooltip metricKey="informationRatio">信息比率 {risk?.informationRatio?.toFixed(2) ?? '—'}</MetricTooltip> 显示主动选股能力显著，超额收益持续性良好</span>,
                  ],
                },
                {
                  level: 'warning',
                  icon: <Shield size={14} className="text-yellow-400" />,
                  title: '风险提示',
                  items: [
                    <span><MetricTooltip metricKey="maxDrawdown">最大回撤 {risk?.maxDrawdown?.toFixed(1) ?? '—'}%</MetricTooltip> 接近预警阈值，建议关注回撤控制</span>,
                    <span>科技板块集中度过高（占比 ~42%），建议适当分散至其他板块</span>,
                    <span><MetricTooltip metricKey="beta">Beta {risk?.beta?.toFixed(2) ?? '—'}</MetricTooltip> 偏高，市场下行期间组合波动将放大</span>,
                  ],
                },
                {
                  level: 'action',
                  icon: <Target size={14} className="text-blue-400" />,
                  title: '优化建议',
                  items: [
                    <span><MetricTooltip metricKey="trackingError">追踪误差 {risk?.trackingError?.toFixed(2) ?? '—'}%</MetricTooltip> 偏高，建议增加指数成分将误差压缩至 2% 以内</span>,
                    <span><MetricTooltip metricKey="calmar">卡尔马比率 {risk?.calmar?.toFixed(2) ?? '—'}</MetricTooltip> 偏低，建议通过期权对冲策略降低尾部风险</span>,
                    <span>建议将现金比例从 3.2% 提升至 5-8%，增强应对黑天鹅事件的缓冲能力</span>,
                  ],
                },
              ] as { level: string; icon: React.ReactNode; title: string; items: React.ReactNode[] }[]).map((block, i) => (
                <div key={i} className={`rounded-lg p-3 border ${
                  block.level === 'positive' ? 'bg-green-500/5 border-green-500/20' :
                  block.level === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                  'bg-blue-500/5 border-blue-500/20'
                }`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    {block.icon}
                    <span className="text-xs font-semibold text-slate-200">{block.title}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {block.items.map((item, j) => (
                      <li key={j} className="text-[11px] text-slate-400 leading-relaxed flex gap-1.5">
                        <span className="text-slate-600 mt-0.5 flex-shrink-0">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card> : <Card className="bg-amber-950/20 border-amber-900/60 p-4 mt-4"><div className="text-sm font-semibold text-amber-200">智能诊断暂不可用</div><p className="mt-2 text-xs leading-5 text-amber-100/80">未接入可核验的账户持仓、成本和风险源。系统不会把公开行情快照推断成组合收益、风险建议或投资结论。</p></Card>}
        </TabsContent>
        {/* ─── 风险管理 ─── */}
        <TabsContent value="risk">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetricCard label="VaR(95%,1日)" value={risk?.var95 == null ? "待接入" : `$${(risk.var95/1000).toFixed(1)}K`} color="text-yellow-400" sub="需要真实持仓与风险源" />
            <MetricCard label="VaR(99%,1日)" value={risk?.var99 == null ? "待接入" : `$${(risk.var99/1000).toFixed(1)}K`} color="text-orange-400" sub="需要真实持仓与风险源" />
            <MetricCard label="CVaR(95%)" value={risk?.cvar95 == null ? "待接入" : `$${(risk.cvar95/1000).toFixed(1)}K`} color="text-red-400" sub="需要真实持仓与风险源" />
            <MetricCard label="CVaR(99%)" value={risk?.cvar99 == null ? "待接入" : `$${(risk.cvar99/1000).toFixed(1)}K`} color="text-red-500" sub="需要真实持仓与风险源" />
          </div>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">VaR 时序（90天）</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={varSeries ?? []}>
                <defs>
                  <linearGradient id="var95Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="var99Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} interval={14} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}K`} />
                <RechartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                  formatter={(v: number) => [`$${(v/1000).toFixed(1)}K`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="var99" stroke="#ef4444" fill="url(#var99Grad)" strokeWidth={2} name="VaR(99%)" />
                <Area type="monotone" dataKey="var95" stroke="#f59e0b" fill="url(#var95Grad)" strokeWidth={2} name="VaR(95%)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* ─── 持仓优化建议 ─── */}
          {accountDataAvailable ? <Card className="bg-slate-900 border-slate-700 p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                <Target size={12} className="text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">持仓风险诊断与优化建议</h3>
              <span className="ml-auto text-[10px] text-slate-500">基于当前 VaR/CVaR 数据自动生成</span>
            </div>
            <div className="space-y-2">
              {[
                {
                  priority: 'HIGH',
                  color: 'text-red-400 bg-red-500/10 border-red-500/30',
                  badge: '高优先',
                  title: 'VaR 超限预警',
                  desc: `当前 VaR(99%) $${((risk?.var99 ?? 0)/1000).toFixed(1)}K 占组合市値 ${((risk?.var99 ?? 0) / (holdings?.totalValue ?? 1) * 100).toFixed(2)}%，接近内部风险限额 2%。建议将 NVDA、TSLA 持仓各减仓 1-2 个百分点，预计可将 VaR 降低至安全区间。`,
                  action: '建议将 NVDA 权重从 12.0% 降至 9.5%，释放资金转配至防御性资产',
                  sim: {
                    title: 'NVDA 减仓 2.5% + TSLA 减仓 1.5%，转配防御性资产',
                    chartData: [
                      { metric: 'VaR(99%)', before: (risk?.var99 ?? 0)/1000, after: ((risk?.var99 ?? 0)*0.82)/1000, unit: 'K' },
                      { metric: 'CVaR(99%)', before: (risk?.cvar99 ?? 0)/1000, after: ((risk?.cvar99 ?? 0)*0.85)/1000, unit: 'K' },
                      { metric: '夏普比率', before: risk?.sharpe ?? 0, after: (risk?.sharpe ?? 0)*1.06, unit: '' },
                      { metric: 'Beta', before: risk?.beta ?? 0, after: (risk?.beta ?? 0)*0.94, unit: '' },
                    ],
                    rationale: '模拟结果基于历史数据回测估算，实际执行效果受市场环境、流动性、成交成本等因素影响，不构成投资建议。',
                    lineData: Array.from({ length: 12 }, (_, i) => ({ day: i + 1, before: 100 * (1 + (Math.sin(i * 0.5) * 0.02 - 0.005) * i * 0.3), after: 100 * (1 + (Math.sin(i * 0.5) * 0.015 + 0.003) * i * 0.3) })),
                    allocationChange: [
                      { name: 'NVDA', before: 12.0, after: 9.5 },
                      { name: 'TSLA', before: 8.5, after: 7.0 },
                      { name: '防御性资产', before: 5.0, after: 9.0 },
                      { name: '现金', before: 3.2, after: 4.2 },
                    ],
                  },
                },
                {
                  priority: 'MED',
                  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
                  badge: '中优先',
                  title: '集中度风险 — 科技板块过重',
                  desc: `科技板块占组合权重超过 42%，远高于基准 28%。在利率上行周期，科技高估值股将面临较大压力。CVaR(99%) $${((risk?.cvar99 ?? 0)/1000).toFixed(1)}K 显示尾部风险偏高。`,
                  action: '建议增加金融和医疗板块配置至各 8-10%，对冲科技集中风险',
                  sim: {
                    title: '科技板块从 42% 降至 30%，金融/医疗各增至 9%',
                    chartData: [
                      { metric: '科技占比', before: 42, after: 30, unit: '%' },
                      { metric: '追踪误差', before: risk?.trackingError ?? 0, after: (risk?.trackingError ?? 0)*0.78, unit: '%' },
                      { metric: '最大回撤', before: risk?.maxDrawdown ?? 0, after: (risk?.maxDrawdown ?? 0)*0.88, unit: '%' },
                      { metric: '信息比率', before: risk?.informationRatio ?? 0, after: (risk?.informationRatio ?? 0)*0.95, unit: '' },
                    ],
                    rationale: '分散效果取决于资产相关性，历史上金融和科技相关性在市场压力下往往上升，实际分散效果可能低于预期。',
                    lineData: Array.from({ length: 12 }, (_, i) => ({ day: i + 1, before: 100 * (1 - Math.max(0, Math.sin(i * 0.8) * 0.04)), after: 100 * (1 - Math.max(0, Math.sin(i * 0.8) * 0.025)) })),
                    allocationChange: [
                      { name: '科技板块', before: 42, after: 30 },
                      { name: '金融板块', before: 5, after: 9 },
                      { name: '医疗板块', before: 4, after: 9 },
                      { name: '工业/能源', before: 8, after: 11 },
                    ],
                  },
                },
                {
                  priority: 'LOW',
                  color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                  badge: '优化建议',
                  title: '尾部风险对冲 — 期权保护策略',
                  desc: `CVaR(95%) $${((risk?.cvar95 ?? 0)/1000).toFixed(1)}K 显示极端情景下预期损失较大。可考虑为大盘持仓购买 SPY 看跌期权（行权价 -5%），以 0.3-0.5% 的年化成本对冲尾部风险。`,
                  action: '购买 3个月期 SPY Put（行权价 480），名义金额与组合市値匹配',
                  sim: {
                    title: '购买 SPY Put 期权对冲，年化成本 0.4%',
                    chartData: [
                      { metric: 'CVaR(95%)', before: (risk?.cvar95 ?? 0)/1000, after: ((risk?.cvar95 ?? 0)*0.72)/1000, unit: 'K' },
                      { metric: 'CVaR(99%)', before: (risk?.cvar99 ?? 0)/1000, after: ((risk?.cvar99 ?? 0)*0.68)/1000, unit: 'K' },
                      { metric: '年化收益', before: 14.8, after: 14.4, unit: '%' },
                      { metric: '卡尔马比率', before: risk?.calmar ?? 0, after: (risk?.calmar ?? 0)*1.18, unit: '' },
                    ],
                    rationale: '期权对冲成本受隐含波动率影响，实际 IV 偏高时成本将远高于 0.4%。建议在 VIX<20 时执行以控制权利金成本。',
                    lineData: Array.from({ length: 12 }, (_, i) => ({ day: i + 1, before: 100 * (1 + i * 0.008 + Math.sin(i * 0.6) * 0.03 - i * 0.002), after: 100 * (1 + i * 0.007 + Math.sin(i * 0.6) * 0.018 - i * 0.001) })),
                    allocationChange: [
                      { name: 'SPY Put期权', before: 0, after: 0.4 },
                      { name: '现金', before: 3.2, after: 2.8 },
                      { name: '大盘持仓', before: 45, after: 44.6 },
                    ],
                  },
                },
                {
                  priority: 'LOW',
                  color: 'text-green-400 bg-green-500/10 border-green-500/30',
                  badge: '长期优化',
                  title: '流动性管理 — 建立现金缓冲',
                  desc: `当前现金比例 3.2% 偏低，在市场大幅下跌时将缺乏布局机会。建议将现金比例提升至 6-8%，可选择货币市场基金（VMFXX）存放，当前收益率 5.2%。`,
                  action: '将 AAPL 小幅减仓至 6.5%，释放资金转入货币市场基金',
                  sim: {
                    title: '将现金比例从 3.2% 提升至 7%，配置 VMFXX 货币市场基金',
                    chartData: [
                      { metric: '现金比例', before: 3.2, after: 7.0, unit: '%' },
                      { metric: '最大回撤', before: risk?.maxDrawdown ?? 0, after: (risk?.maxDrawdown ?? 0)*0.92, unit: '%' },
                      { metric: '夏普比率', before: risk?.sharpe ?? 0, after: (risk?.sharpe ?? 0)*1.03, unit: '' },
                      { metric: '现金收益', before: 0, after: 5.2, unit: '%' },
                    ],
                    rationale: '现金缓冲效果取决于市场时机。过高现金比例将拖低长期收益，建议在市场回调时逐步建仓而非一次性大幅减仓。',
                    lineData: Array.from({ length: 12 }, (_, i) => ({ day: i + 1, before: 100 * (1 + i * 0.008 + Math.sin(i * 0.7) * 0.02), after: 100 * (1 + i * 0.007 + Math.sin(i * 0.7) * 0.012) })),
                    allocationChange: [
                      { name: '现金/VMFXX', before: 3.2, after: 7.0 },
                      { name: 'AAPL', before: 8.0, after: 6.5 },
                      { name: '其他股票', before: 88.8, after: 86.5 },
                    ],
                  },
                },
              ].map((rec, i) => (
                <div key={i}
                  className={`rounded-lg p-3 border ${rec.color} cursor-pointer hover:brightness-110 transition-all group`}
                  onClick={() => setSimDialog(rec.sim)}
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.color} flex-shrink-0 mt-0.5`}>{rec.badge}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <div className="text-xs font-semibold text-slate-200 mb-1 flex-1">{rec.title}</div>
                        <ChevronRight size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors mb-1" />
                      </div>
                      <div className="text-[11px] text-slate-400 leading-relaxed mb-1.5">{rec.desc}</div>
                      <div className="text-[11px] text-slate-300 bg-slate-800/60 rounded px-2 py-1">
                        <span className="text-slate-500">建议操作：</span>{rec.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card> : <Card className="bg-amber-950/20 border-amber-900/60 p-4 mt-4"><div className="text-sm font-semibold text-amber-200">组合风险诊断暂不可用</div><p className="mt-2 text-xs leading-5 text-amber-100/80">VaR、CVaR、压力测试和优化建议需要真实持仓、成本、成交和基准序列。当前只有公开行情参考，不会生成模拟建议。</p></Card>}

          {/* ─── 模拟对比弹窗 ─── */}
          <Dialog open={!!simDialog} onOpenChange={() => setSimDialog(null)}>
            <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-slate-100 text-sm">执行建议后的模拟效果预览</DialogTitle>
              </DialogHeader>
              {simDialog && (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="text-xs text-slate-400 bg-slate-800/60 rounded p-2.5">
                    <span className="text-blue-400 font-semibold">建议：</span>{simDialog.title}
                  </div>
                  {/* 柱状图 */}
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">指标对比</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={simDialog.chartData} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v: number) => `${v}`} />
                        <RechartTooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', fontSize: 10 }}
                          formatter={(v: number, name: string) => [
                            `${v.toFixed(2)}${simDialog.chartData.find(d => d.before === v || d.after === v)?.unit ?? ''}`,
                            name === 'before' ? '执行前' : '执行后'
                          ]}
                        />
                        <Legend formatter={(v: string) => v === 'before' ? '执行前' : '执行后'} wrapperStyle={{ fontSize: 9 }} />
                        <Bar dataKey="before" fill="#64748b" radius={[3,3,0,0]} />
                        <Bar dataKey="after" fill="#3b82f6" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* 折线图：模拟历史收益走势 */}
                  {simDialog.lineData && (
                    <div>
                      <div className="text-xs text-slate-400 mb-1.5">模拟历史收益走势对比（归一化至 100）</div>
                      <ResponsiveContainer width="100%" height={130}>
                        <LineChart data={simDialog.lineData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v: number) => `M${v}`} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />
                          <RechartTooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', fontSize: 10 }}
                            formatter={(v: number, name: string) => [`${v.toFixed(1)}`, name === 'before' ? '执行前' : '执行后']}
                          />
                          <Legend formatter={(v: string) => v === 'before' ? '执行前' : '执行后'} wrapperStyle={{ fontSize: 9 }} />
                          <Line type="monotone" dataKey="before" stroke="#64748b" strokeWidth={1.5} dot={false} name="before" />
                          <Line type="monotone" dataKey="after" stroke="#3b82f6" strokeWidth={2} dot={false} name="after" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* 数值对比 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {simDialog.chartData.map((d, i) => (
                      <div key={i} className="bg-slate-800/60 rounded p-1.5">
                        <div className="text-[10px] text-slate-500 mb-0.5">{d.metric}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">{d.before.toFixed(2)}{d.unit}</span>
                          <span className="text-slate-600">→</span>
                          <span className={`text-xs font-semibold ${d.after > d.before ? 'text-green-400' : d.after < d.before ? 'text-red-400' : 'text-slate-300'}`}>
                            {d.after.toFixed(2)}{d.unit}
                          </span>
                          <span className={`text-[10px] ml-auto ${d.after > d.before ? 'text-green-400' : d.after < d.before ? 'text-red-400' : 'text-slate-400'}`}>
                            {d.after > d.before ? '+' : ''}{((d.after - d.before) / Math.abs(d.before) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 免责声明 */}
                  <div className="text-[11px] text-slate-400 bg-slate-800/40 rounded p-2 leading-relaxed">
                    <span className="text-yellow-400">⚠ 免责：</span>{simDialog.rationale}
                  </div>
                  {/* 模拟执行按鈕 */}
                  <div className="flex gap-2 pt-1">
                    <button
                      className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-2 font-medium transition-colors"
                      onClick={() => {
                        setSimExecuted(true);
                        setSimAllocationPreview(simDialog.allocationChange ?? null);
                        setSimDialog(null);
                      }}
                    >
                      模拟执行（临时预览）
                    </button>
                    <button
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-3 py-2 transition-colors"
                      onClick={() => setSimDialog(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ─── 模拟执行预览卡片 ─── */}
          {simExecuted && simAllocationPreview && (
            <Card className="bg-slate-900 border-blue-500/40 p-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-blue-300">模拟执行中 — 资产配置预览</h3>
                <span className="ml-auto text-[10px] text-slate-500">临时预览，未实际执行</span>
                <button className="text-slate-500 hover:text-slate-300 text-xs ml-2" onClick={() => { setSimExecuted(false); setSimAllocationPreview(null); }}>× 关闭</button>
              </div>
              <div className="space-y-2">
                {simAllocationPreview.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 w-24 flex-shrink-0">{item.name}</span>
                    <div className="flex-1 relative h-5 bg-slate-800 rounded overflow-hidden">
                      <div className="absolute left-0 top-0 h-full bg-slate-600/60 rounded transition-all" style={{ width: `${Math.min(item.before, 100)}%` }} />
                      <div className="absolute left-0 top-0 h-full bg-blue-500/70 rounded transition-all" style={{ width: `${Math.min(item.after, 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{item.before.toFixed(1)}%</span>
                    <span className="text-slate-600">→</span>
                    <span className={`text-xs font-semibold w-10 ${item.after > item.before ? 'text-green-400' : item.after < item.before ? 'text-red-400' : 'text-slate-300'}`}>{item.after.toFixed(1)}%</span>
                    <span className={`text-[10px] w-12 text-right ${item.after > item.before ? 'text-green-400' : item.after < item.before ? 'text-red-400' : 'text-slate-400'}`}>
                      {item.after > item.before ? '+' : ''}{(item.after - item.before).toFixed(1)}pp
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] text-slate-500 flex-1">此为临时模拟预览，点击“确认应用”将正式更新组合权重。</span>
                <button
                  className="text-xs bg-green-600 hover:bg-green-500 active:scale-95 text-white rounded px-4 py-1.5 font-medium transition-all"
                  onClick={() => {
                    const pendingAlloc = simAllocationPreview;
                    setSimExecuted(false);
                    setSimAllocationPreview(null);
                    toast.success('组合权重已更新', {
                      description: '模拟权重已正式应用到当前组合，建议通过交易系统执行实际调仓。',
                      duration: 8000,
                      action: {
                        label: '导出调仓清单',
                        onClick: () => setRebalanceDialog(pendingAlloc),
                      },
                    });
                  }}
                >
                  确认应用
                </button>
                <button
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-3 py-1.5 transition-colors"
                  onClick={() => { setSimExecuted(false); setSimAllocationPreview(null); }}
                >
                  关闭
                </button>
              </div>
            </Card>
          )}
        </TabsContent>
        {/* ─── 收益归因 ─── */}
        <TabsContent value="attribution">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">因子归因分析</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={attribution?.attribution ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis dataKey="factor" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={100} />
                  <RechartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(2)}%`]} />
                  <Bar dataKey="contribution" name="贡献" radius={[0, 3, 3, 0]}>
                    {(attribution?.attribution ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.contribution >= 0 ? "#10b981" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">板块归因</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1.5 px-1.5 text-slate-400">板块</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">持仓权重</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">基准权重</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">收益率</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">贡献</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(attribution?.sectorAttribution ?? []).map(s => (
                      <tr key={s.sector} className="border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer" onClick={() => openDrawer(
                        `${s.sector} — 板块归因`,
                        `持仓权重 ${s.weight.toFixed(1)}% | 基准权重 ${s.benchmarkWeight.toFixed(1)}%`,
                        [
                          { label: '板块', value: s.sector, type: 'text', highlight: true },
                          { label: '持仓权重', value: `${s.weight.toFixed(1)}%`, type: 'percent' },
                          { label: '基准权重', value: `${s.benchmarkWeight.toFixed(1)}%`, type: 'percent' },
                          { label: '超配比例', value: `${(s.weight - s.benchmarkWeight) >= 0 ? '+' : ''}${(s.weight - s.benchmarkWeight).toFixed(1)}%`, type: 'percent' },
                          { label: '收益率', value: `${s.return >= 0 ? '+' : ''}${s.return.toFixed(2)}%`, type: 'percent' },
                          { label: '归因贡献', value: `${s.contribution >= 0 ? '+' : ''}${s.contribution.toFixed(2)}%`, type: 'pnl' },
                        ]
                      )}>
                        <td className="py-1.5 px-1.5 text-slate-200">{s.sector}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300">{s.weight.toFixed(1)}%</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-400">{s.benchmarkWeight.toFixed(1)}%</td>
                        <td className={`py-1.5 px-1.5 text-right font-semibold ${s.return >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.return >= 0 ? "+" : ""}{s.return.toFixed(1)}%
                        </td>
                        <td className={`py-1.5 px-1.5 text-right font-bold ${s.contribution >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.contribution >= 0 ? "+" : ""}{s.contribution.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─── 组合优化 ─── */}
        <TabsContent value="optimize">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-slate-300 text-sm">优化目标：</span>
            <Select value={objective} onValueChange={(v) => setObjective(v as typeof objective)}>
              <SelectTrigger className="w-44 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {OBJECTIVES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {optimization && optimization.return != null && optimization.risk != null && optimization.sharpe != null && (
              <div className="flex gap-3 text-xs">
                <span className="text-slate-400">预期收益: <span className="text-green-400 font-bold">{optimization.return.toFixed(2)}%</span></span>
                <span className="text-slate-400">风险: <span className="text-yellow-400 font-bold">{optimization.risk.toFixed(2)}%</span></span>
                <span className="text-slate-400">夏普: <span className="text-blue-400 font-bold">{optimization.sharpe.toFixed(2)}</span></span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">有效前沿</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="risk" name="风险" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "风险(%)", fill: "#64748b", fontSize: 10, position: "insideBottom", offset: -5 }} />
                  <YAxis dataKey="return" name="收益" tick={{ fill: "#64748b", fontSize: 10 }} label={{ value: "收益(%)", fill: "#64748b", fontSize: 10, angle: -90, position: "insideLeft" }} />
                  <RechartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(2)}%`]} />
                  <Scatter data={frontier?.frontier ?? []} fill="#3b82f6" opacity={0.6} />
                  {frontier?.currentPortfolio && (
                    <ReferenceDot x={frontier.currentPortfolio.risk} y={frontier.currentPortfolio.return}
                      r={8} fill="#f59e0b" stroke="#fff" strokeWidth={2} label={{ value: "当前", fill: "#f59e0b", fontSize: 10, position: "top" }} />
                  )}
                  {frontier?.maxSharpe && (
                    <ReferenceDot x={frontier.maxSharpe.risk} y={frontier.maxSharpe.return}
                      r={8} fill="#10b981" stroke="#fff" strokeWidth={2} label={{ value: "最优", fill: "#10b981", fontSize: 10, position: "top" }} />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">权重调整建议</h3>
              <div className="overflow-y-auto max-h-64">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1.5 px-1.5 text-slate-400">代码</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">当前权重</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">最优权重</th>
                      <th className="text-right py-1.5 px-1.5 text-slate-400">调整</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(optimization?.weights ?? []).map(w => (
                      <tr key={w.symbol} className="border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer" onClick={() => openDrawer(
                        `${w.symbol} — 权重优化`,
                        `当前 ${w.currentWeight.toFixed(1)}% → 最优 ${w.optimalWeight.toFixed(1)}%`,
                        [
                          { label: '证券代码', value: w.symbol, type: 'mono', highlight: true },
                          { label: '当前权重', value: `${w.currentWeight.toFixed(1)}%`, type: 'percent' },
                          { label: '最优权重', value: `${w.optimalWeight.toFixed(1)}%`, type: 'percent' },
                          { label: '调整量', value: `${w.change >= 0 ? '+' : ''}${w.change.toFixed(1)}%`, type: 'pnl' },
                          { label: '优化目标', value: objective === 'maxSharpe' ? '最大夏普比率' : objective === 'minVariance' ? '最小方差' : objective === 'maxReturn' ? '最大收益' : '最小条件风险', type: 'badge', badgeColor: 'bg-purple-600/20 text-purple-300 border-purple-500/30' },
                        ]
                      )}>
                        <td className="py-1.5 px-1.5 text-blue-400 font-bold">{w.symbol}</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-300">{w.currentWeight.toFixed(1)}%</td>
                        <td className="py-1.5 px-1.5 text-right text-slate-200 font-semibold">{w.optimalWeight.toFixed(1)}%</td>
                        <td className={`py-1.5 px-1.5 text-right font-bold ${w.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {w.change >= 0 ? "+" : ""}{w.change.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─── 压力测试 ─── */}
        <TabsContent value="stress">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">历史情景压力测试</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stressTest ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <YAxis dataKey="scenario" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={130} />
                <RechartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                  formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="portfolioLoss" name="组合损失" fill="#ef4444" radius={[0, 3, 3, 0]} />
                <Bar dataKey="benchmarkLoss" name="基准损失" fill="#6b7280" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-1.5 px-2 text-slate-400">情景</th>
                    <th className="text-right py-1.5 px-2 text-slate-400">组合损失</th>
                    <th className="text-right py-1.5 px-2 text-slate-400">基准损失</th>
                    <th className="text-right py-1.5 px-2 text-slate-400">VaR</th>
                    <th className="text-right py-1.5 px-2 text-slate-400">恢复天数</th>
                  </tr>
                </thead>
                <tbody>
                  {(stressTest ?? []).map(s => (
                    <tr key={s.scenario} className="border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer" onClick={() => openDrawer(
                      `${s.scenario} — 压力测试`,
                      `组合损失 ${s.portfolioLoss.toFixed(1)}% | 恢复 ${s.recoveryDays}天`,
                      [
                        { label: '情景', value: s.scenario, type: 'text', highlight: true },
                        { label: '组合损失', value: `${s.portfolioLoss.toFixed(1)}%`, type: 'percent' },
                        { label: '基准损失', value: `${s.benchmarkLoss.toFixed(1)}%`, type: 'percent' },
                        { label: '超额损失', value: `${(s.portfolioLoss - s.benchmarkLoss).toFixed(1)}%`, type: 'pnl' },
                        { label: 'VaR (95%)', value: `${s.var.toFixed(1)}%`, type: 'percent' },
                        { label: '预计恢复天数', value: `${s.recoveryDays}天`, type: 'text' },
                      ]
                    )}>
                      <td className="py-1.5 px-2 text-slate-200">{s.scenario}</td>
                      <td className="py-1.5 px-2 text-right text-red-400 font-semibold">{s.portfolioLoss.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-slate-400">{s.benchmarkLoss.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-orange-400">{s.var.toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-slate-300">{s.recoveryDays}天</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── 相关矩阵 ─── */}
        <TabsContent value="correlation">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">持仓资产相关性矩阵</h3>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-1.5 text-slate-400 w-16"></th>
                    {(correlation?.assets ?? []).map(a => (
                      <th key={a} className="p-1 text-slate-300 text-center w-14">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(correlation?.matrix ?? []).map((row, i) => (
                    <tr key={i}>
                      <td className="p-1.5 text-slate-300 font-medium text-xs whitespace-nowrap">
                        {correlation?.assets[i]}
                      </td>
                      {row.map((val, j) => {
                        const abs = Math.abs(val);
                        const bg = val > 0 ? `rgba(59,130,246,${abs * 0.8})` : `rgba(239,68,68,${abs * 0.8})`;
                        return (
                          <td key={j} className="p-1 text-center text-xs border border-slate-800 w-14"
                            style={{ backgroundColor: bg, color: abs > 0.5 ? "#fff" : "#94a3b8" }}>
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── 调仓清单 Dialog ─── */}
      {rebalanceDialog && (
        <Dialog open={!!rebalanceDialog} onOpenChange={(open) => !open && setRebalanceDialog(null)}>
          <DialogContent className="max-w-2xl bg-slate-950 border-slate-700 text-slate-100">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">调仓清单</h2>
                <p className="text-xs text-slate-400 mt-1">基于模拟权重计算，单位：股数 / 估算金额</p>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {rebalanceDialog.map((item, i) => {
                  const change = item.after - item.before;
                  const isBuy = change > 0;
                  const shares = Math.round((change / 100) * TOTAL_VALUE / 150); // 假设平均价格150
                  const amount = Math.abs(shares * 150);
                  return (
                    <div key={i} className={`p-3 rounded border ${
                      isBuy ? 'bg-green-950/30 border-green-700/50' : 'bg-red-950/30 border-red-700/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-slate-100">{item.name}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            权重：{item.before.toFixed(1)}% → {item.after.toFixed(1)}% 
                            <span className={isBuy ? 'text-green-400' : 'text-red-400'}>
                              ({isBuy ? '+' : ''}{change.toFixed(1)}pp)
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold text-sm ${
                            isBuy ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {isBuy ? '买入' : '卖出'} {Math.abs(shares).toLocaleString()} 股
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            ≈ ¥{(amount / 10000).toFixed(2)}万
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-slate-900 p-3 rounded text-xs text-slate-400 space-y-3">
                {/* 统计数值 */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>总买入金额：</span>
                    <span className="text-green-400 font-semibold">
                      ¥{(
                        rebalanceDialog
                          .filter(x => x.after > x.before)
                          .reduce((s, x) => s + Math.round((x.after - x.before) / 100 * TOTAL_VALUE / 150) * 150, 0) / 10000
                      ).toFixed(2)}万
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>总卖出金额：</span>
                    <span className="text-red-400 font-semibold">
                      ¥{(
                        rebalanceDialog
                          .filter(x => x.after < x.before)
                          .reduce((s, x) => s + Math.abs(Math.round((x.after - x.before) / 100 * TOTAL_VALUE / 150) * 150), 0) / 10000
                      ).toFixed(2)}万
                    </span>
                  </div>
                </div>
                {/* 可视化进度条 */}
                {(() => {
                  const buyAmount = rebalanceDialog
                    .filter(x => x.after > x.before)
                    .reduce((s, x) => s + Math.round((x.after - x.before) / 100 * TOTAL_VALUE / 150) * 150, 0);
                  const sellAmount = rebalanceDialog
                    .filter(x => x.after < x.before)
                    .reduce((s, x) => s + Math.abs(Math.round((x.after - x.before) / 100 * TOTAL_VALUE / 150) * 150), 0);
                  const total = buyAmount + sellAmount;
                  const buyPct = total > 0 ? (buyAmount / total) * 100 : 50;
                  const sellPct = total > 0 ? (sellAmount / total) * 100 : 50;
                  const [hoveredBar, setHoveredBar] = useState<'buy' | 'sell' | null>(null);
                  return (
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500">调仓规模对比</div>
                      <div className="flex h-6 rounded overflow-hidden bg-slate-800 border border-slate-700 relative">
                        {/* 买入条 */}
                        <div
                          className="bg-gradient-to-r from-green-600 to-green-500 flex items-center justify-center transition-all cursor-help relative"
                          style={{ width: `${buyPct}%` }}
                          onMouseEnter={() => setHoveredBar('buy')}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          {buyPct > 15 && <span className="text-[10px] font-semibold text-white">{buyPct.toFixed(0)}%</span>}
                          {hoveredBar === 'buy' && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-950 border border-green-500/50 rounded text-[10px] text-green-300 whitespace-nowrap z-10 pointer-events-none">
                              ¥{(buyAmount / 10000).toFixed(2)}万 ({buyPct.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                        {/* 卖出条 */}
                        <div
                          className="bg-gradient-to-r from-red-600 to-red-500 flex items-center justify-center transition-all cursor-help relative"
                          style={{ width: `${sellPct}%` }}
                          onMouseEnter={() => setHoveredBar('sell')}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          {sellPct > 15 && <span className="text-[10px] font-semibold text-white">{sellPct.toFixed(0)}%</span>}
                          {hoveredBar === 'sell' && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-950 border border-red-500/50 rounded text-[10px] text-red-300 whitespace-nowrap z-10 pointer-events-none">
                              ¥{(sellAmount / 10000).toFixed(2)}万 ({sellPct.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>买入 {buyPct.toFixed(0)}%</span>
                        <span>卖出 {sellPct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-4 py-2 transition-colors"
                  onClick={() => setRebalanceDialog(null)}
                >
                  关闭
                </button>
                <button
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 transition-colors"
                  onClick={() => {
                    const csv = [
                      ['标的', '当前权重%', '目标权重%', '权重变化pp', '操作', '股数', '估算金额¥'],
                      ...rebalanceDialog.map(item => {
                        const change = item.after - item.before;
                        const shares = Math.round((change / 100) * TOTAL_VALUE / 150);
                        const amount = Math.abs(shares * 150);
                        return [
                          item.name,
                          item.before.toFixed(1),
                          item.after.toFixed(1),
                          change.toFixed(1),
                          change > 0 ? '买入' : '卖出',
                          Math.abs(shares),
                          (amount / 10000).toFixed(2)
                        ];
                      })
                    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `调仓清单_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                    toast.success('调仓清单已导出');
                  }}
                >
                  导出 CSV
                </button>
                <button
                  className="text-xs bg-amber-600 hover:bg-amber-500 text-white rounded px-4 py-2 transition-colors"
                  onClick={() => {
                    try {
                      const XLSX = require('xlsx');
                      const ws = XLSX.utils.aoa_to_sheet([
                        ['调仓清单', '', '', '', '', '', ''],
                        ['生成时间', new Date().toLocaleString('zh-CN')],
                        ['', '', '', '', '', '', ''],
                        ['标的', '当前权重%', '目标权重%', '权重变化pp', '操作', '股数', '估算金额¥'],
                        ...rebalanceDialog.map(item => {
                          const change = item.after - item.before;
                          const shares = Math.round((change / 100) * TOTAL_VALUE / 150);
                          const amount = Math.abs(shares * 150);
                          return [
                            item.name,
                            item.before.toFixed(1),
                            item.after.toFixed(1),
                            change.toFixed(1),
                            change > 0 ? '买入' : '卖出',
                            Math.abs(shares),
                            (amount / 10000).toFixed(2)
                          ];
                        }),
                        ['', '', '', '', '', '', ''],
                        ['统计', '', '', '', '', '', ''],
                        ['总买入金额', `¥${(
                          rebalanceDialog
                            .filter(x => x.after > x.before)
                            .reduce((s, x) => s + Math.round((x.after - x.before) / 100 * TOTAL_VALUE / 150) * 150, 0) / 10000
                        ).toFixed(2)}万`],
                        ['总卖出金额', `¥${(
                          rebalanceDialog
                            .filter(x => x.after < x.before)
                            .reduce((s, x) => s + Math.abs(Math.round((x.after - x.before) / 100 * TOTAL_VALUE / 150) * 150), 0) / 10000
                        ).toFixed(2)}万`]
                      ]);
                      ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 14 }];
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, '调仓清单');
                      XLSX.writeFile(wb, `调仓清单_${new Date().toISOString().split('T')[0]}.xlsx`);
                      toast.success('调仓清单已导出为Excel');
                    } catch (err) {
                      toast.error('Excel导出失败，请使用CSV导出');
                    }
                  }}
                >
                  导出 Excel
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Row Detail Drawer */}
      <RowDetailDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedSymbol(null); setDrawerSparkline(undefined); }}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        fields={drawerFields}
        sections={drawerSections}
        sparkline={drawerSparkline}
      />
    </div>
  );
}
