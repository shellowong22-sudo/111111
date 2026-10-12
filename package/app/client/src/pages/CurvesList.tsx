import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, BarChart2, TrendingUp, GitCompare, X, CheckSquare,
} from "lucide-react";
import CurveChartModal from "@/components/CurveChartModal";
import CurveCompareModal from "@/components/CurveCompareModal";
import { toast } from "sonner";

type CurveItem = {
  id: number;
  name: string;
  curveId: string;
  type?: string | null;
  currency?: string | null;
  country?: string | null;
  region?: string | null;
};

export default function CurvesList() {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // 单曲线图表弹窗
  const [chartCurve, setChartCurve] = useState<CurveItem | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  // 对比模式
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<CurveItem[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // 获取数据
  const { data: allCurves = [], isLoading: curvesLoading } = trpc.curves.getAll.useQuery();
  const { data: regions = [] } = trpc.curves.getRegions.useQuery();
  const { data: categories = [] } = trpc.curves.getCategories.useQuery();
  const { data: searchResults = [] } = trpc.curves.search.useQuery(
    { keyword: searchKeyword }, { enabled: searchKeyword.length > 0 }
  );
  const { data: regionCurves = [] } = trpc.curves.getByRegion.useQuery(
    { region: selectedRegion! }, { enabled: selectedRegion !== null }
  );
  const { data: typeCurves = [] } = trpc.curves.getByType.useQuery(
    { type: selectedType! }, { enabled: !!selectedType }
  );

  const filteredCurves = useMemo(() => {
    let curves = allCurves;
    if (searchKeyword) curves = searchResults;
    else if (selectedRegion) curves = regionCurves;
    else if (selectedType) curves = typeCurves;
    return [...curves].sort((a, b) => a.name.localeCompare(b.name));
  }, [allCurves, searchResults, regionCurves, typeCurves, searchKeyword, selectedRegion, selectedType]);

  // ── 单曲线打开 ──────────────────────────────────────────────────────────────
  const handleOpenChart = (curve: CurveItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (compareMode) return;
    setChartCurve(curve);
    setChartOpen(true);
  };

  // ── 对比模式：选择/取消曲线 ──────────────────────────────────────────────────
  const handleCompareSelect = (curve: CurveItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompareSelected((prev) => {
      const exists = prev.find((c) => c.id === curve.id);
      if (exists) return prev.filter((c) => c.id !== curve.id);
      if (prev.length >= 2) {
        toast.warning("最多只能选择 2 条曲线进行对比");
        return prev;
      }
      return [...prev, curve];
    });
  };

  const handleCardClick = (curve: CurveItem, e: React.MouseEvent) => {
    if (compareMode) {
      handleCompareSelect(curve, e);
    } else {
      handleOpenChart(curve, e);
    }
  };

  // ── 对比模式开关 ─────────────────────────────────────────────────────────────
  const toggleCompareMode = () => {
    setCompareMode((v) => {
      if (v) setCompareSelected([]);
      return !v;
    });
  };

  // ── 启动对比分析 ─────────────────────────────────────────────────────────────
  const handleStartCompare = () => {
    if (compareSelected.length !== 2) {
      toast.warning("请选择恰好 2 条曲线进行对比");
      return;
    }
    setCompareOpen(true);
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    setSelectedRegion(null);
    setSelectedType(null);
  };

  const handleRegionSelect = (regionId: number) => {
    setSelectedRegion(regionId === selectedRegion ? null : regionId);
    setSearchKeyword("");
    setSelectedType(null);
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type === selectedType ? null : type);
    setSearchKeyword("");
    setSelectedRegion(null);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Government: "bg-blue-100 text-blue-800",
      Corporate: "bg-green-100 text-green-800",
      CDS: "bg-red-100 text-red-800",
      Municipal: "bg-purple-100 text-purple-800",
      Agency: "bg-orange-100 text-orange-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">收益率曲线库</h1>
            <p className="text-slate-600">
              浏览全球债券收益率曲线、CDS 曲线和其他金融曲线
              {!compareMode && (
                <span className="ml-2 text-blue-500 text-sm">· 点击曲线卡片可查看历史走势与 AI 分析</span>
              )}
              {compareMode && (
                <span className="ml-2 text-violet-600 text-sm font-medium">
                  · 对比模式：请点击选择 2 条曲线（已选 {compareSelected.length}/2）
                </span>
              )}
            </p>
          </div>

          {/* 对比模式按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {compareMode && compareSelected.length === 2 && (
              <Button
                onClick={handleStartCompare}
                className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg"
              >
                <GitCompare className="w-4 h-4 mr-2" />
                开始对比分析
              </Button>
            )}
            <Button
              variant={compareMode ? "default" : "outline"}
              onClick={toggleCompareMode}
              className={compareMode
                ? "bg-violet-600 hover:bg-violet-500 text-white"
                : "border-violet-300 text-violet-600 hover:bg-violet-50"
              }
            >
              {compareMode ? (
                <><X className="w-4 h-4 mr-2" />退出对比</>
              ) : (
                <><GitCompare className="w-4 h-4 mr-2" />对比分析</>
              )}
            </Button>
          </div>
        </div>

        {/* 对比模式提示条 */}
        {compareMode && (
          <div className="mb-4 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3 flex-wrap">
            <CheckSquare className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="text-sm text-violet-700 font-medium">
              对比模式已开启：点击曲线卡片选择（最多 2 条）
            </span>
            {compareSelected.length > 0 && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {compareSelected.map((c, i) => (
                  <Badge
                    key={c.id}
                    className={`text-xs ${i === 0 ? "bg-blue-600 text-white" : "bg-orange-500 text-white"}`}
                  >
                    {i === 0 ? "A" : "B"} · {c.curveId}
                    <button
                      className="ml-1.5 hover:opacity-70"
                      onClick={(e) => { e.stopPropagation(); handleCompareSelect(c, e); }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {compareSelected.length === 2 && (
                  <Button size="sm" onClick={handleStartCompare}
                    className="bg-violet-600 hover:bg-violet-500 text-white h-7 text-xs">
                    <GitCompare className="w-3 h-3 mr-1" />开始对比
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 搜索栏 */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <Input
              placeholder="搜索曲线名称或代码..."
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>

        {/* 过滤选项 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* 地区过滤 */}
          <Card className="bg-white text-slate-900">
            <CardHeader>
              <CardTitle className="text-lg">按地区</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {regions.map((region) => (
                <Button
                  key={region.id}
                  variant={selectedRegion === region.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => handleRegionSelect(region.id)}
                >
                  {region.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* 类型过滤 */}
          <Card className="bg-white text-slate-900">
            <CardHeader>
              <CardTitle className="text-lg">按类型</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedType === category.name ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => handleTypeSelect(category.name)}
                >
                  {category.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <Card className="bg-white text-slate-900">
            <CardHeader>
              <CardTitle className="text-lg">统计信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600">总曲线数</p>
                  <p className="text-2xl font-bold text-slate-900">{allCurves.length}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">当前显示</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredCurves.length}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" />
                    点击卡片查看历史走势 + AI 分析
                  </p>
                  <p className="text-xs text-violet-500 flex items-center gap-1">
                    <GitCompare className="w-3 h-3" />
                    右上角「对比分析」可比较两条曲线
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 曲线列表 */}
        <div>
          {curvesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCurves.map((curve) => {
                const isSelectedA = compareSelected[0]?.id === curve.id;
                const isSelectedB = compareSelected[1]?.id === curve.id;
                const isSelected = isSelectedA || isSelectedB;

                return (
                  <Card
                    key={curve.id}
                    className={`transition-all duration-200 cursor-pointer group border-2 ${
                      isSelectedA
                        ? "border-blue-500 bg-blue-50 shadow-blue-200 shadow-lg"
                        : isSelectedB
                        ? "border-orange-400 bg-orange-50 shadow-orange-200 shadow-lg"
                        : compareMode
                        ? "border-slate-200 hover:border-violet-300 hover:shadow-md"
                        : "border-slate-200 bg-white text-slate-900 hover:shadow-lg hover:border-blue-300"
                    }`}
                    onClick={(e) => handleCardClick(curve, e)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold line-clamp-2 mb-1 transition-colors ${
                            isSelected ? "text-slate-900" : "text-slate-900 group-hover:text-blue-700"
                          }`}>
                            {curve.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono">{curve.curveId}</p>
                        </div>

                        {/* 右上角图标：对比模式显示选择标记，普通模式显示走势图标 */}
                        {compareMode ? (
                          <div className={`ml-2 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all ${
                            isSelectedA
                              ? "bg-blue-500 text-white"
                              : isSelectedB
                              ? "bg-orange-400 text-white"
                              : "bg-slate-100 text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-600"
                          }`}>
                            {isSelectedA ? "A" : isSelectedB ? "B" : "+"}
                          </div>
                        ) : (
                          <button
                            className="ml-2 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-blue-600 text-slate-400 hover:text-white transition-all duration-150 group-hover:bg-blue-100 group-hover:text-blue-600 hover:!bg-blue-600 hover:!text-white"
                            onClick={(e) => handleOpenChart(curve, e)}
                            title="查看历史走势图"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={getTypeColor(curve.type || "")}>
                            {curve.type}
                          </Badge>
                          <Badge variant="outline">{curve.currency}</Badge>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p><span className="font-medium">国家：</span>{curve.country}</p>
                        <p><span className="font-medium">地区：</span>{curve.region}</p>
                      </div>

                      {/* 底部提示 */}
                      <div className={`mt-3 pt-2 border-t border-slate-100 flex items-center gap-1 text-xs transition-colors ${
                        isSelectedA ? "text-blue-500"
                        : isSelectedB ? "text-orange-500"
                        : compareMode ? "text-violet-400 group-hover:text-violet-600"
                        : "text-slate-400 group-hover:text-blue-500"
                      }`}>
                        {compareMode ? (
                          <>
                            <GitCompare className="w-3 h-3" />
                            <span>
                              {isSelectedA ? "已选为曲线 A"
                                : isSelectedB ? "已选为曲线 B"
                                : "点击选择参与对比"}
                            </span>
                          </>
                        ) : (
                          <>
                            <BarChart2 className="w-3 h-3" />
                            <span>点击查看历史收益率走势</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!curvesLoading && filteredCurves.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center">
                <p className="text-slate-600 mb-4">未找到匹配的曲线</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchKeyword("");
                    setSelectedRegion(null);
                    setSelectedType(null);
                  }}
                >
                  清除过滤条件
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 单曲线图表弹窗 */}
      <CurveChartModal
        curve={chartCurve}
        open={chartOpen}
        onClose={() => setChartOpen(false)}
      />

      {/* 对比分析弹窗 */}
      {compareSelected.length === 2 && (
        <CurveCompareModal
          curveA={compareSelected[0]}
          curveB={compareSelected[1]}
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}
