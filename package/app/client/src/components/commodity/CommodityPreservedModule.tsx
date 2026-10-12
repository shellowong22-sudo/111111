import type { ReactNode } from "react";
import { RegionalInventoryPanel } from "./CommodityRegionalInventoryTools";

export default function CommodityPreservedModule({ moduleId, children }: { moduleId: string; children?: ReactNode }) {
  const id = moduleId.toUpperCase();
  // COMM already has its own live directory and drill-down. Account tools now
  // live inside that workbench, not as a second page appended below it.
  if (id === "COMM") return <div className="min-h-full bg-slate-950">{children}</div>;
  // OILS already owns WTI/Brent prices, EIA national operations and WTI COT.
  // Only the distinct PADD regional breakdown belongs alongside that page.
  if (id === "OILS") return (
    <div className="min-h-full bg-slate-950">
      {children}
      <div className="mx-4 my-4"><RegionalInventoryPanel /></div>
    </div>
  );
  // 其余商品功能（SPOT / CTM / SEAG / CCRV / MAP / CPLY / CMRV / COSY / GP）都已是完整的实时面板，
  // 不再在下方追加观察层，避免同一组数据重复出现。
  return <div className="min-h-full bg-slate-950">{children}</div>;
}
