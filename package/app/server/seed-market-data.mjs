/**
 * seed-market-data.mjs
 * 导入初始市场数据到 market_data 表
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

const records = [
  // 主权债 / bond
  { symbol: 'US10Y',  name: '10Y US Treasury',     market: 'bond',      price: 98.50,   change_val: -0.12, change_pct: -0.12, volume: 5000000 },
  { symbol: 'US30Y',  name: '30Y US Treasury',     market: 'bond',      price: 96.20,   change_val: -0.25, change_pct: -0.26, volume: 3000000 },
  { symbol: 'USGG2YR',name: '2Y US Treasury',      market: 'bond',      price: 99.80,   change_val:  0.05, change_pct:  0.05, volume: 8000000 },
  { symbol: 'BUND',   name: 'German Bund 10Y',     market: 'bond',      price: 97.40,   change_val: -0.10, change_pct: -0.10, volume: 2000000 },
  { symbol: 'GILT',   name: 'UK Gilt 10Y',         market: 'bond',      price: 96.80,   change_val: -0.08, change_pct: -0.08, volume: 1500000 },
  // 股票 / stock
  { symbol: 'AAPL',   name: 'Apple Inc.',          market: 'stock',     price: 189.30,  change_val:  1.20, change_pct:  0.64, volume: 52000000 },
  { symbol: 'MSFT',   name: 'Microsoft Corp.',     market: 'stock',     price: 415.50,  change_val:  3.10, change_pct:  0.75, volume: 21000000 },
  { symbol: 'GOOGL',  name: 'Alphabet Inc.',       market: 'stock',     price: 175.80,  change_val: -0.90, change_pct: -0.51, volume: 18000000 },
  { symbol: 'AMZN',   name: 'Amazon.com Inc.',     market: 'stock',     price: 198.40,  change_val:  2.30, change_pct:  1.17, volume: 35000000 },
  { symbol: 'TSLA',   name: 'Tesla Inc.',          market: 'stock',     price: 248.60,  change_val: -5.40, change_pct: -2.13, volume: 88000000 },
  // 外汇 / forex
  { symbol: 'EURUSD', name: 'EUR/USD',             market: 'forex',     price: 1.0842,  change_val:  0.0012, change_pct:  0.11, volume: 0 },
  { symbol: 'GBPUSD', name: 'GBP/USD',             market: 'forex',     price: 1.2715,  change_val: -0.0008, change_pct: -0.06, volume: 0 },
  { symbol: 'USDJPY', name: 'USD/JPY',             market: 'forex',     price: 149.82,  change_val:  0.35,   change_pct:  0.23, volume: 0 },
  { symbol: 'USDCNY', name: 'USD/CNY',             market: 'forex',     price: 7.2450,  change_val: -0.0050, change_pct: -0.07, volume: 0 },
  // 大宗商品 / commodity
  { symbol: 'CL1',    name: 'WTI Crude Oil',       market: 'commodity', price: 78.45,   change_val: -0.65, change_pct: -0.82, volume: 420000 },
  { symbol: 'GC1',    name: 'Gold',                market: 'commodity', price: 2345.60, change_val: 12.40, change_pct:  0.53, volume: 180000 },
  { symbol: 'SI1',    name: 'Silver',              market: 'commodity', price: 28.92,   change_val:  0.18, change_pct:  0.63, volume: 95000  },
  { symbol: 'NG1',    name: 'Natural Gas',         market: 'commodity', price: 2.185,   change_val: -0.02, change_pct: -0.91, volume: 320000 },
  // 指数 / index
  { symbol: 'SPX',    name: 'S&P 500',             market: 'index',     price: 5234.18, change_val: 18.40, change_pct:  0.35, volume: 0 },
  { symbol: 'NDX',    name: 'Nasdaq 100',          market: 'index',     price: 18245.60,change_val: 85.20, change_pct:  0.47, volume: 0 },
  { symbol: 'DJIA',   name: 'Dow Jones',           market: 'index',     price: 39218.54,change_val:-42.10, change_pct: -0.11, volume: 0 },
  { symbol: '000001', name: '上证指数',             market: 'index',     price: 3145.20, change_val: 12.80, change_pct:  0.41, volume: 0 },
  // 衍生品 / derivative
  { symbol: 'ESM4',   name: 'E-mini S&P 500 Jun',  market: 'derivative',price: 5240.25, change_val: 20.50, change_pct:  0.39, volume: 1200000 },
  { symbol: 'NQM4',   name: 'E-mini Nasdaq Jun',   market: 'derivative',price: 18260.00,change_val: 88.00, change_pct:  0.48, volume: 580000  },
  // 期权 / option
  { symbol: 'AAPL240621C190', name: 'AAPL Jun21 190 Call', market: 'option', price: 4.85, change_val: 0.35, change_pct: 7.78, volume: 25000 },
  { symbol: 'SPY240621P520',  name: 'SPY Jun21 520 Put',   market: 'option', price: 3.20, change_val:-0.15, change_pct:-4.48, volume: 18000 },
  { symbol: 'TSLA240621C250', name: 'TSLA Jun21 250 Call', market: 'option', price: 8.40, change_val:-1.20, change_pct:-12.5, volume: 42000 },
  // 基金 / fund
  { symbol: 'SPY',    name: 'SPDR S&P 500 ETF',    market: 'fund',      price: 523.45,  change_val:  1.85, change_pct:  0.35, volume: 68000000 },
  { symbol: 'QQQ',    name: 'Invesco QQQ Trust',   market: 'fund',      price: 445.20,  change_val:  2.10, change_pct:  0.47, volume: 42000000 },
  { symbol: 'GLD',    name: 'SPDR Gold Shares',    market: 'fund',      price: 221.80,  change_val:  0.95, change_pct:  0.43, volume: 8500000  },
  { symbol: '110010', name: '易方达上证50增强A',    market: 'fund',      price: 1.2350,  change_val:  0.0050, change_pct: 0.41, volume: 5000000 },
];

let inserted = 0;
for (const r of records) {
  await conn.execute(
    `INSERT INTO market_data (symbol, name, market, price, change_val, change_pct, volume)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), market=VALUES(market), price=VALUES(price),
       change_val=VALUES(change_val), change_pct=VALUES(change_pct), volume=VALUES(volume)`,
    [r.symbol, r.name, r.market, r.price, r.change_val, r.change_pct, r.volume]
  );
  inserted++;
}

console.log(`✓ Seeded ${inserted} market_data records`);
await conn.end();
console.log('Data import complete.');
