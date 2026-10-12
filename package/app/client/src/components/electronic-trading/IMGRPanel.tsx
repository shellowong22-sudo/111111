/** IMGR 库存与定价：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { ImgrLive } from "@/components/live/EmsxLive2";
export default function IMGRPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <ImgrLive onClose={props.onClose} />;
}
