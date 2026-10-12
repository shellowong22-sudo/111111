/** 已改为实时数据版本（原模拟推演实现已移除） */
import { PGMLive } from "@/components/live/MMLive";
export default function PGMPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <PGMLive onClose={props.onClose} />;
}
