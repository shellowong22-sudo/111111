/**
 * LocalBondMenu — 地方债二级菜单（Bloomberg 风格两列列表）
 * 样式与抵押债菜单一致：深色背景、两列布局、序号+青色代码+功能名称
 */
import { ChevronRight, Home, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  code: string;
  ticker?: string;
  name: string;
  description: string;
  hasSubmenu?: boolean;
}

interface LocalBondMenuProps {
  onClose: () => void;
  onSelectItem: (itemId: string, itemName: string) => void;
}

export default function LocalBondMenu({ onClose, onSelectItem }: LocalBondMenuProps) {
  const menuItems: MenuItem[] = [
    { id: '1',    code: '1',  name: '证券与功能说明',       description: '', hasSubmenu: false },
    { id: 'MSRC', code: '2',  ticker: 'MSRC',  name: '地方债检索',             description: '' },
    { id: 'SMUN', code: '3',  ticker: 'SMUN',  name: '地方债发行人检索',       description: '' },
    { id: 'AAA',  code: '4',  ticker: 'AAA',   name: 'BVAL地方债AAA曲线',      description: '' },
    { id: 'BTMM', code: '5',  ticker: 'BTMM',  name: '国债与货币市场',         description: '' },
    { id: 'PICK', code: '6',  ticker: 'PICK',  name: '地方债发行',             description: '' },
    { id: 'MBWD', code: '7',  ticker: 'MBWD',  name: '地方债买价询价',         description: '' },
    { id: 'CDRN', code: '8',  ticker: 'CDRN',  name: '商议承销日程',           description: '' },
    { id: 'CDRC', code: '9',  ticker: 'CDRC',  name: '竞价承销日程',           description: '' },
    { id: 'CDRA', code: '10', ticker: 'CDRA',  name: '地方债固定利率日历',     description: '' },
    { id: 'CNDS', code: '11', ticker: 'CNDS',  name: '短期日程',               description: '' },
    { id: 'CDRV', code: '12', ticker: 'CDRV',  name: '地方债可变利率日历',     description: '' },
    { id: 'DEAL', code: '13', ticker: 'DEAL',  name: '交易管理',               description: '' },
    { id: 'CACT', code: '14', ticker: 'CACT',  name: '公司大事检索',           description: '' },
    { id: 'MCAL', code: '15', ticker: 'MCAL',  name: '结构金融日历',           description: '' },
    { id: 'MBIX', code: '16', ticker: 'MBIX',  name: '最新地方债指数',         description: '' },
    { id: 'VRDN', code: '17', ticker: 'VRDN',  name: '佑诚7天VRDN',            description: '' },
    { id: 'BMA',  code: '18', ticker: 'BMA',   name: 'BMA地方债掉期指数',      description: '' },
    { id: 'BOOM', code: '19', ticker: 'BOOM',  name: 'BOOM VRDN库存',          description: '' },
    { id: 'MSRB', code: '20', ticker: 'MSRB',  name: 'MSRB统计数据',           description: '' },
    { id: 'SLGS', code: '21', ticker: 'SLGS',  name: 'SLGS国债和市政债利率',   description: '' },
  ];

  const leftItems = menuItems.slice(0, 11);
  const rightItems = menuItems.slice(11);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-start pt-16">
      <div className="bg-background border border-border rounded-sm w-full max-w-5xl max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-muted/20 border-b border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-mono">
            <Home className="w-4 h-4 text-accent" />
            <span className="text-accent">Finance Hub 功能目录</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">地方债</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted/20 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="p-4 grid grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-1">
            {leftItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id, item.name)}
                className={cn(
                  'w-full text-left px-2 py-1 rounded-sm text-xs transition-colors',
                  'hover:bg-muted/20 border border-transparent hover:border-accent/30',
                  'group flex items-center gap-2'
                )}
              >
                <span className="text-muted-foreground font-mono w-6">{item.code})</span>
                {item.ticker && (
                  <span className="text-accent font-mono font-semibold w-20">{item.ticker}</span>
                )}
                <span className="text-foreground flex-1">{item.name}</span>
                {item.hasSubmenu && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-accent flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Right Column */}
          <div className="space-y-1">
            {rightItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item.id, item.name)}
                className={cn(
                  'w-full text-left px-2 py-1 rounded-sm text-xs transition-colors',
                  'hover:bg-muted/20 border border-transparent hover:border-accent/30',
                  'group flex items-center gap-2'
                )}
              >
                <span className="text-muted-foreground font-mono w-6">{item.code})</span>
                {item.ticker && (
                  <span className="text-accent font-mono font-semibold w-20">{item.ticker}</span>
                )}
                <span className="text-foreground flex-1">{item.name}</span>
                {item.hasSubmenu && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-accent flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-2 bg-muted/5 text-xs text-muted-foreground font-mono">
          <span>🤖 Indicates function uses Ucheer AI technology</span>
        </div>
      </div>
    </div>
  );
}
