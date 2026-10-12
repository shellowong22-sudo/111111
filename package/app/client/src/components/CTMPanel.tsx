/** CTM 合约表：已改为实时数据版本（原模拟实现已移除） */
import { CtmLive } from "@/components/live/MarketsLive";
export default function CTMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CtmLive onClose={onClose} />;
}
