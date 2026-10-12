import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('开始导入曲线和 ETF 样本数据...\n');

  // 1. 插入曲线分类
  const categories = [
    { name: 'Government', description: '政府债券曲线', icon: 'gov' },
    { name: 'Corporate', description: '公司债券曲线', icon: 'corp' },
    { name: 'CDS', description: '信用违约互换曲线', icon: 'cds' },
    { name: 'Municipal', description: '市政债券曲线', icon: 'muni' },
    { name: 'Agency', description: '机构债券曲线', icon: 'agency' },
  ];

  for (const cat of categories) {
    await connection.execute(
      'INSERT IGNORE INTO curve_categories (name, description, icon) VALUES (?, ?, ?)',
      [cat.name, cat.description, cat.icon]
    );
  }
  console.log('✓ 曲线分类导入完成（5 条）');

  // 2. 插入曲线地区
  const regions = [
    { name: '美洲', countries: JSON.stringify(['美国', '加拿大', '巴西', '墨西哥']) },
    { name: '欧洲', countries: JSON.stringify(['英国', '法国', '德国', '意大利', '西班牙']) },
    { name: '亚太', countries: JSON.stringify(['日本', '中国', '澳大利亚', '新加坡', '香港']) },
    { name: '新兴市场', countries: JSON.stringify(['俄罗斯', '印度', '巴西', '南非', '泰国']) },
  ];

  for (const region of regions) {
    await connection.execute(
      'INSERT IGNORE INTO curve_regions (name, countries) VALUES (?, ?)',
      [region.name, region.countries]
    );
  }
  console.log('✓ 曲线地区导入完成（4 条）');

  // 3. 插入曲线数据
  const curves = [
    // 美国政府债券
    { curveId: 'USGG10YR', name: '美国 10 年期政府债券收益率', nameEn: 'US 10Y Government Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Government', categoryId: 1 },
    { curveId: 'USGG2YR', name: '美国 2 年期政府债券收益率', nameEn: 'US 2Y Government Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Government', categoryId: 1 },
    { curveId: 'USGG5YR', name: '美国 5 年期政府债券收益率', nameEn: 'US 5Y Government Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Government', categoryId: 1 },
    { curveId: 'USGG30YR', name: '美国 30 年期政府债券收益率', nameEn: 'US 30Y Government Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Government', categoryId: 1 },
    
    // 英国政府债券
    { curveId: 'GUKG10', name: '英国 10 年期政府债券收益率', nameEn: 'UK 10Y Government Curve', country: '英国', region: '欧洲', currency: 'GBP', type: 'Government', categoryId: 1 },
    { curveId: 'GUKG2', name: '英国 2 年期政府债券收益率', nameEn: 'UK 2Y Government Curve', country: '英国', region: '欧洲', currency: 'GBP', type: 'Government', categoryId: 1 },
    
    // 德国政府债券
    { curveId: 'GDBR10', name: '德国 10 年期政府债券收益率', nameEn: 'Germany 10Y Government Curve', country: '德国', region: '欧洲', currency: 'EUR', type: 'Government', categoryId: 1 },
    { curveId: 'GDBR2', name: '德国 2 年期政府债券收益率', nameEn: 'Germany 2Y Government Curve', country: '德国', region: '欧洲', currency: 'EUR', type: 'Government', categoryId: 1 },
    
    // 日本政府债券
    { curveId: 'JGBK10', name: '日本 10 年期政府债券收益率', nameEn: 'Japan 10Y Government Curve', country: '日本', region: '亚太', currency: 'JPY', type: 'Government', categoryId: 1 },
    { curveId: 'JGBK2', name: '日本 2 年期政府债券收益率', nameEn: 'Japan 2Y Government Curve', country: '日本', region: '亚太', currency: 'JPY', type: 'Government', categoryId: 1 },
    
    // 美国公司债券
    { curveId: 'USCC10', name: '美国 10 年期 AAA 级公司债券收益率', nameEn: 'US 10Y AAA Corporate Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Corporate', categoryId: 2 },
    { curveId: 'USCC5', name: '美国 5 年期 BBB 级公司债券收益率', nameEn: 'US 5Y BBB Corporate Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Corporate', categoryId: 2 },
    
    // 欧洲公司债券
    { curveId: 'EUCC10', name: '欧洲 10 年期 AAA 级公司债券收益率', nameEn: 'Europe 10Y AAA Corporate Curve', country: '欧元区', region: '欧洲', currency: 'EUR', type: 'Corporate', categoryId: 2 },
    
    // CDS 曲线
    { curveId: 'USCD5', name: '美国 5 年期 CDS 曲线', nameEn: 'US 5Y CDS Curve', country: '美国', region: '美洲', currency: 'USD', type: 'CDS', categoryId: 3 },
    { curveId: 'EUCD5', name: '欧元区 5 年期 CDS 曲线', nameEn: 'EUR 5Y CDS Curve', country: '欧元区', region: '欧洲', currency: 'EUR', type: 'CDS', categoryId: 3 },
    
    // 市政债券
    { curveId: 'MUNI10', name: '美国市政债券 10 年期收益率', nameEn: 'US Municipal 10Y Curve', country: '美国', region: '美洲', currency: 'USD', type: 'Municipal', categoryId: 4 },
  ];

  let curveCount = 0;
  for (const curve of curves) {
    try {
      await connection.execute(
        'INSERT IGNORE INTO curves (curve_id, name, name_en, country, region, currency, type, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [curve.curveId, curve.name, curve.nameEn, curve.country, curve.region, curve.currency, curve.type, curve.categoryId]
      );
      curveCount++;
    } catch (err) {
      console.error(`插入曲线 ${curve.curveId} 失败:`, err.message);
    }
  }
  console.log(`✓ 曲线数据导入完成（${curveCount} 条）`);

  // 4. 插入曲线数据点（历史数据）
  const today = new Date();
  const dataPoints = [];
  
  for (let i = 0; i < curves.length; i++) {
    const periods = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'];
    for (let p = 0; p < periods.length; p++) {
      // 生成过去 30 天的数据
      for (let d = 0; d < 30; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split('T')[0];
        
        // 生成模拟收益率数据（基础值 + 随机波动）
        const baseRate = 2.5 + p * 0.3 + Math.random() * 2;
        const value = (baseRate + (Math.random() - 0.5) * 0.5).toFixed(4);
        
        dataPoints.push({
          curveId: i + 1,
          dataDate: dateStr,
          period: periods[p],
          value: value
        });
      }
    }
  }

  // 批量插入数据点（每 100 条一批）
  let pointCount = 0;
  for (let i = 0; i < dataPoints.length; i += 100) {
    const batch = dataPoints.slice(i, i + 100);
    const placeholders = batch.map(() => '(?, ?, ?, ?)').join(',');
    const values = batch.flatMap(p => [p.curveId, p.dataDate, p.period, p.value]);
    
    try {
      await connection.execute(
        `INSERT IGNORE INTO curve_data_points (curve_id, data_date, period, value) VALUES ${placeholders}`,
        values
      );
      pointCount += batch.length;
    } catch (err) {
      console.error(`插入数据点批次失败:`, err.message);
    }
  }
  console.log(`✓ 曲线数据点导入完成（${pointCount} 条）`);

  // 5. 插入 ETF 产品数据
  const etfProducts = [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', nameEn: 'SPY', price: '450.25', nav: '450.25', changeVal: '2.50', changePct: '0.56%', fundType: 'Equity', assetClass: 'US Equity', region: '美洲', rating: 'AAA' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', nameEn: 'QQQ', price: '380.15', nav: '380.15', changeVal: '3.20', changePct: '0.85%', fundType: 'Equity', assetClass: 'US Tech', region: '美洲', rating: 'AAA' },
    { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', nameEn: 'IVV', price: '448.90', nav: '448.90', changeVal: '2.35', changePct: '0.53%', fundType: 'Equity', assetClass: 'US Equity', region: '美洲', rating: 'AAA' },
    { symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', nameEn: 'AGG', price: '95.50', nav: '95.50', changeVal: '-0.15', changePct: '-0.16%', fundType: 'Fixed Income', assetClass: 'US Bonds', region: '美洲', rating: 'AA' },
    { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', nameEn: 'BND', price: '76.80', nav: '76.80', changeVal: '-0.10', changePct: '-0.13%', fundType: 'Fixed Income', assetClass: 'US Bonds', region: '美洲', rating: 'AA' },
    { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', nameEn: 'VEA', price: '45.30', nav: '45.30', changeVal: '0.85', changePct: '1.91%', fundType: 'Equity', assetClass: 'International', region: '欧洲', rating: 'A' },
    { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF', nameEn: 'EEM', price: '38.50', nav: '38.50', changeVal: '1.20', changePct: '3.22%', fundType: 'Equity', assetClass: 'Emerging Markets', region: '新兴市场', rating: 'B' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', nameEn: 'GLD', price: '185.25', nav: '185.25', changeVal: '2.50', changePct: '1.37%', fundType: 'Commodity', assetClass: 'Precious Metals', region: '全球', rating: 'A' },
    { symbol: 'DBC', name: 'Commodities ETF', nameEn: 'DBC', price: '28.75', nav: '28.75', changeVal: '0.45', changePct: '1.59%', fundType: 'Commodity', assetClass: 'Broad Commodities', region: '全球', rating: 'B' },
    { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', nameEn: 'XLE', price: '72.50', nav: '72.50', changeVal: '1.85', changePct: '2.62%', fundType: 'Equity', assetClass: 'Energy', region: '美洲', rating: 'B' },
  ];

  let etfCount = 0;
  for (const etf of etfProducts) {
    try {
      await connection.execute(
        'INSERT IGNORE INTO etf_products (symbol, name, name_en, price, nav, change_val, change_pct, fund_type, asset_class, region, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [etf.symbol, etf.name, etf.nameEn, etf.price, etf.nav, etf.changeVal, etf.changePct, etf.fundType, etf.assetClass, etf.region, etf.rating]
      );
      etfCount++;
    } catch (err) {
      console.error(`插入 ETF ${etf.symbol} 失败:`, err.message);
    }
  }
  console.log(`✓ ETF 产品导入完成（${etfCount} 条）`);

  // 6. 插入 ETF 持仓数据
  const holdings = [
    { etfId: 1, holdingName: 'Apple Inc.', holdingType: 'Stock', weight: '7.2%' },
    { etfId: 1, holdingName: 'Microsoft Corp.', holdingType: 'Stock', weight: '6.8%' },
    { etfId: 1, holdingName: 'Alphabet Inc.', holdingType: 'Stock', weight: '3.9%' },
    { etfId: 1, holdingName: 'Amazon.com Inc.', holdingType: 'Stock', weight: '3.1%' },
    { etfId: 1, holdingName: 'Berkshire Hathaway', holdingType: 'Stock', weight: '1.6%' },
    
    { etfId: 2, holdingName: 'Apple Inc.', holdingType: 'Stock', weight: '12.5%' },
    { etfId: 2, holdingName: 'Microsoft Corp.', holdingType: 'Stock', weight: '11.8%' },
    { etfId: 2, holdingName: 'Nvidia Corp.', holdingType: 'Stock', weight: '8.2%' },
    { etfId: 2, holdingName: 'Alphabet Inc.', holdingType: 'Stock', weight: '6.9%' },
    { etfId: 2, holdingName: 'Amazon.com Inc.', holdingType: 'Stock', weight: '5.1%' },
    
    { etfId: 4, holdingName: 'US Treasury Bonds', holdingType: 'Bond', weight: '35.2%' },
    { etfId: 4, holdingName: 'Corporate Bonds', holdingType: 'Bond', weight: '40.5%' },
    { etfId: 4, holdingName: 'Municipal Bonds', holdingType: 'Bond', weight: '15.3%' },
    { etfId: 4, holdingName: 'Cash', holdingType: 'Cash', weight: '9.0%' },
  ];

  let holdingCount = 0;
  for (const holding of holdings) {
    try {
      await connection.execute(
        'INSERT IGNORE INTO etf_holdings (etf_id, holding_name, holding_type, weight) VALUES (?, ?, ?, ?)',
        [holding.etfId, holding.holdingName, holding.holdingType, holding.weight]
      );
      holdingCount++;
    } catch (err) {
      console.error(`插入持仓数据失败:`, err.message);
    }
  }
  console.log(`✓ ETF 持仓导入完成（${holdingCount} 条）`);

  console.log('\n✅ 所有样本数据导入完成！');
  console.log(`总计：${categories.length} 个分类 + ${regions.length} 个地区 + ${curveCount} 条曲线 + ${pointCount} 个数据点 + ${etfCount} 个 ETF + ${holdingCount} 个持仓`);

} catch (error) {
  console.error('导入失败:', error);
  process.exit(1);
} finally {
  await connection.end();
}
