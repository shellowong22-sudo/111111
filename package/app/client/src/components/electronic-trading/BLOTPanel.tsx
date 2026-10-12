/** BLOT 成交簿（与直通式处理 BLOT 同一实现）：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { StpBLOT } from "@/components/live/STPLive";
export default function BLOTPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpBLOT onClose={props.onClose} />;
}
