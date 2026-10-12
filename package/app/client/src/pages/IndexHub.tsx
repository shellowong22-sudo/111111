import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { BarChart2, RefreshCw, Search } from 'lucide-react';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';
import type { ModuleLiveFeedItem } from '@/hooks/useModuleLiveFeed';
import { collectOpenBBDatasetRows, formatDatasetNumber, readDatasetNumber, readDatasetText } from '@/lib/openbbDataset';

const SECFPanel = lazy(() => import('@/components/index-panels/SECFPanel'));
const HELPINDXPanel = lazy(() => import('@/components/index-panels/HELPINDXPanel'));
const WEIFPanel = lazy(() => import('@/components/index-panels/WEIFPanel'));
const WBIXPanel = lazy(() => import('@/components/index-panels/WBIXPanel'));
const GMMPanel = lazy(() => import('@/components/index-panels/GMMPanel'));
const INPanel = lazy(() => import('@/components/index-panels/INPanel'));
const returnToIndexHub = () => window.location.assign('/index-hub');
const INPPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.INPPanel onClose={returnToIndexHub} /> })));
const CIXPanel = lazy(() => import('@/components/CIXPanel').then(module => ({ default: () => <module.default onClose={returnToIndexHub} /> })));
const CIXBPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXBPanel onClose={returnToIndexHub} /> })));
const AGGPanel = lazy(() => import('@/components/index-panels/AGGPanel'));
const FDFDPanel = lazy(() => import('@/components/index-panels/FDFDPanel'));
const OtherIndexPanel = lazy(() => import('@/components/index-panels/OtherIndexPanel'));
const RRGPanel = lazy(() => import('@/components/index-panels/RRGPanel'));
const WTPanel = lazy(() => import('@/components/index-panels/WTPanel'));
const CIXNPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXNPanel onClose={returnToIndexHub} /> })));
const CIXSPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXSPanel onClose={returnToIndexHub} /> })));
const CIXRPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXRPanel onClose={returnToIndexHub} /> })));
const CIXCPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXCPanel onClose={returnToIndexHub} /> })));
const CIXXPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXXPanel onClose={returnToIndexHub} /> })));
const CIXIPanel = lazy(() => import('@/components/CIXEditors').then(module => ({ default: () => <module.CIXIPanel onClose={returnToIndexHub} /> })));
const IndexDerivativesPanel = lazy(() => import('@/components/index-panels/IndexDerivativesPanel'));
const BBGIndexPanel = lazy(() => import('@/components/index-panels/BBGIndexPanel'));

const PANEL_MAP: Record<string, LazyExoticComponent<ComponentType>> = {
  SECF: SECFPanel, HELP_INDX: HELPINDXPanel, WEIF: WEIFPanel, WBIX: WBIXPanel,
  GMM: GMMPanel, IN: INPanel, INP: INPPanel, CIX: CIXPanel, CIXB: CIXBPanel, AGG: AGGPanel,
  FDFD: FDFDPanel, OTHER_INDEX: OtherIndexPanel, RRG: RRGPanel, WT: WTPanel, CIXN: CIXNPanel,
  CIXS: CIXSPanel, CIXR: CIXRPanel, CIXC: CIXCPanel, CIXX: CIXXPanel, CIXI: CIXIPanel,
  INDEX_DERIV: IndexDerivativesPanel, BBG: BBGIndexPanel,
};

type IndexRow = {
  key: string;
  code: string;
  name: string;
  region: string;
  last: number | null;
  change: number | null;
  changePercent: number | null;
  ytd: number | null;
  volume: number | null;
  pe: number | null;
  high52: number | null;
  low52: number | null;
  yieldValue: number | null;
  duration: number | null;
  rating: string;
  type: string;
  relativeStrength: number | null;
  momentum: number | null;
  weight: number | null;
  date: string;
  observedAt: string | null;
  quality: string;
  realtimeStatus: string;
  datasetLabel: string;
};

