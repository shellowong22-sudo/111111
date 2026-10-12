import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Search } from 'lucide-react';

interface Currency {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCIES: Currency[] = [
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'CAD', name: '加拿大元', symbol: 'C$' },
  { code: 'AUD', name: '澳大利亚元', symbol: 'A$' },
  { code: 'NZD', name: '新西兰元', symbol: 'NZ$' },
  { code: 'CHF', name: '瑞士法郎', symbol: 'CHF' },
  { code: 'NOK', name: '挪威克朗', symbol: 'kr' },
  { code: 'ISK', name: '冰岛克朗', symbol: 'kr' },
];

interface CurrencySelectorProps {
  value?: string;
  onChange?: (currency: string) => void;
}

export function CurrencySelector({ value = 'USD', onChange }: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCurrency = CURRENCIES.find(c => c.code === value) || CURRENCIES[0];
  const filteredCurrencies = CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (currency: Currency) => {
    onChange?.(currency.code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative w-full max-w-xs">
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold">{selectedCurrency.code}</span>
          <span className="text-sm text-muted-foreground">{selectedCurrency.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索货币..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredCurrencies.length > 0 ? (
              filteredCurrencies.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => handleSelect(currency)}
                  className={`w-full px-4 py-2 text-left hover:bg-accent flex items-center justify-between ${
                    currency.code === value ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <span>
                    <span className="font-semibold">{currency.code}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{currency.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{currency.symbol}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                未找到匹配的货币
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
