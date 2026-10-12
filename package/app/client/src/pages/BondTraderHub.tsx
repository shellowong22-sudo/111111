import { useLocation } from 'wouter';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';

const BOND_TYPES = ['主权债', '公司债', '地方债', '金融债'];
const BONDS = {
  '主权债': [
    { code: 'US10Y', name: '10年美国国债', price: 98.50, change: '-0.12', volume: '5.0M', yield: '4.25%' },
    { code: 'US30Y', name: '30年美国国债', price: 96.20, change: '-0.25', volume: '3.0M', yield: '4.35%' },
    { code: 'BUND', name: '德国10年债', price: 97.40, change: '-0.10', volume: '2.0M', yield: '2.45%' },
    { code: 'GILT', name: '英国10年债', price: 96.80, change: '-0.08', volume: '1.5M', yield: '3.85%' },
  ],
  '公司债': [
    { code: 'AAPL_BD', name: '苹果公司债', price: 102.35, change: '+0.15', volume: '1.2M', yield: '3.95%' },
    { code: 'MSFT_BD', name: '微软公司债', price: 101.80, change: '+0.08', volume: '0.8M', yield: '3.85%' },
    { code: 'JPM_BD', name: 'JPMorgan公司债', price: 100.50, change: '-0.05', volume: '2.3M', yield: '4.15%' },
  ],
  '地方债': [
    { code: 'CA_BD', name: '加州地方债', price: 99.75, change: '+0.05', volume: '0.5M', yield: '3.45%' },
    { code: 'NY_BD', name: '纽约地方债', price: 100.20, change: '+0.10', volume: '0.7M', yield: '3.55%' },
  ],
  '金融债': [
    { code: 'FRB_BD', name: '联邦储备债', price: 99.90, change: '-0.02', volume: '4.5M', yield: '4.05%' },
    { code: 'IMF_BD', name: 'IMF债券', price: 100.45, change: '+0.03', volume: '0.3M', yield: '3.75%' },
  ],
};

export default function BondTraderHub() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState('主权债');
  const [expandedBond, setExpandedBond] = useState<string | null>(null);

  const bonds = BONDS[selectedType as keyof typeof BONDS] || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">债券交易员中心</h1>
          <p className="text-slate-400">主权债、公司债、地方债、金融债的实时交易数据</p>
        </div>

        {/* 控制面板 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">债券类型</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {BOND_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-100">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">期限</label>
              <Select defaultValue="10y">
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="2y" className="text-slate-100">2年</SelectItem>
                  <SelectItem value="5y" className="text-slate-100">5年</SelectItem>
                  <SelectItem value="10y" className="text-slate-100">10年</SelectItem>
                  <SelectItem value="30y" className="text-slate-100">30年</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">信用等级</label>
              <Select defaultValue="all">
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-slate-100">全部</SelectItem>
                  <SelectItem value="aaa" className="text-slate-100">AAA</SelectItem>
                  <SelectItem value="aa" className="text-slate-100">AA</SelectItem>
                  <SelectItem value="a" className="text-slate-100">A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* 市场概览 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">平均收益率</div>
            <div className="text-3xl font-bold text-blue-400">3.85%</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">总成交量</div>
            <div className="text-3xl font-bold text-green-400">22.5M</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">平均价格</div>
            <div className="text-3xl font-bold text-orange-400">99.45</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">波动率</div>
            <div className="text-3xl font-bold text-purple-400">2.3%</div>
          </Card>
        </div>

        {/* 债券列表 */}
        <Card className="bg-slate-900 border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-50 mb-4">{selectedType}交易数据</h2>
          <div className="space-y-2">
            {bonds.map((bond) => {
              const isExpanded = expandedBond === bond.code;
              const change = parseFloat(bond.change);
              const isUp = change >= 0;

              return (
                <div key={bond.code} className="border border-slate-700 rounded-lg overflow-hidden">
                  <div
                    onClick={() => setExpandedBond(isExpanded ? null : bond.code)}
                    className="bg-slate-800 hover:bg-slate-700 cursor-pointer p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="w-20">
                          <div className="text-blue-400 font-semibold text-sm">{bond.code}</div>
                          <div className="text-slate-400 text-xs">{bond.name}</div>
                        </div>
                        <div className="flex items-center gap-8 flex-1">
                          <div>
                            <div className="text-slate-400 text-xs">价格</div>
                            <div className="text-slate-100 font-semibold">{bond.price.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-xs">涨跌</div>
                            <div className={isUp ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                              {bond.change}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-xs">成交量</div>
                            <div className="text-slate-100">{bond.volume}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 text-xs">收益率</div>
                            <div className="text-orange-400 font-semibold">{bond.yield}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="bg-slate-900 p-4 border-t border-slate-700">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-slate-400 mb-1">买入价</div>
                          <div className="text-slate-100 font-semibold">{(bond.price - 0.05).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">卖出价</div>
                          <div className="text-slate-100 font-semibold">{(bond.price + 0.05).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">52周高</div>
                          <div className="text-slate-100 font-semibold">{(bond.price + 2).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">52周低</div>
                          <div className="text-slate-100 font-semibold">{(bond.price - 2).toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        {/* 买卖进入固定收益电子交易（FIT）下单界面，不在此处直接成交。 */}
                        <Button type="button" onClick={() => setLocation('/electronic-trading?panel=FIT')} className="bg-green-600 hover:bg-green-700 text-white flex-1">买入</Button>
                        <Button type="button" onClick={() => setLocation('/electronic-trading?panel=FIT')} className="bg-red-600 hover:bg-red-700 text-white flex-1">卖出</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
