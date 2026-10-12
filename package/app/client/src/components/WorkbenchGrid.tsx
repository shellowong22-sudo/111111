import { useState } from "react";
import { WorkbenchPanel, WorkbenchPanelData } from "./WorkbenchPanel";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

interface WorkbenchGridProps {
  panels: WorkbenchPanelData[];
  isLoading?: boolean;
  onRemove: (panelId: number) => void;
  onTogglePin: (panelId: number) => void;
  onNavigate: (panelCode: string) => void;
  onAddClick: () => void;
  onReorder?: (updates: Array<{ panelId: number; position: number }>) => void;
}

export function WorkbenchGrid({
  panels,
  isLoading = false,
  onRemove,
  onTogglePin,
  onNavigate,
  onAddClick,
  onReorder,
}: WorkbenchGridProps) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (panelId: number) => {
    setDraggedId(panelId);
  };

  const handleDragOver = (e: React.DragEvent, panelId: number) => {
    e.preventDefault();
    setDragOverId(panelId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    // 查找拖拽的面板和目标面板的索引
    const draggedIndex = panels.findIndex((p) => p.id === draggedId);
    const targetIndex = panels.findIndex((p) => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    // 创建新的排序数组
    const newPanels = [...panels];
    const [draggedPanel] = newPanels.splice(draggedIndex, 1);
    newPanels.splice(targetIndex, 0, draggedPanel);

    // 生成位置更新
    const updates = newPanels.map((panel, index) => ({
      panelId: panel.id,
      position: index,
    }));

    onReorder?.(updates);
    setDraggedId(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  // 分离固定和非固定面板
  const pinnedPanels = panels.filter((p) => p.pinned);
  const unpinnedPanels = panels.filter((p) => !p.pinned);

  return (
    <div className="space-y-6">
      {/* 固定面板区域 */}
      {pinnedPanels.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">固定面板</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedPanels.map((panel) => (
              <div
                key={panel.id}
                draggable
                onDragStart={() => handleDragStart(panel.id)}
                onDragOver={(e) => handleDragOver(e, panel.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, panel.id)}
                className={`transition-opacity ${
                  draggedId === panel.id ? "opacity-50" : ""
                } ${
                  dragOverId === panel.id && draggedId !== panel.id
                    ? "ring-2 ring-blue-400"
                    : ""
                }`}
              >
                <WorkbenchPanel
                  panel={panel}
                  onRemove={onRemove}
                  onTogglePin={onTogglePin}
                  onNavigate={onNavigate}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 非固定面板区域 */}
      {unpinnedPanels.length > 0 && (
        <div>
          {pinnedPanels.length > 0 && (
            <h3 className="text-sm font-semibold text-gray-700 mb-3">我的面板</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {unpinnedPanels.map((panel) => (
              <div
                key={panel.id}
                draggable
                onDragStart={() => handleDragStart(panel.id)}
                onDragOver={(e) => handleDragOver(e, panel.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, panel.id)}
                className={`transition-opacity ${
                  draggedId === panel.id ? "opacity-50" : ""
                } ${
                  dragOverId === panel.id && draggedId !== panel.id
                    ? "ring-2 ring-blue-400"
                    : ""
                }`}
              >
                <WorkbenchPanel
                  panel={panel}
                  onRemove={onRemove}
                  onTogglePin={onTogglePin}
                  onNavigate={onNavigate}
                />
              </div>
            ))}

            {/* 添加面板按钮 */}
            <button
              onClick={onAddClick}
              className="h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center group"
            >
              <div className="text-center">
                <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 group-hover:text-blue-600">
                  添加面板
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {panels.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">还没有添加任何面板</p>
          <Button onClick={onAddClick}>
            <Plus className="w-4 h-4 mr-2" />
            添加第一个面板
          </Button>
        </div>
      )}
    </div>
  );
}
