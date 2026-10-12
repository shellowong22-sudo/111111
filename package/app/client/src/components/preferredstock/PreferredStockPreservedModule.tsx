import React from "react";
import PreferredCapabilityAnalysisTool from "./PreferredCapabilityAnalysisTool";

/** Keep every original preferred-stock function as one full-width workspace. */
export default function PreferredStockPreservedModule({
  moduleId,
  original,
}: {
  moduleId: string;
  original: React.ReactNode;
  onNavigate?: (targetId: string) => void;
}) {
  return (
    <section
      className="h-full min-h-0 min-w-0 overflow-hidden bg-black"
      data-preferred-stock-original-workspace={moduleId}
    >
      {original ?? <PreferredCapabilityAnalysisTool moduleId={moduleId} />}
    </section>
  );
}

