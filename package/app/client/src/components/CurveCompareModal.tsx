/**
 * CurveCompareModal — 双曲线对比分析弹窗
 * - 并排展示两条曲线的期限结构截面（叠加折线图）
 * - 关键指标对比表格
 * - AI 对比解读（流式输出）
 * - 一键复制 + 导出长图
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2, BarChart2, Sparkles, X, RefreshCw,
  Copy, Download, Settings2, CheckCircle2, ChevronDown, GitCompare,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { DataLoadingSkeleton } from "@/components/ChartSkeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── 期限排序 ─────────────────────────────────────────────────────────────────
const MATURITY_ORDER: Record<string, number> = {
  "1M": 1, "3M": 2, "6M": 3, "1Y": 4, "2Y": 5, "3Y": 6,
  "5Y": 7, "7Y": 8, "10Y": 9, "20Y": 10, "30Y": 11,
};

// ─── 分析风格 ─────────────────────────────────────────────────────────────────
type AnalysisStyle = "professional" | "plain" | "strategy";
const STYLE_OPTIONS: { value: AnalysisStyle; label: string; desc: string }[] = [
  { value: "professional", label: "专业术语",    desc: "使用固定收益专业术语，适合机构投资者" },
  { value: "plain",        label: "通俗易懂",    desc: "用日常语言解读，适合普通投资者" },
  { value: "strategy",     label: "投资策略侧重", desc: "聚焦套利机会与操作建议，适合策略研究" },
];

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
  curveA: CurveInfo;
  curveB: CurveInfo;
  open: boolean;
  onClose: () => void;
};

// ─── 自定义 Tooltip ──────────────────────────────────────────────────────────
const CompareTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-semibold mb-2">期限：{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-slate-400 max-w-[120px] truncate">{entry.name}:</span>
          <span className="text-white font-mono font-bold">{Number(entry.value).toFixed(4)}%</span>
        </div>
      ))}
      {payload.length === 2 && payload[0]?.value != null && payload[1]?.value != null && (
        <div className="mt-1 pt-1 border-t border-slate-700">
          <span className="text-slate-500">利差：</span>
          <span className={`font-mono font-bold ${(payload[0].value - payload[1].value) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {(payload[0].value - payload[1].value >= 0 ? "+" : "")}{(payload[0].value - payload[1].value).toFixed(4)}%
          </span>
        </div>
      )}
    </div>
  );
};

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function CurveCompareModal({ curveA, curveB, open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState("chart");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [analysisStyle, setAnalysisStyle] = useState<AnalysisStyle>("professional");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // ── 数据获取 ────────────────────────────────────────────────────────────────
  const { data: snapshotA = [], isLoading: loadA } =
    trpc.curves.getLatestSnapshot.useQuery({ curveId: curveA.id }, { enabled: open });
  const { data: snapshotB = [], isLoading: loadB } =
    trpc.curves.getLatestSnapshot.useQuery({ curveId: curveB.id }, { enabled: open });

  // ── 数据处理 ────────────────────────────────────────────────────────────────
  const processSnapshot = (raw: typeof snapshotA) =>
    [...raw]
      .sort((a, b) => (MATURITY_ORDER[a.period] ?? 99) - (MATURITY_ORDER[b.period] ?? 99))
      .map(r => ({ maturity: r.period, yield: parseFloat(r.value ?? '0') }));

  const dataA = useMemo(() => processSnapshot(snapshotA), [snapshotA]);
  const dataB = useMemo(() => processSnapshot(snapshotB), [snapshotB]);

  // 合并为对比图数据
  const compareChartData = useMemo(() => {
    const maturities = Array.from(
      new Set([...dataA.map(d => d.maturity), ...dataB.map(d => d.maturity)])
    ).sort((a, b) => (MATURITY_ORDER[a] ?? 99) - (MATURITY_ORDER[b] ?? 99));

    const mapA = Object.fromEntries(dataA.map(d => [d.maturity, d.yield]));
    const mapB = Object.fromEntries(dataB.map(d => [d.maturity, d.yield]));

    return maturities.map(m => ({
      maturity: m,
      [curveA.curveId]: mapA[m] ?? null,
      [curveB.curveId]: mapB[m] ?? null,
      spread: mapA[m] != null && mapB[m] != null ? mapA[m] - mapB[m] : null,
    }));
  }, [dataA, dataB, curveA.curveId, curveB.curveId]);

  // 统计指标
  const statsA = useMemo(() => {
    if (!dataA.length) return null;
    const y10 = dataA.find(d => d.maturity === "10Y")?.yield ?? null;
    const y2  = dataA.find(d => d.maturity === "2Y")?.yield ?? null;
    return { y10, y2, slope: y10 != null && y2 != null ? y10 - y2 : null };
  }, [dataA]);

  const statsB = useMemo(() => {
    if (!dataB.length) return null;
    const y10 = dataB.find(d => d.maturity === "10Y")?.yield ?? null;
    const y2  = dataB.find(d => d.maturity === "2Y")?.yield ?? null;
    return { y10, y2, slope: y10 != null && y2 != null ? y10 - y2 : null };
  }, [dataB]);

  // ── AI 对比分析 ──────────────────────────────────────────────────────────────
  const runAiCompare = useCallback(async () => {
    if (!statsA || !statsB) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAiText("");
    setAiError("");
    setAiLoading(true);
    setActiveTab("ai");

    try {
      const res = await fetch("/api/curve-compare-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          analysisStyle,
          curveA: {
            name: curveA.name, curveId: curveA.curveId,
            type: curveA.type ?? "Unknown", country: curveA.country ?? "Unknown",
            currency: curveA.currency ?? "Unknown",
            y2: statsA.y2, y10: statsA.y10, slope: statsA.slope,
            snapshot: dataA.map(d => ({ period: d.maturity, value: String(d.yield) })),
          },
          curveB: {
            name: curveB.name, curveId: curveB.curveId,
            type: curveB.type ?? "Unknown", country: curveB.country ?? "Unknown",
            currency: curveB.currency ?? "Unknown",
            y2: statsB.y2, y10: statsB.y10, slope: statsB.slope,
            snapshot: dataB.map(d => ({ period: d.maturity, value: String(d.yield) })),
          },
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
  }, [curveA, curveB, statsA, statsB, dataA, dataB, analysisStyle]);

  // ── 一键复制 ────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      setCopied(true);
      toast.success("AI 对比解读已复制到剪贴板");
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
        backgroundColor: "#0f172a", scale: 2, useCORS: true, logging: false,
      });
      const link = document.createElement("a");
      link.download = `compare-${curveA.curveId}-vs-${curveB.curveId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("对比长图已导出");
    } catch {
      toast.error("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }, [curveA, curveB]);

  const handleClose = () => { abortRef.current?.abort(); onClose(); };
  const styleLabel = STYLE_OPTIONS.find(s => s.value === analysisStyle)?.label ?? "专业术语";
  const isLoading = loadA || loadB;

  const fmtSlope = (slope: number | null) => {
    if (slope == null) return "—";
    return `${slope >= 0 ? "+" : ""}${slope.toFixed(4)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-5xl w-full max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 p-0">
        <div ref={exportRef} className="bg-slate-950">
          {/* 头部 */}
          <DialogHeader className="px-6 pt-5 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <GitCompare className="w-5 h-5 text-violet-400 flex-shrink-0" />
                  <DialogTitle className="text-lg font-bold text-white">曲线对比分析</DialogTitle>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="text-sm text-slate-200 font-medium">{curveA.name}</span>
                    <span className="font-mono text-xs text-slate-500">{curveA.curveId}</span>
                  </div>
                  <span className="text-slate-600 text-sm">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-sm text-slate-200 font-medium">{curveB.name}</span>
                    <span className="font-mono text-xs text-slate-500">{curveB.curveId}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0"
                onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* 指标对比表 */}
          {!isLoading && statsA && statsB && (
            <div className="px-6 pt-4">
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium text-xs w-32">指标</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-blue-300 text-xs">
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          {curveA.curveId}
                        </span>
                      </th>
                      <th className="text-center px-4 py-2.5 font-semibold text-orange-300 text-xs">
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-400" />
                          {curveB.curveId}
                        </span>
                      </th>
                      <th className="text-center px-4 py-2.5 text-slate-500 font-medium text-xs">A-B 利差</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        label: "2Y 收益率",
                        a: statsA.y2 != null ? `${statsA.y2.toFixed(4)}%` : "—",
                        b: statsB.y2 != null ? `${statsB.y2.toFixed(4)}%` : "—",
                        diff: statsA.y2 != null && statsB.y2 != null ? statsA.y2 - statsB.y2 : null,
                      },
                      {
                        label: "10Y 收益率",
                        a: statsA.y10 != null ? `${statsA.y10.toFixed(4)}%` : "—",
                        b: statsB.y10 != null ? `${statsB.y10.toFixed(4)}%` : "—",
                        diff: statsA.y10 != null && statsB.y10 != null ? statsA.y10 - statsB.y10 : null,
                      },
                      {
                        label: "2Y-10Y 利差",
                        a: fmtSlope(statsA.slope),
                        b: fmtSlope(statsB.slope),
                        diff: statsA.slope != null && statsB.slope != null ? statsA.slope - statsB.slope : null,
                      },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{row.label}</td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-blue-300">{row.a}</td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-orange-300">{row.b}</td>
                        <td className={`px-4 py-2.5 text-center font-mono font-bold text-xs ${
                          row.diff == null ? "text-slate-500"
                          : row.diff > 0 ? "text-emerald-400"
                          : row.diff < 0 ? "text-red-400"
                          : "text-slate-400"
                        }`}>
                          {row.diff != null ? `${row.diff >= 0 ? "+" : ""}${row.diff.toFixed(4)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 图表 + AI */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pt-4 pb-6">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="chart" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
                  <BarChart2 className="w-3.5 h-3.5 mr-1.5" />期限结构对比
                </TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />AI 对比解读
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {/* 风格选择 */}
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
                      <DropdownMenuItem key={opt.value} onClick={() => setAnalysisStyle(opt.value)}
                        className={`cursor-pointer hover:bg-slate-800 focus:bg-slate-800 ${analysisStyle === opt.value ? "text-violet-300" : ""}`}>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-slate-500">{opt.desc}</span>
                        </div>
                        {analysisStyle === opt.value && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-violet-400 flex-shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* AI 对比解读按钮 */}
                <Button size="sm" variant="outline"
                  disabled={aiLoading || isLoading || !statsA || !statsB}
                  onClick={runAiCompare}
                  className="border-violet-700 text-violet-300 hover:bg-violet-900/40 hover:text-violet-200 disabled:opacity-50 h-8">
                  {aiLoading
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />生成中...</>
                    : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI 对比</>
                  }
                </Button>

                {/* 复制 */}
                {aiText && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="ghost" onClick={handleCopy}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0">
                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-slate-800 text-slate-200 border-slate-700">
                      {copied ? "已复制" : "复制解读"}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* 导出 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleExport} disabled={exporting}
                      className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0">
                      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-slate-800 text-slate-200 border-slate-700">
                    导出为长图
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* ── 期限结构对比图 ── */}
            <TabsContent value="chart" className="mt-0">
              {isLoading ? (
                <DataLoadingSkeleton variant="line" height={340} label="正在加载收益率曲线对比" />
              ) : compareChartData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">暂无数据</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={compareChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="maturity" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#334155" }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} width={48} />
                      <RechartTooltip content={<CompareTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
                      <Line type="monotone" dataKey={curveA.curveId} name={curveA.name} stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey={curveB.curveId} name={curveB.name} stroke="#fb923c" strokeWidth={2.5} dot={{ fill: "#fb923c", strokeWidth: 0, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} strokeDasharray="6 3" />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* 利差数据表 */}
                  <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {compareChartData.filter(d => d.spread != null).map((d) => (
                      <div key={d.maturity} className="bg-slate-900 rounded border border-slate-800 px-2 py-1.5 text-center">
                        <p className="text-xs text-slate-500 font-mono">{d.maturity}</p>
                        <p className={`text-xs font-bold font-mono ${(d.spread ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {(d.spread ?? 0) >= 0 ? "+" : ""}{(d.spread ?? 0).toFixed(4)}%
                        </p>
                        <p className="text-xs text-slate-600">A-B</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 text-right mt-2">
                    蓝色实线：{curveA.name}&nbsp;·&nbsp;橙色虚线：{curveB.name}
                  </p>
                </>
              )}
            </TabsContent>

            {/* ── AI 对比解读 Tab ── */}
            <TabsContent value="ai" className="mt-0">
              <div className="min-h-[280px]">
                {!aiLoading && !aiText && !aiError && (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="w-14 h-14 rounded-full bg-violet-900/30 border border-violet-700/50 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-violet-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-slate-300 font-medium mb-1">AI 双曲线对比解读</p>
                      <p className="text-slate-500 text-sm">
                        分析两条曲线的形态差异、宏观驱动因素<br />及相对价值关系
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Settings2 className="w-3.5 h-3.5" />
                      当前风格：<span className="text-violet-300 font-medium">{styleLabel}</span>
                    </div>
                    <Button onClick={runAiCompare} disabled={isLoading || !statsA || !statsB}
                      className="bg-violet-600 hover:bg-violet-500 text-white">
                      <Sparkles className="w-4 h-4 mr-2" />立即生成对比解读
                    </Button>
                  </div>
                )}

                {(aiLoading || aiText) && !aiError && (
                  <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-600/30 border border-violet-500/50 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-violet-400" />
                        </div>
                        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">AI 对比分析</span>
                        <Badge variant="outline" className="text-xs border-violet-800 text-violet-400 px-1.5 py-0">{styleLabel}</Badge>
                        {aiLoading && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />生成中
                          </span>
                        )}
                      </div>
                      {!aiLoading && aiText && (
                        <Button size="sm" variant="ghost" onClick={runAiCompare}
                          className="text-slate-500 hover:text-slate-300 h-7 px-2">
                          <RefreshCw className="w-3 h-3 mr-1" />重新生成
                        </Button>
                      )}
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed
                      prose-p:text-slate-200 prose-p:my-2
                      prose-strong:text-white prose-strong:font-semibold
                      prose-ul:text-slate-300 prose-li:my-0.5">
                      <Streamdown>{aiText}</Streamdown>
                      {aiLoading && <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-middle" />}
                    </div>
                    {!aiLoading && aiText && (
                      <p className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-600">
                        以上内容由 AI 自动生成，仅供参考，不构成投资建议。
                      </p>
                    )}
                  </div>
                )}

                {aiError && (
                  <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <p className="text-red-400 text-sm">{aiError}</p>
                    <Button size="sm" variant="outline" onClick={runAiCompare}
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
