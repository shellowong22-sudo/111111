/** WFII 外国组合投资：与经济数据中心 WFII 同一实现（含该功能的数据交付；原写死数据已移除） */
import EconomicDataHub from "@/pages/EconomicDataHub";
import { EconomicFieldSourceBoundary } from "@/components/econ/EconomicDataHubPreservedRoute";
export default function WFIIPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-auto"><EconomicFieldSourceBoundary path="/econ-hub?tab=wfii"><EconomicDataHub initialTab="wfii" /></EconomicFieldSourceBoundary></div>;
}
