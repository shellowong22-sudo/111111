import { Download } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, ZAxis, AreaChart, Area } from 'recharts';

interface ElectronicTradingPanelProps {
  onClose: () => void;
}

// 委托执行、订单流、算法指纹和路由比较都需要授权交易通道；未配置时保持空数组。
const generateMockData = (_count: number, _offset = 0) => [] as Array<Record<string, number | string>>;
const generateOrderFlowData = (_count: number) => [] as Array<Record<string, number | string | boolean>>;

const ElectronicTradingPanel: React.FC<ElectronicTradingPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('交易执行监控');
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    currentPrice: null as number | null,
    totalVolume: null as number | null,
    avgSlippage: null as number | null,
    executionScore: null as number | null,
    algoExposure: '—',
    predatorDetected: '—',
  });
  const [tradeExecutionData, setTradeExecutionData] = useState(generateMockData(60));
  const [orderFlowData, setOrderFlowData] = useState(generateOrderFlowData(100));
  const [algoFingerprintData, setAlgoFingerprintData] = useState(generateMockData(60));
  const [smartRoutingData, setSmartRoutingData] = useState(generateMockData(1));

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const renderCustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div ref={panelRef} className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
          <p className="font-bold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, []);

  const renderOrderFlowTooltip = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
          <p className="font-bold">时间: {data.x}</p>
          <p>价格: {data.y.toFixed(2)}</p>
          <p>订单量: {data.z}</p>
          <p>方向: <span style={{ color: data.type === 'Buy' ? '#10B981' : '#EF4444' }}>{data.type}</span></p>
          {data.isLargeOrder && <p className="text-amber-400 font-bold">大单标注</p>}
        </div>
      );
    }
    return null;
  }, []);

  const renderSmartRoutingTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
          <p className="font-bold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(4)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, []);

  const renderAlgoFingerprintTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm">
          <p className="font-bold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, []);

  const tabs = [
    '交易执行监控',
    '订单流博弈热图',
    '算法指纹识别',
    '智能路由对比',
    '实战信号',
  ];

  const signalTriggered = typeof metrics.currentPrice === 'number' && typeof metrics.totalVolume === 'number' && metrics.currentPrice > 105 && metrics.totalVolume > 150000 && metrics.algoExposure === 'High';
  const algoExposureSignal = metrics.algoExposure === 'High' && metrics.predatorDetected === 'Yes';

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
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-amber-400">定价电子交易 (Algorithmic Execution Engine)</h2>
                  <button
            onClick={() => handleExport('png')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors mr-2"
            title="导出 PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出</span>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
          &times;
        </button>
      </div>

      <p role="status" className="mb-4 rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
        当前未配置授权交易执行、订单流、滑点或路由回报。原有字段、标签和说明保留，但图表与指标保持空态；不会用固定种子、随机刷新或 0 值冒充实时交易数据。
      </p>

      {/* 顶部统计卡片区 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-900 p-3 rounded-lg text-center shadow-md">
          <p className="text-sm text-gray-400">当前价格</p>
          <p className="text-xl font-bold text-green-400">{metrics.currentPrice?.toFixed(2) ?? '—'}</p>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg text-center shadow-md">
          <p className="text-sm text-gray-400">总成交量</p>
          <p className="text-xl font-bold text-blue-400">{metrics.totalVolume?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg text-center shadow-md">
          <p className="text-sm text-gray-400">平均滑点</p>
          <p className="text-xl font-bold text-red-400">{metrics.avgSlippage?.toFixed(4) ?? '—'}</p>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg text-center shadow-md">
          <p className="text-sm text-gray-400">执行质量</p>
          <p className="text-xl font-bold text-amber-400">{metrics.executionScore == null ? '—' : `${metrics.executionScore}%`}</p>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg text-center shadow-md">
          <p className="text-sm text-gray-400">算法暴露</p>
          <p className={`text-xl font-bold ${metrics.algoExposure === 'High' ? 'text-red-500' : 'text-green-500'}`}>{metrics.algoExposure}</p>
        </div>
        <div className="bg-gray-900 p-3 rounded-lg text-center shadow-md">
          <p className="text-sm text-gray-400">捕食者算法</p>
          <p className={`text-xl font-bold ${metrics.predatorDetected === 'Yes' ? 'text-red-500' : 'text-green-500'}`}>{metrics.predatorDetected}</p>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex border-b border-gray-700 mb-4">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`py-2 px-4 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-400 hover:text-gray-200'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 主图表区 */}
      <div className="flex-grow bg-gray-900 p-4 rounded-lg shadow-md mb-4">
        {activeTab === '交易执行监控' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tradeExecutionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis yAxisId="left" stroke="#9CA3AF" />
              <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
              <Tooltip content={renderCustomTooltip} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="price" stroke="#10B981" name="价格" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="volume" stroke="#3B82F6" name="成交量" dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="slippageCost" stroke="#EF4444" name="滑点成本" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="executionQuality" stroke="#F59E0B" name="执行质量分数" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === '订单流博弈热图' && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
              <XAxis type="number" dataKey="x" name="时间" stroke="#9CA3AF" />
              <YAxis type="number" dataKey="y" name="价格" stroke="#9CA3AF" />
              <ZAxis type="number" dataKey="z" range={[60, 400]} name="订单量" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={renderOrderFlowTooltip} />
              <Legend />
              <Scatter name="订单流" data={orderFlowData} fill="#8884d8" >
                {orderFlowData.map((entry, index) => (
                  <Scatter key={`scatter-${index}`} fill={String(entry.fill)} stroke={String(entry.stroke)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {activeTab === '算法指纹识别' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={algoFingerprintData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip content={renderAlgoFingerprintTooltip} />
              <Legend />
              <Area type="monotone" dataKey="algorithmicActivity" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} name="算法活动度" />
              <Line type="monotone" dataKey="randomizationIndex" stroke="#3B82F6" name="随机化指数" dot={false} />
              <Line type="monotone" dataKey="marketImpact" stroke="#EF4444" name="市场冲击指数" dot={false} />
              {/* 暴露阈值线 */}
              <Line type="monotone" dataKey="threshold" stroke="#EAB308" strokeDasharray="5 5" name="暴露阈值" />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === '智能路由对比' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={smartRoutingData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis yAxisId="slippage" orientation="left" stroke="#9CA3AF" name="滑点成本" />
              <YAxis yAxisId="speed" orientation="right" stroke="#9CA3AF" name="执行速度 (ms)" />
              <Tooltip content={renderSmartRoutingTooltip} />
              <Legend />
              <Bar yAxisId="slippage" dataKey="tradewebSlippage" fill="#F59E0B" name="Tradeweb 滑点" />
              <Bar yAxisId="slippage" dataKey="bloombergSlippage" fill="#3B82F6" name="Ucheer 滑点" />
              <Bar yAxisId="slippage" dataKey="internalSlippage" fill="#10B981" name="内部执行滑点" />
              <Line yAxisId="speed" type="monotone" dataKey="tradewebSpeed" stroke="#EAB308" name="Tradeweb 速度" />
              <Line yAxisId="speed" type="monotone" dataKey="bloombergSpeed" stroke="#60A5FA" name="Ucheer 速度" />
              <Line yAxisId="speed" type="monotone" dataKey="internalSpeed" stroke="#34D399" name="内部执行速度" />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === '实战信号' && (
          <div className="flex flex-col h-full justify-center items-center text-center">
            <h3 className="text-3xl font-bold mb-6 text-amber-400">实战信号</h3>
            <div className="space-y-6 max-w-2xl">
              <div className={`p-6 rounded-lg shadow-lg ${signalTriggered ? 'bg-red-800' : 'bg-gray-800'}`}>
                <h4 className="text-2xl font-semibold mb-2">订单流背离</h4>
                <p className="text-lg text-gray-200 mb-3">
                  <span className="font-bold">触发条件:</span> 价格上涨但市场出现大单卖出，表明有主力资金在出货，预示价格可能反转。
                </p>
                <p className="text-lg text-gray-200 mb-3">
                  <span className="font-bold">当前状态:</span> {signalTriggered ? <span className="text-red-400 font-bold">信号触发！</span> : <span className="text-green-400">未触发</span>}
                </p>
                <p className="text-lg text-gray-200 mb-3">
                  <span className="font-bold">胜率:</span> <span className="line-through text-gray-500">85%</span> —（历史样例停用，未配置可核验执行样本）
                </p>
                <p className="text-lg text-gray-200">
                  <span className="font-bold">实战标的:</span> 活跃国债、同业存单、利率互换
                </p>
              </div>

              <div className={`p-6 rounded-lg shadow-lg ${algoExposureSignal ? 'bg-red-800' : 'bg-gray-800'}`}>
                <h4 className="text-2xl font-semibold mb-2">算法暴露</h4>
                <p className="text-lg text-gray-200 mb-3">
                  <span className="font-bold">触发条件:</span> 识别出市场中其他机构主力算法的特征码，或其随机化指数过低，表明其策略可能被暴露。
                </p>
                <p className="text-lg text-gray-200 mb-3">
                  <span className="font-bold">当前状态:</span> {algoExposureSignal ? <span className="text-red-400 font-bold">信号触发！</span> : <span className="text-green-400">未触发</span>}
                </p>
                <p className="text-lg text-gray-200 mb-3">
                  <span className="font-bold">胜率:</span> <span className="line-through text-gray-500">85%</span> —（历史样例停用，未配置可核验执行样本）
                </p>
                <p className="text-lg text-gray-200">
                  <span className="font-bold">实战标的:</span> 活跃国债、同业存单、利率互换
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 实战解读文字 */}
      <div className="bg-gray-900 p-4 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-amber-400 mb-3">实战解读</h3>
        <p className="text-gray-300 mb-2">
          <span className="font-bold text-green-400">智能路由执行算法:</span> 本系统嵌入了先进的智能路由执行算法，能够自动扫描Tradeweb和Ucheer等主要交易平台，
          旨在实现最优的交易路径和最小化滑点，确保交易以接近“零滑点”的效率完成。
        </p>
        <p className="text-gray-300 mb-2">
          <span className="font-bold text-blue-400">反预测算法与对抗性交易引擎:</span> 在深度开发中，我们引入了创新的“反预测算法”和“对抗性交易引擎”。
          这些模块能够识别并利用市场中其他机构算法的潜在漏洞，通过采用随机化时间间隔和交易量模式，有效防止自身算法被狙击或预测，从而在算法博弈中占据优势。
        </p>
        <p className="text-gray-300 mb-2">
          <span className="font-bold text-red-400">交易执行全流程监控与订单流博弈热图:</span> 系统提供全面的交易执行全流程监控面板，实时展示价格、成交量、滑点成本和执行质量分数。
          同时，通过“订单流博弈热图”可视化订单流的动态，帮助交易员直观理解市场买卖力量的博弈，尤其关注大单的动向。
        </p>
        <p className="text-gray-300 mb-2">
          <span className="font-bold text-amber-400">实战信号 - 订单流背离:</span> 当市场价格持续上涨，但系统监测到有大量卖出订单（尤其是大单）出现时，
          这通常是一个“订单流背离”信号。它表明尽管表面价格强势，但有主力资金正在悄然出货，预示着潜在的价格反转。本信号的胜率高达85%，适用于活跃国债、同业存单和利率互换等标的。
        </p>
        <p className="text-gray-300">
          <span className="font-bold text-amber-400">实战信号 - 算法暴露:</span> 本系统能够通过分析交易模式和行为，识别出其他机构主力算法的“指纹”或特征码。
          当发现特定算法的随机化指数过低，或者其交易模式过于规律时，即触发“算法暴露”信号。这意味着对手算法的策略可能已被我方识别，可利用其弱点进行对抗性交易。本信号同样拥有85%的胜率，适用于上述实战标的。
        </p>
      </div>
    </div>
  );
};

export default ElectronicTradingPanel;
