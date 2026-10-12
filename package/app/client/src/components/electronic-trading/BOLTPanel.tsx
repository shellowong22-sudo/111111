/** BOLT 买卖报价列表：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { BoltLive } from "@/components/live/EmsxLive";
export default function BOLTPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <BoltLive onClose={props.onClose} />;
}
