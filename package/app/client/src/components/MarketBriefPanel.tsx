/**
 * AI 市场资讯摘要面板
 * 支持收缩/展开模式 + 全市场/自选两种视图
 */
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import OfficialMarketFactsBrief from '@/components/OfficialMarketFactsBrief';
import {
  Brain, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertCircle, Zap, BarChart3, MessageSquare, Loader2,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react';

const WATCHLIST_KEY = 'finance_hub_watchlist';

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
  bullish: { label: '看涨', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: TrendingUp },
  bearish: { label: '看跌', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: TrendingDown },
  neutral: { label: '中性', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: Minus },
  mixed: { label: '分化', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertCircle },
};

const IMPACT_COLORS: Record<string, string> = {
  positive: 'text-green-400',
  negative: 'text-red-400',
  neutral: 'text-slate-400',
};

const TREND_ICONS: Record<string, React.ReactNode> = {
  up: <TrendingUp className="w-3 h-3 text-green-400" />,
  down: <TrendingDown className="w-3 h-3 text-red-400" />,
  flat: <Minus className="w-3 h-3 text-slate-400" />,
};

type BriefMode = 'market' | 'watchlist';

export default function MarketBriefPanel() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedHighlight, setExpandedHighlight] = useState<number | null>(null);
  const [mode, setMode] = useState<BriefMode>('market');

  // 获取自选列表
  const watchlistSymbols = useMemo(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_KEY);
      return saved ? JSON.parse(saved) as string[] : [];
    } catch { return []; }
  }, []);

  // 全市场摘要
  const { data: marketBrief, isLoading: marketLoading, error: marketError, refetch: refetchMarket } =
    trpc.marketBrief.getDailyBrief.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: 1 });

  // 自选摘要（仅当有自选品种时查询）
  const { data: personalBrief, isLoading: personalLoading, error: personalError, refetch: refetchPersonal } =
    trpc.marketBrief.getPersonalizedBrief.useQuery(
      { symbols: watchlistSymbols },
      { enabled: watchlistSymbols.length > 0 && mode === 'watchlist', staleTime: 5 * 60 * 1000, retry: 1 }
    );

  const refreshMutation = trpc.marketBrief.refreshBrief.useMutation({
    onSuccess: () => {
      if (mode === 'market') refetchMarket();
      else refetchPersonal();
      setIsRefreshing(false);
    },
    onError: () => setIsRefreshing(false),
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMutation.mutate();
  };

  const brief = mode === 'market' ? marketBrief : personalBrief;
  const isLoading = mode === 'market' ? marketLoading : personalLoading;
  const error = mode === 'market' ? marketError : personalError;

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-3"><OfficialMarketFactsBrief /></div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-3"><OfficialMarketFactsBrief /></div>
    );
  }

  if (!brief) return <div className="h-full overflow-y-auto p-3"><OfficialMarketFactsBrief /></div>;

  const sentimentCfg = SENTIMENT_CONFIG[brief.sentiment] || SENTIMENT_CONFIG.neutral;
  const SentimentIcon = sentimentCfg.icon;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      <OfficialMarketFactsBrief />
      <details className="rounded border border-border/40">
        <summary className="cursor-pointer px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground">市场简报详情</summary>
        <div className="border-t border-border/40 p-2">
      {/* 标题栏 + 模式切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-foreground tracking-wide">AI 市场简报</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="刷新摘要"
          >
            <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 模式切换 Tab */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/30 border border-border/30">
        <button
          onClick={() => setMode('market')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all duration-200",
            mode === 'market'
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <BarChart3 className="w-3 h-3" />
          全市场
        </button>
        <button
          onClick={() => setMode('watchlist')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all duration-200",
            mode === 'watchlist'
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Star className="w-3 h-3" />
          我的自选
          {watchlistSymbols.length > 0 && (
            <span className="text-[9px] px-1 rounded-full bg-cyan-500/20 text-cyan-400">{watchlistSymbols.length}</span>
          )}
        </button>
      </div>

      {/* 自选为空提示 */}
      {mode === 'watchlist' && watchlistSymbols.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Star className="w-6 h-6 text-muted-foreground/40" />
          <p className="text-[11px] text-muted-foreground">暂无自选品种</p>
          <p className="text-[10px] text-muted-foreground/60">前往「行情数据中心」点击星标添加品种</p>
        </div>
      )}

      {/* 摘要内容 */}
      {(mode === 'market' || watchlistSymbols.length > 0) && brief && (
        <>
          {/* 情绪指标卡片 */}
          <div className={cn("rounded-md p-2 border", sentimentCfg.bg, sentimentCfg.border)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <SentimentIcon className={cn("w-3.5 h-3.5", sentimentCfg.color)} />
                <span className={cn("text-[11px] font-bold", sentimentCfg.color)}>
                  {mode === 'watchlist' ? '自选情绪' : '市场情绪'}: {sentimentCfg.label}
                </span>
              </div>
              <span className={cn("text-[11px] font-mono font-bold", sentimentCfg.color)}>
                {brief.sentimentScore > 0 ? '+' : ''}{brief.sentimentScore}
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  brief.sentimentScore > 0 ? 'bg-green-500' : brief.sentimentScore < 0 ? 'bg-red-500' : 'bg-slate-500'
                )}
                style={{ width: `${Math.min(100, Math.abs(brief.sentimentScore) + 50)}%` }}
              />
            </div>
          </div>

          {/* 市场摘要 */}
          <p className="text-[11px] leading-relaxed text-foreground/90">{brief.summary}</p>

          {/* AI 建议 */}
          <div className="rounded-md p-2 bg-cyan-500/5 border border-cyan-500/20">
            <div className="flex items-center gap-1 mb-0.5">
              <MessageSquare className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400">AI 建议</span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">{brief.tradingAdvice}</p>
          </div>

          {/* 展开/收缩按钮 */}
          <button
            onClick={() => { setIsExpanded(!isExpanded); setExpandedHighlight(null); }}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-border/50 hover:border-border hover:bg-muted/30 transition-all duration-200 group"
          >
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
              {isExpanded ? '收起详情' : '展开详情（重要动态 · 板块表现）'}
            </span>
            {isExpanded
              ? <ChevronUp className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
            }
          </button>

          {/* 可折叠详情区域 */}
          {isExpanded && (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* 重要动态 */}
              {brief.highlights.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">重要动态</span>
                  </div>
                  {brief.highlights.map((h, i) => (
                    <div key={i} className="group">
                      <button
                        onClick={() => setExpandedHighlight(expandedHighlight === i ? null : i)}
                        className="w-full flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors text-left border border-transparent hover:border-border/30"
                      >
                        <span className={cn("text-[10px] mt-0.5 flex-shrink-0", IMPACT_COLORS[h.impact])}>●</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-[11px] font-medium text-foreground">{h.title}</p>
                            <ChevronDown className={cn(
                              "w-3 h-3 text-muted-foreground/50 transition-transform duration-200 flex-shrink-0",
                              expandedHighlight === i && "rotate-180"
                            )} />
                          </div>
                          {expandedHighlight !== i && (
                            <p className="text-[10px] text-muted-foreground truncate">{h.description}</p>
                          )}
                        </div>
                      </button>
                      {expandedHighlight === i && (
                        <div className="ml-5 mt-1 mb-2 p-2 rounded-md bg-muted/20 border border-border/30 animate-in fade-in slide-in-from-top-1 duration-150">
                          <p className="text-[11px] text-foreground/90 leading-relaxed">{h.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/20">
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-medium",
                              h.impact === 'positive' ? 'bg-green-500/10 text-green-400' :
                              h.impact === 'negative' ? 'bg-red-500/10 text-red-400' :
                              'bg-slate-500/10 text-slate-400'
                            )}>
                              {h.impact === 'positive' ? '利好' : h.impact === 'negative' ? '利空' : '中性'}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60">来源: AI 市场分析</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 板块表现 */}
              {brief.sectorPerformance.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {mode === 'watchlist' ? '品种分析' : '板块表现'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {brief.sectorPerformance.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-muted/20 border border-border/30">
                        {TREND_ICONS[s.trend]}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-foreground truncate">{s.sector}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{s.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 生成时间 */}
          <p className="text-[9px] text-muted-foreground/60 text-right font-mono">
            生成于 {new Date(brief.generatedAt).toLocaleTimeString('zh-CN', { hour12: false })}
          </p>
        </>
      )}
        </div>
      </details>
    </div>
  );
}
