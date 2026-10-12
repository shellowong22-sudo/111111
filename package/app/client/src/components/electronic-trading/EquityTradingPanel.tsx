/** EQUITY 股票执行：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { EquityLive } from "@/components/live/EmsxLive2";
export default function EquityTradingPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <EquityLive onClose={props.onClose} />;
}
