import React, { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INDUSTRY_GROUP_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useModuleLiveFeed } from "@/hooks/useModuleLiveFeed";
import ModuleLiveDeliveryTable from "../ModuleLiveDeliveryTable";

type IndustryCode = (typeof INDUSTRY_GROUP_CAPABILITIES)[number]["id"];

const METRIC_PATTERNS: Record<IndustryCode, RegExp | null> = {
  CLASS: null,
  MEMBERS: null,
  QUOTES: /price|quote|close|行情|价格|收盘/i,
  RETURNS: /return|change|涨跌|收益/i,
  VOLUME: /volume|turnover|成交|换手/i,
  FLOW: /flow|inflow|outflow|资金流|净流入/i,
  BREADTH: /breadth|advance|decline|new high|new low|宽度|上涨|下跌|新高|新低/i,
  VALUATION: /pe\b|pb\b|ev|multiple|valuation|估值|市盈|市净/i,
  EARNINGS: /earnings|income|roe|margin|盈利|净利润|利润率/i,
  FORECAST: /forecast|estimate|consensus|revision|预测|预期|一致预期|修订/i,
  REVENUE: /revenue|sales|营收|收入/i,
  PROFIT: /profit|net income|operating income|利润|净利/i,
  BALANCE: /asset|liabilit|debt|leverage|资产|负债|杠杆/i,
  CASHFLOW: /cash flow|fcf|operating cash|现金流/i,
  CAPEX: /capex|capital expenditure|资本开支/i,
  DIVIDEND: /dividend|yield|payout|股息|分红|派息/i,
  VOLATILITY: /volatility|variance|波动/i,
  CORRELATION: null,
  ROTATION: /relative|momentum|rotation|return|相对|动量|轮动|收益/i,
  CONTRIBUTION: /contribution|weight|贡献|权重/i,
  CYCLE: null,
  STRESS: /stress|exposure|sensitivity|shock|压力|敞口|敏感/i,
};

const LENS_SPEC: Record<IndustryCode, { input: string; method: string; output: string }> = {
  CLASS: { input: "分类体系、版本、生效日与唯一行业归属", method: "按批次分类版本汇总行业组、成分和来源覆盖", output: "分类层级与覆盖缺口" },
  MEMBERS: { input: "证券标识、行业组、权重、观察时点与来源", method: "保留证券级记录并拒绝跨单位合并", output: "成分明细与来源定位" },
  QUOTES: { input: "行业价格或报价指标、币种、市场时点", method: "仅聚合同名同单位报价，不把旧值标记为实时", output: "行业报价横截面" },
  RETURNS: { input: "行业收益或涨跌指标与共同观察区间", method: "按行业和同一收益口径比较平均、中位及区间", output: "行业涨跌分布" },
  VOLUME: { input: "成交量、成交额或换手率及对应单位", method: "按成交口径分组并展示覆盖与极值", output: "交易活跃度与集中度" },
  FLOW: { input: "净流入、流入或流出及币种和来源", method: "隔离不同币种和资金流定义后进行横截面对比", output: "行业资金迁移" },
  BREADTH: { input: "上涨、下跌、新高、新低或宽度指标", method: "按行业汇总参与度指标，不以指数涨跌替代宽度", output: "行业内部扩散" },
  VALUATION: { input: "PE、PB、EV 倍数及有效样本覆盖", method: "分指标和单位展示平均、中位与极值", output: "行业估值横截面" },
  EARNINGS: { input: "利润、ROE 或利润率及报告期", method: "按盈利指标和可比单位聚合并披露覆盖", output: "行业盈利能力与质量" },
  FORECAST: { input: "一致预期、预测期、修订与来源权限", method: "仅聚合已授权预测记录并保留离散度", output: "盈利预测路径" },
  REVENUE: { input: "营收或销售增长及报告期", method: "按同一增长定义比较行业分布", output: "需求与营收增长" },
  PROFIT: { input: "净利或经营利润增长及报告期", method: "隔离利润口径后比较行业分布", output: "利润增长与质量" },
  BALANCE: { input: "资产、负债、债务或杠杆指标", method: "按资产负债口径和单位进行横截面聚合", output: "杠杆与资产负债结构" },
  CASHFLOW: { input: "经营现金流、自由现金流及币种", method: "按现金流定义和期间聚合，不与利润混算", output: "现金转化与覆盖" },
  CAPEX: { input: "资本开支、资本开支强度及期间", method: "按绝对额或比率分别比较并保留币种", output: "投资强度与产能周期" },
  DIVIDEND: { input: "股息率、支付率或分红金额", method: "区分收益率、比率和金额口径后聚合", output: "行业股东回报" },
  VOLATILITY: { input: "已实现波动率、窗口和年化规则", method: "仅比较共同窗口和同一单位的波动指标", output: "行业风险区间" },
  CORRELATION: { input: "同一指标、共同观察日和至少两个行业", method: "对共同日期的行业序列计算 Pearson 相关系数", output: "行业相关矩阵与有效样本数" },
  ROTATION: { input: "行业相对收益或动量的连续时间序列", method: "比较首末共同口径观测并计算绝对及百分比变化", output: "行业轮动排序" },
  CONTRIBUTION: { input: "行业权重、贡献或基准归因指标", method: "按同一归因定义聚合并披露覆盖", output: "基准收益贡献" },
  CYCLE: { input: "行业经营指标与官方产业、通胀、就业背景", method: "账户行业序列和 FRED 环境指标分层展示", output: "行业景气证据链" },
  STRESS: { input: "行业敞口、敏感度、冲击与损失指标", method: "仅展示已定义情景输入，并以官方风险环境作背景", output: "压力损失与集中度" },
};

