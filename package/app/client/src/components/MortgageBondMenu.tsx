import { ChevronRight, Home, X } from 'lucide-react';
import { handleMenuItemClick } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  code: string;
  ticker?: string;
  name: string;
  description: string;
  hasSubmenu?: boolean;
}

interface MortgageBondMenuProps {
  onClose: () => void;
  onSelectItem: (itemId: string, itemName: string) => void;
}

export default function MortgageBondMenu({ onClose, onSelectItem }: MortgageBondMenuProps) {
  const [, setLocation] = useLocation();
  const menuItems: MenuItem[] = [
    { id: '1', code: '1', name: '证券与功能说明', description: '', hasSubmenu: false },
    { id: '2', code: '2', ticker: 'SECF', name: '证券查找', description: '' },
    { id: '3', code: '3', ticker: 'MTGS', name: '抵押债检索', description: '' },
    { id: '4', code: '4', ticker: 'MTGH', name: '抵押债功能说明屏幕', description: '' },
    { id: '5', code: '5', name: '新发行及发售', description: '', hasSubmenu: false },
    { id: '6', code: '6', ticker: 'MCAL', name: '结构金融日历', description: '' },
    { id: '7', code: '7', ticker: 'IMGR', name: '库存与价格', description: '' },
    { id: '8', code: '8', ticker: 'STSH', name: 'Structuring Shell Tool', description: '' },
    { id: '9', code: '9', name: '当前市场', description: '', hasSubmenu: false },
    { id: '10', code: '10', ticker: 'TBPF', name: 'TBA表现行情显示', description: '' },
    { id: '11', code: '11', name: '评级及抵押品趋势', description: '', hasSubmenu: false },
    { id: '12', code: '12', ticker: 'BMMI', name: 'BBG Mortgage Market Insight', description: '' },
    { id: '13', code: '13', name: '新闻与研究报告', description: '', hasSubmenu: false },
    { id: '14', code: '14', ticker: 'FIRS', name: '佑诚率先报道', description: '' },
    { id: '15', code: '15', ticker: 'NI', name: '结构融资管道', description: '' },
    { id: '16', code: '16', name: '分析 GN 455993 Mtge', description: '', hasSubmenu: false },
    { id: '17', code: '17', ticker: 'DES', name: '证券简介', description: '' },
    { id: '18', code: '18', ticker: 'YT', name: '收益率表', description: '' },
    { id: '19', code: '19', ticker: 'FIBC', name: '债券计算器', description: '' },
    { id: '20', code: '20', ticker: 'Q', name: '市场报价', description: '' },
    { id: '21', code: '21', ticker: 'CMAP', name: 'CMBS地图', description: '' },
    { id: '22', code: '22', name: '抵押债指数', description: '', hasSubmenu: false },
    { id: '23', code: '23', ticker: 'TBPF MCCN', name: 'TBA表现实时监测：当前票息、成交量、价格', description: '' },
    { id: '24', code: '24', name: '资产类别', description: '', hasSubmenu: false },
    { id: '25', code: '25', name: '美国民用及商用', description: '', hasSubmenu: false },
    { id: '26', code: '26', name: '抵押债成交量与表现', description: '', hasSubmenu: false },
  ];

  // Split items into left and right columns
  const leftItems = menuItems.slice(0, 13);
  const rightItems = menuItems.slice(13);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-start pt-16">
      <div className="bg-background border border-border rounded-sm w-full max-w-5xl max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-muted/20 border-b border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-mono">
            <Home className="w-4 h-4 text-accent" />
            <span className="text-accent">Finance Hub 功能目录</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">抵押债</span>
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
