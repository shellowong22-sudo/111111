/**
 * 数据源管理：新增 / 编辑 / 复制 / 删除 / 启停 / 定时 / 立即运行 / 运行记录。
 * 支持：数据脚本、公开数据适配器、HTTP 接口、数据库查询、实时行情、RSS / 网页；zip 与单文件走“一键接入”。
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Database, Globe2, History, Layers3, Loader2, Pencil, Play, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RawViewer, ZipExplorer } from './ContentExplorer';
import { trpc } from '@/lib/trpc';
import { Btn, Empty, Field, INTERVALS, Modal, Pill, PreviewTable, SlotSelect, Toggle, fmtTime, inputCls, kindLabel, slotLabel, smallInputCls, statusText } from './ui';

type SourceKind = 'script' | 'adapter' | 'agent_reach' | 'http' | 'database' | 'market';
type Perms = { manageSources: boolean };

export default function SourcesPanel({ perms, onOpenDatasets }: { perms: Perms; onOpenDatasets: (sourceId: number) => void }) {
  const utils = trpc.useUtils();
  const sources = trpc.ucAdmin.sources.useQuery();
  const invalidate = () => void utils.ucAdmin.invalidate();
  const run = trpc.ucAdmin.runSource.useMutation({ onSuccess: (r) => { toast.success(`运行完成：${r.datasets.length} 张表，${r.datasets.reduce((n, d) => n + d.rows, 0)} 行`); invalidate(); }, onError: (e) => { toast.error(e.message); invalidate(); } });
  const del = trpc.ucAdmin.deleteSource.useMutation({ onSuccess: () => { toast.success('已删除数据源及其数据集、模块'); invalidate(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.ucAdmin.updateSource.useMutation({ onSuccess: () => { toast.success('已保存'); void utils.ucAdmin.sources.invalidate(); }, onError: (e) => toast.error(e.message) });
  const dup = trpc.ucAdmin.duplicateSource.useMutation({ onSuccess: () => { toast.success('已复制（副本默认停用，可编辑后启用）'); invalidate(); }, onError: (e) => toast.error(e.message) });
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(null);
  const [explore, setExplore] = useState<{ id: number; zip: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [history, setHistory] = useState<number | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [filter, setFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const list = (sources.data ?? []).filter((s) => (kindFilter === 'all' || s.kind === kindFilter) && (!filter || s.name.includes(filter) || String(s.id) === filter));
  const editing = dialog?.mode === 'edit' ? sources.data?.find((s) => s.id === dialog.id) : undefined;

  return (
    <>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#071012] px-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="搜索名称 / 编号" className="h-8 w-48 bg-transparent text-xs text-slate-100 outline-none" /></div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className={`${inputCls} w-36`}>
          <option value="all">全部类型</option>
          {Object.entries(kindLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="text-[11px] text-slate-500">共 {list.length} 个数据源 · 运行后每张表成为一个数据集</span>
        <div className="ml-auto flex gap-2">
          <Btn tone="ghost" onClick={() => void sources.refetch()}><RefreshCw className="h-3.5 w-3.5" />刷新</Btn>
          <Btn disabled={!perms.manageSources} onClick={() => setShowPresets(true)}><Layers3 className="h-3.5 w-3.5" />预置数据源</Btn>
          <Btn tone="primary" disabled={!perms.manageSources} onClick={() => setDialog({ mode: 'create' })}><Plus className="h-3.5 w-3.5" />新增数据源</Btn>
        </div>
      </div>

      {dialog && <SourceDialog
        initial={editing ? { id: editing.id, name: editing.name, slotId: editing.slotId, intervalMinutes: editing.intervalMinutes, config: editing.config as Record<string, unknown> } : undefined}
        onClose={() => setDialog(null)}
        onDone={(sourceId) => { setDialog(null); invalidate(); if (sourceId) onOpenDatasets(sourceId); }}
      />}
      {history !== null && <RunHistory sourceId={history} onClose={() => setHistory(null)} />}
      {showPresets && <PresetsDialog onClose={() => setShowPresets(false)} />}

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-white/[0.03] text-left text-slate-400"><tr>{['启用', '名称', '类型', '推送位置', '定时运行', '最近运行', '数据集 / 模块', '成功率', '操作'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {sources.isLoading && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">加载中…</td></tr>}
            {!sources.isLoading && !list.length && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">没有数据源。上传 zip，或点“新增数据源”接入接口 / 数据库 / 行情 / 脚本。</td></tr>}
            {list.map((s) => {
              const cfg = s.config as Record<string, unknown>;
              const detail = s.kind === 'script' ? `${cfg.script} ${cfg.command ?? ''}` : s.kind === 'adapter' ? String(cfg.adapter) : s.kind === 'agent_reach' || s.kind === 'http' ? String(cfg.url) : s.kind === 'database' ? String(cfg.sql ?? '').slice(0, 60) : s.kind === 'market' ? (cfg.mode === 'kline' ? `${cfg.symbol} · ${cfg.period}` : `板块 ${cfg.board ?? '自定义'}`) : s.kind === 'zipscript' ? `zip 功能脚本 ${cfg.file ?? ''} ${cfg.command ?? ''}` : String(cfg.fileName ?? '');
              const rate = s.runs ? Math.round(((s.runs - s.fails) / s.runs) * 100) : null;
              return (
                <tr key={s.id} className={`border-t border-white/5 align-top ${s.enabled ? '' : 'opacity-60'}`}>
                  <td className="px-3 py-2"><Toggle checked={s.enabled} disabled={!perms.manageSources} onChange={(v) => update.mutate({ id: s.id, enabled: v })} /></td>
                  <td className="px-3 py-2"><button type="button" onClick={() => onOpenDatasets(s.id)} className="text-left font-medium text-slate-100 hover:text-teal-200">{s.name}</button><div className="max-w-[260px] truncate text-[10px] text-slate-600" title={detail}>#{s.id} · {detail}</div></td>
                  <td className="px-3 py-2 text-slate-300">{kindLabel[s.kind] ?? s.kind}</td>
                  <td className="px-3 py-2"><SlotSelect value={s.slotId} onChange={(v) => update.mutate({ id: s.id, slotId: v })} className={`${smallInputCls} w-44`} /></td>
                  <td className="px-3 py-2">{s.kind === 'zip' ? <span className="text-slate-600">上传触发</span> : (
                    <select value={s.intervalMinutes} disabled={!perms.manageSources} onChange={(e) => update.mutate({ id: s.id, intervalMinutes: Number(e.target.value) })} className={`${smallInputCls} w-28`}>
                      {INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      {!INTERVALS.some(([v]) => v === s.intervalMinutes) && <option value={s.intervalMinutes}>每 {s.intervalMinutes} 分钟</option>}
                    </select>)}</td>
                  <td className="px-3 py-2"><Pill tone={s.lastStatus}>{statusText[s.lastStatus] ?? s.lastStatus}</Pill><div className="mt-1 text-[10px] text-slate-600">{fmtTime(s.lastRunAt)}</div>{s.lastError && <div className="mt-1 max-w-xs text-[10px] text-red-300/80" title={s.lastError}>{s.lastError.slice(0, 120)}</div>}</td>
                  <td className="px-3 py-2 text-slate-300">{s.datasets} / {s.modules}</td>
                  <td className="px-3 py-2 text-slate-300">{rate === null ? '—' : `${rate}%`}<div className="text-[10px] text-slate-600">{s.runs} 次</div></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Btn size="sm" disabled={!perms.manageSources || run.isPending} onClick={() => run.mutate({ id: s.id })} title="重新拉取数据并走完整管线">{run.isPending && run.variables?.id === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}{s.kind === 'zip' ? '重新处理' : '立即运行'}</Btn>
                      {s.kind !== 'zip' && <Btn size="sm" tone="ghost" disabled={!perms.manageSources || run.isPending} onClick={() => run.mutate({ id: s.id, useSnapshot: true })} title="不重新拉取，用上次的原始数据重跑规则">用快照重跑</Btn>}
                      <Btn size="sm" tone="ghost" onClick={() => setExplore({ id: s.id, zip: s.kind === 'zip' })} title={s.kind === 'zip' ? '逐个文件查看原文、表格与可映射方式' : '查看最近一次原始返回'}><Search className="h-3 w-3" />{s.kind === 'zip' ? '浏览内容' : '原始数据'}</Btn>
                      <Btn size="sm" tone="ghost" onClick={() => onOpenDatasets(s.id)}><Layers3 className="h-3 w-3" />数据集</Btn>
                      <Btn size="sm" tone="ghost" onClick={() => setHistory(s.id)}><History className="h-3 w-3" />记录</Btn>
                      {s.kind !== 'zip' && <Btn size="sm" tone="ghost" disabled={!perms.manageSources} onClick={() => setDialog({ mode: 'edit', id: s.id })}><Pencil className="h-3 w-3" />编辑</Btn>}
                      {s.kind !== 'zip' && <Btn size="sm" tone="ghost" disabled={!perms.manageSources} onClick={() => dup.mutate({ id: s.id })}><Copy className="h-3 w-3" /></Btn>}
                      {confirmDelete === s.id
                        ? <><Btn size="sm" tone="danger" onClick={() => { del.mutate({ id: s.id }); setConfirmDelete(null); }}>确认删除</Btn><Btn size="sm" tone="ghost" onClick={() => setConfirmDelete(null)}>取消</Btn></>
                        : <Btn size="sm" tone="ghost" disabled={!perms.manageSources} onClick={() => setConfirmDelete(s.id)}><Trash2 className="h-3 w-3" /></Btn>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
      {explore && (explore.zip ? <ZipExplorer sourceId={explore.id} canManage={perms.manageSources} onClose={() => setExplore(null)} /> : <RawViewer sourceId={explore.id} onClose={() => setExplore(null)} />)}
    </>
  );
}

function PresetsDialog({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const presets = trpc.ucAdmin.presets.useQuery(undefined, { refetchInterval: 5000 });
  const install = trpc.ucAdmin.installPresets.useMutation({ onSuccess: (r) => { toast.success(r.started ? `开始接入 ${r.pending} 个预置数据源（后台逐个运行，完成后自动推送到前端）` : '正在接入中，请稍候'); void utils.ucAdmin.invalidate(); }, onError: (e) => toast.error(e.message) });
  const list = presets.data ?? [];
  const missing = list.filter((p) => !p.sourceId);
  return (
    <Modal title="预置数据源（系统已有接口一键接入）" onClose={onClose} width="max-w-4xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>共 {list.length} 个：实时行情、指数 / 商品 / 汇率 K 线、交易所与央行数据接口、宏观数据脚本。接入后按计划自动运行并推送到对应页面。</span>
        <Btn tone="primary" disabled={!missing.length || install.isPending} onClick={() => install.mutate({ force: true })}>{install.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}接入缺少的 {missing.length} 个</Btn>
      </div>
      <div className="max-h-[64vh] overflow-y-auto rounded-xl border border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0b1719] text-left text-slate-400"><tr>{['名称', '类型', '前端位置', '运行间隔', '状态', ''].map((h) => <th key={h} className="px-3 py-1.5 font-normal">{h}</th>)}</tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.key} className="border-t border-white/5">
              <td className="px-3 py-1.5 text-slate-100">{p.name}</td>
              <td className="px-3 py-1.5 text-slate-400">{kindLabel[p.kind] ?? p.kind}</td>
              <td className="px-3 py-1.5 text-slate-400">{slotLabel(p.slot)}</td>
              <td className="px-3 py-1.5 text-slate-400">{INTERVALS.find(([v]) => v === p.interval)?.[1] ?? `每 ${p.interval} 分钟`}</td>
              <td className="px-3 py-1.5">{p.sourceId ? <Pill tone={p.status ?? 'never'}>{statusText[p.status ?? 'never'] ?? p.status}</Pill> : <Pill tone="never">{p.installed ? '已被删除' : '未接入'}</Pill>}</td>
              <td className="px-3 py-1.5">{!p.sourceId && <Btn size="sm" disabled={install.isPending} onClick={() => install.mutate({ keys: [p.key], force: true })}>接入</Btn>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Modal>
  );
}

function RunHistory({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const runs = trpc.ucAdmin.runs.useQuery({ sourceId, status: 'all' });
  const [open, setOpen] = useState<number | null>(null);
  const steps = trpc.ucAdmin.runSteps.useQuery({ runId: open ?? 0 }, { enabled: !!open });
  return (
    <Modal title={`运行记录 · 数据源 #${sourceId}`} onClose={onClose} width="max-w-3xl">
      <div className="max-h-[70vh] space-y-1 overflow-y-auto">
        {(runs.data ?? []).map((r) => (
          <div key={r.id} className="rounded-lg border border-white/5">
            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.02]">
              <span className="flex items-center gap-2"><Pill tone={r.status}>{statusText[r.status] ?? r.status}</Pill><span className="text-slate-400">{({ upload: '上传', manual: '手动', schedule: '定时', rules: '规则变更' } as Record<string, string>)[r.trigger_kind] ?? r.trigger_kind}</span></span>
              <span className="text-[10px] text-slate-500">{fmtTime(r.started_at)}{r.finished_at ? ` · ${Math.max(0, Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 100) / 10)} 秒` : ''}</span>
            </button>
            {r.error && <p className="px-3 pb-2 text-[11px] text-red-300/80">{r.error}</p>}
            {open === r.id && <StepList steps={steps.data ?? []} />}
          </div>
        ))}
        {!runs.data?.length && <Empty>还没有运行记录</Empty>}
      </div>
    </Modal>
  );
}

export function StepList({ steps }: { steps: Array<{ id: number; step: string; status: string; rows_in: number; rows_out: number; duration_ms: number; detail: string }> }) {
  return (
    <div className="space-y-1 px-3 pb-3">
      {steps.map((s) => (
        <div key={s.id} className="grid grid-cols-[52px_64px_1fr_64px] items-center gap-2 text-[11px]">
          <span className="text-slate-300">{({ ingest: '接入', clean: '清洗', dedup: '去重', mask: '脱敏', store: '入库', push: '推送' } as Record<string, string>)[s.step] ?? s.step}</span>
          <Pill tone={s.status}>{statusText[s.status] ?? s.status}</Pill>
          <span className="truncate text-slate-400" title={s.detail}>{s.rows_in} → {s.rows_out} · {s.detail}</span>
          <span className="text-right text-slate-600">{s.duration_ms} ms</span>
        </div>
      ))}
      {!steps.length && <p className="text-[11px] text-slate-600">加载步骤…</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ 新增 / 编辑数据源 */

