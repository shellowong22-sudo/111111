import IndustryGroupModuleWorkbench from "@/components/ig/IndustryGroupModuleWorkbench";
import OpenBBModuleDataBand from "@/components/OpenBBModuleDataBand";

export default function IndustryGroupAnalysis() {
  return <><OpenBBModuleDataBand path="/industry-analysis" title="行业横截面对比数据" /><IndustryGroupModuleWorkbench code="CLASS" /></>;
}
