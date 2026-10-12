import { createHash } from 'node:crypto';
import { resolveAdminDataModulesForPath } from '../shared/adminDataModules';
import { FINMIND_MODULE_BINDINGS } from '../shared/finmindModuleBindings';
import { displayTaiwanDerivativeUnderlyingName, taiwanDerivativeUnderlying, taiwanFuturesContractName, taiwanOptionContractName } from '../shared/taiwanDerivativeNames';
import { readArchivedPublicDataset } from './archivedPublicDataset';

// Explicit opt-in avoids duplicating ECST and FX's existing native archive views.
export const MODULE_ARCHIVE_VIEWS = [
  { module: 'index-hub', contract: 'index.us.sp500.fred.daily.v1', label: '标普 500 日收盘指数', field: '收盘指数', unit: '指数点', frequency: '交易日', symbol: 'SP500', integrated: true },
  { module: 'commodity-market', contract: 'commodity.us.wti-spot.fred.daily.v1', label: '西德州原油现货历史', field: '现货价格', unit: '美元/桶', frequency: '交易日', symbol: 'DCOILWTICO', integrated: true },
  { module: 'crypto-market', contract: 'crypto.btc-usd.fred.daily.v1', label: '比特币美元日频参考历史', field: '日频参考价', unit: '美元/比特币', frequency: '每日' },
  { module: 'bond-market', contract: 'credit.us.high-yield-oas.fred.daily.v1', label: '美国高收益债期权调整利差', field: '期权调整利差', unit: '百分点', frequency: '交易日' },
  { module: 'interest-rates', contract: 'rates.us.effective-fed-funds.fred.daily.v1', label: '美国有效联邦基金利率', field: '有效利率', unit: '%', frequency: '每日' },
  { module: 'yield-curve', contract: 'rates.us.10y2y-spread.fred.daily.v1', label: '美国 10 年减 2 年期限利差', field: '期限利差', unit: '百分点', frequency: '交易日' },
  { module: 'g7-curves', contract: 'rates.de.long-government-bond.fred.monthly.v1', label: '德国长期政府债券月度利率', field: '月度长期利率', unit: '%', frequency: '每月' },
  { module: 'curve-search', contract: 'rates.us.treasury-5y.fred.daily.v1', label: '美国 5 年期国债收益率', field: '5 年期收益率', unit: '%', frequency: '交易日' },
  { module: 'curves-compare', contract: 'rates.us.treasury-2y.fred.daily.v1', label: '美国 2 年期国债收益率', field: '2 年期收益率', unit: '%', frequency: '交易日' },
  { module: 'forex-curves', contract: 'fx.usd-eur.fred.daily.v1', label: '欧元兑美元参考历史', field: '每欧元美元数', unit: '美元/欧元', frequency: '交易日' },
  { module: 'commodity-market', contract: 'energy.us.natural-gas-storage.weekly.v1', label: '美国天然气库存', field: '库存量', unit: '十亿立方英尺', frequency: '每周', symbol: 'NGSTORAGE', integrated: true },
  { module: 'commodity-market', contract: 'energy.us.commercial-crude-inventory.eia.weekly.v1', label: '美国商业原油库存', field: '库存量', unit: '千桶', frequency: '每周', symbol: 'WCESTUS1', integrated: true },
  { module: 'commodity-market', contract: 'energy.us.refinery-utilization.eia.weekly.v1', label: '美国炼厂产能利用率', field: '利用率', unit: '%', frequency: '每周', symbol: 'WPULEUS3', integrated: true },
  { module: 'mm-03-mktbeat', contract: 'rates.us.sofr.fred.v1', label: 'SOFR 市场利率', field: '利率', unit: '%', frequency: '交易日', integrated: true },
  { module: 'sov-10-debt', contract: 'fiscal.us.total-public-debt.daily.v1', label: '美国公共债务总额', field: '债务总额', unit: '美元', frequency: '交易日', integrated: true },
] as const;

