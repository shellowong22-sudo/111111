import { useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FolderOpen, LogIn, Save, Trash2, Upload } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Card, LoadingState } from '@/components/sovereign/PanelKit';
import { BondPositionInput, importBondPortfolioRows, inspectBondPortfolioCsv } from '@/lib/bondPortfolioCsv';

type Scenario = 'parallel' | 'steepener' | 'butterfly';
type Analysis = { rows: Array<{ identifier: string; maturityYears: number; yieldToMaturity: number; appliedShiftBp: number }> };
type Snapshot = { id: number; name: string; positions: BondPositionInput[]; magnitudeBp: number; updatedAt: Date };
const scenarioMeta: Array<{ id: Scenario; label: string; color: string }> = [{ id: 'parallel', label: '平行移位', color: '#22d3ee' }, { id: 'steepener', label: '曲线陡峭化', color: '#fbbf24' }, { id: 'butterfly', label: '蝶式变动', color: '#c084fc' }];

export default function PortfolioBondCurveComparison() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [positions, setPositions] = useState<BondPositionInput[]>([]);
  const [message, setMessage] = useState('上传自己的债券 CSV 后才绘制收益率曲线；不会使用示例持仓。');
  const [magnitudeBp, setMagnitudeBp] = useState(50);
  const [snapshotName, setSnapshotName] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const snapshots = trpc.bondPortfolio.snapshots.useQuery(undefined, { enabled: auth.isAuthenticated, refetchOnWindowFocus: false });
  const saveSnapshot = trpc.bondPortfolio.saveSnapshot.useMutation({ onSuccess: async (snapshot) => { await utils.bondPortfolio.snapshots.invalidate(); setSelectedSnapshotId(snapshot?.id ?? null); setSnapshotName(snapshot?.name ?? ''); setMessage('已保存当前账户私有情景快照。'); } });
  const deleteSnapshot = trpc.bondPortfolio.deleteSnapshot.useMutation({ onSuccess: async () => { await utils.bondPortfolio.snapshots.invalidate(); setSelectedSnapshotId(null); setSnapshotName(''); setMessage('已删除选中的账户私有情景快照。'); } });
  const parallel = trpc.bondPortfolio.analyze.useQuery({ positions, scenario: 'parallel', magnitudeBp }, { enabled: auth.isAuthenticated && positions.length > 0, refetchOnWindowFocus: false });
  const steepener = trpc.bondPortfolio.analyze.useQuery({ positions, scenario: 'steepener', magnitudeBp }, { enabled: auth.isAuthenticated && positions.length > 0, refetchOnWindowFocus: false });
  const butterfly = trpc.bondPortfolio.analyze.useQuery({ positions, scenario: 'butterfly', magnitudeBp }, { enabled: auth.isAuthenticated && positions.length > 0, refetchOnWindowFocus: false });
  const curves = useMemo(() => {
    const analyses: Partial<Record<Scenario, Analysis>> = { parallel: parallel.data as Analysis | undefined, steepener: steepener.data as Analysis | undefined, butterfly: butterfly.data as Analysis | undefined };
    const base = analyses.parallel?.rows ?? [];
    return [...base].sort((a, b) => a.maturityYears - b.maturityYears || a.identifier.localeCompare(b.identifier)).map((row) => {
      const point: Record<string, string | number> = { maturity: `${row.maturityYears.toFixed(2)}Y`, base: Number(row.yieldToMaturity.toFixed(4)) };
      for (const meta of scenarioMeta) { const target = analyses[meta.id]?.rows.find((item) => item.identifier === row.identifier); if (target) point[meta.id] = Number((target.yieldToMaturity + target.appliedShiftBp / 100).toFixed(4)); }
      return point;
    });
  }, [parallel.data, steepener.data, butterfly.data]);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const inspection = inspectBondPortfolioCsv(await file.text()); const result = importBondPortfolioRows(inspection, inspection.mapping);
    if (result.missingFields.length || !result.positions.length) { setPositions([]); setMessage(`无法使用自动映射导入：${result.missingFields.length ? '缺少必填字段' : '没有有效持仓'}。请在原 BOND RISK 工作区确认字段映射后再上传相同格式。`); return; }
    setPositions(result.positions); setSelectedSnapshotId(null); setSnapshotName(''); setMessage(`本次仅在浏览器会话中读取 ${result.positions.length} 条有效持仓；${result.errors.length} 条未进入曲线。`);
  };
  const availableSnapshots = (snapshots.data ?? []) as Snapshot[];
  const loadSnapshot = (id: number) => {
    const snapshot = availableSnapshots.find((item) => item.id === id); if (!snapshot) return;
    setPositions(snapshot.positions); setMagnitudeBp(snapshot.magnitudeBp); setSnapshotName(snapshot.name); setSelectedSnapshotId(snapshot.id); setMessage(`已载入“${snapshot.name}”的 ${snapshot.positions.length} 条账户私有持仓映射与冲击参数。`);
  };
  if (auth.loading) return <LoadingState />;
  if (!auth.isAuthenticated) return <Card title="利率情景收益率曲线 · 登录后可用"><p className="text-[10px] leading-5 text-slate-500">仅使用登录账户主动上传的债券持仓和明确的冲击幅度绘图；系统不保存文件，也不显示示例曲线。</p><button type="button" onClick={() => { window.location.href = getLoginUrl(); }} className="mt-2 inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[10px] text-cyan-200"><LogIn className="h-3.5 w-3.5" />登录并上传</button></Card>;
  const loading = positions.length > 0 && (parallel.isLoading || steepener.isLoading || butterfly.isLoading);
  return <Card title="BOND RISK · 利率情景收益率曲线对比"><div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-1 rounded border border-cyan-800 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-200"><Upload className="h-3.5 w-3.5" />上传债券 CSV<input type="file" accept=".csv,text/csv" onChange={upload} className="hidden" /></label><label className="text-[10px] text-slate-500">冲击幅度（bp）<input type="number" min="-500" max="500" value={magnitudeBp} onChange={(event) => setMagnitudeBp(Math.max(-500, Math.min(500, Number(event.target.value) || 0)))} className="terminal-ledger-input ml-2 w-20" /></label></div><div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-950/30 p-2"><FolderOpen className="h-3.5 w-3.5 text-cyan-300" /><select value={selectedSnapshotId ?? ''} onChange={(event) => event.target.value ? loadSnapshot(Number(event.target.value)) : setSelectedSnapshotId(null)} className="terminal-ledger-input min-w-36"><option value="">载入已保存情景…</option>{availableSnapshots.map((snapshot) => <option value={snapshot.id} key={snapshot.id}>{snapshot.name}</option>)}</select><input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} maxLength={120} placeholder="情景快照名称" className="terminal-ledger-input min-w-36 flex-1" /><button type="button" disabled={!positions.length || !snapshotName.trim() || saveSnapshot.isPending} onClick={() => saveSnapshot.mutate({ ...(selectedSnapshotId ? { id: selectedSnapshotId } : {}), name: snapshotName, positions, magnitudeBp })} className="inline-flex items-center gap-1 rounded border border-emerald-700 px-2 py-1 text-[10px] text-emerald-200 disabled:opacity-40"><Save className="h-3.5 w-3.5" />{selectedSnapshotId ? '覆盖保存' : '保存快照'}</button><button type="button" disabled={!selectedSnapshotId || deleteSnapshot.isPending} onClick={() => selectedSnapshotId && deleteSnapshot.mutate({ id: selectedSnapshotId })} className="inline-flex items-center gap-1 rounded border border-rose-800 px-2 py-1 text-[10px] text-rose-200 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />删除</button></div><p className="mt-2 text-[10px] leading-5 text-slate-500">{message} 快照仅保存当前登录账户主动导入的标准化持仓映射和明确冲击参数，不保存 CSV 文件；三条情景曲线不代表可交易市场曲线。</p>{loading ? <LoadingState /> : positions.length && curves.length ? <div className="mt-3 h-72 rounded border border-slate-800 bg-slate-950/30 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={curves}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="maturity" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" width={52} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value) => `${Number(value).toFixed(4)}%`} /><Legend wrapperStyle={{ fontSize: 10 }} /><Line type="monotone" dataKey="base" name="导入到期收益率" stroke="#e2e8f0" strokeWidth={2} dot={{ r: 3 }} />{scenarioMeta.map((meta) => <Line key={meta.id} type="monotone" dataKey={meta.id} name={meta.label} stroke={meta.color} strokeWidth={2} dot={{ r: 3 }} />)}</LineChart></ResponsiveContainer></div> : <div className="mt-3 rounded border border-slate-800 bg-slate-950/30 p-3 text-[10px] text-slate-500">等待实际导入持仓。曲线不会因无持仓或未通过字段校验而显示模拟数据。</div>}</Card>;
}
