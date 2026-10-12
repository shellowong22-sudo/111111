/**
 * 模块工作台（前后台同屏）：
 *  · 左：按前端位置分组的模块，可拖动调整前端显示顺序；“新建模块”从模板库选
 *  · 中：与前端完全相同的模块（同一渲染器、同一份数据）
 *  · 右：拖拽字段到模板槽位、参数、组合其他数据集、规则、推送与版本、A/B
 */
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Copy, Eye, GripVertical, History, Layers3, Loader2, Plus, Rocket, Settings2, SlidersHorizontal, Split, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { UC_SLOTS, UC_TEMPLATES, UcModuleParams, type UcField, type UcModuleDefinition, type UcPublishedModule } from '@shared/ucheerModules';
import { ModuleRenderer } from '@/uc/ModuleRenderer';
import RulesEditor from './RulesEditor';
import { Btn, Empty, Field, Modal, Pill, SlotSelect, Toggle, fmtTime, inputCls, kindLabel, slotLabel, smallInputCls, statusText, useDebounced } from './ui';

type Perms = { buildModules: boolean; publish: boolean; editRules: boolean };
type F = Pick<UcField, 'name' | 'label' | 'type'>;

export default function ModuleStudio({ perms, focus, onFocus }: { perms: Perms; focus: number | null; onFocus: (id: number | null) => void }) {
  const utils = trpc.useUtils();
  const modules = trpc.ucAdmin.modules.useQuery({});
  const reorder = trpc.ucAdmin.reorderModules.useMutation({ onSuccess: () => { toast.success('前端显示顺序已更新'); void utils.ucAdmin.modules.invalidate(); }, onError: (e) => toast.error(e.message) });
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const list = (modules.data ?? []).filter((m) => !filter || m.name.includes(filter) || (m.datasetName ?? '').includes(filter));
  const selected = focus ?? list[0]?.id ?? null;
  useEffect(() => { if (focus === null && list[0]) onFocus(list[0].id); }, [focus, list, onFocus]);

  const dropOn = (targetId: number, slotId: string) => {
    if (!dragId || dragId === targetId) return;
    const inSlot = list.filter((m) => m.slotId === slotId && !m.variantOf).map((m) => m.id);
    if (!inSlot.includes(dragId)) { toast.error('只能在同一前端位置内调整顺序'); return; }
    const without = inSlot.filter((id) => id !== dragId);
    without.splice(without.indexOf(targetId), 0, dragId);
    reorder.mutate({ ids: without });
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[270px_1fr]">
      <aside className="space-y-2">
        <div className="flex gap-1"><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索模块" className={inputCls} /><Btn tone="primary" disabled={!perms.buildModules} onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />新建</Btn></div>
        <div className="max-h-[74vh] space-y-1 overflow-y-auto pr-1">
          {UC_SLOTS.filter((s) => list.some((m) => m.slotId === s.id)).map((s) => (
            <div key={s.id}>
              <div className="px-1 pt-2 text-[10px] font-semibold tracking-wide text-slate-500">{s.group} · {s.label}</div>
              {list.filter((m) => m.slotId === s.id).map((m) => (
                <div key={m.id} draggable={perms.buildModules && !m.variantOf} onDragStart={() => setDragId(m.id)} onDragEnd={() => setDragId(null)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn(m.id, s.id)}
                  className={`mt-1 flex items-stretch rounded-lg border ${selected === m.id ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/5 hover:border-white/15'} ${dragId === m.id ? 'opacity-40' : ''}`}>
                  {!m.variantOf && <span className="flex cursor-grab items-center px-1 text-slate-600" title="拖动调整前端显示顺序"><GripVertical className="h-3.5 w-3.5" /></span>}
                  <button type="button" onClick={() => onFocus(m.id)} className="min-w-0 flex-1 px-1.5 py-1.5 text-left">
                    <div className="flex items-center justify-between gap-1"><span className="truncate text-xs text-slate-100">{m.variantOf ? '↳ ' : ''}{m.name}</span><Pill tone={m.status}>{statusText[m.status]}{m.publishedVersion ? ` v${m.publishedVersion}` : ''}</Pill></div>
                    <div className="truncate text-[10px] text-slate-600">{UC_TEMPLATES.find((t) => t.code === m.template)?.label} · {m.datasetName}{m.variantOf ? ` · B 版 ${m.trafficPct}%` : ''} · 曝光 {m.events.view ?? 0}</div>
                  </button>
                </div>
              ))}
            </div>
          ))}
          {!list.length && <Empty>还没有模块。点“新建”从模板创建，或先接入数据。</Empty>}
        </div>
      </aside>
      {creating && <NewModuleDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onFocus(id); }} />}
      {selected ? <ModuleEditor key={selected} id={selected} perms={perms} onDeleted={() => onFocus(null)} onFocus={onFocus} /> : <Empty>选择左侧模块</Empty>}
    </div>
  );
}

