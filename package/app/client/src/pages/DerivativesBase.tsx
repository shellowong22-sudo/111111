import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import ModuleLiveDeliveryTable from '@/components/ModuleLiveDeliveryTable';

interface DerivativesBaseProps {
  title: string;
  code: string;
  description: string;
  apiEndpoint: string;
  dataType: 'swap' | 'futures' | 'cds' | 'option' | 'commodity' | 'volatility' | 'news' | 'research' | 'trading' | 'dashboard' | 'analysis';
}

type ArchivedFuturesRow = {
  symbol: string;
  name: string;
  contractName: string;
  category: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  openInterest: number | null;
  date: string;
};

function firstPositiveNumber(values: Record<string, string | number | boolean | null>, aliases: string[]) {
  for (const alias of aliases) {
    const value = readDatasetNumber(values, [alias]);
    if (value !== null && value > 0) return value;
  }
  return null;
}

export function readArchivedFuturesRows(items: ReturnType<typeof useModuleLiveFeed>['items']): ArchivedFuturesRow[] {
  const rows = collectOpenBBDatasetRows(items)
    .filter(row => ['期货公开快照', '中国期货公开快照', '台湾期货日成交'].includes(row.datasetLabel))
    .flatMap((row): ArchivedFuturesRow[] => {
      const symbol = readDatasetText(row.values, ['symbol', '标的', '代码'], '').trim();
      const name = readDatasetText(row.values, ['name', 'underlying_name', '名称', '合约名称'], '').trim();
      const contractName = readDatasetText(row.values, ['contract_name', '合约名称'], name).trim();
      const price = firstPositiveNumber(row.values, row.datasetLabel === '台湾期货日成交'
        ? ['settlement_price', 'close', 'value', '结算价']
        : ['value', 'close', '最新价', '价格']);
      const change = readDatasetNumber(row.values, ['change', '涨跌额', '涨跌']);
      const reportedChangePct = readDatasetNumber(row.values, ['change_pct', 'changePct', '涨跌幅']);
      // A contradictory absolute/percentage change must not be shown as two
      // simultaneous market facts. Preserve the raw archive for later audit.
      const changePct = change !== null && reportedChangePct !== null && change * reportedChangePct < 0
        ? null : reportedChangePct;
      const volume = readDatasetNumber(row.values, ['volume', '成交量']);
      const openInterest = readDatasetNumber(row.values, ['open_interest', 'openInterest', '持仓量']);
      const date = readDatasetText(row.values, ['date', '观察期', '交易日期'], row.observedAt ?? '');
      if (!symbol || !name || (price === null && volume === null && openInterest === null)) return [];
      return [{ symbol, name, contractName, category: row.datasetLabel, price, change, changePct, volume, openInterest, date }];
    });
  const deduped = new Map<string, ArchivedFuturesRow>();
  for (const row of rows) {
    const key = `${row.category}|${row.symbol}|${row.contractName}`;
    const previous = deduped.get(key);
    if (!previous || row.date >= previous.date) deduped.set(key, row);
  }
  return [...deduped.values()].sort((left, right) =>
    right.date.localeCompare(left.date)
    || (right.openInterest ?? -1) - (left.openInterest ?? -1)
    || (right.volume ?? -1) - (left.volume ?? -1)
    || left.symbol.localeCompare(right.symbol),
  );
}

type PositionRow = {
  symbol: string;
  name: string;
  date: string;
  openInterest: number;
  producerNet: number | null;
  swapNet: number | null;
  managedMoneyNet: number | null;
  otherReportNet: number | null;
  nonReportableNet: number | null;
};

