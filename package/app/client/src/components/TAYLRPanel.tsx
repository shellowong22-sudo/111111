/** TAYLR 泰勒规则：与经济数据中心 TAYL 同一实现（真实政策利率与通胀，原写死数据已移除） */
import TAYLTab from "@/components/econ/TAYLTab";
export default function TAYLRPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-auto bg-[#03070c]"><TAYLTab /></div>;
}
