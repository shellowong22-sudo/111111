/** 外汇模块交互桥：已改为实时数据版本（原模拟实现已移除） */
import type { ReactNode } from "react";
import { ForexBridge } from "@/components/live/RatesFxLive3";
export default function ForexOriginalInteractionBridge({ moduleId, children }: { moduleId: "FXTF" | "FXC"; children: ReactNode }) {
  return <ForexBridge moduleId={moduleId}>{children}</ForexBridge>;
}
