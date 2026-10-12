/** ECST 统计数据：与经济数据中心 ECST 同一实现（官方月度 / 季度数据 + 各国年度与预测；原写死数据已移除） */
import EconomicDataHub from "@/pages/EconomicDataHub";
import { EconomicFieldSourceBoundary } from "@/components/econ/EconomicDataHubPreservedRoute";
export default function ECSTPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-auto"><EconomicFieldSourceBoundary path="/econ-hub?tab=ecst"><EconomicDataHub initialTab="ecst" /></EconomicFieldSourceBoundary></div>;
}
