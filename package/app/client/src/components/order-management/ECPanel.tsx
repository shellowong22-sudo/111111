import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Users, DollarSign, TrendingUp, Settings, Bell, Shield, Globe, Server } from 'lucide-react';

const revenueData = [
  { month: 'Jan', equity: 4.2, fixed: 3.8, fx: 1.5, deriv: 2.1 },
  { month: 'Feb', equity: 4.8, fixed: 4.1, fx: 1.8, deriv: 2.4 },
  { month: 'Mar', equity: 5.6, fixed: 4.8, fx: 2.1, deriv: 2.8 },
  { month: 'Apr', equity: 5.1, fixed: 4.4, fx: 1.9, deriv: 2.5 },
  { month: 'May', equity: 5.8, fixed: 5.0, fx: 2.3, deriv: 3.1 },
  { month: 'Jun', equity: 6.2, fixed: 5.4, fx: 2.5, deriv: 3.4 },
];

const systemStatus = [
  { system: 'AIM OMS', status: 'ONLINE', uptime: '99.98%', latency: '1.2ms', load: 42 },
  { system: 'TOMS', status: 'ONLINE', uptime: '99.95%', latency: '1.8ms', load: 58 },
  { system: 'EMSX 执行', status: 'ONLINE', uptime: '100%', latency: '0.8ms', load: 35 },
  { system: 'MARS 风控', status: 'ONLINE', uptime: '99.99%', latency: '2.1ms', load: 28 },
  { system: 'FIX 网关', status: 'ONLINE', uptime: '99.97%', latency: '0.5ms', load: 65 },
  { system: '数据库集群', status: 'ONLINE', uptime: '99.99%', latency: '3.2ms', load: 48 },
  { system: '消息队列', status: 'DEGRADED', uptime: '99.82%', latency: '8.5ms', load: 88 },
  { system: '报告系统', status: 'ONLINE', uptime: '99.90%', latency: '12ms', load: 22 },
];

const userActivity = [
  { dept: '股票交易台', users: 48, active: 45, orders: 2840, revenue: 6.2 },
  { dept: '固收交易台', users: 32, active: 30, orders: 1920, revenue: 5.4 },
  { dept: '衍生品台', users: 24, active: 22, orders: 980, revenue: 3.4 },
  { dept: '外汇台', users: 18, active: 17, orders: 1240, revenue: 2.5 },
  { dept: '量化策略', users: 12, active: 12, orders: 4820, revenue: 4.8 },
  { dept: '风控合规', users: 15, active: 14, orders: 0, revenue: 0 },
];

