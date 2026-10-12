/**
 * 佑诚数据工作台（管理后台）：快速搭建、清洗、推送、权限、监控。
 *
 *  一键接入 · 数据源 · 数据集与清洗 · 模块工作台（前后台同屏）· 推送中心 · 权限管理 · 日志与监控
 *  后台看到的模块与前端完全一致（同一渲染器、同一份数据），确认后一键推送到前端对应页面；前端不显示任何数据来源。
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Database, FileArchive, History, Layers3, Loader2, Radio, ShieldCheck, Terminal, Wifi } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import UploadPanel from './uc/UploadPanel';
import SourcesPanel from './uc/SourcesPanel';
import DatasetsPanel from './uc/DatasetsPanel';
import ModuleStudio from './uc/ModuleStudio';
import { MembersPanel, MonitorPanel, PushCenter } from './uc/OpsPanels';

type Tab = 'upload' | 'sources' | 'datasets' | 'studio' | 'push' | 'members' | 'logs';

export default function UcheerStudio() {
  const [tab, setTab] = useState<Tab>('upload');
  const [focusModule, setFocusModule] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState<number | null>(null);
  const me = trpc.ucAdmin.me.useQuery(undefined, { retry: false });
  const rebuild = trpc.ucAdmin.rebuild.useMutation({ onSuccess: () => toast.success('已开始重建，约 2 分钟后自动重启生效'), onError: (e) => toast.error(e.message) });
  const overview = trpc.ucAdmin.overview.useQuery(undefined, { retry: false, refetchInterval: 30_000, enabled: !!me.data });
  const c = overview.data?.counts ?? {};
  const openModule = (id: number | null) => { setFocusModule(id); setTab('studio'); };
  const openDatasets = (sourceId: number | null) => { setSourceFilter(sourceId); setTab('datasets'); };

  if (me.isLoading) return <div className="flex min-h-[300px] items-center justify-center text-xs text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载工作台…</div>;
  if (me.error || !me.data) return <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-200">{me.error?.message ?? '没有访问权限'}</div>;
  const perms = me.data.perms;

  const tabs: Array<[Tab, string, typeof FileArchive, boolean]> = [
    ['upload', 'zip 一键接入', FileArchive, true],
    ['sources', '数据源', Terminal, true],
    ['datasets', '数据集与清洗', Database, true],
    ['studio', '模块工作台（前后台同屏）', Layers3, true],
    ['push', '推送中心', Radio, true],
    ['members', '权限管理', ShieldCheck, perms.manageMembers],
    ['logs', '日志与监控', History, true],
  ];

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/[0.08] via-transparent to-transparent p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Ucheer data studio</p>
          <h2 className="mt-1 text-xl font-semibold text-white">佑诚数据工作台</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">上传 zip 或接入接口 / 数据库 / 行情 / 脚本，自动清洗、去重、脱敏后入库；这里看到的模块与前端完全一致，确认后一键推送到前端对应页面。前端不显示任何数据来源。</p>
          <p className="mt-1 text-[11px] text-slate-500">{perms.manageMembers && <button type="button" disabled={rebuild.isPending} onClick={() => { if (window.confirm('重新构建前端并重启服务？约 2 分钟内页面会短暂不可用。')) rebuild.mutate(); }} className="mr-2 border border-teal-700 px-1.5 text-teal-200 hover:bg-teal-900/40">重建并重启</button>}当前身份：{me.data.name || '—'} · <span className="text-teal-300">{me.data.roleLabel}</span>{overview.data && <span className="ml-2 inline-flex items-center gap-1"><Wifi className="h-3 w-3 text-teal-300" />{overview.data.liveClients} 个前端页面在线接收推送</span>}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5 xl:grid-cols-9">
          {[['数据源', c.sources], ['数据集', c.datasets], ['模块', c.modules], ['已上线', c.published], ['待审核', c.pendingReview], ['未处理告警', c.openAlerts], ['24h 运行', c.runs24h], ['24h 失败', c.failed24h], ['24h 推送', c.pushes24h]].map(([k, v]) => (
            <div key={String(k)} className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5"><div className={`text-base font-semibold ${(k === '24h 失败' || k === '未处理告警') && Number(v) > 0 ? 'text-amber-300' : 'text-slate-100'}`}>{overview.isLoading ? '…' : Number(v ?? 0)}</div><div className="text-[10px] text-slate-500">{k}</div></div>
          ))}
        </div>
      </header>
      {overview.error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">工作台无法连接数据库：{overview.error.message}</div>}

      <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
        {tabs.filter(([, , , show]) => show).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${tab === key ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}><Icon className="h-3.5 w-3.5" />{label}</button>
        ))}
      </nav>

      {tab === 'upload' && <UploadPanel canUpload={perms.manageSources} onOpenModule={openModule} onOpenDatasets={openDatasets} />}
      {tab === 'sources' && <SourcesPanel perms={perms} onOpenDatasets={openDatasets} />}
      {tab === 'datasets' && <DatasetsPanel perms={perms} sourceFilter={sourceFilter} onClearSource={() => setSourceFilter(null)} onOpenModule={openModule} />}
      {tab === 'studio' && <ModuleStudio perms={perms} focus={focusModule} onFocus={setFocusModule} />}
      {tab === 'push' && <PushCenter canPublish={perms.publish} onOpenDataset={() => openDatasets(null)} />}
      {tab === 'members' && perms.manageMembers && <MembersPanel selfId={me.data.userId} />}
      {tab === 'logs' && <MonitorPanel />}
    </section>
  );
}
