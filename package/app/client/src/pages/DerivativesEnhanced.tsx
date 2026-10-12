import { useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { displayTaiwanDerivativeUnderlyingName, formatTaiwanContractMonth, taiwanDerivativeUnderlying, taiwanFuturesContractName, taiwanTradingSession } from '@shared/taiwanDerivativeNames';

type FutureObservation = {
  key: string;
  contract: string;
  underlying: string;
  underlyingName: string;
  contractName: string;
  month: string;
  session: string;
  date: string;
  settlement: number | null;
  close: number | null;
  volume: number | null;
  openInterest: number | null;
};

function mapFutures(items: ReturnType<typeof useModuleLiveFeed>['items']) {
  const rows = collectOpenBBDatasetRows(items).flatMap(row => {
    const contract = readDatasetText(row.values, ['symbol', 'contract_symbol'], '');
    const date = readDatasetText(row.values, ['date', 'timestamp'], '');
    const close = readDatasetNumber(row.values, ['close', 'value']);
    const settlementValue = readDatasetNumber(row.values, ['settlement_price', 'settlement']);
    const settlement = settlementValue !== null && (settlementValue !== 0 || close === null || close === 0) ? settlementValue : close;
    if (!contract || !date || (settlement === null && close === null)) return [];
    const underlying = readDatasetText(row.values, ['underlying_symbol', 'underlying'], contract.split(':')[0] || '');
    const month = readDatasetText(row.values, ['contract_month', 'expiration', 'expiry'], '');
    return [{
      key: row.key,
      contract,
      underlying,
      underlyingName: displayTaiwanDerivativeUnderlyingName(readDatasetText(row.values, ['underlying_name'], taiwanDerivativeUnderlying(underlying))),
      contractName: readDatasetText(row.values, ['contract_name'], taiwanFuturesContractName(underlying, month)),
      month,
      session: readDatasetText(row.values, ['trading_session', 'session'], '未提供'),
      date,
      settlement,
      close,
      volume: readDatasetNumber(row.values, ['volume']),
      openInterest: readDatasetNumber(row.values, ['open_interest', 'oi']),
    } satisfies FutureObservation];
  });
  const unique = new Map<string, FutureObservation>();
  rows.forEach(row => unique.set(`${row.contract}:${row.date}`, row));
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date) || a.contract.localeCompare(b.contract));
}

