import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const PERIOD_GROUPS = {
  '历史价格走势': {
    '日线图': ['3M', '6M', '1Y', '2Y', '3Y', '5Y'],
    '周线图': ['1Y', '2Y', '3Y', '4Y', '5Y', '10Y'],
    '月线图': ['5Y', '10Y', '15Y', '20Y', '25Y', '30Y'],
    '季线图': ['10Y', '20Y', '25Y', '30Y', '40Y', '50Y'],
    '年线图': ['10Y', '20Y', '25Y', '30Y', '40Y', '50Y'],
  },
  '日内价格走势': {
    '跳价': ['1D', '2D', '3D', '4D', '5D', '10D'],
    '1分钟': ['1D', '2D', '3D'],
    '3分钟': ['1D', '2D', '3D', '4D', '5D', '10D'],
    '5分钟': ['1D', '2D', '3D', '4D', '5D', '10D'],
    '10分钟': ['3D', '4D', '5D', '10D', '20D', '30D'],
    '15分钟': ['3D', '4D', '5D', '10D', '20D', '30D'],
    '30分钟': ['10D', '20D', '30D', '60D', '3M', '6M'],
    '60分钟': ['10D', '20D', '30D', '60D', '3M', '6M'],
    '120分钟': ['10D', '20D', '30D', '60D', '3M', '6M'],
    '240分钟': ['10D', '20D', '30D', '60D', '3M', '6M'],
  },
};

interface PeriodSelectorProps {
  onSelect: (period: string) => void;
  selected?: string;
}

export default function PeriodSelector({ onSelect, selected = '1Y' }: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSubGroup, setSelectedSubGroup] = useState<string | null>(null);

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-between border-slate-700 bg-slate-900 text-slate-200"
      >
        <span>期限选择: {selected}</span>
        <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <Card className="absolute top-full mt-2 w-full max-w-2xl bg-slate-900 border-slate-700 z-50 shadow-lg">
          <div className="grid grid-cols-3 gap-4 p-4">
            {/* 主分组 */}
            <div className="border-r border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">分类</h3>
              <div className="space-y-1">
                {Object.keys(PERIOD_GROUPS).map((group) => (
                  <button
                    key={group}
                    onClick={() => {
                      setSelectedGroup(group);
                      setSelectedSubGroup(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                      selectedGroup === group
                        ? 'bg-slate-700 text-blue-400'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* 子分组 */}
            {selectedGroup && (
              <div className="border-r border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">类型</h3>
                <div className="space-y-1">
                  {Object.keys(PERIOD_GROUPS[selectedGroup as keyof typeof PERIOD_GROUPS]).map(
                    (subGroup) => (
                      <button
                        key={subGroup}
                        onClick={() => setSelectedSubGroup(subGroup)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                          selectedSubGroup === subGroup
                            ? 'bg-slate-700 text-blue-400'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {subGroup}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* 期限选项 */}
            {selectedGroup && selectedSubGroup && (
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">期限</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(PERIOD_GROUPS[selectedGroup as keyof typeof PERIOD_GROUPS][
                    selectedSubGroup as keyof typeof PERIOD_GROUPS[keyof typeof PERIOD_GROUPS]
                  ] as string[] | undefined)?.map((period: string) => (
                    <button
                      key={period}
                      onClick={() => {
                        onSelect(period);
                        setIsOpen(false);
                      }}
                      className={`px-3 py-2 rounded text-sm font-mono transition ${
                        selected === period
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-700 flex gap-2">
            <Button
              onClick={() => setIsOpen(false)}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300"
            >
              关闭
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
