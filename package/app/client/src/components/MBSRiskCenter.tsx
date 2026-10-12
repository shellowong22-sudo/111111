/**
 * MBS 风险预警中心 — 升级版
 * 新增：状态矩阵点击交互（平滑滚动高亮）、多维度筛选、自选信号收藏
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
import {
  AlertTriangle, Shield, TrendingDown, TrendingUp, Activity,
  Zap, Eye, ChevronDown, ChevronUp, Info, Filter, Star, StarOff,
  X, CheckCircle2, SlidersHorizontal
} from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useFavoriteSignals } from '@/hooks/useFavoriteSignals';

// ─── Tooltip 组件 ─────────────────────────────────────────────────────────
export function InfoTooltip({ content, children }: { content: string; children?: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className="inline-flex items-center cursor-help">
            {children ?? <Info className="w-3 h-3 text-muted-foreground hover:text-accent transition-colors" />}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-50 max-w-xs px-3 py-2 text-xs rounded-lg border border-border bg-popover text-popover-foreground shadow-xl leading-relaxed"
            sideOffset={5}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-border" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ─── 信号徽章（带 Tooltip + 加入自选）────────────────────────────────────
export function SignalBadgeWithTooltip({
  signal, label, tooltip, panelId, panelName, value
}: {
  signal: 'buy' | 'sell' | 'neutral' | 'warning';
  label: string; tooltip: string;
  panelId?: string; panelName?: string; value?: string;
}) {
  const { addFavorite, removeFavorite, isFavorite, signals } = useFavoriteSignals();
  const fav = panelId ? isFavorite(panelId, label) : false;
  const favId = panelId ? signals.find(s => s.panelId === panelId && s.label === label)?.id : undefined;

  const colors = {
    buy: 'bg-green-500/20 text-green-400 border-green-500/40',
    sell: 'bg-red-500/20 text-red-400 border-red-500/40',
    neutral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    warning: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  };
  const icons = {
    buy: <TrendingUp className="w-3 h-3" />,
    sell: <TrendingDown className="w-3 h-3" />,
    neutral: <Activity className="w-3 h-3" />,
    warning: <AlertTriangle className="w-3 h-3" />,
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!panelId || !panelName) return;
    if (fav && favId) {
      removeFavorite(favId);
    } else {
      addFavorite({ panelId, panelName, signal, label, value, tooltip });
    }
  };

  return (
    <InfoTooltip content={tooltip}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold cursor-help group ${colors[signal]}`}>
        {icons[signal]} {label}
        {panelId && (
          <button
            onClick={handleFav}
            className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            title={fav ? '取消自选' : '加入自选'}
          >
            {fav
              ? <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
              : <Star className="w-2.5 h-2.5 text-muted-foreground" />
            }
          </button>
        )}
      </span>
    </InfoTooltip>
  );
}

// ─── 26 个功能模块状态矩阵数据 ────────────────────────────────────────────
const MODULE_MATRIX = [
  { id: '1',  name: 'SecInfo',    riskType: '流动性', group: 'A' },
  { id: '2',  name: 'SECF',       riskType: '提前还款', group: 'A' },
  { id: '3',  name: 'MTGS',       riskType: '模型风险', group: 'A' },
  { id: '4',  name: 'MTGH',       riskType: '提前还款', group: 'A' },
  { id: '5',  name: '新发行',     riskType: '流动性', group: 'A' },
  { id: '6',  name: 'MCAL',       riskType: '信用风险', group: 'A' },
  { id: '7',  name: 'IMGR',       riskType: '流动性', group: 'B' },
  { id: '8',  name: 'STSH',       riskType: '模型风险', group: 'B' },
  { id: '9',  name: '当前市场',   riskType: '市场风险', group: 'B' },
  { id: '10', name: 'TBPF',       riskType: '流动性', group: 'B' },
  { id: '11', name: '评级趋势',   riskType: '信用风险', group: 'B' },
  { id: '12', name: 'BMMI',       riskType: '市场风险', group: 'B' },
  { id: '13', name: '新闻研究',   riskType: '市场风险', group: 'C' },
  { id: '14', name: 'FIRS',       riskType: '流动性', group: 'C' },
  { id: '15', name: 'NI',         riskType: '流动性', group: 'C' },
  { id: '16', name: 'GN分析',     riskType: '信用风险', group: 'C' },
  { id: '17', name: 'DES',        riskType: '模型风险', group: 'C' },
  { id: '18', name: 'YT',         riskType: '市场风险', group: 'C' },
  { id: '19', name: 'FIBC',       riskType: '模型风险', group: 'D' },
  { id: '20', name: 'Q报价',      riskType: '流动性', group: 'D' },
  { id: '21', name: 'CMAP',       riskType: '信用风险', group: 'D' },
  { id: '22', name: '抵押债指数', riskType: '市场风险', group: 'D' },
  { id: '23', name: 'MCCN',       riskType: '流动性', group: 'D' },
  { id: '24', name: '资产类别',   riskType: '市场风险', group: 'D' },
  { id: '25', name: 'RMBS/CMBS',  riskType: '信用风险', group: 'D' },
  { id: '26', name: '成交量',     riskType: '流动性', group: 'D' },
];

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type RiskType = '流动性' | '信用风险' | '模型风险' | '市场风险' | '提前还款' | '监管风险' | '全部';

// ─── 风险评分卡 ───────────────────────────────────────────────────────────
function RiskScoreCard({ label, score, color, tooltip }: {
  label: string; score: number; color: string; tooltip: string;
}) {
  const pct = Math.min(100, score);
  const level = pct > 70 ? 'HIGH' : pct > 40 ? 'MED' : 'LOW';
  const levelColor = pct > 70 ? 'text-red-400' : pct > 40 ? 'text-orange-400' : 'text-green-400';
  return (
    <InfoTooltip content={tooltip}>
      <div className="p-2 rounded border border-border bg-muted/10 cursor-help hover:border-accent/40 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={`text-xs font-bold ${levelColor}`}>{level}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted/20 rounded-full h-1.5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
          </div>
          <span className="text-xs font-mono font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
    </InfoTooltip>
  );
}

// ─── 预警条目 ─────────────────────────────────────────────────────────────
function AlertItem({ level, source, message, value, tooltip, timestamp, riskType, onModuleClick }: {
  level: RiskLevel; source: string; message: string; value?: string;
  tooltip: string; timestamp: string; riskType: string;
  onModuleClick?: (moduleId: string) => void;
}) {
  const cfg = {
    critical: { bg: 'bg-red-500/10 border-red-500/50', icon: 'text-red-400', dot: 'bg-red-500' },
    high:     { bg: 'bg-orange-500/10 border-orange-500/40', icon: 'text-orange-400', dot: 'bg-orange-500' },
    medium:   { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: 'text-yellow-400', dot: 'bg-yellow-500' },
    low:      { bg: 'bg-blue-500/10 border-blue-500/30', icon: 'text-blue-400', dot: 'bg-blue-500' },
  }[level];

  // 从 source 提取模块 ID（如 "IMGR-7" → "7"）
  const moduleId = source.match(/-(\d+)$/)?.[1];

  return (
    <InfoTooltip content={tooltip}>
      <div className={`flex items-start gap-2 p-2 rounded border text-xs cursor-help hover:opacity-90 transition-opacity ${cfg.bg}`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${cfg.dot} animate-pulse`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            <button
              className={`font-bold text-xs ${cfg.icon} hover:underline cursor-pointer`}
              onClick={() => moduleId && onModuleClick?.(moduleId)}
              title={`点击跳转到功能 ${moduleId}`}
            >
              [{source}]
            </button>
            <span className="text-foreground">{message}</span>
            {value && <span className={`ml-auto font-mono font-bold flex-shrink-0 ${cfg.icon}`}>{value}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{timestamp}</span>
            <span className="px-1 py-0.5 rounded text-xs bg-muted/20 text-muted-foreground">{riskType}</span>
          </div>
        </div>
      </div>
    </InfoTooltip>
  );
}

// ─── 主组件：风险预警中心 ─────────────────────────────────────────────────
export function FavoriteSignalsSidebar({ onClose }: { onClose?: () => void }) {
  const { signals, removeFavorite, clearAll } = useFavoriteSignals();

  const signalColors = {
    buy:     'bg-green-500/20 text-green-400 border-green-500/40',
    sell:    'bg-red-500/20 text-red-400 border-red-500/40',
    neutral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    warning: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  };
  const signalIcons = {
    buy:     <TrendingUp className="w-3 h-3" />,
    sell:    <TrendingDown className="w-3 h-3" />,
    neutral: <Activity className="w-3 h-3" />,
    warning: <AlertTriangle className="w-3 h-3" />,
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        <span className="font-bold text-sm">自选信号追踪</span>
        <span className="text-xs text-muted-foreground ml-1">({signals.length})</span>
        {signals.length > 0 && (
          <button
            onClick={clearAll}
            className="ml-auto text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" /> 清空
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs text-center gap-2">
            <StarOff className="w-8 h-8 opacity-30" />
            <p>暂无自选信号</p>
            <p className="text-xs opacity-60">在任意功能面板的信号标签上<br />悬停后点击 ☆ 即可加入自选</p>
          </div>
        ) : (
          signals.map(sig => (
            <div
              key={sig.id}
              className="p-2 rounded border border-border bg-muted/10 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs text-muted-foreground font-mono">[{sig.panelName}]</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold ${signalColors[sig.signal]}`}>
                  {signalIcons[sig.signal]} {sig.label}
                </span>
                {sig.value && <span className="text-xs font-mono text-foreground ml-auto">{sig.value}</span>}
                <button
                  onClick={() => removeFavorite(sig.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors ml-1"
                  title="取消自选"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{sig.tooltip}</p>
              <span className="text-xs text-muted-foreground/50 mt-0.5 block">
                {new Date(sig.addedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 入口改为实时风险预警版本
export { MBSRiskCenter } from "./live/MBSRiskLive";
