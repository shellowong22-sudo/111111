import { useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  Filter,
  History,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Card } from "./PanelKit";

type CalendarEventType = "announcement" | "auction" | "settlement";
type FinancingCountryCode = "ALL" | "US" | "DE" | "GB" | "JP" | "FR" | "IT";
type CalendarRecord = {
  id: string;
  countryCode: string;
  country: string;
  currency: string;
  auctionDate: string;
  eventType: CalendarEventType;
  securityType: string;
  securityTerm: string | null;
  issueDate: string | null;
  maturityDate: string | null;
  offeringAmount: number | null;
  couponRate: number | null;
  isin?: string | null;
  sourceLabel: string;
  sourceUrl: string;
};
type CalendarSource = {
  countryCode: string;
  country: string;
  status: "available" | "unavailable" | "indexed";
  sourceLabel: string;
  sourceUrl: string;
  limitation: string;
};
type CalendarData = {
  records: CalendarRecord[];
  sources: CalendarSource[];
  timestamp: string;
};
type ReminderRule = {
  id: number;
  eventType: CalendarEventType;
  countryCode: string;
  daysBeforeEvent: number;
  isActive: boolean;
};
type ReminderHistory = {
  id: number;
  ruleId: number;
  eventRecordId: string;
  eventDate: Date | string;
  sentAt: Date | string;
  eventType: CalendarEventType;
  countryCode: string;
  daysBeforeEvent: number;
  isActive: boolean;
};
type TenorBucket = "短端" | "中端" | "长端" | "未分类";

const eventTypeLabel: Record<CalendarEventType, string> = {
  announcement: "发行公告",
  auction: "拍卖",
  settlement: "交收",
};
const statusStyle = (status: CalendarSource["status"]) =>
  status === "available"
    ? "border-emerald-900/70 bg-emerald-950/20 text-emerald-200"
    : status === "indexed"
      ? "border-amber-900/70 bg-amber-950/20 text-amber-200"
      : "border-slate-700 bg-slate-950/40 text-slate-400";

function tenorBucket(term: string | null): TenorBucket {
  const years = Number(term?.match(/(\d+(?:\.\d+)?)\s*year/i)?.[1]);
  const months = Number(term?.match(/(\d+(?:\.\d+)?)\s*month/i)?.[1]);
  if (Number.isFinite(years))
    return years >= 10 ? "长端" : years >= 2 ? "中端" : "短端";
  if (Number.isFinite(months)) return "短端";
  return "未分类";
}

