/** AGENCY 机构抵押债：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { AgencyLive } from "@/components/live/EmsxLive";
export default function AgencyMBSPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <AgencyLive onClose={props.onClose} />;
}
