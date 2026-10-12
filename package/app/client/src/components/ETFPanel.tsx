/** ETF：统一由 EtfLive 实现（原“资金流量 / 溢价折价”两个未配置视图已移除；固定收益 ETF 见 WETF，资金方向见 TFLO）。 */
import { EtfLive } from "@/components/live/EtfLive";

export default function ETFPanel({ onClose }: { onClose?: () => void }) {
  return <EtfLive onClose={onClose} />;
}
