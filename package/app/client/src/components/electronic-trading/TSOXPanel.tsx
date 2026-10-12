/** TSOX 执行质量（与 TOMS 委托总览同一实现）：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { OmsOverview } from "@/components/live/OMSLive";
export default function TSOXPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <OmsOverview onClose={props.onClose} />;
}
