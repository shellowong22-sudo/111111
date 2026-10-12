/** DLIB 个人衍生品库：已改为实时数据版本（原模拟实现已移除） */
import { DlibLive } from "@/components/live/DerivLibLive";
export default function DLIBPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <DlibLive onClose={onClose} />;
}
