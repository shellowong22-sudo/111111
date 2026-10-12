import { useEffect, useState } from 'react';
import { getLoginUrl } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { CheckCircle2, Clock3, History, LogIn, ShieldCheck, UserRoundCheck, XCircle } from 'lucide-react';
import { Card, LoadingState } from './PanelKit';
import { useRef } from 'react';
import ExportMenu from '@/components/ExportMenu';

type Props = {
  moduleCode: string;
  visibleModuleCodes?: string[];
  title?: string;
  description?: string;
};

const statusStyle = {
  submitted: { label: '待审批', className: 'text-amber-300', Icon: Clock3 },
  approved: { label: '已批准', className: 'text-emerald-300', Icon: CheckCircle2 },
  rejected: { label: '已驳回', className: 'text-rose-300', Icon: XCircle },
} as const;

function approvalCountdown(value: Date | string, now: number) {
  const milliseconds = new Date(value).getTime() - now;
  if (milliseconds <= 0) return { label: `已逾期 ${Math.ceil(Math.abs(milliseconds) / 3_600_000)} 小时`, className: 'text-rose-300' };
  const totalMinutes = Math.ceil(milliseconds / 60_000); const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60;
  return { label: `${hours} 小时 ${minutes} 分后到期`, className: totalMinutes <= 120 ? 'text-amber-300' : 'text-cyan-300' };
}

function formatShanghaiTime(value: Date | string) {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}

