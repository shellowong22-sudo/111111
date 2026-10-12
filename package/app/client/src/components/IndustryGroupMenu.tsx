import { X } from "lucide-react";
import { INDUSTRY_GROUP_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

interface IndustryGroupMenuProps {
  onClose: () => void;
  onSelectItem?: (itemId: string, itemName: string) => void;
}

export function IndustryGroupMenu({ onClose, onSelectItem }: IndustryGroupMenuProps) {
  const midpoint = 11;
  const columns = [INDUSTRY_GROUP_CAPABILITIES.slice(0, midpoint), INDUSTRY_GROUP_CAPABILITIES.slice(midpoint)];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden border border-emerald-900/70 bg-[#07100f] shadow-2xl" aria-label="行业分组 22 项功能目录">
        <header className="flex items-center justify-between border-b border-emerald-900/60 bg-[#0a1715] px-4 py-3">
          <div><p className="font-mono text-[10px] text-emerald-400">佑诚功能主目录 ›</p><h2 className="text-sm font-semibold text-slate-100">佑诚行业分组</h2></div>
          <button type="button" aria-label="关闭行业分组功能目录" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={columnIndex === 0 ? "md:border-r md:border-emerald-950" : ""}>
              {column.map((item, offset) => {
                const number = columnIndex === 0 ? offset + 1 : midpoint + offset + 1;
                return (
                  <button type="button" key={item.id} onClick={() => { onSelectItem?.(item.id, item.name); onClose(); }} className="grid w-full grid-cols-[2rem_5.5rem_minmax(0,1fr)] items-start border-b border-emerald-950 px-3 py-2 text-left hover:bg-emerald-950/30 focus-visible:bg-emerald-950/40 focus-visible:outline-none">
                    <span className="font-mono text-[10px] text-slate-600">{String(number).padStart(2, "0")}</span>
                    <span className="font-mono text-[11px] font-semibold text-emerald-300">{item.code}</span>
                    <span className="min-w-0 text-xs font-medium text-slate-200">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-emerald-900/60 bg-[#0a1715] px-4 py-2 text-[10px] text-slate-500"><span>行业分组 22 项原功能</span><span className="font-mono text-emerald-300">22 / 22</span></footer>
      </section>
    </div>
  );
}
