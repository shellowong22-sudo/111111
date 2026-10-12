import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  onClose?: () => void;
}
type Tab = "calendar" | "surprise";

const control =
  "h-7 border border-slate-700 bg-black px-2 text-[10px] text-slate-200";

export default function CACTPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("calendar");
  const [query, setQuery] = useState("AAPL");
  const [cik, setCik] = useState("");
  const [form, setForm] = useState("ALL");
  const issuers = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query, limit: 6 },
    {
      enabled: query.trim().length >= 2,
      staleTime: 6 * 60 * 60 * 1000,
      retry: false,
    }
  );
  useEffect(() => {
    const exact = issuers.data?.results?.find(
      (item: any) => item.ticker?.toUpperCase() === query.trim().toUpperCase()
    );
    if (!cik && exact?.cik) setCik(exact.cik);
  }, [issuers.data, query, cik]);
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000, retry: false }
  );
  const facts = trpc.stockMarketResearch.getCompanyFacts.useQuery(
    { cik: cik || "0" },
    {
      enabled: Boolean(cik) && tab === "surprise",
      staleTime: 5 * 60_000,
      retry: false,
    }
  );
  const issuer = filings.data?.issuer as any;
  const allEvents = useMemo(
    () =>
      ((filings.data?.filings ?? []) as any[]).filter(item =>
        ["8-K", "10-K", "10-Q", "DEFM14A"].includes(item.form)
      ),
    [filings.data]
  );
  const events =
    form === "ALL" ? allEvents : allEvents.filter(item => item.form === form);
  const monthRows = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach(item => {
      const month = String(item.filingDate ?? "").slice(0, 7);
      if (month) counts.set(month, (counts.get(month) ?? 0) + 1);
    });
    return [...counts]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [events]);
  const epsMetric = (facts.data?.metrics ?? []).find(
    (item: any) => item.id === "EarningsPerShareDiluted"
  ) as any;
  const epsRows = ((epsMetric?.observations ?? []) as any[])
    .filter(item => ["annual", "quarter"].includes(item.periodType))
    .slice(-24)
    .reverse();
  const loading = issuers.isFetching || filings.isFetching || facts.isFetching;

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#080d16] text-xs text-slate-200"
      aria-label="CACT 企业大事件日历"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-2 py-2">
        <Calendar className="h-4 w-4 text-orange-300" />
        <b className="font-mono text-orange-300">CACT</b>
        <span>企业大事件日历</span>
        <span role="status" className="text-[10px] text-slate-500">
          {loading
            ? "正在读取 SEC"
            : cik
              ? `${issuer?.name ?? query} · CIK ${cik}`
              : "等待主体"}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="关闭 CACT"
            onClick={onClose}
            className="ml-auto p-1 text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      <div
        role="toolbar"
        className="flex flex-wrap items-end gap-2 border-b border-slate-800 p-2"
      >
        <label className="text-[10px] text-slate-500">
          公司、代码或 CIK
          <input
            aria-label="CACT 主体检索"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setCik("");
            }}
            className={`${control} ml-2 w-52`}
          />
        </label>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {(issuers.data?.results ?? []).map((item: any) => (
            <button
              type="button"
              key={item.cik}
              onClick={() => setCik(item.cik)}
              className={`${control} ${cik === item.cik ? "border-orange-500 text-orange-200" : ""}`}
            >
              {item.ticker || item.name} · {item.cik}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            void issuers.refetch();
            void filings.refetch();
            void facts.refetch();
          }}
          className={`${control} inline-flex items-center gap-1`}
        >
          <RefreshCw className="h-3 w-3" />
          刷新
        </button>
      </div>
      <nav
        role="tablist"
        aria-label="CACT 原功能"
        className="flex border-b border-slate-800"
      >
        {(["calendar", "surprise"] as Tab[]).map(value => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            key={value}
            onClick={() => setTab(value)}
            className={`border-r border-slate-800 px-3 py-2 text-[10px] ${tab === value ? "border-b-2 border-b-orange-400 text-orange-200" : "text-slate-500"}`}
          >
            {value === "calendar" ? "事件日历" : "历史 EPS"}
          </button>
        ))}
      </nav>
      {tab === "calendar" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
          <div className="min-h-0 overflow-auto border-b border-slate-800 lg:border-b-0 lg:border-r">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-[#080d16] p-2">
              <label className="text-[10px] text-slate-500">
                表单
                <select
                  aria-label="CACT 表单筛选"
                  value={form}
                  onChange={event => setForm(event.target.value)}
                  className={`${control} ml-2`}
                >
                  <option value="ALL">全部事件表单</option>
                  {["8-K", "10-K", "10-Q", "DEFM14A"].map(value => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <span>{events.length} 条实际申报</span>
            </div>
            <table className="w-full min-w-[680px] text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  {[
                    "申报日",
                    "表单",
                    "主体",
                    "主文件",
                    "访问编号",
                    "事件口径",
                  ].map(label => (
                    <th key={label} className="p-2 font-normal">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(item => (
                  <tr
                    key={`${item.accessionNumber}-${item.primaryDocument}`}
                    className="border-t border-slate-800"
                  >
                    <td className="p-2">{item.filingDate ?? "—"}</td>
                    <td className="font-mono text-orange-200">{item.form}</td>
                    <td>{issuer?.tickers?.[0] ?? query}</td>
                    <td>{item.primaryDocument ?? "—"}</td>
                    <td className="font-mono text-slate-500">
                      {item.accessionNumber ?? "—"}
                    </td>
                    <td>
                      {item.form === "8-K"
                        ? "重大事项申报"
                        : item.form === "DEFM14A"
                          ? "股东会议/委托书"
                          : "定期财务申报"}
                    </td>
                  </tr>
                ))}
                {!events.length && (
                  <tr>
                    <td colSpan={6} className="p-5 text-center text-amber-200">
                      {cik
                        ? "该主体暂无匹配的申报事件。"
                        : "请选择真实 SEC 主体；不显示预置事件。"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="min-h-0 p-2">
            <p className="border-b border-slate-800 pb-2 text-[10px] text-slate-500">
              近 12 个有记录月份的实际申报数量
            </p>
            <div className="h-[360px]">
              {monthRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthRows}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="申报数"
                      fill="#fb923c"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p role="status" className="p-4 text-slate-500">
                  取得实际申报后显示月度分布。
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] text-left text-[10px]">
            <thead className="text-slate-500">
              <tr>
                {[
                  "报告期",
                  "期间类型",
                  "实际稀释 EPS",
                  "单位",
                  "表单",
                  "申报日",
                ].map(label => (
                  <th key={label} className="p-2 font-normal">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {epsRows.map(row => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="p-2">{row.end}</td>
                  <td>{row.periodType === "annual" ? "年度" : "季度"}</td>
                  <td className="font-mono text-cyan-200">
                    {Number(row.value).toLocaleString()}
                  </td>
                  <td>{epsMetric?.unit ?? "—"}</td>
                  <td>{row.form}</td>
                  <td>{row.filed ?? "—"}</td>
                </tr>
              ))}
              {!epsRows.length && (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-amber-200">
                    {cik
                      ? "当前 SEC XBRL 未返回可用稀释 EPS。"
                      : "请选择主体后读取实际 EPS。"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <footer className="border-t border-slate-800 px-2 py-1.5 text-[9px] leading-5 text-slate-500">
        日历是公开申报时间线，不是交易所财报预约日历；不推断影响等级、EPS
        预期、期权到期或交易信号。
        {filings.data?.sourceBoundary ? ` ${filings.data.sourceBoundary}` : ""}
      </footer>
    </section>
  );
}
