/**
 * Legacy data-engine compatibility surface.
 *
 * Production screens must use a server-backed source.  The former random
 * generators were removed so an accidental legacy call fails loudly instead
 * of presenting synthetic prices as market data.
 */

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

export interface BondData extends MarketData {
  yield: number;
  maturity: string;
  duration: number;
  rating: string;
}

export interface IndexData extends MarketData {
  components: number;
  dayHigh: number;
  dayLow: number;
}

export interface CurrencyData extends MarketData {
  base: string;
  quote: string;
}

export interface CommodityData extends MarketData {
  unit: string;
  dayHigh: number;
  dayLow: number;
}

export interface EconomicIndicator {
  name: string;
  value: number;
  unit: string;
  previous: number;
  forecast: number;
  timestamp: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  timestamp: number;
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  type: 'text' | 'alert' | 'system';
}

const REAL_DATA_REQUIRED = 'REAL_DATA_SOURCE_REQUIRED';
const unavailable = (): never => { throw new Error(REAL_DATA_REQUIRED); };

// 债券数据生成
export const generateBondData = (symbol: string, name: string, basePrice: number = 100): BondData => {
  void symbol; void name; void basePrice; return unavailable();
};

// 股票/指数数据生成
export const generateIndexData = (symbol: string, name: string, basePrice: number = 3000): IndexData => {
  void symbol; void name; void basePrice; return unavailable();
};

// 货币对数据生成
export const generateCurrencyData = (symbol: string, base: string, quote: string, basePrice: number = 1.1): CurrencyData => {
  void symbol; void base; void quote; void basePrice; return unavailable();
};

// 大宗商品数据生成
export const generateCommodityData = (symbol: string, name: string, unit: string, basePrice: number): CommodityData => {
  void symbol; void name; void unit; void basePrice; return unavailable();
};

// 经济指标数据生成
export const generateEconomicIndicator = (name: string, value: number, unit: string, previous: number): EconomicIndicator => {
  void name; void value; void unit; void previous; return unavailable();
};

// 新闻数据生成
export const generateNewsItem = (id: string): NewsItem => {
  void id; return unavailable();
};

// 消息数据生成
export const generateMessage = (id: string, sender: string): Message => {
  void id; void sender; return unavailable();
};

// K线数据生成（用于图表）
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const generateCandleData = (basePrice: number, periods: number = 50): CandleData[] => {
  void basePrice; void periods; return unavailable();
};

// 数据缓存与订阅系统
class DataEngine {
  private cache: Map<string, any> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // 立即调用一次
    if (this.cache.has(key)) {
      callback(this.cache.get(key));
    }

    // 返回取消订阅函数
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private publish(key: string, data: any): void {
    this.cache.set(key, data);
    this.subscribers.get(key)?.forEach(callback => callback(data));
  }

  startUpdating(key: string, generator: () => any, interval: number = 1000): void {
    void interval;
    this.stopUpdating(key);
    this.publish(key, generator());
  }

  stopUpdating(key: string): void {
    const id = this.updateIntervals.get(key);
    if (id) {
      clearInterval(id);
      this.updateIntervals.delete(key);
    }
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  clear(): void {
    this.updateIntervals.forEach(id => clearInterval(id));
    this.updateIntervals.clear();
    this.cache.clear();
    this.subscribers.clear();
  }
}

export const dataEngine = new DataEngine();
