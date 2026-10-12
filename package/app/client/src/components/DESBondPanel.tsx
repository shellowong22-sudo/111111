/** DES 债券描述：已改为真实数据版本（美债拍卖条款 + 最新收益率曲线估值；原模拟实现已移除） */
import { DesBondLive } from "@/components/live/BondRatesLive";
export default function DESBondPanel({ onClose }: { onClose?: () => void }) {
  return <DesBondLive onClose={onClose} />;
}
