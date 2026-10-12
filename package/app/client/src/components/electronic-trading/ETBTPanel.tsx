/** ETBT 单品种记录簿：已改为基于平台模拟交易系统与实时行情的实现（原空壳 / 写死数据已移除） */
import { EtbtLive } from "@/components/live/EmsxLive2";
export default function ETBTPanel(props: { onClose?: () => void } & Record<string, unknown>) {
  return <EtbtLive onClose={props.onClose} />;
}
