import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

function downloadJson(value: unknown) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `municipal-research-presets-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }

export default function MunicipalResearchPresetExchangeToolbar() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [conflict, setConflict] = useState<'skip' | 'replace'>('skip'); const [message, setMessage] = useState('');
  const exported = trpc.municipalResearch.exportViewPresets.useQuery(undefined, { enabled: false });
  const imported = trpc.municipalResearch.importViewPresets.useMutation({ onSuccess: (result) => { setMessage(`已导入 ${result.imported} 项，跳过 ${result.skipped} 项。`); utils.municipalResearch.listViewPresets.invalidate(); } });
  if (loading) return null;
  if (!isAuthenticated) return <p className="mt-3 text-[10px] text-slate-500">登录后可导出账户私有研究配置 JSON，并由其他已登录用户导入到其自身账户；不会自动共享任何账户数据。</p>;
  return <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-[11px] text-slate-200">研究配置导入与导出</b><p className="mt-1 text-[10px] text-slate-500">仅交换观察窗口、期限桶、配置名称与默认标记；不包含市场时间序列、证据文件或账户标识。</p></div><button type="button" disabled={exported.isFetching} onClick={async () => { const result = await exported.refetch(); if (result.data) downloadJson(result.data); }} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-200 disabled:text-slate-600"><Download className="h-3 w-3" />导出 JSON</button></div><div className="mt-2 flex flex-wrap items-center gap-2"><input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const exchange = JSON.parse(await file.text()); imported.mutate({ exchange, onConflict: conflict }); } catch { setMessage('导入文件不是有效的地方债研究配置 JSON。'); } event.currentTarget.value = ''; }} className="input-terminal max-w-72 text-xs" /><label className="text-[10px] text-slate-500">同名配置<select value={conflict} onChange={(event) => setConflict(event.target.value as 'skip' | 'replace')} className="input-terminal ml-1"><option value="skip">跳过保留本地</option><option value="replace">替换本地</option></select></label></div>{message && <p className="mt-2 text-[10px] text-cyan-200">{message}</p>}{imported.error && <p className="mt-2 text-[10px] text-rose-300">{imported.error.message}</p>}</div>;
}
