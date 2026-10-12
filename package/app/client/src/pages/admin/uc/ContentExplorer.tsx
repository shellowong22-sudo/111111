/**
 * 内容浏览：压缩包里每个文件一字不差地看；表格看解析结果；看能映射成什么前端模板 / 推送到哪个页面；勾选文件直接接入并推送。
 * 接口 / 脚本 / 行情类数据源：看最近一次原始返回和可映射方式。
 */
import { useMemo, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronRight, Code2, Database, FileText, FileType2, Image as ImageIcon, Loader2, Package, Search, Settings2, Square, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Btn, PreviewTable, SlotSelect, Toggle, downloadText } from './ui';

const KIND_META: Record<string, { label: string; color: string; Icon: typeof FileText }> = {
  table: { label: '数据表', color: 'text-emerald-300', Icon: Database },
  doc: { label: '文档', color: 'text-sky-300', Icon: FileText },
  script: { label: '脚本', color: 'text-amber-300', Icon: Terminal },
  code: { label: '代码', color: 'text-violet-300', Icon: Code2 },
  config: { label: '配置', color: 'text-slate-400', Icon: Settings2 },
  image: { label: '图片', color: 'text-pink-300', Icon: ImageIcon },
  binary: { label: '二进制', color: 'text-slate-500', Icon: Package },
  text: { label: '文本', color: 'text-slate-300', Icon: FileType2 },
};
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)}MB` : n > 1024 ? `${(n / 1024).toFixed(1)}KB` : `${n}B`);

type Mapping = {
  fields: Array<{ name: string; label: string; type: string }>;
  numeric: string[]; dates: string[]; codes: string[];
  suggested: { template: string; slot: string; slotLabel: string; reason: string };
  templates: Array<{ code: string; label: string; ok: boolean; why: string }>;
  slots: Array<{ id: string; label: string; score: number }>;
};

function MappingView({ mapping }: { mapping: Mapping }) {
  return (
    <div className="space-y-3 text-[11px]">
      <div className="border-l-2 border-teal-400 pl-2">
        <div className="text-slate-400">推荐</div>
        <div className="text-slate-100">模板 <b className="text-teal-200">{mapping.templates.find((t) => t.code === mapping.suggested.template)?.label ?? mapping.suggested.template}</b> · 推送到 <b className="text-teal-200">{mapping.suggested.slotLabel}</b></div>
        <div className="text-[10px] text-slate-500">{mapping.suggested.reason}</div>
      </div>
      <div>
        <div className="mb-1 text-slate-400">可用的前端模板</div>
        <table className="w-full"><tbody>
          {mapping.templates.map((t) => <tr key={t.code} className="border-t border-white/5"><td className={`py-0.5 pr-2 ${t.ok ? 'text-emerald-300' : 'text-slate-600'}`}>{t.ok ? '✓' : '✕'} {t.label}</td><td className="text-slate-500">{t.why}</td></tr>)}
        </tbody></table>
      </div>
      <div>
        <div className="mb-1 text-slate-400">字段（{mapping.fields.length}）</div>
        <div className="flex flex-wrap gap-1">
          {mapping.fields.map((f) => <span key={f.name} className="border border-white/10 px-1 text-[10px] text-slate-300">{f.label}<span className="ml-1 text-slate-500">{({ number: '数值', percent: '百分比', date: '日期', string: '文本' } as Record<string, string>)[f.type] ?? f.type}</span></span>)}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">数值列 {mapping.numeric.length} · 日期列 {mapping.dates.length} · 代码列 {mapping.codes.length ? mapping.codes.join('、') : '无'}</div>
      </div>
      <div>
        <div className="mb-1 text-slate-400">适合的前端页面（按匹配度）</div>
        <div className="flex flex-wrap gap-1">{mapping.slots.slice(0, 8).map((s) => <span key={s.id} className={`border px-1 text-[10px] ${s.score > 0 ? 'border-teal-500/40 text-teal-200' : 'border-white/10 text-slate-500'}`}>{s.label}</span>)}</div>
      </div>
    </div>
  );
}

function TextView({ text, truncated, path }: { text: string; truncated: boolean; path: string }) {
  const lines = useMemo(() => text.split(/\r?\n/), [text]);
  const shown = lines.slice(0, 20000);
  return (
    <div className="relative">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#081114] px-2 py-1 text-[10px] text-slate-500">
        <span>{lines.length.toLocaleString()} 行{truncated ? ' · 文件较大，只显示前 3MB' : ''}{lines.length > 20000 ? ' · 显示前 20,000 行' : ''}</span>
        <span className="flex gap-2"><button type="button" className="hover:text-white" onClick={() => { void navigator.clipboard?.writeText(text); toast.success('已复制全文'); }}>复制全文</button><button type="button" className="hover:text-white" onClick={() => downloadText(path.split('/').pop() ?? 'file.txt', text, 'text/plain;charset=utf-8')}>下载</button></span>
      </div>
      <pre className="overflow-x-auto font-mono text-[11px] leading-[18px] text-slate-200">
        {shown.map((l, i) => <div key={i} className="flex hover:bg-white/[0.03]"><span className="w-12 shrink-0 select-none pr-3 text-right text-slate-600">{i + 1}</span><span className="whitespace-pre">{l || ' '}</span></div>)}
      </pre>
    </div>
  );
}

export function ZipExplorer({ sourceId, onClose, canManage }: { sourceId: number; onClose: () => void; canManage: boolean }) {
  const utils = trpc.useUtils();
  const tree = trpc.ucAdmin.zipTree.useQuery({ id: sourceId });
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [hideIgnored, setHideIgnored] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [tab, setTab] = useState<'raw' | 'table' | 'map'>('raw');
  const [slot, setSlot] = useState('tool.board');
  const file = trpc.ucAdmin.zipFile.useQuery({ id: sourceId, path: sel ?? '' }, { enabled: !!sel });
  const importFiles = trpc.ucAdmin.importZipFile.useMutation({
    onSuccess: (r) => { toast.success(`已接入 ${r.datasets.length} 张表，生成 ${r.modules.length} 个模块并推送`); setPicked([]); void utils.ucAdmin.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const files = (tree.data?.files ?? []).filter((f) => (!q || f.path.toLowerCase().includes(q.toLowerCase())) && (!kinds.length || kinds.includes(f.kind)) && (!hideIgnored || !f.ignored));
  // 目录树
  const folders = useMemo(() => {
    const m = new Map<string, typeof files>();
    for (const f of files) {
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '（根目录）';
      m.set(dir, [...(m.get(dir) ?? []), f]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [files]);
  const d = file.data;
  const pickTable = (p: string) => setPicked((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#05090b]">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <span className="text-sm font-semibold text-slate-100">内容浏览 · {tree.data?.name ?? '…'}</span>
        {tree.data && <span className="text-[11px] text-slate-500">{tree.data.total.toLocaleString()} 个文件 · {fmtSize(tree.data.bytes)} · {Object.entries(tree.data.counts).map(([k, v]) => `${KIND_META[k]?.label ?? k} ${v}`).join(' · ')}</span>}
        <button type="button" onClick={onClose} className="ml-auto text-[12px] text-slate-400 hover:text-white">关闭 ✕</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)]">
        {/* 文件树 */}
        <div className="flex min-h-0 flex-col border-r border-white/10">
          <div className="space-y-1 border-b border-white/10 p-2">
            <div className="flex items-center gap-1 border border-white/10 px-1.5"><Search className="h-3 w-3 text-slate-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索文件路径" className="h-6 flex-1 bg-transparent text-[11px] text-slate-100 outline-none" /></div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(KIND_META).map(([k, m]) => (
                <button key={k} type="button" onClick={() => setKinds((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]))} className={`border px-1 text-[10px] ${kinds.includes(k) ? 'border-teal-400 text-teal-100' : 'border-white/10 text-slate-500'}`}>{m.label} {tree.data?.counts[k] ?? 0}</button>
              ))}
            </div>
            <Toggle checked={hideIgnored} onChange={setHideIgnored} label={<span className="text-[10px]">隐藏默认忽略的文件</span>} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto text-[11px]">
            {tree.isLoading && <div className="p-4 text-slate-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />读取压缩包…</div>}
            {tree.error && <div className="p-4 text-red-300">{tree.error.message}</div>}
            {folders.map(([dir, list]) => {
              const isOpen = open[dir] ?? folders.length < 12;
              return (
                <div key={dir}>
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [dir]: !isOpen }))} className="flex w-full items-center gap-1 bg-white/[0.02] px-2 py-1 text-left text-slate-400 hover:text-slate-100">
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}<span className="truncate">{dir}</span><span className="ml-auto text-[10px] text-slate-600">{list.length}</span>
                  </button>
                  {isOpen && list.map((f) => {
                    const m = KIND_META[f.kind] ?? KIND_META.text;
                    return (
                      <div key={f.path} className={`flex items-center gap-1 py-0.5 pl-5 pr-2 ${sel === f.path ? 'bg-teal-500/15' : 'hover:bg-white/[0.03]'}`}>
                        {f.kind === 'table' ? <button type="button" onClick={() => pickTable(f.path)} title="勾选后可批量接入">{picked.includes(f.path) ? <CheckSquare className="h-3 w-3 text-teal-300" /> : <Square className="h-3 w-3 text-slate-600" />}</button> : <span className="w-3" />}
                        <button type="button" onClick={() => { setSel(f.path); setTab(f.kind === 'table' ? 'table' : 'raw'); }} className="flex min-w-0 flex-1 items-center gap-1 text-left">
                          <m.Icon className={`h-3 w-3 shrink-0 ${m.color}`} />
                          <span className={`truncate ${f.ignored ? 'text-slate-500 line-through decoration-slate-700' : 'text-slate-200'}`}>{f.path.split('/').pop()}</span>
                          {f.datasets.length > 0 && <span className="shrink-0 bg-emerald-500/15 px-1 text-[9px] text-emerald-300">{f.datasets.some((x) => x.published) ? '已推送' : '已入库'}</span>}
                          <span className="ml-auto shrink-0 text-[10px] text-slate-600">{fmtSize(f.size)}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {picked.length > 0 && (
            <div className="space-y-1 border-t border-white/10 p-2 text-[11px]">
              <div className="text-slate-300">已勾选 {picked.length} 个数据文件</div>
              <SlotSelect value={slot} onChange={setSlot} />
              <Btn tone="primary" disabled={!canManage || importFiles.isPending} onClick={() => importFiles.mutate({ id: sourceId, paths: picked, slot, publish: true })}>{importFiles.isPending ? '接入中…' : '接入并推送到前端'}</Btn>
            </div>
          )}
        </div>
        {/* 文件内容 */}
        <div className="flex min-h-0 flex-col">
          {!sel && <div className="m-auto text-[12px] text-slate-500">从左侧选择文件，查看原文、表格解析结果和可映射方式</div>}
          {sel && (
            <>
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[11px]">
                <span className="truncate font-mono text-slate-200">{sel}</span>
                {d && <span className="text-slate-500">{fmtSize(d.size)}</span>}
                {d?.ignored && <span className="text-amber-300/80">{d.ignored}</span>}
                <span className="ml-auto flex border border-white/10">
                  {([['raw', '原文'], ['table', `表格${d?.tables.length ? `（${d.tables.length}）` : ''}`], ['map', '可映射 / 接入']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`px-2 py-0.5 ${tab === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400'}`}>{l}</button>)}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-2">
                {file.isLoading && <div className="text-slate-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />读取…</div>}
                {file.error && <div className="text-red-300">{file.error.message}</div>}
                {d && tab === 'raw' && (d.image ? <img src={d.image} alt={sel} className="max-h-[80vh] max-w-full" /> : d.text != null ? <TextView text={d.text} truncated={d.truncated} path={d.path} /> : <div className="text-slate-500">{d.note}</div>)}
                {d && tab === 'table' && (d.tables.length ? d.tables.map((t) => (
                  <div key={t.name} className="mb-4">
                    <div className="mb-1 text-[11px] text-slate-300">{t.name} · {t.total.toLocaleString()} 行 × {t.columns.length} 列 {t.useful ? '' : <span className="text-amber-300/80">（列或行太少，默认不入库）</span>}</div>
                    <PreviewTable columns={t.columns} rows={t.rows} max={300} />
                  </div>
                )) : <div className="text-slate-500">{d.note ?? '这个文件不是表格'}</div>)}
                {d && tab === 'map' && (d.tables.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {d.tables.map((t) => (
                      <div key={t.name} className="border border-white/10 p-2">
                        <div className="mb-2 text-[12px] font-semibold text-slate-100">{t.name}</div>
                        <MappingView mapping={t.mapping} />
                        <div className="mt-3 flex items-center gap-2">
                          <div className="w-60"><SlotSelect value={slot === 'tool.board' ? t.mapping.suggested.slot : slot} onChange={setSlot} /></div>
                          <Btn tone="primary" disabled={!canManage || importFiles.isPending} onClick={() => importFiles.mutate({ id: sourceId, paths: [sel], slot: slot === 'tool.board' ? t.mapping.suggested.slot : slot, publish: true })}>接入并推送</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="space-y-2 text-[12px] text-slate-400">
                  {d.kind === 'script' && <p>Python 脚本：上传后系统会自动试跑能输出数据的脚本，成功的会注册成定时数据源（在“数据源”页查看）。</p>}
                  {d.kind === 'doc' && <p>文档：README / docs 下的 Markdown 会合并成「项目文档」知识表，推送到 Ucheer AI。</p>}
                  {(d.kind === 'code' || d.kind === 'config') && <p>代码 / 配置文件：不是数据，只供查看；其中的接口地址可以在“数据源 → 新建 → HTTP 接口”里接入。</p>}
                  {d.kind === 'image' && <p>图片：仅供查看。</p>}
                </div>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function RawViewer({ sourceId, onClose }: { sourceId: number; onClose: () => void }) {
  const raw = trpc.ucAdmin.sourceRaw.useQuery({ id: sourceId });
  const [tab, setTab] = useState<'raw' | 'table' | 'map' | 'config'>('raw');
  const d = raw.data;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#05090b]">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <span className="text-sm font-semibold text-slate-100">原始数据 · {d?.name ?? '…'}</span>
        <span className="flex border border-white/10 text-[11px]">{([['raw', '原始返回'], ['table', '解析表格'], ['map', '可映射'], ['config', '接入配置']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`px-2 py-0.5 ${tab === k ? 'bg-teal-500/20 text-teal-100' : 'text-slate-400'}`}>{l}</button>)}</span>
        <button type="button" onClick={onClose} className="ml-auto text-[12px] text-slate-400 hover:text-white">关闭 ✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {raw.isLoading && <div className="text-slate-500"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />读取…</div>}
        {raw.error && <div className="text-red-300">{raw.error.message}</div>}
        {d?.note && <div className="text-slate-500">{d.note}</div>}
        {d && tab === 'raw' && d.text != null && <TextView text={d.text} truncated={d.truncated} path={`${d.name}.json`} />}
        {d && tab === 'table' && (d.table ? <><div className="mb-1 text-[11px] text-slate-300">{d.table.total.toLocaleString()} 行 × {d.table.columns.length} 列</div><PreviewTable columns={d.table.columns} rows={d.table.rows} max={300} /></> : <div className="text-slate-500">没有解析出表格</div>)}
        {d && tab === 'map' && (d.table ? <div className="max-w-3xl"><MappingView mapping={d.table.mapping} /></div> : <div className="text-slate-500">没有解析出表格</div>)}
        {d && tab === 'config' && <pre className="font-mono text-[11px] text-slate-200">{JSON.stringify(d.config, null, 2)}</pre>}
      </div>
    </div>
  );
}
