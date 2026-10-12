/**
 * 数据规则：字段映射 → 格式转换 → 计算字段 → 行过滤 → 缺失值 → 去重 → 脱敏 → 推送方式。
 * “验证清洗效果”用上次的原始数据试跑，不入库；保存后立即重跑生成新版本。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Copy, Eye, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  UC_FILTER_OPS, UC_MASK_METHODS, UC_TRANSFORM_OPS,
  type UcField, type UcPipelineConfig,
} from '@shared/ucheerModules';
import { Btn, Field, PreviewTable, Toggle, inputCls, smallInputCls } from './ui';

function Section({ title, extra, children, defaultOpen = true }: { title: ReactNode; extra?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-white/5">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11px] font-medium text-slate-300">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{title}</button>
        {open && extra}
      </div>
      {open && <div className="border-t border-white/5 p-2">{children}</div>}
    </div>
  );
}

const MASK_LABEL: Record<string, string> = { hide: '隐藏字段', hash: '哈希', partial: '部分遮掩', replace: '替换为', round: '取整到' };

export default function RulesEditor({ datasetId, canEdit, onSaved }: { datasetId: number; canEdit: boolean; onSaved?: () => void }) {
  const utils = trpc.useUtils();
  const ds = trpc.ucAdmin.dataset.useQuery({ id: datasetId });
  const [pipeline, setPipeline] = useState<UcPipelineConfig | null>(null);
  const [fields, setFields] = useState<UcField[]>([]);
  useEffect(() => {
    if (!ds.data) return;
    setPipeline(ds.data.pipeline);
    setFields((ds.data.pipeline.cleaning.fields.length ? ds.data.pipeline.cleaning.fields : ds.data.fields).filter((f) => !f.source.startsWith('=')));
  }, [ds.data]);
  const previewRules = trpc.ucAdmin.previewRules.useMutation({ onError: (e) => toast.error(e.message) });
  const saveRules = trpc.ucAdmin.saveRules.useMutation({
    onSuccess: (r) => { toast.success(`规则已保存，已重新入库（${r.datasets.map((d) => `v${d.version}`).join('、')}）`); void utils.ucAdmin.invalidate(); onSaved?.(); },
    onError: (e) => toast.error(e.message),
  });
  if (!pipeline || !ds.data) return <div className="p-4 text-xs text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />加载规则…</div>;

  const c = pipeline.cleaning;
  const setC = (patch: Partial<UcPipelineConfig['cleaning']>) => setPipeline({ ...pipeline, cleaning: { ...c, ...patch } });
  const full: UcPipelineConfig = { ...pipeline, cleaning: { ...c, fields } };
  const kept = fields.filter((f) => !c.dropped.includes(f.source));
  const allNames = [...kept.map((f) => ({ name: f.name, label: f.label })), ...c.derived.map((d) => ({ name: d.name, label: d.label || d.name }))];
  const setField = (i: number, patch: Partial<UcField>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const s = previewRules.data?.stats;
  const triggerUrl = pipeline.push.token ? `${window.location.origin}/api/uc/trigger/${pipeline.push.token}` : '';
  const FieldSel = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={smallInputCls}>{allNames.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}</select>
  );

  return (
    <div className="space-y-2 text-xs">
      <Section title={`字段映射与类型（${kept.length}/${fields.length} 列保留）`}>
        <div className="max-h-72 overflow-auto">
          <table className="w-full">
            <thead className="text-[10px] text-slate-500"><tr><th className="px-1 py-1 text-left">原始列</th><th className="px-1 py-1 text-left">字段名</th><th className="px-1 py-1 text-left">显示名</th><th className="px-1 py-1 text-left">类型</th><th className="px-1 py-1">保留</th></tr></thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.source} className="border-t border-white/5">
                  <td className="max-w-[100px] truncate px-1 py-1 font-mono text-[10px] text-slate-500" title={f.source}>{f.source}</td>
                  <td className="px-1 py-1"><input value={f.name} onChange={(e) => setField(i, { name: e.target.value.slice(0, 120) || f.name })} className={smallInputCls} /></td>
                  <td className="px-1 py-1"><input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className={smallInputCls} /></td>
                  <td className="px-1 py-1"><select value={f.type} onChange={(e) => setField(i, { type: e.target.value as UcField['type'] })} className={smallInputCls}><option value="number">数值</option><option value="percent">百分比</option><option value="date">日期</option><option value="string">文本</option></select></td>
                  <td className="px-1 py-1 text-center"><input type="checkbox" checked={!c.dropped.includes(f.source)} onChange={(e) => setC({ dropped: e.target.checked ? c.dropped.filter((d) => d !== f.source) : [...c.dropped, f.source] })} className="accent-teal-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400"><input type="checkbox" checked={c.trim} onChange={(e) => setC({ trim: e.target.checked })} className="accent-teal-400" />去掉首尾空格、全角转半角、去千分位</label>
      </Section>

      <Section title={`格式转换（${c.transforms.length}）`} extra={<button type="button" onClick={() => setC({ transforms: [...c.transforms, { field: allNames[0]?.name ?? '', op: 'scale', param: '' }] })} className="text-[11px] text-teal-300 hover:text-teal-100">+ 添加</button>}>
        {c.transforms.map((t, i) => {
          const op = UC_TRANSFORM_OPS.find((o) => o.code === t.op);
          return (
            <div key={i} className="mb-1 grid grid-cols-[1fr_1fr_1fr_20px] gap-1">
              <FieldSel value={t.field} onChange={(v) => setC({ transforms: c.transforms.map((x, j) => (j === i ? { ...x, field: v } : x)) })} />
              <select value={t.op} onChange={(e) => setC({ transforms: c.transforms.map((x, j) => (j === i ? { ...x, op: e.target.value as typeof t.op } : x)) })} className={smallInputCls}>{UC_TRANSFORM_OPS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
              <input value={t.param} disabled={!op?.param} placeholder={op?.param ?? ''} onChange={(e) => setC({ transforms: c.transforms.map((x, j) => (j === i ? { ...x, param: e.target.value } : x)) })} className={smallInputCls} />
              <button type="button" onClick={() => setC({ transforms: c.transforms.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
        {!c.transforms.length && <p className="text-[10px] text-slate-600">例：成交额 × 0.0001 转为万元；涨跌幅 小数→百分数；代码 加前缀；日期 只保留年月。</p>}
      </Section>

      <Section title={`计算字段（${c.derived.length}）`} defaultOpen={c.derived.length > 0} extra={<button type="button" onClick={() => setC({ derived: [...c.derived, { name: `计算${c.derived.length + 1}`, label: '', expr: '', type: 'number' }] })} className="text-[11px] text-teal-300 hover:text-teal-100">+ 添加</button>}>
        {c.derived.map((d, i) => (
          <div key={i} className="mb-1 grid grid-cols-[1fr_2fr_80px_20px] gap-1">
            <input value={d.name} onChange={(e) => setC({ derived: c.derived.map((x, j) => (j === i ? { ...x, name: e.target.value, label: e.target.value } : x)) })} placeholder="字段名" className={smallInputCls} />
            <input value={d.expr} onChange={(e) => setC({ derived: c.derived.map((x, j) => (j === i ? { ...x, expr: e.target.value } : x)) })} placeholder="[收盘] / [开盘] * 100 - 100" className={`${smallInputCls} font-mono`} />
            <select value={d.type} onChange={(e) => setC({ derived: c.derived.map((x, j) => (j === i ? { ...x, type: e.target.value as 'number' | 'percent' } : x)) })} className={smallInputCls}><option value="number">数值</option><option value="percent">百分比</option></select>
            <button type="button" onClick={() => setC({ derived: c.derived.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <p className="text-[10px] text-slate-600">支持 + − × ÷ 和括号；字段写成 [字段名]。可用字段：{kept.slice(0, 12).map((f) => f.name).join('、')}</p>
      </Section>

      <Section title={`行过滤（${c.filters.length}）`} defaultOpen={c.filters.length > 0} extra={<button type="button" onClick={() => setC({ filters: [...c.filters, { field: allNames[0]?.name ?? '', op: 'not_empty', value: '' }] })} className="text-[11px] text-teal-300 hover:text-teal-100">+ 添加</button>}>
        {c.filters.map((f, i) => (
          <div key={i} className="mb-1 grid grid-cols-[1fr_1fr_1fr_20px] gap-1">
            <FieldSel value={f.field} onChange={(v) => setC({ filters: c.filters.map((x, j) => (j === i ? { ...x, field: v } : x)) })} />
            <select value={f.op} onChange={(e) => setC({ filters: c.filters.map((x, j) => (j === i ? { ...x, op: e.target.value as typeof f.op } : x)) })} className={smallInputCls}>{UC_FILTER_OPS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
            <input value={f.value} disabled={f.op === 'not_empty'} onChange={(e) => setC({ filters: c.filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className={smallInputCls} />
            <button type="button" onClick={() => setC({ filters: c.filters.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <p className="text-[10px] text-slate-600">所有条件都满足的行才入库。</p>
      </Section>

      <Section title="缺失值与去重">
        <div className="grid grid-cols-2 gap-2">
          <Field label="缺失值处理"><select value={c.missing} onChange={(e) => setC({ missing: e.target.value as typeof c.missing })} className={inputCls}><option value="keep">保留为空</option><option value="drop_row">丢弃含空值的行</option><option value="fill_zero">数值补 0</option><option value="fill_previous">沿用上一行</option></select></Field>
          <Field label="重复时保留"><select value={pipeline.dedup.strategy} onChange={(e) => setPipeline({ ...pipeline, dedup: { ...pipeline.dedup, strategy: e.target.value as 'latest' | 'earliest' } })} className={inputCls}><option value="latest">最新一条</option><option value="earliest">最早一条</option></select></Field>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">去重 key（不选 = 整行完全相同才算重复）</div>
        <div className="mt-1 flex flex-wrap gap-1">{allNames.map((f) => {
          const on = pipeline.dedup.keys.includes(f.name);
          return <button key={f.name} type="button" onClick={() => setPipeline({ ...pipeline, dedup: { ...pipeline.dedup, keys: on ? pipeline.dedup.keys.filter((k) => k !== f.name) : [...pipeline.dedup.keys, f.name] } })} className={`rounded-md border px-2 py-0.5 text-[11px] ${on ? 'border-teal-400/50 bg-teal-400/10 text-teal-50' : 'border-white/10 text-slate-400'}`}>{f.label}</button>;
        })}</div>
      </Section>

      <Section title={`脱敏（${pipeline.masking.length}）`} extra={<button type="button" onClick={() => setPipeline({ ...pipeline, masking: [...pipeline.masking, { field: allNames[0]?.name ?? '', method: 'partial', param: '1', scope: 'frontend' }] })} className="text-[11px] text-teal-300 hover:text-teal-100">+ 添加</button>}>
        {pipeline.masking.map((r, i) => (
          <div key={i} className="mb-1 grid grid-cols-[1fr_90px_64px_110px_20px] gap-1">
            <FieldSel value={r.field} onChange={(v) => setPipeline({ ...pipeline, masking: pipeline.masking.map((x, j) => (j === i ? { ...x, field: v } : x)) })} />
            <select value={r.method} onChange={(e) => setPipeline({ ...pipeline, masking: pipeline.masking.map((x, j) => (j === i ? { ...x, method: e.target.value as typeof r.method } : x)) })} className={smallInputCls}>{UC_MASK_METHODS.map((m) => <option key={m} value={m}>{MASK_LABEL[m]}</option>)}</select>
            <input value={r.param} disabled={r.method === 'hide' || r.method === 'hash'} onChange={(e) => setPipeline({ ...pipeline, masking: pipeline.masking.map((x, j) => (j === i ? { ...x, param: e.target.value } : x)) })} placeholder={r.method === 'round' ? '位数' : r.method === 'replace' ? '***' : r.method === 'partial' ? '保留几位' : ''} className={smallInputCls} />
            <select value={r.scope} onChange={(e) => setPipeline({ ...pipeline, masking: pipeline.masking.map((x, j) => (j === i ? { ...x, scope: e.target.value as 'frontend' | 'everyone' } : x)) })} className={smallInputCls}><option value="frontend">只对前端</option><option value="everyone">后台也脱敏</option></select>
            <button type="button" onClick={() => setPipeline({ ...pipeline, masking: pipeline.masking.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <p className="text-[10px] text-slate-600">“后台也脱敏”时，只有拥有“查看脱敏前原值”权限的成员能看到原值。名为 来源 / source / provider / url 的字段自动对前端隐藏。</p>
      </Section>

      <Section title="推送到前端的方式">
        <div className="grid grid-cols-3 gap-1">
          {([['realtime', '实时', '入库即推送'], ['schedule', '定时', '按间隔或每天固定时间'], ['trigger', '触发', '外部系统调用地址时推送']] as const).map(([k, l, d]) => (
            <button key={k} type="button" onClick={() => setPipeline({ ...pipeline, push: { ...pipeline.push, mode: k } })} className={`rounded-lg border px-2 py-1.5 text-left ${pipeline.push.mode === k ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/5 hover:border-white/15'}`}><div className="text-xs text-slate-100">{l}</div><div className="text-[10px] text-slate-500">{d}</div></button>
          ))}
        </div>
        {pipeline.push.mode === 'schedule' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="每隔（分钟）"><input type="number" min={1} max={10080} value={pipeline.push.everyMinutes} disabled={!!pipeline.push.at} onChange={(e) => setPipeline({ ...pipeline, push: { ...pipeline.push, everyMinutes: Math.max(1, Number(e.target.value) || 60) } })} className={inputCls} /></Field>
            <Field label="或每天固定时间（北京时间）"><input type="time" value={pipeline.push.at} onChange={(e) => setPipeline({ ...pipeline, push: { ...pipeline.push, at: e.target.value } })} className={inputCls} /></Field>
          </div>
        )}
        {pipeline.push.mode === 'trigger' && (
          <div className="mt-2 space-y-1">
            {triggerUrl ? (
              <div className="flex items-center gap-1"><code className="flex-1 truncate rounded bg-black/40 px-2 py-1 text-[10px] text-teal-200">{triggerUrl}</code><Btn size="sm" onClick={() => { void navigator.clipboard?.writeText(triggerUrl); toast.success('已复制触发地址'); }}><Copy className="h-3 w-3" />复制</Btn></div>
            ) : <p className="text-[10px] text-slate-500">保存后生成触发地址。</p>}
            <p className="text-[10px] text-slate-600">GET 或 POST 该地址即推送最新候选版本；加 ?run=1 先重新拉取数据再推送。</p>
            {pipeline.push.token && <button type="button" onClick={() => setPipeline({ ...pipeline, push: { ...pipeline.push, token: '' } })} className="text-[10px] text-amber-300 hover:text-amber-100">重新生成地址（旧地址失效）</button>}
          </div>
        )}
        <div className="mt-2"><Toggle checked={pipeline.reviewRequired} onChange={(v) => setPipeline({ ...pipeline, reviewRequired: v })} label="新版本需要审核通过后才推送" /></div>
      </Section>

      {(c.overrides.length > 0 || c.excludedKeys.length > 0) && <p className="rounded-md border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[11px] text-amber-200">当前有 {c.overrides.length} 处人工修正、{c.excludedKeys.length} 行人工删除（在“数据浏览”里管理），重跑后依然生效。</p>}

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-white/5 bg-[#081114] pt-2">
        <Btn disabled={previewRules.isPending} onClick={() => previewRules.mutate({ id: datasetId, pipeline: full })}>{previewRules.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}验证清洗效果</Btn>
        <Btn tone="primary" disabled={!canEdit || saveRules.isPending} onClick={() => saveRules.mutate({ id: datasetId, pipeline: full })}>{saveRules.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}保存规则并重新入库</Btn>
        {!canEdit && <span className="self-center text-[10px] text-slate-500">当前角色只能查看规则</span>}
      </div>
      {s && previewRules.data && (
        <div className="space-y-2 rounded-lg border border-teal-400/15 bg-teal-400/[0.04] p-2">
          <div className="text-[11px] text-slate-300">原始 {s.rowsIn} 行 → 清洗后 {s.rowsCleaned} → 去重后 {s.rowsDeduped}；重复 {s.duplicates}，无效单元格 {s.invalidCells}，过滤 {s.filteredRows ?? 0}，丢弃 {s.droppedRows}</div>
          <div className="text-[10px] text-slate-500">前端看到的数据（前 15 行）</div>
          <PreviewTable columns={Object.keys(previewRules.data.view[0] ?? {})} rows={previewRules.data.view as Array<Record<string, unknown>>} />
        </div>
      )}
    </div>
  );
}
