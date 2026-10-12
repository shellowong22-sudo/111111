import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp } from 'lucide-react';

const BOND_TYPES = ['国债', '企业债', '可转债', '高收益债', '地方债'];
const BONDS = [
  { name: '10年国债', yield: 2.85, duration: 8.2, rating: 'AAA', spread: 0 },
  { name: '5年国债', yield: 2.45, duration: 4.8, rating: 'AAA', spread: 0 },
  { name: 'AAA企业债', yield: 3.20, duration: 5.5, rating: 'AAA', spread: 35 },
  { name: 'AA企业债', yield: 3.85, duration: 6.2, rating: 'AA', spread: 100 },
  { name: 'A企业债', yield: 4.50, duration: 6.8, rating: 'A', spread: 165 },
  { name: 'BBB企业债', yield: 5.20, duration: 7.5, rating: 'BBB', spread: 235 },
];

export default function FixedIncomeAnalysis() {
  const [selectedType, setSelectedType] = useState('国债');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">固定收益分析</h1>
          <p className="text-slate-400">债券收益率与信用风险分析</p>
        </div>

        {/* 债券类型选择 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <label className="text-sm font-medium text-slate-300 mb-3 block">选择债券类型</label>
          <div className="flex gap-2 flex-wrap">
            {BOND_TYPES.map(t => (
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

        {/* 收益率曲线 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-6">
          <h2 className="text-lg font-semibold text-slate-50 mb-4">收益率曲线</h2>
          <div className="h-64 bg-slate-800 rounded-lg flex items-end justify-around px-4 py-4">
            {[2, 3, 5, 7, 10, 20, 30].map((year, i) => {
              const height = (2.5 + year * 0.08 + Math.sin(year * 0.5) * 0.3) * 10;
              return (
                <div key={year} className="flex flex-col items-center gap-2">
                  <div
                    className="bg-gradient-to-t from-blue-500 to-blue-400 rounded-t"
                    style={{ width: '30px', height: `${height}px` }}
                  />
                  <span className="text-xs text-slate-400">{year}Y</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 债券列表 */}
        <Card className="bg-slate-900 border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-50 mb-4">债券行情</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 text-slate-300 font-semibold">债券</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">收益率</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">久期</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">评级</th>
                  <th className="text-right py-2 text-slate-300 font-semibold">利差</th>
                </tr>
              </thead>
              <tbody>
                {BONDS.map(bond => (
                  <tr key={bond.name} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 text-slate-100">{bond.name}</td>
                    <td className="text-right text-green-400 font-semibold">{bond.yield.toFixed(2)}%</td>
                    <td className="text-right text-slate-300">{bond.duration.toFixed(1)}</td>
                    <td className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        bond.rating === 'AAA' ? 'bg-green-900 text-green-300' :
                        bond.rating === 'AA' ? 'bg-blue-900 text-blue-300' :
                        bond.rating === 'A' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {bond.rating}
                      </span>
                    </td>
                    <td className="text-right text-orange-400">{bond.spread} bps</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 风险指标 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">平均收益率</div>
            <div className="text-3xl font-bold text-green-400">3.68%</div>
            <div className="text-xs text-slate-500 mt-2">加权平均</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">平均久期</div>
            <div className="text-3xl font-bold text-blue-400">6.17</div>
            <div className="text-xs text-slate-500 mt-2">年</div>
          </Card>
          <Card className="bg-slate-900 border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-2">信用风险</div>
            <div className="text-3xl font-bold text-orange-400">中等</div>
            <div className="text-xs text-slate-500 mt-2">评级分布</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
