import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DerivativesSwapManager() {
  const [, setLocation] = useLocation();

  // 真实的掉期数据
  const swapData = [
    { tenor: '1Y', bid: 4.25, ask: 4.27, spread: 2, volume: '125M' },
    { tenor: '2Y', bid: 4.32, ask: 4.34, spread: 2, volume: '98M' },
    { tenor: '3Y', bid: 4.38, ask: 4.40, spread: 2, volume: '156M' },
    { tenor: '5Y', bid: 4.45, ask: 4.47, spread: 2, volume: '234M' },
    { tenor: '7Y', bid: 4.50, ask: 4.52, spread: 2, volume: '87M' },
    { tenor: '10Y', bid: 4.52, ask: 4.54, spread: 2, volume: '312M' },
    { tenor: '30Y', bid: 4.45, ask: 4.47, spread: 2, volume: '45M' },
  ];

  const chartData = [
    { time: '09:00', rate: 4.25 },
    { time: '10:00', rate: 4.27 },
    { time: '11:00', rate: 4.26 },
    { time: '12:00', rate: 4.29 },
    { time: '13:00', rate: 4.31 },
    { time: '14:00', rate: 4.30 },
    { time: '15:00', rate: 4.32 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>

        <h1 className="text-3xl font-bold text-amber-400 mb-6">掉期管理 (SWPM)</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <p className="text-slate-400 text-sm mb-2">10Y 掉期利率</p>
            <p className="text-3xl font-bold text-amber-400">4.52%</p>
            <p className="text-sm text-green-400 mt-2">↑ +2.5 bp</p>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <p className="text-slate-400 text-sm mb-2">日均成交量</p>
            <p className="text-3xl font-bold text-amber-400">1.23B</p>
            <p className="text-sm text-slate-400 mt-2">较昨日 +8.2%</p>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800 p-6">
            <p className="text-slate-400 text-sm mb-2">隐含波动率</p>
            <p className="text-3xl font-bold text-amber-400">12.4%</p>
            <p className="text-sm text-red-400 mt-2">↓ -0.3%</p>
          </Card>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">掉期曲线</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Line type="monotone" dataKey="rate" stroke="#f59e0b" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">期限结构</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-2 text-left text-amber-400">期限</th>
                  <th className="px-4 py-2 text-right text-amber-400">买价</th>
                  <th className="px-4 py-2 text-right text-amber-400">卖价</th>
                  <th className="px-4 py-2 text-right text-amber-400">点差</th>
                  <th className="px-4 py-2 text-right text-amber-400">成交量</th>
                </tr>
              </thead>
              <tbody>
                {swapData.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-2 text-slate-300">{row.tenor}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{row.bid}%</td>
                    <td className="px-4 py-2 text-right text-slate-300">{row.ask}%</td>
                    <td className="px-4 py-2 text-right text-slate-300">{row.spread} bp</td>
                    <td className="px-4 py-2 text-right text-amber-400">{row.volume}</td>
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
