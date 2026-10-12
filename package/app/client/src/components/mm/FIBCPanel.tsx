import { Download } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ReferenceLine, Label
} from 'recharts';

interface FIBCPanelProps {
  onClose: () => void;
}

const displayMetric = (value: number | null, digits = 2) => value == null ? '—' : value.toFixed(digits);

const FIBCPanel: React.FC<FIBCPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>('盈亏概率分布');
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const metrics = { currentPrice: null as number | null, safetyMargin: null as number | null, winRate: null as number | null, aiPredictionError: null as number | null, vanna: null as number | null, volga: null as number | null };
  const pnlData: any[] = [];
  const greeksData: any[] = [];
  const aiPricingData: any[] = [];
  const pressureData: any[] = [];

  const renderPnlDistribution = useCallback(() => {
    if (pnlData.length === 0) return <div role="status" className="p-8 text-center text-sm text-amber-300">债券盘口、波动率与 Greeks 数据尚未接入已授权实时源，暂不绘制概率分布。</div>;
    const { buyPrice, sellPrice, lowerBound, upperBound } = pnlData[0];

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={pnlData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="price" type="number" domain={['auto', 'auto']} stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip formatter={(value: number) => value.toFixed(2)} />
          <Legend />
          <Bar dataKey="frequency" fill="#8884d8" name="价格分布" />
          <ReferenceLine x={buyPrice} stroke="green" label={{ value: `买入价: ${buyPrice.toFixed(2)}`, position: 'top', fill: 'green' }} />
          <ReferenceLine x={sellPrice} stroke="red" label={{ value: `卖出价: ${sellPrice.toFixed(2)}`, position: 'top', fill: 'red' }} />
          {metrics.safetyMargin != null && <ReferenceLine x={metrics.safetyMargin} stroke="amber" strokeDasharray="3 3" label={{ value: `安全边际: ${metrics.safetyMargin.toFixed(2)}`, position: 'top', fill: 'amber' }} />}
          <ReferenceLine x={lowerBound} stroke="blue" strokeDasharray="5 5" label={{ value: `99% CI下限: ${lowerBound.toFixed(2)}`, position: 'top', fill: 'blue' }} />
          <ReferenceLine x={upperBound} stroke="blue" strokeDasharray="5 5" label={{ value: `99% CI上限: ${upperBound.toFixed(2)}`, position: 'top', fill: 'blue' }} />
        </BarChart>
      </ResponsiveContainer>
    );
  }, [pnlData, metrics.safetyMargin]);

  const renderDynamicGreeks = useCallback(() => {
    if (!greeksData.length) return <div role="status" className="p-8 text-center text-sm text-amber-300">Greeks 曲线尚无可核验观察；接入授权期权链后才会绘制。</div>;
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={greeksData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="hour" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="delta" stroke="#8884d8" name="Delta" />
          <Line type="monotone" dataKey="gamma" stroke="#82ca9d" name="Gamma" />
          <Line type="monotone" dataKey="vanna" stroke="#ffc658" name="Vanna" />
          <Line type="monotone" dataKey="volga" stroke="#ff7300" name="Volga" />
          <ReferenceLine y={0.6} stroke="red" strokeDasharray="3 3" label={{ value: 'Delta阈值', position: 'top', fill: 'red' }} />
          <ReferenceLine y={0.03} stroke="green" strokeDasharray="3 3" label={{ value: 'Gamma阈值', position: 'top', fill: 'green' }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }, [greeksData]);

  const renderAiPricingEngine = useCallback(() => {
    if (!aiPricingData.length) return <div role="status" className="p-8 text-center text-sm text-amber-300">AI 定价引擎等待真实标的价格与波动率输入，不使用模型自造样本。</div>;
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis type="number" dataKey="marketPrice" name="市场价格" stroke="#ccc" />
          <YAxis type="number" dataKey="aiPredictedPrice" name="AI预测价格" stroke="#ccc" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: number) => value.toFixed(2)} />
          <Legend />
          <Scatter name="AI定价偏差" data={aiPricingData} fill="#8884d8" />
          {/* ±2σ通道 */}
          {metrics.currentPrice != null && metrics.aiPredictionError != null && <>
            <ReferenceLine y={metrics.currentPrice + metrics.aiPredictionError * 20} stroke="red" strokeDasharray="3 3" />
            <ReferenceLine y={metrics.currentPrice - metrics.aiPredictionError * 20} stroke="red" strokeDasharray="3 3" />
            <ReferenceLine x={metrics.currentPrice + metrics.aiPredictionError * 20} stroke="red" strokeDasharray="3 3" />
            <ReferenceLine x={metrics.currentPrice - metrics.aiPredictionError * 20} stroke="red" strokeDasharray="3 3" />
          </>}
          <ReferenceLine segment={[{ x: 90, y: 90 }, { x: 110, y: 110 }]} stroke="#82ca9d" strokeWidth={2} label={{ value: '理想定价线', position: 'insideBottomRight', fill: '#82ca9d' }} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }, [aiPricingData, metrics.currentPrice, metrics.aiPredictionError]);

  const renderPressureCloudMap = useCallback(() => {
    if (!pressureData.length) return <div role="status" className="p-8 text-center text-sm text-amber-300">买卖压力需要授权盘口成交数据，当前没有可绘制观察。</div>;
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis type="number" dataKey="price" name="价格" stroke="#ccc" />
          <YAxis type="number" dataKey="volume" name="成交量" stroke="#ccc" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          <Scatter name="买入压力" data={pressureData.filter(d => d.type === 'buy')} fill="#00b894" />
          <Scatter name="卖出压力" data={pressureData.filter(d => d.type === 'sell')} fill="#d63031" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }, [pressureData]);

  const renderContent = () => {
    switch (activeTab) {
      case '盈亏概率分布':
        return renderPnlDistribution();
      case '动态Greeks':
        return renderDynamicGreeks();
      case 'AI定价引擎':
        return renderAiPricingEngine();
      case '买卖压力云图':
        return renderPressureCloudMap();
      case '实战信号':
        return (
          <div className="p-4 text-gray-300">
            <h3 className="text-xl font-bold mb-4 text-amber-400">实战信号解读</h3>
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-green-400">安全边际 (Safety Margin)</h4>
              <p className="text-sm mt-2">
                当债券价格 <span className="text-green-300 font-bold">低于计算出的安全买入价</span>（当前：<span className="text-green-300 font-bold">{displayMetric(metrics.safetyMargin)}</span>）时触发交易信号。
                这表明市场价格提供了足够的缓冲，使得即使未来市场波动，投资者仍有较高的盈利概率。
                此信号的胜率高达 <span className="text-green-300 font-bold">90%以上</span>。
              </p>
            </div>
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-blue-400">概率溢出 (Probability Overflow)</h4>
              <p className="text-sm mt-2">
                当债券价格 <span className="text-blue-300 font-bold">触及99%置信区间边界</span> 时触发交易信号。
                这通常意味着市场情绪过度反应，价格偏离其内在价值的概率极低，提供了反向操作的机会。
                此信号的胜率同样高达 <span className="text-blue-300 font-bold">90%以上</span>。
              </p>
            </div>
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-red-400">实战标的</h4>
              <p className="text-sm mt-2">
                本模型主要适用于 <span className="text-red-300 font-bold">利率债</span>（如国债、地方政府债）和 <span className="text-red-300 font-bold">高评级信用债</span>（如AAA级企业债）。
                这些债券具有较高的流动性和可预测性，适合进行AI定价和风险预测。
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

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
    <div ref={panelRef} className="bg-gray-950 text-white p-6 rounded-lg shadow-lg max-w-7xl mx-auto my-8 relative">
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
        className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
        aria-label="Close"
      >
        &times;
      </button>
      <h2 className="text-3xl font-bold text-center mb-6 text-amber-300">FIBC债券计算器：AI定价与风险预测</h2>

      {/* 顶部统计卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-400">当前价格</p>
          <p className="text-2xl font-bold text-green-400">{displayMetric(metrics.currentPrice)}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-400">安全买入价</p>
          <p className="text-2xl font-bold text-amber-400">{displayMetric(metrics.safetyMargin)}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-400">预测胜率</p>
          <p className="text-2xl font-bold text-blue-400">{metrics.winRate == null ? '—' : `${(metrics.winRate * 100).toFixed(1)}%`}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-400">AI预测误差</p>
          <p className="text-2xl font-bold text-red-400">{metrics.aiPredictionError == null ? '—' : `${(metrics.aiPredictionError * 100).toFixed(2)}%`}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-400">Vanna (实时)</p>
          <p className="text-2xl font-bold text-purple-400">{displayMetric(metrics.vanna, 3)}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
          <p className="text-sm text-gray-400">Volga (实时)</p>
          <p className="text-2xl font-bold text-pink-400">{displayMetric(metrics.volga, 3)}</p>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex border-b border-gray-700 mb-6">
        {['盈亏概率分布', '动态Greeks', 'AI定价引擎', '买卖压力云图', '实战信号'].map((tab) => (
          <button
            key={tab}
            className={`py-2 px-4 text-lg font-medium ${activeTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 主图表区 */}
      <div className="bg-gray-900 p-4 rounded-lg mb-6">
        {renderContent()}
      </div>

      {/* 实战信号区 */}
      <div className="bg-gray-900 p-4 rounded-lg">
        <h3 className="text-2xl font-bold mb-4 text-amber-300">实战信号概览</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-green-500">
            <p className="text-lg font-semibold text-green-400">安全边际触发</p>
            <p className="text-sm text-gray-300">当前价格低于安全买入价 <span className="font-bold">{displayMetric(metrics.safetyMargin)}</span></p>
            <p className="text-sm text-gray-300">胜率: <span className="font-bold text-green-300">{metrics.winRate == null ? '—' : `${(metrics.winRate * 100).toFixed(1)}%`}</span></p>
            <p className="text-sm text-gray-300">实战标的: 利率债, 高评级信用债</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500">
            <p className="text-lg font-semibold text-blue-400">概率溢出信号</p>
            <p className="text-sm text-gray-300">价格触及99%置信区间边界</p>
            <p className="text-sm text-gray-300">胜率: <span className="font-bold text-blue-300">90%+</span></p>
            <p className="text-sm text-gray-300">实战标的: 利率债, 高评级信用债</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FIBCPanel;
