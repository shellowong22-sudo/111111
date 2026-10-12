// 二级市场数据（信用债、CDS、掉期、ETF）

export const SECONDARY_MARKETS = [
  { id: 'credit-bond', name: '信用债市场', icon: '💼' },
  { id: 'cds-market', name: 'CDS 市场', icon: '📊' },
  { id: 'swap-market', name: '掉期市场', icon: '🔄' },
  { id: 'etf-market', name: 'ETF 市场', icon: '📈' },
  { id: 'sovereign-debt', name: '主权债市场', icon: '🏛️' },
  { id: 'bond-futures', name: '债券期货', icon: '📉' },
  { id: 'rate-futures', name: '利率期货', icon: '⚡' },
  { id: 'intraday-trading', name: '日内交易', icon: '🚀' }
];

export function generateSecondaryMarketData(marketId: string, count: number = 20) {
  void marketId; void count;
  return [] as Array<{ id: number; code: string; name: string; price: string; change: string; changePercent: string; volume: number; bid: string; ask: string; spread: string; yield: string; duration: string; rating: string; maturity: string }>;
}

export function generateMarketStatistics(marketId: string) {
  void marketId;
  return {
    totalVolume: null,
    totalValue: null,
    averageSpread: null,
    activeInstruments: null,
    dayChange: null,
    weekChange: null,
    monthChange: null,
  };
}

export function generateChartData(type: 'line' | 'bar' | 'scatter' = 'line', count: number = 50) {
  void type; void count;
  return [] as Array<{ x: number; y: number; timestamp: string }>;
}
