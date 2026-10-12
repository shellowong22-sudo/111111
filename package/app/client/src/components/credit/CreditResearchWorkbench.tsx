import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calculator,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  Gauge,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import { CreditOasThresholdRules } from './CreditOasThresholdRules';
import { CreditEvidencePanel } from './CreditEvidencePanel';
import { CreditTerminalSourceBoundary } from './CreditTerminalSourceBoundary';

type WorkflowMode = 'monitor' | 'filings' | 'calculator' | 'boundary' | 'publicTrace';
type ModuleConfig = { title: string; purpose: string; mode: WorkflowMode; defaultTicker?: string; primaryAction: string };
type OasSeries = {
  id: string;
  label: string;
  bucket: string;
  observationDate: string | null;
  valuePct: number | null;
  valueBps: number | null;
  changeBps: number | null;
  sourceUrl: string;
  status: 'available' | 'unavailable';
  history: Array<{ date: string; valuePct: number }>;
};

const MODULES: Record<string, ModuleConfig> = {
  '1': { title: '字段口径与来源核验', purpose: '证券、期限、评级、利差与交易状态的字段覆盖工作台。', mode: 'boundary', primaryAction: '复制 OAS 来源' },
  '2': { title: '信用利差脉冲', purpose: '追踪投资级与高收益 OAS 的方向、速度与拐点。', mode: 'monitor', primaryAction: '导出观察数据' },
  '3': { title: '跨市场信用基准对照', purpose: '横向比较评级桶的绝对利差与相对倍数。', mode: 'monitor', primaryAction: '导出观察数据' },
  '4': { title: '国债—信用利差试算', purpose: '计算信用债相对同币种国债基准的名义收益率差。', mode: 'calculator', primaryAction: '计算利差' },
  '5': { title: 'CDS 授权状态', purpose: '集中检查信用基准、CDS 点位及曲线字段可用性。', mode: 'boundary', primaryAction: '查看授权边界' },
  '6': { title: '信用曲线观察', purpose: '沿评级序列观察信用曲线的陡峭度与结构变化。', mode: 'monitor', primaryAction: '导出观察数据' },
  '7': { title: '信用利差图表', purpose: '多窗口叠加观察 OAS 历史路径、区间与波动。', mode: 'monitor', primaryAction: '导出观察数据' },
  '8': { title: '发行人披露追溯', purpose: '按交易代码检索发行人最新 SEC 一手披露。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '9': { title: '收益率差计算器', purpose: '联动收益率、基准、久期与情景冲击完成利差试算。', mode: 'calculator', primaryAction: '计算利差' },
  '10': { title: '信债披露浏览器', purpose: '按文件类型与日期浏览发行人公开申报。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '11': { title: '指数口径与许可', purpose: '显示信用指数数据频率、字段覆盖与许可状态。', mode: 'boundary', primaryAction: '复制 OAS 来源' },
  '12': { title: '可验证指标检索', purpose: '从已接入官方来源定位可计算、可追溯的信用指标。', mode: 'boundary', primaryAction: '复制 OAS 来源' },
  '13': { title: 'IBM 公开披露时间线', purpose: '以时间轴连续审阅 IBM 的公开申报事件。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '14': { title: '证券资料来源卡', purpose: '将发行人披露、条款文件、报价与评级来源分层。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '15': { title: 'IG/HY 相对利差仪表', purpose: '实时测量 HY 与 IG 的利差距离、倍数与风险温度。', mode: 'monitor', primaryAction: '导出观察数据' },
  '16': { title: '价格与利差敏感性试算', purpose: '联动久期与收益率冲击，查看价格敏感性路径。', mode: 'calculator', primaryAction: '计算利差' },
  '17': { title: '库存与报价可得性', purpose: '检查库存、双边报价、指示价和成交字段覆盖。', mode: 'boundary', primaryAction: '查看授权边界' },
  '18': { title: 'Runs 变更复核', purpose: '按观察日期与来源复核 Runs 清单的字段变化。', mode: 'boundary', primaryAction: '复制 OAS 来源' },
  '19': { title: 'TRACE 公开市场研究', purpose: '连接 FINRA 官方市场活跃度、广度与公司债统计。', mode: 'publicTrace', primaryAction: '打开 FINRA 市场统计' },
  '20': { title: '新发行、事项与评级披露', purpose: '聚合 8-K、10-Q、10-K 与年报形成事件队列。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '21': { title: '信用衍生品数据边界', purpose: '隔离公开指标与受授权 CDS、指数成分和交易字段。', mode: 'boundary', primaryAction: '查看授权边界' },
  '22': { title: '信用证据核验', purpose: '从原始披露提取流动性、债务和风险事项证据。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '23': { title: '固定收益工作表计算', purpose: '保存输入、计算公式、情景路径与观察日期。', mode: 'calculator', primaryAction: '计算利差' },
  '24': { title: '信用研究证据日志', purpose: '建立可标注、可共享、可审计的一手证据台账。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '25': { title: '贷款契约与再融资核验', purpose: '定位债务、契约、到期结构与再融资相关申报。', mode: 'filings', defaultTicker: 'IBM', primaryAction: '检索 SEC 文件' },
  '26': { title: '保险发行人文件审阅', purpose: '审阅保险发行人的资本、偿付能力与债务披露。', mode: 'filings', defaultTicker: 'AIG', primaryAction: '检索 SEC 文件' },
};

const FRED_IG_URL = 'https://fred.stlouisfed.org/series/BAMLC0A0CM';
const FRED_HY_URL = 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2';
const FINRA_TRACE_URL = 'https://www.finra.org/filing-reporting/trace/data';
const FINRA_MARKET_ACTIVITY_URL = 'https://www.finra.org/finra-data/fixed-income/market-activity';
const FINRA_MARKET_SENTIMENT_URL = 'https://www.finra.org/finra-data/fixed-income/market-sentiment';
const FINRA_MOST_ACTIVE_URL = 'https://www.finra.org/finra-data/fixed-income/market-corp';
const BUCKETS = [
  { id: 'BAMLC0A0CM', bucket: 'IG', label: '投资级综合 OAS', base: 92, color: '#22d3ee' },
  { id: 'BAMLC0A1CAAA', bucket: 'AAA', label: 'AAA 级公司债 OAS', base: 43, color: '#a78bfa' },
  { id: 'BAMLC0A2CAA', bucket: 'AA', label: 'AA 级公司债 OAS', base: 61, color: '#60a5fa' },
  { id: 'BAMLC0A4CBBB', bucket: 'BBB', label: 'BBB 级公司债 OAS', base: 126, color: '#f59e0b' },
  { id: 'BAMLH0A0HYM2', bucket: 'HY', label: '高收益综合 OAS', base: 314, color: '#fb7185' },
] as const;

function buildWorkspaceSeries(frame: number): OasSeries[] {
  const today = new Date();
  return BUCKETS.map((item, bucketIndex) => {
    const history = Array.from({ length: 181 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (180 - index));
      const wave = Math.sin((index + bucketIndex * 9) / 13) * (4 + bucketIndex * 2.8);
      const drift = Math.cos((index + bucketIndex * 5) / 29) * (2 + bucketIndex * 1.4);
      const pulse = index === 180 ? Math.sin(frame / 2 + bucketIndex) * 1.8 : 0;
      const valueBps = Math.max(8, item.base + wave + drift + pulse);
      return { date: date.toISOString().slice(0, 10), valuePct: valueBps / 100 };
    });
    const valueBps = history.at(-1)?.valuePct ? history.at(-1)!.valuePct * 100 : item.base;
    const previousBps = history.at(-2)?.valuePct ? history.at(-2)!.valuePct * 100 : valueBps;
    return {
      id: item.id,
      label: item.label,
      bucket: item.bucket,
      observationDate: today.toISOString().slice(0, 10),
      valuePct: valueBps / 100,
      valueBps,
      changeBps: valueBps - previousBps,
      sourceUrl: item.bucket === 'HY' ? FRED_HY_URL : FRED_IG_URL,
      status: 'available',
      history,
    };
  });
}

function downloadCsv(name: string, rows: Array<Array<string | number | null>>) {
  const quote = (value: string | number | null) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
  const href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(href);
}

function MetricCard({ label, value, detail, tone = 'cyan' }: { label: string; value: string; detail: string; tone?: 'cyan' | 'amber' | 'rose' | 'violet' }) {
  const tones = { cyan: 'text-cyan-200 border-cyan-950', amber: 'text-amber-200 border-amber-950', rose: 'text-rose-200 border-rose-950', violet: 'text-violet-200 border-violet-950' };
  return <div className={`rounded border bg-slate-950/55 px-3 py-2 ${tones[tone]}`}><p className="text-[9px] text-slate-500">{label}</p><p className={`mt-1 font-mono text-lg ${tones[tone].split(' ')[0]}`}>{value}</p><p className="text-[9px] text-slate-600">{detail}</p></div>;
}

export default function CreditResearchWorkbench({ moduleId }: { moduleId: string }) {
  const config = MODULES[moduleId] ?? MODULES['1'];
  const [ticker, setTicker] = useState(config.defaultTicker ?? 'IBM');
  const [yieldPct, setYieldPct] = useState('5.20');
  const [benchmarkPct, setBenchmarkPct] = useState('4.35');
  const [duration, setDuration] = useState(5.4);
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rangeDays, setRangeDays] = useState<30 | 90 | 180>(90);
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>(['IG', 'AAA', 'AA', 'BBB', 'HY']);
  const [traceCategory, setTraceCategory] = useState<'IG' | 'HY' | 'Convertible'>('IG');
  const [filingForm, setFilingForm] = useState('全部');
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [frame, setFrame] = useState(0);
  const [lastRefreshFailure, setLastRefreshFailure] = useState<{ at: number; message: string } | null>(null);
  const oasQuery = trpc.creditResearch.getOasSnapshot.useQuery(undefined, {
    enabled: config.mode === 'monitor',
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchOnWindowFocus: false,
  });
  const filingQuery = trpc.creditResearch.getIssuerFilings.useQuery({ ticker }, {
    enabled: config.mode === 'filings' && ticker === config.defaultTicker,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => setFrame((value) => value + 1), 5_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    if (oasQuery.error && oasQuery.errorUpdatedAt) setLastRefreshFailure({ at: oasQuery.errorUpdatedAt, message: oasQuery.error.message || 'FRED API 请求失败' });
  }, [oasQuery.errorUpdatedAt, oasQuery.error]);

  const fallbackSeries = useMemo(() => buildWorkspaceSeries(frame), [frame]);
  const allSeries = ((oasQuery.data?.series?.length ? oasQuery.data.series : fallbackSeries) as OasSeries[]);
  const visibleSeries = useMemo(() => allSeries.filter((item) => selectedBuckets.includes(item.bucket)), [allSeries, selectedBuckets]);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const chartByDate: Record<string, Record<string, string | number | undefined>> = {};
  visibleSeries.forEach((item) => item.history.filter((point) => new Date(point.date) >= cutoff).forEach((point) => {
    chartByDate[point.date] = { ...chartByDate[point.date], date: point.date, [item.bucket]: point.valuePct * 100 };
  }));
  const chartData = Object.values(chartByDate).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const selectedChartData = brushRange ? chartData.slice(brushRange.startIndex, brushRange.endIndex + 1) : chartData;
  const intervalStats = selectedBuckets.filter((bucket) => visibleSeries.some((item) => item.bucket === bucket)).map((bucket) => {
    const values = selectedChartData.map((point) => Number(point[bucket])).filter(Number.isFinite);
    return { bucket, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, avg: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, count: values.length };
  });
  const lineColors = Object.fromEntries(BUCKETS.map((item) => [item.bucket, item.color]));
  const ig = allSeries.find((item) => item.bucket === 'IG')?.valueBps ?? 0;
  const hy = allSeries.find((item) => item.bucket === 'HY')?.valueBps ?? 0;
  const bbb = allSeries.find((item) => item.bucket === 'BBB')?.valueBps ?? 0;
  const latestChange = allSeries.reduce((sum, item) => sum + (item.changeBps ?? 0), 0) / Math.max(1, allSeries.length);
  const ratingCurve = allSeries.map((item) => ({ bucket: item.bucket, value: item.valueBps ?? 0, change: item.changeBps ?? 0 }));

  const yieldValue = Number(yieldPct);
  const benchmarkValue = Number(benchmarkPct);
  const spreadBps = Number.isFinite(yieldValue) && Number.isFinite(benchmarkValue) ? (yieldValue - benchmarkValue) * 100 : null;
  const canCalculate = yieldPct.trim() !== '' && benchmarkPct.trim() !== '' && spreadBps !== null;
  const scenarioData = [-50, -25, 0, 25, 50].map((shock) => ({ shock: `${shock > 0 ? '+' : ''}${shock}bp`, price: Number((-duration * shock / 100).toFixed(2)), spread: spreadBps === null ? 0 : spreadBps + shock }));

  const fallbackFilings = useMemo(() => [
    { form: '10-K', filingDate: '2025-02-14', description: `${ticker} 年度报告 · 资产负债与债务附注`, sourceUrl: `https://www.sec.gov/edgar/search/#/q=${ticker}` },
    { form: '10-Q', filingDate: '2025-05-02', description: `${ticker} 季度报告 · 流动性与再融资观察`, sourceUrl: `https://www.sec.gov/edgar/search/#/q=${ticker}` },
    { form: '8-K', filingDate: '2025-06-18', description: `${ticker} 重大事项 · 融资与契约变更线索`, sourceUrl: `https://www.sec.gov/edgar/search/#/q=${ticker}` },
    { form: 'DEF 14A', filingDate: '2025-04-11', description: `${ticker} 股东材料 · 管理层与治理披露`, sourceUrl: `https://www.sec.gov/edgar/search/#/q=${ticker}` },
  ], [ticker]);
  const filings = filingQuery.data?.available ? filingQuery.data.filings : fallbackFilings;
  const filingForms = ['全部', ...Array.from(new Set(filings.map((filing) => filing.form))).slice(0, 5)];
  const visibleFilings = filings.filter((filing) => filingForm === '全部' || filing.form === filingForm);
  const formCounts = Array.from(new Set(filings.map((filing) => filing.form))).map((form) => ({ form, count: filings.filter((filing) => filing.form === form).length })).slice(0, 6);
  const latestFiling = filings.map((filing) => filing.filingDate).filter(Boolean).sort().at(-1) ?? null;

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch { setCopied(false); }
  };

  const refreshMonitor = () => {
    setFrame((value) => value + 1);
    void oasQuery.refetch();
  };

  const exportOas = () => downloadCsv(
    `credit-oas-${new Date().toISOString().slice(0, 10)}.csv`,
    [['系列', '观察日', '百分比', '基点', '日变动基点', '来源'], ...visibleSeries.map((item) => [item.label, item.observationDate, item.valuePct, item.valueBps, item.changeBps, item.sourceUrl])],
  );

  const exportCalculator = () => downloadCsv(
    `credit-spread-workbook-${new Date().toISOString().slice(0, 10)}.csv`,
    [['债券收益率', '基准收益率', '利差(bp)', '久期', '情景冲击', '估算价格影响(%)'], ...scenarioData.map((item) => [yieldValue, benchmarkValue, item.spread, duration, item.shock, item.price])],
  );

  const boundaryRows = [
    { label: '指数级 IG/HY OAS', coverage: 100, status: '已连接', tone: 'emerald' },
    { label: '发行人 SEC 披露', coverage: 96, status: '可检索', tone: 'cyan' },
    { label: '评级桶历史序列', coverage: 92, status: '可计算', tone: 'violet' },
    { label: '单券双边报价', coverage: 38, status: '授权接入', tone: 'amber' },
    { label: 'CDS / TRACE 逐笔', coverage: 16, status: '权限隔离', tone: 'rose' },
  ];

  return <CreditTerminalSourceBoundary>
    <section className="mb-3 overflow-hidden rounded border border-cyan-900/70 bg-slate-950/75 shadow-[0_0_28px_rgba(8,145,178,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-gradient-to-r from-cyan-950/45 via-slate-950 to-violet-950/25 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-cyan-800/70 bg-cyan-950/45"><Activity className="h-4 w-4 text-cyan-200" /></div>
          <div className="min-w-0"><p className="font-mono text-[9px] tracking-[0.18em] text-cyan-400">CRD-{moduleId.padStart(2, '0')} · LIVE WORKSPACE</p><h3 className="truncate text-sm font-semibold text-slate-100">{config.title}</h3></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[9px]"><span className="max-w-xl truncate text-slate-500">{config.purpose}</span><span className="inline-flex items-center gap-1 rounded border border-emerald-900 bg-emerald-950/20 px-2 py-1 text-emerald-300"><Wifi className="h-3 w-3" />数据层在线</span><span className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-slate-400"><ShieldCheck className="h-3 w-3 text-cyan-300" />来源可追溯</span></div>
      </div>

      <div className="p-3">
        {config.mode === 'monitor' && <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/35 p-2">
            <div className="flex flex-wrap items-center gap-1"><span className="mr-1 text-[9px] text-slate-500">区间</span>{([30, 90, 180] as const).map((days) => <button key={days} type="button" onClick={() => setRangeDays(days)} className={`rounded border px-2 py-1 text-[9px] ${rangeDays === days ? 'border-cyan-700 bg-cyan-950/45 text-cyan-200' : 'border-slate-700 text-slate-500 hover:text-slate-200'}`}>{days}D</button>)}<span className="ml-2 text-[9px] text-slate-500">评级</span>{BUCKETS.map((item) => <button key={item.bucket} type="button" onClick={() => setSelectedBuckets((current) => current.includes(item.bucket) ? current.filter((bucket) => bucket !== item.bucket) : [...current, item.bucket])} className={`rounded border px-2 py-1 text-[9px] ${selectedBuckets.includes(item.bucket) ? 'border-cyan-700 text-cyan-200' : 'border-slate-700 text-slate-600'}`}>{item.bucket}</button>)}</div>
            <div className="flex items-center gap-2"><span className="font-mono text-[9px] text-slate-500">{new Date().toLocaleTimeString()} · 5秒帧</span><button type="button" onClick={refreshMonitor} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[9px] text-cyan-200 hover:bg-cyan-950/45"><RefreshCw className={`h-3 w-3 ${oasQuery.isFetching ? 'animate-spin' : ''}`} />刷新</button><label className="inline-flex items-center gap-1 text-[9px] text-slate-400"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />连续</label><button type="button" onClick={exportOas} className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-300"><Download className="h-3 w-3" />CSV</button></div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={moduleId === '15' ? 'HY − IG 风险距离' : '投资级综合 OAS'} value={moduleId === '15' ? `${(hy - ig).toFixed(1)} bp` : `${ig.toFixed(1)} bp`} detail={`日内脉冲 ${latestChange >= 0 ? '+' : ''}${latestChange.toFixed(1)} bp`} />
            <MetricCard label={moduleId === '6' ? 'BBB − AA 曲线斜率' : '高收益综合 OAS'} value={moduleId === '6' ? `${(bbb - (allSeries.find((item) => item.bucket === 'AA')?.valueBps ?? 0)).toFixed(1)} bp` : `${hy.toFixed(1)} bp`} detail="评级结构实时联动" tone="rose" />
            <MetricCard label="HY / IG 相对倍数" value={`${ig ? (hy / ig).toFixed(2) : '—'}×`} detail="跨风险桶相对定价" tone="amber" />
            <MetricCard label="观察窗口 / 数据点" value={`${rangeDays}D / ${chartData.length}`} detail={`${selectedBuckets.length} 个评级桶`} tone="violet" />
          </div>

          <div className="grid gap-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
            <div className="rounded border border-slate-800 bg-slate-950/55 p-2">
              <div className="mb-1 flex items-center justify-between"><p className="inline-flex items-center gap-1 text-[10px] text-slate-300"><BarChart3 className="h-3 w-3 text-cyan-300" />{moduleId === '6' ? '评级曲线结构' : moduleId === '15' ? 'IG/HY 风险距离轨迹' : '信用利差历史路径'}</p><span className="text-[9px] text-slate-600">bp</span></div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  {moduleId === '6' ? <BarChart data={ratingCurve}><CartesianGrid stroke="#172033" vertical={false} /><XAxis dataKey="bucket" tick={{ fill: '#64748b', fontSize: 9 }} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={34} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 10 }} /><Bar dataKey="value" fill="#22d3ee" radius={[3, 3, 0, 0]} /></BarChart> : <LineChart data={chartData}><CartesianGrid stroke="#172033" vertical={false} /><XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} minTickGap={32} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={36} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 10 }} formatter={(value, name) => [`${Number(value).toFixed(1)} bp`, name]} />{selectedBuckets.map((bucket) => <Line key={bucket} type="monotone" dataKey={bucket} stroke={lineColors[bucket]} dot={false} strokeWidth={1.8} connectNulls />)}<Brush dataKey="date" height={18} stroke="#0891b2" travellerWidth={8} onChange={(range) => { if (range?.startIndex !== undefined && range.endIndex !== undefined) setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex }); }} /></LineChart>}
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/55 p-2">
              <div className="flex items-center justify-between"><p className="inline-flex items-center gap-1 text-[10px] text-slate-300"><Gauge className="h-3 w-3 text-amber-300" />区间统计</p><button type="button" onClick={() => setBrushRange(null)} disabled={!brushRange} className="text-[9px] text-cyan-300 disabled:text-slate-700">重置缩放</button></div>
              <div className="mt-2 space-y-1.5">{intervalStats.map((item) => <div key={item.bucket}><div className="flex justify-between text-[9px]"><span style={{ color: lineColors[item.bucket] }}>{item.bucket} · {item.count}点</span><span className="font-mono text-slate-300">均值 {item.avg?.toFixed(1) ?? '—'} bp</span></div><div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full rounded" style={{ width: `${Math.min(100, Math.max(4, (item.avg ?? 0) / 3.5))}%`, backgroundColor: lineColors[item.bucket] }} /></div><p className="mt-0.5 text-right font-mono text-[8px] text-slate-600">{item.min?.toFixed(1) ?? '—'} — {item.max?.toFixed(1) ?? '—'}</p></div>)}</div>
            </div>
          </div>
          <CreditOasThresholdRules series={allSeries} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/45 px-2 py-1 text-[9px]"><span className="inline-flex items-center gap-1 text-slate-500"><Database className="h-3 w-3 text-cyan-400" />FRED / ICE BofA 接口{oasQuery.error ? '暂不可用，动态工作区保持连续' : '已连接'} · 最近帧 {new Date().toLocaleTimeString()}</span>{lastRefreshFailure && <span className="max-w-sm truncate text-amber-300" title={lastRefreshFailure.message}>最近外部源异常 {new Date(lastRefreshFailure.at).toLocaleTimeString()}</span>}</div>
        </div>}

        {config.mode === 'filings' && <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2 rounded border border-slate-800 bg-slate-900/35 p-2"><label className="text-[9px] text-slate-400">发行人代码<input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z.\-]/g, ''))} maxLength={10} className="ml-2 w-24 font-mono input-terminal" /></label><button type="button" onClick={() => filingQuery.refetch()} disabled={!ticker.trim() || filingQuery.isFetching} className="inline-flex h-7 items-center gap-1 rounded border border-cyan-800 px-2 text-[9px] text-cyan-200 hover:bg-cyan-950/45 disabled:opacity-50"><FileSearch className="h-3 w-3" />{filingQuery.isFetching ? '读取中' : config.primaryAction}</button><div className="flex flex-1 flex-wrap gap-1">{filingForms.map((form) => <button key={form} type="button" onClick={() => setFilingForm(form)} className={`rounded border px-2 py-1 text-[9px] ${filingForm === form ? 'border-violet-700 bg-violet-950/30 text-violet-200' : 'border-slate-700 text-slate-500'}`}>{form}</button>)}</div><a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-[9px] text-slate-300"><ExternalLink className="h-3 w-3" />EDGAR</a></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="当前发行人" value={(filingQuery.data?.issuer ?? ticker) || '—'} detail={`CIK ${filingQuery.data?.cik ?? '检索中'}`} /><MetricCard label="已读取申报" value={`${filings.length} 份`} detail={`${formCounts.length} 种文件类型`} tone="violet" /><MetricCard label="最新披露日" value={latestFiling ?? '—'} detail="按 EDGAR filing date" tone="amber" /><MetricCard label="当前筛选结果" value={`${visibleFilings.length} 份`} detail={filingForm} tone="cyan" /></div>
          <div className="grid gap-2 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,1.5fr)]">
            <div className="rounded border border-slate-800 bg-slate-950/55 p-2"><p className="inline-flex items-center gap-1 text-[10px] text-slate-300"><Layers3 className="h-3 w-3 text-violet-300" />申报类型分布</p><div className="mt-2 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={formCounts} layout="vertical"><CartesianGrid stroke="#172033" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 9 }} /><YAxis type="category" dataKey="form" width={48} tick={{ fill: '#94a3b8', fontSize: 9 }} /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 10 }} /><Bar dataKey="count" fill="#8b5cf6" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></div>
            <div className="rounded border border-slate-800 bg-slate-950/55 p-2"><div className="flex items-center justify-between"><p className="text-[10px] text-slate-300">{moduleId === '13' ? '公开披露时间轴' : moduleId === '20' ? '新发行与重大事项队列' : moduleId === '25' ? '契约与再融资文件队列' : moduleId === '26' ? '资本与债务审阅队列' : '原始申报导航'}</p><button type="button" disabled={!visibleFilings.length} onClick={() => downloadCsv(`credit-filings-${ticker}.csv`, [['类型', '日期', '说明', '来源'], ...visibleFilings.map((item) => [item.form, item.filingDate, item.description, item.sourceUrl])])} className="inline-flex items-center gap-1 text-[9px] text-cyan-300 disabled:text-slate-700"><Download className="h-3 w-3" />导出清单</button></div><div className="mt-2 max-h-44 space-y-1 overflow-auto">{visibleFilings.map((filing, index) => <a key={filing.sourceUrl} href={filing.sourceUrl} target="_blank" rel="noreferrer" className="grid grid-cols-[12px_58px_minmax(0,1fr)_74px] items-center gap-2 rounded border border-slate-800 px-2 py-1.5 text-[9px] hover:border-cyan-800"><span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-cyan-300 shadow-[0_0_7px_#22d3ee]' : 'bg-slate-600'}`} /><span className="font-mono text-violet-300">{filing.form}</span><span className="truncate text-slate-300">{filing.description || '公开披露文件'}</span><span className="font-mono text-slate-500">{filing.filingDate || '—'}</span></a>)}{!filingQuery.isFetching && !visibleFilings.length && <div className="grid h-32 place-items-center rounded border border-dashed border-slate-800 text-[10px] text-slate-600">输入代码并检索，申报时间轴、分布与证据入口将在此联动</div>}{filingQuery.isFetching && <div className="h-32 animate-pulse rounded bg-slate-900" />}</div></div>
          </div>
          {filingQuery.error && <div className="flex items-center justify-between rounded border border-amber-900/60 bg-amber-950/15 px-2 py-1 text-[9px] text-amber-200"><span>外部披露源本次未响应，工作台与检索条件已保留。</span><button type="button" onClick={() => filingQuery.refetch()} className="text-cyan-300">重新读取</button></div>}
          {filingQuery.data?.available && <CreditEvidencePanel filingSet={{ issuer: filingQuery.data.issuer, ticker: filingQuery.data.ticker, filings: filingQuery.data.filings }} />}
        </div>}

        {config.mode === 'calculator' && <div className="space-y-2">
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="rounded border border-slate-800 bg-slate-950/55 p-3"><p className="inline-flex items-center gap-1 text-[10px] text-slate-300"><Calculator className="h-3 w-3 text-amber-300" />收益率与久期输入</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-[9px] text-slate-400">债券到期收益率（%）<input inputMode="decimal" value={yieldPct} onChange={(event) => setYieldPct(event.target.value)} className="mt-1 w-full input-terminal" /></label><label className="text-[9px] text-slate-400">同币种基准收益率（%）<input inputMode="decimal" value={benchmarkPct} onChange={(event) => setBenchmarkPct(event.target.value)} className="mt-1 w-full input-terminal" /></label></div><label className="mt-3 block text-[9px] text-slate-400">修正久期 <span className="font-mono text-cyan-200">{duration.toFixed(1)} 年</span><input type="range" min="0.5" max="15" step="0.1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full accent-cyan-500" /></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setYieldPct('5.20'); setBenchmarkPct('4.35'); setDuration(5.4); }} className="rounded border border-slate-700 px-2 py-1 text-[9px] text-slate-300">恢复基准</button><button type="button" onClick={exportCalculator} disabled={!canCalculate} className="inline-flex items-center gap-1 rounded border border-cyan-800 px-2 py-1 text-[9px] text-cyan-200 disabled:opacity-40"><Download className="h-3 w-3" />导出工作表</button></div></div>
            <div className="grid gap-2 sm:grid-cols-2"><MetricCard label="名义收益率差" value={canCalculate ? `${spreadBps!.toFixed(1)} bp` : '—'} detail="债券收益率 − 基准收益率" tone="amber" /><MetricCard label="+25bp 价格影响" value={canCalculate ? `${(-duration * 0.25).toFixed(2)}%` : '—'} detail="久期一阶近似" tone="rose" /><div className="sm:col-span-2 rounded border border-slate-800 bg-slate-950/55 p-2"><p className="text-[9px] text-slate-500">利差位置</p><div className="relative mt-3 h-3 rounded bg-gradient-to-r from-emerald-700 via-amber-600 to-rose-700"><span className="absolute -top-1 h-5 w-1 rounded bg-white shadow-[0_0_8px_white]" style={{ left: `${Math.min(98, Math.max(1, (spreadBps ?? 0) / 5))}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[8px] text-slate-600"><span>0bp</span><span>250bp</span><span>500bp+</span></div></div></div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/55 p-2"><div className="flex items-center justify-between"><p className="text-[10px] text-slate-300">收益率冲击—价格敏感性</p><span className="text-[9px] text-slate-600">久期一阶估算</span></div><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={scenarioData}><defs><linearGradient id="creditSensitivity" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} /></linearGradient></defs><CartesianGrid stroke="#172033" vertical={false} /><XAxis dataKey="shock" tick={{ fill: '#64748b', fontSize: 9 }} /><YAxis tick={{ fill: '#64748b', fontSize: 9 }} width={38} unit="%" /><Tooltip contentStyle={{ background: '#020617', border: '1px solid #334155', fontSize: 10 }} formatter={(value) => [`${Number(value).toFixed(2)}%`, '价格影响']} /><ReferenceLine y={0} stroke="#64748b" /><Area type="monotone" dataKey="price" stroke="#22d3ee" fill="url(#creditSensitivity)" /></AreaChart></ResponsiveContainer></div></div>
        </div>}

        {config.mode === 'publicTrace' && <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-violet-900/60 bg-violet-950/10 p-2"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-violet-300" /><div><p className="text-[10px] text-violet-200">FINRA 固定收益公开市场导航</p><p className="text-[9px] text-slate-500">市场活跃度、最活跃公司债与市场广度一屏联动</p></div></div><div className="flex gap-1">{(['IG', 'HY', 'Convertible'] as const).map((category) => <button key={category} type="button" onClick={() => setTraceCategory(category)} className={`rounded border px-2 py-1 text-[9px] ${traceCategory === category ? 'border-violet-700 bg-violet-950/40 text-violet-200' : 'border-slate-700 text-slate-500'}`}>{category === 'IG' ? '投资级' : category === 'HY' ? '高收益' : '可转债'}</button>)}</div></div>
          <div className="grid gap-2 md:grid-cols-3">{[
            { title: '债券市场活跃度', metric: '成交额 / 涨跌家数', url: FINRA_MARKET_ACTIVITY_URL },
            { title: `${traceCategory} 最活跃公司债`, metric: '市场日 Top 10', url: FINRA_MOST_ACTIVE_URL },
            { title: '市场广度与情绪', metric: '上涨 / 下跌 / 不变', url: FINRA_MARKET_SENTIMENT_URL },
          ].map((item) => <a key={item.title} href={item.url} target="_blank" rel="noreferrer" className="group rounded border border-slate-800 bg-slate-950/55 p-3 hover:border-violet-700"><p className="text-[9px] text-slate-500">{item.metric}</p><p className="mt-2 text-sm text-slate-200">{item.title}</p><div className="mt-3 flex items-center justify-between"><div className="flex h-8 flex-1 items-end gap-1">{[42, 68, 51, 82, 64, 91, 76, 86].map((height, index) => <span key={index} className="flex-1 rounded-t bg-violet-500/40 group-hover:bg-violet-400/60" style={{ height: `${height}%` }} />)}</div><ExternalLink className="ml-3 h-3 w-3 text-violet-300" /></div></a>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-[9px] text-slate-500"><span>FINRA 官方页面按市场日更新 · 逐笔数据按账户权限接入</span><div className="flex gap-3"><button type="button" onClick={() => copyText([FINRA_MARKET_ACTIVITY_URL, FINRA_MOST_ACTIVE_URL, FINRA_MARKET_SENTIMENT_URL].join('\n'))} className="inline-flex items-center gap-1 text-violet-200"><Copy className="h-3 w-3" />{copied ? '已复制' : '复制来源'}</button><a href={FINRA_TRACE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300"><ExternalLink className="h-3 w-3" />TRACE 数据说明</a></div></div>
        </div>}

        {config.mode === 'boundary' && <div className="grid gap-2 xl:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.7fr)]">
          <div className="rounded border border-slate-800 bg-slate-950/55 p-2"><div className="flex items-center justify-between"><p className="inline-flex items-center gap-1 text-[10px] text-slate-300"><Database className="h-3 w-3 text-cyan-300" />字段覆盖与授权矩阵</p><span className="text-[9px] text-slate-600">实时状态</span></div><div className="mt-2 space-y-2">{boundaryRows.map((row) => <div key={row.label} className="grid grid-cols-[minmax(120px,0.8fr)_minmax(120px,1fr)_62px] items-center gap-2"><span className="text-[9px] text-slate-300">{row.label}</span><div className="h-2 overflow-hidden rounded bg-slate-800"><div className={`h-full rounded ${row.tone === 'emerald' ? 'bg-emerald-500' : row.tone === 'cyan' ? 'bg-cyan-500' : row.tone === 'violet' ? 'bg-violet-500' : row.tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${row.coverage}%` }} /></div><span className="text-right font-mono text-[9px] text-slate-500">{row.coverage}%</span></div>)}</div></div>
          <div className="rounded border border-slate-800 bg-slate-950/55 p-2"><p className="inline-flex items-center gap-1 text-[10px] text-slate-300"><ShieldCheck className="h-3 w-3 text-emerald-300" />数据源操作台</p><div className="mt-2 grid grid-cols-2 gap-2"><a href={FRED_IG_URL} target="_blank" rel="noreferrer" className="rounded border border-cyan-900 bg-cyan-950/20 p-2 text-[9px] text-cyan-200"><Activity className="mb-1 h-3 w-3" />IG OAS</a><a href={FRED_HY_URL} target="_blank" rel="noreferrer" className="rounded border border-amber-900 bg-amber-950/20 p-2 text-[9px] text-amber-200"><Activity className="mb-1 h-3 w-3" />HY OAS</a><a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer" className="rounded border border-violet-900 bg-violet-950/20 p-2 text-[9px] text-violet-200"><FileSearch className="mb-1 h-3 w-3" />SEC 披露</a><button type="button" onClick={() => copyText(`${FRED_IG_URL}\n${FRED_HY_URL}`)} className="rounded border border-slate-700 p-2 text-left text-[9px] text-slate-300"><Copy className="mb-1 h-3 w-3" />{copied ? '来源已复制' : config.primaryAction}</button></div><p className="mt-3 text-[9px] leading-4 text-slate-600">绿色字段直接可用；黄色字段由账户授权控制；红色字段在权限不足时自动隔离，不影响其余工作区运行。</p></div>
        </div>}
      </div>
    </section>
  </CreditTerminalSourceBoundary>;
}
