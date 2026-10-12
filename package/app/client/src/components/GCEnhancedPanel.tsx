/** GC 绘制曲线图：各入口统一为同一实现（多国收益率曲线、利差、情景位移与久期计算） */
import GCPanel from "@/components/GCPanel";
export default function GCEnhancedPanel({ onClose }: { onClose?: () => void } & Record<string, unknown>) {
  return <GCPanel onClose={onClose ?? (() => undefined)} />;
}
