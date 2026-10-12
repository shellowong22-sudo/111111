import React from 'react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronRight, X } from 'lucide-react';

interface MoneyMarketMenuProps {
  onClose: () => void;
  onSelectItem?: (itemId: string, itemName: string) => void;
}

export const MoneyMarketMenu: React.FC<MoneyMarketMenuProps> = ({ onClose, onSelectItem }) => {
  const menuItems = [
    [
      { num: 1,  code: 'DES',      name: '证券与功能说明',          hasSubmenu: false, id: 'des-mm' },
      { num: 2,  code: 'PGM',      name: '货币市场项目列表',         hasSubmenu: false, id: 'pgm' },
      { num: 3,  code: 'MKTBEAT',  name: '当前市场',                hasSubmenu: false, id: 'mktbeat' },
      { num: 4,  code: 'BTMM',     name: '国债与货币市场',           hasSubmenu: false, id: 'btmm' },
      { num: 5,  code: 'BOOM',     name: '货币市场发售',             hasSubmenu: false, id: 'boom' },
      { num: 6,  code: 'TCON',     name: '国债控制面板',             hasSubmenu: false, id: 'tcon' },
      { num: 7,  code: 'RV',       name: '相对价值',                hasSubmenu: false, id: 'rv' },
      { num: 8,  code: 'YCQSIM',   name: '收益曲线量子模拟',         hasSubmenu: false, id: 'ycqsim' },
      { num: 9,  code: 'GC',       name: '绘制曲线图',              hasSubmenu: false, id: 'gc' },
      { num: 10, code: 'CRVF MMKT',name: '查找曲线-货币市场',        hasSubmenu: false, id: 'crvf-mmkt' },
      { num: 11, code: 'CRVF',     name: '查找曲线',                hasSubmenu: false, id: 'crvf' },
      { num: 12, code: 'FIBC',     name: '债券计算器',              hasSubmenu: false, id: 'fibc' },
      { num: 13, code: 'CDIE',     name: '预测CDI 对实际DI 期货',    hasSubmenu: false, id: 'cdie' },
    ],
    [
      { num: 14, code: 'EFSF',     name: '分析 EFSF EMTN M-Mkt',   hasSubmenu: false, id: 'efsf' },
      { num: 15, code: 'MMIDX',    name: '货币市场指数',             hasSubmenu: false, id: 'mmidx' },
      { num: 16, code: 'ETRADE',   name: '定价、写单、电子交易',      hasSubmenu: false, id: 'etrade' },
      { num: 17, code: 'EDSF',     name: 'ED合成FRA',               hasSubmenu: false, id: 'edsf' },
      { num: 18, code: 'PBOC',     name: '中国人民银行',             hasSubmenu: false, id: 'pboc' },
      { num: 19, code: 'TWDI',     name: '台北金融业拆款定盘利率',    hasSubmenu: false, id: 'twdi' },
      { num: 20, code: 'NEWS',     name: '新闻与研究报告',           hasSubmenu: false, id: 'news-mm' },
      { num: 21, code: 'SOURCE',   name: '公开资料时效监控台',        hasSubmenu: false, id: 'source-mm' },
      { num: 22, code: 'MMFLOW',   name: '货币市场研究交付',          hasSubmenu: false, id: 'mmflow' },
    ],
  ];

  const handleClick = (item: any) => {
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
      className={`flex items-center gap-3 py-2 px-3 rounded transition-colors group ${
        item.id && !item.hasSubmenu ? 'cursor-pointer hover:bg-amber-900/20' : ''
      }`}
    >
      <span className="text-gray-500 text-sm w-6">{item.num})</span>
      {item.code && (
        <span className="text-amber-400 font-semibold min-w-20">{item.code}</span>
      )}
      <span className="text-gray-300 flex-1">{item.name}</span>
      {item.hasSubmenu && (
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-amber-400 transition-colors" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">佑诚功能主目录 › </span>
            <span className="text-amber-400 font-semibold">货币市场</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">{menuItems[0].map(renderMenuItem)}</div>
            <div className="space-y-1">{menuItems[1].map(renderMenuItem)}</div>
          </div>
          <div className="mt-8 pt-4 border-t border-gray-700 text-xs text-gray-500">
            <span>期货及期权</span>
            <div className="mt-2 text-gray-600">亚太地区 | 其他定价/利率</div>
          </div>
        </div>
      </div>
    </div>
  );
};
