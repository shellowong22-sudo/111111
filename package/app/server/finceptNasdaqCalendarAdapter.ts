const NASDAQ_BASE = "https://api.nasdaq.com/api";
const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  origin: "https://www.nasdaq.com",
  referer: "https://www.nasdaq.com/",
  "user-agent": "Mozilla/5.0 FinanceHub/1.0",
} as const;

type CalendarPoint = {
  date: string;
  value: number | null;
  fields: Record<string, unknown>;
};

type CalendarResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: string;
  limitation: string;
  history: CalendarPoint[];
};

function text(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw || /^(?:n\/a|na|--|-)$/.test(raw.toLowerCase())) return null;
  const negative = /^\(.*\)$/.test(raw);
  const match = raw.replace(/[(),$,%]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : null;
}

function isoDate(value: unknown, fallback: string | null = null) {
  const raw = text(value);
  if (!raw) return fallback;
  const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mmddyyyy) {
    const date = new Date(Date.UTC(Number(mmddyyyy[3]), Number(mmddyyyy[1]) - 1, Number(mmddyyyy[2])));
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : fallback;
  }
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : fallback;
}

function dateRange(days: number) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: Math.max(1, days) }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

async function requestJson(path: string) {
  const response = await fetch(`${NASDAQ_BASE}${path}`, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Nasdaq calendar HTTP ${response.status}`);
  return await response.json() as any;
}

function result(
  symbol: string,
  source: string,
  sourceUrl: string,
  history: CalendarPoint[],
  retrievedAt: Date,
  limitation: string,
): CalendarResult {
  return {
    available: history.length > 0,
    symbol,
    source,
    sourceUrl,
    // Calendar rows intentionally contain future event dates.  `observedAt`
    // is the provider read time for status/freshness; the event date remains
    // in each archived row and must not be mistaken for a current quote.
    observedAt: history.length ? retrievedAt.toISOString() : null,
    retrievedAt: retrievedAt.toISOString(),
    realtime: false,
    delayStatus: "public_calendar_observation",
    limitation,
    history,
  };
}

function dedupe(points: CalendarPoint[]) {
  const unique = new Map<string, CalendarPoint>();
  for (const point of points) {
    const fields = point.fields;
    const key = [
      point.date,
      fields.eventType,
      fields.symbol,
      fields.country,
      fields.eventName,
      fields.gmt,
    ].join("|");
    if (!unique.has(key)) unique.set(key, point);
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function parseNasdaqEarningsRows(rows: unknown[], reportDate: string): CalendarPoint[] {
  return rows.flatMap((row: any) => {
    const symbol = text(row?.symbol)?.toUpperCase();
    const companyName = text(row?.name);
    if (!symbol || !companyName) return [];
    const date = isoDate(reportDate);
    if (!date) return [];
    const epsPrevious = number(row?.lastYearEPS);
    const epsConsensus = number(row?.epsForecast);
    const epsActual = number(row?.eps);
    return [{
      date,
      value: epsActual ?? epsConsensus ?? epsPrevious,
      fields: {
        eventType: "earnings",
        eventDate: date,
        symbol,
        companyName,
        reportDate: date,
        epsPrevious,
        epsConsensus,
        epsActual,
        numEstimates: number(row?.noOfEsts),
        periodEnding: text(row?.fiscalQuarterEnding),
        previousReportDate: isoDate(row?.lastYearRptDt),
        reportingTime: text(row?.time)?.replace(/^time-/, "") ?? null,
        marketCap: number(row?.marketCap),
        freshness: "public_delayed_calendar",
      },
    }];
  });
}

export function parseNasdaqDividendRows(rows: unknown[], fallbackDate: string): CalendarPoint[] {
  return rows.flatMap((row: any) => {
    const symbol = text(row?.symbol)?.toUpperCase();
    const companyName = text(row?.companyName);
    const exDividendDate = isoDate(row?.dividend_Ex_Date, fallbackDate);
    if (!symbol || !companyName || !exDividendDate) return [];
    const amount = number(row?.dividend_Rate);
    return [{
      date: exDividendDate,
      value: amount,
      fields: {
        eventType: "dividend",
        eventDate: exDividendDate,
        symbol,
        companyName,
        exDividendDate,
        paymentDate: isoDate(row?.payment_Date),
        recordDate: isoDate(row?.record_Date),
        declarationDate: isoDate(row?.announcement_Date),
        amount,
        annualizedAmount: number(row?.indicated_Annual_Dividend),
        freshness: "public_delayed_calendar",
      },
    }];
  });
}

export function parseNasdaqIpoRows(rows: unknown[], status: string): CalendarPoint[] {
  return rows.flatMap((row: any) => {
    const symbol = text(row?.proposedTickerSymbol)?.toUpperCase();
    const companyName = text(row?.companyName);
    if (!companyName) return [];
    const eventDate = isoDate(row?.pricedDate) ?? isoDate(row?.expectedPriceDate) ?? isoDate(row?.filedDate) ?? isoDate(row?.withdrawDate);
    if (!eventDate) return [];
    const sharePrice = number(row?.proposedSharePrice);
    return [{
      date: eventDate,
      value: sharePrice,
      fields: {
        eventType: "ipo",
        eventDate,
        symbol: symbol ?? null,
        companyName,
        ipoDate: isoDate(row?.pricedDate),
        sharePrice,
        exchange: text(row?.proposedExchange),
        offerAmount: number(row?.dollarValueOfSharesOffered),
        shareCount: number(row?.sharesOffered),
        expectedPriceDate: isoDate(row?.expectedPriceDate),
        filedDate: isoDate(row?.filedDate),
        withdrawDate: isoDate(row?.withdrawDate),
        dealStatus: text(row?.dealStatus) ?? status,
        dealId: text(row?.dealID),
        freshness: "public_delayed_calendar",
      },
    }];
  });
}

export function parseNasdaqEconomicRows(rows: unknown[], eventDate: string): CalendarPoint[] {
  return rows.flatMap((row: any) => {
    const country = text(row?.country);
    const eventName = text(row?.eventName);
    if (!country || !eventName) return [];
    const gmt = text(row?.gmt);
    const actual = text(row?.actual);
    const consensus = text(row?.consensus);
    const previous = text(row?.previous);
    const symbol = `NASDAQ:ECONOMIC:${country}:${eventName}`.slice(0, 120);
    return [{
      date: eventDate,
      value: number(actual) ?? number(consensus) ?? number(previous),
      fields: {
        eventType: "economic_event",
        eventDate,
        symbol,
        country,
        eventName,
        gmt,
        actual,
        consensus,
        previous,
        description: text(row?.description),
        freshness: "public_delayed_calendar",
      },
    }];
  });
}

export async function fetchFinceptNasdaqEarningsCalendar(days = 7): Promise<CalendarResult> {
  const retrievedAt = new Date();
  const history: CalendarPoint[] = [];
  try {
    for (const date of dateRange(days)) {
      const body = await requestJson(`/calendar/earnings?date=${date}`);
      history.push(...parseNasdaqEarningsRows(body?.data?.rows ?? [], date));
    }
    return result(
      "NASDAQ:EARNINGS",
      "Nasdaq public earnings calendar",
      `${NASDAQ_BASE}/calendar/earnings`,
      dedupe(history),
      retrievedAt,
      history.length
        ? "Nasdaq 公开财报日历观察；不代表已披露的完整财务报表，也不是实时交易报价。"
        : "Nasdaq 财报日历本次没有返回可验证事件；没有生成占位数据。",
    );
  } catch (error) {
    return result(
      "NASDAQ:EARNINGS",
      "Nasdaq public earnings calendar",
      `${NASDAQ_BASE}/calendar/earnings`,
      [],
      retrievedAt,
      `Nasdaq 财报日历请求失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function fetchFinceptNasdaqDividendCalendar(days = 7): Promise<CalendarResult> {
  const retrievedAt = new Date();
  const history: CalendarPoint[] = [];
  try {
    for (const date of dateRange(days)) {
      const body = await requestJson(`/calendar/dividends?date=${date}`);
      history.push(...parseNasdaqDividendRows(body?.data?.calendar?.rows ?? [], date));
    }
    return result(
      "NASDAQ:DIVIDENDS",
      "Nasdaq public dividend calendar",
      `${NASDAQ_BASE}/calendar/dividends`,
      dedupe(history),
      retrievedAt,
      history.length
        ? "Nasdaq 公开分红日历观察；金额与日期以公开日历为准，不代表实时价格或投资建议。"
        : "Nasdaq 分红日历本次没有返回可验证事件；没有生成占位数据。",
    );
  } catch (error) {
    return result(
      "NASDAQ:DIVIDENDS",
      "Nasdaq public dividend calendar",
      `${NASDAQ_BASE}/calendar/dividends`,
      [],
      retrievedAt,
      `Nasdaq 分红日历请求失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function fetchFinceptNasdaqIpoCalendar(months = 2): Promise<CalendarResult> {
  const retrievedAt = new Date();
  const history: CalendarPoint[] = [];
  try {
    const start = new Date();
    start.setUTCDate(1);
    for (let index = 0; index < Math.max(1, months); index += 1) {
      const date = new Date(start);
      date.setUTCMonth(start.getUTCMonth() + index);
      const month = date.toISOString().slice(0, 7);
      const body = await requestJson(`/ipo/calendar?date=${month}`);
      const data = body?.data ?? {};
      for (const status of ["upcoming", "priced", "filed", "withdrawn"]) {
        const rows = status === "upcoming"
          ? data?.upcoming?.upcomingTable?.rows
          : data?.[status]?.rows;
        history.push(...parseNasdaqIpoRows(Array.isArray(rows) ? rows : [], status));
      }
    }
    return result(
      "NASDAQ:IPO",
      "Nasdaq public IPO calendar",
      `${NASDAQ_BASE}/ipo/calendar`,
      dedupe(history),
      retrievedAt,
      history.length
        ? "Nasdaq 公开 IPO 日历观察；不代表承销、上市或交易执行状态。"
        : "Nasdaq IPO 日历本次没有返回可验证事件；没有生成占位数据。",
    );
  } catch (error) {
    return result(
      "NASDAQ:IPO",
      "Nasdaq public IPO calendar",
      `${NASDAQ_BASE}/ipo/calendar`,
      [],
      retrievedAt,
      `Nasdaq IPO 日历请求失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function fetchFinceptNasdaqEconomicCalendar(days = 7): Promise<CalendarResult> {
  const retrievedAt = new Date();
  const history: CalendarPoint[] = [];
  try {
    for (const date of dateRange(days)) {
      const body = await requestJson(`/calendar/economicevents?date=${date}`);
      history.push(...parseNasdaqEconomicRows(body?.data?.rows ?? [], date));
    }
    return result(
      "NASDAQ:ECONOMIC",
      "Nasdaq public economic calendar",
      `${NASDAQ_BASE}/calendar/economicevents`,
      dedupe(history),
      retrievedAt,
      history.length
        ? "Nasdaq 公开宏观事件日历观察；事件数值可能为空，不等同于官方统计序列的最终发布值。"
        : "Nasdaq 宏观事件日历本次没有返回可验证事件；没有生成占位数据。",
    );
  } catch (error) {
    return result(
      "NASDAQ:ECONOMIC",
      "Nasdaq public economic calendar",
      `${NASDAQ_BASE}/calendar/economicevents`,
      [],
      retrievedAt,
      `Nasdaq 宏观事件日历请求失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
