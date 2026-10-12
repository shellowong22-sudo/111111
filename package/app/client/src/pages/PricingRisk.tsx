import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Shield, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSearch } from 'wouter';
import ExportMenu from '@/components/ExportMenu';
import UserPreferencesPanel from '@/components/UserPreferencesPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// Lazy load all 23 panels for code splitting
const AnnouncementIntelPanel = lazy(() => import('@/components/pricing/AnnouncementIntelPanel'));
const RiskDashboardPanel = lazy(() => import('@/components/pricing/RiskDashboardPanel'));
const AssetClassificationPanel = lazy(() => import('@/components/pricing/AssetClassificationPanel'));
const RealtimePricingPanel = lazy(() => import('@/components/pricing/RealtimePricingPanel'));
const StaticDataPanel = lazy(() => import('@/components/pricing/StaticDataPanel'));
const YieldCurvePanel = lazy(() => import('@/components/pricing/YieldCurvePanel'));
const VolSurfacePanel = lazy(() => import('@/components/pricing/VolSurfacePanel'));
const ValuationEnginePanel = lazy(() => import('@/components/pricing/ValuationEnginePanel'));
const GreeksAnalysisPanel = lazy(() => import('@/components/pricing/GreeksAnalysisPanel'));
const VaRPanel = lazy(() => import('@/components/pricing/VaRPanel'));
const StressTestPanel = lazy(() => import('@/components/pricing/StressTestPanel'));
const PnLAttributionPanel = lazy(() => import('@/components/pricing/PnLAttributionPanel'));
const CVADVAPanel = lazy(() => import('@/components/pricing/CVADVAPanel'));
const LiquidityRiskPanel = lazy(() => import('@/components/pricing/LiquidityRiskPanel'));
const CapitalAdequacyPanel = lazy(() => import('@/components/pricing/CapitalAdequacyPanel'));
const WhatIfSimPanel = lazy(() => import('@/components/pricing/WhatIfSimPanel'));
const CorrelationMatrixPanel = lazy(() => import('@/components/pricing/CorrelationMatrixPanel'));
const TailRiskPanel = lazy(() => import('@/components/pricing/TailRiskPanel'));
const BacktestEnginePanel = lazy(() => import('@/components/pricing/BacktestEnginePanel'));
const PricingAlertPanel = lazy(() => import('@/components/pricing/PricingAlertPanel'));
const PricingDecisionPanel = lazy(() => import('@/components/pricing/PricingDecisionPanel'));
const PricingAuditPanel = lazy(() => import('@/components/pricing/PricingAuditPanel'));
const PricingIntegrationPanel = lazy(() => import('@/components/pricing/PricingIntegrationPanel'));
const PricingRiskSettings = lazy(() => import('@/components/pricing/PricingRiskSettings'));

const TABS = [
  { key: 'announce', label: '1.公告情报', short: 'ANN' },
  { key: 'dashboard', label: '2.全局看板', short: 'DASH' },
  { key: 'asset-class', label: '3.品种管理', short: 'ASST' },
  { key: 'realtime', label: '4.实时行情', short: 'LIVE' },
  { key: 'static-data', label: '5.静态数据', short: 'STAT' },
  { key: 'yield-curve', label: '6.收益率曲线', short: 'YLD' },
  { key: 'vol-surface', label: '7.波动率曲面', short: 'VOL' },
  { key: 'valuation', label: '8.估值引擎', short: 'VAL' },
  { key: 'greeks', label: '9.Greeks', short: 'GRK' },
  { key: 'var', label: '10.VaR', short: 'VaR' },
  { key: 'stress', label: '11.压力测试', short: 'STR' },
  { key: 'pnl', label: '12.P&L归因', short: 'PnL' },
  { key: 'cva', label: '13.CVA/DVA', short: 'CVA' },
  { key: 'liquidity', label: '14.流动性', short: 'LIQ' },
  { key: 'capital', label: '15.资本充足', short: 'CAP' },
  { key: 'whatif', label: '16.What-if', short: 'WIF' },
  { key: 'correlation', label: '17.相关性', short: 'COR' },
  { key: 'tail-risk', label: '18.尾部风险', short: 'TAIL' },
  { key: 'backtest', label: '19.策略回测', short: 'BKT' },
  { key: 'alert', label: '20.智能预警', short: 'ALT' },
  { key: 'decision', label: '21.决策报告', short: 'DEC' },
  { key: 'audit', label: '22.审计日志', short: 'AUD' },
  { key: 'integration', label: '23.系统集成', short: 'INT' },
];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">加载中...</span>
      </div>
    </div>
  );
}

