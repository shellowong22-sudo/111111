import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const roles = ["all", "admin", "user", "trader", "risk_manager"] as const;
const assignableRoles = roles.filter((role): role is Exclude<(typeof roles)[number], "all"> => role !== "all");

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminUsers() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("all");
  const [page, setPage] = useState(1);
  const queryInput = useMemo(() => ({ page, pageSize: 20, search: search || undefined, role }), [page, search, role]);
  const usersQuery = trpc.admin.listUsers.useQuery(queryInput);
  const utils = trpc.useUtils();
  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: async () => {
      toast.success("用户角色已更新");
      await utils.admin.listUsers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: async () => {
      toast.success("用户已删除");
      await utils.admin.listUsers.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeRoleFilter = (nextRole: (typeof roles)[number]) => {
    setPage(1);
    setRole(nextRole);
  };

  const data = usersQuery.data;
  const isMutating = updateRole.isPending || deleteUser.isPending;

  return (
    <AdminLayout>
      <section className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Access control</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">用户管理</h1>
            <p className="mt-1 text-sm text-slate-400">通过真实的后台权限接口检索账户、分配职责并维护访问控制。</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => usersQuery.refetch()}
            disabled={usersQuery.isFetching}
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </header>

        <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4 lg:grid-cols-[minmax(0,1fr)_190px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }}
              placeholder="按名称、邮箱或 Open ID 搜索"
              className="border-slate-700 bg-slate-950 pl-9 text-slate-100"
            />
          </div>
          <select
            value={role}
            onChange={(event) => changeRoleFilter(event.target.value as (typeof roles)[number])}
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200"
            aria-label="按角色筛选"
          >
            {roles.map((item) => <option key={item} value={item}>{item === "all" ? "全部角色" : item}</option>)}
          </select>
          <Button type="button" onClick={applySearch} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">搜索</Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-300"><Users className="h-4 w-4 text-cyan-400" />{data ? `共 ${data.total} 位用户` : "正在读取用户"}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />角色变更保留服务端安全校验</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">用户</th><th className="px-4 py-3">Open ID</th><th className="px-4 py-3">角色</th><th className="px-4 py-3">创建时间</th><th className="px-4 py-3">最近登录</th><th className="px-4 py-3 text-right">操作</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {usersQuery.isLoading && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">正在加载用户数据…</td></tr>}
                {data?.data.map((user) => (
                  <tr key={user.id} className="text-slate-300">
                    <td className="px-4 py-3"><p className="font-medium text-slate-100">{user.name || "未命名用户"}</p><p className="mt-0.5 text-xs text-slate-500">{user.email || "未提供邮箱"}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.openId}</td>
                    <td className="px-4 py-3"><select value={user.role} onChange={(event) => updateRole.mutate({ userId: user.id, role: event.target.value as (typeof assignableRoles)[number] })} disabled={isMutating} aria-label={`更改 ${user.name || user.openId} 的角色`} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-cyan-200 disabled:opacity-50">{assignableRoles.map((item) => <option key={item} value={item}>{item}</option>)}</select></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.lastSignedIn)}</td>
                    <td className="px-4 py-3 text-right"><Button type="button" aria-label={`删除 ${user.name || user.openId}`} variant="ghost" size="icon" disabled={isMutating} onClick={() => { if (window.confirm(`确认删除用户“${user.name || user.openId}”吗？此操作无法撤销。`)) deleteUser.mutate({ userId: user.id }); }} className="h-8 w-8 text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
                {!usersQuery.isLoading && !data?.data.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500"><Users className="mx-auto mb-2 h-5 w-5" />未找到匹配的用户。</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {usersQuery.error && <p className="text-sm text-red-300">无法加载用户：{usersQuery.error.message}</p>}
        <footer className="flex items-center justify-between text-sm text-slate-400">
          <span>第 {data?.page ?? page} 页，共 {Math.max(data?.totalPages ?? 1, 1)} 页</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || usersQuery.isFetching} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"><ChevronLeft className="mr-1 h-4 w-4" />上一页</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={!data || page >= data.totalPages || usersQuery.isFetching} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">下一页<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </footer>
      </section>
    </AdminLayout>
  );
}
