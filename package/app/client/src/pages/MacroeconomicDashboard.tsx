import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Globe, Calendar, Activity, DollarSign, Percent } from "lucide-react";
import BlsMacroReleaseEvidenceDesk from "@/components/macro/BlsMacroReleaseEvidenceDesk";
import ModuleLiveDeliveryTable from "@/components/ModuleLiveDeliveryTable";
import { useModuleLiveFeed } from "@/hooks/useModuleLiveFeed";

const COUNTRIES = ["美国", "中国", "欧元区", "日本", "英国", "德国", "印度", "巴西"];
const METRICS = [
  { key: "gdpGrowth", label: "GDP增速" },
  { key: "cpi", label: "CPI通胀" },
  { key: "unemployment", label: "失业率" },
  { key: "pmi", label: "制造业PMI" },
  { key: "rate", label: "政策利率" },
  { key: "debtGdp", label: "债务/GDP" },
];
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];
const QUERY_OPTIONS = { staleTime: 5 * 60_000, refetchInterval: 5 * 60_000, retry: false } as const;

function KpiCard({ label, value, unit, change, changeLabel }: {
  label: string; value: number | null; unit: string; change: number | null; changeLabel: string;
}) {
  const isAvailable = value !== null && Number.isFinite(value);
  const isPos = (change ?? 0) >= 0;
  return (
    <Card className="bg-slate-900 border-slate-700 p-4">
      <div className="text-slate-400 text-xs mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-100 mb-1">
        {isAvailable ? value.toFixed(2) : "—"}<span className="text-sm text-slate-400 ml-1">{unit}</span>
      </div>
      {change !== null && Number.isFinite(change) ? <div className={`text-xs flex items-center gap-1 ${isPos ? "text-green-400" : "text-red-400"}`}>
        {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{isPos ? "+" : ""}{change.toFixed(2)} {changeLabel}
      </div> : <div className="text-xs text-slate-500">未接入可验证变化</div>}
    </Card>
  );
}

function CorrelationCell({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <td className="p-1 text-center text-xs border border-slate-800 text-slate-600">—</td>;
  const abs = Math.abs(value);
  const bg = value > 0 ? `rgba(59,130,246,${abs * 0.8})` : `rgba(239,68,68,${abs * 0.8})`;
  return (
    <td className="p-1 text-center text-xs border border-slate-800" style={{ backgroundColor: bg, color: abs > 0.5 ? "#fff" : "#94a3b8" }}>
      {value.toFixed(2)}
    </td>
  );
}

export default function MacroeconomicDashboard() {
  const [selectedCountry, setSelectedCountry] = useState("美国");
  const [compareCountries, setCompareCountries] = useState<string[]>(["美国", "中国", "欧元区"]);
  const [compareMetric, setCompareMetric] = useState("gdpGrowth");
  const [tab, setTab] = useState("overview");

  const { data: indicators } = trpc.macro.getIndicators.useQuery({ country: selectedCountry }, QUERY_OPTIONS);
  const { data: gdpSeries } = trpc.macro.getGdpTimeSeries.useQuery({ country: selectedCountry, periods: 24 }, QUERY_OPTIONS);
  const { data: cpiSeries } = trpc.macro.getCpiTimeSeries.useQuery({ country: selectedCountry, periods: 24 }, QUERY_OPTIONS);
  const { data: pmiSeries } = trpc.macro.getPmiTimeSeries.useQuery({ country: selectedCountry, periods: 24 }, QUERY_OPTIONS);
  const { data: unemploymentSeries } = trpc.macro.getUnemploymentTimeSeries.useQuery({ country: selectedCountry, periods: 24 }, QUERY_OPTIONS);
  const { data: multiCountry } = trpc.macro.getMultiCountryComparison.useQuery({ metric: compareMetric, countries: compareCountries }, QUERY_OPTIONS);
  const { data: multiMetric } = trpc.macro.getMultiMetricComparison.useQuery({ countries: compareCountries }, QUERY_OPTIONS);
  const { data: correlation } = trpc.macro.getCorrelationMatrix.useQuery(undefined, QUERY_OPTIONS);
  const { data: calendar } = trpc.macro.getEconomicCalendar.useQuery(undefined, QUERY_OPTIONS);
  const { data: yieldCurves } = trpc.macro.getYieldCurveComparison.useQuery(undefined, QUERY_OPTIONS);
  const { data: fxRates } = trpc.macro.getFxRates.useQuery(undefined, QUERY_OPTIONS);
  const { data: centralBanks } = trpc.macro.getCentralBankRates.useQuery(undefined, QUERY_OPTIONS);
  const openBBDelivery = useModuleLiveFeed("/macro-dashboard", true);

  const toggleCountry = (c: string) => {
    setCompareCountries(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : prev.length < 5 ? [...prev, c] : prev
    );
  };

  const byDate = <T extends { date: string; value: number }>(series: T[] | undefined) => new Map((series ?? []).map(point => [point.date, point.value]));
  const cpiByDate = byDate(cpiSeries);
  const pmiByDate = byDate(pmiSeries as Array<{ date: string; value: number }> | undefined);
  const unemploymentByDate = byDate(unemploymentSeries);
  const mergedSeries = (gdpSeries ?? []).map(g => ({
    date: g.date.slice(0, 7),
    gdp: g.value,
    cpi: cpiByDate.get(g.date) ?? null,
    pmi: pmiByDate.get(g.date) ?? null,
    unemployment: unemploymentByDate.get(g.date) ?? null,
  }));

  const yieldCurveData = (yieldCurves?.tenors ?? []).map((tenor, i) => {
    const row: Record<string, string | number | null> = { tenor };
    Object.entries(yieldCurves?.curves ?? {}).forEach(([country, vals]) => {
      row[country] = (vals as Array<number | null>)[i] ?? null;
    });
    return row;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50 flex items-center gap-2">
            <Globe size={24} className="text-blue-400" />
            宏观经济仪表板
          </h1>
          <p className="text-slate-400 text-sm">全球经济指标实时监控与多维分析</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Activity size={12} className="animate-pulse" />
            5 分钟自动检查
          </div>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-36 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-4">
        <ModuleLiveDeliveryTable {...openBBDelivery} title="宏观经济数据投递与前端回执" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900 border border-slate-700 mb-4">
          <TabsTrigger value="overview" className="text-xs">经济概览</TabsTrigger>
          <TabsTrigger value="timeseries" className="text-xs">时序分析</TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">多国对比</TabsTrigger>
          <TabsTrigger value="yieldcurve" className="text-xs">收益率曲线</TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs">经济日历</TabsTrigger>
          <TabsTrigger value="correlation" className="text-xs">相关性矩阵</TabsTrigger>
          <TabsTrigger value="fx" className="text-xs">汇率与央行</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {(indicators?.indicators ?? []).slice(0, 10).map(ind => (
              <KpiCard key={ind.name} label={ind.name} value={ind.value} unit={ind.unit} change={ind.change} changeLabel={ind.changeLabel} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">GDP 规模趋势（万亿美元）</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mergedSeries.slice(-12)}>
                  <defs>
                    <linearGradient id="gdpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Area type="monotone" dataKey="gdp" stroke="#3b82f6" fill="url(#gdpGrad)" strokeWidth={2} name="GDP" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">CPI 通胀 vs PMI 制造业</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mergedSeries.slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="cpi" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPI%" />
                  <Line yAxisId="right" type="monotone" dataKey="pmi" stroke="#10b981" strokeWidth={2} dot={false} name="PMI" />
                  <ReferenceLine yAxisId="right" y={50} stroke="#6b7280" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeseries">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">GDP 规模（万亿美元）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={mergedSeries}>
                  <defs>
                    <linearGradient id="gdpGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Area type="monotone" dataKey="gdp" stroke="#3b82f6" fill="url(#gdpGrad2)" strokeWidth={2} name="GDP" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">CPI 通胀率（%）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={mergedSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Line type="monotone" dataKey="cpi" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPI%" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">失业率（%）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={mergedSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Line type="monotone" dataKey="unemployment" stroke="#ef4444" strokeWidth={2} dot={false} name="失业率%" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">制造业 PMI</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={mergedSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} domain={[40, 60]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 4" />
                  <Bar dataKey="pmi" name="PMI" radius={[2, 2, 0, 0]}>
                    {mergedSeries.map((entry, i) => (
                      <Cell key={i} fill={entry.pmi === null ? "#475569" : entry.pmi >= 50 ? "#10b981" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compare">
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={compareMetric} onValueChange={setCompareMetric}>
              <SelectTrigger className="w-40 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {METRICS.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1">
              {COUNTRIES.map((c, i) => (
                <button
                  key={c}
                  onClick={() => toggleCountry(c)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    compareCountries.includes(c)
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                {METRICS.find(m => m.key === compareMetric)?.label} — 横向对比
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={multiCountry ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis dataKey="country" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} name={METRICS.find(m => m.key === compareMetric)?.label}>
                    {(multiCountry ?? []).map((_entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">雷达图 — 多维经济体质</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={METRICS.map(m => {
                  const row: Record<string, string | number | null> = { metric: m.label };
                  compareCountries.forEach(c => {
                    const d = multiMetric?.find(x => x.country === c);
                    row[c] = d?.values[m.key as keyof typeof d.values] ?? null;
                  });
                  return row;
                })}>
                  <PolarGrid stroke="#1e293b" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 10 }} />
                  {compareCountries.map((c, i) => (
                    <Radar key={c} name={c} dataKey={c} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="yieldcurve">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">全球主权债收益率曲线对比</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={yieldCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="tenor" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: 11 }}
                  formatter={(v) => {
                    const numeric = typeof v === "number" ? v : Number(v);
                    return [Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : "—"];
                  }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(yieldCurves?.curves ?? {}).map((country, i) => (
                  <Line key={country} type="monotone" dataKey={country} stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-blue-400" />
              近期重要经济数据发布
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-400">日期</th>
                    <th className="text-left py-2 px-2 text-slate-400">国家</th>
                    <th className="text-left py-2 px-2 text-slate-400">事件</th>
                    <th className="text-right py-2 px-2 text-slate-400">实际值</th>
                    <th className="text-right py-2 px-2 text-slate-400">预测值</th>
                    <th className="text-right py-2 px-2 text-slate-400">前值</th>
                    <th className="text-center py-2 px-2 text-slate-400">影响</th>
                    <th className="text-center py-2 px-2 text-slate-400">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {(calendar ?? []).map((ev, i) => (
                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-2 px-2 text-slate-300">{ev.date}</td>
                      <td className="py-2 px-2 text-slate-200 font-medium">{ev.country}</td>
                      <td className="py-2 px-2 text-slate-100">{ev.event}</td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-100">
                        {ev.actual ?? <span className="text-slate-500">待公布</span>}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-300">{ev.forecast}</td>
                      <td className="py-2 px-2 text-right text-slate-400">{ev.previous}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          ev.impact === "high" ? "border-red-500 text-red-400" :
                          ev.impact === "medium" ? "border-yellow-500 text-yellow-400" :
                          "border-slate-500 text-slate-400"
                        }`}>
                          {ev.impact === "high" ? "高" : ev.impact === "medium" ? "中" : ev.impact === "low" ? "低" : "—"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {ev.surprise === "positive" ? <span className="text-green-400">↑超预期</span> :
                         ev.surprise === "negative" ? <span className="text-red-400">↓低预期</span> :
                         <span className="text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="correlation">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">宏观经济指标相关性矩阵</h3>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-slate-400"></th>
                    {(correlation?.indicators ?? []).map(ind => (
                      <th key={ind} className="p-1 text-slate-300 text-center whitespace-nowrap">{ind}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(correlation?.matrix ?? []).map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 text-slate-300 whitespace-nowrap font-medium">
                        {correlation?.indicators[i]}
                      </td>
                      {row.map((val, j) => <CorrelationCell key={j} value={val} />)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: "rgba(59,130,246,0.8)" }} />
                正相关
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-3 rounded" style={{ backgroundColor: "rgba(239,68,68,0.8)" }} />
                负相关
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="fx">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <DollarSign size={16} className="text-green-400" />
                主要汇率
              </h3>
              <div className="space-y-2">
                {(fxRates ?? []).map(fx => (
                  <div key={fx.pair} className="flex items-center justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-200 font-medium text-sm">{fx.pair}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-100 font-bold">{fx.rate === null ? "—" : fx.rate.toFixed(4)}</span>
                      <span className={`text-xs font-semibold ${fx.changePct !== null && fx.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {fx.changePct === null ? "—" : `${fx.changePct >= 0 ? "+" : ""}${fx.changePct.toFixed(3)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-slate-900 border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Percent size={16} className="text-blue-400" />
                全球央行政策利率
              </h3>
              <div className="space-y-2">
                {(centralBanks ?? []).map(cb => (
                  <div key={cb.bank} className="flex items-center justify-between py-1.5 border-b border-slate-800">
                    <div>
                      <div className="text-slate-200 text-sm font-medium">{cb.bank}</div>
                      <div className="text-slate-500 text-xs">下次会议: {cb.nextMeeting}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-slate-100">{cb.rate === null ? "—" : `${cb.rate.toFixed(2)}%`}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        cb.direction === "hike" ? "border-red-500 text-red-400" :
                        cb.direction === "cut" ? "border-green-500 text-green-400" :
                        "border-slate-500 text-slate-400"
                      }`}>
                        {cb.direction === "hike" ? "加息" : cb.direction === "cut" ? "降息" : "维持"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      <BlsMacroReleaseEvidenceDesk />
    </div>
  );
}
