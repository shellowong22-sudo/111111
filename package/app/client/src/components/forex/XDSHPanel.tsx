/** XDSH 外汇市场状态仪表：已改为实时数据版本（与终端外汇窗口同一实现） */
import { XdshLive } from "@/components/live/FxDeskLive3";
export default function XDSHPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <XdshLive onClose={onClose} />;
}
