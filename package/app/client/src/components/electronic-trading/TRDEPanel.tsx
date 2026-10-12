/** TRDE 多品种列表：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { TrdeLive } from "@/components/live/EmsxLive2";
export default function TRDEPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <TrdeLive onClose={props.onClose} />;
}
