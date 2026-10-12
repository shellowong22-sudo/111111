/**
 * CT10 Govt 分析面板（微观结构与全球宏观冲击传导）
 */
import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  ComposedChart, Line, Bar as RBar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, ReferenceLine,
} from 'recharts';
import { PanelShell, Card, Metric, Badge, Bar, LoadingState, chartTooltipStyle } from './sovereign/PanelKit';

const SHOCKS = [
  { id: 'CPI_SURPRISE', label: 'CPI 超预期' },
  { id: 'FED_HAWKISH', label: '美联储鹰派' },
  { id: 'GEOPOLITICAL', label: '地缘政治' },
  { id: 'GROWTH_SHOCK', label: '增长冲击' },
];

export default function CT10Panel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('micro');
  const [shock, setShock] = useState<'CPI_SURPRISE' | 'FED_HAWKISH' | 'GEOPOLITICAL' | 'GROWTH_SHOCK'>('CPI_SURPRISE');
  const [magnitude, setMagnitude] = useState(1);

  const micro = trpc.ct10.getMicrostructure.useQuery();
  const transmission = trpc.ct10.getShockTransmission.useQuery({ shock, magnitude });
  const linkage = trpc.ct10.getAssetLinkage.useQuery();

  const tabs = [
    { id: 'micro', label: '微观结构 + 收益率分解' },
    { id: 'transmission', label: '宏观冲击传导路径' },
    { id: 'linkage', label: '全球资产联动' },
  ];

  return (
    <PanelShell ticker="CT10" title="分析 CT10 Govt" subtitle="微观结构与全球宏观冲击传导路径"
      onClose={onClose} onRefresh={() => { micro.refetch(); transmission.refetch(); linkage.refetch(); }}
      tabs={tabs} activeTab={tab} onTabChange={setTab}>

      {tab === 'micro' && (
        micro.isLoading || !micro.data ? <LoadingState /> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric label="CT10 名义收益率" value={micro.data.yieldLevel ?? '—'} unit={micro.data.yieldLevel == null ? undefined : '%'} tone="warn" />
              <Metric label="10Y 实际利率" value={micro.data.decomposition.find((item) => item.component === '实际利率')?.value ?? '—'} unit="%" tone="info" />
              <Metric label="10Y 平衡通胀" value={micro.data.decomposition.find((item) => item.component === '通胀预期')?.value ?? '—'} unit="%" tone="pos" />
              <Metric label="10Y 国债期货" value={micro.data.futures?.price ?? '—'} tone="neutral" />
            </div>
            <Card title="名义收益率、实际利率与平衡通胀">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={micro.data.decompositionHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} minTickGap={28} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} domain={['auto', 'auto']} />
                  <Tooltip {...chartTooltipStyle()} />
                  <Line dataKey="nominal" name="名义 10Y" stroke="#f59e0b" dot={false} connectNulls />
                  <Line dataKey="real" name="实际 10Y" stroke="#22d3ee" dot={false} connectNulls />
                  <Line dataKey="breakeven" name="平衡通胀" stroke="#34d399" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card title="最新口径分解">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={micro.data.decomposition} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" tick={{ fill: '#475569', fontSize: 9 }} />
                    <YAxis type="category" dataKey="component" tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
                    <Tooltip {...chartTooltipStyle()} />
                    <RBar dataKey="value" name="收益率水平(%)">
                      {micro.data.decomposition.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                    </RBar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card title="10Y 国债期货价格与成交量">
                {micro.data.futures?.history?.length ? <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={micro.data.futures.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} minTickGap={24} />
                    <YAxis yAxisId="price" tick={{ fill: '#475569', fontSize: 9 }} domain={['auto', 'auto']} />
                    <YAxis yAxisId="volume" orientation="right" hide />
                    <Tooltip {...chartTooltipStyle()} />
                    <RBar yAxisId="volume" dataKey="volume" name="成交量" fill="#334155" />
                    <Line yAxisId="price" dataKey="value" name="期货价格" stroke="#a78bfa" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer> : <div className="grid h-[200px] place-items-center text-[11px] text-slate-500">公开期货序列未返回，不以委托流曲线填充。</div>}
              </Card>
            </div>
            <Card title="数据权限边界"><p className="text-[11px] leading-5 text-slate-300">{micro.data.methodology}</p><p className="mt-2 text-[10px] text-amber-300">未授权字段：{micro.data.unavailableFields.join('、')}。</p></Card>
          </div>
        )
      )}

      {tab === 'transmission' && (
        transmission.isLoading || !transmission.data ? <LoadingState /> : (
          <div className="space-y-3">
            <Card title="冲击场景设定">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">冲击类型</label>
                  <div className="flex flex-wrap gap-1">
                    {SHOCKS.map(s => (
                      <button key={s.id} onClick={() => setShock(s.id as any)}
                        className={`px-2 py-1 text-[10px] rounded border transition-colors ${shock === s.id ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">冲击幅度（σ）：{magnitude.toFixed(1)}</label>
                  <input type="range" min={-3} max={3} step={0.5} value={magnitude} onChange={e => setMagnitude(Number(e.target.value))} className="w-full accent-amber-500" />
                </div>
              </div>
            </Card>
            <Card title="用户情景传导路径（冲击 → CT10 → 多市场）">
              <div className="space-y-2">
                {transmission.data.path.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-32 text-[11px] text-slate-300 shrink-0">{p.node}</div>
                    <Badge tone="info">{p.horizon}</Badge>
                    <div className="flex-1"><Bar value={Math.abs(p.impact)} max={Math.max(20, Math.abs(p.impact))} tone="warn" /></div>
                    <span className={`text-[11px] tabular-nums w-20 text-right ${p.impact >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>{p.impact >= 0 ? '+' : ''}{p.impact}{p.unit}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="非线性响应曲线（冲击幅度 → 收益率响应）">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={transmission.data.nonlinear}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="magnitude" tick={{ fill: '#475569', fontSize: 9 }} label={{ value: '冲击(σ)', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 9 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} label={{ value: 'bps', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 9 }} />
                  <Tooltip {...chartTooltipStyle()} />
                  <ReferenceLine x={0} stroke="#475569" /><ReferenceLine y={0} stroke="#475569" />
                  <Line dataKey="yieldResponse" stroke="#f59e0b" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="情景口径"><p className="text-[11px] leading-5 text-slate-300">{transmission.data.methodology}</p></Card>
          </div>
        )
      )}

      {tab === 'linkage' && (
        linkage.isLoading || !linkage.data ? <LoadingState /> : (
          <div className="space-y-3">
            <Card title="CT10 异动 → 全球资产联动预警">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-left">
                      <th className="py-1.5 pr-2">资产</th><th className="pr-2">代码</th>
                      <th className="pr-2 text-right">Beta</th><th className="pr-2 text-right">相关性</th><th className="text-right">联动状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkage.data.linkages.map((l: any) => (
                      <tr key={l.symbol} className="border-b border-slate-800/50">
                        <td className="py-1.5 pr-2 text-slate-200">{l.asset}</td>
                        <td className="pr-2 text-slate-400">{l.symbol}</td>
                        <td className={`pr-2 text-right tabular-nums ${l.beta == null ? 'text-slate-600' : l.beta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{l.beta ?? '—'}</td>
                        <td className={`pr-2 text-right tabular-nums ${l.corr != null && Math.abs(l.corr) > 0.7 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>{l.corr ?? '—'}</td>
                        <td className="text-right"><Badge tone={l.alert.includes('强') ? 'neg' : l.alert.includes('中') ? 'warn' : 'info'}>{l.alert}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="样本口径与时点核对"><p className="text-[11px] leading-5 text-slate-300">{linkage.data.methodology}</p><div className="mt-2 grid gap-1 text-[10px] text-slate-500">{linkage.data.linkages.map((item) => <span key={item.symbol}>{item.symbol} · 共同样本 {item.observations} · 最近观测 {item.lastObservedAt ?? '未返回'}</span>)}</div></Card>
          </div>
        )
      )}
    </PanelShell>
  );
}
