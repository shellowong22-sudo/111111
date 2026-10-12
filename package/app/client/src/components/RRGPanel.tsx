/** RRG 相对旋转图：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { MacroRRG } from "@/components/live/MacroXLive3";
export default function RRGPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MacroRRG onClose={onClose} />;
}
