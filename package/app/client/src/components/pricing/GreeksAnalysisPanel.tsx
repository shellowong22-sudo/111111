/** 希腊值分析：与 DLIB 个人衍生品库（逐笔重估、净希腊值汇总）为同一功能，统一实现 */
import { DlibLive } from "@/components/live/DerivLibLive";
export default function GreeksAnalysisPanel(_props: Record<string, unknown> = {}) {
  return <DlibLive />;
}
