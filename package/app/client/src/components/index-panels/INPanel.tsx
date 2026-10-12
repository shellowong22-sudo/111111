/** IN 指数浏览器：统一由 IdxIN 实现（Terminal 窗口与指数中心共用同一实现）。 */
import { IdxIN } from "@/components/live/IndexInLive";

export default function INPanel({ onClose }: { onClose?: () => void }) {
  return <IdxIN onClose={onClose} />;
}
