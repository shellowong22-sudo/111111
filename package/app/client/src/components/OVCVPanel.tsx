/** OVCV 可转债估值：与 /ovcv 页面为同一功能，统一使用实时可转债工作台（原写死参数的实现已移除） */
import { ConvertibleDesk } from "@/uc/hubs/PropertyDesk";
export default function OVCVPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-hidden"><ConvertibleDesk /></div>;
}
