import React from 'react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronRight, X } from 'lucide-react';

interface IndicesMenuProps {
  onClose: () => void;
}

export const IndicesMenu: React.FC<IndicesMenuProps> = ({ onClose }) => {
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
      { num: 1, code: 'SECF', name: '证券查找', hasSubmenu: false },
      { num: 2, code: 'HELP INDX', name: '指数', hasSubmenu: false },
      // WEI 的唯一入口保留在“股票”模块；指数目录不再重复展示。
      { num: 4, code: 'WEIF', name: '全球股指期货', hasSubmenu: false },
      { num: 5, code: 'WBIX', name: '全球债券指数', hasSubmenu: false },
      { num: 6, code: 'GMM', name: '全球宏观市场驱动者', hasSubmenu: false },
      { num: 7, code: '', name: '指数', hasSubmenu: false },
      { num: 8, code: 'IN', name: '指数浏览器', hasSubmenu: false },
      { num: 9, code: 'INP', name: '指数出版物', hasSubmenu: false },
      { num: 10, code: 'CIX', name: '自设指数库', hasSubmenu: false },
      { num: 11, code: 'CIXB', name: '自设篮子编辑器', hasSubmenu: false },
      { num: 12, code: 'AGG', name: '自设合并', hasSubmenu: false },
    ],
    // 右列
    [
      { num: 13, code: '', name: '分析 FDFD Index', hasSubmenu: false },
      { num: 14, code: '', name: '其他指数', hasSubmenu: false },
      { num: 15, code: 'RRG', name: '相对旋转图', hasSubmenu: false },
      { num: 16, code: 'WT', name: 'WTR行情显示', hasSubmenu: false },
      { num: 17, code: '', name: '指数衍生品', hasSubmenu: false },
      { num: 18, code: 'CIXN', name: '自设表达式编辑器', hasSubmenu: false },
      { num: 19, code: 'CIXS', name: '自设利差编辑器', hasSubmenu: false },
      { num: 20, code: 'CIXR', name: '自设比率编辑器', hasSubmenu: false },
      { num: 21, code: 'CIXC', name: '自设转换编辑器', hasSubmenu: false },
      { num: 22, code: 'CIXX', name: '本地数据-使用Excel', hasSubmenu: false },
      { num: 23, code: 'CIXI', name: '自设时间序列编辑器', hasSubmenu: false },
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
            <span className="text-amber-400 font-semibold">指数</span>
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
              <div className="text-xs text-gray-400 mb-3 font-semibold">指数与功能说明</div>
              {menuItems[0].slice(0, 2).map(renderMenuItem)}
              
              <div className="text-xs text-gray-400 mb-3 mt-4 font-semibold">当前市场/行情</div>
              {menuItems[0].slice(2, 12).map(renderMenuItem)}
            </div>

            {/* Right Column */}
            <div className="space-y-1">
              <div className="text-xs text-gray-400 mb-3 font-semibold">多重指数分析</div>
              {menuItems[1].slice(0, 4).map(renderMenuItem)}
              
              <div className="text-xs text-gray-400 mb-3 mt-4 font-semibold">更多自设指数</div>
              {menuItems[1].slice(4).map(renderMenuItem)}
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 pt-4 border-t border-gray-700 text-xs text-gray-500">
            <span>创建自设指数 | 指数 | 多重指数分析 | 指数衍生品 | 更多自设指数</span>
          </div>
        </div>
      </div>
    </div>
  );
};
