import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./archivedPublicDataset', () => ({ readArchivedPublicDataset: vi.fn() }));
import { readArchivedPublicDataset } from './archivedPublicDataset';
import { AKSHARE_MODULE_ARCHIVE_VIEWS, FINCEPT_MODULE_ARCHIVE_VIEWS, FINMIND_MODULE_ARCHIVE_VIEWS, MODULE_ARCHIVE_VIEWS, readArchivedModuleDatasets } from './archivedModuleDatasets';
import { MANAGED_PUBLIC_DATASETS } from './adminPublicDatasetIngestion';
import { ADMIN_DATA_MODULES } from '../shared/adminDataModules';

describe('module reference archive delivery', () => {
  it('each managed archive contract has one frontend owner, not a sibling-page copy', () => {
    const views = [
      ...MODULE_ARCHIVE_VIEWS,
      ...FINMIND_MODULE_ARCHIVE_VIEWS,
      ...FINCEPT_MODULE_ARCHIVE_VIEWS,
      ...AKSHARE_MODULE_ARCHIVE_VIEWS,
    ];
    expect(new Set(views.map(view => view.contract)).size).toBe(views.length);
    for (const view of views) {
      const owner = ADMIN_DATA_MODULES.find(module => module.id === view.module);
      expect(owner?.path).toBeTruthy();
      expect(ADMIN_DATA_MODULES.filter(module => module.id === view.module)).toHaveLength(1);
    }
  });

  beforeEach(() => {
    vi.mocked(readArchivedPublicDataset).mockReset().mockResolvedValue({
      available: true, status: 'available', observations: [
        { date: '2026-09-18', payload: { value: 2.7, sourceUrl: 'https://private.example', savedAt: 'private' } },
      ],
    });
  });
  it.each(MODULE_ARCHIVE_VIEWS)('delivers the owned $module reference contract without leaking internals', async view => {
    const modulePath = ADMIN_DATA_MODULES.find(module => module.id === view.module)?.path;
    expect(modulePath).toBeTruthy();
    const items = await readArchivedModuleDatasets(modulePath!);
    const ownedViews = [...MODULE_ARCHIVE_VIEWS, ...FINMIND_MODULE_ARCHIVE_VIEWS, ...FINCEPT_MODULE_ARCHIVE_VIEWS, ...AKSHARE_MODULE_ARCHIVE_VIEWS].filter(item => item.module === view.module);
    expect(readArchivedPublicDataset).toHaveBeenCalledTimes(ownedViews.length);
    expect(readArchivedPublicDataset).toHaveBeenCalledWith(view.contract, 2501);
    const item = items.find(candidate => candidate.title === view.label);
    expect(item).toBeTruthy();
    expect(item?.dataset.rows[0]).toMatchObject({ '观察期': '2026-09-18', [view.field]: 2.7, '单位': view.unit });
    expect(MANAGED_PUBLIC_DATASETS.find(dataset => dataset.dataContractId === view.contract)?.moduleId).toBe(view.module);
    expect(JSON.stringify(item)).not.toMatch(/sourceUrl|savedAt|https:|dataContractId|moduleId/);
    expect(item?.dataset.metadata.schemaVersion).toBe('integrated' in view && view.integrated === true
      ? 'module-observation-history-v1'
      : 'public-reference-history-v1');
  });
  it.each(['/terminal?module=stocks&open=wei', '/unknown'])('does not replay native archives or siblings into %s', async path => {
    expect(await readArchivedModuleDatasets(path)).toEqual([]);
    expect(readArchivedPublicDataset).not.toHaveBeenCalled();
  });
  it('projects NBP multi-currency observations only into FXC with the actual pair and unit', async () => {
    vi.mocked(readArchivedPublicDataset).mockImplementation(async contract => ({
      available: true, status: 'available',
      observations: contract === 'fx.pl.multi-pln.nbp.daily.v1'
        ? [{ date: '2026-09-28', payload: { value: 4.3754, symbol: 'EUR/PLN', name: 'EUR/PLN 日频参考汇率', base: 'EUR', quote: 'PLN', unit: 'PLN/EUR', sourceUrl: 'https://private.example' } }]
        : [],
    }));
    const items = await readArchivedModuleDatasets('/forex-hub');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.rows[0]).toMatchObject({
      '观察期': '2026-09-28', 标的: 'EUR/PLN', 名称: 'EUR/PLN 日频参考汇率',
      中间参考汇率: 4.3754, 单位: 'PLN/EUR', base: 'EUR', quote: 'PLN',
    });
    expect(JSON.stringify(items)).not.toMatch(/sourceUrl|private\.example/);
  });
  it('delivers AKShare observations to the existing news and ECST owners', async () => {
    vi.mocked(readArchivedPublicDataset).mockImplementation(async contract => contract === 'news.public.publication.akshare.v1'
      ? {
        available: true, status: 'available', observations: [{
          date: '2026-09-25',
          payload: { title: '公开动态示例', summary: '已清洗正文', url: 'https://example.test/article' },
        }],
      }
      : {
        available: true, status: 'available', observations: [{ date: '2026-09-25', payload: { value: 2.7 } }],
      });
    const items = await readArchivedModuleDatasets('/news-hub?tab=top');
    expect(items.find(item => item.title === '公开新闻动态')).toBeTruthy();
    const economic = await readArchivedModuleDatasets('/econ-hub?tab=ecst');
    expect(economic.map(item => item.title)).toEqual(expect.arrayContaining(['中国宏观 GDP 观察', '中国宏观 CPI 观察', '中国制造业 PMI 观察']));
  });
  it('delivers named AKShare fund observations to the existing fund browser', async () => {
    vi.mocked(readArchivedPublicDataset).mockImplementation(async contract => contract === 'fund.open.snapshot.akshare.v1'
      ? {
        available: true, status: 'available', observations: [{
          date: '2026-09-25',
          payload: { fundCode: '000001', fundName: '华夏成长混合', netAssetValue: 1.2345, value: 1.2345 },
        }],
      }
      : { available: true, status: 'available', observations: [] });
    const items = await readArchivedModuleDatasets('/fund-browse');
    const fund = items.find(item => item.title === '开放式基金净值公开快照');
    expect(fund?.dataset.rows[0]).toMatchObject({
      标的: '000001',
      名称: '华夏成长混合',
      单位净值: 1.2345,
      nav: 1.2345,
      fund_code: '000001',
      fund_name: '华夏成长混合',
    });
  });
  it('delivers ETF unit NAV, not an exchange quote, to the existing fund browser', async () => {
    vi.mocked(readArchivedPublicDataset).mockImplementation(async contract => contract === 'fund.etf.snapshot.akshare.v1'
      ? {
        available: true, status: 'available', observations: [{
          date: '2026-09-30',
          payload: {
            symbol: '520970', fundCode: '520970', fundName: '嘉实中证港股通创新药ETF',
            netAssetValue: 0.9772, value: 0.9772, changePct: 3.99,
            sourceUrl: 'https://private.example',
          },
        }],
      }
      : { available: true, status: 'available', observations: [] });
    const items = await readArchivedModuleDatasets('/fund-browse');
    const etf = items.find(item => item.title === 'ETF 交易日单位净值');
    expect(etf?.dataset.rows[0]).toMatchObject({
      标的: '520970', 名称: '嘉实中证港股通创新药ETF',
      单位净值: 0.9772, nav: 0.9772,
      fund_type: 'ETF', currency: 'CNY', region: '中国',
    });
    expect(JSON.stringify(etf)).not.toMatch(/sourceUrl|private\.example/);
  });
  it('does not invent missing values or change identity on polling', async () => {
    const first = await readArchivedModuleDatasets('/yield-curve');
    expect(await readArchivedModuleDatasets('/yield-curve')).toEqual(first);
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({ available: false, status: 'not_collected', observations: [] });
    expect(await readArchivedModuleDatasets('/yield-curve')).toEqual([]);
  });
  it('changes content identity only when observations change', async () => {
    const first = await readArchivedModuleDatasets('/yield-curve');
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({ available: true, status: 'available', observations: [{ date: '2026-09-18', payload: { value: 2.8 } }] });
    const revised = await readArchivedModuleDatasets('/yield-curve');
    expect(first[0].itemKey).toBe(revised[0].itemKey);
    expect(first[0].dataset.metadata.checksum).not.toBe(revised[0].dataset.metadata.checksum);
  });
  it('delivers named option contracts with real volume when a closing quote is absent', async () => {
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({
      available: true, status: 'available', observations: [{
        date: '2026-09-24',
        payload: {
          symbol: 'TXO:202706:57400:PUT:position',
          underlyingSymbol: 'TXO', underlyingName: '台湾加权股价指数（非个股）',
          contractName: '台股指数选择权 2027年6月 57,400点 卖权',
          contractMonth: '202706', strikePrice: 57400, optionType: 'PUT',
          volume: 12, sourceReference: 'internal', apiKey: 'hidden',
        },
      }],
    });
    const items = await readArchivedModuleDatasets('/moso');
    expect(items[0]?.dataset.rows[0]).toMatchObject({
      contract_name: '台股指数选择权 2027年6月 57,400点 卖权',
      underlying_name: '台湾加权股价指数',
      strike_price: 57400, volume: 12, value: null, '单位': '指数点',
    });
    expect(JSON.stringify(items)).not.toMatch(/sourceReference|apiKey|hidden|internal/i);
  });
  it('delivers FinMind futures to the existing DERI entry', async () => {
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({
      available: true, status: 'available', observations: [{
        date: '2026-09-24',
        payload: {
          symbol: 'TX', underlyingSymbol: 'TX', underlyingName: '台湾加权指数',
          contractMonth: '202610', close: 22450, value: 22450, volume: 8123,
          openInterest: 145678,
        },
      }],
    });
    const items = await readArchivedModuleDatasets('/deri');
    expect(items.find(item => item.title === '台湾期货日成交')?.dataset.rows[0]).toMatchObject({
      标的: 'TX',
      名称: '台湾加权指数',
      结算价: 22450,
      volume: 8123,
      open_interest: 145678,
      contract_name: '台股指数期货 2026年10月',
    });
  });
  it('projects CFTC net positions into its owned futures panel without internal fields', async () => {
    vi.mocked(readArchivedPublicDataset).mockImplementation(async contract => ({
      available: true, status: 'available', observations: contract === 'derivatives.global.cftc-disaggregated.weekly.v1'
        ? [{ date: '2026-09-22', payload: {
          symbol: 'WTI', name: 'WTI 原油', contractName: 'WTI 原油', openInterest: 1_000_000,
          producerLong: 45, producerShort: 60, producerNet: -15, swapNet: 8, managedMoneyNet: 27,
          sourceUrl: 'https://private.example', apiKey: 'hidden',
        } }]
        : [],
    }));
    const items = await readArchivedModuleDatasets('/commodity-futures');
    const cftc = items.find(item => item.title === 'CFTC 全球期货持仓周报');
    expect(cftc?.dataset.rows[0]).toMatchObject({
      标的: 'WTI', 名称: 'WTI 原油', open_interest: 1_000_000,
      producer_long: 45, producer_short: 60, producer_net: -15,
      swap_net: 8, managed_money_net: 27,
    });
    expect(JSON.stringify(cftc)).not.toMatch(/sourceUrl|apiKey|private\.example|hidden/);
  });
  it('names previously archived index contracts from their verified contract fields', async () => {
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({
      available: true, status: 'available', observations: [{
        date: '2026-09-24', payload: {
          symbol: 'TXO:legacy-hash', underlyingSymbol: 'TXO',
          contractMonth: '202706', strikePrice: 57400, optionType: 'PUT',
          close: 21, value: 21, volume: 8,
        },
      }],
    });
    const items = await readArchivedModuleDatasets('/moso');
    expect(items[0]?.dataset.rows[0]).toMatchObject({
      contract_name: '台股指数选择权 2027年6月 57,400点 卖权',
      underlying_name: '台湾加权股价指数', close: 21, volume: 8,
    });
  });
  it('routes Fincept TWSE observations to the existing EQS/WEI owners with business names', async () => {
    vi.mocked(readArchivedPublicDataset).mockImplementation(async contract => contract === 'equity.twse.snapshot.v1'
      ? {
        available: true, status: 'available', observations: [{
          date: '2026-09-23',
          payload: { symbol: '2330', name: '台積電', close: 101.5, value: 101.5, volume: 1000, apiKey: 'hidden' },
        }],
      }
      : contract === 'index.twse.taiex.snapshot.v1'
        ? {
          available: true, status: 'available', observations: [{
            date: '2026-09-23',
            payload: { symbol: 'TAIEX', name: '台湾加权股价指数', close: 47001.12, value: 47001.12 },
          }],
        }
        : { available: true, status: 'available', observations: [{ date: '2026-09-18', payload: { value: 2.7 } }] });
    const eqs = await readArchivedModuleDatasets('/terminal?open=eqs&module=stocks');
    const wei = await readArchivedModuleDatasets('/index-hub?panel=WEI');
    expect(eqs.find(item => item.title === '台湾证券交易所股票快照')?.dataset.rows[0]).toMatchObject({ 标的: '2330', 名称: '台積電', 收盘价: 101.5 });
    expect(wei.find(item => item.title === '台湾加权股价指数快照')?.dataset.rows[0]).toMatchObject({ 标的: 'TAIEX', '指数点': 47001.12 });
    expect(JSON.stringify([...eqs, ...wei])).not.toMatch(/apiKey|hidden/i);
  });
  it('only reports truncation when an older observation actually exists', async () => {
    const complete = await readArchivedModuleDatasets('/yield-curve', 1);
    expect(complete[0].dataset.metadata.truncated).toBe(false);
    vi.mocked(readArchivedPublicDataset).mockResolvedValue({ available: true, status: 'available', observations: [
      { date: '2026-09-17', payload: { value: 2.6 } },
      { date: '2026-09-18', payload: { value: 2.7 } },
    ] });
    const limited = await readArchivedModuleDatasets('/yield-curve', 1);
    expect(limited[0].dataset.metadata.truncated).toBe(true);
    expect(limited[0].dataset.rows).toHaveLength(1);
    expect(limited[0].dataset.rows[0]['观察期']).toBe('2026-09-18');
  });
});
