import { X } from 'lucide-react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

interface MenuItem {
  number: string;
  code: string;
  name: string;
  hasSubmenu?: boolean;
}

const menuItems: MenuItem[] = [
  { number: '1', code: 'AIM', name: '买方OMS', hasSubmenu: false },
  { number: '2', code: 'TOMS', name: '卖方债券委托单管理系统（含 TOMS 概览）', hasSubmenu: false },
  { number: '3', code: 'BBS', name: 'Overview: Buy-Side Solutions' },
  { number: '4', code: 'BSS', name: 'Overview: Sell-Side Solutions' },
  { number: '5', code: 'TWC', name: 'TW配置' },
  { number: '6', code: 'RISK', name: '概览：MARS' },
  { number: '7', code: 'TTTT', name: '定价号码状态' },
  { number: '8', code: 'EC', name: '企业主控台' },
  { number: '9', code: 'AIMH', name: 'AIM功能说明' },
  { number: '10', code: 'HELP TOMS', name: 'TOMS功能说明' },
  { number: '11', code: 'TSDM', name: '交易系统演示功能中心' },
  { number: '12', code: 'BSKM', name: 'ETF创建/赎回' },
  { number: '13', code: 'BSKT', name: '概览：ETF创建' },
  { number: '14', code: 'BSKA', name: 'AP ETF委托单管理' },
  { number: '15', code: 'DSKM', name: 'BSKT券商交易台权限' },
  { number: '16', code: 'CKMM', name: 'ETF创建(Beta)' },
  { number: '17', code: 'CKPV', name: 'ETFP客户数据' },
  { number: '18', code: 'CKPM', name: 'ETF创建/赎回' },
  { number: '19', code: 'CKAP', name: 'BSKT做市商(Beta)' },
];

interface OrderManagementMenuProps {
  onClose: () => void;
}

export function OrderManagementMenu({ onClose }: OrderManagementMenuProps) {
  const [, setLocation] = useLocation();
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 交易委托管理系统</span>
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
              {menuItems.slice(0, 8).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => { handleMenuItemClick(item.code || item.number, item.name, (path) => { onClose(); setLocation(path); }); }}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-20">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}
            </div>

            {/* Right Column */}
            <div className="space-y-2">
              <div className="text-[#d4af37] text-xs font-semibold mb-3">资料中心</div>
              {menuItems.slice(8, 11).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => { handleMenuItemClick(item.code || item.number, item.name, (path) => { onClose(); setLocation(path); }); }}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-20">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}

              <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">ETF一级市场</div>
              {menuItems.slice(11, 19).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => { handleMenuItemClick(item.code || item.number, item.name, (path) => { onClose(); setLocation(path); }); }}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-20">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}
            </div>
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
