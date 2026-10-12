import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Search, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const generateTickerStatus = () => [
  { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', status: 'ACTIVE', price: 175.42, lastUpdate: '15:59:58', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', status: 'ACTIVE', price: 415.18, lastUpdate: '15:59:57', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', status: 'ACTIVE', price: 175.60, lastUpdate: '15:59:55', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', status: 'HALTED', price: 248.32, lastUpdate: '14:32:15', tradingStatus: 'HALTED', haltReason: 'LULD', circuit: 'L1' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ', status: 'ACTIVE', price: 875.22, lastUpdate: '15:59:59', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', status: 'ACTIVE', price: 485.34, lastUpdate: '15:59:56', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', status: 'ACTIVE', price: 198.41, lastUpdate: '15:59:54', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', exchange: 'NYSE', status: 'ACTIVE', price: 386.12, lastUpdate: '15:59:50', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', status: 'ACTIVE', price: 198.75, lastUpdate: '15:59:52', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'V', name: 'Visa Inc.', exchange: 'NYSE', status: 'DELAYED', price: 275.88, lastUpdate: '15:58:30', tradingStatus: 'DELAYED', haltReason: 'DATA_DELAY', circuit: null },
  { ticker: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', status: 'ACTIVE', price: 68.42, lastUpdate: '15:59:48', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE', status: 'ACTIVE', price: 118.35, lastUpdate: '15:59:45', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'GS', name: 'Goldman Sachs', exchange: 'NYSE', status: 'ACTIVE', price: 458.92, lastUpdate: '15:59:51', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'BAC', name: 'Bank of America', exchange: 'NYSE', status: 'ACTIVE', price: 38.45, lastUpdate: '15:59:49', tradingStatus: 'OPEN', haltReason: null, circuit: null },
  { ticker: 'COIN', name: 'Coinbase Global', exchange: 'NASDAQ', status: 'HALTED', price: 225.18, lastUpdate: '13:45:22', tradingStatus: 'HALTED', haltReason: 'NEWS_PENDING', circuit: null },
];

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  ACTIVE: { color: 'text-green-400', bg: 'bg-green-400/10', icon: <CheckCircle className="w-3 h-3" /> },
  HALTED: { color: 'text-red-400', bg: 'bg-red-400/10', icon: <XCircle className="w-3 h-3" /> },
  DELAYED: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: <AlertCircle className="w-3 h-3" /> },
};

