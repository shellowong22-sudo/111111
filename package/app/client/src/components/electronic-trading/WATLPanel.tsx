/** WATL 观察列表与技术状态：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { WatlLive } from "@/components/live/EmsxLive2";
export default function WATLPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <WatlLive onClose={props.onClose} />;
}
