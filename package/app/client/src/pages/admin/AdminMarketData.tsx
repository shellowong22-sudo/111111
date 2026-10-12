import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Database, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const markets = ["stock", "bond", "forex", "commodity", "index", "derivative", "option", "fund"] as const;

export default function AdminMarketData() {
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState<string>("");
  const [form, setForm] = useState({ symbol: "", name: "", market: "stock" as (typeof markets)[number], price: "0" });
  const data = trpc.admin.listMarketData.useQuery({ page: 1, pageSize: 100, search: search || undefined, market: market || undefined });
  const create = trpc.admin.createMarketData.useMutation({ onSuccess: () => { toast.success("品种已新增"); setForm({ symbol: "", name: "", market: "stock", price: "0" }); data.refetch(); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.deleteMarketData.useMutation({ onSuccess: () => { toast.success("品种已删除"); data.refetch(); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ ...form, changeVal: "0", changePct: "0", volume: "0" }); };

  return (
    <AdminLayout>
      <section className="space-y-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Market data</p><h1 className="mt-1 text-2xl font-semibold text-white">行情数据管理</h1><p className="mt-1 text-sm text-slate-400">管理导入至数据库的金融品种，类型与 market 枚举保持一致。</p></div><Button variant="outline" onClick={() => data.refetch()} disabled={data.isFetching} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"><RefreshCw className={`mr-2 h-4 w-4 ${data.isFetching ? "animate-spin" : ""}`} />刷新</Button></header>
        <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[1fr_1.5fr_150px_130px_auto]"><Input required value={form.symbol} onChange={event => setForm({ ...form, symbol: event.target.value.toUpperCase() })} placeholder="代码，例如 AAPL" className="border-slate-700 bg-slate-950 text-slate-100" /><Input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="品种名称" className="border-slate-700 bg-slate-950 text-slate-100" /><select value={form.market} onChange={event => setForm({ ...form, market: event.target.value as typeof form.market })} className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200">{markets.map(item => <option key={item} value={item}>{item}</option>)}</select><Input required type="number" step="any" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} aria-label="价格" className="border-slate-700 bg-slate-950 text-slate-100" /><Button type="submit" disabled={create.isPending} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Plus className="mr-1 h-4 w-4" />新增</Button></form>
        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索代码或名称" className="border-slate-700 bg-slate-900 pl-9 text-slate-100" /></div><select value={market} onChange={event => setMarket(event.target.value)} className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"><option value="">全部市场</option>{markets.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">代码</th><th className="px-4 py-3">名称</th><th className="px-4 py-3">类别</th><th className="px-4 py-3 text-right">价格</th><th className="px-4 py-3 text-right">涨跌幅</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-800">{data.data?.data.map((item: any) => <tr key={item.id} className="text-slate-300"><td className="px-4 py-3 font-mono font-medium text-cyan-300">{item.symbol}</td><td className="px-4 py-3">{item.name}</td><td className="px-4 py-3 capitalize text-slate-500">{item.market}</td><td className="px-4 py-3 text-right font-mono">{item.price}</td><td className="px-4 py-3 text-right font-mono">{item.changePct}%</td><td className="px-4 py-3 text-right"><Button aria-label={`删除 ${item.symbol}`} variant="ghost" size="icon" disabled={remove.isPending} onClick={() => { if (window.confirm(`确认删除 ${item.symbol} 吗？`)) remove.mutate({ id: item.id }); }} className="h-8 w-8 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button></td></tr>)}{!data.isLoading && !data.data?.data.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500"><Database className="mx-auto mb-2 h-5 w-5" />尚无匹配的行情数据。</td></tr>}</tbody></table></div></div>
        {data.error && <p className="text-sm text-red-300">无法加载行情：{data.error.message}</p>}
      </section>
    </AdminLayout>
  );
}
