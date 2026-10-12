/** 资本占用：已改为交易账户真实敞口与风险资本（原写死数据已移除） */
import { CapitalLive } from "@/components/live/PricingXLive";
export default function CapitalAdequacyPanel(_props: Record<string, unknown> = {}) {
  return <CapitalLive />;
}
