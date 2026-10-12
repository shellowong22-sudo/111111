import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  Landmark,
  Radio,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MoneyMarketBadge as Badge,
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
} from "./MoneyMarketWorkbench";
import {
  useModuleLiveFeed,
  type ModuleLiveFeedItem,
} from "@/hooks/useModuleLiveFeed";

export type MmRate = {
  id: string;
  label: string;
  category: string;
  unit?: string;
  sourceUrl: string;
  observationDate: string | null;
  value: number | null;
  changeBps: number | null;
  history: Array<{ date: string; value: number }>;
  status: "available" | "unavailable";
  limitation: string;
};
export type MmAuction = {
  cusip: string | null;
  securityType: string | null;
  securityTerm: string | null;
  auctionDate: string | null;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: string | null;
  sourceUrl: string;
};
export type MmFundingPoint = {
  date: string;
  product: "SOFR" | "EFFR" | "OBFR";
  ratePct: number | null;
  volumeBn: number | null;
  p1Pct: number | null;
  p25Pct: number | null;
  p75Pct: number | null;
  p99Pct: number | null;
  targetLowPct: number | null;
  targetHighPct: number | null;
  revision: string;
};
export type MmSource = {
  id: string;
  label: string;
  region: string;
  frequency: string;
  url: string;
  scope: string;
};
export type MmSnapshot = {
  asOf: string;
  rates: MmRate[];
  treasuryAuctions: MmAuction[];
  cdi: Array<{ date: string; valuePct: number }>;
  taiwanCallRate: Array<{ date: string; valuePct: number }>;
  fundingTape?: MmFundingPoint[];
  sourceLatencyMs: Record<string, number | null>;
  sources: MmSource[];
};

const COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#f59e0b",
  "#34d399",
  "#fb7185",
  "#60a5fa",
];
const tooltip = {
  background: "#020617",
  border: "1px solid #334155",
  color: "#e2e8f0",
  fontSize: 11,
};
const sourceLink = (url: string, label = "打开原始记录") => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-100"
  >
    <ExternalLink className="h-3 w-3" />
    {label}
  </a>
);
const quote = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
function exportCsv(filename: string, headings: string[], rows: unknown[][]) {
  const blob = new Blob(
    [
      `\uFEFF${[headings, ...rows].map(row => row.map(quote).join(",")).join("\r\n")}`,
    ],
    { type: "text/csv;charset=utf-8" }
  );
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}
function Empty({ children }: { children: string }) {
  return (
    <div className="rounded border border-dashed border-slate-700 bg-slate-950/50 p-4 text-xs leading-5 text-slate-500">
      {children}
    </div>
  );
}
function formatObservation(row?: MmRate) {
  if (!row || row.value == null) return "—";
  return `${row.value.toFixed(row.unit === "USD bn" ? 1 : 4)} ${row.unit ?? "%"}`;
}
function cleanFeedText(value: unknown) {
  return String(value ?? "")
    .replace(
      /(?:后台|管理端|人工定向推送|爬虫|crawler|模块\s*ID|moduleId|映射|targetPath|strategyKey|promptKey)\s*[:：]?[^。；\n]*/gi,
      ""
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function uniqueFeed(items: ModuleLiveFeedItem[]) {
  const seen = new Set<string>();
  return items.flatMap(item => {
    const title = cleanFeedText(item.title);
    const body = cleanFeedText(item.body);
    const key = `${title}\u0000${body}`;
    if (!title || !body || seen.has(key)) return [];
    seen.add(key);
    return [{ ...item, title, body }];
  });
}

function articleParagraphs(value: string) {
  const cleaned = value.replace(/\r/g, "").trim();
  const explicit = cleaned
    .split(/\n{2,}/)
    .map(row => row.trim())
    .filter(Boolean);
  if (explicit.length >= 3) {
    const grouped: string[] = [];
    for (let index = 0; index < explicit.length; index += 1) {
      const current = explicit[index];
      const next = explicit[index + 1];
      if (
        current.length <= 32 &&
        next &&
        next.length >= 45 &&
        !/[。！？!?]$/.test(current)
      ) {
        grouped.push(`${current}\n${next}`);
        index += 1;
      } else {
        grouped.push(current);
      }
    }
    return grouped;
  }
  const sentences =
    cleaned
      .match(/[^。！？!?]+[。！？!?]?/g)
      ?.map(row => row.trim())
      .filter(Boolean) ?? [];
  if (sentences.length < 4) return explicit.length ? explicit : [cleaned];
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 3)
    paragraphs.push(sentences.slice(index, index + 3).join(""));
  return paragraphs;
}

export function DesIntegrated({ snapshot }: { snapshot?: MmSnapshot }) {
  const available = (snapshot?.rates ?? []).filter(
    row => row.status === "available"
  );
  const [selectedId, setSelectedId] = useState("SOFR");
  const selected =
    snapshot?.rates.find(row => row.id === selectedId) ?? available[0];
  const coverage = (snapshot?.rates ?? []).map(row => ({
    id: row.id,
    observations: row.history.length,
    current: row.value,
    unit: row.unit,
    available: row.status === "available",
  }));
  return (
    <Card
      title="字段血缘与观察覆盖"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "mm-des-field-lineage.csv",
              [
                "代码",
                "名称",
                "定义",
                "单位",
                "观察日",
                "覆盖",
                "状态",
                "原始地址",
              ],
              (snapshot?.rates ?? []).map(row => [
                row.id,
                row.label,
                row.category,
                row.unit,
                row.observationDate,
                row.history.length,
                row.status,
                row.sourceUrl,
              ])
            )
          }
          disabled={!coverage.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          字段清单
        </button>
      }
    >
      <div className="grid gap-3 xl:grid-cols-[1.05fr_1.4fr]">
        <div className="overflow-auto rounded border border-slate-800">
          <table className="min-w-full text-[11px]">
            <thead className="sticky top-0 bg-slate-950 text-left text-slate-500">
              <tr>
                <th className="p-2">字段</th>
                <th className="p-2">口径</th>
                <th className="p-2">最新值</th>
                <th className="p-2">观察日</th>
                <th className="p-2">覆盖</th>
              </tr>
            </thead>
            <tbody>
              {(snapshot?.rates ?? []).map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`cursor-pointer border-t border-slate-800 ${selected?.id === row.id ? "bg-cyan-950/30" : "hover:bg-slate-900/60"}`}
                >
                  <td className="p-2 font-mono text-cyan-200">{row.id}</td>
                  <td className="max-w-56 p-2 text-slate-400">
                    {row.category}
                  </td>
                  <td className="p-2 text-slate-200">
                    {formatObservation(row)}
                  </td>
                  <td className="p-2 text-slate-500">
                    {row.observationDate ?? "—"}
                  </td>
                  <td className="p-2">{row.history.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/45 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-xs text-cyan-300">
                {selected?.id ?? "NO SERIES"}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-100">
                {selected?.label ?? "选择左侧字段查看历史血缘"}
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">
                {selected?.category}
              </p>
            </div>
            {selected && sourceLink(selected.sourceUrl)}
          </div>
          <div className="mt-3 h-56">
            {selected?.history.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selected.history}>
                  <defs>
                    <linearGradient id="desFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#22d3ee" stopOpacity={0.45} />
                      <stop offset="1" stopColor="#22d3ee" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    minTickGap={30}
                  />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                  <Tooltip contentStyle={tooltip} />
                  <Area
                    dataKey="value"
                    name={`${selected.label} (${selected.unit ?? "%"})`}
                    stroke="#22d3ee"
                    fill="url(#desFill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty>
                该字段当前没有可读历史；保持真实空状态，不复制其他指标。
              </Empty>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric
              label="历史观察"
              value={String(selected?.history.length ?? 0)}
              tone="info"
            />
            <Metric label="计量单位" value={selected?.unit ?? "—"} />
            <Metric
              label="读取状态"
              value={selected?.status === "available" ? "可用" : "暂不可用"}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PgmIntegrated({ snapshot }: { snapshot?: MmSnapshot }) {
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: number;
      name: string;
      deadline: string;
      sourceId: string;
      status: "资料收集中" | "待复核" | "可交付";
    }>
  >([]);
  const add = () => {
    if (!name.trim() || !deadline || !sourceId) return;
    setRows(current => [
      ...current,
      {
        id: Date.now(),
        name: name.trim(),
        deadline,
        sourceId,
        status: "资料收集中",
      },
    ]);
    setName("");
  };
  const funnel = ["资料收集中", "待复核", "可交付"].map(status => ({
    status,
    count: rows.filter(row => row.status === status).length,
  }));
  const readableSeries = (snapshot?.rates ?? []).filter(
    rate => rate.status === "available"
  );
  const observationCount = readableSeries.reduce(
    (sum, rate) => sum + rate.history.length,
    0
  );
  const freshest = readableSeries
    .map(rate => rate.observationDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  return (
    <Card
      title="研究委托漏斗"
      action={
        <button
          type="button"
          disabled={!rows.length}
          onClick={() =>
            exportCsv(
              "mm-pgm-mandates.csv",
              ["委托", "截止日", "资料源", "阶段"],
              rows.map(row => [
                row.name,
                row.deadline,
                snapshot?.sources.find(s => s.id === row.sourceId)?.label,
                row.status,
              ])
            )
          }
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          导出任务簿
        </button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="研究委托名称"
              className="input-terminal text-xs"
            />
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="input-terminal text-xs"
            />
            <select
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
              className="input-terminal text-xs"
            >
              <option value="">选择证据来源</option>
              {snapshot?.sources.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={add}
              disabled={!name.trim() || !deadline || !sourceId}
              className="rounded border border-cyan-800 px-3 text-xs text-cyan-200 disabled:opacity-40"
            >
              建立委托
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Metric
              label="可绑定公开来源"
              value={String(snapshot?.sources.length ?? 0)}
              tone="info"
            />
            <Metric
              label="可读短端序列"
              value={String(readableSeries.length)}
            />
            <Metric
              label="可用历史观察"
              value={observationCount.toLocaleString()}
            />
            <Metric label="最近观测日" value={freshest ?? "—"} />
          </div>
          <div className="mt-3 space-y-1">
            {rows.map(row => (
              <div
                key={row.id}
                className="grid items-center gap-2 rounded border border-slate-800 px-2 py-2 text-xs sm:grid-cols-[1fr_8rem_9rem_auto]"
              >
                <span className="text-slate-200">{row.name}</span>
                <span className="text-slate-500">{row.deadline}</span>
                <select
                  value={row.status}
                  onChange={e =>
                    setRows(current =>
                      current.map(item =>
                        item.id === row.id
                          ? {
                              ...item,
                              status: e.target.value as typeof row.status,
                            }
                          : item
                      )
                    )
                  }
                  className="input-terminal text-[10px]"
                >
                  <option>资料收集中</option>
                  <option>待复核</option>
                  <option>可交付</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setRows(current =>
                      current.filter(item => item.id !== row.id)
                    )
                  }
                  className="text-rose-300"
                >
                  移除
                </button>
              </div>
            ))}
            {!rows.length && (
              <Empty>
                填写委托、截止日并绑定一个已登记来源后，漏斗才会产生真实会话任务；没有预置任务。
              </Empty>
            )}
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/45 p-3">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 9 }}
                />
                <YAxis
                  dataKey="status"
                  type="category"
                  width={70}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                />
                <Tooltip contentStyle={tooltip} />
                <Bar
                  dataKey="count"
                  name="委托数"
                  fill="#a78bfa"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            阶段由用户实际推进；系统只计算队列分布，不自动伪造完成度。
          </p>
        </div>
      </div>
    </Card>
  );
}

export function BoomIntegrated({
  snapshot,
  selectedTerms,
  onSelectedTermsChange,
}: {
  snapshot?: MmSnapshot;
  selectedTerms: string[];
  onSelectedTermsChange: (terms: string[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = snapshot?.treasuryAuctions ?? [];
  const terms = [
    ...new Set(all.map(row => row.securityTerm).filter(Boolean)),
  ] as string[];
  const rows = all.filter(
    row =>
      !selectedTerms.length ||
      (row.securityTerm != null && selectedTerms.includes(row.securityTerm))
  );
  const chart = rows
    .reduce<Array<{ date: string; amount: number; count: number }>>(
      (out, row) => {
        const date = row.auctionDate ?? "未披露";
        const amount =
          Number(String(row.offeringAmount ?? "").replace(/[^0-9.-]/g, "")) ||
          0;
        const found = out.find(x => x.date === date);
        if (found) {
          found.amount += amount;
          found.count += 1;
        } else out.push({ date, amount, count: 1 });
        return out;
      },
      []
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const active = rows.find(row => row.cusip === selected);
  return (
    <Card
      title="发售事件轴与供给分布"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "mm-boom-auctions.csv",
              ["CUSIP", "期限", "拍卖日", "发行日", "到期日", "发行额"],
              rows.map(r => [
                r.cusip,
                r.securityTerm,
                r.auctionDate,
                r.issueDate,
                r.maturityDate,
                r.offeringAmount,
              ])
            )
          }
          disabled={!rows.length}
          className="text-xs text-amber-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          拍卖记录
        </button>
      }
    >
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onSelectedTermsChange([])}
          className={`rounded px-2 py-1 text-[10px] ${!selectedTerms.length ? "bg-amber-900/50 text-amber-100" : "text-slate-500 hover:text-slate-300"}`}
        >
          全部
        </button>
        {terms.map(value => (
          <button
            type="button"
            key={value}
            onClick={() =>
              onSelectedTermsChange(
                selectedTerms.includes(value)
                  ? selectedTerms.filter(item => item !== value)
                  : [...selectedTerms, value]
              )
            }
            className={`rounded px-2 py-1 text-[10px] ${selectedTerms.includes(value) ? "bg-amber-900/50 text-amber-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="h-52">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    minTickGap={28}
                  />
                  <YAxis
                    yAxisId="amount"
                    tick={{ fill: "#64748b", fontSize: 9 }}
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fill: "#64748b", fontSize: 9 }}
                  />
                  <Tooltip contentStyle={tooltip} />
                  <Bar
                    yAxisId="amount"
                    dataKey="amount"
                    name="公告发行额"
                    fill="#f59e0b"
                    opacity={0.75}
                  />
                  <Line
                    yAxisId="count"
                    dataKey="count"
                    name="事件数"
                    stroke="#22d3ee"
                    dot
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty>当前筛选没有财政部已发布拍卖记录。</Empty>
            )}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            柱形为公开发行额，折线为同日事件数；不推断未来未公告供给。
          </p>
        </div>
        <div className="max-h-60 overflow-auto rounded border border-slate-800">
          {rows.map((row, index) => (
            <button
              type="button"
              key={`${row.cusip}-${index}`}
              onClick={() => setSelected(row.cusip)}
              className={`grid w-full grid-cols-[1fr_auto] gap-2 border-b border-slate-800 px-3 py-2 text-left text-[11px] ${active === row ? "bg-amber-950/30" : "hover:bg-slate-900/60"}`}
            >
              <span>
                <b className="text-slate-200">
                  {row.securityTerm ?? "期限待披露"}
                </b>
                <span className="ml-2 font-mono text-slate-500">
                  {row.cusip ?? "CUSIP待披露"}
                </span>
              </span>
              <span className="text-amber-200">{row.auctionDate ?? "—"}</span>
            </button>
          ))}
          {!rows.length && <Empty>没有匹配事件。</Empty>}
        </div>
      </div>
      {active && (
        <div className="mt-3 grid gap-2 rounded border border-amber-900/50 bg-amber-950/10 p-3 text-xs sm:grid-cols-4">
          <Metric
            label="拍卖日"
            value={active.auctionDate ?? "—"}
            tone="warn"
          />
          <Metric label="发行日" value={active.issueDate ?? "—"} />
          <Metric label="到期日" value={active.maturityDate ?? "—"} />
          <Metric label="公告规模" value={active.offeringAmount ?? "—"} />
        </div>
      )}
    </Card>
  );
}

export function TconIntegrated({ snapshot }: { snapshot?: MmSnapshot }) {
  const [windowDays, setWindowDays] = useState(90);
  const [limit, setLimit] = useState(10);
  const sofr = snapshot?.rates.find(r => r.id === "SOFR");
  const effr = snapshot?.rates.find(r => r.id === "EFFR");
  const iorb = snapshot?.rates.find(r => r.id === "IORB");
  const effrDates = new Set((effr?.history ?? []).map(point => point.date));
  const iorbDates = new Set((iorb?.history ?? []).map(point => point.date));
  const dates = (sofr?.history ?? [])
    .map(point => point.date)
    .filter(date => effrDates.has(date) && iorbDates.has(date))
    .sort()
    .slice(-windowDays);
  const rows = dates.flatMap(date => {
    const s = sofr?.history.find(p => p.date === date)?.value;
    const e = effr?.history.find(p => p.date === date)?.value;
    const i = iorb?.history.find(p => p.date === date)?.value;
    return s != null && e != null && i != null
      ? [{ date, secured: (s - e) * 100, reserve: (e - i) * 100 }]
      : [];
  });
  const breaches = rows.filter(
    r => Math.abs(r.secured) > limit || Math.abs(r.reserve) > limit
  ).length;
  return (
    <Card title="政策走廊偏移监控">
      <div className="grid gap-2 sm:grid-cols-4">
        <Metric
          label="担保融资腿"
          value={rows.at(-1) ? `${rows.at(-1)!.secured.toFixed(1)} bp` : "—"}
          tone="info"
          trend={rows.map(row => row.secured)}
        />
        <Metric
          label="准备金腿"
          value={rows.at(-1) ? `${rows.at(-1)!.reserve.toFixed(1)} bp` : "—"}
          tone="info"
          trend={rows.map(row => row.reserve)}
        />
        <Metric
          label="越界观察"
          value={String(breaches)}
          tone={breaches ? "warn" : "pos"}
        />
        <label className="text-xs text-slate-500">
          容许带（bp）
          <input
            type="number"
            min="0"
            value={limit}
            onChange={e => setLimit(Number(e.target.value) || 0)}
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-1">
        {[30, 90, 180].map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setWindowDays(value)}
            className={`rounded px-2 py-1 text-[10px] ${windowDays === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
      </div>
      <div className="mt-2 h-64">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 9 }}
                minTickGap={28}
              />
              <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
              <Tooltip contentStyle={tooltip} />
              <ReferenceLine y={limit} stroke="#f59e0b" strokeDasharray="4 4" />
              <ReferenceLine
                y={-limit}
                stroke="#f59e0b"
                strokeDasharray="4 4"
              />
              <Line
                dataKey="secured"
                name="SOFR−EFFR (bp)"
                stroke="#22d3ee"
                dot={false}
              />
              <Line
                dataKey="reserve"
                name="EFFR−IORB (bp)"
                stroke="#a78bfa"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty>三条政策实施序列缺少同日观察，无法计算走廊偏移。</Empty>
        )}
      </div>
      <div
        className="mt-2 grid grid-cols-10 gap-1"
        aria-label="最近走廊偏移状态带"
      >
        {rows.slice(-40).map(row => {
          const magnitude = Math.max(
            Math.abs(row.secured),
            Math.abs(row.reserve)
          );
          return (
            <div
              key={row.date}
              title={`${row.date} · 最大偏移 ${magnitude.toFixed(1)} bp`}
              className={`h-3 ${magnitude > limit ? "bg-amber-400" : magnitude > limit * 0.6 ? "bg-emerald-500" : "bg-emerald-950"}`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        仅比较同日公开观察与用户阈值；越界不自动解释为政策变化或交易信号。
      </p>
    </Card>
  );
}

export function CurveDirectoryIntegrated({
  snapshot,
  cross = false,
}: {
  snapshot?: MmSnapshot;
  cross?: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("国库券");
  const [basket, setBasket] = useState("政策走廊");
  const localFamilies: Record<string, string[]> = {
    隔夜基准: ["SOFR", "EFFR", "OBFR"],
    国库券: ["DTB4WK", "DTB3", "DTB6"],
    商业票据: ["DCPF3M", "DCPN3M"],
  };
  const globalBaskets: Record<string, string[]> = {
    政策走廊: ["ECBDFR", "ECBMRRFR", "ECBMLFR"],
    跨国短端: [
      "IRSTCI01GBM156N",
      "IRSTCI01CAM156N",
      "IRSTCI01AUM156N",
      "IR3TIB01JPM156N",
    ],
  };
  const globalLabels: Record<string, string> = {
    ECBDFR: "欧元区·存款便利",
    ECBMRRFR: "欧元区·主要再融资",
    ECBMLFR: "欧元区·边际贷款",
    IRSTCI01GBM156N: "英国·短期利率",
    IRSTCI01CAM156N: "加拿大·短期利率",
    IRSTCI01AUM156N: "澳大利亚·短期利率",
    IR3TIB01JPM156N: "日本·3M 银行间",
  };
  if (!cross) {
    const rows = (snapshot?.rates ?? []).filter(
      row =>
        localFamilies[family]?.includes(row.id) &&
        row.value != null &&
        `${row.id}${row.label}${row.category}`
          .toLowerCase()
          .includes(query.toLowerCase())
    );
    const selected =
      (snapshot?.rates ?? []).find(
        row => row.id === selectedId && rows.some(item => item.id === row.id)
      ) ?? rows[0];
    return (
      <Card
        title="美国货币工具期限曲线发现器"
        action={
          <button
            type="button"
            onClick={() =>
              exportCsv(
                "mm-crvf-instrument-curve.csv",
                [
                  "工具代码",
                  "工具名称",
                  "期限或定义",
                  "最近观察",
                  "单位",
                  "观察日",
                ],
                rows.map(row => [
                  row.id,
                  row.label,
                  row.category,
                  row.value,
                  row.unit,
                  row.observationDate,
                ])
              )
            }
            disabled={!rows.length}
            className="text-xs text-cyan-300 disabled:text-slate-600"
          >
            <Download className="mr-1 inline h-3 w-3" />
            导出工具曲线
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-500">工具族</span>
          {Object.keys(localFamilies).map(name => (
            <button
              type="button"
              key={name}
              onClick={() => {
                setFamily(name);
                setSelectedId("");
              }}
              className={`rounded px-2 py-1 text-[10px] ${family === name ? "bg-cyan-900 text-cyan-100" : "border border-slate-800 text-slate-500"}`}
            >
              {name}
            </button>
          ))}
          <div className="ml-auto flex min-w-60 items-center gap-1 rounded border border-slate-700 px-2">
            <Search className="h-3 w-3 text-slate-500" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="代码、名称或工具定义"
              className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="h-56">
              {rows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows}
                    onClick={state => {
                      const id = (
                        state?.activePayload?.[0]?.payload as MmRate | undefined
                      )?.id;
                      if (id) setSelectedId(id);
                    }}
                  >
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="id" tick={{ fill: "#64748b", fontSize: 9 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Tooltip contentStyle={tooltip} />
                    <Bar
                      dataKey="value"
                      name="最近公开利率 (%)"
                      radius={[4, 4, 0, 0]}
                    >
                      {rows.map((row, index) => (
                        <Cell
                          key={row.id}
                          fill={
                            selected?.id === row.id
                              ? "#f59e0b"
                              : COLORS[index % COLORS.length]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty>
                  该工具族当前没有可读观察；不会复制其他工具的数据补位。
                </Empty>
              )}
            </div>
            <div className="mt-2 grid gap-1 sm:grid-cols-3" aria-label="可下钻曲线节点">
              {rows.map(row => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  aria-pressed={selected?.id === row.id}
                  className={`grid grid-cols-[auto_1fr] items-center gap-2 border px-2 py-1.5 text-left text-[10px] ${selected?.id === row.id ? "border-amber-600 bg-amber-950/25 text-amber-100" : "border-slate-800 text-slate-400 hover:border-cyan-800"}`}
                >
                  <b className="font-mono">{row.id}</b>
                  <span className="text-right">{formatObservation(row)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/45 p-3">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-cyan-300">
                      {selected.id}
                    </p>
                    <h5 className="mt-1 text-sm font-semibold text-slate-100">
                      {selected.category}
                    </h5>
                    <p className="mt-1 text-[10px] text-slate-500">
                      最近观察 {formatObservation(selected)} ·{" "}
                      {selected.observationDate}
                    </p>
                  </div>
                  {sourceLink(selected.sourceUrl, "核对该工具")}
                </div>
                <div className="mt-3 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selected.history}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#64748b", fontSize: 8 }}
                        minTickGap={24}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#64748b", fontSize: 8 }}
                      />
                      <Tooltip contentStyle={tooltip} />
                      <Area
                        dataKey="value"
                        name={selected.label}
                        stroke="#f59e0b"
                        fill="#92400e"
                        fillOpacity={0.22}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <Empty>选择一个有可读历史的工具。</Empty>
            )}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          本入口只用于同一工具族内的期限节点发现与单序列历史下钻，不展示全球来源目录。
        </p>
      </Card>
    );
  }
  const rows = (snapshot?.rates ?? []).filter(
    row => globalBaskets[basket]?.includes(row.id) && row.value != null
  );
  const selected =
    (snapshot?.rates ?? []).find(
      row => row.id === selectedId && rows.some(item => item.id === row.id)
    ) ?? rows[0];
  const median = rows.length
    ? ([...rows].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[
        Math.floor(rows.length / 2)
      ]?.value ?? null)
    : null;
  return (
    <Card
      title="全球短端政策篮子可比台"
      action={
        <button
          type="button"
          onClick={() =>
            exportCsv(
              "mm-crvf-global-policy-basket.csv",
              [
                "市场节点",
                "公开值",
                "观察日",
                "相对篮子中位数(bp)",
                "原始地址",
              ],
              rows.map(row => [
                globalLabels[row.id] ?? row.label,
                row.value,
                row.observationDate,
                median == null || row.value == null
                  ? null
                  : (row.value - median) * 100,
                row.sourceUrl,
              ])
            )
          }
          disabled={!rows.length}
          className="text-xs text-violet-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          导出跨市场篮子
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {Object.keys(globalBaskets).map(name => (
          <button
            type="button"
            key={name}
            onClick={() => {
              setBasket(name);
              setSelectedId("");
            }}
            className={`rounded border px-3 py-1 text-[10px] ${basket === name ? "border-violet-600 bg-violet-950/40 text-violet-100" : "border-slate-800 text-slate-500"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="overflow-auto rounded border border-slate-800">
          <table className="min-w-full text-[11px]">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-2">市场节点</th>
                <th className="p-2">公开值</th>
                <th className="p-2">观察日</th>
                <th className="p-2">距篮子中位数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`cursor-pointer border-t border-slate-800 ${selected?.id === row.id ? "bg-violet-950/25" : "hover:bg-slate-900/60"}`}
                >
                  <td className="p-2 text-violet-100">
                    {globalLabels[row.id] ?? row.label}
                  </td>
                  <td className="p-2">{formatObservation(row)}</td>
                  <td className="p-2 text-slate-500">
                    {row.observationDate ?? "—"}
                  </td>
                  <td className="p-2 text-slate-300">
                    {median == null || row.value == null
                      ? "—"
                      : `${((row.value - median) * 100).toFixed(1)} bp`}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="p-4 text-slate-500">
                    当前篮子没有可读的同类公开观察。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/45 p-3">
          <div className="h-40">
            {rows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical">
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tick={{ fill: "#64748b", fontSize: 8 }}
                  />
                  <YAxis
                    dataKey="id"
                    type="category"
                    width={120}
                    tick={{ fill: "#94a3b8", fontSize: 8 }}
                  />
                  <Tooltip contentStyle={tooltip} />
                  <Bar
                    dataKey="value"
                    name="公开短端利率 (%)"
                    fill="#a78bfa"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty>没有可比较节点。</Empty>
            )}
          </div>
          {selected && (
            <div className="mt-3 border-t border-slate-800 pt-3">
              <div className="flex justify-between gap-2">
                <b className="text-violet-100">
                  {globalLabels[selected.id] ?? selected.label}
                </b>
                {sourceLink(selected.sourceUrl, "核验该市场")}
              </div>
              <div className="mt-2 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selected.history}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip contentStyle={tooltip} />
                    <Line
                      dataKey="value"
                      name={globalLabels[selected.id] ?? selected.label}
                      stroke="#a78bfa"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        本入口只做同类政策篮子的跨市场水平、相对中位数与各自历史比较；不复用工具发现清单，也不换算成交易信号。
      </p>
    </Card>
  );
}

export function FibcIntegrated() {
  const [face, setFace] = useState(1_000_000);
  const [price, setPrice] = useState(990_000);
  const [days, setDays] = useState(90);
  const [basis, setBasis] = useState(360);
  const valid = face > 0 && price > 0 && price <= face && days > 0 && basis > 0;
  const discount = valid
    ? ((((face - price) / face) * basis) / days) * 100
    : null;
  const investment = valid
    ? ((((face - price) / price) * basis) / days) * 100
    : null;
  const curve = Array.from({ length: 17 }, (_, index) => {
    const shift = (index - 8) * 0.125;
    const scenario = price * (1 + shift / 100);
    return {
      shift,
      price: scenario,
      yield:
        scenario > 0
          ? ((((face - scenario) / scenario) * basis) / days) * 100
          : null,
    };
  });
  const conventions = [360, 365].map(dayBasis => ({
    convention: `ACT/${dayBasis}`,
    discount: valid
      ? ((((face - price) / face) * dayBasis) / days) * 100
      : null,
    investment: valid
      ? ((((face - price) / price) * dayBasis) / days) * 100
      : null,
  }));
  return (
    <Card title="贴现工具估值与收益敏感度">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs text-slate-500">
          面值
          <input
            type="number"
            value={face}
            onChange={e => setFace(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          净价金额
          <input
            type="number"
            value={price}
            onChange={e => setPrice(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          到期天数
          <input
            type="number"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          日计数
          <select
            value={basis}
            onChange={e => setBasis(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          >
            <option value={360}>ACT/360</option>
            <option value={365}>ACT/365</option>
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="贴现收益率"
          value={discount == null ? "—" : `${discount.toFixed(5)}%`}
          tone="info"
        />
        <Metric
          label="投资收益率"
          value={investment == null ? "—" : `${investment.toFixed(5)}%`}
          tone="info"
        />
        <Metric
          label="到期增值"
          value={valid ? (face - price).toLocaleString() : "—"}
        />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
        <div className="h-60">
          {valid ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="shift"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  label={{
                    value: "价格冲击 %",
                    position: "insideBottom",
                    offset: -2,
                    fill: "#64748b",
                    fontSize: 9,
                  }}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                <Tooltip contentStyle={tooltip} />
                <ReferenceLine x={0} stroke="#475569" />
                <Line
                  dataKey="yield"
                  name="投资收益率 (%)"
                  stroke="#34d399"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty>输入必须为正数，且净价金额不能高于面值。</Empty>
          )}
        </div>
        <div className="min-w-0 border-l border-yellow-950 pl-3">
          <div className="relative mt-5 h-12 border-t border-yellow-700/60">
            <span className="absolute -top-2 left-0 h-4 w-px bg-yellow-400" />
            <span className="absolute -top-2 right-0 h-4 w-px bg-yellow-400" />
            <span className="absolute left-0 top-4 text-[9px] text-slate-500">
              结算现金流
              <br />
              <b className="font-mono text-slate-200">
                −{price.toLocaleString()}
              </b>
            </span>
            <span className="absolute right-0 top-4 text-right text-[9px] text-slate-500">
              {days} 天到期
              <br />
              <b className="font-mono text-yellow-200">
                +{face.toLocaleString()}
              </b>
            </span>
          </div>
          <table className="mt-8 min-w-full text-[10px]">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="p-1.5">计数惯例</th>
                <th>贴现率</th>
                <th>投资率</th>
                <th>口径差</th>
              </tr>
            </thead>
            <tbody>
              {conventions.map(row => (
                <tr
                  key={row.convention}
                  className={`border-t border-slate-900 ${basis === Number(row.convention.slice(-3)) ? "text-yellow-200" : "text-slate-400"}`}
                >
                  <td className="p-1.5">{row.convention}</td>
                  <td>
                    {row.discount == null ? "—" : `${row.discount.toFixed(5)}%`}
                  </td>
                  <td>
                    {row.investment == null
                      ? "—"
                      : `${row.investment.toFixed(5)}%`}
                  </td>
                  <td>
                    {row.discount == null || row.investment == null
                      ? "—"
                      : `${(row.investment - row.discount).toFixed(5)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        曲线由当前输入逐点复算；不引用或伪装市场报价。
      </p>
    </Card>
  );
}

export function EfsfIntegrated({ snapshot }: { snapshot?: MmSnapshot }) {
  const feed = useModuleLiveFeed("/terminal?open=efsf&module=money-market");
  const pushed = uniqueFeed(feed.items);
  const official = snapshot?.sources.find(s => s.id === "EFSF");
  const [identifier, setIdentifier] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("EMTN 文件");
  const [url, setUrl] = useState(
    official?.url ?? "https://www.efsf.europa.eu/"
  );
  const [documents, setDocuments] = useState<
    Array<{
      id: number;
      identifier: string;
      date: string;
      kind: string;
      url: string;
    }>
  >([]);
  const eligible = useMemo(() => {
    try {
      return new URL(url).hostname.endsWith("efsf.europa.eu");
    } catch {
      return false;
    }
  }, [url]);
  const add = () => {
    if (!identifier.trim() || !date || !eligible) return;
    setDocuments(rows => [
      ...rows,
      { id: Date.now(), identifier: identifier.trim(), date, kind, url },
    ]);
    setIdentifier("");
  };
  const chart = Object.entries(
    documents.reduce<Record<string, number>>((map, row) => {
      map[row.kind] = (map[row.kind] ?? 0) + 1;
      return map;
    }, {})
  ).map(([type, count]) => ({ type, count }));
  return (
    <Card title="EFSF 文件血缘与版本台">
      <div className="grid gap-2 md:grid-cols-[1fr_9rem_9rem_1.4fr_auto]">
        <input
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          placeholder="ISIN、文件名或版本号"
          className="input-terminal text-xs"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input-terminal text-xs"
        />
        <select
          value={kind}
          onChange={e => setKind(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>EMTN 文件</option>
          <option>融资计划</option>
          <option>投资者资料</option>
          <option>新闻稿</option>
        </select>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="input-terminal text-xs"
        />
        <button
          type="button"
          onClick={add}
          disabled={!identifier.trim() || !date || !eligible}
          className="rounded border border-amber-800 px-3 text-xs text-amber-200 disabled:opacity-40"
        >
          登记版本
        </button>
      </div>
      <div
        className={`mt-2 rounded border px-3 py-2 text-[10px] ${eligible ? "border-emerald-900 text-emerald-300" : "border-rose-900 text-rose-300"}`}
      >
        {eligible
          ? "链接通过 EFSF 官方域名校验，可登记到当前版本链。"
          : "链接不属于 efsf.europa.eu，已阻止进入证据链。"}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="max-h-64 overflow-auto rounded border border-slate-800">
          {pushed.map(item => (
            <article key={item.itemKey} className="border-b border-slate-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-100">{item.title}</h4>
                <Badge tone="info">{feed.connection === "live" ? "实时送达" : "断线补收"}</Badge>
              </div>
              <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-[10px] leading-5 text-slate-400">{item.body}</p>
              <time className="mt-1 block text-[9px] text-slate-600">
                {item.publishedAt ? new Date(item.publishedAt).toLocaleString("zh-CN") : ""}
              </time>
            </article>
          ))}
          {documents
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(row => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_8rem_auto] items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs"
              >
                <span>
                  <b className="text-slate-200">{row.identifier}</b>
                  <span className="ml-2 text-slate-500">{row.kind}</span>
                </span>
                <time className="text-slate-500">{row.date}</time>
                {sourceLink(row.url, "核验文件")}
              </div>
            ))}
          {!pushed.length && !documents.length && (
            <Empty>
              当前没有实时送达或用户核验登记的 EFSF 文件；不会填入虚构 EMTN 条款。
            </Empty>
          )}
        </div>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="送达文件" value={String(pushed.length)} tone="info" />
            <Metric label="人工核验" value={String(documents.length)} />
          </div>
          <div className="mt-2 h-40">
          {chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="type" tick={{ fill: "#64748b", fontSize: 9 }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 9 }}
                />
                <Tooltip contentStyle={tooltip} />
                <Bar dataKey="count" name="已核验版本" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center">
              <Landmark className="h-12 w-12 text-slate-800" />
            </div>
          )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function EtradeIntegrated() {
  const [instrument, setInstrument] = useState("");
  const [notional, setNotional] = useState("");
  const [settlement, setSettlement] = useState("T+1");
  const [source, setSource] = useState("");
  const [checks, setChecks] = useState({
    price: false,
    permission: false,
    approval: false,
  });
  const [tickets, setTickets] = useState<
    Array<{
      id: number;
      instrument: string;
      notional: number;
      settlement: string;
      state: string;
    }>
  >([]);
  const validSource = /^https:\/\//.test(source);
  const score = [
    instrument.trim().length > 0,
    Number(notional) > 0,
    validSource,
    checks.price,
    checks.permission,
    checks.approval,
  ].filter(Boolean).length;
  const ready = score === 6;
  const create = () => {
    if (!ready) return;
    setTickets(rows => [
      {
        id: Date.now(),
        instrument: instrument.trim(),
        notional: Number(notional),
        settlement,
        state: "待机构通道受理",
      },
      ...rows,
    ]);
    setInstrument("");
    setNotional("");
    setChecks({ price: false, permission: false, approval: false });
  };
  const stages = [
    { name: "标的", done: !!instrument.trim() },
    { name: "金额", done: Number(notional) > 0 },
    { name: "证据", done: validSource },
    { name: "价格复核", done: checks.price },
    { name: "权限检查", done: checks.permission },
    { name: "审批", done: checks.approval },
  ];
  return (
    <Card title="交易前验证链与受理簿">
      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={instrument}
          onChange={e => setInstrument(e.target.value)}
          placeholder="证券或工具代码"
          className="input-terminal text-xs"
        />
        <input
          value={notional}
          onChange={e => setNotional(e.target.value)}
          type="number"
          placeholder="名义金额"
          className="input-terminal text-xs"
        />
        <select
          value={settlement}
          onChange={e => setSettlement(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>T+0</option>
          <option>T+1</option>
          <option>T+2</option>
          <option>待双方确认</option>
        </select>
        <input
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="授权价格证据 HTTPS 地址"
          className="input-terminal text-xs"
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 md:grid-cols-6">
        {stages.map((stage, index) => (
          <div
            key={stage.name}
            className={`relative rounded border p-2 text-center text-[10px] ${stage.done ? "border-emerald-800 bg-emerald-950/20 text-emerald-200" : "border-slate-800 text-slate-600"}`}
          >
            <span className="font-mono">{index + 1}</span>
            <br />
            {stage.name}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {(
          [
            ["price", "已核验价格有效期"],
            ["permission", "已通过账户权限"],
            ["approval", "已取得内部批准"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs text-slate-400">
            <input
              type="checkbox"
              checked={checks[key]}
              onChange={e =>
                setChecks(v => ({ ...v, [key]: e.target.checked }))
              }
            />{" "}
            {label}
          </label>
        ))}
        <button
          type="button"
          onClick={create}
          disabled={!ready}
          className="ml-auto rounded border border-cyan-800 px-3 py-1 text-xs text-cyan-200 disabled:opacity-40"
        >
          <Send className="mr-1 inline h-3 w-3" />
          创建受理记录
        </button>
      </div>
      <div className="mt-3 overflow-auto rounded border border-slate-800">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">工具</th>
              <th className="p-2">名义金额</th>
              <th className="p-2">结算</th>
              <th className="p-2">当前状态</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(row => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="p-2 text-cyan-100">{row.instrument}</td>
                <td className="p-2">{row.notional.toLocaleString()}</td>
                <td className="p-2">{row.settlement}</td>
                <td className="p-2 text-amber-200">{row.state}</td>
              </tr>
            ))}
            {!tickets.length && (
              <tr>
                <td colSpan={4} className="p-4 text-slate-500">
                  验证链完成前不生成受理记录；此页面不连接交易场所，也不伪装成交。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function EdsfIntegrated() {
  const [near, setNear] = useState(3.5);
  const [far, setFar] = useState(3.8);
  const [start, setStart] = useState(30);
  const [end, setEnd] = useState(120);
  const [notional, setNotional] = useState(1_000_000);
  const fraction = (end - start) / 360;
  const forward =
    fraction > 0
      ? (((1 + ((far / 100) * end) / 360) / (1 + ((near / 100) * start) / 360) -
          1) /
          fraction) *
        100
      : null;
  const cash = forward == null ? null : ((notional * forward) / 100) * fraction;
  const surface = Array.from({ length: 17 }, (_, index) => {
    const shock = (index - 8) * 5;
    const scenario = (forward ?? 0) + shock / 100;
    return {
      shock,
      forward: Number(scenario.toFixed(5)),
      cash: Number((((notional * scenario) / 100) * fraction).toFixed(2)),
    };
  });
  return (
    <Card title="合成 FRA 生命周期与损益曲线">
      <div className="grid gap-2 sm:grid-cols-5">
        <label className="text-xs text-slate-500">
          近端利率 %
          <input
            type="number"
            step="0.01"
            value={near}
            onChange={e => setNear(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          远端利率 %
          <input
            type="number"
            step="0.01"
            value={far}
            onChange={e => setFar(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          起始天数
          <input
            type="number"
            value={start}
            onChange={e => setStart(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          结束天数
          <input
            type="number"
            value={end}
            onChange={e => setEnd(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          名义金额
          <input
            type="number"
            value={notional}
            onChange={e => setNotional(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="合成远期"
          value={
            forward == null || !Number.isFinite(forward)
              ? "—"
              : `${forward.toFixed(5)}%`
          }
          tone="info"
        />
        <Metric
          label="计息分数"
          value={fraction > 0 ? fraction.toFixed(6) : "—"}
        />
        <Metric
          label="输入驱动现金流"
          value={
            cash == null || !Number.isFinite(cash)
              ? "—"
              : cash.toLocaleString(undefined, { maximumFractionDigits: 2 })
          }
        />
      </div>
      <div className="mt-3 h-60">
        {fraction > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={surface}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="shock"
                tick={{ fill: "#64748b", fontSize: 9 }}
                label={{
                  value: "远期冲击 bp",
                  position: "insideBottom",
                  offset: -2,
                  fill: "#64748b",
                  fontSize: 9,
                }}
              />
              <YAxis yAxisId="cash" tick={{ fill: "#64748b", fontSize: 9 }} />
              <YAxis
                yAxisId="rate"
                orientation="right"
                tick={{ fill: "#64748b", fontSize: 9 }}
              />
              <Tooltip contentStyle={tooltip} />
              <ReferenceLine yAxisId="cash" y={0} stroke="#475569" />
              <Area
                yAxisId="cash"
                dataKey="cash"
                name="期间现金流"
                stroke="#a78bfa"
                fill="#7c3aed"
                fillOpacity={0.22}
              />
              <Line
                yAxisId="rate"
                dataKey="forward"
                name="冲击后远期 (%)"
                stroke="#22d3ee"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <Empty>结束天数必须大于起始天数。</Empty>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        全部结果由当前输入透明复算，不冒充交易所合约或市场隐含远期。
      </p>
    </Card>
  );
}

export function WbfIntegrated() {
  const [future, setFuture] = useState(110);
  const [cash, setCash] = useState(108);
  const [factor, setFactor] = useState(0.9);
  const [days, setDays] = useState(90);
  const basis = cash - future * factor;
  const repo =
    future > 0 && factor > 0 && days > 0
      ? (((basis / (future * factor)) * 365) / days) * 100
      : null;
  const grid = Array.from({ length: 17 }, (_, index) => {
    const shift = (index - 8) * 0.0025;
    const cf = factor + shift;
    const b = cash - future * cf;
    return {
      shift: Number((shift * 100).toFixed(2)),
      converted: Number((future * cf).toFixed(5)),
      basis: Number(b.toFixed(5)),
      repo:
        future > 0 && cf > 0
          ? Number(((((b / (future * cf)) * 365) / days) * 100).toFixed(4))
          : null,
    };
  });
  return (
    <Card title="转换因子—基差—隐含回购联动">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs text-slate-500">
          期货输入价
          <input
            type="number"
            step="0.01"
            value={future}
            onChange={e => setFuture(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          现券输入价
          <input
            type="number"
            step="0.01"
            value={cash}
            onChange={e => setCash(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          转换因子
          <input
            type="number"
            step="0.0001"
            value={factor}
            onChange={e => setFactor(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          持有天数
          <input
            type="number"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="当前基差"
          value={Number.isFinite(basis) ? basis.toFixed(5) : "—"}
          tone="info"
        />
        <Metric
          label="隐含回购"
          value={
            repo == null || !Number.isFinite(repo) ? "—" : `${repo.toFixed(4)}%`
          }
          tone="info"
        />
        <Metric
          label="转换后期货"
          value={
            Number.isFinite(future * factor)
              ? (future * factor).toFixed(5)
              : "—"
          }
        />
      </div>
      <div className="mt-3 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={grid}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis dataKey="shift" tick={{ fill: "#64748b", fontSize: 9 }} />
            <YAxis yAxisId="basis" tick={{ fill: "#64748b", fontSize: 9 }} />
            <YAxis
              yAxisId="repo"
              orientation="right"
              tick={{ fill: "#64748b", fontSize: 9 }}
            />
            <Tooltip contentStyle={tooltip} />
            <ReferenceLine yAxisId="basis" y={0} stroke="#475569" />
            <Bar yAxisId="basis" dataKey="basis" name="基差" fill="#60a5fa" />
            <Line
              yAxisId="repo"
              dataKey="repo"
              name="隐含回购率 (%)"
              stroke="#f59e0b"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        因子与价格均为用户输入；工作表不识别 CTD，也不提供可执行期货行情。
      </p>
    </Card>
  );
}

export function PbocIntegrated({ snapshot }: { snapshot?: MmSnapshot }) {
  const feed = useModuleLiveFeed("/terminal?open=pboc&module=money-market");
  const pushed = uniqueFeed(feed.items);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [tool, setTool] = useState("7天逆回购");
  const [amount, setAmount] = useState("");
  const [events, setEvents] = useState<
    Array<{
      id: number;
      title: string;
      date: string;
      tool: string;
      amount: number;
    }>
  >([]);
  const add = () => {
    if (!title.trim() || !date || !Number.isFinite(Number(amount))) return;
    setEvents(rows => [
      ...rows,
      {
        id: Date.now(),
        title: title.trim(),
        date,
        tool,
        amount: Number(amount),
      },
    ]);
    setTitle("");
    setAmount("");
  };
  const chart = [...events].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card title="公开市场操作事件轴">
      <div className="grid gap-2 md:grid-cols-[1fr_9rem_9rem_10rem_auto]">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="公告或操作名称"
          className="input-terminal text-xs"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input-terminal text-xs"
        />
        <select
          value={tool}
          onChange={e => setTool(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>7天逆回购</option>
          <option>14天逆回购</option>
          <option>MLF</option>
          <option>国库现金定存</option>
          <option>其他工具</option>
        </select>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="净投放(+)/回笼(-) 亿元"
          className="input-terminal text-xs"
        />
        <button
          type="button"
          onClick={add}
          className="rounded border border-rose-800 px-3 text-xs text-rose-200"
        >
          登记核验值
        </button>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="h-56">
          {chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} />
                <Tooltip contentStyle={tooltip} />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="amount" name="净投放/回笼（亿元）">
                  {chart.map(row => (
                    <Cell
                      key={row.id}
                      fill={row.amount >= 0 ? "#34d399" : "#fb7185"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty>
              只有经用户从正式公告核验的金额才进入事件轴；当前没有登记值。
            </Empty>
          )}
        </div>
        <div className="max-h-56 overflow-auto rounded border border-slate-800">
          {pushed.map(item => (
            <article
              key={item.itemKey}
              className="border-b border-slate-800 p-3"
            >
              <h4 className="text-xs font-semibold text-slate-100">
                {item.title}
              </h4>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[10px] leading-5 text-slate-400">
                {item.body}
              </p>
              <time className="mt-1 block text-[9px] text-slate-600">
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleString("zh-CN")
                  : ""}
              </time>
            </article>
          ))}
          {!pushed.length && <Empty>当前暂无已审核政策内容。</Empty>}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <span className="text-[9px] text-slate-600">
          内容状态：{feed.connection === "live" ? "实时同步" : "自动补收"}
        </span>
      </div>
    </Card>
  );
}

export function CenbIntegrated({ snapshot }: { snapshot?: MmSnapshot }) {
  const [region, setRegion] = useState("全部");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const centralBankSourceIds = new Set([
    "FRED-SOFR",
    "FRED-EFFR",
    "NYFED-FUNDING",
    "ECB-POLICY-CORRIDOR",
    "OECD-SHORT-RATES",
    "BCB-CDI",
    "CBC-CALL",
    "PBOC",
  ]);
  const centralBankSources = (snapshot?.sources ?? []).filter(source =>
    centralBankSourceIds.has(source.id)
  );
  const regions = [
    "全部",
    ...new Set(centralBankSources.map(source => source.region)),
  ];
  const sources = centralBankSources.filter(
    source => region === "全部" || source.region === region
  );
  const sourceRateIds: Record<string, string[]> = {
    "FRED-SOFR": ["SOFR"],
    "FRED-EFFR": ["EFFR"],
    "NYFED-FUNDING": ["SOFR", "EFFR", "OBFR", "IORB"],
    "ECB-POLICY-CORRIDOR": ["ECBDFR", "ECBMRRFR", "ECBMLFR"],
    "OECD-SHORT-RATES": [
      "IRSTCI01GBM156N",
      "IRSTCI01CAM156N",
      "IRSTCI01AUM156N",
      "IR3TIB01JPM156N",
    ],
  };
  const allRateIds = [
    "SOFR",
    "EFFR",
    "OBFR",
    "IORB",
    "ECBDFR",
    "ECBMRRFR",
    "ECBMLFR",
    "IRSTCI01GBM156N",
    "IRSTCI01CAM156N",
    "IRSTCI01AUM156N",
    "IR3TIB01JPM156N",
  ];
  const visibleRateIds = new Set(
    region === "全部"
      ? allRateIds
      : sources.flatMap(source => sourceRateIds[source.id] ?? [])
  );
  const rates = (snapshot?.rates ?? []).filter(
    r => visibleRateIds.has(r.id) && r.value != null
  );
  const selectedSource =
    sources.find(source => source.id === selectedSourceId) ?? sources[0];
  const selectedRates = (snapshot?.rates ?? []).filter(rate =>
    (sourceRateIds[selectedSource?.id ?? ""] ?? []).includes(rate.id)
  );
  const selectedObservations = selectedRates.reduce(
    (sum, rate) => sum + rate.history.length,
    0
  );
  const selectedLatest = selectedRates
    .flatMap(rate => (rate.observationDate ? [rate.observationDate] : []))
    .sort()
    .at(-1);
  const selectedLatency = selectedSource
    ? snapshot?.sourceLatencyMs[selectedSource.id]
    : null;
  return (
    <Card title="全球央行短端来源拓扑">
      <div className="flex flex-wrap gap-1">
        {regions.map(value => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setRegion(value);
              setSelectedSourceId("");
            }}
            className={`rounded px-2 py-1 text-[10px] ${region === value ? "bg-violet-900/60 text-violet-100" : "text-slate-500"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-64">
          {rates.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rates} layout="vertical">
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 9 }} />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={105}
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                />
                <Tooltip contentStyle={tooltip} />
                <Bar dataKey="value" name="最近观察 (%)" radius={[0, 4, 4, 0]}>
                  {rates.map((row, index) => (
                    <Cell key={row.id} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty>全球短端公开序列暂不可读。</Empty>
          )}
        </div>
        <div className="max-h-64 space-y-1 overflow-auto">
          {sources.map(s => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSelectedSourceId(s.id)}
              className={`w-full rounded border p-2 text-left text-xs ${selectedSource?.id === s.id ? "border-violet-600 bg-violet-950/20" : "border-slate-800 hover:border-slate-600"}`}
            >
              <div className="flex justify-between">
                <b className="text-violet-100">{s.label}</b>
                <span className="text-[9px] text-slate-600">{s.frequency}</span>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {s.scope}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[9px] text-slate-500">
                <span>序列 {(sourceRateIds[s.id] ?? []).length}</span>
                <span>状态 {(sourceRateIds[s.id] ?? []).some(id => snapshot?.rates.find(rate => rate.id === id)?.status === "available") ? "可读" : "目录"}</span>
                <span>延迟 {snapshot?.sourceLatencyMs[s.id] == null ? "—" : `${snapshot.sourceLatencyMs[s.id]}ms`}</span>
              </div>
            </button>
          ))}
          {!sources.length && <Empty>该地区没有已登记央行来源。</Empty>}
        </div>
      </div>
      {selectedSource && (
        <div className="mt-3 grid gap-2 border-t border-violet-950 pt-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Metric label="可读序列" value={String(selectedRates.filter(rate => rate.status === "available").length)} tone="info" />
          <Metric label="历史覆盖" value={selectedObservations.toLocaleString()} />
          <Metric label="最近观察" value={selectedLatest ?? "按公告更新"} />
          <div className="flex items-center justify-end">
            {sourceLink(selectedSource.url, "核验当前央行来源")}
          </div>
          {selectedLatency != null && (
            <p className="text-[9px] text-slate-600 sm:col-span-4">本次读取响应 {selectedLatency} ms；点击右侧来源可切换独立覆盖与原始记录。</p>
          )}
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        不同市场序列只用于来源覆盖与公开观察比较，不换算为统一交易机会。
      </p>
    </Card>
  );
}

export function NewsIntegrated() {
  const feed = useModuleLiveFeed("/terminal?open=news-mm&module=money-market");
  const [query, setQuery] = useState("");
  const items = uniqueFeed(feed.items).filter(item =>
    `${item.title}${item.body}`.toLowerCase().includes(query.toLowerCase())
  );
  const [selected, setSelected] = useState<string | null>(null);
  const active = items.find(item => item.itemKey === selected) ?? items[0];
  const paragraphs = active ? articleParagraphs(active.body) : [];
  return (
    <Card
      title="货币市场事件研究流"
      action={
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${feed.connection === "live" ? "text-emerald-300" : "text-amber-300"}`}
        >
          <Radio className="h-3 w-3" />
          {feed.connection === "live" ? "实时接收" : "断线补收"}
        </span>
      }
    >
      <div className="flex items-center gap-2 rounded border border-slate-700 px-2">
        <Search className="h-3.5 w-3.5 text-slate-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="检索政策、基准、融资或拍卖事件"
          className="h-9 flex-1 bg-transparent text-xs outline-none"
        />
        <span className="text-[10px] text-slate-600">{items.length} 条</span>
      </div>
      <div className="mt-3 grid min-h-72 gap-3 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="max-h-[42rem] overflow-auto border-r border-slate-800">
          {items.map(item => (
            <button
              type="button"
              key={item.itemKey}
              onClick={() => setSelected(item.itemKey)}
              className={`w-full border-b border-slate-800 p-3 text-left ${active?.itemKey === item.itemKey ? "border-l-2 border-l-slate-200 bg-slate-800/35" : "hover:bg-slate-900/60"}`}
            >
              <span className="block text-xs font-semibold leading-5 text-slate-200">
                {item.title}
              </span>
              <span className="mt-1 block text-[10px] text-cyan-300/80">
                {item.category || item.topic || "货币市场"}
              </span>
              <time className="mt-1 block text-[9px] text-slate-600">
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleString("zh-CN")
                  : ""}
              </time>
            </button>
          ))}
          {!items.length && (
            <Empty>
              当前没有已审核且定向到 NEWS
              的内容；保持真实空状态，不生成占位新闻。
            </Empty>
          )}
        </div>
        <div className="min-w-0 bg-slate-950/25 px-3 py-2 sm:px-6 sm:py-4">
          {active ? (
            <article className="mx-auto max-w-4xl">
              <div className="border-b border-slate-700 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="info">
                      {active.category || active.topic || "货币市场"}
                    </Badge>
                    <h3 className="mt-3 text-xl font-semibold leading-8 text-slate-100">
                      {active.title}
                    </h3>
                  </div>
                  <time className="shrink-0 text-[9px] text-slate-600">
                    {active.publishedAt
                      ? new Date(active.publishedAt).toLocaleString("zh-CN")
                      : ""}
                  </time>
                </div>
                <p className="mt-3 text-[10px] text-slate-500">
                  {active.category || active.topic || "货币市场事件"} · 正文{" "}
                  {active.body.length.toLocaleString()} 字
                </p>
              </div>
              <div className="max-h-[34rem] overflow-auto pr-2">
                {paragraphs.map((paragraph, index) => {
                  const [possibleHeading, ...bodyLines] = paragraph
                    .split("\n")
                    .map(line => line.trim())
                    .filter(Boolean);
                  const hasHeading =
                    bodyLines.length > 0 && possibleHeading.length <= 30;
                  const body = hasHeading ? bodyLines.join(" ") : paragraph;
                  return index === 0 ? (
                    <div
                      key={index}
                      className="my-5 border-l-2 border-slate-300 pl-4"
                    >
                      {hasHeading && (
                        <h4 className="mb-2 text-[11px] tracking-[.12em] text-slate-400">
                          {possibleHeading}
                        </h4>
                      )}
                      <p className="text-[13px] font-medium leading-7 text-slate-200">
                        {body}
                      </p>
                    </div>
                  ) : (
                    <section
                      key={index}
                      className="border-t border-slate-900 py-4"
                    >
                      <span className="font-mono text-[9px] tracking-[.18em] text-slate-600">
                        {String(index).padStart(2, "0")}
                      </span>
                      {hasHeading && (
                        <h4 className="mt-1 text-[13px] font-semibold text-slate-100">
                          {possibleHeading}
                        </h4>
                      )}
                      <p className="mt-2 text-[12px] leading-7 text-slate-300">
                        {body}
                      </p>
                    </section>
                  );
                })}
              </div>
            </article>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Activity className="mx-auto h-12 w-12 text-slate-800" />
                <p className="mt-3 text-xs text-slate-600">
                  等待经过审核的货币市场内容
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
