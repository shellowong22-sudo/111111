/** EM 新兴市场债：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { EmLive } from "@/components/live/EmsxLive";
export default function EmergingMarketsPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <EmLive onClose={props.onClose} />;
}
