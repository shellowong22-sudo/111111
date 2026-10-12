import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Gem } from 'lucide-react';

const METAL_TYPES = ['贵金属', '工业金属', '稀有金属', '合金'];
const METALS = [
  { code: 'GC', name: '黄金', price: 2385.50, change: 1.25, volume: '1.2M', unit: 'oz' },
  { code: 'SI', name: '白银', price: 28.45, change: 2.85, volume: '0.8M', unit: 'oz' },
  { code: 'PL', name: '铂金', price: 945.30, change: -0.95, volume: '0.2M', unit: 'oz' },
  { code: 'PA', name: '钯金', price: 1025.80, change: 3.45, volume: '0.15M', unit: 'oz' },
  { code: 'CU', name: '铜', price: 4.25, change: 1.65, volume: '2.5M', unit: 'lb' },
];

export default function PreciousMetals() {
  const [selectedType, setSelectedType] = useState('贵金属');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">贵金属市场</h1>
          <p className="text-slate-400">全球贵金属与工业金属行情</p>
        </div>

        {/* 金属类型选择 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <label className="text-sm font-medium text-slate-300 mb-3 block">选择金属类型</label>
          <div className="flex gap-2 flex-wrap">
            {METAL_TYPES.map(t => (
              <Button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-4 py-2 text-sm ${
                  selectedType === t
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-800 hover:bg-slate-700'
                } text-white`}
              >
                {t}
              </Button>
            ))}
          </div>
        </Card>

        {/* 市场统计 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">黄金价格</div>
            <div className="text-3xl font-bold text-yellow-400">$2,385</div>
            <div className="text-xs text-slate-400 mt-1">每盎司</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">日均成交</div>
            <div className="text-3xl font-bold text-green-400">4.95M</div>
            <div className="text-xs text-slate-400 mt-1">手数</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">波动率</div>
            <div className="text-3xl font-bold text-orange-400">12.3%</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">库存增长</div>
            <div className="text-3xl font-bold text-red-400">-2.1%</div>
          </Card>
        </div>

        {/* 金属行情表 */}
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gem size={20} className="text-yellow-400" />
            <h2 className="text-lg font-semibold text-slate-50">贵金属行情</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-300 font-semibold">代码</th>
                  <th className="text-left py-2 text-slate-300 font-semibold">名称</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">价格</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">涨跌</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">成交量</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">单位</th>
                </tr>
              </thead>
              <tbody>
                {METALS.map(metal => (
                  <tr key={metal.code} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 text-blue-400 font-semibold">{metal.code}</td>
                    <td className="py-3 text-slate-100">{metal.name}</td>
                    <td className="text-right text-slate-100 font-semibold">${metal.price.toFixed(2)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {metal.change > 0 ? (
                          <>
                            <TrendingUp size={16} className="text-green-400" />
                            <span className="text-green-400 font-semibold">+{metal.change.toFixed(2)}%</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={16} className="text-red-400" />
                            <span className="text-red-400 font-semibold">{metal.change.toFixed(2)}%</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="text-right text-slate-300">{metal.volume}</td>
                    <td className="text-right text-slate-400">{metal.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
