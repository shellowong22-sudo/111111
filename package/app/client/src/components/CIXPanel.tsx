/** CIX 自设指数：各入口统一为同一实现（自定义篮子 / 价差 / 比值指数，按真实行情计算并保存在平台数据库；原本地示例指数已移除） */
import { CixxLive } from "@/components/live/IndexXLive";
export default function CIXPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <CixxLive onClose={onClose} />;
}
