/** 委托时间线回放：已改为实时数据版本（按平台交易系统真实事件流水逐步重放委托生命周期，原模拟实现已移除） */
import { OmsReplay } from "@/components/live/OMSLive";

export interface TimelineEvent {
  id: string;
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  status: 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  prevStatus?: string;
  timestamp: number;
  note?: string;
  filledQty?: number;
  avgPrice?: number;
}

interface OrderTimelineReplayProps {
  orderId?: string;
  symbol?: string;
  onClose?: () => void;
}

export default function OrderTimelineReplay({ orderId, symbol, onClose }: OrderTimelineReplayProps) {
  return <OmsReplay orderId={orderId} symbol={symbol} onClose={onClose} />;
}