function FinancingStructureComparison({
  records,
  countryCodes,
  sources,
}: {
  records: CalendarRecord[];
  countryCodes: string[];
  sources: CalendarSource[];
}) {
  const tenorData = useMemo(
    () =>
      countryCodes.map(countryCode => {
        const countryRows = records.filter(
          record => record.countryCode === countryCode
        );
        const source = sources.find(item => item.countryCode === countryCode);
        const counts = countryRows.reduce<Record<TenorBucket, number>>(
          (total, row) => {
            total[tenorBucket(row.securityTerm)] += 1;
            return total;
          },
          { 短端: 0, 中端: 0, 长端: 0, 未分类: 0 }
        );
        return { country: source?.country ?? countryCode, ...counts };
      }),
    [countryCodes, records, sources]
  );
  const currencyPanels = useMemo(
    () =>
      Object.entries(
        records
          .filter(record => record.offeringAmount !== null)
          .reduce<Record<string, Record<string, number>>>((groups, record) => {
            groups[record.currency] ??= {};
            groups[record.currency][record.country] =
              (groups[record.currency][record.country] ?? 0) +
              (record.offeringAmount ?? 0);
            return groups;
          }, {})
      ).map(([currency, values]) => ({
        currency,
        data: Object.entries(values).map(([country, amount]) => ({
          country,
          amount,
        })),
      })),
    [records]
  );
  if (!records.length)
    return (
      <p className="text-[10px] text-slate-500">
        所选国家没有可用官方事件，不能计算融资规模或期限结构。
      </p>
    );
  return (
    <section className="mb-3 rounded border border-violet-900/50 bg-violet-950/10 p-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] text-violet-200">
        <BarChart3 className="h-3.5 w-3.5" />
        跨国融资期限与规模结构对比
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        <div>
          <p className="mb-1 text-[9px] text-slate-500">
            期限分布（已读取官方事件数）
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tenorData}
                margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
              >
                <XAxis
                  dataKey="country"
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    fontSize: 10,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="短端" stackId="tenor" fill="#22d3ee" />
                <Bar dataKey="中端" stackId="tenor" fill="#a78bfa" />
                <Bar dataKey="长端" stackId="tenor" fill="#fbbf24" />
                <Bar dataKey="未分类" stackId="tenor" fill="#64748b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[9px] text-slate-500">
            原币种融资规模（仅有规模披露的事件；币种分面）
          </p>
          {currencyPanels.length ? (
            <div className="grid gap-2">
              {currencyPanels.map(panel => (
                <div key={panel.currency} className="h-28">
                  <p className="text-[9px] text-slate-400">{panel.currency}</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={panel.data}
                      margin={{ top: 2, right: 8, left: -18, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="country"
                        tick={{ fill: "#94a3b8", fontSize: 9 }}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 9 }}
                        width={38}
                        tickFormatter={value =>
                          new Intl.NumberFormat("en-US", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(value)
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#020617",
                          border: "1px solid #334155",
                          fontSize: 10,
                        }}
                        formatter={value => [
                          new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: panel.currency,
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(Number(value)),
                          `${panel.currency} 规模`,
                        ]}
                      />
                      <Bar dataKey="amount" fill="#34d399" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          ) : (
            <p className="pt-8 text-center text-[10px] text-slate-500">
              所选官方事件未披露规模，系统不补全或估算。
            </p>
          )}
        </div>
      </div>
      <p className="mt-1 text-[9px] text-slate-500">
        规模图严格按货币分面展示；不同货币的名义金额不直接相加或比较。
      </p>
    </section>
  );
}

function FinancingReminderSettings({ sources }: { sources: CalendarSource[] }) {
  const [draft, setDraft] = useState<{
    eventType: CalendarEventType;
    countryCode: FinancingCountryCode;
    daysBeforeEvent: number;
    isActive: boolean;
  }>({
    eventType: "auction",
    countryCode: "ALL",
    daysBeforeEvent: 2,
    isActive: true,
  });
  const [selectedRuleIds, setSelectedRuleIds] = useState<number[]>([]);
  const [historyFilters, setHistoryFilters] = useState({
    from: "",
    to: "",
    countryCode: "ALL" as FinancingCountryCode,
    status: "all" as "active" | "paused" | "all",
  });
  const historyInput = useMemo(
    () => ({
      limit: 30,
      countryCode: historyFilters.countryCode,
      status: historyFilters.status,
      ...(historyFilters.from ? { from: historyFilters.from } : {}),
      ...(historyFilters.to ? { to: historyFilters.to } : {}),
    }),
    [historyFilters]
  );
  const rulesQuery =
    trpc.sovereignBonds.listFinancingCalendarReminderRules.useQuery(undefined, {
      retry: false,
      refetchOnWindowFocus: false,
    });
  const historyQuery =
    trpc.sovereignBonds.listFinancingCalendarReminderNotificationHistory.useQuery(
      historyInput,
      { retry: false, refetchOnWindowFocus: false }
    );
  const historyExportQuery =
    trpc.sovereignBonds.listFinancingCalendarReminderNotificationHistory.useQuery(
      { ...historyInput, limit: 500 },
      { enabled: false, retry: false }
    );
  const saveRule =
    trpc.sovereignBonds.saveFinancingCalendarReminderRule.useMutation({
      onSuccess: () => rulesQuery.refetch(),
    });
  const deleteRule =
    trpc.sovereignBonds.deleteFinancingCalendarReminderRule.useMutation({
      onSuccess: () => {
        rulesQuery.refetch();
        historyQuery.refetch();
      },
    });
  const setRuleActive =
    trpc.sovereignBonds.setFinancingCalendarReminderRuleActive.useMutation({
      onSuccess: () => {
        rulesQuery.refetch();
        historyQuery.refetch();
      },
    });
  const setRulesActive =
    trpc.sovereignBonds.setFinancingCalendarReminderRulesActive.useMutation({
      onSuccess: () => {
        setSelectedRuleIds([]);
        rulesQuery.refetch();
        historyQuery.refetch();
      },
    });
  const countryName = (countryCode: string) =>
    countryCode === "ALL"
      ? "全部已接入国家"
      : (sources.find(source => source.countryCode === countryCode)?.country ??
        countryCode);
  const rules = (rulesQuery.data?.data ?? []) as ReminderRule[];
  const history = (historyQuery.data?.data ?? []) as ReminderHistory[];
  const toggleRuleSelection = (id: number) =>
    setSelectedRuleIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  const allSelected =
    rules.length > 0 && rules.every(rule => selectedRuleIds.includes(rule.id));
  const exportHistoryCsv = async () => {
    const result = await historyExportQuery.refetch();
    const rows = (result.data?.data ?? []) as ReminderHistory[];
    const quote = (
      value: string | number | boolean | Date | null | undefined
    ) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      "规则编号,国家,事件类型,事件日期,提前天数,规则当前状态,发送时间,官方事件标识",
      ...rows.map(item =>
        [
          item.ruleId,
          countryName(item.countryCode),
          eventTypeLabel[item.eventType],
          item.eventDate,
          item.daysBeforeEvent,
          item.isActive ? "已启用" : "已暂停",
          new Date(item.sentAt).toISOString(),
          item.eventRecordId,
        ]
          .map(quote)
          .join(",")
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financing-reminder-history-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="mb-3 rounded border border-amber-900/50 bg-amber-950/10 p-2">
      <div className="mb-2 flex items-center gap-1 text-[10px] text-amber-100">
        <BellRing className="h-3.5 w-3.5" />
        账户提醒设置
      </div>
      {rulesQuery.isLoading ? (
        <div className="h-12 animate-pulse rounded bg-slate-800" />
      ) : rulesQuery.error ? (
        <p className="text-[10px] text-slate-500">
          登录后可为当前账户设置提醒。提醒仅针对已读取的官方事件，不会根据规律预测未发布发行安排。
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-[10px] text-slate-500">
              事件类型
              <select
                value={draft.eventType}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    eventType: event.target.value as CalendarEventType,
                  }))
                }
                className="mt-1 w-full input-terminal"
              >
                <option value="announcement">发行公告</option>
                <option value="auction">拍卖</option>
                <option value="settlement">交收</option>
              </select>
            </label>
            <label className="text-[10px] text-slate-500">
              国家范围
              <select
                value={draft.countryCode}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    countryCode: event.target.value as FinancingCountryCode,
                  }))
                }
                className="mt-1 w-full input-terminal"
              >
                <option value="ALL">全部已接入国家</option>
                {sources
                  .filter(source =>
                    ["US", "DE", "GB", "JP", "FR", "IT"].includes(
                      source.countryCode
                    )
                  )
                  .map(source => (
                    <option key={source.countryCode} value={source.countryCode}>
                      {source.country}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-[10px] text-slate-500">
              提前天数
              <input
                type="number"
                min={1}
                max={90}
                value={draft.daysBeforeEvent}
                onChange={event => {
                  const daysBeforeEvent = Math.min(
                    90,
                    Math.max(1, Number(event.target.value) || 1)
                  );
                  setDraft(current => ({ ...current, daysBeforeEvent }));
                }}
                className="mt-1 w-full input-terminal"
              />
            </label>
            <button
              type="button"
              disabled={saveRule.isPending}
              onClick={() => saveRule.mutate(draft)}
              className="mt-4 inline-flex h-7 items-center justify-center gap-1 rounded border border-amber-700 px-2 text-[10px] text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
            >
              <BellRing className="h-3 w-3" />
              {saveRule.isPending ? "保存中" : "保存规则"}
            </button>
          </div>
          {saveRule.error && (
            <p className="mt-1 text-[10px] text-rose-300">
              保存失败：{saveRule.error.message}
            </p>
          )}
          <div className="mt-2 space-y-1">
            {rules.length ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-950/30 px-2 py-1 text-[9px]">
                  <label className="inline-flex items-center gap-1 text-slate-400">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelectedRuleIds(
                          allSelected ? [] : rules.map(rule => rule.id)
                        )
                      }
                      className="accent-amber-500"
                    />
                    全选{" "}
                    {selectedRuleIds.length
                      ? `(${selectedRuleIds.length})`
                      : ""}
                  </label>
                  <button
                    type="button"
                    disabled={
                      !selectedRuleIds.length || setRulesActive.isPending
                    }
                    onClick={() =>
                      setRulesActive.mutate({
                        ids: selectedRuleIds,
                        isActive: false,
                      })
                    }
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-200 disabled:opacity-50"
                  >
                    <Pause className="h-3 w-3" />
                    批量暂停
                  </button>
                  <button
                    type="button"
                    disabled={
                      !selectedRuleIds.length || setRulesActive.isPending
                    }
                    onClick={() =>
                      setRulesActive.mutate({
                        ids: selectedRuleIds,
                        isActive: true,
                      })
                    }
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-200 disabled:opacity-50"
                  >
                    <Play className="h-3 w-3" />
                    批量恢复
                  </button>
                </div>
                {rules.map(rule => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[10px]"
                  >
                    <label className="inline-flex min-w-0 items-center gap-2 text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedRuleIds.includes(rule.id)}
                        onChange={() => toggleRuleSelection(rule.id)}
                        className="accent-amber-500"
                      />
                      <span>
                        {countryName(rule.countryCode)} ·{" "}
                        {eventTypeLabel[rule.eventType]} · 提前{" "}
                        <b className="text-amber-200">{rule.daysBeforeEvent}</b>{" "}
                        天 · {rule.isActive ? "已启用" : "已暂停"}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRuleActive.mutate({
                            id: rule.id,
                            isActive: !rule.isActive,
                          })
                        }
                        disabled={setRuleActive.isPending}
                        title={rule.isActive ? "暂停提醒规则" : "恢复提醒规则"}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-200 disabled:opacity-50"
                      >
                        {rule.isActive ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {rule.isActive ? "暂停" : "恢复"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRule.mutate({ id: rule.id })}
                        disabled={deleteRule.isPending}
                        title="删除提醒规则"
                        className="text-slate-500 hover:text-rose-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[10px] text-slate-500">
                尚未保存提醒规则。设置后将由既有小时扫描在提醒窗口内写入账户通知中心。
              </p>
            )}
          </div>
          <div className="mt-3 border-t border-amber-900/40 pt-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-amber-100">
              <span className="inline-flex items-center gap-1">
                <History className="h-3.5 w-3.5" />
                历史发送记录
              </span>
              <button
                type="button"
                onClick={exportHistoryCsv}
                disabled={historyExportQuery.isFetching}
                className="inline-flex items-center gap-1 rounded border border-amber-800 px-1.5 py-0.5 text-[9px] text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {historyExportQuery.isFetching ? "准备中" : "导出 CSV"}
              </button>
            </div>
            <div className="mb-2 grid gap-1 sm:grid-cols-4">
              <label className="text-[9px] text-slate-500">
                事件起日
                <input
                  type="date"
                  value={historyFilters.from}
                  onChange={event =>
                    setHistoryFilters(current => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                  className="mt-0.5 w-full input-terminal"
                />
              </label>
              <label className="text-[9px] text-slate-500">
                事件止日
                <input
                  type="date"
                  value={historyFilters.to}
                  onChange={event =>
                    setHistoryFilters(current => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                  className="mt-0.5 w-full input-terminal"
                />
              </label>
              <label className="text-[9px] text-slate-500">
                国家
                <select
                  value={historyFilters.countryCode}
                  onChange={event =>
                    setHistoryFilters(current => ({
                      ...current,
                      countryCode: event.target.value as FinancingCountryCode,
                    }))
                  }
                  className="mt-0.5 w-full input-terminal"
                >
                  <option value="ALL">全部国家</option>
                  {sources
                    .filter(source =>
                      ["US", "DE", "GB", "JP", "FR", "IT"].includes(
                        source.countryCode
                      )
                    )
                    .map(source => (
                      <option
                        key={source.countryCode}
                        value={source.countryCode}
                      >
                        {source.country}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-[9px] text-slate-500">
                规则状态
                <select
                  value={historyFilters.status}
                  onChange={event =>
                    setHistoryFilters(current => ({
                      ...current,
                      status: event.target.value as "active" | "paused" | "all",
                    }))
                  }
                  className="mt-0.5 w-full input-terminal"
                >
                  <option value="all">全部状态</option>
                  <option value="active">当前启用</option>
                  <option value="paused">当前暂停</option>
                </select>
              </label>
            </div>
            {historyQuery.isLoading ? (
              <div className="h-9 animate-pulse rounded bg-slate-800" />
            ) : historyQuery.error ? (
              <p className="text-[10px] text-slate-500">
                登录后可查看当前账户的提醒发送记录。
              </p>
            ) : history.length ? (
              <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[9px] text-slate-400"
                  >
                    <span className="text-slate-200">
                      {countryName(item.countryCode)} ·{" "}
                      {eventTypeLabel[item.eventType]} ·{" "}
                      {new Date(item.eventDate).toLocaleDateString()}
                    </span>
                    <span className="ml-2">提前 {item.daysBeforeEvent} 天</span>
                    <span
                      className={`ml-2 ${item.isActive ? "text-emerald-200" : "text-amber-200"}`}
                    >
                      {item.isActive ? "规则已启用" : "规则已暂停"}
                    </span>
                    <span className="ml-2">
                      发送于 {new Date(item.sentAt).toLocaleString()}
                    </span>
                    <div className="mt-0.5 break-all font-mono text-slate-600">
                      {item.eventRecordId}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">
                当前筛选条件下没有已发送记录。仅当规则在有效提醒窗口内命中已发布的官方事件时才会追加记录。
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function SovereignFinancingCalendar({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data: CalendarData | undefined;
  isLoading: boolean;
  error: { message: string } | null;
  onRetry: () => void;
}) {
  const [countryCodes, setCountryCodes] = useState<string[]>([
    "US",
    "DE",
    "GB",
    "JP",
    "FR",
    "IT",
  ]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bondType, setBondType] = useState("");
  const [isinQuery, setIsinQuery] = useState("");
  const [future30Only, setFuture30Only] = useState(true);
  const [webcalStatus, setWebcalStatus] = useState("");
  const [copiedIsinRecordId, setCopiedIsinRecordId] = useState<string | null>(
    null
  );
  const [isinCopyErrorRecordId, setIsinCopyErrorRecordId] = useState<
    string | null
  >(null);
  const sources = data?.sources ?? [];
  const records = data?.records ?? [];
  const futureWindow = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }, []);
  const bondTypes = useMemo(
    () =>
      [
        ...new Set(
          records
            .filter(record => countryCodes.includes(record.countryCode))
            .map(record => record.securityType)
            .filter(Boolean)
        ),
      ].sort(),
    [countryCodes, records]
  );
  const rows = useMemo(
    () =>
      records.filter(
        record =>
          countryCodes.includes(record.countryCode) &&
          record.auctionDate >= futureWindow.from &&
          (!from || record.auctionDate >= from) &&
          (!to || record.auctionDate <= to) &&
          (!future30Only || record.auctionDate <= futureWindow.to) &&
          (!bondType || record.securityType === bondType) &&
          (!isinQuery ||
            (record.isin ?? "").includes(isinQuery.trim().toUpperCase()))
      ),
    [
      records,
      countryCodes,
      from,
      to,
      future30Only,
      futureWindow,
      bondType,
      isinQuery,
    ]
  );
  const selectedSources = sources.filter(source =>
    countryCodes.includes(source.countryCode)
  );
  const toggleCountry = (countryCode: string) =>
    setCountryCodes(current =>
      current.includes(countryCode)
        ? current.filter(value => value !== countryCode)
        : [...current, countryCode]
    );
  const reset = () => {
    setCountryCodes(["US", "DE", "GB", "JP", "FR", "IT"]);
    setFrom("");
    setTo("");
    setBondType("");
    setIsinQuery("");
    setFuture30Only(true);
    setWebcalStatus("");
  };
  const currencyAmount = (record: CalendarRecord) =>
    record.offeringAmount === null
      ? "—"
      : new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
          style: "currency",
          currency: record.currency,
        }).format(record.offeringAmount);
  const icsHref = `/api/sovereign-financing-calendar.ics?countries=${encodeURIComponent(countryCodes.join(","))}`;
  const webcalHref =
    typeof window === "undefined"
      ? icsHref
      : `webcal://${window.location.host}${icsHref}`;
  const copyWebcal = async () => {
    try {
      await navigator.clipboard.writeText(webcalHref);
      setWebcalStatus("WebCal 链接已复制。");
    } catch {
      setWebcalStatus("浏览器未授予剪贴板权限；请复制下方链接。");
    }
  };
  const copyIsin = async (recordId: string, isin: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(isin);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = isin;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(fallback);
        if (!copied) throw new Error("clipboard-fallback-failed");
      }
      setCopiedIsinRecordId(recordId);
      setIsinCopyErrorRecordId(null);
    } catch {
      setCopiedIsinRecordId(null);
      setIsinCopyErrorRecordId(recordId);
    }
  };
  const officialSecurityHref = (record: CalendarRecord) =>
    record.countryCode === "GB" &&
    record.isin &&
    /^https:\/\/www\.dmo\.gov\.uk\//.test(record.sourceUrl)
      ? record.sourceUrl
      : null;
  return (
    <div className="space-y-3">
      <Card title="已公布的未来融资排期">
        <div className="mb-2 rounded border border-emerald-900/50 bg-emerald-950/10 px-2 py-1.5 text-[10px] text-emerald-100">
          本页只保留今天起已经公布的发行公告、拍卖和交收排期；已完成场次的需求与定价结果请在“官方拍卖”查看。
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="min-w-64 rounded border border-slate-800 bg-slate-950/50 p-2">
            <p className="mb-1 text-[10px] text-slate-500">国家（可多选）</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {sources.map(source => (
                <label
                  key={source.countryCode}
                  className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={countryCodes.includes(source.countryCode)}
                    onChange={() => toggleCountry(source.countryCode)}
                    className="accent-cyan-500"
                  />
                  {source.country}
                </label>
              ))}
            </div>
          </div>
          <label className="text-[10px] text-slate-500">
            起始日
            <input
              type="date"
              min={futureWindow.from}
              value={from}
              onChange={event => setFrom(event.target.value)}
              className="mt-1 input-terminal"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            结束日
            <input
              type="date"
              min={futureWindow.from}
              value={to}
              onChange={event => setTo(event.target.value)}
              className="mt-1 input-terminal"
            />
          </label>
          <label className="text-[10px] text-slate-500">
            债券类型
            <select
              value={bondType}
              onChange={event => setBondType(event.target.value)}
              className="mt-1 input-terminal"
            >
              <option value="">全部类型</option>
              {bondTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-slate-500">
            ISIN
            <input
              value={isinQuery}
              onChange={event => setIsinQuery(event.target.value.toUpperCase())}
              placeholder="例如 GB00..."
              maxLength={12}
              className="mt-1 w-28 font-mono input-terminal"
            />
          </label>
          <button
            type="button"
            onClick={() => setFuture30Only(value => !value)}
            className={`mt-4 inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] ${future30Only ? "border-emerald-700 bg-emerald-950/40 text-emerald-100" : "border-slate-700 text-slate-300 hover:border-emerald-800"}`}
          >
            <CalendarDays className="h-3 w-3" />
            {future30Only ? "未来 30 天" : "全部已公布排期"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-[10px] text-slate-300 hover:border-cyan-800"
          >
            <RotateCcw className="h-3 w-3" />
            重置
          </button>
          <a
            href={icsHref}
            download
            className="mt-4 inline-flex h-7 items-center gap-1 rounded border border-cyan-800 px-2 text-[10px] text-cyan-200 hover:bg-cyan-950/60"
          >
            <Download className="h-3 w-3" />
            下载 ICS
          </a>
        </div>
        <div className="mb-3 rounded border border-cyan-900/50 bg-cyan-950/10 p-2 text-[10px]">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={webcalHref}
              className="inline-flex h-7 items-center gap-1 rounded border border-cyan-700 px-2 text-cyan-100 hover:bg-cyan-950/70"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              订阅 WebCal
            </a>
            <button
              type="button"
              onClick={copyWebcal}
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-700 px-2 text-slate-300 hover:border-cyan-800"
            >
              <Clipboard className="h-3 w-3" />
              复制链接
            </button>
            {webcalStatus && (
              <span className="inline-flex items-center gap-1 text-emerald-200">
                <Check className="h-3 w-3" />
                {webcalStatus}
              </span>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-[9px] text-slate-500">
            {webcalHref}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            在系统日历中选择“通过 URL
            订阅”并粘贴该链接。订阅会按所选国家读取同一官方事件端点，服务端缓存最长五分钟。
          </p>
        </div>
        <FinancingReminderSettings sources={sources} />
        <div className="mb-3 grid gap-1.5 lg:grid-cols-2">
          {selectedSources.map(source => (
            <div
              key={source.countryCode}
              className={`rounded border px-2 py-1.5 text-[10px] ${statusStyle(source.status)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <b>
                  {source.country}
                </b>
                <span
                 
                  
                 
                  title="打开官方来源"
                  className="shrink-0 hover:text-cyan-200"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-0.5 opacity-80">{source.limitation}</p>
            </div>
          ))}
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 animate-pulse rounded bg-slate-800" />
            <div className="h-8 animate-pulse rounded bg-slate-800" />
          </div>
        ) : error ? (
          <p className="rounded border border-rose-900/60 bg-rose-950/20 p-2 text-[11px] text-rose-300">
            官方融资日历暂不可读取：{error.message}
            <button
              type="button"
              onClick={onRetry}
              className="ml-2 text-cyan-300 underline"
            >
              重试
            </button>
          </p>
        ) : (
          <>
            <FinancingStructureComparison
              records={rows}
              countryCodes={countryCodes}
              sources={sources}
            />
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-500">
                      <th className="p-1.5">国家 / 事件日</th>
                      <th>事项</th>
                      <th>类型 / 期限</th>
                      <th>ISIN</th>
                      <th>发行日 / 到期日</th>
                      <th className="text-right">规模</th>
                      <th className="text-right">票面利率</th>
                      
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(record => {
                      const officialHref = officialSecurityHref(record);
                      return (
                        <tr
                          key={record.id}
                          className="border-b border-slate-800/60"
                          title={`${record.country} · ${record.securityType} · ${record.auctionDate}`}
                        >
                          <td className="p-1.5">
                            <b className="text-cyan-300">{record.country}</b>
                            <div className="font-mono text-slate-300">
                              {record.auctionDate}
                            </div>
                          </td>
                          <td>
                            <span className="rounded border border-amber-900/60 px-1 py-0.5 text-[9px] text-amber-200">
                              {eventTypeLabel[record.eventType]}
                            </span>
                          </td>
                          <td>
                            <div className="text-slate-200">
                              {record.securityType}
                            </div>
                            <div className="text-slate-500">
                              {record.securityTerm ?? "期限待披露"}
                            </div>
                          </td>
                          <td className="font-mono text-[10px] text-violet-200">
                            {record.isin ? (
                              <div className="flex min-w-36 items-center gap-1">
                                <span>{record.isin}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void copyIsin(record.id, record.isin!)
                                  }
                                  title={`复制 ISIN ${record.isin}`}
                                  aria-label={`复制 ISIN ${record.isin}`}
                                  className="rounded p-0.5 text-violet-300 transition hover:bg-violet-950/70 hover:text-violet-100 focus:outline-none focus:ring-1 focus:ring-violet-400"
                                >
                                  {copiedIsinRecordId === record.id ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Clipboard className="h-3 w-3" />
                                  )}
                                </button>
                                {officialHref && (
                                  <span
                                   
                                    
                                   
                                    title={`打开英国 DMO 官方证券资料：${record.isin}`}
                                    aria-label={`打开英国 DMO 官方证券资料：ISIN ${record.isin}`}
                                    className="rounded p-0.5 text-cyan-400 transition hover:bg-cyan-950/70 hover:text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </span>
                                )}
                                <span aria-live="polite" className="sr-only">
                                  {copiedIsinRecordId === record.id
                                    ? `ISIN ${record.isin} 已复制`
                                    : isinCopyErrorRecordId === record.id
                                      ? "ISIN 复制失败，请手动复制"
                                      : ""}
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-slate-500">
                            {record.issueDate ?? "—"} /{" "}
                            {record.maturityDate ?? "—"}
                          </td>
                          <td className="text-right font-mono text-slate-200">
                            {currencyAmount(record)}
                          </td>
                          <td className="text-right font-mono text-amber-300">
                            {record.couponRate === null
                              ? "—"
                              : `${record.couponRate.toFixed(3)}%`}
                          </td>
                          
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px] text-slate-500">
                <Filter className="mr-1 inline h-3.5 w-3.5" />
                当前组合筛选没有可展示的官方融资记录。未有结构化数据的国家保持来源状态，不以规律或推测填充。
              </p>
            )}
          </>
        )}
        <p className="mt-2 text-[9px] text-slate-600">
          <CalendarDays className="mr-1 inline h-3 w-3" />
          读取时间：
          {data?.timestamp ? new Date(data.timestamp).toLocaleString() : "—"}
          。ICS/WebCal
          仅包含已读取的一级市场官方事件与来源链接，不代表二级市场可成交报价。
        </p>
      </Card>
    </div>
  );
}
