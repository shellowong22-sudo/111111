import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Database, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const formatSize = (bytes: number) => bytes < 1024 * 1024
  ? `${(bytes / 1024).toFixed(1)} KB`
  : bytes < 1024 ** 3 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / (1024 ** 3)).toFixed(2)} GiB`;
const formatTime = (time: Date | string | null | undefined) => time ? new Date(time).toLocaleString("zh-CN") : "未记录";
const inputClass = "w-full rounded-md border border-slate-700 bg-[#071324] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500";
const sourceErrorLabel = (message: string) => {
  if (message.includes("FT_NEEDS_LICENSED_REPUBLISHING_FEED")) return "FT 需要正式的内容再分发许可与授权数据接入，公开网页访问不等于有权将其新闻自动提供给终端。";
  if (message.includes("EXTERNAL_WEB_NEWS_REQUIRES_AUTHORIZED_FEED")) return "公开网页只能留在后台作资料核验；请通过有权使用的真实订阅源授权新闻，不会把首页或抓取全文直接推给前端。";
  if (message.includes("NEWS_PAGE_CHROME_OR_ARTICLE_LIST") || message.includes("NEWS_PORTAL_IS_NOT_AN_ARTICLE") || message.includes("NEWS_REQUIRES_SINGLE_ARTICLE_TITLE")) return "该资料是站点首页、菜单或多篇文章列表，并非一篇可交付新闻；原始资料仍保留在后台。";
  if (message.includes("NEWS_ARTICLE_URL_REQUIRED") || message.includes("NEWS_PUBLIC_EXCERPT_REQUIRED")) return "需要独立文章链接和来源真实提供的公开摘要；不能用栏目页或拼接文本冒充新闻。";
  if (message.includes("NEWS_ARTICLE_SOURCE_MUST_MATCH_APPROVED_FEED")) return "订阅源指向其他发布方的网站，不能将未经授权的跨站文章自动转发为本来源新闻。";
  if (message.includes("SOURCE_RESPONSE_NOT_RSS")) return "来源当前返回的不是 RSS/Atom；不会把普通网页错误解析为自动更新的订阅源。";
  if (message.includes("SOURCE_PUBLIC_FEED_NOT_DISCOVERED")) return "该网页没有可验证的公开 RSS/Atom 入口。请提供发布方官方订阅地址；不能把普通网页伪装成自动数据接口。";
  if (message.includes("SOURCE_HAS_NO_DELIVERABLE_CLEANED_RECORD")) return "订阅源可读取，但当前没有符合该功能质量和使用边界的已清洗资料；没有授权发布。";
  if (message.includes("SOURCE_NOT_VERIFIED_AVAILABLE") || message.includes("SOURCE_HEALTH_UNAVAILABLE_RECHECK_BEFORE_AUTHORIZATION")) return "该订阅源最近检查不可用。请重新检测为可用后再授权交付。";
  if (message.includes("MODULE_HAS_NO_VERIFIED_FRONTEND_FEED")) return "该功能尚无已核验的 Agent Reach 前端资料读取入口，不能标记为已接通。";
  if (message.includes("PUBLIC_FEED_HAS_NO_QUALITY_APPROVED_EXCERPT")) return "来源能访问，但没有通过质量检查且允许展示的公开摘要；没有开通前端交付。";
  if (message.includes("PUBLIC_FEED_HAS_NO_VERIFIED_FULL_ARTICLE")) return "官方订阅源可读，但没有核验通过的完整新闻正文；没有把摘要冒充全文推送给 TOP。";
  if (message.includes("SOURCE_HTTP_") || message.includes("RSS 源 HTTP")) return `来源服务器暂不可用：${message}`;
  return message;
};

export default function AgentReachKnowledgeDesk({ databaseConfigured }: { databaseConfigured: boolean }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [publicSourceUrl, setPublicSourceUrl] = useState("");
  const [webCaptureUrl, setWebCaptureUrl] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [sourceModuleSearch, setSourceModuleSearch] = useState("");
  const [sourceTarget, setSourceTarget] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [content, setContent] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "internal" | "public">("all");
  const [approval, setApproval] = useState<"all" | "approved" | "private">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetModule, setTargetModule] = useState("");
  const [followRss, setFollowRss] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const inventory = trpc.agentReachAdmin.storageInventory.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const overview = trpc.agentReachAdmin.dashboard.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const list = trpc.agentReachAdmin.browseKnowledge.useQuery(
    { page, pageSize: 20, query, source, approval }, { retry: false },
  );
  const detail = trpc.agentReachAdmin.knowledgeDetail.useQuery(
    { id: selectedId ?? "ard_00000000000000000000000000000000" },
    { enabled: Boolean(selectedId), retry: false },
  );
  const delivery = trpc.agentReachAdmin.deliveryGrants.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const publicSources = trpc.agentReachAdmin.publicSources.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const topArchive = trpc.agentReachAdmin.deliveredTopNewsArchive.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const refresh = () => {
    void utils.agentReachAdmin.storageInventory.invalidate();
    void utils.agentReachAdmin.browseKnowledge.invalidate();
    void utils.agentReachAdmin.knowledgeDetail.invalidate();
    void utils.agentReachAdmin.deliveryGrants.invalidate();
    void utils.agentReachAdmin.publicSources.invalidate();
    void utils.agentReachAdmin.deliveredTopNewsArchive.invalidate();
  };
  const ingest = trpc.agentReachAdmin.ingestCompanyInput.useMutation({
    onSuccess: receipt => {
      if (receipt.status === "unavailable" || receipt.status === "empty") {
        toast.error(`未入库：${receipt.error ?? "质量校验不通过"}`);
        return;
      }
      toast.success(`新增 ${receipt.stored} 条，去重 ${receipt.deduplicated} 条，拒收 ${receipt.rejected} 条`);
      if (receipt.stored) { setTitle(""); setContent(""); setPage(1); refresh(); }
    },
    onError: error => toast.error(`入库失败：${error.message}`),
  });
  const approve = trpc.agentReachAdmin.approveKnowledge.useMutation({
    onSuccess: receipt => {
      toast.success(receipt.approved ? "本条资料已批准给 Ucheer AI 检索" : "已撤销本条资料的 Ucheer 检索权限");
      refresh();
    },
    onError: error => toast.error(`Ucheer 授权失败：${error.message}`),
  });
  const grant = trpc.agentReachAdmin.setDeliveryGrant.useMutation({
    onSuccess: receipt => {
      const messages: Record<string, string> = {
        delivered: "本条已交付到所选功能",
        already_delivered: "该条已交付，没有重复写入",
        duplicate: "相同内容已交付，拦截重复",
        quality_rejected: "质量不满足前端展示条件，授权已保存但未交付",
        front_feed_rejected: "功能读取规则拒绝了本条，授权已保存但未交付",
        not_authorized: "本条没有获得有效授权",
        revoked: "前端授权已撤销",
      };
      const message = messages[receipt.delivered] ?? receipt.delivered;
      if (["quality_rejected", "front_feed_rejected", "not_authorized"].includes(receipt.delivered)) toast.warning(message);
      else toast.success(message);
      refresh();
    },
    onError: error => toast.error(`授权失败：${sourceErrorLabel(error.message)}`),
  });
  const runDaily = trpc.agentReachAdmin.runDailyDelivery.useMutation({
    onSuccess: receipt => {
      const delivered = receipt.receipts.filter(item => item.result === "delivered").length;
      const failed = receipt.receipts.filter(item => ["front_feed_rejected", "quality_rejected"].includes(item.result)).length;
      toast[failed ? "warning" : "success"](`本次新增交付 ${delivered} 条；未通过检查 ${failed} 条；刷新来源 ${receipt.refreshed.length} 个`);
      refresh();
    },
    onError: error => toast.error(`每日交付失败：${error.message}`),
  });
  const connectSource = trpc.agentReachAdmin.registerPublicSource.useMutation({
    onSuccess: receipt => {
      if (receipt.status === "available") toast.success(`网址可用：入库 ${receipt.newlyStored} 条，去重 ${receipt.deduplicated} 条；请选择前端功能授权`);
      else toast.warning(`网址不可用：${sourceErrorLabel(receipt.error ?? "未知原因")}`);
      refresh();
    },
    onError: error => toast.error(`网址检测失败：${sourceErrorLabel(error.message)}`),
  });
  const captureWeb = trpc.agentReachAdmin.capturePublicWebSource.useMutation({
    onSuccess: receipt => {
      if (receipt.status === "available")
        toast.success(`网页已采集：新增 ${receipt.newlyStored} 条、去重 ${receipt.deduplicated} 条；仅后台保存`);
      else toast.warning(`网页采集失败：${sourceErrorLabel(receipt.error ?? "未知原因")}`);
      refresh();
    },
    onError: error => toast.error(`网页采集失败：${sourceErrorLabel(error.message)}`),
  });
  const authorizeSource = trpc.agentReachAdmin.authorizePublicSource.useMutation({
    onSuccess: receipt => {
      if (["quality_rejected", "front_feed_rejected"].includes(receipt.status))
        toast.warning(`已保存授权，但前端未接收：${receipt.status}`);
      else toast.success(`目标已授权，本次实际新增 ${receipt.deliveredCount} 条；后续由每日任务读取新资料`);
      refresh();
    },
    onError: error => toast.error(`授权失败：${sourceErrorLabel(error.message)}`),
  });
  useEffect(() => {
    if (selectedId && list.data && !list.data.items.some(item => item.id === selectedId) &&
      (query || source !== "all" || approval !== "all")) setSelectedId(null);
  }, [selectedId, list.data, query, source, approval]);
  const record = detail.data;
  const selectedGrants = delivery.data?.grants.filter(item => item.recordUuid === selectedId && item.isEnabled) ?? [];
  const filteredCatalog = (delivery.data?.catalog ?? []).filter(item =>
    `${item.name} ${item.id} ${item.domain} ${item.path}`.toLowerCase().includes(sourceModuleSearch.trim().toLowerCase()));
  const maxPage = Math.max(1, Math.ceil((list.data?.total ?? 0) / 20));

  return <div className="space-y-4 p-4 text-slate-100 sm:p-5" data-testid="agent-reach-knowledge-desk">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-cyan-400">Data custody / 管理员专用</p>
        <h3 className="mt-1 text-xl font-semibold">终端数据资产与清洗资料</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">这里展示数据库实际库存。选择一条资料可核对原始→清洗→入库，再分别决定 AI 检索权与指定功能交付权。</p></div>
      <button type="button" onClick={refresh} disabled={inventory.isFetching || list.isFetching}
        className="inline-flex items-center gap-2 rounded border border-cyan-600/70 px-3 py-2 text-xs text-cyan-100 disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${inventory.isFetching || list.isFetching ? "animate-spin" : ""}`} />刷新数据库
      </button>
    </header>
    <section aria-label="任意公开网页单次采集" className="rounded-lg border border-cyan-800/60 bg-[#0c1b2d] p-4">
      <h4 className="text-base font-semibold text-white">公开网页 · 单次执行与入库统计</h4>
      <p className="mt-1 text-xs leading-5 text-slate-400">与「技能执行 → 网页」相同的只读采集链路。输入任意可公开读取的网址，查看实际返回、采集时间、新增、去重、拒收和质量；同一网址再次执行会继续去重。普通网页只留在后台，不能作为自动订阅或未经许可的前端新闻。</p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); if (webCaptureUrl.trim() && !captureWeb.isPending) captureWeb.mutate({ websiteUrl: webCaptureUrl.trim() }); }}>
        <input aria-label="单次采集的公开网址" type="url" required value={webCaptureUrl}
          onChange={event => setWebCaptureUrl(event.target.value)}
          className={`min-w-0 flex-1 ${inputClass}`} placeholder="https://example.com/article" />
        <button type="submit" disabled={!databaseConfigured || !webCaptureUrl.trim() || captureWeb.isPending}
          className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">
          {captureWeb.isPending ? "正在读取与清洗…" : "运行网页技能并统计"}</button>
      </form>
      {captureWeb.data && <div role="status" className="mt-3 rounded border border-slate-700 bg-[#071324] p-3 text-xs text-slate-200">
        <div className={captureWeb.data.status === "available" ? "text-emerald-300" : "text-rose-300"}>
          {captureWeb.data.status === "available" ? "网页可读 · 单次采集（非订阅）" : `不可用 · ${sourceErrorLabel(captureWeb.data.error ?? "未知原因")}`}
        </div>
        <p className="mt-1 break-all">{captureWeb.data.websiteUrl} · {formatTime(captureWeb.data.checkedAt)}</p>
        <p className="mt-1">本次读取 {captureWeb.data.sourceItems} · 新增 {captureWeb.data.newlyStored} · 去重 {captureWeb.data.deduplicated} · 拒收 {captureWeb.data.rejected} · 平均质量 {captureWeb.data.qualityAverage ?? "—"}</p>
        {captureWeb.data.title && <p className="mt-2 font-semibold">{captureWeb.data.title}</p>}
        {captureWeb.data.preview && <details className="mt-2"><summary className="cursor-pointer text-cyan-300">查看真实返回节选</summary>
          <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-slate-400">{captureWeb.data.preview}</p></details>}
        <p className="mt-2 text-slate-500">{captureWeb.data.boundary}</p>
      </div>}
    </section>
    <section aria-label="公开来源连接器" className="rounded-lg border border-cyan-800/60 bg-[#0c1b2d] p-4">
      <h4 className="text-base font-semibold text-white">公开网址接入 · 健康状态 · 指定前端功能</h4>
      <p className="mt-1 text-xs leading-5 text-slate-400">添加网站或 RSS/Atom：先验证可自动订阅的公开数据源、清洗去重、入库，再人工指定可交付的现有功能。普通网页即使能打开，没有可核验的订阅入口也不能伪装成每日更新接口；失败原因会保留。未授权时不推送前端。</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="公开来源网站或 RSS 地址" type="url" value={publicSourceUrl}
        onChange={event => setPublicSourceUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !connectSource.isPending && publicSourceUrl.trim() && rightsConfirmed) connectSource.mutate({ websiteUrl: publicSourceUrl.trim(), rightsConfirmed: true }); }}
        className={`min-w-0 flex-1 ${inputClass}`} placeholder="https://example.com/ 或 https://example.com/feed.xml" />
        <button type="button" disabled={!databaseConfigured || !publicSourceUrl.trim() || !rightsConfirmed || connectSource.isPending}
          onClick={() => connectSource.mutate({ websiteUrl: publicSourceUrl.trim(), rightsConfirmed: true })}
          className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{connectSource.isPending ? "正在检测与清洗…" : "检测网址并入库"}</button></div>
      <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-300"><input type="checkbox" className="mt-1" checked={rightsConfirmed} onChange={event => setRightsConfirmed(event.target.checked)} />
        我已确认对拟授权展示的内容具有相应使用及再分发权限；公开可访问不等于可转载。接入不会绕过付费墙。</label>
      {connectSource.data && <p role="status" className="mt-2 break-words text-xs text-slate-200">
        {connectSource.data.status === "available" ? `可用 · ${connectSource.data.feedUrl} · 本次读取 ${connectSource.data.sourceItems} 条、入库 ${connectSource.data.newlyStored} 条、去重 ${connectSource.data.deduplicated} 条` : `不可用 · ${sourceErrorLabel(connectSource.data.error ?? "未知原因")}`}</p>}
      {connectSource.isError && <p role="alert" className="mt-2 text-xs text-rose-300">检测失败：{sourceErrorLabel(connectSource.error.message)}</p>}
      <div className="mt-3 grid gap-2 border-t border-slate-700 pt-3 sm:grid-cols-[minmax(200px,1fr)_minmax(280px,2fr)]">
        <label className="text-xs text-slate-300">筛选现有前端功能<input aria-label="筛选前端功能" value={sourceModuleSearch}
          onChange={event => { setSourceModuleSearch(event.target.value); setSourceTarget(""); }} className={`mt-1 ${inputClass}`} placeholder="名称、分类、编号、路径" /></label>
        <label className="text-xs text-slate-300">授权目标（未接通的功能不可选择）
          <select aria-label="来源授权目标" className={`mt-1 ${inputClass}`} value={sourceTarget} onChange={event => setSourceTarget(event.target.value)}>
            <option value="">请选择真实可交付的前端功能</option>
            {filteredCatalog.map(item => <option key={item.id} value={item.id} disabled={!item.deliverable}>
              {item.domain} / {item.name} · {item.deliverable ? "已验证可交付" : "尚无前端读取入口"}
            </option>)}
          </select></label>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">匹配 {filteredCatalog.length} 个功能；其中 {filteredCatalog.filter(item => item.deliverable).length} 个经过读取验证。未接通的功能不会伪装成已推送，仍需逐项开发其数据入口。</p>
      {publicSources.isError && <p role="alert" className="mt-2 text-xs text-rose-300">来源状态读取失败：{publicSources.error.message}</p>}
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {publicSources.data?.map(item => {
          const activeGrants = (delivery.data?.grants ?? []).filter(entry => entry.isEnabled && entry.followRss && entry.rssUrl === item.feedUrl);
          return <div key={item.id} className="rounded border border-slate-700 bg-[#071324] p-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2"><span className="min-w-0 break-all text-slate-100">{item.websiteUrl}</span>
              <strong className={item.status === "available" ? "text-emerald-300" : "text-rose-300"}>{item.mode === "web_once"
                ? item.status === "available" ? "网页可读 · 非订阅" : "网页采集失败"
                : item.status === "available" ? "订阅可用" : "订阅不可用"}</strong></div>
            <div className="mt-1 break-all text-slate-400">最近检查 {formatTime(item.lastCheckedAt)} · 最近读取 {item.sourceItems} · 累计入库 {item.storedCount} · 累计去重 {item.deduplicatedCount}{item.feedUrl ? ` · 订阅 ${item.feedUrl}` : ""}</div>
            {item.lastError && <div className="mt-1 text-rose-300">失败原因：{sourceErrorLabel(item.lastError)}</div>}
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" disabled={item.mode === "feed" ? !rightsConfirmed || connectSource.isPending : captureWeb.isPending}
                className="text-cyan-300 underline disabled:opacity-40" onClick={() => item.mode === "web_once"
                  ? captureWeb.mutate({ websiteUrl: item.websiteUrl })
                  : connectSource.mutate({ websiteUrl: item.websiteUrl, rightsConfirmed: true })}>重新检测</button>
              {item.mode === "feed" && <button type="button" disabled={item.status !== "available" || !item.feedUrl || !sourceTarget || authorizeSource.isPending}
                className="text-emerald-300 underline disabled:opacity-40" onClick={() => authorizeSource.mutate({ sourceId: item.id, moduleId: sourceTarget })}>授权给选定功能并实际交付</button>
              }
            </div>
            {activeGrants.map(entry => <div key={entry.id} className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2 text-slate-300">
              <span>{delivery.data?.modules.find(module => module.id === entry.moduleId)?.name ?? entry.moduleId} · 已交付 {entry.deliveredCount} 条 · 最近 {formatTime(entry.lastDeliveredAt)}</span>
              <button type="button" disabled={grant.isPending} className="text-amber-300 underline disabled:opacity-40"
                onClick={() => grant.mutate({ recordUuid: entry.recordUuid, moduleId: entry.moduleId, enabled: false, followRss: false })}>撤销授权</button>
            </div>)}
          </div>;
        })}
        {publicSources.data?.length === 0 && <p className="text-xs text-slate-400">尚未登记网址；已存在的老新闻订阅授权仍保持原状。</p>}
      </div>
    </section>
    <section aria-label="TOP 已交付新闻永久归档" className="rounded-lg border border-cyan-800/60 bg-[#0c1b2d] p-4">
      <h4 className="text-base font-semibold text-white">TOP 已交付新闻 · 数据库归档</h4>
      <p className="mt-1 text-xs text-slate-400">这里读取已交付且未撤销的 TOP 新闻记录，不依赖浏览器标签页或当下上游接口；与下方待授权原始资料分别统计。</p>
      {topArchive.isError ? <p role="alert" className="mt-2 text-xs text-rose-300">归档读取失败：{topArchive.error.message}</p> :
        <p className="mt-2 text-xs text-emerald-300">数据库已交付 {topArchive.data?.total ?? "读取中"} 条 · 以下展示最近 {topArchive.data?.items.length ?? 0} 条</p>}
      <div className="mt-2 max-h-52 overflow-y-auto">
        {topArchive.data?.items.map(item => <div key={item.id} className="border-b border-slate-800 py-2 text-xs">
          <p className="text-slate-100">{item.title}</p>
          <p className="mt-1 text-slate-500">{item.category || "未分类"} · 发布 {formatTime(item.publishedAt)} · 入库 {formatTime(item.createdAt)}</p>
        </div>)}
        {topArchive.data && !topArchive.data.items.length && <p className="py-3 text-xs text-amber-200">暂无数据库里处于“已交付”状态的 TOP 新闻。</p>}
      </div>
    </section>
    {inventory.isError && <p role="alert" className="rounded border border-rose-800 bg-rose-950/20 p-3 text-sm text-rose-200">整个终端数据库库存读取失败：{inventory.error.message}</p>}
    {inventory.data && <section aria-label="整个终端数据库库存" className="rounded-lg border border-slate-700 bg-[#0c1b2d] p-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["数据库", inventory.data.schemaName, "当前连接的 MySQL schema"],
          ["全库数据表", inventory.data.tableCount.toLocaleString(), "含行情、基金、AI、新闻、系统等"],
          ["表及索引空间", formatSize(inventory.data.allocatedBytes), "当前 schema 的 MySQL 分配量，不含二进制日志"],
          ["Agent Reach 去重资料", inventory.data.exactAgentReachDocuments.toLocaleString(), `结构化资料库共 ${inventory.data.exactStructuredDocuments.toLocaleString()} 条（包含前项）`],
        ].map(([label, value, note]) => <div key={label} className="rounded border border-slate-700/70 bg-[#071324] px-3 py-3">
          <div className="text-[11px] text-slate-400">{label}</div><div className="mt-1 break-words text-xl font-semibold tabular-nums text-cyan-200">{value}</div><p className="mt-1 text-[11px] leading-4 text-slate-500">{note}</p>
        </div>)}
      </div>
      {inventory.data.physicalStorage ? <div className="mt-3 rounded border border-amber-900/60 bg-amber-950/10 p-3 text-xs">
        <div className="font-semibold text-amber-200">物理磁盘（整个 MySQL 实例，与上方表统计不是同一口径）</div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-slate-300">
          <span>实例数据目录：<b className="tabular-nums text-white">{formatSize(inventory.data.physicalStorage.totalBytes)}</b></span>
          <span>其中二进制日志：<b className="tabular-nums text-amber-200">{formatSize(inventory.data.physicalStorage.binaryLogBytes)}</b></span>
          <span>当前库的目录文件：<b className="tabular-nums text-white">{formatSize(inventory.data.physicalStorage.schemaDirectoryBytes)}</b></span>
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{inventory.data.physicalStorage.directory}</p>
        <p className="mt-1 text-[11px] text-slate-500">包含日志、引擎文件及其他 schema；目录统计可能随写入变化。这里只读展示，不提供删除或搬迁按钮。</p>
      </div> : <p className="mt-3 text-xs text-slate-400">服务器无法读取 MySQL 实例的物理目录；表及索引统计仍可用，不能据此推算磁盘总占用。</p>}
      <p className="mt-3 text-[11px] text-slate-400">采样时间：{formatTime(inventory.data.observedAt)}。全库各表合计约 {inventory.data.estimatedTableRows.toLocaleString()} 行，来自 MySQL 统计估值，原始/清洗/结构化可包含同一资料，不能当成独立文档数；上面的资料数是精确 COUNT。</p>
      {overview.data?.knowledge.databaseConfigured && <div className="mt-3 grid gap-2 border-t border-slate-700 pt-3 text-xs sm:grid-cols-4">
        {[
          ["原始采集", overview.data.knowledge.rawCount, "spider_raw_data"],
          ["清洗完成", overview.data.knowledge.cleanCount, "spider_ai_processed"],
          ["结构化可查", overview.data.knowledge.structuredCount, "finance_world_dataset"],
          ["处理血缘", overview.data.knowledge.lineageCount, "spider_data_blood"],
        ].map(([label, count, table]) => <div key={label} className="rounded border border-slate-800 bg-[#071324] p-2">
          <div className="text-slate-400">{label}</div><div className="mt-1 text-base font-semibold tabular-nums text-emerald-300">{Number(count).toLocaleString()}</div>
          <div className="break-all font-mono text-[10px] text-slate-500">{table}</div>
        </div>)}</div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inventory.data.groups.map(group =>
        <div key={group.name} className="flex justify-between rounded border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-xs">
          <span>{group.name} · {group.tables} 表</span><span className="tabular-nums text-slate-400">约 {group.estimatedRows.toLocaleString()} 行 · {formatSize(group.allocatedBytes)}</span>
        </div>)}</div>
      <button type="button" aria-expanded={showTables} onClick={() => setShowTables(!showTables)}
        className="mt-3 text-xs font-medium text-cyan-300 hover:underline">{showTables ? "收起全库表明细" : "查看全库各表的存储量与估算行数"}</button>
      {showTables && <div className="mt-2 max-h-64 overflow-auto rounded border border-slate-700 bg-[#071324]">
        <table className="w-full min-w-[540px] text-left text-xs"><thead className="sticky top-0 bg-slate-800 text-slate-300"><tr><th className="p-2">数据表</th><th className="p-2">业务分类</th><th className="p-2 text-right">估算行数</th><th className="p-2 text-right">分配空间</th></tr></thead>
          <tbody>{inventory.data.tables.map(table => <tr key={table.tableName} className="border-t border-slate-800"><td className="p-2 font-mono text-slate-200">{table.tableName}</td><td className="p-2 text-slate-400">{table.group}</td><td className="p-2 text-right tabular-nums">{table.estimatedRows.toLocaleString()}</td><td className="p-2 text-right tabular-nums">{formatSize(table.allocatedBytes)}</td></tr>)}</tbody></table>
      </div>}
    </section>}
    <div className="grid gap-4 2xl:grid-cols-[minmax(240px,.7fr)_minmax(340px,1.15fr)_minmax(340px,1fr)]">
      <section className="h-fit rounded-lg border border-slate-700 bg-[#0c1b2d] p-4">
        <h4 className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4 text-cyan-400" />输入公司资料</h4>
        <p className="mt-2 text-xs leading-5 text-slate-400">只有真实通过质量校验的资料才会保存。未批准时仅后台可见；不自动交付前端。</p>
        <label className="mt-4 block text-xs text-slate-400">资料标题<input value={title} onChange={event => setTitle(event.target.value)} className={`mt-1 ${inputClass}`} placeholder="研究资料标题" /></label>
        <label className="mt-3 block text-xs text-slate-400">来源部门<input value={sourceName} onChange={event => setSourceName(event.target.value)} className={`mt-1 ${inputClass}`} placeholder="例如：内部研究部" /></label>
        <label className="mt-3 block text-xs text-slate-400">资料正文<textarea value={content} onChange={event => setContent(event.target.value)}
          className={`mt-1 min-h-36 resize-y ${inputClass}`} placeholder="粘贴待清洗的原文，不少于 20 字" /></label>
        <button type="button" disabled={!databaseConfigured || ingest.isPending || !title.trim() || content.trim().length < 20}
          onClick={() => ingest.mutate({ title: title.trim(), sourceName: sourceName.trim() || undefined, content: content.trim() })}
          className="mt-3 inline-flex items-center gap-2 rounded bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">
          {ingest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}清洗、去重并保存
        </button>
        {ingest.data && <p role="status" className="mt-2 text-xs text-slate-300">本次回执：新增 {ingest.data.stored} · 去重 {ingest.data.deduplicated} · 拒收 {ingest.data.rejected}</p>}
      </section>
      <section className="min-w-0 rounded-lg border border-slate-700 bg-[#0c1b2d] p-4">
        <div className="flex items-center justify-between"><h4 className="font-semibold">清洗后的资料库</h4><span className="text-xs tabular-nums text-cyan-300">{list.data ? `${list.data.total.toLocaleString()} 条匹配` : "读取中"}</span></div>
        <div className="mt-3 flex gap-2"><input aria-label="检索清洗后的资料" value={draftSearch} onChange={event => setDraftSearch(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") { setPage(1); setQuery(draftSearch.trim()); } }}
          placeholder="标题、来源或清洗正文" className={`min-w-0 flex-1 ${inputClass}`} />
          <button type="button" aria-label="开始检索" onClick={() => { setPage(1); setQuery(draftSearch.trim()); }}
            className="rounded border border-cyan-700 px-3 text-cyan-200"><Search className="h-4 w-4" /></button></div>
        <div className="mt-2 flex gap-2">
          <select aria-label="来源类型" className={inputClass} value={source} onChange={event => { setPage(1); setSource(event.target.value as typeof source); }}>
            <option value="all">全部来源</option><option value="internal">公司输入</option><option value="public">公开渠道</option></select>
          <select aria-label="Ucheer 授权状态" className={inputClass} value={approval} onChange={event => { setPage(1); setApproval(event.target.value as typeof approval); }}>
            <option value="all">所有授权状态</option><option value="approved">Ucheer 已批准</option><option value="private">仅后台</option></select>
        </div>
        {list.isError && <p role="alert" className="mt-3 text-xs text-rose-300">资料库读取失败：{list.error.message}</p>}
        <div className="mt-3 max-h-[660px] space-y-1 overflow-y-auto">
          {list.data?.items.map(item => <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); setTargetModule(""); setFollowRss(false); }}
            className={`w-full rounded border p-3 text-left transition-colors ${selectedId === item.id ? "border-cyan-500 bg-cyan-950/30" : "border-slate-800 bg-[#071324] hover:border-cyan-800"}`}>
            <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-medium">{item.title}</span>
              <span className={`shrink-0 text-[11px] ${item.approved ? "text-emerald-300" : "text-amber-300"}`}>{item.approved ? "AI 可用" : "仅后台"}</span></span>
            <span className="mt-1 block text-[11px] text-slate-400">{item.sourceName} · {item.qualityLevel} · {formatTime(item.capturedAt)}</span>
            <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.excerpt}</span>
          </button>)}
          {!list.isFetching && !list.data?.items.length && !list.isError && <p className="py-8 text-center text-sm text-slate-400">未找到匹配资料；清除筛选或运行技能再查看。</p>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
          <button type="button" disabled={page <= 1 || list.isFetching} onClick={() => setPage(page - 1)} className="inline-flex items-center text-cyan-300 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" />上一页</button>
          <span>第 {page} / {maxPage} 页</span>
          <button type="button" disabled={page >= maxPage || list.isFetching} onClick={() => setPage(page + 1)} className="inline-flex items-center text-cyan-300 disabled:opacity-30">下一页<ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </section>
      <section className="min-w-0 rounded-lg border border-slate-700 bg-[#0c1b2d] p-4">
        <h4 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-400" />单条核验与授权</h4>
        {!selectedId && <p className="mt-6 text-sm leading-6 text-slate-400">在中间选择一条资料：查看完整清洗正文、质量检查、原始记录和处理血缘；授权仅作用于当前所选资料。</p>}
        {detail.isError && <p role="alert" className="mt-3 text-xs text-rose-300">资料详情读取失败：{detail.error.message}</p>}
        {selectedId && detail.isFetching && <p className="mt-3 text-sm text-slate-400">正在读取真实记录…</p>}
        {selectedId && !detail.isFetching && !record && !detail.isError && <p className="mt-3 text-xs text-amber-300">这条资料已不存在；请重新选择。</p>}
        {record && <div className="mt-3 space-y-3 text-xs">
          <div className="rounded border border-cyan-800/50 bg-cyan-950/20 p-3">
            <div className="break-words text-sm font-medium">{record.title}</div>
            <div className="mt-1 text-slate-400">{record.sourceName} · {record.qualityLevel} · {formatTime(record.capturedAt)}</div>
            {!record.internal && /^https?:\/\//.test(record.sourceUrl) && <a className="mt-1 inline-flex items-center gap-1 text-cyan-300 hover:underline" href={record.sourceUrl} target="_blank" rel="noreferrer">核对公开来源<ExternalLink className="h-3 w-3" /></a>}
            {record.internal && <div className="mt-1 text-amber-300">公司内部资料 · 原文不得公开分享</div>}
          </div>
          <details open className="rounded border border-slate-700 bg-[#071324] p-3"><summary className="cursor-pointer font-medium text-cyan-200">采集资料的清洗内容（不代表单篇新闻全文）</summary>
            <p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words leading-5 text-slate-300">{record.cleanedContent || "清洗结果为空"}</p></details>
          <details className="rounded border border-slate-700 bg-[#071324] p-3"><summary className="cursor-pointer font-medium text-cyan-200">原文、质量检查与处理血缘</summary>
            <div className="mt-2 space-y-2 text-slate-400">
              <div>原文抓取：{formatTime(record.rawCapturedAt)} · 解析：{record.rawParseStatus ?? "无记录"} · 清洗：{record.processStatus ?? "无记录"}</div>
              <div>内容指纹：<span className="break-all font-mono">{record.contentHash ?? "无记录"}</span></div>
              <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(record.qualityChecks, null, 2)}</pre>
              <div>步骤：{record.transformationSteps.map(step => String(step.step ?? "处理")).join(" → ") || "无血缘记录"}</div>
              <div className="max-h-52 overflow-auto whitespace-pre-wrap break-words">{record.originalContent ?? "原始记录不可读取"}</div>
            </div></details>
          <div className="border-t border-slate-700 pt-3"><div className="font-medium">① Ucheer AI 检索权</div>
            <p className="mt-1 text-slate-400">仅允许 AI 在对话中检索此条清洗资料；不自动发布到任何前端功能。</p>
            <button type="button" disabled={approve.isPending} onClick={() => approve.mutate({ id: record.id, approved: !record.approved })}
              className={`mt-2 rounded border px-3 py-2 disabled:opacity-40 ${record.approved ? "border-amber-700 text-amber-200" : "border-cyan-700 text-cyan-200"}`}>{record.approved ? "撤销本条 AI 检索权" : "批准本条给 Ucheer AI"}</button>
          </div>
          <div className="border-t border-slate-700 pt-3"><div className="font-medium">② 指定前端功能交付权</div>
            <p className="mt-1 text-slate-400">只支持已验证读取资料流的现有功能。网页首页可存为后台资料，但不可当单篇新闻授权；RSS 新闻仅交付来源真实提供的摘要，完整正文需另行取得可使用的内容源。</p>
            <select aria-label="当前资料的交付目标" className={`mt-2 ${inputClass}`} value={targetModule} onChange={event => setTargetModule(event.target.value)}>
              <option value="">选择一个实际可读取的前端功能</option>
              {(delivery.data?.modules ?? []).map(module => <option key={module.id} value={module.id}>{module.domain} / {module.name} / {module.path}</option>)}
            </select>
            {record.rssFeedUrl && !record.internal && <label className="mt-2 flex gap-2 text-slate-300"><input type="checkbox" checked={followRss} onChange={event => setFollowRss(event.target.checked)} />同时订阅此公开 RSS 来源的新内容，每日仅向本目标交付</label>}
            <button type="button" disabled={!targetModule || !delivery.data || grant.isPending} onClick={() => grant.mutate({
              recordUuid: record.id, moduleId: targetModule, enabled: true, followRss,
            })} className="mt-2 rounded border border-cyan-600 px-3 py-2 text-cyan-200 disabled:opacity-40">授权并尝试交付当前资料</button>
            {delivery.isError && <p role="alert" className="mt-2 text-rose-300">授权回执不可读取：{delivery.error.message}</p>}
            <div className="mt-2 space-y-1">{selectedGrants.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-[#071324] p-2">
              <span>{delivery.data?.modules.find(module => module.id === item.moduleId)?.name ?? item.moduleId} · 已实际交付 {item.deliveredCount} 条 · {item.followRss ? "RSS 每日跟进" : "只交付本条"} · 最近 {formatTime(item.lastDeliveredAt)}</span>
              <button type="button" disabled={grant.isPending} onClick={() => grant.mutate({ recordUuid: record.id, moduleId: item.moduleId, enabled: false, followRss: false })}
                className="text-amber-300 underline disabled:opacity-40">撤销</button></div>)}</div>
            {!selectedGrants.length && <p className="mt-2 text-slate-500">本条尚未授权给前端功能。</p>}
          </div>
        </div>}
      </section>
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-[#0c1b2d] p-3 text-xs text-slate-400">
      <span>每日任务：{delivery.data?.schedule?.isEnabled ? "已启用" : "未启用或尚未配置"} · 最近执行 {formatTime(delivery.data?.schedule?.lastExecutedAt)}{delivery.data?.schedule?.lastStatus === "failed" ? ` · 失败：${delivery.data.schedule.lastError ?? "未知"}` : ""}。有效 RSS 来源 {delivery.data?.grants.filter(item => item.isEnabled && item.followRss && item.rssUrl).length ?? 0} 个；为 0 时不会自动新增新闻。内部资料不会自动生成。</span>
      <button type="button" disabled={!databaseConfigured || !delivery.data?.grants.some(item => item.isEnabled) || runDaily.isPending}
        onClick={() => runDaily.mutate()} className="rounded border border-cyan-700 px-3 py-2 text-cyan-200 disabled:opacity-40">
        {runDaily.isPending ? "正在运行" : "立即检查已授权交付"}
      </button>
    </footer>
  </div>;
}
