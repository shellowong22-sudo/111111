/** WBIX 全球债券指数：已改为实时数据版本（原模拟实现已移除） */
import { IdxWBIX } from "@/components/live/IndexLive";
export default function WBIXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <IdxWBIX onClose={onClose} />;
}
