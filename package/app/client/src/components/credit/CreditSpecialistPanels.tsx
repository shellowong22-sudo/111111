import { useEffect, useMemo, useState } from 'react';
import { Copy, Database, Download, ExternalLink, LineChart as LineChartIcon, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { trpc } from '@/lib/trpc';
import { Badge, Card, Metric, PanelShell } from '@/components/sovereign/PanelKit';
import CreditCoreSpecialistPanels from './CreditCoreSpecialistPanels';
import CreditIssuerAndAnalyticsPanels from './CreditIssuerAndAnalyticsPanels';
import CreditPostTradeDeliveryPanels from './CreditPostTradeDeliveryPanels';
import CreditCollaborationPanels from './CreditCollaborationPanels';
import CreditInteractiveVisualizationPanels from './CreditInteractiveVisualizationPanels';
import CreditChartExportPanels from './CreditChartExportPanels';
import CreditAccountGovernancePanels from './CreditAccountGovernancePanels';
import { CreditTerminalSourceBoundary } from './CreditTerminalSourceBoundary';

type CreditSpecialistPanelProps = { moduleId: string };

type DictionaryRow = { id: string; field: string; definition: string; unit: string; asOf: string; sourceUrl: string };
type CurveNode = { id: string; tenor: string; years: string; yieldPct: string; oasBps: string };
type GovernanceRow = { id: string; object: string; provider: string; status: string; asOf: string; sourceUrl: string };
type IndexRow = { id: string; name: string; methodologyUrl: string; frequency: string; permission: string; asOf: string };

const FRED_SERIES = [
  { id: 'BAMLC0A0CM', name: 'ICE BofA US Corporate Index OAS', group: '投资级综合', frequency: '日度', url: 'https://fred.stlouisfed.org/series/BAMLC0A0CM' },
  { id: 'BAMLC0A1CAAA', name: 'ICE BofA AAA US Corporate Index OAS', group: 'AAA', frequency: '日度', url: 'https://fred.stlouisfed.org/series/BAMLC0A1CAAA' },
  { id: 'BAMLC0A2CAA', name: 'ICE BofA AA US Corporate Index OAS', group: 'AA', frequency: '日度', url: 'https://fred.stlouisfed.org/series/BAMLC0A2CAA' },
  { id: 'BAMLC0A4CBBB', name: 'ICE BofA BBB US Corporate Index OAS', group: 'BBB', frequency: '日度', url: 'https://fred.stlouisfed.org/series/BAMLC0A4CBBB' },
  { id: 'BAMLH0A0HYM2', name: 'ICE BofA US High Yield Index OAS', group: '高收益综合', frequency: '日度', url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2' },
];

const COVERAGE_CATALOG = [
  { key: 'us-oas', market: '美国公司债 OAS', risk: 'IG / HY 指数级', provider: 'FRED / ICE BofA', refresh: '日度公开观测', url: 'https://fred.stlouisfed.org/categories/32413' },
  { key: 'us-treasury', market: '美国国债曲线', risk: '主权基准', provider: 'U.S. Treasury', refresh: '官方日度', url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates' },
  { key: 'eu-issuance', market: '欧元区主权发行', risk: '主权融资事件', provider: '欧洲债务管理机构', refresh: '按公告披露', url: 'https://www.aft.gouv.fr/en' },
  { key: 'uk-gilt', market: '英国 Gilt', risk: '主权融资事件', provider: 'UK DMO', refresh: '按拍卖公告披露', url: 'https://www.dmo.gov.uk/' },
  { key: 'jp-jgb', market: '日本 JGB', risk: '主权融资事件', provider: '日本财务省', refresh: '按发行日历披露', url: 'https://www.mof.go.jp/english/policy/jgbs/auction/' },
];

let localWorkpaperIdSequence = 0;

function makeId(prefix: string) {
  localWorkpaperIdSequence += 1;
  return `${prefix}-${Date.now()}-${localWorkpaperIdSequence}`;
}

function useLocalRows<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) as T : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* 浏览器存储不可用时仅保留当前会话 */ }
  }, [key, value]);
  return [value, setValue] as const;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const quote = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const body = [headers.map(quote).join(','), ...rows.map((row) => row.map(quote).join(','))].join('\r\n');
  const href = URL.createObjectURL(new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = href; link.download = filename; link.click();
  URL.revokeObjectURL(href);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
}

