import { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { PREFERRED_STOCK_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

type ModuleId = (typeof PREFERRED_STOCK_CAPABILITIES)[number]["id"];
type Column = { key: string; label: string; unit?: string };

export const PREFERRED_MODULE_META = Object.fromEntries(
  PREFERRED_STOCK_CAPABILITIES.map(capability => [capability.id, {
    code: capability.code,
    title: capability.name,
    focus: capability.responsibility,
    category: capability.sourceProfile === "licensed" ? "restricted" : capability.sourceProfile === "account" ? "input" : capability.sourceProfile === "official" ? "environment" : "disclosure",
  }])
) as Record<ModuleId, { code: string; title: string; focus: string; category: "disclosure" | "environment" | "input" | "restricted" }>;

const TERM_COLUMNS: Partial<Record<ModuleId, Column[]>> = {
  secf: [
    { key: "securityIdentifier", label: "证券标识" }, { key: "securityName", label: "证券名称" },
    { key: "issuerName", label: "发行人" }, { key: "cik", label: "CIK" }, { key: "asOfDate", label: "条款时点" },
  ],
  psch: [
    { key: "securityIdentifier", label: "证券标识" }, { key: "dividendType", label: "股息结构" },
    { key: "couponRatePct", label: "票面股息率", unit: "%" }, { key: "paymentFrequency", label: "支付频率" },
    { key: "referenceIndex", label: "参考利率" }, { key: "spreadBps", label: "加点", unit: "bp" },
    { key: "firstCallDate", label: "首赎日" }, { key: "maturityDate", label: "到期日" },
    { key: "liquidationPreference", label: "清算优先额" }, { key: "asOfDate", label: "条款时点" },
  ],
  wb: [
    { key: "securityIdentifier", label: "证券标识" }, { key: "dividendType", label: "股息结构" },
    { key: "couponRatePct", label: "票面股息率", unit: "%" }, { key: "referenceIndex", label: "参考利率" },
    { key: "spreadBps", label: "加点", unit: "bp" }, { key: "resetFrequency", label: "重置频率" },
  ],
  pord: [
    { key: "securityIdentifier", label: "证券标识" }, { key: "firstCallDate", label: "首赎日" },
    { key: "liquidationPreference", label: "清算优先额" }, { key: "maturityDate", label: "到期日" }, { key: "sourceReference", label: "条款证据" },
  ],
  wei: [
    { key: "issuerName", label: "发行人" }, { key: "cik", label: "CIK" },
    { key: "securityIdentifier", label: "证券标识" }, { key: "sourceReference", label: "披露证据" }, { key: "asOfDate", label: "条款时点" },
  ],
  rpa: [
    { key: "issuerName", label: "发行人" }, { key: "securityIdentifier", label: "证券标识" },
    { key: "liquidationPreference", label: "清算优先额" }, { key: "sourceReference", label: "偿付顺序证据" },
  ],
  por: [
    { key: "securityIdentifier", label: "证券标识" }, { key: "issuerName", label: "发行人" },
    { key: "dividendType", label: "股息结构" }, { key: "couponRatePct", label: "票面股息率", unit: "%" },
    { key: "spreadBps", label: "加点", unit: "bp" }, { key: "firstCallDate", label: "首赎日" },
    { key: "maturityDate", label: "到期日" }, { key: "liquidationPreference", label: "清算优先额" },
  ],
  aide: [
    { key: "securityIdentifier", label: "证券标识" }, { key: "dividendType", label: "股息结构" },
    { key: "couponRatePct", label: "票面股息率", unit: "%" }, { key: "firstCallDate", label: "首赎日" },
    { key: "maturityDate", label: "到期日" }, { key: "liquidationPreference", label: "清算优先额" }, { key: "asOfDate", label: "条款时点" },
  ],
};

const REQUIRED_SOURCE_FIELDS: Partial<Record<ModuleId, Array<[string, string, string]>>> = {
  dat: [["bid/ask/last", "授权行情源", "实时或延迟标识、市场时间、接收时间、币种"], ["priceCondition", "授权行情源", "报价条件和交易场所"]],
  inf: [["bidLevels/askLevels", "授权订单簿", "价格、数量、档位、场所、sequence"], ["spread/depth", "订单簿计算", "同一时点可复算"]],
  fit: [["tradePrice/tradeSize", "授权逐笔成交源", "成交条件、市场时间、sequence"], ["venue", "授权逐笔成交源", "交易场所或报告设施"]],
  eds: [["recordDate/payableDate", "发行人或交易所公告", "股权登记日和支付日"], ["amount/status", "支付记录", "实际支付、递延或拖欠状态"]],
  app: [["cumulativeFlag", "招募说明书条款", "累积/非累积及未付股息处置"], ["arrearsAmount", "发行人披露", "拖欠金额、币种和时点"]],
  sop: [["participationFlag", "招募说明书条款", "参与/非参与"], ["participationFormula", "招募说明书条款", "超额分配条件和上限"]],
  case: [["conversionRatio", "招募说明书条款", "转换比率和调整事件"], ["conversionWindow/trigger", "招募说明书条款", "窗口与触发条件"]],
  aid: [["putDate/putPrice", "招募说明书条款", "回售日期、价格和触发条件"]],
  cma: [["underlyingPrice", "授权标的行情", "币种、市场时间、时效"], ["conversionRatio", "招募说明书条款", "同一版本有效比率"]],
  viz: [["preferredPrice", "授权优先股行情", "同一时点价格"], ["conversionValue", "转股价值计算", "相同标的时点和币种"]],
  prc: [["cleanPrice", "授权优先股行情", "净价、币种和时点"], ["cashflows", "核验条款", "股息、赎回/到期假设和日历"]],
  qfm: [["annualCashDistribution", "核验分配记录或条款现金流", "年化现金分配、币种和适用期间"], ["currentCleanPrice", "授权优先股行情", "当前净价、币种、市场时间和时效状态"]],
  crd: [["rating/outlook", "获许可评级源", "评级机构、日期、展望和历史"], ["watch/status", "获许可评级源", "观察名单及迁移事件"]],
  liq: [["quotes/trades", "授权行情与成交源", "价差、深度、成交频度和时点"], ["impact", "同源计算", "规模、方向、窗口和方法"]],
};

const PARTIAL_SOURCE_FIELDS: Partial<Record<ModuleId, Array<[string, string, string]>>> = {
  pord: [["callPrice/currency", "招募说明书或发行人条款", "赎回价格、币种、适用日期和条款版本"], ["callTrigger/notice", "招募说明书或发行人条款", "触发条件、通知期和可部分赎回规则"]],
};

const RATE_MODES = new Set<ModuleId>(["mdl", "aide"]);
const EMPTY_TERM_MODES = new Set<ModuleId>(Object.keys(REQUIRED_SOURCE_FIELDS) as ModuleId[]);
const palette = ["#22d3ee", "#f59e0b", "#34d399", "#fb7185", "#a78bfa", "#60a5fa", "#facc15"];

function display(value: unknown, unit?: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString();
  if (unit && Number.isFinite(Number(value))) return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${unit}`;
  if (unit) return `${String(value)} ${unit}`;
  return String(value);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportRows(moduleId: ModuleId, columns: Column[], rows: any[]) {
  if (!rows.length || !columns.length) return;
  const csv = [columns.map(column => csvCell(column.label)).join(","), ...rows.map(row => columns.map(column => csvCell(row[column.key])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `preferred-stock-${moduleId}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SourceGapTable({ mode }: { mode: ModuleId }) {
  const requirements = REQUIRED_SOURCE_FIELDS[mode] ?? [];
  return (
    <div className="min-h-0 overflow-auto">
      <table className="w-full min-w-[720px] text-left text-[10px]">
        <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr><th className="p-2">缺失字段</th><th>所需来源</th><th>接入验收口径</th><th className="pr-2">状态</th></tr></thead>
        <tbody>{requirements.map(([field, source, rule]) => <tr key={field} className="border-t border-slate-800"><td className="p-2 font-mono text-amber-200">{field}</td><td>{source}</td><td>{rule}</td><td className="pr-2 text-rose-300">数据源未配置</td></tr>)}</tbody>
      </table>
      <p role="status" className="border-t border-amber-900/50 px-3 py-3 text-[11px] text-amber-200">当前账户没有该能力所需的合法数据链路，因此不展示价格、盘口、成交、评级或计算结果，也不使用其他优先股页面的数据替代。</p>
    </div>
  );
}

function PartialSourceGapTable({ mode }: { mode: ModuleId }) {
  const requirements = PARTIAL_SOURCE_FIELDS[mode] ?? [];
  if (!requirements.length) return null;
  return (
    <div className="border-t border-amber-900/50">
      <header className="px-2 py-1.5 text-[10px] text-amber-200">已导入条款之外仍需补齐的字段</header>
      <table className="w-full min-w-[720px] text-left text-[10px]">
        <thead className="bg-slate-950 text-slate-500"><tr><th className="p-2">缺失字段</th><th>所需来源</th><th>接入验收口径</th><th className="pr-2">状态</th></tr></thead>
        <tbody>{requirements.map(([field, source, rule]) => <tr key={field} className="border-t border-slate-800"><td className="p-2 font-mono text-amber-200">{field}</td><td>{source}</td><td>{rule}</td><td className="pr-2 text-rose-300">数据源未配置</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function PreferredStockResearchLayer({ moduleId }: { moduleId: string; onNavigate?: (target: string) => void }) {
  const capability = PREFERRED_STOCK_CAPABILITIES.find(item => item.id === moduleId) ?? PREFERRED_STOCK_CAPABILITIES[0];
  const mode = capability.id as ModuleId;
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [dividendType, setDividendType] = useState("");
  const [sortKey, setSortKey] = useState("asOfDate");
  const [selectedId, setSelectedId] = useState("");
  const terms = trpc.preferredStockResearch.listTerms.useQuery(
    { limit: 500 },
    { enabled: isAuthenticated, retry: false, staleTime: 30_000, refetchOnReconnect: true }
  );
  const environment = trpc.preferredStockResearch.getMarketEnvironment.useQuery(undefined, {
    enabled: RATE_MODES.has(mode), retry: false, staleTime: 30_000, refetchOnReconnect: true,
  });
  const columns = TERM_COLUMNS[mode] ?? [];
  const rows = useMemo(() => {
    const token = query.trim().toLocaleLowerCase();
    return [...(terms.data ?? [])].filter((row: any) => {
      const matchesText = !token || `${row.securityIdentifier} ${row.securityName} ${row.issuerName} ${row.cik ?? ""}`.toLocaleLowerCase().includes(token);
      return matchesText && (!dividendType || row.dividendType === dividendType);
    }).sort((left: any, right: any) => String(right[sortKey] ?? "").localeCompare(String(left[sortKey] ?? "")));
  }, [dividendType, query, sortKey, terms.data]);
  const selected = (rows.find((row: any) => row.securityIdentifier === selectedId) ?? rows[0] ?? null) as Record<string, unknown> | null;
  const chartRows = useMemo(() => {
    const series = environment.data?.series ?? [];
    const dates = new Map<string, Record<string, string | number>>();
    series.forEach((item: any) => item.history.forEach((point: any) => {
      const observedDate = String(point.date ?? "");
      const indicatorId = String(item.id ?? "");
      if (!observedDate || !indicatorId) return;
      const current: Record<string, string | number> = dates.get(observedDate) ?? { date: observedDate };
      current[indicatorId] = point.value;
      dates.set(observedDate, current);
    }));
    return [...dates.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-180);
  }, [environment.data?.series]);

  return (
    <section className="flex min-h-[520px] min-w-0 flex-col bg-[#050706] text-slate-200" data-preferred-capability={mode}>
      <div role="toolbar" aria-label={`${capability.name} 数据工具栏`} className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-2">
        <input aria-label="筛选证券或发行人" value={query} onChange={event => setQuery(event.target.value)} placeholder="证券、发行人或 CIK" className="h-7 min-w-44 flex-1 border border-slate-700 bg-black px-2 text-[11px] outline-none focus:border-amber-600" />
        <select aria-label="股息结构" value={dividendType} onChange={event => setDividendType(event.target.value)} className="h-7 border border-slate-700 bg-black px-2 text-[11px]"><option value="">全部股息结构</option><option value="fixed">固定</option><option value="floating">浮动</option><option value="fixed_to_float">固转浮</option><option value="other">其他</option></select>
        <select aria-label="排序字段" value={sortKey} onChange={event => setSortKey(event.target.value)} className="h-7 border border-slate-700 bg-black px-2 text-[11px]"><option value="asOfDate">条款时点</option><option value="issuerName">发行人</option><option value="securityIdentifier">证券标识</option><option value="firstCallDate">首赎日</option><option value="maturityDate">到期日</option></select>
        <button type="button" onClick={() => { void terms.refetch(); if (RATE_MODES.has(mode)) void environment.refetch(); }} disabled={terms.isFetching || environment.isFetching} className="inline-flex h-7 items-center gap-1 border border-amber-800 px-2 text-[11px] text-amber-200 disabled:opacity-40"><RefreshCw className={`h-3 w-3 ${(terms.isFetching || environment.isFetching) ? "animate-spin" : ""}`} />刷新</button>
        <button type="button" onClick={() => exportRows(mode, columns, rows)} disabled={!columns.length || !rows.length} className="inline-flex h-7 items-center gap-1 border border-slate-700 px-2 text-[11px] disabled:opacity-40"><Download className="h-3 w-3" />导出</button>
      </div>

      {EMPTY_TERM_MODES.has(mode) ? <SourceGapTable mode={mode} /> : (
        <div className={`grid min-h-0 flex-1 ${RATE_MODES.has(mode) ? "xl:grid-cols-[minmax(440px,0.95fr)_minmax(500px,1.05fr)]" : "grid-cols-1"}`}>
          <div className="min-h-0 overflow-auto border-r border-slate-800">
            {!isAuthenticated ? <div role="status" className="p-4 text-xs text-amber-200">需要登录后读取当前账户导入的优先股条款。</div> : terms.isLoading ? <div role="status" className="p-4 text-xs text-slate-400">正在读取账户优先股条款…</div> : terms.isError ? <div role="alert" className="p-4 text-xs text-rose-300">账户条款读取失败，请使用刷新重试。</div> : columns.length && rows.length ? (
              <table className="w-full min-w-[760px] text-left text-[10px]">
                <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr>{columns.map(column => <th key={column.key} className="p-2 font-normal">{column.label}</th>)}</tr></thead>
                <tbody>{rows.map((row: any) => <tr key={row.securityIdentifier} onClick={() => setSelectedId(row.securityIdentifier)} className={`cursor-pointer border-t border-slate-800 ${selected?.securityIdentifier === row.securityIdentifier ? "bg-amber-950/20" : "hover:bg-slate-900"}`}>{columns.map(column => <td key={column.key} className="max-w-56 truncate p-2 font-mono">{column.key === "sourceReference" ? (row[column.key] ? "已提供" : "未提供") : display(row[column.key], column.unit)}</td>)}</tr>)}</tbody>
              </table>
            ) : <div role="status" className="p-4 text-xs text-amber-200">数据源未配置或当前筛选没有账户条款记录；不生成示例证券。</div>}
            <PartialSourceGapTable mode={mode} />
          </div>

          {RATE_MODES.has(mode) && <div className="min-h-0 overflow-auto">
            <header className="border-b border-slate-800 px-2 py-1.5 text-[10px] text-amber-200">官方利率与信用环境 · 仅用于利率敏感性或压力背景，不是个券估值</header>
            <div className="h-[340px] min-w-[480px] p-2" data-chart-id={`preferred-${mode}-environment`}>
              {chartRows.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid stroke="#302513" strokeDasharray="2 3" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={28} /><YAxis domain={["auto", "auto"]} tick={{ fill: "#64748b", fontSize: 9 }} width={45} /><Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", fontSize: 10 }} /><Legend wrapperStyle={{ fontSize: 10 }} />{(environment.data?.series ?? []).map((item: any, index: number) => <Line key={item.id} dataKey={item.id} name={item.label} stroke={palette[index % palette.length]} dot={false} isAnimationActive={false} connectNulls={false} />)}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center border-y border-slate-800 text-xs text-slate-500">官方历史序列当前不可读；不生成替代曲线。</div>}
            </div>
            <table className="w-full text-left text-[10px]"><thead className="text-slate-500"><tr><th className="p-2">指标</th><th>观察值</th><th>日变动</th><th>观察日</th><th>时效</th></tr></thead><tbody>{(environment.data?.series ?? []).map((item: any) => <tr key={item.id} className="border-t border-slate-800"><td className="p-2 text-amber-200">{item.label}</td><td>{display(item.value, item.unit)}</td><td>{display(item.changeBps, "bp")}</td><td>{item.observationDate ?? "—"}</td><td>公开日度/非实时</td></tr>)}</tbody></table>
          </div>}
        </div>
      )}

      {selected && columns.length > 0 && <details className="border-t border-slate-800"><summary className="cursor-pointer px-2 py-1.5 text-[10px] text-slate-400">所选证券字段明细</summary><table className="w-full text-left text-[10px]"><tbody>{columns.map(column => <tr key={column.key} className="border-t border-slate-800"><th className="w-44 p-2 font-normal text-slate-500">{column.label}</th><td className="p-2 font-mono">{column.key === "sourceReference" ? (selected[column.key] ? "已提供来源定位" : "未提供来源定位") : display(selected[column.key], column.unit)}</td></tr>)}</tbody></table></details>}
      <footer role="status" className="flex flex-wrap justify-between gap-2 border-t border-slate-800 bg-[#100d07] px-3 py-2 text-[9px] text-slate-500"><span>{capability.responsibility}</span><span>来源：{RATE_MODES.has(mode) ? "账户条款 + FRED 公开历史观察" : columns.length ? "当前账户导入条款" : "待配置的合法专业数据源"} · {environment.data?.retrievedAt ?? "未读取"}</span></footer>
    </section>
  );
}
