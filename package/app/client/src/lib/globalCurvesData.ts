// 全球曲线数据模型（G7 国家、地域、外汇）

export const G7_COUNTRIES = [
  { code: 'US', name: '美国', flag: '🇺🇸', color: '#3b82f6' },
  { code: 'UK', name: '英国', flag: '🇬🇧', color: '#ef4444' },
  { code: 'JP', name: '日本', flag: '🇯🇵', color: '#f97316' },
  { code: 'DE', name: '德国', flag: '🇩🇪', color: '#8b5cf6' },
  { code: 'FR', name: '法国', flag: '🇫🇷', color: '#06b6d4' },
  { code: 'IT', name: '意大利', flag: '🇮🇹', color: '#10b981' },
  { code: 'CA', name: '加拿大', flag: '🇨🇦', color: '#ec4899' }
];

export const REGIONAL_MARKETS = [
  { code: 'APAC', name: '亚太地区', region: 'Asia-Pacific' },
  { code: 'EMEA', name: '欧中东非', region: 'Europe, Middle East, Africa' },
  { code: 'LATAM', name: '拉美地区', region: 'Latin America' },
  { code: 'ASEAN', name: '东盟', region: 'ASEAN' },
  { code: 'GULF', name: '海湾地区', region: 'Gulf Cooperation Council' },
  { code: 'NORDIC', name: '北欧', region: 'Nordic Countries' },
  { code: 'BALKAN', name: '巴尔干', region: 'Balkans' },
  { code: 'MENA', name: '中东北非', region: 'Middle East & North Africa' },
  { code: 'SSA', name: '撒哈拉以南', region: 'Sub-Saharan Africa' },
  { code: 'CEE', name: '中东欧', region: 'Central & Eastern Europe' }
];

export const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'GBP/JPY', 'GBP/CHF', 'AUD/JPY', 'CAD/JPY',
  'USD/CNY', 'USD/INR', 'USD/BRL', 'USD/RUB', 'USD/MXN', 'USD/SGD',
  'EUR/CNY', 'EUR/INR', 'EUR/BRL', 'GBP/CNY', 'JPY/CNY', 'AUD/CNY',
  'USD/HKD', 'USD/KRW', 'USD/THB', 'USD/MYR', 'USD/IDR', 'USD/PHP',
  'EUR/HKD', 'EUR/KRW', 'GBP/HKD', 'AUD/HKD', 'NZD/JPY', 'CAD/CHF'
];

export const MATURITY_TERMS = [
  { value: '2Y', label: '2年' },
  { value: '5Y', label: '5年' },
  { value: '10Y', label: '10年' },
  { value: '30Y', label: '30年' }
];

export function generateCountryCurveData(countryCode: string, term: string = '10Y', count: number = 50) {
  void countryCode; void term; void count;
  return [] as Array<{ x: number; y: number; timestamp: string }>;
}

export function generateRegionalData(regionCode: string, count: number = 15) {
  void regionCode; void count;
  return [] as Array<{ id: number; country: string; yield2Y: string; yield5Y: string; yield10Y: string; yield30Y: string; spread: string; change: string }>;
}

export function generateForexData(pair: string, count: number = 50) {
  void pair; void count;
  return [] as Array<{ x: number; y: number; timestamp: string }>;
}

export function generateCurveComparison(countries: string[], term: string = '10Y') {
  void countries; void term;
  return [] as Array<{ country: string; yield: string; change: string; volatility: string }>;
}
