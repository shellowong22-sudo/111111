/**
 * WVOL - 全球外汇波动率 (World FX Volatility)
 * 蓝图要求：多维数据分析-因果推理-自主执行闭环智能体
 * 真实内容：FX波动率曲面(Delta-Tenor)、3D曲面可视化、Risk Reversal、Butterfly、历史/隐含对比
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DerivativesAIPanel from '@/components/DerivativesAIPanel';

// --- FX 波动率曲面数据 --------------------------------------------------------
const DELTAS = ['10DP', '25DP', 'ATM', '25DC', '10DC'];
const DELTAS_LABEL = ['10D Put', '25D Put', 'ATM', '25D Call', '10D Call'];
const TENORS = ['1W', '1M', '3M', '6M', '1Y', '2Y'];

const EURUSD_SURFACE: number[][] = [
  [8.5, 7.8, 8.2, 8.5, 9.0, 9.5],
  [7.8, 7.2, 7.6, 7.9, 8.4, 8.9],
  [7.2, 6.8, 7.2, 7.5, 8.0, 8.5],
  [7.5, 7.0, 7.4, 7.7, 8.2, 8.7],
  [8.2, 7.6, 8.0, 8.3, 8.8, 9.3],
];

const USDJPY_SURFACE: number[][] = [
  [12.5, 11.2, 11.8, 12.2, 12.8, 13.5],
  [11.2, 10.2, 10.8, 11.2, 11.8, 12.5],
  [10.2, 9.5, 10.2, 10.5, 11.2, 12.0],
  [10.8, 10.0, 10.6, 11.0, 11.6, 12.3],
  [12.0, 11.0, 11.5, 12.0, 12.5, 13.2],
];

const GBPUSD_SURFACE: number[][] = [
  [10.5, 9.8, 10.2, 10.5, 11.0, 11.5],
  [9.5, 8.8, 9.2, 9.5, 10.0, 10.5],
  [8.8, 8.2, 8.6, 8.9, 9.4, 9.9],
  [9.2, 8.5, 8.9, 9.2, 9.7, 10.2],
  [10.2, 9.5, 9.8, 10.2, 10.7, 11.2],
];

const EURUSD_SURFACE_HIST: number[][] = [
  [8.2, 7.5, 7.9, 8.2, 8.7, 9.2],
  [7.5, 6.9, 7.3, 7.6, 8.1, 8.6],
  [6.9, 6.5, 6.9, 7.2, 7.7, 8.2],
  [7.2, 6.7, 7.1, 7.4, 7.9, 8.4],
  [7.9, 7.3, 7.7, 8.0, 8.5, 9.0],
];

const USDJPY_SURFACE_HIST: number[][] = [
  [12.0, 10.8, 11.4, 11.8, 12.4, 13.0],
  [10.8, 9.8, 10.4, 10.8, 11.4, 12.0],
  [9.8, 9.2, 9.8, 10.2, 10.8, 11.5],
  [10.4, 9.6, 10.2, 10.6, 11.2, 11.8],
  [11.6, 10.6, 11.2, 11.6, 12.2, 12.8],
];

const GBPUSD_SURFACE_HIST: number[][] = [
  [10.2, 9.5, 9.9, 10.2, 10.7, 11.2],
  [9.2, 8.5, 8.9, 9.2, 9.7, 10.2],
  [8.5, 7.9, 8.3, 8.6, 9.1, 9.6],
  [8.9, 8.2, 8.6, 8.9, 9.4, 9.9],
  [9.9, 9.2, 9.5, 9.9, 10.4, 10.9],
];

const SURFACES_HIST: Record<string, number[][]> = {
  'EUR/USD': EURUSD_SURFACE_HIST,
  'USD/JPY': USDJPY_SURFACE_HIST,
  'GBP/USD': GBPUSD_SURFACE_HIST,
};

function calcDeltaSurface(current: number[][], historical: number[][]): number[][] {
  return current.map((row, i) => row.map((v, j) => parseFloat((v - historical[i][j]).toFixed(2))));
}

const SURFACES: Record<string, number[][]> = {
  'EUR/USD': EURUSD_SURFACE,
  'USD/JPY': USDJPY_SURFACE,
  'GBP/USD': GBPUSD_SURFACE,
};

function calcSkewData(surface: number[][]): { tenor: string; rr25: number; rr10: number; fly25: number; atm: number }[] {
  return TENORS.map((tenor, ti) => ({
    tenor,
    rr25: parseFloat((surface[0][ti] - surface[4][ti]).toFixed(2)),
    rr10: parseFloat((surface[0][ti] - surface[4][ti] + 1.5).toFixed(2)),
    fly25: parseFloat(((surface[0][ti] + surface[4][ti]) / 2 - surface[2][ti]).toFixed(2)),
    atm: surface[2][ti],
  }));
}

const HV_IV_HISTORY = [
  { month: '6月', hv: 6.2, iv: 7.8, vrp: 1.6 },
  { month: '7月', hv: 5.8, iv: 7.2, vrp: 1.4 },
  { month: '8月', hv: 7.5, iv: 9.5, vrp: 2.0 },
  { month: '9月', hv: 8.2, iv: 10.2, vrp: 2.0 },
  { month: '10月', hv: 7.8, iv: 9.8, vrp: 2.0 },
  { month: '11月', hv: 6.5, iv: 8.2, vrp: 1.7 },
  { month: '12月', hv: 5.8, iv: 7.5, vrp: 1.7 },
  { month: '1月', hv: 5.5, iv: 7.0, vrp: 1.5 },
  { month: '2月', hv: 6.2, iv: 7.8, vrp: 1.6 },
  { month: '3月', hv: 7.0, iv: 8.8, vrp: 1.8 },
  { month: '4月', hv: 7.5, iv: 9.2, vrp: 1.7 },
  { month: '5月', hv: 6.8, iv: 8.5, vrp: 1.7 },
];

const CROSS_VOL = [
  { pair: 'EUR/USD', vol1m: 7.2, vol3m: 7.8, vol1y: 8.5, change: -0.2 },
  { pair: 'GBP/USD', vol1m: 8.8, vol3m: 9.2, vol1y: 10.1, change: +0.5 },
  { pair: 'USD/JPY', vol1m: 9.5, vol3m: 10.2, vol1y: 11.2, change: +1.2 },
  { pair: 'USD/CHF', vol1m: 6.8, vol3m: 7.5, vol1y: 8.2, change: -0.3 },
  { pair: 'AUD/USD', vol1m: 10.2, vol3m: 11.0, vol1y: 12.5, change: +0.8 },
  { pair: 'USD/CAD', vol1m: 7.5, vol3m: 8.2, vol1y: 9.0, change: +0.3 },
  { pair: 'EUR/GBP', vol1m: 5.8, vol3m: 6.5, vol1y: 7.2, change: -0.1 },
  { pair: 'EUR/JPY', vol1m: 10.5, vol3m: 11.2, vol1y: 12.0, change: +1.5 },
];

// ============================================================
// 3D 波动率曲面组件（Plotly.js）
// ============================================================
function VolSurface3D({ pair, surface }: { pair: string; surface: number[][] }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [colorscale, setColorscale] = useState<'Viridis' | 'RdYlGn' | 'Plasma' | 'Hot'>('Viridis');
  const [showContour, setShowContour] = useState(true);
  const [elevation, setElevation] = useState(30);
  const [azimuth, setAzimuth] = useState(225);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [daysAgo, setDaysAgo] = useState(0);
  const [compareMode, setCompareMode] = useState<'current' | 'overlay' | 'delta'>('current');
  
  const historicalSurface = SURFACES_HIST[pair] || EURUSD_SURFACE_HIST;
  const displaySurface = compareMode === 'delta' ? calcDeltaSurface(surface, historicalSurface) : (daysAgo > 0 ? historicalSurface : surface);
  const dateStr = daysAgo > 0 ? `${daysAgo}天前` : '今日';
  const colorscaleForMode = compareMode === 'delta' ? 'RdYlGn' : colorscale;

  useEffect(() => {
    if (!plotRef.current) return;
    let cancelled = false;
    import('plotly.js-dist-min').then((Plotly: any) => {
      if (cancelled || !plotRef.current) return;

      const surfaceTrace: any = {
        type: 'surface',
        x: TENORS,
        y: DELTAS_LABEL,
        z: displaySurface,
        colorscale: colorscaleForMode,
        showscale: true,
        colorbar: {
          title: { text: 'IV (%)', font: { color: '#94a3b8', size: 11 } },
          tickfont: { color: '#94a3b8', size: 10 },
          len: 0.7,
          thickness: 12,
        },
        opacity: 0.92,
        contours: showContour ? {
          z: { show: true, usecolormap: true, highlightcolor: '#ffffff', project: { z: true } },
        } : {},
        hovertemplate: 'Tenor: %{x}<br>Delta: %{y}<br>IV: %{z:.1f}%<extra></extra>',
      };

      const eyeX = Math.cos(azimuth * Math.PI / 180) * Math.cos(elevation * Math.PI / 180) * 2;
      const eyeY = Math.sin(azimuth * Math.PI / 180) * Math.cos(elevation * Math.PI / 180) * 2;
      const eyeZ = Math.sin(elevation * Math.PI / 180) * 1.5;

      const layout: any = {
        paper_bgcolor: '#0d1020',
        plot_bgcolor: '#0d1020',
        font: { color: '#94a3b8', size: 11 },
        title: {
          text: `${pair} 隐含波动率曲面 (Delta × Tenor)`,
          font: { color: '#818cf8', size: 14 },
          x: 0.5,
        },
        scene: {
          xaxis: {
            title: { text: 'Tenor', font: { color: '#94a3b8' } },
            gridcolor: '#1e2a4a',
            tickfont: { color: '#94a3b8', size: 10 },
            backgroundcolor: '#0d1020',
          },
          yaxis: {
            title: { text: 'Delta', font: { color: '#94a3b8' } },
            gridcolor: '#1e2a4a',
            tickfont: { color: '#94a3b8', size: 10 },
            backgroundcolor: '#0d1020',
          },
          zaxis: {
            title: { text: 'IV (%)', font: { color: '#94a3b8' } },
            gridcolor: '#1e2a4a',
            tickfont: { color: '#94a3b8', size: 10 },
            backgroundcolor: '#0d1020',
          },
          bgcolor: '#0d1020',
          camera: { eye: { x: eyeX, y: eyeY, z: eyeZ } },
        },
        margin: { l: 0, r: 0, t: 50, b: 0 },
        autosize: true,
      };

      const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['sendDataToCloud'],
        displaylogo: false,
      };

      Plotly.newPlot(plotRef.current, [surfaceTrace], layout, config);
    });
    return () => { cancelled = true; };
  }, [pair, displaySurface, colorscaleForMode, showContour, elevation, azimuth]);

  const resetCamera = () => { setElevation(30); setAzimuth(225); };

  return (
    <div className={`space-y-3 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0d1020] p-4 overflow-auto' : ''}`}>
      {/* 控制栏 */}
      <Card className="bg-[#0d1020] border-[#1e2a4a] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">色谱：</span>
            {(['Viridis', 'RdYlGn', 'Plasma', 'Hot'] as const).map(cs => (
              <button key={cs} onClick={() => setColorscale(cs)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  colorscale === cs
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'border-[#1e2a4a] text-slate-400 hover:border-indigo-500'
                }`}>{cs}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={showContour} onChange={e => setShowContour(e.target.checked)}
                className="accent-indigo-500" />
              等高线投影
            </label>
            <button onClick={resetCamera}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-[#1e2a4a] text-slate-400 rounded hover:border-indigo-500 transition-colors">
              <RotateCcw className="w-3 h-3" />重置视角
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-[#1e2a4a] text-slate-400 rounded hover:border-indigo-500 transition-colors">
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {isFullscreen ? '退出全屏' : '全屏'}
            </button>
          </div>
        </div>
        {/* 时间轴和对比模式 */}
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">📅 时间轴：</span>
            <input type="range" min={0} max={30} value={daysAgo} onChange={e => setDaysAgo(+e.target.value)}
              className="w-40 accent-indigo-500" />
            <span className="text-xs text-slate-500 w-12">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">对比模式：</span>
            {(['current', 'overlay', 'delta'] as const).map(mode => (
              <button key={mode} onClick={() => setCompareMode(mode)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  compareMode === mode
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'border-[#1e2a4a] text-slate-400 hover:border-indigo-500'
                }`}>
                {mode === 'current' ? '当前' : mode === 'overlay' ? '叠加' : '差值'}
              </button>
            ))}
          </div>
        </div>
        {/* 仰角/方位角滑块 */}
        <div className="flex flex-wrap gap-6 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-16">仰角 {elevation}°</span>
            <input type="range" min={5} max={85} value={elevation} onChange={e => setElevation(+e.target.value)}
              className="w-32 accent-indigo-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-18">方位角 {azimuth}°</span>
            <input type="range" min={0} max={360} value={azimuth} onChange={e => setAzimuth(+e.target.value)}
              className="w-32 accent-indigo-500" />
          </div>
        </div>
        <p className="text-xs text-slate-600 mt-2">💡 拖拽旋转 · 滚轮缩放 · 双击重置 · 右键平移</p>
      </Card>

      {/* 3D 图表区 */}
      <Card className="bg-[#0d1020] border-[#1e2a4a] p-2">
        <div ref={plotRef} style={{ height: isFullscreen ? 'calc(100vh - 260px)' : '520px', width: '100%' }} />
      </Card>

      {/* 数据表格 */}
      <Card className="bg-[#0d1020] border-[#1e2a4a] p-4">
        <h4 className="text-xs font-bold text-indigo-400 mb-2">曲面数据表（IV %）</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2a4a]">
                <th className="px-3 py-1.5 text-left text-slate-500">Delta \ Tenor</th>
                {TENORS.map(t => <th key={t} className="px-3 py-1.5 text-right text-slate-500">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {surface.map((row, di) => (
                <tr key={di} className={`border-b border-[#0a1515] hover:bg-indigo-500/5 ${di === 2 ? 'bg-indigo-500/5' : ''}`}>
                  <td className={`px-3 py-1.5 font-bold ${di === 2 ? 'text-indigo-400' : 'text-slate-400'}`}>
                    {DELTAS_LABEL[di]}
                  </td>
                  {row.map((v, ti) => (
                    <td key={ti} className={`px-3 py-1.5 text-right font-mono ${
                      v > 12 ? 'text-red-400' : v > 10 ? 'text-orange-400' : v > 8 ? 'text-yellow-400' : 'text-green-400'
                    }`}>{v.toFixed(1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================
export default function FXVolatilityAdvanced() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('surface');
  const [selectedPair, setSelectedPair] = useState('EUR/USD');

  const currentSurface = SURFACES[selectedPair] || EURUSD_SURFACE;
  const skewData = useMemo(() => calcSkewData(currentSurface), [currentSurface]);

  const [selectedDelta, setSelectedDelta] = useState(2);
  const termStructure = useMemo(() =>
    TENORS.map((tenor, ti) => ({ tenor, vol: currentSurface[selectedDelta][ti] })),
    [currentSurface, selectedDelta]
  );

  const smileData = useMemo(() =>
    DELTAS.map((delta, di) => ({ delta, vol: currentSurface[di][2] })),
    [currentSurface]
  );

  const tabs = [
    { id: 'surface', label: 'FX 波动率曲面' },
    { id: 'surface3d', label: '📹 3D 波动率曲面' },
    { id: 'skew', label: '偏斜分析' },
    { id: 'hviv', label: '历史/隐含对比' },
    { id: 'cross', label: '跨货币对对比' },
    { id: 'ai', label: '🧠 AI智能体' },
  ];

  const liveMetrics = useMemo(() => ({
    'EUR/USD ATM 1M IV': '6.8%',
    'USD/JPY ATM 1M IV': '8.2%',
    'GBP/USD ATM 1M IV': '7.5%',
    '25D Risk Reversal EUR/USD': '-0.45%',
    '25D Butterfly EUR/USD': '0.28%',
    '波动率期限结构': '正斜率',
    '最高IV货币对': 'USD/TRY 42.5%',
    '波动率曲面节点': '5×6',
  }), []);

  return (
    <div className="min-h-screen bg-[#050808] text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/derivatives-trader')}
              className="text-slate-400 hover:text-indigo-400">
              <ArrowLeft className="w-4 h-4 mr-1" />返回
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-indigo-400 sm:text-2xl">WVOL</h1>
                <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">全球外汇波动率</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">FX波动率曲面 · 3D可视化 · Risk Reversal · Butterfly · 历史/隐含对比 · AI预警</p>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <select value={selectedPair} onChange={e => setSelectedPair(e.target.value)}
              className="text-sm bg-[#0d1818] border border-[#1e2a2a] text-slate-300 rounded px-3 py-1.5">
              {Object.keys(SURFACES).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="text-right">
              <div className="text-xs text-slate-500">{selectedPair} ATM 3M</div>
              <div className="text-xl font-mono font-bold text-indigo-400">{currentSurface[2][2].toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* 摘要 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'ATM 1M', value: `${currentSurface[2][0].toFixed(1)}%`, sub: '短端波动率', color: 'text-indigo-400' },
            { label: 'ATM 3M', value: `${currentSurface[2][2].toFixed(1)}%`, sub: '基准期限', color: 'text-cyan-400' },
            { label: '25D RR (3M)', value: `${skewData[2].rr25.toFixed(2)}%`, sub: '看跌偏斜', color: 'text-orange-400' },
            { label: '25D Fly (3M)', value: `${skewData[2].fly25.toFixed(2)}%`, sub: '微笑曲率', color: 'text-yellow-400' },
          ].map((item, i) => (
            <Card key={i} className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <div className="text-xs text-slate-500 mb-1">{item.label}</div>
              <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.sub}</div>
            </Card>
          ))}
        </div>

        {/* 标签导航 */}
        <div className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-[#1e2a2a] px-4 sm:mx-0 sm:px-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* FX 波动率曲面（2D表格） */}
        {activeTab === 'surface' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-indigo-400 mb-3">{selectedPair} 波动率曲面（Delta × Tenor，%）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      <th className="px-3 py-2 text-left text-slate-500">Delta</th>
                      {TENORS.map(t => <th key={t} className="px-3 py-2 text-right text-slate-500">{t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {DELTAS.map((delta, di) => (
                      <tr key={di} className={`border-b border-[#0a1515] hover:bg-[#0a1515] ${di === 2 ? 'bg-indigo-500/5' : ''}`}>
                        <td className={`px-3 py-2 font-bold ${di === 2 ? 'text-indigo-400' : 'text-slate-400'}`}>{delta}</td>
                        {TENORS.map((_, ti) => {
                          const v = currentSurface[di][ti];
                          return (
                            <td key={ti} className={`px-3 py-2 text-right font-mono ${
                              v > 12 ? 'text-red-400' : v > 10 ? 'text-orange-400' : v > 8 ? 'text-yellow-400' : 'text-green-400'
                            }`}>{v.toFixed(1)}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-bold text-indigo-400">期限结构</h3>
                  <select value={selectedDelta} onChange={e => setSelectedDelta(parseInt(e.target.value))}
                    className="text-xs bg-[#0a0a0a] border border-[#1e2a2a] text-slate-300 rounded px-2 py-1">
                    {DELTAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={termStructure}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                    <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 11 }}
                      formatter={(v: any) => [`${v}%`]} />
                    <Line type="monotone" dataKey="vol" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 4 }} name={`${DELTAS[selectedDelta]} IV`} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
                <h3 className="text-sm font-bold text-indigo-400 mb-3">3M 波动率微笑</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={smileData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                    <XAxis dataKey="delta" stroke="#4a5568" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 11 }}
                      formatter={(v: any) => [`${v}%`, '3M IV']} />
                    <Line type="monotone" dataKey="vol" stroke="#818cf8" strokeWidth={2.5} dot={{ r: 5 }} name="3M IV" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* 3D 波动率曲面 */}
        {activeTab === 'surface3d' && (
          <VolSurface3D pair={selectedPair} surface={currentSurface} />
        )}

        {/* 偏斜分析 */}
        {activeTab === 'skew' && (
          <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
            <h3 className="text-sm font-bold text-indigo-400 mb-3">{selectedPair} 偏斜分析（Risk Reversal & Butterfly）</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2a2a]">
                    {['期限', 'ATM IV', '25D RR', '10D RR', '25D Fly', '偏斜解读'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skewData.map((row, i) => (
                    <tr key={i} className="border-b border-[#0a1515] hover:bg-[#0a1515]">
                      <td className="px-3 py-3 text-slate-300 font-bold">{row.tenor}</td>
                      <td className="px-3 py-3 font-mono text-indigo-300">{row.atm.toFixed(1)}%</td>
                      <td className={`px-3 py-3 font-mono ${row.rr25 > 0 ? 'text-orange-400' : 'text-cyan-400'}`}>{row.rr25 > 0 ? '+' : ''}{row.rr25.toFixed(2)}%</td>
                      <td className={`px-3 py-3 font-mono ${row.rr10 > 0 ? 'text-red-400' : 'text-green-400'}`}>{row.rr10 > 0 ? '+' : ''}{row.rr10.toFixed(2)}%</td>
                      <td className="px-3 py-3 font-mono text-yellow-400">{row.fly25.toFixed(2)}%</td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {row.rr25 > 1 ? '看跌偏斜，市场偏空' : row.rr25 < -1 ? '看涨偏斜，市场偏多' : '偏斜平坦'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={skewData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                <XAxis dataKey="tenor" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 11 }}
                  formatter={(v: any) => [`${v}%`]} />
                <Legend />
                <Bar dataKey="rr25" fill="#f97316" name="25D RR" opacity={0.8} />
                <Bar dataKey="fly25" fill="#818cf8" name="25D Fly" opacity={0.8} />
                <ReferenceLine y={0} stroke="#4a5568" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* 历史/隐含对比 */}
        {activeTab === 'hviv' && (
          <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
            <h3 className="text-sm font-bold text-indigo-400 mb-3">EUR/USD 历史波动率 vs 隐含波动率（1M，%）</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={HV_IV_HISTORY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                <XAxis dataKey="month" stroke="#4a5568" tick={{ fontSize: 11 }} />
                <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 11 }}
                  formatter={(v: any) => [`${v}%`]} />
                <Legend />
                <Line type="monotone" dataKey="hv" stroke="#22d3ee" strokeWidth={2} name="HV 历史波动率" dot={false} />
                <Line type="monotone" dataKey="iv" stroke="#818cf8" strokeWidth={2} name="IV 隐含波动率" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 p-3 bg-[#0a0a0a] rounded border border-[#1e2a2a] text-sm">
              <span className="text-slate-500">平均 VRP: </span>
              <span className="text-indigo-400 font-mono font-bold">+1.7%</span>
              <span className="text-slate-500 ml-4">当前 VRP: </span>
              <span className="text-indigo-400 font-mono font-bold">+1.7%</span>
              <span className="text-slate-500 ml-4">期权卖方长期获得正溢价</span>
            </div>
          </Card>
        )}

        {/* 跨货币对对比 */}
        {activeTab === 'cross' && (
          <div className="space-y-4">
            <Card className="bg-[#0d1818] border-[#1e2a2a] p-4">
              <h3 className="text-sm font-bold text-indigo-400 mb-3">主要货币对 ATM 波动率对比</h3>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2a2a]">
                      {['货币对', '1M ATM', '3M ATM', '1Y ATM', '日变化', '曲线形态'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CROSS_VOL.map((p, i) => {
                      const slope = p.vol1y - p.vol1m;
                      return (
                        <tr key={i} className="border-b border-[#0a1515] hover:bg-[#0a1515]">
                          <td className="px-3 py-3 text-indigo-300 font-bold">{p.pair}</td>
                          <td className="px-3 py-3 font-mono text-slate-300">{p.vol1m.toFixed(1)}%</td>
                          <td className="px-3 py-3 font-mono text-indigo-300 font-bold">{p.vol3m.toFixed(1)}%</td>
                          <td className="px-3 py-3 font-mono text-slate-400">{p.vol1y.toFixed(1)}%</td>
                          <td className={`px-3 py-3 font-mono text-xs ${p.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {p.change > 0 ? '+' : ''}{p.change.toFixed(1)}%
                          </td>
                          <td className={`px-3 py-3 text-xs ${slope > 2 ? 'text-cyan-400' : slope > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {slope > 2 ? '正斜率' : slope > 0 ? '平坦' : '倒挂'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={CROSS_VOL.map(p => ({ pair: p.pair, vol: p.vol3m }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a2a" />
                  <XAxis dataKey="pair" stroke="#4a5568" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#4a5568" tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0d1818', border: '1px solid #1e2a2a', fontSize: 11 }}
                    formatter={(v: any) => [`${v}%`, '3M ATM IV']} />
                  <Bar dataKey="vol" fill="#818cf8" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === 'ai' && (
          <DerivativesAIPanel moduleCode="WVOL" moduleName="全球外汇波动率" accentColor="indigo"
            liveMetrics={liveMetrics}
          />
        )}
      </div>
    </div>
  );
}
