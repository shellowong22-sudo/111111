/** CIXX 自定义指数：已改为实时数据版本（原模拟实现已移除） */
import { CixxLive } from "@/components/live/IndexXLive";
export default function CIXXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CixxLive onClose={onClose} />;
}
