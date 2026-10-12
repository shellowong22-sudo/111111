/** FIT 固收执行预估：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { FitLive } from "@/components/live/EmsxLive";
export default function FITPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <FitLive onClose={props.onClose} />;
}
