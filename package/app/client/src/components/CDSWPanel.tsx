/** CDSW 信用违约互换：已改为真实美债曲线贴现的期限结构剥离估值（原模拟实现已移除） */
import { CdswLive } from "@/components/live/BondRatesLive";
export default function CDSWPanel({ onClose }: { onClose?: () => void }) {
  return <CdswLive onClose={onClose} />;
}
