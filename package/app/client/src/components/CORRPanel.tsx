/**
 * CORRPanel.tsx — CORR 我的相关系数矩阵
 * Bloomberg Terminal 风格，真实 Yahoo Finance 数据
 * 功能：热力图矩阵 / 协方差 / Beta / 散点图 / 自定义标的 / 预设分组
 */
import React, { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
  PieChart, Pie,
} from 'recharts';
import { X, Plus, Trash2, RefreshCw, ChevronDown, BarChart2, Grid, TrendingUp, FlaskConical, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataLoadingSkeleton } from '@/components/ChartSkeleton';

interface CORRPanelProps {
  onClose: () => void;
}

type CalcType = 'correlation' | 'covariance' | 'beta';
type RangeType = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';
type ViewMode = 'matrix' | 'scatter' | 'stats' | 'lab';

// ─── 颜色映射 ─────────────────────────────────────────────────────────────────
function getCorrBg(val: number, calcType: CalcType): string {
  if (calcType === 'correlation') {
    if (val >= 0.9) return '#0a2a0a';
    if (val >= 0.7) return '#0d3a0d';
    if (val >= 0.5) return '#0a2a0a';
    if (val >= 0.3) return '#071a07';
    if (val >= 0) return '#0d0d0d';
    if (val >= -0.3) return '#1a0707';
    if (val >= -0.5) return '#2a0a0a';
    if (val >= -0.7) return '#3a0d0d';
    return '#4a1010';
  }
  // covariance / beta: use magnitude
  const abs = Math.abs(val);
  if (abs > 0.5) return val > 0 ? '#0a2a0a' : '#3a0d0d';
  if (abs > 0.2) return val > 0 ? '#071a07' : '#2a0a0a';
  if (abs > 0.05) return val > 0 ? '#071207' : '#1a0707';
  return '#0d0d0d';
}

function getCorrText(val: number, calcType: CalcType): string {
  if (calcType === 'correlation') {
    if (val >= 0.7) return '#00e676';
    if (val >= 0.3) return '#69f0ae';
    if (val >= 0) return '#b9f6ca';
    if (val >= -0.3) return '#ff8a80';
    if (val >= -0.7) return '#ff5252';
    return '#ff1744';
  }
  return val > 0 ? '#69f0ae' : '#ff5252';
}

function formatValue(val: number, calcType: CalcType): string {
  if (calcType === 'correlation') return val.toFixed(3);
  if (calcType === 'covariance') return val.toFixed(5);
  return val.toFixed(3);
}

// ─── 预设分组按钮 ─────────────────────────────────────────────────────────────
const RANGE_LABELS: Record<RangeType, string> = {
  '1mo': '1个月', '3mo': '3个月', '6mo': '6个月',
  '1y': '1年', '2y': '2年', '5y': '5年',
};

const CALC_LABELS: Record<CalcType, string> = {
  correlation: '相关系数', covariance: '协方差', beta: 'Beta',
};

// ─── 本地类型定义（避免 tRPC 联合类型推断问题） ───────────────────────────────
interface MatrixCol {
  col: string;
  colLabel: string;
  value: number;
}

interface MatrixRow {
  row: string;
  rowLabel: string;
  cols: MatrixCol[];
  annualizedVol: number;
  sharpe: number;
}

interface LatestPrice {
  price: number;
  change: number;
  changePct: number;
  currency: string;
}

interface MatrixResult {
  success: boolean;
  error?: string;
  matrix: MatrixRow[];
  tickers: string[];
  latestPrices?: Record<string, LatestPrice>;
  failedTickers: string[];
  dataPoints: number;
  range: string;
  calcType: string;
  timestamp?: string;
}

interface ScatterResult {
  success: boolean;
  points: { x: number; y: number }[];
  correlation: number;
  labelX?: string;
  labelY?: string;
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function CORRPanel({ onClose }: CORRPanelProps) {
  const [calcType, setCalcType] = useState<CalcType>('correlation');
  const [range, setRange] = useState<RangeType>('1y');
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [customTickers, setCustomTickers] = useState<string[]>([
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META',
  ]);
  const [inputTicker, setInputTicker] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [scatterX, setScatterX] = useState('');
  const [scatterY, setScatterY] = useState('');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showCalcMenu, setShowCalcMenu] = useState(false);

  // ── tRPC 查询 ──────────────────────────────────────────────────────────────
  const { data: presets } = trpc.corr.getPresets.useQuery();

  const {
    data: matrixData,
    isLoading,
    refetch,
    error,
  } = trpc.corr.computeMatrix.useQuery(
    { tickers: customTickers, range, calcType },
    {
      enabled: customTickers.length >= 2,
      staleTime: 5 * 60 * 1000, // 5 分钟缓存
    }
  );

  const scatterEnabled = viewMode === 'scatter' && scatterX !== '' && scatterY !== '' && scatterX !== scatterY;
  const { data: scatterData, isLoading: scatterLoading } = trpc.corr.getScatterData.useQuery(
    { tickerX: scatterX, tickerY: scatterY, range: range === '5y' ? '2y' : range },
    { enabled: scatterEnabled, staleTime: 5 * 60 * 1000 }
  );

