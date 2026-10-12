import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const CURRENCIES = [
  { code: 'LCL', name: '当地货币' },
  { code: 'USD', name: '美元' },
  { code: 'EUR', name: '欧元' },
  { code: 'JPY', name: '日元' },
  { code: 'GBP', name: '英镑' },
  { code: 'CAD', name: '加拿大元' },
  { code: 'AUD', name: '澳大利亚元' },
  { code: 'NZD', name: '新西兰元' },
  { code: 'CHF', name: '瑞士法郎' },
  { code: 'NOK', name: '挪威克朗' },
  { code: 'SEK', name: '瑞典克朗' },
  { code: 'DKK', name: '丹麦克朗' },
  { code: 'CNY', name: '人民币' },
  { code: 'HKD', name: '港元' },
  { code: 'SGD', name: '新加坡元' },
];

interface CurrencySelectorProps {
  onSelect: (currency: string) => void;
  selected?: string;
}

export default function CurrencySelector({ onSelect, selected = 'LCL' }: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCurrency = CURRENCIES.find(c => c.code === selected);

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-between border-slate-700 bg-slate-900 text-slate-200"
      >
        <span>{selectedCurrency?.code} - {selectedCurrency?.name}</span>
        <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <Card className="absolute top-full mt-2 w-full bg-slate-900 border-slate-700 z-50 shadow-lg">
          <div className="p-3 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="搜索货币..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-slate-800 border-slate-600 text-slate-200"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.map((currency) => (
              <button
                key={currency.code}
                onClick={() => {
                  onSelect(currency.code);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full px-4 py-2 text-left hover:bg-slate-800 transition ${
                  selected === currency.code ? 'bg-slate-800 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-blue-400">{currency.code}</div>
                    <div className="text-xs text-slate-400">{currency.name}</div>
                  </div>
                  {selected === currency.code && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-slate-700">
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              size="sm"
              className="w-full border-slate-600 text-slate-300"
            >
              浏览更多...
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
