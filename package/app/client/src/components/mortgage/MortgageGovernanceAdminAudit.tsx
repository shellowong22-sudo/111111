import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Card, Metric, PanelShell } from '@/components/sovereign/PanelKit';

type Filter = 'all' | 'attention' | 'overdue' | 'stale';

function downloadAuditCsv(rows: Array<{ moduleId: string; label: string; ledgerCount: number; recordCount: number; shareCount: number; inReviewCount: number; changesRequestedCount: number; dueSoonCount: number; overdueCount: number; staleCount: number; latestUpdatedAt: Date | string | null }>, staleAfterDays: number) {
  const quote = (value: string | number) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = ['模块', '账户台账', '记录', '共享授权', '审阅中', '需修订', '即将到期', '逾期', `超过 ${staleAfterDays} 天未更新`, '最近更新'];
  const body = [header.map(quote).join(','), ...rows.map((row) => [
    `${row.moduleId} · ${row.label}`, row.ledgerCount, row.recordCount, row.shareCount, row.inReviewCount,
    row.changesRequestedCount, row.dueSoonCount, row.overdueCount, row.staleCount,
    row.latestUpdatedAt ? new Date(row.latestUpdatedAt).toLocaleString() : '—',
  ].map(quote).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'mortgage-collaboration-timeliness-audit.csv'; link.click(); URL.revokeObjectURL(url);
}

export default function MortgageGovernanceAdminAudit() {
  const audit = trpc.mortgageGovernanceAdmin.audit.useQuery(undefined, { staleTime: 30_000 });
  const [filter, setFilter] = useState<Filter>('all');
  const data = audit.data;
  const rows = useMemo(() => {
    if (!data) return [];
    return data.modules.filter((row) => filter === 'all' || filter === 'overdue' ? (filter !== 'overdue' || row.overdueCount > 0) : filter === 'stale' ? row.staleCount > 0 : row.overdueCount + row.dueSoonCount + row.changesRequestedCount + row.staleCount > 0);
  }, [data, filter]);
  return <PanelShell ticker="MBS-GOV" title="抵押债协作与数据时效审计" subtitle="跨模块账户台账、团队授权、审阅积压与数据更新时效的管理员级聚合视图">
    <Card title="协作与时效审计总览" action={<div className="flex items-center gap-2"><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="input-terminal h-7 text-[11px]"><option value="all">全部模块</option><option value="attention">需关注</option><option value="overdue">审阅逾期</option><option value="stale">数据未更新</option></select><button type="button" onClick={() => data && downloadAuditCsv(rows, data.staleAfterDays)} disabled={!data || !rows.length} className="text-xs text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />CSV 导出</button></div>}>
      {audit.isLoading ? <div className="h-56 animate-pulse rounded bg-slate-800" /> : audit.error ? <p className="text-xs text-rose-300">{audit.error.message}</p> : !data ? <p className="text-xs text-slate-500">暂无可用审计汇总。</p> : <>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-7"><Metric label="账户台账" value={String(data.totals.ledgers)} unit="本" /><Metric label="记录" value={String(data.totals.records)} unit="条" /><Metric label="团队授权" value={String(data.totals.shares)} unit="项" tone="info" /><Metric label="审阅中" value={String(data.totals.inReview)} unit="项" tone={data.totals.inReview ? 'warn' : 'neutral'} /><Metric label="即将到期" value={String(data.totals.dueSoon)} unit="项" tone={data.totals.dueSoon ? 'warn' : 'neutral'} /><Metric label="审阅逾期" value={String(data.totals.overdue)} unit="项" tone={data.totals.overdue ? 'neg' : 'neutral'} /><Metric label={`超过 ${data.staleAfterDays} 天未更新`} value={String(data.totals.stale)} unit="项" tone={data.totals.stale ? 'warn' : 'neutral'} /></div>
        <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }} /><Bar dataKey="recordCount" name="记录" fill="#22d3ee" radius={[3, 3, 0, 0]} /><Bar dataKey="shareCount" name="共享授权" fill="#a78bfa" radius={[3, 3, 0, 0]} /><Bar dataKey="staleCount" name="未更新" fill="#f59e0b" radius={[3, 3, 0, 0]} /><Bar dataKey="overdueCount" name="审阅逾期" fill="#fb7185" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="mt-3 overflow-auto rounded border border-slate-800"><table className="min-w-full text-left text-xs"><thead className="bg-slate-950/70 text-[10px] text-slate-500"><tr><th className="p-2">模块</th><th className="p-2">台账/记录</th><th className="p-2">协作/审阅</th><th className="p-2">时效与时限</th><th className="p-2">最近更新</th></tr></thead><tbody>{rows.map((row) => <tr key={row.moduleId} className="border-t border-slate-800"><td className="p-2 text-slate-200">{row.moduleId} · {row.label}</td><td className="p-2 text-slate-300">{row.ledgerCount} / {row.recordCount}</td><td className="p-2 text-slate-300">{row.shareCount} / {row.inReviewCount}{row.changesRequestedCount ? ` · ${row.changesRequestedCount} 待修订` : ''}</td><td className={row.overdueCount ? 'p-2 text-rose-300' : row.dueSoonCount || row.staleCount ? 'p-2 text-amber-300' : 'p-2 text-slate-400'}>{row.overdueCount ? `${row.overdueCount} 逾期` : row.dueSoonCount ? `${row.dueSoonCount} 即将到期` : '时限正常'} · {row.staleCount} 未更新</td><td className="whitespace-nowrap p-2 text-slate-500">{row.latestUpdatedAt ? new Date(row.latestUpdatedAt).toLocaleString() : '—'}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-5 text-center text-slate-500">当前筛选没有匹配的模块。</td></tr>}</tbody></table></div>
        <p className="mt-3 text-[10px] text-slate-500"><ShieldCheck className="mr-1 inline h-3 w-3 text-cyan-300" />管理员视图仅汇总账户对象、记录数量、共享授权、审阅状态和更新时间；不展示或导出台账正文、FHFA 原始 CSV 文件或任何未授权市场数据。</p>
      </>}
    </Card>
  </PanelShell>;
}