/* ------------------------------------------------------------------ 从模板新建 */

function NewModuleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const utils = trpc.useUtils();
  const datasets = trpc.ucAdmin.datasets.useQuery({});
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [template, setTemplate] = useState<string>('');
  const [slot, setSlot] = useState('tool.board');
  const [name, setName] = useState('');
  const create = trpc.ucAdmin.createModule.useMutation({ onSuccess: (r) => { toast.success('模块已创建'); void utils.ucAdmin.invalidate(); onCreated(r.id); }, onError: (e) => toast.error(e.message) });
  const ds = datasets.data?.find((d) => d.id === datasetId);
  return (
    <Modal title="新建模块" onClose={onClose} width="max-w-4xl">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <div className="mb-1 text-[11px] text-slate-400">1. 选择数据集</div>
          <div className="max-h-[360px] space-y-1 overflow-y-auto">
            {datasets.data?.map((d) => (
              <button key={d.id} type="button" onClick={() => { setDatasetId(d.id); if (!name) setName(d.name); }} className={`w-full rounded-lg border px-2 py-1.5 text-left ${datasetId === d.id ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/5 hover:border-white/15'}`}>
                <div className="flex justify-between text-xs text-slate-100"><span className="truncate">{d.name}</span><span className="text-[10px] text-slate-500">{d.rowCount} 行</span></div>
                <div className="truncate text-[10px] text-slate-600">{d.sourceName} · {kindLabel[d.sourceKind] ?? d.sourceKind} · {d.fields.slice(0, 5).map((f) => f.label).join('、')}</div>
              </button>
            ))}
            {!datasets.data?.length && <Empty>还没有数据集</Empty>}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] text-slate-400">2. 选择模板（留空 = 按字段自动推荐）</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {UC_TEMPLATES.map((t) => (
                <button key={t.code} type="button" onClick={() => setTemplate(template === t.code ? '' : t.code)} className={`rounded-lg border px-2 py-2 text-left ${template === t.code ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/5 hover:border-white/15'}`}>
                  <div className="text-xs text-slate-100">{t.label}</div><div className="text-[10px] text-slate-500">{t.needs}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="3. 模块名称"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
            <Field label="前端位置"><SlotSelect value={slot} onChange={setSlot} /></Field>
          </div>
          {ds && <p className="text-[10px] text-slate-500">字段：{ds.fields.map((f) => f.label).join('、')}</p>}
          <div className="flex justify-end gap-2"><Btn tone="ghost" onClick={onClose}>取消</Btn><Btn tone="primary" disabled={!datasetId || create.isPending} onClick={() => datasetId && create.mutate({ datasetId, template: template || undefined, slotId: slot, name: name || undefined })}>{create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}创建并打开</Btn></div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ 编辑器 */

