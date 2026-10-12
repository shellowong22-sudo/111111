import React from 'react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronRight, X } from 'lucide-react';

interface NewsResearchMenuProps {
  onClose: () => void;
}

export const NewsResearchMenu: React.FC<NewsResearchMenuProps> = ({ onClose }) => {
  const [, setLocation] = useLocation();
  
  const handleItemClick = (item: any) => {
    // These seven entries are native News Hub tabs. Keep their visible
    // Bloomberg-style codes in this menu, but route directly to the existing
    // tab so they cannot fall through to a generic /menu-item/:id page (DOCS
    // also exists in the communications namespace).
    if (item.path) {
      onClose();
      setLocation(item.path);
      toast.success(`已打开 ${item.name}`, {
        description: '已进入新闻与研究中心对应功能',
        duration: 2000,
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
      { num: 1, code: 'TOP', path: '/news-hub?tab=top', name: '要闻精选', hasSubmenu: false },
      { num: 2, code: 'BTDY', path: '/news-hub?tab=btdy', name: 'Ucheer Today', hasSubmenu: false },
      { num: 3, code: 'FRNT', path: '/news-hub?tab=frnt', name: '首页', hasSubmenu: false },
      { num: 4, code: 'CN', path: '/news-hub?tab=cn', name: '公司新闻', hasSubmenu: false },
      { num: 5, code: 'READ', path: '/news-hub?tab=read', name: '最热门报道', hasSubmenu: false },
      { num: 6, code: 'NI', path: '/news-hub?tab=ni', name: '新闻主题', hasSubmenu: false },
      { num: 7, code: 'NH', path: '/news-hub?tab=nh', name: '滚动新闻', hasSubmenu: false },
      { num: 8, code: 'FIRS', path: '/news-hub?tab=firs', name: '佑诚率先报道', hasSubmenu: false },
      { num: 9, code: 'BI', path: '/news-hub?tab=bi', name: '佑诚行业研究', hasSubmenu: false },
      { num: 10, code: 'DAYB', path: '/news-hub?tab=dayb', name: '佑诚早间新闻', hasSubmenu: false },
      { num: 11, code: 'MAG', path: '/news-hub?tab=mag', name: '佑诚杂志', hasSubmenu: false },
      { num: 12, code: 'MDIA', path: '/news-hub?tab=mdia', name: '多媒体', hasSubmenu: false },
      { num: 13, code: 'MEDI', path: '/news-hub?tab=medi', name: '佑诚媒体', hasSubmenu: false },
      { num: 14, code: '3RD', path: '/news-hub?tab=3rd', name: '第三方优质新闻', hasSubmenu: false },
    ],
    // 右列
    [
      { num: 15, code: 'INTL', path: '/news-hub?tab=intl', name: '非英语新闻', hasSubmenu: false },
      { num: 16, code: 'CMNT', path: '/news-hub?tab=cmnt', name: '评论与分析', hasSubmenu: false },
      { num: 17, code: 'OPIN', path: '/news-hub?tab=opin', name: '佑诚观点', hasSubmenu: false },
      { num: 18, code: 'BNEF', path: '/news-hub?tab=bnef', name: '佑诚新能源财经研究报告', hasSubmenu: false },
      { num: 19, code: 'PERS', path: '/news-hub?tab=pers', name: '个性化新闻', hasSubmenu: false },
      { num: 20, code: 'MYN', path: '/news-hub?tab=myn', name: '我的新闻', hasSubmenu: false },
      { num: 21, code: 'NLRT', path: '/news-hub?tab=nlrt', name: '新闻检索与提醒', hasSubmenu: false },
      { num: 22, code: 'NSUB', path: '/news-hub?tab=nsub', name: '新闻订阅', hasSubmenu: false },
      { num: 23, code: 'MREP', path: '/news-hub?tab=mrep', name: 'Morning Report', hasSubmenu: false },
      { num: 24, code: 'NZPD', path: '/news-hub?tab=nzpd', name: '新闻设定', hasSubmenu: false },
      { num: 25, code: 'SOCL', path: '/news-hub?tab=socl', name: '社交媒体与分析', hasSubmenu: false },
      { num: 26, code: 'SOCI', path: '/news-hub?tab=soci', name: '社交监测', hasSubmenu: false },
      { num: 27, code: 'TREN', path: '/news-hub?tab=tren', name: '新闻趋势', hasSubmenu: false },
      { num: 28, code: 'DOCS', path: '/news-hub?tab=docs', name: '文件与资料', hasSubmenu: false },
    ],
  ];

  const renderMenuItem = (item: any) => (
    <div
      key={`${item.num}-${item.code}`}
      {...(item.code || item.path ? { onClick: () => handleItemClick(item) } : {})}
      className={`flex items-center gap-3 py-2 px-3 rounded transition-colors group ${
        item.code || item.path
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
      <div className="border border-[#1d3047] w-full max-w-5xl max-h-[90vh] overflow-auto" style={{ background: "#060b12" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1d3047] px-6 py-4" style={{ background: "#0a1420" }}>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">佑诚功能主目录 › </span>
            <span className="text-amber-400 font-semibold">新闻与研究报告</span>
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
            <span>新闻主目录 | 佑诚来源 | 多媒体 | 第三方新闻 | 评论分析 | 个性化新闻 | 社交媒体</span>
          </div>
        </div>
      </div>
    </div>
  );
};
