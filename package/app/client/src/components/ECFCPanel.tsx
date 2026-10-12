/** ECFC 经济预测：与经济数据中心 ECFC 同一实现（国际货币基金组织预测矩阵，原写死数据已移除） */
import ECFCTab from "@/components/econ/ECFCTab";
export default function ECFCPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-auto bg-[#03070c]"><ECFCTab /></div>;
}
