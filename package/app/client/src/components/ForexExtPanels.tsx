/**
 * 外汇补全面板集合
 * FXIP / FXDS / FXTF / XDSH / ECMI / ALLQ / FRD / BFIX / FXFA / STNI
 */
import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Search, RefreshCw, Download, Star, TrendingUp, TrendingDown, Globe, Calculator, Bell, Newspaper, Filter, ArrowUpDown } from 'lucide-react';

// ─── 通用工具 ───────────────────────────────────────────────────────────────
// The control panel stores symbols only. Prices, changes, and history are read
// from the public reference API below; no static quote values are carried in
// the initial watchlist.
const MAJOR_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD',
  'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
].map(pair => ({ pair }));

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY', 'HKD', 'SGD', 'KRW'];

function PanelHeader({ code, title, onClose, onRefresh, onExport, refreshLabel = '刷新当前面板', exportLabel = '导出当前面板' }: { code: string; title: string; onClose?: () => void; onRefresh?: () => void; onExport?: () => void; refreshLabel?: string; exportLabel?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a2e] border-b border-[#2a2a4a]">
      <div className="flex items-center gap-2">
        <span className="text-[#f59e0b] font-bold text-sm font-mono">{code}</span>
        <span className="text-gray-300 text-sm">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && <button type="button" aria-label={refreshLabel} title={refreshLabel} onClick={onRefresh} className="text-gray-400 hover:text-white p-1"><RefreshCw size={12} /></button>}
        {onExport && <button type="button" aria-label={exportLabel} title={exportLabel} onClick={onExport} className="text-gray-400 hover:text-white p-1"><Download size={12} /></button>}
        {onClose && <button type="button" aria-label="关闭面板" onClick={onClose} className="text-gray-400 hover:text-red-400 p-1 text-xs">✕</button>}
      </div>
    </div>
  );
}

type PublicReferenceRow = {
  pair: string;
  base: string;
  quote: string;
  label: string;
  dataMode: 'public_daily';
  status: 'available' | 'unavailable';
  observationDate: string | null;
  rate: number | null;
  previousRate: number | null;
  changePct: number | null;
  history: Array<{ date: string; value: number }>;
  limitation: string;
};

