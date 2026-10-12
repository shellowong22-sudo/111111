import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const etfs = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', name_en: 'SPDR S&P 500 ETF Trust', price: '523.45', nav: '523.12', change_val: '1.85', change_pct: '0.35', volume: '68000000', fund_type: 'Equity', asset_class: 'Large Cap', region: 'US', rating: 'AAA', description: 'Tracks the S&P 500 Index', expense_ratio: '0.0945%', aum: '$500B' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', name_en: 'Invesco QQQ Trust', price: '445.20', nav: '444.95', change_val: '2.10', change_pct: '0.47', volume: '42000000', fund_type: 'Equity', asset_class: 'Large Cap Growth', region: 'US', rating: 'AAA', description: 'Tracks the Nasdaq-100 Index', expense_ratio: '0.20%', aum: '$250B' },
  { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', name_en: 'iShares Core S&P 500 ETF', price: '525.80', nav: '525.50', change_val: '1.90', change_pct: '0.36', volume: '5000000', fund_type: 'Equity', asset_class: 'Large Cap', region: 'US', rating: 'AAA', description: 'Tracks the S&P 500 Index', expense_ratio: '0.03%', aum: '$450B' },
  { symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', name_en: 'iShares Core US Aggregate Bond ETF', price: '96.50', nav: '96.45', change_val: '-0.10', change_pct: '-0.10', volume: '8000000', fund_type: 'Fixed Income', asset_class: 'Bond', region: 'US', rating: 'AAA', description: 'Tracks the Bloomberg US Aggregate Bond Index', expense_ratio: '0.03%', aum: '$100B' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', name_en: 'Vanguard Total Bond Market ETF', price: '73.20', nav: '73.15', change_val: '-0.08', change_pct: '-0.11', volume: '6000000', fund_type: 'Fixed Income', asset_class: 'Bond', region: 'US', rating: 'AAA', description: 'Tracks the Bloomberg US Aggregate Float Adjusted Index', expense_ratio: '0.03%', aum: '$80B' },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', name_en: 'Vanguard FTSE Developed Markets ETF', price: '48.90', nav: '48.85', change_val: '0.25', change_pct: '0.51', volume: '12000000', fund_type: 'Equity', asset_class: 'International', region: 'International', rating: 'AA', description: 'Tracks the FTSE Developed All Cap ex US Index', expense_ratio: '0.05%', aum: '$120B' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', name_en: 'iShares MSCI Emerging Markets ETF', price: '42.15', nav: '42.10', change_val: '-0.30', change_pct: '-0.71', volume: '35000000', fund_type: 'Equity', asset_class: 'Emerging Markets', region: 'EM', rating: 'A', description: 'Tracks the MSCI Emerging Markets Index', expense_ratio: '0.70%', aum: '$20B' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', name_en: 'SPDR Gold Shares', price: '221.80', nav: '221.75', change_val: '0.95', change_pct: '0.43', volume: '8500000', fund_type: 'Commodity', asset_class: 'Gold', region: 'Global', rating: 'AAA', description: 'Tracks the price of gold bullion', expense_ratio: '0.40%', aum: '$60B' },
  { symbol: 'DBC', name: 'Invesco DB Commodity Index Tracking Fund', name_en: 'Invesco DB Commodity Index Tracking Fund', price: '22.40', nav: '22.38', change_val: '-0.15', change_pct: '-0.67', volume: '2000000', fund_type: 'Commodity', asset_class: 'Commodity', region: 'Global', rating: 'A', description: 'Tracks a basket of commodities', expense_ratio: '0.85%', aum: '$2B' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', name_en: 'Energy Select Sector SPDR Fund', price: '88.50', nav: '88.45', change_val: '-0.80', change_pct: '-0.90', volume: '15000000', fund_type: 'Equity', asset_class: 'Sector', region: 'US', rating: 'AA', description: 'Tracks the Energy Select Sector Index', expense_ratio: '0.09%', aum: '$35B' },
];

let count = 0;
for (const etf of etfs) {
  try {
    await conn.execute(
      `INSERT INTO etf_products (symbol, name, name_en, price, nav, change_val, change_pct, volume, fund_type, asset_class, region, rating, description, expense_ratio, aum)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), change_val=VALUES(change_val), change_pct=VALUES(change_pct)`,
      [etf.symbol, etf.name, etf.name_en, etf.price, etf.nav, etf.change_val, etf.change_pct, etf.volume, etf.fund_type, etf.asset_class, etf.region, etf.rating, etf.description, etf.expense_ratio, etf.aum]
    );
    count++;
    console.log(`✓ ${etf.symbol}`);
  } catch (e) {
    console.error(`✗ ${etf.symbol}: ${e.message}`);
  }
}

await conn.end();
console.log(`ETF seed complete: ${count} records`);
