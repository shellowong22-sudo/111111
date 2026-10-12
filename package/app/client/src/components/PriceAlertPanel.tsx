/** 价格预警：已改为实时数据版本（预警条件永久保存，按实时行情判断触发，原模拟实现已移除） */
import { PriceAlertLive } from "@/components/live/TerminalLive";
interface PriceAlertPanelProps {
  title: string;
}
export default function PriceAlertPanel({ title }: PriceAlertPanelProps) {
  return <PriceAlertLive title={title} />;
}
