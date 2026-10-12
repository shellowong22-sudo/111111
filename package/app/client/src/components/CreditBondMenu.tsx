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

interface CreditBondMenuProps {
  onClose: () => void;
  onSelectItem: (itemId: string, itemName: string) => void;
}

export default function CreditBondMenu({ onClose, onSelectItem }: CreditBondMenuProps) {
  const [, setLocation] = useLocation();
  const menuItems: MenuItem[] = [
    { id: '1', code: '1', name: '证券与功能说明', description: '', hasSubmenu: true },
    { id: '2', code: '2', name: '当前市场', description: '', hasSubmenu: true },
    { id: '3', code: '3', ticker: 'WB', name: '全球债券市场', description: '' },
    { id: '4', code: '4', ticker: 'BTMM', name: '国债与货币市场', description: '' },
    { id: '5', code: '5', ticker: 'GCDS', name: '全球CDS图表', description: '' },
    { id: '6', code: '6', name: '收益曲线', description: '', hasSubmenu: true },
    { id: '7', code: '7', ticker: 'GC', name: '绘制曲线图', description: '' },
    { id: '8', code: '8', name: '新闻/研究报告', description: '', hasSubmenu: true },
    { id: '9', code: '9', name: '计算器与分析', description: '', hasSubmenu: true },
    { id: '10', code: '10', ticker: 'IN', name: '佑诚信债浏览器', description: '' },
    { id: '11', code: '11', ticker: 'WBIX', name: '全球债券指数', description: '' },
    { id: '12', code: '12', ticker: 'INS', name: '指数检索', description: '' },
    { id: '13', code: '13', name: '分析 IBM 7 10/30/25 Corp', description: '', hasSubmenu: true },
    { id: '14', code: '14', ticker: 'DES', name: '证券简介', description: '' },
    { id: '15', code: '15', ticker: 'YAS', name: '收益率与利差分析', description: '' },
    { id: '16', code: '16', name: '定价', description: '', hasSubmenu: true },
    { id: '17', code: '17', ticker: 'IMGR', name: '库存与价格', description: '' },
    { id: '18', code: '18', ticker: 'RUNZ', name: 'Runs管理', description: '' },
    { id: '19', code: '19', ticker: 'TACT', name: 'TRACE活动', description: '' },
    { id: '20', code: '20', name: '新发行、公司大事、评级', description: '', hasSubmenu: true },
    { id: '21', code: '21', name: '信用衍生产品', description: '', hasSubmenu: true },
    { id: '22', code: '22', name: '信用分析', description: '', hasSubmenu: true },
    { id: '23', code: '23', ticker: 'FIW', name: '固定收益工作表', description: '' },
    { id: '24', code: '24', ticker: 'CRAN', name: 'Credit Research Analysis', description: '' },
    { id: '25', code: '25', name: '贷款', description: '', hasSubmenu: true },
    { id: '26', code: '26', ticker: 'CRMX', name: 'BMS Insurance System', description: '' },
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
            <span className="text-foreground">信用债</span>
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
                  <span className="text-accent font-mono font-semibold w-12">{item.ticker}</span>
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
                  <span className="text-accent font-mono font-semibold w-12">{item.ticker}</span>
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
