import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import {
  Bell, Check, CheckCheck, Trash2, ArrowLeft, Megaphone,
  AlertTriangle, Clock3, Info, Settings2, Wifi, WifiOff, Save, ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import MktbeatDigestCompactDetails from '@/components/MktbeatDigestCompactDetails';
import { toast } from 'sonner';
import { useSSENotifications } from '@/hooks/useSSENotifications';

type FilterType = 'all' | 'unread' | 'read' | 'due_soon';
type ViewType = 'list' | 'preferences';

const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  announcement: { icon: Megaphone, color: 'text-blue-400', label: '公告' },
  system: { icon: Settings2, color: 'text-purple-400', label: '系统' },
  alert: { icon: AlertTriangle, color: 'text-amber-400', label: '警告' },
  info: { icon: Info, color: 'text-cyan-400', label: '通知' },
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewType>('list');
  const [navigatingNotificationId, setNavigatingNotificationId] = useState<number | null>(null);

  // SSE real-time connection
  const { unreadCount: sseUnreadCount, connected: sseConnected, setUnreadCount: setSseUnreadCount, lastEventAt, reconnectCount } = useSSENotifications();

  const { data, refetch, isLoading } = trpc.notification.list.useQuery(
    { filter, page, pageSize: 20 },
    { enabled: !!user }
  );

  // Sync SSE unread count with actual data
  useEffect(() => {
    if (data?.unreadCount !== undefined) {
      setSseUnreadCount(data.unreadCount);
    }
  }, [data?.unreadCount, setSseUnreadCount]);

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => { refetch(); setSseUnreadCount(0); },
  });
  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const clearReadMutation = trpc.notification.clearRead.useMutation({
    onSuccess: () => refetch(),
  });
  const openRelatedNotification = (item: { id: number; isRead: boolean; relatedType?: string | null }) => {
    if (!item.isRead) markReadMutation.mutate({ id: item.id });
    const target = item.relatedType === 'mktbeat_threshold' || item.relatedType === 'mktbeat_threshold_digest' ? '/?module=money-market&open=mktbeat'
      : item.relatedType === 'source_freshness' || item.relatedType === 'source_freshness_digest' || item.relatedType === 'source_freshness_copy' ? '/?module=money-market&open=source-mm'
        : item.relatedType === 'mmflow_delivery_review' || item.relatedType === 'mmflow_delivery_deadline' ? '/?module=money-market&open=mmflow' : null;
    if (!target) return;
    setNavigatingNotificationId(item.id);
    toast.info('正在打开终端详情…');
    window.setTimeout(() => navigate(target), 180);
  };

  // Notification preferences
  const { data: prefsData, isLoading: prefsLoading } = trpc.notification.getPreferences.useQuery(
    undefined,
    { enabled: !!user && view === 'preferences' }
  );
  const [prefs, setPrefs] = useState({
    announcements: true,
    systemAlerts: true,
    marketAlerts: true,
    infoMessages: true,
  });
  useEffect(() => {
    if (prefsData) setPrefs(prefsData);
  }, [prefsData]);

  const updatePrefsMutation = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => toast.success('通知偏好已保存'),
    onError: () => toast.error('保存失败，请重试'),
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  const items = data?.items || [];
  const total = data?.total || 0;
  const unreadCount = sseUnreadCount || data?.unreadCount || 0;
  const dueSoonCount = data?.dueSoonCount || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">消息中心</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            {/* SSE connection status */}
            <div
              className={cn("flex items-center gap-1 text-xs", sseConnected ? "text-green-500" : "text-slate-500")}
              title={sseConnected ? "实时推送已连接" : "实时推送未连接"}
            >
              {sseConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{sseConnected ? "实时" : "离线"}</span>
              <span className="hidden md:inline text-[10px] text-muted-foreground" title={lastEventAt ? new Date(lastEventAt).toLocaleString() : '尚未收到事件'}>
                {lastEventAt ? `最后事件 ${new Date(lastEventAt).toLocaleTimeString()}` : '等待事件'} · 重连 {reconnectCount}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                全部已读
              </Button>
            )}
            {view === 'list' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearReadMutation.mutate()}
                disabled={clearReadMutation.isPending}
                className="text-xs gap-1 text-muted-foreground"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空已读
              </Button>
            )}
            <Button
              variant={view === 'preferences' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView(v => v === 'list' ? 'preferences' : 'list')}
              className="text-xs gap-1"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {view === 'list' ? '偏好设置' : '消息列表'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── 通知偏好设置 ── */}
        {view === 'preferences' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-base font-semibold mb-1">通知偏好设置</h2>
              <p className="text-sm text-muted-foreground mb-5">
                选择您希望接收的通知类型。关闭后，该类型通知将不再推送给您。
              </p>
              {prefsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    {
                      key: 'announcements' as const,
                      label: '系统公告',
                      desc: '平台重要公告、功能更新、维护通知',
                      icon: Megaphone,
                      color: 'text-blue-400',
                    },
                    {
                      key: 'systemAlerts' as const,
                      label: '系统警告',
                      desc: '账号安全、登录异常、权限变更等系统级警告',
                      icon: AlertTriangle,
                      color: 'text-amber-400',
                    },
                    {
                      key: 'marketAlerts' as const,
                      label: '市场提醒',
                      desc: '价格预警、重大市场事件、持仓风险提示',
                      icon: Bell,
                      color: 'text-green-400',
                    },
                    {
                      key: 'infoMessages' as const,
                      label: '普通通知',
                      desc: '一般性信息推送、活动通知、功能提示',
                      icon: Info,
                      color: 'text-cyan-400',
                    },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-md bg-muted/50", item.color)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <Label className="text-sm font-medium cursor-pointer">{item.label}</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                        <Switch
                          checked={prefs[item.key]}
                          onCheckedChange={val => setPrefs(p => ({ ...p, [item.key]: val }))}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => updatePrefsMutation.mutate(prefs)}
                  disabled={updatePrefsMutation.isPending}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  {updatePrefsMutation.isPending ? '保存中...' : '保存设置'}
                </Button>
              </div>
            </div>

            {/* SSE connection status card */}
            <div className={cn(
              "flex items-start gap-3 p-4 rounded-xl border text-sm",
              sseConnected
                ? "bg-green-500/5 border-green-500/20 text-green-300"
                : "bg-slate-500/5 border-slate-500/20 text-slate-400"
            )}>
              {sseConnected
                ? <Wifi className="w-4 h-4 mt-0.5 shrink-0" />
                : <WifiOff className="w-4 h-4 mt-0.5 shrink-0" />
              }
              <div>
                <div className="font-medium mb-0.5">
                  {sseConnected ? "实时推送已连接" : "实时推送未连接"}
                </div>
                <div className="text-xs opacity-80">
                  {sseConnected
                    ? "您将在有新通知时立即收到推送提醒，无需刷新页面。"
                    : "实时推送连接断开，新通知将在您下次刷新页面时显示。系统会自动尝试重连。"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 消息列表 ── */}
        {view === 'list' && (
          <>
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 mb-4 bg-muted/30 p-1 rounded-lg w-fit">
              {(['all', 'unread', 'due_soon', 'read'] as FilterType[]).map(f => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setFilter(f); setPage(1); }}
                  className="text-xs h-7"
                >
                  {f === 'all' ? '全部' : f === 'unread' ? '未读' : f === 'due_soon' ? '即将到期' : '已读'}
                  {f === 'unread' && unreadCount > 0 && (
                    <span className="ml-1 bg-red-500/20 text-red-400 px-1 rounded text-[10px]">
                      {unreadCount}
                    </span>
                  )}
                  {f === 'due_soon' && dueSoonCount > 0 && (
                    <span className="ml-1 bg-amber-500/20 text-amber-300 px-1 rounded text-[10px]">
                      {dueSoonCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Notification List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Bell className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">
                  暂无{filter === 'unread' ? '未读' : filter === 'read' ? '已读' : filter === 'due_soon' ? '即将到期' : ''}消息
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item: any) => {
                  const config = typeConfig[item.type] || typeConfig.info;
                  const Icon = config.icon;
                  const isSignatureExpiring = item.relatedType === 'checklist_export' && item.type === 'alert';
                  const isReviewDue = item.relatedType === 'checklist_template_archive' && item.type === 'alert';
                  const isMmflowDeadline = item.relatedType === 'mmflow_delivery_deadline' && item.type === 'alert';
                  const isSourceRuleCopy = item.relatedType === 'source_freshness_copy' && item.type === 'info';
                  const isMktbeatThreshold = (item.relatedType === 'mktbeat_threshold' || item.relatedType === 'mktbeat_threshold_digest') && (item.type === 'alert' || item.type === 'info');
                  const isMktbeatDigest = item.relatedType === 'mktbeat_threshold_digest' && item.type === 'info';
                  const isDueSoon = isSignatureExpiring || isReviewDue || isMmflowDeadline;
                  const deadlineTone = isReviewDue ? 'border-rose-500/50 bg-rose-500/10' : isMmflowDeadline ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-amber-500/50 bg-amber-500/10';
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "group relative bg-card border rounded-lg p-4 transition-all duration-200 hover:border-primary/30",
                        navigatingNotificationId === item.id && "translate-x-1 border-cyan-500/60 bg-cyan-950/20",
                        isDueSoon ? deadlineTone : item.isRead ? "border-border opacity-70" : "border-primary/20 bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {!item.isRead && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                        <div className={cn("mt-0.5 p-1.5 rounded-md bg-muted/50", config.color)}>
                          {isDueSoon ? <Clock3 className={cn("w-4 h-4", isReviewDue ? 'text-rose-300' : isMmflowDeadline ? 'text-cyan-300' : 'text-amber-300')} /> : <Icon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", config.color, "bg-current/10")}>
                              {isDueSoon ? isReviewDue ? '临期 · 审阅' : isMmflowDeadline ? '临期 · MMFLOW' : '临期 · 签名' : isSourceRuleCopy ? 'SOURCE · 规则复制' : config.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString('zh-CN', {
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <h3 className={cn("text-sm font-medium mb-1", !item.isRead && "text-foreground")}>
                            {item.title}
                          </h3>
                          {item.type === 'announcement' ? (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs max-h-48 overflow-y-auto">
                              <div
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: item.content || ''
                                }}
                              />
                            </div>
                          ) : (
                            <p
                              className="text-xs text-muted-foreground line-clamp-2"
                              dangerouslySetInnerHTML={{
                                __html: (item.content || '').replace(/<[^>]*>/g, ' ').slice(0, 120)
                              }}
                            />
                          )}
                          {isMktbeatDigest && <MktbeatDigestCompactDetails notificationId={item.id} />}
                          {isMktbeatThreshold && (
                            <button type="button" disabled={navigatingNotificationId === item.id} onClick={() => openRelatedNotification(item)} className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 transition-all duration-150 hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60">
                              {navigatingNotificationId === item.id ? '正在打开…' : '查看 MKTBEAT 数据详情'} <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                          {isMmflowDeadline && (
                            <button type="button" disabled={navigatingNotificationId === item.id} onClick={() => openRelatedNotification(item)} className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 transition-all duration-150 hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60">
                              {navigatingNotificationId === item.id ? '正在打开…' : '打开 MMFLOW 审批交付包'} <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                          {isSourceRuleCopy && (
                            <button type="button" disabled={navigatingNotificationId === item.id} onClick={() => openRelatedNotification(item)} className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 transition-all duration-150 hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60">
                              {navigatingNotificationId === item.id ? '正在打开…' : '查看 SOURCE 时效规则'} <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!item.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => markReadMutation.mutate({ id: item.id })}
                              title="标记已读"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate({ id: item.id })}
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="text-xs"
                >
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="text-xs"
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
