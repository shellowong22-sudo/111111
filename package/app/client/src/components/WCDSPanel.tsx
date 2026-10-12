/** WCDS 全球信用违约行情：没有公开 CDS 报价，统一为主权利差隐含违约概率（与 SOVR 同一实现；单名 CDS 估值在 CDSW） */
import { SOVRLive } from "@/components/live/CreditXLive2";
export default function WCDSPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <SOVRLive onClose={onClose} />;
}
