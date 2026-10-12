import { useState } from 'react';
import { Badge, Card, Metric } from '@/components/sovereign/PanelKit';

type Bucket = { id: string; label: string; issuedAmount: number | null; issuedCount: number | null; outstandingAmount: number | null; outstandingCount: number | null };
type Activity = { recordDate: string; buckets: Bucket[] };
type Source = { id: string; label: string; frequency: string; availability: string; scope: string };
type RestrictedId = 'MBWD' | 'CDRV' | 'DEAL' | 'MBIX' | 'VRDN' | 'BOOM';

const currencyB = (value: number | null | undefined) => value == null ? '—' : `$${(value / 1_000_000_000).toFixed(2)}B`;

function CoverageFilter({ title, intro, sources, defaultQuery = '' }: { title: string; intro: string; sources: Source[]; defaultQuery?: string }) {
  const [query, setQuery] = useState(defaultQuery);
  const [onlyReadable, setOnlyReadable] = useState(false);
  const visible = sources.filter((source) => (!onlyReadable || source.availability === 'available') && `${source.id} ${source.label} ${source.scope}`.toLowerCase().includes(query.toLowerCase()));
  return <Card title={title}><p className="mb-2 text-[11px] text-slate-400">{intro}</p><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选资料、频率或范围" className="input-terminal min-w-48 flex-1 text-xs" /><label className="inline-flex items-center gap-1 text-[11px] text-slate-400"><input checked={onlyReadable} onChange={(event) => setOnlyReadable(event.target.checked)} type="checkbox" />仅当前可读</label></div><div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[11px]"><thead className="text-slate-500"><tr><th className="pb-1">资料</th><th className="pb-1">频率</th><th className="pb-1">状态</th><th className="pb-1">终端内范围</th></tr></thead><tbody>{visible.map((source) => <tr key={source.id} className="border-t border-slate-800"><td className="py-1.5 text-slate-200">{source.label}</td><td className="py-1.5 text-slate-400">{source.frequency}</td><td className="py-1.5"><Badge tone={source.availability === 'available' ? 'pos' : source.availability === 'restricted' ? 'warn' : 'neutral'}>{source.availability === 'available' ? '可读' : source.availability === 'restricted' ? '受限' : source.availability === 'historical' ? '历史' : '暂不可读'}</Badge></td><td className="py-1.5 text-slate-500">{source.scope}</td></tr>)}{!visible.length && <tr><td colSpan={4} className="py-4 text-center text-slate-500">没有匹配的终端资料。</td></tr>}</tbody></table></div></Card>;
}

function MaturityCompare({ latest }: { latest: Activity }) {
  const [left, setLeft] = useState('0-3m'); const [right, setRight] = useState('3-6m');
  const a = latest.buckets.find((bucket) => bucket.id === left); const b = latest.buckets.find((bucket) => bucket.id === right);
  const options = latest.buckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.label}</option>);
  const delta = (a?.outstandingAmount ?? 0) - (b?.outstandingAmount ?? 0);
  return <Card title="MBWD · 期限活动比较（官方结构资料）"><p className="text-[11px] text-slate-400">比较实际读取的 SLGS 分期限活动，辅助核验期限结构；不提供市政债买价、市场深度或可执行报价。</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-500">比较 A<select value={left} onChange={(event) => setLeft(event.target.value)} className="input-terminal mt-1 w-full">{options}</select></label><label className="text-xs text-slate-500">比较 B<select value={right} onChange={(event) => setRight(event.target.value)} className="input-terminal mt-1 w-full">{options}</select></label></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="A 未偿" value={currencyB(a?.outstandingAmount)} /><Metric label="B 未偿" value={currencyB(b?.outstandingAmount)} /><Metric label="A–B 结构差" value={currencyB(delta)} tone={delta >= 0 ? 'info' : 'warn'} /></div></Card>;
}

