/**
 * 佑诚数据模块渲染器 —— 前端与管理后台共用的唯一实现。
 * 后台预览与前端显示调用同一个组件、同一份配置，交互完全一致；
 * mode="admin" 只在外层多一个“预览”标识，不改变任何交互。
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Brush,
} from 'recharts';
import { ArrowDownUp, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import type { UcPublishedModule } from '@shared/ucheerModules';

type Row = Record<string, string | number | null>;
type Field = UcPublishedModule['fields'][number];

export const UC_PALETTE = ['#2dd4bf', '#f59e0b', '#60a5fa', '#f472b6', '#a3e635', '#c084fc', '#fb923c', '#38bdf8'];
import LiveBoard from './market/LiveBoard';
import KlineChart from './market/KlineChart';
import type { Period } from './market/live';

const UP = '#ef4444';
const DOWN = '#22c55e';

/* ------------------------------------------------------------------ 格式 */

function fieldOf(m: UcPublishedModule, name?: string): Field | undefined {
  return m.fields.find((f) => f.name === name);
}
function labelOf(m: UcPublishedModule, name?: string) {
  return fieldOf(m, name)?.label ?? name ?? '';
}
export function formatValue(v: unknown, field: Field | undefined, decimals: number, unit = ''): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number' && field && (field.type === 'number' || field.type === 'percent')) {
    const abs = Math.abs(v);
    const s = abs >= 1e12 ? `${(v / 1e12).toFixed(2)}万亿` : abs >= 1e8 ? `${(v / 1e8).toFixed(2)}亿` : abs >= 1e5 ? `${(v / 1e4).toFixed(2)}万` : v.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return field.type === 'percent' ? `${s}%` : `${s}${unit}`;
  }
  return String(v);
}

