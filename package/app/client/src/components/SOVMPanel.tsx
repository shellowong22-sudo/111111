/** SOVM：已改为实时数据版本（原模拟实现已移除） */
import { SOVMLive } from "@/components/live/CreditXLive2";
export default function SOVMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <SOVMLive onClose={onClose} />;
}
