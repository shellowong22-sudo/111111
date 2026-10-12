/** EFSF：已改为实时数据版本（原模拟实现已移除） */
import { EFSFLive } from "@/components/live/CreditXLive2";
export default function EFSFPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EFSFLive onClose={onClose} />;
}
