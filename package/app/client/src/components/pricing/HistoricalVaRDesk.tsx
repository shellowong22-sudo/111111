import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function currency(value: number | null, code: string | null) { return value === null || !Number.isFinite(value) ? '—' : `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${code ?? ''}`.trim(); }

export default function HistoricalVaRDesk() {
  const [countryCode, setCountryCode] = useState('US');
  const [query, setQuery] = useState('AAPL');
  const [selectedKey, setSelectedKey] = useState('');
  const [notionalText, setNotionalText] = useState('');
  const listInput = useMemo(() => ({ countryCode, query: query.trim() || undefined, offset: 0, limit: 20 }), [countryCode, query]);
  const countries = trpc.equityListings.countries.useQuery();
  const listings = trpc.equityListings.list.useQuery(listInput, { refetchOnWindowFocus: false });
  const selected = (listings.data?.rows ?? []).find((row) => `${row.countryCode}-${row.symbol}` === selectedKey) ?? null;
  const quoteInput = useMemo(() => ({ countryCode: selected?.countryCode ?? 'ZZ', symbol: selected?.symbol ?? '__NOT_SELECTED__', range: '1y' as const }), [selected?.countryCode, selected?.symbol]);
  const quote = trpc.equityListings.quote.useQuery(quoteInput, { enabled: Boolean(selected), refetchOnWindowFocus: false });
  const history = quote.data?.available ? quote.data.history : [];
  const analysis = useMemo(() => {
    const returns = history.slice(1).flatMap((point, index) => {
      const previous = history[index];
      if (point.close === null || previous.close === null || previous.close <= 0) return [];
      const returnPct = ((point.close / previous.close) - 1) * 100;
      return Number.isFinite(returnPct) ? [{ date: point.date, returnPct }] : [];
    });
    const sorted = returns.map((point) => point.returnPct).sort((a, b) => a - b);
    const tail = sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.05)] : null;
    const lossRate = tail === null ? null : Math.max(0, -tail);
    const notional = Number(notionalText);
    return { returns, sampleSize: returns.length, tail, lossRate, notional: Number.isFinite(notional) && notional > 0 ? notional : null, firstDate: history[0]?.date ?? null, lastDate: history.at(-1)?.date ?? null };
  }, [history, notionalText]);

  return <section className="rounded border border-cyan-900/60 bg-[#0c1727] p-3 text-gray-100" data-historical-var-desk="true">
    <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-cyan-300" /><div><p className="text-sm font-bold text-cyan-200">VaR · 实际历史损失观察</p><p className="mt-0.5 max-w-3xl text-[10px] leading-4 text-gray-400">仅使用用户选定已导入证券的实际日收盘价计算历史 95% 单日负收益分位；不是组合 VaR、情景预测、监管结论或交易建议。</p></div></div><button type="button" onClick={() => void quote.refetch()} disabled={!selected || quote.isFetching} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[10px] text-cyan-100 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${quote.isFetching ? 'animate-spin' : ''}`} />读取历史</button></div>
    <div className="mt-3 grid gap-2 md:grid-cols-4"><select aria-label="国家或地区" value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setSelectedKey(''); }} className="rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs">{(countries.data ?? []).map((country) => <option key={country.countryCode} value={country.countryCode}>{country.country} ({country.listingCount})</option>)}</select><input aria-label="证券检索" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedKey(''); }} placeholder="检索已导入证券" className="rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs" /><input aria-label="名义金额" value={notionalText} onChange={(event) => setNotionalText(event.target.value)} inputMode="decimal" placeholder="输入名义金额（可选）" className="rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs" /><span className="rounded border border-gray-800 px-2 py-1.5 text-[10px] text-gray-500">95% 历史分位 · 1 日 · 1 年范围</span></div>
    <div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto">{listings.isLoading ? <span className="text-[10px] text-gray-500">正在检索已导入证券…</span> : (listings.data?.rows ?? []).map((row) => <button key={`${row.countryCode}-${row.symbol}`} type="button" onClick={() => setSelectedKey(`${row.countryCode}-${row.symbol}`)} className={`rounded border px-2 py-1 text-[10px] ${selectedKey === `${row.countryCode}-${row.symbol}` ? 'border-cyan-600 bg-cyan-950/50 text-cyan-100' : 'border-gray-800 text-gray-400 hover:border-gray-600'}`}>{row.symbol} · {row.name}</button>)}</div>
    {!selected ? <div className="mt-3 flex items-center gap-2 rounded border border-dashed border-gray-700 p-3 text-[10px] leading-4 text-gray-500"><Activity className="h-4 w-4" />选择一只已导入证券后，终端才会读取真实历史价格。未选择敞口时不生成 VaR、组合损失或风险判断。</div> : quote.isLoading || quote.isFetching ? <p className="mt-3 text-[10px] text-gray-500">正在读取 {selected.symbol} 的实际历史收盘价…</p> : quote.isError ? <p className="mt-3 rounded border border-red-900/50 p-2 text-[10px] text-red-200">真实历史请求失败；终端不以随机分布或旧 VaR 样例替代。</p> : quote.data && !quote.data.available ? <p className="mt-3 rounded border border-amber-900/50 p-2 text-[10px] text-amber-200">{quote.data.limitation}</p> : analysis.sampleSize ? <><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Metric label="证券" value={`${selected.symbol} · ${quote.data?.quote?.currency ?? '未提供'}`} /><Metric label="实际日收益样本" value={`${analysis.sampleSize} 条`} /><Metric label="95% 历史分位损失率" value={analysis.lossRate === null ? '—' : `${analysis.lossRate.toFixed(3)}%`} /><Metric label="对应名义损失观察" value={analysis.lossRate === null || analysis.notional === null ? '输入名义金额后计算' : currency(analysis.notional * analysis.lossRate / 100, quote.data?.quote?.currency ?? null)} /><Metric label="观察区间" value={`${analysis.firstDate ?? '—'} 至 ${analysis.lastDate ?? '—'}`} /></div><div className="mt-3 rounded border border-gray-800 bg-gray-950/50 p-2"><p className="mb-1 text-[10px] text-cyan-200">实际日收益率（最近 60 个观察）</p><ResponsiveContainer width="100%" height={160}><BarChart data={analysis.returns.slice(-60)}><CartesianGrid strokeDasharray="3 3" stroke="#263042" /><XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 8 }} minTickGap={26} /><YAxis tick={{ fill: '#9ca3af', fontSize: 8 }} width={42} /><Tooltip contentStyle={{ background: '#030712', border: '1px solid #164e63', fontSize: 10 }} formatter={(value) => `${Number(value).toFixed(3)}%`} /><Bar dataKey="returnPct" fill="#22d3ee" name="日收益率" /></BarChart></ResponsiveContainer></div><p className="mt-2 text-[9px] leading-4 text-gray-500">来源：{quote.data?.source}；查询时间：{quote.data?.queriedAt ? new Date(quote.data.queriedAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}；市场观测时间：{quote.data?.observedAt ? new Date(quote.data.observedAt).toLocaleString('zh-CN', { hour12: false }) : '未提供'}。历史分位只描述该样本期内的日收益排序，不外推未来损失。</p></> : <p className="mt-3 text-[10px] text-amber-200">返回历史不足以计算收益率；终端不填入替代 VaR。</p>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded border border-gray-800 bg-gray-950/45 p-2"><p className="text-[9px] text-gray-500">{label}</p><p className="mt-1 break-words text-[11px] font-medium text-gray-100">{value}</p></div>; }
