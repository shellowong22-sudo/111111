/** WBI 全球通胀挂钩债券：已改为实时数据版本（原写死数据已移除） */
import { WbiLive } from "@/components/live/BondXLive";
export default function WBIPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <WbiLive onClose={onClose} />;
}
