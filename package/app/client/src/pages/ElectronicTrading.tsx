import { lazy, Suspense, useCallback, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SplitPane } from "@/components/electronic-trading/SplitPane";
import { useOrders, useSummary } from "@/uc/trade/kit";
import { EmsxOrderEntry } from "@/components/live/EmsxOrderLive";
import {
  Activity, Zap, Clock, BarChart2,
  Columns2, Square, ArrowLeftRight, X, PanelLeft, PanelRight,
  ChevronRight, ArrowLeft, TrendingUp, Shield, DollarSign, Globe,
  Settings, AlertCircle,
} from "lucide-react";

// ─── 懒加载面板组件 ─────────────────────────────────────────────────────────────
const GovtBondQuotePanel = lazy(() => import("@/components/electronic-trading/GovtBondQuotePanel"));
const FITPanel = lazy(() => import("@/components/electronic-trading/FITPanel"));
const FITGPanel = lazy(() => import("@/components/electronic-trading/FITGPanel"));
const CorporateBondPanel = lazy(() => import("@/components/electronic-trading/CorporateBondPanel"));
const BOLTPanel = lazy(() => import("@/components/electronic-trading/BOLTPanel"));
const AgencyMBSPanel = lazy(() => import("@/components/electronic-trading/AgencyMBSPanel"));
const IMGRPanel = lazy(() => import("@/components/electronic-trading/IMGRPanel"));
const EmergingMarketsPanel = lazy(() => import("@/components/electronic-trading/EmergingMarketsPanel"));
const TRDEPanel = lazy(() => import("@/components/electronic-trading/TRDEPanel"));
const EBNDPanel = lazy(() => import("@/components/electronic-trading/EBNDPanel"));
const MuniBondPanel = lazy(() => import("@/components/electronic-trading/MuniBondPanel"));
const PICKPanel = lazy(() => import("@/components/electronic-trading/PICKPanel"));
const IRSwapPanel = lazy(() => import("@/components/electronic-trading/IRSwapPanel"));
const CDSPanel = lazy(() => import("@/components/electronic-trading/CDSPanel"));
const EquityTradingPanel = lazy(() => import("@/components/electronic-trading/EquityTradingPanel"));
const FXTradingPanel = lazy(() => import("@/components/electronic-trading/FXTradingPanel"));
const WorkflowPanel = lazy(() => import("@/components/electronic-trading/WorkflowPanel"));
const BLOTPanel = lazy(() => import("@/components/electronic-trading/BLOTPanel"));
const ETBTPanel = lazy(() => import("@/components/electronic-trading/ETBTPanel"));
const VCONPanel = lazy(() => import("@/components/electronic-trading/VCONPanel"));
const TSOXPanel = lazy(() => import("@/components/electronic-trading/TSOXPanel"));
const WATLPanel = lazy(() => import("@/components/electronic-trading/WATLPanel"));
const PTBBPanel = lazy(() => import("@/components/electronic-trading/PTBBPanel"));
const MoneyMarketPanel = lazy(() => import("@/components/electronic-trading/MoneyMarketPanel"));
const MIFIETPanel = lazy(() => import("@/components/electronic-trading/MIFIETPanel"));
const UACKPanel = lazy(() => import("@/components/electronic-trading/UACKPanel"));

