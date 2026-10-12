import { useEffect, useState } from 'react';
import { BookmarkCheck } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import OasViewPresetToolbar from './OasViewPresetToolbar';

const moduleIds = ['PORTFOLIO-bondrisk', 'PORTFOLIO-portvr', 'PORTFOLIO-portsa', 'PORTFOLIO-report', 'PORTFOLIO-audit'];
type Selection = { selectedBuckets: string[]; startDate: string; endDate: string };

export default function OasViewPresetPanel({ moduleId }: { moduleId: string }) {
  const auth = useAuth();
  const [selection, setSelection] = useState<Selection>({ selectedBuckets: [], startDate: '', endDate: '' });
  useEffect(() => { const sync = (event: Event) => { const detail = (event as CustomEvent<Selection>).detail; if (detail && Array.isArray(detail.selectedBuckets)) setSelection({ selectedBuckets: detail.selectedBuckets.filter((value): value is string => typeof value === 'string'), startDate: typeof detail.startDate === 'string' ? detail.startDate : '', endDate: typeof detail.endDate === 'string' ? detail.endDate : '' }); }; window.addEventListener('portfolio-oas-selection-change', sync); return () => window.removeEventListener('portfolio-oas-selection-change', sync); }, []);
  if (!auth.isAuthenticated || !moduleIds.includes(moduleId)) return null;
  return <section className="mx-4 mt-4 rounded-xl border border-cyan-900/70 bg-slate-950 p-4" data-oas-view-preset-panel="true"><header className="flex items-start gap-2"><BookmarkCheck className="mt-0.5 h-4 w-4 text-cyan-300" /><div><p className="font-mono text-[10px] text-cyan-300">OAS VIEW PRESETS · ACCOUNT-SCOPED</p><h2 className="mt-1 text-sm font-semibold text-slate-100">保存 OAS 图表配置</h2><p className="mt-1 text-[10px] leading-5 text-slate-400">保存当前图表的评级桶与起止观察日。加载保存项会立即应用到上方 OAS 历史叠加图；不保存市场数据或创建样例配置。</p></div></header><OasViewPresetToolbar {...selection} onApply={(preset) => window.dispatchEvent(new CustomEvent('portfolio-oas-preset-apply', { detail: preset }))} /></section>;
}
