import { BookmarkPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

type OasPreset = { id: number; name: string; selectedBuckets: unknown; startDate: string | null; endDate: string | null };

export default function OasViewPresetToolbar({ selectedBuckets, startDate, endDate, onApply }: { selectedBuckets: string[]; startDate: string; endDate: string; onApply: (preset: { selectedBuckets: string[]; startDate: string; endDate: string }) => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const presets = trpc.portfolioRisk.listOasViewPresets.useQuery(undefined, { refetchOnWindowFocus: false });
  const save = trpc.portfolioRisk.saveOasViewPreset.useMutation({ onSuccess: () => { utils.portfolioRisk.listOasViewPresets.invalidate(); setName(''); } });
  const remove = trpc.portfolioRisk.deleteOasViewPreset.useMutation({ onSuccess: () => utils.portfolioRisk.listOasViewPresets.invalidate() });
  const apply = (preset: OasPreset) => onApply({ selectedBuckets: Array.isArray(preset.selectedBuckets) ? preset.selectedBuckets.filter((value): value is string => typeof value === 'string') : [], startDate: preset.startDate ?? '', endDate: preset.endDate ?? '' });
  return <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-2"><div className="flex flex-wrap items-end gap-2"><label className="flex-1 text-[10px] text-slate-400">保存当前 OAS 筛选<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="配置名称" className="terminal-ledger-input mt-1 w-full" /></label><button type="button" disabled={!name.trim() || !selectedBuckets.length || save.isPending} onClick={() => save.mutate({ name, selectedBuckets, startDate: startDate || null, endDate: endDate || null })} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1.5 text-[10px] text-cyan-100 disabled:opacity-40"><BookmarkPlus className="h-3.5 w-3.5" />{save.isPending ? '保存中…' : '保存配置'}</button></div><div className="mt-2 flex flex-wrap gap-1">{(presets.data ?? []).map((preset: OasPreset) => <div key={preset.id} className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px]"><button type="button" onClick={() => apply(preset)} className="text-slate-200 hover:text-cyan-200">{preset.name}</button><button type="button" aria-label={`删除 ${preset.name}`} onClick={() => remove.mutate({ id: preset.id })} className="text-rose-300"><Trash2 className="h-3 w-3" /></button></div>)}</div>{!presets.isLoading && !(presets.data ?? []).length && <p className="mt-2 text-[10px] text-slate-500">尚无已保存配置。保存后仅当前账户可加载此评级桶与观察窗口组合。</p>}</div>;
}
