import React from "react";
import { X } from "lucide-react";
import { PREFERRED_STOCK_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

interface PreferredStockMenuProps {
  onClose: () => void;
  onSelectItem?: (itemId: string, itemName: string) => void;
}

export const PreferredStockMenu: React.FC<PreferredStockMenuProps> = ({ onClose, onSelectItem }) => {
  const midpoint = 12;
  const columns = [PREFERRED_STOCK_CAPABILITIES.slice(0, midpoint), PREFERRED_STOCK_CAPABILITIES.slice(midpoint)];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden border border-amber-900/70 bg-[#070a0f] shadow-2xl" aria-label="优先股 23 项功能目录">
        <header className="flex items-center justify-between border-b border-amber-900/60 bg-[#0d1119] px-4 py-3">
          <div><p className="font-mono text-[10px] text-amber-400">佑诚功能主目录 ›</p><h2 className="text-sm font-semibold text-slate-100">优先股深度分析系统</h2></div>
          <button type="button" aria-label="关闭优先股功能目录" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={columnIndex === 0 ? "md:border-r md:border-amber-950" : ""}>
              {column.map((item, offset) => {
                const number = columnIndex === 0 ? offset + 1 : midpoint + offset + 1;
                return (
                  <button type="button" key={item.id} onClick={() => { onSelectItem?.(`pf-${item.id}`, item.name); onClose(); }} className="grid w-full grid-cols-[2rem_5.5rem_minmax(0,1fr)] items-start border-b border-amber-950 px-3 py-2 text-left hover:bg-amber-950/20 focus-visible:bg-amber-950/30 focus-visible:outline-none">
                    <span className="font-mono text-[10px] text-slate-600">{String(number).padStart(2, "0")}</span>
                    <span className="font-mono text-[11px] font-semibold text-amber-300">{item.code}</span>
                    <span className="min-w-0 text-xs font-medium text-slate-200">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-amber-900/60 bg-[#0d1119] px-4 py-2 text-[10px] text-slate-500"><span>优先股 23 项原功能</span><span className="font-mono text-amber-300">23 / 23</span></footer>
      </section>
    </div>
  );
};