export default function ECPanel() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'systems' | 'users' | 'revenue' | 'alerts'>('dashboard');
  const [detailSystem, setDetailSystem] = useState<string | null>(null);
  const [handledAlerts, setHandledAlerts] = useState<string[]>([]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-[#e0e0e0] font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-[#d4af37]/30">
        <div className="flex items-center gap-3">
          <span className="text-[#d4af37] font-bold text-sm">EC</span>
          <span className="text-[#888]">|</span>
          <span className="text-[#ccc]">企业主控台 — Enterprise Control Center</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded">⚠ 1 系统降级</span>
          <span className="flex items-center gap-1 text-green-400 text-[10px]"><Activity className="w-3 h-3" />LIVE</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-6 gap-0 border-b border-[#222]">
        {[
          { label: '在线用户', value: '140/149', icon: <Users className="w-3 h-3" />, color: '#4ade80' },
          { label: '今日委托', value: '11,800', icon: <Activity className="w-3 h-3" />, color: '#d4af37' },
          { label: '今日佣金', value: '$22.3M', icon: <DollarSign className="w-3 h-3" />, color: '#4ade80' },
          { label: '系统可用性', value: '99.97%', icon: <Server className="w-3 h-3" />, color: '#4ade80' },
          { label: '活跃策略', value: '28', icon: <TrendingUp className="w-3 h-3" />, color: '#60a5fa' },
          { label: '未处理告警', value: '3', icon: <Bell className="w-3 h-3" />, color: '#facc15' },
        ].map((kpi, i) => (
          <div key={i} className="px-3 py-2 border-r border-[#222] last:border-r-0">
            <div className="flex items-center gap-1 text-[#666] text-[10px] mb-0.5" style={{ color: kpi.color }}>{kpi.icon}<span className="text-[#666]">{kpi.label}</span></div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#222]">
        {[
          { id: 'dashboard', label: '总览仪表盘' },
          { id: 'systems', label: '系统状态' },
          { id: 'users', label: '用户活动' },
          { id: 'revenue', label: '收入分析' },
          { id: 'alerts', label: '告警中心' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2 text-xs transition-colors ${activeTab === t.id ? 'text-[#d4af37] border-b-2 border-[#d4af37] bg-[#d4af37]/5' : 'text-[#666] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-3">月度收入趋势 ($M)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                    <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="equity" stackId="1" stroke="#d4af37" fill="#d4af37" fillOpacity={0.3} name="股票" />
                    <Area type="monotone" dataKey="fixed" stackId="1" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} name="固收" />
                    <Area type="monotone" dataKey="fx" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.3} name="外汇" />
                    <Area type="monotone" dataKey="deriv" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.3} name="衍生品" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#111118] border border-[#222] rounded p-3">
                <div className="text-[#d4af37] font-bold mb-3">系统状态概览</div>
                <div className="space-y-2">
                  {systemStatus.slice(0, 6).map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[#888]">{s.system}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#555] text-[10px]">{s.latency}</span>
                        <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.load}%`, background: s.load > 80 ? '#f87171' : s.load > 60 ? '#facc15' : '#4ade80' }} />
                        </div>
                        <span className={`text-[10px] font-bold ${s.status === 'ONLINE' ? 'text-green-400' : 'text-yellow-400'}`}>{s.status === 'ONLINE' ? '●' : '⚠'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'systems' && (
          <div>
            <div className="text-[#d4af37] font-bold mb-3">系统健康状态</div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>
                  {['系统', '状态', '可用性', '延迟', '负载', '操作'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {systemStatus.map((s, i) => (
                  <tr key={i} className={`border-b border-[#111] hover:bg-[#1a1a2e] ${s.status === 'DEGRADED' ? 'bg-yellow-400/5' : ''}`}>
                    <td className="px-3 py-2 text-[#ccc] font-bold">{s.system}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${s.status === 'ONLINE' ? 'bg-green-400/20 text-green-400' : 'bg-yellow-400/20 text-yellow-400'}`}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2 text-[#ccc]">{s.uptime}</td>
                    <td className="px-3 py-2 text-[#ccc]">{s.latency}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-[#222] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.load}%`, background: s.load > 80 ? '#f87171' : s.load > 60 ? '#facc15' : '#4ade80' }} />
                        </div>
                        <span className={s.load > 80 ? 'text-red-400' : s.load > 60 ? 'text-yellow-400' : 'text-green-400'}>{s.load}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setDetailSystem(detailSystem === s.system ? null : s.system)} className="px-2 py-0.5 bg-[#1a1a2e] hover:bg-[#d4af37] hover:text-black text-[#888] rounded text-[10px] transition-colors">详情</button>
                    </td>
                  </tr>
                ))}
                {systemStatus.filter(s => s.system === detailSystem).map(s => (
                  <tr key={`detail-${s.system}`} className="border-b border-[#111] bg-[#111118]">
                    <td colSpan={8} className="px-3 py-2 text-[11px] text-[#ccc]">
                      {Object.entries(s).map(([key, value]) => <span key={key} className="mr-4"><span className="text-[#666]">{key}：</span>{String(value)}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="text-[#d4af37] font-bold mb-3">部门用户活动</div>
            <table className="w-full text-[11px]">
              <thead className="border-b border-[#222]">
                <tr>
                  {['部门', '总用户', '在线', '今日委托', '今日佣金($M)', '活跃率'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[#666] font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userActivity.map((u, i) => (
                  <tr key={i} className="border-b border-[#111] hover:bg-[#1a1a2e]">
                    <td className="px-3 py-2 text-[#ccc] font-bold">{u.dept}</td>
                    <td className="px-3 py-2 text-[#888]">{u.users}</td>
                    <td className="px-3 py-2 text-green-400">{u.active}</td>
                    <td className="px-3 py-2 text-[#d4af37]">{u.orders.toLocaleString()}</td>
                    <td className="px-3 py-2 text-[#ccc]">{u.revenue > 0 ? `$${u.revenue}` : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
                          <div className="h-full bg-[#d4af37] rounded-full" style={{ width: `${Math.round(u.active / u.users * 100)}%` }} />
                        </div>
                        <span className="text-[#d4af37]">{Math.round(u.active / u.users * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div>
            <div className="text-[#d4af37] font-bold mb-3">收入分析</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} unit="M" />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', fontSize: 11 }} formatter={(v: any) => `$${v}M`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="equity" fill="#d4af37" name="股票" radius={[2,2,0,0]} />
                <Bar dataKey="fixed" fill="#4ade80" name="固收" radius={[2,2,0,0]} />
                <Bar dataKey="fx" fill="#60a5fa" name="外汇" radius={[2,2,0,0]} />
                <Bar dataKey="deriv" fill="#f97316" name="衍生品" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-3">
            <div className="text-[#d4af37] font-bold mb-3">系统告警中心</div>
            {[
              { level: 'WARN', system: '消息队列', msg: '消息队列负载达 88%，接近阈值 90%，建议扩容', time: '15:45:22', action: '扩容' },
              { level: 'INFO', system: 'FIX 网关', msg: 'FIX 会话 SESSION-001 重连成功，延迟恢复正常', time: '15:32:10', action: '确认' },
              { level: 'INFO', system: 'TOMS', msg: '今日委托量超过 9000 笔，创历史新高', time: '14:58:33', action: '确认' },
            ].map((alert, i) => (
              <div key={i} className={`p-3 rounded border ${alert.level === 'WARN' ? 'border-yellow-400/30 bg-yellow-400/5' : 'border-[#222] bg-[#111118]'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold mt-0.5 ${alert.level === 'WARN' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-400/20 text-blue-400'}`}>{alert.level}</span>
                    <div>
                      <div className="text-[#d4af37] font-bold text-[11px]">{alert.system}</div>
                      <div className="text-[#888] text-[11px] mt-0.5">{alert.msg}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[#555] text-[10px]">{alert.time}</span>
                    {handledAlerts.includes(alert.msg) ? <span className="text-[10px] text-green-400">已{alert.action}</span> : <button type="button" onClick={() => setHandledAlerts(prev => [...prev, alert.msg])} className="px-2 py-0.5 bg-[#d4af37] text-black rounded text-[10px] font-bold hover:bg-[#e5c158]">{alert.action}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
