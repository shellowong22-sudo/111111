import { ChevronRight, Home, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MenuItem {
  id: string;
  code: string;
  ticker?: string;
  name: string;
  description: string;
  hasSubmenu?: boolean;
}

interface SovereignBondMenuProps {
  onClose: () => void;
  onSelectItem: (itemId: string, itemName: string) => void;
}

// 当前市场原有子菜单（0–27）。这些是原入口映射，不是新增面板。
const currentMarketItems: { left: MenuItem[]; right: MenuItem[] } = {
  left: [
    { id: 'cm-0', code: '0', ticker: 'SOVS', name: '全局搜索与高级筛选', description: '搜索所有AI分析模块' },
    { id: 'cm-1', code: '1', name: '利率行情显示', description: '', hasSubmenu: true },
    { id: 'cm-2', code: '2', ticker: 'WB', name: '全球债券市场', description: '' },
    { id: 'cm-3', code: '3', ticker: 'WBMV', name: '全球债券驱动者', description: '' },
    { id: 'cm-4', code: '4', ticker: 'FIT', name: '固定收益交易', description: '' },
    { id: 'cm-5', code: '5', ticker: 'SOVM', name: '主权债行情表', description: '' },
    { id: 'cm-6', code: '6', ticker: 'MIPR', name: '市场隐含政策利率', description: '' },
    { id: 'cm-7', code: '7', name: '期货与期权行情显示', description: '', hasSubmenu: true },
    { id: 'cm-8', code: '8', ticker: 'WBF', name: '全球债券期货', description: '' },
    { id: 'cm-9', code: '9', ticker: 'WIR', name: '全球利率期货', description: '' },
    { id: 'cm-10', code: '10', name: '信用行情显示', description: '', hasSubmenu: true },
    { id: 'cm-11', code: '11', ticker: 'FICM', name: '固定收益信用行情显示', description: '' },
    { id: 'cm-12', code: '12', ticker: 'GCDS', name: '全球CDS图表', description: '' },
    { id: 'cm-13', code: '13', ticker: 'TFLO', name: 'TRACE市场流量', description: '' },
    { id: 'cm-14', code: '14', ticker: 'CDX', name: 'CDS指数行情显示', description: '' },
    { id: 'cm-15', code: '15', ticker: 'WCDS', name: '全球CDS行情显示', description: '' },
    { id: 'cm-16', code: '16', ticker: 'SOVR', name: '主权债CDS行情显示', description: '' },
  ],
  right: [
    { id: 'cm-header-cross', code: '', name: '跨市场行情显示', description: '', hasSubmenu: false },
    { id: 'cm-17', code: '17', ticker: 'BTMM', name: '国债与货币市场', description: '' },
    { id: 'cm-18', code: '18', ticker: 'WCDM', name: '全球各国债务行情显示', description: '' },
    { id: 'cm-19', code: '19', ticker: 'DMMV', name: '发达国家市场行情表', description: '' },
    { id: 'cm-20', code: '20', ticker: 'SRSK', name: '主权债信用风险', description: '' },
    { id: 'cm-sep1', code: '', name: '', description: '' },
    { id: 'cm-21', code: '21', name: '利率掉期行情显示', description: '', hasSubmenu: true },
    { id: 'cm-22', code: '22', ticker: 'USSW', name: '掉期市场', description: '' },
    { id: 'cm-23', code: '23', ticker: 'BCMP', name: '佑诚资本市场', description: '' },
    { id: 'cm-sep2', code: '', name: '', description: '' },
    { id: 'cm-24', code: '24', name: '专家行情显示', description: '', hasSubmenu: true },
    { id: 'cm-25', code: '25', ticker: 'DEBT', name: '主权债所有权', description: '' },
    { id: 'cm-26', code: '26', ticker: 'WETF', name: '固定收益ETF行情显示', description: '' },
    { id: 'cm-sep3', code: '', name: '', description: '' },
    { id: 'cm-27', code: '27', name: '特定国家行情显示', description: '', hasSubmenu: true },
  ],
};

// 主菜单（原有 24 个入口）
const mainMenuItems: MenuItem[] = [
  { id: '1', code: '1', name: '证券、设定与功能说明', description: '', hasSubmenu: true },
  { id: '2', code: '2', ticker: 'SECF', name: '证券查找', description: '' },
  { id: '3', code: '3', name: '当前市场', description: '', hasSubmenu: true },
  { id: '4', code: '4', ticker: 'WB', name: '全球债券市场', description: '' },
  { id: '5', code: '5', ticker: 'FIT', name: '固定收益交易', description: '' },
  { id: '6', code: '6', ticker: 'BTMM', name: '国债与货币市场', description: '' },
  { id: '7', code: '7', ticker: 'GCDS', name: '全球CDS图表', description: '' },
  { id: '8', code: '8', ticker: 'COUN', name: '国家指南', description: '' },
  { id: '9', code: '9', ticker: 'MIPR', name: '市场隐含政策利率', description: '' },
  { id: '10', code: '10', ticker: 'DEBT', name: '主权债所有权', description: '' },
  { id: '11', code: '11', ticker: 'SRSK', name: '主权债信用风险', description: '' },
  { id: '12', code: '12', ticker: 'GMM', name: '全球宏观市场驱动者', description: '' },
  { id: '13', code: '13', name: '收益曲线', description: '', hasSubmenu: true },
  { id: '14', code: '14', ticker: 'GC', name: '绘制曲线图', description: '' },
  { id: '15', code: '15', name: '分析 CT10 Govt', description: '', hasSubmenu: true },
  { id: '16', code: '16', ticker: 'DES', name: '证券简介', description: '' },
  { id: '17', code: '17', ticker: 'YAS', name: '收益率与利差分析', description: '' },
  { id: '18', code: '18', ticker: 'TOP BON', name: '债券新闻', description: '' },
  { id: '19', code: '19', name: '计算器与分析', description: '', hasSubmenu: true },
  { id: '20', code: '20', name: '定价', description: '', hasSubmenu: true },
  { id: '21', code: '21', ticker: 'IMGR', name: '库存与价格', description: '' },
  { id: '22', code: '22', ticker: 'RUNZ', name: 'Runs管理', description: '' },
  { id: '23', code: '23', name: '新发行、公司大事、评级', description: '', hasSubmenu: true },
  { id: '24', code: '24', name: 'IR与通胀衍生产品及SN', description: '', hasSubmenu: true },
];

function MenuItemRow({ item, onClick, nonInteractive = false }: { item: MenuItem; onClick: () => void; nonInteractive?: boolean }) {
  if (!item.code && !item.name) return <div className="h-3" />;
  if (!item.code && item.name) {
    return <div className="px-2 py-1 text-xs text-muted-foreground font-mono mt-2 mb-1">{item.name}</div>;
  }
  if (nonInteractive) {
    return (
      <div className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground" aria-label={`${item.code})${item.name}分组`}>
        <span className="w-6 font-mono">{item.code})</span>
        <span className="flex-1 min-w-0"><span className="block">{item.name}</span></span>
        <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/70" />
      </div>
    );
  }
  return (
    <button onClick={onClick} className={cn('w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors', 'hover:bg-muted/20 border border-transparent hover:border-accent/30', 'group flex items-center gap-2')}>
      <span className="text-muted-foreground font-mono w-6">{item.code})</span>
      {item.ticker && <span className="text-accent font-mono font-semibold w-14">{item.ticker}</span>}
      <span className={cn('flex-1 min-w-0', !item.ticker && 'ml-0')}><span className="block">{item.name}</span></span>
      {item.hasSubmenu && <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-accent flex-shrink-0" />}
    </button>
  );
}