// ─── 面板分组配置 ───────────────────────────────────────────────────────────────
const PANEL_GROUPS = [
  {
    id: "fixed-income",
    label: "固定收益交易",
    icon: TrendingUp,
    color: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
    activeBg: "bg-amber-600",
    hoverBg: "hover:bg-amber-500/20",
    dotColor: "bg-amber-400",
    panels: [
      { id: "GOVT", label: "GOVT", name: "国债市场行情", desc: "国债报价、收益率曲线、期限结构实时展示", component: GovtBondQuotePanel },
      { id: "FIT", label: "FIT", name: "固定收益交易", desc: "多交易商RFQ询价、一键成交、执行分析", component: FITPanel },
      { id: "FITG", label: "FITG", name: "固收交易网格", desc: "矩阵视图展示多品种报价与流动性热力图", component: FITGPanel },
      { id: "CORP", label: "CORP", name: "公司债交易", desc: "投资级/高收益公司债报价聚合与信用分析", component: CorporateBondPanel },
      { id: "BOLT", label: "BOLT", name: "买卖报价列表", desc: "多交易商报价聚合、RFQ询价与最优价格匹配", component: BOLTPanel },
      { id: "AGENCY", label: "AGENCY", name: "机构债/MBS", desc: "美国机构债与抵押支持证券电子交易", component: AgencyMBSPanel },
    ],
  },
  {
    id: "bond-market",
    label: "债券市场",
    icon: DollarSign,
    color: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
    activeBg: "bg-emerald-600",
    hoverBg: "hover:bg-emerald-500/20",
    dotColor: "bg-emerald-400",
    panels: [
      { id: "IMGR", label: "IMGR", name: "库存与定价", desc: "交易商债券库存头寸实时监控与定价管理", component: IMGRPanel },
      { id: "EM", label: "EM", name: "新兴市场", desc: "新兴市场主权债/公司债报价与信用利差分析", component: EmergingMarketsPanel },
      { id: "TRDE", label: "TRDE", name: "多品种列表", desc: "跨资产类别多品种列表交易与批量执行", component: TRDEPanel },
      { id: "EBND", label: "EBND", name: "电子债券", desc: "全球电子债券交易平台接入与订单路由", component: EBNDPanel },
      { id: "MUNI", label: "MUNI", name: "地方债交易", desc: "市政债券电子交易、报价与流动性分析", component: MuniBondPanel },
      { id: "PICK", label: "PICK", name: "地方债发行", desc: "新发行地方债日历、簿记管理与定价分析", component: PICKPanel },
    ],
  },
  {
    id: "rates-credit",
    label: "利率与信用",
    icon: Activity,
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    activeBg: "bg-blue-600",
    hoverBg: "hover:bg-blue-500/20",
    dotColor: "bg-blue-400",
    panels: [
      { id: "IRSWAP", label: "IRSWAP", name: "利率掉期", desc: "IRS/OIS/XCCY利率衍生品报价与执行", component: IRSwapPanel },
      { id: "CDS", label: "CDS", name: "信用违约掉期", desc: "单名CDS/指数CDS报价、信用曲线与对冲分析", component: CDSPanel },
      { id: "PTBB", label: "PTBB", name: "组合交易篮子", desc: "多债券组合交易篮子构建、优化与批量执行", component: PTBBPanel },
      { id: "MONEY", label: "MONEY", name: "货币市场", desc: "回购、融资、短期利率工具交易与监控", component: MoneyMarketPanel },
    ],
  },
  {
    id: "equity-fx",
    label: "股权与外汇",
    icon: Globe,
    color: "text-purple-400",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/10",
    activeBg: "bg-purple-600",
    hoverBg: "hover:bg-purple-500/20",
    dotColor: "bg-purple-400",
    panels: [
      { id: "EQUITY", label: "EQUITY", name: "股票交易", desc: "股票算法交易、DMA直连与执行质量分析", component: EquityTradingPanel },
      { id: "FX", label: "FX", name: "外汇交易", desc: "即期/远期/掉期外汇交易与汇率风险管理", component: FXTradingPanel },
    ],
  },
  {
    id: "tools-confirm",
    label: "工具与确认",
    icon: Settings,
    color: "text-slate-300",
    borderColor: "border-slate-500/30",
    bgColor: "bg-slate-500/10",
    activeBg: "bg-slate-600",
    hoverBg: "hover:bg-slate-500/20",
    dotColor: "bg-slate-400",
    panels: [
      { id: "WORKFLOW", label: "WORKFLOW", name: "工作流程", desc: "交易工作流配置、自动化规则与审批流程", component: WorkflowPanel },
      { id: "BLOT", label: "BLOT", name: "电子交易记录簿", desc: "全品种电子交易记录簿、成交明细与对账", component: BLOTPanel },
      { id: "ETBT", label: "ETBT", name: "单品种记录簿", desc: "单一品种电子交易记录簿与历史成交分析", component: ETBTPanel },
      { id: "VCON", label: "VCON", name: "语音确认", desc: "语音交易确认、录音存档与合规管理", component: VCONPanel },
      { id: "TSOX", label: "TSOX", name: "执行管理", desc: "固定收益执行质量分析（VWAP/TCA/实施缺口）", component: TSOXPanel },
      { id: "WATL", label: "WATL", name: "观察列表", desc: "自定义交易品种观察列表与价格预警", component: WATLPanel },
      { id: "MIFIET", label: "MIFIET", name: "MiFID II合规", desc: "MiFID II电子交易合规报告与监控", component: MIFIETPanel },
      { id: "UACK", label: "UACK", name: "用户确认", desc: "全球用户交易确认管理与审计追踪", component: UACKPanel },
    ],
  },
];

