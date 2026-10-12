/** IMGR 库存与定价：与电子交易 IMGR 为同一实现（同一功能代码只保留一个实现） */
import { ImgrLive } from "@/components/live/EmsxLive2";
export default function IMGRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown> = {}) {
  return <ImgrLive onClose={onClose} />;
}
