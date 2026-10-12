/** 自选品种：已改为实时数据版本（自选列表永久保存，实时行情与日线指标，原模拟实现已移除） */
import { WatchlistLive } from "@/components/live/TerminalLive";
interface WatchlistPanelProps {
  title: string;
}
export default function WatchlistPanel({ title }: WatchlistPanelProps) {
  return <WatchlistLive title={title} />;
}
