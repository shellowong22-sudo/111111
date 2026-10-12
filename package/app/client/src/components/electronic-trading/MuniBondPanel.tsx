/** MUNI 地方债：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { MuniLive } from "@/components/live/EmsxLive";
export default function MuniBondPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <MuniLive onClose={props.onClose} />;
}
