/**
 * CIX 系列自设指数工具。
 * 每个工具均以已导入的行情数据、用户输入或用户本地文件为来源；
 * 不生成随机估值、不展示虚构报告，也不保留只提示成功的空操作。
 */
import { useMemo, useState } from 'react';
import { ArrowRightLeft, BarChart2, BookOpen, Calculator, Download, FileText, Percent, Plus, Save, Table, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface PanelProps { onClose: () => void; }
type MarketQuote = { symbol: string; name: string; market: string; price: string | number; changePct: string | number; volume: string | number };
type BasketItem = { id: number; ticker: string; name: string; weight: number };
type CsvRow = { date: string; value: string; label: string };

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+(US|LN|JP|HK|CN)$/i, '');
}

function useQuotes() {
  const query = trpc.market.getAll.useQuery();
  const quotes = (query.data ?? []) as MarketQuote[];
  const bySymbol = useMemo(() => new Map(quotes.map(item => [normalizeSymbol(item.symbol), item])), [quotes]);
  return { ...query, quotes, bySymbol };
}

function quoteNumber(quote: MarketQuote | undefined) {
  const value = Number(quote?.price);
  return Number.isFinite(value) ? value : undefined;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const body = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function persist(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), value }));
}

function loadRecentTickers() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('finance-hub:cixb-recent-tickers') ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 8) : [];
  } catch { return []; }
}

function PanelHeader({ code, title, accent, onClose }: { code: string; title: string; accent: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#121a2b] border-b border-[#334155]">
      <div className="flex items-center gap-2">
        <span className="font-bold" style={{ color: accent }}>{code}</span>
        <span className="text-slate-300">{title}</span>
      </div>
      <button type="button" onClick={onClose} aria-label="关闭面板" className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  );
}

function LoadingOrError({ loading, error }: { loading: boolean; error: unknown }) {
  if (loading) return <div className="p-4 text-slate-400">正在读取已导入行情…</div>;
  if (error) return <div className="p-4 text-red-400">行情读取失败，请刷新后重试。</div>;
  return null;
}