export const FINMIND_MODULE_ARCHIVE_VIEWS = [
  { module: 'stock-eqs', contract: 'equity.tw.2330.ohlcv.daily.finmind.v1', label: '台积电日频行情', field: '收盘价', unit: '新台币', frequency: '交易日', payloadFields: ['close', 'value'] },
  { module: 'stock-eqs', contract: 'equity.us.aapl.ohlcv.daily.finmind.v1', label: '苹果公司日频行情', field: '收盘价', unit: '美元', frequency: '交易日', payloadFields: ['close', 'value'] },
  ...FINMIND_MODULE_BINDINGS.filter(binding => binding.dataset === 'USStockPrice' && binding.symbol !== 'AAPL').map(binding => ({
    module: binding.moduleId,
    contract: binding.dataContractId,
    label: binding.label,
    field: '收盘价',
    unit: '美元',
    frequency: binding.frequency,
    payloadFields: ['close', 'value'] as const,
  })),
  { module: 'stock-eqs', contract: 'equity.tw.2330.valuation.daily.finmind.v1', label: '台积电估值指标', field: '市盈率', unit: '倍', frequency: '交易日', payloadFields: ['pe', 'value'] },
  { module: 'stock-eqs', contract: 'equity.tw.2330.dividend.finmind.v1', label: '台积电股利公告', field: '现金股利', unit: '新台币/股', frequency: '公告日', payloadFields: ['cashDividend', 'value'] },
  { module: 'commodity-market', contract: 'commodity.gold.reference.finmind.v1', label: '黄金参考价格', field: '参考价格', unit: '美元/盎司', frequency: '参考观察', payloadFields: ['price', 'value'] },
  { module: 'index-hub', contract: 'index.tw.taiex.total-return.finmind.v1', label: '台湾加权股价报酬指数', field: '报酬指数', unit: '指数点', frequency: '交易日', payloadFields: ['value', 'close'] },
  { module: 'deri', contract: 'derivatives.tw.futures.daily.finmind.v1', label: '台湾期货日成交', field: '结算价', unit: '指数点', frequency: '交易日', payloadFields: ['close', 'value'] },
  { module: 'moso', contract: 'derivatives.tw.options.daily.finmind.v1', label: '台湾期权日成交', field: '收盘价', unit: '指数点', frequency: '交易日', payloadFields: ['close', 'value'] },
  { module: 'news-cn', contract: 'news.tw.2330.company.finmind.v1', label: '公司新闻', field: '标题', unit: '文章', frequency: '发布时', payloadFields: ['title', 'description'] },
] as const;

/**
 * Capabilities imported from the FinceptTerminal connector that are actually
 * runnable in this Node service.  The Qt/Python screens are not copied; only
 * the normalized exchange observations enter an existing module slot.
 */
