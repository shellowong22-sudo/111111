/** ECTR 贸易流量小窗：与经济数据中心 ECTR 为同一实现（真实数据），原占位视图已移除 */
import ECTRTab from "@/components/econ/ECTRTab";
export default function ECTRPanel(_props: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full overflow-auto bg-[#03070c]"><ECTRTab /></div>;
}
