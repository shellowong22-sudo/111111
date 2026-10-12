import { useRef } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/sovereign/PanelKit';
import ExportMenu from '@/components/ExportMenu';

export type BondRiskScenario = 'parallel' | 'steepener' | 'butterfly';

export type BondRiskAnalysis = {
  totalPnl: number;
  rows: Array<{ identifier: string; maturityYears: number; appliedShiftBp: number; estimatedPnl: number; dv01: number }>;
};

type Props = { selectedScenario: BondRiskScenario; selectedAnalysis: BondRiskAnalysis; analyses: Partial<Record<BondRiskScenario, BondRiskAnalysis>> };

const labels: Record<BondRiskScenario, string> = { parallel: '平行移位', steepener: '曲线陡峭化', butterfly: '蝶式变动' };
const colors: Record<BondRiskScenario, string> = { parallel: '#22d3ee', steepener: '#fbbf24', butterfly: '#c084fc' };
const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export default function BondRiskScenarioCharts({ selectedScenario, selectedAnalysis, analyses }: Props) {
  const exportRef = useRef<HTMLDivElement>(null);
  const scenarioData = (Object.keys(labels) as BondRiskScenario[]).flatMap((key) => analyses[key] ? [{ scenario: labels[key], estimatedPnl: analyses[key]!.totalPnl }] : []);
  const curveData = [...selectedAnalysis.rows].sort((a, b) => a.maturityYears - b.maturityYears).map((row) => ({ maturity: `${row.maturityYears.toFixed(2)}Y`, appliedShiftBp: Number(row.appliedShiftBp.toFixed(2)) }));
  const positionData = [...selectedAnalysis.rows].sort((a, b) => Math.abs(b.estimatedPnl) - Math.abs(a.estimatedPnl)).map((row) => ({ identifier: row.identifier, estimatedPnl: Math.round(row.estimatedPnl), dv01: Math.round(row.dv01) }));

  return <Card title="3. 利率情景风险图表"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><p className="max-w-3xl text-[10px] leading-5 text-slate-500">所有图表均由本次导入持仓、所选冲击幅度和同一套久期—凸性近似实时计算；不会显示示例持仓或预测价格。</p><ExportMenu filename={`bond-risk-${selectedScenario}-scenario`} targetRef={exportRef} /></div><div ref={exportRef} className="bg-[#0a0a0f] p-2"><div className="mb-3 border-b border-slate-800 pb-2 text-[11px] text-cyan-300">BOND RISK · {labels[selectedScenario]} · 导出时间 {new Date().toLocaleString()}</div><div className="grid gap-3 xl:grid-cols-2"><div className="min-h-64 rounded border border-slate-800 bg-slate-950/30 p-2"><p className="mb-2 text-[10px] text-cyan-300">三类情景组合估计损益</p><ResponsiveContainer width="100%" height={220}><BarChart data={scenarioData}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="scenario" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={62} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} /><Bar dataKey="estimatedPnl" name="估计 P&L" fill="#22d3ee" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="min-h-64 rounded border border-slate-800 bg-slate-950/30 p-2"><p className="mb-2 text-[10px] text-cyan-300">{labels[selectedScenario]}：期限实际适用冲击</p><ResponsiveContainer width="100%" height={220}><LineChart data={curveData}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="maturity" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit=" bp" width={55} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} /><Line type="monotone" dataKey="appliedShiftBp" name="适用冲击" stroke={colors[selectedScenario]} strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div className="min-h-64 rounded border border-slate-800 bg-slate-950/30 p-2 xl:col-span-2"><p className="mb-2 text-[10px] text-cyan-300">{labels[selectedScenario]}：持仓估计损益与 DV01</p><ResponsiveContainer width="100%" height={220}><BarChart data={positionData} layout="vertical" margin={{ left: 12 }}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis type="category" dataKey="identifier" width={100} tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value) => money(Number(value))} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="estimatedPnl" name="估计 P&L" fill="#a78bfa" radius={[0, 3, 3, 0]} /><Bar dataKey="dv01" name="DV01" fill="#38bdf8" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></div></div></Card>;
}
