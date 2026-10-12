import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Database, MonitorCog, Settings2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function AdminSettings() {
  const health = trpc.admin.systemHealth.useQuery();

  return (
    <AdminLayout>
      <section className="space-y-6">
        <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Configuration</p><h1 className="mt-1 text-2xl font-semibold text-white">管理设置</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">此页仅呈现已连接的配置入口与运行环境摘要；不会伪造不可用的保存操作。</p></header>
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-cyan-400" /><h2 className="font-semibold text-white">个人偏好与界面设置</h2></div><p className="mt-3 text-sm leading-6 text-slate-400">打开已实现的应用设置页，管理个人会话下的可用界面偏好。</p><Button asChild type="button" className="mt-5 bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Link href="/settings">前往应用设置<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></article>
          <article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><MonitorCog className="h-5 w-5 text-cyan-400" /><h2 className="font-semibold text-white">运行状态</h2></div><p className="mt-3 text-sm leading-6 text-slate-400">数据库：<span className={health.data?.database.connected ? "text-emerald-300" : "text-amber-300"}>{health.data?.database.connected ? "已连接" : health.data ? "不可用" : "读取中"}</span></p><p className="mt-1 text-sm text-slate-400">服务状态：{health.data?.status ?? "读取中"}</p><Button asChild type="button" variant="outline" className="mt-5 border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"><Link href="/admin/monitor">打开系统监控<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></article>
        </div>
        <div className="grid gap-4 md:grid-cols-2"><article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><ShieldCheck className="h-5 w-5 text-cyan-400" /><h2 className="mt-3 font-semibold text-white">访问控制</h2><p className="mt-2 text-sm leading-6 text-slate-400">用户与角色操作由服务端管理员程序保护，并由安全审计记录约束。</p><Link href="/admin/users" className="mt-4 inline-flex items-center text-sm text-cyan-300 hover:text-cyan-200">打开用户管理<ArrowRight className="ml-1 h-4 w-4" /></Link></article><article className="rounded-lg border border-slate-800 bg-slate-900/70 p-5"><Database className="h-5 w-5 text-cyan-400" /><h2 className="mt-3 font-semibold text-white">行情数据维护</h2><p className="mt-2 text-sm leading-6 text-slate-400">品种数据管理使用实际数据库读写链路，覆盖已导入的 market 分类。</p><Link href="/admin/market-data" className="mt-4 inline-flex items-center text-sm text-cyan-300 hover:text-cyan-200">打开行情数据管理<ArrowRight className="ml-1 h-4 w-4" /></Link></article></div>
      </section>
    </AdminLayout>
  );
}

