/**
 * PanelKit — 主权/固收面板共享 UI 原子组件库
 * 被 DESPanel / CalcPanel / CT10Panel / IMGRPanel / InflationPanel /
 * IssuancePanel / PricingPanel / RUNZPanel / SecInfoPanel / TopBonPanel / YASPanel 使用
 */
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, X } from 'lucide-react';

// ─── 颜色 ────────────────────────────────────────────────────────────────────
export const CHART_COLORS = [
  '#60a5fa', '#34d399', '#f59e0b', '#f87171', '#a78bfa',
  '#22d3ee', '#fb923c', '#4ade80', '#e879f9', '#facc15',
];

export function chartTooltipStyle(): Record<string, unknown> {
  return {
    contentStyle: {
      background: 'var(--chart-tooltip-bg, #0f172a)',
      border: '1px solid var(--chart-tooltip-border, #1e293b)',
      borderRadius: 6,
      fontSize: 11,
      color: 'var(--foreground)',
    },
    cursor: { stroke: 'var(--border)', strokeWidth: 1 },
  };
}

// ─── tone 工具 ────────────────────────────────────────────────────────────────
export type Tone = 'pos' | 'neg' | 'warn' | 'info' | 'neutral' | 'crit' | undefined;

const TONE_CLASS: Record<NonNullable<Tone>, string> = {
  pos: 'text-green-400',
  neg: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-sky-400',
  neutral: 'text-slate-400',
  crit: 'text-red-600',
};

export function severityTone(severity: string): Tone {
  const s = severity?.toLowerCase();
  if (s === 'high' || s === '高') return 'neg';
  if (s === 'medium' || s === '中') return 'warn';
  if (s === 'low' || s === '低') return 'pos';
  return 'neutral';
}

// ─── LoadingState ─────────────────────────────────────────────────────────────
export function LoadingState({ text, label }: { text?: string; label?: string }) {
  const message = text ?? label ?? '加载中…';
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
      <RefreshCw className={cn('w-4 h-4', slow ? '' : 'animate-spin')} />
      <span>{slow ? '数据源响应较慢，请点击顶部刷新重试' : message}</span>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}
export function Badge({ children, tone, className }: BadgeProps) {
  const colorClass = tone ? TONE_CLASS[tone] : 'text-slate-300';
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border',
      tone === 'pos' ? 'border-green-500/30 bg-green-500/10' :
      tone === 'neg' ? 'border-red-500/30 bg-red-500/10' :
      tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10' :
      tone === 'info' ? 'border-sky-500/30 bg-sky-500/10' :
      tone === 'crit' ? 'border-red-700/40 bg-red-700/15' :
      'border-slate-600/40 bg-slate-700/20',
      colorClass,
      className,
    )}>
      {children}
    </span>
  );
}

// ─── Metric ───────────────────────────────────────────────────────────────────
interface MetricProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: Tone;
  className?: string;
  sub?: React.ReactNode;
  /** 仅接受业务组件传入的原始历史序列；未提供时不生成或伪造走势。 */
  trend?: number[];
}
const SovereignPanelContext = React.createContext<string | null>(null);

export function SovereignMetricScope({ ticker, children }: { ticker: string; children: React.ReactNode }) {
  return <SovereignPanelContext.Provider value={ticker}>{children}</SovereignPanelContext.Provider>;
}

const METRIC_STROKE: Record<NonNullable<Tone>, string> = {
  pos: '#34d399', neg: '#fb7185', warn: '#fbbf24', info: '#38bdf8', neutral: '#94a3b8', crit: '#ef4444',
};

