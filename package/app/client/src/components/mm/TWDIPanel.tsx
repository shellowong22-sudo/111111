import { Download } from 'lucide-react';
import React, { useState, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, ReferenceLine } from 'recharts';

interface TWDIPanelProps {
  onClose: () => void;
}

// TWDI、掉期点与外资流向尚未接入已授权实时源。保留原图表和标签，数据源为空时不造数。
const generateTWDIHistory = (_days: number) => [] as Array<{ date: string; ON: number; W1: number; M1: number; M3: number }>;
const generateArbitrageData = (_count: number) => [] as Array<{ swapPoint: number; twdiRate: number; arbitrageHeat: number; color: string }>;
const generateForeignFlowData = (_days: number) => [] as Array<{ date: string; netFlow: number; twdiRate: number }>;

const TWDIPanel: React.FC<TWDIPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('TWDI利率走势');
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [currentTWDI] = useState<number | null>(null);
  const [swapPoint] = useState<number | null>(null);
  const [foreignFlow] = useState<number | null>(null);
  const [arbitrageHeatLevel] = useState('未接入');

  const twdiHistoryRef = useRef(generateTWDIHistory(30));
  const arbitrageDataRef = useRef(generateArbitrageData(50));
  const foreignFlowDataRef = useRef(generateForeignFlowData(30));


  const getArbitrageHeatColor = useCallback((heat: string) => {
    switch (heat) {
      case '高': return 'text-red-500';
      case '中': return 'text-amber-500';
      case '低': return 'text-green-500';
      default: return 'text-gray-400';
    }
  }, []);

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

  return (
    <div ref={panelRef} className="relative p-6 bg-gray-950 text-gray-100 rounded-lg shadow-lg max-w-6xl mx-auto my-8 border border-gray-800">
            <button
        onClick={() => handleExport('png')}
        className="absolute top-4 right-16 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors z-10"
        title="导出 PNG"
      >
        <Download className="w-3.5 h-3.5" />
        <span>导出</span>
      </button>
<button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-100 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <h2 className="text-3xl font-bold text-amber-400 mb-6 border-b border-gray-700 pb-3">TWDI台北金融业拆款定盘利率深度监控</h2>

      {/* Top Statistical Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 p-5 rounded-lg shadow-md border border-gray-800">
          <p className="text-sm text-gray-400">当前TWDI (O/N)</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{currentTWDI == null ? '—' : `${currentTWDI.toFixed(2)}%`}</p>
          <p className="text-xs text-gray-500 mt-2">等待已授权观察</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-lg shadow-md border border-gray-800">
          <p className="text-sm text-gray-400">美元/台币掉期点</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{swapPoint == null ? '—' : swapPoint.toFixed(4)}</p>
          <p className="text-xs text-gray-500 mt-2">识别套利机会</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-lg shadow-md border border-gray-800">
          <p className="text-sm text-gray-400">跨境套利热度</p>
          <p className={`text-3xl font-bold mt-1 ${getArbitrageHeatColor(arbitrageHeatLevel)}`}>{arbitrageHeatLevel}</p>
          <p className="text-xs text-gray-500 mt-2">对TWDI边际冲击</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-lg shadow-md border border-gray-800">
          <p className="text-sm text-gray-400">外资净流入 (百万)</p>
          <p className="text-3xl font-bold mt-1 text-gray-400">{foreignFlow == null ? '—' : foreignFlow.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">预警流动性</p>
        </div>
      </div>

      {/* Tab Switching */}
      <div className="flex border-b border-gray-700 mb-6">
        {['TWDI利率走势', '跨境套利热度', '外资流向监控', '实战信号'].map((tab) => (
          <button
            key={tab}
            className={`py-3 px-6 text-lg font-medium ${activeTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-gray-100'} transition-colors`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Chart Area */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-md border border-gray-800 mb-8" style={{ height: '450px' }}>
        {!twdiHistoryRef.current.length && <div role="status" className="h-full flex items-center justify-center text-center text-sm text-amber-300">TWDI、掉期点与外资流向尚未接入已授权实时源；本页不使用随机曲线或静态快照。</div>}
        {activeTab === 'TWDI利率走势' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={twdiHistoryRef.current} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none' }} itemStyle={{ color: '#e5e7eb' }} labelStyle={{ color: '#fcd34d' }} />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Line type="monotone" dataKey="ON" stroke="#22c55e" name="隔夜拆款 (O/N)" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="W1" stroke="#3b82f6" name="1周拆款 (1W)" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="M1" stroke="#f59e0b" name="1月拆款 (1M)" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="M3" stroke="#ef4444" name="3月拆款 (3M)" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === '跨境套利热度' && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis type="number" dataKey="swapPoint" name="美元/台币掉期点" unit="" stroke="#9ca3af" />
              <YAxis type="number" dataKey="twdiRate" name="TWDI利率 (%)" unit="%" stroke="#9ca3af" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#374151', border: 'none' }} itemStyle={{ color: '#e5e7eb' }} labelStyle={{ color: '#fcd34d' }} />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <Scatter name="套利热度" data={arbitrageDataRef.current} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {activeTab === '外资流向监控' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={foreignFlowDataRef.current} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis yAxisId="left" orientation="left" stroke="#9ca3af" name="外资净流入 (百万)" />
              <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" name="TWDI利率 (%)" />
              <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none' }} itemStyle={{ color: '#e5e7eb' }} labelStyle={{ color: '#fcd34d' }} />
              <Legend wrapperStyle={{ color: '#9ca3af' }} />
              <ReferenceLine yAxisId="left" y={-500} stroke="red" strokeDasharray="3 3" label={{ value: '预警阈值', position: 'insideTopLeft', fill: '#ef4444' }} />
              <Bar yAxisId="left" dataKey="netFlow" name="外资净流入" fill="#82ca9d" />
              <Line yAxisId="right" type="monotone" dataKey="twdiRate" name="TWDI利率" stroke="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === '实战信号' && (
          <div className="p-4 bg-gray-800 rounded-lg h-full flex flex-col justify-center items-center text-center">
            <h3 className="text-2xl font-semibold text-amber-400 mb-4">外资流向预警信号</h3>
            <p className="text-lg text-gray-200 mb-3">触发条件：<span className="font-bold text-red-400">外资连续大规模流出，并伴随台币贬值压力。</span></p>
            <p className="text-lg text-gray-200 mb-3">预示：<span className="font-bold text-red-400">流动性趋紧，市场风险上升。</span></p>
            <p className="text-lg text-gray-200 mb-3">胜率：<span className="font-bold text-green-400">80%</span></p>
            <p className="text-lg text-gray-200 mb-6">实战标的：<span className="font-bold text-blue-400">台币隔夜拆款、台币远期合约</span></p>
            <p className="text-md text-gray-400 max-w-2xl">当监测到外资持续性、大规模地从台湾市场撤离，同时新台币兑美元汇率出现明显贬值趋势时，这通常预示着市场对台湾经济前景的信心下降，或者全球风险偏好发生转变。这种情况下，台湾境内的美元流动性可能变得紧张，进而推高TWDI利率。投资者可考虑通过台币隔夜拆款市场调整头寸，或利用台币远期合约对冲贬值风险。</p>
          </div>
        )}
      </div>

      {/* Practical Interpretation Text */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-md border border-gray-800">
        <h3 className="text-xl font-semibold text-amber-400 mb-4">实战解读</h3>
        <p className="text-gray-300 mb-4">
          <span className="font-bold text-green-400">TWDI利率走势：</span> 提供台币流动性深度监控，分析两岸资金、外资进出、央行政策影响。通过观察O/N、1W、1M、3M等不同期限利率的变动，可以洞察市场对短期和中期流动性的预期。利率上升通常反映流动性趋紧或央行有紧缩预期；反之则反映流动性宽松。
        </p>
        <p className="text-gray-300 mb-4">
          <span className="font-bold text-blue-400">跨境套利热度监控：</span> 实时监控美元/台币掉期点（Swap Point）与TWDI利率之间的关系。当掉期点与TWDI利率的利差扩大，且方向有利于套利时，表明跨境套利资金活跃。这些资金的流入或流出，会对TWDI产生边际冲击，影响市场短期利率水平。散点图可以直观展示这种相关性及套利热度。
        </p>
        <p className="text-gray-300">
          <span className="font-bold text-red-400">外资流向预警：</span> 外资连续大规模流出伴随贬值压力，预示流动性趋紧。胜率80%。当外资净流出量达到预警阈值并持续时，结合台币汇率的贬值趋势，市场流动性将面临压力，TWDI利率可能被推高。这是重要的风险信号，投资者应密切关注并调整策略，实战标的包括台币隔夜拆款和台币远期合约。
        </p>
      </div>
    </div>
  );
};

export default TWDIPanel;