export function readCftcPositions(items: ReturnType<typeof useModuleLiveFeed>['items']): PositionRow[] {
  const latest = new Map<string, PositionRow>();
  for (const row of collectOpenBBDatasetRows(items).filter(row => row.datasetLabel === 'CFTC 全球期货持仓周报')) {
    const symbol = readDatasetText(row.values, ['symbol', '标的'], '');
    const name = readDatasetText(row.values, ['contract_name', 'name', '名称'], '');
    const date = readDatasetText(row.values, ['date', '观察期'], row.observedAt ?? '');
    const openInterest = readDatasetNumber(row.values, ['open_interest', '未平仓量']);
    if (!symbol || !name || !date || openInterest === null) continue;
    const item = {
      symbol, name, date, openInterest,
      producerNet: readDatasetNumber(row.values, ['producer_net']),
      swapNet: readDatasetNumber(row.values, ['swap_net']),
      managedMoneyNet: readDatasetNumber(row.values, ['managed_money_net']),
      otherReportNet: readDatasetNumber(row.values, ['other_report_net']),
      nonReportableNet: readDatasetNumber(row.values, ['non_reportable_net']),
    };
    if (!latest.has(symbol) || latest.get(symbol)!.date < date) latest.set(symbol, item);
  }
  return [...latest.values()].sort((a, b) => b.openInterest - a.openInterest);
}

const INTEGRATED_FUTURES_LABELS = new Set(['期货公开快照', '中国期货公开快照', '台湾期货日成交', 'CFTC 全球期货持仓周报']);

export function derivativeArchivePath(apiEndpoint: string) {
  if (apiEndpoint === 'openbb://derivatives_futures_curve') return '/commodity-futures';
  if (apiEndpoint === 'openbb://derivatives_options_chains') return '/_index-options';
  return '';
}

