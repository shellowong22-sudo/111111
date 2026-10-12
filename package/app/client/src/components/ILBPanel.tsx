/** ILB 通胀挂钩债券：已改为实时数据版本（原写死数据已移除） */
import { IlbLive } from "@/components/live/BondXLive";
export default function ILBPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <IlbLive onClose={onClose} />;
}
