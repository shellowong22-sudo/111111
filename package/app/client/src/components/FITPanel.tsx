/** FIT 固定收益交易：与电子交易 FIT 为同一实现（利率隐含公允变动与执行） */
import { FitLive } from "@/components/live/EmsxLive";
export default function FITPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FitLive onClose={onClose} />;
}
