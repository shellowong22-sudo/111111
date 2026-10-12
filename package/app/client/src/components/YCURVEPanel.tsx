import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronDown, Home, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useModuleLiveFeed } from '@/hooks/useModuleLiveFeed';
import {
  CURVE_MENU_GROUPS, type CurveMenuItem,
  MARKET_SIDE_OPTIONS, INTERPOLATION_OPTIONS, YIELD_ADJUST_OPTIONS,
  KRR_SHIFT_OPTIONS, DV01_MOVE_OPTIONS,
  DEFAULT_YCDF_SETTINGS, type YcdfSettings, type SelectOption,
  findOptionLabel,
} from '@/lib/ycurveData';
import CRVFPanel from './CRVFPanel';
import GCPanel from './GCPanel';
import CurveDistinctTools from './CurveDistinctTools';
import type { SelectedCurve } from '@/lib/crvfData';

// --- 外部点击关闭钩子 ----------------------------------------------------------
function useOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  const cb = useCallback(onOut, [onOut]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [cb]);
  return ref;
}

// --- 彭博风格下拉选择器 --------------------------------------------------------
function YcdfSelect({
  options, value, onChange, disabled,
}: {
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));
  const label = findOptionLabel(options, value);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={cn(
          'flex items-center justify-between w-full px-2 py-1 text-left text-xs border border-black',
          disabled
            ? 'bg-[#bdb3a3] text-black/50 cursor-not-allowed'
            : 'bg-[#f5a623] text-black hover:brightness-105',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 min-w-full bg-[#0a0a0a] border border-[#3a4a6a] shadow-xl py-0.5">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1 text-left text-xs whitespace-nowrap',
                o.value === value
                  ? 'bg-[#1c4d8f] text-white'
                  : 'text-[#f5a623] hover:bg-[#1a2540]',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- 视图类型 ------------------------------------------------------------------
type ViewType = 'menu' | 'ycdf' | 'crvf' | 'gc' | 'tool';

interface YCURVEPanelProps { onClose: () => void; }

const YCURVE_SERIES = [
  { id: 'DGS1MO', tenor: '1M' },
  { id: 'DGS3MO', tenor: '3M' },
  { id: 'DGS6MO', tenor: '6M' },
  { id: 'DGS1', tenor: '1Y' },
  { id: 'DGS2', tenor: '2Y' },
  { id: 'DGS5', tenor: '5Y' },
  { id: 'DGS10', tenor: '10Y' },
  { id: 'DGS30', tenor: '30Y' },
] as const;

type YcurveSeriesId = (typeof YCURVE_SERIES)[number]['id'];
type RatePoint = { date: string; value: number };

function alignedValues(
  rows: Partial<Record<YcurveSeriesId, { data?: RatePoint[] }>>,
  ids: YcurveSeriesId[],
  calculate: (values: number[]) => number
) {
  const maps = ids.map(id => new Map((rows[id]?.data ?? []).map(point => [point.date, point.value])));
  const dates = (rows[ids[0]]?.data ?? []).map(point => point.date);
  return dates.flatMap(date => {
    const values = maps.map(map => map.get(date));
    return values.every((value): value is number => typeof value === 'number' && Number.isFinite(value))
      ? [{ date, value: calculate(values) }]
      : [];
  }).slice(-90);
}

function ycurvePolyline(values: number[], width = 420, height = 120) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((value, index) => `${12 + index * ((width - 24) / (values.length - 1))},${10 + (max - value) * ((height - 24) / span)}`).join(' ');
}

type YcdfAnalysis = 'history' | 'twoTen' | 'fiveThirty' | 'butterfly';

function YcdfCurveReference() {
  const [selectedSeries, setSelectedSeries] = useState<YcurveSeriesId>('DGS10');
  const [analysis, setAnalysis] = useState<YcdfAnalysis>('history');
  const query = trpc.sovereignBonds.getMultipleRateSeries.useQuery(
    { series: YCURVE_SERIES.map(item => item.id) },
    { refetchOnWindowFocus: false, refetchInterval: 60_000, staleTime: 30_000 }
  );
  const feed = useModuleLiveFeed('/terminal?open=13&module=sovereign-bonds');
  const rows = (query.data?.data ?? {}) as Partial<Record<YcurveSeriesId, { latest?: number; data?: RatePoint[] }>>;
  const currentCurve = YCURVE_SERIES.map(item => ({ ...item, value: rows[item.id]?.latest })).filter((item): item is typeof item & { value: number } => typeof item.value === 'number' && Number.isFinite(item.value) && item.value > 0);
  const selectedHistory = (rows[selectedSeries]?.data ?? []).filter(point => Number.isFinite(point.value)).slice(-90);
  const structures = useMemo(() => ({
    twoTen: alignedValues(rows, ['DGS10', 'DGS2'], ([ten, two]) => (ten - two) * 100),
    fiveThirty: alignedValues(rows, ['DGS30', 'DGS5'], ([thirty, five]) => (thirty - five) * 100),
    butterfly: alignedValues(rows, ['DGS10', 'DGS5', 'DGS30'], ([ten, five, thirty]) => (ten * 2 - five - thirty) * 100),
  }), [rows]);
  const selectedTenor = YCURVE_SERIES.find(item => item.id === selectedSeries)?.tenor ?? selectedSeries;
  const latest = (series: RatePoint[]) => series.at(-1)?.value;
  const curvePoints = ycurvePolyline(currentCurve.map(point => point.value));
  const analysisSeries = analysis === 'history' ? selectedHistory : structures[analysis];
  const analysisMeta: Record<YcdfAnalysis, { label: string; unit: string; color: string }> = {
    history: { label: `${selectedTenor} 历史收益率`, unit: '%', color: '#f5a623' },
    twoTen: { label: '2Y—10Y 斜率历史', unit: 'bp', color: '#42c7b9' },
    fiveThirty: { label: '5Y—30Y 坡度历史', unit: 'bp', color: '#8cc7ff' },
    butterfly: { label: '5Y/10Y/30Y 蝶式历史', unit: 'bp', color: '#b18cff' },
  };
  const historyPoints = ycurvePolyline(analysisSeries.map(point => point.value));
  const newestUpdate = feed.items[0];
  const selectTenor = (series: YcurveSeriesId) => {
    setSelectedSeries(series);
    setAnalysis('history');
  };
  const structureButtons: Array<{ id: Exclude<YcdfAnalysis, 'history'>; label: string; value: number | undefined }> = [
    { id: 'twoTen', label: '2Y—10Y 斜率', value: latest(structures.twoTen) },
    { id: 'fiveThirty', label: '5Y—30Y 坡度', value: latest(structures.fiveThirty) },
    { id: 'butterfly', label: '5Y/10Y/30Y 蝶式', value: latest(structures.butterfly) },
  ];

  return <div data-ycdf-curve-reference>
    <FormRow label="当前期限曲线">
      {query.isLoading ? <div className="grid h-28 place-items-center border border-[#26364d] bg-[#060a10] text-xs text-[#71849c]">正在读取期限节点…</div> : !currentCurve.length ? <div className="grid h-28 place-items-center border border-dashed border-[#3a4a6a] text-xs text-[#ffbd8e]">当前数据源未返回可用收益率点。</div> : <div className="border border-[#26364d] bg-[#060a10] p-2">
        <div className="flex items-center justify-between text-[10px]"><span className="text-[#8cc7ff]">{query.data?.source ?? 'FRED'} · {query.data?.timestamp ? new Date(query.data.timestamp).toLocaleString('zh-CN', { hour12: false }) : '等待观测'}</span><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="text-[#4a90e2] hover:text-white disabled:opacity-40">{query.isFetching ? '读取中…' : '刷新节点'}</button></div>
        <svg viewBox="0 0 420 125" className="h-28 w-full" role="img" aria-label="现金曲线当前期限节点">
          {[22, 50, 78, 106].map(y => <line key={y} x1="12" y1={y} x2="408" y2={y} stroke="#14263c" strokeWidth="1" />)}
          <polyline points={curvePoints} fill="none" stroke="#4a90e2" strokeWidth="2.4" />
          {currentCurve.map((point, index) => { const coordinate = curvePoints.split(' ')[index]?.split(',') ?? ['0', '0']; return <g key={point.id}><circle cx={coordinate[0]} cy={coordinate[1]} r="3.5" fill={selectedSeries === point.id ? '#f5a623' : '#4a90e2'} /><text x={coordinate[0]} y="121" fill="#71849c" fontSize="9" textAnchor="middle">{point.tenor}</text></g>; })}
        </svg>
        <div className="grid grid-cols-4 gap-1 lg:grid-cols-8">{currentCurve.map(point => <button type="button" key={point.id} onClick={() => selectTenor(point.id)} className={cn('border px-1 py-1 text-[10px]', analysis === 'history' && selectedSeries === point.id ? 'border-[#f5a623] bg-[#241b0a] text-[#f5a623]' : 'border-[#285a90] text-[#8cc7ff]')}>{point.tenor}<br />{point.value.toFixed(3)}%</button>)}</div>
      </div>}
    </FormRow>
    <FormRow label="结构利差与蝶式">
      <div className="grid grid-cols-3 gap-1">
        {structureButtons.map(item => <button type="button" key={item.id} onClick={() => setAnalysis(item.id)} className={cn('border px-2 py-2 text-left text-[10px]', analysis === item.id ? 'border-[#f5a623] bg-[#241b0a]' : 'border-[#26364d] bg-[#060a10]')}><span className="block text-[#7890aa]">{item.label}</span><b className={cn('mt-1 block text-sm', (item.value ?? 0) >= 0 ? 'text-[#42c7b9]' : 'text-[#ff7b72]')}>{item.value?.toFixed(1) ?? '—'} bp</b></button>)}
      </div>
    </FormRow>
    <FormRow label="历史走势下钻">
      <div className="border border-[#26364d] bg-[#060a10] p-2">
        <div className="flex items-center justify-between text-[10px]"><span style={{ color: analysisMeta[analysis].color }}>{analysisMeta[analysis].label}</span><span className="text-[#71849c]">{analysisSeries[0]?.date ?? '—'} → {analysisSeries.at(-1)?.date ?? '—'}</span></div>
        <svg viewBox="0 0 420 115" className="h-28 w-full" role="img" aria-label={analysisMeta[analysis].label}>
          {[20, 48, 76, 104].map(y => <line key={y} x1="12" y1={y} x2="408" y2={y} stroke="#14263c" strokeWidth="1" />)}
          <polyline points={historyPoints} fill="none" stroke={analysisMeta[analysis].color} strokeWidth="2.1" />
        </svg>
        <div className="grid grid-cols-3 gap-1 text-center text-[10px]"><span className="border border-[#173453] p-1 text-[#8cc7ff]">低点 {analysisSeries.length ? Math.min(...analysisSeries.map(point => point.value)).toFixed(3) : '—'} {analysisMeta[analysis].unit}</span><span className="border border-[#173453] p-1" style={{ color: analysisMeta[analysis].color }}>最新 {latest(analysisSeries)?.toFixed(3) ?? '—'} {analysisMeta[analysis].unit}</span><span className="border border-[#173453] p-1 text-[#ffbd8e]">高点 {analysisSeries.length ? Math.max(...analysisSeries.map(point => point.value)).toFixed(3) : '—'} {analysisMeta[analysis].unit}</span></div>
      </div>
    </FormRow>
    {newestUpdate && <FormRow label="曲线关联更新"><div className="border-l-2 border-[#f5a623] bg-[#1a1306] px-3 py-2 text-[10px]"><b className="block text-[#ffd277]">{newestUpdate.title}</b><span className="mt-1 line-clamp-2 text-[#a89a7b]">{newestUpdate.body}</span></div></FormRow>}
  </div>;
}

export default function YCURVEPanel({ onClose }: YCURVEPanelProps) {
  const [view, setView] = useState<ViewType>('menu');
  const [activeTool, setActiveTool] = useState<CurveMenuItem | null>(null);
  const [settings, setSettings] = useState<YcdfSettings>(DEFAULT_YCDF_SETTINGS);
  const [funcMenuOpen, setFuncMenuOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [gcCurves, setGcCurves] = useState<SelectedCurve[]>([]);
  const funcRef = useOutside<HTMLDivElement>(() => setFuncMenuOpen(false));

  const set = <K extends keyof YcdfSettings>(k: K, v: YcdfSettings[K]) =>
    setSettings(prev => ({ ...prev, [k]: v }));

  // -- 点击子菜单项 --
  const handleMenuItem = (item: CurveMenuItem) => {
    if (item.ticker === 'YCDF') {
      setView('ycdf');
      return;
    }
    if (item.ticker === 'CRVF') {
      setView('crvf');
      return;
    }
    if (item.ticker === 'GC') {
      setView('gc');
      return;
    }
    setActiveTool(item);
    setView('tool');
  };

  // -- CRVF → GC 跳转 --
  const handleCrvfGo = (curves: SelectedCurve[]) => {
    setGcCurves(curves);
    setView('gc');
  };

  // ------------------------------- 子菜单视图 -------------------------------
  const renderMenu = () => (
    <div className="flex flex-col h-full bg-black text-white font-mono overflow-auto">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 px-5 py-4 text-lg italic">
        <Home className="w-5 h-5 text-[#4a90e2]" />
        <span className="text-[#4a90e2] font-semibold">金融功能主目录</span>
        <ChevronRight className="w-4 h-4 text-[#4a90e2]" />
        <span className="text-[#4a90e2] font-semibold">主权债</span>
        <ChevronRight className="w-4 h-4 text-[#4a90e2]" />
        <span className="text-white not-italic font-semibold">收益曲线</span>
      </div>

      {/* two-column groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 px-6 py-2 flex-1">
        {/* 左列：自设曲线 + 查找曲线（合并展示前两组的拆分语义） */}
        <div className="space-y-6">
          {/* 自设曲线组 -> 仅 YCDF */}
          <MenuGroup title="自设曲线" items={[CURVE_MENU_GROUPS[0].items[0]]} onItem={handleMenuItem} />
          {/* 查找曲线组 -> CRVF */}
          <MenuGroup title="查找曲线" items={[CURVE_MENU_GROUPS[0].items[1]]} onItem={handleMenuItem} />
        </div>
        {/* 右列：当前及历史曲线 + 波动率 */}
        <div className="space-y-6">
          <MenuGroup title="当前及历史曲线" items={CURVE_MENU_GROUPS[1].items} onItem={handleMenuItem} />
          <MenuGroup title="波动率" items={CURVE_MENU_GROUPS[2].items} onItem={handleMenuItem} />
        </div>
      </div>

    </div>
  );

  // ------------------------------- YCDF 设定页 -------------------------------
  const renderYcdf = () => (
    <div className="flex flex-col h-full bg-black text-white font-mono overflow-auto">
      {/* 顶部蓝色命令栏 */}
      <div className="flex items-center justify-between bg-black border-b border-[#1c4d8f] px-2 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setView('menu')} className="px-1 text-[#4a90e2] hover:text-white" title="返回收益曲线菜单">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <ChevronRight className="w-3 h-3 text-[#4a90e2]" />
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#10243f] border border-[#1c4d8f] text-white">美国国债曲线</span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#10243f] border border-[#1c4d8f] text-white">YCDF</span>
          <div className="relative" ref={funcRef}>
            <button
              onClick={() => setFuncMenuOpen(v => !v)}
              className="flex items-center gap-1 px-2 py-0.5 text-[#4a90e2] hover:text-white"
            >
              相关功能目录 <ChevronDown className="w-3 h-3" />
            </button>
            {funcMenuOpen && (
              <div className="absolute left-0 top-full z-50 w-44 bg-[#0a0a0a] border border-[#1c4d8f] py-1">
                {['GC 绘制曲线图', 'FWCV 远期曲线分析', 'ICVS 掉期曲线建立', 'CRVF 查找曲线'].map(f => (
                  <button
                    key={f}
                    onClick={() => {
                      setFuncMenuOpen(false);
                      if (f.startsWith('CRVF')) setView('crvf');
                      else if (f.startsWith('GC')) setView('gc');
                      else {
                        const ticker = f.split(' ')[0];
                        const target = CURVE_MENU_GROUPS.flatMap(group => group.items).find(item => item.ticker === ticker);
                        if (target) { setActiveTool(target); setView('tool'); }
                      }
                    }}
                    className="block w-full px-3 py-1 text-left text-xs text-[#f5a623] hover:bg-[#1a2540]"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 红色标题栏 */}
      <div className="flex items-stretch border-y border-[#5a0d0d]">
        <button
          onClick={() => setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))}
          className="px-4 py-1.5 text-sm text-[#8a3a3a] bg-[#1a0606] hover:text-[#c05050] border-r border-[#5a0d0d]"
          title="保存设定"
        >
          {savedAt ? `已保存 ${savedAt}` : '1) 保存'}
        </button>
        <div className="flex-1 bg-gradient-to-r from-[#1a0606] to-[#7a1010]" />
        <div className="flex items-center px-4 py-1.5 text-sm text-white bg-[#7a1010] font-semibold">
          现金曲线设定
        </div>
      </div>

      {/* 表单区 */}
      <div className="flex-1 px-4 py-3">
        {/* YCDF Settings Group 标题条 */}
        <div className="bg-[#1c1c1c] border border-[#333] px-3 py-1 text-sm text-[#ccc]">YCDF 曲线设定</div>

        {/* 曲线设定 分组 */}
        <SectionLabel>曲线设定</SectionLabel>
        <FormRow label="预设市场方">
          <YcdfSelect options={MARKET_SIDE_OPTIONS} value={settings.marketSide} onChange={v => set('marketSide', v)} />
        </FormRow>
        <FormRow label="内插法">
          <YcdfSelect options={INTERPOLATION_OPTIONS} value={settings.interpolation} onChange={v => set('interpolation', v)} />
        </FormRow>
        <CheckRow checked={settings.fallbackFit} onToggle={() => set('fallbackFit', !settings.fallbackFit)} label="退回拟合" />
        <FormRow label="收益率调整方法">
          <YcdfSelect options={YIELD_ADJUST_OPTIONS} value={settings.yieldAdjust} onChange={v => set('yieldAdjust', v)} />
        </FormRow>
        <FormRow label="KRR移动方法">
          <YcdfSelect options={KRR_SHIFT_OPTIONS} value={settings.krrShift} onChange={v => set('krrShift', v)} />
        </FormRow>
        <YcdfCurveReference />

        {/* DV01/KRR 曲线设定 分组 */}
        <SectionLabel>DV01/KRR 曲线设定</SectionLabel>
        <FormRow label="DV01/KRR 曲线移动选项">
          <YcdfSelect options={DV01_MOVE_OPTIONS} value={settings.dv01Move} onChange={v => set('dv01Move', v)} />
        </FormRow>

        {/* 移动曲线工具设定 分组 */}
        <SectionLabel>移动曲线工具设定</SectionLabel>
        <FormRow label="DV01/KRR曲线移动货币/曲线常规">
          <div className="w-full border border-[#3a4a6a] bg-[#101828] px-2 py-1 text-xs text-[#8cc7ff]">USD · 美国国债政府曲线</div>
        </FormRow>

        {/* IYC Curve PCS */}
        <div className="mt-6">
          <FormRow label="IYC Curve PCS">
            <input
              value={settings.iycCurvePcs}
              onChange={e => set('iycCurvePcs', e.target.value)}
              className="w-full px-2 py-1 text-xs bg-[#f5a623] text-black border border-black focus:outline-none"
            />
          </FormRow>
          <CheckRow
            checked={settings.fallbackToDefaultPcs}
            onToggle={() => set('fallbackToDefaultPcs', !settings.fallbackToDefaultPcs)}
            label="Fallback to default PCS"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-full bg-black overflow-hidden">
      {/* close button — 仅在 menu/ycdf 视图显示，crvf/gc 内部有自己的关闭按钮 */}
      {(view === 'menu' || view === 'ycdf') && (
        <button
          onClick={onClose}
          className="absolute top-1.5 right-2 z-50 text-[#888] hover:text-white"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {view === 'menu' && renderMenu()}
      {view === 'ycdf' && renderYcdf()}
      {view === 'crvf' && (
        <CRVFPanel
          onClose={onClose}
          onBack={() => setView('menu')}
          onGo={handleCrvfGo}
        />
      )}
      {view === 'gc' && (
        <GCPanel
          onClose={onClose}
          onBack={() => setView('crvf')}
          initialCurves={gcCurves}
        />
      )}
      {view === 'tool' && activeTool?.ticker && <CurveDistinctTools item={{ ...activeTool, ticker: activeTool.ticker }} onBack={() => setView('menu')} />}
    </div>
  );
}

const CURVE_TOOL_DEFINITIONS: Record<string, { fields: [string, string, string]; note: string; result: (a: number, b: number, c: number) => string }> = {
  GCT: { fields: ['起始窗口（天）', '结束窗口（天）', '观察频率（天）'], note: '仅记录用户设定的观察窗口；未接入历史曲线读取。', result: (a, b, c) => `已设置 ${a}–${b} 天曲线观察窗口，每 ${c} 天复核一次。` },
  FWCV: { fields: ['短端收益率（%）', '长端收益率（%）', '远期期限（年）'], note: '按用户输入计算两点之间的年化远期变化，不读取市场远期报价。', result: (a, b, c) => `输入曲线的年化变化为 ${((b - a) / Math.max(c, 1)).toFixed(4)} 个百分点/年。` },
  FWCM: { fields: ['短端收益率（%）', '中端收益率（%）', '长端收益率（%）'], note: '仅基于输入的三个节点生成远期曲线矩阵摘要。', result: (a, b, c) => `短中段变化 ${(b - a).toFixed(4)}，中长段变化 ${(c - b).toFixed(4)} 个百分点。` },
  ICUR: { fields: ['左端收益率（%）', '右端收益率（%）', '定位比例（0–1）'], note: '使用用户输入节点作线性插值；不是可交易收益率。', result: (a, b, c) => `线性内插收益率为 ${(a + (b - a) * Math.min(Math.max(c, 0), 1)).toFixed(4)}%。` },
  BNCH: { fields: ['基准收益率（%）', '公司债收益率（%）', '久期（年）'], note: '计算用户输入债券相对基准的利差，不调用债券行情。', result: (a, b, c) => `输入债券相对基准利差为 ${((b - a) * 100).toFixed(2)} bp；久期参数 ${c.toFixed(2)} 年。` },
  ICVS: { fields: ['现金曲线收益率（%）', '掉期曲线收益率（%）', '期限（年）'], note: '计算输入现金/掉期节点差，不建立或发布市场掉期曲线。', result: (a, b, c) => `${c.toFixed(2)} 年节点的输入现金-掉期利差为 ${((a - b) * 100).toFixed(2)} bp。` },
  GC3D: { fields: ['期限（年）', '收益率（%）', '冲击（bp）'], note: '形成用户输入的三维曲线情景点，不读取或模拟市场曲面。', result: (a, b, c) => `情景点：期限 ${a.toFixed(2)} 年，冲击后收益率 ${(b + c / 100).toFixed(4)}%。` },
  CRV: { fields: ['起点收益率（%）', '终点收益率（%）', '节点数量'], note: '按输入端点生成自设曲线斜率摘要，市场曲线读取未接入。', result: (a, b, c) => `自设曲线斜率为 ${(b - a).toFixed(4)} 个百分点；计划节点 ${Math.max(2, Math.round(c))} 个。` },
  VCUB: { fields: ['年化波动率（%）', '期限（年）', '置信水平（%）'], note: '计算输入波动率的方差时间缩放，不提供或模拟波动率立方图市场数据。', result: (a, b, c) => `总方差近似为 ${((a / 100) ** 2 * Math.max(b, 0)).toFixed(6)}；输入置信水平 ${c.toFixed(1)}%。` },
};

function CurveInputTool({ item, onBack }: { item: CurveMenuItem; onBack: () => void }) {
  const definition = CURVE_TOOL_DEFINITIONS[item.ticker ?? 'GCT'];
  const [values, setValues] = useState(['1', '2', '1']);
  const [result, setResult] = useState<string | null>(null);
  const update = (index: number, value: string) => setValues(prev => prev.map((current, i) => i === index ? value : current));
  const calculate = () => {
    const [a, b, c] = values.map(value => Number(value));
    if (![a, b, c].every(Number.isFinite)) { setResult('请输入三个有效数值后再计算。'); return; }
    setResult(definition.result(a, b, c));
  };
  return <div className="flex h-full flex-col overflow-auto bg-black font-mono text-white">
    <div className="flex items-center gap-3 border-b border-[#1c4d8f] px-5 py-3"><button onClick={onBack} className="text-[#4a90e2] hover:text-white">← 返回收益曲线</button><span className="text-[#f5a623] font-semibold">{item.num}) {item.ticker} {item.name}</span></div>
    <div className="mx-6 mt-6 max-w-3xl border border-[#3a4a6a] bg-[#0c0c0c] p-5"><p className="text-sm leading-6 text-[#aaa]">{definition.note}</p><p className="mt-2 text-xs text-[#777]">来源状态：未接入外部市场数据；本工具仅处理当前用户输入。</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">{definition.fields.map((label: string, index: number) => <label key={label} className="text-xs text-[#f5a623]">{label}<input value={values[index]} onChange={event => update(index, event.target.value)} inputMode="decimal" className="mt-1 w-full border border-[#4a90e2] bg-[#101828] px-2 py-2 text-white outline-none focus:border-[#f5a623]" /></label>)}</div>
      <button onClick={calculate} className="mt-5 bg-[#f5a623] px-4 py-2 text-sm font-semibold text-black hover:brightness-105">计算当前输入</button>
      {result && <div className="mt-5 border border-[#2b6d62] bg-[#071b1a] p-4 text-sm text-[#8ee6cf]">结果：{result}</div>}</div>
  </div>;
}

// --- 子组件 ------------------------------------------------------------------
function MenuGroup({
  title, items, onItem,
}: { title: string; items: CurveMenuItem[]; onItem: (i: CurveMenuItem) => void }) {
  return (
    <div>
      <div className="text-white text-lg font-semibold mb-2">{title}</div>
      <div className="space-y-1">
        {items.map(item => (
          <button
            key={item.num}
            onClick={() => onItem(item)}
            className="flex items-center gap-3 w-full text-left hover:bg-[#111] px-2 py-0.5 group"
          >
            <span className="text-[#888] w-6 text-right">{item.num})</span>
            {item.ai && (
              <span className="inline-flex items-center justify-center w-6 h-4 bg-[#333] text-[9px] font-bold border border-[#555] text-white">AI</span>
            )}
            <span className="text-[#f5a623] w-14 font-semibold">{item.ticker}</span>
            <span className="text-[#f5a623] group-hover:underline">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#161616] px-3 py-1 mt-1 text-xs text-[#999] border-x border-b border-[#2a2a2a]">{children}</div>;
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[260px_1fr] items-center gap-4 px-3 py-1">
      <span className="text-[#f5a623] text-xs">{label}</span>
      <div className="max-w-2xl">{children}</div>
    </div>
  );
}

function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 px-3 py-1 text-left">
      <span className={cn(
        'flex items-center justify-center w-4 h-4 border',
        checked ? 'bg-[#1c4d8f] border-[#1c4d8f]' : 'bg-transparent border-[#4a90e2]',
      )}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="text-[#f5a623] text-xs">{label}</span>
    </button>
  );
}
