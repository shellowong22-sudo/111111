/**
 * 推送中心、权限管理、日志与监控。
 */
import { useState } from 'react';
import { AlertTriangle, Copy, Loader2, Radio, RefreshCw, Rocket, Search, ShieldCheck, UserMinus, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { StepList } from './SourcesPanel';
import { Btn, Empty, Pill, Toggle, fmtTime, inputCls, pushModeText, smallInputCls, statusText } from './ui';

/* ================================================================== 推送中心 */

export function PushCenter({ canPublish, onOpenDataset }: { canPublish: boolean; onOpenDataset: (id: number) => void }) {
  const utils = trpc.useUtils();
  const status = trpc.ucAdmin.pushStatus.useQuery(undefined, { refetchInterval: 10_000 });
  const pushNow = trpc.ucAdmin.pushNow.useMutation({ onSuccess: (r) => { toast.success(`已推送 v${r.version}`); void utils.ucAdmin.invalidate(); }, onError: (e) => toast.error(e.message) });
  const [modeFilter, setModeFilter] = useState('all');
  const d = status.data;
  const market = (d?.market ?? {}) as Record<string, { fails: number; paused: boolean; lastOk: number; lastError: string | null }>;
  const okCount = (d?.log ?? []).filter((l) => l.status === 'succeeded').length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div className="flex items-center gap-1.5 text-lg font-semibold text-teal-200"><Wifi className="h-4 w-4" />{d?.liveClients ?? '…'}</div><div className="text-[10px] text-slate-500">正在接收推送的前端页面</div></div>
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div className="text-lg font-semibold text-slate-100">{d?.log.length ?? '…'}</div><div className="text-[10px] text-slate-500">最近推送记录</div></div>
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div className="text-lg font-semibold text-emerald-300">{d?.log.length ? `${Math.round((okCount / d.log.length) * 100)}%` : '—'}</div><div className="text-[10px] text-slate-500">推送成功率</div></div>
        <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div className="text-lg font-semibold text-amber-300">{(d?.datasets ?? []).reduce((n, x) => n + x.candidates, 0)}</div><div className="text-[10px] text-slate-500">等待推送的候选版本</div></div>
      </div>

      <div className="rounded-xl border border-white/5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-xs text-slate-300">
          <span className="flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5 text-teal-300" />各数据集推送方式</span>
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={`${smallInputCls} w-32`}><option value="all">全部方式</option>{Object.entries(pushModeText).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <div className="max-h-[40vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.03] text-left text-slate-400"><tr>{['数据集', '方式', '规则', '前端版本 / 最新', '待推送', '最近推送', '操作'].map((h) => <th key={h} className="px-3 py-1.5 font-normal">{h}</th>)}</tr></thead>
            <tbody>
              {(d?.datasets ?? []).filter((x) => modeFilter === 'all' || x.mode === modeFilter).map((x) => {
                const url = x.token ? `${window.location.origin}/api/uc/trigger/${x.token}` : '';
                return (
                  <tr key={x.id} className="border-t border-white/5">
                    <td className="px-3 py-1.5"><button type="button" onClick={() => onOpenDataset(x.id)} className="text-slate-100 hover:text-teal-200">{x.name}</button></td>
                    <td className="px-3 py-1.5"><Pill tone={x.mode === 'realtime' ? 'on' : 'info'}>{pushModeText[x.mode]}</Pill>{x.reviewRequired && <span className="ml-1"><Pill tone="candidate">需审核</Pill></span>}</td>
                    <td className="px-3 py-1.5 text-[11px] text-slate-400">{x.mode === 'schedule' ? (x.at ? `每天 ${x.at}` : `每 ${x.everyMinutes} 分钟`) : x.mode === 'trigger' ? (url ? <button type="button" onClick={() => { void navigator.clipboard?.writeText(url); toast.success('已复制触发地址'); }} className="inline-flex items-center gap-1 text-teal-300"><Copy className="h-3 w-3" />复制触发地址</button> : '保存规则后生成') : '入库即推送'}</td>
                    <td className="px-3 py-1.5 text-slate-300">v{x.publishedVersion} / v{x.currentVersion}</td>
                    <td className="px-3 py-1.5">{x.candidates ? <Pill tone="waiting">{x.candidates} 个</Pill> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-1.5 text-[11px] text-slate-500">{fmtTime(x.lastPush)}</td>
                    <td className="px-3 py-1.5"><Btn size="sm" tone="primary" disabled={!canPublish || pushNow.isPending} onClick={() => pushNow.mutate({ id: x.id })}>{pushNow.isPending && pushNow.variables?.id === x.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}立即推送</Btn></td>
                  </tr>
                );
              })}
              {!d?.datasets.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">还没有数据集</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-slate-300"><span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-teal-300" />推送记录</span><Btn size="sm" tone="ghost" onClick={() => void status.refetch()}><RefreshCw className="h-3 w-3" /></Btn></div>
          <div className="max-h-[46vh] overflow-y-auto">
            {(d?.log ?? []).map((l) => (
              <div key={l.id} className="grid grid-cols-[64px_70px_1fr_120px] items-center gap-2 border-b border-white/5 px-3 py-1.5 text-[11px]">
                <Pill tone={l.status}>{statusText[l.status] ?? l.status}</Pill>
                <span className="text-slate-400">{({ realtime: '实时', schedule: '定时', trigger: '触发', manual: '手动', review: '审核通过' } as Record<string, string>)[l.mode] ?? l.mode}</span>
                <span className="truncate text-slate-300" title={l.detail}>{l.dataset_name ?? '—'} v{l.version} · {l.detail} · 在线页面 {l.clients}</span>
                <span className="text-right text-slate-500">{fmtTime(l.created_at)}</span>
              </div>
            ))}
            {!d?.log.length && <Empty>还没有推送记录</Empty>}
          </div>
        </div>
        <div className="rounded-xl border border-white/5">
          <div className="border-b border-white/5 px-3 py-2 text-xs text-slate-300">实时行情通道（WEI 与“实时行情K线”模块）</div>
          <div className="space-y-1 p-3">
            {Object.entries(market).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-300">{({ qq: '通道 A（A股 / 港股 / 美股）', yahoo: '通道 B（全球指数 / 期货 / 外汇）', sina: '通道 C（备用）', em: '通道 D（备用）' } as Record<string, string>)[k] ?? k}</span>
                <span className="flex items-center gap-2"><Pill tone={v.paused ? 'failed' : v.lastOk ? 'succeeded' : 'never'}>{v.paused ? '暂停 60 秒' : v.lastOk ? '正常' : '未使用'}</Pill><span className="text-slate-500">{v.lastOk ? fmtTime(v.lastOk) : ''}</span></span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-slate-600">某个通道连续失败会自动暂停并切换到下一个，前端不受影响。</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== 权限管理 */

export function MembersPanel({ selfId }: { selfId: number }) {
  const utils = trpc.useUtils();
  const data = trpc.ucAdmin.members.useQuery();
  const setMember = trpc.ucAdmin.setMember.useMutation({ onSuccess: () => { toast.success('已保存'); void utils.ucAdmin.members.invalidate(); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.ucAdmin.removeMember.useMutation({ onSuccess: () => { toast.success('已移除'); void utils.ucAdmin.members.invalidate(); }, onError: (e) => toast.error(e.message) });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  if (data.error) return <Empty>{data.error.message}</Empty>;
  if (!data.data) return <div className="p-6 text-xs text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />加载成员…</div>;
  const { roles, permissions, sources, users } = data.data;
  const list = users.filter((u) => !q || u.name.includes(q) || u.email.includes(q));
  const effective = (roleKey: string | null, custom: Record<string, unknown>) => {
    const base = roles.find((r) => r.key === roleKey)?.perms as Record<string, boolean> | undefined;
    return Object.fromEntries(permissions.map((p) => [p.key, typeof custom[p.key] === 'boolean' ? (custom[p.key] as boolean) : !!base?.[p.key]]));
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5">
        {roles.map((r) => (
          <div key={r.key} className="rounded-xl border border-white/5 bg-black/20 p-2">
            <div className="flex items-center gap-1 text-xs font-medium text-slate-100"><ShieldCheck className="h-3.5 w-3.5 text-teal-300" />{r.label}</div>
            <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">{permissions.filter((p) => (r.perms as Record<string, boolean>)[p.key]).map((p) => <li key={p.key}>· {p.label}</li>)}{!permissions.some((p) => (r.perms as Record<string, boolean>)[p.key]) && <li>· 只能查看</li>}</ul>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2"><div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#071012] px-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索用户" className="h-8 w-56 bg-transparent text-xs text-slate-100 outline-none" /></div><span className="text-[11px] text-slate-500">系统管理员默认是“管理员”；给任何用户设置角色后，他就能进入数据工作台，能做的事按角色和下面的细项决定。</span></div>
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="bg-white/[0.03] text-left text-slate-400"><tr>{['用户', '系统角色', '工作台角色', '数据源范围', '最近登录', '操作'].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((u) => {
              const custom = u.custom as Record<string, unknown>;
              const eff = effective(u.ucRole, custom);
              const sourceIds = (custom.sourceIds as number[] | 'all' | undefined) ?? 'all';
              const save = (patch: { role?: string; custom?: Record<string, boolean>; sourceIds?: number[] | 'all' }) => setMember.mutate({
                userId: u.id,
                role: (patch.role ?? u.ucRole ?? 'developer') as 'admin',
                custom: patch.custom ?? Object.fromEntries(Object.entries(custom).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>,
                sourceIds: patch.sourceIds ?? sourceIds,
              });
              return [
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-3 py-2"><div className="text-slate-100">{u.name || '（未命名）'}{u.id === selfId && <span className="ml-1 text-[10px] text-teal-300">我</span>}</div><div className="text-[10px] text-slate-600">{u.email}</div></td>
                  <td className="px-3 py-2 text-slate-400">{({ admin: '系统管理员', user: '普通用户', trader: '交易员', risk_manager: '风控' } as Record<string, string>)[u.systemRole] ?? u.systemRole}</td>
                  <td className="px-3 py-2">
                    <select value={u.member ? u.ucRole ?? '' : u.systemRole === 'admin' ? 'admin-default' : ''} onChange={(e) => e.target.value && e.target.value !== 'admin-default' && save({ role: e.target.value })} className={`${smallInputCls} w-36`}>
                      {!u.member && <option value={u.systemRole === 'admin' ? 'admin-default' : ''}>{u.systemRole === 'admin' ? '管理员（默认）' : '未加入'}</option>}
                      {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{sourceIds === 'all' ? '全部数据源' : `${sourceIds.length} 个数据源`}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-500">{fmtTime(u.lastSignedIn)}</td>
                  <td className="px-3 py-2"><div className="flex gap-1">{(u.member || u.systemRole === 'admin') && <Btn size="sm" tone="ghost" onClick={() => setOpen(open === u.id ? null : u.id)}>细项权限</Btn>}{u.member && u.id !== selfId && <Btn size="sm" tone="ghost" onClick={() => remove.mutate({ userId: u.id })}><UserMinus className="h-3 w-3" />移出</Btn>}</div></td>
                </tr>,
                open === u.id && (
                  <tr key={`${u.id}-detail`} className="bg-black/20">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-slate-400">细项权限（覆盖角色默认值）</div>
                          {permissions.map((p) => <Toggle key={p.key} checked={!!eff[p.key]} onChange={(v) => save({ role: u.ucRole ?? 'admin', custom: { ...Object.fromEntries(Object.entries(custom).filter(([, x]) => typeof x === 'boolean')) as Record<string, boolean>, [p.key]: v } })} label={p.label} />)}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-400"><span>可见的数据源</span><Toggle checked={sourceIds === 'all'} onChange={(v) => save({ role: u.ucRole ?? 'admin', sourceIds: v ? 'all' : [] })} label="全部" /></div>
                          {sourceIds !== 'all' && <div className="max-h-48 space-y-0.5 overflow-y-auto">{sources.map((s) => <label key={s.id} className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={sourceIds.includes(s.id)} onChange={(e) => save({ role: u.ucRole ?? 'admin', sourceIds: e.target.checked ? [...sourceIds, s.id] : sourceIds.filter((x) => x !== s.id) })} className="accent-teal-400" />{s.name}<span className="text-slate-600">#{s.id}</span></label>)}</div>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================== 日志与监控 */

export function MonitorPanel() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<'all' | 'succeeded' | 'failed' | 'running'>('all');
  const runs = trpc.ucAdmin.runs.useQuery({ status }, { refetchInterval: 15_000 });
  const alerts = trpc.ucAdmin.alerts.useQuery(undefined, { refetchInterval: 15_000 });
  const [auditQ, setAuditQ] = useState('');
  const audit = trpc.ucAdmin.auditLog.useQuery({ search: auditQ });
  const ack = trpc.ucAdmin.ackAlert.useMutation({ onSuccess: () => void utils.ucAdmin.invalidate() });
  const [openRun, setOpenRun] = useState<number | null>(null);
  const steps = trpc.ucAdmin.runSteps.useQuery({ runId: openRun ?? 0 }, { enabled: !!openRun });
  const [tab, setTab] = useState<'runs' | 'alerts' | 'audit'>('runs');
  const openAlerts = (alerts.data ?? []).filter((a) => a.status === 'open');
  const failed = (runs.data ?? []).filter((r) => r.status === 'failed').length;
  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1">
        {([['runs', `全链路运行记录（${runs.data?.length ?? 0}）`], ['alerts', `告警（未处理 ${openAlerts.length}）`], ['audit', '操作日志']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-xs ${tab === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>)}
      </nav>
      {tab === 'runs' && (
        <div className="rounded-xl border border-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-xs text-slate-300">
            <span>接入 → 清洗 → 去重 → 脱敏 → 入库 → 推送，每一步都有记录{failed ? <span className="ml-2 text-red-300">本页失败 {failed} 次</span> : null}</span>
            <div className="flex gap-1"><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${smallInputCls} w-28`}><option value="all">全部状态</option><option value="succeeded">成功</option><option value="failed">失败</option><option value="running">运行中</option></select><Btn size="sm" tone="ghost" onClick={() => void runs.refetch()}><RefreshCw className="h-3 w-3" /></Btn></div>
          </div>
          <div className="max-h-[68vh] overflow-y-auto">
            {(runs.data ?? []).map((r) => (
              <div key={r.id} className="border-b border-white/5">
                <button type="button" onClick={() => setOpenRun(openRun === r.id ? null : r.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.02]">
                  <span className="flex items-center gap-2"><Pill tone={r.status}>{statusText[r.status] ?? r.status}</Pill><span className="text-slate-200">{r.source_name ?? `#${r.source_id}`}</span><span className="text-[10px] text-slate-500">{({ upload: '上传', manual: '手动', schedule: '定时', rules: '规则变更' } as Record<string, string>)[r.trigger_kind] ?? r.trigger_kind}</span></span>
                  <span className="text-[10px] text-slate-500">{fmtTime(r.started_at)}</span>
                </button>
                {r.error && <p className="px-3 pb-2 text-[11px] text-red-300/80">{r.error}</p>}
                {openRun === r.id && <StepList steps={steps.data ?? []} />}
              </div>
            ))}
            {!runs.data?.length && <Empty>暂无运行记录</Empty>}
          </div>
        </div>
      )}
      {tab === 'alerts' && (
        <div className="rounded-xl border border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-slate-300"><span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-300" />推送失败、运行失败、数据质量异常都会在这里告警</span>{openAlerts.length > 0 && <Btn size="sm" tone="ghost" onClick={() => ack.mutate({})}>全部标记已处理</Btn>}</div>
          <div className="max-h-[68vh] overflow-y-auto">
            {(alerts.data ?? []).map((a) => (
              <div key={a.id} className={`flex items-start justify-between gap-2 border-b border-white/5 px-3 py-2 text-xs ${a.status === 'open' ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-2"><Pill tone={a.severity}>{statusText[a.severity] ?? a.severity}</Pill><div><div className={a.severity === 'critical' ? 'text-red-200' : 'text-slate-200'}>{a.message}</div><div className="text-[10px] text-slate-600">{({ pipeline_failed: '运行失败', push_failed: '推送失败', quality: '数据质量' } as Record<string, string>)[a.kind] ?? a.kind} · {a.ref} · {fmtTime(a.created_at)}</div></div></div>
                {a.status === 'open' && <Btn size="sm" tone="ghost" onClick={() => ack.mutate({ id: a.id })}>已处理</Btn>}
              </div>
            ))}
            {!alerts.data?.length && <Empty>没有告警</Empty>}
          </div>
        </div>
      )}
      {tab === 'audit' && (
        <div className="rounded-xl border border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={auditQ} onChange={(e) => setAuditQ(e.target.value)} placeholder="搜索操作人 / 动作 / 对象" className={`${inputCls} h-7 max-w-xs`} /></div>
          <div className="max-h-[68vh] overflow-y-auto">
            {(audit.data ?? []).map((a) => (
              <div key={a.id} className="grid grid-cols-[130px_90px_120px_1fr] items-center gap-2 border-b border-white/5 px-3 py-1.5 text-[11px]">
                <span className="text-slate-500">{fmtTime(a.created_at)}</span>
                <span className="truncate text-slate-300">{a.user_name || `#${a.user_id ?? '—'}`}</span>
                <span className="text-teal-200">{a.action}</span>
                <span className="truncate text-slate-400" title={a.detail}>{a.target} {a.detail}</span>
              </div>
            ))}
            {!audit.data?.length && <Empty>暂无操作记录</Empty>}
          </div>
        </div>
      )}
    </div>
  );
}
