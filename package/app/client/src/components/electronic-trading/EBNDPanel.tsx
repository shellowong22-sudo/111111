/** EBND 全球电子债券：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { EbndLive } from "@/components/live/EmsxLive";
export default function EBNDPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <EbndLive onClose={props.onClose} />;
}
