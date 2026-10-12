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
  { number: '1', code: 'BLCU', name: 'BBG Customization Settings' },
  { number: '2', code: 'PDFQ', name: '设定-快速开始' },
  { number: '3', code: '', name: '用户与诊断信息', hasSubmenu: false },
  { number: '4', code: 'UUF', name: '更新密码' },
  { number: '5', code: 'LANG', name: '语言偏好' },
  { number: '6', code: 'TZDF', name: '设置本地时区' },
  { number: '7', code: 'PSET', name: '打印设定' },
  { number: '8', code: 'PDFU 3', name: '当前时段预设' },
  { number: '9', code: 'PDFU 9', name: '"自动完成"功能设置' },
  { number: '10', code: 'PDFU 10', name: '<Back>与<Menu>偏好' },
  { number: '11', code: 'PDFU COLORS', name: '无障碍颜色' },
  { number: '12', code: '', name: '交易所、外来资讯及价格设定', hasSubmenu: false },
  { number: '13', code: '', name: '实用工具', hasSubmenu: false },
  { number: '14', code: 'CLIP', name: '截取到剪贴板' },
  { number: '15', code: 'GRAB', name: '发送屏幕图像' },
  { number: '16', code: 'GRIB', name: '以IB发送屏幕图像' },
  { number: '17', code: 'HELP PDF', name: '设定与预设帮助' },
  { number: '18', code: 'INBB', name: 'APOD创建帮助' },
  { number: '19', code: 'DRS', name: '概览：灾备服务' },
  { number: '20', code: 'PDFG', name: '国债设定' },
  { number: '21', code: 'PDFO', name: '历史常规预设' },
  { number: '22', code: 'COVR', name: '债券计算重设' },
  { number: '23', code: 'PDFD', name: '优先债预设设定' },
  { number: '24', code: 'IPDF', name: '股票指数预设' },
  { number: '25', code: 'PDFE', name: '股票个人预设' },
];

interface SettingsToolsMenuProps {
  onClose: () => void;
}

export function SettingsToolsMenu({ onClose }: SettingsToolsMenuProps) {
  const [, setLocation] = useLocation();
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 设定与实用工具</span>
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
              {menuItems.slice(12, 25).map((item) => (
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
