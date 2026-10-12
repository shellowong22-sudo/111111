/**
 * seed-all-data.mjs
 * 导入所有样本数据：曲线分类/地区/曲线/数据点/ETF/基金
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. 曲线分类
const categories = [
  { name: 'Government', description: '政府债券曲线', icon: 'gov' },
  { name: 'Corporate', description: '公司债券曲线', icon: 'corp' },
  { name: 'CDS', description: '信用违约互换曲线', icon: 'cds' },
  { name: 'Municipal', description: '市政债券曲线', icon: 'muni' },
  { name: 'Agency', description: '机构债券曲线', icon: 'agency' },
];
for (const cat of categories) {
  await conn.execute(
    'INSERT IGNORE INTO curve_categories (name, description, icon) VALUES (?, ?, ?)',
    [cat.name, cat.description, cat.icon]
  );
}
console.log(`✓ 曲线分类导入完成（${categories.length} 条）`);

// 2. 曲线地区
const regions = [
  { name: 'Americas', description: '美洲地区', countries: 'US,CA,BR,MX' },
  { name: 'Europe', description: '欧洲地区', countries: 'DE,FR,GB,IT,ES' },
  { name: 'Asia Pacific', description: '亚太地区', countries: 'CN,JP,KR,AU,IN' },
  { name: 'Global', description: '全球', countries: 'Global' },
];
for (const r of regions) {
  await conn.execute(
    'INSERT IGNORE INTO curve_regions (name, description, countries) VALUES (?, ?, ?)',
    [r.name, r.description, r.countries]
  );
}
console.log(`✓ 曲线地区导入完成（${regions.length} 条）`);

// 3. 曲线数据
const curves = [
  { curve_id: 'US-GOVT', name: '美国国债收益率曲线', name_en: 'US Treasury Yield Curve', country: 'US', region: 'Americas', currency: 'USD', type: 'Government' },
  { curve_id: 'DE-GOVT', name: '德国国债收益率曲线', name_en: 'German Bund Yield Curve', country: 'DE', region: 'Europe', currency: 'EUR', type: 'Government' },
  { curve_id: 'GB-GOVT', name: '英国国债收益率曲线', name_en: 'UK Gilt Yield Curve', country: 'GB', region: 'Europe', currency: 'GBP', type: 'Government' },
  { curve_id: 'JP-GOVT', name: '日本国债收益率曲线', name_en: 'Japan JGB Yield Curve', country: 'JP', region: 'Asia Pacific', currency: 'JPY', type: 'Government' },
  { curve_id: 'CN-GOVT', name: '中国国债收益率曲线', name_en: 'China Treasury Yield Curve', country: 'CN', region: 'Asia Pacific', currency: 'CNY', type: 'Government' },
  { curve_id: 'US-CORP-IG', name: '美国投资级公司债曲线', name_en: 'US IG Corporate Curve', country: 'US', region: 'Americas', currency: 'USD', type: 'Corporate' },
  { curve_id: 'US-CORP-HY', name: '美国高收益公司债曲线', name_en: 'US HY Corporate Curve', country: 'US', region: 'Americas', currency: 'USD', type: 'Corporate' },
  { curve_id: 'EUR-CORP-IG', name: '欧元区投资级公司债曲线', name_en: 'EUR IG Corporate Curve', country: 'EU', region: 'Europe', currency: 'EUR', type: 'Corporate' },
  { curve_id: 'US-CDS-5Y', name: '美国5年期CDS曲线', name_en: 'US 5Y CDS Curve', country: 'US', region: 'Americas', currency: 'USD', type: 'CDS' },
  { curve_id: 'EU-CDS-5Y', name: '欧洲5年期CDS曲线', name_en: 'EU 5Y CDS Curve', country: 'EU', region: 'Europe', currency: 'EUR', type: 'CDS' },
];
for (const c of curves) {
  await conn.execute(
    'INSERT IGNORE INTO curves (curve_id, name, country, region, currency, type) VALUES (?, ?, ?, ?, ?, ?)',
    [c.curve_id, c.name, c.country, c.region, c.currency, c.type]
  );
}
console.log(`✓ 曲线数据导入完成（${curves.length} 条）`);

// 4. 曲线数据点（与 Drizzle 当前表结构对齐: curve_id, data_date, period, value）
const [curveRows] = await conn.execute('SELECT id, curve_id FROM curves');
const curveMap = {};
for (const row of curveRows) curveMap[row.curve_id] = row.id;

const today = new Date().toISOString().split('T')[0];
const tenors = [
  { tenor: '1M', tenor_years: 0.083 },
  { tenor: '3M', tenor_years: 0.25 },
  { tenor: '6M', tenor_years: 0.5 },
  { tenor: '1Y', tenor_years: 1 },
  { tenor: '2Y', tenor_years: 2 },
  { tenor: '3Y', tenor_years: 3 },
  { tenor: '5Y', tenor_years: 5 },
  { tenor: '7Y', tenor_years: 7 },
  { tenor: '10Y', tenor_years: 10 },
  { tenor: '20Y', tenor_years: 20 },
  { tenor: '30Y', tenor_years: 30 },
];

// US Treasury rates (approx)
const usRates = [5.28, 5.35, 5.30, 5.10, 4.75, 4.55, 4.35, 4.30, 4.25, 4.45, 4.40];
// German Bund rates
const deRates = [3.85, 3.90, 3.82, 3.70, 3.20, 3.00, 2.80, 2.75, 2.72, 2.90, 2.85];
// UK Gilt rates
const gbRates = [5.10, 5.15, 5.05, 4.90, 4.50, 4.35, 4.20, 4.18, 4.15, 4.35, 4.30];

const curveRates = {
  'US-GOVT': usRates,
  'DE-GOVT': deRates,
  'GB-GOVT': gbRates,
  'JP-GOVT': [-0.10, -0.05, 0.05, 0.10, 0.20, 0.35, 0.60, 0.80, 0.95, 1.50, 1.80],
  'CN-GOVT': [1.80, 1.85, 1.90, 1.95, 2.10, 2.20, 2.35, 2.45, 2.55, 2.80, 2.95],
  'US-CORP-IG': usRates.map(r => r + 1.2),
  'US-CORP-HY': usRates.map(r => r + 3.5),
  'EUR-CORP-IG': deRates.map(r => r + 1.1),
  'US-CDS-5Y': [20, 22, 25, 28, 32, 35, 40, 45, 50, 60, 65],
  'EU-CDS-5Y': [25, 28, 30, 33, 38, 42, 48, 52, 58, 68, 72],
};

let dpCount = 0;
for (const [cid, rates] of Object.entries(curveRates)) {
  const dbId = curveMap[cid];
  if (!dbId) continue;
  for (let i = 0; i < tenors.length; i++) {
    try {
      await conn.execute(
        'INSERT IGNORE INTO curve_data_points (curve_id, data_date, period, value) VALUES (?, ?, ?, ?)',
        [dbId, today, tenors[i].tenor, String(rates[i])]
      );
      dpCount++;
    } catch (e) {
      // skip
    }
  }
}
console.log(`✓ 曲线数据点导入完成（${dpCount} 条）`);

// 5. ETF产品（使用实际表结构，无name_en字段）
const etfs = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: '523.45', nav: '523.12', change_val: '1.85', change_pct: '0.35', volume: '68000000', fund_type: 'Equity', asset_class: 'Large Cap', region: 'US', rating: 'AAA' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: '445.20', nav: '444.98', change_val: '2.10', change_pct: '0.47', volume: '42000000', fund_type: 'Equity', asset_class: 'Tech', region: 'US', rating: 'AAA' },
  { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', price: '524.80', nav: '524.55', change_val: '1.90', change_pct: '0.36', volume: '15000000', fund_type: 'Equity', asset_class: 'Large Cap', region: 'US', rating: 'AAA' },
  { symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', price: '96.45', nav: '96.38', change_val: '-0.12', change_pct: '-0.12', volume: '8000000', fund_type: 'Bond', asset_class: 'Fixed Income', region: 'US', rating: 'AAA' },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', price: '72.80', nav: '72.75', change_val: '-0.08', change_pct: '-0.11', volume: '5000000', fund_type: 'Bond', asset_class: 'Fixed Income', region: 'US', rating: 'AAA' },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', price: '48.25', nav: '48.18', change_val: '0.35', change_pct: '0.73', volume: '12000000', fund_type: 'Equity', asset_class: 'International', region: 'Developed', rating: 'AA' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', price: '42.10', nav: '42.05', change_val: '-0.25', change_pct: '-0.59', volume: '18000000', fund_type: 'Equity', asset_class: 'Emerging', region: 'EM', rating: 'A' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', price: '218.50', nav: '218.42', change_val: '1.20', change_pct: '0.55', volume: '6000000', fund_type: 'Commodity', asset_class: 'Gold', region: 'Global', rating: 'AA' },
  { symbol: 'DBC', name: 'Invesco DB Commodity Index Tracking Fund', price: '24.35', nav: '24.30', change_val: '-0.15', change_pct: '-0.61', volume: '2000000', fund_type: 'Commodity', asset_class: 'Commodities', region: 'Global', rating: 'A' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', price: '88.40', nav: '88.35', change_val: '-0.80', change_pct: '-0.90', volume: '10000000', fund_type: 'Equity', asset_class: 'Energy', region: 'US', rating: 'AA' },
];
let etfCount = 0;
for (const e of etfs) {
  try {
    await conn.execute(
      'INSERT IGNORE INTO etf_products (symbol, name, price, nav, change_val, change_pct, volume, fund_type, asset_class, region, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [e.symbol, e.name, e.price, e.nav, e.change_val, e.change_pct, e.volume, e.fund_type, e.asset_class, e.region, e.rating]
    );
    etfCount++;
  } catch (err) {
    console.warn(`ETF ${e.symbol} 插入失败: ${err.message}`);
  }
}
console.log(`✓ ETF产品导入完成（${etfCount} 条）`);

// 6. 基金数据（fund_data表）
const [fundCols] = await conn.execute('DESCRIBE fund_data');
const fundColNames = fundCols.map(c => c.Field);
console.log('fund_data columns:', fundColNames);

const funds = [
  { symbol: 'VFINX', name: 'Vanguard 500 Index Fund', price: '480.25', change_val: '1.68', change_pct: '0.35', fund_type: 'Index', asset_class: 'Equity' },
  { symbol: 'FCNTX', name: 'Fidelity Contrafund', price: '18.45', change_val: '0.12', change_pct: '0.65', fund_type: 'Active', asset_class: 'Equity' },
  { symbol: 'AGTHX', name: 'American Funds Growth Fund of America', price: '68.90', change_val: '0.45', change_pct: '0.66', fund_type: 'Active', asset_class: 'Equity' },
  { symbol: 'VBTLX', name: 'Vanguard Total Bond Market Index Fund', price: '9.85', change_val: '-0.02', change_pct: '-0.20', fund_type: 'Index', asset_class: 'Bond' },
  { symbol: 'PTTRX', name: 'PIMCO Total Return Fund', price: '8.42', change_val: '-0.03', change_pct: '-0.36', fund_type: 'Active', asset_class: 'Bond' },
];
let fundCount = 0;
for (const f of funds) {
  try {
    const cols = ['symbol', 'name', 'price', 'change_val', 'change_pct', 'fund_type', 'asset_class'].filter(c => fundColNames.includes(c));
    const vals = cols.map(c => f[c]);
    await conn.execute(
      `INSERT IGNORE INTO fund_data (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      vals
    );
    fundCount++;
  } catch (err) {
    console.warn(`Fund ${f.symbol} 插入失败: ${err.message}`);
  }
}
console.log(`✓ 基金数据导入完成（${fundCount} 条）`);

await conn.end();
console.log('\n✅ 所有数据导入完成！');
