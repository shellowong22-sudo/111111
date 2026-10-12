/** YCURVE：收益率曲线分析，统一到 YLD 实现 */
import { LiveYieldCurve } from "@/components/live/PricingLive";
export default function YCURVEEnhancedPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <LiveYieldCurve />;
}