export default function DerivativesEnhanced() {
  const delivery = useModuleLiveFeed('/deri', true);
  const rows = useMemo(() => mapFutures(delivery.items), [delivery.items]);
  const latestDate = rows[0]?.date ?? '';
  const latestRows = useMemo(() => rows.filter(row => row.date === latestDate), [latestDate, rows]);
  const contracts = useMemo(() => [...new Set(rows.map(row => row.contract))], [rows]);
  const [selectedContract, setSelectedContract] = useState('');
  const activeContract = selectedContract && contracts.includes(selectedContract) ? selectedContract : contracts[0] ?? '';
  const history = useMemo(() => rows.filter(row => row.contract === activeContract).slice().sort((a, b) => a.date.localeCompare(b.date)), [activeContract, rows]);
  const current = history.at(-1) ?? null;
  const totalVolume = latestRows.reduce((sum, row) => sum + (row.volume ?? 0), 0);
  const totalOpenInterest = latestRows.reduce((sum, row) => sum + (row.openInterest ?? 0), 0);
  const archiveSaved = delivery.items.some(item => Boolean(item.dataset?.metadata.observationIdentity));
  const hasOpenBB = delivery.items.some(item => item.dataset?.metadata.schemaVersion === 'openbb-query-v1');
  const hasFinMind = delivery.items.some(item => item.dataset?.metadata.schemaVersion === 'module-observation-history-v1');
  const apiStatus = hasFinMind
    ? '期货数据服务已连接'
    : hasOpenBB
      ? '期货数据服务已连接'
      : rows.length
        ? '期货数据服务已连接'
        : '暂无可验证期货观察';

  return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-5 text-slate-100">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-amber-400"><Activity className="h-5 w-5" />DERI · 期货 · 台股指数期货</h1><p className="mt-1 text-xs text-slate-400">TX = 台湾加权股价指数期货，标的是台湾加权股价指数；斜杠月份为跨月价差。交易日汇总自动更新，非逐笔实时报价。</p></div>
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-400"><span className={rows.length ? 'text-emerald-300' : 'text-amber-300'}>{apiStatus}</span><span>{archiveSaved ? '永久归档：已保存' : '永久归档：等待可验证记录'}</span><span>最新交易日：{latestDate || '未提供'}</span><span>{delivery.connection === 'live' ? '自动更新通道已连接' : delivery.connection === 'connecting' ? '正在连接' : '定时检查更新'}</span><Button type="button" variant="outline" size="sm" onClick={() => void delivery.refetch()} disabled={delivery.isLoading} className="border-amber-700/60 text-amber-300"><RefreshCw className={`mr-1 h-3.5 w-3.5 ${delivery.isLoading ? 'animate-spin' : ''}`} />刷新</Button></div>
    </header>

    {rows.length ? <>
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['最新观察期', latestDate || '—'],
          ['活跃合约', String(latestRows.length)],
          ['当期成交量', totalVolume.toLocaleString()],
          ['当期未平仓量', totalOpenInterest.toLocaleString()],
        ].map(([label, value]) => <Card key={label} className="border-slate-800 bg-slate-900/70 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 font-mono text-xl font-semibold text-amber-300">{value}</p></Card>)}
      </section>

      <section className="mb-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-amber-300">合约历史</h2><p className="text-[10px] text-slate-500">{current?.underlyingName ?? '台湾加权股价指数'} · 交易日汇总，非实时可执行报价</p></div><select value={activeContract} onChange={event => setSelectedContract(event.target.value)} className="h-8 max-w-72 border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200">{contracts.map(contract => <option key={contract} value={contract}>{rows.find(row => row.contract === contract)?.contractName ?? contract} · {contract}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-2 border-y border-slate-800 py-2 text-xs"><div><span className="block text-slate-500">结算价</span><b className="font-mono text-slate-100">{formatDatasetNumber(current?.settlement ?? current?.close ?? null, 2)}</b></div><div><span className="block text-slate-500">成交量</span><b className="font-mono text-slate-100">{formatDatasetNumber(current?.volume ?? null, 0)}</b></div><div><span className="block text-slate-500">未平仓量</span><b className="font-mono text-slate-100">{formatDatasetNumber(current?.openInterest ?? null, 0)}</b></div></div>
          <div className="mt-3 h-72">{history.length >= 2 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={history}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 9 }} /><Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} /><Line type="monotone" dataKey="settlement" name="结算价" stroke="#f59e0b" dot={false} connectNulls /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-500">该合约历史观察不足。</div>}</div>
        </Card>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-3 py-2"><h2 className="font-semibold text-amber-300">合约观察明细</h2><p className="text-[10px] text-slate-500">共载入 {rows.length} 条永久归档记录 · 结算价单位为指数点；跨月价差不可当作指数水平</p></div>
          <div className="max-h-[390px] overflow-auto"><table className="w-full min-w-[920px] text-left text-[11px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="px-3 py-2">观察期</th><th>合约名称 / 代码</th><th>到期月</th><th>时段</th><th className="text-right">结算价（点）</th><th className="text-right">收盘价（点）</th><th className="text-right">成交量</th><th className="pr-3 text-right">未平仓量</th></tr></thead><tbody>{rows.slice(0, 500).map(row => <tr key={row.key} className="border-t border-slate-800/80 hover:bg-slate-800/40"><td className="px-3 py-1.5 font-mono text-slate-400">{row.date}</td><td><span className="block text-amber-200">{row.contractName}</span><span className="font-mono text-slate-500">{row.contract}</span></td><td>{formatTaiwanContractMonth(row.month)}</td><td>{taiwanTradingSession(row.session)}</td><td className="text-right font-mono">{formatDatasetNumber(row.settlement, 2)}</td><td className="text-right font-mono">{formatDatasetNumber(row.close, 2)}</td><td className="text-right font-mono">{formatDatasetNumber(row.volume, 0)}</td><td className="pr-3 text-right font-mono">{formatDatasetNumber(row.openInterest, 0)}</td></tr>)}</tbody></table></div>
        </Card>
      </section>
    </> : <Card className="border-amber-900/50 bg-amber-950/10 p-8 text-center text-sm text-amber-200">暂未收到可验证的期货合约观察；页面不会生成替代行情。</Card>}
  </main>;
}