export default function DerivativesBase({
  title,
  code,
  description,
  apiEndpoint,
  dataType,
}: DerivativesBaseProps) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const archivePath = derivativeArchivePath(apiEndpoint);
  const archiveDelivery = useModuleLiveFeed(archivePath, Boolean(archivePath));
  const archivedFutures = useMemo(
    () => readArchivedFuturesRows(archiveDelivery.items),
    [archiveDelivery.items],
  );
  const cftcPositions = useMemo(() => readCftcPositions(archiveDelivery.items), [archiveDelivery.items]);
  const otherDeliveries = useMemo(() => archiveDelivery.items.filter(item =>
    !item.dataset || !INTEGRATED_FUTURES_LABELS.has(item.dataset.label)), [archiveDelivery.items]);
  const filteredFutures = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return archivedFutures;
    return archivedFutures.filter(row =>
      `${row.symbol} ${row.name}`.toLocaleLowerCase().includes(query),
    );
  }, [archivedFutures, search]);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(filteredFutures.length / pageSize));
  const visiblePage = Math.min(page, pageCount);

  useEffect(() => {
    if (apiEndpoint.startsWith('openbb://')) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    fetchData();
  }, [apiEndpoint]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // OpenBB data is delivered through the canonical module feed. The old
      // example.com URL was never a production source and must not be treated
      // as a market quote endpoint.
      if (apiEndpoint.startsWith('openbb://') || apiEndpoint.includes('api.example.com')) {
        setData(null);
        setError('数据源未配置：请在管理后台启用对应 OpenBB 数据提供商。');
        return;
      }
      
      // 调用外部 API
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`API 返回错误: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
      // Provider failures remain visible. Never turn an unavailable source
      // into a synthetic quote or a static-looking trading table.
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <RefreshCw className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-slate-400">正在加载数据...</p>
        </div>
      </div>
    );
  }

  if (apiEndpoint.startsWith('openbb://')) {
    if (archivePath === '/_index-options') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Button variant="ghost" onClick={() => setLocation('/')} className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />返回
            </Button>
            <h1 className="text-3xl font-bold text-amber-400 mb-2">{title}</h1>
            <p className="text-slate-400 mb-6">{description}</p>
            <ModuleLiveDeliveryTable
              items={archiveDelivery.items}
              connection={archiveDelivery.connection}
              receivedAt={archiveDelivery.receivedAt}
              title="指数期权数据"
            />
          </div>
        </div>
      );
    }
    const latestDate = archivedFutures.map(row => row.date).sort().at(-1) ?? null;
    const countFor = (label: string) => archivedFutures.filter(row => row.category === label).length;
    const isReading = archiveDelivery.isLoading || archiveDelivery.connection === 'connecting';
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Button variant="ghost" onClick={() => setLocation('/')} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-amber-400 mb-2">{title}</h1>
              <p className="text-slate-400">{description}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                行情与成交观察日 {latestDate ?? '—'}；周度持仓另列，均非可执行报价
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void archiveDelivery.refetch()}
              disabled={archiveDelivery.isLoading}
              className="border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${archiveDelivery.isLoading ? 'animate-spin' : ''}`} />
              重新读取已归档观察
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              ['行情与成交合约', archivedFutures.length ? archivedFutures.length.toLocaleString() : '—'],
              ['全球期货合约', countFor('期货公开快照').toLocaleString()],
              ['中国期货合约', countFor('中国期货公开快照').toLocaleString()],
              ['台湾期货合约', countFor('台湾期货日成交').toLocaleString()],
            ].map(([label, value]) => (
              <Card key={label} className="bg-slate-900/50 border-slate-800 p-4">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className="text-xl font-bold text-amber-400">{value}</p>
              </Card>
            ))}
          </div>

          {!isReading && !archivedFutures.length && !cftcPositions.length && !otherDeliveries.length && (
            <Card className="bg-amber-950/20 border-amber-800 p-4 mb-4">
              <p className="text-amber-200 text-sm">当前没有可验证的期货快照。</p>
              <p className="text-slate-400 text-xs mt-2">
                页面不会用静态、随机或历史示例代替；请在管理后台核验对应行情或期货持仓接口。
              </p>
              {archiveDelivery.error && (
                <p className="text-slate-500 text-xs mt-1">{archiveDelivery.error.message}</p>
              )}
            </Card>
          )}

          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-amber-400">期货合约快照</h2>
                <p className="text-[11px] text-slate-500 mt-1">全球、中国与台湾期货各自独立归档；不跨合同拼接，零结算价不当作报价；涨跌额与涨跌幅相互矛盾时不展示后者。</p>
              </div>
              <input
                value={search}
                onChange={event => { setSearch(event.target.value); setPage(1); }}
                placeholder="搜索代码或合约名称"
                className="h-8 w-56 rounded border border-slate-700 bg-black px-2 text-xs text-slate-200"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['市场观察', '代码', '合约名称', '收盘/结算观察价', '涨跌额', '涨跌幅', '成交量', '持仓量', '观察日'].map(label => (
                      <th key={label} className="px-3 py-2 text-left text-amber-400">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFutures.slice((visiblePage - 1) * pageSize, visiblePage * pageSize).map(row => (
                    <tr key={`${row.category}-${row.symbol}-${row.contractName}`} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-xs text-slate-400">{row.category}</td>
                      <td className="px-3 py-2 font-mono text-cyan-200">{row.symbol}</td>
                      <td className="px-3 py-2 text-slate-200">{row.contractName}</td>
                      <td className="px-3 py-2 text-right text-slate-100">{row.price?.toLocaleString() ?? '—'}</td>
                      <td className={`px-3 py-2 text-right ${row.change == null ? 'text-slate-500' : row.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.change == null ? '—' : `${row.change >= 0 ? '+' : ''}${row.change.toLocaleString()}`}
                      </td>
                      <td className={`px-3 py-2 text-right ${row.changePct == null ? 'text-slate-500' : row.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.changePct == null ? '—' : `${row.changePct >= 0 ? '+' : ''}${row.changePct.toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.volume?.toLocaleString() ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.openInterest?.toLocaleString() ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{row.date || '—'}</td>
                    </tr>
                  ))}
                  {!isReading && filteredFutures.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">没有匹配的真实合约。</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredFutures.length > pageSize && <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-400">
              <span>第 {visiblePage} / {pageCount} 页 · 共 {filteredFutures.length.toLocaleString()} 个合约</span>
              <Button variant="outline" size="sm" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>上一页</Button>
              <Button variant="outline" size="sm" disabled={visiblePage === pageCount} onClick={() => setPage(visiblePage + 1)}>下一页</Button>
            </div>}
          </Card>
          {cftcPositions.length > 0 && <Card className="mt-4 bg-slate-900/50 border-slate-800 p-4">
            <h2 className="text-lg font-semibold text-amber-400">全球期货持仓结构</h2>
            <p className="mt-1 mb-3 text-[11px] text-slate-500">周度报告，不是实时价格；净持仓 = 多头 − 空头。缺失字段保持空值。</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-sm">
                <thead><tr className="border-b border-slate-700">{['合约', '未平仓量', '生产商净持仓', '掉期商净持仓', '管理基金净持仓', '其他报告净持仓', '非报告净持仓', '报告日'].map(label =>
                  <th key={label} className="px-3 py-2 text-left text-amber-400">{label}</th>)}</tr></thead>
                <tbody>{cftcPositions.map(row => <tr key={row.symbol} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="px-3 py-2 text-slate-200">{row.name}</td>
                  {[row.openInterest, row.producerNet, row.swapNet, row.managedMoneyNet, row.otherReportNet, row.nonReportableNet].map((value, index) =>
                    <td key={index} className="px-3 py-2 text-right tabular-nums text-slate-300">{value === null ? '—' : value.toLocaleString()}</td>)}
                  <td className="px-3 py-2 text-slate-500">{row.date}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </Card>}
          {otherDeliveries.length > 0 && <div className="mt-4">
            <ModuleLiveDeliveryTable items={otherDeliveries} connection={archiveDelivery.connection} receivedAt={archiveDelivery.receivedAt} title="其他已核验期货观察" />
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-amber-400 mb-2">{title}</h1>
            <p className="text-slate-400">{description}</p>
          </div>
          <Button
            variant="outline"
            onClick={fetchData}
            className="border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>

        {error && (
          <Card className="bg-red-900/20 border-red-700 p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-slate-400 text-xs mt-2">数据源未配置或暂不可用；页面不以静态、随机或合成数据替代。</p>
          </Card>
        )}

        {data && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-slate-900/50 border-slate-800 p-6">
                <p className="text-slate-400 text-sm mb-2">当前价格</p>
                <p className="text-3xl font-bold text-amber-400">{data.stats.current}</p>
                <p className={`text-sm mt-2 ${data.stats.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {data.stats.change >= 0 ? '↑' : '↓'} {Math.abs(data.stats.change)} bp
                </p>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-6">
                <p className="text-slate-400 text-sm mb-2">日均成交量</p>
                <p className="text-3xl font-bold text-amber-400">{data.stats.volume}</p>
                <p className="text-sm text-slate-400 mt-2">较昨日 +8.2%</p>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-6">
                <p className="text-slate-400 text-sm mb-2">隐含波动率</p>
                <p className="text-3xl font-bold text-amber-400">{data.stats.volatility}%</p>
                <p className="text-sm text-red-400 mt-2">↓ -0.3%</p>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 p-6">
                <p className="text-slate-400 text-sm mb-2">变化幅度</p>
                <p className="text-3xl font-bold text-amber-400">{data.stats.changePercent}%</p>
                <p className="text-sm text-slate-400 mt-2">日涨幅</p>
              </Card>
            </div>

            {/* 图表 */}
            <Card className="bg-slate-900/50 border-slate-800 p-6 mb-6">
              <h2 className="text-lg font-semibold text-amber-400 mb-4">价格走势</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" name="价格" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* 数据表格 */}
            {data.tableData && (
              <Card className="bg-slate-900/50 border-slate-800 p-6">
                <h2 className="text-lg font-semibold text-amber-400 mb-4">期限结构</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-2 text-left text-amber-400">期限</th>
                        <th className="px-4 py-2 text-right text-amber-400">买价</th>
                        <th className="px-4 py-2 text-right text-amber-400">卖价</th>
                        <th className="px-4 py-2 text-right text-amber-400">点差</th>
                        <th className="px-4 py-2 text-right text-amber-400">成交量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tableData.map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="px-4 py-2 text-slate-300">{row.tenor}</td>
                          <td className="px-4 py-2 text-right text-slate-300">{row.bid}</td>
                          <td className="px-4 py-2 text-right text-slate-300">{row.ask}</td>
                          <td className="px-4 py-2 text-right text-slate-300">{row.spread} bp</td>
                          <td className="px-4 py-2 text-right text-amber-400">{row.volume}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
