import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';

interface Region {
  id: string;
  name: string;
}

interface DataSource {
  id: string;
  name: string;
}

const REGIONS: Region[] = [
  { id: 'asia-pacific', name: '亚太' },
  { id: 'asia-emerging', name: '亚太地区（新兴）' },
  { id: 'eastern-europe', name: '东欧' },
  { id: 'latin-america', name: '拉丁美洲与加勒比地区' },
  { id: 'middle-east-africa', name: '中东与非洲' },
  { id: 'north-america', name: '北美' },
  { id: 'western-europe', name: '西欧' },
];

const DATA_SOURCES: DataSource[] = [
  { id: 'source-1', name: '列表来源 1' },
  { id: 'source-2', name: '列表来源 2' },
  { id: 'source-3', name: '列表来源 3' },
  { id: 'source-4', name: '列表来源 4' },
  { id: 'source-5', name: '列表来源 5' },
  { id: 'source-6', name: '列表来源 6' },
  { id: 'source-7', name: '列表来源 7' },
  { id: 'source-8', name: '列表来源 8' },
  { id: 'source-9', name: '列表来源 9' },
];

interface RegionSourceSelectorProps {
  selectedRegions?: string[];
  selectedSources?: string[];
  onRegionsChange?: (regions: string[]) => void;
  onSourcesChange?: (sources: string[]) => void;
}

export function RegionSourceSelector({
  selectedRegions = [],
  selectedSources = [],
  onRegionsChange,
  onSourcesChange,
}: RegionSourceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'regions' | 'sources'>('regions');

  const handleRegionToggle = (regionId: string) => {
    const updated = selectedRegions.includes(regionId)
      ? selectedRegions.filter(id => id !== regionId)
      : [...selectedRegions, regionId];
    onRegionsChange?.(updated);
  };

  const handleSourceToggle = (sourceId: string) => {
    const updated = selectedSources.includes(sourceId)
      ? selectedSources.filter(id => id !== sourceId)
      : [...selectedSources, sourceId];
    onSourcesChange?.(updated);
  };

  const handleSelectAll = () => {
    if (activeTab === 'regions') {
      onRegionsChange?.(selectedRegions.length === REGIONS.length ? [] : REGIONS.map(r => r.id));
    } else {
      onSourcesChange?.(selectedSources.length === DATA_SOURCES.length ? [] : DATA_SOURCES.map(s => s.id));
    }
  };

  const displayText = activeTab === 'regions'
    ? `地区 (${selectedRegions.length})`
    : `列表来源 (${selectedSources.length})`;

  return (
    <div className="relative w-full max-w-sm">
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{displayText}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('regions')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeTab === 'regions'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              地区
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeTab === 'sources'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              列表来源
            </button>
          </div>

          <div className="p-3 border-b border-border">
            <button
              onClick={handleSelectAll}
              className="text-sm text-primary hover:underline"
            >
              {activeTab === 'regions'
                ? selectedRegions.length === REGIONS.length ? '取消全选' : '全选'
                : selectedSources.length === DATA_SOURCES.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {activeTab === 'regions' ? (
              <div className="space-y-2 p-3">
                {REGIONS.map((region) => (
                  <div key={region.id} className="flex items-center gap-2">
                    <Checkbox
                      id={region.id}
                      checked={selectedRegions.includes(region.id)}
                      onCheckedChange={() => handleRegionToggle(region.id)}
                    />
                    <label htmlFor={region.id} className="text-sm cursor-pointer">
                      {region.name}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {DATA_SOURCES.map((source) => (
                  <div key={source.id} className="flex items-center gap-2">
                    <Checkbox
                      id={source.id}
                      checked={selectedSources.includes(source.id)}
                      onCheckedChange={() => handleSourceToggle(source.id)}
                    />
                    <label htmlFor={source.id} className="text-sm cursor-pointer">
                      {source.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
