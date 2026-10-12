import React from 'react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronRight, X } from 'lucide-react';

interface EconomicsMenuProps {
  onClose: () => void;
}

export const EconomicsMenu: React.FC<EconomicsMenuProps> = ({ onClose }) => {
  const [, setLocation] = useLocation();
  
  const handleItemClick = (item: any) => {
    // BECO exists in both menus; this menu owns the economic workspace.
    if (item.code === 'BECO') {
      onClose();
      setLocation('/econ-hub?tab=beco');
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
      { num: 1, code: '', name: '经济数据', hasSubmenu: false },
      { num: 2, code: 'ECST', name: '世界经济统计数据', hasSubmenu: false },
      { num: 3, code: 'ECO', name: '经济日历', hasSubmenu: false },
      { num: 4, code: 'ECTR', name: '贸易流量', hasSubmenu: false },
      { num: 5, code: 'WFII', name: '外国投资组合投资', hasSubmenu: false },
      { num: 6, code: 'ECWB', name: '经济工作台', hasSubmenu: false },
      { num: 7, code: 'RSAN', name: '俄乌战争', hasSubmenu: false },
      { num: 8, code: 'ECOB', name: 'Economic Key Indicators', hasSubmenu: false },
      { num: 9, code: '', name: '分析与预测', hasSubmenu: false },
      { num: 10, code: 'ECFC', name: '经济预测', hasSubmenu: false },
      { num: 11, code: 'SHOK', name: 'BE预测模型', hasSubmenu: false },
      { num: 12, code: 'WIRP', name: '利率概率', hasSubmenu: false },
      { num: 13, code: 'FCON', name: '财务状况', hasSubmenu: false },
      { num: 14, code: 'ECSU', name: '经济意外', hasSubmenu: false },
      { num: 15, code: 'TAYL', name: '泰勒规则模型', hasSubmenu: false },
      { num: 16, code: 'ECAN', name: '世界经济分析工具', hasSubmenu: false },
      { num: 17, code: 'MOSP', name: 'Most Active Predict Markets', hasSubmenu: false },
    ],
    // 右列
    [
      { num: 18, code: '', name: '分析 USURTOT Index', hasSubmenu: false },
      { num: 19, code: '', name: '央行信息', hasSubmenu: false },
      { num: 20, code: 'CENB', name: '央行查找', hasSubmenu: false },
      { num: 21, code: 'CBRT', name: '央行利率分析', hasSubmenu: false },
      { num: 22, code: 'FOMC', name: '美联邦公开市场操作', hasSubmenu: false },
      { num: 23, code: 'FOMS', name: 'FOMC 声明', hasSubmenu: false },
      { num: 24, code: 'FDSP', name: '佑诚经济联储分析仪', hasSubmenu: false },
      { num: 25, code: 'BE', name: '经济新闻与分析', hasSubmenu: false },
      { num: 26, code: 'BECO', name: '佑诚经济', hasSubmenu: false },
      { num: 27, code: 'BIE', name: 'Ucheer Eco Country Primers', hasSubmenu: false },
      { num: 28, code: 'PMI', name: '标普全球PMI', hasSubmenu: false },
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
            <span className="text-amber-400 font-semibold">经济数据及分析</span>
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
            <span>经济数据 | 分析预测 | 央行信息 | 新闻研究 | 资料中心</span>
          </div>
        </div>
      </div>
    </div>
  );
};
