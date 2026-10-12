/**
 * import-data.mjs
 * 导入品种行情数据，使用 process.exit 避免连接挂起
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);

const records = [
  // 股票 / stock
  { symbol: 'AAPL',   name: 'Apple Inc.',           market: 'stock',     price: '175.80',  change_val: '-0.90', change_pct: '-0.51', volume: '18000000' },
  { symbol: 'MSFT',   name: 'Microsoft Corp.',       market: 'stock',     price: '415.20',  change_val: '3.40',  change_pct: '0.83',  volume: '22000000' },
  { symbol: 'GOOGL',  name: 'Alphabet Inc.',         market: 'stock',     price: '175.80',  change_val: '-0.90', change_pct: '-0.51', volume: '18000000' },
  { symbol: 'AMZN',   name: 'Amazon.com Inc.',       market: 'stock',     price: '198.40',  change_val: '2.30',  change_pct: '1.17',  volume: '35000000' },
  { symbol: 'TSLA',   name: 'Tesla Inc.',            market: 'stock',     price: '248.60',  change_val: '-5.40', change_pct: '-2.13', volume: '88000000' },
  { symbol: 'NVDA',   name: 'NVIDIA Corp.',          market: 'stock',     price: '875.40',  change_val: '12.30', change_pct: '1.43',  volume: '45000000' },
  { symbol: 'META',   name: 'Meta Platforms',        market: 'stock',     price: '485.20',  change_val: '6.80',  change_pct: '1.42',  volume: '15000000' },
  { symbol: 'BRK.B',  name: 'Berkshire Hathaway B',  market: 'stock',     price: '385.60',  change_val: '1.20',  change_pct: '0.31',  volume: '3500000'  },
  { symbol: '600519', name: '贵州茅台',               market: 'stock',     price: '1680.00', change_val: '15.00', change_pct: '0.90',  volume: '2500000'  },
  { symbol: '000858', name: '五粮液',                 market: 'stock',     price: '145.80',  change_val: '-1.20', change_pct: '-0.82', volume: '8000000'  },
  // 外汇 / forex
  { symbol: 'EURUSD', name: 'EUR/USD',               market: 'forex',     price: '1.0842',  change_val: '0.0012',  change_pct: '0.11',  volume: '0' },
  { symbol: 'GBPUSD', name: 'GBP/USD',               market: 'forex',     price: '1.2715',  change_val: '-0.0008', change_pct: '-0.06', volume: '0' },
  { symbol: 'USDJPY', name: 'USD/JPY',               market: 'forex',     price: '149.82',  change_val: '0.35',    change_pct: '0.23',  volume: '0' },
  { symbol: 'USDCNY', name: 'USD/CNY',               market: 'forex',     price: '7.2450',  change_val: '-0.0050', change_pct: '-0.07', volume: '0' },
  { symbol: 'USDCHF', name: 'USD/CHF',               market: 'forex',     price: '0.8985',  change_val: '0.0020',  change_pct: '0.22',  volume: '0' },
  { symbol: 'AUDUSD', name: 'AUD/USD',               market: 'forex',     price: '0.6542',  change_val: '-0.0015', change_pct: '-0.23', volume: '0' },
  // 大宗商品 / commodity
  { symbol: 'CL1',    name: 'WTI Crude Oil',         market: 'commodity', price: '78.45',   change_val: '-0.65', change_pct: '-0.82', volume: '420000' },
  { symbol: 'GC1',    name: 'Gold',                  market: 'commodity', price: '2345.60', change_val: '12.40', change_pct: '0.53',  volume: '180000' },
  { symbol: 'SI1',    name: 'Silver',                market: 'commodity', price: '28.92',   change_val: '0.18',  change_pct: '0.63',  volume: '95000'  },
  { symbol: 'NG1',    name: 'Natural Gas',           market: 'commodity', price: '2.185',   change_val: '-0.02', change_pct: '-0.91', volume: '320000' },
  { symbol: 'HG1',    name: 'Copper',                market: 'commodity', price: '4.285',   change_val: '0.045', change_pct: '1.06',  volume: '85000'  },
  { symbol: 'ZW1',    name: 'Wheat',                 market: 'commodity', price: '548.25',  change_val: '-3.50', change_pct: '-0.63', volume: '65000'  },
  // 指数 / index
  { symbol: 'SPX',    name: 'S&P 500',               market: 'index',     price: '5234.18', change_val: '18.40',  change_pct: '0.35',  volume: '0' },
  { symbol: 'NDX',    name: 'Nasdaq 100',            market: 'index',     price: '18245.60',change_val: '85.20',  change_pct: '0.47',  volume: '0' },
  { symbol: 'DJIA',   name: 'Dow Jones',             market: 'index',     price: '39218.54',change_val: '-42.10', change_pct: '-0.11', volume: '0' },
  { symbol: '000001', name: '上证指数',               market: 'index',     price: '3145.20', change_val: '12.80',  change_pct: '0.41',  volume: '0' },
  { symbol: '399001', name: '深证成指',               market: 'index',     price: '9842.50', change_val: '45.60',  change_pct: '0.47',  volume: '0' },
  { symbol: 'HSI',    name: '恒生指数',               market: 'index',     price: '17285.40',change_val: '-85.20', change_pct: '-0.49', volume: '0' },
  // 衍生品 / derivative
  { symbol: 'ESM4',   name: 'E-mini S&P 500 Jun',    market: 'derivative',price: '5240.25', change_val: '20.50', change_pct: '0.39',  volume: '1200000' },
  { symbol: 'NQM4',   name: 'E-mini Nasdaq Jun',     market: 'derivative',price: '18260.00',change_val: '88.00', change_pct: '0.48',  volume: '580000'  },
  { symbol: 'CLN4',   name: 'WTI Crude Jul Futures', market: 'derivative',price: '79.20',   change_val: '-0.45', change_pct: '-0.57', volume: '380000'  },
  // 期权 / option
  { symbol: 'AAPL240621C190', name: 'AAPL Jun21 190 Call', market: 'option', price: '4.85', change_val: '0.35',  change_pct: '7.78',  volume: '25000' },
  { symbol: 'SPY240621P520',  name: 'SPY Jun21 520 Put',   market: 'option', price: '3.20', change_val: '-0.15', change_pct: '-4.48', volume: '18000' },
  { symbol: 'TSLA240621C250', name: 'TSLA Jun21 250 Call', market: 'option', price: '8.40', change_val: '-1.20', change_pct: '-12.5', volume: '42000' },
  { symbol: 'QQQ240621P440',  name: 'QQQ Jun21 440 Put',   market: 'option', price: '2.95', change_val: '0.25',  change_pct: '9.26',  volume: '15000' },
  { symbol: 'NVDA240621C900', name: 'NVDA Jun21 900 Call', market: 'option', price: '12.60',change_val: '1.80',  change_pct: '16.67', volume: '32000' },
  // 基金 / fund
  { symbol: 'SPY',    name: 'SPDR S&P 500 ETF',      market: 'fund',      price: '523.45',  change_val: '1.85',  change_pct: '0.35',  volume: '68000000' },
  { symbol: 'QQQ',    name: 'Invesco QQQ Trust',     market: 'fund',      price: '445.20',  change_val: '2.10',  change_pct: '0.47',  volume: '42000000' },
  { symbol: 'GLD',    name: 'SPDR Gold Shares',      market: 'fund',      price: '221.80',  change_val: '0.95',  change_pct: '0.43',  volume: '8500000'  },
  { symbol: '110010', name: '易方达上证50增强A',       market: 'fund',      price: '1.2350',  change_val: '0.0050',change_pct: '0.41',  volume: '5000000'  },
  { symbol: '000001F',name: '华夏成长混合',            market: 'fund',      price: '1.5680',  change_val: '0.0120',change_pct: '0.77',  volume: '3200000'  },
  { symbol: 'IEF',    name: 'iShares 7-10yr Treasury',market: 'fund',     price: '96.45',   change_val: '-0.25', change_pct: '-0.26', volume: '12000000' },
  // 债券 / bond
  { symbol: 'US10Y',  name: 'US 10Y Treasury',       market: 'bond',      price: '4.285',   change_val: '0.025', change_pct: '0.59',  volume: '0' },
  { symbol: 'US2Y',   name: 'US 2Y Treasury',        market: 'bond',      price: '4.825',   change_val: '-0.015',change_pct: '-0.31', volume: '0' },
  { symbol: 'US30Y',  name: 'US 30Y Treasury',       market: 'bond',      price: '4.485',   change_val: '0.030', change_pct: '0.67',  volume: '0' },
  { symbol: 'CN10Y',  name: '中国10年国债',            market: 'bond',      price: '2.285',   change_val: '-0.005',change_pct: '-0.22', volume: '0' },
  { symbol: 'DE10Y',  name: 'Germany 10Y Bund',      market: 'bond',      price: '2.485',   change_val: '0.015', change_pct: '0.61',  volume: '0' },
  { symbol: 'JP10Y',  name: 'Japan 10Y JGB',         market: 'bond',      price: '0.985',   change_val: '0.005', change_pct: '0.51',  volume: '0' },
];

let inserted = 0, updated = 0;
for (const r of records) {
  const [result] = await conn.execute(
    `INSERT INTO market_data (symbol, name, market, price, change_val, change_pct, volume)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), market=VALUES(market),
       price=VALUES(price), change_val=VALUES(change_val),
       change_pct=VALUES(change_pct), volume=VALUES(volume)`,
    [r.symbol, r.name, r.market, r.price, r.change_val, r.change_pct, r.volume]
  );
  if (result.affectedRows === 1) inserted++;
  else updated++;
}

const [count] = await conn.execute('SELECT COUNT(*) as cnt FROM market_data');
console.log(`✅ market_data: inserted=${inserted}, updated=${updated}, total=${count[0].cnt}`);
process.exit(0);
