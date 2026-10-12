/** 交易委托簿：已改为实时数据版本（真实盘口、逐笔报价与本账户委托，原模拟实现已移除） */
import { OrderBookLive } from "@/components/live/TerminalLive";
interface OrderBookPanelProps { title: string; symbol?: string; }
export default function OrderBookPanel({ title, symbol }: OrderBookPanelProps) {
  return <OrderBookLive title={title} symbol={symbol} />;
}
