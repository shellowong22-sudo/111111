/** INP 市场快照：与终端 INP 同一实现（由真实行情生成，原写死数据已移除） */
import { INPPanel as InpLive } from "@/components/CIXEditors";
export default function INPPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <InpLive onClose={onClose ?? (() => undefined)} />;
}