export const FINCEPT_MODULE_ARCHIVE_VIEWS = [
  {
    module: 'commodity-market',
    contract: 'commodity.pl.gold.nbp.daily.v1',
    label: '黄金参考价（兹罗提/克）',
    field: '参考价格',
    unit: 'PLN/克',
    frequency: '日频参考',
    payloadFields: ['price', 'value'] as const,
  },
  {
    module: 'forex-hub',
    contract: 'fx.pl.usd-pln.nbp.daily.v1',
    label: '美元兑兹罗提日频参考汇率',
    field: '中间参考汇率',
    unit: 'PLN/USD',
    frequency: '日频参考',
    symbol: 'USD/PLN',
    payloadFields: ['value'] as const,
  },
  {
    module: 'forex-hub',
    contract: 'fx.pl.multi-pln.nbp.daily.v1',
    label: '多币种兑兹罗提日频参考汇率',
    field: '中间参考汇率',
    unit: '兹罗提/单位外币',
    frequency: '日频参考',
    payloadFields: ['value'] as const,
  },
  {
    module: 'forex-hub',
    contract: 'fx.cz.cnb.daily-reference.v1',
    label: '捷克央行多币种参考汇率',
    field: '中间参考汇率',
    unit: 'CZK/单位外币',
    frequency: '日频参考',
    payloadFields: ['value'] as const,
  },
  {
    module: 'forex-hub',
    contract: 'fx.il.boi.daily-reference.v1',
    label: '以色列银行多币种参考汇率',
    field: '中间参考汇率',
    unit: 'ILS/单位外币',
    frequency: '日频参考',
    payloadFields: ['value'] as const,
  },
  {
    module: 'stock-eqs',
    contract: 'equity.twse.valuation.v1',
    label: '台湾股票估值指标',
    field: '市盈率',
    unit: '倍',
    frequency: '交易所日频观察',
    payloadFields: ['pe'] as const,
  },
  {
    module: 'stock-eqs',
    contract: 'equity.twse.snapshot.v1',
    label: '台湾证券交易所股票快照',
    field: '收盘价',
    unit: '新台币',
    frequency: '交易所公开快照',
    payloadFields: ['close', 'value'] as const,
  },
  {
    module: 'index-hub',
    contract: 'index.twse.taiex.snapshot.v1',
    label: '台湾加权股价指数快照',
    field: '指数点',
    unit: '指数点',
    frequency: '交易所公开快照',
    payloadFields: ['close', 'value'] as const,
  },
  {
    module: 'index-hub',
    contract: 'index.global.cboe-volatility.daily.v1',
    label: 'CBOE 波动率指数历史',
    field: '收盘值',
    unit: '指数点',
    frequency: '公开日频历史',
    payloadFields: ['close', 'value'] as const,
  },
  {
    module: 'index-hub',
    contract: 'index.global.cboe-delayed-snapshot.daily.v1',
    label: 'CBOE 全球指数延迟快照',
    field: '观察价格',
    unit: '指数点',
    frequency: '公开延迟观察',
    payloadFields: ['currentPrice', 'value'] as const,
  },
  {
    module: 'crypto-market',
    contract: 'crypto.global.coingecko.markets.daily.v1',
    label: '全球加密资产公开市场快照',
    field: '观察价格',
    unit: '美元',
    frequency: '公开市场观察',
    payloadFields: ['price', 'value'] as const,
  },
  {
    module: 'stock-eqs',
    contract: 'equity.global.nasdaq-screener.daily.v1',
    label: 'Nasdaq 公开股票筛选快照',
    field: '观察价格',
    unit: '公开延迟观察',
    frequency: '公开筛选观察',
    payloadFields: ['price', 'value'] as const,
  },
  {
    module: 'stock-eqs',
    contract: 'equity.global.nasdaq-earnings-calendar.daily.v1',
    label: 'Nasdaq 全球股票财报日历',
    field: 'EPS一致预期',
    unit: '美元/股',
    frequency: '公开日历',
    isCalendar: true,
  },
  {
    module: 'stock-eqs',
    contract: 'equity.global.nasdaq-dividend-calendar.daily.v1',
    label: 'Nasdaq 全球股票分红日历',
    field: '每股分红',
    unit: '美元/股',
    frequency: '公开日历',
    isCalendar: true,
  },
  {
    module: 'stock-eqs',
    contract: 'equity.global.nasdaq-ipo-calendar.monthly.v1',
    label: 'Nasdaq 全球股票 IPO 日历',
    field: '发行价',
    unit: '美元/股',
    frequency: '公开月历',
    isCalendar: true,
  },
  {
    module: 'economic-ecst',
    contract: 'macro.global.nasdaq-economic-calendar.daily.v1',
    label: 'Nasdaq 全球宏观事件日历',
    field: '实际值',
    unit: '公开事件值',
    frequency: '公开日历',
    isCalendar: true,
  },
  {
    module: 'commodity-futures',
    contract: 'derivatives.global.cftc-disaggregated.weekly.v1',
    label: 'CFTC 全球期货持仓周报',
    field: '未平仓量',
    unit: '合约数',
    frequency: '周度报告',
    payloadFields: ['openInterest'] as const,
  },
] as const;

