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
import { FileSearch, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type View = "search" | "detail" | "stats" | "history";
type Filing = {
  form: string;
  filingDate: string | null;
  accessionNumber: string | null;
  primaryDocument: string | null;
  category?: string;
};
const views: Array<{ id: View; label: string }> = [
  { id: "search", label: "全文检索" },
  { id: "detail", label: "文档详情" },
  { id: "stats", label: "文档统计" },
  { id: "history", label: "搜索历史" },
];
const control =
  "h-7 border border-slate-700 bg-black px-2 text-[10px] text-slate-200";

export default function DSPanel({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<View>("search");
  const [issuerText, setIssuerText] = useState("AAPL");
  const [cik, setCik] = useState("");
  const [keyword, setKeyword] = useState("risk");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState("ALL");
  const [history, setHistory] = useState<
    Array<{
      at: string;
      cik: string;
      form: string;
      keyword: string;
      document: string;
    }>
  >([]);
  const issuers = trpc.stockMarketResearch.searchIssuers.useQuery(
    { query: issuerText, limit: 6 },
    {
      enabled: issuerText.trim().length >= 2,
      staleTime: 6 * 60 * 60 * 1000,
      retry: false,
    }
  );
  useEffect(() => {
    const exact = issuers.data?.results?.find(
      (item: any) =>
        item.ticker?.toUpperCase() === issuerText.trim().toUpperCase()
    );
    if (!cik && exact?.cik) setCik(exact.cik);
  }, [issuers.data, issuerText, cik]);
  const filings = trpc.stockMarketResearch.getIssuerFilings.useQuery(
    { cik: cik || "0" },
    { enabled: Boolean(cik), staleTime: 60_000, retry: false }
  );
  const rows = useMemo(
    () =>
      ((filings.data?.filings ?? []) as Filing[]).filter(
        item => form === "ALL" || item.form === form
      ),
    [filings.data, form]
  );
  const selected =
    rows.find(
      item => `${item.accessionNumber}:${item.primaryDocument}` === selectedKey
    ) ??
    rows[0] ??
    null;
  useEffect(() => {
    if (
      selected &&
      !rows.some(
        item =>
          `${item.accessionNumber}:${item.primaryDocument}` === selectedKey
      )
    )
      setSelectedKey(`${selected.accessionNumber}:${selected.primaryDocument}`);
  }, [rows, selected, selectedKey]);
  const excerpt = trpc.stockMarketResearch.getFilingExcerpt.useQuery(
    {
      cik: cik || "0",
      accessionNumber: selected?.accessionNumber ?? "0000000000",
      primaryDocument: selected?.primaryDocument ?? "missing.htm",
      keyword: submittedKeyword || "__",
    },
    {
      enabled: Boolean(
        cik &&
        selected?.accessionNumber &&
        selected?.primaryDocument &&
        submittedKeyword.length >= 2
      ),
      staleTime: 60_000,
      retry: false,
    }
  );
  const formCounts = useMemo(() => {
    const map = new Map<string, number>();
    ((filings.data?.filings ?? []) as Filing[]).forEach(item =>
      map.set(item.form, (map.get(item.form) ?? 0) + 1)
    );
    return [...map]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filings.data]);
  const submitSearch = () => {
    const next = keyword.trim().slice(0, 80);
    if (next.length < 2 || !selected) return;
    setSubmittedKeyword(next);
    setHistory(current =>
      [
        {
          at: new Date().toISOString(),
          cik,
          form: selected.form,
          keyword: next,
          document: selected.primaryDocument ?? "—",
        },
        ...current,
      ].slice(0, 30)
    );
  };
  const loading =
    issuers.isFetching || filings.isFetching || excerpt.isFetching;

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden bg-black font-mono text-xs text-emerald-300"
      aria-label="DS 文件检索"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-emerald-950 px-2 py-2">
        <FileSearch className="h-4 w-4 text-blue-300" />
        <b className="text-blue-300">DS</b>
        <span className="text-emerald-700">文件检索 · 全文搜索 · 文档分析</span>
        <span role="status" className="text-[10px] text-slate-500">
          {loading
            ? "正在读取"
            : cik
              ? `SEC CIK ${cik} · ${rows.length} 份目录记录`
              : "等待主体"}
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="关闭 DS"
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
          主体
          <input
            aria-label="DS 主体检索"
            value={issuerText}
            onChange={event => {
              setIssuerText(event.target.value);
              setCik("");
            }}
            className={`${control} ml-2 w-44`}
          />
        </label>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {(issuers.data?.results ?? []).map((item: any) => (
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
        <label className="text-[10px] text-slate-500">
          表单
          <select
            aria-label="DS 表单筛选"
            value={form}
            onChange={event => setForm(event.target.value)}
            className={`${control} ml-2`}
          >
            <option value="ALL">全部</option>
            {[
              ...new Set(
                ((filings.data?.filings ?? []) as Filing[]).map(
                  item => item.form
                )
              ),
            ].map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${control} inline-flex items-center gap-1`}
          onClick={() => {
            void issuers.refetch();
            void filings.refetch();
            void excerpt.refetch();
          }}
        >
          <RefreshCw className="h-3 w-3" />
          刷新来源
        </button>
      </div>
      <nav
        role="tablist"
        aria-label="DS 原功能"
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
        {activeTab === "search" && (
          <div className="grid min-h-[440px] grid-cols-1 lg:grid-cols-[minmax(360px,.85fr)_minmax(0,1.15fr)]">
            <div className="min-h-0 overflow-auto border-b border-slate-800 lg:border-b-0 lg:border-r">
              <table className="w-full min-w-[620px] text-left text-[10px]">
                <thead className="sticky top-0 bg-black text-slate-500">
                  <tr>
                    {["申报日", "表单", "主文件", "访问编号"].map(label => (
                      <th key={label} className="p-2 font-normal">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(item => {
                    const key = `${item.accessionNumber}:${item.primaryDocument}`;
                    return (
                      <tr
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        className={`cursor-pointer border-t border-slate-800 ${selectedKey === key ? "bg-blue-950/40" : "hover:bg-slate-900"}`}
                      >
                        <td className="p-2">{item.filingDate ?? "—"}</td>
                        <td className="text-blue-300">{item.form}</td>
                        <td>{item.primaryDocument ?? "—"}</td>
                        <td className="text-slate-500">
                          {item.accessionNumber ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-5 text-center text-amber-200"
                      >
                        {cik
                          ? "来源未返回匹配文件。"
                          : "选择真实 SEC 主体后读取文档目录。"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="min-w-0 p-2">
              <div className="flex gap-2 border-b border-slate-800 pb-2">
                <input
                  aria-label="DS 正文关键词"
                  value={keyword}
                  onChange={event => setKeyword(event.target.value)}
                  placeholder="输入至少 2 个字符"
                  className={`${control} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  disabled={
                    !selected || keyword.trim().length < 2 || excerpt.isFetching
                  }
                  onClick={submitSearch}
                  className={control}
                >
                  检索当前主文件
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-300">
                {excerpt.isFetching
                  ? "正在读取 SEC 主文件…"
                  : (excerpt.data?.excerpt ??
                    (submittedKeyword
                      ? excerpt.data?.sourceBoundary
                      : "选择目录记录并提交关键词；只显示关键词附近的 SEC 原文证据。"))}
              </p>
            </div>
          </div>
        )}
        {activeTab === "detail" && (
          <div className="p-2">
            <table className="w-full max-w-4xl text-left text-[10px]">
              <tbody>
                {[
                  ["主体", (filings.data?.issuer as any)?.name ?? "—"],
                  ["CIK", cik || "—"],
                  [
                    "交易代码",
                    (filings.data?.issuer as any)?.tickers?.join(", ") ?? "—",
                  ],
                  [
                    "交易所",
                    (filings.data?.issuer as any)?.exchanges?.join(", ") ?? "—",
                  ],
                  ["SIC", (filings.data?.issuer as any)?.sic ?? "—"],
                  [
                    "SIC 描述",
                    (filings.data?.issuer as any)?.sicDescription ?? "—",
                  ],
                  ["表单", selected?.form ?? "—"],
                  ["申报日", selected?.filingDate ?? "—"],
                  ["主文件", selected?.primaryDocument ?? "—"],
                  ["访问编号", selected?.accessionNumber ?? "—"],
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border-b border-slate-800">
                    <th className="w-40 p-2 font-normal text-slate-500">
                      {label}
                    </th>
                    <td className="p-2 text-slate-200">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "stats" && (
          <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[minmax(300px,.65fr)_minmax(0,1.35fr)]">
            <table className="h-fit w-full text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="p-2 font-normal">表单</th>
                  <th className="p-2 font-normal">实际目录数</th>
                </tr>
              </thead>
              <tbody>
                {formCounts.map(row => (
                  <tr key={row.name} className="border-t border-slate-800">
                    <td className="p-2 text-blue-300">{row.name}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="h-[410px] border-t border-slate-800 p-2 lg:border-l lg:border-t-0">
              {formCounts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formCounts}>
                    <CartesianGrid stroke="#052e16" strokeDasharray="2 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#6ee7b7", fontSize: 9 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#6ee7b7", fontSize: 9 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="实际目录数"
                      fill="#60a5fa"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p role="status" className="p-4 text-slate-500">
                  取得实际目录后显示表单分布。
                </p>
              )}
            </div>
          </div>
        )}
        {activeTab === "history" && (
          <>
            <p className="border-b border-slate-800 p-2 text-[10px] text-slate-500">
              本会话搜索历史由实际提交动作产生，不预置热门搜索或伪造搜索次数。
            </p>
            <table className="w-full text-left text-[10px]">
              <thead className="text-slate-500">
                <tr>
                  {["提交时间", "CIK", "表单", "主文件", "关键词"].map(
                    label => (
                      <th key={label} className="p-2 font-normal">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr
                    key={`${item.at}-${index}`}
                    className="border-t border-slate-800"
                  >
                    <td className="p-2">
                      {new Date(item.at).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </td>
                    <td>{item.cik}</td>
                    <td>{item.form}</td>
                    <td>{item.document}</td>
                    <td className="text-blue-300">{item.keyword}</td>
                  </tr>
                ))}
                {!history.length && (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-slate-500">
                      本会话尚未提交正文检索。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
      <footer className="border-t border-emerald-950 px-2 py-1.5 text-[9px] leading-5 text-slate-500">
        来源：SEC EDGAR
        主体目录、申报目录和主文件原文。未接入券商研报许可源时，不显示伪造研报、评级、目标价、页数、情绪分数或相关度分数。
        {filings.data?.sourceBoundary ? ` ${filings.data.sourceBoundary}` : ""}
      </footer>
    </section>
  );
}
