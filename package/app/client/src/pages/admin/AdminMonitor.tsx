import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Activity, Cpu, Database, Gauge, RefreshCw, Server } from "lucide-react";

function formatDate(value: Date | string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminMonitor() {
  const health = trpc.admin.systemHealth.useQuery(undefined, { refetchInterval: 30_000 });
  const activity = trpc.admin.getActivityLog.useQuery({ limit: 20 }, { refetchInterval: 30_000 });
  const refresh = () => { void health.refetch(); void activity.refetch(); };
  const detail = health.data;

  return (
    <AdminLayout>
      <section className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Operations</p><h1 className="mt-1 text-2xl font-semibold text-white">系统监控</h1><p className="mt-1 text-sm text-slate-400">展示后台服务、数据库连通性与最近活动；数据每 30 秒通过真实接口刷新。</p></div>
          <Button type="button" variant="outline" onClick={refresh} disabled={health.isFetching || activity.isFetching} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"><RefreshCw className={`mr-2 h-4 w-4 ${health.isFetching || activity.isFetching ? "animate-spin" : ""}`} />立即刷新</Button>
        </header>

        {health.error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">无法读取系统健康信息：{health.error.message}</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">服务状态</span><Activity className="h-5 w-5 text-cyan-400" /></div><p className={`mt-4 text-2xl font-semibold ${detail?.status === "healthy" ? "text-emerald-300" : "text-amber-300"}`}>{detail?.status === "healthy" ? "健康" : detail?.status === "degraded" ? "降级" : "读取中"}</p><p className="mt-2 text-xs text-slate-500">{detail ? `更新于 ${formatDate(detail.timestamp)}` : "等待服务响应"}</p></article>
          <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">数据库</span><Database className="h-5 w-5 text-cyan-400" /></div><p className="mt-4 text-2xl font-semibold text-white">{detail?.database.connected ? "已连接" : detail ? "不可用" : "读取中"}</p><p className="mt-2 text-xs text-slate-500">{detail ? `响应 ${detail.database.latencyMs} ms` : "—"}</p></article>
          <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">进程运行时间</span><Server className="h-5 w-5 text-cyan-400" /></div><p className="mt-4 text-2xl font-semibold text-white">{detail?.server.uptimeFormatted ?? "—"}</p><p className="mt-2 text-xs text-slate-500">{detail?.server.nodeVersion ?? "Node 版本读取中"}</p></article>
          <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">堆内存占用</span><Cpu className="h-5 w-5 text-cyan-400" /></div><p className="mt-4 text-2xl font-semibold text-white">{detail?.memory.heapUsed ?? "—"}</p><p className="mt-2 text-xs text-slate-500">{detail ? `${detail.memory.heapUsedPercent}% of ${detail.memory.heapTotal}` : "—"}</p></article>
        </div>

        <article className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70"><header className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/50 px-4 py-3"><Gauge className="h-4 w-4 text-cyan-400" /><h2 className="text-sm font-semibold text-white">近期登录活动</h2></header><div className="divide-y divide-slate-800">{activity.isLoading && <p className="p-5 text-sm text-slate-500">正在读取活动记录…</p>}{activity.data?.map((item, index) => <div key={`${item.user}-${item.timestamp}-${index}`} className="flex items-start justify-between gap-4 px-4 py-3"><div><p className="text-sm text-slate-200">{item.detail}</p><p className="mt-1 text-xs text-slate-500">用户：{item.user}</p></div><time className="shrink-0 text-xs text-slate-500">{formatDate(item.timestamp)}</time></div>)}{!activity.isLoading && !activity.data?.length && <p className="p-5 text-sm text-slate-500">暂无可显示的活动记录。</p>}</div></article>
      </section>
    </AdminLayout>
  );
}
