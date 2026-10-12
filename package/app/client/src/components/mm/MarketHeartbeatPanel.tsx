import { Download } from 'lucide-react';
import React, { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis, BarChart, Bar, AreaChart, Area } from 'recharts';

// Headlessui Tab shim
const _TabCtx = React.createContext<{selected:number;setSelected:(n:number)=>void}>({selected:0,setSelected:()=>{}});
const Tab = Object.assign(
  ({children}:any)=><div>{children}</div>,
  {
    Group:({children,selectedIndex,onChange}:any)=>{const[s,ss]=React.useState(selectedIndex||0);React.useEffect(()=>ss(selectedIndex||0),[selectedIndex]);return <_TabCtx.Provider value={{selected:s,setSelected:(n)=>{ss(n);onChange?.(n);}}}>{ children }</_TabCtx.Provider>;},
    List:({children,className}:any)=>{const{selected,setSelected}=React.useContext(_TabCtx);return <div className={`flex border-b border-gray-700 overflow-x-auto ${className||''}`}>{React.Children.map(children,(c,i)=>React.cloneElement(c,{_i:i,_sel:selected===i,_onClick:()=>setSelected(i)}))}</div>;},
    Panels:({children}:any)=>{const{selected}=React.useContext(_TabCtx);return <div>{React.Children.map(children,(c,i)=>i===selected?c:null)}</div>;},
    Panel:({children}:any)=><div>{children}</div>,
  }
);


interface MarketHeartbeatPanelProps {
  onClose: () => void;
}

// Shibor/SOFR/EURIBOR/TIBOR and liquidity regimes require verified public
// observations.  Empty arrays are intentional until the relevant source is
// configured; no random path is used as a market heartbeat.

