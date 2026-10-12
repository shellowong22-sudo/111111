import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { SECONDARY_MARKETS } from '@/lib/secondaryMarketsData';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

type SecondaryRow = { key: string; market: string; code: string; name: string; price: number | null; change: number | null; volume: number | null; spread: number | null; yield: number | null; rating: string; };

function normalize(value: string) { return value.toLocaleLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, ''); }

function mapSecondaryRows(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map((row): SecondaryRow => ({
    key: row.key,
    market: readDatasetText(row.values, ['market', 'market_id', 'asset_class', 'segment'], ''),
    code: readDatasetText(row.values, ['symbol', 'code', 'ticker', 'instrument'], '未提供'),
    name: readDatasetText(row.values, ['name', 'instrument_name', 'security_name'], '未命名标的'),
    price: readDatasetNumber(row.values, ['price', 'last', 'close', 'value']),
    change: readDatasetNumber(row.values, ['change', 'change_value', 'daily_change', 'change_percent']),
    volume: readDatasetNumber(row.values, ['volume', 'notional', 'turnover']),
    spread: readDatasetNumber(row.values, ['spread', 'spread_bps', 'bid_ask_spread']),
    yield: readDatasetNumber(row.values, ['yield', 'yield_rate', 'ytm', 'rate']),
    rating: readDatasetText(row.values, ['rating', 'credit_rating'], '未评级'),
  })).filter((row) => row.code !== '未提供');
}

function marketRows(rows: SecondaryRow[], id: string, name: string) {
  const aliases = [normalize(id), normalize(name)];
  return rows.filter((row) => aliases.some((alias) => alias && normalize(row.market).includes(alias)));
}

function SecondaryMarketsWorkspace({ items, connection, receivedAt }: { items: ModuleLiveFeedItem[]; connection: 'connecting' | 'live' | 'fallback'; receivedAt: string | null }) {
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const rows = useMemo(() => mapSecondaryRows(items), [items]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">二级市场中心</h1>
          <p className="text-slate-400">信用债、CDS、掉期、ETF 等多个市场的数据展示</p>
          <p className="mt-1 text-xs text-slate-500">{connection === 'live' ? '数据连接正常' : connection === 'connecting' ? '正在连接数据源' : '当前为轮询补收'} · {receivedAt ? new Date(receivedAt).toLocaleString() : '尚未接收'} · 无授权观测时不生成价格、成交量或评级。</p>
        </div>

        {/* 市场导航卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {SECONDARY_MARKETS.map((market) => (
          <Card key={market.id} className="bg-slate-900 border-slate-700 p-4 hover:border-slate-500 hover:bg-slate-800 transition-all cursor-pointer" onClick={() => setExpandedMarket(expandedMarket === market.id ? null : market.id)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{market.icon}</span>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">{marketRows(rows, market.id, market.name).length} 条</span>
              </div>
              <h3 className="font-semibold text-slate-100 mb-2">{market.name}</h3>
              <div className="text-xs text-slate-500">点击展开原有详情区</div>
            </Card>
          ))}
        </div>

        {/* 市场详情展开面板 */}
        <div className="space-y-4">
          {SECONDARY_MARKETS.map((market) => {
            const data = marketRows(rows, market.id, market.name);
            const changes = data.map((row) => row.change).filter((value): value is number => value !== null);
            const spreads = data.map((row) => row.spread).filter((value): value is number => value !== null);

            return (
              <Card key={market.id} className="bg-slate-900 border-slate-700 overflow-hidden">
                <button
                  onClick={() => setExpandedMarket(expandedMarket === market.id ? null : market.id)}
                  className="w-full px-6 py-4 bg-slate-800 hover:bg-slate-700 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{market.icon}</span>
                    <div className="text-left">
                      <div className="font-semibold text-slate-100">{market.name}</div>
                      <div className="text-xs text-slate-400">可读标的: {data.length || '—'}</div>
                    </div>
                  </div>
                  {expandedMarket === market.id ? <ChevronUp /> : <ChevronDown />}
                </button>

                {expandedMarket === market.id && (
                  <div className="p-6 border-t border-slate-700">
                    {/* 市场统计 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-700">
                      <div>
                        <div className="text-slate-400 text-sm">日涨跌</div>
                        <div className={`text-lg font-semibold ${changes[0] !== undefined && changes[0] > 0 ? 'text-green-400' : changes[0] !== undefined && changes[0] < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {changes.length ? `${formatDatasetNumber(changes[0], 3)}%` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-sm">周涨跌</div>
                        <div className="text-lg font-semibold text-slate-400">
                          {'—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-sm">月涨跌</div>
                        <div className="text-lg font-semibold text-slate-400">
                          {'—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-sm">平均利差</div>
                        <div className="text-lg font-semibold text-slate-100">{spreads.length ? formatDatasetNumber(spreads[0], 3) : '—'}</div>
                      </div>
                    </div>

                    {/* 数据表格 */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="px-4 py-3 text-left text-slate-400">代码</th>
                            <th className="px-4 py-3 text-right text-slate-400">价格</th>
                            <th className="px-4 py-3 text-right text-slate-400">涨跌</th>
                            <th className="px-4 py-3 text-right text-slate-400">成交量</th>
                            <th className="px-4 py-3 text-right text-slate-400">利差</th>
                            <th className="px-4 py-3 text-right text-slate-400">收益率</th>
                            <th className="px-4 py-3 text-right text-slate-400">评级</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((row) => (
                            <tr key={row.key} className="border-b border-slate-800 hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-mono text-blue-400">{row.code}</td>
                              <td className="px-4 py-3 text-right">{formatDatasetNumber(row.price)}</td>
                              <td className={`px-4 py-3 text-right ${row.change !== null && row.change > 0 ? 'text-green-400' : row.change !== null && row.change < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                {row.change === null ? '—' : formatDatasetNumber(row.change, 3)}
                              </td>
                              <td className="px-4 py-3 text-right">{row.volume === null ? '—' : formatDatasetNumber(row.volume, 0)}</td>
                              <td className="px-4 py-3 text-right">{formatDatasetNumber(row.spread, 3)}</td>
                              <td className="px-4 py-3 text-right">{row.yield === null ? '—' : `${formatDatasetNumber(row.yield, 3)}%`}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  row.rating.startsWith('A') ? 'bg-green-900 text-green-200' :
                                  row.rating.startsWith('B') ? 'bg-yellow-900 text-yellow-200' :
                                  'bg-red-900 text-red-200'
                                }`}>
                                  {row.rating}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {!data.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">当前市场没有可验证观测；未使用随机报价或静态成交记录填充。</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SecondaryMarketsHub() {
  const delivery = useModuleLiveFeed('/secondary-markets', true);
  return <SecondaryMarketsWorkspace {...delivery} />;
}
