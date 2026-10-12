import React from 'react';
/**
 * CRVFPanel — 查找曲线
 * 经典视图：精确复刻彭博「查找曲线」界面（三列联动检索），所有按钮均接入真实交互
 * 相对价值筛选器：① 相对价值排行榜 ② 曲线对比表 ③ 监控清单（数据库持久化）
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, Search, BarChart3, Star, Trash2, Plus, ArrowUpDown, LineChart as LineChartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { DataLoadingSkeleton } from '@/components/ChartSkeleton';
import CurveWorkflowWorkbench from '@/components/CurveWorkflowWorkbench';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  REGION_LIST, G7_COUNTRIES, EU_COUNTRIES,
  MM_G7_COUNTRIES, MM_G7_CANADA,
  MUNI_REGIONS, MUNI_US_SUBTYPES, MUNI_US_ALL_CURVES,
  FX_G7_COUNTRIES, FX_G7_ALL_CURVES,
  CREDIT_SUB_TABS, CREDIT_SECTORS, CREDIT_RATINGS, CREDIT_SECTOR_CURVES,
  CUSTOM_SUB_TABS, CUSTOM_TYPE_OPTIONS,
  ALL_ALL_CURVES,
  type SelectedCurve, type CrvfCurve, type CrvfCountry,
} from '@/lib/crvfData';
import {
  rankCurves, curveTenorValues, compareTenors, SORT_OPTIONS,
  VALUATION_LABEL, VALUATION_COLOR, type SortKey, type CurveMetrics,
} from '@/lib/crvfRelativeValue';

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

const MAIN_TABS = [
  { id: '10', name: '全部' },
  { id: '11', name: '国家/地区' },
  { id: '12', name: '信用' },
  { id: '13', name: '货币市场' },
  { id: '14', name: '地方债与地区债' },
  { id: '15', name: '外汇' },
  { id: '16', name: '自设曲线' },
];

interface CRVFPanelProps {
  onClose: () => void;
  onBack?: () => void;
  onGo?: (curves: SelectedCurve[]) => void;
}

type CrvfView = 'classic' | 'rv';
type CurveWorkflow = 'forward' | 'spread' | 'cash' | null;

export default function CRVFPanel({ onClose, onBack, onGo }: CRVFPanelProps) {
  const [view, setView] = useState<CrvfView>('classic');
  const [mode, setMode] = useState<'single' | 'multi'>('multi');
  const [activeTab, setActiveTab] = useState('10');
  const [creditSubTab, setCreditSubTab] = useState('18');
  const [customSubTab, setCustomSubTab] = useState('19');
  const [customTypeFilter, setCustomTypeFilter] = useState('0');
  const [customTypeOpen, setCustomTypeOpen] = useState(false);
  const customTypeRef = useOutside<HTMLDivElement>(() => setCustomTypeOpen(false));
  const [col1, setCol1] = useState<string>('41');
  const [col2, setCol2] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<SelectedCurve[]>([]);
  const [funcMenuOpen, setFuncMenuOpen] = useState(false);
  const funcRef = useOutside<HTMLDivElement>(() => setFuncMenuOpen(false));
  const [setMenuOpen, setSetMenuOpen] = useState(false);
  const setMenuRef = useOutside<HTMLDivElement>(() => setSetMenuOpen(false));
  const [workflow, setWorkflow] = useState<CurveWorkflow>(null);

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setCol1('41');
    setCol2(null);
    setSearchText('');
  };

  const addCurve = (curve: CrvfCurve, country = '', currency = '', type = '') => {
    if (selected.find(s => s.id === curve.id)) { toast.info('该曲线已在已选列表'); return; }
    setSelected(prev => [...prev, { num: prev.length + 21, name: curve.name, country, currency, type, id: curve.id }]);
    toast.success(`已添加 ${curve.name}`);
  };

  const removeCurve = (id: string) => {
    setSelected(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, num: i + 21 })));
  };

  const handleGo = () => {
    if (selected.length === 0) { toast.error('请先选择至少一条曲线'); return; }
    if (onGo) { onGo(selected); toast.success(`已将 ${selected.length} 条曲线发送至曲线图`); return; }
    setView('rv');
    toast.success('已切换至相对价值筛选器，可在曲线对比区查看所选曲线');
  };

  const handleExportSelected = () => {
    setSetMenuOpen(false);
    if (selected.length === 0) { toast.error('已选列表为空'); return; }
    const header = ['序号', '名称', '国家/地区', '货币', '类型', '曲线ID'].join(',');
    const rows = selected.map(s => [s.num, `"${s.name}"`, s.country, s.currency, s.type, s.id].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CRVF_selected_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出已选曲线 CSV');
  };

  const getColumns = () => {
    switch (activeTab) {
      case '10':
        return { col1Items: REGION_LIST, col2Items: null, curves: ALL_ALL_CURVES };
      case '11': {
        const col2Items = col1 === '42' ? G7_COUNTRIES : col1 === '43' ? EU_COUNTRIES : null;
        const curves = col2Items ? (col2Items.find(c => String(c.num) === col2)?.curves ?? ALL_ALL_CURVES) : ALL_ALL_CURVES;
        return { col1Items: REGION_LIST, col2Items, curves };
      }
      case '12': {
        if (creditSubTab === '18') {
          const curves = col2 ? CREDIT_SECTOR_CURVES.filter((_, i) => i < 20) : CREDIT_SECTOR_CURVES;
          return { col1Items: CREDIT_SECTORS, col2Items: CREDIT_RATINGS, curves };
        }
        return { col1Items: CREDIT_SECTORS, col2Items: null, curves: CREDIT_SECTOR_CURVES };
      }
      case '13': {
        const col2Items = col1 === '42' ? MM_G7_COUNTRIES : null;
        const curves = col2Items ? (col2Items.find(c => String(c.num) === col2)?.curves ?? MM_G7_CANADA) : MM_G7_CANADA;
        return { col1Items: REGION_LIST, col2Items, curves };
      }
      case '14': {
        const col2Items = col1 === '42' ? MUNI_US_SUBTYPES.map(s => ({ ...s, curves: MUNI_US_ALL_CURVES } as CrvfCountry)) : null;
        return { col1Items: MUNI_REGIONS, col2Items, curves: MUNI_US_ALL_CURVES };
      }
      case '15': {
        const col2Items = col1 === '42' ? FX_G7_COUNTRIES : null;
        const curves = col2Items ? (col2Items.find(c => String(c.num) === col2)?.curves ?? FX_G7_ALL_CURVES) : FX_G7_ALL_CURVES;
        return { col1Items: REGION_LIST, col2Items, curves };
      }
      default:
        return { col1Items: REGION_LIST, col2Items: null, curves: ALL_ALL_CURVES };
    }
  };

  const { col1Items, col2Items, curves } = getColumns();
  const filteredCurves = searchText ? curves.filter(c => c.name.includes(searchText) || c.id.includes(searchText)) : curves;

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono overflow-hidden">
      {/* 顶部命令栏 */}
      <div className="flex items-center justify-between bg-black border-b border-[#1c4d8f] px-2 py-1 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          {onBack && <button type="button" onClick={onBack} className="text-[#4a90e2] hover:text-white" aria-label="返回收益曲线菜单">←</button>}
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#10243f] border border-[#1c4d8f] text-white">主权债收益率曲线检索</span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#10243f] border border-[#1c4d8f] text-white">CRVF</span>
          <div className="relative" ref={funcRef}>
            <button onClick={() => setFuncMenuOpen(v => !v)} className="flex items-center gap-1 px-2 py-0.5 text-[#4a90e2] hover:text-white">
              相关功能目录 <ChevronDown className="w-3 h-3" />
            </button>
            {funcMenuOpen && (
              <div className="absolute left-0 top-full z-50 w-48 bg-[#0a0a0a] border border-[#1c4d8f] py-1">
                {[
                  { f: 'GC 绘制曲线图', act: () => { setFuncMenuOpen(false); handleGo(); } },
                  { f: 'FWCV 远期曲线分析', act: () => { setWorkflow('forward'); setFuncMenuOpen(false); } },
                  { f: 'ICVS 曲线利差计算', act: () => { setWorkflow('spread'); setFuncMenuOpen(false); } },
                  { f: 'YCDF 现金曲线设定', act: () => { setWorkflow('cash'); setFuncMenuOpen(false); } },
                ].map(({ f, act }) => (
                  <button key={f} onClick={act} className="block w-full px-3 py-1 text-left text-xs text-[#f5a623] hover:bg-[#1a2540]">{f}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#4a90e2]">
          <button onClick={onClose} className="text-[#888] hover:text-white ml-2" aria-label="关闭曲线检索"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-1 px-3 py-1 bg-[#7a1010] border-b border-[#5a0d0d] text-xs shrink-0">
        <button onClick={() => setView('classic')}
          className={cn('flex items-center gap-1 px-2 py-0.5', view === 'classic' ? 'bg-[#f5a623] text-black' : 'text-[#f5a623] hover:text-white')}>
          <Search className="w-3 h-3" />查找曲线
        </button>
        <button onClick={() => setView('rv')}
          className={cn('flex items-center gap-1 px-2 py-0.5', view === 'rv' ? 'bg-[#f5a623] text-black' : 'text-[#f5a623] hover:text-white')}>
          <BarChart3 className="w-3 h-3" />相对价值筛选器
        </button>
      </div>

      {view === 'rv' ? (
        <RelativeValueView curves={filteredCurves.length > 0 ? filteredCurves : ALL_ALL_CURVES} selected={selected} onGo={onGo} />
      ) : (
        <>
          {/* 命令输入条 */}
          <div className="px-2 py-1 bg-black shrink-0">
            <div className="flex items-center">
              <span className="text-[#4a90e2] text-xs mr-1">▶</span>
              <input value={searchText} onChange={e => setSearchText(e.target.value)}
                className="h-6 flex-1 max-w-2xl border border-[#1c4d8f] bg-[#0a1830] text-white text-xs px-2 focus:outline-none"
                placeholder="输入关键词或曲线ID搜索..." />
            </div>
          </div>

          {/* 红色标题栏 */}
          <div className="flex items-center justify-between border-y border-[#5a0d0d] bg-gradient-to-r from-[#1a0606] to-[#7a1010] px-3 py-1 shrink-0">
            <button onClick={handleGo} className="text-white text-sm font-semibold hover:text-[#f5a623]">1&lt;GO&gt;绘制所选曲线 ({selected.length})</button>
            <div className="relative" ref={setMenuRef}>
              <button onClick={() => setSetMenuOpen(v => !v)} className="text-white text-xs hover:text-[#f5a623] flex items-center gap-1">
                <span className="text-[#888]">⊞</span> 2) 设定 <ChevronDown className="w-3 h-3" />
              </button>
              {setMenuOpen && (
                <div className="absolute right-0 top-full z-50 w-44 bg-[#0a0a0a] border border-[#1c4d8f] py-1">
                  <button onClick={handleExportSelected} className="block w-full px-3 py-1 text-left text-xs text-[#f5a623] hover:bg-[#1a2540]">导出已选曲线 CSV</button>
                  <button onClick={() => { setSelected([]); setSetMenuOpen(false); toast.success('已清空已选列表'); }} className="block w-full px-3 py-1 text-left text-xs text-[#f5a623] hover:bg-[#1a2540]">清空已选曲线</button>
                  <button onClick={() => { setMode(mode === 'multi' ? 'single' : 'multi'); setSetMenuOpen(false); }} className="block w-full px-3 py-1 text-left text-xs text-[#f5a623] hover:bg-[#1a2540]">切换为{mode === 'multi' ? '单一' : '多重'}曲线</button>
                </div>
              )}
            </div>
          </div>

          {workflow && <CurveWorkflowWorkbench workflow={workflow} selected={selected} onClose={() => setWorkflow(null)} />}

          {/* 主体 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-3 pt-2 pb-1 shrink-0">
              <div className="flex items-center gap-6 mb-2">
                <button onClick={() => setMode('single')} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('w-3 h-3 rounded-full border-2 flex items-center justify-center', mode === 'single' ? 'border-white' : 'border-[#555]')}>
                    {mode === 'single' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-[#ccc]">单一曲线</span>
                </button>
                <button onClick={() => setMode('multi')} className="flex items-center gap-1.5 text-xs">
                  <span className={cn('w-3 h-3 rounded-full border-2 flex items-center justify-center', mode === 'multi' ? 'border-[#4a90e2]' : 'border-[#555]')}>
                    {mode === 'multi' && <span className="w-1.5 h-1.5 rounded-full bg-[#4a90e2]" />}
                  </span>
                  <span className="text-[#4a90e2] font-semibold">多重曲线</span>
                </button>
              </div>

              <div className="flex items-center gap-0 border-b border-[#333]">
                {MAIN_TABS.map(tab => (
                  <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                    className={cn('px-3 py-1 text-xs whitespace-nowrap border-r border-[#333]',
                      activeTab === tab.id ? 'bg-[#1c4d8f] text-white' : 'bg-[#111] text-[#f5a623] hover:bg-[#1a2540]')}>
                    {tab.id}) {tab.name}
                  </button>
                ))}
              </div>

              {activeTab === '12' && (
                <div className="flex items-center gap-0 border-b border-[#333]">
                  {CREDIT_SUB_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setCreditSubTab(tab.id)}
                      className={cn('px-3 py-0.5 text-xs whitespace-nowrap border-r border-[#333]',
                        creditSubTab === tab.id ? 'bg-[#1c4d8f] text-white' : 'bg-[#0a0a0a] text-[#f5a623] hover:bg-[#1a2540]')}>
                      {tab.id}) {tab.name}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === '16' && (
                <div className="flex items-center gap-0 border-b border-[#333]">
                  {CUSTOM_SUB_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setCustomSubTab(tab.id)}
                      className={cn('px-3 py-0.5 text-xs whitespace-nowrap border-r border-[#333]',
                        customSubTab === tab.id ? 'bg-[#1c4d8f] text-white' : 'bg-[#0a0a0a] text-[#f5a623] hover:bg-[#1a2540]')}>
                      {tab.id}) {tab.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === '16' ? (
              <div className="flex-1 overflow-auto px-3 pb-2">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] text-xs text-[#f5a623] border-b border-[#333] py-1">
                  <span>名称</span><span>国家/地区</span>
                  <span className="flex items-center gap-1">类型
                    <div className="relative" ref={customTypeRef}>
                      <button onClick={() => setCustomTypeOpen(v => !v)} className="flex items-center gap-0.5 text-[#f5a623] hover:text-white"><ChevronDown className="w-3 h-3" /></button>
                      {customTypeOpen && (
                        <div className="absolute left-0 top-full z-50 w-40 bg-[#0a0a0a] border border-[#333] py-1">
                          {CUSTOM_TYPE_OPTIONS.map(opt => (
                            <button key={opt.value} onClick={() => { setCustomTypeFilter(opt.value); setCustomTypeOpen(false); }}
                              className={cn('block w-full px-3 py-1 text-left text-xs', customTypeFilter === opt.value ? 'bg-[#1c4d8f] text-white' : 'text-[#f5a623] hover:bg-[#1a2540]')}>
                              {Number(opt.value) + 1} {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </span>
                  <span>状态</span><span>修改</span><span>最近查阅</span>
                </div>
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] text-xs py-1 bg-[#f5a623]/20">
                  <span className="px-1 text-[#f5a623]">（创建自设曲线）</span>
                  <span /><span className="px-1 text-[#f5a623]">{CUSTOM_TYPE_OPTIONS.find(o => o.value === customTypeFilter)?.label ?? '全部'}</span>
                  <span /><span /><span />
                </div>
                <div className="text-[#555] text-xs py-8 text-center">暂无自设曲线数据，可在「相对价值筛选器」中将曲线加入监控清单</div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-hidden flex gap-0">
                  <div className="w-[200px] shrink-0 overflow-y-auto border-r border-[#222]">
                    {col1Items.map(item => (
                      <button key={item.num} onClick={() => { setCol1(String(item.num)); setCol2(null); }}
                        className={cn('flex items-center justify-between w-full px-3 py-0.5 text-left text-xs',
                          col1 === String(item.num) ? 'bg-[#1c4d8f] text-white' : 'text-[#f5a623] hover:bg-[#111]')}>
                        <span>{item.num}) {item.name}</span>
                        {col2Items && <ChevronRight className="w-3 h-3 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  {col2Items && (
                    <div className="w-[200px] shrink-0 overflow-y-auto border-r border-[#222]">
                      {col2Items.map(item => (
                        <button key={item.num} onClick={() => setCol2(String(item.num))}
                          className={cn('flex items-center justify-between w-full px-3 py-0.5 text-left text-xs',
                            col2 === String(item.num) ? 'bg-[#1c4d8f] text-white' : 'text-[#f5a623] hover:bg-[#111]')}>
                          <span>{item.num}) {item.name}</span>
                          <ChevronRight className="w-3 h-3 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between px-3 py-1 border-b border-[#222] bg-[#0a0a0a] sticky top-0">
                      <span className="text-[#f5a623] text-xs font-semibold">曲线 ({filteredCurves.length})</span>
                      <span className="text-[#f5a623] text-xs">曲线ID</span>
                    </div>
                    {filteredCurves.map(curve => (
                      <button key={curve.id} onClick={() => addCurve(curve)}
                        className="flex items-center justify-between w-full px-3 py-0.5 text-left text-xs hover:bg-[#1a2540] group">
                        <span className="text-[#f5a623] truncate flex-1 mr-2 group-hover:text-white">{curve.num}) {curve.name}</span>
                        <span className="text-[#f5a623] shrink-0 text-[10px] group-hover:text-white">{curve.id}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 border-t border-[#333]">
                  <div className="grid grid-cols-[2fr_80px_80px_120px_80px_24px] text-xs text-[#f5a623] bg-[#0a0a0a] px-3 py-1 border-b border-[#222]">
                    <span>选定的曲线</span><span>国家/地区</span><span>货币</span><span>类型</span><span>曲线ID</span><span />
                  </div>
                  <div className="max-h-24 overflow-y-auto">
                    {selected.length === 0 ? (
                      <div className="text-[#555] text-xs py-3 text-center">点击上方曲线添加到已选列表</div>
                    ) : selected.map(s => (
                      <div key={s.id} className="grid grid-cols-[2fr_80px_80px_120px_80px_24px] text-xs px-3 py-0.5 hover:bg-[#111] items-center">
                        <span className="text-[#f5a623] truncate">{s.num}) {s.name}</span>
                        <span className="text-[#f5a623]">{s.country}</span>
                        <span className="text-[#f5a623]">{s.currency}</span>
                        <span className="text-[#f5a623]">{s.type}</span>
                        <span className="text-[#f5a623]">{s.id}</span>
                        <button onClick={() => removeCurve(s.id)} className="text-[#c05050] hover:text-red-400 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 px-3 py-1.5 border-t border-[#222] bg-black shrink-0">
            <button onClick={handleGo} className="text-[#4a90e2] text-xs hover:text-white hover:underline flex items-center gap-1">
              <LineChartIcon className="w-3 h-3" /> 1) 绘制所选曲线 | GC »
            </button>
            <button onClick={() => setView('rv')} className="text-[#4a90e2] text-xs hover:text-white hover:underline flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> 相对价值分析 »
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 相对价值筛选器视图
// ════════════════════════════════════════════════════════════════════════════
function RelativeValueView({ curves, selected, onGo }: { curves: CrvfCurve[]; selected: SelectedCurve[]; onGo?: (c: SelectedCurve[]) => void }) {
  const { isAuthenticated } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>('richCheapBp');
  const [desc, setDesc] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>(() => curves.slice(0, 3).map(c => c.id));

  const pool = useMemo(() => curves.slice(0, 40), [curves]);
  const ranked = useMemo(() => rankCurves(pool, sortKey, desc), [pool, sortKey, desc]);

  // 监控清单（数据库持久化）
  const utils = trpc.useUtils();
  const watchQuery = trpc.crvfWatchlist.list.useQuery(undefined, { enabled: isAuthenticated });
  const addWatch = trpc.crvfWatchlist.add.useMutation({
    onSuccess: () => { utils.crvfWatchlist.list.invalidate(); toast.success('已加入监控清单'); },
    onError: () => toast.error('加入失败，请先登录'),
  });
  const removeWatch = trpc.crvfWatchlist.remove.useMutation({
    onSuccess: () => { utils.crvfWatchlist.list.invalidate(); toast.success('已移出监控清单'); },
  });
  const watchedIds = new Set((watchQuery.data ?? []).map(w => w.curveId));

  const toggleCompare = (id: string) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 5 ? (toast.error('最多对比 5 条'), prev) : [...prev, id]);
  };

  const toggleWatch = (m: CurveMetrics) => {
    if (!isAuthenticated) { toast.error('请先登录后再使用监控清单'); return; }
    if (watchedIds.has(m.id)) removeWatch.mutate({ curveId: m.id });
    else addWatch.mutate({ curveId: m.id, curveName: m.name });
  };

  const tenors = compareTenors();
  const compareCurves = pool.filter(c => compareIds.includes(c.id));
  const compareChart = useMemo(() => {
    return tenors.map(t => {
      const row: Record<string, string | number> = { tenor: t };
      compareCurves.forEach(c => { row[c.id] = curveTenorValues(c).find(v => v.tenor === t)?.value ?? 0; });
      return row;
    });
  }, [compareCurves, tenors]);
  const COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa'];

  return (
    <div className="flex-1 overflow-auto p-3 space-y-3 text-xs">
      {/* 说明 */}
      <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
        <div className="text-[#f5a623] font-semibold mb-1 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />相对价值筛选器 · 主权债曲线</div>
        <div className="text-[#7a8a9a] leading-relaxed">
          对检索结果按 <span className="text-[#aaa]">收益率/利差/久期/凸性</span> 排序，
          结合模型公允利差给出 <span className="text-[#4ade80]">便宜</span>/<span className="text-[#9aa5b1]">合理</span>/<span className="text-[#f87171]">偏贵</span> 标签；
          支持多曲线<span className="text-[#aaa]">并排对比</span>，并可将关注曲线加入<span className="text-[#aaa]">监控清单</span>（登录后持久化保存）。
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* ① 排行榜 */}
        <div className="col-span-2 bg-[#0a0f1a] border border-[#1c2a40] p-2">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-[#f5a623] font-semibold">① 相对价值排行榜（Top {Math.min(ranked.length, 40)}）</span>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[#888]">排序:</span>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                className="bg-[#1a2540] text-[#f5a623] border border-[#1c4d8f] px-2 py-0.5 focus:outline-none">
                {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <button onClick={() => setDesc(d => !d)} className="flex items-center gap-0.5 text-[#4a90e2] hover:text-white px-1">
                <ArrowUpDown className="w-3 h-3" />{desc ? '降序' : '升序'}
              </button>
            </div>
          </div>
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-[#0a0f1a]">
                <tr className="text-[#888] border-b border-[#1c2a40]">
                  <th className="text-left px-1 py-1">#</th>
                  <th className="text-left px-1 py-1">曲线</th>
                  <th className="text-center px-1">评级</th>
                  <th className="text-right px-1">YTM%</th>
                  <th className="text-right px-1">利差bp</th>
                  <th className="text-right px-1">久期</th>
                  <th className="text-right px-1">便宜度bp</th>
                  <th className="text-center px-1">估值</th>
                  <th className="text-center px-1">对比</th>
                  <th className="text-center px-1">监控</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((m, i) => (
                  <tr key={m.id} className="border-b border-[#111] hover:bg-[#10243f]">
                    <td className="px-1 py-0.5 text-[#666]">{i + 1}</td>
                    <td className="px-1 py-0.5 text-[#ccc] truncate max-w-[160px]" title={m.name}>{m.name}</td>
                    <td className="px-1 text-center text-[#aaa]">{m.rating}</td>
                    <td className="px-1 text-right text-[#f5a623]">{m.ytm.toFixed(2)}</td>
                    <td className="px-1 text-right text-[#aaa]">{m.spreadBp}</td>
                    <td className="px-1 text-right text-[#60a5fa]">{m.modDuration}</td>
                    <td className="px-1 text-right" style={{ color: m.richCheapBp >= 0 ? '#4ade80' : '#f87171' }}>{m.richCheapBp > 0 ? '+' : ''}{m.richCheapBp}</td>
                    <td className="px-1 text-center"><span style={{ color: VALUATION_COLOR[m.valuation] }}>{VALUATION_LABEL[m.valuation]}</span></td>
                    <td className="px-1 text-center">
                      <input type="checkbox" checked={compareIds.includes(m.id)} onChange={() => toggleCompare(m.id)} className="w-3 h-3" />
                    </td>
                    <td className="px-1 text-center">
                      <button onClick={() => toggleWatch(m)} className="hover:scale-110 transition-transform">
                        <Star className="w-3.5 h-3.5" fill={watchedIds.has(m.id) ? '#f5a623' : 'none'} stroke={watchedIds.has(m.id) ? '#f5a623' : '#888'} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[#666] text-[10px] mt-1">便宜度 = 实际利差 − 模型公允利差；正值代表相对便宜（收益率补偿更高）。</div>
        </div>

        {/* ③ 监控清单 */}
        <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
          <div className="text-[#f5a623] font-semibold mb-2 flex items-center gap-1"><Star className="w-3.5 h-3.5" />③ 我的监控清单</div>
          {!isAuthenticated ? (
            <div className="text-[#888] text-[10px] py-4 text-center">登录后可保存监控清单</div>
          ) : watchQuery.isLoading ? (
            <DataLoadingSkeleton variant="list" rows={3} label="正在加载曲线监控清单" className="p-2" />
          ) : (watchQuery.data ?? []).length === 0 ? (
            <div className="text-[#888] text-[10px] py-4 text-center">点击排行榜中的 ★ 加入监控</div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {(watchQuery.data ?? []).map(w => (
                <div key={w.curveId} className="flex items-center justify-between gap-1 bg-[#10243f] px-2 py-1 rounded">
                  <span className="text-[#ccc] text-[10px] truncate flex-1" title={w.curveName ?? undefined}>{w.curveName}</span>
                  <span className="text-[#666] text-[9px]">{w.curveId}</span>
                  <button onClick={() => removeWatch.mutate({ curveId: w.curveId })} className="text-[#c05050] hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ② 曲线对比表 + 图 */}
      <div className="bg-[#0a0f1a] border border-[#1c2a40] p-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#f5a623] font-semibold">② 曲线对比（{compareCurves.length} 条）</span>
          {onGo && compareCurves.length > 0 && (
            <button onClick={() => { onGo(compareCurves.map((c, i) => ({ num: i + 21, name: c.name, country: '', currency: '', type: '', id: c.id }))); toast.success('已发送到 GC 绘图'); }}
              className="flex items-center gap-1 px-2 py-0.5 text-[#4a90e2] border border-[#1c4d8f] hover:bg-[#1a2540]">
              <LineChartIcon className="w-3 h-3" />发送到 GC 绘图
            </button>
          )}
        </div>
        {compareCurves.length === 0 ? (
          <div className="text-[#888] text-[10px] py-6 text-center">在排行榜中勾选曲线进行对比</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="overflow-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[#888] border-b border-[#1c2a40]">
                    <th className="text-left px-1 py-1">曲线</th>
                    {tenors.map(t => <th key={t} className="text-right px-1">{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {compareCurves.map((c, i) => {
                    const vals = curveTenorValues(c);
                    return (
                      <tr key={c.id} className="border-b border-[#111]">
                        <td className="px-1 py-0.5 truncate max-w-[120px]" style={{ color: COLORS[i % COLORS.length] }} title={c.name}>■ {c.id}</td>
                        {tenors.map(t => <td key={t} className="px-1 text-right text-[#aaa]">{vals.find(v => v.tenor === t)?.value.toFixed(2)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={compareChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
                <XAxis dataKey="tenor" tick={{ fill: '#888', fontSize: 10 }} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1c4d8f', fontSize: 11 }} labelStyle={{ color: '#f5a623' }} formatter={(v: number) => `${v.toFixed(3)}%`} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                {compareCurves.map((c, i) => <Line key={c.id} type="monotone" dataKey={c.id} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={{ r: 2 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Injected Visualization: 信用市场资金流向与利差联动仪 =====
import { AreaChart as _AC_crvf, Area as _A_crvf, ComposedChart as _CC_crvf, Bar as _B_crvf, Line as _L_crvf, XAxis as _XA_crvf, YAxis as _YA_crvf, CartesianGrid as _CG_crvf, Tooltip as _TT_crvf, ResponsiveContainer as _RC_crvf } from 'recharts';

export function VizPanel_crvf() {
  const [tab, setTab] = React.useState(0);
  const data = [{name:"W1",v1:2.8,v2:-1.2},{name:"W2",v1:5.2,v2:2.5},{name:"W3",v1:-1.5,v2:-3.8},{name:"W4",v1:8.5,v2:5.2},{name:"W5",v1:3.2,v2:1.8},{name:"W6",v1:-2.8,v2:-4.5},{name:"W7",v1:6.8,v2:4.2},{name:"W8",v1:4.5,v2:2.8}];
  const clr = "#6ee7b7";
  return (
    <div className="mt-6 p-4 bg-[#0d1117] rounded-lg border border-[#21262d]">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{backgroundColor: clr}}></div>
        <h3 className="text-sm font-semibold" style={{color: clr}}>信用市场资金流向与利差联动仪</h3>
      </div>
      <div className="flex gap-2 mb-3">
        {['趋势分析','分布统计','投资信号'].map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} className={`px-3 py-1 text-xs rounded-full transition-colors ${tab===i?'bg-[#1f6feb] text-white':'bg-[#21262d] text-gray-400 hover:text-gray-200'}`}>{t}</button>
        ))}
      </div>
      {tab===0&&(<div style={{height:180}}><_RC_crvf width="100%" height="100%"><_AC_crvf data={data} margin={{top:5,right:10,left:-20,bottom:0}}><defs><linearGradient id="g_crvf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={clr} stopOpacity={0.3}/><stop offset="95%" stopColor={clr} stopOpacity={0}/></linearGradient></defs><_CG_crvf strokeDasharray="3 3" stroke="#21262d"/><_XA_crvf dataKey="name" tick={{fill:"#8b949e",fontSize:10}}/><_YA_crvf tick={{fill:"#8b949e",fontSize:10}}/><_TT_crvf contentStyle={{backgroundColor:"#161b22",border:"1px solid #30363d",borderRadius:"6px",fontSize:"11px"}}/><_A_crvf type="monotone" dataKey="v1" stroke={clr} fill="url(#g_crvf)" strokeWidth={2}/></_AC_crvf></_RC_crvf></div>)}
      {tab===1&&(<div style={{height:180}}><_RC_crvf width="100%" height="100%"><_CC_crvf data={data} margin={{top:5,right:10,left:-20,bottom:0}}><_CG_crvf strokeDasharray="3 3" stroke="#21262d"/><_XA_crvf dataKey="name" tick={{fill:"#8b949e",fontSize:10}}/><_YA_crvf tick={{fill:"#8b949e",fontSize:10}}/><_TT_crvf contentStyle={{backgroundColor:"#161b22",border:"1px solid #30363d",borderRadius:"6px",fontSize:"11px"}}/><_B_crvf dataKey="v1" fill={clr} opacity={0.8} radius={[2,2,0,0]}/><_L_crvf type="monotone" dataKey="v2" stroke="#f0883e" strokeWidth={2} dot={false}/></_CC_crvf></_RC_crvf></div>)}
      {tab===2&&(<div className="grid grid-cols-4 gap-2">{data.slice(0,8).map((d,i)=>(<div key={i} className="bg-[#161b22] rounded p-2 text-center"><div className="text-xs text-gray-500 truncate">{d.name}</div><div className="text-sm font-bold mt-1" style={{color:clr}}>{Number(d.v1).toFixed(2)}</div><div className="text-xs text-gray-400">{Number(d.v2).toFixed(2)}</div></div>))}</div>)}
    </div>
  );
}