export const AKSHARE_MODULE_ARCHIVE_VIEWS = [
  { module: 'stock-eqs', contract: 'equity.cn.a.snapshot.akshare.v1', label: '中国股票公开快照', field: '最近价格观察', unit: '人民币', frequency: '已核实交易日日频', payloadFields: ['value'] },
  { module: 'stock-eqs', contract: 'equity.cn.directory.akshare.v1', label: '中国股票代码与名称目录', field: '证券名称', unit: '公开目录', frequency: '每日更新', payloadFields: ['name', 'symbol'] },
  { module: 'index-hub', contract: 'index.cn.snapshot.akshare.v1', label: '中国指数公开快照', field: '最近指数观察', unit: '指数点', frequency: '已核实交易日日频', payloadFields: ['value'] },
  { module: 'index-hub', contract: 'index.global.snapshot.akshare.v1', label: '全球指数公开快照', field: '指数点', unit: '指数点', frequency: '接口返回', payloadFields: ['close', 'value'] },
  { module: 'fund-browse', contract: 'fund.etf.snapshot.akshare.v1', label: 'ETF 交易日单位净值', field: '单位净值', unit: '人民币/份', frequency: '交易日净值', payloadFields: ['netAssetValue', 'value'] },
  { module: 'fund-browse', contract: 'fund.open.snapshot.akshare.v1', label: '开放式基金净值公开快照', field: '单位净值', unit: '净值', frequency: '接口返回', payloadFields: ['netAssetValue', 'value'] },
  { module: 'commodity-futures', contract: 'derivatives.global.futures.snapshot.akshare.v1', label: '期货公开快照', field: '最新价', unit: '公开观察', frequency: '接口返回', payloadFields: ['close', 'value'] },
  { module: 'commodity-futures', contract: 'derivatives.cn.futures.snapshot.akshare.v1', label: '中国期货公开快照', field: '最新价', unit: '公开观察', frequency: '接口返回', payloadFields: ['close', 'value'] },
  { module: 'commodity-futures', contract: 'derivatives.cn.futures.inventory.akshare.v1', label: '沪铜库存公开序列', field: '库存', unit: '吨', frequency: '公开日频观察', payloadFields: ['inventory', 'value'] },
  { module: 'moso', contract: 'derivatives.cn.options.snapshot.akshare.v1', label: '期权公开快照', field: '最新价', unit: '公开观察', frequency: '接口返回', payloadFields: ['close', 'value'] },
  { module: 'bond-market', contract: 'rates.cn-us.bond-curve.akshare.v1', label: '中美国债收益率曲线', field: '美国 10 年收益率', unit: '%', frequency: '公开日频观察', payloadFields: ['us10y', 'value'] },
  { module: 'news-top', contract: 'news.public.publication.akshare.v1', label: '公开新闻动态', field: '标题', unit: '文章', frequency: '发布时', payloadFields: ['title', 'summary'] },
  { module: 'news-top', contract: 'news.cn.cctv.akshare.v1', label: '央视公开新闻动态', field: '标题', unit: '文章', frequency: '发布时', payloadFields: ['title', 'summary'] },
  { module: 'economic-ecst', contract: 'macro.cn.gdp.akshare.v1', label: '中国宏观 GDP 观察', field: 'GDP 观察值', unit: '公开统计', frequency: '发布周期', payloadFields: ['value'] },
  { module: 'economic-ecst', contract: 'macro.cn.cpi.akshare.v1', label: '中国宏观 CPI 观察', field: 'CPI 观察值', unit: '公开统计', frequency: '发布周期', payloadFields: ['value'] },
  { module: 'economic-ecst', contract: 'macro.cn.pmi.akshare.v1', label: '中国制造业 PMI 观察', field: 'PMI 指数', unit: '指数点', frequency: '发布周期', payloadFields: ['value'] },
  { module: 'economic-ecst', contract: 'rates.jp.bank-policy.akshare.v1', label: '日本央行政策利率历史', field: '政策利率', unit: '%', frequency: '发布周期', payloadFields: ['value', 'previous'] },
  { module: 'economic-ecst', contract: 'rates.uk.bank-policy.akshare.v1', label: '英格兰银行政策利率历史', field: '政策利率', unit: '%', frequency: '发布周期', payloadFields: ['value', 'previous'] },
  { module: 'index-hub', contract: 'index.global.sox.akshare.v1', label: '费城半导体指数历史', field: '指数点', unit: '指数点', frequency: '公开日频观察', payloadFields: ['close', 'value'] },
  { module: 'commodity-market', contract: 'commodity.global.bdi.akshare.v1', label: '波罗的海干散货指数', field: '指数点', unit: '指数点', frequency: '公开日频观察', payloadFields: ['close', 'value'] },
] as const;

function providerForContract(contract: string, source?: string | null) {
  if (source?.trim()) return source.trim();
  if (contract.includes(".akshare.")) return "AKShare 公共数据接口";
  if (contract.includes(".finmind.")) return "FinMind 公共数据接口";
  if (contract.includes("fred.")) return "Federal Reserve FRED";
  if (contract.includes("eia.")) return "U.S. EIA";
  if (contract.includes("world-bank")) return "World Bank";
  if (contract.includes("imf-")) return "IMF DataMapper";
  if (contract.includes("eurostat")) return "Eurostat";
  if (contract.includes("cftc")) return "U.S. CFTC";
  if (contract.includes("coingecko")) return "CoinGecko";
  if (contract.includes("cboe")) return "CBOE";
  if (contract.includes("nasdaq")) return "Nasdaq public data";
  if (contract.includes(".nbp.")) return "Narodowy Bank Polski";
  if (contract.includes(".cnb.")) return "Czech National Bank";
  if (contract.includes(".boi.")) return "Bank of Israel";
  if (contract.includes("hkma")) return "Hong Kong Monetary Authority";
  if (contract.includes("bank-of-canada")) return "Bank of Canada";
  return "公开数据适配器";
}

