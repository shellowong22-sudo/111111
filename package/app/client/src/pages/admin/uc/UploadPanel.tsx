/**
 * 一键接入：拖入一个或多个 zip / csv / json / xlsx，按顺序上传 → 自动识别 → 清洗 / 去重 / 脱敏 → 入库 → 生成模块（可直接推送）。
 */
import { useRef, useState } from 'react';
import { CheckCircle2, CloudUpload, FileArchive, Layers3, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { ZipExplorer } from './ContentExplorer';
import { Btn, Field, SlotSelect, Toggle, inputCls, slotLabel } from './ui';

type Item = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'failed';
  progress: number;
  error?: string;
  result?: { sourceId: number; datasets: Array<{ datasetId: number; name: string; version: number; rows: number; slot?: string | null }>; modulesCreated: number[]; scriptsQueued?: number };
};

const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function UploadPanel({ canUpload, onOpenModule, onOpenDatasets }: { canUpload: boolean; onOpenModule: (id: number) => void; onOpenDatasets: (sourceId: number) => void }) {
  const utils = trpc.useUtils();
  const sources = trpc.ucAdmin.sources.useQuery();
  const zipSources = (sources.data ?? []).filter((s) => s.kind === 'zip');
  const [slot, setSlot] = useState('auto');
  const [autoModules, setAutoModules] = useState(true);
  const [autoPublish, setAutoPublish] = useState(true);
  const [replaceId, setReplaceId] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const running = useRef(false);
  const queue = useRef<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const patch = (id: string, p: Partial<Item>) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const uploadOne = (item: Item, replace: number) => new Promise<void>((resolve) => {
    const params = new URLSearchParams({ name: item.file.name, slot, modules: autoModules ? '1' : '0', publish: autoModules && autoPublish ? '1' : '0' });
    if (replace) params.set('sourceId', String(replace));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/uc/upload?${params}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    patch(item.id, { status: 'uploading', progress: 0 });
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      patch(item.id, pct >= 100 ? { progress: 100, status: 'processing' } : { progress: pct });
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* 空 */ }
      if (xhr.status >= 200 && xhr.status < 300) patch(item.id, { status: 'done', progress: 100, result: body as Item['result'] });
      else patch(item.id, { status: 'failed', error: String(body.error ?? `HTTP ${xhr.status}`) });
      resolve();
    };
    xhr.onerror = () => { patch(item.id, { status: 'failed', error: '网络错误' }); resolve(); };
    xhr.send(item.file);
  });

  const drain = async () => {
    if (running.current) return;
    running.current = true;
    let ok = 0;
    let first = true;
    while (queue.current.length) {
      const next = queue.current.shift()!;
      await uploadOne(next, first ? replaceId : 0);
      first = false;
      ok += 1;
    }
    running.current = false;
    void utils.ucAdmin.invalidate();
    toast.success(`本批 ${ok} 个文件处理完成`);
  };

  const add = (files: FileList | File[]) => {
    if (!canUpload) { toast.error('当前角色没有管理数据源的权限'); return; }
    const list = [...files].map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, file, status: 'queued' as const, progress: 0 }));
    if (!list.length) return;
    setItems((cur) => [...list, ...cur]);
    queue.current.push(...list);
    void drain();
  };

  const done = items.filter((i) => i.status === 'done');
  const totalRows = done.reduce((n, i) => n + (i.result?.datasets.reduce((m, d) => m + d.rows, 0) ?? 0), 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) add(e.dataTransfer.files); }}
          className={`flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-teal-300 bg-teal-400/10' : 'border-teal-500/25 bg-black/20'}`}>
          <CloudUpload className="h-10 w-10 text-teal-300" />
          <p className="mt-3 text-sm font-medium text-slate-100">把 zip 拖到这里（可一次拖多个），或</p>
          <div className="mt-3"><Btn tone="primary" disabled={!canUpload} onClick={() => inputRef.current?.click()}><FileArchive className="h-4 w-4" />选择文件（可多选）</Btn></div>
          <input ref={inputRef} type="file" multiple accept=".zip,.csv,.tsv,.txt,.json,.ndjson,.jsonl,.xlsx,.xls,.xlsm" className="hidden" onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
          <p className="mt-4 max-w-md text-[11px] leading-5 text-slate-500">支持 zip（可多层嵌套）以及 csv / tsv / json / ndjson / xlsx，单个文件最大 300MB。多个文件按顺序处理；中文文件名与 GBK 编码自动识别；每张表各生成一个数据集和一个模块。</p>
        </div>
        {items.length > 0 && (
          <div className="rounded-xl border border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-slate-300"><span>处理队列：完成 {done.length} / {items.length}，共入库 {totalRows.toLocaleString()} 行</span><Btn size="sm" tone="ghost" onClick={() => setItems((l) => l.filter((i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'processing'))}>清除已完成</Btn></div>
            <div className="max-h-[46vh] overflow-y-auto">
              {items.map((i) => (
                <div key={i.id} className="border-b border-white/5 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {i.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> : i.status === 'failed' ? <XCircle className="h-3.5 w-3.5 shrink-0 text-red-300" /> : <Loader2 className={`h-3.5 w-3.5 shrink-0 text-teal-300 ${i.status === 'queued' ? '' : 'animate-spin'}`} />}
                      <span className="truncate text-slate-100">{i.file.name}</span><span className="shrink-0 text-[10px] text-slate-500">{fmtSize(i.file.size)}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">{({ queued: '排队中', uploading: `上传 ${i.progress}%`, processing: '识别、清洗、入库中…', done: '完成', failed: '失败' } as Record<string, string>)[i.status]}</span>
                  </div>
                  {(i.status === 'uploading' || i.status === 'processing') && <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5"><div className={`h-full bg-teal-400 transition-all ${i.status === 'processing' ? 'animate-pulse' : ''}`} style={{ width: `${i.progress}%` }} /></div>}
                  {i.error && <p className="mt-1 text-[11px] text-red-300/80">{i.error}</p>}
                  {i.result && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      {i.result.datasets.map((d) => <span key={d.datasetId}>· {d.name}：{d.rows.toLocaleString()} 行 v{d.version}{d.slot ? <span className="text-teal-300/80"> → {slotLabel(d.slot)}</span> : null}</span>)}
                      {!!i.result.scriptsQueued && <span className="text-amber-200/80">· 另有 {i.result.scriptsQueued} 个功能脚本在后台试跑，能出数据的会自动接入并推送（结果见“日志与监控”）</span>}
                      <span className="flex gap-1">
                        <Btn size="sm" tone="ghost" onClick={() => onOpenDatasets(i.result!.sourceId)}>看数据</Btn>
                        {i.result.modulesCreated[0] && <Btn size="sm" tone="primary" onClick={() => onOpenModule(i.result!.modulesCreated[0])}><Layers3 className="h-3 w-3" />看模块</Btn>}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
        <h3 className="text-sm font-semibold text-slate-100">接入选项</h3>
        <Field label="推送到前端的位置" hint="默认按表名与字段自动判断：行情→股票页、利率→收益率曲线、银行流水→清算结算、问答→Ucheer AI、文档→知识库。之后可在模块工作台修改。"><SlotSelect value={slot} onChange={setSlot} allowAuto /></Field>
        <Field label="替换已有 zip 数据源（只作用于本批第一个文件）" hint="同结构的新 zip 沿用上次的清洗规则与模块，只更新数据，前端自动刷新。">
          <select value={replaceId} onChange={(e) => setReplaceId(Number(e.target.value))} className={inputCls}>
            <option value={0}>新建数据源</option>
            {zipSources.map((s) => <option key={s.id} value={s.id}>{s.name}（#{s.id}）</option>)}
          </select>
        </Field>
        <Toggle checked={autoModules} onChange={setAutoModules} label="自动生成模块（按字段推荐模板）" />
        <Toggle checked={autoPublish} disabled={!autoModules} onChange={setAutoPublish} label="生成后直接推送到前端" />
        <ZipHealth zipSources={zipSources} canManage={canUpload} onOpenDatasets={onOpenDatasets} />
        <div className="rounded-lg border border-white/5 p-2 text-[11px] leading-5 text-slate-500">
          处理流程：上传 → 解压 → 自动忽略依赖清单 / 配置 / 锁文件 / 翻译包 / 图片 → 识别数据表、项目文档、功能脚本 → 字段类型识别 → 清洗 → 去重 → 脱敏（来源字段自动对前端隐藏）→ 入库 → 按内容放到合适页面 → 推送。
          每一步的记录在“日志与监控”里。
        </div>
      </div>
    </div>
  );
}

function ZipHealth({ zipSources, canManage, onOpenDatasets }: { zipSources: Array<{ id: number; name: string; last_status?: string }>; canManage: boolean; onOpenDatasets: (sourceId: number) => void }) {
  const utils = trpc.useUtils();
  const dup = trpc.ucAdmin.duplicates.useQuery(undefined, { staleTime: 30_000 });
  const rescan = trpc.ucAdmin.rescanZip.useMutation({
    onSuccess: (r) => {
      toast.success(`已重新识别：${r.placed.length} 张表已放到对应页面${r.removed.length ? `，清理无效表 ${r.removed.length} 个` : ''}${r.scriptsQueued ? `，${r.scriptsQueued} 个功能脚本后台试跑中` : ''}`);
      void utils.ucAdmin.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const cleanup = trpc.ucAdmin.cleanupJunk.useMutation({
    onSuccess: (r) => { toast.success(r.removed.length ? `已清理 ${r.removed.length} 个无效数据表` : '没有发现无效数据表'); void utils.ucAdmin.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const merge = trpc.ucAdmin.mergeDuplicates.useMutation({
    onSuccess: (r) => { toast.success(r.archived ? `已下线 ${r.archived} 个重复模块（数据保留）` : '没有需要合并的重复内容'); void utils.ucAdmin.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const [explore, setExplore] = useState<number | null>(null);
  const d = dup.data;
  const dupDatasets = d?.datasets.reduce((n, g) => n + g.duplicates.length, 0) ?? 0;
  const dupModules = d?.modules.reduce((n, g) => n + g.ids.length - 1, 0) ?? 0;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-white/5 p-2">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-200"><span>全站数据体检</span>{dup.isFetching && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}</div>
        <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
          <div className="rounded bg-black/20 py-1"><div className={`text-sm font-semibold ${dupDatasets ? 'text-amber-300' : 'text-slate-200'}`}>{dupDatasets}</div><div className="text-slate-500">内容重复的数据集</div></div>
          <div className="rounded bg-black/20 py-1"><div className={`text-sm font-semibold ${dupModules ? 'text-amber-300' : 'text-slate-200'}`}>{dupModules}</div><div className="text-slate-500">重复上线的模块</div></div>
          <div className="rounded bg-black/20 py-1"><div className={`text-sm font-semibold ${d?.sources.length ? 'text-amber-300' : 'text-slate-200'}`}>{d?.sources.length ?? 0}</div><div className="text-slate-500">重复上传的数据源</div></div>
        </div>
        {!!d?.datasets.length && (
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-[10px] text-slate-400">
            {d.datasets.slice(0, 20).map((g) => <li key={g.hash}>「{g.keep.name}」（{g.keep.source}）与 {g.duplicates.map((x) => `「${x.name}」（${x.source}）`).join('、')} 内容完全相同</li>)}
          </ul>
        )}
        {!!d?.sources.length && <p className="mt-1 text-[10px] text-slate-500">重复上传：{d.sources.map((x) => `${x.name}（${x.ids.length} 次）`).join('、')}，可在“数据源”里删除多余的一份。</p>}
        <div className="mt-2 flex flex-wrap gap-1">
          <Btn size="sm" tone="primary" disabled={!canManage || merge.isPending || (!dupDatasets && !dupModules)} onClick={() => merge.mutate()}>{merge.isPending ? '合并中…' : '一键合并重复'}</Btn>
          <Btn size="sm" disabled={!canManage || cleanup.isPending} onClick={() => cleanup.mutate()}>{cleanup.isPending ? '清理中…' : '清理无效数据表'}</Btn>
        </div>
      </div>
      {zipSources.length > 0 && (
        <div className="rounded-lg border border-white/5 p-2">
          <div className="mb-1 text-xs text-slate-200">已上传的压缩包</div>
          <ul className="max-h-52 space-y-1 overflow-y-auto text-[11px]">
            {zipSources.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-2">
                <button type="button" className="min-w-0 truncate text-left text-slate-300 hover:text-teal-200" onClick={() => onOpenDatasets(z.id)}>{z.name}</button>
                <span className="flex shrink-0 gap-1"><Btn size="sm" tone="ghost" onClick={() => setExplore(z.id)}>浏览内容</Btn><Btn size="sm" tone="ghost" disabled={!canManage || rescan.isPending} onClick={() => rescan.mutate({ id: z.id, publish: true })}>{rescan.isPending && rescan.variables?.id === z.id ? '识别中…' : '重新识别并推送'}</Btn></span>
              </li>
            ))}
          </ul>
          {explore != null && <ZipExplorer sourceId={explore} canManage={canManage} onClose={() => setExplore(null)} />}
          <p className="mt-1 text-[10px] leading-4 text-slate-500">按新规则重新解压：忽略依赖清单 / 配置，生成项目文档，自动选页面，并试跑包里的功能脚本。</p>
        </div>
      )}
    </div>
  );
}