// ─── CIXB：可保存的行情篮子 ─────────────────────────────────────────────────
export function CIXBPanel({ onClose }: PanelProps) {
  const { quotes, bySymbol, isLoading, error } = useQuotes();
  const [components, setComponents] = useState<BasketItem[]>([
    { id: 1, ticker: 'AAPL', name: 'Apple Inc.', weight: 34 },
    { id: 2, ticker: 'MSFT', name: 'Microsoft Corp.', weight: 33 },
    { id: 3, ticker: 'US10Y', name: '10Y US Treasury', weight: 33 },
  ]);
  const [newTicker, setNewTicker] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [recentTickers, setRecentTickers] = useState<string[]>(loadRecentTickers);
  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  const valued = components.map(item => ({ ...item, quote: bySymbol.get(normalizeSymbol(item.ticker)) }));
  const coverage = valued.filter(item => quoteNumber(item.quote) !== undefined).reduce((sum, item) => sum + item.weight, 0);

  const addComponent = () => {
    const ticker = normalizeSymbol(newTicker);
    const weight = Number(newWeight);
    const quote = bySymbol.get(ticker);
    if (!ticker || !Number.isFinite(weight) || weight <= 0) return toast.error('请输入有效的行情代码和正权重');
    if (!quote) return toast.error(`未在已导入行情中找到 ${ticker}`);
    if (components.some(item => normalizeSymbol(item.ticker) === ticker)) return toast.error(`${ticker} 已在篮子中`);
    if (totalWeight + weight > 100) return toast.error(`加入后权重为 ${totalWeight + weight}% ，不能超过 100%`);
    setComponents(items => [...items, { id: Date.now(), ticker, name: quote.name, weight }]);
    const nextRecent = [ticker, ...recentTickers.filter(item => item !== ticker)].slice(0, 8);
    setRecentTickers(nextRecent);
    window.localStorage.setItem('finance-hub:cixb-recent-tickers', JSON.stringify(nextRecent));
    setNewTicker(''); setNewWeight('');
  };

  const saveBasket = () => {
    if (totalWeight !== 100) return toast.error('请将总权重调整为 100% 后再保存');
    if (coverage !== 100) return toast.error('存在没有可用报价的成分，无法保存估值快照');
    const snapshot = valued.map(item => ({ symbol: item.ticker, name: item.name, weight: item.weight, price: quoteNumber(item.quote), quotedAt: new Date().toISOString() }));
    persist('finance-hub:cixb', snapshot);
    downloadCsv('cixb-basket-snapshot.csv', ['代码', '名称', '权重%', '现价', '报价变动%'], valued.map(item => [item.ticker, item.name, item.weight, quoteNumber(item.quote) ?? '', item.quote?.changePct ?? '']));
    toast.success('篮子快照已保存到当前浏览器并导出 CSV');
  };

  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200">
    <PanelHeader code="CIXB" title="行情篮子与权重快照" accent="#f59e0b" onClose={onClose} />
    <LoadingOrError loading={isLoading} error={error} />
    {!isLoading && !error && <div className="flex-1 overflow-auto p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded border border-slate-700 bg-slate-900 p-2"><div className="text-slate-500">成分数量</div><div className="mt-1 font-semibold text-white">{components.length}</div></div>
        <div className="rounded border border-slate-700 bg-slate-900 p-2"><div className="text-slate-500">总权重</div><div className={`mt-1 font-semibold ${totalWeight === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{totalWeight.toFixed(1)}%</div></div>
        <div className="rounded border border-slate-700 bg-slate-900 p-2"><div className="text-slate-500">有效报价覆盖</div><div className={`mt-1 font-semibold ${coverage === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{coverage.toFixed(1)}%</div></div>
      </div>
      <table className="w-full border-collapse"><thead><tr className="border-b border-slate-700 text-left text-slate-500"><th className="p-2">代码</th><th className="p-2">名称</th><th className="p-2">权重%</th><th className="p-2">已导入报价</th><th className="p-2">操作</th></tr></thead>
        <tbody>{valued.map(item => <tr key={item.id} className="border-b border-slate-800"><td className="p-2 font-medium text-amber-300">{item.ticker}</td><td className="p-2">{item.name}</td><td className="p-2"><input aria-label={`${item.ticker} 权重`} type="number" min="0" max="100" step="0.1" value={item.weight} onChange={event => setComponents(rows => rows.map(row => row.id === item.id ? { ...row, weight: Number(event.target.value) || 0 } : row))} className="w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5" /></td><td className="p-2">{quoteNumber(item.quote) === undefined ? <span className="text-amber-400">未找到</span> : <span>{quoteNumber(item.quote)?.toFixed(4)} <span className="text-slate-500">{Number(item.quote?.changePct).toFixed(2)}%</span></span>}</td><td className="p-2"><button type="button" onClick={() => setComponents(rows => rows.filter(row => row.id !== item.id))} className="text-red-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>
      <div className="flex flex-wrap gap-2"><input list="cixb-symbols" value={newTicker} onChange={event => setNewTicker(event.target.value)} placeholder="选择已导入代码" className="min-w-40 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1" /><datalist id="cixb-symbols">{quotes.map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</datalist><input value={newWeight} onChange={event => setNewWeight(event.target.value)} type="number" min="0" max="100" placeholder="权重%" className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1" /><button type="button" onClick={addComponent} className="rounded bg-amber-400 px-3 py-1 font-semibold text-slate-950"><Plus className="h-3.5 w-3.5" /></button><button type="button" onClick={saveBasket} className="flex items-center gap-1 rounded bg-emerald-500 px-3 py-1 font-semibold text-slate-950"><Save className="h-3.5 w-3.5" />保存并导出</button></div>
      {recentTickers.length > 0 && <div className="flex flex-wrap items-center gap-1 text-slate-500"><span>最近使用：</span>{recentTickers.map(ticker => <button type="button" key={ticker} onClick={() => setNewTicker(ticker)} className="rounded border border-slate-700 px-2 py-0.5 text-amber-300 hover:border-amber-400">{ticker}</button>)}</div>}
    </div>}</div>;
}

export function evaluateArithmetic(expression: string, variables: Map<string, number>) {
  const tokens = expression.match(/[A-Za-z][A-Za-z0-9]*|\d*\.?\d+|[()+\-*/]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('只支持代码、数字、括号与 + - * / 运算符');
  let index = 0;
  const primary = (): number => {
    const token = tokens[index++];
    if (token === '(') { const value = sum(); if (tokens[index++] !== ')') throw new Error('括号不匹配'); return value; }
    if (token === '-') return -primary();
    if (/^\d/.test(token ?? '')) return Number(token);
    const value = variables.get(normalizeSymbol(token ?? ''));
    if (value === undefined) throw new Error(`未找到可计算的行情代码：${token}`);
    return value;
  };
  const product = (): number => { let value = primary(); while (tokens[index] === '*' || tokens[index] === '/') { const operator = tokens[index++]; const next = primary(); if (operator === '/' && next === 0) throw new Error('除数不能为 0'); value = operator === '*' ? value * next : value / next; } return value; };
  const sum = (): number => { let value = product(); while (tokens[index] === '+' || tokens[index] === '-') { const operator = tokens[index++]; const next = product(); value = operator === '+' ? value + next : value - next; } return value; };
  const output = sum();
  if (index !== tokens.length || !Number.isFinite(output)) throw new Error('表达式无法计算');
  return output;
}

// ─── CIXN：受限语法的实时报价表达式 ─────────────────────────────────────────
export function CIXNPanel({ onClose }: PanelProps) {
  const { quotes, bySymbol, isLoading, error } = useQuotes();
  const [expr, setExpr] = useState('(US10Y - BUND) * 100');
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const variables = useMemo(() => new Map(Array.from(bySymbol.entries()).map(([symbol, quote]) => [symbol, quoteNumber(quote)]).filter((entry): entry is [string, number] => entry[1] !== undefined)), [bySymbol]);
  const run = () => { try { const value = evaluateArithmetic(expr, variables); setResult(value); setMessage(`使用 ${variables.size} 个已导入报价计算`); } catch (reason) { setResult(null); setMessage(reason instanceof Error ? reason.message : '计算失败'); } };
  const save = () => { if (result === null) return toast.error('请先完成有效计算'); persist('finance-hub:cixn', { expression: expr, result, sourceCount: variables.size }); downloadCsv('cixn-expression-result.csv', ['表达式', '计算结果', '可用报价数'], [[expr, result, variables.size]]); toast.success('表达式结果已保存到当前浏览器并导出 CSV'); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="CIXN" title="行情表达式计算器" accent="#60a5fa" onClose={onClose} /><LoadingOrError loading={isLoading} error={error} />{!isLoading && !error && <div className="flex-1 overflow-auto p-3 space-y-3"><p className="text-slate-400">仅允许使用已导入的代码、数值、括号和四则运算；计算过程不会执行脚本。</p><textarea value={expr} onChange={event => setExpr(event.target.value)} rows={3} className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono text-emerald-300" /><div className="flex gap-2"><button type="button" onClick={run} className="rounded bg-blue-500 px-3 py-1 font-semibold text-white"><Calculator className="mr-1 inline h-3.5 w-3.5" />计算</button><button type="button" onClick={save} className="rounded bg-slate-700 px-3 py-1 text-white"><Save className="mr-1 inline h-3.5 w-3.5" />保存结果</button></div><div className="rounded border border-slate-700 bg-slate-900 p-3"><div className="text-slate-500">计算结果</div><div className={`mt-1 text-lg font-semibold ${result === null ? 'text-slate-400' : 'text-emerald-400'}`}>{result === null ? '尚未计算' : result.toFixed(6)}</div><div className={result === null && message ? 'mt-2 text-amber-400' : 'mt-2 text-slate-500'}>{message || '示例： (US10Y - BUND) * 100'}</div></div><div className="rounded border border-slate-800 p-2 text-slate-500">可用代码：{quotes.slice(0, 12).map(item => item.symbol).join('、')}{quotes.length > 12 ? ' …' : ''}</div></div>}</div>;
}

// ─── CIXS：报价差值与单位化利差 ───────────────────────────────────────────────
export function CIXSPanel({ onClose }: PanelProps) {
  const { quotes, bySymbol, isLoading, error } = useQuotes();
  const [leg1, setLeg1] = useState('US10Y'); const [leg2, setLeg2] = useState('BUND'); const [multiplier, setMultiplier] = useState('100'); const [result, setResult] = useState<number | null>(null);
  const calculate = () => { const first = quoteNumber(bySymbol.get(normalizeSymbol(leg1))); const second = quoteNumber(bySymbol.get(normalizeSymbol(leg2))); const multiple = Number(multiplier); if (first === undefined || second === undefined) return toast.error('两条腿均须来自已导入行情'); if (!Number.isFinite(multiple)) return toast.error('请输入有效乘数'); setResult((first - second) * multiple); };
  const save = () => { if (result === null) return toast.error('请先计算价差'); persist('finance-hub:cixs', { leg1, leg2, multiplier, result }); downloadCsv('cixs-spread.csv', ['腿1', '腿2', '乘数', '结果'], [[leg1, leg2, multiplier, result]]); toast.success('价差计算已保存并导出 CSV'); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="CIXS" title="双腿报价差值工具" accent="#34d399" onClose={onClose} /><LoadingOrError loading={isLoading} error={error} />{!isLoading && !error && <div className="flex-1 p-3 space-y-3"><p className="text-slate-400">用两条已导入行情计算差值；乘数可用于将价格差统一为点、百分比或自定义单位。</p><div className="grid grid-cols-3 gap-2"><input list="cixs-symbols" value={leg1} onChange={event => setLeg1(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><input list="cixs-symbols" value={leg2} onChange={event => setLeg2(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><input value={multiplier} onChange={event => setMultiplier(event.target.value)} type="number" className="rounded border border-slate-700 bg-slate-900 p-2" /><datalist id="cixs-symbols">{quotes.map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</datalist></div><div className="rounded border border-slate-700 bg-slate-900 p-3"><span className="text-slate-500">{leg1} − {leg2} × {multiplier}</span><div className="mt-1 text-lg font-semibold text-amber-300">{result === null ? '尚未计算' : result.toFixed(4)}</div></div><div className="flex gap-2"><button type="button" onClick={calculate} className="rounded bg-emerald-500 px-3 py-1 font-semibold text-slate-950">计算</button><button type="button" onClick={save} className="rounded bg-slate-700 px-3 py-1">保存并导出</button></div></div>}</div>;
}

// ─── CIXR：价格比率与变动归因 ───────────────────────────────────────────────
export function CIXRPanel({ onClose }: PanelProps) {
  const { quotes, bySymbol, isLoading, error } = useQuotes();
  const [numerator, setNumerator] = useState('AAPL'); const [denominator, setDenominator] = useState('MSFT'); const [scale, setScale] = useState('1');
  const first = quoteNumber(bySymbol.get(normalizeSymbol(numerator))); const second = quoteNumber(bySymbol.get(normalizeSymbol(denominator))); const ratio = first !== undefined && second !== undefined && second !== 0 ? first / second * (Number(scale) || 1) : undefined;
  const save = () => { if (ratio === undefined) return toast.error('请选择两条存在且非零报价的行情'); persist('finance-hub:cixr', { numerator, denominator, scale, ratio }); downloadCsv('cixr-ratio.csv', ['分子', '分母', '比例系数', '比率'], [[numerator, denominator, scale, ratio]]); toast.success('比率快照已保存并导出 CSV'); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="CIXR" title="相对价格比率" accent="#a78bfa" onClose={onClose} /><LoadingOrError loading={isLoading} error={error} />{!isLoading && !error && <div className="flex-1 p-3 space-y-3"><div className="grid grid-cols-3 gap-2"><input list="cixr-symbols" value={numerator} onChange={event => setNumerator(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><input list="cixr-symbols" value={denominator} onChange={event => setDenominator(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><input value={scale} onChange={event => setScale(event.target.value)} type="number" className="rounded border border-slate-700 bg-slate-900 p-2" /><datalist id="cixr-symbols">{quotes.map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</datalist></div><div className="rounded border border-slate-700 bg-slate-900 p-3"><div className="text-slate-500">{numerator} / {denominator} × {scale}</div><div className="mt-1 text-lg font-semibold text-amber-300">{ratio === undefined ? '缺少可用报价' : ratio.toFixed(6)}</div><div className="mt-2 text-slate-500">分子：{first?.toFixed(4) ?? '—'}　分母：{second?.toFixed(4) ?? '—'}</div></div><button type="button" onClick={save} className="rounded bg-violet-500 px-3 py-1 font-semibold text-white"><Save className="mr-1 inline h-3.5 w-3.5" />保存比率</button></div>}</div>;
}

// ─── CIXC：报价单位换算 ───────────────────────────────────────────────────────
export function CIXCPanel({ onClose }: PanelProps) {
  const { quotes, bySymbol, isLoading, error } = useQuotes();
  const [source, setSource] = useState('AAPL'); const [fromUnit, setFromUnit] = useState('USD/股'); const [toUnit, setToUnit] = useState('本币/股'); const [factor, setFactor] = useState('1');
  const price = quoteNumber(bySymbol.get(normalizeSymbol(source))); const converted = price === undefined || !Number.isFinite(Number(factor)) ? undefined : price * Number(factor);
  const save = () => { if (converted === undefined) return toast.error('请先选择有效行情并填写转换系数'); persist('finance-hub:cixc', { source, fromUnit, toUnit, factor, price, converted }); downloadCsv('cixc-conversion.csv', ['代码', '原始数值', '原始单位', '转换系数', '转换结果', '目标单位'], [[source, price ?? '', fromUnit, factor, converted, toUnit]]); toast.success('转换结果已保存并导出 CSV'); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="CIXC" title="行情单位换算" accent="#fb7185" onClose={onClose} /><LoadingOrError loading={isLoading} error={error} />{!isLoading && !error && <div className="flex-1 p-3 space-y-3"><div className="grid grid-cols-2 gap-2"><input list="cixc-symbols" value={source} onChange={event => setSource(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><input value={factor} onChange={event => setFactor(event.target.value)} type="number" step="any" placeholder="转换系数" className="rounded border border-slate-700 bg-slate-900 p-2" /><input value={fromUnit} onChange={event => setFromUnit(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><input value={toUnit} onChange={event => setToUnit(event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2" /><datalist id="cixc-symbols">{quotes.map(item => <option key={item.symbol} value={item.symbol}>{item.name}</option>)}</datalist></div><div className="rounded border border-slate-700 bg-slate-900 p-3"><div className="text-slate-500">{source}: {price?.toFixed(4) ?? '未找到报价'} {fromUnit}</div><div className="mt-1 text-lg font-semibold text-rose-300">→ {converted?.toFixed(6) ?? '—'} {toUnit}</div></div><button type="button" onClick={save} className="rounded bg-rose-500 px-3 py-1 font-semibold text-white"><Save className="mr-1 inline h-3.5 w-3.5" />保存换算</button></div>}</div>;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV 至少需要标题行和一行数据');
  return lines.slice(1).map((line, index) => {
    const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    const date = cells[0] || String(index + 1); const value = cells[1] ?? '';
    if (!Number.isFinite(Number(value))) throw new Error(`第 ${index + 2} 行数值无效`);
    return { date, value, label: cells[2] || '本地数据' };
  });
}

// ─── CIXX：真实 CSV 导入与快照 ───────────────────────────────────────────────
export function CIXXPanel({ onClose }: PanelProps) {
  const [fileName, setFileName] = useState(''); const [rows, setRows] = useState<CsvRow[]>([]);
  const load = (file: File | undefined) => { if (!file) return; if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('为保证可验证的解析结果，当前仅接受 CSV 文件'); const reader = new FileReader(); reader.onload = () => { try { const data = parseCsv(String(reader.result)); setRows(data); setFileName(file.name); toast.success(`已解析 ${data.length} 行本地数据`); } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'CSV 解析失败'); } }; reader.readAsText(file, 'utf-8'); };
  const persistRows = () => { if (!rows.length) return toast.error('请先导入 CSV'); persist('finance-hub:cixx', rows); downloadCsv('cixx-imported-series.csv', ['日期', '数值', '标签'], rows.map(row => [row.date, row.value, row.label])); toast.success('本地序列已保存到浏览器并导出核验副本'); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="CIXX" title="本地 CSV 时间序列导入" accent="#34d399" onClose={onClose} /><div className="flex-1 overflow-auto p-3 space-y-3"><label className="block cursor-pointer rounded border-2 border-dashed border-slate-700 p-6 text-center hover:border-emerald-500"><Upload className="mx-auto mb-2 h-7 w-7 text-slate-500" /><div>选择 CSV 文件（列：日期、数值、标签〔可选〕）</div><input type="file" accept=".csv,text/csv" onChange={event => load(event.target.files?.[0])} className="hidden" /></label>{fileName && <div className="text-emerald-400">已解析：{fileName}（{rows.length} 行）</div>}{rows.length > 0 && <><div className="max-h-56 overflow-auto rounded border border-slate-700"><table className="w-full"><thead className="sticky top-0 bg-slate-900 text-slate-500"><tr><th className="p-2 text-left">日期</th><th className="p-2 text-left">数值</th><th className="p-2 text-left">标签</th></tr></thead><tbody>{rows.slice(0, 50).map((row, index) => <tr key={`${row.date}-${index}`} className="border-t border-slate-800"><td className="p-2">{row.date}</td><td className="p-2 text-amber-300">{row.value}</td><td className="p-2 text-slate-400">{row.label}</td></tr>)}</tbody></table></div><button type="button" onClick={persistRows} className="rounded bg-emerald-500 px-3 py-1 font-semibold text-slate-950"><Save className="mr-1 inline h-3.5 w-3.5" />保存并导出核验副本</button></>}</div></div>;
}

// ─── CIXI：人工时间序列与完整导出 ────────────────────────────────────────────
export function CIXIPanel({ onClose }: PanelProps) {
  const [points, setPoints] = useState<CsvRow[]>([{ date: '2026-01-01', value: '100.00', label: '基准' }, { date: '2026-02-01', value: '102.50', label: '月度观察' }]);
  const add = () => setPoints(rows => [...rows, { date: new Date().toISOString().slice(0, 10), value: '', label: '手工录入' }]);
  const save = () => { if (!points.length || points.some(point => !point.date || !Number.isFinite(Number(point.value)))) return toast.error('每个数据点都需要有效日期和数值'); const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date)); persist('finance-hub:cixi', sorted); downloadCsv('cixi-manual-series.csv', ['日期', '数值', '标签'], sorted.map(point => [point.date, point.value, point.label])); toast.success('时间序列已保存并导出 CSV'); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="CIXI" title="手工时间序列与版本快照" accent="#f59e0b" onClose={onClose} /><div className="flex-1 overflow-auto p-3 space-y-3"><div className="flex justify-between"><span className="text-slate-400">用于录入内部估值、调整因子或不可公开的观察值。</span><button type="button" onClick={add} className="rounded bg-amber-400 px-2 py-1 font-semibold text-slate-950"><Plus className="mr-1 inline h-3.5 w-3.5" />添加点</button></div><table className="w-full"><thead className="text-left text-slate-500"><tr><th className="p-2">日期</th><th className="p-2">数值</th><th className="p-2">标签</th><th /></tr></thead><tbody>{points.map((point, index) => <tr key={index} className="border-t border-slate-800"><td className="p-2"><input type="date" value={point.date} onChange={event => setPoints(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, date: event.target.value } : row))} className="rounded border border-slate-700 bg-slate-900 p-1" /></td><td className="p-2"><input value={point.value} onChange={event => setPoints(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row))} type="number" step="any" className="w-28 rounded border border-slate-700 bg-slate-900 p-1 text-amber-300" /></td><td className="p-2"><input value={point.label} onChange={event => setPoints(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row))} className="w-full rounded border border-slate-700 bg-slate-900 p-1" /></td><td className="p-2"><button type="button" onClick={() => setPoints(rows => rows.filter((_, rowIndex) => rowIndex !== index))} className="text-red-400"><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table><button type="button" onClick={save} className="rounded bg-amber-400 px-3 py-1 font-semibold text-slate-950"><Save className="mr-1 inline h-3.5 w-3.5" />保存并导出</button></div></div>;
}

// ─── INP：由真实行情生成的可下载市场快照 ─────────────────────────────────────
export function INPPanel({ onClose }: PanelProps) {
  const { quotes, isLoading, error } = useQuotes();
  const [filter, setFilter] = useState('全部');
  const markets = ['全部', ...Array.from(new Set(quotes.map(item => item.market)))];
  const rows = filter === '全部' ? quotes : quotes.filter(item => item.market === filter);
  const download = () => { if (!rows.length) return toast.error('当前筛选没有可导出的行情'); downloadCsv(`finance-hub-market-snapshot-${filter}.csv`, ['代码', '名称', '类别', '现价', '涨跌幅%', '成交量'], rows.map(item => [item.symbol, item.name, item.market, item.price, item.changePct, item.volume])); toast.success(`已导出 ${rows.length} 条${filter === '全部' ? '' : filter + ' '}行情快照`); };
  return <div className="flex h-full flex-col bg-[#080d18] text-xs text-slate-200"><PanelHeader code="INP" title="可下载市场快照" accent="#60a5fa" onClose={onClose} /><LoadingOrError loading={isLoading} error={error} />{!isLoading && !error && <div className="flex-1 overflow-auto p-3 space-y-3"><div className="flex flex-wrap gap-1">{markets.map(market => <button type="button" key={market} onClick={() => setFilter(market)} className={`rounded px-2 py-1 ${filter === market ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{market}</button>)}</div><div className="flex items-center justify-between"><span className="text-slate-400">当前筛选 {rows.length} 条已导入行情，可直接用于研究底稿。</span><button type="button" onClick={download} className="rounded bg-blue-500 px-3 py-1 font-semibold text-white"><Download className="mr-1 inline h-3.5 w-3.5" />导出 CSV</button></div><div className="max-h-80 overflow-auto rounded border border-slate-700"><table className="w-full"><thead className="sticky top-0 bg-slate-900 text-left text-slate-500"><tr><th className="p-2">代码</th><th className="p-2">名称</th><th className="p-2">类别</th><th className="p-2">现价</th><th className="p-2">涨跌幅</th></tr></thead><tbody>{rows.map(item => <tr key={item.symbol} className="border-t border-slate-800"><td className="p-2 font-medium text-blue-300">{item.symbol}</td><td className="p-2">{item.name}</td><td className="p-2 text-slate-400">{item.market}</td><td className="p-2">{item.price}</td><td className={`p-2 ${Number(item.changePct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Number(item.changePct) >= 0 ? '+' : ''}{item.changePct}%</td></tr>)}</tbody></table></div></div>}</div>;
}
