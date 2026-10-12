/** 交易账簿管理：已改为实时数据版本（全部基于平台自有交易系统的真实委托、成交、持仓与交收记录，原模拟实现已移除） */
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PanelShell } from "@/uc/panels/kit";
import { LedgerAIM, LedgerFutPositions, LedgerFutures, LedgerImpact, LedgerOptions, LedgerSettlement, LedgerStock, LedgerSummary, LedgerTOMS } from "@/components/live/LedgerLive";

type PanelId = "STOCK" | "FUTURES" | "OPTIONS" | "TBGS" | "BTFI" | "TBMI" | "AIM" | "TOMS" | "TSDM";
interface NavGroup { label: string; color: string; items: { id: PanelId; code?: string; name: string }[] }

const NAV_GROUPS: NavGroup[] = [
  { label: "交易账簿发售", color: "#f59e0b", items: [{ id: "STOCK", name: "交易账簿股票" }, { id: "FUTURES", name: "交易账簿期货" }, { id: "OPTIONS", name: "交易账簿期权" }] },
  { label: "交易账簿产品信息", color: "#60a5fa", items: [{ id: "TBGS", code: "TBGS", name: "交易账簿汇总视图" }, { id: "BTFI", code: "BTFI", name: "期货持仓信息" }, { id: "TBMI", code: "TBMI", name: "账簿市场影响分析" }] },
  { label: "资产管理与订单", color: "#34d399", items: [{ id: "AIM", code: "AIM", name: "资产指令管理系统" }, { id: "TOMS", code: "TOMS", name: "交易订单管理系统" }, { id: "TSDM", code: "TSDM", name: "交易结算与交收管理" }] },
];
const IDS: PanelId[] = ["STOCK", "FUTURES", "OPTIONS", "TBGS", "BTFI", "TBMI", "AIM", "TOMS", "TSDM"];

function renderPanel(id: PanelId) {
  switch (id) {
    case "STOCK": return <LedgerStock />;
    case "FUTURES": return <LedgerFutures />;
    case "OPTIONS": return <LedgerOptions />;
    case "TBGS": return <LedgerSummary />;
    case "BTFI": return <LedgerFutPositions />;
    case "TBMI": return <LedgerImpact />;
    case "AIM": return <LedgerAIM />;
    case "TOMS": return <LedgerTOMS />;
    case "TSDM": return <LedgerSettlement />;
  }
}

export default function TradingLedger() {
  const [activePanel, setActivePanel] = useState<PanelId>(() => {
    const p = new URLSearchParams(window.location.search).get("panel");
    return p && (IDS as string[]).includes(p) ? (p as PanelId) : "STOCK";
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("panel", activePanel);
    window.history.replaceState({}, "", url.toString());
  }, [activePanel]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(NAV_GROUPS.map((g) => g.label)));
  const toggleGroup = useCallback((label: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n; }), []);
  const activeItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activePanel);

  return (
    <div className="flex h-full overflow-hidden bg-[#03070c] text-white">
      <div className="flex w-52 flex-shrink-0 flex-col overflow-y-auto border-r border-[#1a2a3c] bg-[#050b13]">
        <div className="border-b border-[#1a2a3c] px-3 py-2"><div className="text-[12px] font-bold text-slate-200">交易账簿管理</div><div className="mt-0.5 text-[10px] text-slate-500">平台交易账户 · 实时行情撮合</div></div>
        <div className="flex-1 py-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <button type="button" onClick={() => toggleGroup(group.label)} className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold hover:bg-[#0a1726]" style={{ color: group.color }}>
                <span>{group.label}</span><span className="text-slate-600">{expanded.has(group.label) ? "▾" : "▸"}</span>
              </button>
              {expanded.has(group.label) && group.items.map((item) => (
                <button key={item.id} type="button" onClick={() => setActivePanel(item.id)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left", activePanel === item.id ? "bg-[#0d2236] shadow-[inset_-2px_0_0_#22d3ee]" : "hover:bg-[#0a1726]")}>
                  <span className="w-10 flex-shrink-0 font-mono text-[9px] font-bold text-cyan-400">{item.code ?? ""}</span>
                  <span className={cn("text-[11px]", activePanel === item.id ? "text-white" : "text-slate-400")}>{item.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <PanelShell key={activePanel} code={activeItem?.code ?? activePanel} title={activeItem?.name ?? ""}>{renderPanel(activePanel)}</PanelShell>
      </div>
    </div>
  );
}
