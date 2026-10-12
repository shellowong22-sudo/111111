/** NOTE：个人笔记永久保存在平台数据库；SHAR（共享笔记）使用平台讨论串与成员共享 */
import { NoteLive } from "@/components/live/CommsLive";
import CommsResearchLayer from "./CommsResearchLayer";
export default function NOTEPanel({ onClose, sharedMode }: { onClose?: () => void; sharedMode?: boolean } & Record<string, unknown>) {
  if (sharedMode) return <div className="h-full overflow-auto bg-[#03070c] px-2 pb-2"><CommsResearchLayer moduleId="SHAR" /></div>;
  return <NoteLive onClose={onClose} />;
}
