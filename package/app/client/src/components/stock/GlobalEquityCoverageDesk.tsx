import React, { useEffect, useMemo, useState } from "react";
import { Database, FileSpreadsheet, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { trpc } from "@/lib/trpc";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const PAGE_SIZE = 20;
type ListingRow = inferRouterOutputs<AppRouter>["equityListings"]["list"]["rows"][number];
const listingKey = (row: ListingRow) => JSON.stringify([row.countryCode, row.exchange, row.symbol, row.sourceFile, row.sourceSheet, row.sourceRow]);
const control = "h-8 border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-sky-600";
const action = "inline-flex h-8 items-center justify-center gap-1 border border-sky-800 px-3 text-xs text-sky-100 hover:bg-sky-950 disabled:opacity-40";
const formatTime = (timestamp: number) => timestamp > 0 ? new Date(timestamp).toLocaleString() : "尚未成功读取";

/** The directory, global coverage and source fields have separate responsibilities. */
export default function GlobalEquityCoverageDesk() {
  const [countryCode, setCountryCode] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedListingKey, setSelectedListingKey] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [wide, setWide] = useState(true);
  const countries = trpc.equityListings.countries.useQuery(undefined, {
    refetchOnWindowFocus: true, staleTime: 60_000, refetchInterval: 60_000,
  });
  const input = useMemo(() => ({
    countryCode: countryCode || undefined, query: query || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
  }), [countryCode, page, query]);
  const listings = trpc.equityListings.list.useQuery(input, {
    refetchOnWindowFocus: true, staleTime: 30_000, refetchInterval: 60_000,
  });
  const allCountries = countries.data ?? [];
  const totalImported = countries.data === undefined ? null : allCountries.reduce((total, item) => total + Number(item.listingCount), 0);
  const maxPage = Math.max(0, Math.ceil((listings.data?.total ?? 0) / PAGE_SIZE) - 1);
  const selectedListing = listings.isError || listings.isLoading
    ? null : listings.data?.rows.find(row => listingKey(row) === selectedListingKey) ?? null;
  const exchangeRows = useMemo(() => {
    if (listings.isError || listings.isLoading) return [];
    const counts = new Map<string, number>();
    (listings.data?.rows ?? []).forEach(row => counts.set(row.exchange || "未提供", (counts.get(row.exchange || "未提供") ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [listings.data?.rows, listings.isError, listings.isLoading]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const update = () => setWide(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  // A repeated search is an explicit refresh, including when returning to cached page 1.
  // Run after the query/page state has changed and keep an in-flight request rather than cancel it.
  useEffect(() => {
    if (requestVersion > 0) void listings.refetch({ cancelRefetch: false });
  }, [requestVersion]);
  const applyQuery = () => {
    setPage(0); setQuery(draftQuery.trim()); setSelectedListingKey(null);
    setRequestVersion(current => current + 1);
  };
  const setCountry = (value: string) => {
    setPage(0); setCountryCode(value); setSelectedListingKey(null);
    setRequestVersion(current => current + 1);
  };
  const changePage = (next: number) => {
    setSelectedListingKey(null); setPage(Math.min(maxPage, Math.max(0, next)));
  };
  const coverageText = countries.isError ? "覆盖总量暂不可用"
    : countries.isLoading || totalImported === null ? "读取覆盖目录…"
      : totalImported.toLocaleString() + " 条已导入目录记录";

  return <section className="mt-3 min-w-0 border-y border-sky-900/70 bg-[#08121d]/70" data-global-equity-coverage-desk="true">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
      <div><p className="font-mono text-[10px] tracking-wide text-sky-300">STOCKS · IMPORTED LISTING COVERAGE</p>
        <h3 className="text-sm font-semibold text-slate-100">全球股票覆盖范围工作台</h3>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-sky-200">
        <Database className="h-3.5 w-3.5" /><span role="status" aria-label="目录覆盖状态">{coverageText}</span>
        <span className="text-slate-500">{countries.isFetching ? "查询中" : "每 60 秒重新查询"}</span>
      </div>
    </header>
    <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 px-3 py-2">
      <label className="text-[10px] text-slate-400">国家/地区
        <select aria-label="全球股票国家筛选" value={countryCode} onChange={event => setCountry(event.target.value)} className={control + " ml-2 max-w-full"}>
          <option value="">全部已导入国家/地区</option>
          {allCountries.map(item => <option key={item.countryCode} value={item.countryCode}>{item.countryCode} · {item.country}</option>)}
        </select>
      </label>
      <label className="min-w-40 flex-1 text-[10px] text-slate-400">代码或名称
        <input aria-label="全球股票目录检索" maxLength={128} value={draftQuery} onChange={event => setDraftQuery(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") applyQuery(); }}
          placeholder="例如 AAPL、台积电、Samsung" className={control + " ml-2 w-[min(20rem,70%)]"} />
      </label>
      <button type="button" onClick={applyQuery} disabled={listings.isFetching} className={action}><Search className="h-3.5 w-3.5" />检索目录</button>
    </div>

    <div className="h-[700px] min-w-0">
      <ResizablePanelGroup direction={wide ? "horizontal" : "vertical"} className="min-w-0" aria-label="目录与来源详情分栏">
        <ResizablePanel defaultSize={65} minSize={35}>
          <div className="flex h-full min-w-0 flex-col" data-equity-directory-pane="true">
            <details open className="shrink-0 border-b border-slate-800">
              <summary className="cursor-pointer px-2 py-2 text-[11px] font-semibold text-sky-200">
                国家覆盖矩阵 <span className="font-normal text-slate-500">· 全部导入国家，不随目录关键词缩小</span>
              </summary>
              {countries.isError ? <div role="alert" className="flex items-center justify-between gap-2 px-3 py-3 text-xs text-amber-200">
                <span>国家覆盖请求失败，不能确定当前覆盖总量。</span>
                <button type="button" className={action} disabled={countries.isFetching} onClick={() => void countries.refetch()}>重试国家覆盖</button>
              </div> : countries.isLoading ? <p role="status" className="px-3 py-3 text-xs text-slate-400">正在读取全部国家统计…</p>
                : !allCountries.length ? <p className="px-3 py-3 text-xs text-slate-400">当前数据库未返回已导入国家。</p>
                  : <div className="max-h-40 overflow-auto">
                    <table aria-label="全部国家覆盖矩阵" className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr>
                        <th className="px-2 py-1">国家/地区</th><th className="px-2 py-1 text-right">导入记录</th>
                        <th className="px-2 py-1 text-right">全目录占比</th><th className="px-2 py-1">相对覆盖</th>
                      </tr></thead>
                      <tbody>{allCountries.map(item => {
                        const share = totalImported ? Number(item.listingCount) / totalImported * 100 : 0;
                        return <tr key={item.countryCode} className={"border-b border-slate-800 " + (item.countryCode === countryCode ? "bg-sky-950/50" : "")}>
                          <td className="px-2 py-1"><button type="button" aria-pressed={countryCode === item.countryCode} onClick={() => setCountry(item.countryCode)}
                            className="w-full text-left text-sky-200 hover:underline">{item.countryCode} · {item.country}</button></td>
                          <td className="px-2 py-1 text-right font-mono text-slate-300">{Number(item.listingCount).toLocaleString()}</td>
                          <td className="px-2 py-1 text-right font-mono text-slate-400">{share.toFixed(2)}%</td>
                          <td className="w-1/4 px-2 py-1"><svg aria-hidden="true" width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none"><rect width="100" height="6" fill="#172337" /><rect width={share} height="6" fill="#38bdf8" /></svg></td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>}
            </details>

            <div className="flex items-center justify-between border-b border-slate-800 px-2 py-2 text-[11px]">
              <h4 className="font-semibold text-slate-300">证券目录</h4>
              <span className="text-slate-500">{listings.isFetching ? "重新读取中，显示上次成功结果" : "点击或按 Enter 选择记录"}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table aria-label="全球证券目录" className="w-full min-w-[420px] text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-950 text-slate-500"><tr>
                  <th className="px-2 py-2">国家</th><th className="px-2 py-2">交易所</th><th className="px-2 py-2">代码</th>
                  <th className="px-2 py-2">名称</th><th className="px-2 py-2">出处状态</th>
                </tr></thead><tbody>
                  {listings.isLoading ? <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-400">正在读取已导入目录…</td></tr>
                    : listings.isError ? <tr><td colSpan={5}><div role="alert" className="px-3 py-4 text-amber-200">
                      <p>目录读取失败；旧结果未标记为最新。</p>
                      <button type="button" onClick={() => void listings.refetch()} disabled={listings.isFetching} className={action + " mt-2"}><RefreshCw className="h-3 w-3" />重试目录</button>
                    </div></td></tr>
                      : listings.data?.rows.length ? listings.data.rows.map(row => <tr key={listingKey(row)} tabIndex={0}
                        aria-selected={selectedListingKey === listingKey(row)} onClick={() => setSelectedListingKey(listingKey(row))}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedListingKey(listingKey(row)); }
                          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            const next = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
                            if (next instanceof HTMLElement) { next.focus(); next.click(); }
                          }
                        }} className={"cursor-pointer border-b border-slate-800 outline-none hover:bg-sky-950/30 focus:bg-sky-950/40 " + (selectedListingKey === listingKey(row) ? "bg-sky-950/50" : "")}>
                        <td className="px-2 py-2 font-mono text-sky-200">{row.countryCode}</td>
                        <td className="px-2 py-2 text-slate-400">{row.exchange || "未提供"}</td>
                        <td className="px-2 py-2"><button type="button" className="font-mono text-slate-100 underline decoration-dotted"
                          aria-label={"查看 " + row.symbol + " 的导入来源"} onClick={event => { event.stopPropagation(); setSelectedListingKey(listingKey(row)); }}>{row.symbol}</button></td>
                        <td className="max-w-48 break-words px-2 py-2 text-slate-300">{row.name || "未提供"}</td>
                        <td className="px-2 py-2 text-slate-500">{row.sourceFile && row.sourceSheet && row.sourceRow ? "已记录" : "字段不全"}</td>
                      </tr>) : <tr><td colSpan={5} className="px-2 py-6 text-slate-400">该筛选没有已导入目录记录；终端不会用推测代码、第三方搜索或样例标的填充。</td></tr>}
                </tbody>
              </table>
            </div>
            {listings.data && !listings.isError && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-2 py-2 text-[10px]">
              <p className="text-slate-400">匹配 {listings.data.total.toLocaleString()} 条 · 当前 {listings.data.offset + (listings.data.rows.length ? 1 : 0)}–{listings.data.offset + listings.data.rows.length}</p>
              <div className="flex gap-1"><button type="button" disabled={page === 0 || listings.isFetching} onClick={() => changePage(page - 1)} className={action}>上一页</button>
                <button type="button" disabled={page >= maxPage || listings.isFetching} onClick={() => changePage(page + 1)} className={action}>下一页</button></div>
            </div>}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="调整目录与详情分栏" />
        <ResizablePanel defaultSize={35} minSize={20}>
          <section aria-live="polite" className="flex h-full min-w-0 flex-col" data-equity-listing-lineage="true">
            <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <h4 className="text-[11px] font-semibold text-sky-200">LISTING LINEAGE · 已导入目录溯源</h4>
              {selectedListing && <button type="button" className="text-slate-400 hover:text-white" aria-label="关闭详情" onClick={() => setSelectedListingKey(null)}><X className="h-3.5 w-3.5" /></button>}
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              {selectedListing ? <>
                <h5 className="border-b border-slate-800 px-3 py-3 font-mono text-sm text-slate-100">{selectedListing.symbol} · {selectedListing.name || "未提供名称"}</h5>
                <table aria-label="选中证券来源字段" className="w-full text-left text-[11px]"><tbody>
                  {[
                    ["目录身份", selectedListing.countryCode + " / " + (selectedListing.exchange || "交易所未提供") + " / " + selectedListing.symbol],
                    ["国家 / 地区", selectedListing.country],
                    ["来源文件", selectedListing.sourceFile],
                    ["来源工作表", selectedListing.sourceSheet],
                    ["原始行号", String(selectedListing.sourceRow)],
                    ["交易所字段质量", selectedListing.exchange ? "原目录已提供" : "原工作簿未提供，不推测交易所"],
                    ["名称字段质量", selectedListing.name ? "原目录已提供" : "原工作簿未提供，不补造名称"],
                  ].map(([label, value]) => <tr key={label} className="border-b border-slate-800"><th className="w-24 px-3 py-2 align-top font-normal text-slate-500">{label}</th><td className="break-all px-3 py-2 text-slate-200">{value || "未提供"}</td></tr>)}
                </tbody></table>
                <p className="px-3 py-3 text-[10px] leading-5 text-slate-400"><FileSpreadsheet className="mr-1 inline h-3 w-3" />字段来自当前目录查询，不读取源文件全文。未发起行情、新闻、公司基本面或第三方页面请求。</p>
              </> : <p className="px-3 py-5 text-xs leading-6 text-slate-400">{listings.isError ? "目录请求失败，来源详情暂不可用。" : "选择目录中的证券代码，在此查看完整来源文件、工作表和原始行号。筛选、检索或翻页会清除旧选择。"}</p>}
              <details open className="border-y border-slate-800">
                <summary className="cursor-pointer px-3 py-2 text-[11px] text-sky-200">当前页交易所矩阵 <span className="text-slate-500">· 不是全市场覆盖</span></summary>
                {!exchangeRows.length ? <p className="px-3 py-3 text-[10px] text-slate-400">{listings.isError ? "目录读取失败，统计不可用。" : "当前页没有可统计的交易所字段。"}</p>
                  : <table aria-label="当前页交易所矩阵" className="w-full text-left text-[11px]"><thead className="text-slate-500"><tr><th className="px-3 py-1">交易所字段</th><th className="px-3 py-1 text-right">本页记录数</th></tr></thead><tbody>{exchangeRows.map(([exchange, count]) => <tr key={exchange} className="border-t border-slate-800"><td className="px-3 py-1 text-slate-300">{exchange}</td><td className="px-3 py-1 text-right font-mono text-slate-300">{count}</td></tr>)}</tbody></table>}
              </details>
            </div>
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    <footer className="border-t border-slate-800 px-3 py-2 text-[10px] leading-5 text-slate-400">
      <div className="flex flex-wrap justify-between gap-x-4"><span>国家统计读取：{formatTime(countries.dataUpdatedAt)}</span><span>目录读取：{formatTime(listings.dataUpdatedAt)}</span></div>
      <p><ShieldCheck className="mr-1 inline h-3.5 w-3.5" />覆盖统计仅来自已导入目录，不显示行情、新闻、目标价或第三方页面，不证明上市状态、流动性或交易资格。新工作簿经受审计导入后，目录重新查询可见。</p>
    </footer>
  </section>;
}
