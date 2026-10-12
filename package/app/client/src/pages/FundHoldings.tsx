import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { trpc } from '@/lib/trpc';

export function projectVerifiedFundHoldings(items: ModuleLiveFeedItem[], fundCode: string) {
  const matches = collectOpenBBDatasetRows(items).flatMap(row => {
    const values = row.values;
    const parent = readDatasetText(values, ['etf_symbol', 'fund_symbol', 'parent_symbol', 'etf_code', 'fund_code'], '');
    if (!parent || parent.toUpperCase() !== fundCode.toUpperCase()) return [];
    const name = readDatasetText(values, ['holding_name', 'security_name', 'constituent_name', 'asset_name'], '');
    if (!name) return [];
    const symbol = readDatasetText(values, ['holding_symbol', 'security_symbol', 'constituent_symbol'], '');
    const weight = readDatasetNumber(values, ['weight', 'weight_percent', 'weight_pct', 'portfolio_weight']);
    if (weight !== null && (weight < 0 || weight > 100)) return [];
    return [{ name, symbol, weight, observedAt: row.observedAt, provider: row.provider }];
  });
  const unique = new Map<string, (typeof matches)[number]>();
  for (const row of matches.sort((a, b) => (a.observedAt ?? '').localeCompare(b.observedAt ?? ''))) {
    unique.set(`${row.symbol || row.name}`.toUpperCase(), row);
  }
  return [...unique.values()].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1));
}