const palette = ["#22d3ee", "#f59e0b", "#34d399", "#a78bfa", "#fb7185", "#60a5fa", "#facc15", "#2dd4bf"];
const fmt = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(row => headers.map(header => csvCell(row[header])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function pearson(left: Map<string, number>, right: Map<string, number>) {
  const pairs = [...left.entries()].flatMap(([date, value]) => right.has(date) ? [[value, right.get(date)!] as const] : []);
  if (pairs.length < 2) return { value: null as number | null, observations: pairs.length };
  const leftMean = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
  const rightMean = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
  const numerator = pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) * (pair[1] - rightMean), 0);
  const leftScale = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[0] - leftMean) ** 2, 0));
  const rightScale = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[1] - rightMean) ** 2, 0));
  return { value: leftScale && rightScale ? numerator / (leftScale * rightScale) : null, observations: pairs.length };
}

export default function IndustryGroupModuleWorkbench({ code, embeddedData = false }: { code: string; embeddedData?: boolean }) {
  const capability = INDUSTRY_GROUP_CAPABILITIES.find(item => item.id === code);
  const mode = (capability?.id ?? "CLASS") as IndustryCode;
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("");
  const [referenceDays, setReferenceDays] = useState(365);
  const dossier = trpc.industryGroupPrivateResearch.getDossier.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000, refetchOnReconnect: true });
  const reference = trpc.industryGroupReference.getSnapshot.useQuery({ days: referenceDays }, { enabled: mode === "CYCLE" || mode === "STRESS", staleTime: 60_000, refetchOnReconnect: true });
  const liveDelivery = useModuleLiveFeed(`/terminal?open=${encodeURIComponent(mode)}&module=industry-group`, true);

  const allSummaries = (dossier.data?.summaries ?? []) as Array<any>;
  const allObservations = (dossier.data?.observations ?? []) as Array<any>;
  const metricPattern = METRIC_PATTERNS[mode];
  const relevantSummaries = useMemo(() => allSummaries.filter(row => {
    const matchesPurpose = metricPattern === null || metricPattern.test(String(row.metric));
    const token = search.trim().toLowerCase();
    const matchesSearch = !token || `${row.industryGroup} ${row.metric} ${row.unit} ${row.currency ?? ""}`.toLowerCase().includes(token);
    const matchesMetric = !selectedMetric || row.metric === selectedMetric;
    return matchesPurpose && matchesSearch && matchesMetric;
  }), [allSummaries, metricPattern, search, selectedMetric]);
  const relevantMetrics = useMemo(() => Array.from(new Set(allSummaries.filter(row => metricPattern === null || metricPattern.test(String(row.metric))).map(row => String(row.metric)))).sort(), [allSummaries, metricPattern]);
  const relevantObservations = useMemo(() => allObservations.filter(row => {
    const purpose = metricPattern === null || metricPattern.test(String(row.metric));
    const token = search.trim().toLowerCase();
    return purpose && (!selectedMetric || row.metric === selectedMetric) && (!token || `${row.industryGroup} ${row.metric} ${row.ticker ?? ""} ${row.issuerName ?? ""}`.toLowerCase().includes(token));
  }), [allObservations, metricPattern, search, selectedMetric]);

  const groupRows = useMemo(() => {
    const map = new Map<string, { industryGroup: string; observations: number; securities: Set<string>; metrics: Set<string>; latest: string | null; sourced: number }>();
    allObservations.forEach(row => {
      const current = map.get(row.industryGroup) ?? { industryGroup: row.industryGroup, observations: 0, securities: new Set(), metrics: new Set(), latest: null, sourced: 0 };
      current.observations += 1;
      if (row.ticker || row.issuerName) current.securities.add(row.ticker || row.issuerName);
      current.metrics.add(row.metric);
      const observed = row.observedAt ? new Date(row.observedAt).toISOString() : null;
      if (observed && (!current.latest || observed > current.latest)) current.latest = observed;
      if (row.sourceReference) current.sourced += 1;
      map.set(row.industryGroup, current);
    });
    return [...map.values()].map(row => ({ industryGroup: row.industryGroup, observations: row.observations, securities: row.securities.size, metrics: row.metrics.size, latest: row.latest, sourceCoverage: row.observations ? row.sourced / row.observations : 0 }));
  }, [allObservations]);

  const chartRows = useMemo(() => {
    const source = (dossier.data?.series ?? []) as Array<any>;
    const relevant = source.filter(row => (metricPattern === null || metricPattern.test(String(row.metric))) && (!selectedMetric || row.metric === selectedMetric));
    const metric = selectedMetric || relevant[0]?.metric;
    const rows = new Map<string, Record<string, unknown>>();
    relevant.filter(row => !metric || row.metric === metric).forEach(row => {
      const observedDate = String(row.observedDate ?? "");
      const industryGroup = String(row.industryGroup ?? "");
      if (!observedDate || !industryGroup) return;
      const current: Record<string, unknown> = rows.get(observedDate) ?? { date: observedDate };
      current[industryGroup] = row.average;
      rows.set(observedDate, current);
    });
    return [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-180);
  }, [dossier.data?.series, metricPattern, selectedMetric]);
  const chartGroups = useMemo(() => Array.from(new Set(chartRows.flatMap(row => Object.keys(row).filter(key => key !== "date")))).slice(0, 8), [chartRows]);

  const correlation = useMemo(() => {
    if (mode !== "CORRELATION") return { metric: "", groups: [] as string[], rows: [] as Array<Record<string, unknown>> };
    const metric = selectedMetric || relevantMetrics[0] || "";
    if (!metric) return { metric, groups: [], rows: [] };
    const byGroup = new Map<string, Map<string, number>>();
    ((dossier.data?.series ?? []) as Array<any>).filter(row => row.metric === metric).forEach(row => {
      const group = String(row.industryGroup ?? "");
      const date = String(row.observedDate ?? "");
      const value = Number(row.average);
      if (!group || !date || !Number.isFinite(value)) return;
      const series = byGroup.get(group) ?? new Map<string, number>();
      series.set(date, value);
      byGroup.set(group, series);
    });
    const groups = [...byGroup.keys()].sort().slice(0, 12);
    const rows = groups.map(rowGroup => ({
      industryGroup: rowGroup,
      ...Object.fromEntries(groups.map(columnGroup => {
        const result = pearson(byGroup.get(rowGroup)!, byGroup.get(columnGroup)!);
        return [columnGroup, result];
      })),
    }));
    return { metric, groups, rows };
  }, [dossier.data?.series, mode, relevantMetrics, selectedMetric]);

  const rotationRows = useMemo(() => {
    if (mode !== "ROTATION") return [] as Array<Record<string, unknown>>;
    const metric = selectedMetric || relevantMetrics[0] || "";
    const grouped = new Map<string, Array<{ date: string; value: number }>>();
    ((dossier.data?.series ?? []) as Array<any>).filter(row => row.metric === metric).forEach(row => {
      const group = String(row.industryGroup ?? "");
      const date = String(row.observedDate ?? "");
      const value = Number(row.average);
      if (!group || !date || !Number.isFinite(value)) return;
      grouped.set(group, [...(grouped.get(group) ?? []), { date, value }]);
    });
    return [...grouped.entries()].flatMap(([industryGroup, points]) => {
      const ordered = points.sort((left, right) => left.date.localeCompare(right.date));
      if (ordered.length < 2) return [];
      const first = ordered[0]!;
      const latest = ordered.at(-1)!;
      const change = latest.value - first.value;
      return [{ industryGroup, startDate: first.date, endDate: latest.date, first: first.value, latest: latest.value, change, changePercent: first.value === 0 ? null : change / Math.abs(first.value) * 100, observations: ordered.length }];
    }).sort((left, right) => Number(right.changePercent ?? right.change) - Number(left.changePercent ?? left.change));
  }, [dossier.data?.series, mode, relevantMetrics, selectedMetric]);

  const sourceStatus = !isAuthenticated ? "需要登录后读取账户行业数据" : dossier.isLoading ? "正在读取账户行业数据" : dossier.isError ? "账户行业数据读取失败" : dossier.data ? `账户批次 ${dossier.data.batch?.name ?? "—"} · ${dossier.data.recordCount} 条` : "数据源未配置：尚无账户行业观察批次";
  const isClassification = mode === "CLASS";
  const isMembers = mode === "MEMBERS";
  const isCorrelation = mode === "CORRELATION";
  const isRotation = mode === "ROTATION";
  const showReference = mode === "CYCLE" || mode === "STRESS";
  const exportRows = isClassification ? groupRows : isMembers ? relevantObservations : isCorrelation ? correlation.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "object" && value !== null ? (value as { value: number | null }).value : value]))) : isRotation ? rotationRows : relevantSummaries;

  if (!capability) return null;

  return (
    <section className={embeddedData ? "flex min-h-[720px] min-w-0 flex-col bg-[#030807] text-slate-100" : "flex h-full min-h-[560px] min-w-0 flex-col bg-[#030807] text-slate-100"} data-industry-module-workbench={mode} data-industry-embedded-data={embeddedData || undefined}>
      {!embeddedData && <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-emerald-900/70 bg-[#081410] px-3 py-2">
        <b className="font-mono text-xs text-emerald-300">{capability.code}</b><span className="text-sm font-semibold">{capability.name}</span><span className="text-[10px] text-slate-500">唯一职责：{capability.responsibility}</span>
      </header>}
      <table aria-label={`${capability.name} 数据定义`} className="w-full border-b border-slate-800 text-left text-[9px]"><tbody><tr><th className="w-20 px-2 py-1 text-slate-500">必需输入</th><td className="border-r border-slate-800 py-1 pr-2 text-slate-300">{LENS_SPEC[mode].input}</td><th className="w-20 px-2 py-1 text-slate-500">计算方法</th><td className="border-r border-slate-800 py-1 pr-2 text-slate-300">{LENS_SPEC[mode].method}</td><th className="w-20 px-2 py-1 text-slate-500">独立输出</th><td className="py-1 pr-2 text-emerald-200">{LENS_SPEC[mode].output}</td></tr></tbody></table>
      <div role="toolbar" aria-label={`${capability.name} 工具栏`} className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-2">
        <input aria-label="筛选行业数据" value={search} onChange={event => setSearch(event.target.value)} placeholder="筛选行业、指标或证券" className="h-7 min-w-48 flex-1 border border-slate-700 bg-black px-2 text-[11px] outline-none focus:border-emerald-600" />
        {!isClassification && !isMembers && <select aria-label="选择行业指标" value={selectedMetric} onChange={event => setSelectedMetric(event.target.value)} className="h-7 max-w-64 border border-slate-700 bg-black px-2 text-[11px]"><option value="">全部匹配指标</option>{relevantMetrics.map(metric => <option key={metric} value={metric}>{metric}</option>)}</select>}
        {showReference && <select aria-label="官方参考时间窗" value={referenceDays} onChange={event => setReferenceDays(Number(event.target.value))} className="h-7 border border-slate-700 bg-black px-2 text-[11px]"><option value={90}>90D</option><option value={365}>1Y</option><option value={1095}>3Y</option></select>}
        <button type="button" onClick={() => { void dossier.refetch(); if (showReference) void reference.refetch(); }} disabled={dossier.isFetching || reference.isFetching} className="inline-flex h-7 items-center gap-1 border border-emerald-800 px-2 text-[11px] text-emerald-200 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${(dossier.isFetching || reference.isFetching) ? "animate-spin" : ""}`} />刷新</button>
        <button type="button" onClick={() => downloadCsv(`industry-${mode.toLowerCase()}.csv`, exportRows as Array<Record<string, unknown>>)} disabled={!exportRows.length} className="inline-flex h-7 items-center gap-1 border border-slate-700 px-2 text-[11px] text-slate-300 disabled:opacity-40"><Download className="h-3 w-3" />导出</button>
      </div>
      <div className={embeddedData ? "min-h-0 flex-1 divide-y divide-slate-800" : "grid min-h-0 flex-1 xl:grid-cols-[minmax(420px,0.95fr)_minmax(480px,1.05fr)]"}>
        <section aria-label={embeddedData ? `${capability.code} 数据矩阵` : `${capability.code} 分析工具`} className={embeddedData ? "min-h-[260px] overflow-x-auto" : "min-h-0 overflow-auto border-r border-slate-800"}>
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-900/60 bg-[#081410] px-2 py-1.5">
            <b className={`font-mono text-[10px] ${embeddedData ? "text-emerald-300" : "text-amber-300"}`}>{embeddedData ? "DATA MATRIX" : "ANALYTICS"}</b>
            <span className="text-[9px] text-slate-500">{capability.name}{embeddedData ? "可比数据" : "分析工具"} · {LENS_SPEC[mode].output}</span>
          </header>
          {isClassification ? <table className="w-full min-w-[720px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">分类体系/版本</th><th>行业组</th><th>观察</th><th>证券</th><th>指标</th><th>最新观察</th><th className="pr-2">来源覆盖</th></tr></thead><tbody>{groupRows.map(row => <tr key={row.industryGroup} className="border-t border-slate-800"><td className="p-2 text-slate-400">{dossier.data?.batch?.classification ?? "未提供"}</td><td className="text-emerald-200">{row.industryGroup}</td><td>{row.observations}</td><td>{row.securities}</td><td>{row.metrics}</td><td>{row.latest ? new Date(row.latest).toLocaleString() : "—"}</td><td className="pr-2">{(row.sourceCoverage * 100).toFixed(0)}%</td></tr>)}</tbody></table> : isMembers ? <table className="w-full min-w-[760px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">行业组</th><th>证券</th><th>指标</th><th>值</th><th>单位/币种</th><th>观察时间</th><th className="pr-2">来源定位</th></tr></thead><tbody>{relevantObservations.slice(0, 500).map(row => <tr key={`${row.recordId}-${row.observedAt}`} className="border-t border-slate-800"><td className="p-2 text-emerald-200">{row.industryGroup}</td><td>{row.ticker || row.issuerName || "—"}</td><td>{row.metric}</td><td className="font-mono">{fmt(row.value)}</td><td>{row.unit} {row.currency ?? ""}</td><td>{row.observedAt ? new Date(row.observedAt).toLocaleString() : "—"}</td><td className="max-w-48 truncate pr-2 text-slate-500">{row.sourceReference || "未提供"}</td></tr>)}</tbody></table> : isCorrelation ? <table aria-label="行业相关矩阵" className="w-full min-w-[720px] text-center text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2 text-left">{correlation.metric || "指标未选择"}</th>{correlation.groups.map(group => <th key={group} className="px-2">{group}</th>)}</tr></thead><tbody>{correlation.rows.map(row => <tr key={String(row.industryGroup)} className="border-t border-slate-800"><th className="p-2 text-left text-emerald-200">{String(row.industryGroup)}</th>{correlation.groups.map(group => { const cell = (row as Record<string, unknown>)[group] as { value: number | null; observations: number }; return <td key={group} title={`${cell.observations} 个共同观察日`} className="font-mono">{cell.value === null ? "—" : cell.value.toFixed(3)} <span className="text-slate-600">({cell.observations})</span></td>; })}</tr>)}</tbody></table> : isRotation ? <table aria-label="行业轮动排序" className="w-full min-w-[720px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">排名</th><th>行业组</th><th>起止观察日</th><th>首值</th><th>末值</th><th>变化</th><th>变化率</th><th className="pr-2">有效观察</th></tr></thead><tbody>{rotationRows.map((row, index) => <tr key={String(row.industryGroup)} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-500">{index + 1}</td><td className="text-emerald-200">{String(row.industryGroup)}</td><td>{String(row.startDate)} / {String(row.endDate)}</td><td className="font-mono">{fmt(row.first)}</td><td className="font-mono">{fmt(row.latest)}</td><td className="font-mono">{fmt(row.change)}</td><td className="font-mono">{row.changePercent === null ? "—" : `${Number(row.changePercent).toFixed(2)}%`}</td><td className="pr-2">{String(row.observations)}</td></tr>)}</tbody></table> : <table className="w-full min-w-[760px] text-left text-[10px]"><thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">行业组</th><th>指标</th><th>覆盖</th><th>平均</th><th>中位</th><th>最小/最大</th><th>单位/币种</th><th className="pr-2">最新观察</th></tr></thead><tbody>{relevantSummaries.map(row => <tr key={`${row.industryGroup}-${row.metric}-${row.unit}-${row.currency ?? ""}`} className="border-t border-slate-800"><td className="p-2 text-emerald-200">{row.industryGroup}</td><td>{row.metric}</td><td>{row.coverage}</td><td className="font-mono">{fmt(row.average)}</td><td className="font-mono">{fmt(row.median)}</td><td className="font-mono">{fmt(row.minimum)} / {fmt(row.maximum)}</td><td>{row.unit} {row.currency ?? ""}</td><td className="pr-2">{row.latestObservedAt ? new Date(row.latestObservedAt).toLocaleString() : "—"}</td></tr>)}</tbody></table>}
          {!exportRows.length && <div role="status" className="border-t border-amber-900/50 p-4 text-xs text-amber-200">数据源未配置或当前筛选没有满足该功能计算口径的记录。该功能不使用静态行业值、随机路径或其他模块数据填充。</div>}
        </section>
        <section aria-label={`${capability.code} 数据与证据`} className="min-h-0 overflow-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-900/60 bg-[#081410] px-2 py-1.5">
            <b className="font-mono text-[10px] text-cyan-300">DATA / EVIDENCE</b>
            <span className="text-[9px] text-slate-500">来源、时点、单位与推送回执</span>
          </header>
          <ModuleLiveDeliveryTable {...liveDelivery} title={`${capability.name} 后台定向内容`} />
          <div className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-slate-500">时间序列数据层 · 只绘制同一指标、单位与观察日可比较的账户记录</div>
          <div className="h-[360px] min-w-[480px] p-2" data-chart-id={`industry-${mode.toLowerCase()}-timeseries`}>
            {chartRows.length && chartGroups.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid stroke="#18302b" strokeDasharray="2 3" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={28} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#64748b", fontSize: 9 }} width={48} /><Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} />{chartGroups.map((group, index) => <Line key={group} dataKey={group} stroke={palette[index % palette.length]} dot={false} connectNulls={false} isAnimationActive={false} />)}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y border-slate-800 text-xs text-slate-500">需要同一指标的至少一个账户时间序列；不生成示例曲线。</div>}
          </div>
          {showReference && <section className="border-t border-slate-800"><header className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-emerald-300">官方宏观参考 · 仅作行业景气或压力环境背景</header><table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">指标</th><th>当前值</th><th>变化</th><th>单位/频率</th><th>观察日</th><th>来源</th></tr></thead><tbody>{(reference.data?.series ?? []).map((row: any) => <tr key={row.id} className="border-t border-slate-800"><td className="p-2 text-emerald-200">{row.label}</td><td className="font-mono">{fmt(row.latest?.value)}</td><td className="font-mono">{fmt(row.change)}</td><td>{row.unit} / {row.frequency}</td><td>{row.latest?.observedAt ?? "—"}</td><td className="text-slate-500">{row.source}</td></tr>)}</tbody></table></section>}
        </section>
      </div>
      <footer role="status" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#081410] px-3 py-2 text-[9px] text-slate-500"><span>{sourceStatus}</span><span>来源时点、单位、币种与覆盖必须一致后才允许比较 · {new Date().toLocaleString()}</span></footer>
    </section>
  );
}
