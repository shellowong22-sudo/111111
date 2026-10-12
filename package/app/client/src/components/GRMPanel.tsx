import PanelActionButton, { togglePanelFullscreen } from '@/components/PanelActionButton';
import { useState } from 'react';
import { X, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GRMPanelProps {
  onClose: () => void;
}

type Country = 'US' | 'CA' | 'DE' | 'FR' | 'IT' | 'ES' | 'GB' | 'JP';

const COUNTRIES: { code: Country; name: string; flag: string }[] = [
  { code: 'US', name: '美国', flag: '🇺🇸' },
  { code: 'CA', name: '加拿大', flag: '🇨🇦' },
  { code: 'DE', name: '德国', flag: '🇩🇪' },
  { code: 'FR', name: '法国', flag: '🇫🇷' },
  { code: 'IT', name: '意大利', flag: '🇮🇹' },
  { code: 'ES', name: '西班牙', flag: '🇪🇸' },
  { code: 'GB', name: '英国', flag: '🇬🇧' },
  { code: 'JP', name: '日本', flag: '🇯🇵' },
];

interface DataCell {
  value: number;
  change: number;
}

type SectionData = Record<string, Record<Country, DataCell>>;

const GRM_DATA: { section: string; rows: { label: string; key: string }[] }[] = [
  {
    section: '主权债',
    rows: [
      { label: '2Y', key: 'sov2y' },
      { label: '5Y', key: 'sov5y' },
      { label: '10Y', key: 'sov10y' },
      { label: '30Y', key: 'sov30y' },
    ],
  },
  {
    section: '通胀债券',
    rows: [
      { label: '10Y', key: 'inf10y' },
      { label: 'Brkeven 10', key: 'brkeven10' },
    ],
  },
  {
    section: '现金曲线',
    rows: [
      { label: '2Y-10Y', key: 'c2_10' },
      { label: '5Y-10Y', key: 'c5_10' },
      { label: '10Y-30Y', key: 'c10_30' },
    ],
  },
  {
    section: '现金蝶式',
    rows: [
      { label: '2Y-5Y-10Y', key: 'b2_5_10' },
      { label: '5Y-10Y-30Y', key: 'b5_10_30' },
    ],
  },
  {
    section: '债券期货',
    rows: [
      { label: '5Y', key: 'fut5y' },
      { label: '10Y', key: 'fut10y' },
      { label: '30Y', key: 'fut30y' },
    ],
  },
  {
    section: '即期掉期',
    rows: [
      { label: '2Y', key: 'sw2y' },
      { label: '5Y', key: 'sw5y' },
      { label: '10Y', key: 'sw10y' },
      { label: '30Y', key: 'sw30y' },
    ],
  },
  {
    section: '掉期曲线',
    rows: [
      { label: '2Y-10Y', key: 'swc2_10' },
      { label: '5Y-10Y', key: 'swc5_10' },
      { label: '10Y-30Y', key: 'swc10_30' },
    ],
  },
];

// Data from image17 screenshot
const DATA_VALUES: Record<string, Record<Country, DataCell>> = {
  sov2y: {
    US: { value: 99.785, change: +0.01 }, CA: { value: 99.338, change: -0.03 },
    DE: { value: 99.610, change: -0.06 }, FR: { value: 98.953, change: -0.07 },
    IT: { value: 98.920, change: -0.07 }, ES: { value: 99.316, change: -0.07 },
    GB: { value: 100.033, change: -0.03 }, JP: { value: 99.965, change: -0.01 },
  },
  sov5y: {
    US: { value: 99.453, change: -0.02 }, CA: { value: 98.241, change: -0.07 },
    DE: { value: 98.709, change: -0.13 }, FR: { value: 99.892, change: -0.17 },
    IT: { value: 98.485, change: -0.16 }, ES: { value: 98.196, change: -0.15 },
    GB: { value: 98.499, change: -0.05 }, JP: { value: 100.290, change: -0.03 },
  },
  sov10y: {
    US: { value: 98.813, change: -0.06 }, CA: { value: 98.008, change: -0.11 },
    DE: { value: 98.606, change: -0.2 }, FR: { value: 98.800, change: -0.27 },
    IT: { value: 97.188, change: -0.29 }, ES: { value: 98.269, change: -0.25 },
    GB: { value: 98.711, change: -0.11 }, JP: { value: 97.836, change: -0.04 },
  },
  sov30y: {
    US: { value: 99.844, change: -0.2 }, CA: { value: 93.034, change: -0.17 },
    DE: { value: 87.157, change: -0.24 }, FR: { value: 96.782, change: -0.41 },
    IT: { value: 100.668, change: -0.38 }, ES: { value: 94.915, change: -0.38 },
    GB: { value: 96.643, change: -0.17 }, JP: { value: 97.956, change: +0.31 },
  },
  inf10y: {
    US: { value: 97.516, change: +0.03 }, CA: { value: 116.382, change: -0.01 },
    DE: { value: 95.204, change: -0.1 }, FR: { value: 83.641, change: -0.18 },
    IT: { value: 99.905, change: -0.24 }, ES: { value: 101.126, change: -0.09 },
    GB: { value: 96.113, change: +0.17 }, JP: { value: 101.736, change: +0.17 },
  },
  brkeven10: {
    US: { value: 2.356, change: +0.01 }, CA: { value: 2.241, change: +0.0 },
    DE: { value: 2.062, change: +0.01 }, FR: { value: 1.827, change: +0.01 },
    IT: { value: 2.064, change: +0.01 }, ES: { value: 2.147, change: +0.01 },
    GB: { value: 3.346, change: +0.03 }, JP: { value: 0, change: 0 },
  },
  c2_10: {
    US: { value: 40.830, change: +1.2 }, CA: { value: 63.328, change: -0.23 },
    DE: { value: 36.527, change: -0.78 }, FR: { value: 95.522, change: -0.49 },
    IT: { value: 96.207, change: -0.68 }, ES: { value: 74.186, change: -0.78 },
    GB: { value: 56.838, change: -0.28 }, JP: { value: 124.300, change: -0.2 },
  },
  c5_10: {
    US: { value: 27.472, change: +0.44 }, CA: { value: 34.144, change: -0.34 },
    DE: { value: 28.005, change: -0.35 }, FR: { value: 56.656, change: -0.34 },
    IT: { value: 60.835, change: +0.07 }, ES: { value: 51.389, change: -0.29 },
    GB: { value: 44.190, change: -0.07 }, JP: { value: 72.600, change: -0.5 },
  },
  c10_30: {
    US: { value: 48.346, change: +0.82 }, CA: { value: 38.497, change: -0.25 },
    DE: { value: 53.570, change: -1.1 }, FR: { value: 75.330, change: -0.7 },
    IT: { value: 82.210, change: -1.21 }, ES: { value: 73.938, change: -0.68 },
    GB: { value: 68.459, change: -0.25 }, JP: { value: 113.400, change: -4.0 },
  },
  b2_5_10: {
    US: { value: -15.020, change: +0.17 }, CA: { value: -5.970, change: +0.42 },
    DE: { value: -20.300, change: -0.26 }, FR: { value: -18.992, change: -0.15 },
    IT: { value: -26.397, change: -0.49 }, ES: { value: -29.559, change: -0.28 },
    GB: { value: -32.133, change: -0.25 }, JP: { value: -26.500, change: +0.2 },
  },
  b5_10_30: {
    US: { value: -21.099, change: +0.09 }, CA: { value: -4.971, change: +0.03 },
    DE: { value: -25.953, change: +0.61 }, FR: { value: -19.451, change: +0.15 },
    IT: { value: -21.746, change: +1.48 }, ES: { value: -23.014, change: +0.48 },
    GB: { value: -24.437, change: +0.2 }, JP: { value: -47.800, change: +1.0 },
  },
  fut5y: {
    US: { value: 106.773, change: +0.04 }, CA: { value: 112.380, change: -0.01 },
    DE: { value: 114.380, change: -0.06 }, FR: { value: 113.190, change: +0.12 },
    IT: { value: 0, change: 0 }, ES: { value: 0, change: 0 },
    GB: { value: 0, change: 0 }, JP: { value: 0, change: 0 },
  },
  fut10y: {
    US: { value: 109.234, change: +0.02 }, CA: { value: 119.710, change: +0.0 },
    DE: { value: 125.220, change: -0.12 }, FR: { value: 118.230, change: -0.19 },
    IT: { value: 117.020, change: -0.26 }, ES: { value: 120.540, change: -0.08 },
    GB: { value: 87.620, change: -0.12 }, JP: { value: 128.660, change: -0.03 },
  },
  fut30y: {
    US: { value: 114.125, change: +0.0 }, CA: { value: 0, change: 0 },
    DE: { value: 107.260, change: -0.16 }, FR: { value: 0, change: 0 },
    IT: { value: 0, change: 0 }, ES: { value: 0, change: 0 },
    GB: { value: 0, change: 0 }, JP: { value: 92.110, change: +0.57 },
  },
  sw2y: {
    US: { value: 3.975, change: +0.0 }, CA: { value: 2.767, change: +0.02 },
    DE: { value: 2.883, change: +0.01 }, FR: { value: 2.883, change: +0.01 },
    IT: { value: 2.883, change: +0.01 }, ES: { value: 2.883, change: +0.01 },
    GB: { value: 4.244, change: +0.0 }, JP: { value: 1.414, change: +0.0 },
  },
  sw5y: {
    US: { value: 3.968, change: +0.0 }, CA: { value: 2.982, change: +0.02 },
    DE: { value: 2.920, change: +0.01 }, FR: { value: 2.920, change: +0.01 },
    IT: { value: 2.920, change: +0.01 }, ES: { value: 2.920, change: +0.01 },
    GB: { value: 4.269, change: +0.03 }, JP: { value: 1.929, change: +0.01 },
  },
  sw10y: {
    US: { value: 4.116, change: +0.01 }, CA: { value: 3.272, change: +0.01 },
    DE: { value: 3.111, change: +0.01 }, FR: { value: 3.111, change: +0.01 },
    IT: { value: 3.111, change: +0.01 }, ES: { value: 3.111, change: +0.01 },
    GB: { value: 4.510, change: +0.0 }, JP: { value: 2.503, change: +0.01 },
  },
  sw30y: {
    US: { value: 4.289, change: +0.01 }, CA: { value: 3.571, change: +0.01 },
    DE: { value: 3.243, change: +0.0 }, FR: { value: 3.243, change: +0.0 },
    IT: { value: 3.243, change: +0.0 }, ES: { value: 3.243, change: +0.0 },
    GB: { value: 4.912, change: +0.0 }, JP: { value: 3.342, change: +0.0 },
  },
  swc2_10: {
    US: { value: 14.1, change: +0.1 }, CA: { value: 50.5, change: -0.1 },
    DE: { value: 22.8, change: +0.0 }, FR: { value: 22.8, change: +0.0 },
    IT: { value: 22.8, change: +0.0 }, ES: { value: 22.8, change: +0.0 },
    GB: { value: 26.6, change: +0.0 }, JP: { value: 108.9, change: +0.1 },
  },
  swc5_10: {
    US: { value: 14.8, change: +0.1 }, CA: { value: 29.0, change: -0.1 },
    DE: { value: 19.1, change: +0.0 }, FR: { value: 19.1, change: +0.0 },
    IT: { value: 19.1, change: +0.0 }, ES: { value: 19.1, change: +0.0 },
    GB: { value: 24.1, change: -0.03 }, JP: { value: 57.4, change: +0.1 },
  },
  swc10_30: {
    US: { value: 17.3, change: +0.1 }, CA: { value: 29.9, change: -0.1 },
    DE: { value: 13.2, change: -0.1 }, FR: { value: 13.2, change: -0.1 },
    IT: { value: 13.2, change: -0.1 }, ES: { value: 13.2, change: -0.1 },
    GB: { value: 64.3, change: -0.03 }, JP: { value: 143.9, change: -0.1 },
  },
};

export default function GRMPanel({ onClose }: GRMPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground font-mono text-xs">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-muted/10 border-b border-border">
        <span className="text-muted-foreground">GRM 全球利率行情显示</span>
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-accent" onClick={(event) => togglePanelFullscreen(event.currentTarget)} />
          <span className="text-accent font-semibold">全球利率行情显示</span>
          <button onClick={onClose} className="p-0.5 hover:bg-muted/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/5">
        <PanelActionButton action="settings" className="px-2 py-0.5 bg-red-900/80 text-white rounded-sm text-xs hover:bg-red-800">
          设定 ▾
        </PanelActionButton>
        <span className="px-2 py-0.5 bg-yellow-500 text-black rounded-sm text-xs font-semibold">可升级</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="border-b border-border">
              <th className="text-left px-2 py-1 text-muted-foreground font-normal w-28" />
              {COUNTRIES.map(c => (
                <th key={c.code} colSpan={2} className="text-center px-1 py-1 border-l border-border/30">
                  <div className="text-foreground font-semibold">{c.name}</div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th className="text-left px-2 py-1 text-muted-foreground font-normal" />
              {COUNTRIES.map(c => (
                <>
                  <th key={`${c.code}-v`} className="text-right px-1 py-0.5 text-muted-foreground font-normal border-l border-border/30 w-16">值</th>
                  <th key={`${c.code}-c`} className="text-right px-1 py-0.5 text-muted-foreground font-normal w-12">变动</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRM_DATA.map(({ section, rows }) => (
              <>
                <tr
                  key={section}
                  className="bg-muted/10 cursor-pointer hover:bg-muted/20"
                  onClick={() => toggleSection(section)}
                >
                  <td colSpan={1 + COUNTRIES.length * 2} className="px-2 py-0.5">
                    <div className="flex items-center gap-1">
                      {collapsed[section]
                        ? <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      }
                      <span className="text-muted-foreground">▸ {section}</span>
                    </div>
                  </td>
                </tr>
                {!collapsed[section] && rows.map(row => {
                  const rowData = DATA_VALUES[row.key];
                  return (
                    <tr key={row.key} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-2 py-0.5 text-orange-400">{row.label}</td>
                      {COUNTRIES.map(c => {
                        const cell = rowData?.[c.code];
                        if (!cell || cell.value === 0) {
                          return (
                            <>
                              <td key={`${c.code}-v`} className="text-right px-1 py-0.5 border-l border-border/20 text-muted-foreground/30">—</td>
                              <td key={`${c.code}-c`} className="text-right px-1 py-0.5" />
                            </>
                          );
                        }
                        return (
                          <>
                            <td key={`${c.code}-v`} className="text-right px-1 py-0.5 border-l border-border/20 text-orange-300 font-semibold">
                              {cell.value.toFixed(3)}
                            </td>
                            <td key={`${c.code}-c`} className={cn('text-right px-1 py-0.5', cell.change > 0 ? 'text-green-400' : cell.change < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                              {cell.change > 0 ? `+${cell.change.toFixed(2)}` : cell.change !== 0 ? cell.change.toFixed(2) : ''}
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3 py-1 flex justify-between text-[10px] text-muted-foreground bg-muted/5">
        <span>建议功能</span>
        <div className="flex gap-4">
          <span><span className="text-accent">EMSI</span> 复制与共享您的EMS交易档案</span>
          <span><span className="text-accent">TOP</span> 要闻</span>
        </div>
      </div>
    </div>
  );
}
