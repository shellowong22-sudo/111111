/** IRSWAP 利率互换对冲：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { IrswapLive } from "@/components/live/EmsxLive2";
export default function IRSwapPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <IrswapLive onClose={props.onClose} />;
}
