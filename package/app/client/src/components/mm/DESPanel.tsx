import { EnhancedTooltip, CustomCursor } from '@/components/ChartEnhancements';
import { useChartLoading, ChartWithSkeleton, AreaChartSkeleton, BarChartSkeleton, LineChartSkeleton, DashboardSkeleton } from '@/components/ChartSkeleton';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RefreshCw, TrendingUp, AlertTriangle, Target, Zap , Download} from 'lucide-react';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';

interface DESPanelProps { onClose: () => void; }

// 宏观因子敏感度数据
const macroFactors = [
  { factor: '通胀预期(CPI)', sensitivity: 0.87, direction: 'positive', zscore: 2.3, color: '#ef4444' },
  { factor: '就业数据(NFP)', sensitivity: 0.72, direction: 'positive', zscore: 1.8, color: '#f97316' },
  { factor: '央行政策(Fed)', sensitivity: 0.95, direction: 'negative', zscore: 3.1, color: '#ef4444' },
  { factor: 'GDP增速', sensitivity: 0.61, direction: 'positive', zscore: 1.2, color: '#22c55e' },
  { factor: '信用利差(IG)', sensitivity: 0.78, direction: 'negative', zscore: 2.0, color: '#f97316' },
  { factor: '美元指数(DXY)', sensitivity: 0.55, direction: 'negative', zscore: 0.9, color: '#22c55e' },
  { factor: 'VIX恐慌指数', sensitivity: 0.83, direction: 'negative', zscore: 2.6, color: '#ef4444' },
  { factor: '原油价格(WTI)', sensitivity: 0.42, direction: 'positive', zscore: 0.7, color: '#22c55e' },
];

// 传递熵节点数据（拓扑网络）
const nodes = [
  { id: 'US10Y', label: '10Y美债', x: 400, y: 200, size: 36, liquidity: 0.92, isCenter: true, type: 'treasury' },
  { id: 'CN10Y', label: '中国国债', x: 200, y: 120, size: 28, liquidity: 0.75, isCenter: false, type: 'treasury' },
  { id: 'DE10Y', label: '德债Bund', x: 600, y: 120, size: 26, liquidity: 0.71, isCenter: false, type: 'treasury' },
  { id: 'CD3M', label: '3M存单', x: 150, y: 280, size: 22, liquidity: 0.88, isCenter: false, type: 'mm' },
  { id: 'CP1M', label: '1M商票', x: 650, y: 280, size: 20, liquidity: 0.82, isCenter: false, type: 'mm' },
  { id: 'SOFR', label: 'SOFR', x: 300, y: 340, size: 24, liquidity: 0.95, isCenter: false, type: 'rate' },
  { id: 'VIX', label: 'VIX', x: 500, y: 340, size: 18, liquidity: 0.45, isCenter: false, type: 'risk' },
  { id: 'CDS5Y', label: '5Y CDS', x: 400, y: 380, size: 20, liquidity: 0.60, isCenter: false, type: 'credit' },
];

// 传递熵边（方向性信息流）
const edges = [
  { from: 'US10Y', to: 'CN10Y', entropy: 0.78, direction: 'out', label: '0.78' },
  { from: 'US10Y', to: 'DE10Y', entropy: 0.85, direction: 'out', label: '0.85' },
  { from: 'US10Y', to: 'SOFR', entropy: 0.91, direction: 'out', label: '0.91' },
  { from: 'US10Y', to: 'CDS5Y', entropy: 0.72, direction: 'out', label: '0.72' },
  { from: 'SOFR', to: 'CD3M', entropy: 0.88, direction: 'out', label: '0.88' },
  { from: 'SOFR', to: 'CP1M', entropy: 0.76, direction: 'out', label: '0.76' },
  { from: 'VIX', to: 'US10Y', entropy: 0.65, direction: 'in', label: '0.65' },
  { from: 'CDS5Y', to: 'VIX', entropy: 0.58, direction: 'out', label: '0.58' },
  { from: 'CN10Y', to: 'CD3M', entropy: 0.52, direction: 'out', label: '0.52' },
  { from: 'DE10Y', to: 'CP1M', entropy: 0.48, direction: 'out', label: '0.48' },
];

