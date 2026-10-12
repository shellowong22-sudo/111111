import { useMemo, useState } from 'react';
import { Calculator, Download, X } from 'lucide-react';
import type { SelectedCurve } from '@/lib/crvfData';

type CurveWorkflow = 'forward' | 'spread' | 'cash';

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(quote).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CurveWorkflowWorkbench({ workflow, selected, onClose }: { workflow: CurveWorkflow; selected: SelectedCurve[]; onClose: () => void }) {
  const [spot, setSpot] = useState('100');
  const [forward, setForward] = useState('101');
  const [years, setYears] = useState('1');
  const [baseYield, setBaseYield] = useState('4.25');
  const [compareYield, setCompareYield] = useState('3.90');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const forwardCarry = useMemo(() => {
    const s = Number(spot); const f = Number(forward); const t = Number(years);
    return s > 0 && f > 0 && t > 0 ? ((f / s - 1) / t) * 100 : undefined;
  }, [spot, forward, years]);
  const spreadBp = useMemo(() => {
    const first = Number(baseYield); const second = Number(compareYield);
    return Number.isFinite(first) && Number.isFinite(second) ? (first - second) * 100 : undefined;
  }, [baseYield, compareYield]);

  const title = workflow === 'forward' ? 'FWCV · 远期收益率输入' : workflow === 'spread' ? 'ICVS · 曲线利差输入' : 'YCDF · 现金曲线快照';
  const subtitle = workflow === 'forward'
    ? '以录入的现货、远期与期限计算年化隐含 carry；不会生成或假设市场报价。'
    : workflow === 'spread'
      ? '以两条录入的收益率计算基点差，便于研究底稿和期限比较。'
      : '将当前已选曲线和观察日期导出为可审计的现金曲线设定快照。';

  return <section className="border-b border-[#1c4d8f] bg-[#091324] px-3 py-2 text-xs text-slate-200">
    <div className="mb-2 flex items-center justify-between"><div><span className="font-semibold text-[#f5a623]">{title}</span><span className="ml-2 text-slate-400">{subtitle}</span></div><button type="button" onClick={onClose} aria-label="关闭曲线工作流" className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button></div>
    {workflow === 'forward' && <div className="grid grid-cols-4 gap-2"><label>现货<input value={spot} onChange={event => setSpot(event.target.value)} type="number" step="any" className="mt-1 w-full border border-slate-600 bg-slate-900 px-2 py-1" /></label><label>远期<input value={forward} onChange={event => setForward(event.target.value)} type="number" step="any" className="mt-1 w-full border border-slate-600 bg-slate-900 px-2 py-1" /></label><label>期限（年）<input value={years} onChange={event => setYears(event.target.value)} type="number" min="0.01" step="any" className="mt-1 w-full border border-slate-600 bg-slate-900 px-2 py-1" /></label><div className="rounded border border-slate-700 bg-slate-900 p-2"><div className="text-slate-500">年化 carry</div><div className="mt-1 font-semibold text-emerald-400">{forwardCarry === undefined ? '请输入有效数值' : `${forwardCarry.toFixed(4)}%`}</div></div></div>}
    {workflow === 'spread' && <div className="grid grid-cols-3 gap-2"><label>曲线 A 收益率（%）<input value={baseYield} onChange={event => setBaseYield(event.target.value)} type="number" step="any" className="mt-1 w-full border border-slate-600 bg-slate-900 px-2 py-1" /></label><label>曲线 B 收益率（%）<input value={compareYield} onChange={event => setCompareYield(event.target.value)} type="number" step="any" className="mt-1 w-full border border-slate-600 bg-slate-900 px-2 py-1" /></label><div className="rounded border border-slate-700 bg-slate-900 p-2"><div className="text-slate-500">A − B</div><div className="mt-1 font-semibold text-amber-300">{spreadBp === undefined ? '请输入有效数值' : `${spreadBp.toFixed(2)} bp`}</div></div></div>}
    {workflow === 'cash' && <div className="flex items-end gap-2"><label className="w-44">观察日期<input value={asOf} onChange={event => setAsOf(event.target.value)} type="date" className="mt-1 w-full border border-slate-600 bg-slate-900 px-2 py-1" /></label><div className="text-slate-400">已选 {selected.length} 条曲线</div><button type="button" onClick={() => downloadCsv(`cash-curve-config-${asOf}.csv`, ['观察日期', '曲线ID', '曲线名称', '国家/地区', '货币', '类型'], selected.map(curve => [asOf, curve.id, curve.name, curve.country, curve.currency, curve.type]))} disabled={!selected.length} className="flex items-center gap-1 rounded bg-[#1c4d8f] px-3 py-1.5 text-white disabled:opacity-50"><Download className="h-3.5 w-3.5" />导出设定</button></div>}
    {workflow !== 'cash' && <button type="button" onClick={() => workflow === 'forward' && forwardCarry !== undefined ? downloadCsv('forward-carry-input.csv', ['现货', '远期', '期限年', '年化carry%'], [[spot, forward, years, forwardCarry]]) : workflow === 'spread' && spreadBp !== undefined ? downloadCsv('curve-spread-input.csv', ['曲线A收益率%', '曲线B收益率%', '利差bp'], [[baseYield, compareYield, spreadBp]]) : undefined} className="mt-2 flex items-center gap-1 rounded bg-[#1c4d8f] px-3 py-1.5 text-white"><Calculator className="h-3.5 w-3.5" />导出计算结果</button>}
  </section>;
}
