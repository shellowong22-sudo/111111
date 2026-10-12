/** FITG 固收交易网格：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { FitgLive } from "@/components/live/EmsxLive";
export default function FITGPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <FitgLive onClose={props.onClose} />;
}
