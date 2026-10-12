/** SEAG 季节性：已改为实时数据版本（与同代码其他入口同一实现，原写死数据已移除） */
import { SeagLive } from "@/components/live/MarketsLive";
export default function SEAGPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <SeagLive onClose={onClose} />;
}
