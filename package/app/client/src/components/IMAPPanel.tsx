/** IMAP 日内市场图：统一由 ImapLive 实现（原面板中未配置的资金流 / 逐笔 / Level 2 视图已移除）。 */
import { ImapLive } from "@/components/live/ImapLive";

export default function IMAPPanel({ onClose }: { onClose?: () => void }) {
  return <ImapLive onClose={onClose} />;
}
