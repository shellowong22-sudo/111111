import { useEffect, useState } from 'react';
import { 
  Settings, Users, Target, BarChart3, Activity, Layout,
  TrendingUp, Shield, Zap, PieChart, BookOpen, History,
  Award, Shuffle, Sliders, Newspaper, Calendar, FileText, CheckSquare,
  Bell, Server, FileSpreadsheet
} from 'lucide-react';

// Sub-panel imports
import PRTUPanel from './PRTUPanel';
import BBUPanel from './BBUPanel';
import PORTOverviewPanel from './PORTOverviewPanel';
import PORTIPPanel from './PORTIPPanel';
import PDSPPanel from './PDSPPanel';
import PORTTEPanel from './PORTTEPanel';
import PORTVRPanel from './PORTVRPanel';
import PORTSAPanel from './PORTSAPanel';
import PORTHDPanel from './PORTHDPanel';
import PORTCHPanel from './PORTCHPanel';
import PORTHPPanel from './PORTHPPanel';
import PORTPAPanel from './PORTPAPanel';
import PORTTSPanel from './PORTTSPanel';
import PORTOPPanel from './PORTOPPanel';
import NLPanel from './NLPanel';
import EVTSPortPanel from './EVTSPortPanel';
import PREPPanel from './PREPPanel';
import MIFIPanel from './MIFIPanel';
import SystemMaintenancePanel from './SystemMaintenancePanel';
import AlertMonitorPanel from './AlertMonitorPanel';
import DecisionReportPanel from './DecisionReportPanel';
import AuditLogPanel from './AuditLogPanel';
import IntegrationMonitorPanel from './IntegrationMonitorPanel';
import BondPortfolioRiskImportPanel from './BondPortfolioRiskImportPanel';

const TABS = [
  { id: 'sys',    label: 'SYS',     title: '系统维护',       icon: Settings,    color: '#6b7280' },
  { id: 'prtu',   label: 'PRTU',    title: '组合管理',       icon: Users,       color: '#3b82f6' },
  { id: 'bbu',    label: 'BBU',     title: '基准管理',       icon: Target,      color: '#8b5cf6' },
  { id: 'port',   label: 'PORT',    title: '综合分析',       icon: BarChart3,   color: '#22c55e' },
  { id: 'portip', label: 'PORT IP', title: '日内业绩',       icon: Activity,    color: '#f59e0b' },
  { id: 'pdsp',   label: 'PDSP',    title: '组合展示',       icon: Layout,      color: '#06b6d4' },
  { id: 'portte', label: 'PORT TE', title: '跟踪误差',       icon: TrendingUp,  color: '#ec4899' },
  { id: 'portvr', label: 'PORT VR', title: '风险价值 VaR',   icon: Shield,      color: '#ef4444' },
  { id: 'portsa', label: 'PORT SA', title: '情景分析',       icon: Zap,         color: '#f97316' },
  { id: 'porthd', label: 'PORT HD', title: '持仓分析',       icon: PieChart,    color: '#14b8a6' },
  { id: 'portch', label: 'PORT CH', title: '组合特征',       icon: BookOpen,    color: '#a855f7' },
  { id: 'porthp', label: 'PORT HP', title: '历史业绩',       icon: History,     color: '#84cc16' },
  { id: 'portpa', label: 'PORT PA', title: '业绩归因',       icon: Award,       color: '#eab308' },
  { id: 'portts', label: 'PORT TS', title: '交易模拟',       icon: Shuffle,     color: '#0ea5e9' },
  { id: 'portop', label: 'PORT OP', title: '组合优化',       icon: Sliders,     color: '#10b981' },
  { id: 'nl',     label: 'NL',      title: '新闻情绪',       icon: Newspaper,   color: '#f43f5e' },
  { id: 'evts',   label: 'EVTS',    title: '事件追踪',       icon: Calendar,    color: '#6366f1' },
  { id: 'prep',   label: 'PREP',    title: '报告生成',       icon: FileText,    color: '#d97706' },
  { id: 'mifi',   label: 'MIFI',    title: '合规方案',       icon: CheckSquare, color: '#059669' },
  { id: 'alert',  label: 'ALRT',    title: '智能预警',       icon: Bell,        color: '#dc2626' },
  { id: 'report', label: 'DRPT',    title: '决策报告',       icon: FileText,    color: '#7c3aed' },
  { id: 'audit',  label: 'AUDT',    title: '审计日志',       icon: History,     color: '#0891b2' },
  { id: 'integ',  label: 'INTG',    title: '系统集成',       icon: Server,      color: '#65a30d' },
  { id: 'bondrisk', label: 'BOND RISK', title: '债券久期与情景损益', icon: FileSpreadsheet, color: '#06b6d4' },
];

