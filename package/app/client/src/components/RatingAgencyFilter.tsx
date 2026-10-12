import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';

interface RatingAgency {
  id: string;
  name: string;
  code: string;
}

const RATING_AGENCIES: RatingAgency[] = [
  { id: 'moody', name: '穆迪', code: 'Moody\'s' },
  { id: 'sp', name: '标准普尔', code: 'S&P' },
  { id: 'fitch', name: '惠誉', code: 'Fitch' },
  { id: 'bloomberg', name: '佑诚综合', code: 'Ucheer' },
  { id: 'custom', name: '自定义评级', code: 'Custom' },
];

interface RatingAgencyFilterProps {
  selectedAgencies?: string[];
  onChange?: (agencies: string[]) => void;
}

export function RatingAgencyFilter({
  selectedAgencies = [],
  onChange,
}: RatingAgencyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAgencyToggle = (agencyId: string) => {
    const updated = selectedAgencies.includes(agencyId)
      ? selectedAgencies.filter(id => id !== agencyId)
      : [...selectedAgencies, agencyId];
    onChange?.(updated);
  };

  const handleSelectAll = () => {
    onChange?.(
      selectedAgencies.length === RATING_AGENCIES.length
        ? []
        : RATING_AGENCIES.map(a => a.id)
    );
  };

  return (
    <div className="relative w-full max-w-sm">
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>评级机构 ({selectedAgencies.length})</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-border flex justify-between items-center">
            <span className="text-sm font-medium">选择评级机构</span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-primary hover:underline"
            >
              {selectedAgencies.length === RATING_AGENCIES.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-3 space-y-3">
            {RATING_AGENCIES.map((agency) => (
              <div key={agency.id} className="flex items-center gap-3">
                <Checkbox
                  id={agency.id}
                  checked={selectedAgencies.includes(agency.id)}
                  onCheckedChange={() => handleAgencyToggle(agency.id)}
                />
                <label htmlFor={agency.id} className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">{agency.name}</div>
                  <div className="text-xs text-muted-foreground">{agency.code}</div>
                </label>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-border flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              关闭
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setIsOpen(false)}
            >
              应用
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
