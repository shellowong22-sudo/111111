/** DTCP：已改为真实数据版本（原模拟数据实现已移除）；净额交收（逐证券轧差） */
import { StpNET } from "@/components/live/STPLive4";
export default function DtcpPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpNET onClose={props.onClose} />;
}
