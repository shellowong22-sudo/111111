import { X } from 'lucide-react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';

interface MenuItem {
  number: string;
  code: string;
  name: string;
}

const menuItems: MenuItem[] = [
  { number: '1', code: 'GOVT', name: '国债市场行情显示' },
  { number: '2', code: 'FIT', name: '固定收益交易' },
  { number: '3', code: 'FITG', name: '固定收益交易网格' },
  { number: '4', code: 'CORP', name: '公司债' },
  { number: '5', code: 'BOLT', name: '买价/卖价列表交易' },
  { number: '6', code: 'AGENCY', name: '美国机构债与抵押债' },
  { number: '7', code: 'BBTM', name: 'TBA 电子交易' },
  { number: '8', code: 'IMGR', name: '库存与价格' },
  { number: '9', code: 'EM', name: 'Emerging Markets' },
  { number: '10', code: 'TRDE', name: 'Multi-Sec List Trading' },
  { number: '11', code: 'EBND', name: 'E-债券' },
  { number: '12', code: 'MUNI', name: '地方债' },
  { number: '13', code: 'MBWD', name: '地方债买价问询' },
  { number: '14', code: 'PICK', name: '地方债发行' },
  { number: '15', code: 'IMGRMUNI', name: 'IMGR MUNI 库存与价格' },
  { number: '16', code: 'IRSWAP', name: '利率掉期流动性' },
  { number: '17', code: 'CDS', name: '信用违约掉期流动性' },
  { number: '18', code: 'EQUITY', name: '股票交易' },
  { number: '19', code: 'FX', name: '外汇交易' },
  { number: '20', code: 'WORKFLOW', name: '工作流程工具和功能说明' },
  { number: '21', code: 'BLOT', name: '佑诚电子交易记录簿' },
  { number: '22', code: 'ETBT', name: 'Single Inst E-Trading Blotter' },
  { number: '23', code: 'VCON', name: '语音确认' },
  { number: '24', code: 'TSOX', name: '固定收益执行管理' },
  { number: '25', code: 'WATL', name: 'Watchlist' },
  { number: '26', code: 'PTBB', name: '投资组合交易篮子设定' },
  { number: '27', code: 'MONEY', name: '货币市场、回购与融资' },
  { number: '28', code: 'BOOM', name: '债券委托单管理' },
  { number: '29', code: 'NOTC', name: '电子交易通知' },
  { number: '30', code: 'MIFIET', name: 'MiFID II 电子交易合规' },
  { number: '31', code: 'UACK', name: '全球用户确认' },
];

interface ElectronicTradingMenuProps {
  onClose: () => void;
}

export function ElectronicTradingMenu({ onClose }: ElectronicTradingMenuProps) {
  const [, setLocation] = useLocation();
  // 本菜单 31 项在“电子交易界面”中各有专属面板。FIT、FITG、BOLT、BBTM、
  // IMGR、BLOT、TSOX、WATL、PTBB 的通用代码配置指向固定收益交易页，
  // 在这里必须打开电子交易界面对应面板，菜单名与功能才一致。
  const openElectronicTradingPanel = (item: MenuItem) => {
    handleMenuItemClick(item.code, item.name, () => {
      onClose();
      setLocation(`/electronic-trading?panel=${encodeURIComponent(item.code)}`);
    });
  };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 电子交易及委托单递送</span>
          </div>
          <button onClick={onClose} className="text-[#d4af37] hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              {menuItems.slice(0, 16).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openElectronicTradingPanel(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-24">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {menuItems.slice(16).map((item) => (
                <div key={item.number} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#333] px-2 py-1 rounded transition-colors"
                  onClick={() => openElectronicTradingPanel(item)}>
                  <span className="text-[#999] w-6">{item.number})</span>
                  <span className="text-[#d4af37] font-semibold w-24">{item.code}</span>
                  <span className="text-[#ccc] flex-1">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-[#333] px-6 py-3 bg-[#0f0f0f] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs bg-[#d4af37] text-black hover:bg-[#e5c158] transition-colors rounded-sm font-semibold">关闭</button>
        </div>
      </div>
    </div>
  );
}
