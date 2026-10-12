import { Download } from 'lucide-react';
import React, { useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
  BarChart, Bar, AreaChart, Area, ComposedChart
} from 'recharts';


interface RVPanelProps {
  onClose: () => void;
}

const RVPanel: React.FC<RVPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // State to manage the currently active tab in the UI.
  const [activeTab, setActiveTab] = useState<string>('利差矩阵热力图');
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // RV metrics require synchronized curve observations and an auditable calculation window.
  // Until that feed is configured, retain the original surface but never manufacture values.
  const stats = {
    currentSpreadDeviation: null as number | null,
    zScoreDeviation: null as number | null,
    arbitrageOpportunities: null as number | null,
    winRate: null as number | null,
    signalStatus: '未接入',
  };
  const spreadMatrixData: any[] = [];
  const zScoreData: any[] = [];
  const cointegrationData: any[] = [];
  const arbitrageTableData: any[] = [];

  /**
   * Custom Tooltip component for Recharts charts.
   * Displays detailed information when hovering over chart elements.
   * @param active Whether the tooltip is active.
   * @param payload Data for the tooltip.
   * @param label Label for the data point.
   * @returns JSX for the custom tooltip.
   */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 border border-gray-700 rounded-md shadow-lg text-white text-sm opacity-95">
          {label && <p className="font-bold mb-1 text-amber-300">{label}</p>}
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="flex justify-between items-center">
              <span className="mr-2">{entry.name}:</span>
              <span className="font-semibold">{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  /**
   * Custom Cell component for the ScatterChart chart.
   * Applies a color scale based on the cell's value to represent spread deviation.
   * @param props Props passed by Recharts ScatterChart component.
   * @returns A Cell component with dynamic fill color.
   */
  const CustomHeatmapCell = (props: any) => {
    const { x, y, width, height, value } = props;
    // Using d3-scale for a more professional and perceptually uniform color gradient.
    // interpolateRdYlGn creates a Red-Yellow-Green diverging color scheme.
    // Domain is set from -0.5 to 0.5 to represent spread deviations.
    const colorScale = (v: number) => { const t = Math.max(0, Math.min(1, (v + 0.5) / 1.0)); const r = Math.round(255 * (t < 0.5 ? 1 : 2 - 2*t)); const g = Math.round(255 * (t < 0.5 ? 2*t : 1)); return `rgb(${r},${g},0)`; };
    return (
      <Cell
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colorScale(value)} // Dynamic fill color based on value
        stroke="#333" // Border color for individual cells for better separation
        strokeWidth={0.5}
      />
    );
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
    <div ref={panelRef} className="flex flex-col h-full bg-gray-950 text-gray-100 p-4 rounded-lg shadow-xl font-sans antialiased">
      {/* Panel Header Section */}
      <div className="flex justify-between items-center mb-5 border-b border-gray-800 pb-4">
        <h2 className="text-3xl font-extrabold text-amber-400 tracking-wide">RV相对价值 (Multi-Dimensional Arbitrage Engine)</h2>
        <button
          onClick={() => handleExport('png')}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors mr-2"
          title="导出 PNG"
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出</span>
        </button>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl p-1 rounded-full hover:bg-gray-800 transition-colors duration-200 ease-in-out"
          aria-label="Close Panel"
        >
          &times;
        </button>
      </div>

      {/* Top Statistical Cards Section - Displays key real-time metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-900 p-5 rounded-xl shadow-md flex flex-col items-center justify-center border border-gray-800 transition-all duration-300 hover:border-amber-500">
          <p className="text-sm text-gray-400 mb-1">当前利差偏离</p>
          <p className={`text-3xl font-bold ${stats.currentSpreadDeviation != null && stats.currentSpreadDeviation > 0.2 ? 'text-red-500' : stats.currentSpreadDeviation != null && stats.currentSpreadDeviation < -0.2 ? 'text-green-500' : 'text-amber-400'}`}>
            {stats.currentSpreadDeviation == null ? '—' : `${stats.currentSpreadDeviation.toFixed(2)} bp`}
          </p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl shadow-md flex flex-col items-center justify-center border border-gray-800 transition-all duration-300 hover:border-blue-500">
          <p className="text-sm text-gray-400 mb-1">Z-Score偏离度</p>
          <p className={`text-3xl font-bold ${stats.zScoreDeviation != null && Math.abs(stats.zScoreDeviation) > 2 ? 'text-red-500' : 'text-amber-400'}`}>
            {stats.zScoreDeviation == null ? '—' : `${stats.zScoreDeviation.toFixed(2)} σ`}
          </p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl shadow-md flex flex-col items-center justify-center border border-gray-800 transition-all duration-300 hover:border-green-500">
          <p className="text-sm text-gray-400 mb-1">活跃套利机会</p>
          <p className="text-3xl font-bold text-blue-400">{stats.arbitrageOpportunities == null ? '—' : `${stats.arbitrageOpportunities} 个`}</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl shadow-md flex flex-col items-center justify-center border border-gray-800 transition-all duration-300 hover:border-purple-500">
          <p className="text-sm text-gray-400 mb-1">历史胜率</p>
          <p className="text-3xl font-bold text-green-400">{stats.winRate == null ? '—' : `${stats.winRate}%`}</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-xl shadow-md flex flex-col items-center justify-center border border-gray-800 transition-all duration-300 hover:border-red-500">
          <p className="text-sm text-gray-400 mb-1">信号状态</p>
          <p className={`text-3xl font-bold ${stats.signalStatus !== '无信号' && stats.signalStatus !== '未接入' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
            {stats.signalStatus}
          </p>
        </div>
      </div>

      {/* Tabs Navigation for different visualizations and analyses */}
      <div className="flex border-b border-gray-700 mb-4 overflow-x-auto scrollbar-hide">
        {['利差矩阵热力图', 'Z-Score偏离度', '协整分析', '套利机会扫描', '实战信号'].map(tab => (
          <button
            key={tab}
            className={`py-3 px-6 text-base font-medium whitespace-nowrap transition-colors duration-200 ease-in-out
              ${activeTab === tab ? 'border-b-2 border-amber-500 text-amber-400' : 'text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}
            onClick={() => setActiveTab(tab)}
            aria-controls={`panel-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area - Renders content based on the active tab */}
      <div className="flex-grow bg-gray-900 p-6 rounded-lg shadow-inner overflow-auto border border-gray-800">
        <div role="status" className="mb-4 border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300">
          国债、金融债、企业债、同业存单与利率互换的同步曲线观察尚未接入；不使用随机利差、固定胜率或模拟套利信号代替实时数据。
        </div>
        {/* Tab 1: 利差矩阵热力图 (Spread Matrix ScatterChart) */}
        {activeTab === '利差矩阵热力图' && (
          <div id="panel-利差矩阵热力图" role="tabpanel" className="animate-fade-in space-y-4">
            <h3 className="text-xl font-bold text-amber-300">利差矩阵热力图 (各期限各资产类别)</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              此热力图直观展示了不同期限和资产类别之间的利差偏离。颜色越<span className="text-green-500">绿</span>表示利差越低（可能被低估），颜色越<span className="text-red-500">红</span>表示利差越高（可能被高估），<span className="text-amber-400">黄色</span>则代表中性区域。通过实时更新，帮助交易员快速识别市场中的相对价值洼地或高地，为套利策略提供视觉依据。
            </p>
            <ResponsiveContainer width="100%" height={450}>
              <ComposedChart
                data={spreadMatrixData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="term"
                  type="category"
                  scale="band"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#999"
                  tick={{ fill: '#999', fontSize: 12 }}
                  interval={0} // Show all ticks
                  label={{ value: '期限', position: 'insideBottomRight', offset: 0, fill: '#999' }}
                />
                <YAxis
                  dataKey="asset"
                  type="category"
                  scale="band"
                  width={120}
                  stroke="#999"
                  tick={{ fill: '#999', fontSize: 12 }}
                  interval={0} // Show all ticks
                  label={{ value: '资产类别', position: 'insideTopLeft', angle: -90, offset: 0, fill: '#999' }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                <ZAxis range={[0, 1]} /> {/* Dummy ZAxis for ScatterChart component requirement in Recharts */}
                <ScatterChart width={400} height={200}>
                  <XAxis dataKey="x" type="number" name="X" />
                  <YAxis dataKey="y" type="number" name="Y" />
                  <ZAxis dataKey="value" range={[20, 200]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={spreadMatrixData} fill="#82ca9d" />
                </ScatterChart>
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-3 italic">颜色梯度：绿色 (低利差/被低估) &lt;-&gt; 黄色 (中性) &lt;-&gt; 红色 (高利差/被高估)。当前等待同期、同口径的可核验观察。</p>
          </div>
        )}

        {/* Tab 2: Z-Score偏离度 (Z-Score Deviation Time Series) */}
        {activeTab === 'Z-Score偏离度' && (
          <div id="panel-Z-Score偏离度" role="tabpanel" className="animate-fade-in space-y-4">
            <h3 className="text-xl font-bold text-amber-300">Z-Score偏离度时序图</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Z-Score偏离度衡量了当前利差与历史均值的标准差倍数。当Z-Score绝对值超过<span className="text-red-500 font-bold">2</span>时，通常被认为是极端偏离，预示着潜在的均值回归套利机会。此图展示了多个资产的Z-Score随时间的变化，并标注了<span className="text-red-400">±2σ</span>的阈值线，帮助交易员识别超买或超卖的市场状况。
            </p>
            <ResponsiveContainer width="100%" height={450}>
              <LineChart
                data={zScoreData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString()} // Format timestamp to local time
                  stroke="#999"
                  tick={{ fill: '#999', fontSize: 12 }}
                  label={{ value: '时间', position: 'insideBottomRight', offset: 0, fill: '#999' }}
                />
                <YAxis domain={[-4, 4]} stroke="#999" tick={{ fill: '#999', fontSize: 12 }} label={{ value: 'Z-Score', angle: -90, position: 'insideLeft', fill: '#999' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="国债Z" stroke="#8884d8" strokeWidth={2} dot={false} name="国债Z-Score" />
                <Line type="monotone" dataKey="金融债Z" stroke="#82ca9d" strokeWidth={2} dot={false} name="金融债Z-Score" />
                <Line type="monotone" dataKey="利率互换Z" stroke="#ffc658" strokeWidth={2} dot={false} name="利率互换Z-Score" />
                <Line dataKey="+2σ" stroke="#ef4444" strokeDasharray="5 5" dot={false} isAnimationActive={false} name="+2σ阈值" />
                <Line dataKey="-2σ" stroke="#ef4444" strokeDasharray="5 5" dot={false} isAnimationActive={false} name="-2σ阈值" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-3 italic">Z-Score只会在历史窗口、曲线口径和更新时间可核验时计算；当前不生成假曲线。</p>
          </div>
        )}

        {/* Tab 3: 协整分析 (Cointegration Analysis) */}
        {activeTab === '协整分析' && (
          <div id="panel-协整分析" role="tabpanel" className="animate-fade-in space-y-4">
            <h3 className="text-xl font-bold text-amber-300">协整分析散点图</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              协整分析用于识别两个或多个资产之间是否存在长期稳定的均衡关系。散点图展示了资产A和资产B利率的历史走势，如果它们围绕一条回归线波动，则表明存在协整关系。偏离回归线越远，潜在的套利机会越大。此图帮助交易员可视化资产间的结构性关系，捕捉因短期偏离长期均衡而产生的套利机会。
            </p>
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 20,
                  left: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis type="number" dataKey="assetA" name="资产A利率" unit="%" stroke="#999" tick={{ fill: '#999', fontSize: 12 }} label={{ value: '资产A利率 (%)', position: 'insideBottom', offset: -10, fill: '#999' }} />
                <YAxis type="number" dataKey="assetB" name="资产B利率" unit="%" stroke="#999" tick={{ fill: '#999', fontSize: 12 }} label={{ value: '资产B利率 (%)', angle: -90, position: 'insideLeft', fill: '#999' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Scatter name="协整关系数据点" data={cointegrationData} fill="#8884d8" opacity={0.6} />
                {/* Simple Regression Line Simulation - represents the long-term equilibrium relationship */}
                <Scatter
                  name="模拟回归线"
                  data={[]}
                  fill="#ff7300"
                  opacity={0.8}
                  line={{ stroke: '#ff7300', strokeWidth: 2 }}
                  lineType="fitting"
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-500 mt-3 italic">回归线仅在有足够同步观察、通过平稳性与残差检验后显示；当前等待可核验样本。</p>
          </div>
        )}

        {/* Tab 4: 套利机会扫描 (Arbitrage Opportunity Scan) */}
        {activeTab === '套利机会扫描' && (
          <div id="panel-套利机会扫描" role="tabpanel" className="animate-fade-in space-y-4">
            <h3 className="text-xl font-bold text-amber-300">当前套利机会扫描 (利差偏离 &gt; 2σ)</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              此表格实时列出了所有利差偏离超过<span className="text-red-500 font-bold">2个标准差</span>的潜在套利机会。这些机会是根据多维时空套利引擎的实时计算结果识别的，提供了预期收益和历史胜率，帮助交易员快速捕捉市场异常，并进行决策。表格内容会随市场波动实时更新。
            </p>
            <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">套利机会</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">利差偏离 (bp)</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">预期收益</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">胜率</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">信号时间</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                  {arbitrageTableData.length > 0 ? (
                    arbitrageTableData.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-850 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-300">{row.opportunity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">{row.spreadDeviation}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-500">{row.expectedReturn}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{row.winRate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{row.signalTime}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">暂无利差偏离超过2σ的套利机会。市场处于相对均衡状态，或等待新的信号触发。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">实时更新的套利机会列表，根据预设的风险阈值（2σ）进行筛选。请结合自身风险偏好进行决策。</p>
          </div>
        )}

        {/* Tab 5: 实战信号 (Practical Signals) */}
        {activeTab === '实战信号' && (
          <div id="panel-实战信号" role="tabpanel" className="space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold text-amber-300">实战信号解读与策略</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              本部分详细阐述了由多维时空套利引擎识别出的两种核心实战信号：<span className="text-red-500 font-bold">协整平衡布局破位</span>和<span className="text-amber-400 font-bold">三维共振</span>。每个信号都附带了详细的触发条件、高胜率以及推荐的实战标的，旨在为交易决策提供清晰、可操作的指引，帮助交易员在复杂市场中把握机会。
            </p>

            {/* Signal 1: Cointegration Equilibrium Breakout */}
            <div className="bg-gray-800 p-5 rounded-lg border border-red-600 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-red-500">
              <p className="text-red-500 font-bold text-xl mb-3">信号名称：协整平衡布局破位</p>
              <p className="text-gray-300 mb-2 leading-relaxed">
                <span className="font-semibold text-gray-200">触发条件：</span>当两个或多个具有长期协整关系的资产（例如，不同期限的国债、不同信用等级的债券或相关联的利率产品）之间的利差偏离其历史均衡水平，且偏离度超过<span className="text-red-400 font-bold">2个标准差</span>时，系统将触发此信号。这表明市场中存在短期失衡，资产价格有望回归其长期均衡，从而产生套利机会。
              </p>
              <p className="text-gray-300 mb-2">
                <span className="font-semibold text-gray-200">历史胜率：</span><span className="text-gray-400 font-bold text-lg">—</span>。当前未接入可复核的历史回测样本，不生成胜率。
              </p>
              <p className="text-gray-300 mb-2">
                <span className="font-semibold text-gray-200">实战标的：</span>
              </p>
              <ul className="list-disc list-inside text-gray-400 ml-6 space-y-1">
                <li><span className="text-blue-400 font-medium">利率互换(IRS)</span>：当IRS定价与基础利率（如Shibor）的利差出现异常偏离时，通过买入被低估的IRS合约并卖出被高估的IRS合约进行套利。</li>
                <li><span className="text-blue-400 font-medium">跨期限利差交易</span>：例如，当短期国债与长期国债的利差异常扩大或收窄时，可采取买入短期国债同时卖出长期国债（或反向操作）的策略，等待利差回归正常水平。</li>
                <li><span className="text-blue-400 font-medium">跨资产套利</span>：利用国债与金融债、同业存单等不同资产类别之间的协整关系，当两者利差异常扩大或缩小时进行反向操作，实现风险对冲下的收益。</li>
              </ul>
              <p className="text-sm text-gray-500 mt-4 italic">解读：协整平衡破位信号捕捉市场短期无效性，通过量化分析识别均值回归机会，是相对价值策略的核心组成部分，要求交易员对资产间的长期关系有深刻理解。</p>
            </div>

            {/* Signal 2: Three-Dimensional Resonance */}
            <div className="bg-gray-800 p-5 rounded-lg border border-amber-600 shadow-lg transition-all duration-300 hover:shadow-xl hover:border-amber-500">
              <p className="text-amber-400 font-bold text-xl mb-3">信号名称：三维共振</p>
              <p className="text-gray-300 mb-2 leading-relaxed">
                <span className="font-semibold text-gray-200">触发条件：</span>当利差偏离、Z-Score偏离度以及协整关系等多个维度指标同时达到极端水平，形成强大的多维度共振效应时，系统将触发此高级信号。这通常意味着市场失衡程度更深、范围更广，回归动力更强，伴随着更高的预期收益和胜率。此信号是多维度分析的综合结果，具有更高的可靠性。
              </p>
              <p className="text-gray-300 mb-2">
                <span className="font-semibold text-gray-200">历史胜率：</span><span className="text-gray-400 font-bold text-lg">—</span>。当前未接入可复核的历史回测样本，不生成胜率。
              </p>
              <p className="text-gray-300 mb-2">
                <span className="font-semibold text-gray-200">实战标的：</span>
              </p>
              <ul className="list-disc list-inside text-gray-400 ml-6 space-y-1">
                <li><span className="text-blue-400 font-medium">利率互换(IRS)</span>：在三维共振信号下，IRS的定价可能出现显著偏离，提供更强的套利空间，可考虑加大头寸或采取更积极的交易策略。</li>
                <li><span className="text-blue-400 font-medium">跨期限利差交易</span>：共振信号增强了期限利差回归的确定性，适合进行更大规模、更激进的交易策略，例如构建蝶式或骑乘策略。</li>
                <li><span className="text-blue-400 font-medium">跨资产套利</span>：在多重指标确认下，不同资产间的套利机会更加稳健，可构建更复杂的套利组合，例如利用股债利差、商品与利率联动等。</li>
              </ul>
              <p className="text-sm text-gray-500 mt-4 italic">解读：三维共振是稀有但高价值的信号，代表了市场深层次的结构性失衡，是捕捉超额收益的绝佳时机。交易员应密切关注此类信号，并结合自身风险管理框架进行操作。</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Signal Overview Section - Summary of current signals and risk tips */}
      <div className="mt-6 p-5 bg-gray-900 rounded-lg shadow-md border border-gray-800">
        <h3 className="text-xl font-bold mb-3 text-red-500">实战信号概览与风险提示</h3>
        <p className="text-gray-300 mb-2 leading-relaxed">
          <span className="font-semibold text-gray-200">当前信号状态：</span><span className={`font-bold text-lg ${stats.signalStatus !== '无信号' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>{stats.signalStatus}</span>
        </p>
        <p className="text-gray-300 mb-2 leading-relaxed">
          <span className="font-semibold text-gray-200">触发条件：</span>利差偏离超过2个标准差或协整平衡破位，或出现三维共振信号。这些条件是系统基于历史数据和量化模型设定的，旨在识别市场中的异常波动和潜在套利机会。
        </p>
        <p className="text-gray-300 mb-2 leading-relaxed">
          <span className="font-semibold text-gray-200">历史胜率：</span><span className="text-gray-400 font-bold text-lg">—</span>。当前未接入可复核的历史回测样本；所有投资均存在风险，量化模型和信号识别仅作为投资参考。
        </p>
        <p className="text-gray-300 leading-relaxed">
          <span className="font-semibold text-gray-200">实战标的：</span>主要包括利率互换(IRS)、跨期限利差交易、跨资产套利。具体交易策略需结合市场情况、流动性以及个人或机构的风险偏好进行灵活调整。
        </p>
        <p className="text-xs text-gray-500 mt-4 italic">风险提示：金融市场复杂多变，任何量化策略都存在局限性。请投资者在采纳信号前，务必进行充分的市场分析和风险评估，并严格控制仓位，做好止损止盈管理。本工具提供的所有信息仅供参考，不构成任何投资建议。</p>
      </div>
    </div>
  );
};

export default RVPanel;
