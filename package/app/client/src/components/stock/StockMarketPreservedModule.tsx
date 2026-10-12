import type { ReactNode } from "react";

export function isStockModuleId(moduleId: string) {
  return typeof moduleId === "string" && moduleId.length > 0;
}

/**
 * Keeps every stock capability on its original route and original component.
 * Data-depth work belongs inside that component; this wrapper must never append
 * a second generic panel or parallel research page below it.
 */
export default function StockMarketPreservedModule({
  moduleId,
  original,
}: {
  moduleId: string;
  original: ReactNode;
  onNavigate?: (targetId: string) => void;
}) {
  return (
    <section
      className="stock-terminal-workspace h-full min-h-0 min-w-0 overflow-auto bg-black"
      data-stock-original-workspace={moduleId}
    >
      {original}
    </section>
  );
}