export default function SovereignBondMenu({ onClose, onSelectItem }: SovereignBondMenuProps) {
  const [view, setView] = useState<'main' | 'currentMarket'>('main');

  const handleMainItemClick = (item: MenuItem) => {
    if (item.id === '3') {
      setView('currentMarket');
      return;
    }
    onSelectItem(item.id, item.name);
    onClose();
  };

  const handleCurrentMarketItemClick = (item: MenuItem) => {
    if (!item.code) return;
    const idMap: Record<string, string> = {
      'cm-0': 'search', 'cm-1': 'grm', 'cm-2': '4', 'cm-3': 'wbmv', 'cm-4': '5', 'cm-5': 'sovm', 'cm-6': '9',
      'cm-7': 'fom-current', 'cm-8': 'wbf', 'cm-9': 'wir', 'cm-10': 'credit-current', 'cm-11': 'ficm', 'cm-12': '7', 'cm-13': 'tflo',
      'cm-14': 'cdx', 'cm-15': 'wcds', 'cm-16': 'sovr', 'cm-17': '6', 'cm-18': 'wcdm', 'cm-19': 'dmmv', 'cm-20': '11',
      'cm-21': 'irs', 'cm-22': 'ussw', 'cm-23': 'bcmp', 'cm-24': 'expert', 'cm-25': '10', 'cm-26': 'wetf', 'cm-27': 'country',
    };
    const mappedId = idMap[item.id] || item.id;
    onSelectItem(mappedId, item.name);
    onClose();
  };

  const leftItems = mainMenuItems.slice(0, 12);
  const rightItems = mainMenuItems.slice(12);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-start pt-16">
      <div className="bg-background border border-border rounded-sm w-full max-w-5xl max-h-[85vh] overflow-auto">
        <div className="sticky top-0 bg-muted/20 border-b border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm font-mono flex-wrap">
            <Home className="w-4 h-4 text-accent" />
            <span className="text-accent cursor-pointer hover:underline" onClick={() => setView('main')}>Finance Hub 功能目录</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className={cn('cursor-pointer hover:underline', view === 'main' ? 'text-foreground' : 'text-accent')} onClick={() => setView('main')}>主权债</span>
            {view === 'currentMarket' && <><ChevronRight className="w-4 h-4 text-muted-foreground" /><span className="text-foreground font-bold">当前市场</span></>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted/20 rounded transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {view === 'main' ? (
          <div className="p-4 grid grid-cols-2 gap-8">
            <div className="space-y-1">{leftItems.map(item => <MenuItemRow key={item.id} item={item} onClick={() => handleMainItemClick(item)} />)}</div>
            <div className="space-y-1">{rightItems.map(item => <MenuItemRow key={item.id} item={item} onClick={() => handleMainItemClick(item)} />)}</div>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 gap-8">
            <div className="space-y-1">{currentMarketItems.left.map(item => <MenuItemRow key={item.id} item={item} onClick={() => handleCurrentMarketItemClick(item)} />)}</div>
            <div className="space-y-1">{currentMarketItems.right.map(item => <MenuItemRow key={item.id} item={item} onClick={() => handleCurrentMarketItemClick(item)} />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
