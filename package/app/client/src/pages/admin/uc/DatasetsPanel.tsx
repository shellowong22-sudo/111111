/**
 * 数据集：数据浏览（分页 / 搜索 / 排序 / 改单元格 / 删除与恢复行 / 导出）、清洗规则、数据质量、版本审核与推送。
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, Loader2, Pencil, RefreshCw, Rocket, RotateCcw, Search, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import RulesEditor from './RulesEditor';
import { Btn, Empty, Pill, downloadText, fmtTime, kindLabel, pushModeText, smallInputCls, statusText, useDebounced } from './ui';

type Perms = { editRules: boolean; publish: boolean; review: boolean; viewRaw: boolean; buildModules: boolean };

export default function DatasetsPanel({ perms, sourceFilter, onClearSource, onOpenModule }: { perms: Perms; sourceFilter: number | null; onClearSource: () => void; onOpenModule: (id: number) => void }) {
  const datasets = trpc.ucAdmin.datasets.useQuery(sourceFilter ? { sourceId: sourceFilter } : {});
  const [selected, setSelected] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const list = (datasets.data ?? []).filter((d) => !q || d.name.includes(q) || d.sourceName.includes(q));
  useEffect(() => {
    if (list.length && (selected === null || !list.some((d) => d.id === selected))) setSelected(list[0].id);
  }, [list, selected]);

  return (
    <div className="grid gap-3 xl:grid-cols-[260px_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#071012] px-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索数据集" className="h-8 flex-1 bg-transparent text-xs text-slate-100 outline-none" /></div>
        {sourceFilter && <button type="button" onClick={onClearSource} className="w-full rounded-md border border-teal-400/20 bg-teal-400/5 px-2 py-1 text-left text-[11px] text-teal-200">只看数据源 #{sourceFilter} · 点此显示全部</button>}
        <div className="max-h-[72vh] space-y-1 overflow-y-auto pr-1">
          {list.map((d) => (
            <button key={d.id} type="button" onClick={() => setSelected(d.id)} className={`w-full rounded-lg border px-2 py-1.5 text-left ${selected === d.id ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/5 hover:border-white/15'}`}>
              <div className="flex items-center justify-between gap-1"><span className="truncate text-xs text-slate-100">{d.name}</span><span className="shrink-0 text-[10px] text-slate-500">{d.rowCount.toLocaleString()} 行</span></div>
              <div className="flex items-center justify-between gap-1 text-[10px] text-slate-600"><span className="truncate">{d.sourceName} · {kindLabel[d.sourceKind] ?? d.sourceKind}</span><span>v{d.publishedVersion}/{d.currentVersion}</span></div>
              <div className="mt-0.5 flex gap-1">{d.pushMode !== 'realtime' && <Pill tone="info">{pushModeText[d.pushMode]}</Pill>}{d.reviewRequired && <Pill tone="candidate">需审核</Pill>}{d.currentVersion > d.publishedVersion && <Pill tone="waiting">有新版本待推送</Pill>}</div>
            </button>
          ))}
          {!datasets.isLoading && !list.length && <Empty>还没有数据集。上传 zip 或新增数据源并运行。</Empty>}
        </div>
      </aside>
      {selected ? <DatasetDetail key={selected} id={selected} perms={perms} onOpenModule={onOpenModule} /> : <Empty>选择左侧数据集</Empty>}
    </div>
  );
}

function DatasetDetail({ id, perms, onOpenModule }: { id: number; perms: Perms; onOpenModule: (id: number) => void }) {
  const utils = trpc.useUtils();
  const ds = trpc.ucAdmin.dataset.useQuery({ id });
  const mods = trpc.ucAdmin.modules.useQuery({ datasetId: id });
  const [tab, setTab] = useState<'browse' | 'rules' | 'quality' | 'versions'>('browse');
  const [name, setName] = useState('');
  useEffect(() => { if (ds.data) setName(ds.data.name); }, [ds.data]);
  const rename = trpc.ucAdmin.renameDataset.useMutation({ onSuccess: () => { toast.success('已重命名'); void utils.ucAdmin.invalidate(); } });
  const pushNow = trpc.ucAdmin.pushNow.useMutation({ onSuccess: (r) => { toast.success(`已推送 v${r.version} 到前端`); void utils.ucAdmin.invalidate(); }, onError: (e) => toast.error(e.message) });
  const createModule = trpc.ucAdmin.createModule.useMutation({ onSuccess: (r) => { void utils.ucAdmin.invalidate(); onOpenModule(r.id); }, onError: (e) => toast.error(e.message) });
  if (!ds.data) return <div className="p-6 text-xs text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />加载数据集…</div>;
  const d = ds.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== d.name && rename.mutate({ id, name: name.trim() })} disabled={!perms.editRules} className="min-w-[180px] flex-1 bg-transparent text-sm font-semibold text-slate-100 outline-none" />
        <span className="text-[11px] text-slate-500">{d.rowCount.toLocaleString()} 行 · {d.fields.length} 个字段 · 前端版本 v{d.publishedVersion} / 最新 v{d.currentVersion}</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {(mods.data ?? []).map((m) => <Btn key={m.id} size="sm" tone="ghost" onClick={() => onOpenModule(m.id)}><Eye className="h-3 w-3" />{m.name}</Btn>)}
          <Btn size="sm" disabled={!perms.buildModules || createModule.isPending} onClick={() => createModule.mutate({ datasetId: id })}>+ 生成模块</Btn>
          <Btn size="sm" tone="primary" disabled={!perms.publish || pushNow.isPending} onClick={() => pushNow.mutate({ id })}>{pushNow.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}立即推送到前端</Btn>
        </div>
      </div>
      <nav className="flex gap-1">
        {([['browse', '数据浏览'], ['rules', '清洗 / 去重 / 脱敏 / 推送规则'], ['quality', '数据质量'], ['versions', '版本与审核']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-xs ${tab === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
        ))}
      </nav>
      {tab === 'browse' && <DataBrowser id={id} perms={perms} fields={d.fields} versions={d.versions.map((v) => v.version)} hasCorrections={d.pipeline.cleaning.overrides.length + d.pipeline.cleaning.excludedKeys.length} excluded={d.pipeline.cleaning.excludedKeys} />}
      {tab === 'rules' && <div className="max-w-3xl"><RulesEditor datasetId={id} canEdit={perms.editRules} /></div>}
      {tab === 'quality' && <QualityView id={id} />}
      {tab === 'versions' && <VersionList id={id} perms={perms} versions={d.versions} />}
    </div>
  );
}

function DataBrowser({ id, perms, fields, versions, hasCorrections, excluded }: { id: number; perms: Perms; fields: Array<{ name: string; label: string; type: string }>; versions: number[]; hasCorrections: number; excluded: string[] }) {
  const utils = trpc.useUtils();
  const [view, setView] = useState<'full' | 'view'>('view');
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 300);
  const [sort, setSort] = useState<{ by: string; dir: 'asc' | 'desc' }>({ by: '', dir: 'asc' });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ key: string; field: string; value: string } | null>(null);
  useEffect(() => setPage(0), [debounced, sort, view, version, size]);
  const rows = trpc.ucAdmin.datasetRows.useQuery({ id, view, version, search: debounced, sortBy: sort.by, sortDir: sort.dir, limit: size, offset: page * size });
  const done = (msg: string) => () => { toast.success(msg); setPicked(new Set()); setEditing(null); void utils.ucAdmin.invalidate(); };
  const editCell = trpc.ucAdmin.editCell.useMutation({ onSuccess: done('已修正并重新入库'), onError: (e) => toast.error(e.message) });
  const delRows = trpc.ucAdmin.deleteRows.useMutation({ onSuccess: done('已更新并重新入库'), onError: (e) => toast.error(e.message) });
  const clear = trpc.ucAdmin.clearCorrections.useMutation({ onSuccess: done('已清除全部人工修正'), onError: (e) => toast.error(e.message) });
  const exportCsv = trpc.ucAdmin.exportDataset.useMutation({ onSuccess: (r) => { downloadText(r.fileName, r.csv); toast.success(`已导出 ${r.rows} 行`); }, onError: (e) => toast.error(e.message) });
  const data = rows.data;
  const columns = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of fields) if (data?.rows.some((r) => f.name in r.data)) { seen.add(f.name); out.push(f.name); }
    for (const r of data?.rows ?? []) for (const k of Object.keys(r.data)) if (!seen.has(k)) { seen.add(k); out.push(k); }
    return out;
  }, [data, fields]);
  const labelOf = (k: string) => fields.find((f) => f.name === k)?.label ?? k;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const toggle = (key: string) => setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const commitEdit = () => {
    if (!editing) return;
    const f = fields.find((x) => x.name === editing.field);
    const raw = editing.value.trim();
    const value = raw === '' ? null : f && (f.type === 'number' || f.type === 'percent') && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    editCell.mutate({ id, key: editing.key, field: editing.field, value });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-white/10 p-0.5">
          {([['view', '前端视图（已脱敏）'], ['full', '入库全量']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} className={`rounded-md px-2 py-1 text-[11px] ${view === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400'}`}>{l}</button>)}
        </div>
        <select value={version ?? ''} onChange={(e) => setVersion(e.target.value ? Number(e.target.value) : undefined)} className={`${smallInputCls} w-28`}><option value="">最新版本</option>{versions.map((v) => <option key={v} value={v}>v{v}</option>)}</select>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#071012] px-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索任意字段" className="h-7 w-48 bg-transparent text-xs text-slate-100 outline-none" /></div>
        {view === 'full' && data && !data.canViewRaw && <Pill tone="candidate">“后台也脱敏”的字段已遮掩</Pill>}
        <div className="ml-auto flex flex-wrap gap-1">
          {picked.size > 0 && <Btn size="sm" tone="danger" disabled={!perms.editRules} onClick={() => delRows.mutate({ id, keys: [...picked] })}><Trash2 className="h-3 w-3" />删除选中 {picked.size} 行</Btn>}
          {excluded.length > 0 && <Btn size="sm" tone="ghost" disabled={!perms.editRules} onClick={() => delRows.mutate({ id, keys: excluded, restore: true })}><RotateCcw className="h-3 w-3" />恢复已删除的 {excluded.length} 行</Btn>}
          {hasCorrections > 0 && <Btn size="sm" tone="ghost" disabled={!perms.editRules} onClick={() => clear.mutate({ id })}><Undo2 className="h-3 w-3" />清除全部人工修正</Btn>}
          <Btn size="sm" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate({ id, view, version })}><Download className="h-3 w-3" />导出 CSV</Btn>
          <Btn size="sm" tone="ghost" onClick={() => void rows.refetch()}><RefreshCw className="h-3 w-3" /></Btn>
        </div>
      </div>
      <div className="max-h-[62vh] overflow-auto rounded-xl border border-white/5">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#0b1719] text-slate-400">
            <tr>
              <th className="w-8 px-2 py-1.5"><input type="checkbox" checked={!!data?.rows.length && data.rows.every((r) => picked.has(r.key))} onChange={(e) => setPicked(e.target.checked ? new Set(data?.rows.map((r) => r.key)) : new Set())} className="accent-teal-400" /></th>
              <th className="px-2 py-1.5 text-left font-normal">#</th>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2 py-1.5 text-left font-normal">
                  <button type="button" onClick={() => setSort((s) => ({ by: c, dir: s.by === c && s.dir === 'asc' ? 'desc' : 'asc' }))} className={`inline-flex items-center gap-0.5 hover:text-slate-100 ${sort.by === c ? 'text-teal-200' : ''}`}>{labelOf(c)}<ArrowDownUp className="h-2.5 w-2.5" /></button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.isLoading && <tr><td colSpan={columns.length + 2} className="px-3 py-8 text-center text-slate-500">加载中…</td></tr>}
            {data?.rows.map((r) => (
              <tr key={`${r.key}-${r.index}`} className={`border-t border-white/5 ${picked.has(r.key) ? 'bg-red-500/[0.06]' : 'hover:bg-white/[0.02]'}`}>
                <td className="px-2 py-1"><input type="checkbox" checked={picked.has(r.key)} onChange={() => toggle(r.key)} className="accent-teal-400" /></td>
                <td className="px-2 py-1 text-slate-600">{r.index + 1}</td>
                {columns.map((c) => {
                  const isEditing = editing?.key === r.key && editing.field === c;
                  const v = r.data[c];
                  return (
                    <td key={c} className="group max-w-[260px] whitespace-nowrap px-2 py-1 text-slate-200" onDoubleClick={() => perms.editRules && view === 'full' && setEditing({ key: r.key, field: c, value: v === null || v === undefined ? '' : String(v) })}>
                      {isEditing ? (
                        <span className="flex items-center gap-1">
                          <input autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }} className={`${smallInputCls} min-w-[120px]`} />
                          <button type="button" onClick={commitEdit} className="text-teal-300">{editCell.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1"><span className="truncate">{v === null || v === undefined ? <span className="text-slate-600">—</span> : String(v)}</span>{perms.editRules && view === 'full' && <Pencil className="h-2.5 w-2.5 shrink-0 text-slate-600 opacity-0 group-hover:opacity-100" />}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan={columns.length + 2} className="px-3 py-8 text-center text-slate-500">没有数据</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>共 {total.toLocaleString()} 行{debounced ? '（已筛选）' : ''} · {view === 'full' ? '双击单元格可修正（记录为规则，重跑后依然生效）' : '切到“入库全量”可修正数据'}</span>
        <div className="flex items-center gap-1">
          <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={`${smallInputCls} w-20`}>{[20, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n} 行/页</option>)}</select>
          <Btn size="sm" tone="ghost" disabled={page <= 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3 w-3" /></Btn>
          <span>第 {page + 1} / {pages} 页</span>
          <Btn size="sm" tone="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-3 w-3" /></Btn>
        </div>
      </div>
    </div>
  );
}

function QualityView({ id }: { id: number }) {
  const q = trpc.ucAdmin.quality.useQuery({ id });
  if (!q.data) return <div className="p-6 text-xs text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />计算数据质量…</div>;
  const d = q.data;
  const maxRows = Math.max(1, ...d.trend.map((t) => t.rows));
  const score = d.quality ? Math.round(100 - (d.quality.fields.reduce((n, f) => n + f.nullRate, 0) / Math.max(1, d.quality.fields.length)) * 100) : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['完整度', score === null ? '—' : `${score}%`, score !== null && score < 90 ? 'text-amber-300' : 'text-emerald-300'],
          ['最新数据日期', d.quality?.latestDate ?? '—', 'text-slate-100'],
          ['距上次入库', d.ageHours === null ? '—' : d.ageHours < 1 ? '1 小时内' : `${d.ageHours} 小时`, d.ageHours !== null && d.ageHours > 48 ? 'text-amber-300' : 'text-slate-100'],
          ['本次重复行', String(d.latest.duplicates), d.latest.duplicates > 0 ? 'text-amber-300' : 'text-slate-100'],
          ['无效单元格', String(d.latest.invalidCells), d.latest.invalidCells > 0 ? 'text-amber-300' : 'text-slate-100'],
        ].map(([k, v, cls]) => <div key={k} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2"><div className={`text-base font-semibold ${cls}`}>{v}</div><div className="text-[10px] text-slate-500">{k}</div></div>)}
      </div>
      <div className="rounded-xl border border-white/5 p-3">
        <div className="mb-2 text-[11px] text-slate-400">近 {d.trend.length} 个版本行数</div>
        <div className="flex h-24 items-end gap-1">
          {d.trend.map((t) => <div key={t.version} title={`v${t.version} · ${t.rows} 行 · ${statusText[t.status] ?? t.status} · ${fmtTime(t.at)}`} className={`flex-1 rounded-t ${t.status === 'published' ? 'bg-teal-400/70' : t.status === 'candidate' ? 'bg-amber-400/60' : 'bg-white/15'}`} style={{ height: `${Math.max(4, (t.rows / maxRows) * 100)}%` }} />)}
        </div>
      </div>
      {d.quality && (
        <div className="overflow-auto rounded-xl border border-white/5">
          <table className="w-full text-[11px]">
            <thead className="bg-white/[0.03] text-slate-400"><tr>{['字段', '类型', '空值率', '取值个数', '最小', '最大', '最新日期'].map((h) => <th key={h} className="px-2 py-1.5 text-left font-normal">{h}</th>)}</tr></thead>
            <tbody>{d.quality.fields.map((f) => (
              <tr key={f.name} className="border-t border-white/5">
                <td className="px-2 py-1 text-slate-200">{f.label}</td>
                <td className="px-2 py-1 text-slate-500">{({ number: '数值', percent: '百分比', date: '日期', string: '文本' } as Record<string, string>)[f.type] ?? f.type}</td>
                <td className="px-2 py-1"><div className="flex items-center gap-1"><div className="h-1.5 w-20 overflow-hidden rounded bg-white/10"><div className={f.nullRate > 0.2 ? 'h-full bg-amber-400' : 'h-full bg-teal-400'} style={{ width: `${f.nullRate * 100}%` }} /></div><span className={f.nullRate > 0.2 ? 'text-amber-300' : 'text-slate-400'}>{(f.nullRate * 100).toFixed(1)}%</span></div></td>
                <td className="px-2 py-1 text-slate-400">{f.distinct.toLocaleString()}</td>
                <td className="px-2 py-1 font-mono text-slate-400">{f.min ?? '—'}</td>
                <td className="px-2 py-1 font-mono text-slate-400">{f.max ?? '—'}</td>
                <td className="px-2 py-1 text-slate-400">{f.latest ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VersionList({ id, perms, versions }: { id: number; perms: Perms; versions: Array<{ version: number; status: string; row_count: number; created_at: string; stats: unknown }> }) {
  const utils = trpc.useUtils();
  const done = (m: string) => () => { toast.success(m); void utils.ucAdmin.invalidate(); };
  const review = trpc.ucAdmin.reviewVersion.useMutation({ onSuccess: done('已处理'), onError: (e) => toast.error(e.message) });
  const withdraw = trpc.ucAdmin.withdrawVersion.useMutation({ onSuccess: done('已撤回，前端恢复到上一版本'), onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-1">
      {versions.map((v) => {
        const st = v.stats as { rowsIn?: number; duplicates?: number; invalidCells?: number };
        return (
          <div key={v.version} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2 text-xs">
            <div className="flex items-center gap-2"><span className="font-mono text-slate-200">v{v.version}</span><Pill tone={v.status}>{statusText[v.status] ?? v.status}</Pill><span className="text-[10px] text-slate-500">{v.row_count.toLocaleString()} 行 · 原始 {st.rowsIn ?? '—'} · 重复 {st.duplicates ?? 0} · 无效 {st.invalidCells ?? 0} · {fmtTime(v.created_at)}</span></div>
            <div className="flex gap-1">
              {v.status === 'candidate' && <><Btn size="sm" tone="primary" disabled={!perms.review} onClick={() => review.mutate({ id, version: v.version, approve: true })}>通过并推送</Btn><Btn size="sm" tone="ghost" disabled={!perms.review} onClick={() => review.mutate({ id, version: v.version, approve: false })}>驳回</Btn></>}
              {v.status === 'published' && <Btn size="sm" tone="ghost" disabled={!perms.publish} onClick={() => withdraw.mutate({ id, version: v.version })}><Undo2 className="h-3 w-3" />撤回</Btn>}
              {(v.status === 'superseded' || v.status === 'withdrawn' || v.status === 'rejected') && <Btn size="sm" tone="ghost" disabled={!perms.review} onClick={() => review.mutate({ id, version: v.version, approve: true })}>恢复为前端版本</Btn>}
            </div>
          </div>
        );
      })}
      {!versions.length && <Empty>暂无版本</Empty>}
      <p className="text-[10px] text-slate-600">只保留最近 10 个版本的数据行；版本记录长期保留。</p>
    </div>
  );
}
