import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Activity, Zap } from 'lucide-react';
import { toast } from 'sonner';

const betaOrders = [
  { id: 'CKMM-001', etf: 'SPY', type: 'CREATION', units: 2, status: 'BETA_TEST', nav: 485.32, submitted: '09:30:00', testResult: 'PASS' },
  { id: 'CKMM-002', etf: 'QQQ', type: 'REDEMPTION', units: 1, status: 'BETA_TEST', nav: 448.75, submitted: '10:15:22', testResult: 'PASS' },
  { id: 'CKMM-003', etf: 'IWM', type: 'CREATION', units: 3, status: 'BETA_FAIL', nav: 198.42, submitted: '11:02:45', testResult: 'FAIL' },
  { id: 'CKMM-004', etf: 'GLD', type: 'CREATION', units: 5, status: 'BETA_TEST', nav: 182.65, submitted: '13:45:18', testResult: 'PASS' },
];

const performanceData = [
  { time: '09:30', latency: 1.2, throughput: 85, errorRate: 0 },
  { time: '10:00', latency: 1.4, throughput: 120, errorRate: 0.1 },
  { time: '10:30', latency: 1.1, throughput: 95, errorRate: 0 },
  { time: '11:00', latency: 2.8, throughput: 68, errorRate: 1.2 },
  { time: '11:30', latency: 1.3, throughput: 110, errorRate: 0 },
  { time: '12:00', latency: 1.0, throughput: 75, errorRate: 0 },
  { time: '13:00', latency: 1.2, throughput: 130, errorRate: 0 },
  { time: '14:00', latency: 1.5, throughput: 145, errorRate: 0.2 },
];

export default function CKMMPanel() {
  const [activeTab, setActiveTab] = useState<'orders' | 'performance' | 'config'>('orders');
  const [betaEnabled, setBetaEnabled] = useState(true);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">CKMM</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">ETF 创建 (Beta) — 测试环境 ETF 创建赎回</span>
          <span className="px-2 py-0.5 bg-purple-400/20 text-purple-400 rounded text-[10px] font-bold">BETA</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setBetaEnabled(!betaEnabled); toast.info(`Beta 模式已${betaEnabled ? '关闭' : '开启'}`); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold transition-colors ${betaEnabled ? 'bg-purple-500 text-white' : 'bg-[#1a1a2e] text-[#888]'}`}>
            <Zap className="w-3 h-3" />{betaEnabled ? 'Beta ON' : 'Beta OFF'}
          </button>
          <span className="flex items-center gap-1 text-purple-400 text-[10px]"><Activity className="w-3 h-3" />BETA</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0 border-b border-[#222]">
        {[
          { label: 'Beta 测试委托', value: String(betaOrders.length), color: '#a78bfa' },
          { label: '测试通过', value: String(betaOrders.filter(o => o.testResult === 'PASS').length), color: '#4ade80' },
          { label: '测试失败', value: String(betaOrders.filter(o => o.testResult === 'FAIL').length), color: '#f87171' },
          { label: '平均延迟', value: '1.3ms', color: '#60a5fa' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="text-[#666] text-[10px]">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#222]">
        {[{ id: 'orders', label: 'Beta 委托' }, { id: 'performance', label: '性能监控' }, { id: 'config', label: 'Beta 配置' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'orders' && (
          <div>
            <div className="mb-3 p-2 bg-purple-400/10 border border-purple-400/30 rounded text-[11px] text-purple-400">
              ⚠ Beta 环境：所有委托仅用于测试，不会产生实际交易。测试数据每日重置。
            </div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>
                  {['委托号', 'ETF', '类型', '单位', 'NAV', '状态', '测试结果', '提交时间'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {betaOrders.map((o, i) => (
                  <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                    <td className="px-3 py-2 text-[#a78bfa] font-bold">{o.id}</td>
                    <td className="px-3 py-2 text-[#d4af37] font-bold">{o.etf}</td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${o.type === 'CREATION' ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'}`}>{o.type === 'CREATION' ? '申购' : '赎回'}</span></td>
                    <td className="px-3 py-2 text-[#ccc]">{o.units}</td>
                    <td className="px-3 py-2 text-[#ccc]">${o.nav.toFixed(2)}</td>
                    <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-purple-400/20 text-purple-400 rounded text-[10px]">{o.status}</span></td>
                    <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${o.testResult === 'PASS' ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'}`}>{o.testResult}</span></td>
                    <td className="px-3 py-2 text-[#888]">{o.submitted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">Beta 环境性能监控</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#666', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="latency" stroke="#a78bfa" name="延迟(ms)" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="throughput" stroke="#4ade80" name="吞吐量" dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="errorRate" stroke="#f87171" name="错误率%" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="max-w-md space-y-4">
            <div className="text-[#d4af37] font-bold mb-3">Beta 环境配置</div>
            {[
              { label: 'Beta 模式', value: betaEnabled, toggle: true },
              { label: '模拟延迟注入', value: false, toggle: true },
              { label: '错误注入测试', value: false, toggle: true },
              { label: '自动重置', value: true, toggle: true },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <label className="text-[#888]">{c.label}</label>
                <button onClick={() => toast.info(`${c.label} 已切换`)}
                  className={`w-10 h-5 rounded-full transition-colors ${c.value ? 'bg-purple-500' : 'bg-[#333]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-0.5 ${c.value ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
