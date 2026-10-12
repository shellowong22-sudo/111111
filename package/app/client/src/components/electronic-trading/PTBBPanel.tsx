/** PTBB 组合交易篮子：与交易账簿 AIM“目标权重与调仓指令”同一实现（同质功能合并） */
import { LedgerAIM } from "@/components/live/LedgerLive";
export default function PTBBPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <LedgerAIM />;
}
