/** CRAN 固定收益工作表：已改为实时数据版本（原写死数据已移除） */
import { CranLive } from "@/components/live/BondXLive";
export default function CRANPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CranLive onClose={onClose} />;
}
