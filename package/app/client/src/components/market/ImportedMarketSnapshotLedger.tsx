import { Database, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

const labels: Record<string, string> = { stock: "股票", option: "期权", fund: "基金", bond: "债券", forex: "外汇", commodity: "商品", index: "指数", derivative: "衍生品" };

function toText(value: unknown) { return value === null || value === undefined || value === "" ? "未提供" : String(value); }
function timestamp(value: unknown) { if (!value) return "导入时间未提供"; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN", { hour12: false }); }

export default function ImportedMarketSnapshotLedger() {
  const [filter, setFilter] = useState("all");
  const [queryText, setQueryText] = useState("");
  const market = trpc.market.getAll.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const rows = useMemo(() => (market.data ?? []).filter((row) => {
    const categoryPass = filter === "all" || row.market === filter;
    const needle = queryText.trim().toLowerCase();
    const searchPass = !needle || row.symbol.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle);
    return categoryPass && searchPass;
  }), [filter, market.data, queryText]);
  const categories = useMemo(() => Array.from(new Set((market.data ?? []).map((row) => row.market))).sort(), [market.data]);
  return <section className="mx-auto max-w-screen-2xl border-x border-b border-cyan-950/80 bg-[#061016] px-6 py-5" data-imported-market-snapshot-ledger="true">
    <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div><p className="flex items-center gap-1 font-mono text-[10px] tracking-wide text-cyan-200"><Database className="h-3.5 w-3.5" /> MARKET · IMPORTED DATABASE SNAPSHOT LEDGER</p><h2 className="mt-1 text-base font-semibold text-slate-100">已导入品种数据库快照</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">此工作台直接读取项目数据库中的导入记录，用于核验代码、市场分类、价格字段、成交量字段与导入时间。它不使用原页面的客户端模拟实时流，不将快照表述为实时可交易报价，也不离开终端。</p></div><button type="button" onClick={() => market.refetch()} disabled={market.isFetching} className="inline-flex h-8 items-center justify-center gap-1 rounded border border-cyan-800 px-3 text-xs text-cyan-100 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${market.isFetching ? "animate-spin" : ""}`} />重新读取数据库快照</button></header>
    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"><label className="flex h-9 items-center gap-2 rounded border border-slate-800 bg-slate-950 px-3 text-slate-500"><Search className="h-4 w-4" /><input aria-label="导入行情检索" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="检索代码或名称，如 AAPL、US10Y" className="w-full bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600" /></label><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setFilter("all")} className={`rounded border px-2 py-1 text-[11px] ${filter === "all" ? "border-cyan-500 bg-cyan-950/50 text-cyan-100" : "border-slate-800 text-slate-400"}`}>全部 {market.data?.length ?? 0}</button>{categories.map((category) => <button type="button" key={category} onClick={() => setFilter(category)} className={`rounded border px-2 py-1 text-[11px] ${filter === category ? "border-cyan-500 bg-cyan-950/50 text-cyan-100" : "border-slate-800 text-slate-400"}`}>{labels[category] ?? category} {(market.data ?? []).filter((row) => row.market === category).length}</button>)}</div></div>
    <div className="mt-3 overflow-x-auto rounded border border-slate-800"><table className="min-w-full text-left text-[11px]"><thead className="bg-slate-950 text-slate-500"><tr><th className="px-3 py-2">代码</th><th className="px-3 py-2">名称</th><th className="px-3 py-2">市场</th><th className="px-3 py-2 text-right">导入价格</th><th className="px-3 py-2 text-right">导入涨跌幅</th><th className="px-3 py-2 text-right">导入成交量</th><th className="px-3 py-2">数据时间</th></tr></thead><tbody>{market.isLoading ? <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">正在读取已导入的数据库快照…</td></tr> : rows.length ? rows.map((row) => <tr key={`${row.market}:${row.symbol}`} className="border-t border-slate-800/70"><td className="px-3 py-2 font-mono text-cyan-200">{row.symbol}</td><td className="px-3 py-2 text-slate-200">{row.name}</td><td className="px-3 py-2 text-slate-400">{labels[row.market] ?? row.market}</td><td className="px-3 py-2 text-right font-mono text-slate-200">{toText(row.price)}</td><td className="px-3 py-2 text-right font-mono text-slate-300">{toText(row.changePct)}%</td><td className="px-3 py-2 text-right font-mono text-slate-300">{toText(row.volume)}</td><td className="px-3 py-2 text-slate-500">{timestamp(row.updatedAt)}</td></tr>) : <tr><td colSpan={7} className="px-3 py-6 text-center text-amber-200">没有匹配的已导入记录；系统不会使用随机、模拟或外部网页结果填充。</td></tr>}</tbody></table></div>
    <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-5 text-amber-100"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />{market.data?.length ? `当前读取 ${market.data.length} 条导入快照。字段代表导入时的数据库值，不能据此推断当前市场、成交、流动性或投资结论。` : "数据库读取不可用时保持真实空状态，不以缓存样本或模拟值替代。"}</p>
  </section>;
}
