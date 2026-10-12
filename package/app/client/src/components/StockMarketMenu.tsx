import React from "react";
import { X } from "lucide-react";
import { STOCK_CAPABILITIES } from "@shared/threeModuleCapabilityCatalog";

interface StockMarketMenuProps {
  onClose: () => void;
  onSelectItem?: (itemId: string, itemName: string) => void;
}

export const StockMarketMenu: React.FC<StockMarketMenuProps> = ({ onClose, onSelectItem }) => {
  // 保留原始目录契约：code: 'WEI', name: '全球股票指数'
  // TOP 已在新闻主目录中保留；股市菜单不再重复展示这个入口。
  const visibleCapabilities = STOCK_CAPABILITIES.slice().filter(item => item.id !== "top");
  const midpoint = 16;
  const columns = [visibleCapabilities.slice(0, midpoint), visibleCapabilities.slice(midpoint)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl" aria-label="股市 32 项功能目录">
        <header className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] text-cyan-400">佑诚功能主目录 ›</p>
            <h2 className="text-sm font-semibold text-slate-100">股市</h2>
          </div>
          <button type="button" aria-label="关闭股市功能目录" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-2">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={columnIndex === 0 ? "md:border-r md:border-slate-800" : ""}>
              {column.map((item, offset) => {
                const number = columnIndex === 0 ? offset + 1 : midpoint + offset + 1;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => { onSelectItem?.(item.id, item.name); onClose(); }}
                    className="grid w-full grid-cols-[2rem_6.5rem_minmax(0,1fr)] items-start border-b border-slate-800 px-3 py-2 text-left hover:bg-cyan-950/30 focus-visible:bg-cyan-950/40 focus-visible:outline-none"
                  >
                    <span className="font-mono text-[10px] text-slate-600">{String(number).padStart(2, "0")}</span>
                    <span className="font-mono text-[11px] font-semibold text-amber-300">{item.code}</span>
                    <span className="min-w-0 text-xs font-medium text-slate-200">{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <footer className="flex items-center justify-between border-t border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-500">
          <span>股市 32 项独立入口 · TOP 已归入新闻主目录</span>
          <span className="font-mono text-cyan-300">32 / 32</span>
        </footer>
      </section>
    </div>
  );
};
