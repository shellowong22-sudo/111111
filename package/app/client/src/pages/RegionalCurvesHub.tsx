import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGIONAL_MARKETS } from '@/lib/globalCurvesData';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

type RegionalCurveRow = {
  key: string;
  region: string;
  country: string;
  yield2Y: number | null;
  yield5Y: number | null;
  yield10Y: number | null;
  yield30Y: number | null;
  spread: number | null;
  change: number | null;
};

function normalize(value: string) {
  return value.toLocaleUpperCase().replace(/[^A-Z0-9\p{L}\p{N}]+/gu, '');
}

function mapRegionalRows(items: ModuleLiveFeedItem[]) {
  const grouped = new Map<string, RegionalCurveRow>();
  collectOpenBBDatasetRows(items).forEach((row) => {
    const region = readDatasetText(row.values, ['region', 'region_code', 'market_region', 'geography'], '');
    const country = readDatasetText(row.values, ['country', 'country_name', 'issuer_country', 'market'], '');
    if (!country) return;
    const tenor = normalize(readDatasetText(row.values, ['tenor', 'term', 'maturity', 'duration'], ''));
    const longYield = readDatasetNumber(row.values, ['yield', 'yield_rate', 'ytm', 'rate', 'value']);
    const key = `${normalize(region)}:${normalize(country)}`;
    const current = grouped.get(key) ?? {
      key: row.key,
      region,
      country,
      yield2Y: readDatasetNumber(row.values, ['yield_2y', '2y', 'two_year_yield']),
      yield5Y: readDatasetNumber(row.values, ['yield_5y', '5y', 'five_year_yield']),
      yield10Y: readDatasetNumber(row.values, ['yield_10y', '10y', 'ten_year_yield']),
      yield30Y: readDatasetNumber(row.values, ['yield_30y', '30y', 'thirty_year_yield']),
      spread: readDatasetNumber(row.values, ['spread', 'curve_spread', 'spread_bps', '2s10s']),
      change: readDatasetNumber(row.values, ['change', 'change_value', 'daily_change', 'change_bps']),
    };
    if (longYield !== null) {
      if (tenor.includes('2Y') || tenor.includes('2YR') || tenor === '2') current.yield2Y = longYield;
      if (tenor.includes('5Y') || tenor.includes('5YR') || tenor === '5') current.yield5Y = longYield;
      if (tenor.includes('10Y') || tenor.includes('10YR') || tenor === '10') current.yield10Y = longYield;
      if (tenor.includes('30Y') || tenor.includes('30YR') || tenor === '30') current.yield30Y = longYield;
    }
    grouped.set(key, current);
  });
  return [...grouped.values()];
}

export default function RegionalCurvesHub() {
  const [selectedRegion, setSelectedRegion] = useState('APAC');
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const delivery = useModuleLiveFeed('/regional-curves', true);
  const rows = useMemo(() => mapRegionalRows(delivery.items), [delivery.items]);
  const rowsForRegion = (code: string) => {
    const definition = REGIONAL_MARKETS.find((item) => item.code === code);
    const aliases = [code, definition?.name ?? '', definition?.region ?? ''].map(normalize).filter(Boolean);
    return rows.filter((row) => aliases.some((alias) => normalize(row.region).includes(alias)));
  };
  const selectedCount = rowsForRegion(selectedRegion).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div><h1 className="text-4xl font-bold text-slate-50 mb-2">地域收益率曲线</h1>
          <p className="text-slate-400">亚太、欧中东非、拉美等 10 个地域的债券收益率数据</p></div>
          <div className="text-right text-xs font-mono text-slate-500"><div className={delivery.connection === 'live' ? 'text-emerald-300' : 'text-amber-300'}>{delivery.connection === 'live' ? '数据连接正常' : delivery.connection === 'connecting' ? '正在连接' : '轮询补收'}</div><div>{delivery.receivedAt ? new Date(delivery.receivedAt).toLocaleString() : '尚未接收'}</div><div>{selectedCount} 条当前地区观测</div></div>
        </div>

        {/* 地域选择 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <label className="text-sm font-medium text-slate-300 mb-2 block">选择地域</label>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {REGIONAL_MARKETS.map(region => (
                <SelectItem key={region.code} value={region.code}>
                  {region.name} ({region.region})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* 地域详情面板 */}
        <div className="space-y-3">
          {REGIONAL_MARKETS.map((region) => {
            const regionRows = rowsForRegion(region.code);
            return (
            <Card key={region.code} className="bg-slate-900 border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedRegion(expandedRegion === region.code ? null : region.code)}
                className="w-full px-6 py-4 bg-slate-800 hover:bg-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="text-left">
                  <div className="font-semibold text-slate-100">{region.name}</div>
                  <div className="text-xs text-slate-400">{region.region} · {regionRows.length} 条观测</div>
                </div>
                {expandedRegion === region.code ? <ChevronUp /> : <ChevronDown />}
              </button>

              {expandedRegion === region.code && (
                <div className="p-6 border-t border-slate-700 overflow-x-auto">
                  <table className="w-full text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-3 text-left text-slate-400">国家</th>
                        <th className="px-4 py-3 text-right text-slate-400">2Y</th>
                        <th className="px-4 py-3 text-right text-slate-400">5Y</th>
                        <th className="px-4 py-3 text-right text-slate-400">10Y</th>
                        <th className="px-4 py-3 text-right text-slate-400">30Y</th>
                        <th className="px-4 py-3 text-right text-slate-400">利差</th>
                        <th className="px-4 py-3 text-right text-slate-400">变化</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regionRows.map((row) => (
                        <tr key={row.key} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-mono text-blue-400">{row.country}</td>
                          <td className="px-4 py-3 text-right">{formatDatasetNumber(row.yield2Y)}{row.yield2Y === null ? '' : '%'}</td>
                          <td className="px-4 py-3 text-right">{formatDatasetNumber(row.yield5Y)}{row.yield5Y === null ? '' : '%'}</td>
                          <td className="px-4 py-3 text-right">{formatDatasetNumber(row.yield10Y)}{row.yield10Y === null ? '' : '%'}</td>
                          <td className="px-4 py-3 text-right">{formatDatasetNumber(row.yield30Y)}{row.yield30Y === null ? '' : '%'}</td>
                          <td className="px-4 py-3 text-right">{formatDatasetNumber(row.spread, 3)}</td>
                          <td className={`px-4 py-3 text-right ${row.change !== null && row.change > 0 ? 'text-green-400' : row.change !== null && row.change < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {row.change === null ? '—' : `${row.change > 0 ? '+' : ''}${formatDatasetNumber(row.change, 3)}`}
                          </td>
                        </tr>
                      ))}
                      {!regionRows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-500">当前地区没有可验证的收益率观测；未使用随机国家或随机曲线填充。</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );})}
        </div>
      </div>
    </div>
  );
}
