/**
 * Market freshness is a typed boundary between provider observations and
 * current-market UI.  It deliberately does not infer a quote from a cached
 * value: a timestamp and an explicitly declared provider status are required.
 */

export type MarketProviderStatus =
  | "realtime"
  | "delayed"
  | "end_of_day"
  | "provider_defined"
  | "archived"
  | "unknown";

export type MarketFreshnessState =
  | "current"
  | "daily"
  | "stale"
  | "archived"
  | "unknown";

export type MarketFreshnessAssessment = {
  state: MarketFreshnessState;
  currentAvailable: boolean;
  dailyAvailable: boolean;
  observedAt: string | null;
  ageMs: number | null;
  maxAgeMs: number | null;
  reason: string;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Daily observations are date-labelled by many public providers. Treat the
 * label as the end of that observation day so a same-day release is not
 * rejected merely because the provider omitted an intraday timestamp.
 */
function parseObservationTime(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const parsed = Date.parse(dateOnly ? `${trimmed}T23:59:59.999Z` : trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function maxAgeFor(status: MarketProviderStatus): number | null {
  switch (status) {
    case "realtime":
      return 5 * MINUTE_MS;
    case "delayed":
      // Public delayed feeds can legally lag; two hours is the maximum window
      // in which a current-market surface may still show the observation.
      return 2 * HOUR_MS;
    case "end_of_day":
    case "provider_defined":
      // Daily/official-release data is allowed a weekend and holiday grace
      // window, but never remains current indefinitely.
      return 72 * HOUR_MS;
    case "archived":
    case "unknown":
      return null;
  }
}

/**
 * Evaluate the provider observation without generating or backfilling values.
 * This is intentionally deterministic so a UI cannot turn an uncertain result
 * into a green "live" state.
 */
export function assessMarketFreshness(input: {
  status: MarketProviderStatus | string | null | undefined;
  observedAt: string | null | undefined;
  now?: Date;
}): MarketFreshnessAssessment {
  const status: MarketProviderStatus =
    input.status === "realtime" ||
    input.status === "delayed" ||
    input.status === "end_of_day" ||
    input.status === "provider_defined" ||
    input.status === "archived"
      ? input.status
      : "unknown";
  const observedAt =
    typeof input.observedAt === "string" && input.observedAt.trim()
      ? input.observedAt
      : null;
  if (status === "archived") {
    return {
      state: "archived",
      currentAvailable: false,
      dailyAvailable: false,
      observedAt,
      ageMs: null,
      maxAgeMs: null,
      reason: "仅历史归档，不得进入当前行情。",
    };
  }
  const observedTime = parseObservationTime(observedAt);
  const maxAgeMs = maxAgeFor(status);
  if (observedTime === null || maxAgeMs === null) {
    return {
      state: "unknown",
      currentAvailable: false,
      dailyAvailable: false,
      observedAt,
      ageMs: null,
      maxAgeMs,
      reason: "缺少可验证的观测时间或供应商时效声明。",
    };
  }
  const now = input.now?.getTime() ?? Date.now();
  const ageMs = Math.max(0, now - observedTime);
  if (ageMs > maxAgeMs) {
    return {
      state: "stale",
      currentAvailable: false,
      dailyAvailable: false,
      observedAt,
      ageMs,
      maxAgeMs,
      reason: "观测已超过允许时效窗口，等待下一次真实更新。",
    };
  }
  const daily = status === "end_of_day" || status === "provider_defined";
  return {
    state: daily ? "daily" : "current",
    currentAvailable: !daily,
    dailyAvailable: daily,
    observedAt,
    ageMs,
    maxAgeMs,
    reason: daily
      ? "最新发布型日频/官方观测；不是盘中成交报价。"
      : status === "delayed"
        ? "当前盘中公开观察，供应商可能延迟。"
        : "当前盘中观察。",
  };
}

export function isCurrentMarketObservation(
  input: Parameters<typeof assessMarketFreshness>[0],
): boolean {
  return assessMarketFreshness(input).currentAvailable;
}

