/** YAS 收益率与利差分析：与 FIBC 债券计算器为同一功能，统一实现 */
import { FibcLive } from "@/components/live/MMLive2";
export default function YASPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FibcLive onClose={onClose} />;
}
