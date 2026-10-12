/** MGU / MRUL / VACN / SMGM：平台没有独立邮件系统，设置类功能统一为讨论串提醒规则与提醒记录（真实数据） */
import { CommsRulesLive } from "@/components/live/CommsLive";
export type CommsSettingMode = "MGU" | "MRUL" | "VACN" | "SMGM" | "archive";
export default function CommsSettings({ mode }: { mode: CommsSettingMode }) {
  return <CommsRulesLive code={mode === "archive" ? "ARCHIVE" : mode} />;
}
