import { useEffect, useRef, useState } from "react";
import SparklineChart, { type SparklineDataPoint, type BenchmarkSeries } from "@/components/Sparkline";
import { trpc } from "@/lib/trpc";
import { X, ExternalLink, Copy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface RowField {
  label: string;
  value: string | number | null | undefined;
  type?: "text" | "number" | "currency" | "percent" | "badge" | "pnl" | "date" | "mono";
  badgeColor?: string; // tailwind bg color class
  highlight?: boolean;
}

export interface SparklineConfig {
  data: SparklineDataPoint[];
  symbol: string;
  totalReturn: number;
  minPrice: number;
  maxPrice: number;
  firstPrice: number;
  lastPrice: number;
}

export interface RowDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: { label: string; color?: string };
  fields: RowField[];
  sections?: { title: string; fields: RowField[] }[];
  actions?: { label: string; onClick: () => void; variant?: "default" | "danger" | "success" }[];
  sparkline?: SparklineConfig;
  width?: number; // px, default 420
}

function FieldValue({ field }: { field: RowField }) {
  const v = field.value;
  if (v === null || v === undefined || v === "") {
    return <span className="text-slate-600 text-xs">—</span>;
  }
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,$%]/g, ""));

  switch (field.type) {
    case "currency":
      return (
        <span className="font-mono text-slate-100 text-sm">
          {typeof n === "number" && !isNaN(n)
            ? `$${Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(2) + "B" : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + "M" : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toFixed(2)}`
            : String(v)}
        </span>
      );
    case "percent":
      return (
        <span className={cn("font-mono text-sm", n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-slate-400")}>
          {n > 0 ? "+" : ""}{String(v)}{String(v).includes("%") ? "" : "%"}
        </span>
      );
    case "pnl":
      return (
        <span className={cn("font-mono font-semibold text-sm flex items-center gap-1", n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-slate-400")}>
          {n > 0 ? <TrendingUp className="w-3 h-3" /> : n < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {n > 0 ? "+" : ""}{String(v)}
        </span>
      );
    case "badge":
      return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", field.badgeColor ?? "bg-slate-700/50 text-slate-300 border-slate-600")}>
          {String(v)}
        </span>
      );
    case "mono":
      return <span className="font-mono text-slate-200 text-sm">{String(v)}</span>;
    case "date":
      return <span className="text-slate-300 text-sm tabular-nums">{String(v)}</span>;
    case "number":
      return (
        <span className="font-mono text-slate-100 text-sm">
          {typeof n === "number" && !isNaN(n) ? n.toLocaleString("en-US") : String(v)}
        </span>
      );
    default:
      return <span className={cn("text-sm", field.highlight ? "text-white font-semibold" : "text-slate-200")}>{String(v)}</span>;
  }
}

function FieldRow({ field }: { field: RowField }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-800/60 last:border-0 group">
      <span className="text-xs text-slate-500 flex-shrink-0 pt-0.5 min-w-[100px]">{field.label}</span>
      <div className="flex items-center gap-1.5 flex-1 justify-end">
        <FieldValue field={field} />
        {field.type === "mono" || field.type === "text" ? (
          <button
            onClick={() => { navigator.clipboard.writeText(String(field.value ?? "")); toast.success("已复制"); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300"
          >
            <Copy className="w-2.5 h-2.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// SparklineSection: handles benchmark data fetching internally
function SparklineSection({ sparkline }: { sparkline?: SparklineConfig }) {
  const [sparkMode, setSparkMode] = useState<"price" | "return">("price");
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<("SPX" | "NDX" | "DJI" | "RUT")[]>([]);

  const { data: bmData } = trpc.portfolio.getBenchmarkHistory.useQuery(
    { benchmarks: selectedBenchmarks, days: 30 },
    { enabled: sparkMode === "return" && selectedBenchmarks.length > 0 }
  );

  const benchmarkSeries: BenchmarkSeries[] = selectedBenchmarks
    .flatMap(key => {
      const meta = bmData?.meta?.[key];
      const data = bmData?.data?.[key];
      if (!meta || !data) return [];
      return [{ key: key as string, name: meta.name, color: meta.color, data } as BenchmarkSeries];
    });

  if (!sparkline || sparkline.data.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-800" />
        价格走势
        <div className="h-px flex-1 bg-slate-800" />
      </div>
      <SparklineChart
        data={sparkline.data}
        symbol={sparkline.symbol}
        totalReturn={sparkline.totalReturn}
        minPrice={sparkline.minPrice}
        maxPrice={sparkline.maxPrice}
        firstPrice={sparkline.firstPrice}
        lastPrice={sparkline.lastPrice}
        mode={sparkMode}
        onModeChange={setSparkMode}
        benchmarks={benchmarkSeries}
        height={sparkMode === "return" ? 155 : 130}
      />
    </div>
  );
}

export function RowDetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  fields,
  sections,
  actions,
  sparkline,
  width = 440,
}: RowDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    // Delay to avoid immediate close on the row click that opened it
    const timer = setTimeout(() => window.addEventListener("mousedown", handler), 100);
    return () => { clearTimeout(timer); window.removeEventListener("mousedown", handler); };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed top-0 right-0 h-full z-50 flex flex-col bg-slate-900 border-l border-slate-700/80 shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white truncate">{title}</h2>
              {badge && (
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", badge.color ?? "bg-blue-600/20 text-blue-300 border-blue-500/30")}>
                  {badge.label}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Top-level fields */}
          {fields.length > 0 && (
            <div className="mb-4">
              {fields.map((f, i) => <FieldRow key={i} field={f} />)}
            </div>
          )}

          {/* Sparkline */}
          <SparklineSection sparkline={sparkline} />

          {/* Sections */}
          {sections?.map((section, si) => (
            <div key={si} className="mb-5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-800" />
                {section.title}
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              {section.fields.map((f, fi) => <FieldRow key={fi} field={f} />)}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        {actions && actions.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-800 flex-shrink-0 flex gap-2 flex-wrap">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className={cn(
                  "flex-1 min-w-[80px] py-2 px-3 rounded-lg text-sm font-medium transition-all active:scale-[0.97]",
                  action.variant === "danger"
                    ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30"
                    : action.variant === "success"
                    ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                    : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30"
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
