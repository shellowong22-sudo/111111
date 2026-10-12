import { runAkShareOperation, type AkShareOperation } from "./aksharePythonAdapter";
import { listAkShareRouteDecisions } from "./akshareCapabilityRouting";
import { getDb } from "./db";
import { managedPublicDatasetStates, marketDataObservationHistory } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { getAkShareDatasetState, getAkShareLocalLedgerStatus, readAkShareObservations } from "./aksharePersistence";

export type AkShareManagedResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: boolean;
  delayStatus: string;
  limitation: string;
  history: Array<{ date: string; value: number | null; fields?: Record<string, unknown> }>;
};

type NormalizedRow = {
  date: string;
  value: number | null;
  fields?: Record<string, unknown>;
};

const SOURCE = "AKShare 公共数据接口";
const LIMITATION = "仅保存接口实际返回的公开观察；接口无响应或字段无法核验时保持不可用，不生成替代数值。";

function text(record: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[alias];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function number(record: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const raw = record[alias];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/,/g, "").replace(/%$/, "").trim();
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function dateValue(record: Record<string, unknown>, fallback: string) {
  const raw = text(record, ["日期", "交易日期", "行情日期", "交易日", "tradedate", "报告期", "报告日期", "统计年度", "年份", "月份", "period", "date", "时间", "行情时间", "ticktime", "发布时间", "发布日期", "发布日", "公布日期"]);
  if (!raw) return fallback.slice(0, 10);
  const month = raw.match(/^(\d{4})年\s*(\d{1,2})月/);
  if (month) return `${month[1]}-${month[2].padStart(2, "0")}-01`;
  const iso = new Date(raw);
  return Number.isFinite(iso.getTime()) ? iso.toISOString().slice(0, 10) : raw.slice(0, 64);
}

function pickFields(record: Record<string, unknown>, aliases: Record<string, string[]>) {
  const fields: Record<string, unknown> = {};
  for (const [key, candidates] of Object.entries(aliases)) {
    const value = number(record, candidates);
    if (value !== null) fields[key] = value;
    else {
      const textValue = text(record, candidates);
      if (textValue) fields[key] = textValue;
    }
  }
  return fields;
}

export function normalizeAkShareDataset(operation: AkShareOperation, records: Array<Record<string, unknown>>, retrievedAt: string): AkShareManagedResult {
  const fallbackDate = retrievedAt;
  const operationSymbol: Record<AkShareOperation, string> = {
    stock_snapshot: "CN:A:ALL",
    stock_directory: "CN:A:DIRECTORY",
    hk_stock_snapshot: "HK:ALL",
    us_stock_snapshot: "US:ALL",
    cn_index_snapshot: "CN:INDEX:ALL",
    global_index_snapshot: "GLOBAL:INDEX:ALL",
    etf_snapshot: "CN:ETF:ALL",
    fund_snapshot: "CN:FUND:ALL",
    forex_snapshot: "CN:FX:ALL",
    futures_snapshot: "GLOBAL:FUTURES:ALL",
    futures_cn_snapshot: "CN:FUTURES:ALL",
    futures_inventory: "CN:FUTURES:INVENTORY:CU",
    options_snapshot: "CN:OPTIONS:ALL",
    bond_curve: "CN_US:BOND_CURVE",
    news_publication: "NEWS:PUBLIC",
    economic_gdp: "CN:GDP",
    economic_cpi: "CN:CPI",
    economic_pmi: "CN:PMI",
    macro_semiconductor_index: "GLOBAL:SOX",
    macro_shipping_bdi: "GLOBAL:BDI",
    macro_japan_bank_rate: "JP:POLICY_RATE",
    macro_uk_bank_rate: "UK:POLICY_RATE",
    news_cctv: "NEWS:CCTV",
  };
  const normalizedRecords = operation === "options_snapshot" && records.every(record => "字段" in record && "值" in record)
    ? [Object.fromEntries(records.map(record => [String(record.字段), record.值]))]
    : records;
  const history: NormalizedRow[] = normalizedRecords.flatMap((record): NormalizedRow[] => {
    const symbol = text(record, ["代码", "证券代码", "基金代码", "合约代码", "期权代码", "symbol", "code", "指数代码"]) || operationSymbol[operation];
    const name = text(record, ["名称", "证券名称", "证券简称", "合约名称", "期权名称", "期权合约简称", "指数名称", "基金名称", "基金简称", "name"]);
    const period = text(record, ["报告期", "统计年度", "年份", "日期", "时间", "period", "date"]) ||
      Object.values(record).find(value => typeof value === "string" && value.trim())?.toString().trim() || "";
    const value = number(record, [
      "最新价", "最新", "现价", "最近成交价", "成交价", "最新值", "库存", "trade", "last", "收盘", "收盘价", "结算价", "价格", "净值", "单位净值", "price", "close", "value",
    ]);
    const date = dateValue(record, fallbackDate);
    // The A-share spot response provides only a clock time. The Python bridge
    // attaches a cross-checked exchange session; older undated responses are
    // not eligible for a fabricated retrieval-day observation.
    if ((operation === "stock_snapshot" || operation === "cn_index_snapshot") &&
      !/^\d{4}-\d{2}-\d{2}$/.test(text(record, ["交易日期"]))) return [];
    const common: Record<string, unknown> = {
      symbol,
      ...(name ? { name } : {}),
      ...pickFields(record, {
        change: ["涨跌额", "涨跌", "change"],
        changePct: ["涨跌幅", "涨幅", "change_pct", "changePct", "changepercent"],
        volume: ["成交量", "成交数量", "成交", "volume"],
        tradeValue: ["成交额", "成交金额", "trade_value"],
        openInterest: ["持仓量", "持仓", "open_interest", "position"],
        inventoryChange: ["增减", "库存增减"],
        open: ["开盘", "开盘价", "open"],
        high: ["最高", "最高价", "high"],
        low: ["最低", "最低价", "low"],
        settlementPrice: ["结算价", "结算", "settlement", "settlement_price"],
        exchange: ["交易所", "exchange"],
        currency: ["币种", "currency"],
      }),
    };
    // AKShare's Chinese futures connector reports changepercent as a
    // decimal ratio (0.006 = 0.6%), while the global futures connector
    // reports percentage points (0.1 = 0.1%). Normalize only the Chinese
    // connector so the terminal never displays a misleading unit.
    if (operation === "futures_cn_snapshot") {
      const rawChangePct = number(record, ["changepercent"]);
      if (rawChangePct !== null) common.changePct = rawChangePct * 100;
      const trade = number(record, ["trade", "最新价", "最新"]);
      const preClose = number(record, ["preclose", "昨结", "prevsettlement"]);
      if (trade !== null && preClose !== null) common.change = trade - preClose;
    }
    if (operation === "news_publication" || operation === "news_cctv") {
      const title = text(record, ["标题", "title", "tag"]);
      const summary = text(record, ["摘要", "summary", "内容", "content", "description"]);
      const url = text(record, ["链接", "url"]);
      const articleSymbol = url || `${operation}:${date}:${title}`.slice(0, 240);
      return title || summary ? [{ date, value: null, fields: { symbol: articleSymbol, title, summary, url } }] : [];
    }
    if (operation === "stock_directory") {
      if (!symbol && !name) return [];
      return [{
        date,
        value: null,
        fields: {
          symbol: symbol || operationSymbol[operation],
          name,
          exchange: text(record, ["市场", "交易所", "exchange"]),
          listingStatus: text(record, ["上市状态", "状态", "status"]),
          directory: true,
        },
      }];
    }
    if (operation === "etf_snapshot") {
      const navDate = text(record, ["最新-交易日"]);
      const queryDate = text(record, ["查询日期"]);
      const nav = number(record, ["最新-单位净值", "当前-单位净值"]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(navDate) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(queryDate) ||
          navDate > queryDate || queryDate > retrievedAt.slice(0, 10) ||
          nav === null || nav <= 0 ||
          symbol === operationSymbol[operation]) return [];
      return [{
        date: navDate,
        value: nav,
        fields: {
          symbol,
          name,
          fundCode: symbol,
          fundName: name,
          netAssetValue: nav,
          cumulativeNav: number(record, ["最新-累计净值", "当前-累计净值"]),
          changePct: number(record, ["增长率"]),
          fundType: "ETF",
          currency: "CNY",
        },
      }];
    }
    if (operation === "bond_curve") {
      const curve = pickFields(record, {
        china2y: ["中国国债收益率2年", "中国国债收益率 2年"],
        china5y: ["中国国债收益率5年", "中国国债收益率 5年"],
        china10y: ["中国国债收益率10年", "中国国债收益率 10年"],
        china30y: ["中国国债收益率30年", "中国国债收益率 30年"],
        china10y2y: ["中国国债收益率10年-2年", "中国国债收益率 10年-2年"],
        us2y: ["美国国债收益率2年", "美国国债收益率 2年"],
        us5y: ["美国国债收益率5年", "美国国债收益率 5年"],
        us10y: ["美国国债收益率10年", "美国国债收益率 10年"],
        us30y: ["美国国债收益率30年", "美国国债收益率 30年"],
        us10y2y: ["美国国债收益率10年-2年", "美国国债收益率 10年-2年"],
      });
      const bondValue = number(record, ["美国国债收益率10年", "美国国债收益率 10年", "中国国债收益率10年", "中国国债收益率 10年"]);
      return bondValue === null && Object.keys(curve).length === 0
        ? []
        : [{ date, value: bondValue, fields: { symbol: operationSymbol[operation], ...curve, curveType: "public_daily_yield_curve" } }];
    }
    if (operation === "macro_japan_bank_rate" || operation === "macro_uk_bank_rate") {
      const publishedOn = text(record, ["发布日期"]);
      const actual = number(record, ["现值"]);
      // The same calendar includes future announcements with a missing
      // actual value. Neither a forecast date nor the previous rate is a new
      // policy decision; only an already published actual enters the ledger.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedOn) ||
          publishedOn > retrievedAt.slice(0, 10) || actual === null) return [];
      return [{
        date: publishedOn,
        value: actual,
        fields: {
          symbol: operationSymbol[operation],
          period,
          previous: number(record, ["前值"]),
        },
      }];
    }
    if (operation === "economic_gdp" || operation === "economic_cpi" || operation === "economic_pmi") {
      const macroValue = number(record, ["国内生产总值-绝对值", "国内生产总值-同比增长", "全国居民消费价格指数-同比增长", "制造业PMI", "制造业-指数", "非制造业PMI", "非制造业-指数", "同比增长", "value"]);
      return [{ date, value: macroValue, fields: { ...common, period } }];
    }
    if (operation === "fund_snapshot") {
      const netAssetKey = Object.keys(record).find(key => /单位净值$/.test(key));
      const fundValue = netAssetKey ? number(record, [netAssetKey]) : value;
      if (fundValue === null) return [];
      return [{ date, value: fundValue, fields: { ...common, fundCode: symbol, fundName: name, netAssetValue: fundValue } }];
    }
    if (value === null) return [];
    return [{ date, value, fields: common }];
  });
  const deduped = new Map<string, NormalizedRow>();
  for (const row of history) {
    const key = `${row.date}|${String(row.fields?.symbol ?? "")}|${JSON.stringify(row.fields ?? {})}`;
    if (!deduped.has(key)) deduped.set(key, row);
  }
  // Connectors are not consistent about ordering (some return newest first,
  // others oldest first). Sort by the normalized observation date before
  // applying the retention window so the archive keeps the newest observations
  // instead of accidentally retaining only the oldest slice.
  const rows = [...deduped.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-10_000);
  return {
    available: rows.length > 0,
    symbol: String(rows[0]?.fields?.symbol ?? operation).slice(0, 120),
    source: SOURCE,
    sourceUrl: `backend:akshare:${operation}`,
    observedAt: rows.map(row => row.date).sort().at(-1) ?? null,
    retrievedAt,
    realtime: ["hk_stock_snapshot", "us_stock_snapshot", "global_index_snapshot", "fund_snapshot", "forex_snapshot", "futures_snapshot", "futures_cn_snapshot", "options_snapshot"].includes(operation),
    delayStatus: operation === "stock_snapshot" || operation === "cn_index_snapshot" ? "已核实交易日日频快照；非盘中实时"
      : operation === "etf_snapshot" ? "ETF单位净值；按交易日更新，非成交价格"
      : operation.startsWith("economic_") || operation === "macro_japan_bank_rate" || operation === "macro_uk_bank_rate"
        ? "政策发布周期数据"
        : operation === "news_publication" ? "发布时更新" : "以接口返回时间为准",
    limitation: operation === "etf_snapshot"
      ? "只保存有明确交易日的 ETF 单位净值；它不是交易所成交价或盘中实时行情，缺失值不补造。"
      : operation === "stock_snapshot" || operation === "cn_index_snapshot"
      ? "价格来自公开市场截面，交易日由同一市场基准标的的日线收盘交叉核验；无成交标的不归入该交易日，盘中价格不保证实时。"
      : LIMITATION,
    history: rows,
  };
}

