/** FRD 外汇远期计算器：已改为实时数据版本（与终端外汇窗口同一实现） */
import { FrdLive } from "@/components/live/FxDeskLive3";
export default function FRDPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FrdLive onClose={onClose} />;
}
