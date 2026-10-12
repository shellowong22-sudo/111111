/** 已改为实时数据版本（原模拟推演实现已移除） */
import { PBOCLive } from "@/components/live/MMLive";
export default function PBOCPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PBOCLive onClose={props.onClose} />;
}
