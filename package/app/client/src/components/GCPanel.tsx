/**
 * GCPanel — 绘制曲线图
 * 经典视图：双层图表 + 右侧控制栏，曲线只使用已加载的有效观测
 * 曲线实验室：① 期限插值查询 ② 曲线利差 ③ 情景位移模拟 ④ 久期/凸性/DV01 计算器
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronDown, Download, LineChart as LineChartIcon, FlaskConical, Calculator, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import {
  type SelectedCurve, type GcCurveSeries, type GcCurvePoint,
} from '@/lib/crvfData';
import {
  densifyCurve, queryYield, curveSpread, applyScenario, bondAnalytics,
  curveShapeMetrics, tenorToYears, type ScenarioType,
} from '@/lib/gcLab';

// --- 外部点击关闭钩子 ----------------------------------------------------------
function useOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  const cb = useCallback(onOut, [onOut]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [cb]);
  return ref;
}

interface GCPanelProps {
  onClose: () => void;
  onBack?: () => void;
  initialCurves?: SelectedCurve[];
}

const LOWER_HALF_OPTIONS = ['利差图', '表格', '无'];
const CURVE_COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa'];
const KEY_TENORS = ['3M', '1Y', '2Y', '3Y', '5Y', '10Y', '15Y', '30Y'];
const GC_RATE_SERIES = [
  { id: 'DGS3MO', tenor: '3M' }, { id: 'DGS1', tenor: '1Y' }, { id: 'DGS2', tenor: '2Y' },
  { id: 'DGS3', tenor: '3Y' }, { id: 'DGS5', tenor: '5Y' }, { id: 'DGS7', tenor: '7Y' },
  { id: 'DGS10', tenor: '10Y' }, { id: 'DGS20', tenor: '20Y' }, { id: 'DGS30', tenor: '30Y' },
] as const;
type RateRecord = Record<string, { latest?: number | null; data?: Array<{ date: string; value: number }> }>;

type GCView = 'classic' | 'lab';

export default function GCPanel({ onClose, onBack, initialCurves }: GCPanelProps) {
  const [view, setView] = useState<GCView>('classic');
  const ratesQuery = trpc.sovereignBonds.getMultipleRateSeries.useQuery(
    { series: GC_RATE_SERIES.map((item) => item.id) },
    { refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const rateData = ratesQuery.data?.data as RateRecord | undefined;
  const observedCurves = useMemo<GcCurveSeries[]>(() => {
    const buildCurve = (id: string, name: string, offset: -1 | -2, color: string): GcCurveSeries | null => {
      const data = GC_RATE_SERIES.flatMap((item) => {
        const history = rateData?.[item.id]?.data ?? [];
        const point = history.at(offset);
        return point && Number.isFinite(point.value) ? [{ tenor: item.tenor, value: Number(point.value) }] : [];
      });
      return data.length >= 2 ? { id, name, color, data } : null;
    };
    return [
      buildCurve('UST-LATEST', '美国国债各期限最新有效观测', -1, CURVE_COLORS[0]),
      buildCurve('UST-PREV', '美国国债各期限上一有效观测', -2, CURVE_COLORS[1]),
    ].filter((curve): curve is GcCurveSeries => curve !== null);
  }, [rateData]);
  const injectedCurves = useMemo<GcCurveSeries[]>(() => (initialCurves ?? []).flatMap((curve, index) => {
    const candidate = curve as unknown as GcCurveSeries;
    return Array.isArray(candidate.data) && candidate.data.filter((point) => Number.isFinite(point.value)).length >= 2
      ? [{ ...candidate, color: candidate.color ?? CURVE_COLORS[index % CURVE_COLORS.length], data: candidate.data.filter((point) => Number.isFinite(point.value)) }]
      : [];
  }).slice(0, 5), [initialCurves]);
  const availableCurves = injectedCurves.length ? injectedCurves : observedCurves;
  const [removedCurveIds, setRemovedCurveIds] = useState<string[]>([]);
  const curves = availableCurves.filter((curve) => !removedCurveIds.includes(curve.id));
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  // 平滑模式
  const [smooth, setSmooth] = useState(false);
  const [lowerHalf, setLowerHalf] = useState('利差图');
  const [lowerOpen, setLowerOpen] = useState(false);
  const lowerRef = useOutside<HTMLDivElement>(() => setLowerOpen(false));
  const [benchmark, setBenchmark] = useState('');
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const benchmarkRef = useOutside<HTMLDivElement>(() => setBenchmarkOpen(false));
  const [tenorMode, setTenorMode] = useState<'all' | 'key'>('key');

  useEffect(() => {
    setVisible((current) => Object.fromEntries(availableCurves.map((curve) => [curve.id, current[curve.id] ?? true])));
    if (!availableCurves.some((curve) => curve.id === benchmark)) setBenchmark(availableCurves[0]?.id ?? '');
  }, [availableCurves, benchmark]);

  const visibleCurves = curves.filter(c => visible[c.id] !== false);

  // 合并图表数据
  const chartData = useMemo(() => {
    if (smooth) {
      // 以第一条曲线密集化的 years 为 X 轴
      const base = densifyCurve(curves[0]?.data ?? [], 60, 'spline');
      return base.map((row, idx) => {
        const out: Record<string, string | number> = { tenor: row.tenor, years: row.years };
        curves.forEach(c => {
          const d = densifyCurve(c.data, 60, 'spline');
          out[c.id] = d[idx]?.value ?? 0;
        });
        return out;
      });
    }
    const tenors = curves[0]?.data.map(p => p.tenor) ?? [];
    return tenors.map((tenor, i) => {
      const row: Record<string, string | number> = { tenor };
      curves.forEach(c => { row[c.id] = c.data[i]?.value ?? 0; });
      return row;
    });
  }, [curves, smooth]);

  // 利差数据（实时计算，前两条可见曲线）
  const spreadData = useMemo(() => {
    if (visibleCurves.length >= 2) {
      return curveSpread(visibleCurves[0].data, visibleCurves[1].data, smooth ? 'spline' : 'linear')
        .map(s => ({ tenor: s.tenor, spread: s.spreadBp }));
    }
    return [];
  }, [visibleCurves, smooth]);

  const removeCurve = (id: string) => {
    setRemovedCurveIds((current) => current.includes(id) ? current : [...current, id]);
    toast.success(`已移除曲线 ${id}`);
  };

  const toggleVisible = (id: string) => setVisible(v => ({ ...v, [id]: v[id] === false }));
  const handleExport = () => {
    if (!curves.length) { toast.error('当前没有可导出的有效曲线'); return; }
    const header = ['曲线代码', '名称', ...KEY_TENORS].join(',');
    const rows = curves.map(c => {
      const vals = KEY_TENORS.map(t => c.data.find(d => d.tenor === t)?.value?.toFixed(3) ?? '');
      return [c.id, `"${c.name}"`, ...vals].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `GC_curves_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出 CSV');
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1520] text-white font-mono overflow-hidden">
      {/* -- 顶部命令栏 -- */}
      <div className="flex items-center justify-between bg-black border-b border-[#1c4d8f] px-2 py-1 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 bg-[#10243f] border border-[#1c4d8f] text-white">主权债收益率曲线</span>
          <span className="px-2 py-0.5 bg-[#10243f] border border-[#1c4d8f] text-white">GC</span>
          <span className={ratesQuery.isFetching ? 'text-[#f5a623]' : 'text-[#4ade80]'}>{ratesQuery.isFetching ? '正在读取期限观测' : `${availableCurves.length} 条有效观测曲线`}</span>
        </div>
        <button onClick={onClose} className="text-[#888] hover:text-white ml-2"><X className="w-4 h-4" /></button>
      </div>

      {/* -- 视图切换 -- */}
      <div className="flex items-center gap-1 px-3 py-1 bg-[#7a1010] border-b border-[#5a0d0d] text-xs shrink-0">
        <button onClick={() => setView('classic')}
          className={cn('flex items-center gap-1 px-2 py-0.5', view === 'classic' ? 'bg-[#f5a623] text-black' : 'text-[#f5a623] hover:text-white')}>
          <LineChartIcon className="w-3 h-3" />经典曲线图
        </button>
        <button onClick={() => setView('lab')}
          className={cn('flex items-center gap-1 px-2 py-0.5', view === 'lab' ? 'bg-[#f5a623] text-black' : 'text-[#f5a623] hover:text-white')}>
          <FlaskConical className="w-3 h-3" />曲线建模实验室
        </button>
        {onBack && <><div className="flex-1" /><button onClick={onBack} className="text-[#4a90e2] hover:text-white">&lt;Back&gt; 返回 CRVF</button></>}
      </div>

      {view === 'classic' ? (
        <ClassicView
          curves={curves} visibleCurves={visibleCurves} visible={visible} toggleVisible={toggleVisible}
          chartData={chartData} spreadData={spreadData} smooth={smooth} setSmooth={setSmooth}
          lowerHalf={lowerHalf} setLowerHalf={setLowerHalf} lowerOpen={lowerOpen} setLowerOpen={setLowerOpen} lowerRef={lowerRef}
          benchmark={benchmark} setBenchmark={setBenchmark} benchmarkOpen={benchmarkOpen} setBenchmarkOpen={setBenchmarkOpen} benchmarkRef={benchmarkRef}
          tenorMode={tenorMode} setTenorMode={setTenorMode}
          handleExport={handleExport} removeCurve={removeCurve} resetCurves={() => setRemovedCurveIds([])}
        />
      ) : (
        <LabView curves={curves} />
      )}

      {/* -- 底部 -- */}
      <div className="flex items-center justify-center gap-2 px-3 py-1 bg-black border-t border-[#222] shrink-0">
        <span className="text-[#f5a623] text-xs">GC</span>
        <span className="text-[#888] text-xs">绘制曲线图 · 主权债收益率曲线建模与情景分析</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 经典曲线视图
