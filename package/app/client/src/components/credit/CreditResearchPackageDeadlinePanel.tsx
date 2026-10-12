import { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, GitCompareArrows, GitFork, Save } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Badge, Card, Metric, PanelShell } from '@/components/sovereign/PanelKit';

const LIST_INPUT = { limit: 100 };

function toLocalInput(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toDateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function displayComparableValue(value: unknown) {
  if (value == null || value === '') return '—';
  return value instanceof Date ? value.toISOString() : String(value);
}

function deadlineLabel(state: string, hours: number | null | undefined) {
  if (state === 'overdue') return `已逾期 ${Math.abs(hours ?? 0)} 小时`;
  if (state === 'due_soon') return `${hours ?? 0} 小时内到期`;
  if (state === 'on_track') return `剩余约 ${hours ?? 0} 小时`;
  return '未设置审批时限';
}

function tone(state: string) { return state === 'overdue' ? 'neg' as const : state === 'due_soon' ? 'warn' as const : state === 'on_track' ? 'info' as const : 'neutral' as const; }

export default function CreditResearchPackageDeadlinePanel() {
  const utils = trpc.useUtils();
  const packagesQuery = trpc.creditCollaboration.listPackages.useQuery(LIST_INPUT);
  const allPackages = [...(packagesQuery.data?.own ?? []), ...(packagesQuery.data?.shared ?? [])];
  const [selectedId, setSelectedId] = useState<number | null>(null); const [dueAt, setDueAt] = useState(''); const [reminderDays, setReminderDays] = useState('3'); const [compareLeft, setCompareLeft] = useState<number | null>(null); const [compareRight, setCompareRight] = useState<number | null>(null);
  const selectedRecord = allPackages.find((item) => item.id === selectedId) ?? null;
  const selected = selectedRecord ? { ...selectedRecord, asOfDate: toDateOnly(selectedRecord.asOfDate) } : null;
  const comparisonInput = useMemo(() => compareLeft && compareRight && compareLeft !== compareRight ? { leftPackageId: compareLeft, rightPackageId: compareRight } : null, [compareLeft, compareRight]);
  const comparisonQuery = trpc.creditCollaboration.comparePackageVersions.useQuery(comparisonInput!, { enabled: !!comparisonInput, select: (data) => ({ ...data, changes: data.changes.map((change) => ({ ...change, left: displayComparableValue(change.left), right: displayComparableValue(change.right) })) }) });
  const refresh = () => Promise.all([utils.creditCollaboration.listPackages.invalidate(), utils.creditCollaboration.comparePackageVersions.invalidate(), utils.creditCollaboration.listPackageAudit.invalidate()]);
  const dueMutation = trpc.creditCollaboration.savePackage.useMutation({ onSuccess: async () => { toast.success('审批时限已保存并写入审计轨迹'); await refresh(); }, onError: (error) => toast.error(error.message) });
  const revisionMutation = trpc.creditCollaboration.createPackageRevision.useMutation({ onSuccess: async (result) => { toast.success(`已从批准版本创建修订草稿 v${result.version}`); setSelectedId(result.id); await refresh(); }, onError: (error) => toast.error(error.message) });
  const select = (id: number) => { const item = allPackages.find((row) => row.id === id); if (!item) return; setSelectedId(id); setDueAt(toLocalInput(item.approvalDueAt)); setReminderDays(String(item.approvalReminderDays ?? 3)); setCompareLeft(item.revisionOfPackageId ?? item.id); setCompareRight(item.id); };
  const sections = selected && Array.isArray(selected.sections) ? selected.sections.filter((value): value is string => typeof value === 'string') : [];
  const canEdit = selected?.permission === 'owner' || selected?.permission === 'editor';
  const duePackages = allPackages.filter((item) => item.deadlineState === 'due_soon' || item.deadlineState === 'overdue');
  return <PanelShell ticker="CRAN+" title="审批时限与修订版本控制" subtitle="临期提醒、批准后修订链及逐字段差异比较">
    <div className="grid gap-3 xl:grid-cols-[0.78fr_1.22fr]"><div className="space-y-3"><Card title="审批时限预警" action={<Badge tone={duePackages.some((item) => item.deadlineState === 'overdue') ? 'neg' : duePackages.length ? 'warn' : 'neutral'}>{duePackages.length ? `${duePackages.length} 项关注` : '无临期项'}</Badge>}>{packagesQuery.isLoading ? <div className="h-24 animate-pulse rounded bg-slate-800" /> : allPackages.length === 0 ? <p className="text-xs text-slate-500">在上方研究包面板创建草稿后，可在此设置审批时限并追踪修订链。</p> : <div className="max-h-72 space-y-1 overflow-auto">{allPackages.map((item) => <button type="button" key={`${item.permission}-${item.id}`} onClick={() => select(item.id)} className={`w-full rounded border p-2 text-left ${selectedId === item.id ? 'border-cyan-700 bg-cyan-950/20' : item.deadlineState === 'overdue' ? 'border-rose-900 bg-rose-950/15 hover:border-rose-700' : item.deadlineState === 'due_soon' ? 'border-amber-900 bg-amber-950/15 hover:border-amber-700' : 'border-slate-800 hover:border-slate-600'}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-slate-200">{item.title}</span>{item.deadlineState === 'overdue' || item.deadlineState === 'due_soon' ? <AlertTriangle className={`h-3.5 w-3.5 ${item.deadlineState === 'overdue' ? 'text-rose-300' : 'text-amber-300'}`} /> : <Badge tone="neutral">v{item.version}</Badge>}</div><p className={`mt-1 text-[10px] ${item.deadlineState === 'overdue' ? 'text-rose-300' : item.deadlineState === 'due_soon' ? 'text-amber-300' : 'text-slate-500'}`}>{deadlineLabel(item.deadlineState, item.hoursUntilDue)}{item.revisionOfPackageId ? ` · 修订自 #${item.revisionOfPackageId}` : ''}</p></button>)}</div>}</Card><Card title="临期口径"><p className="text-[11px] text-slate-400">仅“待审阅”状态参与计算。达到设定天数阈值即标为**临期**；超过截止时间即标为**逾期**。状态来自服务器当前时间和账户保存的截止时限，不依据前端样本或猜测。</p></Card></div><div className="space-y-3">{selected ? <><Card title="审批时限设置" action={<Badge tone={tone(selected.deadlineState)}>{deadlineLabel(selected.deadlineState, selected.hoursUntilDue)}</Badge>}><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">审批截止时间<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} disabled={!canEdit || selected.status === 'approved'} className="input-terminal mt-1 w-full disabled:opacity-40" /></label><label className="text-xs text-slate-400">临期提醒阈值（天）<input type="number" min="1" max="30" value={reminderDays} onChange={(event) => setReminderDays(event.target.value)} disabled={!canEdit || selected.status === 'approved'} className="input-terminal mt-1 w-full disabled:opacity-40" /></label></div><p className="mt-2 text-[10px] text-slate-500">提交审批前设置截止时间。时限与修改人会写入审计轨迹；批准版冻结后请创建后续修订版本。</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => dueMutation.mutate({ packageId: selected.id, templateId: selected.templateId, title: selected.title, researchQuestion: selected.researchQuestion, asOfDate: selected.asOfDate ?? null, sourceUrl: selected.sourceUrl, note: selected.note ?? null, sections, approvalDueAt: dueAt ? new Date(dueAt).toISOString() : null, approvalReminderDays: Number(reminderDays) || 3 })} disabled={!canEdit || selected.status === 'approved' || !dueAt || dueMutation.isPending} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-3 py-1.5 text-xs text-cyan-200 disabled:opacity-40"><Save className="h-3.5 w-3.5" />保存时限</button>{selected.status === 'approved' && selected.permission === 'owner' && <button type="button" onClick={() => revisionMutation.mutate({ approvedPackageId: selected.id })} disabled={revisionMutation.isPending} className="inline-flex items-center gap-1 rounded border border-violet-800 px-3 py-1.5 text-xs text-violet-200 disabled:opacity-40"><GitFork className="h-3.5 w-3.5" />创建后续修订</button>}</div></Card><Card title="关联版本差异比较" action={<GitCompareArrows className="h-4 w-4 text-cyan-300" />}><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">基准版本<select value={compareLeft ?? ''} onChange={(event) => setCompareLeft(Number(event.target.value) || null)} className="input-terminal mt-1 w-full"><option value="">选择版本</option>{allPackages.map((item) => <option key={item.id} value={item.id}>#{item.id} · v{item.version} · {item.title}</option>)}</select></label><label className="text-xs text-slate-400">对比版本<select value={compareRight ?? ''} onChange={(event) => setCompareRight(Number(event.target.value) || null)} className="input-terminal mt-1 w-full"><option value="">选择版本</option>{allPackages.map((item) => <option key={item.id} value={item.id}>#{item.id} · v{item.version} · {item.title}</option>)}</select></label></div>{comparisonQuery.isFetching ? <div className="mt-3 h-24 animate-pulse rounded bg-slate-800" /> : comparisonQuery.error ? <div className="mt-3 rounded border border-amber-900 bg-amber-950/15 p-3 text-xs text-amber-200">{comparisonQuery.error.message}</div> : comparisonQuery.data ? <div className="mt-3"><div className="grid gap-2 sm:grid-cols-3"><Metric label="关联根版本" value={`#${comparisonQuery.data.rootPackageId}`} /><Metric label="已变更字段" value={String(comparisonQuery.data.changes.length)} unit="项" tone={comparisonQuery.data.changes.length ? 'warn' : 'pos'} /><Metric label="未变更字段" value={String(comparisonQuery.data.unchangedCount)} unit="项" /></div><div className="mt-3 max-h-52 overflow-auto">{comparisonQuery.data.changes.length ? comparisonQuery.data.changes.map((change) => <div key={change.key} className="border-t border-slate-800 py-2 text-xs"><p className="text-cyan-200">{change.label}</p><div className="mt-1 grid gap-1 text-[10px] sm:grid-cols-2"><p className="rounded bg-rose-950/20 p-1 text-rose-200">旧：{change.left || '—'}</p><p className="rounded bg-emerald-950/20 p-1 text-emerald-200">新：{change.right || '—'}</p></div></div>) : <p className="text-xs text-slate-500">所选关联版本在可比较字段中没有变化。</p>}</div></div> : <p className="mt-3 text-xs text-slate-500">选择同一修订链中的两个版本，即可查看标题、问题、来源、章节、时限及备注的逐字段变化。</p>}</Card></> : <div className="rounded border border-dashed border-slate-700 px-3 py-14 text-center text-xs text-slate-500">从左侧选择研究包，以设置审批时限、创建后续修订或比较关联版本。</div>}</div></div>
  </PanelShell>;
}
