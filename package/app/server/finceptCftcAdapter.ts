const API_URL = "https://www.cftc.gov/dea/newcot/f_disagg.txt";

type Observation = {
  date: string;
  value: number;
  symbol: string;
  fields: Record<string, string | number | null>;
};

export type CftcSeriesResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "weekly_publication";
  history: Observation[];
  limitation: string;
};

// The Fincept ZIP exposes the CFTC wrapper for the main commodity, FX,
// index, rates and crypto contracts. Keep the same contract universe here,
// while still parsing only the official disaggregated futures-only report.
const MARKET_CODES = new Set([
  "002602", "001602", "005602", "033661", "073732", "083731", "080732",
  "057642", "054642", "067651", "02365B", "111659", "022651",
  "088691", "084691", "085692", "076651", "075651",
  "099741", "097741", "096742", "092741", "090741", "232741",
  "13874A", "209742", "124603", "240741", "1170E1",
  "020601", "043602", "044601", "042601", "045601",
  "133741", "146021", "098662",
]);

const MARKET_LABELS: Record<string, string> = {
  "001602": "CBOT 软红冬小麦期货",
  "002602": "CBOT 玉米期货",
  "005602": "CBOT 大豆期货",
  "033661": "ICE 棉花期货",
  "073732": "ICE 可可期货",
  "083731": "ICE 咖啡期货",
  "080732": "ICE 原糖期货",
  "057642": "CME 活牛期货",
  "054642": "CME 瘦肉猪期货",
  "067651": "NYMEX WTI 原油期货",
  "088691": "COMEX 黄金期货",
  "02365B": "NYMEX 天然气期货",
  "111659": "NYMEX RBOB 汽油期货",
  "022651": "NYMEX 取暖油期货",
  "084691": "COMEX 白银期货",
  "085692": "COMEX 铜期货",
  "076651": "NYMEX 铂金期货",
  "075651": "NYMEX 钯金期货",
  "099741": "CME 欧元期货",
  "097741": "CME 日元期货",
  "096742": "CME 英镑期货",
  "092741": "CME 瑞郎期货",
  "090741": "CME 加元期货",
  "232741": "CME 澳元期货",
  "13874A": "CME E-mini 标普 500 期货",
  "209742": "CME E-mini 纳斯达克 100 期货",
  "124603": "CBOT 道琼斯指数期货",
  "240741": "CME 日经 225 期货",
  "1170E1": "CBOE VIX 期货",
  "043602": "CBOT 10年期美国国债期货",
  "044601": "CBOT 5年期美国国债期货",
  "042601": "CBOT 2年期美国国债期货",
  "045601": "CME 联邦基金期货",
  "133741": "CME 比特币期货",
  "146021": "CME 以太坊期货",
  "098662": "ICE 美元指数期货",
  "020601": "CBOT 美国长期国债期货",
};

function csvFields(line: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  fields.push(value.trim());
  return fields;
}

function numberAt(fields: string[], index: number) {
  const value = Number(String(fields[index] ?? "").replace(/,/g, "").trim());
  return Number.isFinite(value) ? value : null;
}

function dateAt(fields: string[], index: number) {
  const value = String(fields[index] ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function net(long: number | null, short: number | null) {
  return long === null || short === null ? null : long - short;
}

/**
 * The ZIP's CFTC wrapper normally queries the Socrata JSON resources. Those
 * resources can reject anonymous requests with 403, while the CFTC publishes
 * the same current disaggregated futures-only report as this public text file.
 * The first seven fields are report metadata; the following fields follow the
 * CFTC disaggregated futures-only layout.
 */
export function parseFinceptCftcDisaggregatedText(text: string): Observation[] {
  const rows: Observation[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
    const fields = csvFields(line);
    if (fields.length < 24) continue;
    const contract = fields[0]?.trim();
    const reportDate = dateAt(fields, 2);
    const marketCode = fields[3]?.trim().toUpperCase();
    if (!contract || !reportDate || !marketCode || !MARKET_CODES.has(marketCode)) continue;
    const openInterest = numberAt(fields, 7);
    if (openInterest === null || openInterest < 0) continue;
    const producerLong = numberAt(fields, 8);
    const producerShort = numberAt(fields, 9);
    const swapLong = numberAt(fields, 10);
    const swapShort = numberAt(fields, 11);
    const managedMoneyLong = numberAt(fields, 13);
    const managedMoneyShort = numberAt(fields, 14);
    const otherReportLong = numberAt(fields, 16);
    const otherReportShort = numberAt(fields, 17);
    const nonReportableLong = numberAt(fields, 21);
    const nonReportableShort = numberAt(fields, 22);
    const symbol = `CFTC:${marketCode}`;
    const displayName = MARKET_LABELS[marketCode] ?? "全球期货持仓合约";
    const identity = `${symbol}|${reportDate}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    rows.push({
      date: reportDate,
      value: openInterest,
      symbol,
      fields: {
        symbol,
        name: displayName,
        contractName: displayName,
        marketCode,
        openInterest,
        producerLong,
        producerShort,
        producerNet: net(producerLong, producerShort),
        swapLong,
        swapShort,
        swapNet: net(swapLong, swapShort),
        managedMoneyLong,
        managedMoneyShort,
        managedMoneyNet: net(managedMoneyLong, managedMoneyShort),
        otherReportLong,
        otherReportShort,
        otherReportNet: net(otherReportLong, otherReportShort),
        nonReportableLong,
        nonReportableShort,
        nonReportableNet: net(nonReportableLong, nonReportableShort),
        reportDate,
        unit: "合约数",
        observationType: "cftc_disaggregated_weekly",
      },
    });
  }
  return rows.sort((left, right) => left.symbol.localeCompare(right.symbol));
}

function result(history: Observation[], limitation: string): CftcSeriesResult {
  return {
    available: history.length > 0,
    symbol: "CFTC:COT:DISAGG",
    source: "CFTC official disaggregated futures-only weekly report",
    sourceUrl: API_URL,
    observedAt: history.map(item => item.date).sort().at(-1) ?? null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "weekly_publication",
    history,
    limitation,
  };
}

export async function fetchFinceptCftcDisaggregated(): Promise<CftcSeriesResult> {
  try {
    const response = await fetch(API_URL, {
      headers: { accept: "text/plain", "user-agent": "Ucheer-Finance/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`CFTC_HTTP_${response.status}`);
    const history = parseFinceptCftcDisaggregatedText(await response.text());
    return result(
      history,
      "CFTC 官方周度持仓报告，按报告日归档；不是实时期货报价、成交或订单簿。",
    );
  } catch (error) {
    return result(
      [],
      `CFTC 周度持仓报告当前不可用：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
