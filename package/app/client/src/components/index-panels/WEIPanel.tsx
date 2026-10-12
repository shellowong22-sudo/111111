import { useMemo, useState } from 'react';
import { Activity, Database, RefreshCw, Search } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

type IndexObservation = {
  key: string;
  seriesKey: string;
  code: string;
  name: string;
  provider: string;
  datasetLabel: string;
  region: string;
  date: string;
  value: number;
  reportedChange: number | null;
  reportedChangePercent: number | null;
  quality: string;
  freshness: string;
};

type IndexSnapshot = IndexObservation & {
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  historyCount: number;
};

function inferredRegion(code: string, label: string) {
  const value = `${code} ${label}`;
  if (/TAIEX|TWII|台湾/i.test(value)) return '台湾';
  if (/SP500|SPX|DJIA|NDX|NASDAQ|标普|道琼斯|纳斯达克|美国/i.test(value)) return '美国';
  if (/HSI|HSCEI|恒生|国企|香港/i.test(value)) return '香港';
  if (/N225|日经|日本/i.test(value)) return '日本';
  if (/KS11|KOSPI|韩国/i.test(value)) return '韩国';
  if (/SENSEX|印度|印度孟买/i.test(value)) return '印度';
  if (/AS51|AORD|澳大利亚|NZ50|新西兰/i.test(value)) return '大洋洲';
  if (/SX5E|FCHI|GDAXI|DAX|FTSE|CAC|欧洲|德国|法国|英国|荷兰|瑞士|意大利|西班牙/i.test(value)) return '欧洲';
  if (/BVSP|巴西|MXX|墨西哥|南美/i.test(value)) return '美洲其他';
  if (/中国|上证|深证|沪深|创业板|中小100/i.test(value)) return '中国';
  return '其他';
}

