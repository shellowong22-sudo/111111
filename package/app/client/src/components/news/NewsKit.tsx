/**
 * NewsKit — 新闻/研究模块共享 UI 原子组件库
 * 被 22 个新闻面板 + comms 面板 + markets 面板使用
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, X, Inbox } from 'lucide-react';
import type { NewsItem, Importance } from '@/lib/newsEngine';
import { AISummaryDrawer, AISummaryButton } from './AISummaryDrawer';
import { BatchSummaryBar } from './BatchSummaryBar';

// ─── 颜色映射 ─────────────────────────────────────────────────────────────────
const IMPORTANCE_COLOR: Record<Importance, string> = {
  high: 'text-red-500 border-red-500/40 bg-red-500/10',
  medium: 'text-amber-500 border-amber-500/40 bg-amber-500/10',
  low: 'text-slate-400 border-slate-600/40 bg-slate-700/10',
};
const IMPORTANCE_LABEL: Record<Importance, string> = {
  high: '突发',
  medium: '重要',
  low: '普通',
};

// ─── ImportanceBadge ──────────────────────────────────────────────────────────
export function ImportanceBadge({ importance }: { importance: Importance }) {
  return (
    <span className={cn(
      'inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0',
      IMPORTANCE_COLOR[importance],
    )}>
      {IMPORTANCE_LABEL[importance]}
    </span>
  );
}

// ─── CategoryTag ──────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  '股票': 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  '债券': 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  '外汇': 'text-teal-400 bg-teal-400/10 border-teal-400/30',
  '商品': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  '指数': 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  '衍生品': 'text-pink-400 bg-pink-400/10 border-pink-400/30',
  '期权': 'text-rose-400 bg-rose-400/10 border-rose-400/30',
  '基金': 'text-green-400 bg-green-400/10 border-green-400/30',
};
export function CategoryTag({ category, className }: { category: string; className?: string }) {
  const cls = CAT_COLORS[category] || 'text-slate-400 bg-slate-700/20 border-slate-600/30';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border', cls, className)}>
      {category}
    </span>
  );
}

// ─── ChangePctLabel ───────────────────────────────────────────────────────────
export function ChangePctLabel({ value, className }: { value: number | string; className?: string }) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  const isPos = n >= 0;
  return (
    <span className={cn(
      'inline-flex items-center font-mono font-semibold tabular-nums',
      isPos ? 'text-green-500' : 'text-red-500',
      className,
    )}>
      {isPos ? '+' : ''}{typeof n === 'number' ? n.toFixed(2) : n}%
    </span>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ text = '暂无数据' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Inbox className="w-10 h-10 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  accent?: string;
  sub?: React.ReactNode;
  className?: string;
}
export function StatCard({ label, value, accent, sub, className }: StatCardProps) {
  return (
    <div className={cn('bg-card/40 rounded-lg border border-border p-3 flex flex-col gap-1', className)}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <span
        className="text-xl font-bold tabular-nums font-mono"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      {sub && <span className="text-[10px]">{sub}</span>}
    </div>
  );
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ children, accent, className }: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 mb-2', className)}>
      <span
        className="w-1 h-4 rounded shrink-0"
        style={{ background: accent || 'var(--accent)' }}
      />
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{children}</h3>
    </div>
  );
}

// ─── NewsRow ──────────────────────────────────────────────────────────────────
export function NewsRow({ item, onClick }: { item: NewsItem; onClick?: () => void }) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="border-b border-border/40 last:border-0">
      <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <ImportanceBadge importance={item.importance} />
          <span className="text-[9px] text-muted-foreground font-mono">
            {item.minutesAgo < 60 ? `${item.minutesAgo}m` : `${Math.floor(item.minutesAgo / 60)}h`}
          </span>
        </div>
        <button
          onClick={onClick}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <CategoryTag category={item.category} />
            <span className="font-mono text-[11px] font-semibold text-foreground/80">{item.symbol}</span>
            <ChangePctLabel value={item.changePct} className="text-[11px] ml-auto" />
          </div>
          <p className="text-xs leading-snug text-foreground/90 line-clamp-2">{item.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{item.summary}</p>
        </button>
        <AISummaryButton
          onClick={e => { e.stopPropagation(); setAiOpen(v => !v); }}
          active={aiOpen}
        />
      </div>
      {/* AI 摘要内联抽屉 */}
      {aiOpen && (
        <div className="mx-3 mb-2 rounded-lg border border-purple-500/20 overflow-hidden bg-card/60">
          <AISummaryDrawer
            item={item}
            onClose={() => setAiOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── NewsShell ────────────────────────────────────────────────────────────────
interface NewsShellProps {
  code: string;
  title: string;
  subtitle?: string;
  accent?: string;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  onClose?: () => void;
  onRefresh?: () => void;
  children: React.ReactNode;
  className?: string;
  /** 传入新闻列表以启用一键总结功能（取前 5 条） */
  newsItems?: NewsItem[];
}

export function NewsShell({
  code,
  title,
  subtitle,
  accent,
  icon,
  headerExtra,
  onClose,
  onRefresh,
  children,
  className,
  newsItems,
}: NewsShellProps) {
  return (
    <div className={cn('flex flex-col min-h-0 bg-background text-foreground', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span
            className="font-bold text-sm font-mono shrink-0"
            style={accent ? { color: accent } : undefined}
          >
            {code}
          </span>
          <div className="min-w-0">
            <span className="text-sm font-semibold truncate">{title}</span>
            {subtitle && (
              <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline">{subtitle}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {headerExtra}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-red-400 p-1 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 一键总结工具栏：仅当传入 newsItems 时渲染 */}
      {newsItems && newsItems.length > 0 && (
        <BatchSummaryBar items={newsItems} accent={accent} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </div>
  );
}
