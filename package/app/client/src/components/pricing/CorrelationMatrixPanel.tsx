/** CORR：已改为实时数据版本（原模拟实现已移除） */
import { MacroCorrelation } from "@/components/live/MacroXLive3";
export default function CorrelationMatrixPanel(_props: Record<string, unknown> = {}) {
  return <MacroCorrelation />;
}
