import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { X } from 'lucide-react';

interface MenuItem {
  number: string;
  code: string;
  name: string;
  hasSubmenu?: boolean;
}

const menuItems: MenuItem[] = [
  { number: '1', code: 'RESD', name: 'MAV报告的EMIR初始用户界面' },
  { number: '2', code: 'FXTB', name: 'FXGO交易记录簿' },
  { number: '3', code: 'FXSS', name: '外汇确认和结算' },
  { number: '4', code: 'ALEX', name: '分配记录簿' },
  { number: '5', code: 'TRPV', name: '三方头寸浏览器' },
  { number: '6', code: 'DTCP', name: 'DTCC头寸显示' },
  { number: '7', code: 'POST', name: 'STP交易后记录簿' },
  { number: '8', code: 'STPE', name: '记录簿管理' },
  { number: '9', code: 'ALOB', name: '分配账户设定' },
  { number: '10', code: 'VCAD', name: 'VCON全公司管理' },
  { number: '11', code: 'ALOS', name: '券商账户映射' },
  { number: '12', code: 'SREF', name: 'STP referral screen' },
  { number: '13', code: 'ESTP', name: '启用BSTP' },
  { number: '14', code: 'SPDL', name: '交易支持目录' },
  { number: '15', code: 'FSTN', name: 'FailStation工作站' },
  { number: '16', code: 'BRRS', name: '概览：监管报告' },
  { number: '17', code: 'RHUB', name: '监管报告中心' },
  { number: '18', code: 'RHAD', name: 'RHUB管理' },
  { number: '19', code: 'RHUD', name: 'RHUB资料' },
  { number: '20', code: 'RHAB', name: 'RHUB管理Beta' },
];

interface STPMenuProps {
  onClose: () => void;
}

export function STPMenu({ onClose }: STPMenuProps) {
  const [, setLocation] = useLocation();
  // STP 处理页为本菜单 24 个代码各自提供专属面板（含 BLOT、IB、MIFI、
  // RHAD、RHUD、RHAB）。通用代码配置会把其中几项带到别的页面或未接入页，
  // 因此本菜单统一打开 STP 处理页中的对应面板。
  const openStpPanel = (item: MenuItem) => {
    const code = item.code || item.number;
    handleMenuItemClick(code, item.name, () => {
      onClose();
      setLocation(`/stp-processing?panel=${encodeURIComponent(code)}`);
    });
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 佑诚直通式处理解决方案</span>
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
              <div className="text-[#d4af37] text-xs font-semibold mb-3">交易记录</div>
              {menuItems.slice(0, 7).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openStpPanel(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}

              <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">授权</div>
              {menuItems.slice(7, 13).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openStpPanel(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}
            </div>

            {/* Right Column */}
            <div className="space-y-2">
              <div className="text-[#d4af37] text-xs font-semibold mb-3">社区</div>
              {menuItems.slice(13, 14).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openStpPanel(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}

              <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">高级服务</div>
              {menuItems.slice(14, 15).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openStpPanel(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-16">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                  {item.hasSubmenu && <span className="text-[#999]">›</span>}
                </div>
              ))}

              <div className="text-[#d4af37] text-xs font-semibold mb-3 mt-4">监管法规</div>
              {menuItems.slice(15, 20).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openStpPanel(item)}>
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
