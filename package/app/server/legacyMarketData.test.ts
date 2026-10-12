import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildTankanForecastDeviation, calculateRegionalPaddConcentration, getEctrShippingSnapshot, inventorySeasonality, LEGACY_FIELD_COVERAGE, LEGACY_PUBLIC_SERIES, legacyMarketDataRouter, parseBoeBankRateCsv, parseBojLoanGrowthHtml, parseBojTankanHtml, parseComtradePartnerFlows, parseComtradeSectorFlows, parseEctrShippingCostCsv, parseLegacyEiaWorkbook, parseLegacyFredCsv } from './routers/legacyMarketData';

describe('遗留行情公开数据与来源治理', () => {
  it('ECTR 商品组解析保留实际流向，不能用贸易金额替代风险评分', () => {
    const rows = parseComtradeSectorFlows({ data: [
      { cmdCode: '27', flowCode: 'M', primaryValue: 251000000000 },
      { cmdCode: '27', flowCode: 'X', primaryValue: 91000000000 },
      { cmdCode: '85', flowCode: 'M', primaryValue: '485000000000' },
    ] }, 2024);
    expect(rows.find(row => row.commodityCode === '27')).toMatchObject({ imports: 251, exports: 91, balance: -160, status: 'available' });
    expect(rows.find(row => row.commodityCode === '85')).toMatchObject({ imports: 485, exports: null, balance: null, status: 'available' });
    expect(rows.find(row => row.commodityCode === '10')).toMatchObject({ imports: null, exports: null, balance: null, status: 'unavailable' });
  });
  it('仅登记受控的 FRED、EIA、BOE 与 BOJ 官方公共系列，并为每条系列声明来源、单位和非实时边界', () => {
    expect(LEGACY_PUBLIC_SERIES.map((item) => item.id)).toEqual(['SP500', 'VIXCLS', 'DGS2', 'DGS10', 'DEXUSEU', 'DEXJPUS', 'DCOILWTICO', 'WALCL', 'WRESBAL', 'FEDFUNDS', 'ECBDFR', 'ECBMRRFR', 'BOE_BANK_RATE', 'BOJ_LOAN_GROWTH', 'GASREGW', 'GASDESW', 'WCESTUS1', 'WGTSTUS1', 'WDISTUS1']);
    LEGACY_PUBLIC_SERIES.forEach((item) => { expect(item.sourceUrl).toMatch(/^https:\/\/(fred\.stlouisfed\.org\/series\/|www\.eia\.gov\/dnav\/pet\/hist_xls\/|www\.bankofengland\.co\.uk\/boeapps\/database\/|www\.stat-search\.boj\.or\.jp\/ssi\/mtshtml\/)/); expect(item.unit).not.toBe(''); expect(item.boundary).toMatch(/不是|不/); });
  });

  it('只从实际 CSV 观测构造最新值、变动和历史，不补造缺失点', () => {
    const parsed = parseLegacyFredCsv('DATE,SP500\n2026-08-18,6400.1\n2026-08-19,.\n2026-08-20,6412.6\n', LEGACY_PUBLIC_SERIES[0]!);
    expect(parsed).toMatchObject({ status: 'available', observationDate: '2026-08-20', value: 6412.6, change: 12.5 });
    expect(parsed.history).toEqual([{ date: '2026-08-18', value: 6400.1 }, { date: '2026-08-20', value: 6412.6 }]);
  });

  it('从 BOE 官方 CSV 与 BOJ 官方统计表实际行构造观察，不使用第三方转述或静态样例', () => {
    const boe = LEGACY_PUBLIC_SERIES.find((item) => item.id === 'BOE_BANK_RATE')!; const boj = LEGACY_PUBLIC_SERIES.find((item) => item.id === 'BOJ_LOAN_GROWTH')!;
    expect(parseBoeBankRateCsv('01 Jan 2026,3.75\n20 Aug 2026,3.75\n', boe)).toMatchObject({ observationDate: '2026-08-20', value: 3.75 });
    expect(parseBojLoanGrowthHtml('<tr nowrap align=right><th align=center>2026/04</th><td> 5.3</td><td> 3.4</td></tr><tr nowrap align=right><th align=center>2026/05</th><td> 5.6</td><td> 3.3</td></tr>', boj)).toMatchObject({ observationDate: '2026-05-01', value: 5.6, change: 0.3 });
  });

  it('EIA 工作簿仅解析实际周度行并忽略表尾空行，不生成 1899 年零值观察', () => {
    const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([['Back to Contents', 'Data 1'], ['Sourcekey', 'WGTSTUS1'], ['Date', 'Inventory'], [46248, 209378], [null, null]]); XLSX.utils.book_append_sheet(workbook, sheet, 'Data 1'); const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(parseLegacyEiaWorkbook(buffer)).toEqual([{ date: '2026-08-14', value: 209378 }]);
  });

  it('字段覆盖率目录登记 BOE、BOJ 与三条 EIA 跨产品库存字段，并维持受限字段真实空状态', () => {
    const states = new Map(LEGACY_FIELD_COVERAGE.map((item) => [item.field, item.state]));
    ['个券最新价、成交量与买卖价', '单券成交价、买卖价与订单簿', '实时可执行汇率与远期点', '实时货币市场成交与政策路径'].forEach((field) => expect(states.get(field)).toBe('true_empty'));
    ['美联储总资产', '英格兰银行官方 Bank Rate', '日本国内银行贷款同比', '美国商业原油库存（不含战略储备）', '美国成品汽油库存', '美国馏分燃料油库存'].forEach((field) => expect(states.get(field)).toBe('verified_public'));
  });

  it('公开路由提供 EIA 同周跨产品对比和受保护的账户时效检查入口', () => {
    const keys = Object.keys((legacyMarketDataRouter as any)._def.procedures);
    expect(keys).toEqual(expect.arrayContaining(['getInventoryComparison', 'getInventorySeasonality', 'getTankanIndustryComparison', 'getTankanForecastDeviation', 'getRegionalProductInventory', 'listInventorySeasonalityAlertRules', 'listInventorySeasonalityAlertEvents', 'saveInventorySeasonalityAlertRule', 'deleteInventorySeasonalityAlertRule', 'checkInventorySeasonalityAlerts', 'checkLegacyFreshnessAlerts']));
  });

  it('ECTR 航运替代序列只解析真实月度观察、去重并保持缺失值为空', () => {
    expect(parseEctrShippingCostCsv('observation_date,PCU483111483111\n2026-01-01,147.2\n2026-01-01,148.1\n2026-02-01,.\n2026-03-01,149.4\n')).toEqual([
      { date: '2026-01-01', value: 147.2 },
      { date: '2026-03-01', value: 149.4 },
    ]);
  });

  it('ECTR 航运入口保留原四个指数名称但只挂载独立替代序列接口', () => {
    const keys = Object.keys((legacyMarketDataRouter as any)._def.procedures);
    expect(keys).toContain('getEctrShipping');
    expect(getEctrShippingSnapshot).toBeTypeOf('function');
    expect('BDI' in ({ seriesId: 'PCU483111483111' } as Record<string, unknown>)).toBe(false);
  });

  it('ECTR 双边贸易解析只接受 Comtrade 年度出口/进口实际值并保持缺失伙伴为空', () => {
    const rows = parseComtradePartnerFlows({ data: [
      { partnerISO: 'CHN', flowCode: 'X', primaryValue: 143545716168 },
      { partnerISO: 'CHN', flowCode: 'M', primaryValue: 462620339617 },
      { partnerISO: 'CAN', flowCode: 'X', primaryValue: 348413969749 },
      { partnerISO: 'CAN', flowCode: 'M', primaryValue: null },
      { partnerISO: 'XXX', flowCode: 'X', primaryValue: 999 },
      { partnerISO: 'JPN', flowCode: 'X', primaryValue: -1 },
    ] });
    expect(rows.get('CHN')).toEqual({ exports: 143.545716168, imports: 462.620339617 });
    expect(rows.get('CAN')).toEqual({ exports: 348.413969749, imports: null });
    expect(rows.has('XXX')).toBe(false);
    expect(rows.has('JPN')).toBe(false);
  });

  it('ECTR 贸易路由保留原页面内的真实伙伴数据入口', () => {
    const keys = Object.keys((legacyMarketDataRouter as any)._def.procedures);
    expect(keys).toContain('getEctrTradePartners');
  });

  it('短观横向比较只抽取 BOJ 大中小企业、制造与非制造的实际值列，不混入预测值', () => {
    const html = '<tr><th>2026/06</th><td>22</td><td>14</td><td>37</td><td>29</td><td>17</td><td>9</td><td>26</td><td>18</td><td>9</td><td>4</td><td>15</td><td>8</td></tr>';
    expect(parseBojTankanHtml(html)).toEqual([{ date: '2026-06-01', largeManufacturing: 22, largeNonmanufacturing: 37, mediumManufacturing: 17, mediumNonmanufacturing: 26, smallManufacturing: 9, smallNonmanufacturing: 15 }]);
  });

  it('短观预测偏差只将当前实际值与紧邻上一季度同口径预测配对，非相邻季度不生成偏差', () => {
    const values = (value: number) => ({ largeManufacturing: value, largeNonmanufacturing: value, mediumManufacturing: value, mediumNonmanufacturing: value, smallManufacturing: value, smallNonmanufacturing: value });
    const paired = buildTankanForecastDeviation([{ date: '2026-03-01', actual: values(18), forecast: values(18) }, { date: '2026-06-01', actual: values(22), forecast: values(16) }, { date: '2026-12-01', actual: values(30), forecast: values(20) }]);
    expect(paired).toHaveLength(1);
    expect(paired[0]).toMatchObject({ date: '2026-06-01', forecastSurveyDate: '2026-03-01' });
    expect(paired[0]!.rows[0]).toMatchObject({ actual: 22, priorForecast: 18, deviation: 4 });
  });

  it('库存季节性仅匹配上一年相同 ISO 周的实际观察，缺少匹配周时保留空值', () => {
    const snapshot: any = { asOf: '2026-08-20T00:00:00.000Z', series: ['WCESTUS1', 'WGTSTUS1', 'WDISTUS1'].map((id, index) => ({ id, status: 'available', history: [{ date: '2025-08-15', value: 100 + index * 10 }, { date: '2025-08-22', value: 110 + index * 10 }, { date: '2026-08-14', value: 120 + index * 10 }] })) };
    const comparison = inventorySeasonality(snapshot);
    expect(comparison.status).toBe('available');
    expect(comparison.rows.at(-1)).toMatchObject({ date: '2026-08-14', crudePriorYear: 100, gasolinePriorYear: 110, distillatePriorYear: 120, crudeYoy: 20, gasolineYoy: 20, distillateYoy: 20 });
    expect(comparison.sourceBoundary).toMatch(/不插值/);
  });

  it('跨 PADD 占比与集中度只在五个地区同一实际发布日期齐全时计算', () => {
    const complete = calculateRegionalPaddConcentration([{ id: 'PADD1', label: '东海岸', status: 'available', observationDate: '2026-08-14', value: 100 }, { id: 'PADD2', label: '中西部', status: 'available', observationDate: '2026-08-14', value: 200 }, { id: 'PADD3', label: '墨西哥湾沿岸', status: 'available', observationDate: '2026-08-14', value: 300 }, { id: 'PADD4', label: '落基山', status: 'available', observationDate: '2026-08-14', value: 150 }, { id: 'PADD5', label: '西海岸', status: 'available', observationDate: '2026-08-14', value: 250 }]);
    expect(complete).toMatchObject({ status: 'available', observationDate: '2026-08-14', totalKbbL: 1000, leadingRegionId: 'PADD3', leadingSharePct: 30, concentrationIndex: 2250, concentrationBand: '中' });
    expect(complete.regions.map((region) => region.sharePct)).toEqual([30, 25, 20, 15, 10]);
    const incomplete = calculateRegionalPaddConcentration([{ id: 'PADD1', label: '东海岸', status: 'available', observationDate: '2026-08-14', value: 100 }]);
    expect(incomplete.status).toBe('unavailable');
  });

  it('匿名调用季节性阈值检查会返回未授权错误', async () => {
    const caller = legacyMarketDataRouter.createCaller({ user: null, req: {} as any, res: {} as any });
    await expect(caller.checkInventorySeasonalityAlerts()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.listInventorySeasonalityAlertEvents({ deliveryStatus: 'all' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
