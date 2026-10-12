/** MiFID II 最佳执行（与直通式处理 MIFI 同一实现）：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { StpMIFI } from "@/components/live/STPLive2";
export default function MIFIETPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <StpMIFI onClose={props.onClose} />;
}
