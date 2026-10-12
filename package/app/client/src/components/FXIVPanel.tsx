/** FXIV 外汇隐含波动：已改为实时数据版本（原模拟实现已移除） */
import { FxivLive } from "@/components/live/FxInfoLive";
export default function FXIVPanel({ onClose, ticker = "GBPUSD Curncy" }: { onClose: () => void; ticker?: string }) {
  return <FxivLive onClose={onClose} ticker={ticker} />;
}
