/**
 * 终端小窗功能面板公用外壳：顶栏（功能代码 / 名称 / 关闭）+ 子功能条 + 内容区；
 * 点任何标的在窗口内右侧滑出实时 K 线；点任何文书 / 新闻在终端内阅读，不跳出终端。
 */
import { useState } from "react";
import { HubContext, SymbolPane } from "@/uc/hubs/kit";
import { DEFAULT_PREFS, NewsCtx, ReaderDrawer, SectionHead, type News } from "@/uc/news/kit";
import { usePolled } from "@/uc/market/live";

export function PanelShell({ code, title, onClose, tabs, tab, setTab, right, children }: { code: string; title: string; onClose?: () => void; tabs?: Array<[string, string]>; tab?: string; setTab?: (t: string) => void; right?: React.ReactNode; children: React.ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [reading, setReading] = useState<News | null>(null);
  return (
    <HubContext.Provider value={{ pick: setPicked, picked }}>
      <NewsCtx.Provider value={{ prefs: DEFAULT_PREFS, open: setReading, openSymbol: setPicked, selected: reading?.id ?? null }}>
        <div className="relative flex h-full min-h-[420px] flex-col bg-[#03070c] text-slate-200">
          <div className="flex items-center gap-2 border-b border-[#1a2a3c] bg-[#060d16] px-2 py-1">
            <span className="font-mono text-[11px] text-amber-300">{code}</span>
            <span className="text-[12px] font-semibold text-white">{title}</span>
            <span className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">{right}<span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />实时</span></span>
            {onClose && <button type="button" onClick={onClose} aria-label={`关闭 ${code}`} className="ml-1 px-1 text-[12px] text-slate-400 hover:text-white">✕</button>}
          </div>
          {tabs && tabs.length > 1 && (
            <nav className="flex min-w-0 overflow-x-auto border-b border-[#1a2a3c] bg-[#050b13]">
              {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab?.(id)} className={`shrink-0 border-r border-[#111d2b] px-2.5 py-1 text-[11px] ${tab === id ? "bg-[#0d2236] text-white shadow-[inset_0_-2px_0_#22d3ee]" : "text-slate-400 hover:bg-[#0a1726]"}`}>{label}</button>)}
            </nav>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {picked && <div className="absolute inset-y-0 right-0 z-20 w-[min(560px,92%)] border-l border-[#1a2a3c] bg-[#050a11] shadow-2xl"><SymbolPane symbol={picked} onClose={() => setPicked(null)} /></div>}
          <ReaderDrawer item={reading} onClose={() => setReading(null)} />
        </div>
      </NewsCtx.Provider>
    </HubContext.Provider>
  );
}

export function Kpis({ items }: { items: Array<[string, React.ReactNode, string?]> }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-[#1a2a3c] sm:grid-cols-4">
      {items.map(([k, v, sub]) => <div key={k} className="bg-[#050b13] px-2 py-1.5"><div className="text-[10px] text-slate-500">{k}</div><div className="font-mono text-[15px] text-white">{v}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}</div>)}
    </div>
  );
}

export const Empty = ({ loading, text = "暂无数据" }: { loading?: boolean; text?: string }) => <div className="px-3 py-6 text-[11px] text-slate-500">{loading ? "读取中…" : text}</div>;

/** 简单的虚拟滚动表体：只渲染可见区域的行（大表不卡） */
export function VirtualRows<T>({ rows, height = 520, rowH = 22, render, header }: { rows: T[]; height?: number; rowH?: number; render: (r: T, i: number) => React.ReactNode; header?: React.ReactNode }) {
  const [top, setTop] = useState(0);
  const start = Math.max(0, Math.floor(top / rowH) - 10);
  const end = Math.min(rows.length, Math.ceil((top + height) / rowH) + 10);
  return (
    <div className="overflow-auto" style={{ maxHeight: height }} onScroll={(e) => setTop((e.target as HTMLDivElement).scrollTop)}>
      <table className="w-full text-[11px]">
        {header}
        <tbody>
          {start > 0 && <tr style={{ height: start * rowH }}><td /></tr>}
          {rows.slice(start, end).map((r, i) => render(r, start + i))}
          {end < rows.length && <tr style={{ height: (rows.length - end) * rowH }}><td /></tr>}
        </tbody>
      </table>
    </div>
  );
}

/** 文书 / 公告 / 判决 / 新闻稿列表：点击在终端内阅读全文 */
export type DocRow = { id: string; title: string; sub?: string; date: string | number; url?: string | null; summary?: string | null; tag?: string };
export function DocList({ rows, loading, empty }: { rows: DocRow[]; loading?: boolean; empty?: string }) {
  const [open, setOpen] = useState<News | null>(null);
  if (!rows.length) return <Empty loading={loading} text={empty} />;
  return (
    <>
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => setOpen({ id: `doc:${r.id}`, title: r.title, summary: r.summary ?? r.sub ?? null, url: r.url ?? null, time: typeof r.date === "number" ? r.date : Date.parse(String(r.date)) || Date.now(), tone: 0, tags: r.tag ? [r.tag] : [], cats: [], tickers: [], lang: "en", kind: "article", score: 0, cluster: 1 } as unknown as News)} className="cursor-pointer border-t border-[#0f1b29] align-top hover:bg-[#0a1726]">
              <td className="w-[86px] whitespace-nowrap px-2 py-1 font-mono text-[10px] text-slate-500">{typeof r.date === "number" ? new Date(r.date).toLocaleDateString("zh-CN") : String(r.date).slice(0, 10)}</td>
              <td className="py-1 pr-2">
                <div className="text-slate-100">{r.tag && <span className="mr-1.5 border border-[#1d3047] px-1 text-[9px] text-cyan-300">{r.tag}</span>}{r.title}</div>
                {r.sub && <div className="text-[10px] text-slate-500">{r.sub}</div>}
                {r.summary && <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">{r.summary}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReaderDrawer item={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** 浏览器级的个人编号（与组合页共用），用于把个人保存项永久写入平台数据库 */
export function ownerId() {
  try {
    let id = localStorage.getItem("uc.pf.owner");
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("uc.pf.owner", id);
    }
    return id;
  } catch {
    return "guest-device";
  }
}
export function useSaved<T>(key: string) {
  return usePolled<T | null>("ucHubs.saved", { owner: ownerId(), key }, 600_000);
}
export async function saveItem(key: string, data: unknown) {
  await fetch("/api/trpc/ucHubs.save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: { owner: ownerId(), key, data } }) });
}
export { SectionHead };