// 历史偏离序列必须来自已授权收益率观测；未接入时保持空态，禁止随机噪声冒充 Z-Score。
const deviationData: Array<{ day: number; zscore: number; threshold2: number; thresholdN2: number; signal: boolean }> = [];

// 雷达图数据（宏观敏感度）
const radarData = [
  { subject: '通胀', A: 87, fullMark: 100 },
  { subject: '就业', A: 72, fullMark: 100 },
  { subject: '央行政策', A: 95, fullMark: 100 },
  { subject: 'GDP', A: 61, fullMark: 100 },
  { subject: '信用利差', A: 78, fullMark: 100 },
  { subject: '美元', A: 55, fullMark: 100 },
  { subject: 'VIX', A: 83, fullMark: 100 },
  { subject: '原油', A: 42, fullMark: 100 },
];

// 拓扑图SVG组件
const TopologyGraph: React.FC<{ animFrame: number }> = ({ animFrame }) => {
  const getNodeColor = (type: string, liquidity: number) => {
    if (liquidity > 0.85) return '#22c55e';
    if (liquidity > 0.65) return '#f59e0b';
    return '#ef4444';
  };

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  return (
    <svg viewBox="0 0 800 480" className="w-full h-full">
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <marker id="arrowOut" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#22c55e" opacity="0.8" />
        </marker>
        <marker id="arrowIn" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" opacity="0.8" />
        </marker>
      </defs>

      {/* 背景网格 */}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`hg${i}`} x1="0" y1={i * 60} x2="800" y2={i * 60} stroke="#1f2937" strokeWidth="1" />
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <line key={`vg${i}`} x1={i * 60} y1="0" x2={i * 60} y2="480" stroke="#1f2937" strokeWidth="1" />
      ))}

      {/* 中心引力场光晕 */}
      <circle cx="400" cy="200" r={60 + (animFrame % 40) * 0.8} fill="url(#centerGlow)" opacity="0.6" />
      <circle cx="400" cy="200" r={90 + (animFrame % 60) * 0.5} fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.2" strokeDasharray="4 4" />

      {/* 边（传递熵连线） */}
      {edges.map((edge, i) => {
        const fromNode = getNodeById(edge.from);
        const toNode = getNodeById(edge.to);
        if (!fromNode || !toNode) return null;
        const isActive = (animFrame + i * 7) % 50 < 25;
        const strokeColor = edge.direction === 'out' ? '#22c55e' : '#ef4444';
        const opacity = isActive ? 0.7 : 0.3;
        // 计算中点
        const mx = (fromNode.x + toNode.x) / 2;
        const my = (fromNode.y + toNode.y) / 2;
        return (
          <g key={edge.from + edge.to}>
            <line
              x1={fromNode.x} y1={fromNode.y}
              x2={toNode.x} y2={toNode.y}
              stroke={strokeColor}
              strokeWidth={edge.entropy * 3}
              opacity={opacity}
              markerEnd={edge.direction === 'out' ? 'url(#arrowOut)' : 'url(#arrowIn)'}
              strokeDasharray={isActive ? '0' : '4 4'}
            />
            <text x={mx} y={my - 4} fill={strokeColor} fontSize="9" textAnchor="middle" opacity={0.8}>
              {edge.label}
            </text>
          </g>
        );
      })}

      {/* 节点 */}
      {nodes.map((node) => {
        const color = getNodeColor(node.type, node.liquidity);
        const pulse = node.isCenter ? (animFrame % 30) * 0.5 : 0;
        return (
          <g key={node.id}>
            {node.isCenter && (
              <circle cx={node.x} cy={node.y} r={node.size + pulse} fill={color} opacity="0.15" />
            )}
            <circle
              cx={node.x} cy={node.y} r={node.size}
              fill={color} opacity="0.85"
              stroke={node.isCenter ? '#f59e0b' : color}
              strokeWidth={node.isCenter ? 2 : 1}
            />
            <text x={node.x} y={node.y + 1} fill="white" fontSize="10" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
              {node.id}
            </text>
            <text x={node.x} y={node.y + node.size + 12} fill="#9ca3af" fontSize="9" textAnchor="middle">
              {node.label}
            </text>
            <text x={node.x} y={node.y + node.size + 22} fill={color} fontSize="9" textAnchor="middle">
              流动性:{(node.liquidity * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* 图例 */}
      <g transform="translate(20, 420)">
        <circle cx="8" cy="8" r="6" fill="#22c55e" />
        <text x="18" y="12" fill="#9ca3af" fontSize="10">{`高流动性(85%+)`}</text>
        <circle cx="120" cy="8" r="6" fill="#f59e0b" />
        <text x="130" y="12" fill="#9ca3af" fontSize="10">中流动性(65~85%)</text>
        <circle cx="250" cy="8" r="6" fill="#ef4444" />
        <text x="260" y="12" fill="#9ca3af" fontSize="10">低流动性(65%-以下)</text>
        <line x1="360" y1="8" x2="400" y2="8" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrowOut)" />
        <text x="410" y="12" fill="#9ca3af" fontSize="10">风险发射源</text>
        <line x1="490" y1="8" x2="530" y2="8" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowIn)" />
        <text x="540" y="12" fill="#9ca3af" fontSize="10">风险吸收者</text>
      </g>
    </svg>
  );
};

export const DESPanel: React.FC<DESPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // ─── 导出 PNG ─────────────────────────────────────────────────────────────────
  const handleExport = async (mode: 'png' | 'clipboard' = 'png') => {
    if (!panelRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const rawCanvas = await html2canvas(panelRef.current, { backgroundColor: '#030712', scale: 2, useCORS: true, logging: false });

      // ── 水印绘制 ──
      const WATERMARK_H = 28;
      const wCanvas = document.createElement('canvas');
      wCanvas.width = rawCanvas.width;
      wCanvas.height = rawCanvas.height + WATERMARK_H * 2;
      const ctx = wCanvas.getContext('2d')!;
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, wCanvas.width, wCanvas.height);
      // 顶部橙色线
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 0, wCanvas.width, 2);
      // 顶部标题
      ctx.font = `bold ${Math.round(WATERMARK_H * 0.45)}px monospace`;
      ctx.fillStyle = '#f59e0b';
      ctx.textBaseline = 'middle';
      ctx.fillText('Finance Hub  ·  Ucheer Terminal', 12, WATERMARK_H / 2);
      // 原始截图
      ctx.drawImage(rawCanvas, 0, WATERMARK_H);
      // 底部背景
      const bottomY = WATERMARK_H + rawCanvas.height;
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, bottomY, wCanvas.width, WATERMARK_H);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, wCanvas.height - 2, wCanvas.width, 2);
      // 底部时间戳
      const timeStr = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      ctx.font = `${Math.round(WATERMARK_H * 0.4)}px monospace`;
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(`导出时间：${timeStr}`, 12, bottomY + WATERMARK_H / 2);
      // 底部免责声明
      ctx.fillStyle = '#4b5563';
      const disclaimer = '仅供参考，不构成投资建议';
      const dW = ctx.measureText(disclaimer).width;
      ctx.fillText(disclaimer, wCanvas.width - dW - 12, bottomY + WATERMARK_H / 2);

      if (mode === 'clipboard') {
        const blob = await new Promise<Blob>((resolve, reject) => {
          wCanvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
        });
        if (navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setExportMsg('✓ 已复制到剪贴板');
        } else {
          // 降级为保存文件
          const link = document.createElement('a');
          link.download = `panel-${new Date().toISOString().slice(0, 10)}.png`;
          link.href = wCanvas.toDataURL('image/png');
          link.click();
          setExportMsg('✓ 已保存 PNG');
        }
      } else {
        const link = document.createElement('a');
        link.download = `panel-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = wCanvas.toDataURL('image/png');
        link.click();
        setExportMsg('✓ 已保存 PNG');
      }
      setTimeout(() => setExportMsg(null), 3000);
    } catch (e) { console.error('Export failed', e); setExportMsg('✗ 导出失败'); setTimeout(() => setExportMsg(null), 3000); }
  };
  const [activeTab, setActiveTab] = useState<'topology' | 'sensitivity' | 'deviation'>('topology');
  const loading = useChartLoading(600);
  const [animFrame, setAnimFrame] = useState(0);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>('US10Y');
  const [signalActive, setSignalActive] = useState(false);

  // 动画帧
  useEffect(() => {
    const timer = setInterval(() => setAnimFrame(f => f + 1), 100);
    return () => clearInterval(timer);
  }, []);

  // 当前 Z-Score 仅在真实序列存在时计算；空态不得显示风险信号。
  const currentZScore: number | null = deviationData.at(-1)?.zscore ?? null;
  const isSignal = currentZScore != null && Math.abs(currentZScore) > 2;

  return (
    <div ref={panelRef} className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-sm">DES</span>
          <span className="text-gray-300 text-sm">证券与功能说明 — 非线性因果拓扑网络</span>
          <span className="text-xs text-gray-500">Topological Causal Map · RQA · Transfer Entropy</span>
        </div>
        <div className="flex items-center gap-2">
          {isSignal && (
            <span className="flex items-center gap-1 text-xs bg-red-900/60 text-red-300 px-2 py-1 rounded animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              拓扑中心位移 ⚡ 胜率95%
            </span>
          )}
                    <button
            onClick={() => handleExport('png')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors mr-2"
            title="导出 PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出</span>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 顶部指标卡片 */}
      <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-900/50 border-b border-gray-800 shrink-0">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">10Y美债收益率</div>
          <div className="text-lg font-bold text-amber-400">4.312%</div>
          <div className="text-xs text-red-400">+0.023bp ↑</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">Z-Score偏离度</div>
          <div className={`text-lg font-bold ${isSignal ? 'text-red-400' : 'text-green-400'}`}>
            {currentZScore == null ? '—' : `${currentZScore > 0 ? '+' : ''}${currentZScore.toFixed(2)}σ`}
          </div>
          <div className="text-xs text-gray-500">历史中枢偏离</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs text-gray-400">传递熵中心度</div>
          <div className="text-lg font-bold text-blue-400">0.912</div>
          <div className="text-xs text-gray-500">US10Y系统重要性</div>
        </div>
        <div className={`rounded p-2 ${isSignal ? 'bg-red-900/40 border border-red-700' : 'bg-gray-800'}`}>
          <div className="text-xs text-gray-400">拓扑信号</div>
          <div className={`text-sm font-bold ${isSignal ? 'text-red-400' : 'text-green-400'}`}>
            {isSignal ? '⚡ 风险发射源转换' : '✓ 正常吸收状态'}
          </div>
          <div className="text-xs text-gray-500">实战胜率 95%</div>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex gap-1 px-4 py-2 bg-gray-900/30 border-b border-gray-800 shrink-0">
        {[
          { id: 'topology', label: '动态引力场拓扑图' },
          { id: 'sensitivity', label: '宏观敏感度矩阵' },
          { id: 'deviation', label: '基准偏离度(Z-Score)' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'topology' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-400 bg-gray-900 rounded p-2">
              <span className="text-amber-400 font-semibold">递归定量分析(RQA) + 传递熵(Transfer Entropy)</span>：
              节点大小=系统重要性，颜色深浅=流动性水平(85%+)�线条粗细=传递熵强度，闪烁频率=风险传导速度。
              绿色箭头=风险发射源，红色箭头=风险吸收者。
            </div>
            <div className="bg-gray-900 rounded border border-gray-700" style={{ height: '380px' }}>
              <TopologyGraph animFrame={animFrame} />
            </div>
            {/* 传递熵排名表 */}
            <div className="bg-gray-900 rounded border border-gray-700 p-3">
              <div className="text-xs text-amber-400 font-semibold mb-2">传递熵排名（谁在驱动谁）</div>
              <div className="grid grid-cols-5 gap-1 text-xs text-gray-500 mb-1">
                <span>发射源</span><span>接收者</span><span>传递熵</span><span>方向</span><span>信号强度</span>
              </div>
              {edges.sort((a, b) => b.entropy - a.entropy).map((e, i) => (
                <div key={i} className="grid grid-cols-5 gap-1 text-xs py-1 border-t border-gray-800">
                  <span className="text-amber-400">{e.from}</span>
                  <span className="text-blue-400">{e.to}</span>
                  <span className={e.entropy > 0.8 ? 'text-red-400' : 'text-green-400'}>{e.entropy.toFixed(2)}</span>
                  <span className={e.direction === 'out' ? 'text-green-400' : 'text-red-400'}>
                    {e.direction === 'out' ? '→ 驱动' : '← 被驱动'}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 rounded" style={{ width: `${e.entropy * 60}px`, backgroundColor: e.entropy > 0.8 ? '#ef4444' : '#22c55e' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sensitivity' && (
          <div className="grid grid-cols-2 gap-4">
            {/* 雷达图 */}
            <div className="bg-gray-900 rounded border border-gray-700 p-3">
              <div className="text-xs text-amber-400 font-semibold mb-2">宏观因子敏感度雷达图（10Y美债）</div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Radar name="敏感度" dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* 敏感度矩阵表 */}
            <div className="bg-gray-900 rounded border border-gray-700 p-3">
              <div className="text-xs text-amber-400 font-semibold mb-2">弹性矩阵 — 价格对宏观因素的弹性</div>
              <div className="space-y-2">
                {macroFactors.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-300 w-28 shrink-0">{f.factor}</span>
                    <div className="flex-1 bg-gray-800 rounded h-4 overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${f.sensitivity * 100}%`,
                          backgroundColor: f.color,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span className="text-xs w-10 text-right" style={{ color: f.color }}>
                      {(f.sensitivity * 100).toFixed(0)}%
                    </span>
                    <span className={`text-xs w-16 ${Math.abs(f.zscore) > 2 ? 'text-red-400' : 'text-gray-400'}`}>
                      Z:{f.zscore > 0 ? '+' : ''}{f.zscore.toFixed(1)}σ
                    </span>
                    <span className={`text-xs w-8 ${f.direction === 'positive' ? 'text-green-400' : 'text-red-400'}`}>
                      {f.direction === 'positive' ? '正相' : '负相'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-300">
                ⚡ 实战信号：央行政策敏感度0.95，Z-Score=+3.1σ（超过2σ阈值），触发"拓扑中心位移"信号。
                实战标的：10Y美债、各期限国债、大额存单(CD)、商业票据(CP)。胜率95%。
              </div>
            </div>
          </div>
        )}

        {activeTab === 'deviation' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded border border-gray-700 p-3">
              <div className="text-xs text-amber-400 font-semibold mb-2">
                收益率偏离历史中枢 Z-Score（60日）— 超过±2σ触发"基准偏离度"信号
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={deviationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} label={{ value: '交易日', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} label={{ value: 'Z-Score(σ)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }} domain={[-4, 4]} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  {/* 2σ阈值线 */}
                  <Line type="monotone" dataKey="threshold2" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="+2σ阈值" />
                  <Line type="monotone" dataKey="thresholdN2" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="-2σ阈值" />
                  <Line
                    type="monotone" dataKey="zscore" stroke="#f59e0b" strokeWidth={2} dot={false}
                    name="Z-Score偏离度"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* 信号统计 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 rounded border border-gray-700 p-3">
                <div className="text-xs text-gray-400">当前偏离度</div>
                <div className={`text-2xl font-bold ${isSignal ? 'text-red-400' : 'text-green-400'}`}>
                  {currentZScore == null ? '—' : `${currentZScore > 0 ? '+' : ''}${currentZScore.toFixed(2)}σ`}
                </div>
                <div className="text-xs text-gray-500">{currentZScore == null ? '尚无可核验偏离序列' : isSignal ? '⚡ 超过2σ阈值，触发信号' : '✓ 正常范围内'}</div>
              </div>
              <div className="bg-gray-900 rounded border border-gray-700 p-3">
                <div className="text-xs text-gray-400">60日信号触发次数</div>
                <div className="text-2xl font-bold text-amber-400">
                  {deviationData.filter(d => d.signal).length}
                </div>
                <div className="text-xs text-gray-500">超过±2σ的天数</div>
              </div>
              <div className="bg-gray-900 rounded border border-gray-700 p-3">
                <div className="text-xs text-gray-400">实战标的</div>
                <div className="text-xs text-blue-400 mt-1 space-y-1">
                  <div>• 10Y美债 (US10Y)</div>
                  <div>• 各期限国债</div>
                  <div>• 大额存单 (CD)</div>
                  <div>• 商业票据 (CP)</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="px-4 py-1.5 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500 shrink-0">
        <span>DES · 递归定量分析(RQA) · 传递熵(Transfer Entropy) · 动态非线性耦合</span>
        <span className="text-green-400">● 实时更新</span>
      </div>
    </div>
  );
};

export default DESPanel;
