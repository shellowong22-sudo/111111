import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';

export default function FXDerivatives() {
  const [, setLocation] = useLocation();

  const items = [
    { name: 'OVML - 外汇/商品期权定价', path: '/ovml' },
    { name: 'WVOL - 外汇隐含波动率矩阵', path: '/wvol' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => setLocation('/')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>

        <h1 className="text-3xl font-bold text-amber-400 mb-2">外汇衍生品</h1>
        <p className="text-slate-400 mb-6">外汇期权和外汇衍生品市场</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <Card
              key={item.path}
              className="bg-slate-900/50 border-slate-800 p-6 hover:border-amber-400/50 cursor-pointer transition-all"
              onClick={() => setLocation(item.path)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-amber-400">{item.name}</h3>
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
