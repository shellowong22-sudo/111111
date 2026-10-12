import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, Download, Activity } from 'lucide-react';
import { toast } from 'sonner';

const basketComponents = [
  { rank: 1, ticker: 'AAPL', name: 'Apple Inc.', shares: 7842, weight: 7.12, price: 175.42, value: 1375843, action: 'BUY' },
  { rank: 2, ticker: 'MSFT', name: 'Microsoft Corp.', shares: 5234, weight: 6.89, price: 415.18, value: 2173452, action: 'BUY' },
  { rank: 3, ticker: 'NVDA', name: 'NVIDIA Corp.', shares: 3128, weight: 5.94, price: 875.22, value: 2737888, action: 'BUY' },
  { rank: 4, ticker: 'AMZN', name: 'Amazon.com Inc.', shares: 8920, weight: 3.82, price: 198.41, value: 1769819, action: 'BUY' },
  { rank: 5, ticker: 'GOOGL', name: 'Alphabet Inc.', shares: 6234, weight: 2.38, price: 175.60, value: 1094710, action: 'BUY' },
  { rank: 6, ticker: 'META', name: 'Meta Platforms', shares: 4128, weight: 2.15, price: 485.34, value: 2003483, action: 'BUY' },
  { rank: 7, ticker: 'TSLA', name: 'Tesla Inc.', shares: 5842, weight: 1.98, price: 248.32, value: 1450965, action: 'BUY' },
  { rank: 8, ticker: 'BRK.B', name: 'Berkshire Hathaway', shares: 3920, weight: 1.72, price: 386.12, value: 1513590, action: 'BUY' },
  { rank: 9, ticker: 'JPM', name: 'JPMorgan Chase', shares: 7234, weight: 1.64, price: 198.75, value: 1437773, action: 'BUY' },
  { rank: 10, ticker: 'V', name: 'Visa Inc.', shares: 4820, weight: 1.43, price: 275.88, value: 1329742, action: 'BUY' },
];

export default function BSKTPanel() {
  const [activeTab, setActiveTab] = useState<'basket' | 'pcf' | 'analysis'>('basket');
  const [etfTicker, setEtfTicker] = useState('SPY');
  const [units, setUnits] = useState(1);

  const totalValue = basketComponents.reduce((sum, c) => sum + c.value, 0) * units;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">BSKT</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">概览：ETF 创建 — 申购篮子成分管理</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast.success('PCF 已刷新')} className="flex items-center gap-1 px-2 py-1 bg-[#1a1a2e] rounded text-[#888] hover:text-[#ccc] text-[10px]">
            <RefreshCw className="w-3 h-3" />刷新 PCF
          </button>
          <button onClick={() => toast.success('篮子已导出')} className="flex items-center gap-1 px-2 py-1 bg-[#1a1a2e] rounded text-[#888] hover:text-[#ccc] text-[10px]">
            <Download className="w-3 h-3" />导出
          </button>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      <div className="flex items-center gap-4 px-3 py-2 bg-[#0d0d14] border-b border-[#1a1a2e]">
        <div className="flex items-center gap-2">
          <span className="text-[#666]">ETF:</span>
          <select value={etfTicker} onChange={e => setEtfTicker(e.target.value)}
            className="bg-[#1a1a2e] border border-[#333] rounded px-2 py-1 text-[#d4af37] font-bold text-xs outline-none focus:border-[#d4af37]">
            {['SPY', 'QQQ', 'IWM', 'GLD', 'TLT'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#666]">创建单位:</span>
          <input type="number" value={units} onChange={e => setUnits(Math.max(1, Number(e.target.value)))}
            className="w-16 bg-[#1a1a2e] border border-[#333] rounded px-2 py-1 text-[#ccc] text-xs outline-none focus:border-[#d4af37]" />
        </div>
        <div className="text-[#d4af37] font-bold">预估总金额: ${(totalValue / 1000000).toFixed(2)}M</div>
        <div className="text-[#888]">成分股: {basketComponents.length} 只</div>
      </div>

      <div className="flex border-b border-[#222]">
        {[{ id: 'basket', label: '篮子成分' }, { id: 'pcf', label: 'PCF 文件' }, { id: 'analysis', label: '权重分析' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'basket' && (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0d0d14] border-b border-[#222]">
              <tr>
                {['排名', '代码', '名称', '份数', '权重', '当前价', '市值($)', '操作'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[#666] font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {basketComponents.map((c, i) => (
                <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                  <td className="px-3 py-2 text-[#555]">{c.rank}</td>
                  <td className="px-3 py-2 text-[#d4af37] font-bold">{c.ticker}</td>
                  <td className="px-3 py-2 text-[#888]">{c.name}</td>
                  <td className="px-3 py-2 text-[#ccc]">{(c.shares * units).toLocaleString()}</td>
                  <td className="px-3 py-2 text-[#ccc]">{c.weight.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-[#ccc]">${c.price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-[#ccc]">${(c.value * units / 1000).toFixed(0)}K</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 bg-green-400/20 text-green-400 rounded text-[10px]">{c.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'pcf' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">PCF 文件 (Portfolio Composition File)</div>
            <div className="bg-[#0d0d14] border border-[#333] rounded p-3 font-mono text-[10px] text-[#4ade80] overflow-auto max-h-96">
              <div className="text-[#888] mb-2"># {etfTicker} PCF - {new Date().toLocaleDateString()} - 申购单位: {units}</div>
              <div className="text-[#888] mb-2"># TICKER | SHARES | PRICE | WEIGHT</div>
              {basketComponents.map((c, i) => (
                <div key={i}>{c.ticker.padEnd(8)} | {String(c.shares * units).padStart(8)} | {c.price.toFixed(4).padStart(10)} | {c.weight.toFixed(4)}%</div>
              ))}
              <div className="mt-2 text-[#888]"># CASH_COMPONENT: $12,450.00</div>
              <div className="text-[#888]"># TOTAL_BASKET_VALUE: ${(totalValue / 1000000).toFixed(4)}M</div>
            </div>
            <button onClick={() => toast.success('PCF 已下载')} className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-[#d4af37] text-black rounded text-[11px] font-bold hover:bg-[#e5c158]">
              <Download className="w-3 h-3" />下载 PCF 文件
            </button>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="p-4">
            <div className="text-[#d4af37] font-bold mb-3">成分权重分析 (Top 10)</div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={basketComponents} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="ticker" tick={{ fill: '#d4af37', fontSize: 10 }} width={50} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="weight" fill="#d4af37" radius={[0,2,2,0]} name="权重" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
