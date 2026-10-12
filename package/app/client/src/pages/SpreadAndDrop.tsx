import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CR_OPTIONS,
  VIEW_OPTIONS,
  TERM_RANGES,
  Y_AXIS_OPTIONS_SPREAD,
} from '@/lib/spreadDropData';
import { useModuleLiveFeed, type ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TERM_OPTIONS = ['2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

type SpreadDropRow = { key: string; term: string; spread: number | null; drop: number | null; code: string; range: string; value: number | null };
function mapSpreadDropRows(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map((row): SpreadDropRow => ({
    key: row.key,
    term: readDatasetText(row.values, ['term', 'tenor', 'maturity', 'duration'], ''),
    spread: readDatasetNumber(row.values, ['spread', 'spread_bps', 'credit_spread']),
    drop: readDatasetNumber(row.values, ['drop', 'drawdown', 'spread_drop', 'change']),
    code: readDatasetText(row.values, ['code', 'symbol', 'ticker', 'instrument'], '未提供'),
    range: readDatasetText(row.values, ['range', 'term_range', 'bucket'], ''),
    value: readDatasetNumber(row.values, ['value', 'level', 'index']),
  })).filter((row) => row.term || row.range);
}

function SpreadAndDropWorkspace({ items, connection, receivedAt }: { items: ModuleLiveFeedItem[]; connection: 'connecting' | 'live' | 'fallback'; receivedAt: string | null }) {
  const [crType, setCrType] = useState('2');
  const [viewType, setViewType] = useState('2');
  const [termRange, setTermRange] = useState('15');
  const [yAxisMetric, setYAxisMetric] = useState('1');

  const liveRows = useMemo(() => mapSpreadDropRows(items), [items]);
  const spreadDropData = useMemo(() => TERM_OPTIONS.map((term) => liveRows.find((row) => row.term.toLocaleUpperCase().replace(/\s/g, '').includes(term)) ?? { key: term, term, spread: null, drop: null, code: '—', range: term, value: null }), [liveRows]);
  const stackedData = useMemo(() => spreadDropData.filter((row) => row.spread !== null), [spreadDropData]);
  const parallelData = useMemo(() => spreadDropData.filter((row) => row.drop !== null), [spreadDropData]);
  const displayRows = viewType === '1' ? stackedData : viewType === '2' ? parallelData : spreadDropData;
  const chartRows = displayRows.filter((row) => row.spread !== null || row.drop !== null);

  const crLabel = CR_OPTIONS.find(o => o.id === crType)?.label || '';
  const viewLabel = VIEW_OPTIONS.find(o => o.id === viewType)?.label || '';
  const termRangeLabel = TERM_RANGES.find(o => o.id === termRange)?.label || '';
  const yAxisLabel = Y_AXIS_OPTIONS_SPREAD.find(o => o.id === yAxisMetric)?.label || '';

  const filteredBondData = liveRows.filter(item => item.range === termRangeLabel || item.term === termRangeLabel);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">利差与下渗分析</h1>
          <p className="text-slate-400">利差与下渗数据对比与分析</p>
          <p className="mt-1 text-xs text-slate-500">{connection === 'live' ? '数据连接正常' : connection === 'connecting' ? '正在连接数据源' : '当前为轮询补收'} · {receivedAt ? new Date(receivedAt).toLocaleString() : '尚未接收'} · 无授权观测时保持空态。</p>
        </div>

        {/* 控制栏 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* C+R 类型选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">C+R 类型</label>
            <Select value={crType} onValueChange={setCrType}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择 C+R 类型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {CR_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 视图类型选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">视图类型</label>
            <Select value={viewType} onValueChange={setViewType}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择视图类型" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {VIEW_OPTIONS.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 期限范围选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">期限范围</label>
            <Select value={termRange} onValueChange={setTermRange}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择期限范围" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {TERM_RANGES.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Y轴指标选择器 */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Y轴指标</label>
            <Select value={yAxisMetric} onValueChange={setYAxisMetric}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                <SelectValue placeholder="选择Y轴指标" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {Y_AXIS_OPTIONS_SPREAD.map(opt => (
                  <SelectItem key={opt.id} value={opt.id} className="text-slate-100">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 图表区 */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-4">
              {crLabel} - {viewLabel}
            </h2>

            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="bg-slate-800 border-slate-700">
                <TabsTrigger value="chart" className="data-[state=active]:bg-blue-600">
                  图表
                </TabsTrigger>
                <TabsTrigger value="data" className="data-[state=active]:bg-blue-600">
                  数据
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chart" className="mt-4">
                <div className="bg-slate-800 rounded p-4 h-80 flex items-center justify-center">
                  {chartRows.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="term" stroke="#94a3b8" fontSize={11} /><YAxis stroke="#94a3b8" fontSize={11} /><Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #475569' }} /><Legend />{viewType !== '3' && <Line type="monotone" dataKey="spread" name="利差" stroke="#38bdf8" strokeWidth={2} connectNulls={false} />}{viewType !== '4' && <Line type="monotone" dataKey="drop" name="下渗" stroke="#f59e0b" strokeWidth={2} connectNulls={false} />}</LineChart></ResponsiveContainer> : <div className="text-center"><p className="text-sm text-slate-400">当前没有可绘制的真实期限观测</p><p className="text-xs text-slate-500 mt-2">{viewLabel} · {crLabel} · {termRangeLabel} · {yAxisLabel}</p></div>}
                </div>
              </TabsContent>

              <TabsContent value="data" className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-mono">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left px-2 py-2 text-slate-400">期限</th>
                        <th className="text-right px-2 py-2 text-slate-400">利差</th>
                        <th className="text-right px-2 py-2 text-slate-400">下渗</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row) => (
                        <tr key={row.key} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="px-2 py-2 text-slate-300">{row.term}</td>
                          <td className="text-right px-2 py-2">
                            <span className={row.spread === null ? 'text-slate-500' : row.spread > 100 ? 'text-green-400' : 'text-red-400'}>
                              {formatDatasetNumber(row.spread, 2)}
                            </span>
                          </td>
                          <td className="text-right px-2 py-2">
                            <span className={row.drop === null ? 'text-slate-500' : row.drop > 50 ? 'text-green-400' : 'text-red-400'}>
                              {formatDatasetNumber(row.drop, 2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* 右侧面板 */}
          <Card className="bg-slate-900 border-slate-700 p-4">
            <h3 className="text-lg font-semibold mb-4">债券数据 - {termRangeLabel}</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredBondData.length > 0 ? (
                filteredBondData.map((bond) => (
                  <div key={bond.key} className="bg-slate-800 rounded p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-blue-400">{bond.code}</span>
                      <span className="text-slate-400 text-sm">{bond.range}</span>
                    </div>
                    <div className="text-right">
                      <span className={bond.value !== null && bond.value > 0.7 ? 'text-green-400' : 'text-slate-300'}>
                        {formatDatasetNumber(bond.value, 2)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-center py-4">暂无可验证观测；未使用随机利差或静态债券值填充。</div>
              )}
            </div>
          </Card>
        </div>

        {/* 底部数据表格 */}
        <Card className="mt-6 bg-slate-900 border-slate-700 p-4">
          <h2 className="text-lg font-semibold mb-4">期限范围数据表</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-3 py-2 text-slate-400">期限范围</th>
                  <th className="text-left px-3 py-2 text-slate-400">债券代码</th>
                  <th className="text-right px-3 py-2 text-slate-400">数值</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row) => (
                  <tr key={row.key} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-3 py-2 text-slate-300">{row.range}</td>
                    <td className="px-3 py-2 text-blue-400 font-mono">{row.code}</td>
                    <td className="text-right px-3 py-2">
                      <span className={row.value !== null && row.value > 0.7 ? 'text-green-400' : 'text-slate-300'}>
                        {formatDatasetNumber(row.value, 2)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!liveRows.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-xs text-slate-500">当前没有可验证的期限观测。</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SpreadAndDrop() {
  const delivery = useModuleLiveFeed('/spread-drop', true);
  return <SpreadAndDropWorkspace {...delivery} />;
}
