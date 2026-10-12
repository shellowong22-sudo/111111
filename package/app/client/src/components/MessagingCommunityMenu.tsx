import React from 'react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { ChevronRight, X } from 'lucide-react';

interface MessagingCommunityMenuProps {
  onClose: () => void;
}

export const MessagingCommunityMenu: React.FC<MessagingCommunityMenuProps> = ({ onClose }) => {
  const [, setLocation] = useLocation();
  
  // 通讯菜单的 SPDL 是“联系人”。通用代码表里 SPDL 指向 STP 的交易支持目录，
  // 而通讯组件里的 SPDLPanel 实际是央行讲话追踪；终端中真正的联系人目录是
  // PEOPPanel（“PEOP 联系人”），因此本菜单的“联系人”打开它。
  const COMMS_ITEM_PATHS: Record<string, string> = {
    'SPDL': '/menu-item/PEOP',
    // SPDI（导入联系人）同理进入联系人目录，在其中使用“添加”录入联系人。
    'SPDI': '/menu-item/PEOP',
  };
  const handleItemClick = (item: any) => {
    const dedicatedPath = item.code ? COMMS_ITEM_PATHS[item.code] : undefined;
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
      { num: 1, code: 'MSG', name: '邮件', hasSubmenu: false },
      { num: 2, code: 'SPDL', name: '联系人', hasSubmenu: false },
      { num: 3, code: 'MSGS', name: '邮件：检索', hasSubmenu: false },
      { num: 4, code: 'MSG 4', name: '邮件：已发送', hasSubmenu: false },
      { num: 5, code: 'MSG 10', name: '邮件: 已删除', hasSubmenu: false },
      { num: 6, code: 'SMSG', name: '共享邮件收件箱', hasSubmenu: false },
      { num: 7, code: 'MSGN', name: '灵活屏邮件', hasSubmenu: false },
      { num: 8, code: 'MSGE', name: '邮件：撰写', hasSubmenu: false },
      { num: 9, code: 'MSGA', name: '邮件：撰写', hasSubmenu: false },
      { num: 10, code: 'DRAF', name: '邮件：草稿', hasSubmenu: false },
      { num: 11, code: 'MSG 8', name: '邮件：延迟', hasSubmenu: false },
      { num: 12, code: 'IB', name: '佑诚即时短信', hasSubmenu: false },
      { num: 13, code: 'IBSR', name: 'IB 聊天检索', hasSubmenu: false },
      { num: 14, code: 'IBB', name: 'IB 群发', hasSubmenu: false },
      { num: 15, code: 'IBS', name: 'IB证券', hasSubmenu: false },
      { num: 16, code: 'IBME', name: 'IB提及', hasSubmenu: false },
    ],
    // 右列
    [
      { num: 17, code: '', name: '佑诚邮件保管与监管', hasSubmenu: false },
      { num: 18, code: 'FILE', name: '文件管理器', hasSubmenu: false },
      { num: 19, code: 'MGU', name: '邮件：设定', hasSubmenu: false },
      { num: 20, code: 'MRUL', name: '邮件：规则', hasSubmenu: false },
      { num: 21, code: 'SMGM', name: '共享邮件管理器', hasSubmenu: false },
      { num: 22, code: 'SPDI', name: '导入联系人', hasSubmenu: false },
      { num: 23, code: 'VACN', name: '邮件：外出期间自动回复', hasSubmenu: false },
      { num: 24, code: '', name: '社区', hasSubmenu: false },
      { num: 25, code: 'SHAR', name: '个人及共享笔记', hasSubmenu: false },
      { num: 26, code: 'NOTE', name: '附注', hasSubmenu: false },
      { num: 27, code: 'CMTY', name: '社区管理员', hasSubmenu: false },
      { num: 28, code: 'BIO', name: '人物简介', hasSubmenu: false },
      { num: 29, code: 'PEOP', name: '人物检索', hasSubmenu: false },
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
            <span className="text-amber-400 font-semibold">通讯与社区</span>
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
            <span>邮件系统 | 佑诚即时短信 | 邮件工具 | 社区管理 | 人物检索</span>
          </div>
        </div>
      </div>
    </div>
  );
};
