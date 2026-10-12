/** CKAP 做市商：已改为实时数据版本（真实盘口双边报价、账户库存与合规风控检查，原模拟实现已移除） */
import { OmsCKAP } from "@/components/live/OMSLive";
export default function CKAPPanel() {
  return <OmsCKAP />;
}
