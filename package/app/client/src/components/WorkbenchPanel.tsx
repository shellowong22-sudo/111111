import { X, Pin, PinOff } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export interface WorkbenchPanelData {
  id: number;
  panelCode: string;
  panelName: string;
  panelType: "bond" | "equity" | "derivative" | "commodity" | "index" | "economic";
  icon?: string;
  position: number;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkbenchPanelProps {
  panel: WorkbenchPanelData;
  onRemove: (panelId: number) => void;
  onTogglePin: (panelId: number) => void;
  onNavigate: (panelCode: string) => void;
}

export function WorkbenchPanel({
  panel,
  onRemove,
  onTogglePin,
  onNavigate,
}: WorkbenchPanelProps) {
  const typeColors: Record<string, string> = {
    bond: "bg-blue-50 border-blue-200",
    equity: "bg-green-50 border-green-200",
    derivative: "bg-purple-50 border-purple-200",
    commodity: "bg-yellow-50 border-yellow-200",
    index: "bg-orange-50 border-orange-200",
    economic: "bg-red-50 border-red-200",
  };

  const typeBadgeColors: Record<string, string> = {
    bond: "bg-blue-100 text-blue-800",
    equity: "bg-green-100 text-green-800",
    derivative: "bg-purple-100 text-purple-800",
    commodity: "bg-yellow-100 text-yellow-800",
    index: "bg-orange-100 text-orange-800",
    economic: "bg-red-100 text-red-800",
  };

  const typeLabels: Record<string, string> = {
    bond: "债券",
    equity: "权益",
    derivative: "衍生品",
    commodity: "商品",
    index: "指数",
    economic: "经济分析",
  };

  return (
    <Card
      className={`relative p-4 cursor-pointer transition-all hover:shadow-lg ${typeColors[panel.panelType]}`}
      onClick={() => onNavigate(panel.panelCode)}
    >
      {/* 固定标记 */}
      {panel.pinned && (
        <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1">
          <Pin className="w-3 h-3" />
        </div>
      )}

      {/* 面板内容 */}
      <div className="pr-12">
        {/* 面板名称 */}
        <h3 className="font-semibold text-sm mb-2 truncate">{panel.panelName}</h3>

        {/* 面板类型标签 */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-1 rounded ${typeBadgeColors[panel.panelType]}`}>
            {typeLabels[panel.panelType]}
          </span>
          {panel.icon && <span className="text-lg">{panel.icon}</span>}
        </div>

        {/* 面板代码 */}
        <p className="text-xs text-gray-500">{panel.panelCode}</p>
      </div>

      {/* 操作按钮 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(panel.id);
          }}
          title={panel.pinned ? "取消固定" : "固定到顶部"}
        >
          {panel.pinned ? (
            <PinOff className="w-4 h-4" />
          ) : (
            <Pin className="w-4 h-4" />
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(panel.id);
          }}
          title="删除"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
