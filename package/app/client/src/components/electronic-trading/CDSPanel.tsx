/** CDS 信用对冲：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { CdsHedgeLive } from "@/components/live/EmsxLive2";
export default function CDSPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <CdsHedgeLive onClose={props.onClose} />;
}
