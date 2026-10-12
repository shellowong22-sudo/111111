import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Globe, AlertTriangle } from 'lucide-react';
import WFIIFxView from './WFIIFxView';
import WFIIFinancialStressView from './WFIIFinancialStressView';

export default function WFIITab() {
  const [view, setView] = useState<'flows' | 'fx' | 'fdi' | 'stress' | 'crisis' | 'payments'>('flows');

  return (
    <div className="space-y-4">

      {/* 视图切换 */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'flows', label: '资本流动' }, { key: 'fx', label: '汇率矩阵' },
          { key: 'fdi', label: 'FDI排名' }, { key: 'stress', label: '金融压力' },

        ].map(v => (
          <Button key={v.key} variant="outline" size="sm"
            className={cn('h-7 text-xs border-gray-700', view === v.key ? 'bg-blue-500/20 text-blue-400 border-blue-700' : 'bg-transparent text-gray-400 hover:text-gray-200')}
            onClick={() => setView(v.key as typeof view)}>{v.label}</Button>
        ))}
      </div>

      {/* 资本流动视图 */}
      {view === 'flows' && <WorldBankExistingView mode="flows" />}

      {/* 汇率矩阵视图 */}
      {view === 'fx' && <WFIIFxView />}

      {/* FDI 排名视图 */}
      {view === 'fdi' && <WorldBankExistingView mode="fdi" />}

      {/* 金融压力视图 */}
      {view === 'stress' && (
        <WFIIFinancialStressView />
        /* <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {STRESS_INDEX.map((item, i) => (
              <Card key={i} className={cn('border cursor-pointer hover:opacity-90 transition-opacity',
                item.status === 'low' ? 'bg-green-950/20 border-green-800/40' :
                item.status === 'medium' ? 'bg-amber-950/20 border-amber-800/40' : 'bg-gray-800 border-gray-700')}
                onClick={() => toast.info(`${item.name}：${item.desc}`)}>
                <CardContent className="p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{item.name}</div>
                  <div className={cn('text-2xl font-bold', item.status === 'low' ? 'text-green-400' : item.status === 'medium' ? 'text-amber-400' : 'text-blue-400')}>
                    {item.value.toFixed(1)}
                  </div>
                  <div className={cn('text-xs mt-1', item.value < item.prev ? 'text-green-400' : 'text-red-400')}>
                    {item.value < item.prev ? '↓' : '↑'} 前值 {item.prev.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-gray-300">金融压力指数对比</CardTitle></CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={STRESS_INDEX}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip content={<EnhancedTooltip />} cursor={CustomCursor} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" name="当前值" fill="#f59e0b" />
                  <Bar dataKey="prev" name="前值" fill="#f59e0b40" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="p-3 bg-violet-950/20 border border-violet-800/40 rounded text-xs text-violet-300">
            <strong>综合评估：</strong>全球金融压力处于中低水平，美国FSI处于低压区，欧元区受能源和财政压力略高。新兴市场受美元走强和资本外流影响，压力相对较高。VIX回落至18.5表明市场情绪趋于稳定，但MOVE指数仍显示利率不确定性。
          </div>
        </div> */
      )}

      {/* 货币危机预警视图 */}

      {/* 跨境支付视图 */}
    </div>
  );
}
import { WorldBankExistingView } from './WorldBankExistingViews';
