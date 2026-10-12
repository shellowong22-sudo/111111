import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw, Rocket, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type View = "calendar" | "performance" | "lockup" | "stats";
const views: Array<{ id: View; label: string }> = [
  { id: "calendar", label: "IPO日历" },
  { id: "performance", label: "上市表现" },
  { id: "lockup", label: "锁定期" },
  { id: "stats", label: "统计分析" },
];
const control =
  "h-7 border border-slate-700 bg-black px-2 text-[10px] text-slate-200";

export default function IPOPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<View>("calendar");
  const [query, setQuery] = useState("RDDT");
  const [cik, setCik] = useState("");
  const issuerSearch = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query, limit: 6 },
    {
      enabled: query.trim().length >= 2,
      staleTime: 6 * 60 * 60 * 1000,
      retry: false,
    }
  );
  useEffect(() => {
    const exact = issuerSearch.data?.results?.find(
      (item: any) => item.ticker?.toUpperCase() === query.trim().toUpperCase()
    );
    if (!cik && exact?.cik) setCik(exact.cik);
  }, [issuerSearch.data, query, cik]);
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000, retry: false }
  );
  const ticker = String((filings.data?.issuer as any)?.tickers?.[0] ?? query)
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, "")
    .slice(0, 15);
  const observation = trpc.stockMarketResearch.getTickerObservation.useQuery(
    { ticker: ticker || "INVALID", range: "1y", assetClass: "stocks" },
    {
      enabled: Boolean(cik && ticker),
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnReconnect: true,
      retry: false,
    }
  );
  const registrationRows = useMemo(
    () =>
      ((filings.data?.filings ?? []) as any[]).filter(item =>
        ["S-1", "S-1/A", "424B2", "424B3", "424B5"].includes(item.form)
      ),
    [filings.data]
  );
  const formCounts = useMemo(() => {
    const map = new Map<string, number>();
    registrationRows.forEach(item =>
      map.set(item.form, (map.get(item.form) ?? 0) + 1)
    );
    return [...map].map(([form, count]) => ({ form, count }));
  }, [registrationRows]);
  const history = (observation.data?.observation?.history ?? []) as Array<{
    date: string;
    value: number;
  }>;
  const loading =
    issuerSearch.isFetching || filings.isFetching || observation.isFetching;

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-black font-mono text-xs text-emerald-300"
      aria-label="IPO 股票发行"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-emerald-950 px-2 py-2">
        <Rocket className="h-4 w-4 text-blue-300" />
        <b className="text-blue-300">IPO</b>
        <span className="text-emerald-600">
          IPO日历 · 定价分析 · 上市表现 · 锁定期追踪
        </span>
        <span role="status" className="text-[10px] text-slate-500">
          {loading
            ? "正在读取"
            : cik
              ? `${ticker} · CIK ${cik}`
              : "等待 SEC 主体"}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="关闭 IPO"
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
          发行主体、代码或 CIK
          <input
            aria-label="IPO 主体检索"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setCik("");
            }}
            className={`${control} ml-2 w-52`}
          />
        </label>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {(issuerSearch.data?.results ?? []).map((item: any) => (
            <button
              type="button"
              key={item.cik}
              onClick={() => setCik(item.cik)}
              className={`${control} ${cik === item.cik ? "border-blue-500 text-blue-200" : ""}`}
            >
              {item.ticker || item.name} · {item.cik}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${control} inline-flex items-center gap-1`}
          onClick={() => {
            void issuerSearch.refetch();
            void filings.refetch();
            void observation.refetch();
          }}
        >
          <RefreshCw className="h-3 w-3" />
          刷新
        </button>
      </div>
      <nav
        role="tablist"
        aria-label="IPO 原功能"
        className="flex overflow-x-auto border-b border-emerald-950"
      >
        {views.map(view => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === view.id}
            key={view.id}
            onClick={() => setActiveTab(view.id)}
            className={`border-r border-slate-800 px-3 py-2 text-[10px] ${activeTab === view.id ? "border-b-2 border-b-blue-400 text-blue-200" : "text-emerald-700"}`}
          >
            {view.label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "calendar" && (
          <>
            <p className="border-b border-slate-800 p-2 text-[10px] text-slate-500">
              公开申报时间线。SEC
              未提供未来上市排期时，本页不生成“即将上市”日期。
            </p>
            <FilingTable
              rows={registrationRows}
              cik={cik}
              empty={
                cik
                  ? "当前 SEC 近期目录没有支持的注册/招股表单。"
                  : "选择真实发行主体后读取。"
              }
            />
          </>
        )}
        {activeTab === "performance" && (
          <div className="grid min-h-[430px] grid-cols-1 lg:grid-cols-[minmax(320px,.75fr)_minmax(0,1.25fr)]">
            <table className="h-fit w-full text-left text-[10px]">
              <tbody>
                {[
                  ["证券", ticker || "—"],
                  [
                    "公共日频末值",
                    observation.data?.observation?.price == null
                      ? "—"
                      : `${Number(observation.data.observation.price).toFixed(4)} ${observation.data.observation.currency ?? ""}`,
                  ],
                  [
                    "观察日",
                    observation.data?.observation?.observationDate ?? "—",
                  ],
                  ["历史点数", history.length],
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border-b border-slate-800">
                    <th className="p-2 font-normal text-slate-500">{label}</th>
                    <td className="p-2 text-slate-200">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="h-[420px] border-t border-slate-800 p-2 lg:border-l lg:border-t-0">
              {history.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid stroke="#052e16" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="date"
                      minTickGap={24}
                      tick={{ fill: "#6ee7b7", fontSize: 9 }}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#6ee7b7", fontSize: 9 }}
                    />
                    <Tooltip />
                    <Line
                      dataKey="value"
                      name="公共日频价格"
                      stroke="#60a5fa"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p role="status" className="p-4 text-slate-500">
                  当前没有可读价格历史；不显示固定当前价或模拟回报。
                </p>
              )}
            </div>
          </div>
        )}
        {activeTab === "lockup" && (
          <>
            <p className="border-b border-slate-800 p-2 text-[10px] leading-5 text-slate-500">
              锁定期条款必须来自招股文件正文并保留条款证据。当前接口只返回 SEC
              主文件元数据，因此不从上市日机械加 180
              天，也不显示“已过/未到”的假判断。
            </p>
            <table className="w-full min-w-[720px] text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  {[
                    "申报日",
                    "表单",
                    "主文件",
                    "访问编号",
                  ].map(label => (
                    <th key={label} className="p-2 font-normal">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registrationRows.map(item => (
                  <tr
                    key={item.accessionNumber}
                    className="border-t border-slate-800"
                  >
                    <td className="p-2">{item.filingDate ?? "—"}</td>
                    <td className="text-blue-300">{item.form}</td>
                    <td>{item.primaryDocument ?? "—"}</td>
                    <td className="text-slate-500">
                      {item.accessionNumber ?? "—"}
                    </td>
                  </tr>
                ))}
                {!registrationRows.length && (
                  <tr>
                    <td colSpan={4} className="p-5 text-center text-slate-500">
                      没有注册文件。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
        {activeTab === "stats" && (
          <div className="grid min-h-[430px] grid-cols-1 lg:grid-cols-[minmax(320px,.65fr)_minmax(0,1.35fr)]">
            <FilingTable
              rows={registrationRows}
              cik={cik}
              empty="没有可统计的实际注册申报。"
            />
            <div className="h-[420px] border-t border-slate-800 p-2 lg:border-l lg:border-t-0">
              {formCounts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formCounts}>
                    <CartesianGrid stroke="#052e16" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="form"
                      tick={{ fill: "#6ee7b7", fontSize: 9 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#6ee7b7", fontSize: 9 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="实际申报数"
                      fill="#3b82f6"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p role="status" className="p-4 text-slate-500">
                  取得实际注册申报后显示表单分布。
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <footer className="border-t border-emerald-950 px-2 py-1.5 text-[9px] leading-5 text-slate-500">
        价格为日线收盘。
        {filings.data?.sourceBoundary ? ` ${filings.data.sourceBoundary}` : ""}
      </footer>
    </section>
  );
}

function FilingTable({
  rows,
  cik,
  empty,
}: {
  rows: any[];
  cik: string;
  empty: string;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[680px] text-left text-[10px]">
        <thead className="text-slate-500">
          <tr>
            {["申报日", "表单", "主文件", "CIK", "访问编号"].map(label => (
              <th key={label} className="p-2 font-normal">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(item => (
            <tr
              key={`${item.accessionNumber}-${item.primaryDocument}`}
              className="border-t border-slate-800"
            >
              <td className="p-2">{item.filingDate ?? "—"}</td>
              <td className="text-blue-300">{item.form}</td>
              <td>{item.primaryDocument ?? "—"}</td>
              <td>{cik || "—"}</td>
              <td className="text-slate-500">{item.accessionNumber ?? "—"}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="p-5 text-center text-amber-200">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