export function mapIndexObservations(items: ReturnType<typeof useModuleLiveFeed>['items']) {
  const unique = new Map<string, IndexObservation>();
  for (const row of collectOpenBBDatasetRows(items)) {
    const value = readDatasetNumber(row.values, ['close', 'value', 'index_value', '收盘指数', '报酬指数']);
    const date = readDatasetText(row.values, ['date', 'timestamp', '观察期'], '');
    const explicitCode = readDatasetText(row.values, ['symbol', 'ticker', 'index_code', '标的'], '');
    // A generic label is not a ticker; do not invent one from a region name.
    const code = explicitCode || row.datasetLabel.trim();
    const explicitName = readDatasetText(row.values, ['name', 'index_name', '名称', '指数名称'], '');
    // Some adapters repeat only the ticker in "name". The dataset label then
    // carries the critical price-vs-total-return distinction.
    const name = explicitName && explicitName !== '未提供' && explicitName !== code
      ? explicitName : row.datasetLabel;
    const reportedChange = readDatasetNumber(row.values, ['change', '涨跌', '变动']);
    const reportedChangePercent = readDatasetNumber(row.values, ['change_pct', 'change_percent', 'changePercent', '涨跌幅', '涨跌幅度']);
    if (!date || value === null || !code) continue;
    // Never calculate a change across two providers or index variants.
    const seriesKey = `${row.provider}:${row.datasetLabel}:${code}`;
    const item: IndexObservation = {
      key: `${seriesKey}:${date}`,
      seriesKey,
      code,
      name,
      provider: row.provider,
      datasetLabel: row.datasetLabel,
      region: inferredRegion(code, name),
      date,
      value,
      reportedChange,
      reportedChangePercent,
      quality: row.quality,
      freshness: row.realtimeStatus,
    };
    unique.set(item.key, item);
  }
  return [...unique.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function latestSnapshots(rows: IndexObservation[]) {
  const groups = new Map<string, IndexObservation[]>();
  rows.forEach(row => groups.set(row.seriesKey, [...(groups.get(row.seriesKey) ?? []), row]));
  const perSeries = [...groups.values()].flatMap(history => {
    const ordered = history.slice().sort((left, right) => left.date.localeCompare(right.date));
    const latest = ordered.at(-1);
    if (!latest) return [];
    const previous = ordered.at(-2)?.value ?? null;
    const change = previous === null ? latest.reportedChange : latest.value - previous;
    const changePercent = previous === null
      ? latest.reportedChangePercent
      : previous && change !== null ? (change / previous) * 100 : null;
    return [{
      ...latest,
      previous,
      change,
      changePercent,
      historyCount: ordered.length,
    } satisfies IndexSnapshot];
  });
  // Keep one visible row per named index variant. A price index and a total
  // return index can share a ticker yet must remain visibly distinct.
  const byVariant = new Map<string, IndexSnapshot>();
  for (const row of perSeries) {
    const variantKey = `${row.code}:${row.name}`;
    const existing = byVariant.get(variantKey);
    if (!existing || row.date > existing.date ||
      (row.date === existing.date && row.historyCount > existing.historyCount)) byVariant.set(variantKey, row);
  }
  return [...byVariant.values()];
}

export default function WEIPanel() {
  const delivery = useModuleLiveFeed('/index-hub?panel=WEI', true);
  const observations = useMemo(() => mapIndexObservations(delivery.items), [delivery.items]);
  const snapshots = useMemo(() => latestSnapshots(observations), [observations]);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('全部');
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const regions = useMemo(() => ['全部', ...new Set(snapshots.map(row => row.region))], [snapshots]);
  const visible = useMemo(() => snapshots
    .filter(row => region === '全部' || row.region === region)
    .filter(row => !search || `${row.code} ${row.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((left, right) => (right.changePercent ?? Number.NEGATIVE_INFINITY) - (left.changePercent ?? Number.NEGATIVE_INFINITY)), [region, search, snapshots]);
  const selected = visible.find(row => row.seriesKey === selectedSeriesKey) ?? visible[0] ?? snapshots[0] ?? null;
  const history = useMemo(() => selected
    ? observations.filter(row => row.seriesKey === selected.seriesKey).sort((left, right) => left.date.localeCompare(right.date))
    : [], [observations, selected]);
  const latestDate = snapshots.map(row => row.date).sort().at(-1) ?? '—';
  const archiveSaved = delivery.items.some(item => Boolean(item.dataset?.metadata.observationIdentity));
  const connectionText = delivery.connection === 'live' ? '自动更新已连接' : delivery.connection === 'connecting' ? '正在连接更新通道' : '定时补收已启用';

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100" data-wei-live-state={delivery.connection}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-amber-300"><Activity className="h-5 w-5" />WEI · 全球股票指数</h1>
          <p className="mt-1 text-xs text-slate-400">真实历史观察、最新变动与永久归档；日频数据不标记为实时可执行报价。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
          <span className={observations.length ? 'text-emerald-300' : 'text-amber-300'}>{connectionText}</span>
          <span>{archiveSaved ? '永久归档已保存' : '等待可验证观察'}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void delivery.refetch()} disabled={delivery.isLoading} className="h-8 border-slate-700 bg-transparent text-xs"><RefreshCw className={`mr-1 h-3.5 w-3.5 ${delivery.isLoading ? 'animate-spin' : ''}`} />刷新</Button>
        </div>
      </header>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['指数序列', snapshots.length.toLocaleString()],
          ['永久观察', observations.length.toLocaleString()],
          ['最新观察期', latestDate],
          ['数据状态', observations.length ? '可用' : '等待数据'],
        ].map(([label, value]) => <Card key={label} className="border-slate-800 bg-slate-900/70 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 font-mono text-lg font-semibold text-slate-100">{value}</p></Card>)}
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-900/50 p-2">
        <Search className="h-4 w-4 text-slate-500" />
        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索指数代码或名称" className="h-8 min-w-56 flex-1 border-slate-700 bg-slate-950 text-xs" />
        <select value={region} onChange={event => setRegion(event.target.value)} className="h-8 border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200">{regions.map(item => <option key={item} value={item}>{item === '全部' ? '全部地区' : item}</option>)}</select>
      </div>

      {!visible.length ? (
        <section className="rounded border border-amber-900/70 bg-amber-950/20 px-4 py-12 text-center text-sm text-amber-200">{delivery.isLoading ? '正在读取永久指数观察…' : '当前筛选没有可验证数据；系统没有用固定样本补值。'}</section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="overflow-hidden border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 px-3 py-2"><h2 className="text-sm font-semibold text-amber-200">指数观察矩阵</h2><p className="text-[10px] text-slate-500">每个指数仅显示自身最新观察，不复制其他功能数据。</p></div>
            <div className="overflow-auto"><table className="w-full min-w-[760px] text-left text-[11px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="px-3 py-2">代码 / 名称</th><th>地区</th><th className="text-right">最新值</th><th className="text-right">本期变动</th><th className="text-right">变动率</th><th>观察期</th><th className="pr-3 text-right">历史数</th></tr></thead><tbody>{visible.map(row => <tr key={row.seriesKey} onClick={() => setSelectedSeriesKey(row.seriesKey)} className={`cursor-pointer border-t border-slate-800 ${selected?.seriesKey === row.seriesKey ? 'bg-amber-950/25' : 'hover:bg-slate-800/40'}`}><td className="px-3 py-2"><b className="font-mono text-amber-200">{row.code}</b><span className="ml-2 text-slate-300">{row.name}</span></td><td>{row.region}</td><td className="text-right font-mono">{formatDatasetNumber(row.value, 4)}</td><td className={`text-right font-mono ${(row.change ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{row.change === null ? '—' : formatDatasetNumber(row.change, 4)}</td><td className={`text-right font-mono ${(row.changePercent ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{row.changePercent === null ? '—' : `${row.changePercent.toFixed(3)}%`}</td><td>{row.date}</td><td className="pr-3 text-right">{row.historyCount}</td></tr>)}</tbody></table></div>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-start justify-between gap-2"><div><h2 className="font-semibold text-amber-200">{selected?.code ?? '—'} 历史轨迹</h2><p className="text-[10px] text-slate-500">{selected?.name ?? '未选择指数'} · {selected?.date ?? '—'}</p></div><Database className="h-4 w-4 text-cyan-300" /></div>
            <div className="h-[360px]">{history.length >= 2 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} minTickGap={24} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', fontSize: 11 }} /><Line type="monotone" dataKey="value" name="指数值" stroke="#f59e0b" dot={false} connectNulls /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-500">真实历史观察不足，未生成替代曲线。</div>}</div>
            {selected && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-500"><span>来源：{selected.provider || '未标机构'} · {selected.datasetLabel}</span><span>质量：{selected.quality}</span><span>时效：{selected.freshness}</span><span>观察：{selected.date}</span></div>}
          </Card>
        </section>
      )}
    </main>
  );
}