export default function PricingRisk() {
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get('tab');
    if (tab && TABS.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchString]);

  const renderPanel = () => {
    switch (activeTab) {
      case 'announce': return <AnnouncementIntelPanel />;
      case 'dashboard': return <RiskDashboardPanel />;
      case 'asset-class': return <AssetClassificationPanel />;
      case 'realtime': return <RealtimePricingPanel />;
      case 'static-data': return <StaticDataPanel />;
      case 'yield-curve': return <YieldCurvePanel />;
      case 'vol-surface': return <VolSurfacePanel />;
      case 'valuation': return <ValuationEnginePanel />;
      case 'greeks': return <GreeksAnalysisPanel />;
      case 'var': return <VaRPanel />;
      case 'stress': return <StressTestPanel />;
      case 'pnl': return <PnLAttributionPanel />;
      case 'cva': return <CVADVAPanel />;
      case 'liquidity': return <LiquidityRiskPanel />;
      case 'capital': return <CapitalAdequacyPanel />;
      case 'whatif': return <WhatIfSimPanel />;
      case 'correlation': return <CorrelationMatrixPanel />;
      case 'tail-risk': return <TailRiskPanel />;
      case 'backtest': return <BacktestEnginePanel />;
      case 'alert': return <PricingAlertPanel />;
      case 'decision': return <PricingDecisionPanel />;
      case 'audit': return <PricingAuditPanel />;
      case 'integration': return <PricingIntegrationPanel />;
      default: return <RiskDashboardPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* 页头 */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-amber-400">定价与风险分析中心</h1>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">23 功能模块</Badge>
          </div>
          <p className="text-slate-400 text-xs">收益率曲线 · 波动率曲面 · 估值引擎 · VaR计量 · 压力测试 · Greeks · 策略回测 · 智能预警</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-400">实时计算</span>
          {/* 导出按钮 */}
          <ExportMenu
            filename={`pricing-risk-${activeTab}-${new Date().toISOString().slice(0, 10)}`}
            targetRef={panelRef}
            variant="outline"
            size="sm"
          />
          {/* 用户偏好按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrefs(true)}
            className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-xs"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1" />
            偏好
          </Button>
          <Suspense fallback={null}>
            <PricingRiskSettings />
          </Suspense>
        </div>
      </div>

      {/* 面板内容 */}
      <div className="flex-1 overflow-auto px-2" ref={panelRef}>
        <Suspense fallback={<LoadingFallback />}>
          {renderPanel()}
        </Suspense>
      </div>

      {/* 底部状态栏 */}
      <div className="px-4 py-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
        <span>当前模块: <span className="text-amber-400">{TABS.find(t => t.key === activeTab)?.label}</span></span>
        <span>定价与风险分析中心 v2.0 | 23个深度功能模块</span>
      </div>

      {/* 用户偏好设置 Sheet */}
      <Sheet open={showPrefs} onOpenChange={setShowPrefs}>
        <SheetContent
          side="right"
          className="w-[520px] max-w-full bg-slate-950 border-slate-800 p-0 overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>用户偏好设置</SheetTitle>
          </SheetHeader>
          <UserPreferencesPanel onClose={() => setShowPrefs(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
