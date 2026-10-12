/** CIX 自设指数：与其他入口同一实现（全球主要指数行情见 WEI） */
import { CixxLive } from "@/components/live/IndexXLive";
export default function CIXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <CixxLive onClose={onClose} />;
}
