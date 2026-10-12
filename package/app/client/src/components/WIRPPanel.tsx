/** WIRP 利率概率：与利率工作台“政策利率路径”同一实现（联邦基金期货隐含路径；原写死数据已移除） */
import { RatesDesk } from "@/uc/hubs/RatesDesk";
export default function WIRPPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-hidden"><RatesDesk initial="path" /></div>;
}