export default function FundHoldings() {
  const [, navigate] = useLocation();
  const initialCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') ?? '' : '';
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [searchText, setSearchText] = useState(code);
  const validCode = /^[A-Z0-9.-]{1,20}$/.test(code);
  const openFundCode = /^\d{6}$/.test(code);
  const archive = trpc.freeMarketData.searchFundArchive.useQuery(
    { query: openFundCode ? code : '000000', page: 0, limit: 50 },
    { enabled: openFundCode, staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const history = trpc.freeMarketData.fundArchiveDetail.useQuery(
    { code: openFundCode ? code : '000000' },
    { enabled: openFundCode, staleTime: 30_000, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const delivery = useModuleLiveFeed('/etf-holdings-admin', validCode && !openFundCode, { acknowledge: false });
  const disclosure = trpc.freeMarketData.fundHoldingsDisclosure.useQuery(
    { code: openFundCode ? code : '000000' },
    { enabled: openFundCode, staleTime: 60_000, refetchInterval: 10 * 60_000, refetchOnWindowFocus: true, retry: 1 },
  );
  const holdings = validCode && !openFundCode ? projectVerifiedFundHoldings(delivery.items, code) : [];
  const fund = (archive.data?.rows ?? []).find(row => row.code === code);
  const latest = history.data?.at(-1);

  return <div className="min-h-screen space-y-4 bg-slate-950 p-4 text-slate-100">
    <button type="button" onClick={() => navigate('/fund-browse')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />返回基金列表</button>
    <h1 className="text-xl font-bold">基金持仓 · {fund?.name ?? (validCode ? code : '选择基金')}</h1>
    <form className="flex max-w-xl gap-2" onSubmit={event => {
      event.preventDefault();
      const next = searchText.trim().toUpperCase();
      if (!/^[A-Z0-9.-]{1,20}$/.test(next)) return;
      setCode(next);
      navigate(`/fund-holdings?id=${encodeURIComponent(next)}`);
    }}>
      <Input aria-label="基金或 ETF 代码" placeholder="输入基金或 ETF 代码" value={searchText} onChange={event => setSearchText(event.target.value)} className="border-slate-700 bg-slate-900" />
      <Button type="submit" variant="outline"><Search className="mr-1 h-4 w-4" />查询</Button>
    </form>
    {!validCode ? <p className="text-sm text-slate-400">请输入具体基金或 ETF 代码；不默认选择示例基金。</p> : <>
      {openFundCode && <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="text-sm">基金归档识别</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs">
          {archive.isLoading || history.isLoading ? <p className="text-slate-400">正在读取实际归档…</p>
            : archive.isError || history.isError ? <p className="text-rose-300">基金归档接口暂不可用。</p>
            : fund ? <><p>{fund.code} · {fund.name}</p><p>最新已归档净值：{latest ? `${latest.currency} ${latest.netAssetValue?.toFixed(4) ?? '—'}` : '—'}</p><p>观察日期：{latest?.observationDate ?? fund.observationDate}</p></>
            : <p className="text-amber-300">没有找到该代码的基金归档，不显示替代基金。</p>}
        </CardContent>
      </Card>}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="text-sm">实际持仓披露（非盘中实时）</CardTitle></CardHeader>
        <CardContent>
          {openFundCode ? <>
            <p className="mb-3 text-xs text-slate-400">来源：{disclosure.data?.source ?? 'AKShare / 天天基金公开持仓披露'}；按各资产最新可用季度展示。后端对已查询基金定期复查，不把采集时间当作持仓变动时间。</p>
            {disclosure.isLoading ? <p className="py-5 text-sm text-slate-400">正在按基金代码读取股票与债券披露…</p>
              : disclosure.isError ? <p className="py-5 text-sm text-rose-300">持仓披露服务暂不可用；不会展示其他基金的持仓。</p>
              : <>
                <p className="mb-2 text-xs text-slate-400">最近采集：{disclosure.data?.retrievedAt ? new Date(disclosure.data.retrievedAt).toLocaleString() : '尚无成功采集'}；最近尝试：{disclosure.data?.lastAttemptAt ? new Date(disclosure.data.lastAttemptAt).toLocaleString() : '—'}</p>
                {Object.entries(disclosure.data?.errors ?? {}).map(([kind, message]) => <p key={kind} className="text-xs text-amber-300">{kind === 'stock' ? '股票' : '债券'}披露本次读取失败：{message}。如显示旧记录，采集时间以该行标注为准。</p>)}
                {disclosure.data?.holdings.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="text-slate-400"><tr><th className="py-2">类型</th><th>代码</th><th>具体名称</th><th>净值占比</th><th>披露季度</th><th>采集时间</th></tr></thead>
                  <tbody>{disclosure.data.holdings.map(row => <tr key={`${row.assetType}:${row.period}:${row.symbol}`} className="border-t border-slate-800"><td className="py-2">{row.assetType === 'stock' ? '股票' : '债券'}</td><td className="font-mono">{row.symbol}</td><td>{row.name}</td><td className="font-mono">{row.weight === null ? '—' : `${row.weight.toFixed(2)}%`}</td><td>{row.period}</td><td>{row.collectedAt ? new Date(row.collectedAt).toLocaleString() : '旧归档'}</td></tr>)}</tbody>
                </table></div> : <p className="py-5 text-sm text-amber-300">该代码暂无可核验的股票或债券持仓披露，不用其他基金的成分填充。</p>}
              </>}
          </> : holdings.length ? <>
            <p className="mb-2 text-xs text-slate-400">{holdings.length} 条匹配 {code} 的持仓记录；按披露权重排序。</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-slate-400"><tr><th className="py-2">成分代码</th><th>成分名称</th><th>披露权重</th><th>观察时间</th></tr></thead>
              <tbody>{holdings.map(row => <tr key={`${row.symbol}:${row.name}`} className="border-t border-slate-800"><td className="py-2 font-mono">{row.symbol || '—'}</td><td>{row.name}</td><td className="font-mono">{row.weight === null ? '—' : `${row.weight.toFixed(2)}%`}</td><td>{row.observedAt ?? '未提供'}</td></tr>)}</tbody>
            </table></div>
          </> : <p className="py-5 text-sm text-amber-300">该代码暂无可核验的持仓披露。不会用另一只基金的成分、模拟权重或推算图表填充。</p>}
        </CardContent>
      </Card>
    </>}
  </div>;
}
