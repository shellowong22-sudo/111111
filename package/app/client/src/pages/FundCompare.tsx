import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, BarChart2, Search } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';

type DatedNav = { observationDate: string; netAssetValue: number | null };
type FundSeries = { code: string; observations: DatedNav[] };
const COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#c084fc'];

export function buildFundComparison(series: FundSeries[]) {
  const indexed = series.map(fund => {
    const byDate = new Map<string, number>();
    for (const point of fund.observations) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(point.observationDate) &&
        typeof point.netAssetValue === 'number' && Number.isFinite(point.netAssetValue) && point.netAssetValue > 0) {
        byDate.set(point.observationDate, point.netAssetValue);
      }
    }
    const ordered = [...byDate].sort(([a], [b]) => a.localeCompare(b));
    return { code: fund.code, ordered };
  });
  const commonDates = indexed.length
    ? indexed[0].ordered.map(([date]) => date).filter(date =>
        indexed.every(fund => fund.ordered.some(([day]) => day === date)))
    : [];
  const chart = commonDates.map(date => {
    const point: Record<string, string | number> = { date };
    for (const fund of indexed) {
      const value = fund.ordered.find(([day]) => day === date)?.[1];
      const base = fund.ordered.find(([day]) => day === commonDates[0])?.[1];
      if (value !== undefined && base) point[fund.code] = Number((value / base * 100).toFixed(4));
    }
    return point;
  });
  return { chart, indexed };
}

export default function FundCompare() {
  const [, navigate] = useLocation();
  const initialCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fund') : null;
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    initialCode && /^\d{6}$/.test(initialCode) ? [initialCode] : [],
  );
  const [searchText, setSearchText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const archive = trpc.freeMarketData.searchFundArchive.useQuery(
    { query: searchTerm, page: 0, limit: 50 },
    { staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const comparison = trpc.freeMarketData.compareFundArchive.useQuery(
    { codes: selectedCodes.length ? selectedCodes : ['000000'] },
    { enabled: selectedCodes.length > 0, staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const series = (comparison.data ?? []).filter(row => selectedCodes.includes(row.code));
  const { chart, indexed } = buildFundComparison(series);
  const names = new Map([
    ...(archive.data?.rows ?? []).map(row => [row.code, row.name] as const),
    ...series.flatMap(row => row.observations.length
      ? [[row.code, row.observations[0].name] as const] : []),
  ]);
  const toggle = (code: string) => setSelectedCodes(current => current.includes(code)
    ? current.filter(item => item !== code)
    : current.length < 4 ? [...current, code] : current);

  return <div className="min-h-screen space-y-4 bg-slate-950 p-4 text-slate-100">
    <button type="button" onClick={() => navigate('/fund-browse')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />返回基金列表</button>
    <header>
      <h1 className="flex items-center gap-2 text-xl font-bold"><BarChart2 className="h-5 w-5 text-emerald-400" />基金对比分析</h1>
      <p className="mt-1 text-xs text-slate-400">从已归档基金中选择最多 4 只，只比较各基金真实净值观察；缺失的年份收益、评级和风险指标不推算。</p>
    </header>
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader><CardTitle className="text-sm">选择基金（{selectedCodes.length}/4）</CardTitle></CardHeader>
      <CardContent>
        <form className="mb-3 flex gap-2" onSubmit={event => { event.preventDefault(); setSearchTerm(searchText.trim()); }}>
          <Input aria-label="搜索基金代码或名称" value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="输入基金代码或名称" className="border-slate-700 bg-slate-950" />
          <Button type="submit" variant="outline"><Search className="mr-1 h-4 w-4" />搜索</Button>
        </form>
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedCodes.map(code => <Button key={code} type="button" size="sm" variant="outline" className="border-emerald-700 text-emerald-300" onClick={() => toggle(code)}>{names.get(code) ?? code} · 移除</Button>)}
        </div>
        <div className="max-h-52 overflow-auto border-t border-slate-800">
          {archive.isLoading ? <p className="py-3 text-xs text-slate-400">正在读取基金归档…</p>
            : archive.isError ? <p className="py-3 text-xs text-rose-300">归档接口不可用，请稍后重试。</p>
            : (archive.data?.rows ?? []).length ? (archive.data?.rows ?? []).map(row =>
              <button key={row.code} type="button" disabled={!selectedCodes.includes(row.code) && selectedCodes.length >= 4} onClick={() => toggle(row.code)}
                className="flex w-full justify-between border-b border-slate-800 px-2 py-1.5 text-left text-xs hover:bg-slate-800 disabled:opacity-40">
                <span>{row.code} · {row.name}</span><span className="font-mono text-slate-400">{row.netAssetValue == null ? '净值缺失' : `${row.currency} ${row.netAssetValue.toFixed(4)}`} · {row.observationDate}</span>
              </button>)
              : <p className="py-3 text-xs text-slate-400">没有匹配的基金。</p>}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">当前结果显示前 50 只；输入准确代码或名称搜索全库。净值为交易日归档，不是盘中实时成交价。</p>
      </CardContent>
    </Card>
    {selectedCodes.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">请选择基金，开始真实净值对比。</p>
      : comparison.isLoading ? <p className="py-8 text-center text-sm text-slate-400">正在读取独立历史归档…</p>
      : comparison.isError ? <p className="py-8 text-center text-sm text-rose-300">基金历史接口不可用；不会显示示例曲线。</p>
      : <>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-sm">各基金净值走势（共同观察首日 = 100）</CardTitle></CardHeader>
          <CardContent>
            {chart.length >= 2 ? <div className="h-72" aria-label="基金真实净值对比曲线">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} width={45} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155' }} />
                  {selectedCodes.map((code, index) => <Line key={code} name={names.get(code) ?? code} type="monotone" dataKey={code} stroke={COLORS[index]} strokeWidth={2} connectNulls={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div> : <p className="py-8 text-center text-sm text-amber-300">所选基金少于两个共同的有效观察日，无法绘制可比较的变化曲线。</p>}
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-sm">独立观察数据</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs"><thead className="text-slate-400"><tr><th className="py-2">基金</th><th>最新净值</th><th>观察日期</th><th>有效观察日</th><th>相邻净值变化</th></tr></thead>
              <tbody>{selectedCodes.map(code => {
                const fund = indexed.find(item => item.code === code);
                const points = fund?.ordered ?? [];
                const latest = points.at(-1);
                const previous = points.at(-2);
                return <tr key={code} className="border-t border-slate-800"><td className="py-2">{code} · {names.get(code) ?? '名称未归档'}</td><td className="font-mono">{latest ? `CNY ${latest[1].toFixed(4)}` : '—'}</td><td>{latest?.[0] ?? '—'}</td><td>{points.length}</td><td className="font-mono">{latest && previous ? `${((latest[1] / previous[1] - 1) * 100).toFixed(2)}%` : '—'}</td></tr>;
              })}</tbody>
            </table>
          </CardContent>
        </Card>
      </>}
  </div>;
}
