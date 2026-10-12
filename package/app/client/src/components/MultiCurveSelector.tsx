import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, Check } from "lucide-react";
import CurveTreeMenu from "./CurveTreeMenu";

interface MultiCurveSelectorProps {
  onConfirm?: (selectedCurves: any[]) => void;
  onCancel?: () => void;
}

export default function MultiCurveSelector({ onConfirm, onCancel }: MultiCurveSelectorProps) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCurveIds, setSelectedCurveIds] = useState<Set<string>>(new Set());
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);

  // 获取所有曲线
  const { data: allCurves = [] } = trpc.curves.getAll.useQuery();

  // 获取地区列表
  const { data: regions = [] } = trpc.curves.getRegions.useQuery();

  // 搜索曲线
  const { data: searchResults = [] } = trpc.curves.search.useQuery(
    { keyword: searchKeyword },
    { enabled: searchKeyword.length > 0 }
  );

  // 按地区获取曲线
  const { data: regionCurves = [] } = trpc.curves.getByRegion.useQuery(
    { region: selectedRegion || 0 },
    { enabled: selectedRegion !== null }
  );

  // 构建树形数据
  const treeData = useMemo(() => {
    const regionMap = new Map<string, any>();

    regions.forEach((region) => {
      regionMap.set(region.name, {
        id: `region-${region.id}`,
        label: region.name,
        children: [],
      });
    });

    allCurves.forEach((curve) => {
      const regionName = curve.region || "";
      const regionNode = regionMap.get(regionName);
      if (regionNode && regionName) {
        regionNode.children.push({
          id: `curve-${curve.id}`,
          label: `${curve.name} (${curve.curveId})`,
          data: curve,
        });
      }
    });

    return Array.from(regionMap.values());
  }, [allCurves, regions]);

  // 过滤曲线
  const filteredCurves = useMemo(() => {
    let curves = allCurves;

    if (searchKeyword.length > 0) {
      curves = searchResults;
    } else if (selectedRegion) {
      curves = regionCurves;
    }

    return curves.filter((curve) => selectedCurveIds.has(`curve-${curve.id}`));
  }, [allCurves, searchResults, regionCurves, searchKeyword, selectedRegion, selectedCurveIds]);

  const handleConfirm = () => {
    const selected = filteredCurves;
    onConfirm?.(selected);
  };

  const handleRemoveCurve = (curveId: string) => {
    const newSelected = new Set(selectedCurveIds);
    newSelected.delete(curveId);
    setSelectedCurveIds(newSelected);
  };

  const handleClearAll = () => {
    setSelectedCurveIds(new Set());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-96 overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle>选择曲线</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex gap-4 p-4">
          {/* 左侧：树形菜单 */}
          <div className="flex-1 overflow-y-auto">
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="搜索曲线..."
                  value={searchKeyword}
                  onChange={(e) => {
                    setSearchKeyword(e.target.value);
                    setSelectedRegion(null);
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            <CurveTreeMenu
              data={treeData}
              multiSelect
              selectedIds={selectedCurveIds}
              onSelectionChange={setSelectedCurveIds}
            />
          </div>

          {/* 右侧：已选曲线列表 */}
          <div className="w-64 border-l pl-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">已选曲线</h3>
              <span className="text-xs text-slate-500">{filteredCurves.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {filteredCurves.length > 0 ? (
                filteredCurves.map((curve) => (
                  <div
                    key={curve.id}
                    className="flex items-center justify-between gap-2 p-2 bg-slate-100 rounded text-sm"
                  >
                    <span className="truncate">{curve.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCurve(`curve-${curve.id}`)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">未选择任何曲线</p>
              )}
            </div>

            {filteredCurves.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="w-full mb-3"
              >
                清除全部
              </Button>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={filteredCurves.length === 0}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-2" />
                确认选择
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
