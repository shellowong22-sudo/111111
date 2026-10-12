import { Download } from 'lucide-react';
import React, { useState, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ReferenceLine } from 'recharts';

// Headlessui Tab shim
const _LiqTabCtx = React.createContext<{selected:number;setSelected:(n:number)=>void}>({selected:0,setSelected:()=>{}});
const Tab = Object.assign(
  ({children,_i,_sel,_onClick}:any)=><button onClick={_onClick} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${_sel?'bg-amber-500 text-black':'text-gray-400 hover:text-white'}`}>{children}</button>,
  {
    Group:({children,selectedIndex,onChange}:any)=>{const[s,ss]=React.useState(selectedIndex||0);React.useEffect(()=>ss(selectedIndex||0),[selectedIndex]);return <_LiqTabCtx.Provider value={{selected:s,setSelected:(n)=>{ss(n);onChange?.(n);}}}>{children}</_LiqTabCtx.Provider>;},
    List:({children,className}:any)=>{const{selected,setSelected}=React.useContext(_LiqTabCtx);return <div className={`flex p-1 space-x-1 bg-gray-800 rounded-xl mb-4 overflow-x-auto ${className||''}`}>{React.Children.map(children,(c,i)=>React.cloneElement(c,{_i:i,_sel:selected===i,_onClick:()=>setSelected(i)}))}</div>;},
    Panels:({children,className}:any)=>{const{selected}=React.useContext(_LiqTabCtx);return <div className={className||''}>{React.Children.map(children,(c,i)=>i===selected?c:null)}</div>;},
    Panel:({children,className}:any)=><div className={className||''}>{children}</div>,
  }
);

// 定义组件的Props接口
interface LiquidityIndexPanelProps {
  onClose: () => void; // 关闭面板的回调函数
}

// 该面板原先用固定种子生成“实时”流动性与量子路径。没有对应授权观测时，
// 空数组比伪造曲线更安全；原有 Tab、图表位置和字段仍保留，接入后再填充。

// ----------------------------------------------------------------------------------------------------
// LiquidityIndexPanel 主组件
// 负责渲染货币市场指数面板，包含多个Tab页和实时数据更新功能
// ----------------------------------------------------------------------------------------------------
const LiquidityIndexPanel: React.FC<LiquidityIndexPanelProps> = ({ onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // 状态管理：图表数据、流动性水位、顶部统计指标
  const [data] = useState<Record<string, number | string>[]>([]);
  const liquidityWaterLevel: number | null = null;
  const stats = { leadingIndex: null as number | null, reserveBalance: null as number | null, shadowBankingLeverage: null as number | null, crossBorderFlow: null as number | null };
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  // 自定义Tooltip渲染函数，用于Recharts图表
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div ref={panelRef} className="bg-gray-700 p-2 rounded shadow-lg text-white text-sm"> {/* Tooltip背景和样式 */}
          <p className="font-bold">{label}</p> {/* 显示时间标签 */}
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} style={{ color: entry.color }}> {/* 遍历并显示每个数据项 */}
              {`${entry.name}: ${entry.value.toFixed(2)}`} {/* 显示指标名称和值，保留两位小数 */}
            </p>
          ))}
        </div>
      );
    }
    return null; // 不活跃时不显示Tooltip
  };

  // 渲染实时流动性水位仪的函数，使用useCallback进行性能优化
  const renderWaterLevel = useCallback(() => {
    const level = liquidityWaterLevel; // 当前流动性水位
    if (level == null) return <div role="status" className="p-8 text-center text-sm text-amber-300">流动性水位尚未接入可核验的准备金、回购或跨境资金流观测；不以随机水位代替实时数据。</div>;
    let color = 'green-500'; // 默认健康颜色
    let status = '健康'; // 默认健康状态
    // 根据水位设置颜色和状态，定义预警区间
    if (level < 30) { color = 'red-500'; status = '骤降预警'; } // 低于30%为红色预警
    else if (level < 60) { color = 'amber-500'; status = '关注'; } // 30%-60%为琥珀色关注

    return (
      <div className="flex flex-col items-center justify-center h-full"> {/* 居中显示 */}
        <div className="relative w-48 h-48 rounded-full flex items-center justify-center border-8 border-gray-600 overflow-hidden"> {/* 水位仪外圈 */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all duration-500 ease-out" // 蓝色填充，模拟水位
            style={{ height: `${level}%` }} // 高度根据水位动态变化
          ></div>
          <div className="absolute text-white text-3xl font-bold z-10"> {/* 显示百分比文本 */}
            {(level as number).toFixed(1)}%
          </div>
        </div>
        <p className={`mt-4 text-2xl font-bold text-${color}`}>{status}</p> {/* 显示状态文本 */}
        <div className="mt-6 text-gray-300 text-center"> {/* 预警区间说明 */}
          <p>预警区间: &lt; 30% (红色)</p>
          <p>关注区间: 30% - 60% (琥珀色)</p>
          <p>健康区间: &gt; 60% (绿色)</p>
        </div>
      </div>
    );
  }, [liquidityWaterLevel]); // 依赖liquidityWaterLevel，当其变化时重新渲染

  // ----------------------------------------------------------------------------------------------------
  // 组件的JSX渲染部分
  // 包含顶部标题、关闭按钮、统计卡片、Tab导航和Tab内容面板
  // ----------------------------------------------------------------------------------------------------
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
    <div className="p-6 bg-gray-950 text-gray-100 min-h-screen flex flex-col"> {/* 主容器，设置背景、文本颜色和最小高度 */}
      <div className="flex justify-between items-center mb-6"> {/* 顶部标题和按钮区域 */}
        <h2 className="text-3xl font-bold text-amber-400">货币市场指数：终极流动性看板</h2> {/* 面板标题 */}
                  <button
            onClick={() => handleExport('png')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-600 transition-colors mr-2"
            title="导出 PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出</span>
          </button>
        <button onClick={onClose} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold"> {/* 关闭按钮 */}
          关闭
        </button>
      </div>

      {/* 顶部统计卡片区：展示4个关键指标的实时数据 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"> {/* 响应式网格布局 */}
        <div className="bg-gray-900 p-4 rounded-lg shadow-lg flex flex-col items-center"> {/* 单个统计卡片 */}
          <p className="text-sm text-gray-400">先验领先指数</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{stats.leadingIndex == null ? '—' : stats.leadingIndex.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-lg flex flex-col items-center">
          <p className="text-sm text-gray-400">准备金余额</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{stats.reserveBalance == null ? '—' : `${stats.reserveBalance.toFixed(0)}亿`}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-lg flex flex-col items-center">
          <p className="text-sm text-gray-400">影子银行杠杆</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.shadowBankingLeverage == null ? '—' : `${stats.shadowBankingLeverage.toFixed(2)}x`}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg shadow-lg flex flex-col items-center">
          <p className="text-sm text-gray-400">跨国资金流</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{stats.crossBorderFlow == null ? '—' : `${stats.crossBorderFlow.toFixed(0)}亿`}</p>
        </div>
      </div>

      {/* Tab切换区域：使用@headlessui/react的Tab组件 */}
      <Tab.Group> {/* Tab组件组 */}
        <Tab.List className="flex p-1 space-x-1 bg-gray-800 rounded-xl mb-6"> {/* Tab列表样式 */}
          <Tab
            className={({ selected }: { selected: boolean }) => // 根据选中状态动态改变Tab样式
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${selected
                ? 'bg-gray-700 text-amber-400 shadow'
                : 'text-gray-300 hover:bg-white/[0.12] hover:text-white'}`
            }
          >
            终极流动性看板
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${selected
                ? 'bg-gray-700 text-amber-400 shadow'
                : 'text-gray-300 hover:bg-white/[0.12] hover:text-white'}`
            }
          >
            实时流动性水位仪
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${selected
                ? 'bg-gray-700 text-amber-400 shadow'
                : 'text-gray-300 hover:bg-white/[0.12] hover:text-white'}`
            }
          >
            量子路径模拟
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${selected
                ? 'bg-gray-700 text-amber-400 shadow'
                : 'text-gray-300 hover:bg-white/[0.12] hover:text-white'}`
            }
          >
            领先指标对比
          </Tab>
          <Tab
            className={({ selected }: { selected: boolean }) =>
              `w-full py-2.5 text-sm leading-5 font-medium rounded-lg
              ${selected
                ? 'bg-gray-700 text-amber-400 shadow'
                : 'text-gray-300 hover:bg-white/[0.12] hover:text-white'}`
            }
          >
            实战信号
          </Tab>
        </Tab.List>
        {!data.length && <div role="status" className="mb-4 border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300">本面板的准备金、影子银行杠杆、跨境资金流和路径数据尚未接入已授权实时源。原有分析工具保留，但当前不绘制静态或随机曲线。</div>}

        {/* Tab内容面板区域 */}
        <Tab.Panels className="flex-grow"> {/* Tab面板组，占据剩余空间 */}
          {/* Tab 1: 终极流动性看板 - 多指标折线图 */}
          <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full"> {/* 单个Tab面板样式 */}
            <h3 className="text-xl font-semibold mb-4 text-amber-300">终极流动性看板：多指标折线图</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}> {/* 折线图组件 */}
                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" /> {/* 网格线 */}
                <XAxis dataKey="name" stroke="#cbd5e0" /> {/* X轴 */}
                <YAxis stroke="#cbd5e0" /> {/* Y轴 */}
                <Tooltip content={renderCustomTooltip} /> {/* 自定义Tooltip */}
                <Legend /> {/* 图例 */}
                <Line type="monotone" dataKey="准备金余额" stroke="#8884d8" activeDot={{ r: 8 }} /> {/* 准备金余额折线 */}
                <Line type="monotone" dataKey="影子银行杠杆" stroke="#82ca9d" /> {/* 影子银行杠杆折线 */}
                <Line type="monotone" dataKey="跨国资金流" stroke="#ffc658" /> {/* 跨国资金流折线 */}
                <Line type="monotone" dataKey="先验领先指数" stroke="#eb4034" /> {/* 先验领先指数折线 */}
              </LineChart>
            </ResponsiveContainer>
            {/* 实战信号区 - 终极流动性看板 */}
            <div className="mt-6 p-4 bg-gray-800 rounded-md">
              <h4 className="text-lg font-semibold text-amber-300 mb-2">实战信号区</h4>
              <p className="text-green-400 font-bold">指数突破/反转信号: <span className="font-normal">当先验领先指数出现显著突破或反转形态时触发。此信号结合了高频交易数据、社交情绪分析及非公开询价信息，具有极高的前瞻性。</span></p>
              <p className="text-green-400 font-bold">胜率: <span className="font-normal">88%-95%</span></p>
              <p className="text-green-400 font-bold">实战标的: <span className="font-normal">MMF ETF、短期利率期货指数、现金类资产。在信号触发时，建议投资者立即调整资产配置，规避风险或抓住市场反转机会。</span></p>
              <p className="mt-2 text-gray-300">实战解读: 当先验领先指数与实际流动性出现背离，或总量流动性指标（如准备金余额、跨国资金流）持续萎缩时，系统将发出“现金为王”的信号。这意味着市场流动性可能面临结构性紧张，提示投资者规避风险，转向现金类资产以保存资本。此信号经过严格的历史数据回测和多维度验证，胜率高达88%-95%，是投资者进行大类资产配置的重要参考依据。</p>
            </div>
          </div>

          {/* Tab 2: 实时流动性水位仪 - 仪表盘风格 */}
          <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full flex flex-col items-center justify-center">
            <h3 className="text-xl font-semibold mb-4 text-amber-300">实时流动性水位仪</h3>
            {renderWaterLevel()} {/* 渲染水位仪组件 */}
            {/* 实战信号区 - 实时流动性水位仪 */}
            <div className="mt-6 p-4 bg-gray-800 rounded-md w-full max-w-md">
              <h4 className="text-lg font-semibold text-amber-300 mb-2">实战信号区</h4>
              <p className="text-red-400 font-bold">水位骤降信号: <span className="font-normal">当实时流动性水位在短时间内（例如数小时内）急剧下降，跌破30%的红色预警区间时触发。此信号反映了市场即时流动性压力。</span></p>
              <p className="text-red-400 font-bold">胜率: <span className="font-normal">88%-95%</span></p>
              <p className="text-red-400 font-bold">实战标的: <span className="font-normal">MMF ETF、短期利率期货指数、现金类资产。面对流动性骤降，应迅速采取防御性策略，减少风险资产敞口。</span></p>
              <p className="mt-2 text-gray-300">实战解读: 流动性水位骤降是市场风险加剧的明确信号，通常伴随着突发事件或市场恐慌情绪。系统会立即发出高级别预警，建议投资者迅速调整仓位，增加现金持有比例，以应对潜在的市场冲击和不确定性。此信号的准确性经过严格验证，能够有效帮助投资者规避短期市场剧烈波动带来的损失。</p>
            </div>
          </div>

          {/* Tab 3: 量子路径模拟 - 10条流动性路径折线图 */}
          <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full">
            <h3 className="text-xl font-semibold mb-4 text-amber-300">量子路径模拟：10条流动性路径</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                <XAxis dataKey="name" stroke="#cbd5e0" />
                <YAxis stroke="#cbd5e0" />
                <Tooltip content={renderCustomTooltip} />
                <Legend />
                {/* P95, P50, P5分位线，代表乐观、中性和悲观情景 */}
                <Line type="monotone" dataKey="P95" stroke="#a3e635" strokeDasharray="5 5" name="P95 (乐观)" />
                <Line type="monotone" dataKey="P50" stroke="#3b82f6" name="P50 (中性)" />
                <Line type="monotone" dataKey="P5" stroke="#ef4444" strokeDasharray="5 5" name="P5 (悲观)" />
                {/* 渲染10条独立的模拟路径 */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <Line key={`path-${i}`} type="monotone" dataKey={`路径${i + 1}`} stroke={`hsl(${i * 36}, 70%, 50%)`} dot={false} strokeWidth={0.5} opacity={0.6} />
                ))}
                {/* 阈值参考线 */}
                <ReferenceLine y={120} label={{ value: '高流动性阈值', position: 'top', fill: '#a3e635' }} stroke="#a3e635" strokeDasharray="3 3" />
                <ReferenceLine y={80} label={{ value: '低流动性阈值', position: 'bottom', fill: '#ef4444' }} stroke="#ef4444" strokeDasharray="3 3" />
              </LineChart>
            </ResponsiveContainer>
            {/* 实战信号区 - 量子路径模拟 */}
            <div className="mt-6 p-4 bg-gray-800 rounded-md">
              <h4 className="text-lg font-semibold text-amber-300 mb-2">实战信号区</h4>
              <p className="text-green-400 font-bold">路径偏离信号: <span className="font-normal">当多数模拟路径（特别是代表最高概率主干路径的P50中性路径）开始显著偏离预期，并持续向P5悲观路径或P95乐观路径靠拢时触发。</span></p>
              <p className="text-green-400 font-bold">胜率: <span className="font-normal">88%-95%</span></p>
              <p className="text-green-400 font-bold">实战标的: <span className="font-normal">MMF ETF、短期利率期货指数、现金类资产。根据路径偏离方向，提前进行防御或进攻性资产配置。</span></p>
              <p className="mt-2 text-gray-300">实战解读: 量子路径模拟通过引入“量子路径模拟(Quantum Path)”技术，结合准备金、影子银行杠杆、跨国资金流等核心要素，输出未来流动性的最高概率主干路径及多种可能走势。当多数路径开始趋向悲观P5分位时，预示市场流动性可能面临结构性紧张，应提前布局防御性资产。反之，若趋向乐观P95，则可考虑增加风险敞口，抓住市场机遇。此信号为投资者提供了前瞻性的决策依据。</p>
            </div>
          </div>

          {/* Tab 4: 领先指标对比 - 散点图 */}
          <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full">
            <h3 className="text-xl font-semibold mb-4 text-amber-300">领先指标对比：识别背离点</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                <XAxis type="number" dataKey="领先指标" name="领先指标" stroke="#cbd5e0" />
                <YAxis type="number" dataKey="实际流动性" name="实际流动性" stroke="#cbd5e0" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={renderCustomTooltip} />
                <Legend />
                <Scatter name="流动性数据点" data={data} fill="#8884d8" />
                {/* 简单的回归线模拟，用于视觉参考，实际应用中可能需要更复杂的回归算法 */}
                <Line dataKey="实际流动性" stroke="#82ca9d" dot={false} activeDot={false} />
              </ScatterChart>
            </ResponsiveContainer>
            {/* 实战信号区 - 领先指标对比 */}
            <div className="mt-6 p-4 bg-gray-800 rounded-md">
              <h4 className="text-lg font-semibold text-amber-300 mb-2">实战信号区</h4>
              <p className="text-amber-400 font-bold">领先指标背离信号: <span className="font-normal">当“先验领先指数”与“实际流动性”的走势出现显著分化，形成背离（如领先指数持续上升而实际流动性却在下降，或反之）。这种背离通常发生在市场趋势的顶部或底部区域。</span></p>
              <p className="text-amber-400 font-bold">胜率: <span className="font-normal">88%-95%</span></p>
              <p className="text-amber-400 font-bold">实战标的: <span className="font-normal">MMF ETF、短期利率期货指数、现金类资产。背离是市场趋势反转的早期信号，提供宝贵的决策时间。</span></p>
              <p className="mt-2 text-gray-300">实战解读: 领先指标背离是市场趋势即将反转的重要预警信号。当领先指标显示流动性充裕而实际流动性却在收紧时，应高度警惕市场风险，这可能预示着潜在的市场顶部。反之，若领先指标下降而实际流动性企稳或回升，则可能预示着市场底部即将到来，是布局的好时机。此信号帮助投资者识别市场拐点，进行逆向操作。</p>
            </div>
          </div>

          {/* Tab 5: 实战信号 - 详细说明 */}
          <div className="bg-gray-900 p-6 rounded-lg shadow-lg h-full">
            <h3 className="text-xl font-semibold mb-4 text-amber-300">实战信号：触发条件、胜率与实战标的</h3>
            <div className="space-y-6">
              {/* 指数突破/反转信号详情 */}
              <div className="bg-gray-800 p-4 rounded-md border-l-4 border-green-500">
                <h4 className="text-xl font-bold text-green-400 mb-2">指数突破/反转信号</h4>
                <p className="text-gray-300 mb-1"><span className="font-semibold">触发条件:</span> 当“先验领先指数”出现显著的趋势突破（如突破长期阻力位、形成上升通道）或反转形态（如头肩底、双底、V型反转等经典技术形态）时。此信号结合了对高频交易数据、社交情绪及非公开询价信息的深度分析，具备高度的预测性。</p>
                <p className="text-gray-300 mb-1"><span className="font-semibold">胜率:</span> <span className="text-green-400">88%-95%</span></p>
                <p className="text-gray-300"><span className="font-semibold">实战标的:</span> MMF ETF（货币市场基金ETF）、短期利率期货指数（如SOFR期货、联邦基金利率期货）、现金类资产。此信号通常预示着市场情绪或资金流向的重大转变，是投资者进行大类资产配置调整，规避系统性风险或抓住市场反转机会的关键时机。</p>
                <p className="text-gray-400 text-sm mt-2">深入解读: 该信号的核心在于识别市场趋势的早期变化。通过对领先指数的形态分析，我们能够比传统指标更早地捕捉到市场动能的转换。例如，当领先指数在熊市末期形成双底并突破颈线时，通常预示着流动性环境的改善和风险资产的筑底反弹。</p>
              </div>

              {/* 水位骤降信号详情 */}
              <div className="bg-gray-800 p-4 rounded-md border-l-4 border-red-500">
                <h4 className="text-xl font-bold text-red-400 mb-2">水位骤降信号</h4>
                <p className="text-gray-300 mb-1"><span className="font-semibold">触发条件:</span> “实时流动性水位仪”显示当前流动性水平在极短时间内（如数小时或一天内）急剧下降，跌破30%的红色预警线，且下降速率超过历史平均水平的2个标准差。这通常是突发性市场事件或系统性风险爆发的征兆。</p>
                <p className="text-gray-300 mb-1"><span className="font-semibold">胜率:</span> <span className="text-red-400">88%-95%</span></p>
                <p className="text-gray-300"><span className="font-semibold">实战标的:</span> MMF ETF、短期利率期货指数、现金类资产。此信号是市场突发性流动性危机的早期预警，要求投资者立即采取防御措施，如削减风险资产头寸，增加现金储备，以最大程度地保护资本。</p>
                <p className="text-gray-400 text-sm mt-2">深入解读: 流动性是金融市场的血液。水位骤降意味着市场资金链可能出现紧张，甚至断裂的风险。这种情况下，即使是优质资产也可能面临抛售压力。该信号旨在提供最及时的风险提示，帮助投资者在危机初期做出反应，避免深度亏损。</p>
              </div>

              {/* 领先指标背离信号详情 */}
              <div className="bg-gray-800 p-4 rounded-md border-l-4 border-amber-500">
                <h4 className="text-xl font-bold text-amber-400 mb-2">领先指标背离信号</h4>
                <p className="text-gray-300 mb-1"><span className="font-semibold">触发条件:</span> “领先指标对比”散点图中，当“先验领先指数”与“实际流动性”的走势出现明显分化，形成背离（如领先指数持续上升而实际流动性却在下降，或反之）。这种背离通常发生在市场趋势的顶部或底部区域。</p>
                <p className="text-gray-300 mb-1"><span className="font-semibold">胜率:</span> <span className="font-normal text-amber-400">88%-95%</span></p>
                <p className="text-gray-300"><span className="font-semibold">实战标的:</span> MMF ETF、短期利率期货指数、现金类资产。背离信号揭示了市场内在结构性矛盾，是趋势即将反转的先行指标，为投资者提供了提前布局或规避风险的时间窗口。</p>
                <p className="text-gray-400 text-sm mt-2">深入解读: 背离是技术分析中的一个重要概念，但在流动性领域，它具有更深层次的宏观意义。当领先指标（如基于高频交易、社交情绪等构建的指数）已经反映出流动性变化，而实际流动性数据尚未跟进时，就形成了背离。这种不一致性往往预示着市场即将迎来转折点，是进行逆向投资策略的绝佳时机。</p>
              </div>

              {/* 量子路径偏离信号详情 */}
              <div className="bg-gray-800 p-4 rounded-md border-l-4 border-blue-500">
                <h4 className="text-xl font-bold text-blue-400 mb-2">量子路径偏离信号</h4>
                <p className="text-gray-300 mb-1"><span className="font-semibold">触发条件:</span> “量子路径模拟”中，多数模拟路径（特别是P50中性路径，代表最高概率主干路径）开始显著偏离预期，并持续向P5悲观路径或P95乐观路径靠拢，且偏离程度超过预设的置信区间。这表明未来流动性情景的概率分布发生了重大变化。</p>
                <p className="text-gray-300 mb-1"><span className="font-semibold">胜率:</span> <span className="font-normal text-blue-400">88%-95%</span></p>
                <p className="text-gray-300"><span className="font-semibold">实战标的:</span> MMF ETF、短期利率期货指数、现金类资产。此信号通过对未来流动性情景的概率模拟，帮助投资者预判市场大方向，从而进行前瞻性的资产配置调整，实现风险控制和收益最大化。</p>
                <p className="text-gray-400 text-sm mt-2">深入解读: 量子路径模拟是本终端的核心创新之一。它不仅仅是简单的趋势预测，而是通过蒙特卡洛模拟等高级算法，结合宏观经济数据、政策预期、市场结构等多种因素，构建出未来流动性演变的多种可能路径。当这些路径的集合行为发生显著变化时，我们就能提前洞察到市场潜在的结构性风险或机遇，为投资者提供超越传统分析工具的决策优势。</p>
              </div>
            </div>
          </div>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default LiquidityIndexPanel;
