import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Home } from 'lucide-react';

const REGIONS = ['一线城市', '二线城市', '三线城市', '郊区'];
const PROPERTIES = [
  { code: 'SH', city: '上海', price: 65000, change: 2.15, volume: '2.5M', roi: 4.2 },
  { code: 'BJ', city: '北京', price: 72000, change: 1.85, volume: '1.8M', roi: 3.8 },
  { code: 'SZ', city: '深圳', price: 58000, change: 3.25, volume: '1.2M', roi: 4.5 },
  { code: 'GZ', city: '广州', price: 42000, change: 0.95, volume: '0.9M', roi: 3.5 },
  { code: 'CD', city: '成都', price: 18000, change: -0.65, volume: '0.5M', roi: 2.8 },
];

export default function RealEstateTrends() {
  const [selectedRegion, setSelectedRegion] = useState('一线城市');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">房地产市场</h1>
          <p className="text-slate-400">全国主要城市房价趋势与投资分析</p>
        </div>

        {/* 地区选择 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <label className="text-sm font-medium text-slate-300 mb-3 block">选择地区</label>
          <div className="flex gap-2 flex-wrap">
            {REGIONS.map(r => (
              <Button
                key={r}
                onClick={() => setSelectedRegion(r)}
                className={`px-4 py-2 text-sm ${
                  selectedRegion === r
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-800 hover:bg-slate-700'
                } text-white`}
              >
                {r}
              </Button>
            ))}
          </div>
        </Card>

        {/* 市场指标 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">平均房价</div>
            <div className="text-3xl font-bold text-blue-400">51,000</div>
            <div className="text-xs text-slate-400 mt-1">元/㎡</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">环比涨幅</div>
            <div className="text-3xl font-bold text-green-400">+1.84%</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">成交量</div>
            <div className="text-3xl font-bold text-orange-400">6.9M</div>
            <div className="text-xs text-slate-400 mt-1">㎡</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">平均 ROI</div>
            <div className="text-3xl font-bold text-green-400">3.8%</div>
          </Card>
        </div>

        {/* 城市房价表 */}
        <Card className="bg-slate-900 border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Home size={20} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-50">主要城市房价</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-300 font-semibold">城市</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">平均房价</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">环比</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">成交面积</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">投资回报</th>
                </tr>
              </thead>
              <tbody>
                {PROPERTIES.map(prop => (
                  <tr key={prop.code} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 text-blue-400 font-semibold">{prop.city}</td>
                    <td className="text-right text-slate-100 font-semibold">¥{prop.price.toLocaleString()}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {prop.change > 0 ? (
                          <>
                            <TrendingUp size={16} className="text-green-400" />
                            <span className="text-green-400 font-semibold">+{prop.change.toFixed(2)}%</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={16} className="text-red-400" />
                            <span className="text-red-400 font-semibold">{prop.change.toFixed(2)}%</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="text-right text-slate-300">{prop.volume}</td>
                    <td className="text-right text-green-400 font-semibold">{prop.roi}%</td>
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
