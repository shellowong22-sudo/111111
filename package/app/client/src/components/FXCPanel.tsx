/** FXC 外汇交叉汇率：统一由 FxcLive 实现（实时交叉矩阵 + 利率平价理论远期；原“远期合同未接入”空档已替换）。 */
import { FxcLive } from "@/components/live/FxcLive";

export default function FXCPanel({ onClose }: { onClose?: () => void }) {
  return <FxcLive onClose={onClose} />;
}
