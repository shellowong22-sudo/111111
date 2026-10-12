import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import OpenBBModuleDataBand from '@/components/OpenBBModuleDataBand';

const DERIVATIVE_TYPES = ['期货', '期权', '掉期', '远期'];
type DerivativeContract = {
  code: string;
  name: string;
  price: number | string | null;
  change: string | null;
  volume: number | string | null;
};

const CONTRACTS: Record<string, DerivativeContract[]> = {
  '期货': [
    { code: 'ES', name: 'E-mini S&P 500', price: null, change: null, volume: null },
    { code: 'NQ', name: 'E-mini Nasdaq', price: null, change: null, volume: null },
    { code: 'YM', name: 'Micro E-mini Dow', price: null, change: null, volume: null },
  ],
  '期权': [
    { code: 'AAPL_C', name: 'AAPL看涨期权', price: null, change: null, volume: null },
    { code: 'SPY_P', name: 'SPY看跌期权', price: null, change: null, volume: null },
    { code: 'QQQ_C', name: 'QQQ看涨期权', price: null, change: null, volume: null },
  ],
  '掉期': [
    { code: 'IRS_5Y', name: '5年利率掉期', price: null, change: null, volume: null },
    { code: 'CDS_IG', name: '投资级CDS', price: null, change: null, volume: null },
    { code: 'FX_SWAP', name: '外汇掉期', price: null, change: null, volume: null },
  ],
  '远期': [
    { code: 'FWD_EUR', name: '欧元远期', price: null, change: null, volume: null },
    { code: 'FWD_GBP', name: '英镑远期', price: null, change: null, volume: null },
  ],
};

export default function DerivativesTraderHub() {
  const [selectedType, setSelectedType] = useState('期货');
  const [expandedContract, setExpandedContract] = useState<string | null>(null);

  const contracts = CONTRACTS[selectedType as keyof typeof CONTRACTS] || [];

  return (
    <OpenBBModuleDataBand path="/derivatives-trader" title="衍生品交易数据">
    {() => <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-50 mb-2">衍生品交易员中心</h1>
          <p className="text-slate-400">期货、期权、掉期、远期的实时交易数据</p>
        </div>

        {/* 控制面板 */}
        <Card className="bg-slate-900 border-slate-700 mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">衍生品类型</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {Object.keys(CONTRACTS).map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-300 mb-2 block">快速选择</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(CONTRACTS).map(type => (
                  <Button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-2 text-sm ${
                      selectedType === type
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-slate-800 hover:bg-slate-700'
                    } text-white`}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* 合约列表 */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-50 mb-4">{selectedType}合约</h2>
          {contracts.map((contract) => (
            <Card key={contract.code} className="bg-slate-900 border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedContract(expandedContract === contract.code ? null : contract.code)}
                className="w-full px-6 py-4 bg-slate-800 hover:bg-slate-700 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div className="font-mono text-blue-400 font-semibold w-16">{contract.code}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">{contract.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-slate-100">{contract.price ?? '—'}</div>
                    <div className={`text-sm ${contract.change?.startsWith('+') ? 'text-green-400' : contract.change ? 'text-red-400' : 'text-slate-500'}`}>
                      {contract.change ?? '数据源未配置'}
                    </div>
                  </div>
                </div>
                {expandedContract === contract.code ? <ChevronUp /> : <ChevronDown />}
              </button>

              {expandedContract === contract.code && (
                <div className="p-6 border-t border-slate-700 bg-slate-950">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-slate-400 text-sm">成交量</div>
                      <div className="text-lg font-semibold text-slate-500">{contract.volume ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">日涨跌</div>
                      <div className={`text-lg font-semibold ${contract.change?.startsWith('+') ? 'text-green-400' : contract.change ? 'text-red-400' : 'text-slate-500'}`}>
                        {contract.change ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">波动率</div>
                      <div className="text-lg font-semibold text-slate-500">—</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">持仓量</div>
                      <div className="text-lg font-semibold text-slate-500">—</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">隐含波动率</div>
                      <div className="text-lg font-semibold text-slate-500">—</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>}
    </OpenBBModuleDataBand>
  );
}
