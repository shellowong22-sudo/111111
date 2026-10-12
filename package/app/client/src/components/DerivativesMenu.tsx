import React from 'react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronRight, X } from 'lucide-react';

interface DerivativesMenuProps {
  onClose: () => void;
}

export const DerivativesMenu: React.FC<DerivativesMenuProps> = ({ onClose }) => {
  const [, setLocation] = useLocation();
  
  const handleItemClick = (item: any) => {
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
      { num: 1, code: '', name: '利率、通胀衍生证券与结构债', hasSubmenu: true },
      { num: 2, code: 'SWPM', name: '掉期管理', hasSubmenu: false },
      { num: 3, code: 'WBF', name: '全球债券期货', hasSubmenu: false },
      { num: 4, code: '', name: '信用衍生产品', hasSubmenu: true },
      { num: 5, code: 'CDSW', name: 'CDS 估值', hasSubmenu: false },
      { num: 6, code: 'WCDS', name: '全球CDS行情显示', hasSubmenu: false },
      { num: 7, code: '', name: '股票衍生品', hasSubmenu: true },
      { num: 8, code: 'OVME', name: '股票/利率期权定价', hasSubmenu: false },
      { num: 9, code: 'MOSO', name: '交易最活跃期权', hasSubmenu: false },
      { num: 10, code: '', name: '股指衍生品', hasSubmenu: true },
      { num: 11, code: '', name: '外汇衍生品', hasSubmenu: true },
      { num: 12, code: 'OVML', name: '外汇/商品期权定价与估值', hasSubmenu: false },
      { num: 13, code: 'WVOL', name: '外汇隐含波动率矩阵', hasSubmenu: false },
      { num: 14, code: '', name: '文件与资料', hasSubmenu: true },
    ],
    // 右列
    [
      { num: 15, code: '', name: '商品衍生品', hasSubmenu: true },
      { num: 16, code: '', name: '可转换债券', hasSubmenu: true },
      { num: 17, code: 'OVCV', name: '可转换债券估价', hasSubmenu: false },
      { num: 18, code: 'DLIB', name: '衍生品库', hasSubmenu: false },
      { num: 19, code: 'VCA', name: '波动率与相关系数分析', hasSubmenu: false },
      { num: 20, code: '', name: '定价与风险解决方案', hasSubmenu: true },
      { num: 21, code: 'MARS', name: '多资产风险系统', hasSubmenu: false },
      { num: 21.5, code: 'BICO', name: '佑诚行业研究概况', hasSubmenu: false },
      { num: 22, code: 'NI DRV', name: '新闻：衍生品', hasSubmenu: false },
      { num: 23, code: 'NI BMRDRV', name: '新闻：衍生品研究', hasSubmenu: false },
      { num: 24, code: 'DERI', name: 'FinMind 期货', hasSubmenu: false },
      { num: 26, code: 'FOM', name: '期货与期权行情监控 ★AI', hasSubmenu: false },
      { num: 27, code: 'WBF-AI', name: 'WBF全球债券期货AI增强 ★', hasSubmenu: false },
      { num: 28, code: 'CREDIT-MONITOR', name: '信用监控综合面板 ★AI', hasSubmenu: false },
      { num: 29, code: 'NCEO', name: '佑诚期权', hasSubmenu: false },
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
            <span className="text-amber-400 font-semibold">衍生品与结构债券</span>
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
            <span>衍生品类型 | 利率衍生品 | 信用衍生品 | 股票衍生品 | 商品衍生品 | 外汇衍生品 | 可转换债券 | 定价与风险</span>
          </div>
        </div>
      </div>
    </div>
  );
};