function exportCsv(m: UcPublishedModule, rows: Row[]) {
  const cols = m.fields;
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const text = [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(r[c.name])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${m.params.title || m.name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ 公共外框 */

const RANGES = [
  { key: '1M', label: '1月', days: 31 },
  { key: '3M', label: '3月', days: 93 },
  { key: '1Y', label: '1年', days: 366 },
  { key: '5Y', label: '5年', days: 366 * 5 },
  { key: 'ALL', label: '全部', days: 0 },
] as const;

function filterRange(rows: Row[], xField: string | undefined, range: string): Row[] {
  const def = RANGES.find((r) => r.key === range);
  if (!xField || !def || !def.days || !rows.length) return rows;
  const last = String(rows[rows.length - 1][xField] ?? '').slice(0, 10);
  const lastTime = Date.parse(last);
  if (!Number.isFinite(lastTime)) return rows;
  const from = lastTime - def.days * 86400000;
  return rows.filter((r) => Date.parse(String(r[xField] ?? '').slice(0, 10)) >= from);
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}
function ToolButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] transition-colors ${active ? 'border-teal-400/60 bg-teal-400/15 text-teal-200' : 'border-white/10 text-slate-400 hover:border-teal-400/40 hover:text-teal-200'}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ 渲染器 */

export function ModuleRenderer({ module, mode = 'frontend', onInteract }: { module: UcPublishedModule; mode?: 'frontend' | 'admin'; onInteract?: (event: 'interact' | 'export') => void }) {
  const m = module;
  const p = m.params;
  const isDateX = fieldOf(m, m.bindings.x)?.type === 'date';
  const [range, setRange] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    let out = m.rows as Row[];
    if (isDateX && p.allowRange) out = filterRange(out, m.bindings.x, range);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)));
    }
    return out;
  }, [m.rows, isDateX, p.allowRange, m.bindings.x, range, query]);
  const interact = (fn: () => void) => () => { fn(); onInteract?.('interact'); };
  const showSearch = p.allowSearch && (m.template === 'table' || m.template === 'newsList' || m.template === 'calendar' || m.template === 'heatmap' || m.template === 'statCard');
  const showRange = p.allowRange && isDateX && (m.template === 'line' || m.template === 'kline' || m.template === 'bar');

  return (
    <section className="uc-module overflow-hidden rounded-xl border border-teal-500/15 bg-[#0a1214] shadow-[0_0_0_1px_rgba(45,212,191,0.03)]" data-uc-module={m.code}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 bg-gradient-to-r from-teal-500/[0.07] to-transparent px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-teal-400" />
            <h3 className="truncate text-sm font-semibold text-slate-100">{p.title || m.name}</h3>
            {mode === 'admin' && <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 text-[10px] text-amber-200">后台预览 · 与前端一致</span>}
          </div>
          {p.subtitle && <p className="mt-0.5 truncate pl-3 text-[11px] text-slate-500">{p.subtitle}</p>}
        </div>
        <Toolbar>
          {showRange && RANGES.map((r) => <ToolButton key={r.key} active={range === r.key} onClick={interact(() => setRange(r.key))}>{r.label}</ToolButton>)}
          {showSearch && (
            <label className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 px-1.5 text-slate-400 focus-within:border-teal-400/50">
              <Search className="h-3 w-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="筛选" className="w-24 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600" />
            </label>
          )}
          {p.allowExport && <ToolButton title="导出 CSV" onClick={() => { exportCsv(m, rows); onInteract?.('export'); }}><Download className="h-3 w-3" />导出</ToolButton>}
        </Toolbar>
      </header>
      <div className="p-3">
        {rows.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-slate-500">{query ? '没有匹配的记录' : '暂无数据'}</div>
        ) : (
          <TemplateBody module={m} rows={rows} onInteract={() => onInteract?.('interact')} />
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-white/5 px-3 py-1.5 text-[10px] text-slate-600">
        <span>{rows.length.toLocaleString()} 条</span>
        <span>更新于 {new Date(m.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </footer>
    </section>
  );
}

function TemplateBody({ module: m, rows, onInteract }: { module: UcPublishedModule; rows: Row[]; onInteract: () => void }) {
  switch (m.template) {
    case 'line': return <LineView m={m} rows={rows} />;
    case 'bar': return <BarView m={m} rows={rows} />;
    case 'kline': return <KlineView m={m} rows={rows} />;
    case 'yieldCurve': return <CurveView m={m} rows={rows} />;
    case 'heatmap': return <HeatmapView m={m} rows={rows} />;
    case 'statCard': return <StatView m={m} rows={rows} />;
    case 'newsList': return <NewsView m={m} rows={rows} onInteract={onInteract} />;
    case 'calendar': return <CalendarView m={m} rows={rows} />;
    case 'liveBoard': return <LiveBoard rows={rows} symbolField={m.bindings.symbol ?? m.bindings.x} nameField={m.bindings.title} period={m.params.period} />;
    default: return <TableView m={m} rows={rows} onInteract={onInteract} />;
  }
}

/* ------------------------------------------------------------------ 图表模板 */

const axisProps = { stroke: '#475569', tick: { fill: '#94a3b8', fontSize: 10 }, tickLine: false } as const;
const tooltipStyle = { background: '#071012', border: '1px solid rgba(45,212,191,0.25)', borderRadius: 8, fontSize: 11, color: '#e2e8f0' };

function seriesOf(m: UcPublishedModule): string[] {
  const s = m.bindings.series.filter((n) => m.fields.some((f) => f.name === n));
  return s.length ? s : m.fields.filter((f) => f.type === 'number' || f.type === 'percent').map((f) => f.name).slice(0, 3);
}

function LineView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const series = seriesOf(m);
  const [hidden, setHidden] = useState<string[]>([]);
  const fmt = (v: unknown, name?: string) => formatValue(v, fieldOf(m, name), m.params.decimals, m.params.unit);
  const Chart = m.params.area ? AreaChart : LineChart;
  return (
    <div style={{ height: m.params.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>{series.map((s, i) => <linearGradient key={s} id={`ucg-${m.code}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={UC_PALETTE[i % 8]} stopOpacity={0.35} /><stop offset="100%" stopColor={UC_PALETTE[i % 8]} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
          <XAxis dataKey={m.bindings.x} {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => fmt(v, series[0])} domain={['auto', 'auto']} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: string) => [fmt(v, name), labelOf(m, name)]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, cursor: 'pointer' }} formatter={(name: string) => labelOf(m, name)} onClick={(e: { dataKey?: unknown }) => { const k = String(e.dataKey); setHidden((h) => h.includes(k) ? h.filter((x) => x !== k) : [...h, k]); }} />}
          {series.map((s, i) => m.params.area
            ? <Area key={s} type="monotone" dataKey={s} hide={hidden.includes(s)} stroke={UC_PALETTE[i % 8]} fill={`url(#ucg-${m.code}-${i})`} strokeWidth={1.6} dot={false} stackId={m.params.stacked ? 'a' : undefined} connectNulls />
            : <Line key={s} type="monotone" dataKey={s} hide={hidden.includes(s)} stroke={UC_PALETTE[i % 8]} strokeWidth={1.6} dot={false} connectNulls />)}
          {rows.length > 60 && <Brush dataKey={m.bindings.x} height={18} stroke="#2dd4bf" fill="#071012" travellerWidth={8} />}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

function BarView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const series = seriesOf(m);
  const fmt = (v: unknown, name?: string) => formatValue(v, fieldOf(m, name), m.params.decimals, m.params.unit);
  return (
    <div style={{ height: m.params.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
          <XAxis dataKey={m.bindings.x} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} width={56} tickFormatter={(v) => fmt(v, series[0])} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(45,212,191,0.06)' }} formatter={(v: unknown, name: string) => [fmt(v, name), labelOf(m, name)]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} formatter={(name: string) => labelOf(m, name)} />}
          {series.map((s, i) => <Bar key={s} dataKey={s} fill={UC_PALETTE[i % 8]} radius={[3, 3, 0, 0]} stackId={m.params.stacked ? 'a' : undefined} maxBarSize={36} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function movingAverage(rows: Row[], key: string, n: number) {
  let sum = 0;
  return rows.map((r, i) => {
    sum += Number(r[key] ?? 0);
    if (i >= n) sum -= Number(rows[i - n][key] ?? 0);
    return i >= n - 1 ? sum / n : null;
  });
}

type CandleProps = { x?: number; y?: number; width?: number; height?: number; payload?: Row & { __o: number; __h: number; __l: number; __c: number } };
function Candle(props: CandleProps) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const { __o: o, __h: h, __l: l, __c: c } = payload;
  const span = h - l || 1;
  const py = (v: number) => y + ((h - v) / span) * height;
  const color = c >= o ? UP : DOWN;
  const cx = x + width / 2;
  const bodyTop = py(Math.max(o, c));
  const bodyH = Math.max(1, Math.abs(py(o) - py(c)));
  const w = Math.max(1, width * 0.7);
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - w / 2} y={bodyTop} width={w} height={bodyH} fill={c >= o ? color : color} fillOpacity={c >= o ? 0.9 : 0.9} />
    </g>
  );
}

function KlineView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const b = m.bindings;
  // 与 WEI 行情大屏同一个 K 线组件：十字线、滚轮缩放、拖拽平移、MA5/10/20、成交量
  const { candles, period } = useMemo(() => {
    const valid = rows.filter((r) => [b.open, b.high, b.low, b.close].every((k) => k && typeof r[k] === 'number'));
    const intraday = valid.some((r) => /\d{1,2}:\d{2}/.test(String(r[b.x!] ?? '')));
    const list = valid.map((r, i) => {
      const raw = String(r[b.x!] ?? '');
      const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00+08:00` : raw.replace(' ', 'T') + (/[+Z]/.test(raw.slice(10)) ? '' : '+08:00'));
      return {
        t: Number.isFinite(parsed) ? parsed : i * 86400e3,
        o: Number(r[b.open!]), h: Number(r[b.high!]), l: Number(r[b.low!]), c: Number(r[b.close!]),
        v: b.volume && typeof r[b.volume] === 'number' ? Number(r[b.volume]) : null,
      };
    }).sort((x, y) => x.t - y.t);
    return { candles: list, period: (intraday ? '5m' : '1d') as Period };
  }, [rows, b.open, b.high, b.low, b.close, b.volume, b.x]);
  const fmt = (v: unknown) => formatValue(v, { name: '', label: '', type: 'number' }, m.params.decimals, m.params.unit);
  if (!candles.length) return <div className="py-10 text-center text-xs text-slate-500">K线需要开、高、低、收四个数值字段</div>;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = prev ? (last.c - prev.c) / prev.c * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="text-lg font-semibold" style={{ color: change >= 0 ? UP : DOWN }}>{fmt(last.c)}</span>
        <span style={{ color: change >= 0 ? UP : DOWN }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</span>
        <span>开 {fmt(last.o)}</span><span>高 {fmt(last.h)}</span><span>低 {fmt(last.l)}</span>
      </div>
      <KlineChart candles={candles} period={period} height={Math.max(220, m.params.height)} showVolume={!!b.volume} prevClose={prev?.c ?? null} />
    </div>
  );
}

function tenorDays(t: unknown): number {
  const s = String(t ?? '').trim().toUpperCase().replace(/\s/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(D|W|M|Y|天|周|月|个月|年)?$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  const u = m[2] ?? 'Y';
  return n * (u === 'D' || u === '天' ? 1 : u === 'W' || u === '周' ? 7 : u === 'M' || u === '月' || u === '个月' ? 30 : 365);
}

function CurveView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => tenorDays(a[m.bindings.x!]) - tenorDays(b[m.bindings.x!])), [rows, m.bindings.x]);
  return <LineView m={{ ...m, params: { ...m.params, area: false } }} rows={sorted} />;
}

function heatColor(v: number, max: number) {
  const t = Math.min(1, Math.abs(v) / (max || 1));
  return v >= 0 ? `rgba(239,68,68,${0.15 + t * 0.7})` : `rgba(34,197,94,${0.15 + t * 0.7})`;
}

function HeatmapView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const value = seriesOf(m)[0];
  const label = m.bindings.x ?? m.fields.find((f) => f.type === 'string')?.name;
  const max = Math.max(...rows.map((r) => Math.abs(Number(r[value] ?? 0))));
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
      {rows.slice(0, 300).map((r, i) => {
        const v = Number(r[value] ?? 0);
        return (
          <div key={i} className="rounded-md px-2 py-2 text-center" style={{ background: heatColor(v, max) }} title={`${String(r[label!] ?? '')}：${formatValue(r[value], fieldOf(m, value), m.params.decimals, m.params.unit)}`}>
            <div className="truncate text-[11px] font-medium text-slate-100">{String(r[label!] ?? '')}</div>
            <div className="text-xs font-semibold text-white">{formatValue(r[value], fieldOf(m, value), m.params.decimals, m.params.unit)}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const series = seriesOf(m);
  const xType = fieldOf(m, m.bindings.x)?.type;
  // 分类字段：每行一张卡；日期字段：每个数值字段一张卡（最新值 + 较上期变化）
  const cards = xType === 'string' && m.bindings.x
    ? rows.slice(0, 24).map((r) => ({ label: String(r[m.bindings.x!] ?? ''), value: r[series[0]], field: fieldOf(m, series[0]), change: null as number | null }))
    : series.map((s) => {
        const vals = rows.map((r) => r[s]).filter((v): v is number => typeof v === 'number');
        const last = vals.at(-1) ?? null;
        const prev = vals.at(-2) ?? null;
        return { label: labelOf(m, s), value: last, field: fieldOf(m, s), change: last !== null && prev ? (last - prev) / Math.abs(prev) * 100 : null };
      });
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {cards.map((c, i) => (
        <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <div className="truncate text-[11px] text-slate-400">{c.label}</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">{formatValue(c.value, c.field, m.params.decimals, m.params.unit)}</div>
          {c.change !== null && <div className="text-[11px]" style={{ color: c.change >= 0 ? UP : DOWN }}>{c.change >= 0 ? '▲' : '▼'} {Math.abs(c.change).toFixed(2)}%</div>}
        </div>
      ))}
    </div>
  );
}

function NewsView({ m, rows, onInteract }: { m: UcPublishedModule; rows: Row[]; onInteract: () => void }) {
  const b = m.bindings;
  const [open, setOpen] = useState<number | null>(null);
  const items = useMemo(() => [...rows].sort((a, c) => String(c[b.time!] ?? '').localeCompare(String(a[b.time!] ?? ''))).slice(0, 200), [rows, b.time]);
  return (
    <ul className="divide-y divide-white/5" style={{ maxHeight: m.params.height + 120, overflowY: 'auto' }}>
      {items.map((r, i) => (
        <li key={i}>
          <button type="button" onClick={() => { setOpen(open === i ? null : i); onInteract(); }} className="flex w-full items-start gap-3 px-1 py-2 text-left hover:bg-teal-400/[0.04]">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-teal-300/80">{String(r[b.time!] ?? '').slice(0, 16)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] leading-5 text-slate-100">{String(r[b.title!] ?? '')}</span>
              {b.summary && open === i && <span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-slate-400">{String(r[b.summary] ?? '')}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function CalendarView({ m, rows }: { m: UcPublishedModule; rows: Row[] }) {
  const dateKey = m.bindings.x ?? m.bindings.time ?? m.fields.find((f) => f.type === 'date')?.name;
  const titleKey = m.bindings.title ?? m.fields.find((f) => f.type === 'string' && f.name !== dateKey)?.name;
  const others = m.fields.filter((f) => f.name !== dateKey && f.name !== titleKey).slice(0, 4);
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const d = String(r[dateKey!] ?? '').slice(0, 10) || '未定日期';
      map.set(d, [...(map.get(d) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, dateKey]);
  return (
    <div className="space-y-3" style={{ maxHeight: m.params.height + 120, overflowY: 'auto' }}>
      {groups.map(([d, items]) => (
        <div key={d}>
          <div className="sticky top-0 bg-[#0a1214] py-1 text-[11px] font-semibold text-teal-300">{d}</div>
          <div className="space-y-1">
            {items.map((r, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 rounded-md border border-white/5 px-2 py-1.5 text-xs">
                <span className="font-medium text-slate-100">{String(r[titleKey!] ?? '')}</span>
                {others.map((f) => <span key={f.name} className="text-slate-500">{f.label}：<span className="text-slate-300">{formatValue(r[f.name], f, m.params.decimals)}</span></span>)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableView({ m, rows, onInteract }: { m: UcPublishedModule; rows: Row[]; onInteract: () => void }) {
  const cols = (m.bindings.columns.length ? m.bindings.columns.map((c) => fieldOf(m, c)).filter((f): f is Field => !!f) : m.fields);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x ?? '').localeCompare(String(y ?? '')) * sort.dir;
    });
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = sorted.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <div>
      <div className="overflow-auto" style={{ maxHeight: m.params.height + 160 }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-[#0d181b]">
            <tr>
              {cols.map((c) => (
                <th key={c.name} className={`whitespace-nowrap border-b border-white/10 px-2 py-1.5 font-medium text-slate-400 ${c.type === 'number' || c.type === 'percent' ? 'text-right' : 'text-left'}`}>
                  <button type="button" className="inline-flex items-center gap-1 hover:text-teal-200" onClick={() => { setSort((s) => s?.key === c.name ? { key: c.name, dir: s.dir === 1 ? -1 : 1 } : { key: c.name, dir: 1 }); setPage(0); onInteract(); }}>
                    {c.label}<ArrowDownUp className={`h-3 w-3 ${sort?.key === c.name ? 'text-teal-300' : 'opacity-30'}`} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-teal-400/[0.04]">
                {cols.map((c) => {
                  const v = r[c.name];
                  const num = typeof v === 'number' && (c.type === 'number' || c.type === 'percent');
                  const signed = num && c.type === 'percent';
                  return <td key={c.name} className={`whitespace-nowrap px-2 py-1 ${num ? 'text-right font-mono' : 'text-left'} ${signed ? ((v as number) >= 0 ? 'text-red-400' : 'text-green-400') : 'text-slate-200'}`}>{formatValue(v, c, m.params.decimals, m.params.unit)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-slate-400">
          <ToolButton onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-3 w-3" /></ToolButton>
          <span>{page + 1} / {pages}</span>
          <ToolButton onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}><ChevronRight className="h-3 w-3" /></ToolButton>
        </div>
      )}
    </div>
  );
}
