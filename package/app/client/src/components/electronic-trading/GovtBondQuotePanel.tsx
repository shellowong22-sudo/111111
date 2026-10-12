/** GOVT 国债执行：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { GovtLive } from "@/components/live/EmsxLive";
export default function GovtBondQuotePanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <GovtLive onClose={props.onClose} />;
}
