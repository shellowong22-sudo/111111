/** MOSO 最活跃期权：跨主要标的真实期权链的成交排名（原实现展示的是股票动量因子，与功能不符，已替换） */
import { MosoLive } from "@/components/live/DerivXLive";
export default function MOSOPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <MosoLive onClose={onClose} />;
}
