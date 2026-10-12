/** 绘制曲线图：与个人工作台的自选图表同一实现（真实行情，布局永久保存；原写死数据已移除） */
import PersonalWorkspaceLive from "@/components/live/PageXWorkspace";
export default function NEWSRPTPanel(_p: { onClose?: () => void } & Record<string, unknown>) {
  return <div className="h-full min-h-0 overflow-auto"><PersonalWorkspaceLive /></div>;
}