export default function TTTTPanel() {
  const [tickers, setTickers] = useState(generateTickerStatus());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterExchange, setFilterExchange] = useState('ALL');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [customTicker, setCustomTicker] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);

  const filtered = tickers.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterExchange !== 'ALL' && t.exchange !== filterExchange) return false;
    if (search && !t.ticker.includes(search.toUpperCase()) && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleLookup = () => {
    if (!customTicker) return;
    const found = tickers.find(t => t.ticker === customTicker.toUpperCase());
    setLookupResult(found || { ticker: customTicker.toUpperCase(), status: 'NOT_FOUND', name: '未找到该代码' });
  };

  const handleRefresh = () => {
    setLastRefresh(new Date());
    setTickers(generateTickerStatus());
  };

  const activeCount = tickers.filter(t => t.status === 'ACTIVE').length;
  const haltedCount = tickers.filter(t => t.status === 'HALTED').length;
  const delayedCount = tickers.filter(t => t.status === 'DELAYED').length;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">TTTT</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">定价号码状态 — 实时证券交易状态监控</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#555] text-[10px]">更新: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={handleRefresh} className="p-1 hover:bg-[#333] rounded"><RefreshCw className="w-3 h-3 text-[#888]" /></button>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-0 border-b border-[#222]">
        <div className="px-3 py-2 border-r border-[#222]">
          <div className="text-[#666] text-[10px]">监控证券</div>
          <div className="font-bold text-sm text-[#d4af37]">{tickers.length}</div>
        </div>
        <div className="px-3 py-2 border-r border-[#222]">
          <div className="text-[#666] text-[10px]">正常交易</div>
          <div className="font-bold text-sm text-green-400">{activeCount}</div>
        </div>
        <div className="px-3 py-2 border-r border-[#222]">
          <div className="text-[#666] text-[10px]">交易暂停</div>
          <div className="font-bold text-sm text-red-400">{haltedCount}</div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[#666] text-[10px]">数据延迟</div>
          <div className="font-bold text-sm text-yellow-400">{delayedCount}</div>
        </div>
      </div>

      {/* Lookup + Filters */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d14] border-b border-[#1a1a2e]">
        <div className="flex items-center gap-1 bg-[#1a1a2e] rounded px-2 py-1">
          <Search className="w-3 h-3 text-[#666]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索代码或名称..." className="bg-transparent outline-none text-xs w-32 text-[#ccc] placeholder-[#444]" />
        </div>
        {['ALL', 'ACTIVE', 'HALTED', 'DELAYED'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-2 py-1 rounded text-[10px] transition-colors ${filterStatus === s ? 'bg-[#d4af37] text-black font-bold' : 'bg-[#1a1a2e] text-[#888] hover:text-[#ccc]'}`}>
            {s}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <input value={customTicker} onChange={e => setCustomTicker(e.target.value.toUpperCase())}
            placeholder="输入代码查询..." className="bg-[#1a1a2e] border border-[#333] rounded px-2 py-1 text-[#ccc] text-xs outline-none focus:border-[#d4af37] w-28" />
          <button onClick={handleLookup} className="px-2 py-1 bg-[#d4af37] text-black rounded text-[10px] font-bold hover:bg-[#e5c158]">查询</button>
        </div>
      </div>

      {/* Lookup Result */}
      {lookupResult && (
        <div className={`mx-3 mt-2 p-3 rounded border ${lookupResult.status === 'NOT_FOUND' ? 'border-red-400/30 bg-red-400/5' : lookupResult.status === 'ACTIVE' ? 'border-green-400/30 bg-green-400/5' : 'border-yellow-400/30 bg-yellow-400/5'}`}>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold text-[#d4af37] mr-2">{lookupResult.ticker}</span>
              <span className="text-[#888]">{lookupResult.name}</span>
            </div>
            <button onClick={() => setLookupResult(null)} className="text-[#666] hover:text-[#ccc]">✕</button>
          </div>
          {lookupResult.status !== 'NOT_FOUND' && (
            <div className="grid grid-cols-4 gap-3 mt-2 text-[11px]">
              <div><span className="text-[#666]">状态: </span>
                <span className={statusConfig[lookupResult.status]?.color}>{lookupResult.status}</span>
              </div>
              <div><span className="text-[#666]">价格: </span><span className="text-[#ccc]">${lookupResult.price}</span></div>
              <div><span className="text-[#666]">交易所: </span><span className="text-[#ccc]">{lookupResult.exchange}</span></div>
              <div><span className="text-[#666]">更新: </span><span className="text-[#ccc]">{lookupResult.lastUpdate}</span></div>
              {lookupResult.haltReason && <div><span className="text-[#666]">暂停原因: </span><span className="text-red-400">{lookupResult.haltReason}</span></div>}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto mt-2">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222]">
            <tr>
              {['代码', '名称', '交易所', '状态', '当前价格', '最后更新', '交易状态', '暂停原因', '熔断级别'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const sc = statusConfig[t.status] || statusConfig.ACTIVE;
              return (
                <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                  <td className="px-3 py-2 text-[#d4af37] font-bold">{t.ticker}</td>
                  <td className="px-3 py-2 text-[#ccc]">{t.name}</td>
                  <td className="px-3 py-2 text-[#888]">{t.exchange}</td>
                  <td className="px-3 py-2">
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${sc.color} ${sc.bg}`}>
                      {sc.icon}{t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#ccc]">${t.price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-[#888]">{t.lastUpdate}</td>
                  <td className={`px-3 py-2 font-bold ${t.tradingStatus === 'OPEN' ? 'text-green-400' : t.tradingStatus === 'HALTED' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {t.tradingStatus}
                  </td>
                  <td className="px-3 py-2 text-red-400">{t.haltReason || '-'}</td>
                  <td className="px-3 py-2">
                    {t.circuit ? <span className="px-1.5 py-0.5 bg-red-400/20 text-red-400 rounded text-[10px] font-bold">{t.circuit}</span> : <span className="text-[#555]">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
