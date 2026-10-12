import { useMemo, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, X, Save, Trash2, Calculator } from 'lucide-react';
import { NewsShell, EmptyState, StatCard, SectionTitle } from '@/components/news/NewsKit';
import { MarketRow } from '@/lib/newsEngine';
import { useChartTheme } from '@/hooks/useChartTheme';
import { num, fmtPrice, deriveIndexSeries } from '@/lib/marketDerive';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export type CIXMode = 'basket' | 'spread' | 'ratio' | 'aggregate' | 'convert' | 'expression' | 'timeseries';

const MODE_META: Record<CIXMode, { code: string; title: string; subtitle: string; accent: string; hint: string; maxLegs: number; }> = {
  basket:     { code: 'CIXB', title: '自设篮子编辑器', subtitle: 'Custom Basket Editor', accent: '#f59e0b', hint: '加权组合多个品种，构建自定义篮子指数', maxLegs: 8 },
  spread:     { code: 'CIXS', title: '自设利差编辑器', subtitle: 'Custom Spread Editor', accent: '#38bdf8', hint: '计算两品种价差 (A − B)，监控利差走势', maxLegs: 2 },
  ratio:      { code: 'CIXR', title: '自设比率编辑器', subtitle: 'Custom Ratio Editor', accent: '#22c55e', hint: '计算两品种比率 (A ÷ B)，分析相对强弱', maxLegs: 2 },
  aggregate:  { code: 'AGG',  title: '自设合并', subtitle: 'Custom Aggregate', accent: '#a78bfa', hint: '等权或加权合并多品种，生成合并指数', maxLegs: 8 },
  convert:    { code: 'CIXC', title: '自设转换编辑器', subtitle: 'Custom Conversion', accent: '#fb7185', hint: '对品种应用倍率/汇率转换后再组合', maxLegs: 4 },
  expression: { code: 'CIXN', title: '自设表达式编辑器', subtitle: 'Custom Expression', accent: '#f97316', hint: '用加权表达式自由组合多个品种', maxLegs: 8 },
  timeseries: { code: 'CIXI', title: '自设时间序列编辑器', subtitle: 'Custom Time Series', accent: '#2dd4bf', hint: '将组合结果输出为时间序列并可保存', maxLegs: 8 },
};

interface Leg { symbol: string; weight: number; }
const LS_KEY = (mode: CIXMode) => `cix-saved-${mode}`;

