/** CALC：债券计算器（久期、凸性、DV01、现金流），与 FIBC 同一实现 */
import { FibcLive } from "@/components/live/MMLive2";
export default function CalcPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FibcLive onClose={onClose} />;
}
