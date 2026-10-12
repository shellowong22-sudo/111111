/** OMON 期权行情：与衍生品终端期权链同一实现（真实期权链；原写死数据已移除） */
import DerivTerminal from "@/uc/hubs/DerivTerminal";
export default function OMONPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-hidden"><DerivTerminal /></div>;
}
