import 'dotenv/config';
import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const etfs = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', name_en: 'SPDR S&P 500 ETF Trust', price: '523.45', nav: '523.12', change_val: '1.85', change_pct: '0.35', fund_type: 'ETF', asset_class: 'Equity', region: 'US', rating: 'AAA' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', name_en: 'Invesco QQQ Trust', price: '445.20', nav: '444.90', change_val: '2.10', change_pct: '0.47', fund_type: 'ETF', asset_class: 'Equity', region: 'US', rating: 'AAA' },
  { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', name_en: 'iShares Core S&P 500 ETF', price: '524.80', nav: '524.50', change_val: '1.90', change_pct: '0.36', fund_type: 'ETF', asset_class: 'Equity', region: 'US', rating: 'AAA' },
  { symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', name_en: 'iShares Core US Aggregate Bond ETF', price: '98.50', nav: '98.45', change_val: '-0.10', change_pct: '-0.10', fund_type: 'ETF', asset_class: 'Bond', region: 'US', rating: 'AAA' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', name_en: 'Vanguard Total Bond Market ETF', price: '74.20', nav: '74.15', change_val: '-0.05', change_pct: '-0.07', fund_type: 'ETF', asset_class: 'Bond', region: 'US', rating: 'AAA' },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', name_en: 'Vanguard FTSE Developed Markets ETF', price: '52.30', nav: '52.25', change_val: '0.30', change_pct: '0.58', fund_type: 'ETF', asset_class: 'Equity', region: 'International', rating: 'AA' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', name_en: 'iShares MSCI Emerging Markets ETF', price: '43.80', nav: '43.75', change_val: '0.20', change_pct: '0.46', fund_type: 'ETF', asset_class: 'Equity', region: 'Emerging', rating: 'A' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', name_en: 'SPDR Gold Shares', price: '221.80', nav: '221.60', change_val: '0.95', change_pct: '0.43', fund_type: 'ETF', asset_class: 'Commodity', region: 'Global', rating: 'AAA' },
  { symbol: 'DBC', name: 'Invesco DB Commodity Index Tracking Fund', name_en: 'Invesco DB Commodity Index Tracking Fund', price: '22.50', nav: '22.45', change_val: '-0.15', change_pct: '-0.66', fund_type: 'ETF', asset_class: 'Commodity', region: 'Global', rating: 'A' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', name_en: 'Energy Select Sector SPDR Fund', price: '91.20', nav: '91.10', change_val: '-0.80', change_pct: '-0.87', fund_type: 'ETF', asset_class: 'Equity', region: 'US', rating: 'AA' },
];

for (const e of etfs) {
  try {
    await conn.execute(
      'INSERT IGNORE INTO etf_products (symbol, name, name_en, price, nav, change_val, change_pct, fund_type, asset_class, region, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [e.symbol, e.name, e.name_en, e.price, e.nav, e.change_val, e.change_pct, e.fund_type, e.asset_class, e.region, e.rating]
    );
  } catch(err) { console.log('ERR:', e.symbol, err.message.slice(0,60)); }
}
console.log(`✓ ETF data seeded: ${etfs.length} records`);
await conn.end();
console.log('Done');
