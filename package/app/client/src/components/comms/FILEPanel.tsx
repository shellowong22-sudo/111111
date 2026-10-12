/** FILE：我的资料库（各功能保存在平台数据库的个人数据），原示例文件列表已移除 */
import { FileLive } from "@/components/live/CommsLive";
export default function FILEPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <FileLive onClose={onClose} />;
}
