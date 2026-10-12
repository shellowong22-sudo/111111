/** NIM — 新发行、事件与评级研究登记簿。数据必须由用户以可核验来源登记。 */
import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { PanelShell, Card, Badge, Metric } from "./sovereign/PanelKit";
import ResearchLedgerWorkspace from "./sovereign/ResearchLedgerWorkspace";
import { SovereignFinancingCalendar } from "./sovereign/SovereignFinancingCalendar";
import {
  Download,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type IssuanceRecord = {
  id: string;
  date: string;
  issuer: string;
  jurisdiction: string;
  currency: string;
  size: string;
  maturity: string;
  sourceUrl: string;
  status: string;
  updatedAt: string;
};
type EventRecord = {
  id: string;
  date: string;
  entity: string;
  topic: string;
  note: string;
  sourceUrl: string;
  status: string;
  updatedAt: string;
};
type RatingRecord = {
  id: string;
  date: string;
  issuer: string;
  agency: string;
  rating: string;
  outlook: string;
  sourceUrl: string;
  status: string;
  updatedAt: string;
};
type CalendarSourceStatus = "available" | "unavailable" | "indexed";
const normalizeCalendarSourceStatus = (status: string): CalendarSourceStatus =>
  status === "available" || status === "indexed" ? status : "unavailable";

function exportCsv(name: string, records: Record<string, unknown>[]) {
  const headers = Array.from(new Set(records.flatMap(row => Object.keys(row))));
  const csv = [
    headers.join(","),
    ...records.map(row =>
      headers.map(header => JSON.stringify(row[header] ?? "")).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const ledgerStatus = (value: string) => value === "approved" ? "已核验" : value === "rejected" ? "已退回" : "待复核";
const part = (value: string, label: string) => value.match(new RegExp(`${label}\\s*([^｜]+)`))?.[1]?.trim() ?? "";
const ledgerDate = (value: unknown) => value ? new Date(value as string | Date).toISOString() : new Date().toISOString();

export default function IssuancePanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState("official-auctions");
  const utils = trpc.useUtils();
  const ledger = trpc.researchLedger.mine.useQuery(
    { limit: 100 },
    { refetchInterval: 5_000, refetchOnWindowFocus: true }
  );
  const submitLedger = trpc.researchLedger.submit.useMutation({
    onSuccess: () => utils.researchLedger.mine.invalidate(),
  });
  const auctions = trpc.sovereignBonds.getTreasuryAuctions.useQuery(
    { limit: 50 },
    { refetchOnWindowFocus: false, refetchInterval: 60_000 }
  );
  const calendar = trpc.sovereignBonds.getOfficialFinancingCalendar.useQuery(
    { limit: 100 },
    { refetchOnWindowFocus: false, refetchInterval: 60_000 }
  );
  const calendarData = useMemo(
    () =>
      calendar.data
        ? {
            ...calendar.data,
            sources: calendar.data.sources.map(source => ({
              ...source,
              status: normalizeCalendarSourceStatus(source.status),
            })),
          }
        : undefined,
    [calendar.data]
  );
  const completedAuctions = useMemo(
    () =>
      (auctions.data?.data ?? [])
        .filter(
          row => row.resultMetricValue !== null || row.bidToCoverRatio !== null
        )
        .slice(0, 30),
    [auctions.data?.data]
  );
  const auctionOutcomeSeries = useMemo(
    () =>
      [...completedAuctions]
        .reverse()
        .map(row => ({
          date: row.auctionDate,
          term: row.securityTerm,
          offeringBn:
            row.offeringAmount === null
              ? null
              : row.offeringAmount / 1_000_000_000,
          demand: row.bidToCoverRatio,
          result: row.resultMetricValue,
        })),
    [completedAuctions]
  );
  const averageDemand = useMemo(() => {
    const values = completedAuctions
      .map(row => row.bidToCoverRatio)
      .filter((value): value is number => value !== null);
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }, [completedAuctions]);
  const completedOffering = useMemo(
    () =>
      completedAuctions.reduce(
        (sum, row) => sum + (row.offeringAmount ?? 0),
        0
      ),
    [completedAuctions]
  );
  const issuances = useMemo<IssuanceRecord[]>(() => (ledger.data ?? [])
    .filter(entry => entry.moduleCode === "NIM-ISSUANCE")
    .map(entry => ({
      id: String(entry.id),
      date: part(entry.purpose, "日期"),
      issuer: entry.instrument,
      jurisdiction: part(entry.purpose, "辖区"),
      currency: part(entry.purpose, "币种") || "—",
      size: part(entry.purpose, "规模"),
      maturity: part(entry.purpose, "期限"),
      sourceUrl: entry.verifiedSource,
      status: ledgerStatus(entry.status),
      updatedAt: ledgerDate(entry.updatedAt),
    })), [ledger.data]);
  const events = useMemo<EventRecord[]>(() => (ledger.data ?? [])
    .filter(entry => entry.moduleCode === "NIM-EVENT")
    .map(entry => ({
      id: String(entry.id),
      date: part(entry.purpose, "日期"),
      entity: entry.instrument,
      topic: part(entry.purpose, "事项"),
      note: part(entry.purpose, "结论"),
      sourceUrl: entry.verifiedSource,
      status: ledgerStatus(entry.status),
      updatedAt: ledgerDate(entry.updatedAt),
    })), [ledger.data]);
  const ratings = useMemo<RatingRecord[]>(() => (ledger.data ?? [])
    .filter(entry => entry.moduleCode === "NIM-RATING")
    .map(entry => ({
      id: String(entry.id),
      date: part(entry.purpose, "日期"),
      issuer: entry.instrument,
      agency: part(entry.purpose, "机构"),
      rating: part(entry.purpose, "评级"),
      outlook: part(entry.purpose, "展望"),
      sourceUrl: entry.verifiedSource,
      status: ledgerStatus(entry.status),
      updatedAt: ledgerDate(entry.updatedAt),
    })), [ledger.data]);
  const issuanceTenors = useMemo(() => Array.from(new Set(issuances.map(item => item.maturity || "未填期限"))).map(tenor => ({ tenor, records: issuances.filter(item => (item.maturity || "未填期限") === tenor).length })), [issuances]);
  const eventTimeline = useMemo(() => Array.from(new Set(events.map(item => item.date || "未填日期"))).sort().map(date => ({ date, records: events.filter(item => (item.date || "未填日期") === date).length })), [events]);
  const ratingDistribution = useMemo(() => Array.from(new Set(ratings.map(item => `${item.agency || "未填机构"} ${item.rating || "未填评级"}`))).map(bucket => ({ bucket, records: ratings.filter(item => `${item.agency || "未填机构"} ${item.rating || "未填评级"}` === bucket).length })), [ratings]);
  const [issuanceForm, setIssuanceForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    issuer: "",
    jurisdiction: "",
    currency: "USD",
    size: "",
    maturity: "",
    sourceUrl: "",
  });
  const [eventForm, setEventForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    entity: "",
    topic: "",
    note: "",
    sourceUrl: "",
  });
  const [ratingForm, setRatingForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    issuer: "",
    agency: "Moody’s",
    rating: "",
    outlook: "",
    sourceUrl: "",
  });
  const tabs = [
    { id: "official-auctions", label: "官方拍卖" },
    { id: "financing-calendar", label: "融资日历" },
    { id: "account-ledger", label: "账户送审" },
    { id: "issuance", label: "发行研究登记" },
    { id: "events", label: "事项核验日志" },
    { id: "ratings", label: "评级来源记录" },
  ];
  const addIssuance = () => {
    if (!issuanceForm.issuer.trim() || !issuanceForm.sourceUrl.trim() || submitLedger.isPending) return;
    submitLedger.mutate({
      moduleCode: "NIM-ISSUANCE",
      instrument: issuanceForm.issuer.trim(),
      purpose: `日期 ${issuanceForm.date}｜辖区 ${issuanceForm.jurisdiction.trim() || "未填"}｜币种 ${issuanceForm.currency.trim() || "未填"}｜规模 ${issuanceForm.size.trim() || "未填"}｜期限 ${issuanceForm.maturity.trim() || "未填"}`,
      verifiedSource: issuanceForm.sourceUrl.trim(),
      methodBasis: "以发行主体原始披露为事实边界；提交后进入账户审批与追加式审计。",
      complianceConfirmed: true,
    }, { onSuccess: () => setIssuanceForm(current => ({ ...current, issuer: "", jurisdiction: "", size: "", maturity: "", sourceUrl: "" })) });
  };
  const addEvent = () => {
    if (
      !eventForm.entity.trim() ||
      !eventForm.topic.trim() ||
      !eventForm.sourceUrl.trim() || submitLedger.isPending
    )
      return;
    submitLedger.mutate({
      moduleCode: "NIM-EVENT",
      instrument: eventForm.entity.trim(),
      purpose: `日期 ${eventForm.date}｜事项 ${eventForm.topic.trim()}｜结论 ${eventForm.note.trim() || "待补"}`,
      verifiedSource: eventForm.sourceUrl.trim(),
      methodBasis: "按事件披露时点排序；仅在来源出现增量时更新核验结论。",
      complianceConfirmed: true,
    }, { onSuccess: () => setEventForm(current => ({ ...current, entity: "", topic: "", note: "", sourceUrl: "" })) });
  };
  const addRating = () => {
    if (
      !ratingForm.issuer.trim() ||
      !ratingForm.rating.trim() ||
      !ratingForm.sourceUrl.trim() || submitLedger.isPending
    )
      return;
    submitLedger.mutate({
      moduleCode: "NIM-RATING",
      instrument: ratingForm.issuer.trim(),
      purpose: `日期 ${ratingForm.date}｜机构 ${ratingForm.agency}｜评级 ${ratingForm.rating.trim()}｜展望 ${ratingForm.outlook.trim() || "未披露"}`,
      verifiedSource: ratingForm.sourceUrl.trim(),
      methodBasis: "评级符号、展望和生效日保留公告口径；不计算替代评分或迁移概率。",
      complianceConfirmed: true,
    }, { onSuccess: () => setRatingForm(current => ({ ...current, issuer: "", rating: "", outlook: "", sourceUrl: "" })) });
  };
  const statusTone = (status: string) => (status === "已核验" ? "pos" : "warn");
  const refresh = () => {
    ledger.refetch();
    auctions.refetch();
    calendar.refetch();
  };
  return (
    <PanelShell
      ticker="NIM"
      title="新发行、公司大事、评级"
      subtitle="以原始来源登记、核验和导出为中心的主权债研究台账"
      onClose={onClose}
      onRefresh={refresh}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === "official-auctions" && (
        <div className="space-y-3">
          <Card title="已完成拍卖的需求与定价结果">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <p className="text-slate-500">
                本页只分析已经公布结果的场次；尚未举行的发行安排统一放在“融资日历”，两处不重复。
              </p>
              <span
               
                
               
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                官方数据页
              </span>
            </div>
            {auctions.isLoading ? (
              <div className="space-y-2">
                <div className="h-7 animate-pulse rounded bg-slate-800" />
                <div className="h-7 animate-pulse rounded bg-slate-800" />
                <div className="h-7 animate-pulse rounded bg-slate-800" />
              </div>
            ) : auctions.error ? (
              <div className="rounded border border-rose-900/60 bg-rose-950/20 p-3 text-[11px] text-rose-300">
                官方拍卖数据暂不可用：{auctions.error.message}
                <button
                  type="button"
                  onClick={() => auctions.refetch()}
                  className="ml-2 text-cyan-300 underline"
                >
                  重试
                </button>
              </div>
            ) : !auctions.data?.available || !completedAuctions.length ? (
              <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3 text-[11px] text-amber-200">
                当前读取窗口没有已经公布结果的场次。未来发行不会在结果页提前占位，请到“融资日历”查看排期。
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  <Metric label="已出结果场次" value={String(completedAuctions.length)} tone="info" />
                  <Metric label="平均投标覆盖" value={averageDemand === null ? "—" : averageDemand.toFixed(2)} tone="pos" />
                  <Metric label="样本发行总额" value={new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1, style: "currency", currency: "USD" }).format(completedOffering)} tone="warn" />
                  <Metric label="最近结果日" value={completedAuctions[0]?.auctionDate ?? "—"} />
                </div>
                <div className="mb-3 h-64 rounded border border-slate-800 bg-slate-950/50 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={auctionOutcomeSeries}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} minTickGap={24} />
                      <YAxis yAxisId="amount" tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={value => `$${value}B`} />
                      <YAxis yAxisId="demand" orientation="right" domain={["auto", "auto"]} tick={{ fill: "#fbbf24", fontSize: 9 }} />
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", fontSize: 10 }} formatter={(value, name) => [name === "发行规模" ? `$${Number(value).toFixed(1)}B` : Number(value).toFixed(2), name]} />
                      <Bar yAxisId="amount" dataKey="offeringBn" name="发行规模" fill="#164e63" />
                      <Line yAxisId="demand" dataKey="demand" name="投标覆盖" stroke="#fbbf24" strokeWidth={2} connectNulls dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-slate-500">
                        <th className="p-1.5">拍卖日</th>
                        <th>CUSIP / 类型</th>
                        <th>期限 / 到期</th>
                        <th className="text-right">发行规模</th>
                        <th className="text-right">投标覆盖</th>
                        <th className="text-right">拍卖结果</th>
                        <th className="text-right">票面利率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedAuctions.map(auction => (
                        <tr
                          key={`${auction.cusip}-${auction.auctionDate}`}
                          className="border-b border-slate-800/60"
                        >
                          <td className="p-1.5 font-mono text-slate-300">
                            {auction.auctionDate || "—"}
                          </td>
                          <td>
                            <div className="font-mono text-cyan-300">
                              {auction.cusip}
                            </div>
                            <div className="text-slate-500">
                              {auction.securityType}
                            </div>
                          </td>
                          <td>
                            <div className="text-slate-300">
                              {auction.securityTerm}
                            </div>
                            <div className="text-slate-500">
                              到期 {auction.maturityDate ?? "—"}
                            </div>
                          </td>
                          <td className="text-right font-mono text-slate-300">
                            {auction.offeringAmount === null
                              ? "—"
                              : new Intl.NumberFormat("en-US", {
                                  notation: "compact",
                                  maximumFractionDigits: 1,
                                  style: "currency",
                                  currency: "USD",
                                }).format(auction.offeringAmount)}
                          </td>
                          <td className="text-right font-mono text-emerald-300">
                            {auction.bidToCoverRatio === null ? "—" : auction.bidToCoverRatio.toFixed(2)}
                          </td>
                          <td className="text-right">
                            <div className="font-mono text-amber-300">
                              {auction.resultMetricValue === null
                                ? "—"
                                : `${auction.resultMetricValue.toFixed(3)}${auction.resultMetricLabel === "最高价格" ? "" : "%"}`}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              {auction.resultMetricLabel ?? "结果待发布"}
                            </div>
                          </td>
                          <td className="text-right font-mono text-slate-300">
                            {auction.couponRate === null
                              ? "—"
                              : `${auction.couponRate.toFixed(3)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[10px] text-slate-600">
                  最近记录日：{completedAuctions[0]?.recordDate || "—"}
                  ；页面请求时间：
                  {auctions.data.timestamp
                    ? new Date(auctions.data.timestamp).toLocaleString()
                    : "—"}
                  。柱形显示已完成场次规模，折线只连接已披露的投标覆盖倍数；这里不展示未来场次，也不把一级市场结果当作二级市场成交报价。
                </p>
              </>
            )}
          </Card>
        </div>
      )}
      {tab === "financing-calendar" && (
        <SovereignFinancingCalendar
          data={calendarData}
          isLoading={calendar.isLoading}
          error={calendar.error}
          onRetry={() => calendar.refetch()}
        />
      )}
      {tab === "account-ledger" && (
        <ResearchLedgerWorkspace
          moduleCode="NIM"
          visibleModuleCodes={["NIM", "NIM-ISSUANCE", "NIM-EVENT", "NIM-RATING"]}
          title="NIM 发行研究账户台账"
          description="将发行、公司/主权事项或评级研究的原始来源与方法口径同步到当前账户，提交后进入管理员审批与审计流程。"
        />
      )}
      {tab === "issuance" && (
          <Card title="发行条款与期限分布">
            <div className="grid gap-2 md:grid-cols-4">
              <label className="text-[10px] text-slate-500">
                日期
                <input
                  type="date"
                  value={issuanceForm.date}
                  onChange={e =>
                    setIssuanceForm({ ...issuanceForm, date: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                发行人 / 主权主体
                <input
                  value={issuanceForm.issuer}
                  onChange={e =>
                    setIssuanceForm({ ...issuanceForm, issuer: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                司法辖区
                <input
                  value={issuanceForm.jurisdiction}
                  onChange={e =>
                    setIssuanceForm({
                      ...issuanceForm,
                      jurisdiction: e.target.value,
                    })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                币种
                <input
                  value={issuanceForm.currency}
                  onChange={e =>
                    setIssuanceForm({
                      ...issuanceForm,
                      currency: e.target.value,
                    })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                规模
                <input
                  value={issuanceForm.size}
                  onChange={e =>
                    setIssuanceForm({ ...issuanceForm, size: e.target.value })
                  }
                  placeholder="如 500m"
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                到期 / 期限
                <input
                  value={issuanceForm.maturity}
                  onChange={e =>
                    setIssuanceForm({
                      ...issuanceForm,
                      maturity: e.target.value,
                    })
                  }
                  placeholder="如 10Y"
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500 md:col-span-2">
                原始来源 URL（必填）
                <input
                  type="url"
                  value={issuanceForm.sourceUrl}
                  onChange={e =>
                    setIssuanceForm({
                      ...issuanceForm,
                      sourceUrl: e.target.value,
                    })
                  }
                  placeholder="https://…"
                  className="mt-1 w-full input-terminal"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addIssuance}
              disabled={
                !issuanceForm.issuer.trim() || !issuanceForm.sourceUrl.trim() || submitLedger.isPending
              }
              className="mt-3 inline-flex items-center gap-1 rounded bg-cyan-700 px-3 py-1.5 text-[11px] text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {submitLedger.isPending ? "正在送审…" : "登记条款并送审"}
            </button>
            <button
              type="button"
              onClick={() => exportCsv("issuance-research", issuances)}
              disabled={!issuances.length}
              className="ml-3 inline-flex items-center gap-1 text-[10px] text-cyan-400 disabled:text-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              导出条款台账
            </button>
            {submitLedger.error && <p className="mt-2 text-[10px] text-rose-300">送审失败：{submitLedger.error.message}</p>}
            <div className="mt-4 grid gap-3 border-t border-slate-800 pt-3 xl:grid-cols-[.75fr_1.25fr]">
              <div className="h-48 rounded border border-slate-800 bg-slate-950/50 p-2">
                {issuanceTenors.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={issuanceTenors}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="tenor" tick={{ fill: "#64748b", fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", fontSize: 10 }} /><Bar dataKey="records" name="登记笔数" fill="#22d3ee" /></ComposedChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-slate-600">提交首条发行来源后生成期限分布；不会预置虚构项目。</div>}
              </div>
              <div className="max-h-48 overflow-auto rounded border border-slate-800">
                <table className="w-full text-[10px]"><thead className="sticky top-0 bg-slate-950 text-left text-slate-500"><tr><th className="p-2">主体</th><th>辖区 / 币种</th><th>规模 / 期限</th><th>状态</th><th>披露</th></tr></thead><tbody>{issuances.map(item => <tr key={item.id} className="border-t border-slate-800"><td className="p-2 text-slate-200">{item.issuer}<div className="font-mono text-slate-600">{item.date}</div></td><td>{item.jurisdiction || "未填"} / {item.currency}</td><td>{item.size || "未填"} / {item.maturity || "未填"}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td><td></td></tr>)}</tbody></table>
                {!ledger.isLoading && !issuances.length && <p className="p-3 text-[10px] text-slate-600">尚无账户级发行研究记录。</p>}
              </div>
            </div>
          </Card>
      )}
      {tab === "events" && (
          <Card title="事项时间轴与证据进度">
            <div className="grid gap-2 md:grid-cols-3">
              <label className="text-[10px] text-slate-500">
                日期
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={e =>
                    setEventForm({ ...eventForm, date: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                主体
                <input
                  value={eventForm.entity}
                  onChange={e =>
                    setEventForm({ ...eventForm, entity: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                事项
                <input
                  value={eventForm.topic}
                  onChange={e =>
                    setEventForm({ ...eventForm, topic: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500 md:col-span-2">
                研究笔记
                <input
                  value={eventForm.note}
                  onChange={e =>
                    setEventForm({ ...eventForm, note: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                原始来源 URL（必填）
                <input
                  type="url"
                  value={eventForm.sourceUrl}
                  onChange={e =>
                    setEventForm({ ...eventForm, sourceUrl: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addEvent}
              disabled={
                !eventForm.entity.trim() ||
                !eventForm.topic.trim() ||
                !eventForm.sourceUrl.trim() || submitLedger.isPending
              }
              className="mt-3 inline-flex items-center gap-1 rounded bg-cyan-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {submitLedger.isPending ? "正在写入…" : "写入事件时间轴"}
            </button>
            <button
              type="button"
              onClick={() => exportCsv("event-verification", events)}
              disabled={!events.length}
              className="ml-3 inline-flex items-center gap-1 text-[10px] text-cyan-400 disabled:text-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              导出事件证据
            </button>
            <div className="mt-4 grid gap-3 border-t border-slate-800 pt-3 xl:grid-cols-[.7fr_1.3fr]">
              <div className="h-48 rounded border border-slate-800 bg-slate-950/50 p-2">{eventTimeline.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={eventTimeline}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", fontSize: 10 }} /><Line dataKey="records" name="当日事项" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} /></ComposedChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-slate-600">时间轴等待首个可核验事项。</div>}</div>
              <ol className="max-h-48 space-y-2 overflow-auto pr-1">{events.map(item => <li key={item.id} className="border-l-2 border-amber-500 bg-slate-950/50 px-3 py-2"><div className="flex items-center justify-between gap-2"><b className="text-[11px] text-slate-100">{item.entity}</b><span className="font-mono text-[9px] text-amber-300">{item.date}</span></div><p className="mt-1 text-[10px] text-slate-300">{item.topic}</p><p className="mt-1 text-[9px] text-slate-500">{item.note || "结论待补"}</p><div className="mt-1 flex items-center justify-between"><Badge tone={statusTone(item.status)}>{item.status}</Badge></div></li>)}{!ledger.isLoading && !events.length && <li className="rounded border border-dashed border-slate-800 p-3 text-[10px] text-slate-600">尚无实际事项；此处不以模板事件填充。</li>}</ol>
            </div>
          </Card>
      )}
      {tab === "ratings" && (
          <Card title="评级机构口径与迁移观察">
            <div className="grid gap-2 md:grid-cols-3">
              <label className="text-[10px] text-slate-500">
                日期
                <input
                  type="date"
                  value={ratingForm.date}
                  onChange={e =>
                    setRatingForm({ ...ratingForm, date: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                发行人 / 主权主体
                <input
                  value={ratingForm.issuer}
                  onChange={e =>
                    setRatingForm({ ...ratingForm, issuer: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                评级机构
                <select
                  value={ratingForm.agency}
                  onChange={e =>
                    setRatingForm({ ...ratingForm, agency: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                >
                  <option>Moody’s</option>
                  <option>S&amp;P</option>
                  <option>Fitch</option>
                  <option>其他</option>
                </select>
              </label>
              <label className="text-[10px] text-slate-500">
                评级
                <input
                  value={ratingForm.rating}
                  onChange={e =>
                    setRatingForm({ ...ratingForm, rating: e.target.value })
                  }
                  placeholder="如 Aa3"
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                展望 / 观察
                <input
                  value={ratingForm.outlook}
                  onChange={e =>
                    setRatingForm({ ...ratingForm, outlook: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                公告 URL（必填）
                <input
                  type="url"
                  value={ratingForm.sourceUrl}
                  onChange={e =>
                    setRatingForm({ ...ratingForm, sourceUrl: e.target.value })
                  }
                  className="mt-1 w-full input-terminal"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addRating}
              disabled={
                !ratingForm.issuer.trim() ||
                !ratingForm.rating.trim() ||
                !ratingForm.sourceUrl.trim() || submitLedger.isPending
              }
              className="mt-3 inline-flex items-center gap-1 rounded bg-cyan-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {submitLedger.isPending ? "正在登记…" : "登记评级公告"}
            </button>
            <button
              type="button"
              onClick={() => exportCsv("rating-records", ratings)}
              disabled={!ratings.length}
              className="ml-3 inline-flex items-center gap-1 text-[10px] text-cyan-400 disabled:text-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              导出评级轨迹
            </button>
            <div className="mt-4 grid gap-3 border-t border-slate-800 pt-3 xl:grid-cols-[.8fr_1.2fr]">
              <div className="h-48 rounded border border-slate-800 bg-slate-950/50 p-2">{ratingDistribution.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={ratingDistribution}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" /><XAxis dataKey="bucket" tick={{ fill: "#64748b", fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", fontSize: 10 }} /><Bar dataKey="records" name="公告笔数" fill="#a78bfa" /></ComposedChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-slate-600">评级公告入库后按机构与等级形成分布。</div>}</div>
              <div className="max-h-48 overflow-auto rounded border border-slate-800"><table className="w-full text-[10px]"><thead className="sticky top-0 bg-slate-950 text-left text-slate-500"><tr><th className="p-2">主体</th><th>机构</th><th>评级 / 展望</th><th>生效日</th><th>证据</th></tr></thead><tbody>{ratings.map(item => <tr key={item.id} className="border-t border-slate-800"><td className="p-2 text-slate-200">{item.issuer}<div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div></td><td>{item.agency || "未填"}</td><td><span className="font-mono text-violet-300">{item.rating}</span> / {item.outlook || "未披露"}</td><td className="font-mono text-slate-500">{item.date}</td><td></td></tr>)}</tbody></table>{!ledger.isLoading && !ratings.length && <p className="p-3 text-[10px] text-slate-600">尚无已登记评级公告。</p>}</div>
            </div>
          </Card>
      )}
    </PanelShell>
  );
}
