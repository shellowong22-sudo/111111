import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export default function PricingRiskSettings() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    varConfidence: '99%',
    volatilityModel: 'SVI',
    valuationModel: 'BSM',
    stressScenario: 'historical',
    exportFormat: 'PDF',
  });

  // 获取用户偏好
  const { data: userPrefs } = trpc.pricingRisk.getUserPreference.useQuery(undefined, {
    enabled: !!user,
  });

  useEffect(() => {
    if (userPrefs) {
      setPreferences({
        varConfidence: userPrefs.varConfidence || '99%',
        volatilityModel: userPrefs.volatilityModel || 'SVI',
        valuationModel: userPrefs.valuationModel || 'BSM',
        stressScenario: userPrefs.stressScenario || 'historical',
        exportFormat: userPrefs.exportFormat || 'PDF',
      });
    }
  }, [userPrefs]);

  // 保存用户偏好
  const updateMutation = trpc.pricingRisk.updateUserPreference.useMutation({
    onSuccess: () => {
      setSaving(false);
      setOpen(false);
    },
    onError: (error) => {
      console.error('保存失败:', error);
      setSaving(false);
    },
  });

  const handleSave = async () => {
    setSaving(true);
    await updateMutation.mutateAsync(preferences);
  };

  const handleReset = () => {
    setPreferences({
      varConfidence: '99%',
      volatilityModel: 'SVI',
      valuationModel: 'BSM',
      stressScenario: 'historical',
      exportFormat: 'PDF',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Settings className="w-4 h-4" />
          设置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-[#16213e] border-blue-900/30">
        <DialogHeader>
          <DialogTitle className="text-gray-200">定价与风险分析设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* VaR置信度 */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">VaR置信度</label>
            <Select value={preferences.varConfidence} onValueChange={(value) => setPreferences({ ...preferences, varConfidence: value })}>
              <SelectTrigger className="bg-[#0f3460] border-blue-900/50 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f3460] border-blue-900/50">
                <SelectItem value="95%">95%</SelectItem>
                <SelectItem value="97.5%">97.5%</SelectItem>
                <SelectItem value="99%">99%</SelectItem>
                <SelectItem value="99.5%">99.5%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 波动率模型 */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">波动率模型</label>
            <Select value={preferences.volatilityModel} onValueChange={(value) => setPreferences({ ...preferences, volatilityModel: value })}>
              <SelectTrigger className="bg-[#0f3460] border-blue-900/50 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f3460] border-blue-900/50">
                <SelectItem value="SVI">SVI (Stochastic Volatility Inspired)</SelectItem>
                <SelectItem value="SABR">SABR (Stochastic Alpha Beta Rho)</SelectItem>
                <SelectItem value="Heston">Heston Model</SelectItem>
                <SelectItem value="GARCH">GARCH</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 估值模型 */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">估值模型</label>
            <Select value={preferences.valuationModel} onValueChange={(value) => setPreferences({ ...preferences, valuationModel: value })}>
              <SelectTrigger className="bg-[#0f3460] border-blue-900/50 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f3460] border-blue-900/50">
                <SelectItem value="BSM">Black-Scholes-Merton</SelectItem>
                <SelectItem value="MonteCarlo">Monte Carlo</SelectItem>
                <SelectItem value="Binomial">Binomial Tree</SelectItem>
                <SelectItem value="FiniteDifference">Finite Difference</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 压力测试场景 */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">压力测试场景</label>
            <Select value={preferences.stressScenario} onValueChange={(value) => setPreferences({ ...preferences, stressScenario: value })}>
              <SelectTrigger className="bg-[#0f3460] border-blue-900/50 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f3460] border-blue-900/50">
                <SelectItem value="historical">历史情景</SelectItem>
                <SelectItem value="reverse">反向压力测试</SelectItem>
                <SelectItem value="hypothetical">假设情景</SelectItem>
                <SelectItem value="combined">组合情景</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 导出格式 */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">默认导出格式</label>
            <Select value={preferences.exportFormat} onValueChange={(value) => setPreferences({ ...preferences, exportFormat: value })}>
              <SelectTrigger className="bg-[#0f3460] border-blue-900/50 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f3460] border-blue-900/50">
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Excel">Excel</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={handleReset} className="flex-1 gap-2">
              <RotateCcw className="w-4 h-4" />
              重置
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
