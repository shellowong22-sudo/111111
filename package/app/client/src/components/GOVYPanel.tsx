/** GOVY 利率交易员：与 IRS 曲线相对价值监控合并为同一实现（同质功能合并，原写死数据已移除） */
import { IrsLive } from "@/components/live/RatesFxLive";
export default function GOVYPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <IrsLive onClose={onClose} />;
}