  // ── 标的管理 ───────────────────────────────────────────────────────────────
  const addTicker = useCallback(() => {
    const t = inputTicker.trim().toUpperCase();
    if (!t) return;
    if (customTickers.includes(t)) {
      toast.error(`${t} 已在列表中`);
      return;
    }
    if (customTickers.length >= 15) {
      toast.error('最多支持 15 个标的');
      return;
    }
    setCustomTickers(prev => [...prev, t]);
    setInputTicker('');
  }, [inputTicker, customTickers]);

  const removeTicker = useCallback((ticker: string) => {
    if (customTickers.length <= 2) {
      toast.error('至少需要 2 个标的');
      return;
    }
    setCustomTickers(prev => prev.filter(t => t !== ticker));
  }, [customTickers]);

  const loadPreset = useCallback((tickers: string[]) => {
    setCustomTickers(tickers);
    setShowPresets(false);
    toast.success('已加载预设分组');
  }, []);

  // ── 散点图标的选择 ─────────────────────────────────────────────────────────
  const availableTickers = matrixData?.tickers ?? customTickers;
  const scatterXFinal = scatterX || availableTickers[0] || '';
  const scatterYFinal = scatterY || availableTickers[1] || '';

  // ── 矩阵统计 ──────────────────────────────────────────────────────────────
  const matrixStats = useMemo(() => {
    if (!matrixData?.matrix) return null;
    const offDiag: number[] = [];
    for (const row of matrixData.matrix) {
      for (const col of row.cols) {
        if (col.col !== row.row) offDiag.push(col.value);
      }
    }
    if (offDiag.length === 0) return null;
    const avg = offDiag.reduce((a, b) => a + b, 0) / offDiag.length;
    const max = Math.max(...offDiag);
    const min = Math.min(...offDiag);
    return { avg: avg.toFixed(3), max: max.toFixed(3), min: min.toFixed(3), count: offDiag.length };
  }, [matrixData]);

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs select-none">
      {/* ── 顶部信息栏 ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#0a0a0a] border-b border-[#333] shrink-0">
        <span className="text-[#f5a623] font-bold text-sm">CORR</span>
        <span className="text-[#aaa]">我的相关系数矩阵</span>
        <span className="text-[#555]">|</span>
        <span className="text-[#aaa]">{customTickers.length} 个标的</span>
        {matrixData?.dataPoints && (
          <>
            <span className="text-[#555]">|</span>
            <span className="text-[#aaa]">{matrixData.dataPoints} 个交易日</span>
          </>
        )}
        {matrixData?.timestamp && (
          <>
            <span className="text-[#555]">|</span>
            <span className="text-[#555]">
              更新: {new Date(matrixData.timestamp).toLocaleTimeString('zh-CN')}
            </span>
          </>
        )}
        <button
          onClick={() => refetch()}
          className="ml-auto text-[#aaa] hover:text-[#f5a623] transition-colors"
          title="刷新数据"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={onClose} className="text-[#aaa] hover:text-white ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── 功能按钮栏 ── */}
      <div className="flex items-center gap-1 px-3 py-1 bg-[#8b0000] border-b border-[#333] shrink-0 flex-wrap">
        {/* 视图切换 */}
        <button
          onClick={() => setViewMode('matrix')}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs transition-colors ${
            viewMode === 'matrix' ? 'text-white bg-[#aa0000]' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <Grid className="w-3 h-3" />矩阵
        </button>
        <button
          onClick={() => setViewMode('scatter')}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs transition-colors ${
            viewMode === 'scatter' ? 'text-white bg-[#aa0000]' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <BarChart2 className="w-3 h-3" />散点图
        </button>
        <button
          onClick={() => setViewMode('stats')}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs transition-colors ${
            viewMode === 'stats' ? 'text-white bg-[#aa0000]' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <TrendingUp className="w-3 h-3" />统计
        </button>
        <button
          onClick={() => setViewMode('lab')}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs transition-colors ${
            viewMode === 'lab' ? 'text-white bg-[#aa0000]' : 'text-[#aaa] hover:text-white'
          }`}
        >
          <FlaskConical className="w-3 h-3" />配对/对冲实验室
        </button>

        <span className="text-[#555] mx-1">|</span>

        {/* 计算类型 */}
        <div className="relative">
          <button
            onClick={() => { setShowCalcMenu(v => !v); setShowRangeMenu(false); }}
            className="flex items-center gap-1 px-2 py-0.5 text-[#f5a623] hover:text-white transition-colors"
          >
            {CALC_LABELS[calcType]} <ChevronDown className="w-3 h-3" />
          </button>
          {showCalcMenu && (
            <div className="absolute top-full left-0 mt-1 bg-[#111] border border-[#333] z-50 min-w-28">
              {(Object.keys(CALC_LABELS) as CalcType[]).map(ct => (
                <button
                  key={ct}
                  onClick={() => { setCalcType(ct); setShowCalcMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 hover:bg-[#222] transition-colors ${
                    calcType === ct ? 'text-[#f5a623]' : 'text-[#aaa]'
                  }`}
                >
                  {CALC_LABELS[ct]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 时间范围 */}
        <div className="relative">
          <button
            onClick={() => { setShowRangeMenu(v => !v); setShowCalcMenu(false); }}
            className="flex items-center gap-1 px-2 py-0.5 text-[#f5a623] hover:text-white transition-colors"
          >
            {RANGE_LABELS[range]} <ChevronDown className="w-3 h-3" />
          </button>
          {showRangeMenu && (
            <div className="absolute top-full left-0 mt-1 bg-[#111] border border-[#333] z-50 min-w-24">
              {(Object.keys(RANGE_LABELS) as RangeType[]).map(r => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setShowRangeMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 hover:bg-[#222] transition-colors ${
                    range === r ? 'text-[#f5a623]' : 'text-[#aaa]'
                  }`}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-[#555] mx-1">|</span>

        {/* 预设分组 */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(v => !v)}
            className="flex items-center gap-1 px-2 py-0.5 text-[#aaa] hover:text-white transition-colors"
          >
            预设分组 <ChevronDown className="w-3 h-3" />
          </button>
          {showPresets && (
            <div className="absolute top-full left-0 mt-1 bg-[#111] border border-[#333] z-50 min-w-36">
              {presets?.map(p => (
                <button
                  key={p.id}
                  onClick={() => loadPreset(p.tickers)}
                  className="block w-full text-left px-3 py-1.5 hover:bg-[#222] text-[#aaa] hover:text-white transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 标的管理栏 ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border-b border-[#222] shrink-0 flex-wrap">
        <span className="text-[#555]">标的：</span>
        {customTickers.map(ticker => (
          <div
            key={ticker}
            className="flex items-center gap-1 bg-[#1a1a1a] border border-[#333] px-2 py-0.5 rounded group"
          >
            <span className="text-[#f5a623] text-xs">{ticker}</span>
            <button
              onClick={() => removeTicker(ticker)}
              className="text-[#555] hover:text-[#ff5252] transition-colors opacity-0 group-hover:opacity-100"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={inputTicker}
            onChange={e => setInputTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker()}
            placeholder="输入代码..."
            className="bg-[#111] border border-[#333] text-white px-2 py-0.5 w-24 text-xs focus:outline-none focus:border-[#f5a623]"
          />
          <button
            onClick={addTicker}
            className="text-[#aaa] hover:text-[#f5a623] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {matrixData?.failedTickers && matrixData.failedTickers.length > 0 && (
          <span className="text-[#ff5252] text-xs ml-2">
            无数据: {matrixData.failedTickers.join(', ')}
          </span>
        )}
      </div>

      {/* ── 主内容区 ── */}
      <div className="flex-1 overflow-auto p-2">
        {viewMode !== 'lab' && isLoading && (
          <DataLoadingSkeleton variant="table" rows={customTickers.length} cols={customTickers.length + 3} label={`正在计算 ${customTickers.length} 个标的的${CALC_LABELS[calcType]}`} />
        )}

        {viewMode !== 'lab' && error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[#ff5252]">
              <div className="text-lg mb-2">数据加载失败</div>
              <div className="text-[#aaa] text-xs">{error.message}</div>
              <button
                onClick={() => refetch()}
                className="mt-3 px-4 py-1.5 bg-[#8b0000] hover:bg-[#aa0000] text-white transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {viewMode !== 'lab' && !isLoading && !error && matrixData && (
          <>
            {/* ── 矩阵视图 ── */}
            {viewMode === 'matrix' && (
              <MatrixView
                matrixData={matrixData}
                calcType={calcType}
                onSelectScatter={(x, y) => {
                  setScatterX(x);
                  setScatterY(y);
                  setViewMode('scatter');
                }}
              />
            )}

            {/* ── 散点图视图 ── */}
            {viewMode === 'scatter' && (
              <ScatterView
                tickers={matrixData.tickers}
                scatterX={scatterXFinal}
                scatterY={scatterYFinal}
                onChangeX={setScatterX}
                onChangeY={setScatterY}
                scatterData={scatterData}
                scatterLoading={scatterLoading}
              />
            )}

            {/* ── 统计视图 ── */}
            {viewMode === 'stats' && (
              <StatsView
                matrixData={matrixData}
                calcType={calcType}
                matrixStats={matrixStats}
              />
            )}
          </>
        )}

        {/* ── 配对/对冲实验室（独立于矩阵加载状态） ── */}
        {viewMode === 'lab' && (
          <LabView tickers={customTickers} />
        )}

        {viewMode !== 'lab' && !isLoading && !error && !matrixData && customTickers.length >= 2 && (
          <div className="flex items-center justify-center h-full text-[#555]">
            点击刷新按钮加载数据
          </div>
        )}
      </div>

      {/* ── 底部状态栏 ── */}
      <div className="flex items-center gap-4 px-3 py-1 bg-[#0a0a0a] border-t border-[#222] shrink-0">
                <span className="text-[#555]">收益率类型: 对数收益率</span>
        {matrixStats && (
          <>
            <span className="text-[#555]">|</span>
            <span className="text-[#aaa]">
              平均相关系数: <span className="text-[#f5a623]">{matrixStats.avg}</span>
            </span>
            <span className="text-[#aaa]">
              最高: <span className="text-[#00e676]">{matrixStats.max}</span>
            </span>
            <span className="text-[#aaa]">
              最低: <span className="text-[#ff5252]">{matrixStats.min}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 矩阵视图子组件 ───────────────────────────────────────────────────────────
function MatrixView({
  matrixData,
  calcType,
  onSelectScatter,
}: {
  matrixData: MatrixResult;
  calcType: CalcType;
  onSelectScatter: (x: string, y: string) => void;
}) {
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null);

  if (!matrixData.success || !matrixData.matrix.length) {
    return (
      <div className="flex items-center justify-center h-full text-[#ff5252]">
        {matrixData.error ?? '无数据'}
      </div>
    );
  }

  const tickers = matrixData.tickers;

  return (
    <div className="space-y-3">
      {/* 矩阵表格 */}
      <div className="overflow-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-28 text-left px-2 py-1 text-[#555] border-b border-[#222]">标的</th>
              {tickers.map(ticker => (
                <th
                  key={ticker}
                  className="text-center px-1 py-1 text-[#f5a623] border-b border-[#222] min-w-16"
                >
                  {ticker.replace('=X', '').replace('^', '').slice(0, 8)}
                </th>
              ))}
              <th className="text-center px-2 py-1 text-[#555] border-b border-[#222] min-w-16">年化波动率</th>
              <th className="text-center px-2 py-1 text-[#555] border-b border-[#222] min-w-12">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.matrix.map(row => {
              const latest = matrixData.latestPrices?.[row.row];
              return (
                <tr key={row.row} className="hover:bg-[#0d0d0d] transition-colors">
                  <td className="px-2 py-1 border-b border-[#111]">
                    <div className="text-[#f5a623] font-bold">
                      {row.row.replace('=X', '').replace('^', '')}
                    </div>
                    <div className="text-[#555] text-[10px] truncate max-w-24">{row.rowLabel}</div>
                    {latest && (
                      <div className={`text-[10px] ${latest.changePct >= 0 ? 'text-[#00e676]' : 'text-[#ff5252]'}`}>
                        {latest.changePct >= 0 ? '+' : ''}{latest.changePct.toFixed(2)}%
                      </div>
                    )}
                  </td>
                  {row.cols.map(col => {
                    const isDiag = col.col === row.row;
                    const isHovered = hoveredCell?.row === row.row || hoveredCell?.col === col.col;
                    return (
                      <td
                        key={col.col}
                        className={`text-center px-1 py-2 border-b border-[#111] cursor-pointer transition-all ${
                          isHovered && !isDiag ? 'ring-1 ring-[#f5a623] ring-inset' : ''
                        }`}
                        style={{
                          backgroundColor: isDiag ? '#1a3a5c' : getCorrBg(col.value, calcType),
                          color: isDiag ? '#4a90e2' : getCorrText(col.value, calcType),
                        }}
                        onMouseEnter={() => setHoveredCell({ row: row.row, col: col.col })}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => !isDiag && onSelectScatter(row.row, col.col)}
                        title={isDiag ? row.row : `${row.rowLabel} vs ${col.colLabel}: ${formatValue(col.value, calcType)}\n点击查看散点图`}
                      >
                        <span className="font-mono text-xs">
                          {isDiag ? '1.000' : formatValue(col.value, calcType)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-1 border-b border-[#111] text-[#aaa] font-mono">
                    {row.annualizedVol.toFixed(1)}%
                  </td>
                  <td className={`text-center px-2 py-1 border-b border-[#111] font-mono ${
                    row.sharpe >= 1 ? 'text-[#00e676]' : row.sharpe >= 0 ? 'text-[#aaa]' : 'text-[#ff5252]'
                  }`}>
                    {row.sharpe.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 图例 */}
      {calcType === 'correlation' && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[#555]">图例：</span>
          {[
            { label: '强正相关 (≥0.7)', bg: '#0a2a0a', text: '#00e676' },
            { label: '弱正相关 (0~0.7)', bg: '#071207', text: '#b9f6ca' },
            { label: '弱负相关 (-0.7~0)', bg: '#1a0707', text: '#ff8a80' },
            { label: '强负相关 (≤-0.7)', bg: '#3a0d0d', text: '#ff1744' },
            { label: '对角线', bg: '#1a3a5c', text: '#4a90e2' },
          ].map(item => (
            <div
              key={item.label}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px]"
              style={{ backgroundColor: item.bg, color: item.text }}
            >
              {item.label}
            </div>
          ))}
          <span className="text-[#555] text-[10px] ml-2">点击非对角线单元格查看散点图</span>
        </div>
      )}
    </div>
  );
}

// ─── 散点图视图子组件 ─────────────────────────────────────────────────────────
function ScatterView({
  tickers,
  scatterX,
  scatterY,
  onChangeX,
  onChangeY,
  scatterData,
  scatterLoading,
}: {
  tickers: string[];
  scatterX: string;
  scatterY: string;
  onChangeX: (t: string) => void;
  onChangeY: (t: string) => void;
  scatterData: { success: boolean; points: { x: number; y: number }[]; correlation: number; labelX?: string; labelY?: string } | null | undefined;
  scatterLoading: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* 标的选择 */}
      <div className="flex items-center gap-3">
        <span className="text-[#555]">X 轴：</span>
        <select
          value={scatterX}
          onChange={e => onChangeX(e.target.value)}
          className="bg-[#111] border border-[#333] text-[#f5a623] px-2 py-0.5 text-xs focus:outline-none focus:border-[#f5a623]"
        >
          {tickers.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-[#555]">Y 轴：</span>
        <select
          value={scatterY}
          onChange={e => onChangeY(e.target.value)}
          className="bg-[#111] border border-[#333] text-[#f5a623] px-2 py-0.5 text-xs focus:outline-none focus:border-[#f5a623]"
        >
          {tickers.filter(t => t !== scatterX).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {scatterData?.correlation !== undefined && (
          <div className="ml-4 flex items-center gap-2">
            <span className="text-[#555]">Pearson r =</span>
            <span
              className="font-mono font-bold text-sm"
              style={{ color: getCorrText(scatterData.correlation, 'correlation') }}
            >
              {scatterData.correlation.toFixed(4)}
            </span>
          </div>
        )}
      </div>

      {scatterLoading && (
        <DataLoadingSkeleton variant="area" height={320} label="正在加载收益率散点图" />
      )}

      {!scatterLoading && scatterData?.success && scatterData.points.length > 0 && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis
                dataKey="x"
                type="number"
                name={scatterData.labelX ?? scatterX}
                label={{ value: `${scatterData.labelX ?? scatterX} 日收益率 (%)`, position: 'bottom', fill: '#555', fontSize: 10 }}
                tick={{ fill: '#555', fontSize: 10 }}
                tickFormatter={v => `${v.toFixed(1)}%`}
              />
              <YAxis
                dataKey="y"
                type="number"
                name={scatterData.labelY ?? scatterY}
                label={{ value: `${scatterData.labelY ?? scatterY} 日收益率 (%)`, angle: -90, position: 'insideLeft', fill: '#555', fontSize: 10 }}
                tick={{ fill: '#555', fontSize: 10 }}
                tickFormatter={v => `${v.toFixed(1)}%`}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#444' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload as { x: number; y: number };
                  return (
                    <div className="bg-[#111] border border-[#333] px-2 py-1 text-xs">
                      <div className="text-[#f5a623]">{scatterData.labelX ?? scatterX}: {d.x.toFixed(3)}%</div>
                      <div className="text-[#69f0ae]">{scatterData.labelY ?? scatterY}: {d.y.toFixed(3)}%</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={scatterData.points}
                fill="#f5a623"
                opacity={0.5}
              >
                {scatterData.points.map((_, i) => (
                  <Cell key={i} fill={scatterData.correlation >= 0 ? '#f5a623' : '#ff5252'} opacity={0.4} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {!scatterLoading && scatterData && !scatterData.success && (
        <div className="text-[#ff5252] text-center py-8">散点图数据加载失败</div>
      )}
    </div>
  );
}

// ─── 统计视图子组件 ───────────────────────────────────────────────────────────
function StatsView({
  matrixData,
  calcType,
  matrixStats,
}: {
  matrixData: MatrixResult;
  calcType: CalcType;
  matrixStats: { avg: string; max: string; min: string; count: number } | null;
}) {
  if (!matrixData.success || !matrixData.matrix.length) {
    return <div className="text-[#ff5252] text-center py-8">{matrixData.error ?? '无数据'}</div>;
  }

  // 找最高/最低相关系数对
  let maxPair = { row: '', col: '', val: -Infinity };
  let minPair = { row: '', col: '', val: Infinity };
  for (const row of matrixData.matrix) {
    for (const col of row.cols) {
      if (col.col === row.row) continue;
      if (col.value > maxPair.val) maxPair = { row: row.row, col: col.col, val: col.value };
      if (col.value < minPair.val) minPair = { row: row.row, col: col.col, val: col.value };
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 汇总统计 */}
      <div className="bg-[#0a0a0a] border border-[#222] p-3">
        <div className="text-[#f5a623] font-bold mb-3 border-b border-[#222] pb-1">矩阵汇总</div>
        <div className="space-y-2">
          <StatRow label="有效标的数" value={`${matrixData.tickers.length} 个`} />
          <StatRow label="数据点数" value={`${matrixData.dataPoints} 个交易日`} />
          <StatRow label="计算类型" value={CALC_LABELS[calcType]} />
          {matrixStats && (
            <>
              <StatRow label="平均相关系数" value={matrixStats.avg} color="#f5a623" />
              <StatRow label="最高相关系数" value={matrixStats.max} color="#00e676" />
              <StatRow label="最低相关系数" value={matrixStats.min} color="#ff5252" />
            </>
          )}
        </div>
      </div>

      {/* 最高/最低相关对 */}
      <div className="bg-[#0a0a0a] border border-[#222] p-3">
        <div className="text-[#f5a623] font-bold mb-3 border-b border-[#222] pb-1">极值对</div>
        <div className="space-y-3">
          <div>
            <div className="text-[#555] text-[10px] mb-1">最强正相关</div>
            <div className="flex items-center gap-2">
              <span className="text-[#f5a623]">{maxPair.row}</span>
              <span className="text-[#555]">↔</span>
              <span className="text-[#f5a623]">{maxPair.col}</span>
              <span className="text-[#00e676] font-mono ml-auto">{maxPair.val.toFixed(4)}</span>
            </div>
          </div>
          <div>
            <div className="text-[#555] text-[10px] mb-1">最强负相关</div>
            <div className="flex items-center gap-2">
              <span className="text-[#f5a623]">{minPair.row}</span>
              <span className="text-[#555]">↔</span>
              <span className="text-[#f5a623]">{minPair.col}</span>
              <span className="text-[#ff5252] font-mono ml-auto">{minPair.val.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 各标的统计 */}
      <div className="col-span-2 bg-[#0a0a0a] border border-[#222] p-3">
        <div className="text-[#f5a623] font-bold mb-3 border-b border-[#222] pb-1">各标的风险指标</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[#555] border-b border-[#222]">
              <th className="text-left py-1 px-2">代码</th>
              <th className="text-left py-1 px-2">名称</th>
              <th className="text-right py-1 px-2">最新价</th>
              <th className="text-right py-1 px-2">涨跌幅</th>
              <th className="text-right py-1 px-2">年化波动率</th>
              <th className="text-right py-1 px-2">Sharpe Ratio</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.matrix.map(row => {
              const latest = matrixData.latestPrices?.[row.row];
              return (
                <tr key={row.row} className="border-b border-[#111] hover:bg-[#0d0d0d]">
                  <td className="py-1.5 px-2 text-[#f5a623] font-bold">
                    {row.row.replace('=X', '').replace('^', '')}
                  </td>
                  <td className="py-1.5 px-2 text-[#aaa]">{row.rowLabel}</td>
                  <td className="py-1.5 px-2 text-right text-white font-mono">
                    {latest ? latest.price.toFixed(2) : '—'}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-mono ${
                    (latest?.changePct ?? 0) >= 0 ? 'text-[#00e676]' : 'text-[#ff5252]'
                  }`}>
                    {latest ? `${latest.changePct >= 0 ? '+' : ''}${latest.changePct.toFixed(2)}%` : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right text-[#aaa] font-mono">
                    {row.annualizedVol.toFixed(1)}%
                  </td>
                  <td className={`py-1.5 px-2 text-right font-mono ${
                    row.sharpe >= 1 ? 'text-[#00e676]' : row.sharpe >= 0 ? 'text-[#aaa]' : 'text-[#ff5252]'
                  }`}>
                    {row.sharpe.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#555]">{label}</span>
      <span className="font-mono" style={{ color: color ?? '#aaa' }}>{value}</span>
    </div>
  );
}

// ─── 配对/对冲实验室子组件 ─────────────────────────────────────────────────────
// CORR 招牌功能：① 滚动相关性 ② 配对交易信号 ③ 最小方差组合（与 GC/CRVF 零重叠）
function LabView({ tickers }: { tickers: string[] }) {
  const [pairA, setPairA] = useState(tickers[0] ?? 'PFF');
  const [pairB, setPairB] = useState(tickers[1] ?? 'TLT');
  const [rcRange, setRcRange] = useState<'6mo' | '1y' | '2y'>('1y');
  const [rcWindow, setRcWindow] = useState(60);
  const [entryZ, setEntryZ] = useState(2);
  // 对冲授权确认弹窗
  const [hedgeOpen, setHedgeOpen] = useState(false);
  const [hedgeConfirmed, setHedgeConfirmed] = useState(false);

  const rolling = trpc.corr.rollingCorrelation.useQuery(
    { tickerA: pairA, tickerB: pairB, range: rcRange, window: rcWindow },
    { enabled: !!pairA && !!pairB && pairA !== pairB, staleTime: 5 * 60 * 1000 }
  );
  const pair = trpc.corr.pairSignal.useQuery(
    { tickerA: pairA, tickerB: pairB, range: rcRange, entryZ },
    { enabled: !!pairA && !!pairB && pairA !== pairB, staleTime: 5 * 60 * 1000 }
  );
  const minVar = trpc.corr.minVariancePortfolio.useQuery(
    { tickers: tickers.slice(0, 8), range: rcRange },
    { enabled: tickers.length >= 2, staleTime: 5 * 60 * 1000 }
  );

  const PIE_COLORS = ['#f5a623', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#34d399', '#facc15'];
  const exportRebalancePlan = () => {
    if (!minVar.data?.success) return;
    const generatedAt = new Date().toISOString();
    const plan = {
      generatedAt,
      range: rcRange,
      portfolioVol: minVar.data.portfolioVol,
      averageCorrelation: minVar.data.avgCorr,
      diversificationScore: minVar.data.diversificationScore,
      weights: minVar.data.weights,
    };
    window.localStorage.setItem('finance-hub:corr-rebalance-plan', JSON.stringify(plan));
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const headers = ['生成时间', '回测区间', '标的', '名称', '目标权重%', '年化波动%', '组合年化波动%', '平均相关性', '分散化评分'];
    const rows = minVar.data.weights.map(weight => [generatedAt, rcRange, weight.ticker, weight.label, (weight.weight * 100).toFixed(2), weight.annualVol, minVar.data.portfolioVol, minVar.data.avgCorr.toFixed(4), minVar.data.diversificationScore]);
    const csv = [headers, ...rows].map(row => row.map(quote).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `corr-rebalance-plan-${generatedAt.slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setHedgeConfirmed(true);
    toast.success('再平衡计划已保存到当前浏览器并导出 CSV');
  };

  return (
    <div className="space-y-3 text-xs">
      {/* 顶部说明 */}
      <div className="bg-[#0a0a0a] border border-[#2a1a00] p-2">
        <div className="text-[#f5a623] font-semibold mb-1">配对与对冲实验室 · 优先股相关性应用</div>
        <div className="text-[#888] leading-relaxed">
          基于真实 Yahoo Finance 历史数据，测量优先股之间及与利率/银行股的动态关系：
          <span className="text-[#aaa]">滚动相关性</span> 监测关系强弱变化、
          <span className="text-[#aaa]">配对交易信号</span> 捕捉价差回归机会、
          <span className="text-[#aaa]">最小方差组合</span> 给出真实可执行的权重配置。
        </div>
      </div>

      {/* 配对选择栏 */}
      <div className="flex items-center gap-2 flex-wrap bg-[#0a0a0a] border border-[#222] p-2">
        <span className="text-[#888]">配对标的:</span>
        <select value={pairA} onChange={e => setPairA(e.target.value)}
          className="bg-[#1a1a1a] text-[#f5a623] border border-[#333] px-2 py-0.5 focus:outline-none focus:border-[#f5a623]">
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-[#555]">vs</span>
        <select value={pairB} onChange={e => setPairB(e.target.value)}
          className="bg-[#1a1a1a] text-[#60a5fa] border border-[#333] px-2 py-0.5 focus:outline-none focus:border-[#60a5fa]">
          {tickers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-[#555] mx-1">|</span>
        <span className="text-[#888]">区间:</span>
        {(['6mo', '1y', '2y'] as const).map(r => (
          <button key={r} onClick={() => setRcRange(r)}
            className={`px-2 py-0.5 ${rcRange === r ? 'bg-[#aa0000] text-white' : 'text-[#888] hover:text-white'}`}>
            {r === '6mo' ? '6个月' : r === '1y' ? '1年' : '2年'}
          </button>
        ))}
        <span className="text-[#555] mx-1">|</span>
        <span className="text-[#888]">滚动窗口:</span>
        <input type="range" min={20} max={120} step={5} value={rcWindow}
          onChange={e => setRcWindow(Number(e.target.value))} className="w-24 accent-[#f5a623]" />
        <span className="text-[#f5a623] w-10">{rcWindow}日</span>
      </div>

      {/* ① 滚动相关性 */}
      <div className="bg-[#0a0a0a] border border-[#222] p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#f5a623] font-semibold">① 滚动相关性时间序列 — {pairA} vs {pairB}</span>
          {rolling.data?.success && (
            <span className="text-[#888]">
              当前 <span className="text-[#f5a623]">{rolling.data.latest.toFixed(3)}</span> ·
              均值 <span className="text-[#aaa]">{rolling.data.avg.toFixed(3)}</span> ·
              区间 [<span className="text-[#ff5252]">{rolling.data.min.toFixed(2)}</span>,
              <span className="text-[#00e676]">{rolling.data.max.toFixed(2)}</span>]
            </span>
          )}
        </div>
        {pairA === pairB ? (
          <div className="text-[#ff5252] py-6 text-center">请选择两个不同的标的</div>
        ) : rolling.isLoading ? (
          <DataLoadingSkeleton variant="line" height={180} label="正在计算滚动相关性" />
        ) : rolling.data?.success ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={rolling.data.series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 9 }} interval="preserveStartEnd" minTickGap={40} />
              <YAxis domain={[-1, 1]} tick={{ fill: '#666', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 11 }}
                labelStyle={{ color: '#f5a623' }} />
              <ReferenceLine y={0} stroke="#444" />
              <ReferenceLine y={rolling.data.avg} stroke="#f5a623" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="value" stroke="#4ade80" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-[#888] py-6 text-center">数据不足，无法计算滚动相关性</div>
        )}
        <div className="text-[#666] mt-1">
          解读：相关系数若从高位（&gt;0.7）骤降，说明两标的关系断裂，配对对冲有效性下降，需重新评估。
        </div>
      </div>

      {/* ② 配对交易信号 */}
      <div className="bg-[#0a0a0a] border border-[#222] p-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#f5a623] font-semibold">② 配对交易信号 — 价差 Z-Score</span>
          <div className="flex items-center gap-1">
            <span className="text-[#888]">入场阈值 Z=</span>
            {[1.5, 2, 2.5].map(z => (
              <button key={z} onClick={() => setEntryZ(z)}
                className={`px-1.5 py-0.5 ${entryZ === z ? 'bg-[#aa0000] text-white' : 'text-[#888] hover:text-white'}`}>{z}</button>
            ))}
          </div>
        </div>
        {pair.isLoading ? (
          <DataLoadingSkeleton variant="line" height={170} label="正在计算配对交易信号" />
        ) : pair.data?.success ? (
          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-[#888]">当前 Z-Score</span>
                <span className={Math.abs(pair.data.z) >= entryZ ? 'text-[#ff5252] font-bold' : 'text-[#f5a623]'}>{pair.data.z.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#888]">价格比</span><span className="text-[#aaa]">{pair.data.latestRatio.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-[#888]">均值 / 标准差</span><span className="text-[#aaa]">{pair.data.mean.toFixed(3)} / {pair.data.sd.toFixed(3)}</span></div>
              <div className="flex justify-between"><span className="text-[#888]">收益率相关系数</span><span className="text-[#aaa]">{pair.data.corr.toFixed(3)}</span></div>
              <div className={`mt-2 p-2 border ${pair.data.signal === 'neutral' ? 'border-[#333] bg-[#111]' : 'border-[#aa6600] bg-[#1a1000]'}`}>
                <div className="flex items-center gap-1 mb-1">
                  {pair.data.signal === 'neutral'
                    ? <span className="text-[#888]">● 中性</span>
                    : <span className="text-[#f5a623] font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />入场信号</span>}
                </div>
                <div className="text-[#ddd]">{pair.data.action}</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={pair.data.ratioSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="idx" tick={{ fill: '#666', fontSize: 9 }} minTickGap={40} />
                <YAxis tick={{ fill: '#666', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 11 }} labelStyle={{ color: '#f5a623' }} />
                <ReferenceLine y={0} stroke="#444" />
                <ReferenceLine y={entryZ} stroke="#ff5252" strokeDasharray="4 4" />
                <ReferenceLine y={-entryZ} stroke="#ff5252" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="z" stroke="#60a5fa" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-[#888] py-6 text-center">数据不足，无法生成配对信号（需至少 30 个交易日）</div>
        )}
      </div>

      {/* ③ 最小方差组合 + 分散化评分 + 对冲授权 */}
      <div className="bg-[#0a0a0a] border border-[#222] p-2">
        <div className="text-[#f5a623] font-semibold mb-1">③ 最小方差组合 — 当前 {tickers.slice(0, 8).length} 个标的</div>
        {minVar.isLoading ? (
          <DataLoadingSkeleton variant="table" rows={6} cols={3} label="正在优化最小方差组合" />
        ) : minVar.data?.success ? (
          <div className="grid grid-cols-[1.2fr_1fr] gap-3">
            <div>
              <table className="w-full text-xs">
                <thead><tr className="text-[#888] border-b border-[#222]">
                  <th className="text-left py-1">标的</th><th className="text-right">建议权重</th><th className="text-right">年化波动</th>
                </tr></thead>
                <tbody>
                  {minVar.data.weights.map((w, i) => (
                    <tr key={w.ticker} className="border-b border-[#161616]">
                      <td className="py-0.5"><span className="inline-block w-2 h-2 mr-1" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-[#f5a623]">{w.ticker}</span> <span className="text-[#666]">{w.label}</span></td>
                      <td className="text-right text-[#4ade80]">{(w.weight * 100).toFixed(1)}%</td>
                      <td className="text-right text-[#aaa]">{w.annualVol}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex items-center gap-4">
                <span className="text-[#888]">组合年化波动: <span className="text-[#f5a623]">{minVar.data.portfolioVol}%</span></span>
                <span className="text-[#888]">平均相关: <span className="text-[#aaa]">{minVar.data.avgCorr.toFixed(3)}</span></span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[#888]">分散化评分:</span>
                <div className="flex-1 h-2 bg-[#1a1a1a] rounded overflow-hidden">
                  <div className="h-full" style={{ width: `${minVar.data.diversificationScore}%`, background: minVar.data.diversificationScore > 60 ? '#4ade80' : minVar.data.diversificationScore > 30 ? '#f5a623' : '#ff5252' }} />
                </div>
                <span className="text-[#f5a623]">{minVar.data.diversificationScore}/100</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={minVar.data.weights} dataKey="weight" nameKey="ticker" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {minVar.data.weights.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', fontSize: 11 }}
                    formatter={(v: number, n: string) => [`${(v * 100).toFixed(1)}%`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <button onClick={() => { setHedgeOpen(true); setHedgeConfirmed(false); }}
                className="mt-1 flex items-center gap-1 px-3 py-1 bg-[#8b0000] hover:bg-[#aa0000] text-white transition-colors">
                <Shield className="w-3 h-3" />生成再平衡计划
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[#888] py-6 text-center">数据不足，无法优化组合（需至少 2 个有效标的）</div>
        )}
      </div>

      {hedgeOpen && minVar.data?.success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setHedgeOpen(false)}>
          <div className="bg-[#0d0d0d] border border-[#aa6600] w-[460px] max-w-[92vw] p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-[#f5a623] font-semibold mb-2">
              <Shield className="w-4 h-4" />对冲再平衡计划 — 导出确认
            </div>
            {!hedgeConfirmed ? (
              <>
                <div className="text-[#aaa] mb-2 leading-relaxed">
                  系统已根据最小方差优化生成以下目标权重。确认后将下载 CSV 并保存到当前浏览器；<span className="text-[#ff5252]">不会提交或执行订单</span>。
                </div>
                <div className="bg-[#111] border border-[#222] p-2 max-h-44 overflow-auto mb-3 space-y-0.5">
                  {minVar.data.weights.map(w => (
                    <div key={w.ticker} className="flex justify-between">
                      <span className="text-[#f5a623]">{w.ticker} <span className="text-[#666]">{w.label}</span></span>
                      <span className="text-[#4ade80]">调整至目标权重 {(w.weight * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setHedgeOpen(false)} className="px-3 py-1 border border-[#333] text-[#aaa] hover:text-white">取消</button>
                  <button onClick={exportRebalancePlan}
                    className="px-3 py-1 bg-[#8b0000] hover:bg-[#aa0000] text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />保存并导出 CSV
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-[#4ade80] mx-auto mb-2" />
                <div className="text-[#4ade80] font-semibold mb-1">计划已导出</div>
                <div className="text-[#888]">再平衡权重已保存到当前浏览器并下载为 CSV；未提交任何订单。</div>
                <button onClick={() => setHedgeOpen(false)} className="mt-3 px-4 py-1 bg-[#333] hover:bg-[#444] text-white">关闭</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
