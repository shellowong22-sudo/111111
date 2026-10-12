/** VCON 交易确认核验（与直通式处理 VCAD 同一实现）：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { StpVCAD } from "@/components/live/STPLive2";
export default function VCONPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpVCAD onClose={props.onClose} />;
}