// 构建 panelId -> component 映射
const PANEL_MAP: Record<string, React.ComponentType> = {};
PANEL_GROUPS.forEach(g => g.panels.forEach(p => { PANEL_MAP[p.id] = p.component; }));

// 构建 panelId -> label 映射
const PANEL_LABEL: Record<string, string> = {};
PANEL_GROUPS.forEach(g => g.panels.forEach(p => { PANEL_LABEL[p.id] = `${p.label} ${p.name}`; }));
PANEL_LABEL["EMSX"] = "EMSX 订单录入";

function getPanelGroup(panelId: string) {
  return PANEL_GROUPS.find(g => g.panels.some(p => p.id === panelId));
}

function getPanelInfo(panelId: string) {
  for (const g of PANEL_GROUPS) {
    const p = g.panels.find(p => p.id === panelId);
    if (p) return { ...p, group: g };
  }
  return null;
}

// ─── 常量 ──────────────────────────────────────────────────────────────────────
function fmt(n: number, d = 2) { return n?.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) ?? "—"; }

// ─── 面板标题栏 ────────────────────────────────────────────────────────────────
function PanelHeader({ panelId, side, onClose, onBack }: { panelId: string; side: "left" | "right"; onClose?: () => void; onBack?: () => void }) {
  const group = getPanelGroup(panelId);
  const info = getPanelInfo(panelId);
  const label = info ? `${info.label} ${info.name}` : (PANEL_LABEL[panelId] || panelId);
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded hover:bg-slate-800 mr-1">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
        {side === "left" ? <PanelLeft className="w-3 h-3 text-slate-500" /> : <PanelRight className="w-3 h-3 text-slate-500" />}
        <span className="text-[11px] font-semibold text-slate-300">{label}</span>
        {group && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${group.activeBg} text-white opacity-80`}>{group.label}</span>
        )}
      </div>
      {onClose && (
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded hover:bg-slate-800">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── 单面板容器 ────────────────────────────────────────────────────────────────
function PanelContainer({ panelId, side, onClose, onBack }: { panelId: string; side: "left" | "right"; onClose?: () => void; onBack?: () => void }) {
  const ActiveComponent = PANEL_MAP[panelId];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader panelId={panelId} side={side} onClose={onClose} onBack={onBack} />
      <div className="flex-1 overflow-auto">
        {panelId === "EMSX" ? (
          <OrderEntryPanel />
        ) : ActiveComponent ? (
          <Suspense fallback={
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span>加载中...</span>
              </div>
            </div>
          }>
            <div className="h-full">
              {(() => { const C = PANEL_MAP[panelId]; return <C />; })()}
            </div>
          </Suspense>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">面板未找到: {panelId}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMSX 卡片总览（Hub 页面）────────────────────────────────────────────────
function EMSXHub({ onSelect, risk }: { onSelect: (id: string) => void; risk: any }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="h-full overflow-auto bg-slate-950 p-4">
      {/* 顶部状态摘要 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">挂单数量</div>
          <div className="text-lg font-mono font-bold text-blue-400">{risk ? risk.openOrders : "—"}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">活跃委托</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">日内P&L</div>
          <div className={`text-lg font-mono font-bold ${(risk?.dailyPnL ?? 0) >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
            {risk ? `${risk.dailyPnL >= 0 ? "+" : ""}$${fmt(risk.dailyPnL / 1000, 1)}K` : "—"}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">今日盈亏</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">总敞口</div>
          <div className="text-lg font-mono font-bold text-white">{risk ? `$${fmt(risk.totalExposure / 1e6, 1)}M` : "—"}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">名义金额</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] text-slate-500 mb-1">系统状态</div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold text-emerald-400">实时</span>
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">{timeStr}</div>
        </div>
      </div>

      {/* 快速入口：EMSX订单录入 */}
      <div
        className="mb-5 bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/40 rounded-xl p-4 cursor-pointer hover:border-blue-400/60 transition-all group"
        onClick={() => onSelect("EMSX")}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center group-hover:bg-blue-600/50 transition-colors">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">EMSX</span>
                <Badge className="text-[10px] bg-blue-600/30 text-blue-300 border-blue-500/30">核心系统</Badge>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">委托单录入与递送系统 — 支持31个交易面板的统一订单入口</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* 分组卡片 */}
      {PANEL_GROUPS.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.id} className="mb-5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className={`w-1 h-4 rounded-full ${group.dotColor}`} />
              <GroupIcon className={`w-4 h-4 ${group.color}`} />
              <span className={`text-xs font-semibold ${group.color}`}>{group.label}</span>
              <span className="text-[10px] text-slate-600">({group.panels.length}个模块)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {group.panels.map(panel => (
                <div
                  key={panel.id}
                  className={`relative bg-slate-900 border ${group.borderColor} rounded-lg p-3 cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-lg ${group.hoverBg} group`}
                  onClick={() => onSelect(panel.id)}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className={`text-[11px] font-bold font-mono ${group.color}`}>{panel.label}</span>
                    <ChevronRight className={`w-3 h-3 ${group.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  </div>
                  <div className="text-[12px] font-medium text-slate-200 mb-1">{panel.name}</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{panel.desc}</div>
                  <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg ${group.dotColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-4 bg-slate-900/50 border border-slate-800 rounded-lg p-3 text-center">
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400 font-medium">EMSX 电子交易及委托单递送系统</span>
          {" · "}共 5 个分组 · 26 个交易功能（模拟账户按实时行情撮合） · 点击任意面板卡片直接进入
        </p>
      </div>
    </div>
  );
}

// ─── 订单录入面板 ──────────────────────────────────────────────────────────────
/** 简单 debounce hook */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function OrderEntryPanel() {
  return <EmsxOrderEntry />;
}

// ─── 主页面 ────────────────────────────────────────────────────────────────────
export default function ElectronicTrading() {
  const getUrlParams = () => {
    if (typeof window === "undefined") return { panel: "HUB", left: null, right: null, split: false };
    const sp = new URLSearchParams(window.location.search);
    return {
      panel: sp.get("panel") || "HUB",
      left: sp.get("left"),
      right: sp.get("right"),
      split: sp.get("split") === "1",
    };
  };
  const urlParams = getUrlParams();
  const [splitMode, setSplitMode] = useState<boolean>(urlParams.split || (!!urlParams.left && !!urlParams.right));
  const [activePanel, setActivePanel] = useState<string>(urlParams.panel || "HUB");
  const [leftPanel, setLeftPanel] = useState<string>(urlParams.left || "PTBB");
  const [rightPanel, setRightPanel] = useState<string>(urlParams.right || "TSOX");
  // 账户状态取自平台模拟交易系统（委托 / 成交实时入库）
  const tradeSummary = useSummary();
  const tradeOrders = useOrders();
  const risk = tradeSummary.data ? { available: true, openOrders: (tradeOrders.data ?? []).filter((o) => o.status === "NEW" || o.status === "PARTIAL").length, dailyPnL: tradeSummary.data.dayPnl, totalExposure: tradeSummary.data.marketValue } : null;

  const syncUrl = useCallback((params: { panel?: string; left?: string; right?: string; split?: boolean }) => {
    const url = new URL(window.location.href);
    if (params.split !== undefined) {
      if (params.split) {
        url.searchParams.set("split", "1");
        url.searchParams.delete("panel");
        if (params.left) url.searchParams.set("left", params.left);
        if (params.right) url.searchParams.set("right", params.right);
      } else {
        url.searchParams.delete("split");
        url.searchParams.delete("left");
        url.searchParams.delete("right");
        if (params.panel) url.searchParams.set("panel", params.panel);
      }
    } else {
      if (params.panel) url.searchParams.set("panel", params.panel);
      if (params.left) url.searchParams.set("left", params.left);
      if (params.right) url.searchParams.set("right", params.right);
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  const handleSelectPanel = (id: string) => { setActivePanel(id); syncUrl({ panel: id }); };
  const handleSelectLeft = (id: string) => { setLeftPanel(id); syncUrl({ left: id }); };
  const handleSelectRight = (id: string) => { setRightPanel(id); syncUrl({ right: id }); };

  const enableSplitMode = () => {
    setSplitMode(true);
    const left = (activePanel !== "HUB" && activePanel !== "EMSX") ? activePanel : "PTBB";
    const right = left === "BOOM" ? "PTBB" : "BOOM";
    setLeftPanel(left);
    setRightPanel(right);
    syncUrl({ split: true, left, right });
    toast.success("已开启分屏模式", { description: "左右两侧可独立选择不同面板" });
  };

  const disableSplitMode = () => {
    setSplitMode(false);
    setActivePanel(leftPanel);
    syncUrl({ split: false, panel: leftPanel });
    toast.info("已切换为单屏模式");
  };

  const swapPanels = () => {
    const tmp = leftPanel;
    setLeftPanel(rightPanel);
    setRightPanel(tmp);
    syncUrl({ left: rightPanel, right: tmp });
    toast.success("已交换左右面板");
  };

  const goBackToHub = () => { setActivePanel("HUB"); syncUrl({ panel: "HUB" }); };

  const isHubView = activePanel === "HUB" || activePanel === "EMSX";

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* ── 顶部状态栏 ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white">EMSX</span>
              {!splitMode && !isHubView && (
                <>
                  <span className="text-slate-600 text-xs">/</span>
                  <button onClick={goBackToHub} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">总览</button>
                  <span className="text-slate-600 text-xs">/</span>
                  <span className="text-xs text-blue-400 font-medium">{PANEL_LABEL[activePanel] || activePanel}</span>
                </>
              )}
            </div>
            <Separator orientation="vertical" className="h-4 bg-slate-700 hidden sm:block" />
            <span className="text-xs text-slate-600 hidden md:inline">26 个功能 · 5 分组</span>
          </div>
          {risk?.available && (
            <div className="flex items-center gap-4 text-xs flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">挂单</span>
                <span className="text-blue-400 font-mono font-bold">{risk.openOrders}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">日内P&L</span>
                <span className={`font-mono font-bold ${risk.dailyPnL >= 0 ? "text-[#f2495c]" : "text-[#1fbf75]"}`}>
                  {risk.dailyPnL >= 0 ? "+" : ""}${(risk.dailyPnL / 1000).toFixed(1)}K
                </span>
              </div>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <span className="text-slate-500">敞口</span>
                <span className="text-white font-mono">${(risk.totalExposure / 1e6).toFixed(1)}M</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
              <button onClick={disableSplitMode} title="单屏模式"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${!splitMode ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}>
                <Square className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">单屏</span>
              </button>
              <button onClick={enableSplitMode} title="分屏模式"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${splitMode ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`}>
                <Columns2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">分屏</span>
              </button>
            </div>
            {splitMode && (
              <button onClick={swapPanels} title="交换左右面板"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">互换</span>
              </button>
            )}
            <Separator orientation="vertical" className="h-4 bg-slate-700" />
            <div className="flex items-center gap-1 text-slate-500 text-xs">
              <Clock className="w-3 h-3" />
              <span className="font-mono hidden sm:inline">{new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 内容区 ── */}
      <div className="flex-1 overflow-hidden">
        {splitMode ? (
          <SplitPane
            left={
              <div className="flex flex-col h-full overflow-hidden">
                {leftPanel === "HUB" ? (
                  <EMSXHub onSelect={handleSelectLeft} risk={risk} />
                ) : (
                  <PanelContainer panelId={leftPanel} side="left" onBack={() => handleSelectLeft("HUB")} />
                )}
              </div>
            }
            right={
              <div className="flex flex-col h-full overflow-hidden">
                {rightPanel === "HUB" ? (
                  <EMSXHub onSelect={handleSelectRight} risk={risk} />
                ) : (
                  <PanelContainer panelId={rightPanel} side="right" onBack={() => handleSelectRight("HUB")} />
                )}
              </div>
            }
            defaultSplit={50}
            minLeftWidth={300}
            minRightWidth={300}
          />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {isHubView ? (
                <EMSXHub onSelect={handleSelectPanel} risk={risk} />
              ) : PANEL_MAP[activePanel] ? (
                <PanelContainer panelId={activePanel} side="left" onBack={goBackToHub} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">面板未找到</p>
                  <button onClick={goBackToHub}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-all">
                    <ArrowLeft className="w-4 h-4" />返回总览
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 分屏提示条 ── */}
      {splitMode && (
        <div className="bg-blue-950/50 border-t border-blue-900/50 px-4 py-1 flex-shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-3 text-blue-400/70">
              <Columns2 className="w-3 h-3" />
              <span>分屏模式已开启 — 拖拽中间分隔线调整宽度比例</span>
              <span className="text-blue-400/40">·</span>
              <span className="text-blue-400/50">
                左：<span className="text-blue-300">{PANEL_LABEL[leftPanel] || leftPanel}</span>
                <span className="mx-2 text-blue-400/30">|</span>
                右：<span className="text-blue-300">{PANEL_LABEL[rightPanel] || rightPanel}</span>
              </span>
            </div>
            <button onClick={disableSplitMode} className="text-blue-400/50 hover:text-blue-300 transition-colors flex items-center gap-1">
              <X className="w-3 h-3" /><span>退出分屏</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