const MarketHeartbeatPanel: React.FC<MarketHeartbeatPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const snapshot = trpc.moneyMarketResearch.getSnapshot.useQuery(undefined, { staleTime: 30_000, refetchInterval: 30_000, retry: false });
  const rateHistory = (id: string) => snapshot.data?.rates.find((item) => item.id === id)?.history.map((point) => point.value) ?? [];
  const latestRate = (id: string) => snapshot.data?.rates.find((item) => item.id === id)?.value ?? null;
  const shibor: number[] = [];
  const sofr = rateHistory('SOFR');
  const euribor = rateHistory('ECBMRRFR');
  const tibor = rateHistory('IR3TIB01JPM156N');
  const marketPhaseData: any[] = [];
  const liquidityStressData: any[] = [];
  const marketPhaseProbData: any[] = [];
  const keyMetrics = {
    shiborRate: null as number | null,
    sofrRate: latestRate('SOFR'),
    euriborRate: latestRate('ECBMRRFR'),
    tiborRate: latestRate('IR3TIB01JPM156N'),
    attractorStability: null as number | null,
    liquidityRisk: '—',
  };

  const dataPointCount = 60;

  // No timer is installed: polling without an upstream observation would be
  // indistinguishable from fabricated real-time data.

  // Determine signal status
  const isAttractorCollapseWarning = keyMetrics.attractorStability !== null && keyMetrics.attractorStability < 0.75 || keyMetrics.liquidityRisk === '高';

  const renderMarketHeartbeatChart = useCallback(() => {
    const data = Array.from({ length: dataPointCount }).map((_, i) => ({
      time: i,
      Shibor: shibor[i],
      SOFR: sofr[i],
      EURIBOR: euribor[i],
      TIBOR: tibor[i],
    }));

    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="time" tickFormatter={(tick) => `T-${dataPointCount - 1 - tick}`} stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
          <Legend />
          <Line type="monotone" dataKey="Shibor" stroke="#f59e0b" dot={false} animationDuration={500} />
          <Line type="monotone" dataKey="SOFR" stroke="#10b981" dot={false} animationDuration={500} />
          <Line type="monotone" dataKey="EURIBOR" stroke="#3b82f6" dot={false} animationDuration={500} />
          <Line type="monotone" dataKey="TIBOR" stroke="#ef4444" dot={false} animationDuration={500} />
        </LineChart>
      </ResponsiveContainer>
    );
  }, [shibor, sofr, euribor, tibor]);

  const renderPhaseSpaceAttractorChart = useCallback(() => {
    const marketPhaseColors: { [key: string]: string } = {
      '扩张': '#10b981',
      '收缩': '#ef4444',
      '平衡': '#3b82f6',
      '转换': '#f59e0b',
    };

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis type="number" dataKey="rateChangeSpeed" name="利率变化速度" stroke="#ccc" />
          <YAxis type="number" dataKey="rateLevel" name="利率水平" stroke="#ccc" />
          <ZAxis range={[60, 400]} name="市场阶段" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
          <Legend />
          {Object.keys(marketPhaseColors).map((phase) => (
            <Scatter
              key={phase}
              name={phase}
              data={marketPhaseData.filter(d => d.marketPhase === phase)}
              fill={marketPhaseColors[phase]}
              opacity={0.7}
            />
          ))}
          {/* Annotations for attractor basins */}
          <text x="10%" y="90%" fill="#ccc" textAnchor="start" dominantBaseline="hanging">吸引子盆1 (稳定)</text>
          <text x="80%" y="10%" fill="#ccc" textAnchor="end" dominantBaseline="hanging">吸引子盆2 (不稳定)</text>
        </ScatterChart>
      </ResponsiveContainer>
    );
  }, [marketPhaseData]);

  const renderLiquidityStressIndexChart = useCallback(() => {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={liquidityStressData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="time" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
          <Legend />
          <Area type="monotone" dataKey="tier3" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="高风险" />
          <Area type="monotone" dataKey="tier2" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="中风险" />
          <Area type="monotone" dataKey="tier1" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="低风险" />
          {/* Critical thresholds could be added as ReferenceLines if needed */}
        </AreaChart>
      </ResponsiveContainer>
    );
  }, [liquidityStressData]);

  const renderMarketPhaseIdentificationChart = useCallback(() => {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={marketPhaseProbData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="name" stroke="#ccc" />
          <YAxis stroke="#ccc" label={{ value: '概率 (%)', angle: -90, position: 'insideLeft', fill: '#ccc' }} />
          <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} itemStyle={{ color: '#fff' }} />
          <Legend />
          <Bar dataKey="probability" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    );
  }, [marketPhaseProbData]);

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
    <div ref={panelRef} className="relative w-full h-full bg-gray-950 text-gray-100 p-6 rounded-lg shadow-lg overflow-auto">
      {/* Close Button */}
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

      <h2 className="text-3xl font-bold mb-6 text-amber-400">市场心跳面板 (Market Heartbeat Panel)</h2>

      <p role="status" className="mb-4 rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">当前未配置 SHIBOR、SOFR、EURIBOR、TIBOR 及流动性状态的可核验实时观察。原有图表、标签和阈值说明保留，数据不足时保持空态，不生成心跳、相变概率或预警结论。</p>

      {/* 顶部统计卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-gray-900 p-4 rounded-lg shadow-md flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">Shibor 利率</p>
          <p className="text-2xl font-bold text-amber-300 animate-pulse">{keyMetrics.shiborRate?.toFixed(2) ?? '—'}%</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-md flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">SOFR 利率</p>
          <p className="text-2xl font-bold text-green-400 animate-pulse">{keyMetrics.sofrRate?.toFixed(2) ?? '—'}%</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-md flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">EURIBOR 利率</p>
          <p className="text-2xl font-bold text-blue-400 animate-pulse">{keyMetrics.euriborRate?.toFixed(2) ?? '—'}%</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-md flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">TIBOR 利率</p>
          <p className="text-2xl font-bold text-red-400 animate-pulse">{keyMetrics.tiborRate?.toFixed(2) ?? '—'}%</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-md flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">吸引子稳定性</p>
          <p className="text-2xl font-bold text-purple-400 animate-pulse">{keyMetrics.attractorStability?.toFixed(2) ?? '—'}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-md flex flex-col items-center justify-center">
          <p className="text-sm text-gray-400">流动性风险</p>
          <p className={`text-2xl font-bold ${keyMetrics.liquidityRisk === '高' ? 'text-red-500' : keyMetrics.liquidityRisk === '中' ? 'text-amber-500' : 'text-green-500'} animate-pulse`}>{keyMetrics.liquidityRisk}</p>
        </div>
      </div>

      {/* Tab切换 */}
      <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
        <Tab.List className="flex p-1 space-x-1 bg-gray-800 rounded-xl mb-6">
          {['市场心跳图', '相空间吸引子图', '流动性压力指数', '市场阶段识别', '实战信号'].map((category, index) => (
            <Tab
              key={category}
              className={({ selected }: { selected: boolean }) =>
                `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
                ${selected
                  ? 'bg-gray-700 text-amber-400 shadow'
                  : 'text-gray-300 hover:bg-white/[0.12] hover:text-white'}
                focus:outline-none focus:ring-2 ring-offset-2 ring-offset-gray-900 ring-white ring-opacity-60`
              }
            >
              {category}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-2">
          <Tab.Panel className="rounded-xl bg-gray-900 p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-900 focus:outline-none focus:ring-2">
            <h3 className="text-xl font-semibold mb-4 text-amber-300">市场心跳图：实时流动性节奏</h3>
            {renderMarketHeartbeatChart()}
            <p className="text-gray-400 mt-4 text-sm">
              此图实时展示Shibor、SOFR、EURIBOR、TIBOR等关键货币市场利率的动态变化，通过“心跳”动画效果直观反映市场流动性的脉动。异常的剧烈波动可能预示着流动性紧张或市场情绪变化。
            </p>
          </Tab.Panel>
          <Tab.Panel className="rounded-xl bg-gray-900 p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-900 focus:outline-none focus:ring-2">
            <h3 className="text-xl font-semibold mb-4 text-green-400">相空间吸引子图：预测吸引子崩溃</h3>
            {renderPhaseSpaceAttractorChart()}
            <p className="text-gray-400 mt-4 text-sm">
              通过“相空间吸引子分析”与“流动性相变模型”，本图将利率变化速度与利率水平映射到二维相空间。不同的颜色代表市场所处的阶段（扩张、收缩、平衡、转换）。
              当市场轨迹偏离或漠出当前吸引子盆时，预示着流动性相变或吸引子崩溃的风险，是重要的早期预警信号。
            </p>
          </Tab.Panel>
          <Tab.Panel className="rounded-xl bg-gray-900 p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-900 focus:outline-none focus:ring-2">
            <h3 className="text-xl font-semibold mb-4 text-blue-400">流动性压力指数：分层风险预警</h3>
            {renderLiquidityStressIndexChart()}
            <p className="text-gray-400 mt-4 text-sm">
              此面积图展示了货币市场流动性压力的分层情况（低、中、高风险层级）。通过实时监测各层级压力的变化，结合预设的临界点阈值，
              可以及时识别潜在的流动性危机，为风险管理提供量化依据。
            </p>
          </Tab.Panel>
          <Tab.Panel className="rounded-xl bg-gray-900 p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-900 focus:outline-none focus:ring-2">
            <h3 className="text-xl font-semibold mb-4 text-red-400">市场阶段识别：概率分布洞察</h3>
            {renderMarketPhaseIdentificationChart()}
            <p className="text-gray-400 mt-4 text-sm">
              本柱状图展示了当前市场处于扩张、收缩、平衡或转换阶段的概率分布。通过动态更新的概率值，
              投资者可以更清晰地了解市场结构性变化，辅助制定宏观策略。
            </p>
          </Tab.Panel>
          <Tab.Panel className="rounded-xl bg-gray-900 p-3 ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-900 focus:outline-none focus:ring-2">
            <h3 className="text-xl font-semibold mb-4 text-purple-400">实战信号：吸引子崩溃预警</h3>
            <div className={`p-4 rounded-lg ${isAttractorCollapseWarning ? 'bg-red-800 text-white' : 'bg-green-800 text-white'} mb-4`}>
              <p className="text-lg font-bold">信号状态: {keyMetrics.attractorStability === null ? '— 未配置实时输入' : isAttractorCollapseWarning ? '⚠️ 吸引子崩溃预警触发！' : '✅ 市场稳定'}</p>
              <p className="text-sm mt-2">
                触发条件：市场心跳图中出现异常跳动（如剧烈波动、趋势反转），或相空间轨迹漠出当前吸引子盆，
                以及流动性风险指标达到“高”级别时，系统将触发“吸引子崩溃”预警信号。
              </p>
              <p className="text-sm mt-2">
                胜率：<span className="line-through text-gray-500">80%</span> — 当前没有可核验回测样本，不显示胜率。
              </p>
              <p className="text-sm mt-2">
                实战标的：主要针对货币市场工具（如短期国债、回购协议、同业存单）进行风险规避或套利操作。
                同时，可结合流动性对冲策略（如利用利率期货、期权进行对冲）来管理潜在的市场波动风险。
              </p>
            </div>
            <p className="text-gray-400 mt-4 text-sm">
              当“吸引子崩溃”预警信号触发时，意味着市场流动性结构可能发生重大变化，
              投资者应立即审视持仓，考虑降低风险敞口或部署对冲策略。此信号旨在提供前瞻性的风险提示，
              帮助投资者在市场剧烈波动前做出反应。
            </p>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default MarketHeartbeatPanel;