export async function fetchAkShareManagedDataset(operation: AkShareOperation): Promise<AkShareManagedResult> {
  const result = await runAkShareOperation(operation);
  return normalizeAkShareDataset(operation, result.records, result.retrievedAt);
}

export function getAkShareCatalog() {
  return listAkShareRouteDecisions().map(item => ({
    ...item,
    provider: "akshare",
    executable: true,
    persisted: true,
    frontendModule: item.route,
    frontendEntry: item.frontendPath,
  }));
}

export async function getAkShareProviderStatus() {
  const catalog = getAkShareCatalog();
  const datasetByOperation: Record<string, string> = {
    stock_snapshot: "akshare-cn-stock-snapshot",
    stock_directory: "akshare-cn-stock-directory",
    hk_stock_snapshot: "akshare-hk-stock-snapshot",
    us_stock_snapshot: "akshare-us-stock-snapshot",
    cn_index_snapshot: "akshare-cn-index-snapshot",
    global_index_snapshot: "akshare-global-index-snapshot",
    etf_snapshot: "akshare-etf-snapshot",
    fund_snapshot: "akshare-fund-snapshot",
    forex_snapshot: "akshare-forex-snapshot",
    futures_snapshot: "akshare-futures-snapshot",
    futures_cn_snapshot: "akshare-cn-futures-snapshot",
    futures_inventory: "akshare-cn-futures-inventory",
    options_snapshot: "akshare-options-snapshot",
    bond_curve: "akshare-bond-curve",
    news_publication: "akshare-news-publication",
    economic_gdp: "akshare-economic-gdp",
    economic_cpi: "akshare-economic-cpi",
    economic_pmi: "akshare-economic-pmi",
    macro_semiconductor_index: "akshare-global-sox-index",
    macro_shipping_bdi: "akshare-global-shipping-bdi",
    macro_japan_bank_rate: "akshare-japan-bank-rate",
    macro_uk_bank_rate: "akshare-uk-bank-rate",
    news_cctv: "akshare-news-cctv",
  };
  const db = await getDb();
  const stateRows = db ? await db.select().from(managedPublicDatasetStates) : [];
  const archiveCounts = db
      ? await db.select({
        contract: marketDataObservationHistory.dataContractId,
        count: sql<number>`count(*)`,
        observedAt: sql<string>`max(${marketDataObservationHistory.observationDate})`,
      }).from(marketDataObservationHistory).where(sql`${marketDataObservationHistory.dataContractId} like '%akshare.v1'`).groupBy(marketDataObservationHistory.dataContractId)
    : [];
  const countByContract = new Map(archiveCounts.map(row => [row.contract, Number(row.count ?? 0)]));
  const observationByContract = new Map(archiveCounts.map(row => [row.contract, row.observedAt]));
  const localStatus = db ? null : await getAkShareLocalLedgerStatus();
  const localRowsByContract = new Map<string, Awaited<ReturnType<typeof readAkShareObservations>>>();
  if (!db) {
    await Promise.all(catalog.map(async item => {
      localRowsByContract.set(item.contract, await readAkShareObservations(item.contract, 10_000));
    }));
  }
  const stateById = new Map(stateRows.map(row => [row.datasetId, row]));
  const localStateByContract = new Map<string, Awaited<ReturnType<typeof getAkShareDatasetState>>>();
  if (!db) {
    await Promise.all(catalog.map(async item => {
      localStateByContract.set(item.contract, await getAkShareDatasetState(item.contract));
    }));
  }
  const results = catalog.map(item => {
    const state = stateById.get(datasetByOperation[item.operation]);
    const localRows = localRowsByContract.get(item.contract) ?? [];
    const localState = localStateByContract.get(item.contract);
    const status = state?.lastStatus === "available" || localState?.lastStatus === "succeeded" ? "available" as const
      : state?.lastStatus === "unavailable" || localState?.lastStatus === "failed" ? "unavailable" as const
        : state?.lastStatus === "failed" ? "unavailable" as const
        : "not_checked" as const;
    return {
      operation: item.operation,
      status,
      // Market observation date is not the collection time. In particular,
      // holiday snapshots must continue to show the last verified session.
      observedAt: observationByContract.get(item.contract) ?? localRows[0]?.observationDate ?? null,
      lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? localState?.lastSuccessAt ?? null,
      rowCount: countByContract.get(item.contract) ?? localRows.length,
      error: state?.lastError ?? localState?.lastError ?? null,
    };
  });
  const available = results.filter(item => item.status === "available").length;
  const unavailable = results.filter(item => item.status === "unavailable").length;
  const notChecked = results.filter(item => item.status === "not_checked").length;
  return {
    provider: "akshare",
    label: "AKShare 公共数据接口",
    catalogCount: catalog.length,
    boundCount: catalog.length,
    availableCount: available,
    unavailableCount: unavailable,
    notCheckedCount: notChecked,
    storage: db ? "database" as const : "local-persistent-fallback" as const,
    databaseConfigured: Boolean(db),
    lastAttemptAt: localStatus?.lastAttemptAt ?? null,
    lastSuccessAt: localStatus?.lastSuccessAt ?? null,
    results,
    bindings: catalog,
    verifiedAt: new Date().toISOString(),
    boundary: "只有实际返回并通过字段清洗的数据才进入归档；实时状态按接口返回能力标记，不将历史或发布周期数据标为实时行情。",
  };
}
