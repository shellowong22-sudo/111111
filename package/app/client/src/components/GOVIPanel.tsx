/** GOVI 国债市场间利差矩阵：与 SOVM 主权利差热力矩阵合并为同一实现（原写死数据已移除） */
import { SOVMLive } from "@/components/live/CreditXLive2";
export default function GOVIPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <SOVMLive onClose={onClose} />;
}