type Initial = { id: number; name: string; slotId: string; intervalMinutes: number; config: Record<string, unknown> };

function SourceDialog({ initial, onClose, onDone }: { initial?: Initial; onClose: () => void; onDone: (sourceId: number | null) => void }) {
  const catalog = trpc.ucAdmin.catalog.useQuery();
  const overview = trpc.ucAdmin.overview.useQuery();
  const c0 = initial?.config ?? {};
  const [kind, setKind] = useState<SourceKind>((initial?.config.kind as SourceKind) ?? 'http');
  const [name, setName] = useState(initial?.name ?? '');
  const [slot, setSlot] = useState(initial?.slotId ?? 'macro.data');
  const [interval, setIntervalMinutes] = useState(initial?.intervalMinutes ?? 0);
  const [autoPublish, setAutoPublish] = useState(true);
  // 脚本
  const [search, setSearch] = useState('');
  const [script, setScript] = useState(String(c0.script ?? ''));
  const [command, setCommand] = useState(String(c0.command ?? ''));
  const [args, setArgs] = useState(Array.isArray(c0.args) ? (c0.args as string[]).join(' ') : '');
  const [env, setEnv] = useState<Record<string, string>>((c0.env as Record<string, string>) ?? {});
  // 适配器
  const [adapter, setAdapter] = useState(String(c0.adapter ?? ''));
  // RSS / 网页
  const [mode, setMode] = useState<'rss' | 'web'>((c0.mode as 'rss' | 'web') === 'web' ? 'web' : 'rss');
  const [url, setUrl] = useState(String(c0.url ?? ''));
  // HTTP
  const [method, setMethod] = useState<'GET' | 'POST'>((c0.method as 'GET' | 'POST') ?? 'GET');
  const [headers, setHeaders] = useState<Array<[string, string]>>(Object.entries((c0.headers as Record<string, string>) ?? {}));
  const [body, setBody] = useState(String(c0.body ?? ''));
  const [jsonPath, setJsonPath] = useState(String(c0.jsonPath ?? ''));
  const [format, setFormat] = useState<'auto' | 'json' | 'csv'>((c0.format as 'auto') ?? 'auto');
  // 数据库
  const [dsn, setDsn] = useState(String(c0.dsn ?? ''));
  const [sqlText, setSqlText] = useState(String(c0.sql ?? 'SELECT * FROM '));
  // 行情
  const [mMode, setMMode] = useState<'quotes' | 'kline'>((c0.mode as 'quotes' | 'kline') === 'kline' ? 'kline' : 'quotes');
  const [board, setBoard] = useState(String(c0.board ?? 'global'));
  const [symbols, setSymbols] = useState(Array.isArray(c0.symbols) ? (c0.symbols as string[]).join(' ') : '');
  const [symbol, setSymbol] = useState(String(c0.symbol ?? '000001.SH'));
  const [period, setPeriod] = useState(String(c0.period ?? '1d'));

  const testScript = trpc.ucAdmin.testScript.useMutation({ onError: (e) => toast.error(e.message) });
  const testSource = trpc.ucAdmin.testSource.useMutation({ onError: (e) => toast.error(e.message) });
  const create = trpc.ucAdmin.createSource.useMutation({ onSuccess: (r) => { toast.success(`已接入 ${r.datasets.length} 张表${r.modulesCreated.length ? `，生成 ${r.modulesCreated.length} 个模块` : ''}`); onDone(r.sourceId); }, onError: (e) => toast.error(e.message) });
  const update = trpc.ucAdmin.updateSource.useMutation({ onSuccess: () => { toast.success('已保存，点“立即运行”生效'); onDone(null); }, onError: (e) => toast.error(e.message) });

  const scripts = catalog.data?.scripts ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scripts.filter((s) => !q || s.script.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.commands.some((c) => c.toLowerCase().includes(q))).slice(0, 300);
  }, [scripts, search]);
  const entry = scripts.find((s) => s.script === script);
  const argList = args.trim() ? (args.trim().match(/"[^"]*"|\S+/g) ?? []).map((a) => a.replace(/^"|"$/g, '')) : [];
  const symbolList = symbols.split(/[\s,，]+/).map((s) => s.trim()).filter(Boolean);

  const config = (() => {
    switch (kind) {
      case 'script': return { kind, script, command, args: argList, env };
      case 'adapter': return { kind, adapter };
      case 'agent_reach': return { kind, mode, url };
      case 'http': return { kind, url, method, headers: Object.fromEntries(headers.filter(([k]) => k.trim())), body, jsonPath, format, timeoutSec: 30 };
      case 'database': return { kind, dsn, sql: sqlText };
      case 'market': return mMode === 'kline' ? { kind, mode: mMode, symbol, period, limit: 240, symbols: [] } : { kind, mode: mMode, board: symbolList.length ? undefined : board, symbols: symbolList, period: '1d', limit: 240 };
    }
  })();
  const valid = name.trim() && (kind === 'script' ? !!script : kind === 'adapter' ? !!adapter : kind === 'agent_reach' || kind === 'http' ? /^https?:\/\//.test(url) : kind === 'database' ? sqlText.trim().length > 8 : mMode === 'kline' ? !!symbol.trim() : true);
  const test = () => {
    if (kind === 'script') testScript.mutate({ script, command, args: argList, env });
    else if (kind === 'http' || kind === 'database' || kind === 'market') testSource.mutate({ config: config as never });
  };
  const testData = kind === 'script' ? testScript.data : testSource.data;
  const testing = testScript.isPending || testSource.isPending;
  const kinds: Array<[SourceKind, string, string]> = [
    ['http', 'HTTP 接口', 'REST / JSON / CSV 地址'],
    ['database', '数据库', 'MySQL 只读查询'],
    ['market', '实时行情', '指数、股票、期货、外汇'],
    ['script', `数据脚本（${scripts.length || '…'}）`, '宏观、债券、股票等 Python 脚本'],
    ['adapter', `公开数据适配器（${catalog.data?.adapters.length ?? '…'}）`, '系统内置数据接口'],
    ['agent_reach', 'RSS / 网页', '订阅或网页正文'],
  ];

  return (
    <Modal title={initial ? `编辑数据源 · ${initial.name}` : '新增数据源'} onClose={onClose}>
      {!initial && (
        <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          {kinds.map(([k, l, d]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-xl border px-3 py-2 text-left ${kind === k ? 'border-teal-400/50 bg-teal-400/10' : 'border-white/5 hover:border-white/15'}`}>
              <div className="text-xs text-slate-100">{l}</div><div className="mt-0.5 text-[10px] text-slate-500">{d}</div>
            </button>
          ))}
        </div>
      )}

      {kind === 'http' && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
            <Field label="方法"><select value={method} onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')} className={inputCls}><option>GET</option><option>POST</option></select></Field>
            <Field label="接口地址"><input value={url} onChange={(e) => { setUrl(e.target.value); if (!name) setName(e.target.value.replace(/^https?:\/\//, '').split('?')[0].slice(0, 60)); }} placeholder="https://api.example.com/v1/quotes?symbol=…" className={inputCls} /></Field>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400"><span>请求头（密钥只保存在后台，显示时自动隐藏）</span><button type="button" onClick={() => setHeaders([...headers, ['', '']])} className="text-teal-300 hover:text-teal-100">+ 添加</button></div>
            {headers.map(([k, v], i) => (
              <div key={i} className="mb-1 grid grid-cols-[1fr_2fr_24px] gap-1">
                <input value={k} onChange={(e) => setHeaders(headers.map((h, j) => (j === i ? [e.target.value, h[1]] : h)))} placeholder="Authorization" className={smallInputCls} />
                <input value={v} onChange={(e) => setHeaders(headers.map((h, j) => (j === i ? [h[0], e.target.value] : h)))} placeholder="Bearer …" className={smallInputCls} />
                <button type="button" onClick={() => setHeaders(headers.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-300">×</button>
              </div>
            ))}
          </div>
          {method === 'POST' && <Field label="请求体"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={`${inputCls} h-auto py-1 font-mono`} /></Field>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="数据路径（可选）" hint="例如 data.items；留空自动找到最大的表"><input value={jsonPath} onChange={(e) => setJsonPath(e.target.value)} className={inputCls} /></Field>
            <Field label="返回格式"><select value={format} onChange={(e) => setFormat(e.target.value as 'auto')} className={inputCls}><option value="auto">自动识别</option><option value="json">JSON</option><option value="csv">CSV</option></select></Field>
          </div>
        </div>
      )}

      {kind === 'database' && (
        <div className="space-y-2">
          <Field label="连接串（留空 = 本系统数据库）" hint="mysql://用户:密码@主机:3306/库名；只执行只读查询"><input value={dsn} onChange={(e) => setDsn(e.target.value)} placeholder="mysql://reader:****@10.0.0.8:3306/market" className={inputCls} /></Field>
          <Field label="SQL"><textarea value={sqlText} onChange={(e) => setSqlText(e.target.value)} rows={5} className={`${inputCls} h-auto py-1 font-mono`} /></Field>
        </div>
      )}

      {kind === 'market' && (
        <div className="space-y-2">
          <div className="flex gap-1">{([['quotes', '实时报价表'], ['kline', '单个代码 K 线']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setMMode(k)} className={`rounded-lg px-3 py-1.5 text-xs ${mMode === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>)}</div>
          {mMode === 'quotes' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="板块"><select value={board} onChange={(e) => { setBoard(e.target.value); if (!name) setName(`${catalog.data?.boards.find((b) => b.id === e.target.value)?.label ?? ''}实时行情`); }} className={inputCls}>{catalog.data?.boards.map((b) => <option key={b.id} value={b.id}>{b.label}（{b.symbols.length}）</option>)}</select></Field>
              <Field label="或自定义代码（空格分隔，填了则优先）" hint="600519 / 000001.SH / 0700.HK / AAPL / ^GSPC / GC / USDCNH"><input value={symbols} onChange={(e) => setSymbols(e.target.value)} className={inputCls} /></Field>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="代码"><input value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls} /></Field>
              <Field label="周期"><select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls}>{[['1m', '分时'], ['5m', '5 分钟'], ['15m', '15 分钟'], ['60m', '60 分钟'], ['1d', '日 K'], ['1w', '周 K'], ['1M', '月 K']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            </div>
          )}
          <p className="text-[10px] text-slate-500">建议：实时报价表设为“每分钟”运行，并用“实时行情K线”模板展示（前端每 3 秒跳动）。</p>
        </div>
      )}

      {kind === 'script' && (
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-white/5">
            <div className="flex items-center gap-2 border-b border-white/5 p-2"><Search className="h-3.5 w-3.5 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索脚本 / 命令，例如 bond、gdp、akshare" className="flex-1 bg-transparent text-xs text-slate-100 outline-none" /></div>
            {overview.data && overview.data.scriptsAvailable === 0 && <p className="border-b border-white/5 p-2 text-[11px] text-amber-300">服务器上没有找到脚本包 vendor/fincept-scripts.zip。</p>}
            <ul className="max-h-[380px] overflow-y-auto">
              {filtered.map((s) => (
                <li key={s.script}><button type="button" onClick={() => { setScript(s.script); setCommand(s.commands[0] ?? ''); setArgs(''); setEnv(Object.fromEntries(s.env.map((k) => [k, '']))); if (!initial) { setName(s.title || s.script); setSlot(s.slot); } testScript.reset(); }} className={`w-full border-b border-white/[0.03] px-3 py-2 text-left ${script === s.script ? 'bg-teal-400/10' : 'hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-100">{s.script}</span><span className="text-[10px] text-slate-500">{slotLabel(s.slot).split(' · ')[1]}</span></div>
                  {s.title && <div className="truncate text-[11px] text-slate-500">{s.title}</div>}
                  <div className="mt-0.5 text-[10px] text-slate-600">{s.commands.length} 个命令{s.env.length ? ` · 需要 ${s.env.join('、')}` : ''}</div>
                </button></li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            {!entry ? <Empty>从左侧选择一个数据脚本</Empty> : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="命令"><select value={command} onChange={(e) => setCommand(e.target.value)} className={inputCls}>{entry.commands.map((c) => <option key={c} value={c}>{c}</option>)}{!entry.commands.length && <option value="">（无）</option>}</select></Field>
                  <Field label="参数（空格分隔，可留空）" hint={entry.usage.find((u) => u.startsWith(command)) ?? entry.usage[0]}><input value={args} onChange={(e) => setArgs(e.target.value)} className={inputCls} /></Field>
                </div>
                {entry.env.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{entry.env.map((k) => <Field key={k} label={k}><input value={env[k] ?? ''} onChange={(e) => setEnv({ ...env, [k]: e.target.value })} placeholder="密钥（只保存在后台）" className={inputCls} /></Field>)}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {kind === 'adapter' && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.data?.adapters.map((a) => (
            <button key={a.id} type="button" onClick={() => { setAdapter(a.id); if (!initial) { setName(a.label); setSlot(a.slot); } }} className={`rounded-xl border px-3 py-2 text-left text-xs ${adapter === a.id ? 'border-teal-400/50 bg-teal-400/10 text-teal-50' : 'border-white/5 text-slate-300 hover:border-white/15'}`}>
              <div className="font-medium">{a.label}</div><div className="mt-0.5 text-[10px] text-slate-500">{slotLabel(a.slot)}</div>
            </button>
          ))}
        </div>
      )}

      {kind === 'agent_reach' && (
        <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
          <Field label="方式"><select value={mode} onChange={(e) => setMode(e.target.value as 'rss' | 'web')} className={inputCls}><option value="rss">RSS / Atom 订阅</option><option value="web">网页正文</option></select></Field>
          <Field label="地址"><input value={url} onChange={(e) => { setUrl(e.target.value); if (!name) setName(e.target.value.replace(/^https?:\/\//, '').slice(0, 60)); }} placeholder="https://…" className={inputCls} /></Field>
        </div>
      )}

      {(kind === 'script' || kind === 'http' || kind === 'database' || kind === 'market') && (
        <div className="mt-3 space-y-2">
          <Btn disabled={testing || !valid} onClick={test}>{testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : kind === 'database' ? <Database className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}试运行（不入库）</Btn>
          {testData && (
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400">识别到 {testData.total} 行、{testData.columns.length} 列</div>
              <PreviewTable columns={testData.columns} rows={testData.rows as Array<Record<string, unknown>>} />
              {!testData.total && <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px] text-slate-500">{testData.raw}</pre>}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-2 border-t border-white/5 pt-3 sm:grid-cols-4">
        <Field label="名称"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="推送到前端的位置"><SlotSelect value={slot} onChange={setSlot} /></Field>
        <Field label="定时运行"><select value={interval} onChange={(e) => setIntervalMinutes(Number(e.target.value))} className={inputCls}>{INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        {!initial && <label className="flex items-end gap-2 pb-2 text-xs text-slate-300"><input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} className="accent-teal-400" />接入后自动生成模块并推送到前端</label>}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Btn tone="ghost" onClick={onClose}>取消</Btn>
        {initial
          ? <Btn tone="primary" disabled={!valid || update.isPending} onClick={() => update.mutate({ id: initial.id, name: name.trim(), slotId: slot, intervalMinutes: interval, config: config as never })}>{update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}保存</Btn>
          : <Btn tone="primary" disabled={!valid || create.isPending} onClick={() => create.mutate({ name: name.trim(), slotId: slot, intervalMinutes: interval, config: config as never, runNow: true, autoPublish })}>{create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}接入并运行</Btn>}
      </div>
    </Modal>
  );
}
