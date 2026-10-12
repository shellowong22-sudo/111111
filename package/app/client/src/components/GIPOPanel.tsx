import { useMemo, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface GIPOPanelProps { onClose: () => void; ticker?: string; }
type ApiRange = '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';
const TIME_RANGES = ['1D', '3D', '1M', '6M', 'YTD', '1Y', '5Y', 'Max'];
const PRICE_TYPES = ['跳价', '中间价', '买价', '卖价'];
const RANGE_MAP: Record<string, ApiRange> = { '1D': '5d', '3D': '5d', '1M': '1mo', '6M': '6mo', 'YTD': '1y', '1Y': '1y', '5Y': '5y', Max: '5y' };

function number(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export default function GIPOPanel({ onClose, ticker = 'IBM US' }: GIPOPanelProps) {
  const [range, setRange] = useState('1D');
  const [priceType, setPriceType] = useState('跳价');
  const [showPrePost, setShowPrePost] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showData, setShowData] = useState(false);
  const symbol = ticker.split(/\s+/)[0].trim().toUpperCase();
  const query = trpc.market.getHistory.useQuery(
    { symbol, range: RANGE_MAP[range] ?? '5d' },
    { refetchInterval: 60_000, refetchOnReconnect: true, refetchOnWindowFocus: true, retry: 1 },
  );
  const history = query.data?.history ?? [];
  const latest = history.at(-1);
  const previous = history.at(-2);
  const change = latest?.close != null && previous?.close != null ? latest.close - previous.close : null;
  const changePct = change != null && previous?.close ? (change / previous.close) * 100 : null;
  const valueFor = (point: typeof latest) => {
    if (!point) return null;
    if (priceType === '买价') return point.low ?? point.close;
    if (priceType === '卖价') return point.high ?? point.close;
    return point.close ?? point.value;
  };
  const chartData = useMemo(() => history.map((point) => ({
    date: point.date.slice(0, 10),
    price: valueFor(point),
    volume: point.volume,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
  })), [history, priceType]);
  const stats = [
    { label: '最新价格', value: valueFor(latest) },
    { label: `收于 ${latest?.date?.slice(0, 10) ?? '—'}`, value: latest?.close ?? null },
    { label: '最高价（样本）', value: history.length ? Math.max(...history.map((p) => p.high ?? -Infinity).filter(Number.isFinite)) : null },
    { label: '平均价（样本）', value: history.length ? history.reduce((sum, p) => sum + (p.close ?? 0), 0) / history.filter((p) => p.close != null).length : null },
    { label: '最低价（样本）', value: history.length ? Math.min(...history.map((p) => p.low ?? Infinity).filter(Number.isFinite)) : null },
  ];

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#0a0a0a] border-b border-[#333]">
        <span className="text-[#f5a623] font-bold">{ticker}</span><span className="text-white">{query.data?.currency ?? '—'}</span>
        <span className={change == null ? 'text-[#777]' : change >= 0 ? 'text-[#00c853]' : 'text-[#ff1744]'}>{change == null ? '—' : `${change >= 0 ? '↑' : '↓'} ${number(Math.abs(change))}`}</span>
        <span className={changePct == null ? 'text-[#777]' : changePct >= 0 ? 'text-[#00c853]' : 'text-[#ff1744]'}>{changePct == null ? '—' : `${changePct >= 0 ? '+' : ''}${number(changePct)}%`}</span>
        <span className="text-[#777] ml-2">公开日频观察 · 非可执行报价</span>
        <button onClick={() => query.refetch()} className="ml-auto text-[#aaa] hover:text-white" title="刷新数据"><RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? 'animate-spin' : ''}`} /></button>
        <button onClick={onClose} className="text-[#aaa] hover:text-white" title="关闭"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex items-center justify-between px-3 py-1 bg-[#8b0000] border-b border-[#333]"><span className="text-white font-bold">{ticker} Equity</span><div className="flex items-center gap-2"><button onClick={() => setRange('1D')} className="px-2 py-0.5 bg-[#1a1a3a] text-[#aaa] border border-[#333] hover:border-[#f5a623] text-xs">94 建议图表</button><button onClick={() => setShowPrePost((value) => !value)} className={`px-2 py-0.5 border text-xs ${showPrePost ? 'border-[#f5a623] text-[#f5a623]' : 'border-[#333] text-[#aaa]'}`}>90 选项</button><button onClick={() => setPriceType('中间价')} className="px-2 py-0.5 bg-[#1a1a3a] text-[#aaa] border border-[#333] hover:border-[#f5a623] text-xs">97 修改</button><span className="text-[#f5a623] ml-2">隔夜（盘前/盘后）</span></div></div>

      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#0d0d0d] border-b border-[#222]"><span className="text-[#666]">范围</span><span className="text-[#f5a623]">{range}</span><span className="text-[#aaa]">{history[0]?.date?.slice(0, 10) ?? '—'}</span><span className="text-[#555]">—</span><span className="text-[#aaa]">{latest?.date?.slice(0, 10) ?? '—'}</span><span className="text-[#aaa]">观察频率：日频</span><span className="text-[#aaa]">{showPrePost ? '盘前/盘后：未接入' : '仅常规时段字段'}</span></div>

      <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0a0a0a] border-b border-[#222]">{TIME_RANGES.map((item) => <button key={item} onClick={() => setRange(item)} className={`px-2 py-0.5 text-xs ${range === item ? 'bg-[#f5a623] text-black font-bold' : 'border border-[#333] text-[#aaa] hover:border-[#f5a623]'}`}>{item}</button>)}<select value={priceType} onChange={(event) => setPriceType(event.target.value)} className="ml-2 bg-[#0d0d0d] border border-[#444] text-[#f5a623] text-xs px-2 py-0.5">{PRICE_TYPES.map((item) => <option key={item}>{item}</option>)}</select><div className="ml-auto flex items-center gap-2"><button onClick={() => setShowData((value) => !value)} className={`px-2 py-0.5 border text-xs ${showData ? 'border-[#f5a623] text-[#f5a623]' : 'border-[#333] text-[#aaa]'}`}>+ 相关数据</button><button onClick={() => setShowVolume((value) => !value)} className="px-2 py-0.5 bg-[#f5a623] text-black font-bold text-xs">{showVolume ? '隐藏成交量' : '添加数据'}</button><button onClick={() => setShowPrePost((value) => !value)} className="px-2 py-0.5 border border-[#333] text-[#aaa] hover:border-[#f5a623] text-xs">修改图表</button></div></div>

      <div className="flex-1 min-h-0 bg-[#050505] relative p-2">
        <div className="absolute top-2 right-3 z-10 text-xs space-y-0.5">{stats.map((item) => <div key={item.label} className="flex items-center gap-2"><span className="text-[#777]">{item.label}</span><span className="text-white">{number(item.value)}</span></div>)}</div>
        {query.isError ? <div role="alert" className="flex h-full items-center justify-center text-amber-300">Yahoo Finance 当前未返回可验证的 {symbol} OHLCV；不显示静态或随机曲线。</div> : query.isLoading ? <div role="status" className="flex h-full items-center justify-center text-[#888]">正在读取 Yahoo Finance 日频历史…</div> : !query.data?.available || chartData.length === 0 ? <div role="status" className="flex h-full items-center justify-center text-amber-300">当前品种没有可验证的公开日频历史；盘前/盘后与逐笔报价源未配置。</div> : <div className="h-full pt-2"><ResponsiveContainer width="100%" height={showVolume ? '72%' : '100%'}><LineChart data={chartData}><CartesianGrid stroke="#1a1a1a" /><XAxis dataKey="date" tick={{ fill: '#777', fontSize: 9 }} minTickGap={24} /><YAxis tick={{ fill: '#777', fontSize: 9 }} domain={['auto', 'auto']} /><Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid #444', fontSize: 11 }} /><Line type="monotone" dataKey="price" name={`${priceType}（日频）`} stroke="#f5a623" strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>{showVolume && <ResponsiveContainer width="100%" height="28%"><BarChart data={chartData}><XAxis dataKey="date" hide /><YAxis tick={{ fill: '#555', fontSize: 8 }} /><Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid #444', fontSize: 11 }} /><Bar dataKey="volume" name="成交量" fill="#42526b" /></BarChart></ResponsiveContainer>}</div>}
      </div>

      {showData && <div className="max-h-40 overflow-auto border-t border-[#333] bg-[#080808] px-3 py-2"><table className="w-full text-left text-[10px]"><thead className="text-[#777]"><tr>{['日期', '开盘', '最高', '最低', '收盘', '成交量', '来源'].map((header) => <th key={header} className="px-2 py-1">{header}</th>)}</tr></thead><tbody>{chartData.slice(-12).map((row) => <tr key={row.date} className="border-t border-[#222]"><td className="px-2 py-1 text-[#aaa]">{row.date}</td><td className="px-2 py-1">{number(row.open)}</td><td className="px-2 py-1">{number(row.high)}</td><td className="px-2 py-1">{number(row.low)}</td><td className="px-2 py-1">{number(row.close)}</td><td className="px-2 py-1">{row.volume == null ? '—' : row.volume.toLocaleString()}</td><td className="px-2 py-1 text-[#777]">{query.data?.source ?? '—'}</td></tr>)}</tbody></table></div>}
      <div className="px-3 py-1.5 bg-[#0a0a0a] border-t border-[#333] text-[#555]">{query.data?.limitation ?? '公开日频 OHLCV，非实时、非可执行报价'} · {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleTimeString('zh-CN') : '读取中'}</div>
    </div>
  );
}
