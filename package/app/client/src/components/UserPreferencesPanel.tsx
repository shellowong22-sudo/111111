import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface UserPreferencesPanelProps {
  onClose?: () => void;
}

const DEFAULT_PREFS = {
  varConfidence: 95,
  exportFormat: "xlsx",
  theme: "dark",
  refreshInterval: 30,
  defaultCurrency: "USD",
  riskModel: "historical",
  showGridLines: true,
  compactMode: false,
  autoSave: true,
  notificationsEnabled: true,
  defaultTimeframe: "1Y",
  benchmarkIndex: "SPX",
};

export default function UserPreferencesPanel({ onClose }: UserPreferencesPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  const getPrefsQuery = trpc.pricingRisk.getUserPreference.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 当查询结果返回时合并偏好
  useEffect(() => {
    const data = getPrefsQuery.data as any;
    if (data?.exportFormat) {
      setPrefs(prev => ({
        ...prev,
        varConfidence: data.varConfidence ? parseInt(data.varConfidence) : prev.varConfidence,
        exportFormat: data.exportFormat ?? prev.exportFormat,
      }));
    }
  }, [getPrefsQuery.data]);

  const upsertMutation = trpc.pricingRisk.updateUserPreference.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("偏好设置已保存");
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      toast.error("保存失败，请重试");
    },
  });

  const handleSave = () => {
    if (!isAuthenticated) {
      // 未登录时保存到 localStorage
      localStorage.setItem("finance-hub-prefs", JSON.stringify(prefs));
      setSaved(true);
      toast.success("偏好设置已保存（本地）");
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    upsertMutation.mutate({
      varConfidence: String(prefs.varConfidence),
      exportFormat: prefs.exportFormat,
      lastUpdatedPanel: "preferences",
    });
  };

  const handleReset = () => {
    setPrefs(DEFAULT_PREFS);
    toast.info("已重置为默认设置");
  };

  // 从 localStorage 加载（未登录时）
  useEffect(() => {
    if (!isAuthenticated) {
      const saved = localStorage.getItem("finance-hub-prefs");
      if (saved) {
        try {
          setPrefs(prev => ({ ...prev, ...JSON.parse(saved) }));
        } catch {}
      }
    }
  }, [isAuthenticated]);

  const isLoading = upsertMutation?.isPending;

  return (
    <div className="bg-slate-950 text-slate-200 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">用户偏好设置</span>
          {!isAuthenticated && (
            <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
              未登录（本地保存）
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-white">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            重置
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : saved ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-400" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            {saved ? "已保存" : "保存设置"}
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400">
              ✕
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="risk">
          <TabsList className="bg-slate-800 border border-slate-700 mb-4">
            <TabsTrigger value="risk" className="data-[state=active]:bg-blue-600 text-xs">风险参数</TabsTrigger>
            <TabsTrigger value="display" className="data-[state=active]:bg-blue-600 text-xs">显示设置</TabsTrigger>
            <TabsTrigger value="data" className="data-[state=active]:bg-blue-600 text-xs">数据偏好</TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-blue-600 text-xs">通知设置</TabsTrigger>
          </TabsList>

          {/* 风险参数 */}
          <TabsContent value="risk">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">VaR 置信度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">当前值</span>
                    <span className="text-lg font-bold text-blue-400">{prefs.varConfidence}%</span>
                  </div>
                  <Slider
                    value={[prefs.varConfidence]}
                    onValueChange={([v]) => setPrefs(p => ({ ...p, varConfidence: v }))}
                    min={90}
                    max={99}
                    step={1}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>90%</span>
                    <span>95%</span>
                    <span>99%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">风险模型</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={prefs.riskModel} onValueChange={v => setPrefs(p => ({ ...p, riskModel: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="historical">历史模拟法</SelectItem>
                      <SelectItem value="parametric">参数法（方差-协方差）</SelectItem>
                      <SelectItem value="montecarlo">蒙特卡洛模拟</SelectItem>
                      <SelectItem value="cornish-fisher">Cornish-Fisher 展开</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-2">
                    {prefs.riskModel === "historical" && "使用历史收益率分布计算风险指标，无需假设分布形态"}
                    {prefs.riskModel === "parametric" && "假设正态分布，计算速度快，适合线性资产组合"}
                    {prefs.riskModel === "montecarlo" && "随机模拟路径，适合非线性衍生品组合"}
                    {prefs.riskModel === "cornish-fisher" && "修正正态分布，考虑偏度和峰度"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">基准指数</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={prefs.benchmarkIndex} onValueChange={v => setPrefs(p => ({ ...p, benchmarkIndex: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="SPX">S&P 500 (SPX)</SelectItem>
                      <SelectItem value="NDX">NASDAQ 100 (NDX)</SelectItem>
                      <SelectItem value="DJI">道琼斯工业 (DJI)</SelectItem>
                      <SelectItem value="CSI300">沪深300 (CSI300)</SelectItem>
                      <SelectItem value="MSCI_WORLD">MSCI 全球</SelectItem>
                      <SelectItem value="CUSTOM">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">默认时间范围</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={prefs.defaultTimeframe} onValueChange={v => setPrefs(p => ({ ...p, defaultTimeframe: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="1M">1个月</SelectItem>
                      <SelectItem value="3M">3个月</SelectItem>
                      <SelectItem value="6M">6个月</SelectItem>
                      <SelectItem value="1Y">1年</SelectItem>
                      <SelectItem value="3Y">3年</SelectItem>
                      <SelectItem value="5Y">5年</SelectItem>
                      <SelectItem value="10Y">10年</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 显示设置 */}
          <TabsContent value="display">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">界面主题</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">紧凑模式</Label>
                    <Switch
                      checked={prefs.compactMode}
                      onCheckedChange={v => setPrefs(p => ({ ...p, compactMode: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">显示网格线</Label>
                    <Switch
                      checked={prefs.showGridLines}
                      onCheckedChange={v => setPrefs(p => ({ ...p, showGridLines: v }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">数据刷新间隔</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">每</span>
                    <span className="text-lg font-bold text-blue-400">{prefs.refreshInterval}秒</span>
                    <span className="text-xs text-slate-400">刷新</span>
                  </div>
                  <Slider
                    value={[prefs.refreshInterval]}
                    onValueChange={([v]) => setPrefs(p => ({ ...p, refreshInterval: v }))}
                    min={5}
                    max={120}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>5s</span>
                    <span>60s</span>
                    <span>120s</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 数据偏好 */}
          <TabsContent value="data">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">默认货币</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={prefs.defaultCurrency} onValueChange={v => setPrefs(p => ({ ...p, defaultCurrency: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="USD">美元 (USD)</SelectItem>
                      <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                      <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                      <SelectItem value="GBP">英镑 (GBP)</SelectItem>
                      <SelectItem value="JPY">日元 (JPY)</SelectItem>
                      <SelectItem value="HKD">港币 (HKD)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">默认导出格式</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={prefs.exportFormat} onValueChange={v => setPrefs(p => ({ ...p, exportFormat: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                      <SelectItem value="png">图片 (.png)</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">自动保存</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300 text-sm">启用自动保存</Label>
                    <Switch
                      checked={prefs.autoSave}
                      onCheckedChange={v => setPrefs(p => ({ ...p, autoSave: v }))}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    自动保存面板布局和分析参数到服务器
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 通知设置 */}
          <TabsContent value="notifications">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">通知偏好</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300 text-sm">启用通知</Label>
                    <p className="text-xs text-slate-500">接收市场警报和系统通知</p>
                  </div>
                  <Switch
                    checked={prefs.notificationsEnabled}
                    onCheckedChange={v => setPrefs(p => ({ ...p, notificationsEnabled: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300 text-sm">价格突破警报</Label>
                    <p className="text-xs text-slate-500">当价格突破关键支撑/阻力位时通知</p>
                  </div>
                  <Switch defaultChecked disabled={!prefs.notificationsEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300 text-sm">风险超限警报</Label>
                    <p className="text-xs text-slate-500">当组合风险超过设定阈值时通知</p>
                  </div>
                  <Switch defaultChecked disabled={!prefs.notificationsEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-slate-300 text-sm">新闻推送</Label>
                    <p className="text-xs text-slate-500">重大市场新闻实时推送</p>
                  </div>
                  <Switch disabled={!prefs.notificationsEnabled} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
