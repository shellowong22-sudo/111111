/** SPDL / SPDI：与直通处理的 SPDL 证券速拨目录为同一功能代码，统一实现 */
import { StpSPDL } from "@/components/live/STPLive3";
export default function SPDLPanel({ onClose }: { onClose?: () => void; importMode?: boolean } & Record<string, unknown>) {
  return <StpSPDL onClose={onClose} />;
}
