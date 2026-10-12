/** CREDANAL：已改为实时数据版本（原模拟实现已移除） */
import { CREDANALLive } from "@/components/live/CreditXLive";
export default function CREDANALPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CREDANALLive onClose={onClose} />;
}