function ExecutionScope({ moduleId, sources }: { moduleId: 'DEAL' | 'BOOM'; sources: Source[] }) {
  const [scope, setScope] = useState<'quote' | 'trade' | 'inventory'>('quote');
  const readable = sources.filter((source) => source.availability === 'available').length;
  const labels = moduleId === 'DEAL' ? { quote: '可执行报价证据', trade: '逐笔成交证据', inventory: '库存与对手方证据' } : { quote: '委托价格证据', trade: '成交回报证据', inventory: '库存可用量证据' };
  return <Card title={`${moduleId} · 研究证据控制台`}><p className="text-[11px] text-slate-400">选择拟核验的证据类型；终端仅展示已可读资料的覆盖状态，不生成订单、成交或库存记录。</p><div className="mt-2 flex flex-wrap gap-1">{(Object.keys(labels) as Array<keyof typeof labels>).map((key) => <button type="button" key={key} onClick={() => setScope(key)} className={`rounded px-2 py-1 text-xs ${scope === key ? 'bg-cyan-900 text-cyan-100' : 'bg-slate-900 text-slate-500'}`}>{labels[key]}</button>)}</div><div className="mt-3 rounded border border-slate-800 bg-slate-950/50 p-2"><Metric label="当前可读终端资料" value={readable} unit="个" tone={readable ? 'pos' : 'warn'} sub={`${labels[scope]} · 已选择的核验范围`} /><p className="mt-2 text-[10px] text-slate-500">MSRB/EMMA 逐笔数据受限时，系统不以样例记录代替；获得授权后也只显示获准字段。</p></div></Card>;
}

function VrdnScope({ moduleId, latest, sources }: { moduleId: 'CDRV' | 'VRDN'; latest: Activity; sources: Source[] }) {
  const [bucketId, setBucketId] = useState('0-3m'); const bucket = latest.buckets.find((item) => item.id === bucketId);
  return <><Card title={`${moduleId} · 短端期限参照`}><p className="text-[11px] text-slate-400">VRDN/SIFMA 核心字段尚无可自由读取授权。可用官方 SLGS 期限活动核验短端背景，但其不会被标为 VRDN 或 SIFMA 利率。</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><label className="text-xs text-slate-500">期限桶<select value={bucketId} onChange={(event) => setBucketId(event.target.value)} className="input-terminal mt-1 w-full">{latest.buckets.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><Metric label="该期限未偿" value={currencyB(bucket?.outstandingAmount)} /><Metric label="当日新认购" value={currencyB(bucket?.issuedAmount)} /></div></Card><div className="mt-3"><CoverageFilter title="公开基准来源筛选" intro="资料状态只表示终端读取能力；不将 SLGS 或任何其他序列冒充 VRDN/SIFMA 利率。" sources={sources} defaultQuery="SLGS" /></div></>;
}

function IndexCoverage({ sources }: { sources: Source[] }) {
  const [mode, setMode] = useState<'current' | 'history'>('current');
  const rows = sources.filter((source) => mode === 'current' ? source.availability === 'available' : source.availability === 'historical');
  return <Card title="MBIX · 指数资料覆盖比较"><div className="flex gap-1"><button type="button" onClick={() => setMode('current')} className={`rounded px-2 py-1 text-xs ${mode === 'current' ? 'bg-cyan-900 text-cyan-100' : 'text-slate-500'}`}>当前可读资料</button><button type="button" onClick={() => setMode('history')} className={`rounded px-2 py-1 text-xs ${mode === 'history' ? 'bg-cyan-900 text-cyan-100' : 'text-slate-500'}`}>历史参照资料</button></div><p className="mt-2 text-[11px] text-slate-400">指数点位、成分、行业利差与归因必须来自已授权资料。本比较仅列出实际资料覆盖，不编制替代指数。</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{rows.map((source) => <div key={source.id} className="rounded border border-slate-800 bg-slate-950/50 p-2"><b className="text-xs text-slate-200">{source.label}</b><p className="mt-1 text-[10px] text-slate-500">{source.frequency} · {source.scope}</p></div>)}{!rows.length && <p className="rounded border border-dashed border-slate-800 p-3 text-xs text-slate-500">该视图没有可用的已授权指数资料。</p>}</div></Card>;
}

export default function MunicipalRestrictedTools({ moduleId, latest, sources }: { moduleId: RestrictedId; latest: Activity; sources: Source[] }) {
  if (moduleId === 'MBWD') return <MaturityCompare latest={latest} />;
  if (moduleId === 'CDRV' || moduleId === 'VRDN') return <VrdnScope moduleId={moduleId} latest={latest} sources={sources} />;
  if (moduleId === 'DEAL' || moduleId === 'BOOM') return <ExecutionScope moduleId={moduleId} sources={sources} />;
  return <IndexCoverage sources={sources} />;
}
