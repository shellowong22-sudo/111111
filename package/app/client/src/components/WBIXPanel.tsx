/** WBIX 全球债券指数：各入口统一为同一实时实现 */
import { IdxWBIX } from "@/components/live/IndexLive";
export default function WBIXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <IdxWBIX onClose={onClose} />;
}
