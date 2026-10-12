import React from 'react';
import { ChevronRight, X } from 'lucide-react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

interface CommoditiesMenuProps {
  onClose: () => void;
}

export const CommoditiesMenu: React.FC<CommoditiesMenuProps> = ({ onClose }) => {
  const [, setLocation] = useLocation();
  
  // 本菜单中两个代码在通用代码表里没有可用的商品功能：
  // DES（分析 CLA Comdty 下的证券简介）打开商品终端的交易所合约规格面板；
  // TOP CMD（商品要闻）打开新闻与研究中心的要闻标签。
  const COMMODITY_ITEM_PATHS: Record<string, string> = {
    'DES': '/terminal?module=commodities&open=ctm',
    'TOP CMD': '/news-hub?tab=top',
  };
  const handleItemClick = (item: any) => {
    const dedicatedPath = item.code ? COMMODITY_ITEM_PATHS[item.code] : undefined;
    if (dedicatedPath) {
      handleMenuItemClick(item.code, item.name, () => {
        onClose();
        setLocation(dedicatedPath);
      });
      return;
    }
    if (item.code) {
      handleMenuItemClick(item.code, item.name, (path) => {
        onClose();
        setLocation(path);
      });
    } else {
      handleMenuItemClick(item.name, item.name, (path) => {
        onClose();
        setLocation(path);
      });
    }
  };
  const menuItems = [
    // 左列
    [
      { num: 1, code: '', name: '数据、设定与功能说明', hasSubmenu: false },
      { num: 2, code: 'COMM', name: '商品目录', hasSubmenu: false },
      { num: 4, code: 'MAP', name: '自设地图', hasSubmenu: false },
      { num: 5, code: 'SPOT', name: '商品现货价格', hasSubmenu: false },
      { num: 6, code: 'CTM', name: '交易所合约', hasSubmenu: false },
      { num: 7, code: '', name: '商品市场概览', hasSubmenu: false },
      { num: 8, code: 'GLCO', name: '全球商品价格', hasSubmenu: false },
      { num: 9, code: 'CPLY', name: '商品操作簿', hasSubmenu: false },
      { num: 10, code: 'COSY', name: '商品分析', hasSubmenu: false },
      { num: 11, code: '', name: '商品电子交易', hasSubmenu: false },
      { num: 12, code: 'CFTC', name: 'CFTC 全球期货持仓周报', hasSubmenu: false },
      { num: 13, code: '', name: '新闻与研究报告', hasSubmenu: false },
      { num: 14, code: 'TOP CMD', name: '商品要闻', hasSubmenu: false },
    ],
    // 右列
    [
      { num: 15, code: '', name: '分析 CLA Comdty', hasSubmenu: false },
      { num: 16, code: 'DES', name: '证券简介', hasSubmenu: false },
      { num: 17, code: 'GP', name: '线段图', hasSubmenu: false },
      { num: 18, code: 'SEAG', name: '季节性图', hasSubmenu: false },
      { num: 19, code: 'CCRV', name: '商品曲线', hasSubmenu: false },
      { num: 20, code: 'CMRV', name: 'Commodities Relative Price', hasSubmenu: false },
      { num: 21, code: 'OILS', name: '石油冲击（WTI 持仓结构）', hasSubmenu: false },
      { num: 30, code: '', name: '天气', hasSubmenu: false },
      { num: 31, code: '', name: '商品投资者', hasSubmenu: false },
    ],
  ];

  const renderMenuItem = (item: any) => (
    <div
      key={`${item.num}-${item.code}`}
      {...(item.code ? { onClick: () => handleItemClick(item) } : {})}
      className={`flex items-center gap-3 py-2 px-3 rounded transition-colors group ${
        item.code
          ? "cursor-pointer hover:bg-amber-900/20"
          : "border-y border-gray-800/70 bg-gray-950/30 text-gray-500"
      }`}
    >
      <span className="text-gray-500 text-sm w-6">{item.num})</span>
      {item.code && (
        <span className="text-amber-400 font-semibold min-w-24">{item.code}</span>
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
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">佑诚功能主目录 › </span>
            <span className="text-amber-400 font-semibold">商品市场</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-1">
              {menuItems[0].map(renderMenuItem)}
            </div>

            {/* Right Column */}
            <div className="space-y-1">
              {menuItems[1].map(renderMenuItem)}
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 pt-4 border-t border-gray-700 text-xs text-gray-500">
            <span>真实商品观察统一进入 COMM 商品目录；未接入真实能力的空槽位不再展示。</span>
          </div>
        </div>
      </div>
    </div>
  );
};
