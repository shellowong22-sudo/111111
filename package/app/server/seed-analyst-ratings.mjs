/**
 * 为热门股票导入历史分析师评级种子数据
 * 覆盖 NVDA / AAPL / MSFT / TSLA / META / AMZN / GOOGL / AMD
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log('[DB] Connected');

// 评级变更类型
const CHG_TYPES = ['upgrade', 'downgrade', 'target_up', 'target_down', 'initiate', 'maintain'];
const RATINGS = ['强烈买入', '买入', '增持', '中性', '持有', '减持', '卖出'];
const FIRMS = [
  'Goldman Sachs', 'Morgan Stanley', 'JPMorgan', 'Citi', 'Bank of America',
  'UBS', 'Deutsche Bank', 'Barclays', 'Wells Fargo', 'Jefferies',
  'Piper Sandler', 'Needham', 'Wedbush', 'KeyBanc', 'Mizuho',
];

// 每只股票的基础数据
const STOCKS = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', basePrice: 135, targetRange: [120, 200] },
  { ticker: 'AAPL', name: 'Apple Inc.', basePrice: 213, targetRange: [190, 260] },
  { ticker: 'MSFT', name: 'Microsoft Corporation', basePrice: 445, targetRange: [400, 520] },
  { ticker: 'TSLA', name: 'Tesla Inc.', basePrice: 248, targetRange: [180, 380] },
  { ticker: 'META', name: 'Meta Platforms Inc.', basePrice: 582, targetRange: [520, 700] },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', basePrice: 204, targetRange: [185, 260] },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', basePrice: 178, targetRange: [160, 220] },
  { ticker: 'AMD',  name: 'Advanced Micro Devices', basePrice: 168, targetRange: [140, 220] },
];

// 分析师名字生成
const ANALYSTS = [
  'David Vogt', 'Katy Huberty', 'Mark Mahaney', 'Ross Seymore', 'Vivek Arya',
  'Chris Caso', 'Stacy Rasgon', 'Timothy Arcuri', 'C.J. Muse', 'Harlan Sur',
  'Joseph Moore', 'Toshiya Hari', 'Brian Nowak', 'Doug Anmuth', 'Eric Sheridan',
];

function rand(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// 为每只股票生成 25-35 条历史评级记录（跨越 2 年）
const rows = [];
for (const stock of STOCKS) {
  const count = randInt(25, 35);
  let prevRating = RATINGS[randInt(0, 2)]; // 起始多为买入
  let prevTarget = rand(stock.targetRange[0], stock.targetRange[1]);

  for (let i = 0; i < count; i++) {
    const daysBack = Math.floor((count - i) * (730 / count)) + randInt(0, 7);
    const firm = FIRMS[randInt(0, FIRMS.length - 1)];
    const analyst = ANALYSTS[randInt(0, ANALYSTS.length - 1)];
    const currentPrice = rand(stock.basePrice * 0.7, stock.basePrice * 1.3);

    // 决定本次评级变更
    let rating = prevRating;
    let chg = 'maintain';
    let target = prevTarget;

    const roll = Math.random();
    if (roll < 0.12) {
      // 升级
      const idx = RATINGS.indexOf(prevRating);
      rating = RATINGS[Math.max(0, idx - 1)];
      chg = 'upgrade';
    } else if (roll < 0.22) {
      // 降级
      const idx = RATINGS.indexOf(prevRating);
      rating = RATINGS[Math.min(RATINGS.length - 1, idx + 1)];
      chg = 'downgrade';
    } else if (roll < 0.45) {
      // 目标价上调
      target = rand(prevTarget * 1.03, prevTarget * 1.20);
      chg = 'target_up';
    } else if (roll < 0.60) {
      // 目标价下调
      target = rand(prevTarget * 0.82, prevTarget * 0.97);
      chg = 'target_down';
    } else if (i === 0) {
      chg = 'initiate';
    }

    target = Math.round(target * 100) / 100;
    const upside = currentPrice > 0 ? Math.round((target - currentPrice) / currentPrice * 10000) / 100 : null;

    rows.push({
      ticker: stock.ticker,
      name: stock.name,
      analyst,
      firm,
      rating,
      prev_rating: prevRating,
      target,
      prev_target: prevTarget,
      chg,
      rating_type: chg,
      current_price: currentPrice,
      upside,
      rated_at: daysAgo(daysBack),
    });

    prevRating = rating;
    prevTarget = target;
  }
}

// 批量插入
let inserted = 0;
for (const r of rows) {
  try {
    await conn.execute(
      `INSERT INTO analyst_ratings
        (ticker, name, analyst, firm, rating, prev_rating, target, prev_target,
         chg, rating_type, current_price, upside, rated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.ticker, r.name, r.analyst, r.firm, r.rating, r.prev_rating,
       r.target, r.prev_target, r.chg, r.rating_type,
       r.current_price, r.upside, r.rated_at]
    );
    inserted++;
  } catch (err) {
    console.error(`[ERR] ${r.ticker}:`, err.message);
  }
}

const [countRows] = await conn.execute('SELECT COUNT(*) as cnt FROM analyst_ratings');
console.log(`[Done] Inserted ${inserted}/${rows.length} rows. Total in DB: ${countRows[0].cnt}`);
await conn.end();