// ════════════════════════════════════════════════════════════════════════════
function ClassicView(props: any) {
  const {
    curves, visibleCurves, visible, toggleVisible, chartData, spreadData, smooth, setSmooth,
    lowerHalf, setLowerHalf, lowerOpen, setLowerOpen, lowerRef,
    benchmark, setBenchmark, benchmarkOpen, setBenchmarkOpen, benchmarkRef,
    tenorMode, setTenorMode, handleExport, removeCurve, resetCurves,
  } = props;

  return (
    <>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#0d1520] border-b border-[#1c4d8f] text-xs shrink-0 flex-wrap">
        <span className="text-white font-semibold truncate max-w-[160px]">{curves[0]?.name.slice(0, 22) ?? 'GC 曲线'}</span>
        {/* 平滑（自设曲线→真实平滑插值开关） */}
        <button onClick={() => setSmooth((v: boolean) => !v)}
          className={cn('px-2 py-0.5 text-xs', smooth ? 'bg-[#f5a623] text-black' : 'text-[#f5a623] border border-[#f5a623] hover:bg-[#f5a623] hover:text-black')}>
          {smooth ? '样条平滑: 开' : '样条平滑: 关'}
        </button>
        <button type="button" onClick={handleExport} className="inline-flex items-center gap-1 border border-[#1c4d8f] px-2 py-0.5 text-[#60a5fa] hover:bg-[#1a2540]"><Download className="h-3 w-3" />导出 CSV</button>
        <div className="flex-1" />
        {/* 下半图快捷切换 */}
        <div className="relative" ref={lowerRef}>
          <button onClick={() => setLowerOpen((v: boolean) => !v)} className="flex items-center gap-1 px-2 py-0.5 bg-[#1a2540] border border-[#1c4d8f] text-white">
            下半图 {lowerHalf} <ChevronDown className="w-3 h-3" />
          </button>
          {lowerOpen && (
            <div className="absolute right-0 top-full z-50 w-32 bg-[#0a0a0a] border border-[#1c4d8f] py-1">
              {LOWER_HALF_OPTIONS.map(opt => (
                <button key={opt} onClick={() => { setLowerHalf(opt); setLowerOpen(false); }}
                  className={cn('block w-full px-3 py-1 text-left text-xs', lowerHalf === opt ? 'bg-[#1c4d8f] text-white' : 'text-[#f5a623] hover:bg-[#1a2540]')}>{opt}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className={cn('overflow-hidden', lowerHalf !== '无' ? 'h-[58%]' : 'h-full')}>
            {chartData.length ? <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                <XAxis dataKey="tenor" tick={{ fill: '#888', fontSize: 10 }} interval={smooth ? 6 : 0} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1c4d8f', fontSize: 11 }} labelStyle={{ color: '#f5a623' }} />
                {visibleCurves.map((c: GcCurveSeries) => (
                  <Line key={c.id} type="monotone" dataKey={c.id} stroke={c.color} strokeWidth={1.6}
                    dot={smooth ? false : { r: 2.5, fill: c.color }} name={c.id} />
                ))}
              </LineChart>
            </ResponsiveContainer> : <div className="grid h-full place-items-center px-6 text-center text-xs text-[#687486]">期限源暂未返回两个以上有效节点；页面不会以示例曲线替代。</div>}
          </div>
          <div className="px-4 py-1 bg-[#0d1520] border-t border-[#1a2540] shrink-0">
            {curves.map((c: GcCurveSeries) => (
              <div key={c.id} className="flex items-center gap-2 text-[10px]">
                <span style={{ color: c.color, opacity: visible[c.id] === false ? 0.3 : 1 }}>●</span>
                <span className="text-[#ccc]" style={{ opacity: visible[c.id] === false ? 0.4 : 1 }}>{c.id} {c.name.slice(0, 46)}</span>
              </div>
            ))}
          </div>

          {lowerHalf === '利差图' && (
            <div className="h-[28%] border-t border-[#1a2540] overflow-hidden">
              {spreadData.length ? <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spreadData} margin={{ top: 5, right: 20, left: 10, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                  <XAxis dataKey="tenor" tick={{ fill: '#888', fontSize: 10 }} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1c4d8f', fontSize: 11 }} labelStyle={{ color: '#f5a623' }} />
                  <ReferenceLine y={0} stroke="#444" />
                  <Line type="monotone" dataKey="spread" stroke="#60a5fa" strokeWidth={1.5} dot={false} name="利差(bp)" />
                </LineChart>
              </ResponsiveContainer> : <div className="grid h-[calc(100%-22px)] place-items-center text-[10px] text-[#687486]">至少保留并显示两条有效曲线后计算逐期限差值</div>}
              <div className="px-4 py-0.5 bg-[#0d1520] text-[10px] text-[#ccc] border-t border-[#1a2540]">
                <span className="text-[#4a90e2]">●</span> 利差(bp) · {visibleCurves[0]?.id ?? '-'} − {visibleCurves[1]?.id ?? '-'}（按有效观测计算）
              </div>
            </div>
          )}

          {lowerHalf === '表格' && (
            <div className="h-[28%] border-t border-[#1a2540] overflow-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-[#1a2540]">
                  <th className="text-left px-2 py-1 text-[#f5a623]">曲线代码</th>
                  {KEY_TENORS.map(t => <th key={t} className="text-right px-2 py-1 text-[#f5a623]">{t}</th>)}
                </tr></thead>
                <tbody>
                  {curves.map((c: GcCurveSeries, i: number) => (
                    <tr key={c.id} className="border-b border-[#111]">
                      <td className="px-2 py-0.5"><span style={{ color: c.color }}>■</span> <span className="text-[#f5a623]">{i + 1}) {c.id}</span></td>
                      {KEY_TENORS.map(t => {
                        const v = tenorMode === 'key'
                          ? c.data.find((d: GcCurvePoint) => d.tenor === t)?.value
                          : queryYield(c.data, t, 'spline');
                        return <td key={t} className="text-right px-2 py-0.5 text-[#f5a623]">{v != null ? v.toFixed(3) : '-'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-4 px-3 py-1 text-[10px]">
                <button onClick={() => setTenorMode('all')} className="flex items-center gap-1">
                  <span className={cn('w-2.5 h-2.5 rounded-full border', tenorMode === 'all' ? 'bg-[#4a90e2] border-[#4a90e2]' : 'border-[#555]')} />
                  <span className={tenorMode === 'all' ? 'text-[#4a90e2]' : 'text-[#888]'}>插值期限</span>
                </button>
                <button onClick={() => setTenorMode('key')} className="flex items-center gap-1">
                  <span className={cn('w-2.5 h-2.5 rounded-full border', tenorMode === 'key' ? 'bg-[#4a90e2] border-[#4a90e2]' : 'border-[#555]')} />
                  <span className={tenorMode === 'key' ? 'text-[#4a90e2]' : 'text-[#888]'}>实际期限</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧控制栏 */}
        <div className="w-[230px] shrink-0 border-l border-[#1a2540] overflow-y-auto bg-[#0a0f1a] text-xs">
          <div className="bg-[#1c4d8f] px-3 py-1 text-white font-semibold">曲线与相对价值</div>
          <div className="px-2 py-2 border-b border-[#1a2540]">
            <div className="mb-1 flex items-center justify-between text-[#f5a623]"><span>已加载期限曲线</span><button type="button" onClick={resetCurves} className="text-[9px] text-[#60a5fa] hover:text-white">恢复全部</button></div>
            {curves.map((c: GcCurveSeries) => (
              <div key={c.id} className="mb-1 flex items-center gap-1">
                <input type="checkbox" checked={visible[c.id] !== false} onChange={() => toggleVisible(c.id)} className="w-3 h-3" />
                <span className="flex-1 text-[10px] truncate" style={{ color: c.color }}>{c.id} {c.name.slice(0, 14)}</span>
                <button onClick={() => removeCurve(c.id)} className="text-[#c05050] hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {!curves.length && <div className="py-3 text-center text-[10px] text-[#687486]">没有已显示曲线</div>}
          </div>
          <div className="px-2 py-2 border-b border-[#1a2540]">
            <div className="text-[#f5a623] mb-1">基准曲线</div>
            <div className="relative" ref={benchmarkRef}>
              <button disabled={!curves.length} onClick={() => setBenchmarkOpen((v: boolean) => !v)} className="flex items-center justify-between w-full px-2 py-0.5 bg-[#f5a623] text-black disabled:opacity-40">
                <span className="truncate">{curves.find((curve: GcCurveSeries) => curve.id === benchmark)?.name ?? '暂无有效曲线'}</span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>
              {benchmarkOpen && (
                <div className="absolute left-0 top-full z-50 w-full bg-[#0a0a0a] border border-[#333] py-1">
                  {curves.map((curve: GcCurveSeries) => (
                    <button key={curve.id} onClick={() => { setBenchmark(curve.id); setBenchmarkOpen(false); toast.success(`基准曲线已设为 ${curve.id}`); }}
                      className={cn('block w-full px-2 py-0.5 text-left text-xs', benchmark === curve.id ? 'bg-[#1c4d8f] text-white' : 'text-[#f5a623] hover:bg-[#1a2540]')}>{curve.id}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 text-[9px] leading-4 text-[#687486]">曲线节点来自当前已加载序列；利差仅在两条可见曲线之间逐期限计算。</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 曲线建模实验室
// ════════════════════════════════════════════════════════════════════════════
function LabView({ curves }: { curves: GcCurveSeries[] }) {
  const [selCurve, setSelCurve] = useState(curves[0]?.id ?? '');
  const active = curves.find(c => c.id === selCurve) ?? curves[0];

  // ① 插值查询
  const [queryTenor, setQueryTenor] = useState('4Y');
  const [method, setMethod] = useState<'linear' | 'spline'>('spline');
  const queried = active ? queryYield(active.data, queryTenor, method) : null;

  // ③ 情景位移
  const [scenario, setScenario] = useState<ScenarioType>('parallel');
  const [bp, setBp] = useState(50);
  const shifted = active ? applyScenario(active.data, { type: scenario, bp }) : [];
  const scenarioChart = useMemo(() => {
    if (!active) return [];
    return active.data.map((p, i) => ({
      tenor: p.tenor,
      原始: p.value,
      情景后: shifted[i]?.value ?? p.value,
    }));
  }, [active, shifted]);

  // ④ 久期凸性
  const [calcYtm, setCalcYtm] = useState(active ? (active.data.find(d => d.tenor === '5Y')?.value ?? 4.5) : 4.5);
  const [calcYears, setCalcYears] = useState(5);
  const [calcCoupon, setCalcCoupon] = useState<number | undefined>(undefined);
  const analytics = bondAnalytics(calcYtm, calcYears, 2, calcCoupon);

  // 曲线形状指标
  const shape = active ? curveShapeMetrics(active.data) : { slope2s10s: null, slope3m10y: null, curvature: null };

  const SCENARIO_LABELS: Record<ScenarioType, string> = {
    parallel: '平行移动', steepen: '陡峭化', flatten: '平坦化', butterfly: '蝶式(中端)',
  };

  if (!active) return <div className="flex-1 flex items-center justify-center text-[#888] text-xs">暂无曲线，请在经典视图添加曲线</div>;

  return (
    <div className="flex-1 overflow-auto p-3 space-y-3 text-xs">
      {/* 顶部说明 + 曲线选择 */}
      <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
        <div className="text-[#f5a623] font-semibold mb-1 flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" />曲线建模实验室 · 主权债收益率曲线工具</div>
        <div className="text-[#7a8a9a] leading-relaxed mb-2">
          对所选曲线进行确定性数学建模：任意期限<span className="text-[#aaa]">样条插值</span>、
          两曲线<span className="text-[#aaa]">利差</span>、
          利率<span className="text-[#aaa]">情景位移模拟</span>、
          债券<span className="text-[#aaa]">久期/凸性/DV01</span> 计算。
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#888]">分析曲线:</span>
          <select value={selCurve} onChange={e => setSelCurve(e.target.value)}
            className="bg-[#1a2540] text-[#f5a623] border border-[#1c4d8f] px-2 py-0.5 focus:outline-none">
            {curves.map(c => <option key={c.id} value={c.id}>{c.id} — {c.name.slice(0, 24)}</option>)}
          </select>
          <span className="text-[#555] mx-1">|</span>
          <span className="text-[#888]">曲线形态:</span>
          <span className="text-[#aaa]">2s10s 斜率 <span className="text-[#4ade80]">{shape.slope2s10s ?? '-'}bp</span></span>
          <span className="text-[#aaa]">3M-10Y <span className="text-[#60a5fa]">{shape.slope3m10y ?? '-'}bp</span></span>
          <span className="text-[#aaa]">曲率 <span className="text-[#f472b6]">{shape.curvature ?? '-'}bp</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* ① 插值查询 */}
        <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
          <div className="text-[#f5a623] font-semibold mb-2 flex items-center gap-1"><Waves className="w-3.5 h-3.5" />① 期限插值查询</div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[#888]">期限:</span>
            <input value={queryTenor} onChange={e => setQueryTenor(e.target.value)}
              className="w-20 bg-[#1a2540] text-[#f5a623] border border-[#1c4d8f] px-2 py-0.5 focus:outline-none" placeholder="如 4Y / 18M" />
            <div className="flex">
              {(['spline', 'linear'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={cn('px-2 py-0.5', method === m ? 'bg-[#1c4d8f] text-white' : 'text-[#888] hover:text-white')}>
                  {m === 'spline' ? '样条' : '线性'}
                </button>
              ))}
            </div>
          </div>
          <div className="text-center py-2">
            <div className="text-[#888] text-[10px]">{queryTenor} 插值收益率</div>
            <div className="text-2xl text-[#4ade80] font-bold">{queried != null ? `${queried.toFixed(3)}%` : '无效期限'}</div>
          </div>
          <div className="text-[#666] text-[10px]">支持任意期限（D/W/M/Y）。样条采用单调三次（Fritsch–Carlson），避免过冲。</div>
        </div>

        {/* ④ 久期凸性计算器 */}
        <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
          <div className="text-[#f5a623] font-semibold mb-2 flex items-center gap-1"><Calculator className="w-3.5 h-3.5" />④ 久期 / 凸性 / DV01</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <label className="flex flex-col"><span className="text-[#888] text-[10px]">YTM (%)</span>
              <input type="number" step="0.01" value={calcYtm} onChange={e => setCalcYtm(parseFloat(e.target.value) || 0)} className="bg-[#1a2540] text-[#f5a623] border border-[#1c4d8f] px-2 py-0.5 focus:outline-none" /></label>
            <label className="flex flex-col"><span className="text-[#888] text-[10px]">期限 (年)</span>
              <input type="number" step="0.5" value={calcYears} onChange={e => setCalcYears(parseFloat(e.target.value) || 0)} className="bg-[#1a2540] text-[#f5a623] border border-[#1c4d8f] px-2 py-0.5 focus:outline-none" /></label>
          </div>
          <button onClick={() => { const v = queryYield(active.data, `${calcYears}Y`, 'spline'); if (v != null) { setCalcYtm(v); toast.success(`已用曲线 ${calcYears}Y 点 ${v}% 填入 YTM`); } }}
            className="w-full mb-2 px-2 py-0.5 text-[#4a90e2] border border-[#1c4d8f] hover:bg-[#1a2540] text-[10px]">从曲线取 {calcYears}Y 收益率</button>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <div className="flex justify-between"><span className="text-[#888]">价格</span><span className="text-[#aaa]">{analytics.price}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">麦考利久期</span><span className="text-[#aaa]">{analytics.macaulayDuration}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">修正久期</span><span className="text-[#4ade80]">{analytics.modifiedDuration}</span></div>
            <div className="flex justify-between"><span className="text-[#888]">凸性</span><span className="text-[#60a5fa]">{analytics.convexity}</span></div>
            <div className="flex justify-between col-span-2"><span className="text-[#888]">DV01 (每 100 面值)</span><span className="text-[#f5a623]">{analytics.dv01}</span></div>
          </div>
        </div>
      </div>

      {/* ③ 情景位移模拟 */}
      <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="text-[#f5a623] font-semibold">③ 利率情景位移模拟 — {active.id}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {(Object.keys(SCENARIO_LABELS) as ScenarioType[]).map(s => (
              <button key={s} onClick={() => setScenario(s)}
                className={cn('px-2 py-0.5', scenario === s ? 'bg-[#1c4d8f] text-white' : 'text-[#888] hover:text-white border border-[#1c2a40]')}>
                {SCENARIO_LABELS[s]}
              </button>
            ))}
            <span className="text-[#888] ml-2">幅度:</span>
            <input type="range" min={-150} max={150} step={5} value={bp} onChange={e => setBp(Number(e.target.value))} className="w-32 accent-[#f5a623]" />
            <span className="text-[#f5a623] w-14">{bp > 0 ? '+' : ''}{bp}bp</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={scenarioChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
            <XAxis dataKey="tenor" tick={{ fill: '#888', fontSize: 10 }} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1c4d8f', fontSize: 11 }} labelStyle={{ color: '#f5a623' }} formatter={(v: number) => `${v.toFixed(3)}%`} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="原始" stroke="#60a5fa" strokeWidth={1.5} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="情景后" stroke="#f59e0b" strokeWidth={1.8} dot={{ r: 2 }} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
        <div className="text-[#666] text-[10px] mt-1">
          解读：{SCENARIO_LABELS[scenario]} {bp > 0 ? '+' : ''}{bp}bp 情景下，曲线形变如上图。
          可结合右上久期凸性估算主权债/债券持仓的损益（ΔP ≈ −修正久期 × Δy + ½ × 凸性 × Δy²）。
        </div>
      </div>
    </div>
  );
}