function mapIndices(items: ModuleLiveFeedItem[]) {
  return collectOpenBBDatasetRows(items).map(row => {
    const code = readDatasetText(row.values, ['symbol', 'ticker', 'index_symbol', 'index_code', 'code', 'id'], row.key);
    return {
      key: row.key,
      code,
      name: readDatasetText(row.values, ['name', 'index_name', 'long_name', 'title'], code),
      region: readDatasetText(row.values, ['region', 'country', 'market', 'exchange'], '未提供'),
      last: readDatasetNumber(row.values, ['last', 'price', 'close', 'value', 'index_value']),
      change: readDatasetNumber(row.values, ['change', 'change_value', 'price_change']),
      changePercent: readDatasetNumber(row.values, ['change_percent', 'change_pct', 'percent_change']),
      ytd: readDatasetNumber(row.values, ['ytd', 'return_ytd', 'ytd_return']),
      volume: readDatasetNumber(row.values, ['volume', 'turnover']),
      pe: readDatasetNumber(row.values, ['pe', 'pe_ratio', 'price_earnings']),
      high52: readDatasetNumber(row.values, ['high_52_week', '52_week_high', 'year_high']),
      low52: readDatasetNumber(row.values, ['low_52_week', '52_week_low', 'year_low']),
      yieldValue: readDatasetNumber(row.values, ['yield', 'yield_to_maturity', 'ytm']),
      duration: readDatasetNumber(row.values, ['duration', 'modified_duration']),
      rating: readDatasetText(row.values, ['rating', 'credit_rating'], '未提供'),
      type: readDatasetText(row.values, ['type', 'index_type', 'category', 'asset_class'], '未分类'),
      relativeStrength: readDatasetNumber(row.values, ['relative_strength', 'rs_ratio', 'rs']),
      momentum: readDatasetNumber(row.values, ['momentum', 'rs_momentum']),
      weight: readDatasetNumber(row.values, ['weight', 'market_weight', 'size', 'market_cap']),
      date: readDatasetText(row.values, ['date', 'timestamp', 'datetime', 'period_ending', 'as_of_date'], ''),
      observedAt: row.observedAt,
      quality: row.quality,
      realtimeStatus: row.realtimeStatus,
      datasetLabel: row.datasetLabel,
    } satisfies IndexRow;
  });
}

