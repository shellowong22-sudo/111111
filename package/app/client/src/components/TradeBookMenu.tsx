import { X } from 'lucide-react';
import { useLocation } from 'wouter';

interface MenuItem {
  number: string;
  code: string;
  name: string;
  panel: string;
  hasSubmenu?: boolean;
}

const menuItems: MenuItem[] = [
  { number: '1', code: '',     name: '交易簿股票',         panel: 'STOCK'   },
  { number: '2', code: '',     name: '交易簿期货',         panel: 'FUTURES' },
  { number: '3', code: '',     name: '交易簿期权',         panel: 'OPTIONS' },
  { number: '4', code: 'TBGS', name: '交易账簿汇总视图',   panel: 'TBGS'    },
  { number: '5', code: 'BTFI', name: '期货持仓信息',       panel: 'BTFI'    },
  { number: '6', code: 'TBMI', name: '账簿市场影响分析',   panel: 'TBMI'    },
  { number: '7', code: 'TSDM', name: '交易结算与交收管理', panel: 'TSDM'    },
];

interface TradeBookMenuProps {
  onClose: () => void;
}

export function TradeBookMenu({ onClose }: TradeBookMenuProps) {
  const [, setLocation] = useLocation();
  const handleClick = (item: MenuItem) => {
    onClose();
    setLocation(`/trade-book?panel=${item.panel}`);
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 交易账簿管理</span>
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
          <div className="space-y-4">
            {[{ title: '交易簿发售', range: [0, 3] }, { title: '交易簿产品信息', range: [3, 6] }, { title: '资产管理与订单', range: [6, 7] }].map((section) => (
              <div key={section.title}>
                <div className="text-[#d4af37] text-xs font-semibold mb-2 pb-1 border-b border-[#333]">{section.title}</div>
                <div className="space-y-1">
                  {menuItems.slice(section.range[0], section.range[1]).map((item) => (
                    <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1.5 rounded transition-colors"
                      onClick={() => handleClick(item)}>
                      <span className="text-[#999] w-6">{item.number})</span>
                      <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                      <span className="text-[#ccc] flex-1">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#333] px-6 py-3 bg-[#0f0f0f] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-[#d4af37] text-black hover:bg-[#e5c158] transition-colors rounded-sm font-semibold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
