/** UACK 交易确认消息（与直通式处理 IB 同一实现）：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { StpIB } from "@/components/live/STPLive3";
export default function UACKPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpIB onClose={props.onClose} />;
}
