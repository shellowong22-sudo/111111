import { X } from 'lucide-react';

// Tab ID mapping: menu code -> PortfolioManagementPanel tab id
const CODE_TO_TAB: Record<string, string> = {
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
  'BOND RISK': 'bondrisk', '24': 'bondrisk',
};

interface MenuItem {
  number: string;
  code: string;
  name: string;
  hasSubmenu?: boolean;
}

const menuItems: MenuItem[] = [
  { number: '1', code: 'SYS', name: '维护投资组合与功能说明', hasSubmenu: false },
  { number: '2', code: 'PRTU', name: '投资组合管理' },
  { number: '3', code: 'BBU', name: '佑诚上传功能' },
  { number: '4', code: 'PORT', name: '投资组合与风险分析' },
  { number: '5', code: 'PORT IP', name: '日内业绩' },
  { number: '6', code: 'PDSP', name: '投资组合显示' },
  { number: '7', code: 'PORT TE', name: '跟踪误差' },
  { number: '8', code: 'PORT VR', name: '风险价值' },
  { number: '9', code: 'PORT SA', name: '情景分析' },
  { number: '10', code: 'PORT HD', name: '投资组合持有' },
  { number: '11', code: 'PORT CH', name: '投资组合特征' },
  { number: '12', code: 'PORT HP', name: '历史业绩' },
  { number: '13', code: 'PORT PA', name: '业绩归因' },
  { number: '14', code: 'PORT TS', name: '交易模拟' },
  { number: '15', code: 'PORT OP', name: '投资组合优化' },
  { number: '16', code: 'NL', name: '证券代码列表新闻' },
  { number: '17', code: 'EVTS', name: '大事日历' },
  { number: '18', code: 'PREP', name: '投资组合报告' },
  { number: '19', code: 'MIFI', name: '概览：MiFID II解决方案' },
  { number: '20', code: 'ALRT', name: '智能预警管理系统' },
  { number: '21', code: 'DRPT', name: '决策支持深度报告' },
  { number: '22', code: 'AUDT', name: '审计日志与操作留痕' },
  { number: '23', code: 'INTG', name: '外部系统集成监控' },
  { number: '24', code: 'BOND RISK', name: '债券久期、凸性与情景损益' },
];

interface PortfolioManagementMenuProps {
  onClose: () => void;
  onOpenTab?: (tabId: string) => void;
}

export function PortfolioManagementMenu({ onClose, onOpenTab }: PortfolioManagementMenuProps) {
  const handleItemClick = (item: MenuItem) => {
    const tabId = CODE_TO_TAB[item.code] ?? CODE_TO_TAB[item.number];
    if (tabId && onOpenTab) {
      onOpenTab(tabId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 投资组合管理与风险</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#d4af37] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-2">
              {menuItems.slice(0, 12).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => handleItemClick(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}
            </div>

            {/* Right Column */}
            <div className="space-y-2">
              {menuItems.slice(12).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => handleItemClick(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#333] px-6 py-3 bg-[#0a0a0a] flex items-center justify-between text-xs text-[#666]">
          <span>Indicates function uses Ucheer AI technology</span>
          <span>MenuId: 5432</span>
        </div>
      </div>
    </div>
  );
}
