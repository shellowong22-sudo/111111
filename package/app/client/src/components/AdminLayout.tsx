/**
 * 后台管理系统布局 - 与用户前台完全独立的双系统架构
 */
import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Users, Database, Activity, Settings, FileSearch, Bot, BrainCircuit, Boxes, Workflow,
  ChevronLeft, ChevronRight, Shield, LogOut, ArrowLeft,
  Menu, X, Megaphone,
  Globe2, PackageOpen,
} from 'lucide-react';
import { RadioTower } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { path: '/admin', label: '仪表盘', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/market-data', label: '数据管理', icon: Database },
  { path: '/admin/data-modules', label: '模块管理', icon: Boxes },
  { path: '/admin/automation-center', label: '自动化任务', icon: Workflow },
  { path: '/admin/data-ingestion', label: 'AI 数据采集', icon: Bot },
  { path: '/admin/ai-management', label: 'AI 管理', icon: BrainCircuit },
  { path: '/admin/ai-crawler', label: '专属 AI 爬虫', icon: Bot },
  { path: '/admin/scrapling', label: 'Scrapling 采集引擎', icon: Globe2 },
  { path: '/admin/openbb', label: 'OpenBB 研究引擎', icon: PackageOpen },
  { path: '/admin/agent-reach', label: '研究与知识工作台', icon: RadioTower },
  { path: '/admin/announcements', label: '公告管理', icon: Megaphone },
  { path: '/admin/export-registry', label: '下载登记', icon: FileSearch },
  { path: '/admin/monitor', label: '系统监控', icon: Activity },
  { path: '/admin/settings', label: '系统设置', icon: Settings },
  { path: '/secure-admin', label: '安全控制台', icon: Shield },
];
const NAV_GROUPS = [
  { title: '总览与权限', paths: ['/admin', '/admin/users', '/secure-admin', '/admin/monitor'] },
  { title: '数据与交付', paths: ['/admin/agent-reach', '/admin/market-data', '/admin/data-modules', '/admin/automation-center', '/admin/data-ingestion', '/admin/openbb'] },
  { title: 'AI 与运营', paths: ['/admin/ai-management', '/admin/ai-crawler', '/admin/scrapling', '/admin/announcements', '/admin/export-registry', '/admin/settings'] },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 权限检查
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">验证管理员权限...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4 p-8 rounded-xl border border-red-500/30 bg-red-500/5 max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">访问被拒绝</h1>
          <p className="text-slate-400 text-sm">
            {!isAuthenticated
              ? '请先登录后再访问管理后台。'
              : '您没有管理员权限，无法访问此页面。'}
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location === path;
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#070f1e] text-slate-100 flex">
      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* 侧边栏 */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 bg-[#09172a] border-r border-cyan-950/70 flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-slate-800 shrink-0">
          <Database className="w-6 h-6 text-cyan-400 shrink-0" />
          {!collapsed && (
            <div className="ml-2 overflow-hidden">
              <h1 className="text-sm font-bold text-white truncate">Ucheer · 管理终端</h1>
              <p className="text-[10px] uppercase tracking-widest text-cyan-500">PRIVATE CONTROL DESK</p>
            </div>
          )}
          {/* 移动端关闭按钮 */}
          <button onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 导航 */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto" aria-label="管理终端导航">
          {NAV_GROUPS.map(group => <div key={group.title} className="mb-4">
            {!collapsed && <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-700">{group.title}</div>}
            {NAV_ITEMS.filter(item => group.paths.includes(item.path)).map(item => {
            const active = isActive(item.path, item.exact);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "mb-0.5 w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 shadow-[inset_3px_0_0_#22d3ee]"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", active && "text-cyan-400")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
            })}
          </div>)}
        </nav>

        {/* 底部 */}
        <div className="p-2 border-t border-slate-800 space-y-1 shrink-0">
          <Link href="/" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors">
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {!collapsed && <span>返回前台</span>}
          </Link>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>退出登录</span>}
          </button>
          {/* 折叠按钮 */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        collapsed ? "lg:ml-16" : "lg:ml-60"
      )}>
        {/* 顶部栏 */}
        <header className="min-h-14 border-b border-cyan-950/70 bg-[#0b1a2c]/95 backdrop-blur-sm flex flex-wrap items-center gap-2 px-4 py-2 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden mr-3 text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-600">Ucheer / Admin terminal</p>
            <p className="truncate text-sm font-semibold text-white">{NAV_ITEMS.find(item => isActive(item.path, item.exact))?.label ?? '管理员工作区'}</p>
          </div>
          <div className="hidden items-center gap-1 lg:flex">
            <Link href="/admin/agent-reach?desk=knowledge" className="rounded border border-cyan-800/50 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10">资料库 · 全库库存</Link>
            <Link href="/admin/automation-center" className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60">自动任务</Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {user?.name || user?.email}
            </span>
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-cyan-400">
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <div className="mx-auto max-w-[1920px] p-3 sm:p-5">
          {children}
        </div>
      </main>
    </div>
  );
}
