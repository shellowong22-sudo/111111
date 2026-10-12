import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Filter,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState } from "@/components/sovereign/PanelKit";
import {
  MoneyMarketBadge as Badge,
  MoneyMarketDatum as Metric,
  MoneyMarketSection as Card,
  MoneyMarketWorkbench,
} from "./MoneyMarketWorkbench";
import BoomAuctionCollaborationPanel from "./BoomAuctionCollaborationPanel";
import CentralBankPolicyEvidencePanel from "./CentralBankPolicyEvidencePanel";
import BoomSubscriptionFilters from "./BoomSubscriptionFilters";
import PolicyEvidenceCollaborationPanel from "./PolicyEvidenceCollaborationPanel";
import PolicyEvidenceWorkflowPanel from "./PolicyEvidenceWorkflowPanel";
import MoneyMarketDistinctiveLayer from "./MoneyMarketDistinctiveLayer";
import {
  BtmmDualRangeComparison,
  MktbeatThresholdAlert,
} from "./MoneyMarketReportComparisonEnhancer";
import {
  BoomIntegrated,
  CenbIntegrated,
  CurveDirectoryIntegrated,
  DesIntegrated,
  EdsfIntegrated,
  EfsfIntegrated,
  EtradeIntegrated,
  FibcIntegrated,
  NewsIntegrated,
  PbocIntegrated,
  PgmIntegrated,
  TconIntegrated,
  WbfIntegrated,
  type MmSnapshot,
} from "./MoneyMarketIntegratedViews";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type RatePoint = { date: string; value: number };
type RateSeries = {
  id: string;
  label: string;
  category: string;
  unit?: string;
  sourceUrl: string;
  observationDate: string | null;
  value: number | null;
  changeBps: number | null;
  history: RatePoint[];
  status: "available" | "unavailable";
  limitation: string;
};
type TreasuryAuction = {
  cusip: string | null;
  securityType: string | null;
  securityTerm: string | null;
  auctionDate: string | null;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: string | null;
  sourceUrl: string;
};
type MoneyMarketSource = {
  id: string;
  label: string;
  region: string;
  frequency: string;
  url: string;
  scope: string;
};
type CdiPoint = { date: string; valuePct: number };
type FundingPoint = {
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
type Snapshot = {
  asOf: string;
  rates: RateSeries[];
  treasuryAuctions: TreasuryAuction[];
  cdi: CdiPoint[];
  taiwanCallRate: CdiPoint[];
  fundingTape?: FundingPoint[];
  sourceLatencyMs: Record<string, number | null>;
  sources: MoneyMarketSource[];
};
type ModuleId =
  | "des-mm"
  | "pgm"
  | "mktbeat"
  | "btmm"
  | "boom"
  | "tcon"
  | "rv"
  | "ycqsim"
  | "gc"
  | "crvf-mmkt"
  | "crvf"
  | "fibc"
  | "cdie"
  | "efsf"
  | "mmidx"
  | "etrade"
  | "edsf"
  | "wbf"
  | "pboc"
  | "twdi"
  | "cenb"
  | "news-mm"
  | "source-mm"
  | "mmflow";

const META: Record<
  ModuleId,
  { n: number; ticker: string; title: string; subtitle: string }
> = {
  "des-mm": {
    n: 1,
    ticker: "DES",
    title: "证券与功能说明",
    subtitle: "货币市场工具字段、来源、时效与授权边界字典",
  },
  pgm: {
    n: 2,
    ticker: "PGM",
    title: "货币市场项目列表",
    subtitle: "可追溯研究工作项与资料覆盖管理",
  },
  mktbeat: {
    n: 3,
    ticker: "MKTBEAT",
    title: "当前市场",
    subtitle: "公开隔夜资金基准的历史观察与时效脉冲",
  },
  btmm: {
    n: 4,
    ticker: "BTMM",
    title: "国债与货币市场",
    subtitle: "美国国库券拍卖与公开短端基准联动",
  },
  boom: {
    n: 5,
    ticker: "BOOM",
    title: "货币市场发售",
    subtitle: "美国国库券官方公告与拍卖事件工作台",
  },
  tcon: {
    n: 6,
    ticker: "TCON",
    title: "国债控制面板",
    subtitle: "政策实施走廊观察与自定义阈值核验",
  },
  rv: {
    n: 7,
    ticker: "RV",
    title: "相对价值",
    subtitle: "公开货币基准的历史差值与分位研究",
  },
  ycqsim: {
    n: 8,
    ticker: "YCQSIM",
    title: "收益曲线量子模拟",
    subtitle: "基于用户输入冲击的短端曲线情景工坊",
  },
  gc: {
    n: 9,
    ticker: "GC",
    title: "绘制曲线图",
    subtitle: "公开短端序列的可选择曲线与导出",
  },
  "crvf-mmkt": {
    n: 10,
    ticker: "CRVF MMKT",
    title: "查找曲线-货币市场",
    subtitle: "货币市场曲线与基准资料目录",
  },
  crvf: {
    n: 11,
    ticker: "CRVF",
    title: "查找曲线",
    subtitle: "跨区域、频率与来源的曲线资料比较",
  },
  fibc: {
    n: 12,
    ticker: "FIBC",
    title: "债券计算器",
    subtitle: "用户输入货币市场贴现、收益率与到期价值计算",
  },
  cdie: {
    n: 13,
    ticker: "CDIE",
    title: "预测CDI 对实际DI期货",
    subtitle: "公开 CDI 观察与用户输入 DI 期货年化收益率比较",
  },
  efsf: {
    n: 14,
    ticker: "EFSF",
    title: "分析 EFSF EMTN M-Mkt",
    subtitle: "EFSF 官方资料原件核验与证券资料工作表",
  },
  mmidx: {
    n: 15,
    ticker: "MMIDX",
    title: "货币市场指数",
    subtitle: "公开资金基准的归一化历史比较",
  },
  etrade: {
    n: 16,
    ticker: "ETRADE",
    title: "定价、写单、电子交易",
    subtitle: "货币市场交易准备、来源确认与审批就绪检查",
  },
  edsf: {
    n: 17,
    ticker: "EDSF",
    title: "ED合成FRA",
    subtitle: "用户输入期限利率的合成 FRA 现金流工作表",
  },
  wbf: {
    n: 18,
    ticker: "WBF",
    title: "全球债券期货",
    subtitle: "用户输入合约与转换因子的基差研究工作表",
  },
  pboc: {
    n: 19,
    ticker: "PBOC",
    title: "中国人民银行",
    subtitle: "公开市场和货币政策原始公告证据索引",
  },
  twdi: {
    n: 20,
    ticker: "TWDI",
    title: "台北金融业拆款定盘利率",
    subtitle: "台湾中央银行公开隔夜拆款观察与时效研究",
  },
  cenb: {
    n: 21,
    ticker: "CENB",
    title: "央行查找",
    subtitle: "全球央行公开货币市场资料目录与覆盖核验",
  },
  "news-mm": {
    n: 22,
    ticker: "NEWS",
    title: "新闻与研究报告",
    subtitle: "官方原始资料证据台账与可导出研究交付清单",
  },
  "source-mm": {
    n: 23,
    ticker: "SOURCE",
    title: "公开资料时效监控台",
    subtitle: "公开来源的最近观察日、可用性与复核队列",
  },
  mmflow: {
    n: 24,
    ticker: "MMFLOW",
    title: "货币市场研究交付",
    subtitle: "按当前研究选择组装可追溯的公开来源交付清单",
  },
};

const rate = (snapshot: Snapshot | undefined, id: string) =>
  snapshot?.rates.find(item => item.id === id);
const fmt = (value: number | null | undefined, unit = "%") =>
  value == null ? "—" : `${value.toFixed(3)}${unit}`;
const csv = (
  name: string,
  headings: string[],
  rows: Array<Array<string | number | null | undefined>>
) => {
  const quote = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const url = URL.createObjectURL(
    new Blob(
      [
        `\uFEFF${[headings, ...rows].map(row => row.map(quote).join(",")).join("\r\n")}`,
      ],
      { type: "text/csv;charset=utf-8" }
    )
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
function SourceLink({
  url,
  label = "核验原始来源",
}: {
  url: string;
  label?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-300"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}
function RateChart({
  series,
  height = 230,
}: {
  series: Snapshot["rates"];
  height?: number;
}) {
  const active = series.filter(item => item.status === "available");
  const dates = [
    ...new Set(active.flatMap(item => item.history.map(point => point.date))),
  ].slice(-180);
  const chart = dates.map(date =>
    Object.fromEntries([
      ["date", date],
      ...active.map(item => [
        item.id,
        item.history.find(point => point.date === date)?.value ?? null,
      ]),
    ])
  );
  return chart.length ? (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 9 }}
            minTickGap={30}
          />
          <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: "#020617",
              border: "1px solid #334155",
              color: "#e2e8f0",
            }}
          />
          {active.map((item, index) => (
            <Line
              key={item.id}
              dataKey={item.id}
              name={item.label}
              stroke={
                ["#22d3ee", "#a78bfa", "#f59e0b", "#34d399", "#fb7185"][
                  index % 5
                ]
              }
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <LoadingState label="公开序列暂不可读；不会使用模拟曲线填充。" />
  );
}
function EmptyBoundary({ text }: { text: string }) {
  return (
    <p className="rounded border border-dashed border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-500">
      {text}
    </p>
  );
}

function Des({ snapshot }: { snapshot?: Snapshot }) {
  const rows = snapshot?.rates ?? [];
  return (
    <Card title="货币市场字段、来源与时效字典">
      <div className="overflow-auto rounded border border-slate-800">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">终端内序列</th>
              <th className="p-2">最近观察</th>
              <th className="p-2">观察日</th>
              <th className="p-2">覆盖</th>
              <th className="p-2">可用性</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => (
              <tr key={item.id} className="border-t border-slate-800">
                <td className="p-2 text-cyan-100">{item.label}</td>
                <td className="p-2 text-slate-200">
                  {item.value == null
                    ? "—"
                    : `${item.value.toFixed(4)} ${item.unit ?? "%"}`}
                </td>
                <td className="p-2 text-slate-400">
                  {item.observationDate || "—"}
                </td>
                <td className="p-2 text-slate-400">{item.history.length}</td>
                <td className="p-2 text-slate-400">
                  {item.status === "available" ? "可读" : "暂不可读"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="p-3 text-slate-500">
                  公开快照暂不可读；字段字典仍保留，系统不会展示替代样本。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {snapshot?.sources.map(source => (
          <div key={source.id} className="rounded border border-slate-800 p-3">
            <div className="flex justify-between gap-2">
              <b className="text-xs text-slate-200">{source.label}</b>
              <Badge tone="info">{source.frequency}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{source.scope}</p>
            <div className="mt-2">
              <SourceLink url={source.url} label="原始证据（可选核验）" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        核心观察、日期、覆盖与可用性直接在终端查看；原始链接仅用于必要的字段核验。公开指标不替代可执行报价、单笔成交或账户持仓数据。
      </p>
    </Card>
  );
}
function ProjectList({ snapshot }: { snapshot?: Snapshot }) {
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [items, setItems] = useState<
    Array<{
      id: number;
      name: string;
      deadline: string;
      sourceUrl: string;
      sourceLabel: string;
    }>
  >([]);
  const terminalSource = snapshot?.sources.find(item => item.id === sourceId);
  const add = () => {
    const resolvedUrl = terminalSource?.url || sourceUrl.trim();
    if (!name.trim() || !resolvedUrl) return;
    setItems(current => [
      ...current,
      {
        id: Date.now(),
        name: name.trim(),
        deadline,
        sourceUrl: resolvedUrl,
        sourceLabel: terminalSource?.label || "用户补充来源",
      },
    ]);
    setName("");
    setDeadline("");
    setSourceUrl("");
  };
  return (
    <Card
      title="研究项目与资料覆盖"
      action={
        <button
          type="button"
          onClick={() =>
            csv(
              "money-market-projects.csv",
              ["项目", "截止日", "终端来源", "来源"],
              items.map(item => [
                item.name,
                item.deadline,
                item.sourceLabel,
                item.sourceUrl,
              ])
            )
          }
          disabled={!items.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <p className="mb-2 text-[11px] text-slate-500">
        优先从终端内已核验来源选择资料，名称、地区、频率和覆盖会直接呈现；原始链接仅用于必要时的证据核验。
      </p>
      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="input-terminal text-xs"
          placeholder="研究项目"
        />
        <input
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          type="date"
          className="input-terminal text-xs"
        />
        <select
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
          className="input-terminal text-xs"
        >
          <option value="">选择终端内来源</option>
          {snapshot?.sources.map(item => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          type="url"
          className="input-terminal text-xs"
          placeholder="补充原始来源 URL"
          disabled={Boolean(terminalSource)}
        />
        <button
          type="button"
          onClick={add}
          className="rounded border border-cyan-800 text-xs text-cyan-200"
        >
          加入项目
        </button>
      </div>
      {terminalSource && (
        <div className="mt-2 rounded border border-cyan-900 bg-cyan-950/20 p-2 text-xs">
          <b className="text-cyan-100">终端来源：{terminalSource.label}</b>
          <span className="ml-2 text-slate-400">
            {terminalSource.region} · {terminalSource.frequency} ·{" "}
            {terminalSource.scope}
          </span>
        </div>
      )}
      <div className="mt-3 space-y-1">
        {items.map(item => (
          <div
            key={item.id}
            className="flex justify-between rounded border border-slate-800 px-2 py-1.5 text-xs"
          >
            <span>
              {item.name}{" "}
              {item.deadline && (
                <span className="text-slate-500">· {item.deadline}</span>
              )}
              <span className="ml-2 text-cyan-100">{item.sourceLabel}</span>
            </span>
            <span className="flex gap-2">
              <SourceLink url={item.sourceUrl} label="原始证据" />
              <button
                type="button"
                onClick={() =>
                  setItems(current => current.filter(row => row.id !== item.id))
                }
                className="text-rose-300"
              >
                移除
              </button>
            </span>
          </div>
        ))}
        {!items.length && (
          <EmptyBoundary text="尚无工作项。选择终端内来源或补充原始 URL 后即可建立当前会话的研究范围；系统不会创建虚构研究结论或截止日期。" />
        )}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        项目暂存于当前浏览器会话；CSV 导出可用于纳入账户级研究流程。
      </p>
    </Card>
  );
}
function MarketBeat({ snapshot }: { snapshot?: Snapshot }) {
  const [days, setDays] = useState(90);
  const series = (snapshot?.rates ?? [])
    .filter(item => ["SOFR", "EFFR", "IORB"].includes(item.id))
    .map(item => ({ ...item, history: item.history.slice(-days) }));
  const sofr = rate(snapshot, "SOFR");
  const effr = rate(snapshot, "EFFR");
  const funding = snapshot?.fundingTape ?? [];
  const fundingRows = useMemo(() => {
    const dates = [...new Set(funding.map(item => item.date))].slice(-days);
    return dates.map(date => {
      const sofrPoint = funding.find(
        item => item.date === date && item.product === "SOFR"
      );
      const effrPoint = funding.find(
        item => item.date === date && item.product === "EFFR"
      );
      const obfrPoint = funding.find(
        item => item.date === date && item.product === "OBFR"
      );
      const percentileWidth =
        sofrPoint?.p1Pct != null && sofrPoint?.p99Pct != null
          ? (sofrPoint.p99Pct - sofrPoint.p1Pct) * 100
          : null;
      return {
        date,
        sofrVolume: sofrPoint?.volumeBn ?? null,
        effrVolume: effrPoint?.volumeBn ?? null,
        obfrVolume: obfrPoint?.volumeBn ?? null,
        percentileWidth,
      };
    });
  }, [days, funding]);
  const latestFunding = (product: FundingPoint["product"]) =>
    funding
      .filter(item => item.product === product)
      .sort((left, right) => left.date.localeCompare(right.date))
      .at(-1);
  const latestSofrFunding = latestFunding("SOFR");
  const latestEffrFunding = latestFunding("EFFR");
  const latestObfrFunding = latestFunding("OBFR");
  const rrp = rate(snapshot, "RRPONTSYD");
  const spreadTrend = (sofr?.history ?? [])
    .flatMap(point => {
      const peer = effr?.history.find(row => row.date === point.date);
      return peer ? [(point.value - peer.value) * 100] : [];
    })
    .slice(-days);
  return (
    <>
      <Card
        title="公开隔夜资金脉冲"
        action={
          <div className="flex gap-1">
            {[30, 90, 180].map(value => (
              <button
                type="button"
                key={value}
                onClick={() => setDays(value)}
                className={`rounded px-2 py-1 text-[11px] ${days === value ? "bg-cyan-900 text-cyan-100" : "text-slate-400"}`}
              >
                {value}D
              </button>
            ))}
            <button
              type="button"
              onClick={() => location.reload()}
              className="text-cyan-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-4">
          <Metric
            label="SOFR"
            value={fmt(sofr?.value)}
            tone="info"
            trend={sofr?.history.slice(-days).map(point => point.value)}
          />
          <Metric
            label="EFFR"
            value={fmt(effr?.value)}
            tone="info"
            trend={effr?.history.slice(-days).map(point => point.value)}
          />
          <Metric
            label="SOFR - EFFR"
            value={
              sofr?.value != null && effr?.value != null
                ? `${((sofr.value - effr.value) * 100).toFixed(1)} bp`
                : "—"
            }
            tone="neutral"
            trend={spreadTrend}
          />
          <Metric label="最近观察日" value={sofr?.observationDate || "—"} />
        </div>
        <div className="mt-3">
          <RateChart series={series} />
        </div>
        <div className="mt-3 rounded border border-cyan-950/70 bg-slate-950/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-cyan-100">
                成交分布与融资量（独立数据分片）
              </h4>
              <p className="mt-1 text-[10px] text-slate-500">
                本区仅接收分配给 MKTBEAT
                的历史成交分布契约；不会复用电子交易货币市场的当前参考观测。
              </p>
            </div>
            <span className="text-[10px] text-slate-500">
              {latestSofrFunding?.date
                ? `最新观测 ${latestSofrFunding.date}`
                : "当前分片未分配"}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Metric
              label="SOFR 成交量"
              value={
                latestSofrFunding?.volumeBn == null
                  ? "—"
                  : `${latestSofrFunding.volumeBn.toLocaleString()} bn`
              }
              tone="info"
              trend={funding
                .filter(item => item.product === "SOFR")
                .slice(-days)
                .flatMap(item =>
                  item.volumeBn == null ? [] : [item.volumeBn]
                )}
            />
            <Metric
              label="EFFR 成交量"
              value={
                latestEffrFunding?.volumeBn == null
                  ? "—"
                  : `${latestEffrFunding.volumeBn.toLocaleString()} bn`
              }
              trend={funding
                .filter(item => item.product === "EFFR")
                .slice(-days)
                .flatMap(item =>
                  item.volumeBn == null ? [] : [item.volumeBn]
                )}
            />
            <Metric
              label="SOFR 1–99 分位宽度"
              value={
                latestSofrFunding?.p1Pct != null &&
                latestSofrFunding?.p99Pct != null
                  ? `${((latestSofrFunding.p99Pct - latestSofrFunding.p1Pct) * 100).toFixed(1)} bp`
                  : "—"
              }
              trend={fundingRows.flatMap(item =>
                item.percentileWidth == null ? [] : [item.percentileWidth]
              )}
            />
            <Metric
              label="ON RRP 使用量"
              value={rrp?.value == null ? "—" : `${rrp.value.toFixed(1)} bn`}
              trend={rrp?.history.slice(-days).map(point => point.value)}
            />
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
            <div className="h-44">
              {fundingRows.some(
                row => row.sofrVolume != null || row.effrVolume != null
              ) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fundingRows}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      tickFormatter={value => `${value}bn`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid #334155",
                      }}
                      formatter={(value: number, name: string) => [
                        value == null ? "—" : `${value.toLocaleString()} bn`,
                        name === "sofrVolume"
                          ? "SOFR 成交量"
                          : name === "effrVolume"
                            ? "EFFR 成交量"
                            : "OBFR 成交量",
                      ]}
                    />
                    <Bar
                      dataKey="sofrVolume"
                      name="SOFR 成交量"
                      fill="#22d3ee"
                    />
                    <Bar
                      dataKey="effrVolume"
                      name="EFFR 成交量"
                      fill="#a78bfa"
                    />
                    <Bar
                      dataKey="obfrVolume"
                      name="OBFR 成交量"
                      fill="#f59e0b"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyBoundary text="历史成交量分片未接入；不复用其他功能的当前观测，也不以利率或模拟规模代替。" />
              )}
            </div>
            <div className="h-44">
              {fundingRows.some(row => row.percentileWidth != null) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fundingRows}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 9 }}
                      tickFormatter={value => `${value}bp`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid #334155",
                      }}
                      formatter={(value: number) => [
                        value == null ? "—" : `${value.toFixed(1)} bp`,
                        "SOFR 1–99 分位宽度",
                      ]}
                    />
                    <Line
                      dataKey="percentileWidth"
                      name="SOFR 1–99 分位宽度"
                      stroke="#34d399"
                      dot={false}
                      strokeWidth={1.8}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyBoundary text="历史分位带分片未接入；不复用其他功能数据或固定区间填充。" />
              )}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            该区保留原成交量与分位字段；只有独立历史分片接入后才显示，当前不会跨功能复制参考观测。
          </p>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          当前市场仅展示本功能的日度历史与派生脉冲；非盘中融资价格、回购交易深度或可执行利率。
        </p>
      </Card>
    </>
  );
}
function Btmm({ snapshot }: { snapshot?: Snapshot }) {
  const bills = snapshot?.treasuryAuctions ?? [];
  const curve = (snapshot?.rates ?? []).filter(item =>
    ["DTB4WK", "DTB3", "DTB6", "SOFR"].includes(item.id)
  );
  return (
    <Card title="短端国库券与货币基准">
      <div className="grid gap-2 sm:grid-cols-4">
        {curve.map(item => (
          <Metric
            key={item.id}
            label={item.label}
            value={fmt(item.value)}
            tone={item.status === "available" ? "info" : "neutral"}
            trend={item.history.map(point => point.value)}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="overflow-auto rounded border border-slate-800">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="p-2">国库券</th>
                <th className="p-2">拍卖日</th>
                <th className="p-2">发行日</th>
              </tr>
            </thead>
            <tbody>
              {bills.slice(0, 8).map((item, index) => (
                <tr
                  key={`${item.cusip}-${index}`}
                  className="border-t border-slate-800"
                >
                  <td className="p-2 text-slate-300">
                    {item.securityTerm || "—"} · {item.cusip || "待披露"}
                  </td>
                  <td className="p-2 text-slate-500">
                    {item.auctionDate || "—"}
                  </td>
                  <td className="p-2 text-slate-500">
                    {item.issueDate || "—"}
                  </td>
                </tr>
              ))}
              {!bills.length && (
                <tr>
                  <td colSpan={3} className="p-4 text-slate-500">
                    财政部拍卖记录暂不可读；不以模拟事件替代。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <RateChart series={curve} height={190} />
      </div>
      <div className="mt-2">
        <SourceLink
          url="https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/"
          label="美国财政部拍卖数据与字段说明"
        />
      </div>
    </Card>
  );
}
function Boom({ snapshot }: { snapshot?: Snapshot }) {
  const [term, setTerm] = useState("全部");
  const events = (snapshot?.treasuryAuctions ?? []).filter(
    item => term === "全部" || item.securityTerm === term
  );
  const terms = Array.from(
    new Set(
      (snapshot?.treasuryAuctions ?? [])
        .map(item => item.securityTerm)
        .filter(Boolean)
    )
  ) as string[];
  return (
    <Card
      title="官方发售与拍卖日历"
      action={
        <button
          type="button"
          onClick={() =>
            csv(
              "us-treasury-bill-auctions.csv",
              ["CUSIP", "期限", "拍卖日", "发行日", "到期日", "发行额"],
              events.map(item => [
                item.cusip,
                item.securityTerm,
                item.auctionDate,
                item.issueDate,
                item.maturityDate,
                item.offeringAmount,
              ])
            )
          }
          disabled={!events.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setTerm("全部")}
          className={`rounded px-2 py-1 text-[11px] ${term === "全部" ? "bg-amber-900/50 text-amber-100" : "text-slate-400"}`}
        >
          全部
        </button>
        {terms.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setTerm(item)}
            className={`rounded px-2 py-1 text-[11px] ${term === item ? "bg-amber-900/50 text-amber-100" : "text-slate-400"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {events.map((item, index) => (
          <div
            key={`${item.cusip}-${index}`}
            className="rounded border border-slate-800 p-3"
          >
            <b className="text-xs text-slate-200">
              {item.securityTerm || "国库券待确认"}
            </b>
            <p className="mt-1 text-[11px] text-slate-500">
              公告/拍卖：{item.auctionDate || "待披露"}
              <br />
              发行：{item.issueDate || "待披露"} · 到期：
              {item.maturityDate || "待披露"}
            </p>
            <p className="mt-2 text-[10px] text-slate-600">
              CUSIP：{item.cusip || "待披露"} · 发行额：
              {item.offeringAmount || "待披露"}
            </p>
          </div>
        ))}
        {!events.length && <EmptyBoundary text="当前无匹配的公开发售记录。" />}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        仅展示财政部公布的发售/拍卖字段，不表示分配资格、可执行订单或二级市场价格。
      </p>
    </Card>
  );
}
function Tcon({ snapshot }: { snapshot?: Snapshot }) {
  const [threshold, setThreshold] = useState("10");
  const sofr = rate(snapshot, "SOFR");
  const effr = rate(snapshot, "EFFR");
  const iorb = rate(snapshot, "IORB");
  const max = Number(threshold) || 0;
  const gap =
    sofr?.value != null && effr?.value != null
      ? Math.abs((sofr.value - effr.value) * 100)
      : null;
  return (
    <Card title="政策实施走廊核验">
      <div className="grid gap-2 md:grid-cols-4">
        <Metric label="SOFR" value={fmt(sofr?.value)} tone="info" />
        <Metric label="EFFR" value={fmt(effr?.value)} tone="info" />
        <Metric label="IORB" value={fmt(iorb?.value)} tone="info" />
        <label className="text-xs text-slate-500">
          差值阈值（bp）
          <input
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            type="number"
            min="0"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div
        className={`mt-3 rounded border p-3 text-xs ${gap != null && gap > max ? "border-amber-700 bg-amber-950/20 text-amber-200" : "border-emerald-900 bg-emerald-950/20 text-emerald-200"}`}
      >
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        {gap == null
          ? "缺少可用公开观察，无法核验。"
          : `SOFR 与 EFFR 当前公开观察差值为 ${gap.toFixed(1)} bp，${gap > max ? "超过" : "未超过"}设定阈值 ${max.toFixed(1)} bp。`}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        此为用户定义阈值的历史观察核验，不代表政策决定、流动性压力判断或交易指令。
      </p>
    </Card>
  );
}
function RelativeValue({ snapshot }: { snapshot?: Snapshot }) {
  const [left, setLeft] = useState("SOFR");
  const [right, setRight] = useState("EFFR");
  const [days, setDays] = useState(120);
  const l = rate(snapshot, left);
  const r = rate(snapshot, right);
  const points = (l?.history ?? [])
    .map(point => ({
      date: point.date,
      left: point.value,
      right: r?.history.find(other => other.date === point.date)?.value ?? null,
      gap: r?.history.find(other => other.date === point.date)
        ? (point.value -
            (r.history.find(other => other.date === point.date)?.value || 0)) *
          100
        : null,
    }))
    .filter(point => point.gap != null)
    .slice(-days);
  const values = points.map(point => point.gap as number);
  const mean = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  const deviation =
    mean == null || values.length < 2
      ? null
      : Math.sqrt(
          values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
            (values.length - 1)
        );
  const latest = values.at(-1) ?? null;
  const zscore =
    latest == null || mean == null || !deviation
      ? null
      : (latest - mean) / deviation;
  const percentile =
    latest == null || !values.length
      ? null
      : (values.filter(value => value <= latest).length / values.length) * 100;
  const buckets = useMemo(() => {
    if (!values.length) return [];
    const low = Math.min(...values);
    const high = Math.max(...values);
    const width = Math.max((high - low) / 8, 0.1);
    return Array.from({ length: 8 }, (_, index) => {
      const start = low + index * width;
      const end = index === 7 ? high + 0.0001 : start + width;
      return {
        band: `${start.toFixed(0)}~${end.toFixed(0)}`,
        count: values.filter(value => value >= start && value < end).length,
      };
    });
  }, [values]);
  const eligible = (snapshot?.rates ?? []).filter(
    item => item.status === "available" && item.unit !== "USD bn"
  );
  return (
    <Card title="双腿配对、偏离分位与回归区间">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <select
          value={left}
          onChange={e => setLeft(e.target.value)}
          className="input-terminal text-xs"
        >
          {eligible.map(item => (
            <option key={item.id}>{item.id}</option>
          ))}
        </select>
        <span className="py-1 text-slate-500">减</span>
        <select
          value={right}
          onChange={e => setRight(e.target.value)}
          className="input-terminal text-xs"
        >
          {eligible.map(item => (
            <option key={item.id}>{item.id}</option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          {[20, 60, 120, 180].map(value => (
            <button
              type="button"
              key={value}
              onClick={() => setDays(value)}
              className={`px-2 py-1 text-[10px] ${days === value ? "bg-violet-900/60 text-violet-100" : "text-slate-500"}`}
            >
              {value}D
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric
          label={`${left}−${right}`}
          value={latest == null ? "—" : `${latest.toFixed(1)} bp`}
          tone="info"
          trend={values}
        />
        <Metric
          label="均值回归偏离"
          value={zscore == null ? "—" : `${zscore.toFixed(2)}σ`}
          tone={zscore != null && Math.abs(zscore) > 2 ? "warn" : "neutral"}
        />
        <Metric
          label="历史所处分位"
          value={percentile == null ? "—" : `${percentile.toFixed(0)}%`}
        />
        <Metric
          label="离散波动"
          value={deviation == null ? "—" : `${deviation.toFixed(1)} bp`}
        />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 9 }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 9 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Line
                dataKey="left"
                name={`${left} (%)`}
                stroke="#c084fc"
                dot={false}
              />
              <Line
                dataKey="right"
                name={`${right} (%)`}
                stroke="#22d3ee"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="band" tick={{ fill: "#64748b", fontSize: 8 }} />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 9 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Bar dataKey="count" name="观察频数" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-2 max-h-40 overflow-auto border-t border-slate-800">
        <table className="min-w-full text-[10px]">
          <thead className="text-left text-slate-600">
            <tr>
              <th className="p-1.5">同日观察</th>
              <th>{left}</th>
              <th>{right}</th>
              <th>配对差</th>
            </tr>
          </thead>
          <tbody>
            {points
              .slice(-8)
              .reverse()
              .map(point => (
                <tr key={point.date} className="border-t border-slate-900">
                  <td className="p-1.5 text-slate-500">{point.date}</td>
                  <td>{point.left.toFixed(4)}%</td>
                  <td>{point.right?.toFixed(4)}%</td>
                  <td className="text-violet-300">
                    {point.gap?.toFixed(1)} bp
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        仅对两条序列的同日公开观察做配对；分位、标准差与偏离由当前窗口直接计算，不把统计偏离解释为可成交套利。
      </p>
    </Card>
  );
}
function CurveScenario({ snapshot }: { snapshot?: Snapshot }) {
  const [base, setBase] = useState("3.60");
  const [shock, setShock] = useState("0");
  const [shape, setShape] = useState("平行");
  const [notional, setNotional] = useState("10000000");
  const observed = [
    { term: "ON", days: 1, id: "SOFR" },
    { term: "4W", days: 28, id: "DTB4WK" },
    { term: "3M", days: 91, id: "DTB3" },
    { term: "6M", days: 182, id: "DTB6" },
  ].map(node => ({
    ...node,
    value: rate(snapshot, node.id)?.value ?? null,
    date: rate(snapshot, node.id)?.observationDate ?? null,
  }));
  const marketBaseReady = observed.every(node => node.value != null);
  const nodes = useMemo(() => {
    const shockBp = Number(shock) || 0;
    const inputBase = Number(base);
    return observed.map((node, index) => {
      const baseline = marketBaseReady
        ? node.value!
        : Number.isFinite(inputBase)
          ? inputBase
          : 0;
      const shapeWeight =
        shape === "陡峭"
          ? index / Math.max(observed.length - 1, 1)
          : shape === "扁平"
            ? 1 - index / Math.max(observed.length - 1, 1)
            : shape === "蝶式"
              ? [0, 1, 1, 0][index]
              : 1;
      const deltaBp = shockBp * shapeWeight;
      const stressed = baseline + deltaBp / 100;
      const sensitivity =
        -Number(notional || 0) * (node.days / 365) * (deltaBp / 10_000);
      return {
        term: node.term,
        id: node.id,
        date: node.date,
        baseline: Number(baseline.toFixed(4)),
        stressed: Number(stressed.toFixed(4)),
        deltaBp: Number(deltaBp.toFixed(2)),
        sensitivity: Number(sensitivity.toFixed(2)),
      };
    });
  }, [base, marketBaseReady, notional, observed, shape, shock]);
  const frontBackBefore = nodes.length
    ? (nodes.at(-1)!.baseline - nodes[0].baseline) * 100
    : null;
  const frontBackAfter = nodes.length
    ? (nodes.at(-1)!.stressed - nodes[0].stressed) * 100
    : null;
  const aggregateSensitivity = nodes.reduce(
    (sum, node) => sum + node.sensitivity,
    0
  );
  return (
    <Card
      title="短端节点冲击与现金敏感度"
      action={
        <button
          type="button"
          onClick={() =>
            csv(
              "money-market-short-end-scenario.csv",
              [
                "节点",
                "公开序列",
                "观察日",
                "基线(%)",
                "情景(%)",
                "变化(bp)",
                "输入本金敏感度",
              ],
              nodes.map(node => [
                node.term,
                node.id,
                node.date,
                node.baseline,
                node.stressed,
                node.deltaBp,
                node.sensitivity,
              ])
            )
          }
          className="text-xs text-cyan-300"
        >
          <Download className="mr-1 inline h-3 w-3" />
          导出情景
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-4">
        <label className="text-xs text-slate-500">
          备用基线 (%)
          <input
            value={base}
            onChange={e => setBase(e.target.value)}
            type="number"
            step="0.01"
            disabled={marketBaseReady}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          冲击 (bp)
          <input
            value={shock}
            onChange={e => setShock(e.target.value)}
            type="number"
            step="1"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          形态
          <select
            value={shape}
            onChange={e => setShape(e.target.value)}
            className="input-terminal mt-1 w-full"
          >
            <option>平行</option>
            <option>陡峭</option>
            <option>扁平</option>
            <option>蝶式</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">
          名义本金
          <input
            value={notional}
            onChange={e => setNotional(e.target.value)}
            type="number"
            min="0"
            step="100000"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric
          label="基线口径"
          value={marketBaseReady ? "公开短端快照" : "用户备用输入"}
          tone="info"
        />
        <Metric
          label="前后端斜率·基线"
          value={
            frontBackBefore == null ? "—" : `${frontBackBefore.toFixed(1)} bp`
          }
        />
        <Metric
          label="前后端斜率·情景"
          value={
            frontBackAfter == null ? "—" : `${frontBackAfter.toFixed(1)} bp`
          }
        />
        <Metric
          label="节点敏感度合计"
          value={aggregateSensitivity.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
        />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_.8fr]">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={nodes}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="term" tick={{ fill: "#64748b" }} />
              <YAxis tick={{ fill: "#64748b" }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Line
                dataKey="baseline"
                name="冲击前 (%)"
                stroke="#22d3ee"
                strokeWidth={2}
              />
              <Line
                dataKey="stressed"
                name="冲击后 (%)"
                stroke="#f59e0b"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-auto rounded border border-slate-800">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-2">节点</th>
                <th className="p-2">变化</th>
                <th className="p-2 text-right">本金敏感度</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map(node => (
                <tr key={node.id} className="border-t border-slate-800">
                  <td className="p-2 text-cyan-100">
                    {node.term} · {node.id}
                  </td>
                  <td className="p-2">{node.deltaBp.toFixed(1)} bp</td>
                  <td className="p-2 text-right text-amber-200">
                    {node.sensitivity.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        基线优先使用同一终端快照内的 SOFR、4W、3M、6M
        公开观察；任一节点不可读时整体切换为用户备用基线，避免把真实值与模拟值混合。敏感度仅由当前名义本金、节点天数和冲击计算，不是持仓估值或交易建议。
      </p>
    </Card>
  );
}
function CurveGraph({ snapshot }: { snapshot?: Snapshot }) {
  const [shown, setShown] = useState<string[]>(["SOFR", "EFFR", "DTB3"]);
  const exportRef = useRef<HTMLDivElement>(null);
  const series = (snapshot?.rates ?? []).filter(item =>
    shown.includes(item.id)
  );
  const exportPdf = async () => {
    if (!exportRef.current || !series.length) {
      toast.error("没有可导出的公开曲线观察");
      return;
    }
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: "#020617",
        scale: 2.5,
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });
      pdf.setProperties({
        title: "货币市场短端曲线报告",
        subject: "公开原始序列图表",
        author: "Finance Hub",
      });
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        canvas.width,
        canvas.height,
        undefined,
        "FAST"
      );
      pdf.save(
        `money-market-curve-report-${new Date().toISOString().slice(0, 10)}.pdf`
      );
      toast.success("高分辨率 PDF 图表报告已导出");
    } catch {
      toast.error("PDF 导出失败，请检查浏览器下载权限");
    }
  };
  return (
    <Card
      title="短端曲线绘制"
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!series.length}
            className="text-xs text-rose-300 disabled:text-slate-600"
          >
            <FileText className="mr-1 inline h-3 w-3" />
            PDF 报告
          </button>
          <button
            type="button"
            onClick={() =>
              csv(
                "money-market-curve.csv",
                ["序列", "观察日", "数值"],
                series.flatMap(item =>
                  item.history.map(point => [item.id, point.date, point.value])
                )
              )
            }
            disabled={!series.length}
            className="text-xs text-cyan-300 disabled:text-slate-600"
          >
            <Download className="mr-1 inline h-3 w-3" />
            CSV
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {snapshot?.rates.map(item => (
          <label key={item.id} className="text-xs text-slate-400">
            <input
              type="checkbox"
              checked={shown.includes(item.id)}
              onChange={() =>
                setShown(current =>
                  current.includes(item.id)
                    ? current.filter(id => id !== item.id)
                    : [...current, item.id]
                )
              }
            />{" "}
            {item.id}
          </label>
        ))}
      </div>
      <div
        ref={exportRef}
        className="mt-3 rounded border border-slate-800 bg-slate-950 p-3"
      >
        <div className="mb-2 flex items-start justify-between">
          <div>
            <b className="text-sm text-slate-100">货币市场短端曲线报告</b>
            <p className="text-[10px] text-slate-500">公开历史观察</p>
          </div>
          <span className="text-[10px] text-cyan-300">
            {series.map(item => item.id).join(" · ") || "—"}
          </span>
        </div>
        <RateChart series={series} />
        <p className="mt-2 text-[10px] text-slate-500">
          来源：FRED /
          纽约联储公开历史序列。图表不含盘中可执行报价、价格预测或交易建议；缺失观察不补点。
        </p>
      </div>
    </Card>
  );
}
function MktbeatCrossWindow({ snapshot }: { snapshot?: Snapshot }) {
  const [selected, setSelected] = useState<string[]>(["SOFR", "EFFR", "IORB"]);
  const [days, setDays] = useState(60);
  const eligible = (snapshot?.rates ?? []).filter(item =>
    ["SOFR", "EFFR", "IORB", "DTB4WK", "DTB3", "DTB6"].includes(item.id)
  );
  const rows = eligible
    .filter(item => selected.includes(item.id))
    .map(item => {
      const history = item.history.slice(-days);
      const values = history.map(point => point.value);
      const mean = values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null;
      const variance =
        mean == null
          ? null
          : values.reduce((total, value) => total + (value - mean) ** 2, 0) /
            values.length;
      return {
        id: item.id,
        last: values.at(-1) ?? null,
        mean,
        low: values.length ? Math.min(...values) : null,
        high: values.length ? Math.max(...values) : null,
        stdev: variance == null ? null : Math.sqrt(variance),
        observations: values.length,
        changeBps:
          values.length > 1 ? (values.at(-1)! - values[0]) * 100 : null,
      };
    });
  const base = rows[0]?.last;
  const chart = rows.map(row => ({
    benchmark: row.id,
    最近值: row.last,
    窗口均值: row.mean,
  }));
  const toggle = (id: string) =>
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  return (
    <Card
      title="多基准交叉窗口统计"
      action={
        <button
          type="button"
          onClick={() =>
            csv(
              "money-market-cross-window.csv",
              [
                "基准",
                "最近值",
                "窗口均值",
                "最小",
                "最大",
                "标准差",
                "窗口变化(bp)",
                "观察数",
                "相对首基准(bp)",
              ],
              rows.map(row => [
                row.id,
                row.last,
                row.mean,
                row.low,
                row.high,
                row.stdev,
                row.changeBps,
                row.observations,
                base != null && row.last != null
                  ? (row.last - base) * 100
                  : null,
              ])
            )
          }
          disabled={!rows.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="flex flex-wrap gap-1">
        {[20, 60, 120].map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setDays(value)}
            className={`rounded px-2 py-1 text-[11px] ${days === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {eligible.map(item => (
          <label key={item.id} className="text-xs text-slate-400">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
            />{" "}
            {item.id}
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-2">基准</th>
                <th className="p-2">最近值</th>
                <th className="p-2">均值</th>
                <th className="p-2">范围</th>
                <th className="p-2">标准差</th>
                <th className="p-2">变化</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2">{row.last?.toFixed(4) ?? "—"}%</td>
                  <td className="p-2">{row.mean?.toFixed(4) ?? "—"}%</td>
                  <td className="p-2">
                    {row.low?.toFixed(3) ?? "—"}–{row.high?.toFixed(3) ?? "—"}
                  </td>
                  <td className="p-2">{row.stdev?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{row.changeBps?.toFixed(1) ?? "—"} bp</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="h-60">
          {chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="benchmark"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                  }}
                />
                <Bar dataKey="最近值" fill="#22d3ee" />
                <Bar dataKey="窗口均值" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBoundary text="请选择至少一个可用公开基准。" />
          )}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        统计按各序列自身可读历史窗口计算；不同定义、频率和发布时间不可直接视为资金成本排名或交易信号。
      </p>
    </Card>
  );
}
function BtmmRangeComparison() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 180);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(today);
  const [applied, setApplied] = useState({ startDate, endDate });
  const rangeQuery = trpc.moneyMarketResearch.getAuctionRange.useQuery(
    applied,
    { staleTime: 60_000 }
  );
  const events = rangeQuery.data?.events ?? [];
  const parseAmount = (value: string | null) =>
    Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
  const trend = events
    .reduce<Array<{ date: string; 发行额: number; 事件数: number }>>(
      (rows, event) => {
        const date = event.auctionDate || "未披露";
        const row = rows.find(item => item.date === date);
        if (row) {
          row.发行额 += parseAmount(event.offeringAmount);
          row.事件数 += 1;
        } else
          rows.push({
            date,
            发行额: parseAmount(event.offeringAmount),
            事件数: 1,
          });
        return rows;
      },
      []
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = trend.reduce((sum, item) => sum + item.发行额, 0);
  const terms = [
    ...new Set(events.map(event => event.securityTerm || "未披露")),
  ].map(term => ({
    term,
    count: events.filter(event => (event.securityTerm || "未披露") === term)
      .length,
  }));
  return (
    <Card
      title="官方拍卖日期区间比较与趋势"
      action={
        <button
          type="button"
          onClick={() =>
            csv(
              "btmm-auction-range.csv",
              ["CUSIP", "期限", "拍卖日", "发行日", "到期日", "原始发行额"],
              events.map(event => [
                event.cusip,
                event.securityTerm,
                event.auctionDate,
                event.issueDate,
                event.maturityDate,
                event.offeringAmount,
              ])
            )
          }
          disabled={!events.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-slate-500">
          起始日
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          结束日
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={e => setEndDate(e.target.value)}
            className="input-terminal mt-1 w-full"
          />
        </label>
        <button
          type="button"
          onClick={() => setApplied({ startDate, endDate })}
          disabled={startDate > endDate}
          className="mt-5 rounded border border-amber-700 px-3 text-xs text-amber-200 disabled:text-slate-600"
        >
          比较区间
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="官方事件数" value={String(events.length)} />
        <Metric
          label="原始发行额合计"
          value={
            total
              ? total.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : "—"
          }
          tone="info"
        />
        <Metric label="期限类别" value={String(terms.length)} />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="h-60">
          {trend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                  minTickGap={25}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                  }}
                />
                <Bar dataKey="发行额" name="原始发行额" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyBoundary
              text={
                rangeQuery.isLoading
                  ? "正在读取财政部官方区间记录…"
                  : "所选区间没有可用的已发布国库券拍卖记录。"
              }
            />
          )}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="p-2">期限</th>
                <th className="p-2">事件数</th>
              </tr>
            </thead>
            <tbody>
              {terms.map(row => (
                <tr key={row.term} className="border-t border-slate-800">
                  <td className="p-2">{row.term}</td>
                  <td className="p-2">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[10px] text-slate-500">
            区间上限为 730 天，仅比较财政部已经发布的 Bill
            记录；不推断未来发行、分配资格或二级市场价格。
          </p>
        </div>
      </div>
    </Card>
  );
}
function SourceCatalog({
  snapshot,
  mode,
}: {
  snapshot?: Snapshot;
  mode: "money" | "cross" | "central";
}) {
  const [filter, setFilter] = useState("全部");
  const sources = (snapshot?.sources ?? [])
    .filter(item =>
      mode === "central"
        ? ["PBOC", "CBC-CALL", "FRED-SOFR", "FRED-EFFR"].includes(item.id)
        : true
    )
    .filter(item => filter === "全部" || item.region === filter);
  const regions = Array.from(
    new Set((snapshot?.sources ?? []).map(item => item.region))
  );
  const seriesIds =
    mode === "central"
      ? ["IORB", "EFFR", "SOFR", "RRPONTSYD"]
      : mode === "money"
        ? ["SOFR", "EFFR", "IORB", "RRPONTSYD", "DTB4WK", "DTB3", "DTB6"]
        : (snapshot?.rates ?? []).map(item => item.id);
  const terminalRows = (snapshot?.rates ?? []).filter(item =>
    seriesIds.includes(item.id)
  );
  return (
    <Card
      title={
        mode === "money"
          ? "货币市场曲线资料目录"
          : mode === "central"
            ? "央行资料覆盖目录"
            : "跨曲线资料比较"
      }
    >
      <p className="mb-2 text-[11px] text-slate-500">
        当前可读序列、观察日和覆盖直接展示在终端；目录只补充来源口径，原始链接不再是主要阅读路径。
      </p>
      <div className="overflow-auto rounded border border-slate-800">
        <table className="min-w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-2">终端内序列</th>
              <th className="p-2">最近值</th>
              <th className="p-2">观察日</th>
              <th className="p-2">覆盖</th>
              <th className="p-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {terminalRows.map(item => (
              <tr key={item.id} className="border-t border-slate-800">
                <td className="p-2 text-cyan-100">{item.id}</td>
                <td className="p-2">
                  {item.value == null ? "—" : `${item.value.toFixed(4)}%`}
                </td>
                <td className="p-2 text-slate-400">
                  {item.observationDate || "—"}
                </td>
                <td className="p-2 text-slate-400">{item.history.length}</td>
                <td className="p-2 text-slate-400">
                  {item.status === "available" ? "可读" : "暂不可读"}
                </td>
              </tr>
            ))}
            {!terminalRows.length && (
              <tr>
                <td colSpan={5} className="p-3 text-slate-500">
                  当前范围没有可读公开序列；不以示例曲线替代。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mb-3 mt-3 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilter("全部")}
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300"
        >
          全部
        </button>
        {regions.map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded px-2 py-1 text-[11px] ${filter === item ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {sources.map(source => (
          <div key={source.id} className="rounded border border-slate-800 p-3">
            <div className="flex justify-between">
              <b className="text-xs text-slate-200">{source.label}</b>
              <Badge tone="info">{source.frequency}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{source.scope}</p>
            <div className="mt-2">
              <SourceLink url={source.url} label="原始证据（可选核验）" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
function Fibc() {
  const [face, setFace] = useState("1000000");
  const [price, setPrice] = useState("990000");
  const [days, setDays] = useState("90");
  const f = Number(face);
  const p = Number(price);
  const d = Number(days);
  const discount = f > 0 && d > 0 ? ((((f - p) / f) * 360) / d) * 100 : null;
  const investment = p > 0 && d > 0 ? ((((f - p) / p) * 365) / d) * 100 : null;
  return (
    <Card title="货币市场贴现与收益率工作表">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs text-slate-500">
          面值
          <input
            value={face}
            onChange={e => setFace(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          价格
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          到期天数
          <input
            value={days}
            onChange={e => setDays(e.target.value)}
            type="number"
            min="1"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="贴现率"
          value={discount == null ? "—" : `${discount.toFixed(4)}%`}
          tone="info"
        />
        <Metric
          label="投资收益率"
          value={investment == null ? "—" : `${investment.toFixed(4)}%`}
          tone="info"
        />
        <Metric
          label="到期现金流"
          value={Number.isFinite(f) ? f.toLocaleString() : "—"}
        />
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        按照用户填写的面值、价格、天数以及 360/365
        日计息基准计算。输入不代表真实报价或适用于特定证券的市场惯例。
      </p>
    </Card>
  );
}
function Cdie({ snapshot }: { snapshot?: Snapshot }) {
  const [future, setFuture] = useState("");
  const cdi = snapshot?.cdi ?? [];
  const latest = cdi.at(-1);
  const compounded = cdi.reduce(
    (acc, point) => acc * (1 + point.valuePct / 100),
    1
  );
  const diff =
    latest && future.trim() !== "" && Number.isFinite(Number(future))
      ? Number(future) - latest.valuePct * 252
      : null;
  const path = cdi.map((point, index) => {
    const factor = cdi
      .slice(0, index + 1)
      .reduce((acc, row) => acc * (1 + row.valuePct / 100), 1);
    const annualized = point.valuePct * 252;
    const inputDi =
      Number.isFinite(Number(future)) && future !== "" ? Number(future) : null;
    return {
      ...point,
      factor: Number(factor.toFixed(8)),
      annualized: Number(annualized.toFixed(5)),
      inputDi,
      basis: inputDi == null ? null : Number((inputDi - annualized).toFixed(5)),
    };
  });
  const basisValues = path.flatMap(point =>
    point.basis == null ? [] : [point.basis]
  );
  return (
    <Card title="CDI 复利路径与 DI 假设偏差结构">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1.15fr]">
        <Metric
          label="最近 CDI 日度值"
          value={latest ? `${latest.valuePct.toFixed(6)}%` : "—"}
          tone="info"
          trend={cdi.map(point => point.valuePct)}
        />
        <Metric
          label="20 日累计因子"
          value={cdi.length ? compounded.toFixed(8) : "—"}
        />
        <Metric
          label="年化当前路径"
          value={latest ? `${(latest.valuePct * 252).toFixed(4)}%` : "—"}
        />
        <label className="text-xs text-slate-500">
          DI 期货年化收益率 (%)
          <input
            value={future}
            onChange={e => setFuture(e.target.value)}
            type="number"
            step="0.01"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={path}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 9 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Line
                dataKey="annualized"
                name="CDI 简单年化路径 (%)"
                stroke="#34d399"
                dot={false}
              />
              {future !== "" && (
                <Line
                  dataKey="inputDi"
                  name="输入 DI 年化收益率 (%)"
                  stroke="#fbbf24"
                  dot={false}
                  strokeDasharray="5 3"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="max-h-60 overflow-auto border-l border-emerald-950 pl-2">
          <table className="min-w-full text-[10px]">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="p-1.5">计息日</th>
                <th>累计因子</th>
                <th>DI 偏差</th>
              </tr>
            </thead>
            <tbody>
              {path
                .slice(-12)
                .reverse()
                .map(point => (
                  <tr key={point.date} className="border-t border-slate-900">
                    <td className="p-1.5 text-slate-500">{point.date}</td>
                    <td>{point.factor.toFixed(8)}</td>
                    <td className="text-emerald-300">
                      {point.basis == null
                        ? "等待输入"
                        : `${point.basis.toFixed(3)}%`}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {diff != null && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Metric
            label="最新 DI−CDI 年化偏差"
            value={`${diff.toFixed(3)}%`}
            tone="info"
            trend={basisValues}
          />
          <Metric
            label="偏差窗口范围"
            value={
              basisValues.length
                ? `${Math.min(...basisValues).toFixed(3)}% 至 ${Math.max(...basisValues).toFixed(3)}%`
                : "—"
            }
          />
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        CDI 来自巴西中央银行 SGS 公开序列；DI
        期货价格/收益率须由用户自行核验输入，系统不免费抓取或推断期货报价。
      </p>
    </Card>
  );
}
function Efsf() {
  const [identifier, setIdentifier] = useState("");
  const [url, setUrl] = useState("https://www.efsf.europa.eu/");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<
    Array<{ id: number; identifier: string; url: string; notes: string }>
  >([]);
  return (
    <Card title="EFSF EMTN 官方资料核验">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          className="input-terminal text-xs"
          placeholder="证券标识或资料名称"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          type="url"
          className="input-terminal text-xs"
          placeholder="官方来源 URL"
        />
        <button
          type="button"
          onClick={() =>
            identifier.trim() &&
            setEntries(current => [
              ...current,
              { id: Date.now(), identifier, url, notes },
            ])
          }
          className="rounded border border-cyan-800 text-xs text-cyan-200"
        >
          加入核验
        </button>
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="input-terminal mt-2 min-h-16 w-full text-xs"
        placeholder="用户核验说明（可选）"
      />
      <div className="mt-3 space-y-1">
        {entries.map(entry => (
          <div
            key={entry.id}
            className="rounded border border-slate-800 p-2 text-xs"
          >
            <b>{entry.identifier}</b>
            <span className="ml-2">
              <SourceLink url={entry.url} />
            </span>
            {entry.notes && (
              <p className="mt-1 text-slate-500">{entry.notes}</p>
            )}
          </div>
        ))}
        {!entries.length && (
          <EmptyBoundary text="使用 EFSF 官方页面和已获授权文件核验资料。未获授权时不显示单券条款、价格或收益率。" />
        )}
      </div>
    </Card>
  );
}
function EfsfTerminalContext({ snapshot }: { snapshot?: Snapshot }) {
  const source = snapshot?.sources.find(item => item.id === "EFSF");
  return (
    <Card title="EFSF · 终端内资料状态">
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric
          label="资料状态"
          value={source ? "已登记公开来源" : "来源暂不可读"}
          tone={source ? "info" : "neutral"}
        />
        <Metric label="更新频率" value={source?.frequency || "—"} />
        <Metric label="可直接查看" value="范围与核验状态" />
      </div>
      <div className="mt-3 rounded border border-slate-800 p-3 text-xs text-slate-400">
        <b className="text-slate-200">终端内范围：</b>
        {source?.scope || "当前未读取到 EFSF 来源元数据。"}
        <br />
        <span className="text-slate-500">
          公开结构化单券条款、二级价格和收益率当前没有已接入的免费、可核验数据，因此保持真实空状态；原有工作表仍可登记用户已授权资料。
        </span>
        {source && (
          <div className="mt-2">
            <SourceLink url={source.url} label="原始资料（可选核验）" />
          </div>
        )}
      </div>
    </Card>
  );
}
function Mmidx({ snapshot }: { snapshot?: Snapshot }) {
  const [window, setWindow] = useState(90);
  const series = (snapshot?.rates ?? [])
    .filter(
      item =>
        ["SOFR", "EFFR", "OBFR", "IORB", "DTB4WK", "DCPF3M"].includes(
          item.id
        ) && item.status === "available"
    )
    .map(item => ({ ...item, history: item.history.slice(-window) }));
  const dates = [
    ...new Set(series.flatMap(item => item.history.map(point => point.date))),
  ].sort();
  const normalized = dates.map(date => {
    const values = series.flatMap(item => {
      const point = item.history.find(row => row.date === date);
      const base = item.history[0]?.value;
      return point && base != null
        ? [Number((100 + (point.value - base) * 100).toFixed(3))]
        : [];
    });
    return Object.fromEntries([
      ["date", date],
      ...series.map(item => {
        const point = item.history.find(row => row.date === date);
        const base = item.history[0]?.value;
        return [
          item.id,
          point && base != null
            ? Number((100 + (point.value - base) * 100).toFixed(3))
            : null,
        ];
      }),
      [
        "dispersion",
        values.length > 1
          ? Number((Math.max(...values) - Math.min(...values)).toFixed(3))
          : null,
      ],
    ]);
  });
  const ranking = series
    .map(item => {
      const first = item.history[0]?.value;
      const last = item.history.at(-1)?.value;
      const changes = item.history
        .slice(1)
        .map(
          (point, index) =>
            Math.abs(point.value - item.history[index].value) * 100
        );
      return {
        id: item.id,
        label: item.label,
        move: first == null || last == null ? null : (last - first) * 100,
        realized: changes.length
          ? changes.reduce((sum, value) => sum + value, 0) / changes.length
          : null,
        observations: item.history.length,
      };
    })
    .sort(
      (left, right) => Math.abs(right.move ?? 0) - Math.abs(left.move ?? 0)
    );
  const latestDispersion = [...normalized]
    .reverse()
    .find(row => typeof row.dispersion === "number")?.dispersion;
  return (
    <Card title="资金指数路径分化与离散度排序">
      <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
        {[30, 90, 180].map(value => (
          <button
            key={value}
            type="button"
            onClick={() => setWindow(value)}
            className={`rounded px-2 py-1 text-[11px] ${window === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
        <span className="ml-auto text-[9px] text-slate-600">
          窗口内首个可用观察 = 100
        </span>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={normalized}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 9 }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 9 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              {series.map((item, index) => (
                <Line
                  key={item.id}
                  dataKey={item.id}
                  name={item.label}
                  stroke={
                    [
                      "#f472b6",
                      "#22d3ee",
                      "#a78bfa",
                      "#fbbf24",
                      "#34d399",
                      "#60a5fa",
                    ][index]
                  }
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0">
          <Metric
            label="截面离散度"
            value={
              typeof latestDispersion === "number"
                ? `${latestDispersion.toFixed(1)} 点`
                : "—"
            }
            tone="info"
            trend={normalized.flatMap(row =>
              typeof row.dispersion === "number" ? [row.dispersion] : []
            )}
          />
          <div className="mt-2 max-h-52 overflow-auto">
            <table className="min-w-full text-[10px]">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="p-1.5">变化排名</th>
                  <th>窗口位移</th>
                  <th>日均绝对变动</th>
                  <th>样本</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(row => (
                  <tr key={row.id} className="border-t border-slate-900">
                    <td className="p-1.5 text-pink-200">{row.id}</td>
                    <td>
                      {row.move == null
                        ? "—"
                        : `${row.move >= 0 ? "+" : ""}${row.move.toFixed(1)} bp`}
                    </td>
                    <td>
                      {row.realized == null
                        ? "—"
                        : `${row.realized.toFixed(2)} bp`}
                    </td>
                    <td>{row.observations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        六条资金与票据序列分别归一化后独立绘制；离散度是同日路径最高值与最低值之差，排名按窗口绝对位移计算，不构成净值、总回报或投资指数。
      </p>
    </Card>
  );
}
function Etrade() {
  const [instrument, setInstrument] = useState("");
  const [notional, setNotional] = useState("");
  const [source, setSource] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const ready =
    !!instrument.trim() &&
    Number(notional) > 0 &&
    /^https:\/\//.test(source) &&
    confirmed;
  return (
    <Card title="交易准备与审批就绪检查">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={instrument}
          onChange={e => setInstrument(e.target.value)}
          className="input-terminal text-xs"
          placeholder="工具/证券标识"
        />
        <input
          value={notional}
          onChange={e => setNotional(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="名义金额"
        />
        <input
          value={source}
          onChange={e => setSource(e.target.value)}
          type="url"
          className="input-terminal text-xs"
          placeholder="已授权来源 URL"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
        />
        我已在授权渠道核验证券、价格、适用性及内部审批。
      </label>
      <div
        className={`mt-3 rounded border p-3 text-xs ${ready ? "border-emerald-800 text-emerald-200" : "border-slate-700 text-slate-400"}`}
      >
        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
        {ready
          ? "交易准备字段齐备，可进入机构已授权的下单与审批流程。"
          : "需填写工具、正数名义金额、HTTPS 授权来源并确认核验，才会标记为准备就绪。"}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        本工作台不连接交易场所、不生成价格、不发送订单，也不模拟成交。
      </p>
    </Card>
  );
}
function Edsf() {
  const [near, setNear] = useState("3.5");
  const [far, setFar] = useState("3.8");
  const [days, setDays] = useState("90");
  const [notional, setNotional] = useState("1000000");
  const forward =
    (Number(far) * Number(days) -
      Number(near) * Math.max(Number(days) - 30, 1)) /
    30;
  const cash = (((Number(notional) * forward) / 100) * Number(days)) / 360;
  return (
    <Card title="合成 FRA 用户输入现金流">
      <div className="grid gap-2 md:grid-cols-4">
        <label className="text-xs text-slate-500">
          近端利率 (%)
          <input
            value={near}
            onChange={e => setNear(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          远端利率 (%)
          <input
            value={far}
            onChange={e => setFar(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          期间天数
          <input
            value={days}
            onChange={e => setDays(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
        <label className="text-xs text-slate-500">
          名义金额
          <input
            value={notional}
            onChange={e => setNotional(e.target.value)}
            type="number"
            className="input-terminal mt-1 w-full"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Metric
          label="输入驱动的合成远期利率"
          value={`${Number.isFinite(forward) ? forward.toFixed(4) : "—"}%`}
          tone="info"
        />
        <Metric
          label="按输入计算的期间现金流"
          value={
            Number.isFinite(cash)
              ? cash.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : "—"
          }
        />
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        仅基于用户输入的透明计算，不等同 Eurodollar、SOFR FRA 或交易所合约报价。
      </p>
    </Card>
  );
}
function Wbf() {
  const [futures, setFutures] = useState("110");
  const [cash, setCash] = useState("108");
  const [factor, setFactor] = useState("0.9");
  const [days, setDays] = useState("90");
  const basis = Number(cash) - Number(futures) * Number(factor);
  const repo =
    Number(futures) > 0 && Number(days) > 0
      ? (((basis / (Number(futures) * Number(factor))) * 365) / Number(days)) *
        100
      : null;
  return (
    <Card title="期货基差与隐含回购率工作表">
      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={futures}
          onChange={e => setFutures(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="期货价格"
        />
        <input
          value={cash}
          onChange={e => setCash(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="现金价格"
        />
        <input
          value={factor}
          onChange={e => setFactor(e.target.value)}
          type="number"
          step="0.0001"
          className="input-terminal text-xs"
          placeholder="转换因子"
        />
        <input
          value={days}
          onChange={e => setDays(e.target.value)}
          type="number"
          className="input-terminal text-xs"
          placeholder="持有天数"
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Metric
          label="基差"
          value={Number.isFinite(basis) ? basis.toFixed(5) : "—"}
          tone="info"
        />
        <Metric
          label="输入驱动隐含回购率"
          value={repo == null ? "—" : `${repo.toFixed(4)}%`}
        />
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        价格、转换因子和持有日均须由用户从获授权渠道核验；系统不提供全球债券期货实时行情或
        CTD 识别。
      </p>
    </Card>
  );
}
function Pboc({ snapshot }: { snapshot?: Snapshot }) {
  const source = snapshot?.sources.find(item => item.id === "PBOC");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState(
    source?.url || "https://www.pbc.gov.cn/en/3688006/index.html"
  );
  const [items, setItems] = useState<
    Array<{ id: number; title: string; url: string }>
  >([]);
  return (
    <Card title="公开市场公告证据索引">
      <div className="grid gap-2 md:grid-cols-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input-terminal text-xs"
          placeholder="公告标题/检索说明"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          type="url"
          className="input-terminal text-xs"
        />
        <button
          type="button"
          onClick={() =>
            title.trim() &&
            setItems(current => [...current, { id: Date.now(), title, url }])
          }
          className="rounded border border-cyan-800 text-xs text-cyan-200"
        >
          登记原始公告
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {items.map(item => (
          <div
            key={item.id}
            className="rounded border border-slate-800 p-2 text-xs"
          >
            <b>{item.title}</b>
            <span className="ml-2">
              <SourceLink url={item.url} />
            </span>
          </div>
        ))}
        {!items.length && (
          <EmptyBoundary text="当前没有录入的公告证据。请从人民银行官方站点添加可核验原始链接；无稳定免费结构化利率时，系统不会填充市场利率、期限利率或政策预测。" />
        )}
      </div>
    </Card>
  );
}
function Twdi({ snapshot }: { snapshot?: Snapshot }) {
  const [days, setDays] = useState(20);
  const data = (snapshot?.taiwanCallRate ?? []).slice(-days);
  const values = data.map(item => item.valuePct);
  const source = snapshot?.sources.find(item => item.id === "CBC-CALL");
  const latency = snapshot?.sourceLatencyMs["CBC-CALL"];
  return (
    <Card
      title="台湾隔夜拆款公开观察"
      action={
        <button
          type="button"
          onClick={() =>
            csv(
              "taiwan-overnight-call-rate.csv",
              ["日期", "利率 (%)"],
              data.map(item => [item.date, item.valuePct])
            )
          }
          disabled={!data.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <Download className="mr-1 inline h-3 w-3" />
          CSV
        </button>
      }
    >
      <div className="flex gap-1">
        {[10, 20, 60].map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setDays(value)}
            className={`rounded px-2 py-1 text-[11px] ${days === value ? "bg-cyan-900 text-cyan-100" : "text-slate-500"}`}
          >
            {value}D
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="最近利率"
          value={data.at(-1) ? `${data.at(-1)?.valuePct.toFixed(3)}%` : "—"}
          tone="info"
          trend={values}
        />
        <Metric
          label="窗口低点"
          value={values.length ? `${Math.min(...values).toFixed(3)}%` : "—"}
        />
        <Metric
          label="窗口高点"
          value={values.length ? `${Math.max(...values).toFixed(3)}%` : "—"}
        />
      </div>
      <div className="mt-3 h-56">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "#020617",
                  border: "1px solid #334155",
                }}
              />
              <Line
                dataKey="valuePct"
                name="隔夜拆款 (%)"
                stroke="#22d3ee"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyBoundary text="台湾中央银行日度表当前无法读取；终端保持真实空状态，不以 TAIBOR、其他市场利率或模拟序列替代。" />
        )}
      </div>
      <div className="mt-2 grid gap-2 border-t border-teal-950 pt-2 text-[10px] sm:grid-cols-4">
        <span>
          <b className="text-slate-300">读取链路</b>
          <br />
          <i className={data.length ? "text-emerald-300" : "text-amber-300"}>
            {data.length ? "已形成可用序列" : "源站当前不可读"}
          </i>
        </span>
        <span>
          <b className="text-slate-300">响应耗时</b>
          <br />
          <i className="font-mono text-slate-500">
            {latency == null ? "未取得" : `${latency} ms`}
          </i>
        </span>
        <span>
          <b className="text-slate-300">覆盖记录</b>
          <br />
          <i className="font-mono text-slate-500">
            {snapshot?.taiwanCallRate.length ?? 0}
          </i>
        </span>
        <span>
          <b className="text-slate-300">原件定位</b>
          <br />
          {source ? (
            <SourceLink url={source.url} label="中央银行日度表" />
          ) : (
            "目录未登记"
          )}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        公开隔夜拆款观察不等同 TAIBOR、期限拆款报价或银行间可执行价格。
      </p>
    </Card>
  );
}
function NewsLedger({ snapshot }: { snapshot?: Snapshot }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("政策");
  const [entries, setEntries] = useState<
    Array<{ id: number; title: string; url: string; tag: string }>
  >([]);
  const download = () => {
    const body = [
      "# 货币市场原始资料证据清单",
      "",
      ...entries.flatMap(item => [
        `## ${item.title}`,
        `- 标签：${item.tag}`,
        `- 原始来源：${item.url}`,
        "",
      ]),
    ].join("\n");
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "money-market-evidence-ledger.md";
    a.click();
    URL.revokeObjectURL(href);
  };
  void snapshot;
  return (
    <Card
      title="原始资料证据台账"
      action={
        <button
          type="button"
          onClick={download}
          disabled={!entries.length}
          className="text-xs text-cyan-300 disabled:text-slate-600"
        >
          <FileText className="mr-1 inline h-3 w-3" />
          Markdown
        </button>
      }
    >
      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input-terminal text-xs"
          placeholder="资料标题"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          type="url"
          className="input-terminal text-xs"
          placeholder="官方原始 URL"
        />
        <select
          value={tag}
          onChange={e => setTag(e.target.value)}
          className="input-terminal text-xs"
        >
          <option>政策</option>
          <option>拍卖</option>
          <option>参考利率</option>
          <option>流动性</option>
        </select>
        <button
          type="button"
          onClick={() =>
            title.trim() &&
            /^https:\/\//.test(url) &&
            setEntries(current => [
              ...current,
              { id: Date.now(), title, url, tag },
            ])
          }
          className="rounded border border-cyan-800 text-xs text-cyan-200"
        >
          登记证据
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {entries.map(entry => (
          <div
            key={entry.id}
            className="flex justify-between gap-2 rounded border border-slate-800 p-2 text-xs"
          >
            <span>
              <Badge tone="info">{entry.tag}</Badge>
              <b className="ml-2">{entry.title}</b>
            </span>
            <SourceLink url={entry.url} />
          </div>
        ))}
        {!entries.length && (
          <EmptyBoundary text="可从管理范围内登记的资料标题建立 NEWS 证据记录；系统不生成新闻、分析师观点、市场预测或交易结论。" />
        )}
      </div>
    </Card>
  );
}
function MmflowTerminalStatus({ snapshot }: { snapshot?: Snapshot }) {
  const sources = snapshot?.sources ?? [];
  const readableRates = (snapshot?.rates ?? []).filter(
    item => item.status === "available"
  );
  const pending = !snapshot;
  return (
    <Card title="MMFLOW · 终端内研究交付工作台">
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric
          label="可选公开来源"
          value={pending ? "更新中" : String(sources.length)}
          tone="info"
        />
        <Metric
          label="当前可读观察"
          value={pending ? "更新中" : String(readableRates.length)}
        />
        <Metric label="交付流程" value="组装 · 审阅 · 导出" />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        下方直接提供来源选择、账户级交付包、团队审阅、版本和导出功能；研究资料范围与状态均在终端内管理。
        {pending
          ? "公开快照正在更新，完成后将显示可选择的来源和观察数量。"
          : "原始网页仅在需要复核来源时作为次级证据入口，不是交付流程的前置条件。"}
      </p>
    </Card>
  );
}

export default function MoneyMarketSpecialistPanels({
  moduleId,
}: {
  moduleId: ModuleId;
}) {
  const { user } = useAuth();
  const usage = trpc.moneyMarketResearch.recordModuleUsage.useMutation();
  const [boomTerms, setBoomTerms] = useState<string[]>([]);
  useEffect(() => {
    if (user) usage.mutate({ moduleId });
  }, [moduleId, user?.id]);
  const meta = META[moduleId];
  const snapshotQuery = trpc.moneyMarketResearch.getSnapshot.useQuery(
    undefined,
    { staleTime: 30_000, refetchInterval: 60_000 }
  );
  const snapshot = snapshotQuery.data as Snapshot | undefined;
  const deepSnapshot = snapshot as MmSnapshot | undefined;
  const body: Record<ModuleId, React.ReactNode> = {
    "des-mm": <DesIntegrated snapshot={deepSnapshot} />,
    pgm: <PgmIntegrated snapshot={deepSnapshot} />,
    mktbeat: <MarketBeat snapshot={snapshot} />,
    btmm: <Btmm snapshot={snapshot} />,
    boom: (
      <BoomIntegrated
        snapshot={deepSnapshot}
        selectedTerms={boomTerms}
        onSelectedTermsChange={setBoomTerms}
      />
    ),
    tcon: <TconIntegrated snapshot={deepSnapshot} />,
    rv: <RelativeValue snapshot={snapshot} />,
    ycqsim: <CurveScenario snapshot={snapshot} />,
    gc: <CurveGraph snapshot={snapshot} />,
    "crvf-mmkt": <CurveDirectoryIntegrated snapshot={deepSnapshot} />,
    crvf: <CurveDirectoryIntegrated snapshot={deepSnapshot} cross />,
    fibc: <FibcIntegrated />,
    cdie: <Cdie snapshot={snapshot} />,
    efsf: <EfsfIntegrated snapshot={deepSnapshot} />,
    mmidx: <Mmidx snapshot={snapshot} />,
    etrade: <EtradeIntegrated />,
    edsf: <EdsfIntegrated />,
    wbf: <WbfIntegrated />,
    pboc: <PbocIntegrated snapshot={deepSnapshot} />,
    twdi: <Twdi snapshot={snapshot} />,
    cenb: <CenbIntegrated snapshot={deepSnapshot} />,
    "news-mm": <NewsIntegrated />,
    "source-mm": (
      <MoneyMarketDistinctiveLayer
        moduleId="source-mm"
        snapshot={deepSnapshot}
      />
    ),
    mmflow: (
      <MoneyMarketDistinctiveLayer moduleId="mmflow" snapshot={deepSnapshot} />
    ),
  };
  const extensions = (
    <>
      {moduleId === "mktbeat" && (
        <MktbeatThresholdAlert
          snapshot={
            snapshot as React.ComponentProps<
              typeof MktbeatThresholdAlert
            >["snapshot"]
          }
        />
      )}
      {moduleId === "btmm" && <BtmmDualRangeComparison />}
      {moduleId === "boom" && (
        <>
          <BoomAuctionCollaborationPanel />
          <BoomSubscriptionFilters
            terms={boomTerms}
            onTermsChange={setBoomTerms}
          />
        </>
      )}
      {moduleId === "pboc" && (
        <CentralBankPolicyEvidencePanel initialSourceId="PBOC" lockSource />
      )}
      {moduleId === "cenb" && (
        <>
          <PolicyEvidenceCollaborationPanel initialSourceId="FED" />
          <PolicyEvidenceWorkflowPanel initialSourceId="FED" />
        </>
      )}
    </>
  );
  const sourceStatus = snapshotQuery.isLoading ? (
    <div className="mt-3">
      <LoadingState label="正在更新终端内公开数据；原有面板仍可使用。" />
    </div>
  ) : snapshotQuery.error ? (
    <div className="mt-3">
      <EmptyBoundary
        text={`公开数据服务暂不可读：${snapshotQuery.error.message}。原有输入、计算、核验和导出面板保持可用；系统不会以缓存样本或随机数据替代。`}
      />
    </div>
  ) : null;
  return (
    <MoneyMarketWorkbench
      moduleId={moduleId}
      ticker={meta.ticker}
      number={meta.n}
      title={meta.title}
      subtitle={meta.subtitle}
      snapshot={snapshot}
    >
      {body[moduleId]}
      {sourceStatus}
      {extensions}
    </MoneyMarketWorkbench>
  );
}
