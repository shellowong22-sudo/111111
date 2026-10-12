import { BookmarkCheck, BookmarkPlus, Clock3, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

type ModuleId = '1' | 'MSRC' | 'SMUN' | 'AAA' | 'BTMM' | 'PICK' | 'MBWD' | 'CDRN' | 'CDRC' | 'CDRA' | 'CNDS' | 'CDRV' | 'DEAL' | 'CACT' | 'MCAL' | 'MBIX' | 'VRDN' | 'BMA' | 'BOOM' | 'MSRB' | 'SLGS';
type Preset = { id: number; name: string; windowSize: number; bucketId: string | null; isDefault: number; lastUsedAt: string | Date | null };

export default function MunicipalResearchPresetToolbar({ moduleId, windowSize, bucketId, onApply }: { moduleId: ModuleId; windowSize: 5 | 10 | 30; bucketId: string; onApply: (settings: { windowSize: 5 | 10 | 30; bucketId: string }) => void }) {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const autoAppliedModule = useRef<string | null>(null);
  const presets = trpc.municipalResearch.listViewPresets.useQuery({ moduleId }, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const save = trpc.municipalResearch.saveViewPreset.useMutation({ onSuccess: () => { utils.municipalResearch.listViewPresets.invalidate({ moduleId }); setName(''); } });
  const remove = trpc.municipalResearch.deleteViewPreset.useMutation({ onSuccess: () => utils.municipalResearch.listViewPresets.invalidate({ moduleId }) });
  const setDefault = trpc.municipalResearch.setViewPresetDefault.useMutation({ onSuccess: () => utils.municipalResearch.listViewPresets.invalidate({ moduleId }) });
  const markUsed = trpc.municipalResearch.markViewPresetUsed.useMutation({ onSuccess: () => utils.municipalResearch.listViewPresets.invalidate({ moduleId }) });
  const apply = (preset: Preset) => { onApply({ windowSize: preset.windowSize as 5 | 10 | 30, bucketId: preset.bucketId ?? '' }); markUsed.mutate({ id: preset.id }); };
  useEffect(() => { if (autoAppliedModule.current === moduleId) return; autoAppliedModule.current = moduleId; const defaultPreset = (presets.data ?? []).find((preset: Preset) => Number(preset.isDefault) === 1); if (defaultPreset) onApply({ windowSize: defaultPreset.windowSize as 5 | 10 | 30, bucketId: defaultPreset.bucketId ?? '' }); }, [moduleId, onApply, presets.data]);
  if (loading) return null;
  if (!isAuthenticated) return <p className="mt-3 text-[10px] text-slate-500">登录后可为当前地方债研究入口保存观察窗口与期限桶配置；未登录时不会写入浏览器或账户数据。</p>;
  return <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-2"><div className="flex flex-wrap items-end gap-2"><label className="min-w-48 flex-1 text-[10px] text-slate-400">保存当前研究筛选<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="配置名称" className="input-terminal mt-1 w-full" /></label><button type="button" disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ moduleId, name, windowSize, bucketId: bucketId || null })} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1.5 text-[10px] text-cyan-100 disabled:opacity-40"><BookmarkPlus className="h-3.5 w-3.5" />{save.isPending ? '保存中…' : '保存配置'}</button></div><div className="mt-2 flex flex-wrap gap-1">{(presets.data ?? []).map((preset: Preset) => <div key={preset.id} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${Number(preset.isDefault) === 1 ? 'border-cyan-700 bg-cyan-950/30' : 'border-slate-700 bg-slate-900/60'}`}><button type="button" onClick={() => apply(preset)} className="text-slate-200 hover:text-cyan-200">{preset.name}</button>{Number(preset.isDefault) === 1 ? <span title="默认配置" className="text-cyan-200"><BookmarkCheck className="h-3 w-3" /></span> : <button type="button" title="设为默认" onClick={() => setDefault.mutate({ id: preset.id })} className="text-slate-500 hover:text-cyan-200"><BookmarkCheck className="h-3 w-3" /></button>}<span title={preset.lastUsedAt ? `最近使用：${new Date(preset.lastUsedAt).toLocaleString()}` : '尚未使用'} className="text-slate-600"><Clock3 className="h-3 w-3" /></span><button type="button" aria-label={`删除 ${preset.name}`} onClick={() => remove.mutate({ id: preset.id })} className="text-rose-300"><Trash2 className="h-3 w-3" /></button></div>)}</div>{!presets.isLoading && !(presets.data ?? []).length && <p className="mt-2 text-[10px] text-slate-500">尚无已保存配置。保存后仅当前账户可一键恢复该入口的观察窗口与期限桶；设为默认的配置会在进入该入口时自动应用。</p>}</div>;
}
