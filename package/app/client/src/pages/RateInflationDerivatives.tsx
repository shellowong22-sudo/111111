import { ArrowLeft, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';

export default function RateInflationDerivatives() {
  const [, setLocation] = useLocation();

  const items = [
    { name: 'SWPM - 掉期管理', path: '/swpm' },
    { name: 'WBF - 全球债券期货', path: '/wbf' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => setLocation('/')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>

        <h1 className="text-3xl font-bold text-amber-400 mb-2">利率、通胀衍生证券与结构债</h1>
        <p className="text-slate-400 mb-6">利率衍生品和通胀相关产品的综合交易平台</p>

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