export default function CIXEditor({ mode }: { mode: CIXMode }) {
  const meta = MODE_META[mode];
  const { data = [] } = trpc.market.getAll.useQuery(undefined, { refetchInterval: 30000 });
  const ct = useChartTheme();
  const rows = data as unknown as MarketRow[];

  const [legs, setLegs] = useState<Leg[]>([]);
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<{ name: string; legs: Leg[] }[]>([]);

  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY(mode)); if (raw) setSaved(JSON.parse(raw)); } catch { /* ignore */ }
  }, [mode]);

  // 默认填两条腿，方便利差/比率即开即用
  useEffect(() => {
    if (rows.length >= 2 && legs.length === 0) {
      setLegs([{ symbol: rows[0].symbol, weight: 1 }, { symbol: rows[1].symbol, weight: mode === 'spread' ? -1 : 1 }]);
    }
  }, [rows, legs.length, mode]);

  const addLeg = (symbol: string) => {
    if (legs.find(l => l.symbol === symbol)) { toast.info('该品种已在组合中'); return; }
    if (legs.length >= meta.maxLegs) { toast.error(`最多 ${meta.maxLegs} 个品种`); return; }
    setLegs([...legs, { symbol, weight: 1 }]);
    setPick('');
  };
  const removeLeg = (symbol: string) => setLegs(legs.filter(l => l.symbol !== symbol));
  const setWeight = (symbol: string, w: number) => setLegs(legs.map(l => l.symbol === symbol ? { ...l, weight: w } : l));

  // 计算组合结果序列（确定性）
  const result = useMemo(() => {
    if (!legs.length) return { series: [] as { label: string; value: number }[], current: 0, label: '' };
    const seriesByLeg = legs.map(l => {
      const r = rows.find(x => x.symbol === l.symbol);
      return r ? deriveIndexSeries(r, 60) : [];
    });
    const len = Math.min(...seriesByLeg.map(s => s.length).filter(Boolean), 60) || 0;
    const out: { label: string; value: number }[] = [];
    for (let i = 0; i < len; i++) {
      let v = 0;
      if (mode === 'ratio') {
        const a = seriesByLeg[0]?.[i]?.value ?? 1;
        const b = seriesByLeg[1]?.[i]?.value ?? 1;
        v = b !== 0 ? a / b : 0;
      } else {
        v = legs.reduce((s, l, idx) => s + (seriesByLeg[idx]?.[i]?.value ?? 0) * l.weight, 0);
        if (mode === 'aggregate') v /= legs.length;
      }
      out.push({ label: seriesByLeg[0]?.[i]?.label ?? `${i}`, value: Number(v.toFixed(4)) });
    }
    const current = out.length ? out[out.length - 1].value : 0;
    const expr = mode === 'ratio'
      ? `${legs[0]?.symbol} ÷ ${legs[1]?.symbol}`
      : legs.map(l => `${l.weight >= 0 ? '+' : ''}${l.weight}·${l.symbol}`).join(' ');
    return { series: out, current, label: expr };
  }, [legs, rows, mode]);

  const change = useMemo(() => {
    if (result.series.length < 2) return 0;
    const first = result.series[0].value, last = result.series[result.series.length - 1].value;
    return first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  }, [result]);

  const persist = (next: { name: string; legs: Leg[] }[]) => {
    setSaved(next);
    try { localStorage.setItem(LS_KEY(mode), JSON.stringify(next)); } catch { /* ignore */ }
  };
  const save = () => {
    const nm = name.trim() || `${meta.code}-${saved.length + 1}`;
    persist([{ name: nm, legs }, ...saved.filter(s => s.name !== nm)]);
    setName('');
    toast.success(`已保存自设指数「${nm}」`);
  };
  const load = (s: { name: string; legs: Leg[] }) => { setLegs(s.legs); toast.info(`已载入「${s.name}」`); };
  const del = (nm: string) => persist(saved.filter(s => s.name !== nm));

  const filtered = useMemo(() => {
    const kw = pick.trim().toLowerCase();
    return kw ? rows.filter(r => r.symbol.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw)).slice(0, 8) : [];
  }, [rows, pick]);

  if (rows.length === 0) return <NewsShell code={meta.code} title={meta.title} accent={meta.accent}><EmptyState /></NewsShell>;

  return (
    <NewsShell code={meta.code} title={meta.title} subtitle={meta.subtitle} accent={meta.accent}
      icon={<Calculator className="w-4 h-4" style={{ color: meta.accent }} />}>
      <div className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2 mb-4 text-xs text-muted-foreground">{meta.hint}</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatCard label="当前指数值" value={<span className="font-mono">{fmtPrice(result.current)}</span>} accent={meta.accent} />
        <StatCard label="区间变动" value={<span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>} />
        <StatCard label="组合腿数" value={legs.length} sub={<span className="text-muted-foreground">上限 {meta.maxLegs}</span>} />
        <StatCard label="已保存" value={saved.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-card/40 rounded-lg border border-border p-3">
          <SectionTitle accent={meta.accent}>组合构建器</SectionTitle>
          <div className="relative mb-2">
            <Input value={pick} onChange={e => setPick(e.target.value)} placeholder="搜索品种加入组合…" className="h-8 text-xs" />
            {filtered.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                {filtered.map(r => (
                  <button key={r.symbol} onClick={() => addLeg(r.symbol)} className="w-full flex items-center justify-between text-xs px-2 py-1.5 hover:bg-accent/10">
                    <span className="font-mono">{r.symbol}</span><span className="text-muted-foreground truncate ml-2"><Plus className="w-3 h-3 inline" /> {r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5 max-h-[260px] overflow-auto">
            {legs.map(l => {
              const r = rows.find(x => x.symbol === l.symbol);
              return (
                <div key={l.symbol} className="flex items-center gap-2 text-xs bg-background/40 rounded px-2 py-1.5">
                  <span className="font-mono flex-1 truncate">{l.symbol}</span>
                  {mode !== 'ratio' && (
                    <input type="number" step="0.1" value={l.weight} onChange={e => setWeight(l.symbol, Number(e.target.value))}
                      className="w-16 bg-background border border-border rounded px-1 py-0.5 text-right font-mono" />
                  )}
                  <span className="font-mono text-muted-foreground w-16 text-right">{fmtPrice(r?.price)}</span>
                  <button onClick={() => removeLeg(l.symbol)} className="text-muted-foreground hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
            {legs.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">搜索并加入品种以构建组合</div>}
          </div>
          <div className="flex gap-2 mt-3">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="命名后保存…" className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={save} disabled={!legs.length}><Save className="w-3.5 h-3.5 mr-1" />保存</Button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card/40 rounded-lg border border-border p-3">
          <SectionTitle accent={meta.accent}>结果序列 · <span className="font-mono text-xs">{result.label}</span></SectionTitle>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.series} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: ct.axis, fontSize: 9 }} interval={9} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: ct.axis, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: ct.tooltip.background, border: `1px solid ${ct.tooltip.border}`, color: ct.tooltip.text, fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke={meta.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {saved.length > 0 && (
        <div className="bg-card/40 rounded-lg border border-border p-3">
          <SectionTitle accent={meta.accent}>已保存的自设指数</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {saved.map(s => (
              <div key={s.name} className="flex items-center gap-2 text-xs bg-background/50 border border-border rounded-full pl-3 pr-1.5 py-1">
                <button onClick={() => load(s)} className="hover:text-accent">{s.name} <span className="text-muted-foreground">({s.legs.length})</span></button>
                <button onClick={() => del(s.name)} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </NewsShell>
  );
}
