import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { PanelShell, Card, Metric, LoadingState, chartTooltipStyle } from './sovereign/PanelKit';
import { useSovereignStream } from '@/hooks/useSovereignStream';
import { Download, FileCheck2, Trash2 } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type SourceRecord = { id: string; date: string; jurisdiction: string; source: string; period: string; scope: string; verified: boolean };
type Macro = { iso2: string; year: number; debtGdpPct: number | null; currentAccountPct: number | null; history?: { debtGdpPct?: Array<{ year: number; value: number }> } };
type RateRecord = Record<string, { latest?: number | null; data?: Array<{ date: string; value: number }> }>;
const countries = ['US', 'DE', 'JP', 'GB', 'FR', 'IT', 'CN', 'IN'] as const;
const names: Record<string, string> = { US: '美国', DE: '德国', JP: '日本', GB: '英国', FR: '法国', IT: '意大利', CN: '中国', IN: '印度' };
const storageKey = 'finance-hub:debt-ownership-sources';
const restore = (): SourceRecord[] => { try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : []; } catch { return []; } };

function saveCsv(rows: SourceRecord[]) {
  const data = [['recorded_at', 'jurisdiction', 'official_source', 'reference_period', 'coverage_scope'], ...rows.map((row) => [row.date, row.jurisdiction, row.source, row.period, row.scope])];
  const url = URL.createObjectURL(new Blob([data.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `ownership-register-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

export default function DEBTPanel({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState('sources');
  const [records, setRecords] = useState<SourceRecord[]>(restore);
  const [selectedCountry, setSelectedCountry] = useState('US');
  const [jurisdiction, setJurisdiction] = useState('美国');
  const [source, setSource] = useState(''); const [period, setPeriod] = useState(''); const [scope, setScope] = useState(''); const [verified, setVerified] = useState(false);
  const macro = trpc.sovereignBonds.getSovereignMacro.useQuery({ countries: [...countries] }, { refetchOnWindowFocus: true, refetchInterval: 120_000 });
  const rates = trpc.sovereignBonds.getMultipleRateSeries.useQuery({ series: ['DGS2', 'DGS10', 'SOFR'] }, { refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const stream = useSovereignStream(10, 5);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(records)); }, [records]);
  const data = macro.data?.data as Record<string, Macro> | undefined;
  const selected = data?.[selectedCountry];
  const rateData = rates.data?.data as RateRecord | undefined;
  const selectedRecords = useMemo(() => records.filter((record) => record.jurisdiction === names[selectedCountry]), [records, selectedCountry]);
  const debtHistory = useMemo(() => (selected?.history?.debtGdpPct ?? []).map((point) => ({ year: point.year, debtGdpPct: point.value })), [selected]);
  const disclosureProgress = useMemo(() => records.slice().reverse().map((record, index) => ({ date: record.date.slice(0, 10), count: index + 1 })), [records]);
  const macroRows = useMemo(() => countries.flatMap((country) => {
    const row = data?.[country];
    return row?.debtGdpPct != null || row?.currentAccountPct != null ? [{ country, name: names[country], debtGdpPct: row?.debtGdpPct ?? null, currentAccountPct: row?.currentAccountPct ?? null, year: row?.year ?? null }] : [];
  }), [data]);
  const coverageRows = useMemo(() => countries.map((country) => {
    const countryRecords = records.filter((record) => record.jurisdiction === names[country]);
    return { country, name: names[country], debtGdpPct: data?.[country]?.debtGdpPct ?? null, currentAccountPct: data?.[country]?.currentAccountPct ?? null, batches: countryRecords.length, latestPeriod: countryRecords[0]?.period ?? '—' };
  }), [data, records]);
  const curveHistory = useMemo(() => {
    const twoMap = new Map((rateData?.DGS2?.data ?? []).map((point) => [point.date, point.value]));
    return (rateData?.DGS10?.data ?? []).flatMap((point) => {
      const two = twoMap.get(point.date);
      return typeof two === 'number' && Number.isFinite(two) ? [{ date: point.date, slopeBp: Number(((point.value - two) * 100).toFixed(2)) }] : [];
    }).slice(-126);
  }, [rateData]);
  const debtTrend = debtHistory.map((point) => point.debtGdpPct);
  const twoYear = stream.latest?.rates.DGS2 ?? rateData?.DGS2?.latest;
  const tenYear = stream.latest?.rates.DGS10 ?? rateData?.DGS10?.latest;
  const addRecord = () => {
    if (!source.trim() || !period.trim() || !scope.trim() || !verified) return;
    setRecords((current) => [{ id: crypto.randomUUID(), date: new Date().toISOString(), jurisdiction, source: source.trim(), period: period.trim(), scope: scope.trim(), verified }, ...current]);
    setSource(''); setPeriod(''); setScope(''); setVerified(false);
  };
  const tabs = [{ id: 'sources', label: '披露底账' }, { id: 'framework', label: '债务背景' }, { id: 'register', label: `来源登记 (${records.length})` }];
  const loading = macro.isLoading || rates.isLoading;
  const error = macro.error ?? rates.error;

  return <PanelShell ticker="DEBT" title="主权债所有权核验" subtitle="持有人披露底账、口径覆盖与可追溯债务背景" onClose={onClose ?? (() => undefined)} onRefresh={() => { macro.refetch(); rates.refetch(); }} tabs={tabs} activeTab={tab} onTabChange={setTab}>
    {loading ? <LoadingState /> : error ? <Card title="所有权数据暂不可用"><p className="text-[11px] text-amber-300">{error.message}</p></Card> : <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">{countries.map((country) => <button key={country} type="button" onClick={() => { setSelectedCountry(country); setJurisdiction(names[country]); }} className={`rounded border px-2 py-1 text-[9px] ${selectedCountry === country ? 'border-teal-600 bg-teal-950/30 text-teal-200' : 'border-slate-800 text-slate-500'}`}>{names[country]}</button>)}<span className={`ml-auto self-center text-[9px] ${stream.connected ? 'text-emerald-300' : 'text-amber-300'}`}>{stream.connected ? '利率观测通道已连接' : '保留最近有效观测'}</span></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Metric label="已核验披露批次" value={selectedRecords.length} trend={disclosureProgress.map((row) => row.count)} tone="info" /><Metric label="最新披露统计期" value={selectedRecords[0]?.period ?? '—'} tone="neutral" /><Metric label="政府债务占 GDP" value={selected?.debtGdpPct == null ? '—' : `${selected.debtGdpPct.toFixed(1)}%`} trend={debtTrend} tone="warn" /><Metric label="2s10s 再融资坡度" value={twoYear == null || tenYear == null ? '—' : `${((tenYear - twoYear) * 100).toFixed(1)} bp`} trend={curveHistory.map((row) => row.slopeBp)} tone="info" /></div>
      {tab === 'sources' && <div className="grid gap-3 xl:grid-cols-[.85fr_1.15fr]"><Card title={`${names[selectedCountry]} 持有人披露底账`}>{selectedRecords.length ? <div className="max-h-[270px] overflow-auto"><table className="w-full text-[9px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-1.5">统计期</th><th>覆盖口径</th><th>核验文件</th></tr></thead><tbody>{selectedRecords.map((record) => <tr key={record.id} className="border-b border-slate-800/60"><td className="p-1.5 font-mono text-teal-300">{record.period}</td><td className="text-slate-300">{record.scope}</td><td className="break-all text-slate-500">{record.source}</td></tr>)}</tbody></table></div> : <div className="grid h-[270px] place-items-center px-6 text-center text-[10px] leading-5 text-slate-500">尚未登记可核验的持有人披露文件；系统不以债务率、经常账户或行情帧推算持有人份额。</div>}</Card><Card title={`${names[selectedCountry]} 政府债务率历史`}>{debtHistory.length > 1 ? <ResponsiveContainer width="100%" height={270}><LineChart data={debtHistory}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 8 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip {...chartTooltipStyle()} /><Line dataKey="debtGdpPct" name="债务/GDP %" stroke="#2dd4bf" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer> : <div className="grid h-[270px] place-items-center text-[10px] text-slate-600">该国家暂未返回两个以上可比较年度</div>}</Card></div>}
      {tab === 'framework' && <div className="grid gap-3 xl:grid-cols-[1.2fr_.8fr]"><Card title="跨国债务与经常账户对照"><ResponsiveContainer width="100%" height={290}><BarChart data={macroRows}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 8 }} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip {...chartTooltipStyle()} /><Bar dataKey="debtGdpPct" name="政府债务/GDP %" fill="#2dd4bf" /><Bar dataKey="currentAccountPct" name="经常账户/GDP %" fill="#f59e0b" /></BarChart></ResponsiveContainer></Card><Card title="披露覆盖矩阵"><div className="max-h-[290px] overflow-auto"><table className="w-full text-[9px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-1.5">国家</th><th className="text-right">债务率</th><th className="text-right">经常账户</th><th className="text-right">批次</th><th className="text-right">最新期</th></tr></thead><tbody>{coverageRows.map((row) => <tr key={row.country} onClick={() => setSelectedCountry(row.country)} className="cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/30"><td className="p-1.5 text-cyan-300">{row.name}</td><td className="text-right font-mono text-slate-300">{row.debtGdpPct == null ? '—' : `${row.debtGdpPct.toFixed(1)}%`}</td><td className="text-right font-mono text-slate-300">{row.currentAccountPct == null ? '—' : `${row.currentAccountPct.toFixed(1)}%`}</td><td className="text-right font-mono text-teal-300">{row.batches}</td><td className="text-right font-mono text-slate-400">{row.latestPeriod}</td></tr>)}</tbody></table></div></Card></div>}
      {tab === 'register' && <><Card title="披露来源登记"><div className="grid gap-2 md:grid-cols-2"><label className="text-[10px] text-slate-500">司法辖区<select value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} className="terminal-ledger-input mt-1 w-full">{countries.map((country) => <option key={country}>{names[country]}</option>)}</select></label><label className="text-[10px] text-slate-500">文件或地址<input value={source} onChange={(event) => setSource(event.target.value)} className="terminal-ledger-input mt-1 w-full" /></label><label className="text-[10px] text-slate-500">统计期<input value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="2026Q2" className="terminal-ledger-input mt-1 w-full" /></label><label className="text-[10px] text-slate-500">覆盖口径<input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="持有人、期限、面值口径" className="terminal-ledger-input mt-1 w-full" /></label></div><label className="mt-3 flex items-center gap-2 text-[10px] text-slate-300"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />完成口径复核</label><button type="button" disabled={!source.trim() || !period.trim() || !scope.trim() || !verified} onClick={addRecord} className="mt-3 inline-flex items-center gap-1 rounded border border-teal-700 bg-teal-950 px-2 py-1 text-[10px] text-teal-200 disabled:opacity-40"><FileCheck2 className="h-3.5 w-3.5" />保存披露批次</button></Card>{records.length ? <><div className="flex justify-end gap-2"><button type="button" onClick={() => saveCsv(records)} className="inline-flex items-center gap-1 text-[10px] text-cyan-300"><Download className="h-3.5 w-3.5" />导出登记</button><button type="button" onClick={() => setRecords([])} className="inline-flex items-center gap-1 text-[10px] text-rose-300"><Trash2 className="h-3.5 w-3.5" />清空</button></div><div className="overflow-x-auto"><table className="w-full text-[10px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-2">时间</th><th>辖区</th><th>文件</th><th>统计期</th><th>覆盖</th></tr></thead><tbody>{records.map((row) => <tr key={row.id} className="border-b border-slate-800/60"><td className="p-2 font-mono text-slate-500">{new Date(row.date).toLocaleString()}</td><td className="text-teal-300">{row.jurisdiction}</td><td className="text-slate-300">{row.source}</td><td className="text-slate-400">{row.period}</td><td className="text-slate-400">{row.scope}</td></tr>)}</tbody></table></div></> : <Card><p className="text-[11px] text-slate-500">登记首个持有人披露批次后，可在这里查看版本并导出。</p></Card>}</>}
    </div>}
  </PanelShell>;
}
