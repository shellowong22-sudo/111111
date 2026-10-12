import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { managedPublicDatasetStates } from "../drizzle/schema";
import { archiveCanonicalObservationSeries } from "./adminMarketIngestion";
import { archivePublicDatasetObservations } from "./publicDatasetPersistence";
import { getDb } from "./db";
import { fetchFinMindDataset, finMindDatasetRequiresDataId, type FinMindRow } from "./finmindApi";
import { FINMIND_MODULE_BINDINGS, type FinMindModuleBinding } from "../shared/finmindModuleBindings";
import { taiwanDerivativeUnderlying, taiwanFuturesContractName, taiwanOptionContractName } from "../shared/taiwanDerivativeNames";

const SYNC_BINDINGS = FINMIND_MODULE_BINDINGS.filter(binding => !binding.id.includes("directory"));
const STATE_PREFIX = "finmind:";
const localNextAttemptAt = new Map<string, number>();

function rowDate(row: FinMindRow): string | null {
  for (const key of ["date", "Date", "datetime", "time", "AnnouncementDate"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.slice(0, 32);
  }
  return null;
}

function numberValue(row: FinMindRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function textValue(row: FinMindRow, keys: string[]) {
  for (const key of keys) if (typeof row[key] === "string" && row[key]) return row[key] as string;
  return null;
}

function payloadFor(binding: FinMindModuleBinding, row: FinMindRow) {
  const symbol = textValue(row, ["stock_id", "future_id", "option_id"]) ?? binding.symbol;
  const date = rowDate(row);
  const common: Record<string, unknown> = { symbol, frequency: binding.frequency, freshness: binding.freshness };
  switch (binding.dataset) {
    case "TaiwanStockPrice":
      return { ...common, open: numberValue(row, ["open"]), high: numberValue(row, ["max", "high"]), low: numberValue(row, ["min", "low"]), close: numberValue(row, ["close"]), value: numberValue(row, ["close"]), volume: numberValue(row, ["Trading_Volume", "volume"]), change: numberValue(row, ["spread"]) };
    case "USStockPrice":
      return { ...common, open: numberValue(row, ["Open", "open"]), high: numberValue(row, ["High", "high"]), low: numberValue(row, ["Low", "low"]), close: numberValue(row, ["Close", "close"]), value: numberValue(row, ["Close", "close"]), volume: numberValue(row, ["Volume", "volume"]) };
    case "TaiwanStockPER":
      return { ...common, pe: numberValue(row, ["PER", "pe"]), pbr: numberValue(row, ["PBR", "pbr"]), dividendYield: numberValue(row, ["dividend_yield"]), value: numberValue(row, ["PER", "pe"]) };
    case "TaiwanStockDividend":
      return { ...common, value: numberValue(row, ["CashEarningsDistribution"]), cashDividend: numberValue(row, ["CashEarningsDistribution"]), announcementDate: textValue(row, ["AnnouncementDate"]), paymentDate: textValue(row, ["CashDividendPaymentDate"]) };
    case "TaiwanStockTotalReturnIndex":
      return { ...common, value: numberValue(row, ["price", "close", "value"]), close: numberValue(row, ["price", "close", "value"]) };
    case "GoldPrice":
      return { ...common, value: numberValue(row, ["Price", "price"]), price: numberValue(row, ["Price", "price"]) };
    case "TaiwanFuturesDaily":
    case "TaiwanOptionDaily":
      const derivativeCode = textValue(row, ["futures_id", "option_id"]) ?? binding.symbol;
      const derivativeMonth = textValue(row, ["contract_date", "contract_month"]) ?? "";
      const derivativeStrike = numberValue(row, ["strike_price"]);
      const derivativeRight = textValue(row, ["call_put"]) ?? "";
      return {
        ...common,
        underlyingSymbol: derivativeCode,
        underlyingName: taiwanDerivativeUnderlying(derivativeCode),
        contractName: binding.dataset === "TaiwanFuturesDaily"
          ? taiwanFuturesContractName(derivativeCode, derivativeMonth)
          : taiwanOptionContractName(derivativeCode, derivativeMonth, derivativeStrike, derivativeRight),
        value: numberValue(row, ["close", "settlement_price", "last_price"]),
        close: numberValue(row, ["close", "last_price"]),
        settlementPrice: numberValue(row, ["settlement_price"]),
        contractMonth: derivativeMonth,
        contractDate: derivativeMonth,
        strikePrice: derivativeStrike,
        optionType: derivativeRight,
        tradingSession: textValue(row, ["trading_session"]),
        volume: numberValue(row, ["volume", "trading_volume"]),
        openInterest: numberValue(row, ["open_interest"]),
      };
    case "TaiwanStockNews":
      return { ...common, title: textValue(row, ["title"]) ?? "市场信息", description: textValue(row, ["description"]) ?? "", articleDate: date };
    default:
      return { ...common, value: numberValue(row, ["value", "close", "price"]) };
  }
}

export function finMindObservationSymbol(binding: FinMindModuleBinding, row: FinMindRow) {
  if (binding.dataset !== "TaiwanFuturesDaily" && binding.dataset !== "TaiwanOptionDaily") return binding.symbol;
  const base = textValue(row, ["futures_id", "option_id"]) ?? binding.symbol;
  const contract = textValue(row, ["contract_date", "contract_month"]) ?? "NA";
  const strike = binding.dataset === "TaiwanOptionDaily" ? numberValue(row, ["strike_price"]) : null;
  const callPut = binding.dataset === "TaiwanOptionDaily" ? textValue(row, ["call_put"]) : null;
  const session = textValue(row, ["trading_session"]);
  const identity = [base, contract, strike, callPut, session].filter(value => value !== null && value !== "").join(":");
  if (identity.length <= 32) return identity;
  return `${base.slice(0, 7)}:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function stateId(binding: FinMindModuleBinding) { return `${STATE_PREFIX}${binding.id}`; }

async function recordState(binding: FinMindModuleBinding, input: { status: string; error: string | null; succeeded: boolean }) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const existing = (await db.select().from(managedPublicDatasetStates).where(eq(managedPublicDatasetStates.datasetId, stateId(binding))).limit(1))[0];
  const failures = input.succeeded ? 0 : (existing?.consecutiveFailures ?? 0) + 1;
  const retryMinutes = input.succeeded ? 30 : Math.min(360, 30 * 2 ** Math.min(failures - 1, 4));
  const values = { datasetId: stateId(binding), lastAttemptAt: now, lastSuccessAt: input.succeeded ? now : existing?.lastSuccessAt ?? null, nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000), consecutiveFailures: failures, lastStatus: input.status, lastError: input.error?.slice(0, 1000) ?? null, updatedAt: now };
  await db.insert(managedPublicDatasetStates).values(values).onDuplicateKeyUpdate({ set: values });
}

export async function syncFinMindBinding(binding: FinMindModuleBinding, options: { force?: boolean } = {}) {
  const db = await getDb();
  const state = db ? (await db.select().from(managedPublicDatasetStates).where(eq(managedPublicDatasetStates.datasetId, stateId(binding))).limit(1))[0] : null;
  if (!options.force && state?.nextAttemptAt && state.nextAttemptAt.getTime() > Date.now()) return { id: binding.id, status: "deferred" as const, nextAttemptAt: state.nextAttemptAt };
  const endDate = new Date().toISOString().slice(0, 10);
  const historyDays = ["TaiwanStockDividend", "TaiwanStockNews"].includes(binding.dataset) ? 365 : binding.dataset === "TaiwanOptionDaily" ? 14 : 90;
  const start = new Date(Date.now() - historyDays * 86_400_000).toISOString().slice(0, 10);
  const result = await fetchFinMindDataset({ dataset: binding.dataset, dataId: finMindDatasetRequiresDataId(binding.dataset) ? binding.symbol : undefined, startDate: start, endDate, limit: 800, selection: binding.dataset === "TaiwanOptionDaily" ? "latest_active_options" : undefined });
  if (!result.available || !result.rows.length) {
    await recordState(binding, { status: "unavailable", error: result.limitation, succeeded: false });
    return { id: binding.id, status: "unavailable" as const, reason: result.limitation };
  }
  const history: Array<{ date: string; payload: Record<string, unknown>; symbol: string }> = result.rows.flatMap(row => {
    const date = rowDate(row);
    if (!date) return [];
    const symbol = finMindObservationSymbol(binding, row);
    return [{ date, symbol, payload: { ...payloadFor(binding, row), symbol } as Record<string, unknown> }];
  });
  if (!history.length) {
    await recordState(binding, { status: "unavailable", error: "未返回带观察期的数据。", succeeded: false });
    return { id: binding.id, status: "unavailable" as const, reason: "未返回带观察期的数据。" };
  }
  let archive;
  try {
    archive = await archiveCanonicalObservationSeries({
      moduleId: binding.moduleId,
      dataContractId: binding.dataContractId,
      symbol: binding.symbol,
      source: "FinMind API",
      sourceReference: `finmind:${binding.dataset}`,
      schemaVersion: "finmind-observation-v1",
      fetchedAt: new Date(result.retrievedAt),
      history,
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "DATABASE_UNAVAILABLE") throw error;
    archive = await archivePublicDatasetObservations({
      moduleId: binding.moduleId,
      dataContractId: binding.dataContractId,
      symbol: binding.symbol,
      fetchedAt: new Date(result.retrievedAt),
      history,
    });
  }
  await recordState(binding, { status: "available", error: null, succeeded: true });
  return { id: binding.id, status: "available" as const, observedAt: result.observedAt, freshness: result.freshness, archive };
}

let activeBatch: Promise<unknown[]> | null = null;
export function syncAllFinMindDatasets(options: { force?: boolean } = {}) {
  if (activeBatch) return activeBatch;
  activeBatch = (async () => {
    const results: unknown[] = [];
    const due = SYNC_BINDINGS.filter(binding =>
      options.force || Date.now() >= (localNextAttemptAt.get(binding.id) ?? 0)
    );
    let cursor = 0;
    const worker = async () => {
      while (cursor < due.length) {
        const binding = due[cursor++];
        try {
          const result = await syncFinMindBinding(binding, options);
          const success = result.status === "available";
          localNextAttemptAt.set(binding.id, Date.now() + (success ? 30 : 10) * 60_000);
          results.push(result);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          localNextAttemptAt.set(binding.id, Date.now() + 10 * 60_000);
          await recordState(binding, { status: "failed", error: reason, succeeded: false }).catch(() => undefined);
          results.push({ id: binding.id, status: "failed", reason });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(4, Math.max(1, due.length)) }, () => worker())
    );
    return results;
  })().finally(() => { activeBatch = null; });
  return activeBatch;
}

export function listFinMindBindings() { return FINMIND_MODULE_BINDINGS.map(binding => ({ ...binding })); }
