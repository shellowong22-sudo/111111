import { X } from 'lucide-react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

interface ForexMenuProps {
  onClose: () => void;
  onSelectItem?: (itemId: string, itemName: string) => void;
}

export function ForexMenu({ onClose, onSelectItem }: ForexMenuProps) {
  const [, setLocation] = useLocation();
  const menuItems = [
    // 左列
    [
      { num: 1, code: '', name: '证券、设定与功能说明', hasSubmenu: false, id: '' },
      { num: 2, code: 'FXIP', name: '外汇信息门户', hasSubmenu: false, id: 'fxip' },
      { num: 3, code: 'FXDS', name: '外汇数据检索', hasSubmenu: false, id: 'fxds' },
      { num: 4, code: 'FXTF', name: '外汇代码查找', hasSubmenu: false, id: 'fxtf' },
      { num: 5, code: '', name: '价格发现', hasSubmenu: false, id: '' },
      { num: 6, code: 'FXC', name: '汇率矩阵', hasSubmenu: false, id: 'fxc' },
      { num: 7, code: 'WCR', name: '全球汇率', hasSubmenu: false, id: 'wcr' },
      { num: 8, code: 'XCCY', name: '交叉货币基点差', hasSubmenu: false, id: 'xccy' },
      { num: 9, code: '', name: '分析功能与选股提示', hasSubmenu: false, id: '' },
      { num: 10, code: 'FXSW', name: '外汇策略工作台', hasSubmenu: false, id: 'fxsw' },
      { num: 11, code: 'XDSH', name: '外汇控制面板', hasSubmenu: false, id: 'xdsh' },
      { num: 12, code: 'FXFC', name: '外汇预测', hasSubmenu: false, id: 'fxfc' },
      { num: 13, code: 'WCRS', name: '全球货币排行榜', hasSubmenu: false, id: 'wcrs' },
      { num: 14, code: 'ECMI', name: '市场冲击行情显示', hasSubmenu: false, id: 'ecmi' },
      { num: 15, code: 'MYQ', name: 'My Quotes', hasSubmenu: false, id: 'myq' },
    ],
    // 右列
    [
      { num: 16, code: '', name: '分析 USD DEPOSIT 1 WK Curncy', hasSubmenu: false, id: '' },
      { num: 17, code: 'ALLQ', name: '全部报价', hasSubmenu: false, id: 'allq' },
      { num: 18, code: 'FRD', name: '外汇远期计算器', hasSubmenu: false, id: 'frd' },
      { num: 19, code: 'BFIX', name: '佑诚外汇定价', hasSubmenu: false, id: 'bfix' },
      { num: 20, code: 'FXFA', name: '外汇利率套利', hasSubmenu: false, id: 'fxfa' },
      { num: 22, code: 'TOP FX', name: '要闻报道', hasSubmenu: false, id: 'topfx' },
      { num: 23, code: 'STNI', name: '建议新闻传输', hasSubmenu: false, id: 'stni' },
      { num: 24, code: 'RES', name: '研究报告主页', hasSubmenu: false, id: 'res' },
      { num: 25, code: '', name: '外汇电子交易', hasSubmenu: false, id: '' },
      { num: 26, code: '', name: '外汇衍生品', hasSubmenu: false, id: '' },
      { num: 27, code: 'MARS FX', name: '外汇', hasSubmenu: false, id: 'marsfx' },
    ],
  ];

  const handleClick = (item: { id: string; code: string; name: string; hasSubmenu: boolean }) => {
    if (!item.id || item.hasSubmenu) return;
    if (onSelectItem) {
      onSelectItem(item.id, item.name);
      onClose();
    }
  };

  const renderMenuItem = (item: any) => (
    <div
      key={`${item.num}-${item.code}`}
      onClick={() => handleClick(item)}
      className={`flex items-center gap-2 text-xs rounded px-1 py-0.5 ${
        item.id && !item.hasSubmenu
          ? 'cursor-pointer hover:bg-[#d4af37]/10 hover:text-white transition-colors'
          : ''
      }`}
    >
      <span className="text-[#999] w-6">{item.num})</span>
      {item.code && (
        <span className={`font-semibold w-20 ${item.id && !item.hasSubmenu ? 'text-[#d4af37]' : 'text-[#888]'}`}>
          {item.code}
        </span>
      )}
      <span className={`flex-1 ${item.hasSubmenu ? 'text-[#aaa] font-semibold' : 'text-[#ccc]'}`}>{item.name}</span>
      {item.hasSubmenu && <span className="text-[#999]">›</span>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-[#333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#d4af37] text-sm">🏠</span>
            <span className="text-[#d4af37] text-sm">佑诚功能主目录 › 外汇市场</span>
          </div>
          <button onClick={onClose} className="text-[#d4af37] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">{menuItems[0].map(renderMenuItem)}</div>
            <div className="space-y-1">{menuItems[1].map(renderMenuItem)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#333] px-6 py-3 bg-[#0f0f0f] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs bg-[#d4af37] text-black hover:bg-[#e5c158] transition-colors rounded-sm font-semibold">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
