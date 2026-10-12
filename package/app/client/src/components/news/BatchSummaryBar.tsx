/**
 * BatchSummaryBar — 新闻列表顶部"一键总结"工具栏
 *
 * 功能：
 * - 顶部展示"一键总结"按钮
 * - 点击后调用 news.summarizeBatch，为当前列表前 5 条新闻并行生成 AI 摘要
 * - 以卡片网格形式展示每条新闻的摘要（标题 + 核心观点 + 市场影响 + 交易结论）
 * - 支持折叠/展开、重新生成
 * - 生成过程中展示骨架屏动画
 */
import { useState, useCallback } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp, RefreshCw,
  TrendingUp, TrendingDown, Minus, Loader2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import type { NewsItem } from '@/lib/newsEngine';

// ─── Types ────────────────────────────────────────────────────────────────────
type Direction = 'bullish' | 'bearish' | 'neutral';
type Strength = 'strong' | 'moderate' | 'weak';

interface SummaryResult {
  id: string;
  keyPoints: string[];
  marketImpact: { direction: Direction; strength: Strength; reason: string };
  dataPoints: Array<{ label: string; value: string }>;
  conclusion: string;
  relatedTopics: string[];
  generatedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DIR_CFG: Record<Direction, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  bullish: { label: '看多', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: <TrendingUp className="w-3 h-3" /> },
  bearish: { label: '看空', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: <TrendingDown className="w-3 h-3" /> },
  neutral: { label: '中性', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: <Minus className="w-3 h-3" /> },
};

const STRENGTH_LABEL: Record<Strength, string> = { strong: '强', moderate: '中', weak: '弱' };

// ─── Sub-components ───────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3 animate-pulse">
      <div className="h-3 bg-muted/60 rounded w-3/4" />
      <div className="h-2 bg-muted/40 rounded w-full" />
      <div className="h-2 bg-muted/40 rounded w-5/6" />
      <div className="h-2 bg-muted/40 rounded w-2/3" />
      <div className="flex gap-2 mt-2">
        <div className="h-5 w-14 bg-muted/40 rounded-full" />
        <div className="h-5 w-20 bg-muted/40 rounded-full" />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  item: NewsItem;
  result: SummaryResult;
}

function SummaryCard({ item, result }: SummaryCardProps) {
  const dir = DIR_CFG[result.marketImpact.direction];
  return (
    <div className="rounded-xl border border-border bg-card/80 overflow-hidden flex flex-col">
      {/* Card Header */}
      <div className="px-3 py-2.5 border-b border-border/60 bg-card/60">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
            {item.symbol || item.category}
          </span>
          <span
            className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ color: dir.color, background: dir.bg }}
          >
            {dir.icon}
            {dir.label} · {STRENGTH_LABEL[result.marketImpact.strength]}
          </span>
        </div>
        <p className="text-xs font-semibold leading-snug line-clamp-2">{item.title}</p>
      </div>

      {/* Key Points */}
      <div className="px-3 py-2 flex-1 space-y-1.5">
        {result.keyPoints.slice(0, 2).map((pt, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <p className="text-[11px] leading-relaxed text-foreground/85 line-clamp-2">{pt}</p>
          </div>
        ))}
      </div>

      {/* Conclusion */}
      <div className="px-3 py-2 border-t border-border/40 bg-purple-500/5">
        <p className="text-[10px] text-purple-300 font-semibold leading-snug line-clamp-2">
          {result.conclusion}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface BatchSummaryBarProps {
  /** 当前新闻列表（取前 5 条） */
  items: NewsItem[];
  /** 强调色，跟随面板主题 */
  accent?: string;
  className?: string;
}

export function BatchSummaryBar({ items, accent = '#a855f7', className }: BatchSummaryBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<SummaryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const batch = trpc.news.summarizeBatch.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setExpanded(true);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || '批量摘要生成失败，请重试');
    },
  });

  const top5 = items.slice(0, 5);

  const handleGenerate = useCallback(() => {
    if (top5.length === 0) return;
    setError(null);
    batch.mutate({
      items: top5.map(it => ({
        id: it.id,
        title: it.title,
        summary: it.summary || '',
        category: it.category || '',
        symbol: it.symbol || '',
        source: it.source || '',
        sentiment: it.sentiment || 'neutral',
        changePct: it.changePct || 0,
      })),
    });
  }, [top5, batch]);

  const isLoading = batch.isPending;
  const hasResult = results && results.length > 0;

  return (
    <div className={cn('border-b border-border/60 bg-card/30', className)}>
      {/* ── Toolbar Row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* 一键总结按钮 */}
        <button
          onClick={handleGenerate}
          disabled={isLoading || top5.length === 0}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95',
            'border disabled:opacity-40 disabled:cursor-not-allowed',
            isLoading
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 cursor-wait'
              : 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25 hover:text-purple-200'
          )}
          style={{ '--accent': accent } as React.CSSProperties}
        >
          {isLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />
          }
          {isLoading ? '正在生成…' : '一键总结'}
        </button>

        {/* 条数提示 */}
        <span className="text-[10px] text-muted-foreground">
          {top5.length > 0 ? `前 ${top5.length} 条新闻` : '暂无新闻'}
        </span>

        {/* 展开/折叠 + 重新生成 */}
        {hasResult && !isLoading && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={handleGenerate}
              className="p-1 rounded text-muted-foreground hover:text-purple-400 transition-colors"
              title="重新生成"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? '收起' : '展开'}
            </button>
          </div>
        )}

        {/* 错误提示 */}
        {error && !isLoading && (
          <div className="flex items-center gap-1.5 ml-auto text-[10px] text-red-400">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>

      {/* ── Results Panel ────────────────────────────────────────────────────── */}
      {(isLoading || (hasResult && expanded)) && (
        <div className="px-3 pb-3">
          {/* 标题行 */}
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-semibold text-purple-300">AI 批量摘要</span>
            {hasResult && !isLoading && (
              <span className="text-[10px] text-muted-foreground ml-1">
                · 共 {results!.length} 条
              </span>
            )}
          </div>

          {/* 骨架屏 / 结果卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {isLoading
              ? Array.from({ length: top5.length }).map((_, i) => <SkeletonCard key={i} />)
              : results!.map((r, i) => (
                  <SummaryCard key={r.id} item={top5[i]} result={r} />
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