function EmptyWorkState({ text }: { text: string }) {
  return <div className="rounded border border-dashed border-slate-700 bg-slate-950/30 px-3 py-8 text-center text-xs text-slate-500">{text}</div>;
}

function DictionaryManagerPanel() {
  const [rows, setRows] = useLocalRows<DictionaryRow[]>('credit-dictionary-v1', []);
  const [draft, setDraft] = useState({ field: '', definition: '', unit: '', asOf: '', sourceUrl: '' });
  const [copied, setCopied] = useState(false);
  const add = () => {
    if (!draft.field.trim() || !draft.definition.trim()) return;
    setRows((current) => [...current, { id: makeId('field'), ...draft }]);
    setDraft({ field: '', definition: '', unit: '', asOf: '', sourceUrl: '' });
  };
  const copy = async () => {
    await copyText(rows.map((row) => `${row.field}: ${row.definition}${row.unit ? ` [${row.unit}]` : ''}`).join('\n'));
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  };
  return <PanelShell ticker="1" title="证券与功能说明" subtitle="字段血缘与研究口径管理">
    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.4fr]">
      <Card title="新建字段血缘记录" action={<Badge tone="info">本地工作底稿</Badge>}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">字段名称<input value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })} placeholder="例如：OAS" className="input-terminal mt-1 w-full" /></label>
          <label className="text-xs text-slate-400">单位/币种<input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="bp / % / USD" className="input-terminal mt-1 w-full" /></label>
          <label className="text-xs text-slate-400 sm:col-span-2">口径定义<textarea value={draft.definition} onChange={(e) => setDraft({ ...draft, definition: e.target.value })} placeholder="说明计算或披露口径，避免将指数、单券和 CDS 混用" className="input-terminal mt-1 min-h-20 w-full resize-y" /></label>
          <label className="text-xs text-slate-400">观察日<input type="date" value={draft.asOf} onChange={(e) => setDraft({ ...draft, asOf: e.target.value })} className="input-terminal mt-1 w-full" /></label>
          <label className="text-xs text-slate-400">原始来源 URL<input type="url" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} placeholder="https://" className="input-terminal mt-1 w-full" /></label>
        </div>
        <button type="button" onClick={add} disabled={!draft.field.trim() || !draft.definition.trim()} className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-800 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-40"><Plus className="h-3.5 w-3.5" />写入字段字典</button>
      </Card>
      <Card title="字段血缘清单" action={<div className="flex gap-2"><button type="button" onClick={copy} disabled={!rows.length} className="text-[11px] text-cyan-300 disabled:text-slate-600">{copied ? '已复制' : '复制定义'}</button><button type="button" onClick={() => downloadCsv('credit-field-lineage.csv', ['字段', '定义', '单位', '观察日', '来源'], rows.map((r) => [r.field, r.definition, r.unit, r.asOf, r.sourceUrl]))} disabled={!rows.length} className="text-[11px] text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />CSV</button></div>}>
        {rows.length === 0 ? <EmptyWorkState text="尚无字段记录。录入口径和原始来源后，才能在研究中复用该字段。" /> : <div className="max-h-96 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-[10px] text-slate-500"><tr><th className="p-2">字段</th><th className="p-2">口径</th><th className="p-2">观察日</th><th className="p-2">来源</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-800/80 align-top"><td className="p-2 font-mono text-cyan-200">{row.field}<span className="block text-[10px] text-slate-500">{row.unit || '未填单位'}</span></td><td className="p-2 text-slate-300">{row.definition}</td><td className="p-2 text-slate-400">{row.asOf || '未填'}</td><td className="p-2">{row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-100"><ExternalLink className="inline h-3 w-3" /> 原件</a> : <span className="text-amber-400">待补</span>}</td><td className="p-2"><button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="text-slate-500 hover:text-rose-300" aria-label="删除字段"><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  </PanelShell>;
}