function downloadCsv(filename: string, lines: string[]) {
  const href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function PublicReferenceTrend({ row, compact = false }: { row: PublicReferenceRow; compact?: boolean }) {
  if (!row.history.length) return <div className="flex h-40 items-center justify-center rounded border border-amber-900/70 bg-amber-950/20 p-3 text-center text-xs text-amber-100">当前无法读取 {row.pair} 的公开日频参考序列；不以静态演示路径或随机数据替代。</div>;
  return <div className={`rounded border border-[#2a2a4a] bg-[#080b17] p-2 ${compact ? 'h-44' : 'h-56'}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={row.history}><CartesianGrid stroke="#1f2937" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 9 }} tickFormatter={(value) => String(value).slice(5)} minTickGap={28} /><YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} width={46} domain={['auto', 'auto']} /><Tooltip contentStyle={{ background: '#080b17', border: '1px solid #334155', fontSize: 11 }} labelStyle={{ color: '#cbd5e1' }} formatter={(value) => [Number(value).toFixed(row.quote === 'JPY' ? 3 : 5), '日频参考汇率']} /><Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} name="日频参考汇率" /></LineChart></ResponsiveContainer></div>;
}

// ─── FXIP 外汇信息门户 ───────────────────────────────────────────────────────
export function FXIPPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'calendar' | 'research'>('overview');
  const [selectedNewsIndex, setSelectedNewsIndex] = useState<number | null>(null);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const newsPairIndex: Record<string, number> = { 'EUR/USD': 0, 'USD/JPY': 2, 'GBP/USD': 3, 'AUD/USD': 4, 'USD/CNY': 5 };
  const tabs = [
    { id: 'overview', label: '市场概览' },
    { id: 'news', label: '外汇新闻' },
    { id: 'calendar', label: '经济日历' },
    { id: 'research', label: '研究报告' },
  ] as const;

  const newsItems = [
    { time: '09:42', headline: '美联储官员暗示年内降息次数或少于预期，美元指数走强', impact: 'high', pair: 'USD' },
    { time: '09:15', headline: 'ECB会议纪要显示通胀担忧持续，欧元承压', impact: 'high', pair: 'EUR' },
    { time: '08:58', headline: '日本央行维持超宽松政策，美元/日元突破157关口', impact: 'medium', pair: 'JPY' },
    { time: '08:30', headline: '英国CPI数据超预期，英镑短线走强', impact: 'high', pair: 'GBP' },
    { time: '07:45', headline: '澳大利亚就业数据好于预期，澳元反弹', impact: 'medium', pair: 'AUD' },
    { time: '07:20', headline: '中国PMI数据出炉，人民币小幅波动', impact: 'low', pair: 'CNY' },
  ];

  const calendarEvents = [
    { time: '14:30', event: '美国非农就业人数', currency: 'USD', importance: 3, forecast: '185K', previous: '175K' },
    { time: '14:30', event: '美国失业率', currency: 'USD', importance: 3, forecast: '3.9%', previous: '3.8%' },
    { time: '16:00', event: '密歇根消费者信心指数', currency: 'USD', importance: 2, forecast: '68.5', previous: '67.4' },
    { time: '20:00', event: '美联储主席鲍威尔讲话', currency: 'USD', importance: 3, forecast: '-', previous: '-' },
    { time: '次日 02:00', event: '日本央行利率决议', currency: 'JPY', importance: 3, forecast: '-0.1%', previous: '-0.1%' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="FXIP" title="外汇信息门户" onClose={onClose} />
      <div className="flex border-b border-[#2a2a4a]">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-mono transition-colors ${activeTab === t.id ? 'bg-[#1e3a5f] text-[#60a5fa] border-b-2 border-[#60a5fa]' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="rounded border border-amber-900/70 bg-amber-950/20 p-2 text-[11px] text-amber-100">市场概览使用公开日频参考汇率，不显示固定示例价格或实时 bid/ask。选择“外汇新闻”可展开每条资料的匹配货币对观察图。</div>
            {reference.isLoading ? <div className="grid grid-cols-2 gap-2"><div className="h-16 animate-pulse rounded bg-[#1a1a2e]" /><div className="h-16 animate-pulse rounded bg-[#1a1a2e]" /></div> : reference.isError ? <div className="rounded border border-red-900/70 bg-red-950/20 p-3 text-xs text-red-200">公开日频参考暂不可读取；市场概览保持真实不可用状态。</div> : (() => {
              const rows = ((reference.data?.readings ?? []) as PublicReferenceRow[]).filter((row) => row.dataMode === 'public_daily' && row.status === 'available' && row.pair in newsPairIndex);
              return rows.length ? <div className="grid grid-cols-2 gap-2">{rows.map((row) => <button type="button" key={row.pair} onClick={() => { setActiveTab('news'); setSelectedNewsIndex(newsPairIndex[row.pair]); }} className="rounded border border-[#2a2a4a] bg-[#1a1a2e] p-2 text-left hover:border-[#3a6a9a]"><div className="mb-1 text-gray-400">{row.pair}</div><div className="font-mono font-bold text-white">{row.rate?.toFixed(row.quote === 'JPY' ? 3 : 5) ?? '—'}</div><div className={Number(row.changePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>{row.changePct == null ? '相邻日变动未提供' : `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(3)}%`}</div><div className="mt-1 text-[10px] text-slate-500">{row.observationDate ?? '日期未提供'} · 日频</div></button>)}</div> : <div className="rounded border border-dashed border-gray-700 p-4 text-center text-xs text-gray-500">公开来源未返回可读货币对，保持真实空状态。</div>;
            })()}
            <div className="bg-[#1a1a2e] rounded p-2 border border-[#2a2a4a]">
              <div className="text-[#f59e0b] font-bold mb-2">市场情绪指标</div>
              <p className="rounded border border-dashed border-gray-700 p-3 text-[11px] leading-5 text-gray-400">原区域未提供持仓、期权偏度或客户流量的可核验来源，终端保留该指标区位但不展示固定百分比。接入合规持仓或情绪数据源后，才能显示可追溯的量化情绪。</p>
            </div>
          </div>
        )}
        {activeTab === 'news' && (
          <div className="space-y-2">
            <div className="rounded border border-amber-900/70 bg-amber-950/20 p-2 text-[11px] text-amber-100">以下为保留的终端内归档新闻资料，非实时新闻流；选择卡片可在本窗口展开摘要与核验说明。</div>
            {newsItems.map((item, i) => (
              <button type="button" key={i} className={`block w-full rounded border p-2 text-left ${selectedNewsIndex === i ? 'border-[#60a5fa] bg-[#172554]' : 'border-[#2a2a4a] bg-[#1a1a2e] hover:border-[#3a3a6a]'}`}
                onClick={() => setSelectedNewsIndex(i)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-500 font-mono">{item.time}</span>
                  <span className={`px-1 rounded text-xs font-bold ${item.impact === 'high' ? 'bg-red-900 text-red-300' : item.impact === 'medium' ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                    {item.impact === 'high' ? '高' : item.impact === 'medium' ? '中' : '低'}
                  </span>
                  <span className="bg-[#1e3a5f] text-[#60a5fa] px-1 rounded">{item.pair}</span>
                </div>
                <div className="text-gray-200">{item.headline}</div>
              </button>
            ))}
            {selectedNewsIndex !== null && (() => {
              const selected = newsItems[selectedNewsIndex];
              const relatedPair = ['EUR/USD', 'EUR/USD', 'USD/JPY', 'GBP/USD', 'AUD/USD', 'USD/CNY'][selectedNewsIndex] ?? 'EUR/USD';
              const related = (reference.data?.readings ?? []).find((row) => row.pair === relatedPair) as PublicReferenceRow | undefined;
              return <article className="rounded border border-[#60a5fa]/70 bg-[#0d1730] p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[#60a5fa]">归档资料详情 · {selected.time} · {selected.pair}</p><h4 className="mt-2 text-sm text-white">{selected.headline}</h4></div><button type="button" onClick={() => setSelectedNewsIndex(null)} className="shrink-0 text-xs text-gray-400 hover:text-white">关闭</button></div><p className="mt-3 leading-5 text-gray-300">该条目完整保留原页面提供的标题、时点、影响级别和货币标签，并在当前终端内展开。归档未提供可核验的新闻原文或实时新闻源，因此终端不会补写新闻事实、假造全文或把它表示为实时报道。</p><div className="mt-3 rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[11px] text-amber-100">关联数据状态：{reference.isLoading ? '正在读取公开日频参考…' : reference.isError ? '公开日频参考暂不可读取；不以模拟数据替代' : related?.history?.length ? `${related.pair} · ${related.label} · 最近实际观察 ${related.observationDate ?? '未提供'} · 仅日频、非可执行` : `${relatedPair} 当前未返回可读公开序列，保持真实空状态`}</div>{related?.history?.length ? <div className="mt-3"><p className="mb-1 text-[11px] text-cyan-200">关联观察图（不将相关性表述为因果）</p><PublicReferenceTrend row={related} compact /></div> : <div className="mt-3 rounded border border-dashed border-gray-700 p-4 text-center text-xs text-gray-500">关联公开序列不可用时不绘制替代图。</div>}</article>;
            })()}
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="space-y-2">
            <div className="text-gray-400 mb-2">今日重要经济事件（北京时间）</div>
            {calendarEvents.map((ev, i) => (
              <div key={i} className="bg-[#1a1a2e] rounded p-2 border border-[#2a2a4a] flex items-center gap-3">
                <div className="w-20 text-gray-400 font-mono">{ev.time}</div>
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className={`w-2 h-2 rounded-full ${j < ev.importance ? 'bg-red-500' : 'bg-gray-600'}`} />
                  ))}
                </div>
                <div className="flex-1 text-gray-200">{ev.event}</div>
                <div className="text-[#60a5fa] font-mono w-8">{ev.currency}</div>
                <div className="text-gray-400 w-12 text-right">预测: {ev.forecast}</div>
                <div className="text-gray-500 w-12 text-right">前值: {ev.previous}</div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'research' && (
          <div className="space-y-2">
            {[
              { title: '美元指数周度展望：短期强势或持续至非农数据', author: 'FX Research', date: '2026-06-22', tag: 'USD' },
              { title: '欧元区经济分化加剧，EUR/USD下行风险上升', author: 'Macro Strategy', date: '2026-06-21', tag: 'EUR' },
              { title: '日元干预风险评估：158关口是否触发BOJ行动', author: 'Asia FX', date: '2026-06-21', tag: 'JPY' },
              { title: '新兴市场货币压力测试：美元走强的传导效应', author: 'EM Strategy', date: '2026-06-20', tag: 'EM' },
            ].map((r, i) => (
              <div key={i} className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a] cursor-pointer hover:border-[#3a3a6a]"
                onClick={() => toast.info(`打开研报: ${r.title.slice(0, 20)}...`)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#1e3a5f] text-[#60a5fa] px-1 rounded text-xs">{r.tag}</span>
                  <span className="text-gray-500">{r.date}</span>
                  <span className="text-gray-500">· {r.author}</span>
                </div>
                <div className="text-gray-200 font-medium">{r.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FXDS 外汇数据检索 ───────────────────────────────────────────────────────
export function FXDSPanel({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'spot' | 'forward' | 'option' | 'swap'>('all');
  const [sortField, setSortField] = useState<'pair' | 'rate' | 'change'>('pair');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const utils = trpc.useUtils();
  const allData = (reference.data?.readings ?? []) as PublicReferenceRow[];

  const filtered = useMemo(() => {
    if (filterType !== 'all' && filterType !== 'spot') return [];
    return allData
      .filter((row) => filterType === 'spot' ? row.dataMode === 'public_daily' : true)
      .filter((row) => `${row.pair} ${row.label} ${row.base} ${row.quote}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (sortField === 'pair') return a.pair.localeCompare(b.pair);
        if (sortField === 'rate') return (b.rate ?? -Infinity) - (a.rate ?? -Infinity);
        return (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity);
      });
  }, [allData, query, sortField, filterType]);

  const selected = allData.find((row) => row.pair === selectedPair) ?? null;

  const refreshReference = async () => {
    try {
      const next = await utils.forexResearch.getPublicReferenceRates.fetch({ refresh: true });
      utils.forexResearch.getPublicReferenceRates.setData({ refresh: false }, next);
      toast.success('已强制重新请求公开日频参考汇率。');
    } catch {
      toast.error('公开日频参考汇率暂不可读取；保留上一状态并不以演示曲线替代。');
    }
  };

  const exportReference = () => {
    if (!filtered.length) {
      toast.error('当前筛选没有可导出的公开日频参考数据。');
      return;
    }
    const csv = ['pair,date,daily_reference_rate,adjacent_change_pct,source', ...filtered.map((row) => [row.pair, row.observationDate ?? '', row.rate ?? '', row.changePct ?? '', 'Frankfurter public daily reference'].join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `fxds-public-daily-reference-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    toast.success(`已导出 ${filtered.length} 条公开日频参考记录。`);
  };

  const toggleWatch = (pair: string) => setWatchlist((items) => items.includes(pair) ? items.filter((item) => item !== pair) : [...items, pair]);

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="FXDS" title="外汇数据检索" onClose={onClose} onRefresh={() => { void refreshReference(); }} onExport={exportReference} refreshLabel="重新请求公开日频参考" exportLabel="导出当前筛选日频参考" />
      <div className="p-2 border-b border-[#2a2a4a] flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="搜索货币对... (如 EUR, USD, JPY)"
            className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded pl-7 pr-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#60a5fa]" />
        </div>
        <div className="flex gap-1">
          {(['all', 'spot', 'forward', 'option', 'swap'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2 py-1 rounded text-xs ${filterType === t ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'}`}>
              {t === 'all' ? '全部' : t === 'spot' ? '公开日频' : t === 'forward' ? '远期' : t === 'option' ? '期权' : '掉期'}
            </button>
          ))}
        </div>
      </div>
      <div role="status" className="flex items-center justify-between border-b border-[#1a1a2e] px-3 py-1 text-[10px] text-gray-500">
        <span>{reference.isFetching ? '正在请求公开日频参考汇率…' : `来源：${reference.data?.source ?? 'Frankfurter · 公开中央银行日频参考汇率'}`}</span>
        <span>最新可用日：{reference.data?.asOf ?? '—'}</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#1a1a2e]">
            <tr>
              {[
                { label: '货币对', field: 'pair' as const },
                { label: '日频参考', field: 'rate' as const },
                { label: '最新日期', field: null },
                { label: '相邻日变化', field: 'change' as const },
                { label: '涨跌幅', field: null },
                { label: '状态', field: null },
              ].map(col => (
                <th key={col.label} onClick={() => col.field && setSortField(col.field)}
                  className={`px-3 py-2 text-left text-gray-400 font-normal ${col.field ? 'cursor-pointer hover:text-white' : ''}`}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.field && <ArrowUpDown size={10} />}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-left text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.pair} className="border-t border-[#1a1a2e] hover:bg-[#1a1a2e] cursor-pointer"
                onClick={() => setSelectedPair(row.pair)}>
                <td className="px-3 py-2 font-mono font-bold text-white">{row.pair}</td>
                <td className="px-3 py-2 font-mono text-cyan-300">{row.rate?.toFixed(row.quote === 'JPY' ? 3 : 5) ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-400">{row.observationDate ?? '—'}</td>
                <td className={`px-3 py-2 font-mono ${(row.changePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {row.changePct == null ? '—' : `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(4)}%`}
                </td>
                <td className="px-3 py-2 font-mono text-gray-400">{row.history.length} 日</td>
                <td className="px-3 py-2 text-gray-400">{row.status === 'available' ? '可读取' : '不可读取'}</td>
                <td className="px-3 py-2">
                  <button type="button" aria-label={watchlist.includes(row.pair) ? `从 ${row.pair} 监控移除` : `加入 ${row.pair} 监控`} onClick={e => { e.stopPropagation(); toggleWatch(row.pair); }}
                    className={watchlist.includes(row.pair) ? 'text-[#f59e0b]' : 'text-gray-400 hover:text-[#f59e0b]'}><Star size={12} fill={watchlist.includes(row.pair) ? 'currentColor' : 'none'} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reference.isLoading && <div className="p-4 text-center text-gray-400">正在读取公开日频参考汇率与历史走势…</div>}
        {reference.error && <div className="p-4 text-center text-amber-200">公开参考源暂不可读取；不显示缓存演示或伪实时曲线。</div>}
        {!reference.isLoading && !reference.error && filtered.length === 0 && <div className="p-4 text-center text-gray-400">当前筛选没有可验证的公开日频参考数据。</div>}
      </div>
      <div className="px-3 py-1 border-t border-[#2a2a4a] text-gray-500">
        共 {filtered.length} 个货币对 | 监控 {watchlist.length} 个 | 日频参考，非逐秒/非可执行
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedPair(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-[#0d0d1a] border-[#2a2a4a] text-white max-w-2xl">
          <DialogHeader><DialogTitle className="text-white">{selected?.pair} 公开日频走势</DialogTitle></DialogHeader>
          {selected && <div className="space-y-3 text-xs"><p className="rounded border border-cyan-900/80 bg-cyan-950/20 p-2 text-cyan-100">{selected.limitation}</p><div className="grid grid-cols-3 gap-3"><div><p className="text-gray-500">最新参考</p><p className="font-mono text-lg text-cyan-200">{selected.rate?.toFixed(selected.quote === 'JPY' ? 3 : 5) ?? '—'}</p></div><div><p className="text-gray-500">最新日期</p><p className="font-mono text-slate-200">{selected.observationDate ?? '—'}</p></div><div><p className="text-gray-500">相邻日变化</p><p className={(selected.changePct ?? 0) >= 0 ? 'font-mono text-emerald-300' : 'font-mono text-rose-300'}>{selected.changePct == null ? '—' : `${selected.changePct >= 0 ? '+' : ''}${selected.changePct.toFixed(4)}%`}</p></div></div><PublicReferenceTrend row={selected} /><button type="button" onClick={() => toggleWatch(selected.pair)} className="w-full rounded bg-[#1e3a5f] py-2 text-[#60a5fa]">{watchlist.includes(selected.pair) ? '从监控移除' : '加入监控'}</button></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── FXTF 外汇代码查找 ───────────────────────────────────────────────────────
export function FXTFPanel({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const utils = trpc.useUtils();
  const allTickers = (reference.data?.readings ?? []) as PublicReferenceRow[];
  const filtered = allTickers.filter((row) => `${row.pair.replace('/', '')} ${row.pair} ${row.label} ${row.base} ${row.quote}`.toLowerCase().includes(query.toLowerCase()));
  const selected = allTickers.find((row) => row.pair === selectedPair) ?? null;
  const toggleWatch = (pair: string) => setWatchlist((items) => items.includes(pair) ? items.filter((item) => item !== pair) : [...items, pair]);

  const refreshReference = async () => {
    try {
      const next = await utils.forexResearch.getPublicReferenceRates.fetch({ refresh: true });
      utils.forexResearch.getPublicReferenceRates.setData({ refresh: false }, next);
      toast.success('已强制重新请求公开日频参考汇率。');
    } catch {
      toast.error('公开日频参考汇率暂不可读取；不显示演示曲线。');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="FXTF" title="外汇代码查找" onClose={onClose} onRefresh={() => { void refreshReference(); }} refreshLabel="重新请求公开日频参考" exportLabel="导出当前代码资料" />
      <div className="p-2 border-b border-[#2a2a4a]">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="输入代码或名称搜索..."
            className="w-full bg-[#1a1a2e] border border-[#2a2a4a] rounded pl-7 pr-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#60a5fa]" />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 overflow-auto border-r border-[#2a2a4a]">
          {reference.isLoading && <div className="p-3 text-gray-400">正在读取公开代码与日频参考资料…</div>}
          {reference.error && <div className="p-3 text-amber-200">公开参考源暂不可读取；不显示静态代码图或伪实时曲线。</div>}
          {filtered.map((row) => (
            <div key={row.pair} onClick={() => { setSelectedPair(row.pair); setShowTrend(false); }}
              className={`px-3 py-2 cursor-pointer border-b border-[#1a1a2e] hover:bg-[#1a1a2e] ${selected?.pair === row.pair ? 'bg-[#1e3a5f]' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white">{row.pair.replace('/', '')}</span>
                <span className="text-gray-500 text-xs bg-[#2a2a4a] px-1 rounded">{row.status === 'available' ? '日频可读' : '不可读'}</span>
              </div>
              <div className="text-gray-400">{row.label}</div>
            </div>
          ))}
        </div>
        <div className="w-1/2 p-3">
          {selected ? (
            <div className="space-y-3">
              <div className="text-[#f59e0b] font-bold text-sm">{selected.pair.replace('/', '')}</div>
              <div className="text-gray-300">{selected.label}</div>
              <div className="space-y-2">
                {[
                  { label: '日频参考', value: selected.rate?.toFixed(selected.quote === 'JPY' ? 3 : 5) ?? '—' },
                  { label: '最新可用日期', value: selected.observationDate ?? '—' },
                  { label: '相邻日变化', value: selected.changePct == null ? '—' : `${selected.changePct >= 0 ? '+' : ''}${selected.changePct.toFixed(4)}%` },
                  { label: '历史点数', value: `${selected.history.length} 日` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between border-b border-[#2a2a4a] pb-1">
                    <span className="text-gray-400">{row.label}</span>
                    <span className="font-mono text-white">{row.value}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => toggleWatch(selected.pair)}
                className="w-full bg-[#1e3a5f] hover:bg-[#2a4a7f] text-[#60a5fa] py-2 rounded text-xs">
                {watchlist.includes(selected.pair) ? '从监控列表移除' : '添加到监控列表'}
              </button>
              <button type="button" onClick={() => setShowTrend(true)}
                className="w-full bg-[#1a2a1a] hover:bg-[#2a3a2a] text-green-400 py-2 rounded text-xs">
                查看公开日频走势图
              </button>
              <p className="text-[10px] leading-4 text-gray-500">{selected.limitation}</p>
            </div>
          ) : (
            <div className="text-gray-500 text-center mt-8">点击左侧代码查看详情</div>
          )}
        </div>
      </div>
      <Dialog open={showTrend && Boolean(selected)} onOpenChange={open => setShowTrend(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-[#0d0d1a] border-[#2a2a4a] text-white max-w-2xl">
          <DialogHeader><DialogTitle className="text-white">{selected?.pair.replace('/', '')} 公开日频走势图</DialogTitle></DialogHeader>
          {selected && <div className="space-y-3 text-xs"><p className="rounded border border-cyan-900/80 bg-cyan-950/20 p-2 text-cyan-100">{selected.limitation}</p><p className="text-[11px] text-slate-400">数据源：{reference.data?.source ?? 'Frankfurter · 公开中央银行日频参考汇率'}</p><PublicReferenceTrend row={selected} /><p className="text-gray-400">最新可用日期：{selected.observationDate ?? '—'}；公开日频序列每 5 分钟重新请求数据源。图表不代表逐秒、可执行、银行双边或订单簿报价。</p></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── XDSH 外汇控制面板 ───────────────────────────────────────────────────────
export function XDSHPanel({ onClose }: { onClose?: () => void }) {
  const [layout, setLayout] = useState<'4x2' | '3x3' | '2x4'>('4x2');
  const [watchlist, setWatchlist] = useState(MAJOR_PAIRS.slice(0, 8));
  const [showAddPair, setShowAddPair] = useState(false);
  const [newPairInput, setNewPairInput] = useState('');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const utils = trpc.useUtils();

  const gridCols = layout === '4x2' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : layout === '3x3' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';
  const selectedReference = (reference.data?.readings ?? []).find((row) => row.pair === selectedPair) as PublicReferenceRow | undefined;
  const refreshReference = async () => {
    try {
      const next = await utils.forexResearch.getPublicReferenceRates.fetch({ refresh: true });
      utils.forexResearch.getPublicReferenceRates.setData({ refresh: false }, next);
      toast.success('已刷新控制面板的公开日频参考。');
    } catch { toast.error('公开日频参考暂不可读取；保持当前可见状态。'); }
  };
  const exportWatchlist = () => {
    const rows = watchlist.map((pair) => {
      const referenceRow = (reference.data?.readings ?? []).find((row) => row.pair === pair.pair) as PublicReferenceRow | undefined;
      return [pair.pair, referenceRow?.observationDate ?? '', referenceRow?.rate ?? '', referenceRow?.changePct ?? '', referenceRow?.dataMode ?? 'unavailable'].join(',');
    });
    downloadCsv(`xdsh-watchlist-${new Date().toISOString().slice(0, 10)}.csv`, ['pair,observation_date,reference_rate,daily_change_pct,data_mode', ...rows]);
    toast.success(`已导出 ${rows.length} 个控制面板自选项。`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="XDSH" title="外汇控制面板" onClose={onClose} onRefresh={refreshReference} onExport={exportWatchlist} refreshLabel="刷新公开日频参考" exportLabel="导出控制面板 CSV" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a4a]">
        <span className="text-gray-400">布局:</span>
        {(['4x2', '3x3', '2x4'] as const).map(l => (
          <button key={l} onClick={() => setLayout(l)}
            className={`px-2 py-0.5 rounded text-xs ${layout === l ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'}`}>
            {l}
          </button>
        ))}
        <button onClick={() => setShowAddPair(true)} className="ml-auto text-gray-400 hover:text-white px-2 py-0.5 bg-[#1a1a2e] rounded">
          + 添加货币对
        </button>
        <Dialog open={showAddPair} onOpenChange={setShowAddPair}>
          <DialogContent className="bg-[#0d0d1a] border-[#2a2a4a] text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white">添加货币对</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={newPairInput}
                onChange={e => setNewPairInput(e.target.value.toUpperCase())}
                placeholder="输入货币对，如 EUR/USD"
                className="bg-[#1a1a2e] border-[#2a2a4a] text-white placeholder:text-gray-500"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newPairInput.includes('/')) {
                    const exists = watchlist.some(p => p.pair === newPairInput);
                    if (!exists) {
                      setWatchlist(w => [...w, { pair: newPairInput }]);
                      toast.info(`已添加 ${newPairInput}；等待公开来源匹配`);
                      setNewPairInput('');
                      setShowAddPair(false);
                    } else {
                      toast.error(`${newPairInput} 已在监控列表中`);
                    }
                  }
                }}
              />
              <p className="text-xs text-gray-500">输入格式：XXX/YYY，按 Enter 添加</p>
              <div className="flex flex-wrap gap-1">
                {MAJOR_PAIRS.filter(p => !watchlist.some(w => w.pair === p.pair)).map(p => (
                  <button key={p.pair} onClick={() => {
                    setWatchlist(w => [...w, p]);
                    toast.success(`已添加 ${p.pair}`);
                    setShowAddPair(false);
                  }} className="px-2 py-0.5 text-xs bg-[#1a1a2e] text-[#60a5fa] rounded hover:bg-[#1e3a5f] border border-[#2a2a4a]">
                    {p.pair}
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex-1 overflow-auto p-2">
      <div className={`grid ${gridCols} gap-2`}>
        {watchlist.map((pair, i) => {
          const referenceRow = (reference.data?.readings ?? []).find((row) => row.pair === pair.pair) as PublicReferenceRow | undefined;
          const sparkData = referenceRow?.history.slice(-20).map((point) => ({ v: point.value })) ?? [];
          const price = referenceRow?.rate ?? null;
          const pct = referenceRow?.changePct ?? null;
          return (
            <button type="button" key={i} className={`rounded border bg-[#1a1a2e] p-2 text-left hover:border-[#3a6a9a] ${selectedPair === pair.pair ? 'border-cyan-500' : 'border-[#2a2a4a]'}`}
              onClick={() => setSelectedPair(pair.pair)}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-white text-xs">{pair.pair}</span>
                <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); setWatchlist(w => w.filter((_, j) => j !== i)); }} onKeyDown={e => { if (e.key === 'Enter') setWatchlist(w => w.filter((_, j) => j !== i)); }} className="text-gray-600 hover:text-red-400 text-xs">✕</span>
              </div>
              <div className="font-mono text-lg font-bold text-white">{reference.isLoading ? '…' : price == null ? '—' : price.toFixed(referenceRow?.quote === 'JPY' ? 3 : 5)}</div>
              <div className={`font-mono text-xs ${Number(pct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pct == null ? '日变动未提供' : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(3)}%`}
              </div>
              <div className="h-8 mt-1">
                {sparkData.length ? <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke={Number(pct ?? 0) >= 0 ? '#4ade80' : '#f87171'} dot={false} strokeWidth={1} />
                  </LineChart>
                </ResponsiveContainer> : <div className="grid h-full place-items-center text-[9px] text-gray-600">公开来源未覆盖</div>}
              </div>
              <div className="mt-1 text-[9px] text-slate-500">{referenceRow ? `${referenceRow.observationDate ?? '日期未提供'} · 公开日频` : '真实空状态'}</div>
            </button>
          );
        })}
      </div>
      {selectedPair && <div className="mt-3 rounded border border-cyan-900/70 bg-[#07111b] p-2"><p className="mb-2 text-xs text-cyan-100">{selectedPair} 控制面板详情</p>{selectedReference ? <><p className="mb-2 text-[10px] text-amber-200">公开日频参考 · 最近观察 {selectedReference.observationDate ?? '未提供'} · 非可执行</p><PublicReferenceTrend row={selectedReference} /></> : <div className="rounded border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">该自选货币对尚未获得可读公开来源，保持真实空状态。</div>}</div>}
      </div>
    </div>
  );
}

// ─── ECMI 市场冲击行情显示 ───────────────────────────────────────────────────
export function ECMIPanel({ onClose }: { onClose?: () => void }) {
  const events = [
    { time: '14:30:02', pair: 'USD/JPY', before: 157.12, after: 157.68, impact: +0.56, event: '美国非农就业人数超预期', type: 'macro' },
    { time: '14:30:01', pair: 'EUR/USD', before: 1.0862, after: 1.0821, impact: -0.0041, event: '美国非农就业人数超预期', type: 'macro' },
    { time: '14:30:00', pair: 'GBP/USD', before: 1.2742, after: 1.2698, impact: -0.0044, event: '美国非农就业人数超预期', type: 'macro' },
    { time: '10:00:15', pair: 'EUR/GBP', before: 0.8521, after: 0.8548, impact: +0.0027, event: '欧元区CPI初值超预期', type: 'macro' },
    { time: '09:30:08', pair: 'GBP/USD', before: 1.2698, after: 1.2742, impact: +0.0044, event: '英国制造业PMI好于预期', type: 'macro' },
    { time: '08:50:22', pair: 'USD/JPY', before: 157.82, after: 157.12, impact: -0.70, event: '日本央行官员鹰派表态', type: 'central_bank' },
  ];

  const [filter, setFilter] = useState<'all' | 'macro' | 'central_bank'>('all');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const utils = trpc.useUtils();
  const filtered = events.filter(e => filter === 'all' || e.type === filter);
  const refreshReference = async () => {
    try {
      const next = await utils.forexResearch.getPublicReferenceRates.fetch({ refresh: true });
      utils.forexResearch.getPublicReferenceRates.setData({ refresh: false }, next);
      toast.success('已刷新 ECMI 关联公开日频参考。');
    } catch { toast.error('关联公开日频参考暂不可读取；冲击归档记录保持不变。'); }
  };
  const exportEvents = () => {
    downloadCsv(`ecmi-archive-events-${new Date().toISOString().slice(0, 10)}.csv`, ['time,pair,before,after,recorded_impact,event,type', ...filtered.map((event) => [event.time, event.pair, event.before, event.after, event.impact, event.event, event.type].join(','))]);
    toast.success(`已导出 ${filtered.length} 条冲击归档记录。`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="ECMI" title="市场冲击行情显示" onClose={onClose} onRefresh={refreshReference} onExport={exportEvents} refreshLabel="刷新关联公开日频参考" exportLabel="导出冲击归档 CSV" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a4a]">
        <span className="text-gray-400">筛选:</span>
        {[
          { id: 'all', label: '全部' },
          { id: 'macro', label: '宏观数据' },
          { id: 'central_bank', label: '央行事件' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id as any)}
            className={`px-2 py-0.5 rounded ${filter === f.id ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'}`}>
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-slate-400">
          <div className="w-2 h-2 bg-slate-400 rounded-full" />
          归档冲击资料
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((ev, i) => (
          <div key={i} className="border-b border-[#1a1a2e] p-3 hover:bg-[#1a1a2e] cursor-pointer"
            onClick={() => setSelectedIndex(selectedIndex === i ? null : i)}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-gray-500 font-mono w-20">{ev.time}</span>
              <span className="font-mono font-bold text-white w-16">{ev.pair}</span>
              <span className={`font-mono font-bold ${ev.impact > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {ev.impact > 0 ? '+' : ''}{ev.impact.toFixed(4)}
              </span>
              <span className="text-gray-400 text-xs bg-[#2a2a4a] px-1 rounded">
                {ev.type === 'macro' ? '宏观' : '央行'}
              </span>
            </div>
            <div className="flex items-center gap-4 ml-20">
              <span className="text-gray-400">冲击前: <span className="font-mono text-white">{ev.before}</span></span>
              <span className="text-gray-400">→</span>
              <span className="text-gray-400">冲击后: <span className="font-mono text-white">{ev.after}</span></span>
              <span className="text-gray-300 flex-1 truncate">{ev.event}</span>
            </div>
            {selectedIndex === i && (() => {
              const related = (reference.data?.readings ?? []).find((row) => row.pair === ev.pair) as PublicReferenceRow | undefined;
              return <div className="mt-3 rounded border border-cyan-900/70 bg-[#07111b] p-2"><div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-300"><span>冲击前：{ev.before}</span><span>冲击后：{ev.after}</span><span>记录变动：{ev.impact > 0 ? '+' : ''}{ev.impact.toFixed(4)}</span><span>类别：{ev.type === 'macro' ? '宏观资料' : '央行资料'}</span></div><p className="mt-2 text-[10px] text-amber-200">{reference.isLoading ? '关联公开日频参考读取中…' : reference.isError ? '公开日频参考暂不可读取；不以模拟曲线替代' : related?.history?.length ? related.dataMode === 'public_daily' ? `${related.pair} · 最近公开观察 ${related.observationDate ?? '未提供'} · 日频、非可执行` : `${related.pair} · 模拟日频情景 · 非真实市场数据` : `${ev.pair} 未返回可读公开序列，保持真实空状态`}</p>{related?.history?.length ? <div className="mt-2"><PublicReferenceTrend row={related} compact /></div> : null}</div>;
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ALLQ 全部报价 ───────────────────────────────────────────────────────────
export function ALLQPanel({ onClose }: { onClose?: () => void }) {
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [base, setBase] = useState('USD');
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const rates = useMemo<Record<string, number | null>>(() => {
    const values: Record<string, number | null> = Object.fromEntries(CURRENCIES.map((currency) => [currency, null]));
    values.USD = 1;
    ((reference.data?.readings ?? []) as PublicReferenceRow[]).filter((row) => row.dataMode === 'public_daily' && row.status === 'available' && row.rate).forEach((row) => {
      if (row.base === 'USD') values[row.quote] = row.rate;
      if (row.quote === 'USD') values[row.base] = row.rate ? 1 / row.rate : null;
    });
    return values;
  }, [reference.data]);
  const baseRate = rates[base];
  const crossRates = CURRENCIES.map(c => ({
    currency: c,
    rate: baseRate && rates[c] ? rates[c] / baseRate : null,
  }));
  const selectedReference = useMemo(() => {
    if (!selectedPair) return undefined;
    const [selectedBase, selectedQuote] = selectedPair.split('/');
    const direct = ((reference.data?.readings ?? []) as PublicReferenceRow[]).find((row) => row.pair === selectedPair);
    if (direct) return direct;
    const reverse = ((reference.data?.readings ?? []) as PublicReferenceRow[]).find((row) => row.pair === `${selectedQuote}/${selectedBase}`);
    return reverse?.history.length ? { ...reverse, pair: selectedPair, label: selectedPair, rate: reverse.rate ? 1 / reverse.rate : null, previousRate: reverse.previousRate ? 1 / reverse.previousRate : null, history: reverse.history.map((point) => ({ ...point, value: 1 / point.value })) } : undefined;
  }, [reference.data, selectedPair]);

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="ALLQ" title="全部报价" onClose={onClose} onRefresh={() => reference.refetch()} onExport={() => downloadCsv(`allq-public-reference-${new Date().toISOString().slice(0, 10)}.csv`, ['base,currency,cross_rate,data_mode', ...crossRates.filter((row) => row.currency !== base).map((row) => [base, row.currency, row.rate ?? '', row.rate == null ? 'unavailable' : 'public_daily'].join(','))])} refreshLabel="刷新公开日频参考" exportLabel="导出当前交叉报价 CSV" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2a4a]">
        <span className="text-gray-400">基准货币:</span>
        <select value={base} onChange={e => setBase(e.target.value)}
          className="bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-0.5 text-white text-xs focus:outline-none">
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          {(['matrix', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2 py-0.5 rounded ${view === v ? 'bg-[#1e3a5f] text-[#60a5fa]' : 'bg-[#1a1a2e] text-gray-400 hover:text-white'}`}>
              {v === 'matrix' ? '矩阵' : '列表'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {view === 'list' ? (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#1a1a2e]">
              <tr>
                <th className="px-3 py-2 text-left text-gray-400">货币</th>
                <th className="px-3 py-2 text-right text-gray-400">汇率 ({base}/X)</th>
                <th className="px-3 py-2 text-right text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {crossRates.filter(r => r.currency !== base).map((r, i) => (
                <tr key={i} className="border-t border-[#1a1a2e] hover:bg-[#1a1a2e] cursor-pointer"
                  onClick={() => setSelectedPair(`${base}/${r.currency}`)}>
                  <td className="px-3 py-2 font-mono font-bold text-white">{base}/{r.currency}</td>
                  <td className={`px-3 py-2 font-mono text-right ${r.rate == null ? 'text-gray-500' : 'text-green-400'}`}>{r.rate == null ? '—' : r.rate.toFixed(r.currency === 'JPY' || r.currency === 'KRW' ? 2 : 4)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-gray-500">{r.rate == null ? '无覆盖' : '查看详情'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>
            <div className="text-gray-400 mb-2">汇率矩阵（行 × 列 = 汇率）</div>
            <div className="overflow-auto">
              <table className="text-center">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-gray-500">↓/→</th>
                    {CURRENCIES.slice(0, 8).map(c => (
                      <th key={c} className="px-2 py-1 text-[#60a5fa] font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CURRENCIES.slice(0, 8).map(row => (
                    <tr key={row}>
                      <td className="px-2 py-1 text-[#60a5fa] font-mono font-bold">{row}</td>
                      {CURRENCIES.slice(0, 8).map(col => {
                        const val = rates[col] && rates[row] ? rates[col]! / rates[row]! : null;
                        const isBase = row === col;
                        return (
                          <td key={col} onClick={() => !isBase && setSelectedPair(`${row}/${col}`)}
                            className={`px-2 py-1 font-mono text-xs cursor-pointer hover:bg-[#1e3a5f] ${isBase ? 'text-gray-600' : 'text-white'}`}>
                            {isBase ? '—' : val == null ? '—' : val.toFixed(col === 'JPY' || col === 'KRW' ? 2 : 4)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {selectedPair && <div className="mt-3 rounded border border-cyan-900/70 bg-[#07111b] p-2"><p className="mb-2 text-xs text-cyan-100">{selectedPair} 交叉报价详情</p>{selectedReference?.history.length ? <><p className="mb-2 text-[10px] text-amber-200">公开日频参考 · 最近观察 {selectedReference.observationDate ?? '未提供'} · 非实时、非可执行</p><PublicReferenceTrend row={selectedReference} /></> : <div className="rounded border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">该货币对没有可读公开日频覆盖，保持真实空状态。</div>}</div>}
      </div>
    </div>
  );
}

// ─── FRD 外汇远期计算器 ──────────────────────────────────────────────────────
export function FRDPanel({ onClose }: { onClose?: () => void }) {
  const [base, setBase] = useState('USD');
  const [quote, setQuote] = useState('JPY');
  const [spotRate, setSpotRate] = useState<number | null>(null);
  const [baseDomRate, setBaseDomRate] = useState(5.25);
  const [quoteForRate, setQuoteForRate] = useState(-0.1);
  const [tenor, setTenor] = useState(90);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const apiSpot = (reference.data?.readings ?? []).find((row) => row.pair === `${base}/${quote}`) as PublicReferenceRow | undefined;
  const effectiveSpot = spotRate ?? apiSpot?.rate ?? null;

  const forwardRate = useMemo(() => {
    if (effectiveSpot == null || !Number.isFinite(effectiveSpot)) return null;
    const t = tenor / 360;
    return effectiveSpot * Math.exp((quoteForRate / 100 - baseDomRate / 100) * t);
  }, [effectiveSpot, baseDomRate, quoteForRate, tenor]);

  const forwardPoints = forwardRate == null || effectiveSpot == null ? null : forwardRate - effectiveSpot;
  const annualizedPremium = forwardPoints == null || effectiveSpot == null ? null : (forwardPoints / effectiveSpot) * (360 / tenor) * 100;

  const tenorCurve = [30, 60, 90, 120, 180, 270, 360].map(t => ({
    tenor: `${t}D`,
    forward: effectiveSpot == null ? null : effectiveSpot * Math.exp((quoteForRate / 100 - baseDomRate / 100) * (t / 360)),
    points: effectiveSpot == null ? null : (effectiveSpot * Math.exp((quoteForRate / 100 - baseDomRate / 100) * (t / 360)) - effectiveSpot) * 10000,
  }));
  const exportCurve = () => {
    downloadCsv(`frd-forward-curve-${base}-${quote}-${new Date().toISOString().slice(0, 10)}.csv`, [
      'base_currency,quote_currency,tenor_days,spot_rate,base_rate_pct,quote_rate_pct,forward_rate,forward_points',
      ...tenorCurve.filter((point) => point.forward != null && point.points != null).map((point) => [base, quote, point.tenor.replace('D', ''), effectiveSpot ?? '', baseDomRate, quoteForRate, point.forward?.toFixed(8) ?? '', point.points?.toFixed(4) ?? ''].join(',')),
    ]);
    toast.success('已导出当前输入参数推导的远期曲线 CSV。');
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="FRD" title="外汇远期计算器" onClose={onClose} onExport={exportCurve} exportLabel="导出当前远期曲线 CSV" />
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a] space-y-2">
            <div className="text-[#f59e0b] font-bold mb-2">输入参数</div>
            {[
              { label: '基础货币', value: base, setter: setBase, type: 'select', options: CURRENCIES },
              { label: '报价货币', value: quote, setter: setQuote, type: 'select', options: CURRENCIES },
                { label: '即期汇率', value: effectiveSpot ?? '', setter: (v: any) => setSpotRate(v === '' ? null : parseFloat(v)), type: 'number', step: 0.01 },
              { label: `${base} 利率 (%)`, value: baseDomRate, setter: (v: any) => setBaseDomRate(parseFloat(v)), type: 'number', step: 0.01 },
              { label: `${quote} 利率 (%)`, value: quoteForRate, setter: (v: any) => setQuoteForRate(parseFloat(v)), type: 'number', step: 0.01 },
              { label: '期限 (天)', value: tenor, setter: (v: any) => setTenor(parseInt(v)), type: 'number', step: 1 },
            ].map(field => (
              <div key={field.label} className="flex items-center justify-between">
                <label className="text-gray-400 w-28">{field.label}</label>
                {field.type === 'select' ? (
                  <select value={field.value as string} onChange={e => (field.setter as any)(e.target.value)}
                    className="bg-[#0d0d1a] border border-[#2a2a4a] rounded px-2 py-0.5 text-white text-xs focus:outline-none w-20">
                    {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type="number" value={field.value as number} step={(field as any).step || 1}
                    onChange={e => (field.setter as any)(e.target.value)}
                    className="bg-[#0d0d1a] border border-[#2a2a4a] rounded px-2 py-0.5 text-white text-xs focus:outline-none w-20 text-right font-mono" />
                )}
              </div>
            ))}
          </div>
          <div className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a] space-y-2">
            <div className="text-[#f59e0b] font-bold mb-2">计算结果</div>
            {[
              { label: '远期汇率', value: forwardRate == null ? '公开即期不可用' : forwardRate.toFixed(4), color: 'text-[#60a5fa]', bold: true },
              { label: '远期点数 (pips)', value: forwardPoints == null ? '—' : (forwardPoints * 10000).toFixed(2), color: forwardPoints != null && forwardPoints >= 0 ? 'text-green-400' : 'text-red-400' },
              { label: '年化溢价/折价', value: annualizedPremium == null ? '—' : `${annualizedPremium.toFixed(4)}%`, color: annualizedPremium != null && annualizedPremium >= 0 ? 'text-green-400' : 'text-red-400' },
              { label: '利率平价偏差', value: annualizedPremium == null ? '—' : `${Math.abs(annualizedPremium - (baseDomRate - quoteForRate)).toFixed(4)}%`, color: 'text-gray-300' },
            ].map(row => (
              <div key={row.label} className="flex justify-between border-b border-[#2a2a4a] pb-1">
                <span className="text-gray-400">{row.label}</span>
                <span className={`font-mono ${row.bold ? 'font-bold text-lg' : ''} ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className="mt-2 p-2 bg-[#0d0d1a] rounded text-gray-400">
              <div className="text-[#f59e0b] mb-1">公式: F = S × e^((r_q - r_b) × T)</div>
              <div>利率平价理论：高利率货币远期贴水</div>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a]">
          <div className="text-[#f59e0b] font-bold mb-2">远期曲线（{base}/{quote}）</div>
          <div className="mb-2 text-[10px] text-gray-500">即期来源：{reference.data?.source ?? '公开汇率 API'}；仅公开日频参考，不代表可执行远期报价。</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tenorCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis dataKey="tenor" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', fontSize: 10 }}
                  formatter={(v: any) => [parseFloat(v).toFixed(4), '远期汇率']} />
                <Line type="monotone" dataKey="forward" stroke="#60a5fa" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BFIX 彭博外汇定价 ───────────────────────────────────────────────────────
export function BFIXPanel({ onClose }: { onClose?: () => void }) {
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const reference = trpc.forexResearch.getPublicReferenceRates.useQuery({ refresh: false }, { refetchInterval: 5 * 60_000 });
  const utils = trpc.useUtils();
  const fixings = [
    { pair: 'EUR/USD', time: '15:00 CET', bfix: 1.0843, wm: 1.0841, diff: 0.0002, vol: '2.8B' },
    { pair: 'GBP/USD', time: '16:00 GMT', bfix: 1.2719, wm: 1.2715, diff: 0.0004, vol: '1.9B' },
    { pair: 'USD/JPY', time: '15:00 JST', bfix: 157.43, wm: 157.45, diff: -0.02, vol: '3.1B' },
    { pair: 'USD/CHF', time: '15:00 CET', bfix: 0.8966, wm: 0.8964, diff: 0.0002, vol: '0.8B' },
    { pair: 'AUD/USD', time: '16:00 AEST', bfix: 0.6522, wm: 0.6520, diff: 0.0002, vol: '1.1B' },
    { pair: 'USD/CAD', time: '16:00 ET', bfix: 1.3646, wm: 1.3648, diff: -0.0002, vol: '0.9B' },
  ];
  const selectedReference = (reference.data?.readings ?? []).find((row) => row.pair === selectedPair) as PublicReferenceRow | undefined;
  const refreshReference = async () => {
    try {
      const next = await utils.forexResearch.getPublicReferenceRates.fetch({ refresh: true });
      utils.forexResearch.getPublicReferenceRates.setData({ refresh: false }, next);
      toast.success('已更新可读的公开日频对照参考。');
    } catch {
      toast.error('公开日频对照参考暂不可读取；BFIX 授权状态不变。');
    }
  };
  const exportArchive = () => {
    downloadCsv(`bfix-archive-status-${new Date().toISOString().slice(0, 10)}.csv`, [
      'pair,scheduled_fix_time,archived_bfix,archived_wm_reuters,archived_difference,authorization_status',
      ...fixings.map((fixing) => [fixing.pair, fixing.time, fixing.bfix, fixing.wm, fixing.diff, 'not_authorized_no_current_fixing'].join(',')),
    ]);
    toast.success('已导出归档字段与授权状态；文件不包含可用 BFIX 定盘。');
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="BFIX" title="佑诚外汇定价" onClose={onClose} onRefresh={() => { void refreshReference(); }} onExport={exportArchive} refreshLabel="刷新公开日频对照参考" exportLabel="导出 BFIX 归档状态 CSV" />
      <div className="p-3 border-b border-[#2a2a4a]">
        <div className="text-gray-400 text-xs">BFIX 为受授权的外汇基准定价资料。本终端未配置许可数据源；下列数字仅保留为原面板的归档字段，不能用作当前定盘、结算、对账或可执行报价。</div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#1a1a2e]">
            <tr>
              {['货币对', '定价时间', 'BFIX', 'WM/Reuters', '价差', '成交量', '操作'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-gray-400 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fixings.map((f, i) => (
              <tr key={i} className="border-t border-[#1a1a2e] hover:bg-[#1a1a2e] cursor-pointer"
                onClick={() => setSelectedPair(selectedPair === f.pair ? null : f.pair)}>
                <td className="px-3 py-2 font-mono font-bold text-white">{f.pair}</td>
                <td className="px-3 py-2 text-gray-400 font-mono">{f.time}</td>
                <td className="px-3 py-2 font-mono text-[#60a5fa]">{f.bfix.toFixed(4)}</td>
                <td className="px-3 py-2 font-mono text-gray-300">{f.wm.toFixed(4)}</td>
                <td className={`px-3 py-2 font-mono ${f.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {f.diff >= 0 ? '+' : ''}{f.diff.toFixed(4)}
                </td>
                <td className="px-3 py-2 text-gray-400">{f.vol}</td>
                <td className="px-3 py-2">
                  <button type="button" aria-label={`导出 ${f.pair} 归档状态`} onClick={e => { e.stopPropagation(); downloadCsv(`bfix-${f.pair.replace('/', '-')}-archive.csv`, ['pair,scheduled_fix_time,archived_bfix,archived_wm_reuters,authorization_status', [f.pair, f.time, f.bfix, f.wm, 'not_authorized_no_current_fixing'].join(',')]); toast.success(`已导出 ${f.pair} 归档状态。`); }}
                    className="text-gray-400 hover:text-white"><Download size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedPair && <div className="border-t border-cyan-900/70 bg-[#07111b] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-cyan-100">{selectedPair} 定价授权与公开对照</p><span className="rounded border border-amber-900/70 bg-amber-950/30 px-2 py-0.5 text-[10px] text-amber-100">BFIX 授权源未配置</span></div><p className="mt-2 text-[10px] text-amber-200">不展示或推断 BFIX 历史定盘。以下仅为独立公开中央银行日频参考对照，不是 BFIX、WM/Reuters、双边报价或订单簿数据。</p>{reference.isLoading ? <div className="mt-2 text-[10px] text-slate-400">读取公开日频对照中…</div> : reference.isError ? <div className="mt-2 text-[10px] text-amber-200">公开日频对照暂不可读取；保持授权不可用状态。</div> : selectedReference?.history.length ? <div className="mt-2"><p className="mb-2 text-[10px] text-slate-400">最近公开观察：{selectedReference.observationDate ?? '未提供'} · {selectedReference.dataMode === 'public_daily' ? '公开日频' : '模拟日频情景'}</p><PublicReferenceTrend row={selectedReference} compact /></div> : <div className="mt-2 rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">该货币对无可读公开日频对照，保持真实空状态。</div>}</div>}
      <div className="px-3 py-2 border-t border-[#2a2a4a] bg-[#1a1a2e] text-gray-500">
        许可状态：未配置 BFIX 数据授权 | 归档字段日期：2026-06-22 | 公开日频对照仅在可读时显示
      </div>
    </div>
  );
}

// ─── FXFA 外汇利率套利 ───────────────────────────────────────────────────────
export function FXFAPanel({ onClose }: { onClose?: () => void }) {
  const [principal, setPrincipal] = useState(1000000);
  const [baseCcy, setBaseCcy] = useState('USD');
  const [quoteCcy, setQuoteCcy] = useState('JPY');
  const [spotRate, setSpotRate] = useState(157.42);
  const [forwardRate, setForwardRate] = useState(155.82);
  const [baseRate, setBaseRate] = useState(5.25);
  const [quoteRate, setQuoteRate] = useState(-0.1);
  const [days, setDays] = useState(90);

  const coveredReturn = useMemo(() => {
    const t = days / 360;
    const investInBase = principal * (1 + baseRate / 100 * t);
    const convertToQuote = principal * spotRate;
    const investInQuote = convertToQuote * (1 + quoteRate / 100 * t);
    const convertBack = investInQuote / forwardRate;
    const arbitrageProfit = convertBack - investInBase;
    const annualizedReturn = (arbitrageProfit / principal) * (360 / days) * 100;
    return { investInBase, convertBack, arbitrageProfit, annualizedReturn };
  }, [principal, baseCcy, quoteCcy, spotRate, forwardRate, baseRate, quoteRate, days]);
  const sensitivityCurve = useMemo(() => [-75, -50, -25, 0, 25, 50, 75].map((forwardShift) => {
    const shiftedForward = forwardRate * (1 + forwardShift / 10_000);
    const term = days / 360;
    const baseProceeds = principal * (1 + baseRate / 100 * term);
    const quoteProceeds = principal * spotRate * (1 + quoteRate / 100 * term);
    const profit = quoteProceeds / shiftedForward - baseProceeds;
    return { forwardShift, annualizedReturn: profit / principal * (360 / days) * 100, profit };
  }), [principal, spotRate, forwardRate, baseRate, quoteRate, days]);
  const exportSensitivity = () => {
    downloadCsv(`fxfa-cip-sensitivity-${new Date().toISOString().slice(0, 10)}.csv`, [
      'base_currency,quote_currency,tenor_days,forward_shift_bp,annualized_return_pct,calculated_profit',
      ...sensitivityCurve.map((point) => [baseCcy, quoteCcy, days, point.forwardShift, point.annualizedReturn.toFixed(6), point.profit.toFixed(2)].join(',')),
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="FXFA" title="外汇利率套利" onClose={onClose} onExport={exportSensitivity} exportLabel="导出理论敏感度 CSV" />
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a] space-y-2">
            <div className="text-[#f59e0b] font-bold mb-2">套利参数</div>
            {[
              { label: '本金 (USD)', value: principal, setter: setPrincipal, step: 100000 },
              { label: '即期汇率', value: spotRate, setter: setSpotRate, step: 0.01 },
              { label: '远期汇率', value: forwardRate, setter: setForwardRate, step: 0.01 },
              { label: `${baseCcy} 利率 (%)`, value: baseRate, setter: setBaseRate, step: 0.01 },
              { label: `${quoteCcy} 利率 (%)`, value: quoteRate, setter: setQuoteRate, step: 0.01 },
              { label: '期限 (天)', value: days, setter: setDays, step: 1 },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <label className="text-gray-400 w-28">{f.label}</label>
                <input type="number" value={f.value} step={f.step}
                  onChange={e => f.setter(parseFloat(e.target.value) as any)}
                  className="bg-[#0d0d1a] border border-[#2a2a4a] rounded px-2 py-0.5 text-white text-xs focus:outline-none w-24 text-right font-mono" />
              </div>
            ))}
          </div>
          <div className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a] space-y-2">
            <div className="text-[#f59e0b] font-bold mb-2">套利结果（CIP）</div>
            {[
              { label: '直接投资收益', value: `$${coveredReturn.investInBase.toLocaleString('en', { maximumFractionDigits: 0 })}`, color: 'text-gray-300' },
              { label: '套利后收益', value: `$${coveredReturn.convertBack.toLocaleString('en', { maximumFractionDigits: 0 })}`, color: 'text-gray-300' },
              { label: '套利利润', value: `$${coveredReturn.arbitrageProfit.toLocaleString('en', { maximumFractionDigits: 0 })}`, color: coveredReturn.arbitrageProfit > 0 ? 'text-green-400' : 'text-red-400', bold: true },
              { label: '年化套利收益率', value: `${coveredReturn.annualizedReturn.toFixed(4)}%`, color: coveredReturn.annualizedReturn > 0 ? 'text-green-400' : 'text-red-400', bold: true },
            ].map(row => (
              <div key={row.label} className="flex justify-between border-b border-[#2a2a4a] pb-1">
                <span className="text-gray-400">{row.label}</span>
                <span className={`font-mono ${(row as any).bold ? 'font-bold text-base' : ''} ${row.color}`}>{row.value}</span>
              </div>
            ))}
            <div className={`mt-2 p-2 rounded text-center font-bold ${coveredReturn.arbitrageProfit > 100 ? 'bg-amber-950/50 text-amber-200' : 'bg-[#0d0d1a] text-gray-400'}`}>
              {coveredReturn.arbitrageProfit > 100 ? '模型差异信号 · 未执行' : '理论平价附近 · 未执行'}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              CIP: 抛补利率平价。结果仅由当前输入推导，不构成可执行套利、报价或交易建议。
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1"><div className="text-[#f59e0b] font-bold">远期偏移敏感度（{baseCcy}/{quoteCcy}）</div><span className="text-[10px] text-amber-200">由当前输入计算 · 非市场曲线 · 未执行</span></div>
          <p className="mb-2 text-[10px] text-gray-500">横轴为相对当前远期的假设偏移（bp），纵轴为年化理论差异；用于检查输入敏感度，不代表实际可交易收益。</p>
          <div className="h-36"><ResponsiveContainer width="100%" height="100%"><LineChart data={sensitivityCurve}><CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" /><XAxis dataKey="forwardShift" tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`} /><YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} width={50} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a4a', fontSize: 10 }} formatter={(value: number) => [`${value.toFixed(4)}%`, '年化理论差异']} labelFormatter={(value) => `远期偏移：${value > 0 ? '+' : ''}${value} bp`} /><ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" /><Line type="monotone" dataKey="annualizedReturn" stroke="#f59e0b" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div>
        </div>
      </div>
    </div>
  );
}

// ─── STNI 建议新闻传输 ───────────────────────────────────────────────────────
export function STNIPanel({ onClose }: { onClose?: () => void }) {
  const [subscriptions, setSubscriptions] = useState([
    { id: 1, name: '美联储政策动态', category: '央行', frequency: '归档观察', active: true, pairs: ['USD'] },
    { id: 2, name: '欧元区经济数据', category: '宏观', frequency: '每日', active: true, pairs: ['EUR'] },
    { id: 3, name: '日本央行动态', category: '央行', frequency: '归档观察', active: false, pairs: ['JPY'] },
    { id: 4, name: '大宗商品价格异动', category: '商品', frequency: '归档观察', active: true, pairs: ['AUD', 'CAD'] },
  ]);
  const [newSub, setNewSub] = useState('');

  const toggleSub = (id: number) => {
    setSubscriptions(s => s.map(sub => sub.id === id ? { ...sub, active: !sub.active } : sub));
    toast.success('本终端会话内的规则状态已更新；未向外部传输。');
  };

  const addSub = () => {
    if (!newSub.trim()) return;
    setSubscriptions(s => [...s, {
      id: Date.now(), name: newSub, category: '自定义', frequency: '会话规则', active: true, pairs: []
    }]);
    setNewSub('');
    toast.success(`已添加订阅: ${newSub}`);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d1a] text-white text-xs">
      <PanelHeader code="STNI" title="建议新闻传输" onClose={onClose} />
      <div className="p-3 border-b border-[#2a2a4a]">
        <div className="flex gap-2">
          <input value={newSub} onChange={e => setNewSub(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSub()}
            placeholder="添加新闻订阅主题..."
            className="flex-1 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#60a5fa]" />
          <button onClick={addSub} className="bg-[#1e3a5f] text-[#60a5fa] px-3 py-1 rounded hover:bg-[#2a4a7f]">添加</button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-amber-200">规则仅保存在当前终端会话，用于站内筛选预览；未接入实时新闻源，不发送邮件、消息或任何外部通知。</p>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        <div className="text-gray-400 mb-2">我的新闻订阅 ({subscriptions.length})</div>
        {subscriptions.map(sub => (
          <div key={sub.id} className="bg-[#1a1a2e] rounded p-3 border border-[#2a2a4a] flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white">{sub.name}</span>
                <span className="bg-[#2a2a4a] text-gray-400 px-1 rounded">{sub.category}</span>
                <span className="bg-[#2a2a4a] text-gray-400 px-1 rounded">{sub.frequency}</span>
              </div>
              <div className="flex gap-1">
                {sub.pairs.map(p => (
                  <span key={p} className="bg-[#1e3a5f] text-[#60a5fa] px-1 rounded text-xs">{p}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleSub(sub.id)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sub.active ? 'bg-green-600' : 'bg-gray-600'}`}>
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${sub.active ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
              <button onClick={() => { setSubscriptions(s => s.filter(x => x.id !== sub.id)); toast.info('已取消订阅'); }}
                className="text-gray-500 hover:text-red-400">✕</button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#2a2a4a] text-gray-500">
        {subscriptions.filter(s => s.active).length} 个启用规则 | 状态：仅本终端会话内预览 · 未传输
      </div>
    </div>
  );
}
