/** CORP 公司债执行：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { CorpLive } from "@/components/live/EmsxLive";
export default function CorporateBondPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <CorpLive onClose={props.onClose} />;
}
