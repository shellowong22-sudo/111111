/** ALLQ 单一货币全球报价面：已改为实时数据版本（与终端外汇窗口同一实现） */
import { AllqLive } from "@/components/live/FxDeskLive3";
export default function ALLQPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <AllqLive onClose={onClose} />;
}