// Map from menu code to tab id
export const PORTFOLIO_CODE_TO_TAB: Record<string, string> = {
  'SYS': 'sys', '1': 'sys',
  'PRTU': 'prtu', '2': 'prtu',
  'BBU': 'bbu', '3': 'bbu',
  'PORT': 'port', '4': 'port',
  'PORT IP': 'portip', '5': 'portip',
  'PDSP': 'pdsp', '6': 'pdsp',
  'PORT TE': 'portte', '7': 'portte',
  'PORT VR': 'portvr', '8': 'portvr',
  'PORT SA': 'portsa', '9': 'portsa',
  'PORT HD': 'porthd', '10': 'porthd',
  'PORT CH': 'portch', '11': 'portch',
  'PORT HP': 'porthp', '12': 'porthp',
  'PORT PA': 'portpa', '13': 'portpa',
  'PORT TS': 'portts', '14': 'portts',
  'PORT OP': 'portop', '15': 'portop',
  'NL': 'nl', '16': 'nl',
  'EVTS': 'evts', '17': 'evts',
  'PREP': 'prep', '18': 'prep',
  'MIFI': 'mifi', '19': 'mifi',
  'ALRT': 'alert', '20': 'alert',
  'DRPT': 'report', '21': 'report',
  'AUDT': 'audit', '22': 'audit',
  'INTG': 'integ', '23': 'integ',
  'BOND RISK': 'bondrisk', 'BOND_RISK': 'bondrisk', '24': 'bondrisk',
};

export default function PortfolioManagementPanel({ onClose, initialTab }: { onClose?: () => void; initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'prtu');

  // 窗口已打开时再次从菜单选择其他功能：跟随新的 initialTab 切换
  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  const renderPanel = () => {
    switch (activeTab) {
      case 'sys':    return <SystemMaintenancePanel />;
      case 'prtu':   return <PRTUPanel />;
      case 'bbu':    return <BBUPanel />;
      case 'port':   return <PORTOverviewPanel />;
      case 'portip': return <PORTIPPanel />;
      case 'pdsp':   return <PDSPPanel />;
      case 'portte': return <PORTTEPanel />;
      case 'portvr': return <PORTVRPanel />;
      case 'portsa': return <PORTSAPanel />;
      case 'porthd': return <PORTHDPanel />;
      case 'portch': return <PORTCHPanel />;
      case 'porthp': return <PORTHPPanel />;
      case 'portpa': return <PORTPAPanel />;
      case 'portts': return <PORTTSPanel />;
      case 'portop': return <PORTOPPanel />;
      case 'nl':     return <NLPanel />;
      case 'evts':   return <EVTSPortPanel />;
      case 'prep':   return <PREPPanel />;
      case 'mifi':   return <MIFIPanel />;
      case 'alert':  return <AlertMonitorPanel />;
      case 'report': return <DecisionReportPanel />;
      case 'audit':  return <AuditLogPanel />;
      case 'integ':  return <IntegrationMonitorPanel />;
      case 'bondrisk': return <BondPortfolioRiskImportPanel />;
      default:       return <PRTUPanel />;
    }
  };

  const activeTabInfo = TABS.find(t => t.id === activeTab);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] text-green-400 font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-green-900/50 bg-black/80 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm tracking-wider">PORT</span>
          <span className="text-green-600 text-xs">投资组合管理与风险系统</span>
          <span className="text-green-800 mx-1">|</span>
          <span style={{ color: activeTabInfo?.color }} className="text-xs font-semibold">
            {activeTabInfo?.label} · {activeTabInfo?.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          
          {onClose && (
            <button onClick={onClose} className="text-green-700 hover:text-green-300 ml-2 text-sm">✕</button>
          )}
        </div>
      </div>

      {/* Content — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        {renderPanel()}
      </div>
    </div>
  );
}
