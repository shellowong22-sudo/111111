const API_URL =
  "https://www.cnb.cz/en/financial-markets/foreign-exchange-market/central-bank-exchange-rate-fixing/central-bank-exchange-rate-fixing/daily.txt";

type Observation = {
  date: string;
  value: number;
  fields: Record<string, string | number | null>;
};

export type CnbSeriesResult = {
  available: boolean;
  symbol: string;
  source: string;
  sourceUrl: string;
  observedAt: string | null;
  retrievedAt: string;
  realtime: false;
  delayStatus: "provider_defined";
  history: Observation[];
  limitation: string;
};

function parsePositiveNumber(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: string | undefined) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b/);
  if (!match) return null;
  const month = new Map([
    ["Jan", 1], ["Feb", 2], ["Mar", 3], ["Apr", 4], ["May", 5], ["Jun", 6],
    ["Jul", 7], ["Aug", 8], ["Sep", 9], ["Oct", 10], ["Nov", 11], ["Dec", 12],
  ]).get(match[2]);
  if (!month) return null;
  const date = `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

const CURRENCY_LABELS: Record<string, string> = {
  AUD: "澳元",
  BRL: "巴西雷亚尔",
  CAD: "加元",
  CHF: "瑞士法郎",
  CNY: "人民币",
  CZK: "捷克克朗",
  DKK: "丹麦克朗",
  EUR: "欧元",
  GBP: "英镑",
  HKD: "港元",
  HUF: "匈牙利福林",
  IDR: "印度尼西亚卢比",
  INR: "印度卢比",
  ISK: "冰岛克朗",
  JPY: "日元",
  KRW: "韩元",
  MXN: "墨西哥比索",
  MYR: "马来西亚林吉特",
  NOK: "挪威克朗",
  NZD: "新西兰元",
  PLN: "波兰兹罗提",
  RON: "罗马尼亚列伊",
  RUB: "俄罗斯卢布",
  SEK: "瑞典克朗",
  SGD: "新加坡元",
  TRY: "土耳其里拉",
  USD: "美元",
  ZAR: "南非兰特",
};

function result(input: {
  history: Observation[];
  sourceUrl: string;
  limitation: string;
}): CnbSeriesResult {
  return {
    available: input.history.length > 0,
    symbol: "CNB:TABLE:DAILY:CZK",
    source: "CNB official public daily fixing",
    sourceUrl: input.sourceUrl,
    observedAt: input.history.map(point => point.date).sort().at(-1) ?? null,
    retrievedAt: new Date().toISOString(),
    realtime: false,
    delayStatus: "provider_defined",
    history: input.history,
    limitation: input.limitation,
  };
}

/**
 * FinceptTerminal's public_apis_finance_data.py reads this no-key endpoint.
 * CNB publishes CZK per a stated amount of foreign currency; normalize to
 * CZK per one unit while retaining the published amount and fixing rate.
 */
export async function fetchFinceptCnbFxBasket(): Promise<CnbSeriesResult> {
  try {
    const response = await fetch(API_URL, {
      headers: { accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`CNB_HTTP_${response.status}`);
    const text = await response.text();
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const date = parseDate(lines[0]);
    if (!date) throw new Error("CNB_INVALID_PUBLICATION_DATE");
    const history: Observation[] = [];
    const seen = new Set<string>();
    for (const line of lines.slice(2)) {
      const [country, currency, amountText, codeText, rateText] = line.split("|").map(value => value.trim());
      const code = String(codeText ?? "").toUpperCase();
      const amount = parsePositiveNumber(amountText);
      const fixingRate = parsePositiveNumber(rateText);
      if (!/^[A-Z]{3}$/.test(code) || code === "CZK" || amount === null || fixingRate === null) continue;
      const value = Number((fixingRate / amount).toPrecision(15));
      if (!Number.isFinite(value) || value <= 0) continue;
      const symbol = `${code}/CZK`;
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      history.push({
        date,
        value,
        fields: {
          symbol,
          name: `${CURRENCY_LABELS[code] ?? `${country || code} ${currency || code}`}兑捷克克朗参考汇率`,
          base: code,
          quote: "CZK",
          currency: "CZK",
          unit: `CZK/${code}`,
          amount,
          fixingRate,
          observationType: "daily_fx_reference",
        },
      });
    }
    return result({
      history,
      sourceUrl: API_URL,
      limitation: "捷克央行每日公开定盘参考汇率，按公布数量归一化为 CZK/单位外币；不是实时或可执行报价。",
    });
  } catch (error) {
    return result({
      history: [],
      sourceUrl: API_URL,
      limitation: `捷克央行参考汇率当前不可用：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
