/** DDIS 股息分析：统一由 DdisLive 实现（原面板股息字段全部为空、两个标签为未接入说明，已移除）。 */
import { DdisLive } from "@/components/live/DdisLive";

export default function DDISPanel({ onClose }: { onClose?: () => void }) {
  return <DdisLive onClose={onClose} />;
}
