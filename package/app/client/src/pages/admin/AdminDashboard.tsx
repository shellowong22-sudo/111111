import AdminLayout from "@/components/AdminLayout";
import AdminOperationalCharts from "@/components/admin/AdminOperationalCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowRight, Bot, Database, RadioTower, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { Link } from "wouter";

const destinations = [
  { href: "/admin/users", label: "用户与角色", detail: "查看账户并管理角色权限", icon: Users },
  { href: "/admin/market-data", label: "行情数据", detail: "维护已导入的品种行情", icon: Database },
  { href: "/admin/data-ingestion", label: "AI 数据采集", detail: "管理许可新闻、投资标的与采集任务", icon: Bot },
  { href: "/admin/agent-reach", label: "研究与知识工作台", detail: "运行公开技能、审阅知识资料、验证 Ucheer 输出", icon: RadioTower },
  { href: "/admin/monitor", label: "系统监控", detail: "查看应用与数据库健康状态", icon: Activity },
];

export default function AdminDashboard() {
  const dashboard = trpc.admin.dashboard.useQuery();
  const marketStats = trpc.admin.marketStats.useQuery();
  const inventory = trpc.agentReachAdmin.storageInventory.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const summary = dashboard.data;

  const metrics = [
    { label: "用户总数", value: summary?.users.total ?? "—", detail: `管理员 ${summary?.users.admins ?? 0} 位`, icon: Users },
    { label: "可用行情", value: summary?.market.totalProducts ?? "—", detail: `${summary?.market.marketTypes ?? 0} 类品种`, icon: Database },
    { label: "上涨品种", value: summary?.market.risers ?? "—", detail: `下跌 ${summary?.market.fallers ?? 0} 个`, icon: TrendingUp },
    { label: "今日活跃", value: summary?.users.activeToday ?? "—", detail: "最近 24 小时登录", icon: ShieldCheck },
  ];

  return (
    <AdminLayout>
      <section className="space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Control room</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">运营概览</h1>
            <p className="mt-1 text-sm text-slate-400">账户、行情与运行状态的实时管理视图。</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />管理员会话已受保护
          </span>
        </header>

        {dashboard.error && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
            概览数据暂不可用：{dashboard.error.message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(metric => (
            <Card key={metric.label} className="border-slate-800 bg-slate-900/70 text-white shadow-none">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-xs text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">{metric.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
                </div>
                <metric.icon className="h-5 w-5 text-cyan-400" />
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="rounded-lg border border-cyan-900/60 bg-[#0c1b2d] p-4" aria-label="终端数据库概览">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Data inventory</div>
              <h2 className="mt-1 text-lg font-semibold text-white">整个终端的自有数据</h2>
              <p className="mt-1 text-xs text-slate-400">显示当前连接数据库的实际库存；清洗前后多个表中的同一条资料不会被说成不同文档。</p></div>
            <Link href="/admin/agent-reach?desk=knowledge" className="inline-flex items-center gap-1.5 rounded border border-cyan-600 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10">查看各表及清洗资料 <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {inventory.error && <p role="alert" className="mt-3 text-sm text-rose-300">数据库库存读取失败：{inventory.error.message}</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ["数据表", inventory.data?.tableCount.toLocaleString() ?? "读取中"],
              ["结构化资料（精确）", inventory.data?.exactStructuredDocuments.toLocaleString() ?? "读取中"],
              ["Agent Reach 清洗资料（精确）", inventory.data?.exactAgentReachDocuments.toLocaleString() ?? "读取中"],
            ].map(([label, value]) => <div key={label} className="rounded border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-cyan-200">{inventory.error ? "不可用" : value}</div>
            </div>)}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">统计查询时间：{inventory.data ? new Date(inventory.data.observedAt).toLocaleString("zh-CN") : "—"}；全库估算行数和表分配空间请进入明细查看，不代表去重资料总数或 C 盘剩余空间。</p>
        </section>

        <AdminOperationalCharts />

        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Card className="border-slate-800 bg-slate-900/70 text-white shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">品种分类覆盖</CardTitle>
              <Database className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {marketStats.data?.map((item: any) => (
                  <div key={item.market} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                    <span className="text-sm capitalize text-slate-300">{item.market}</span>
                    <span className="font-mono text-sm text-cyan-300">{item.count}</span>
                  </div>
                ))}
                {!marketStats.isLoading && !marketStats.data?.length && (
                  <p className="col-span-full py-5 text-center text-sm text-slate-500">尚无可显示的分类统计。</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70 text-white shadow-none">
            <CardHeader><CardTitle className="text-base">管理入口</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {destinations.map(item => (
                <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/5">
                  <item.icon className="h-4 w-4 text-cyan-400" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{item.label}</span><span className="block truncate text-xs text-slate-500">{item.detail}</span></span>
                  <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </AdminLayout>
  );
}
