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
  { number: '1', code: 'BQLX', name: 'Excel BQL帮助页面' },
  { number: '2', code: 'DAPI', name: '概览：桌面API' },
  { number: '3', code: 'EAPI', name: '企业版API功能说明' },
  { number: '4', code: 'BDEV', name: '佑诚开发者' },
  { number: '5', code: 'APIL', name: 'API确认' },
  { number: '6', code: 'EDF', name: '概览：EDF（事件驱动数据传输）' },
  { number: '7', code: 'ESIP', name: '企业整合' },
  { number: '8', code: 'ESIC', name: '企业整合(Beta)' },
  { number: '9', code: 'EMRS', name: '授权管理' },
  { number: '10', code: 'APIE', name: '授权报告' },
  { number: '11', code: 'SAPE', name: '服务器API声明管理' },
  { number: '12', code: 'MVC', name: 'MVC管理员控制面板' },
  { number: '13', code: 'BDME', name: '佑诚数据模型百科' },
  { number: '14', code: 'EDRS', name: 'Overview: Enterprise Data Sols' },
  { number: '15', code: 'APRE', name: 'Application Registration' },
  { number: '16', code: '', name: 'Ucheer Quant（UQuant）', hasSubmenu: false },
  { number: '17', code: 'BQNT', name: 'UQuant' },
  { number: '18', code: 'BQIQ', name: 'UQuant 桌面版概览' },
  { number: '19', code: '', name: '数据服务', hasSubmenu: false },
  { number: '20', code: 'DATA', name: '佑诚企业数据目录' },
  { number: '21', code: 'DLPS', name: 'Data License Per Security' },
  { number: '22', code: 'DCA', name: '桌面资料提供应用程序' },
  { number: '23', code: 'CMD', name: '贡献管理控制面板' },
  { number: '24', code: 'BVLI', name: '概览：BVAL' },
  { number: '25', code: 'FVHL', name: '公允价值等级' },
  { number: '26', code: 'BVCH', name: 'BVAL价格质疑' },
  { number: '27', code: 'CBTA', name: '自设代码管理' },
  { number: '28', code: 'FIGI', name: '全球ID' },
  { number: '29', code: 'ISIN', name: 'ISIN查寻' },
  { number: '30', code: 'LEI', name: '法律实体代码' },
];

interface BloombergDataMenuProps {
  onClose: () => void;
}

export function BloombergDataMenu({ onClose }: BloombergDataMenuProps) {
  const [, setLocation] = useLocation();
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">Finance Hub 数据目录 › 数据、Excel 与量化工具</span>
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
              {menuItems.slice(0, 15).map((item) => (
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
              {menuItems.slice(15, 30).map((item) => (
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
