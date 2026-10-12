import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

const ENERGY_TYPES = ['原油', '天然气', '煤炭', '电力'];

type EnergyObservation = {
  code: string;
  name: string;
  category: string;
  value: number;
  previous: number | null;
  change: number | null;
  date: string;
  unit: string;
};

const ENERGY_CONTRACTS = [
  { match: /天然气库存/, code: 'NG-STORAGE', name: '美国天然气库存', category: '天然气', unit: '十亿立方英尺' },
  { match: /商业原油库存/, code: 'CRUDE-STOCK', name: '美国商业原油库存', category: '原油', unit: '千桶' },
  { match: /炼厂产能利用率/, code: 'REFINERY-UTIL', name: '美国炼厂产能利用率', category: '原油', unit: '%' },
] as const;

function formatValue(value: number | null, unit: string) {
  if (value === null) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: unit === '%' ? 1 : 2 })}${unit === '%' ? '%' : ''}`;
}

export default function EnergyMarket() {
  const [selectedType, setSelectedType] = useState('原油');
  const delivery = useModuleLiveFeed('/energy-market', true);
  const observations = useMemo<EnergyObservation[]>(() => ENERGY_CONTRACTS.flatMap(definition => {
    const history = collectOpenBBDatasetRows(delivery.items)
      .filter(row => definition.match.test(row.datasetLabel))
      .flatMap(row => {
        const value = readDatasetNumber(row.values, ['库存量', '利用率', 'value']);
        const date = readDatasetText(row.values, ['观察期', 'date'], '');
        return value === null || !date ? [] : [{ value, date }];
      })
      .sort((left, right) => left.date.localeCompare(right.date));
    const latest = history.at(-1);
    const previous = history.at(-2)?.value ?? null;
    return latest ? [{
      code: definition.code,
      name: definition.name,
      category: definition.category,
      value: latest.value,
      previous,
      change: previous === null ? null : latest.value - previous,
      date: latest.date,
      unit: definition.unit,
    }] : [];
  }), [delivery.items]);
  const byCode = useMemo(() => new Map(observations.map(row => [row.code, row])), [observations]);
  const latestStorage = byCode.get('NG-STORAGE') ?? null;
  const latestCrude = byCode.get('CRUDE-STOCK') ?? null;
  const latestRefinery = byCode.get('REFINERY-UTIL') ?? null;
  const visibleRows = observations.filter(row => row.category === selectedType);
  const latestObservedAt = observations.map(row => row.date).sort().at(-1) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-4xl font-bold text-slate-50 mb-2">能源市场</h1>
          <p className="text-slate-400">能源库存、炼厂运行与周期观察</p></div>
          <div className={`font-mono text-xs ${observations.length ? 'text-emerald-300' : 'text-amber-300'}`}>
            {observations.length ? `永久观察已自动更新 · ${latestObservedAt}` : delivery.isLoading ? '正在读取已保存观察…' : '当前没有可验证观察'}
          </div>
        </div>

        {/* 能源类型选择 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <label className="text-sm font-medium text-slate-300 mb-3 block">选择能源类型</label>
          <div className="flex gap-2 flex-wrap">
            {ENERGY_TYPES.map(t => {
              const count = observations.filter(row => row.category === t).length;
              return (
              <Button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-4 py-2 text-sm ${
                  selectedType === t
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-800 hover:bg-slate-700'
                } text-white`}
              >
                {t} <span className="ml-1 opacity-60">{count}</span>
              </Button>
              );
            })}
          </div>
        </Card>

        {/* 市场统计 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">天然气库存</div>
            <div className="text-3xl font-bold text-orange-400">{formatValue(latestStorage?.value ?? null, latestStorage?.unit ?? '')}</div>
            <div className="mt-1 text-[10px] text-slate-500">{latestStorage?.date ?? '等待可验证观察'}</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">商业原油库存</div>
            <div className="text-3xl font-bold text-green-400">{formatValue(latestCrude?.value ?? null, latestCrude?.unit ?? '')}</div>
            <div className="mt-1 text-[10px] text-slate-500">{latestCrude?.date ?? '等待可验证观察'}</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">炼厂产能利用率</div>
            <div className="text-3xl font-bold text-red-400">{formatValue(latestRefinery?.value ?? null, latestRefinery?.unit ?? '')}</div>
            <div className="mt-1 text-[10px] text-slate-500">{latestRefinery?.date ?? '等待可验证观察'}</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">永久观察</div>
            <div className="text-3xl font-bold text-blue-400">{observations.length}</div>
            <div className="mt-1 text-[10px] text-slate-500">自动清洗 · 指纹去重 · 定时更新</div>
          </Card>
        </div>

        {/* 能源行情表 */}
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-orange-400" />
            <h2 className="text-lg font-semibold text-slate-50">{selectedType}运行观察</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-300 font-semibold">代码</th>
                  <th className="text-left py-2 text-slate-300 font-semibold">名称</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">最新值</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">较前期</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">观察期</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">单位</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(energy => (
                  <tr key={energy.code} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 text-blue-400 font-semibold">{energy.code}</td>
                    <td className="py-3 text-slate-100">{energy.name}</td>
                    <td className="text-right text-slate-100 font-semibold">{formatValue(energy.value, energy.unit)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {energy.change === null ? <span className="text-slate-500">—</span> : energy.change > 0 ? (
                          <>
                            <TrendingUp size={16} className="text-green-400" />
                            <span className="text-green-400 font-semibold">+{energy.change.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={16} className="text-red-400" />
                            <span className="text-red-400 font-semibold">{energy.change.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="text-right text-slate-300">{energy.date}</td>
                    <td className="text-right text-slate-400">{energy.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length && <div className="flex items-center justify-center gap-2 border-t border-slate-800 py-12 text-sm text-amber-200"><Activity size={16} />该类别当前没有可验证永久观察；系统未生成替代数值。</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
