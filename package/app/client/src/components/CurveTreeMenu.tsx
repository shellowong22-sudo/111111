import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  data?: any;
}

interface CurveTreeMenuProps {
  data: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  multiSelect?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export default function CurveTreeMenu({
  data,
  onSelect,
  multiSelect = false,
  selectedIds = new Set(),
  onSelectionChange,
}: CurveTreeMenuProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleSelect = (node: TreeNode) => {
    if (multiSelect) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(node.id)) {
        newSelected.delete(node.id);
      } else {
        newSelected.add(node.id);
      }
      onSelectionChange?.(newSelected);
    } else {
      onSelect?.(node);
    }
  };

  const TreeNodeComponent = ({ node, level = 0 }: { node: TreeNode; level?: number }) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-700 cursor-pointer transition-colors",
            isSelected && "bg-blue-600 text-white"
          )}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(node.id);
            }
            handleSelect(node);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )
          ) : (
            <div className="w-4" />
          )}
          <span className="text-sm font-medium truncate">{node.label}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => (
              <TreeNodeComponent key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-800 rounded-lg p-3 space-y-1 max-h-96 overflow-y-auto">
      {data.map((node) => (
        <TreeNodeComponent key={node.id} node={node} />
      ))}
    </div>
  );
}
