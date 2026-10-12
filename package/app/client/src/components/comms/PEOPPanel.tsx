/** PEOP / BIO：平台成员目录（真实账号），原示例人物已移除 */
import { PeopLive } from "@/components/live/CommsLive";
export default function PEOPPanel({ onClose }: { onClose?: () => void; bioMode?: boolean } & Record<string, unknown>) {
  return <PeopLive onClose={onClose} />;
}
