/** BTMM：国债与货币市场（资金面监控），与货币市场菜单 BTMM 同一实现 */
import { BtmmLive } from "@/components/live/MMLive2";
export default function BTMMPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <BtmmLive onClose={onClose} />;
}
