import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectorData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

interface IndustrySectorPanelProps {
  title: string;
}

export default function IndustrySectorPanel({ title }: IndustrySectorPanelProps) {
  const [sectors, setSectors] = useState<SectorData[]>([
    {
      name: 'Technology',
      symbol: 'XLK',
      price: 145.50,
      change: 2.50,
      changePercent: 1.75,
      volume: 45230000,
      marketCap: 8500000000000,
    },
    {
      name: 'Healthcare',
      symbol: 'XLV',
      price: 135.75,
      change: 1.25,
      changePercent: 0.93,
      volume: 28450000,
      marketCap: 4200000000000,
    },
    {
      name: 'Financials',
      symbol: 'XLF',
      price: 42.30,
      change: -0.85,
      changePercent: -1.97,
      volume: 156230000,
      marketCap: 5800000000000,
    },
    {
      name: 'Energy',
      symbol: 'XLE',
      price: 92.15,
      change: 3.20,
      changePercent: 3.58,
      volume: 89340000,
      marketCap: 1200000000000,
    },
    {
      name: 'Consumer Discretionary',
      symbol: 'XLY',
      price: 78.60,
      change: -1.40,
      changePercent: -1.75,
      volume: 34560000,
      marketCap: 3400000000000,
    },
    {
      name: 'Industrials',
      symbol: 'XLI',
      price: 105.40,
      change: 0.95,
      changePercent: 0.91,
      volume: 42120000,
      marketCap: 2800000000000,
    },
    {
      name: 'Consumer Staples',
      symbol: 'XLP',
      price: 68.90,
      change: 0.30,
      changePercent: 0.44,
      volume: 18900000,
      marketCap: 2100000000000,
    },
    {
      name: 'Materials',
      symbol: 'XLB',
      price: 82.75,
      change: 2.15,
      changePercent: 2.67,
      volume: 24560000,
      marketCap: 1600000000000,
    },
    {
      name: 'Real Estate',
      symbol: 'XLRE',
      price: 58.40,
      change: -0.65,
      changePercent: -1.10,
      volume: 12340000,
      marketCap: 900000000000,
    },
    {
      name: 'Utilities',
      symbol: 'XLU',
      price: 75.20,
      change: 0.15,
      changePercent: 0.20,
      volume: 15670000,
      marketCap: 1100000000000,
    },
  ]);

  useEffect(() => {
    // Update sector prices periodically
    const interval = setInterval(() => {
      setSectors(prev =>
        prev.map(sector => {
          const change = (Math.random() - 0.5) * 5;
          const changePercent = (change / sector.price) * 100;
          return {
            ...sector,
            price: sector.price + change,
            change,
            changePercent,
          };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="terminal-header">
        <h3 className="terminal-title">{title}</h3>
        <span className="text-xs text-muted-foreground">S&P 500 Sectors</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-muted/20 border-b border-border">
            <tr>
              <th className="px-2 py-1 text-left font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50">
                Sector
              </th>
              <th className="px-2 py-1 text-center font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50">
                Symbol
              </th>
              <th className="px-2 py-1 text-right font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50">
                Price
              </th>
              <th className="px-2 py-1 text-right font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50">
                Change
              </th>
              <th className="px-2 py-1 text-right font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50">
                %
              </th>
              <th className="px-2 py-1 text-right font-mono font-semibold text-accent uppercase tracking-wider border-r border-border/50">
                Volume
              </th>
              <th className="px-2 py-1 text-right font-mono font-semibold text-accent uppercase tracking-wider">
                Market Cap
              </th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((sector) => (
              <tr
                key={sector.symbol}
                className="border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                <td className="px-2 py-1 font-mono text-foreground border-r border-border/30">
                  {sector.name}
                </td>
                <td className="px-2 py-1 font-mono font-semibold text-accent text-center border-r border-border/30">
                  {sector.symbol}
                </td>
                <td className="px-2 py-1 font-mono text-right border-r border-border/30">
                  ${sector.price.toFixed(2)}
                </td>
                <td
                  className={cn(
                    'px-2 py-1 font-mono text-right border-r border-border/30 flex items-center justify-end gap-1',
                    sector.change > 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {sector.change > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{sector.change > 0 ? '+' : ''}{sector.change.toFixed(2)}</span>
                </td>
                <td
                  className={cn(
                    'px-2 py-1 font-mono text-right border-r border-border/30 font-semibold',
                    sector.changePercent > 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {sector.changePercent > 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                </td>
                <td className="px-2 py-1 font-mono text-right border-r border-border/30 text-muted-foreground">
                  {(sector.volume / 1000000).toFixed(1)}M
                </td>
                <td className="px-2 py-1 font-mono text-right text-muted-foreground">
                  ${(sector.marketCap / 1000000000000).toFixed(1)}T
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
