import { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

const YTW_FIELDS = [
  { id: 1, label: '最新价格', value: 'latest_price' },
  { id: 2, label: '开盘价', value: 'open_price' },
  { id: 3, label: '最高价', value: 'high_price' },
  { id: 4, label: '最低价', value: 'low_price' },
  { id: 5, label: '买价', value: 'bid_price' },
  { id: 6, label: '中价', value: 'mid_price' },
  { id: 7, label: '卖价', value: 'ask_price' },
  { id: 8, label: '买价到期收益率', value: 'bid_ytm' },
  { id: 9, label: '中价到期收益率', value: 'mid_ytm' },
  { id: 10, label: '卖价到期收益率', value: 'ask_ytm' },
  { id: 11, label: '买价最差收益率', value: 'bid_worst_ytm' },
  { id: 12, label: '中价最差收益率', value: 'mid_worst_ytm' },
  { id: 13, label: '卖价最差收益率', value: 'ask_worst_ytm' },
  { id: 14, label: '下一购回收购收益率', value: 'next_call_ytm' },
  { id: 15, label: '下一购回收购中价收益率', value: 'next_call_mid_ytm' },
  { id: 16, label: '至下次购回卖价收益率', value: 'put_ytm' },
  { id: 17, label: '买价与基准价差线', value: 'bid_spread' },
  { id: 18, label: '中价与基准价差线', value: 'mid_spread' },
  { id: 19, label: '卖价与基准价差线', value: 'ask_spread' },
  { id: 20, label: '中价 1-利差线', value: 'mid_1_spread' },
  { id: 21, label: '中价 Z-价差线', value: 'mid_z_spread' },
  { id: 22, label: '中价资产期限线', value: 'mid_duration' },
  { id: 23, label: '查找栏目...', value: 'search' },
];

interface YTWFieldSelectorProps {
  onSelectionChange: (selected: string[]) => void;
  selected?: string[];
}

export default function YTWFieldSelector({
  onSelectionChange,
  selected = ['latest_price', 'open_price', 'high_price', 'low_price'],
}: YTWFieldSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return YTW_FIELDS.filter(
      f =>
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
        f.value !== 'search'
    );
  }, [searchQuery]);

  const toggleField = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter(v => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-between border-slate-700 bg-slate-900 text-slate-200"
      >
        <span>YTW 字段选择 ({selected.length})</span>
      </Button>

      {isOpen && (
        <Card className="absolute top-full mt-2 w-full max-w-md bg-slate-900 border-slate-700 z-50 shadow-lg">
          <div className="p-3 border-b border-slate-700">
            <div className="relative mb-3">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="搜索字段..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-slate-800 border-slate-600 text-slate-200"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectionChange(YTW_FIELDS.map(f => f.value).filter(v => v !== 'search'))}
                className="flex-1 border-slate-600 text-slate-300"
              >
                全选
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectionChange([])}
                className="flex-1 border-slate-600 text-slate-300"
              >
                清空
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-3">
            <div className="grid grid-cols-1 gap-2">
              {filtered.map((field) => (
                <label
                  key={field.value}
                  className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded cursor-pointer transition"
                >
                  <Checkbox
                    checked={selected.includes(field.value)}
                    onChange={() => toggleField(field.value)}
                    className="border-slate-600"
                  />
                  <span className="text-sm text-slate-200">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-slate-700 flex gap-2">
            <Button
              onClick={() => setIsOpen(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              确定
            </Button>
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300"
            >
              取消
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