function metricNumber(value: React.ReactNode) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^[¥$€£]?\s*[-+]?\d[\d,]*(?:\.\d+)?\s*(?:%|bp|bps|x|年|个|代|M|B|T|USD\/bp)?$/i.test(normalized)) return null;
  const parsed = Number(normalized.replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sparklinePoints(values: number[]) {
  if (values.length < 2) return '';
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  return values.map((point, index) => `${(index / (values.length - 1)) * 100},${22 - ((point - min) / span) * 18}`).join(' ');
}

export function Metric({ label, value, unit, tone, className, sub, trend }: MetricProps) {
  const panelTicker = React.useContext(SovereignPanelContext);
  const colorClass = tone ? TONE_CLASS[tone] : 'text-foreground';
  const [expanded, setExpanded] = useState(false);
  const series = (trend ?? []).filter(Number.isFinite).slice(-24);
  const canInspect = series.length > 1;
  const minimum = canInspect ? Math.min(...series) : null;
  const maximum = canInspect ? Math.max(...series) : null;
  const change = canInspect ? series[series.length - 1] - series[0] : null;
  const stroke = tone ? METRIC_STROKE[tone] : '#94a3b8';
  const content = <>
    <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
      <span className="truncate">{label}</span>
      {canInspect && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,.8)]" />}
    </span>
    <span className={cn('text-base font-bold tabular-nums font-mono', colorClass)}>
      {value}{unit && <span className="text-xs font-normal ml-0.5 text-muted-foreground">{unit}</span>}
    </span>
    {canInspect && <svg aria-hidden="true" className="mt-0.5 h-6 w-full overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
      <line x1="0" y1="22" x2="100" y2="22" stroke="currentColor" className="text-slate-800" strokeWidth="0.7" />
      <polyline points={sparklinePoints(series)} fill="none" stroke={stroke} strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={sparklinePoints(series).split(' ').at(-1)?.split(',')[1] ?? '12'} r="1.8" fill={stroke} />
    </svg>}
    {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    {expanded && canInspect && <MetricDrilldown ticker={panelTicker} label={label} values={series} minimum={minimum} maximum={maximum} change={change} />}
  </>;
  return (
    canInspect
      ? <button type="button" aria-expanded={expanded} title="展开当前数据的区间明细" onClick={() => setExpanded((current) => !current)} className={cn('flex min-w-0 flex-col gap-0.5 border-y border-slate-800/80 bg-transparent py-2 text-left transition hover:border-slate-700 hover:bg-slate-900/45', className)}>{content}</button>
      : <div className={cn('flex min-w-0 flex-col gap-0.5 border-y border-slate-800/70 bg-transparent py-2', className)}>{content}</div>
  );
}

function MetricDrilldown({ ticker, label, values, minimum, maximum, change }: { ticker: string | null; label: string; values: number[]; minimum: number | null; maximum: number | null; change: number | null }) {
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const points = values.map((point, index) => `${8 + (index / Math.max(1, values.length - 1)) * 184},${58 - ((point - min) / span) * 44}`).join(' ');
  return <div className="mt-1.5 border-t border-slate-800 pt-2" data-metric-drilldown={ticker ?? undefined}>
    <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold text-slate-300">{label}联动序列</span><span className="font-mono text-[8px] text-slate-600">{values.length} 个序列点</span></div>
    <svg className="mt-1 h-[72px] w-full" viewBox="0 0 200 72" preserveAspectRatio="none" aria-label={`${label}联动序列`}>
      <line x1="8" y1="58" x2="192" y2="58" stroke="#334155" strokeWidth="0.7" />
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="grid grid-cols-3 gap-1 text-[8px] font-mono text-slate-500"><span>低 {minimum?.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span><span>高 {maximum?.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span><span className={change !== null && change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{change !== null && change >= 0 ? '+' : ''}{change?.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span></div>
  </div>;
}

// ─── Bar ─────────────────────────────────────────────────────────────────────
interface BarProps {
  value: number;
  max?: number;
  tone?: Tone;
  className?: string;
}
export function Bar({ value, max = 100, tone, className }: BarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClass =
    tone === 'pos' ? 'bg-green-500' :
    tone === 'neg' ? 'bg-red-500' :
    tone === 'warn' ? 'bg-amber-500' :
    tone === 'info' ? 'bg-sky-500' :
    'bg-slate-500';
  return (
    <div className={cn('h-1.5 rounded-full bg-slate-700/50 overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}
export function Card({ title, children, className, action }: CardProps) {
  return (
    <div className={cn('bg-transparent border-y border-border py-3', className)}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── PanelShell ───────────────────────────────────────────────────────────────
interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface PanelShellProps {
  ticker: string;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  onRefresh?: () => void;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
  showFeedUpdates?: boolean;
}

const SOVEREIGN_FEED_PATHS: Record<string, string> = {
  HELP: '/terminal?open=1&module=sovereign-bonds', SECF: '/terminal?open=2&module=sovereign-bonds',
  FIT: '/terminal?open=5&module=sovereign-bonds', BTMM: '/terminal?open=6&module=sovereign-bonds',
  GCDS: '/terminal?open=7&module=sovereign-bonds', COUN: '/terminal?open=8&module=sovereign-bonds',
  MIPR: '/terminal?open=9&module=sovereign-bonds', DEBT: '/terminal?open=10&module=sovereign-bonds',
  SRSK: '/terminal?open=11&module=sovereign-bonds', GMM: '/terminal?open=12&module=sovereign-bonds',
  YCURVE: '/terminal?open=13&module=sovereign-bonds', GC: '/terminal?open=14&module=sovereign-bonds',
  CT10: '/terminal?open=15&module=sovereign-bonds', DES: '/terminal?open=16&module=sovereign-bonds',
  YAS: '/terminal?open=17&module=sovereign-bonds', 'TOP BON': '/terminal?open=18&module=sovereign-bonds',
  CALC: '/terminal?open=19&module=sovereign-bonds', PRICE: '/terminal?open=20&module=sovereign-bonds',
  IMGR: '/terminal?open=21&module=sovereign-bonds', RUNZ: '/terminal?open=22&module=sovereign-bonds',
  NIM: '/terminal?open=23&module=sovereign-bonds', 'IR/SN': '/terminal?open=24&module=sovereign-bonds',
};

const CREDIT_FEED_PATHS: Record<string, string> = {
  '1': '/terminal?open=1&module=credit-bonds', '2': '/terminal?open=2&module=credit-bonds',
  WB: '/terminal?open=3&module=credit-bonds', BTMM: '/terminal?open=4&module=credit-bonds',
  GCDS: '/terminal?open=5&module=credit-bonds', '6': '/terminal?open=6&module=credit-bonds',
  GC: '/terminal?open=7&module=credit-bonds', '8': '/terminal?open=8&module=credit-bonds',
  CALC: '/terminal?open=9&module=credit-bonds', '9': '/terminal?open=9&module=credit-bonds',
  IN: '/terminal?open=10&module=credit-bonds', WBIX: '/terminal?open=11&module=credit-bonds',
  INS: '/terminal?open=12&module=credit-bonds', '13': '/terminal?open=13&module=credit-bonds',
  DES: '/terminal?open=14&module=credit-bonds', YAS: '/terminal?open=15&module=credit-bonds',
  '16': '/terminal?open=16&module=credit-bonds', IMGR: '/terminal?open=17&module=credit-bonds',
  RUNZ: '/terminal?open=18&module=credit-bonds', TACT: '/terminal?open=19&module=credit-bonds',
  '20': '/terminal?open=20&module=credit-bonds', '21': '/terminal?open=21&module=credit-bonds',
  '22': '/terminal?open=22&module=credit-bonds', FIW: '/terminal?open=23&module=credit-bonds',
  CRAN: '/terminal?open=24&module=credit-bonds', LOAN: '/terminal?open=25&module=credit-bonds',
  CRMX: '/terminal?open=26&module=credit-bonds',
};

const MORTGAGE_FEED_PATHS: Record<string, string> = {
  'MBS-1': '/terminal?open=1&module=mortgage-bonds', SECF: '/terminal?open=2&module=mortgage-bonds',
  MTGS: '/terminal?open=3&module=mortgage-bonds', MTGH: '/terminal?open=4&module=mortgage-bonds',
  'MBS-5': '/terminal?open=5&module=mortgage-bonds', MCAL: '/terminal?open=6&module=mortgage-bonds',
  IMGR: '/terminal?open=7&module=mortgage-bonds', STSH: '/terminal?open=8&module=mortgage-bonds',
  'MBS-9': '/terminal?open=9&module=mortgage-bonds', TBPF: '/terminal?open=10&module=mortgage-bonds',
  'MBS-11': '/terminal?open=11&module=mortgage-bonds', BMMI: '/terminal?open=12&module=mortgage-bonds',
  'MBS-13': '/terminal?open=13&module=mortgage-bonds', FIRS: '/terminal?open=14&module=mortgage-bonds',
  NI: '/terminal?open=15&module=mortgage-bonds', 'MBS-16': '/terminal?open=16&module=mortgage-bonds',
  DES: '/terminal?open=17&module=mortgage-bonds', YT: '/terminal?open=18&module=mortgage-bonds',
  FIBC: '/terminal?open=19&module=mortgage-bonds', Q: '/terminal?open=20&module=mortgage-bonds',
  CMAP: '/terminal?open=21&module=mortgage-bonds', 'MBS-22': '/terminal?open=22&module=mortgage-bonds',
  MCCN: '/terminal?open=23&module=mortgage-bonds', 'MBS-24': '/terminal?open=24&module=mortgage-bonds',
  'MBS-25': '/terminal?open=25&module=mortgage-bonds', 'MBS-26': '/terminal?open=26&module=mortgage-bonds',
};

const MONEY_MARKET_FEED_PATHS: Record<string, string> = {
  DES: '/terminal?open=des-mm&module=money-market', PGM: '/terminal?open=pgm&module=money-market',
  MKTBEAT: '/terminal?open=mktbeat&module=money-market', BTMM: '/terminal?open=btmm&module=money-market',
  BOOM: '/terminal?open=boom&module=money-market', TCON: '/terminal?open=tcon&module=money-market',
  RV: '/terminal?open=rv&module=money-market', YCQSIM: '/terminal?open=ycqsim&module=money-market',
  GC: '/terminal?open=gc&module=money-market', 'CRVF MMKT': '/terminal?open=crvf-mmkt&module=money-market',
  CRVF: '/terminal?open=crvf&module=money-market', FIBC: '/terminal?open=fibc&module=money-market',
  CDIE: '/terminal?open=cdie&module=money-market', EFSF: '/terminal?open=efsf&module=money-market',
  MMIDX: '/terminal?open=mmidx&module=money-market', ETRADE: '/terminal?open=etrade&module=money-market',
  EDSF: '/terminal?open=edsf&module=money-market', WBF: '/terminal?open=wbf&module=money-market',
  PBOC: '/terminal?open=pboc&module=money-market', TWDI: '/terminal?open=twdi&module=money-market',
  CENB: '/terminal?open=cenb&module=money-market', NEWS: '/terminal?open=news-mm&module=money-market',
  SOURCE: '/terminal?open=source-mm&module=money-market', MMFLOW: '/terminal?open=mmflow&module=money-market',
};

export function PanelShell({
  ticker,
  title,
  subtitle,
  onClose,
  onRefresh,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
  headerExtra,
  showFeedUpdates = true,
}: PanelShellProps) {
  return (
    <SovereignPanelContext.Provider value={ticker}>
    <div className={cn('flex flex-col min-h-0 bg-background text-foreground', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-400 font-bold text-sm font-mono shrink-0">{ticker}</span>
          <div className="min-w-0">
            <span className="text-sm font-semibold truncate">{title}</span>
            {subtitle && <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {headerExtra}
          {onRefresh && (
            <button onClick={onRefresh} title="重新读取当前数据" className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-card/40 shrink-0 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange?.(t.id)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap',
                activeTab === t.id
                  ? 'bg-accent/20 text-accent font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </div>
    </SovereignPanelContext.Provider>
  );
}