function ModuleEditor({ id, perms, onDeleted, onFocus }: { id: number; perms: Perms; onDeleted: () => void; onFocus: (id: number) => void }) {
  const utils = trpc.useUtils();
  const mod = trpc.ucAdmin.module.useQuery({ id });
  const [def, setDef] = useState<UcModuleDefinition | null>(null);
  const [panel, setPanel] = useState<'display' | 'combine' | 'rules' | 'publish'>('display');
  const [layout, setLayout] = useState<'split' | 'frontend' | 'compare'>('split');
  useEffect(() => { if (mod.data) setDef(mod.data.definition); }, [mod.data]);
  const debounced = useDebounced(def, 300);
  const preview = trpc.ucAdmin.preview.useQuery({ definition: debounced! }, { enabled: !!debounced, retry: false });
  const live = trpc.ucAdmin.preview.useQuery({ definition: mod.data?.definition as UcModuleDefinition }, { enabled: layout === 'compare' && !!mod.data, retry: false });
  const dirty = !!def && !!mod.data && JSON.stringify(def) !== JSON.stringify(mod.data.definition);
  const save = trpc.ucAdmin.saveModule.useMutation({
    onSuccess: (r) => { toast.success(r.version ? `已推送到前端（模块版本 v${r.version}），打开的前端页面会自动刷新` : '已保存'); void utils.ucAdmin.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const duplicate = trpc.ucAdmin.duplicateModule.useMutation({ onSuccess: (r) => { toast.success('已复制'); void utils.ucAdmin.invalidate(); onFocus(r.id); }, onError: (e) => toast.error(e.message) });
  if (!def || !mod.data) return <div className="flex min-h-[300px] items-center justify-center text-xs text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载模块…</div>;
  const payload = preview.data as (UcPublishedModule & { lineage?: Record<string, unknown> }) | undefined;
  const slot = UC_SLOTS.find((s) => s.id === def.slotId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-100">{def.name}</span>
          <Pill tone={mod.data.status}>{statusText[mod.data.status]}{mod.data.publishedVersion ? ` v${mod.data.publishedVersion}` : ''}</Pill>
          {dirty && <Pill tone="candidate">有未保存的修改</Pill>}
          <span className="text-[11px] text-slate-500">前端位置：{slotLabel(def.slotId)}</span>
          {slot && <a href={slot.paths[0]} target="_blank" rel="noreferrer" className="text-[11px] text-teal-300 hover:underline">打开前端页面 ↗</a>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <div className="flex rounded-lg border border-white/10 p-0.5">
            {([['split', '编辑'], ['frontend', '只看前端'], ['compare', '修改前后对比']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setLayout(k)} className={`rounded-md px-2 py-1 text-[11px] ${layout === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400'}`}>{l}</button>)}
          </div>
          <Btn size="sm" tone="ghost" disabled={!perms.buildModules} onClick={() => duplicate.mutate({ id })}><Copy className="h-3 w-3" />复制</Btn>
          <Btn size="sm" tone="ghost" disabled={!dirty} onClick={() => setDef(mod.data!.definition)}><Undo2 className="h-3 w-3" />撤销修改</Btn>
          <Btn disabled={!perms.buildModules || !dirty || save.isPending} onClick={() => save.mutate({ id, definition: def })}>保存草稿</Btn>
          <Btn tone="primary" disabled={!perms.buildModules || !perms.publish || save.isPending} onClick={() => save.mutate({ id, definition: def, publish: true })}>{save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}保存并推送到前端</Btn>
        </div>
      </div>

      {layout === 'compare' ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="space-y-1"><div className="text-[11px] text-slate-500">前端当前（已保存的配置）</div>{live.data ? <ModuleRenderer module={live.data as UcPublishedModule} mode="admin" /> : <Empty>加载…</Empty>}</div>
          <div className="space-y-1"><div className="text-[11px] text-teal-300">修改后（推送后前端将显示）</div>{payload ? <ModuleRenderer module={payload} mode="admin" /> : <Empty>加载…</Empty>}</div>
        </div>
      ) : (
        <div className={`grid gap-3 ${layout === 'frontend' ? '' : '2xl:grid-cols-[1fr_440px] xl:grid-cols-[1fr_400px]'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" />前端效果（与用户看到的完全相同：同一组件、同一份配置与数据，修改即时刷新）</div>
            {preview.error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-xs text-red-200">{preview.error.message}</div>
              : payload ? <ModuleRenderer module={payload} mode="admin" />
              : <div className="flex h-60 items-center justify-center rounded-xl border border-white/5 text-xs text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成预览…</div>}
            {payload?.lineage && <LineageBar lineage={payload.lineage} />}
          </div>
          {layout === 'split' && (
            <div className="rounded-xl border border-white/5 bg-black/20">
              <div className="flex border-b border-white/5 p-1">
                {([['display', '显示', Settings2], ['combine', '组合数据', Layers3], ['rules', '数据规则', SlidersHorizontal], ['publish', '推送与版本', Rocket]] as const).map(([k, l, Icon]) => (
                  <button key={k} type="button" onClick={() => setPanel(k)} className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] ${panel === k ? 'bg-teal-500/15 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}><Icon className="h-3.5 w-3.5" />{l}</button>
                ))}
              </div>
              <div className="max-h-[76vh] overflow-y-auto p-3">
                {panel === 'display' && <DisplayConfig def={def} fields={payload?.fields ?? []} onChange={setDef} />}
                {panel === 'combine' && <CombineConfig def={def} onChange={setDef} />}
                {panel === 'rules' && <RulesEditor datasetId={def.datasetId} canEdit={perms.editRules} onSaved={() => void utils.ucAdmin.preview.invalidate()} />}
                {panel === 'publish' && <PublishConfig id={id} def={def} perms={perms} onChange={setDef} module={mod.data} onDeleted={onDeleted} onFocus={onFocus} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LineageBar({ lineage }: { lineage: Record<string, unknown> }) {
  const stats = (lineage.stats ?? {}) as Record<string, unknown>;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[11px] text-slate-400">
      <span className="text-amber-200">仅后台可见</span>
      <span>来源：{String(lineage.sourceName)}（{kindLabel[String(lineage.sourceKind)] ?? String(lineage.sourceKind)}）</span>
      <span>数据集：{String(lineage.datasetName)}</span>
      <span>预览版本 v{String(lineage.datasetVersion)}（{statusText[String(lineage.versionStatus)] ?? String(lineage.versionStatus)}）</span>
      <span>前端版本 v{String(lineage.publishedVersion || 0)}</span>
      {stats.rowsIn !== undefined && <span>原始 {String(stats.rowsIn)} 行 → 入库 {String(stats.rowsDeduped)} 行（重复 {String(stats.duplicates)}，无效单元格 {String(stats.invalidCells)}）</span>}
      {Array.isArray(stats.hiddenSourceFields) && stats.hiddenSourceFields.length > 0 && <span>已对前端隐藏：{(stats.hiddenSourceFields as string[]).join('、')}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ 拖拽字段绑定 */

const DRAG_MIME = 'application/x-uc-field';

function FieldChip({ f }: { f: F }) {
  const tone = f.type === 'date' ? 'border-sky-400/30 text-sky-200' : f.type === 'string' ? 'border-white/15 text-slate-300' : 'border-teal-400/30 text-teal-200';
  return (
    <span draggable onDragStart={(e: DragEvent) => { e.dataTransfer.setData(DRAG_MIME, f.name); e.dataTransfer.setData('text/plain', f.name); }} title="拖到右侧槽位"
      className={`inline-flex cursor-grab items-center gap-1 rounded-md border bg-black/30 px-1.5 py-0.5 text-[11px] active:cursor-grabbing ${tone}`}>
      <GripVertical className="h-3 w-3 opacity-50" />{f.label}<span className="text-[9px] opacity-60">{({ number: '数', percent: '%', date: '日期', string: '文' } as Record<string, string>)[f.type]}</span>
    </span>
  );
}

function Slot({ label, value, fields, multi, onSet, onClear, hint }: { label: string; value: string | string[] | undefined; fields: F[]; multi?: boolean; onSet: (name: string) => void; onClear: (name?: string) => void; hint?: string }) {
  const [over, setOver] = useState(false);
  const values = (Array.isArray(value) ? value : value ? [value] : []);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const n = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain'); if (n) onSet(n); }}
      className={`rounded-lg border border-dashed px-2 py-1.5 transition-colors ${over ? 'border-teal-300 bg-teal-400/10' : 'border-white/15'}`}>
      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500"><span>{label}{multi ? '（可多个）' : ''}</span>
        <select value="" onChange={(e) => e.target.value && onSet(e.target.value)} className="h-5 rounded border border-white/10 bg-[#071012] text-[10px] text-slate-300"><option value="">选择…</option>{fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}</select>
      </div>
      <div className="flex min-h-[22px] flex-wrap gap-1">
        {values.map((v) => <span key={v} className="inline-flex items-center gap-1 rounded-md bg-teal-500/20 px-1.5 py-0.5 text-[11px] text-teal-50">{fields.find((f) => f.name === v)?.label ?? v}<button type="button" onClick={() => onClear(v)} className="text-teal-200/60 hover:text-white"><X className="h-3 w-3" /></button></span>)}
        {!values.length && <span className="text-[10px] text-slate-600">{hint ?? '把字段拖到这里'}</span>}
      </div>
    </div>
  );
}

function DisplayConfig({ def, fields, onChange }: { def: UcModuleDefinition; fields: F[]; onChange: (d: UcModuleDefinition) => void }) {
  const set = (patch: Partial<UcModuleDefinition>) => onChange({ ...def, ...patch });
  const setB = (patch: Partial<UcModuleDefinition['bindings']>) => onChange({ ...def, bindings: { ...def.bindings, ...patch } });
  const setP = (patch: Partial<UcModuleDefinition['params']>) => onChange({ ...def, params: UcModuleParams.parse({ ...def.params, ...patch }) });
  const t = def.template;
  const one = (key: 'x' | 'open' | 'high' | 'low' | 'close' | 'volume' | 'title' | 'time' | 'summary' | 'symbol', label: string, hint?: string) => (
    <Slot key={key} label={label} hint={hint} value={def.bindings[key]} fields={fields} onSet={(n) => setB({ [key]: n })} onClear={() => setB({ [key]: undefined })} />
  );
  const many = (key: 'series' | 'columns', label: string, hint?: string) => (
    <Slot key={key} label={label} hint={hint} multi value={def.bindings[key]} fields={fields} onSet={(n) => !def.bindings[key].includes(n) && setB({ [key]: [...def.bindings[key], n] })} onClear={(n) => setB({ [key]: def.bindings[key].filter((x) => x !== n) })} />
  );
  const slots: ReactNode[] = [];
  if (t === 'kline') slots.push(one('x', '日期'), one('open', '开盘'), one('high', '最高'), one('low', '最低'), one('close', '收盘'), one('volume', '成交量'));
  else if (t === 'liveBoard') slots.push(one('symbol', '代码字段', '如 代码 / symbol'), one('title', '名称字段'));
  else if (t === 'newsList') slots.push(one('title', '标题'), one('time', '时间'), one('summary', '摘要'));
  else if (t === 'calendar') slots.push(one('x', '日期'), one('title', '事件'));
  else if (t === 'table') slots.push(many('columns', '显示的列', '不放 = 全部列'));
  else slots.push(one('x', t === 'yieldCurve' ? '期限' : t === 'heatmap' || t === 'statCard' ? '名称 / 日期' : '横轴'), many('series', '数值'));

  return (
    <div className="space-y-3">
      <Field label="模块名称"><input value={def.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
      <div>
        <div className="mb-1 text-[11px] text-slate-400">模板</div>
        <div className="grid grid-cols-3 gap-1">
          {UC_TEMPLATES.map((x) => <button key={x.code} type="button" title={x.needs} onClick={() => set({ template: x.code })} className={`rounded-lg border px-2 py-1.5 text-[11px] ${t === x.code ? 'border-teal-400/50 bg-teal-400/10 text-teal-50' : 'border-white/5 text-slate-300 hover:border-white/15'}`}>{x.label}</button>)}
        </div>
      </div>
      <div className="rounded-lg border border-white/5 p-2">
        <div className="mb-1 text-[11px] text-slate-400">字段（拖到下方槽位）</div>
        <div className="flex flex-wrap gap-1">{fields.map((f) => <FieldChip key={f.name} f={f} />)}{!fields.length && <span className="text-[10px] text-slate-600">预览加载后显示字段</span>}</div>
      </div>
      <div className="grid gap-1.5">{slots}</div>
      {t === 'liveBoard' && (
        <Field label="迷你 K 线周期"><select value={def.params.period} onChange={(e) => setP({ period: e.target.value as typeof def.params.period })} className={inputCls}>{[['1m', '分时'], ['5m', '5 分钟'], ['15m', '15 分钟'], ['60m', '60 分钟'], ['1d', '日 K'], ['1w', '周 K'], ['1M', '月 K']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      )}
      <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
        <Field label="标题"><input value={def.params.title} onChange={(e) => setP({ title: e.target.value })} className={inputCls} /></Field>
        <Field label="副标题"><input value={def.params.subtitle} onChange={(e) => setP({ subtitle: e.target.value })} className={inputCls} /></Field>
        <Field label="排序字段"><select value={def.params.sortBy ?? ''} onChange={(e) => setP({ sortBy: e.target.value || undefined })} className={inputCls}><option value="">（默认）</option>{fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}</select></Field>
        <Field label="排序方向"><select value={def.params.sortDir} onChange={(e) => setP({ sortDir: e.target.value as 'asc' | 'desc' })} className={inputCls}><option value="asc">升序</option><option value="desc">降序</option></select></Field>
        <Field label="只显示最近 N 条（0 = 全部）"><input type="number" min={0} value={def.params.limit} onChange={(e) => setP({ limit: Number(e.target.value) || 0 })} className={inputCls} /></Field>
        <Field label="小数位"><input type="number" min={0} max={8} value={def.params.decimals} onChange={(e) => setP({ decimals: Number(e.target.value) || 0 })} className={inputCls} /></Field>
        <Field label="单位"><input value={def.params.unit} onChange={(e) => setP({ unit: e.target.value })} placeholder="如 元、亿、bp" className={inputCls} /></Field>
        <Field label={`图表高度 ${def.params.height}px`}><input type="range" min={160} max={900} step={10} value={def.params.height} onChange={(e) => setP({ height: Number(e.target.value) })} className="w-full accent-teal-400" /></Field>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {([['area', '面积图'], ['stacked', '堆叠'], ['allowRange', '前端可选时间区间'], ['allowSearch', '前端可筛选'], ['allowExport', '前端可导出']] as const).map(([k, l]) => (
          <Toggle key={k} checked={!!def.params[k]} onChange={(v) => setP({ [k]: v })} label={l} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 多数据源组合 */

function CombineConfig({ def, onChange }: { def: UcModuleDefinition; onChange: (d: UcModuleDefinition) => void }) {
  const datasets = trpc.ucAdmin.datasets.useQuery({});
  const others = (datasets.data ?? []).filter((d) => d.id !== def.datasetId);
  const main = datasets.data?.find((d) => d.id === def.datasetId);
  const combine = def.combine ?? [];
  const set = (next: UcModuleDefinition['combine']) => onChange({ ...def, combine: next });
  const mainFields = useMemo(() => main?.fields ?? [], [main]);
  return (
    <div className="space-y-3 text-xs">
      <Field label="主数据集"><select value={def.datasetId} onChange={(e) => onChange({ ...def, datasetId: Number(e.target.value) })} className={inputCls}>{datasets.data?.map((d) => <option key={d.id} value={d.id}>{d.name}（{d.sourceName}）</option>)}</select></Field>
      <div className="flex items-center justify-between text-[11px] text-slate-400"><span>组合其他数据集（{combine.length}）</span><button type="button" disabled={!others.length} onClick={() => set([...combine, { datasetId: others[0].id, mode: 'union', on: '', prefix: '' }])} className="text-teal-300 hover:text-teal-100 disabled:opacity-40">+ 添加</button></div>
      {combine.map((c, i) => {
        const other = datasets.data?.find((d) => d.id === c.datasetId);
        return (
          <div key={i} className="space-y-1.5 rounded-lg border border-white/5 p-2">
            <div className="grid grid-cols-[1fr_110px_20px] gap-1">
              <select value={c.datasetId} onChange={(e) => set(combine.map((x, j) => (j === i ? { ...x, datasetId: Number(e.target.value) } : x)))} className={smallInputCls}>{others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              <select value={c.mode} onChange={(e) => set(combine.map((x, j) => (j === i ? { ...x, mode: e.target.value as 'union' | 'join' } : x)))} className={smallInputCls}><option value="union">追加行</option><option value="join">按字段拼列</option></select>
              <button type="button" onClick={() => set(combine.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
            </div>
            {c.mode === 'join' && (
              <div className="grid grid-cols-2 gap-1">
                <select value={c.on} onChange={(e) => set(combine.map((x, j) => (j === i ? { ...x, on: e.target.value } : x)))} className={smallInputCls}><option value="">按哪个字段对齐…</option>{mainFields.filter((f) => other?.fields.some((o) => o.name === f.name)).map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}</select>
                <input value={c.prefix} onChange={(e) => set(combine.map((x, j) => (j === i ? { ...x, prefix: e.target.value } : x)))} placeholder={`列名前缀，默认“${other?.name ?? ''}·”`} className={smallInputCls} />
              </div>
            )}
            <p className="text-[10px] text-slate-600">{c.mode === 'union' ? '把该数据集的行追加到主数据集后面（同名字段合并成一列）。' : '按对齐字段把该数据集的列拼到主数据集每一行上，例如按“日期”把两条曲线放进同一张图。'}</p>
          </div>
        );
      })}
      {!combine.length && <p className="text-[10px] text-slate-600">例：把“美债收益率”和“中债收益率”两个数据集按日期拼在一起，在一张图里对比；或把多个 zip 里同结构的表追加成一张。</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ 推送与版本 */

function PublishConfig({ id, def, perms, onChange, module, onDeleted, onFocus }: { id: number; def: UcModuleDefinition; perms: Perms; onChange: (d: UcModuleDefinition) => void; module: { status: string; publishedVersion: number; variantOf: number | null; trafficPct: number; versions: Array<{ version: number; published_at: string }>; events: Record<string, number> }; onDeleted: () => void; onFocus: (id: number) => void }) {
  const utils = trpc.useUtils();
  const all = trpc.ucAdmin.modules.useQuery({});
  const variant = (all.data ?? []).find((m) => m.variantOf === id);
  const done = (msg: string) => () => { toast.success(msg); void utils.ucAdmin.invalidate(); };
  const err = (e: { message: string }) => toast.error(e.message);
  const publish = trpc.ucAdmin.publishModule.useMutation({ onSuccess: done('已推送到前端'), onError: err });
  const unpublish = trpc.ucAdmin.unpublishModule.useMutation({ onSuccess: done('已从前端下线'), onError: err });
  const rollback = trpc.ucAdmin.rollbackModule.useMutation({ onSuccess: done('已回滚并推送'), onError: err });
  const del = trpc.ucAdmin.deleteModule.useMutation({ onSuccess: () => { toast.success('模块已删除'); void utils.ucAdmin.invalidate(); onDeleted(); }, onError: err });
  const pushNow = trpc.ucAdmin.pushNow.useMutation({ onSuccess: (r) => { toast.success(`数据 v${r.version} 已推送`); void utils.ucAdmin.invalidate(); }, onError: err });
  const setVariant = trpc.ucAdmin.setVariant.useMutation({ onSuccess: (r) => { toast.success('A/B 设置已保存'); void utils.ucAdmin.invalidate(); if (!variant) onFocus(r.variantId); }, onError: err });
  const promote = trpc.ucAdmin.promoteVariant.useMutation({ onSuccess: done('B 版本已推为全量'), onError: err });
  const [traffic, setTraffic] = useState(variant?.trafficPct ?? 20);
  const [confirmDel, setConfirmDel] = useState(false);
  const base = module.variantOf ? (all.data ?? []).find((m) => m.id === module.variantOf) : null;

  return (
    <div className="space-y-4 text-xs">
      <Field label="推送到前端的位置" hint={`对应页面：${UC_SLOTS.find((s) => s.id === def.slotId)?.paths.join('、')}（改完点“保存并推送”生效）`}><SlotSelect value={def.slotId} onChange={(v) => onChange({ ...def, slotId: v })} /></Field>
      <div className="flex flex-wrap gap-2">
        {module.status !== 'published' && <Btn tone="primary" disabled={!perms.publish || publish.isPending} onClick={() => publish.mutate({ id })}><Rocket className="h-3.5 w-3.5" />上线（用已保存配置）</Btn>}
        {module.status === 'published' && <Btn disabled={!perms.publish} onClick={() => unpublish.mutate({ id })}><Undo2 className="h-3.5 w-3.5" />从前端下线</Btn>}
        <Btn disabled={!perms.publish || pushNow.isPending} onClick={() => pushNow.mutate({ id: def.datasetId })}><Rocket className="h-3.5 w-3.5" />推送最新数据</Btn>
        {confirmDel ? <><Btn tone="danger" onClick={() => del.mutate({ id })}>确认删除模块</Btn><Btn tone="ghost" onClick={() => setConfirmDel(false)}>取消</Btn></> : <Btn tone="ghost" disabled={!perms.buildModules} onClick={() => setConfirmDel(true)}><Trash2 className="h-3.5 w-3.5" />删除模块</Btn>}
      </div>

      <div>
        <div className="mb-1 text-[11px] text-slate-400">模块发布历史（可回滚）</div>
        <div className="space-y-1">
          {module.versions.map((v) => (
            <div key={v.version} className="flex items-center justify-between rounded-lg border border-white/5 px-2 py-1.5">
              <span className="text-slate-300">v{v.version} <span className="text-[10px] text-slate-500">{fmtTime(v.published_at)}</span>{module.publishedVersion === v.version && <span className="ml-1 text-emerald-300">当前</span>}</span>
              {module.publishedVersion !== v.version && <Btn size="sm" tone="ghost" disabled={!perms.publish} onClick={() => rollback.mutate({ id, version: v.version })}><History className="h-3 w-3" />回滚到此版</Btn>}
            </div>
          ))}
          {!module.versions.length && <p className="text-slate-600">还未推送过</p>}
        </div>
      </div>

      {module.variantOf ? (
        <div className="space-y-2 rounded-lg border border-white/5 p-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><Split className="h-3.5 w-3.5 text-teal-300" />这是「{base?.name ?? '主模块'}」的 B 版本，分流 {module.trafficPct}%</div>
          <div className="text-[10px] text-slate-500">B 版：曝光 {module.events.view ?? 0} · 交互 {module.events.interact ?? 0} · 导出 {module.events.export ?? 0}</div>
          <div className="flex gap-1">{base && <Btn size="sm" onClick={() => onFocus(base.id)}>回到 A 版</Btn>}<Btn size="sm" tone="primary" disabled={!perms.publish} onClick={() => promote.mutate({ variantId: id })}>B 版推为全量</Btn></div>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-white/5 p-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300"><Split className="h-3.5 w-3.5 text-teal-300" />A/B 对比</div>
          <p className="text-[10px] text-slate-500">复制出 B 版本单独调整（模板、参数、组合数据），按比例分流给前端用户；同一用户始终看到同一版本。</p>
          <div className="flex items-center gap-2"><input type="range" min={0} max={100} step={5} value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="flex-1 accent-teal-400" /><span className="w-10 text-right text-slate-200">{traffic}%</span></div>
          <div className="flex flex-wrap gap-1">
            <Btn size="sm" disabled={!perms.buildModules} onClick={() => setVariant.mutate({ id, trafficPct: traffic })}>{variant ? '更新 B 版流量' : '创建 B 版本'}</Btn>
            {variant && <Btn size="sm" onClick={() => onFocus(variant.id)}><Eye className="h-3 w-3" />编辑 B 版</Btn>}
            {variant && <Btn size="sm" tone="primary" disabled={!perms.publish} onClick={() => promote.mutate({ variantId: variant.id })}>B 版推为全量</Btn>}
          </div>
          <table className="w-full text-[11px]">
            <thead className="text-slate-500"><tr><th className="text-left font-normal">版本</th><th className="text-right font-normal">曝光</th><th className="text-right font-normal">交互</th><th className="text-right font-normal">导出</th><th className="text-right font-normal">交互率</th></tr></thead>
            <tbody>
              {[['A', module.events], ...(variant ? [['B', variant.events]] : [])].map(([k, ev]) => {
                const e = ev as Record<string, number>;
                return <tr key={String(k)} className="border-t border-white/5"><td className="py-1 text-slate-300">{String(k)} 版</td><td className="text-right text-slate-300">{e.view ?? 0}</td><td className="text-right text-slate-300">{e.interact ?? 0}</td><td className="text-right text-slate-300">{e.export ?? 0}</td><td className="text-right text-teal-200">{e.view ? `${(((e.interact ?? 0) / e.view) * 100).toFixed(1)}%` : '—'}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
