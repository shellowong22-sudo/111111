import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { getMenuItemPath } from '@/lib/menuItemHandler';
import { useLocation } from 'wouter';

const MENU_CATEGORIES = [
  {
    id: 'sovereign',
    title: '利息行情显示',
    icon: '📊',
    items: [
      { code: 'WB', name: '全球债券市场' },
      { code: 'WBFX', name: '全球债券货币对' },
      { code: 'FIT', name: '固定收益产品' },
      { code: 'SOVM', name: '主权行情表' },
      { code: 'MIPR', name: '市场综合政策利率' },
    ]
  },
  {
    id: 'futures',
    title: '期货与期权行情显示',
    icon: '📈',
    items: [
      { code: 'WBF', name: '全球债券期货' },
      { code: 'WIR', name: '全球利率期货' },
    ]
  },
  {
    id: 'credit',
    title: '信用行情显示',
    icon: '💳',
    items: [
      { code: 'FICM', name: '固定收益信用信息显示' },
      { code: 'GCDS', name: '全球CDS信息表' },
      { code: 'TFLO', name: 'TRACE市场流量' },
      { code: 'COX', name: 'CDS价格行情显示' },
      { code: 'WCDS', name: '全球CDS信息显示' },
      { code: 'SOVR', name: '主权CDS行情显示' },
    ]
  },
  {
    id: 'money',
    title: '货币市场行情显示',
    icon: '💰',
    items: [
      { code: 'BTMM', name: '固定与货币市场' },
      { code: 'WCDM', name: '全球固定货币行情显示' },
      { code: 'DHMM', name: '港元固定市场行情表' },
      { code: 'SRSK', name: '主权信用风险' },
    ]
  },
  {
    id: 'professional',
    title: '专业行情显示',
    icon: '🔬',
    items: [
      { code: 'DEBT', name: '主权债所有权' },
      { code: 'WEIF', name: '固定收益行情信息显示' },
    ]
  },
  {
    id: 'country',
    title: '特定国家行情显示',
    icon: '🌍',
    items: [
      { code: 'USSM', name: '特殊市场' },
      { code: 'BCMP', name: '佑诚资本市场' },
    ]
  },
];

export default function CurveSearch() {
  const [, navigate] = useLocation();
  const archive = trpc.freeMarketData.archivedPublicDatasetsForPath.useQuery({ path: '/curve-search' }, { refetchInterval: 60_000, retry: 2 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = MENU_CATEGORIES.filter(cat =>
    cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.items.some(item =>
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const selectedCat = MENU_CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">查找曲线功能</h1>
          <p className="text-slate-400">浏览和分析全球债券、利率与信用曲线数据</p>
        </div>

        {/* 搜索栏 */}
        <div className="mb-6 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <Input
              type="text"
              placeholder="搜索菜单项或代码..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700 text-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 菜单列表 */}
          <div className="lg:col-span-2">
            <div className="space-y-3">
              {filteredCategories.map((category) => (
                <Card
                  key={category.id}
                  className={`bg-slate-900 border-slate-700 p-4 cursor-pointer transition hover:bg-slate-800 ${
                    selectedCategory === category.id ? 'border-blue-500 bg-slate-800' : ''
                  }`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <h3 className="font-semibold text-slate-50">{category.title}</h3>
                        <p className="text-sm text-slate-400">{category.items.length} 个项目</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 详情面板 */}
          <div>
            {selectedCat ? (
              <Card className="bg-slate-900 border-slate-700 sticky top-6">
                <div className="p-4 border-b border-slate-700">
                  <h2 className="text-lg font-semibold mb-1">{selectedCat.title}</h2>
                  <p className="text-sm text-slate-400">{selectedCat.items.length} 个菜单项</p>
                </div>

                <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                  {selectedCat.items.map((item) => (
                    <Button
                      key={item.code}
                      onClick={() => navigate(getMenuItemPath(item.code))}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2 px-3 hover:bg-slate-800"
                    >
                      <div className="flex-1">
                        <div className="font-mono text-blue-400 text-sm">{item.code}</div>
                        <div className="text-xs text-slate-400">{item.name}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </Button>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="bg-slate-900 border-slate-700 p-6 text-center sticky top-6">
                <p className="text-slate-500">选择一个菜单项查看详情</p>
                {archive.data?.[0] && <details className="mt-4 text-left text-xs">
                  <summary className="cursor-pointer text-cyan-300">{archive.data[0].title} · {archive.data[0].dataset.metadata.rowCount} 期</summary>
                  <div className="mt-2 max-h-96 overflow-auto"><table className="w-full"><thead><tr><th>观察期</th><th>5 年期收益率 (%)</th></tr></thead><tbody>{archive.data[0].dataset.rows.slice().reverse().map(row => <tr key={row['观察期']} className="border-t border-slate-800"><td className="py-1">{row['观察期']}</td><td>{row['5 年期收益率']}</td></tr>)}</tbody></table></div>
                </details>}
                {archive.isError && <p role="alert" className="mt-2 text-amber-300">历史读取失败，等待重试</p>}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
