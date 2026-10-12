export type NasdaqSessionQuote = {
  symbol: string;
  session: 'pre_market' | 'regular' | 'after_hours';
  price: number;
  change: number | null;
  changePct: number | null;
  observedAt: string;
  providerTimestamp: string;
  providerRealtime: boolean;
  source: 'Nasdaq public quote';
};
export type NasdaqExtendedSession = NasdaqSessionQuote & { session: 'pre_market' | 'after_hours' };

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function quoteNumber(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[+$\-\d,.%\s]+$/.test(value)) return null;
  const parsed = Number(value.replace(/[$,%\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

// Nasdaq's "ET" is a named exchange timezone, not a fixed UTC offset.
// Resolve DST using America/New_York and reject timestamps that do not
// round-trip to the provider's stated local clock.
function parseEasternTimestamp(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) (AM|PM) ET$/.exec(value);
  if (!match) return null;
  const month = MONTHS[match[1]];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]) % 12 + (match[6] === 'PM' ? 12 : 0);
  const minute = Number(match[5]);
  if (day < 1 || day > 31 || Number(match[4]) < 1 || Number(match[4]) > 12 || minute > 59) return null;
  const noon = Date.UTC(year, month, day, 12);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', timeZoneName: 'shortOffset',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  });
  const zone = formatter.formatToParts(noon).find(part => part.type === 'timeZoneName')?.value ?? '';
  const offset = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
  if (!offset) return null;
  const minutes = (offset[1] === '+' ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0));
  const instant = new Date(Date.UTC(year, month, day, hour, minute) - minutes * 60_000);
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
  if (Number(parts.year) !== year || Number(parts.month) !== month + 1 ||
      Number(parts.day) !== day || Number(parts.hour) !== hour || Number(parts.minute) !== minute) return null;
  return instant;
}

/** Only accept a current, timestamped trade from the matching US security and exchange session. */
export function parseNasdaqSessionQuote(payload: any, expectedSymbol: string, now = new Date()): NasdaqSessionQuote | null {
  const data = payload?.data;
  if (data?.symbol !== expectedSymbol || !/^[A-Z]{1,6}$/.test(expectedSymbol)) return null;
  const session = data.marketStatus === 'Pre-Market' ? 'pre_market'
    : /^(After-Hours|After Hours|Post-Market)$/.test(data.marketStatus) ? 'after_hours'
      : /^(Open|Market Open|Regular Market)$/.test(data.marketStatus) ? 'regular' : null;
  if (!session) return null;
  const quote = data.primaryData;
  const price = quoteNumber(quote?.lastSalePrice);
  const observed = parseEasternTimestamp(quote?.lastTradeTimestamp);
  if (price === null || price <= 0 || !observed) return null;
  const age = now.getTime() - observed.getTime();
  if (age < -60_000 || age > 15 * 60_000) return null;
  const eastern = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(eastern.formatToParts(observed).map(part => [part.type, part.value]));
  const clock = Number(parts.hour) * 60 + Number(parts.minute);
  if (session === 'pre_market' ? clock < 240 || clock >= 570
    : session === 'regular' ? clock < 570 || clock >= 960
      : clock < 960 || clock >= 1200) return null;
  return {
    symbol: expectedSymbol,
    session,
    price,
    change: quoteNumber(quote.netChange),
    changePct: quoteNumber(quote.percentageChange),
    observedAt: observed.toISOString(),
    providerTimestamp: quote.lastTradeTimestamp,
    providerRealtime: quote.isRealTime === true,
    source: 'Nasdaq public quote',
  };
}

/** A regular-session trade must never be presented as a pre/after-hours trade. */
export function parseNasdaqExtendedSession(payload: any, expectedSymbol: string, now = new Date()): NasdaqExtendedSession | null {
  const quote = parseNasdaqSessionQuote(payload, expectedSymbol, now);
  return quote && quote.session !== 'regular' ? quote as NasdaqExtendedSession : null;
}

const cache = new Map<string, { until: number; value: NasdaqSessionQuote | null }>();
const pending = new Map<string, Promise<NasdaqSessionQuote | null>>();

export async function fetchNasdaqSessionQuote(symbol: string, assetClass: 'stocks' | 'index' | 'etf' = 'stocks'): Promise<NasdaqSessionQuote | null> {
  symbol = symbol.toUpperCase();
  if (!/^[A-Z]{1,6}$/.test(symbol)) return null;
  const key = `${assetClass}:${symbol}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) {
    // A cached observation must never outlive the freshness boundary.
    return hit.value && Date.now() - Date.parse(hit.value.observedAt) <= 15 * 60_000 ? hit.value : null;
  }
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    let value: NasdaqSessionQuote | null = null;
    try {
      const response = await fetch(`https://api.nasdaq.com/api/quote/${symbol}/info?assetclass=${assetClass}`, {
        headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) value = parseNasdaqSessionQuote(await response.json(), symbol);
    } catch { /* An unavailable feed remains unavailable; never reuse a prior session. */ }
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    // One active symbol may be checked each second; inactive or unavailable
    // sessions back off. A poll is not itself a new trade.
    cache.set(key, { until: Date.now() + (value?.providerRealtime ? 1_000 : 20_000), value });
    return value;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

export async function fetchNasdaqExtendedSession(symbol: string): Promise<NasdaqExtendedSession | null> {
  const quote = await fetchNasdaqSessionQuote(symbol);
  return quote && quote.session !== 'regular' ? quote as NasdaqExtendedSession : null;
}