export async function readArchivedModuleDatasets(path: string, limit = 2500) {
  const owners = new Set(resolveAdminDataModulesForPath(path).map(module => module.id));
  const views: ReadonlyArray<any> = [...MODULE_ARCHIVE_VIEWS, ...FINMIND_MODULE_ARCHIVE_VIEWS, ...FINCEPT_MODULE_ARCHIVE_VIEWS, ...AKSHARE_MODULE_ARCHIVE_VIEWS].filter(view => owners.has(view.module));
  const results = await Promise.all(views.map(async view => {
    const archive = await readArchivedPublicDataset(view.contract, limit + 1);
    const truncated = archive.observations.length > limit;
    const rows: Array<Record<string, string | number | null>> = archive.observations.slice(-limit).flatMap((observation): Array<Record<string, string | number | null>> => {
      const payload = observation.payload as Record<string, unknown>;
      const fieldValues = (('payloadFields' in view ? view.payloadFields : ['value']) as ReadonlyArray<string>).map((field: string) => payload[field]);
      const text = typeof fieldValues[0] === 'string' ? fieldValues[0].trim() : '';
      const calendarContract = typeof view.contract === 'string' && view.contract.includes('nasdaq-') && view.isCalendar === true;
      if (calendarContract) {
        const eventType = typeof payload.eventType === 'string' ? payload.eventType : '';
        const symbol = typeof payload.symbol === 'string' && payload.symbol.trim() ? payload.symbol : '';
        const companyName = typeof payload.companyName === 'string' ? payload.companyName : '';
        const eventDate = typeof payload.eventDate === 'string' ? payload.eventDate : observation.date;
        if (eventType === 'earnings') {
          return [{
            '观察期': observation.date,
            '报告日': eventDate,
            ...(symbol ? { 标的: symbol } : {}),
            ...(companyName ? { 名称: companyName } : {}),
            'EPS上一期': typeof payload.epsPrevious === 'number' ? payload.epsPrevious : null,
            'EPS一致预期': typeof payload.epsConsensus === 'number' ? payload.epsConsensus : null,
            'EPS实际': typeof payload.epsActual === 'number' ? payload.epsActual : null,
            '财报时间': typeof payload.reportingTime === 'string' ? payload.reportingTime : '',
            '财季结束': typeof payload.periodEnding === 'string' ? payload.periodEnding : '',
            '单位': view.unit,
          }];
        }
        if (eventType === 'dividend') {
          return [{
            '观察期': observation.date,
            '除息日': typeof payload.exDividendDate === 'string' ? payload.exDividendDate : eventDate,
            ...(symbol ? { 标的: symbol } : {}),
            ...(companyName ? { 名称: companyName } : {}),
            '每股分红': typeof payload.amount === 'number' ? payload.amount : null,
            '年化分红': typeof payload.annualizedAmount === 'number' ? payload.annualizedAmount : null,
            '支付日': typeof payload.paymentDate === 'string' ? payload.paymentDate : '',
            '登记日': typeof payload.recordDate === 'string' ? payload.recordDate : '',
            '公告日': typeof payload.declarationDate === 'string' ? payload.declarationDate : '',
            '单位': view.unit,
          }];
        }
        if (eventType === 'ipo') {
          return [{
            '观察期': observation.date,
            '事件日': eventDate,
            ...(symbol ? { 标的: symbol } : {}),
            ...(companyName ? { 名称: companyName } : {}),
            '发行价': typeof payload.sharePrice === 'number' ? payload.sharePrice : null,
            '发行交易所': typeof payload.exchange === 'string' ? payload.exchange : '',
            '发行金额': typeof payload.offerAmount === 'number' ? payload.offerAmount : null,
            '预期定价日': typeof payload.expectedPriceDate === 'string' ? payload.expectedPriceDate : '',
            '申报日': typeof payload.filedDate === 'string' ? payload.filedDate : '',
            '撤回日': typeof payload.withdrawDate === 'string' ? payload.withdrawDate : '',
            '状态': typeof payload.dealStatus === 'string' ? payload.dealStatus : '',
            '单位': view.unit,
          }];
        }
        if (eventType === 'economic_event') {
          return [{
            '观察期': observation.date,
            '事件日': eventDate,
            '国家': typeof payload.country === 'string' ? payload.country : '',
            '事件': typeof payload.eventName === 'string' ? payload.eventName : '',
            '时间': typeof payload.gmt === 'string' ? payload.gmt : '',
            '实际值': typeof payload.actual === 'string' ? payload.actual : '',
            '预期值': typeof payload.consensus === 'string' ? payload.consensus : '',
            '前值': typeof payload.previous === 'string' ? payload.previous : '',
            '说明': typeof payload.description === 'string' ? payload.description : '',
            '单位': view.unit,
          }];
        }
        return [];
      }
      if (view.module === 'news-cn') return text ? [{ '观察期': observation.date, 标题: text, 摘要: typeof fieldValues[1] === 'string' ? fieldValues[1] : '', 单位: view.unit }] : [];
      const value = fieldValues.find((item: unknown): item is number => typeof item === 'number' && Number.isFinite(item)) ?? null;
      const derivative = view.module === 'commodity-futures' || view.module === 'deri' || view.module === 'moso';
      const hasDerivativeObservation = derivative && (typeof payload.volume === 'number' || typeof payload.openInterest === 'number');
      if (view.module === 'news-top' && typeof payload.title === 'string' && payload.title.trim()) {
        return [{
          '观察期': observation.date,
          标题: payload.title,
          摘要: typeof payload.summary === 'string' ? payload.summary : '',
          单位: view.unit,
        }];
      }
      if (typeof value !== 'number' && !hasDerivativeObservation) return [];
      const derivativeCode = typeof payload.underlyingSymbol === 'string' ? payload.underlyingSymbol.toUpperCase() : '';
      const derivativeMonth = typeof payload.contractMonth === 'string' ? payload.contractMonth : '';
      const knownDerivative = ((view.module === 'commodity-futures' || view.module === 'deri') && derivativeCode === 'TX')
        || (view.module === 'moso' && derivativeCode === 'TXO');
      const underlyingName = typeof payload.underlyingName === 'string' ? displayTaiwanDerivativeUnderlyingName(payload.underlyingName)
        : knownDerivative ? taiwanDerivativeUnderlying(derivativeCode) : null;
      const contractName = typeof payload.contractName === 'string' ? payload.contractName
        : knownDerivative && derivativeMonth
          ? (view.module === 'commodity-futures' || view.module === 'deri')
            ? taiwanFuturesContractName(derivativeCode, derivativeMonth)
            : taiwanOptionContractName(
              derivativeCode, derivativeMonth,
              typeof payload.strikePrice === 'number' ? payload.strikePrice : null,
              typeof payload.optionType === 'string' ? payload.optionType : '',
            )
          : null;
      const symbol = typeof payload.symbol === 'string' && payload.symbol.trim()
        ? payload.symbol
        : typeof payload.fundCode === 'string' && payload.fundCode.trim()
          ? payload.fundCode
        : typeof view.symbol === 'string'
          ? view.symbol
          : '';
      const displayName = typeof payload.name === 'string' && payload.name.trim()
        ? payload.name
        : typeof payload.fundName === 'string' && payload.fundName.trim()
          ? payload.fundName
          : underlyingName ?? '';
      const unit = (view.contract === 'fx.pl.multi-pln.nbp.daily.v1' || view.contract === 'fx.cz.cnb.daily-reference.v1' || view.contract === 'fx.il.boi.daily-reference.v1') && typeof payload.unit === 'string'
        ? payload.unit : view.unit;
      const businessAliases: Record<string, string | number | null> = {
        date: observation.date,
        value,
        ...(symbol ? { symbol } : {}),
        ...(typeof payload.close === 'number' ? { close: payload.close } : {}),
        ...(typeof payload.currentPrice === 'number' ? { current_price: payload.currentPrice } : {}),
        ...(typeof payload.open === 'number' ? { open: payload.open } : {}),
        ...(typeof payload.high === 'number' ? { high: payload.high } : {}),
        ...(typeof payload.low === 'number' ? { low: payload.low } : {}),
        ...(typeof payload.change === 'number' ? { change: payload.change } : {}),
        ...(typeof payload.changePct === 'number' ? { change_pct: payload.changePct } : {}),
        ...(typeof payload.priceChange === 'number' ? { price_change: payload.priceChange } : {}),
        ...(typeof payload.priceChangePercent === 'number' ? { price_change_pct: payload.priceChangePercent } : {}),
        ...(typeof payload.bid === 'number' ? { bid: payload.bid } : {}),
        ...(typeof payload.ask === 'number' ? { ask: payload.ask } : {}),
        ...(typeof payload.previousClose === 'number' ? { previous_close: payload.previousClose } : {}),
        ...(typeof payload.volume === 'number' ? { volume: payload.volume } : {}),
        ...(displayName ? { name: displayName } : {}),
        ...(typeof payload.fundCode === 'string' ? { fund_code: payload.fundCode, symbol: payload.fundCode } : {}),
        ...(typeof payload.fundName === 'string' ? { fund_name: payload.fundName, name: payload.fundName } : {}),
        ...(typeof payload.netAssetValue === 'number' ? { net_asset_value: payload.netAssetValue, nav: payload.netAssetValue } : {}),
        ...(view.contract === 'fund.etf.snapshot.akshare.v1' ? { fund_type: 'ETF', currency: 'CNY', region: '中国' } : {}),
        ...(typeof payload.securityName === 'string' ? { security_name: payload.securityName } : {}),
        ...(typeof payload.exchange === 'string' ? { exchange: payload.exchange } : {}),
        ...(typeof payload.currency === 'string' ? { currency: payload.currency } : {}),
        ...(typeof payload.base === 'string' ? { base: payload.base } : {}),
        ...(typeof payload.quote === 'string' ? { quote: payload.quote } : {}),
        ...(typeof payload.amount === 'number' ? { amount: payload.amount } : {}),
        ...(typeof payload.fixingRate === 'number' ? { fixing_rate: payload.fixingRate } : {}),
        ...(typeof payload.tradeValue === 'number' ? { trade_value: payload.tradeValue } : {}),
        ...(typeof payload.transaction === 'number' ? { transactions: payload.transaction } : {}),
        ...(typeof payload.openInterest === 'number' ? { open_interest: payload.openInterest } : {}),
        ...(view.contract === 'derivatives.global.cftc-disaggregated.weekly.v1'
          ? Object.fromEntries([
              ['producer_long', payload.producerLong],
              ['producer_short', payload.producerShort],
              ['producer_net', payload.producerNet],
              ['swap_long', payload.swapLong],
              ['swap_short', payload.swapShort],
              ['swap_net', payload.swapNet],
              ['managed_money_long', payload.managedMoneyLong],
              ['managed_money_short', payload.managedMoneyShort],
              ['managed_money_net', payload.managedMoneyNet],
              ['other_report_net', payload.otherReportNet],
              ['non_reportable_net', payload.nonReportableNet],
            ].filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])))
          : {}),
        ...(typeof payload.contractDate === 'string' ? { expiration: payload.contractDate } : {}),
        ...(typeof payload.strikePrice === 'number' ? { strike_price: payload.strikePrice } : {}),
        ...(typeof payload.optionType === 'string' ? { put_call: payload.optionType } : {}),
        ...(typeof payload.settlementPrice === 'number' ? { settlement_price: payload.settlementPrice } : {}),
        ...(typeof payload.underlyingSymbol === 'string' ? { underlying_symbol: payload.underlyingSymbol } : {}),
        ...(underlyingName ? { underlying_name: underlyingName } : {}),
        ...(contractName ? { contract_name: contractName } : {}),
        ...(typeof payload.contractMonth === 'string' ? { contract_month: payload.contractMonth } : {}),
        ...(typeof payload.tradingSession === 'string' ? { trading_session: payload.tradingSession } : {}),
        ...(typeof payload.pe === 'number' ? { pe: payload.pe } : {}),
        ...(typeof payload.pbr === 'number' ? { pbr: payload.pbr } : {}),
        ...(typeof payload.dividendYield === 'number' ? { dividend_yield: payload.dividendYield } : {}),
        ...(typeof payload.fiscalYearQuarter === 'string' ? { fiscal_year_quarter: payload.fiscalYearQuarter } : {}),
      };
      return [{
        '观察期': observation.date,
        [view.field]: value,
        '单位': unit,
        ...(symbol ? { 标的: symbol } : {}),
        ...(displayName ? { 名称: displayName } : {}),
        ...businessAliases,
      }];
    });
    if (!rows.length) return null;
    const digest = createHash('sha256').update(JSON.stringify([view.contract, rows])).digest('hex');
    const latest = String(rows.at(-1)?.['观察期'] ?? '');
    const latestObservation = archive.observations.at(-1) as
      | { retrievedAt?: string | null; source?: string | null }
      | undefined;
    const rowKeys = new Set(rows.flatMap(row => Object.keys(row)));
    const derivativeColumns = [
      'value',
      'change',
      'change_pct',
      'volume',
      'trade_value',
      'open_interest',
      'producer_long',
      'producer_short',
      'producer_net',
      'swap_long',
      'swap_short',
      'swap_net',
      'managed_money_long',
      'managed_money_short',
      'managed_money_net',
      'other_report_net',
      'non_reportable_net',
      'settlement_price',
      'open',
      'high',
      'low',
      'exchange',
      'currency',
      'contract_name',
      'contract_month',
      'expiration',
      'underlying_symbol',
      'underlying_name',
      'trading_session',
    ].filter(column => rowKeys.has(column));
      const hasDerivativeRows = view.module === 'commodity-futures' || view.module === 'deri' || view.module === 'moso';
    const calendarColumns = view.contract === 'equity.global.nasdaq-earnings-calendar.daily.v1'
      ? ['观察期', '报告日', '标的', '名称', 'EPS上一期', 'EPS一致预期', 'EPS实际', '财报时间', '财季结束', '单位']
      : view.contract === 'equity.global.nasdaq-dividend-calendar.daily.v1'
        ? ['观察期', '除息日', '标的', '名称', '每股分红', '年化分红', '支付日', '登记日', '公告日', '单位']
        : view.contract === 'equity.global.nasdaq-ipo-calendar.monthly.v1'
          ? ['观察期', '事件日', '标的', '名称', '发行价', '发行交易所', '发行金额', '预期定价日', '申报日', '撤回日', '状态', '单位']
          : view.contract === 'macro.global.nasdaq-economic-calendar.daily.v1'
            ? ['观察期', '事件日', '国家', '事件', '时间', '实际值', '预期值', '前值', '说明', '单位']
            : null;
    const columns = calendarColumns ?? (view.module === 'news-cn' || view.module === 'news-top'
      ? ['观察期', '标题', '摘要', '单位']
      : rows.some(row => typeof row.标的 === 'string' && row.标的)
        ? rows.some(row => typeof row.名称 === 'string' && row.名称)
          ? ['观察期', '标的', '名称', view.field, ...(hasDerivativeRows ? derivativeColumns : []), '单位']
          : ['观察期', '标的', view.field, ...(hasDerivativeRows ? derivativeColumns : []), '单位']
        : ['观察期', view.field, ...(hasDerivativeRows ? derivativeColumns : []), '单位']);
    return {
      itemKey: createHash('sha256').update(view.contract).digest('hex').slice(0, 24),
      title: view.label, body: `${view.label} · ${view.frequency}观察`, topic: view.label,
      category: '参考历史', sourceKind: view.module === 'news-top' ? 'public' as const : 'observation' as const,
      publishedAt: latest, updatedAt: latest,
      dataset: {
        label: view.label,
        columns,
        rows,
        metadata: {
          provider: providerForContract(view.contract, latestObservation?.source),
          queriedAt: latestObservation?.retrievedAt ?? null,
          observedAt: view.isCalendar === true
            ? latestObservation?.retrievedAt ?? latest
            : latest,
          timezone: '按观测口径',
          rowCount: rows.length, displayedRowCount: rows.length, truncated,
          quality: '已核验观察', realtimeStatus: `${view.frequency}发布`,
          schemaVersion: FINMIND_MODULE_ARCHIVE_VIEWS.some(item => item.contract === view.contract) || FINCEPT_MODULE_ARCHIVE_VIEWS.some(item => item.contract === view.contract) || AKSHARE_MODULE_ARCHIVE_VIEWS.some(item => item.contract === view.contract) || view.integrated === true ? 'module-observation-history-v1' : 'public-reference-history-v1', checksum: digest, observationIdentity: digest,
        },
      },
    };
  }));
  return results.filter((item): item is NonNullable<typeof item> => item !== null);
}
