/**
 * CurveChartModal — 收益率曲线交互式图表弹窗
 * Tab 1: 历史走势（多期限折线图）
 * Tab 2: 期限结构（最新截面面积图）
 * Tab 3: AI 分析（流式 LLM 市场趋势解读）
 *
 * 新增功能：
 * - 一键复制 AI 解读文本
 * - 导出为长图（html2canvas）
 * - 个性化偏好设置（专业术语 / 通俗易懂 / 投资策略侧重）
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, TrendingUp, BarChart2, Sparkles, X, RefreshCw,
  Copy, Download, Settings2, CheckCircle2, ChevronDown,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { DataLoadingSkeleton } from "@/components/ChartSkeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ReferenceLine,
} from "recharts";

// ─── 期限排序 & 颜色 ─────────────────────────────────────────────────────────
const MATURITY_ORDER: Record<string, number> = {
  "1M": 1, "3M": 2, "6M": 3, "1Y": 4, "2Y": 5, "3Y": 6,
  "5Y": 7, "7Y": 8, "10Y": 9, "20Y": 10, "30Y": 11,
};
const MATURITY_COLORS: Record<string, string> = {
  "1M": "#94a3b8", "3M": "#64748b", "6M": "#3b82f6", "1Y": "#06b6d4",
  "2Y": "#10b981", "3Y": "#84cc16", "5Y": "#f59e0b", "7Y": "#f97316",
  "10Y": "#ef4444", "20Y": "#ec4899", "30Y": "#8b5cf6",
};

// ─── 分析风格 ─────────────────────────────────────────────────────────────────
type AnalysisStyle = "professional" | "plain" | "strategy";
const STYLE_OPTIONS: { value: AnalysisStyle; label: string; desc: string }[] = [
  { value: "professional", label: "专业术语", desc: "使用固定收益专业术语，适合机构投资者" },
  { value: "plain",        label: "通俗易懂", desc: "用日常语言解读，适合普通投资者" },
  { value: "strategy",     label: "投资策略侧重", desc: "聚焦交易机会与风险提示，适合策略研究" },
];

// ─── 类型 ────────────────────────────────────────────────────────────────────
export type CurveInfo = {
  id: number;
  name: string;
  curveId: string;
  type?: string | null;
  currency?: string | null;
  country?: string | null;
  region?: string | null;
};

type Props = {
  curve: CurveInfo | null;
  open: boolean;
  onClose: () => void;
};

// ─── 自定义 Tooltip ──────────────────────────────────────────────────────────
const HistoryTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-semibold mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-400">{entry.dataKey}:</span>
          <span className="text-white font-mono font-bold">{Number(entry.value).toFixed(4)}%</span>
        </div>
      ))}
    </div>
  );
};
const SnapshotTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-semibold mb-1">期限：{label}</p>
      <p className="text-emerald-400 font-mono font-bold text-sm">
        {Number(payload[0]?.value).toFixed(4)}%
      </p>
    </div>
  );
};

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function inferHistoryTrend(data: Array<Record<string, any>>, key = "10Y"): string {
  if (data.length < 4) return "flat";
  const vals = data.map(d => d[key]).filter(v => v != null) as number[];
  if (vals.length < 4) return "flat";
  const first = vals.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const last  = vals.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const diff  = last - first;
  const range = Math.max(...vals) - Math.min(...vals);
  if (range > 0.8) return "volatile";
  if (diff > 0.15) return "rising";
  if (diff < -0.15) return "falling";
  return "flat";
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function CurveChartModal({ curve, open, onClose }: Props) {
  const [selectedMaturities, setSelectedMaturities] = useState<Set<string>>(
    new Set(["1Y", "2Y", "5Y", "10Y"])
  );
  const [activeTab, setActiveTab] = useState("history");

  // AI 分析状态
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [analysisStyle, setAnalysisStyle] = useState<AnalysisStyle>("professional");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // ── 数据获取 ────────────────────────────────────────────────────────────────
  const { data: rawHistory = [], isLoading: histLoading } =
    trpc.curves.getHistoricalYields.useQuery(
      { curveId: curve?.id ?? 0 },
      { enabled: open && !!curve?.id }
    );
  const { data: rawSnapshot = [], isLoading: snapLoading } =
    trpc.curves.getLatestSnapshot.useQuery(
      { curveId: curve?.id ?? 0 },
      { enabled: open && !!curve?.id }
    );

  // ── 数据处理 ────────────────────────────────────────────────────────────────
  const allMaturities = useMemo(() => {
    const set = new Set(rawHistory.map((r) => r.period));
    return Array.from(set).sort(
      (a, b) => (MATURITY_ORDER[a] ?? 99) - (MATURITY_ORDER[b] ?? 99)
    );
  }, [rawHistory]);

  const historyChartData = useMemo(() => {
    if (!rawHistory.length) return [];
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of rawHistory) {
      const dd = row.dataDate ?? ""; const vv = row.value ?? "0";
      if (!byDate[dd]) byDate[dd] = {};
      byDate[dd][row.period] = parseFloat(vv);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [rawHistory]);

  const snapshotChartData = useMemo(() => {
    return [...rawSnapshot]
      .sort((a, b) => (MATURITY_ORDER[a.period] ?? 99) - (MATURITY_ORDER[b.period] ?? 99))
      .map((r) => ({ maturity: r.period, yield: parseFloat(r.value ?? '0') }));
  }, [rawSnapshot]);

  const latestDate = rawSnapshot[0]?.dataDate ?? "";

  const stats = useMemo(() => {
    if (!snapshotChartData.length) return null;
    const yields = snapshotChartData.map((d) => d.yield);
    const min = Math.min(...yields);
    const max = Math.max(...yields);
    const spread = max - min;
    const y10 = snapshotChartData.find((d) => d.maturity === "10Y")?.yield ?? null;
    const y2  = snapshotChartData.find((d) => d.maturity === "2Y")?.yield ?? null;
    return { min, max, spread, y10, y2, slope: y10 != null && y2 != null ? y10 - y2 : null };
  }, [snapshotChartData]);

  // ── 期限切换 ────────────────────────────────────────────────────────────────
  const toggleMaturity = (m: string) => {
    setSelectedMaturities((prev) => {
      const next = new Set(prev);
      if (next.has(m)) { if (next.size > 1) next.delete(m); }
      else next.add(m);
      return next;
    });
  };

  // ── AI 分析 ─────────────────────────────────────────────────────────────────
  const runAiAnalysis = useCallback(async () => {
    if (!curve || !stats) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAiText("");
    setAiError("");
    setAiLoading(true);
    setActiveTab("ai");
    const historyTrend = inferHistoryTrend(historyChartData);
    try {
      const res = await fetch("/api/curve-ai-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          curveName:    curve.name,
          curveId:      curve.curveId,
          curveType:    curve.type ?? "Unknown",
          country:      curve.country ?? "Unknown",
          currency:     curve.currency ?? "Unknown",
          y2:           stats.y2,
          y10:          stats.y10,
          slope:        stats.slope,
          minYield:     stats.min,
          maxYield:     stats.max,
          spread:       stats.spread,
          latestDate,
          historyTrend,
          analysisStyle,
          recentValues: snapshotChartData.map(d => ({ period: d.maturity, value: String(d.yield) })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`请求失败：${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          try {
            const chunk = JSON.parse(jsonStr);
            if (chunk.error) { setAiError(chunk.error); break; }
            if (chunk.text)  { setAiText(prev => prev + chunk.text); }
          } catch { /* skip */ }
        }
      }
    } catch (err: unknown) {
      if ((err as any)?.name !== "AbortError") {
        setAiError(err instanceof Error ? err.message : "AI 分析失败，请重试");
      }
    } finally {
      setAiLoading(false);
    }
  }, [curve, stats, historyChartData, snapshotChartData, latestDate, analysisStyle]);

  // ── 一键复制 ────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      setCopied(true);
      toast.success("AI 解读已复制到剪贴板");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  }, [aiText]);

  // ── 导出长图 ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${curve?.curveId ?? "curve"}-analysis-${latestDate || "latest"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("长图已导出");
    } catch (e) {
      toast.error("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }, [curve, latestDate]);

  // ── 关闭时清理 ───────────────────────────────────────────────────────────────
  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  if (!curve) return null;

  const styleLabel = STYLE_OPTIONS.find(s => s.value === analysisStyle)?.label ?? "专业术语";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-4xl w-full max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 p-0">

        {/* ── 可导出区域 ── */}
        <div ref={exportRef} className="bg-slate-950">
          {/* 头部 */}
          <DialogHeader className="px-6 pt-5 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-white leading-tight mb-1">
                  {curve.name}
                </DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-400">{curve.curveId}</span>
                  {curve.type && (
                    <Badge variant="secondary" className="text-xs bg-blue-900/50 text-blue-300 border-blue-700">
                      {curve.type}
                    </Badge>
                  )}
                  {curve.currency && (
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                      {curve.currency}
                    </Badge>
                  )}
                  {curve.country && (
                    <span className="text-xs text-slate-500">{curve.country}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost" size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0"
                onClick={handleClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* 统计卡片 */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pt-4">
              {[
                { label: "10Y 收益率", value: stats.y10 != null ? `${stats.y10.toFixed(4)}%` : "—", color: "text-emerald-400" },
                {
                  label: "2Y-10Y 利差",
                  value: stats.slope != null ? `${stats.slope >= 0 ? "+" : ""}${stats.slope.toFixed(4)}%` : "—",
                  color: stats.slope != null && stats.slope >= 0 ? "text-emerald-400" : "text-red-400",
                },
                { label: "曲线最高点", value: `${stats.max.toFixed(4)}%`, color: "text-amber-400" },
                { label: "曲线利差", value: `${stats.spread.toFixed(4)}%`, color: "text-blue-400" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-900 rounded-lg px-3 py-2 border border-slate-800">
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <p className={`text-base font-bold font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 图表 + AI 区域 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pt-4 pb-6">
            {/* Tab 栏 + 操作按钮 */}
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />历史走势
                </TabsTrigger>
                <TabsTrigger value="snapshot" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
                  <BarChart2 className="w-3.5 h-3.5 mr-1.5" />期限结构
                </TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />AI 分析
                </TabsTrigger>
              </TabsList>

              {/* 右侧操作区 */}
              <div className="flex items-center gap-2">
                {/* 个性化偏好设置 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline"
                      className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white h-8 px-2.5">
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                      {styleLabel}
                      <ChevronDown className="w-3 h-3 ml-1 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200 w-56">
                    <DropdownMenuLabel className="text-slate-400 text-xs">AI 分析风格</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-700" />
                    {STYLE_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setAnalysisStyle(opt.value)}
                        className={`cursor-pointer hover:bg-slate-800 focus:bg-slate-800 ${analysisStyle === opt.value ? "text-violet-300" : ""}`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-slate-500">{opt.desc}</span>
                        </div>
                        {analysisStyle === opt.value && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-violet-400 flex-shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* AI 解读按钮 */}
                <Button
                  size="sm" variant="outline"
                  disabled={aiLoading || !stats}
                  onClick={runAiAnalysis}
                  className="border-violet-700 text-violet-300 hover:bg-violet-900/40 hover:text-violet-200 disabled:opacity-50 h-8"
                >
                  {aiLoading
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />生成中...</>
                    : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI 解读</>
                  }
                </Button>

                {/* 复制按钮（仅 AI 分析有内容时显示） */}
                {aiText && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm" variant="ghost"
                        onClick={handleCopy}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0"
                      >
                        {copied
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          : <Copy className="w-4 h-4" />
                        }
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-slate-800 text-slate-200 border-slate-700">
                      {copied ? "已复制" : "复制 AI 解读"}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* 导出长图按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm" variant="ghost"
                      onClick={handleExport}
                      disabled={exporting}
                      className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0"
                    >
                      {exporting
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />
                      }
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-slate-800 text-slate-200 border-slate-700">
                    导出为长图
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* ── 历史走势 Tab ── */}
            <TabsContent value="history" className="mt-0">
              {histLoading ? (
                <DataLoadingSkeleton variant="line" height={320} label="正在加载收益率历史走势" />
              ) : historyChartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">暂无历史数据</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="text-xs text-slate-500">期限筛选：</span>
                    {allMaturities.map((m) => (
                      <button
                        key={m}
                        onClick={() => toggleMaturity(m)}
                        className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition-all ${
                          selectedMaturities.has(m)
                            ? "border-transparent text-white"
                            : "border-slate-700 text-slate-500 bg-transparent"
                        }`}
                        style={selectedMaturities.has(m) ? { background: MATURITY_COLORS[m] ?? "#3b82f6" } : {}}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={historyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} width={48} />
                      <RechartTooltip content={<HistoryTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
                      {allMaturities.filter((m) => selectedMaturities.has(m)).map((m) => (
                        <Line key={m} type="monotone" dataKey={m} stroke={MATURITY_COLORS[m] ?? "#3b82f6"} strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-600 text-right mt-1">
                    数据区间：{historyChartData[0]?.date} — {historyChartData[historyChartData.length - 1]?.date}
                    &nbsp;·&nbsp;共 {historyChartData.length} 个交易日
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── 期限结构 Tab ── */}
            <TabsContent value="snapshot" className="mt-0">
              {snapLoading ? (
                <DataLoadingSkeleton variant="area" height={320} label="正在加载收益率期限结构" />
              ) : snapshotChartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">暂无截面数据</div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    最新日期：<span className="text-slate-300 font-mono">{latestDate}</span>
                    &nbsp;·&nbsp;完整期限结构（{snapshotChartData.length} 个节点）
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={snapshotChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="maturity" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} width={48} />
                      <RechartTooltip content={<SnapshotTooltip />} />
                      <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="yield" stroke="#3b82f6" strokeWidth={2.5} fill="url(#yieldGrad)" dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: "#60a5fa", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {snapshotChartData.map((d) => (
                      <div key={d.maturity} className="bg-slate-900 rounded border border-slate-800 px-2 py-1.5 text-center">
                        <p className="text-xs text-slate-500 font-mono">{d.maturity}</p>
                        <p className="text-sm font-bold font-mono text-emerald-400">{d.yield.toFixed(4)}%</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── AI 分析 Tab ── */}
            <TabsContent value="ai" className="mt-0">
              <div className="min-h-[280px]">
                {/* 空状态 */}
                {!aiLoading && !aiText && !aiError && (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-14 h-14 rounded-full bg-violet-900/30 border border-violet-700/50 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-violet-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 font-medium mb-1">AI 市场趋势解读</p>
                      <p className="text-slate-500 text-sm">
                        基于 2Y-10Y 利差、历史走势和期限结构，<br />自动生成专业的固定收益市场分析
                      </p>
                    </div>
                    {/* 风格选择提示 */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Settings2 className="w-3.5 h-3.5" />
                      当前风格：<span className="text-violet-300 font-medium">{styleLabel}</span>
                      <span>（可在右上角切换）</span>
                    </div>
                    <Button
                      onClick={runAiAnalysis}
                      disabled={!stats}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      立即生成 AI 解读
                    </Button>
                  </div>
                )}

                {/* 流式输出中 / 已完成 */}
                {(aiLoading || aiText) && !aiError && (
                  <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/50 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-violet-400" />
                        </div>
                        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">AI 市场分析</span>
                        <Badge variant="outline" className="text-xs border-violet-800 text-violet-400 px-1.5 py-0">
                          {styleLabel}
                        </Badge>
                        {aiLoading && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            生成中
                          </span>
                        )}
                      </div>
                      {!aiLoading && aiText && (
                        <Button size="sm" variant="ghost" onClick={runAiAnalysis}
                          className="text-slate-500 hover:text-slate-300 h-7 px-2">
                          <RefreshCw className="w-3 h-3 mr-1" />重新生成
                        </Button>
                      )}
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed
                      prose-p:text-slate-200 prose-p:my-2
                      prose-strong:text-white prose-strong:font-semibold
                      prose-ul:text-slate-300 prose-li:my-0.5
                      prose-a:text-blue-400">
                      <Streamdown>{aiText}</Streamdown>
                      {aiLoading && (
                        <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                    {!aiLoading && aiText && (
                      <p className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-600">
                        以上内容由 AI 自动生成，仅供参考，不构成投资建议。
                      </p>
                    )}
                  </div>
                )}

                {/* 错误状态 */}
                {aiError && (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <p className="text-red-400 text-sm">{aiError}</p>
                    <Button size="sm" variant="outline" onClick={runAiAnalysis}
                      className="border-slate-700 text-slate-300">
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />重试
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
