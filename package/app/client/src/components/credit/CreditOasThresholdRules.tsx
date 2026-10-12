import { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Save, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type OasSeries = { id: string; label: string; observationDate: string | null; valueBps: number | null; status: 'available' | 'unavailable' };

const SERIES = [
  { id: 'BAMLC0A0CM' as const, label: '投资级综合 OAS' },
  { id: 'BAMLC0A1CAAA' as const, label: 'AAA 级公司债 OAS' },
  { id: 'BAMLC0A2CAA' as const, label: 'AA 级公司债 OAS' },
  { id: 'BAMLC0A4CBBB' as const, label: 'BBB 级公司债 OAS' },
  { id: 'BAMLH0A0HYM2' as const, label: '高收益综合 OAS' },
];

export function CreditOasThresholdRules({ series }: { series: OasSeries[] }) {
  const utils = trpc.useUtils();
  const rulesQuery = trpc.creditResearch.listOasThresholdRules.useQuery(undefined, { retry: false });
  const evaluateMutation = trpc.creditResearch.evaluateMyOasThresholds.useMutation();
  const saveMutation = trpc.creditResearch.saveOasThresholdRule.useMutation({ onSuccess: () => utils.creditResearch.listOasThresholdRules.invalidate() });
  const deleteMutation = trpc.creditResearch.deleteOasThresholdRule.useMutation({ onSuccess: () => utils.creditResearch.listOasThresholdRules.invalidate() });
  const [seriesId, setSeriesId] = useState<(typeof SERIES)[number]['id']>('BAMLC0A0CM');
  const [threshold, setThreshold] = useState('');
  const [active, setActive] = useState(true);
  const evaluatedObservationKey = useRef('');
  const currentRule = useMemo(() => (rulesQuery.data ?? []).find((rule) => rule.seriesId === seriesId) ?? null, [rulesQuery.data, seriesId]);
  const selectedObservation = series.find((item) => item.id === seriesId) ?? null;

  useEffect(() => {
    setThreshold(currentRule ? String(currentRule.thresholdBps) : '');
    setActive(currentRule?.isActive ?? true);
  }, [currentRule?.id, currentRule?.thresholdBps, currentRule?.isActive, seriesId]);

  useEffect(() => {
    const key = series.map((item) => `${item.id}:${item.observationDate ?? 'none'}:${item.valueBps ?? 'none'}`).join('|');
    if (!key || evaluatedObservationKey.current === key || !series.some((item) => item.status === 'available')) return;
    evaluatedObservationKey.current = key;
    evaluateMutation.mutate();
  }, [series]);

  const save = () => {
    const value = Number(threshold);
    if (!Number.isFinite(value) || value <= 0) return;
    saveMutation.mutate({ seriesId, thresholdBps: value, isActive: active });
  };

  return <div className="mt-2 rounded border border-violet-900/60 bg-violet-950/10 p-2">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="inline-flex items-center gap-1 text-[10px] text-violet-200"><BellRing className="h-3 w-3" />账户级 OAS 阈值提醒</p><p className="mt-0.5 text-[9px] text-slate-500">当已披露的 FRED / ICE BofA 观察值严格高于阈值时，写入通知中心并通过现有右上角通知推送；同一规则与观察日只提醒一次。</p></div><button type="button" onClick={() => evaluateMutation.mutate()} disabled={evaluateMutation.isPending} className="rounded border border-violet-800 px-2 py-1 text-[9px] text-violet-200 hover:bg-violet-950/50 disabled:opacity-50">{evaluateMutation.isPending ? '检查中' : '立即检查'}</button></div>
    {rulesQuery.error ? <p className="mt-2 text-[9px] text-amber-200">登录后可管理账户阈值与接收提醒。</p> : <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"><label className="text-[9px] text-slate-400">OAS 系列<select value={seriesId} onChange={(event) => setSeriesId(event.target.value as typeof seriesId)} className="mt-1 w-full input-terminal">{SERIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-[9px] text-slate-400">超过阈值（bp）<input inputMode="decimal" value={threshold} onChange={(event) => setThreshold(event.target.value)} placeholder="例如 140" className="mt-1 w-full input-terminal" /></label><label className="flex h-7 items-center gap-1 text-[9px] text-slate-300"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />启用</label><button type="button" onClick={save} disabled={saveMutation.isPending || !threshold.trim()} className="inline-flex h-7 items-center justify-center gap-1 rounded border border-violet-800 px-2 text-[9px] text-violet-200 hover:bg-violet-950/50 disabled:opacity-50"><Save className="h-3 w-3" />保存规则</button></div>}
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/40 px-2 py-1"><span className="text-[9px] text-slate-500">当前 {selectedObservation?.label ?? '—'}：<b className="font-mono text-slate-200">{selectedObservation?.valueBps === null || selectedObservation?.valueBps === undefined ? '—' : `${selectedObservation.valueBps.toFixed(1)} bp`}</b> · 观察日 {selectedObservation?.observationDate ?? '—'}</span>{currentRule && <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">已设 {Number(currentRule.thresholdBps).toFixed(1)} bp · {currentRule.isActive ? '启用' : '暂停'}<button type="button" aria-label="删除当前 OAS 阈值规则" onClick={() => deleteMutation.mutate({ ruleId: currentRule.id })} disabled={deleteMutation.isPending} className="ml-1 text-rose-300 hover:text-rose-100"><Trash2 className="h-3 w-3" /></button></span>}</div>
  </div>;
}
