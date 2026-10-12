/** CRPR 信用价差：与 MKTOV 信用市场概览（信用利差 / 评级分层）为同一功能，统一实现 */
import { EqMKTOV } from "@/components/live/EqFlowLive";
export default function CRPRPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <EqMKTOV onClose={onClose} />;
}
