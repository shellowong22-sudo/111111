/** 量化回测：与定价风险页 BKT 策略回测引擎为同一实现（真实日线） */
import { LiveBacktest } from "@/components/live/PricingOpsLive";
export default function BacktestEnginePanel(_props: { title?: string } & Record<string, unknown>) {
  return <LiveBacktest />;
}