function IndexWorkspace({ items, connection, receivedAt, refetch, isLoading }: {
  items: ModuleLiveFeedItem[];
  connection: 'connecting' | 'live' | 'fallback';
  receivedAt: string | null;
  refetch: () => unknown;
  isLoading: boolean;
}) {
  const rows = useMemo(() => mapIndices(items), [items]);
  const urlCode = new URLSearchParams(window.location.search).get('code') ?? '';
  const [activeTab, setActiveTab] = useState('wbix');
  const [region, setRegion] = useState('全部');
  const [search, setSearch] = useState(urlCode);
  const [sortField, setSortField] = useState<'changePercent' | 'ytd' | 'volume' | 'pe'>('changePercent');
  const [selectedCode, setSelectedCode] = useState(urlCode);
  const regions = useMemo(() => [...new Set(rows.map(row => row.region))].sort(), [rows]);
  const uniqueRows = useMemo(() => {
    const unique = new Map<string, IndexRow>();
    rows.forEach(row => {
      const identity = `${row.code.toLocaleUpperCase()}:${row.date || 'current'}`;
      if (!unique.has(identity)) unique.set(identity, row);
    });
    return [...unique.values()];
  }, [rows]);
  const visible = useMemo(() => uniqueRows.filter(row => (region === '全部' || row.region === region) && (!search || `${row.code} ${row.name} ${row.region}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).sort((a, b) => (b[sortField] ?? Number.NEGATIVE_INFINITY) - (a[sortField] ?? Number.NEGATIVE_INFINITY)), [uniqueRows, region, search, sortField]);
  const selected = visible.find(row => row.code === selectedCode) ?? visible[0] ?? null;
  const bondRows = useMemo(() => visible.filter(row => row.yieldValue !== null || row.duration !== null || /bond|fixed income|债/i.test(`${row.type} ${row.datasetLabel}`)), [visible]);
  const rrgRows = useMemo(() => visible.filter(row => row.relativeStrength !== null && row.momentum !== null), [visible]);
  const customRows = useMemo(() => visible.filter(row => /custom|自设|cix/i.test(`${row.type} ${row.datasetLabel}`)), [visible]);
  const macroRows = useMemo(() => visible.filter(row => /macro|econom|driver|宏观/i.test(`${row.type} ${row.datasetLabel}`)), [visible]);
  const empty = (label: string) => <div className="border border-gray-800 bg-black px-3 py-14 text-center text-xs text-gray-500">{isLoading ? `正在加载${label}…` : `${label}暂无可验证观察；系统未生成替代数值。`}</div>;

  return <div className="min-h-screen bg-gray-950 text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-3"><div className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-amber-400" /><div><h1 className="text-lg font-bold text-amber-400">指数综合分析中心</h1><p className="text-xs text-gray-500">WBIX · RRG · CIX · GMM</p></div></div><div className="flex items-center gap-3 font-mono text-[10px] text-gray-500"><span className={connection === 'live' ? 'text-emerald-300' : connection === 'connecting' ? 'text-amber-300' : 'text-rose-300'}>{connection === 'live' ? '实时连接' : connection === 'connecting' ? '正在连接' : '轮询补收'}</span><span>接收 {receivedAt ? new Date(receivedAt).toLocaleString() : '未接收'}</span><Button type="button" variant="outline" size="sm" onClick={() => void refetch()} className="h-7 border-gray-700 bg-transparent text-xs"><RefreshCw className="mr-1 h-3 w-3" />刷新</Button></div></header>
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 px-3 py-2"><Search className="h-3.5 w-3.5 text-gray-500" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索指数代码或名称" className="h-7 min-w-64 flex-1 border-gray-700 bg-black text-xs" /><Select value={region} onValueChange={setRegion}><SelectTrigger className="h-7 w-40 border-gray-700 bg-black text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="全部">全部地区</SelectItem>{regions.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={sortField} onValueChange={value => setSortField(value as typeof sortField)}><SelectTrigger className="h-7 w-40 border-gray-700 bg-black text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="changePercent">涨跌幅排序</SelectItem><SelectItem value="ytd">年初至今排序</SelectItem><SelectItem value="volume">成交量排序</SelectItem><SelectItem value="pe">市盈率排序</SelectItem></SelectContent></Select><span className="font-mono text-[10px] text-gray-500">记录 {visible.length} / {uniqueRows.length}</span></div>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="p-3"><TabsList className="mb-3 h-auto flex-wrap border border-gray-800 bg-gray-900 p-1">{[['wbix', 'WBIX 债券指数'], ['rrg', 'RRG 相对旋转图'], ['cix', 'CIX 自设指数'], ['gmm', 'GMM 宏观驱动者']].map(([value, label]) => <TabsTrigger key={value} value={value} className="text-xs data-[state=active]:bg-amber-950 data-[state=active]:text-amber-300">{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="wbix">{bondRows.length ? <IndexTable rows={bondRows} selectedCode={selected?.code ?? ''} onSelect={setSelectedCode} mode="bond" /> : empty('债券指数')}</TabsContent>
      <TabsContent value="rrg">{rrgRows.length ? <div className="h-[560px] border border-gray-800 p-3"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid stroke="#1f2937" /><XAxis type="number" dataKey="relativeStrength" domain={['auto', 'auto']} name="相对强度" tick={{ fill: '#6b7280', fontSize: 10 }} /><YAxis type="number" dataKey="momentum" domain={['auto', 'auto']} name="动量" tick={{ fill: '#6b7280', fontSize: 10 }} /><ZAxis dataKey="weight" range={[60, 500]} /><ReferenceLine x={100} stroke="#475569" /><ReferenceLine y={100} stroke="#475569" /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={rrgRows} fill="#60a5fa" /></ScatterChart></ResponsiveContainer></div> : empty('RRG 相对旋转')}</TabsContent>
      <TabsContent value="cix">{customRows.length ? <IndexTable rows={customRows} selectedCode={selected?.code ?? ''} onSelect={setSelectedCode} mode="equity" /> : <div>{empty('自设指数')}<div className="border-x border-b border-gray-800 px-3 py-2 text-right"><Button type="button" size="sm" onClick={() => window.location.assign('/index-hub?panel=CIX')} className="h-7 bg-amber-700 text-xs hover:bg-amber-600">打开 CIX 编辑器</Button></div></div>}</TabsContent>
      <TabsContent value="gmm">{macroRows.length ? <IndexTable rows={macroRows} selectedCode={selected?.code ?? ''} onSelect={setSelectedCode} mode="equity" /> : empty('宏观驱动者')}</TabsContent>
    </Tabs>
  </div>;
}

function IndexTable({ rows, selectedCode, onSelect, mode }: { rows: IndexRow[]; selectedCode: string; onSelect: (code: string) => void; mode: 'equity' | 'bond' }) {
  return <div className="max-h-[640px] overflow-auto"><table className="w-full min-w-[900px] text-left text-[10px]"><thead className="sticky top-0 z-10 bg-gray-950 text-gray-500"><tr><th className="px-2 py-1.5">代码 / 名称</th><th>地区 / 类型</th><th className="text-right">{mode === 'bond' ? '到期收益率' : '当前值'}</th><th className="text-right">{mode === 'bond' ? '久期' : '涨跌幅'}</th><th className="text-right">YTD</th><th className="text-right">{mode === 'bond' ? '评级' : '成交量'}</th><th>观测时间</th><th>质量 / 时效</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} onClick={() => onSelect(row.code)} className={`cursor-pointer border-t border-gray-900 ${selectedCode === row.code ? 'bg-amber-950/30' : 'hover:bg-gray-900'}`}><td className="px-2 py-1.5"><b className="text-amber-300">{row.code}</b><span className="ml-2 text-gray-300">{row.name}</span></td><td>{row.region} · {row.type}</td><td className="text-right font-mono">{formatDatasetNumber(mode === 'bond' ? row.yieldValue : row.last, 4)}</td><td className="text-right font-mono">{formatDatasetNumber(mode === 'bond' ? row.duration : row.changePercent, 4)}</td><td className="text-right font-mono">{formatDatasetNumber(row.ytd)}</td><td className="text-right font-mono">{mode === 'bond' ? row.rating : formatDatasetNumber(row.volume, 0)}</td><td>{row.observedAt ?? '未提供'}</td><td>{row.quality}<br />{row.realtimeStatus}</td></tr>)}</tbody></table></div>;
}

export default function IndexHub() {
  const panelCode = new URLSearchParams(window.location.search).get('panel');
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (panelCode?.toUpperCase() === 'WEI') {
      // WEI 的完整国家市场/报价/加密货币数据仍由原 WEIPanel
      // 提供；指数中心不再维护第二份简化数据层。
      setLocation('/terminal?module=stocks&open=wei');
    }
  }, [panelCode, setLocation]);
  if (panelCode?.toUpperCase() === 'WEI') return null;
  if (panelCode && PANEL_MAP[panelCode]) {
    const Panel = PANEL_MAP[panelCode];
    return <Suspense fallback={<div className="min-h-screen bg-gray-950 p-8 text-amber-400">正在加载指数工具…</div>}><Panel /></Suspense>;
  }
  return <OpenBBModuleDataBand path="/index-hub" title="指数中心数据">{delivery => <IndexWorkspace {...delivery} />}</OpenBBModuleDataBand>;
}
