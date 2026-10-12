/** CENB 央行查找：已改为实时数据版本（原写死数据已移除） */
import { CenbLive } from "@/components/live/EconLive";
export default function CENBPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CenbLive onClose={onClose} />;
}