function MarketCoveragePanel() {
  const [selected, setSelected] = useLocalRows<string[]>('credit-market-coverage-v1', ['us-oas', 'us-treasury']);
  const selectedRows = COVERAGE_CATALOG.filter((item) => selected.includes(item.key));
  const toggle = (key: string) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  return <PanelShell ticker="WB" title="全球债券市场" subtitle="跨市场覆盖与研究可得性控制">
    <div className="grid gap-3 lg:grid-cols-[0.85fr_1.45fr]">
      <Card title="选择研究覆盖范围"><p className="mb-3 text-xs text-slate-400">选择的是本次研究需要纳入的**公开来源覆盖**，不是实时跨市场报价订阅。</p><div className="space-y-2">{COVERAGE_CATALOG.map((item) => <label key={item.key} className="flex cursor-pointer items-start gap-2 rounded border border-slate-800 p-2 hover:border-cyan-900"><input type="checkbox" checked={selected.includes(item.key)} onChange={() => toggle(item.key)} className="mt-0.5" /><span><span className="block text-xs text-slate-200">{item.market}</span><span className="text-[10px] text-slate-500">{item.provider} · {item.risk}</span></span></label>)}</div></Card>
      <Card title="覆盖矩阵" action={<button type="button" onClick={() => downloadCsv('credit-market-coverage.csv', ['市场', '风险桶', '来源', '更新口径', '链接'], selectedRows.map((r) => [r.market, r.risk, r.provider, r.refresh, r.url]))} disabled={!selectedRows.length} className="text-[11px] text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出覆盖报告</button>}>
        {selectedRows.length === 0 ? <EmptyWorkState text="请从左侧选择至少一个研究市场。" /> : <div className="grid gap-2 md:grid-cols-2">{selectedRows.map((item) => <article key={item.key} className="rounded border border-slate-800 bg-slate-950/40 p-3"><div className="flex items-start justify-between gap-2"><div><h4 className="text-sm text-slate-100">{item.market}</h4><p className="mt-1 text-[11px] text-slate-500">风险层级：{item.risk}</p></div><Badge tone="info">已纳入</Badge></div><dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><div><dt className="text-slate-500">主来源</dt><dd className="text-slate-300">{item.provider}</dd></div><div><dt className="text-slate-500">时效口径</dt><dd className="text-slate-300">{item.refresh}</dd></div></dl><a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-100">打开原始来源 <ExternalLink className="h-3.5 w-3.5" /></a></article>)}</div>}
        <p className="mt-3 text-[10px] text-slate-500">覆盖矩阵用于区分可公开核验的指数/官方公告与需额外许可的单券报价、CDS 点位及逐笔交易数据。</p>
      </Card>
    </div>
  </PanelShell>;
}

function BenchmarkDecompositionPanel() {
  const [creditYield, setCreditYield] = useState('');
  const [governmentYield, setGovernmentYield] = useState('');
  const [liquidityAdj, setLiquidityAdj] = useState('');
  const credit = Number(creditYield); const gov = Number(governmentYield); const liquidity = Number(liquidityAdj || 0);
  const valid = Number.isFinite(credit) && Number.isFinite(gov) && creditYield.trim() !== '' && governmentYield.trim() !== '';
  const nominal = valid ? (credit - gov) * 100 : null;
  const residual = nominal === null ? null : nominal - liquidity;
  return <PanelShell ticker="BTMM" title="国债与货币市场" subtitle="国债基准与信用收益率拆解">
    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
      <Card title="输入同币种、同期限观察值"><div className="grid gap-2 sm:grid-cols-3"><label className="text-xs text-slate-400">信用债收益率（%）<input inputMode="decimal" value={creditYield} onChange={(e) => setCreditYield(e.target.value)} className="input-terminal mt-1 w-full" placeholder="5.20" /></label><label className="text-xs text-slate-400">国债基准收益率（%）<input inputMode="decimal" value={governmentYield} onChange={(e) => setGovernmentYield(e.target.value)} className="input-terminal mt-1 w-full" placeholder="4.35" /></label><label className="text-xs text-slate-400">已知流动性调整（bp）<input inputMode="decimal" value={liquidityAdj} onChange={(e) => setLiquidityAdj(e.target.value)} className="input-terminal mt-1 w-full" placeholder="可选" /></label></div><p className="mt-3 text-[10px] text-slate-500">仅计算用户输入的名义收益率差。到期日、币种、税制或嵌入期权不一致时，结果不可视为可交易利差。</p></Card>
      <Card title="基准拆解输出">{valid ? <div className="grid gap-3 sm:grid-cols-3"><Metric label="名义收益率差" value={nominal?.toFixed(1)} unit="bp" tone="info" sub="信用债收益率 − 国债收益率" /><Metric label="输入流动性调整" value={liquidity.toFixed(1)} unit="bp" tone="warn" sub="仅用户录入时扣除" /><Metric label="残余差" value={residual?.toFixed(1)} unit="bp" tone="neutral" sub="非 OAS、非报价" /></div> : <EmptyWorkState text="输入信用债和国债收益率后显示拆解结果。" />}<div className="mt-4 grid gap-2 sm:grid-cols-2"><a href="https://home.treasury.gov/resource-center/data-chart-center/interest-rates" target="_blank" rel="noreferrer" className="rounded border border-slate-800 p-2 text-xs text-slate-300 hover:border-cyan-800">美国财政部利率资源 <ExternalLink className="ml-1 inline h-3 w-3 text-cyan-300" /></a><a href="https://www.federalreserve.gov/releases/h15/" target="_blank" rel="noreferrer" className="rounded border border-slate-800 p-2 text-xs text-slate-300 hover:border-cyan-800">美联储 H.15 利率发布 <ExternalLink className="ml-1 inline h-3 w-3 text-cyan-300" /></a></div></Card>
    </div>
  </PanelShell>;
}

function CdsGovernancePanel() {
  const [rows, setRows] = useLocalRows<GovernanceRow[]>('credit-cds-governance-v1', []);
  const [draft, setDraft] = useState({ object: '', provider: '', status: '待核验', asOf: '', sourceUrl: '' });
  const add = () => { if (!draft.object.trim() || !draft.provider.trim()) return; setRows((current) => [...current, { id: makeId('cds'), ...draft }]); setDraft({ object: '', provider: '', status: '待核验', asOf: '', sourceUrl: '' }); };
  const tone = (value: string) => value === '已授权' ? 'pos' : value === '受限' ? 'warn' : 'neutral';
  return <PanelShell ticker="GCDS" title="全球 CDS 图表" subtitle="CDS 数据权限、延迟与实体覆盖治理">
    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.25fr]">
      <Card title="登记授权对象"><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">实体/指数<input value={draft.object} onChange={(e) => setDraft({ ...draft, object: e.target.value })} className="input-terminal mt-1 w-full" placeholder="例如：单名 / 指数" /></label><label className="text-xs text-slate-400">数据供应商<input value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} className="input-terminal mt-1 w-full" placeholder="录入已签约供应商" /></label><label className="text-xs text-slate-400">权限状态<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="input-terminal mt-1 w-full"><option>待核验</option><option>已授权</option><option>受限</option><option>已过期</option></select></label><label className="text-xs text-slate-400">核验日期<input type="date" value={draft.asOf} onChange={(e) => setDraft({ ...draft, asOf: e.target.value })} className="input-terminal mt-1 w-full" /></label><label className="text-xs text-slate-400 sm:col-span-2">授权记录/来源 URL<input type="url" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} className="input-terminal mt-1 w-full" placeholder="https://" /></label></div><button type="button" onClick={add} disabled={!draft.object.trim() || !draft.provider.trim()} className="mt-3 inline-flex items-center gap-1 rounded border border-violet-800 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-950/40 disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5" />登记核验状态</button></Card>
      <Card title="数据权限台账" action={<button type="button" onClick={() => downloadCsv('cds-permission-ledger.csv', ['对象', '供应商', '状态', '核验日', '记录'], rows.map((r) => [r.object, r.provider, r.status, r.asOf, r.sourceUrl]))} disabled={!rows.length} className="text-[11px] text-violet-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />CSV</button>}>{rows.length === 0 ? <EmptyWorkState text="尚未登记任何授权。系统不会在没有可验证授权时显示或推导 CDS 点位。" /> : <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 p-2"><div><p className="text-xs text-slate-200">{row.object} <span className="text-slate-500">· {row.provider}</span></p><p className="mt-0.5 text-[10px] text-slate-500">核验：{row.asOf || '未填'} {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 text-violet-300">原件 <ExternalLink className="inline h-3 w-3" /></a>}</p></div><div className="flex items-center gap-2"><Badge tone={tone(row.status) as 'pos' | 'warn' | 'neutral'}>{row.status}</Badge><button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div>}<p className="mt-3 text-[10px] text-amber-300">本页是治理台账，不是 CDS 行情屏幕。录入“已授权”不自动建立市场数据连接。</p></Card>
    </div>
  </PanelShell>;
}

function TermStructurePanel() {
  const [nodes, setNodes] = useLocalRows<CurveNode[]>('credit-term-structure-v1', []);
  const [draft, setDraft] = useState({ tenor: '', years: '', yieldPct: '', oasBps: '' });
  const add = () => { const years = Number(draft.years); if (!draft.tenor.trim() || !Number.isFinite(years) || years <= 0) return; setNodes((current) => [...current, { id: makeId('node'), ...draft }]); setDraft({ tenor: '', years: '', yieldPct: '', oasBps: '' }); };
  const curve = useMemo(() => nodes.map((n) => ({ ...n, x: Number(n.years), yieldValue: Number(n.yieldPct), oasValue: Number(n.oasBps) })).filter((n) => Number.isFinite(n.x)).sort((a, b) => a.x - b.x), [nodes]);
  const slope = curve.length >= 2 && Number.isFinite(curve[0].yieldValue) && Number.isFinite(curve[curve.length - 1].yieldValue) ? (curve[curve.length - 1].yieldValue - curve[0].yieldValue) * 100 : null;
  return <PanelShell ticker="6" title="收益曲线" subtitle="用户输入节点的期限结构研究">
    <div className="grid gap-3 xl:grid-cols-[0.8fr_1.35fr]">
      <Card title="新增曲线节点"><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">期限标签<input value={draft.tenor} onChange={(e) => setDraft({ ...draft, tenor: e.target.value })} className="input-terminal mt-1 w-full" placeholder="5Y" /></label><label className="text-xs text-slate-400">年数<input inputMode="decimal" value={draft.years} onChange={(e) => setDraft({ ...draft, years: e.target.value })} className="input-terminal mt-1 w-full" placeholder="5" /></label><label className="text-xs text-slate-400">收益率（%）<input inputMode="decimal" value={draft.yieldPct} onChange={(e) => setDraft({ ...draft, yieldPct: e.target.value })} className="input-terminal mt-1 w-full" placeholder="可选" /></label><label className="text-xs text-slate-400">OAS（bp）<input inputMode="decimal" value={draft.oasBps} onChange={(e) => setDraft({ ...draft, oasBps: e.target.value })} className="input-terminal mt-1 w-full" placeholder="可选" /></label></div><button type="button" onClick={add} disabled={!draft.tenor.trim() || !draft.years.trim()} className="mt-3 inline-flex items-center gap-1 rounded border border-cyan-800 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-950/40 disabled:opacity-40"><Plus className="h-3.5 w-3.5" />加入节点</button><p className="mt-3 text-[10px] text-slate-500">本模块不补齐未输入期限，也不会把不同币种、评级或流动性条件的节点拼接为同一曲线。</p></Card>
      <Card title="期限结构与斜率" action={<button type="button" onClick={() => downloadCsv('credit-term-structure.csv', ['期限', '年数', '收益率%', 'OASbp'], curve.map((n) => [n.tenor, n.x, n.yieldPct, n.oasBps]))} disabled={!curve.length} className="text-[11px] text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出节点</button>}>{curve.length === 0 ? <EmptyWorkState text="录入至少两个节点后，可比较期限方向；收益率与 OAS 可独立录入。" /> : <><div className="mb-2 grid gap-2 sm:grid-cols-3"><Metric label="节点数量" value={curve.length} /><Metric label="收益率首末斜率" value={slope === null ? '—' : slope.toFixed(1)} unit={slope === null ? undefined : 'bp'} tone={slope !== null && slope < 0 ? 'warn' : 'info'} /><Metric label="可用 OAS 节点" value={curve.filter((n) => Number.isFinite(n.oasValue)).length} /></div><div className="h-56 rounded border border-slate-800 bg-slate-950/50 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={curve}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="tenor" tick={{ fill: '#94a3b8', fontSize: 10 }} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} /><Line type="monotone" dataKey="yieldValue" name="收益率 %" stroke="#22d3ee" connectNulls={false} /><Line type="monotone" dataKey="oasValue" name="OAS bp" stroke="#f59e0b" connectNulls={false} /></LineChart></ResponsiveContainer></div><div className="mt-2 max-h-32 overflow-auto text-xs">{curve.map((node) => <div key={node.id} className="flex items-center justify-between border-b border-slate-800 py-1.5"><span className="font-mono text-slate-200">{node.tenor} · {node.x}Y</span><span className="text-slate-400">YTM {node.yieldPct || '—'}% · OAS {node.oasBps || '—'} bp</span><button type="button" onClick={() => setNodes((current) => current.filter((item) => item.id !== node.id))} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></>}</Card>
    </div>
  </PanelShell>;
}

function ChartComposerPanel() {
  const [selected, setSelected] = useLocalRows<string[]>('credit-chart-composer-v1', ['IG', 'HY']);
  const [days, setDays] = useState<30 | 90 | 180>(90);
  const query = trpc.creditResearch.getOasSnapshot.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: false });
  const visible = (query.data?.series ?? []).filter((item) => selected.includes(item.bucket));
  const chartData = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const byDate: Record<string, Record<string, string | number>> = {};
    visible.forEach((series) => series.history.forEach((point) => {
      if (new Date(point.date) < cutoff) return;
      byDate[point.date] = { ...(byDate[point.date] ?? {}), date: point.date, [series.bucket]: point.valuePct * 100 };
    }));
    return Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [visible, days]);
  const colors: Record<string, string> = { IG: '#22d3ee', AAA: '#a78bfa', AA: '#60a5fa', BBB: '#f59e0b', HY: '#fb7185' };
  const toggle = (bucket: string) => setSelected((current) => current.includes(bucket) ? current.filter((item) => item !== bucket) : [...current, bucket]);
  return <PanelShell ticker="GC" title="绘制曲线图" subtitle="OAS 序列编排与研究图输出" onRefresh={() => query.refetch()}>
    <div className="grid gap-3 xl:grid-cols-[0.75fr_1.45fr]">
      <Card title="图表编排"><p className="mb-3 text-xs text-slate-400">在同源 FRED/ICE BofA OAS 序列中选择图层；该操作不创建单券曲线或市场预测。</p><div className="space-y-2">{['IG', 'AAA', 'AA', 'BBB', 'HY'].map((bucket) => <label key={bucket} className="flex items-center justify-between rounded border border-slate-800 px-2 py-2 text-xs"><span><input type="checkbox" checked={selected.includes(bucket)} onChange={() => toggle(bucket)} className="mr-2" />{bucket}</span><span className="h-2 w-6 rounded" style={{ backgroundColor: colors[bucket] }} /></label>)}</div><div className="mt-4"><p className="mb-1 text-[11px] text-slate-500">观察窗口</p><div className="flex gap-1">{([30, 90, 180] as const).map((value) => <button key={value} type="button" onClick={() => setDays(value)} className={`rounded border px-2 py-1 text-xs ${days === value ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{value}D</button>)}</div></div></Card>
      <Card title="图表画布" action={<button type="button" onClick={() => downloadCsv('credit-chart-composer-data.csv', ['日期', ...visible.map((s) => s.bucket)], chartData.map((row) => [String(row.date), ...visible.map((s) => Number(row[s.bucket] ?? NaN).toString())]))} disabled={!chartData.length} className="text-[11px] text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出图层数据</button>}>{query.isLoading ? <div className="h-64 animate-pulse rounded bg-slate-800" /> : query.error ? <EmptyWorkState text="公开 OAS 当前不可读取；系统不会使用静态或随机路径替代。可点击标题栏刷新重试。" /> : !visible.length ? <EmptyWorkState text="请从左侧加入至少一个序列图层。" /> : <><div className="mb-2 flex items-center justify-between text-[10px] text-slate-500"><span>{visible.map((s) => s.bucket).join(' / ')} · {days} 日视图</span><span>源：FRED / ICE BofA 指数级日度 OAS</span></div><div className="h-64 rounded border border-slate-800 bg-slate-950/50 p-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={32} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 11 }} formatter={(value) => `${Number(value).toFixed(1)} bp`} />{visible.map((series) => <Line key={series.bucket} type="monotone" dataKey={series.bucket} stroke={colors[series.bucket]} strokeWidth={1.8} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div></>}</Card>
    </div>
  </PanelShell>;
}

function IndexGovernancePanel() {
  const [rows, setRows] = useLocalRows<IndexRow[]>('credit-index-governance-v1', []);
  const [draft, setDraft] = useState({ name: '', methodologyUrl: '', frequency: '日度', permission: '待核验', asOf: '' });
  const add = () => { if (!draft.name.trim()) return; setRows((current) => [...current, { id: makeId('index'), ...draft }]); setDraft({ name: '', methodologyUrl: '', frequency: '日度', permission: '待核验', asOf: '' }); };
  return <PanelShell ticker="WBIX" title="全球债券指数" subtitle="指数方法、许可与复现边界治理">
    <div className="grid gap-3 xl:grid-cols-[0.9fr_1.25fr]">
      <Card title="登记指数研究对象"><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">指数名称<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input-terminal mt-1 w-full" placeholder="录入研究指数" /></label><label className="text-xs text-slate-400">更新频率<select value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} className="input-terminal mt-1 w-full"><option>日度</option><option>月度</option><option>按再平衡</option><option>未知，待核验</option></select></label><label className="text-xs text-slate-400">方法文件 URL<input type="url" value={draft.methodologyUrl} onChange={(e) => setDraft({ ...draft, methodologyUrl: e.target.value })} className="input-terminal mt-1 w-full" placeholder="https://" /></label><label className="text-xs text-slate-400">许可状态<select value={draft.permission} onChange={(e) => setDraft({ ...draft, permission: e.target.value })} className="input-terminal mt-1 w-full"><option>待核验</option><option>方法公开，数值受限</option><option>已授权</option><option>不可用</option></select></label><label className="text-xs text-slate-400 sm:col-span-2">方法/许可核验日<input type="date" value={draft.asOf} onChange={(e) => setDraft({ ...draft, asOf: e.target.value })} className="input-terminal mt-1 w-full" /></label></div><button type="button" onClick={add} disabled={!draft.name.trim()} className="mt-3 inline-flex items-center gap-1 rounded border border-amber-800 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-950/40 disabled:opacity-40"><Database className="h-3.5 w-3.5" />建立治理卡</button></Card>
      <Card title="指数治理卡" action={<button type="button" onClick={() => downloadCsv('index-governance.csv', ['指数', '方法文件', '频率', '许可', '核验日'], rows.map((r) => [r.name, r.methodologyUrl, r.frequency, r.permission, r.asOf]))} disabled={!rows.length} className="text-[11px] text-amber-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出</button>}>{rows.length === 0 ? <EmptyWorkState text="请登记指数名称及其方法/许可状态。系统不会把公开 OAS 观察误称为指数成分或总回报。" /> : <div className="grid gap-2 md:grid-cols-2">{rows.map((row) => <article key={row.id} className="rounded border border-slate-800 bg-slate-950/40 p-3"><div className="flex justify-between gap-2"><h4 className="text-sm text-slate-100">{row.name}</h4><button type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div><dl className="mt-3 space-y-1 text-[11px]"><div className="flex justify-between"><dt className="text-slate-500">频率</dt><dd>{row.frequency}</dd></div><div className="flex justify-between"><dt className="text-slate-500">许可</dt><dd className="text-amber-300">{row.permission}</dd></div><div className="flex justify-between"><dt className="text-slate-500">核验</dt><dd>{row.asOf || '未填'}</dd></div></dl>{row.methodologyUrl ? <a href={row.methodologyUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300">方法文件 <ExternalLink className="h-3 w-3" /></a> : <p className="mt-3 text-[10px] text-amber-300">待补方法来源</p>}</article>)}</div>}</Card>
    </div>
  </PanelShell>;
}

function SeriesDiscoveryPanel() {
  const [queryText, setQueryText] = useState('');
  const [saved, setSaved] = useLocalRows<string[]>('credit-series-discovery-v1', []);
  const normalized = queryText.trim().toLowerCase();
  const results = FRED_SERIES.filter((item) => !normalized || `${item.id} ${item.name} ${item.group}`.toLowerCase().includes(normalized));
  const toggle = (id: string) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selected = FRED_SERIES.filter((item) => saved.includes(item.id));
  return <PanelShell ticker="INS" title="指数检索" subtitle="公开时间序列发现与研究清单">
    <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
      <Card title="已接入公开序列目录"><div className="flex gap-2"><label className="relative flex-1"><Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-500" /><input value={queryText} onChange={(e) => setQueryText(e.target.value)} className="input-terminal w-full pl-7" placeholder="按代码、评级或名称检索" /></label><a href="https://fred.stlouisfed.org/searchresults" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 text-xs text-cyan-300">FRED 搜索 <ExternalLink className="h-3.5 w-3.5" /></a></div><div className="mt-3 space-y-2">{results.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded border border-slate-800 p-2"><div><p className="font-mono text-xs text-cyan-200">{item.id}</p><p className="mt-0.5 text-xs text-slate-300">{item.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{item.group} · {item.frequency}</p></div><div className="flex gap-2"><a href={item.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-cyan-200" aria-label="打开 FRED 序列"><ExternalLink className="h-3.5 w-3.5" /></a><button type="button" onClick={() => toggle(item.id)} className={`rounded border px-2 py-1 text-[10px] ${saved.includes(item.id) ? 'border-cyan-800 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{saved.includes(item.id) ? '移出清单' : '加入清单'}</button></div></div>)}{results.length === 0 && <EmptyWorkState text="没有匹配的已接入公开序列。可使用 FRED 官方搜索继续发现，但发现结果需另行核验。" />}</div></Card>
      <Card title="本次研究序列清单" action={<button type="button" onClick={() => downloadCsv('credit-public-series-list.csv', ['代码', '名称', '分组', '频率', '来源'], selected.map((i) => [i.id, i.name, i.group, i.frequency, i.url]))} disabled={!selected.length} className="text-[11px] text-cyan-300 disabled:text-slate-600"><Download className="mr-1 inline h-3 w-3" />导出</button>}>{selected.length === 0 ? <EmptyWorkState text="尚未保存公开序列。加入清单后可导出研究目录。" /> : <div className="space-y-2">{selected.map((item) => <div key={item.id} className="rounded border border-slate-800 p-2"><p className="font-mono text-xs text-cyan-200">{item.id}</p><p className="mt-1 text-xs text-slate-300">{item.name}</p></div>)}</div>}<p className="mt-3 text-[10px] text-slate-500">本检索仅列出已验证接入的 FRED/ICE BofA 公开 OAS 系列；不表示覆盖全部指数，也不生成指数许可结论。</p></Card>
    </div>
  </PanelShell>;
}

export function isCreditSpecialistModule(moduleId: string) {
  return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'].includes(moduleId);
}

function CreditSpecialistContent({ moduleId }: CreditSpecialistPanelProps) {
  switch (moduleId) {
    case '1': return <DictionaryManagerPanel />;
    case '2': return <CreditChartExportPanels moduleId={moduleId} />;
    case '3': return <MarketCoveragePanel />;
    case '4': return <BenchmarkDecompositionPanel />;
    case '5': return <CdsGovernancePanel />;
    case '6': return <TermStructurePanel />;
    case '7': return <ChartComposerPanel />;
    case '8': return <CreditCoreSpecialistPanels moduleId={moduleId} />;
    case '9': return <CreditCoreSpecialistPanels moduleId={moduleId} />;
    case '10': return <CreditCoreSpecialistPanels moduleId={moduleId} />;
    case '11': return <IndexGovernancePanel />;
    case '12': return <SeriesDiscoveryPanel />;
    case '13': return <CreditIssuerAndAnalyticsPanels moduleId={moduleId} />;
    case '14': return <CreditIssuerAndAnalyticsPanels moduleId={moduleId} />;
    case '15': return <CreditChartExportPanels moduleId={moduleId} />;
    case '16': return <CreditIssuerAndAnalyticsPanels moduleId={moduleId} />;
    case '17': return <CreditAccountGovernancePanels moduleId={moduleId} />;
    case '18': return <CreditAccountGovernancePanels moduleId={moduleId} />;
    case '19': return <CreditPostTradeDeliveryPanels moduleId={moduleId} />;
    case '20': return <CreditPostTradeDeliveryPanels moduleId={moduleId} />;
    case '21': return <CreditAccountGovernancePanels moduleId={moduleId} />;
    case '22': return <CreditAccountGovernancePanels moduleId={moduleId} />;
    case '23': return <CreditCollaborationPanels moduleId={moduleId} />;
    case '24': return <CreditCollaborationPanels moduleId={moduleId} />;
    default: return null;
  }
}

export default function CreditSpecialistPanels({ moduleId }: CreditSpecialistPanelProps) {
  return <CreditTerminalSourceBoundary><CreditSpecialistContent moduleId={moduleId} /></CreditTerminalSourceBoundary>;
}