export default function ResearchLedgerWorkspace({ moduleCode, visibleModuleCodes, title = '账户研究登记簿', description }: Props) {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [instrument, setInstrument] = useState('');
  const [purpose, setPurpose] = useState('');
  const [verifiedSource, setVerifiedSource] = useState('');
  const [methodBasis, setMethodBasis] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({});
  const auditExportRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'dueSoon' | 'overdue'>('all');
  const acceptedModuleCodes = visibleModuleCodes?.length ? visibleModuleCodes : [moduleCode];
  const acceptsModuleCode = (value: string) => acceptedModuleCodes.includes(value);
  useEffect(() => { const timer = window.setTimeout(function refresh() { setNow(Date.now()); }, 30_000); return () => window.clearTimeout(timer); }, [now]);

  const mine = trpc.researchLedger.mine.useQuery({ limit: 50 }, { enabled: auth.isAuthenticated, refetchOnWindowFocus: false });
  const pending = trpc.researchLedger.pending.useQuery({ limit: 50 }, { enabled: auth.isAdmin, refetchOnWindowFocus: false });
  const audit = trpc.researchLedger.audit.useQuery({ entryId: selectedEntryId ?? 0 }, { enabled: selectedEntryId !== null, refetchOnWindowFocus: false });
  const submit = trpc.researchLedger.submit.useMutation({
    onSuccess: async () => {
      setInstrument(''); setPurpose(''); setVerifiedSource(''); setMethodBasis(''); setConfirmed(false);
      await utils.researchLedger.mine.invalidate();
      if (auth.isAdmin) await utils.researchLedger.pending.invalidate();
    },
  });
  const review = trpc.researchLedger.review.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.researchLedger.mine.invalidate(), utils.researchLedger.pending.invalidate()]);
      if (selectedEntryId !== null) await utils.researchLedger.audit.invalidate({ entryId: selectedEntryId });
    },
  });
  const filteredPending = (pending.data ?? []).filter((entry) => {
    if (!acceptsModuleCode(entry.moduleCode)) return false;
    const remaining = new Date(entry.approvalDueAt).getTime() - now;
    if (approvalFilter === 'overdue') return remaining <= 0;
    if (approvalFilter === 'dueSoon') return remaining > 0 && remaining <= 2 * 60 * 60 * 1000;
    return true;
  });
  const visibleEntries = (() => {
    const rows = auth.isAdmin && approvalFilter !== 'all'
      ? filteredPending
      : [...(mine.data ?? []), ...(auth.isAdmin ? (pending.data ?? []) : [])];
    return Array.from(new Map(rows.filter((entry) => acceptsModuleCode(entry.moduleCode)).map((entry) => [entry.id, entry])).values());
  })();

  const canSubmit = Boolean(instrument.trim() && purpose.trim() && verifiedSource.trim() && methodBasis.trim() && confirmed);
  const submitEntry = () => {
    if (!canSubmit || submit.isPending) return;
    submit.mutate({ moduleCode, instrument: instrument.trim(), purpose: purpose.trim(), verifiedSource: verifiedSource.trim(), methodBasis: methodBasis.trim(), complianceConfirmed: true });
  };
  const reviewEntry = (entryId: number, decision: 'approved' | 'rejected') => {
    const note = reviewNote[entryId]?.trim();
    if (!note || review.isPending) return;
    review.mutate({ entryId, decision, reviewNote: note });
  };

  if (auth.loading) return <LoadingState />;
  if (!auth.isAuthenticated) return <Card title="登录后同步研究登记"><p className="text-[11px] leading-5 text-slate-400">研究条目会归属当前账户，并在提交后进入合规复核流程；未登录时不会写入浏览器本地存储。</p><button type="button" onClick={() => { window.location.href = getLoginUrl(); }} className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950 px-2 py-1 text-[10px] text-cyan-200"><LogIn className="h-3.5 w-3.5" />登录并同步</button></Card>;

  return <div className="space-y-3">
    <Card title={title}>
      <p className="mb-3 text-[10px] leading-5 text-slate-500">{description ?? '提交时保存账户归属、来源核验、方法口径与合规确认，并设定 24 小时复核期限。处理结果以追加式审计事件留痕并反馈至提交账户；该工作流仅记录研究核验，不执行订单或输出交易指令。'}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-[10px] text-slate-500">研究标的<input value={instrument} onChange={(event) => setInstrument(event.target.value)} placeholder="如：国债 CUSIP / 期货合约 / ISIN" className="terminal-ledger-input mt-1 w-full" /></label>
        <label className="text-[10px] text-slate-500">研究目的<input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="如：期限暴露核验 / 发行条款复核" className="terminal-ledger-input mt-1 w-full" /></label>
        <label className="text-[10px] text-slate-500">已核验来源<input value={verifiedSource} onChange={(event) => setVerifiedSource(event.target.value)} placeholder="原始披露、官方 API、受许可终端或内部系统" className="terminal-ledger-input mt-1 w-full" /></label>
        <label className="text-[10px] text-slate-500">方法与口径<input value={methodBasis} onChange={(event) => setMethodBasis(event.target.value)} placeholder="数据时间、估值口径、检查范围；不填交易指令" className="terminal-ledger-input mt-1 w-full" /></label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-[10px] text-slate-300"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" className="mt-0.5" />我已核验授权、来源可用性、适当性、限额、流动性及本地合规要求。</label>
      {submit.error && <p className="mt-2 text-[10px] text-rose-300">提交失败：{submit.error.message}</p>}
      <button type="button" disabled={!canSubmit || submit.isPending} onClick={submitEntry} className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-700 bg-cyan-950 px-2 py-1 text-[10px] text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5" />{submit.isPending ? '正在提交…' : '提交账户登记并送审（24 小时）'}</button>
    </Card>

    <Card title={`账户研究登记（${visibleEntries.length}）`}>
      {auth.isAdmin && <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setApprovalFilter('all')} className={`rounded border px-2 py-1 text-[10px] ${approvalFilter === 'all' ? 'border-cyan-700 bg-cyan-950 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>全部</button>
        <button type="button" onClick={() => setApprovalFilter('dueSoon')} className={`rounded border px-2 py-1 text-[10px] ${approvalFilter === 'dueSoon' ? 'border-amber-700 bg-amber-950/40 text-amber-200' : 'border-slate-700 text-slate-400'}`}>即将到期（2 小时内）</button>
        <button type="button" onClick={() => setApprovalFilter('overdue')} className={`rounded border px-2 py-1 text-[10px] ${approvalFilter === 'overdue' ? 'border-rose-700 bg-rose-950/40 text-rose-200' : 'border-slate-700 text-slate-400'}`}>已逾期</button>
      </div>}
      {(mine.isLoading || (auth.isAdmin && pending.isLoading)) ? <LoadingState /> : mine.error ? <p className="text-[11px] text-rose-300">无法读取账户登记：{mine.error.message}</p> : pending.error && auth.isAdmin ? <p className="text-[11px] text-rose-300">无法读取待处理记录：{pending.error.message}</p> : visibleEntries.length ? <div className="overflow-x-auto"><table className="w-full text-[11px]"><thead><tr className="border-b border-slate-800 text-left text-slate-500"><th className="p-1.5">提交时间</th><th>标的 / 目的</th><th>来源 / 口径</th><th>状态与时限</th><th>处理 / 审计</th></tr></thead><tbody>{visibleEntries.map((entry) => {
        const status = statusStyle[entry.status];
        const StatusIcon = status.Icon;
        const deadline = approvalCountdown(entry.approvalDueAt, now);
        return <tr key={entry.id} className="border-b border-slate-800/60 align-top"><td className="p-1.5 font-mono text-slate-500">{formatShanghaiTime(entry.submittedAt)}</td><td className="py-1.5"><div className="text-cyan-300">{entry.instrument}</div><div className="text-slate-400">{entry.purpose}</div></td><td className="py-1.5"><div className="text-slate-400">{entry.verifiedSource}</div><div className="text-slate-600">{entry.methodBasis}</div></td><td className="py-1.5"><div className={`inline-flex items-center gap-1 ${status.className}`}><StatusIcon className="h-3.5 w-3.5" />{status.label}</div>{entry.status === 'submitted' && <div className={`mt-1 text-[9px] ${deadline.className}`}>已送审 · {formatShanghaiTime(entry.approvalDueAt)} · {deadline.label}</div>}{entry.reviewNote && <div className="mt-1 max-w-48 text-[9px] text-slate-500">{entry.reviewNote}</div>}</td><td className="min-w-64 py-1.5"><button type="button" onClick={() => setSelectedEntryId(entry.id)} className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-200"><History className="h-3.5 w-3.5" />查看</button>{auth.isAdmin && entry.status === 'submitted' && <div className="mt-2 flex flex-wrap gap-1"><input value={reviewNote[entry.id] ?? ''} onChange={(event) => setReviewNote((current) => ({ ...current, [entry.id]: event.target.value }))} placeholder="复核意见（至少 2 字）" className="terminal-ledger-input min-w-40 flex-1" /><button type="button" onClick={() => reviewEntry(entry.id, 'approved')} disabled={!reviewNote[entry.id]?.trim() || review.isPending} className="inline-flex items-center gap-1 rounded border border-emerald-800 px-2 py-1 text-[10px] text-emerald-300 disabled:opacity-40"><UserRoundCheck className="h-3.5 w-3.5" />通过</button><button type="button" onClick={() => reviewEntry(entry.id, 'rejected')} disabled={!reviewNote[entry.id]?.trim() || review.isPending} className="inline-flex items-center gap-1 rounded border border-rose-800 px-2 py-1 text-[10px] text-rose-300 disabled:opacity-40"><XCircle className="h-3.5 w-3.5" />退回</button></div>}</td></tr>;
      })}</tbody></table></div> : <p className="text-[11px] text-slate-500">当前条件下没有研究登记。</p>}
    </Card>

    {selectedEntryId !== null && <Card title={`审计记录 #${selectedEntryId}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><ExportMenu filename={`research-ledger-audit-${selectedEntryId}`} targetRef={auditExportRef} /><button type="button" onClick={() => setSelectedEntryId(null)} className="text-[10px] text-slate-500 hover:text-slate-200">收起</button></div>{audit.isLoading ? <LoadingState /> : audit.error ? <p className="text-[11px] text-rose-300">无法读取审计记录：{audit.error.message}</p> : audit.data?.length ? <div ref={auditExportRef} className="space-y-2 bg-[#0a0a0f] p-3"><div className="border-b border-slate-800 pb-2 text-[11px] text-cyan-300">研究登记审计记录 #{selectedEntryId} · 导出时间 {formatShanghaiTime(new Date())}</div>{audit.data.map((event) => <div key={event.id} className="border-l border-slate-700 pl-3 text-[10px]"><span className="font-mono text-slate-500">{formatShanghaiTime(event.createdAt)}</span><span className="ml-2 text-cyan-300">{event.action === 'submitted' ? '提交' : event.action === 'approved' ? '通过' : '退回'}</span><p className="mt-1 text-slate-400">{event.note ?? '—'}</p></div>)}</div> : <p className="text-[11px] text-slate-500">暂无审计事件。</p>}</Card>}
  </div>;
}
