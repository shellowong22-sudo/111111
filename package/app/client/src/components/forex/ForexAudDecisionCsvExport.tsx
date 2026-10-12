import { Download } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { buildAudDecisionComparisonCsv } from '@/lib/forexDecisionCsv';
import { Card, LoadingState, Metric } from '@/components/sovereign/PanelKit';

export default function ForexAudDecisionCsvExport() {
  const comparison = trpc.forexResearch.getCurrencyDecisionComparison.useQuery({ currency: 'AUD' }, { staleTime: 60_000, retry: 1 });
  const download = () => { if (!comparison.data?.reading || !comparison.data.rows.length) return; const blob = new Blob([buildAudDecisionComparisonCsv(comparison.data)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `AUD_RBA_decision_windows_${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  return <Card title="FX AUD EXPORT · 澳元多事件窗口 CSV"><div className="flex flex-wrap items-end justify-between gap-3"><div className="flex gap-2"><Metric label="实际 RBA 事件" value={comparison.data?.rows.length ?? '—'} sub="仅已归档且具有公开窗口的事件" tone="info" /><Metric label="导出序列" value={comparison.data?.reading?.id ?? '—'} sub={comparison.data?.reading?.unit ?? '实际公开观察'} tone="info" /></div><button onClick={download} disabled={comparison.isLoading || !comparison.data?.reading || !comparison.data.rows.length} className="inline-flex items-center gap-1.5 rounded border border-cyan-700 bg-cyan-950/30 px-3 py-1.5 text-xs text-cyan-100 transition-colors hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-3.5 w-3.5" />导出 AUD 事件窗口 CSV</button></div>{comparison.isLoading ? <LoadingState text="正在准备 AUD 实际事件窗口导出…" /> : !comparison.data?.reading ? <p className="mt-3 rounded border border-slate-800 p-3 text-xs text-slate-400">当前没有可导出的 AUD 公开窗口；终端不会生成空白或示例文件。</p> : <p className="mt-3 text-[10px] text-slate-500">导出包含决议字段、前后最近实际观察、窗口读数变化、相对决议日、实际读数、归一化读数、FRED/H.10 序列标识与数据边界；不含预测、归因或可执行报价。</p>}</Card>;
}
