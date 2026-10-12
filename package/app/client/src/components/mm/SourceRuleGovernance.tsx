import { useEffect, useMemo, useState } from 'react';
import { Copy, Share2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

const EMPTY_SOURCE_RULES: never[] = [];

export default function SourceRuleGovernance() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedRuleIds, setSelectedRuleIds] = useState<number[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberId, setMemberId] = useState<number | null>(null);
  const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer');
  const rulesQuery = trpc.moneyMarketResearch.listSourceFreshnessNotificationRules.useQuery(undefined, { enabled: Boolean(user), staleTime: 30_000 });
  const rules = rulesQuery.data ?? EMPTY_SOURCE_RULES;
  const ownerRules = useMemo(() => rules.filter((rule) => rule.permission === 'owner'), [rules]);
  const shareRuleId = selectedRuleIds.length === 1 ? selectedRuleIds[0] : null;
  const membersQuery = trpc.moneyMarketResearch.searchSourceRuleMembers.useQuery({ query: memberQuery, limit: 10 }, { enabled: Boolean(user && ownerRules.length) });
  const sharesQuery = trpc.moneyMarketResearch.listSourceRuleShares.useQuery({ ruleId: shareRuleId ?? 0 }, { enabled: Boolean(user && shareRuleId) });
  const refresh = async () => { await Promise.all([utils.moneyMarketResearch.listSourceFreshnessNotificationRules.invalidate(), utils.moneyMarketResearch.listSourceRuleShares.invalidate()]); };
  useEffect(() => {
    setSelectedRuleIds((previous) => {
      const next = previous.filter((id) => ownerRules.some((rule) => rule.id === id));
      return next.length === previous.length ? previous : next;
    });
  }, [ownerRules]);
  const copy = trpc.moneyMarketResearch.copySourceRules.useMutation({ onSuccess: async (result) => { await refresh(); toast.success(`已复制 ${result.copied} 条规则${result.skipped ? `；${result.skipped} 条既有独立规则未覆盖` : ''}`); }, onError: (error) => toast.error(error.message.includes('FORBIDDEN') ? '仅可复制本账户拥有的规则' : '批量复制失败') });
  const share = trpc.moneyMarketResearch.shareSourceRule.useMutation({ onSuccess: async () => { await refresh(); toast.success('规则团队权限已保存'); }, onError: () => toast.error('规则授权失败') });
  const revoke = trpc.moneyMarketResearch.revokeSourceRuleShare.useMutation({ onSuccess: refresh, onError: () => toast.error('撤销规则授权失败') });
  const toggleRule = (ruleId: number) => setSelectedRuleIds((current) => current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId]);
  if (!user) return null;
  return <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs text-slate-200"><UsersRound className="mr-1 inline h-3.5 w-3.5 text-cyan-300" />SOURCE · 团队时效标准治理</b><span className="text-[10px] text-slate-500">共享规则受权限控制；复制后形成接收账户独立规则</span></div><p className="mt-1 text-[10px] text-slate-500">勾选本账户规则后可批量复制给成员。仅选择一条自有规则时，可授予只读或编辑权限；共享不会覆盖对方已有的独立阈值规则。</p><div className="mt-2 grid gap-1 md:grid-cols-2">{rules.map((rule) => <label key={rule.id} className={`flex items-center gap-2 rounded border p-2 text-[10px] ${rule.permission === 'owner' ? 'border-slate-700 text-slate-300' : 'border-slate-800 text-slate-500'}`}><input type="checkbox" checked={selectedRuleIds.includes(rule.id)} disabled={rule.permission !== 'owner'} onChange={() => toggleRule(rule.id)} /><span><b className="text-cyan-100">{rule.sourceId}</b> · {rule.thresholdDays} 日 · {rule.digestMode === 'daily' ? '每日汇总' : '即时'} · {rule.isActive ? '启用' : '暂停'}</span><span className="ml-auto rounded border border-slate-700 px-1 text-slate-500">{rule.permission === 'owner' ? '自有' : rule.permission === 'editor' ? '共享可编辑' : '共享只读'}</span></label>)}{!rules.length && <p className="text-[10px] text-slate-500">先在上方保存至少一条时效规则，才能复制或共享。</p>}</div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_auto]"><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} className="input-terminal text-xs" placeholder="搜索成员姓名或账户" /><select value={String(memberId ?? '')} onChange={(event) => setMemberId(event.target.value ? Number(event.target.value) : null)} className="input-terminal text-xs"><option value="">选择成员</option>{(membersQuery.data ?? []).map((member) => <option key={member.id} value={member.id}>{member.name || member.email || `成员 ${member.id}`}</option>)}</select><button type="button" onClick={() => memberId && copy.mutate({ ruleIds: selectedRuleIds, targetUserId: memberId })} disabled={!memberId || !selectedRuleIds.length || copy.isPending} className="rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:text-slate-600"><Copy className="mr-1 inline h-3 w-3" />批量复制</button></div>{shareRuleId && <div className="mt-2 grid gap-2 rounded border border-slate-800 p-2 md:grid-cols-[1fr_120px_auto]"><span className="self-center text-[10px] text-slate-400">将选中规则共享为协同标准</span><select value={permission} onChange={(event) => setPermission(event.target.value as typeof permission)} className="input-terminal text-xs"><option value="viewer">只读</option><option value="editor">可编辑</option></select><button type="button" onClick={() => memberId && share.mutate({ ruleId: shareRuleId, sharedWithUserId: memberId, permission })} disabled={!memberId || share.isPending} className="rounded border border-amber-800 px-3 text-xs text-amber-200 disabled:text-slate-600"><Share2 className="mr-1 inline h-3 w-3" />共享标准</button></div>}{shareRuleId && <div className="mt-2 flex flex-wrap gap-1">{(sharesQuery.data ?? []).map((item) => <span key={item.id} className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400">{item.userName || item.userEmail || `成员 ${item.sharedWithUserId}`} · {item.permission}<button type="button" onClick={() => revoke.mutate({ ruleId: shareRuleId, sharedWithUserId: item.sharedWithUserId })} className="ml-2 text-rose-300">撤销</button></span>)}{!(sharesQuery.data ?? []).length && <span className="text-[10px] text-slate-500">该规则尚未共享给团队成员。</span>}</div>}</div>;
}

function SharedRuleEditor({ rule }: { rule: { id: number; sourceId: string; thresholdDays: number; isActive: boolean; timezone: string; digestMode: 'immediate' | 'daily' } }) {
  const utils = trpc.useUtils();
  const [thresholdDays, setThresholdDays] = useState(rule.thresholdDays);
  const [isActive, setIsActive] = useState(rule.isActive);
  const [digestMode, setDigestMode] = useState(rule.digestMode);
  const [timezone, setTimezone] = useState(rule.timezone);
  const update = trpc.moneyMarketResearch.updateSharedSourceFreshnessNotificationRule.useMutation({ onSuccess: async () => { await utils.moneyMarketResearch.listSourceFreshnessNotificationRules.invalidate(); toast.success(`${rule.sourceId} 共享规则已更新`); }, onError: () => toast.error('共享规则更新失败') });
  return <div className="grid gap-2 rounded border border-cyan-950 bg-cyan-950/10 p-2 md:grid-cols-[110px_90px_130px_1fr_auto]"><b className="self-center text-xs text-cyan-100">{rule.sourceId}</b><label className="text-[10px] text-slate-500">阈值<input type="number" min="0" max="365" value={thresholdDays} onChange={(event) => setThresholdDays(Number(event.target.value))} className="input-terminal mt-1 w-full" /></label><label className="text-[10px] text-slate-500">投递<select value={digestMode} onChange={(event) => setDigestMode(event.target.value as typeof digestMode)} className="input-terminal mt-1 w-full"><option value="immediate">即时</option><option value="daily">每日</option></select></label><label className="text-[10px] text-slate-500">时区<input value={timezone} onChange={(event) => setTimezone(event.target.value)} maxLength={64} className="input-terminal mt-1 w-full" /></label><div className="flex items-end gap-2"><label className="mb-1 flex items-center gap-1 text-[10px] text-slate-400"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />启用</label><button type="button" onClick={() => update.mutate({ ruleId: rule.id, thresholdDays: Math.max(0, Math.min(365, Number(thresholdDays) || 0)), isActive, digestMode, timezone })} disabled={update.isPending} className="rounded border border-cyan-800 px-2 py-1 text-xs text-cyan-200 disabled:text-slate-600">更新</button></div></div>;
}

export function SharedSourceRuleEditors() {
  const { user } = useAuth();
  const rulesQuery = trpc.moneyMarketResearch.listSourceFreshnessNotificationRules.useQuery(undefined, { enabled: Boolean(user), staleTime: 30_000 });
  const editableRules = (rulesQuery.data ?? EMPTY_SOURCE_RULES).filter((rule) => rule.permission === 'editor');
  if (!user || !editableRules.length) return null;
  return <div className="mt-3 rounded border border-cyan-950 bg-slate-950/40 p-3"><b className="text-xs text-cyan-100">SOURCE · 团队共享规则编辑</b><p className="mt-1 text-[10px] text-slate-500">仅展示授予当前账户“可编辑”权限的规则。修改会作用于共享规则本身，并由服务端再次校验权限。</p><div className="mt-2 space-y-2">{editableRules.map((rule) => <SharedRuleEditor key={rule.id} rule={rule} />)}</div></div>;
}
