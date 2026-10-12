import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { marketDataObservationHistory } from "../drizzle/schema";
import { getDb } from "./db";
import { readAkShareObservations } from "./aksharePersistence";

const CONTRACT = "fund.open.snapshot.akshare.v1";
const MODULE = "fund-browse";

type FundArchiveRow = {
  id: number;
  symbol: string;
  observationDate: string;
  payload: Record<string, unknown>;
};

function projectFund(row: FundArchiveRow) {
  const name = typeof row.payload.fundName === "string" ? row.payload.fundName.trim() : "";
  const nav = row.payload.netAssetValue;
  if (!/^\d{6}$/.test(row.symbol) || !name) return null;
  return {
    code: row.symbol,
    name,
    // Zero is an unavailable NAV in this collector, not a tradable zero-price
    // fund. Keep the real code/name searchable while leaving NAV blank.
    netAssetValue: typeof nav === "number" && Number.isFinite(nav) && nav > 0 ? nav : null,
    observationDate: row.observationDate,
    currency: "CNY" as const,
  };
}

export function projectFundSearch(rows: FundArchiveRow[], keyword: string, page: number, limit: number) {
  const latest = new Map<string, FundArchiveRow>();
  for (const row of rows) {
    const previous = latest.get(row.symbol);
    if (!previous || row.observationDate > previous.observationDate ||
        (row.observationDate === previous.observationDate && row.id > previous.id)) latest.set(row.symbol, row);
  }
  const term = keyword.trim().toLocaleLowerCase();
  const matched = [...latest.values()].flatMap(row => {
    const value = projectFund(row);
    return value && (!term || value.code.includes(term) || value.name.toLocaleLowerCase().includes(term)) ? [value] : [];
  }).sort((a, b) => a.code.localeCompare(b.code));
  return { total: matched.length, rows: matched.slice(page * limit, (page + 1) * limit) };
}

export async function searchArchivedFunds(query: string, page: number, limit: number) {
  const db = await getDb();
  if (!db) {
    const raw = await readAkShareObservations(CONTRACT, 100_000);
    const projected = projectFundSearch(raw.map((row, index) => ({
      id: raw.length - index, symbol: row.symbol, observationDate: row.observationDate, payload: row.payload,
    })), query, page, limit);
    return { ...projected, page, partial: raw.length >= 100_000 };
  }
  const contractScope = and(
    eq(marketDataObservationHistory.moduleId, MODULE),
    eq(marketDataObservationHistory.dataContractId, CONTRACT),
  );
  const latestIds = db.select({ id: sql<number>`max(${marketDataObservationHistory.id})` })
    .from(marketDataObservationHistory).where(contractScope)
    .groupBy(marketDataObservationHistory.symbol);
  const term = query.trim();
  const searchScope = term ? sql`(
    LOCATE(${term}, ${marketDataObservationHistory.symbol}) > 0 OR
    LOCATE(${term}, JSON_UNQUOTE(JSON_EXTRACT(${marketDataObservationHistory.payload}, '$.fundName'))) > 0
  )` : undefined;
  const scope = and(contractScope, inArray(marketDataObservationHistory.id, latestIds), searchScope);
  const [count] = await db.select({ total: sql<number>`count(*)` })
    .from(marketDataObservationHistory).where(scope);
  const rows = await db.select({
    id: marketDataObservationHistory.id,
    symbol: marketDataObservationHistory.symbol,
    observationDate: marketDataObservationHistory.observationDate,
    payload: marketDataObservationHistory.payload,
  }).from(marketDataObservationHistory).where(scope)
    .orderBy(marketDataObservationHistory.symbol)
    .limit(limit).offset(page * limit);
  return { total: Number(count?.total ?? 0), page, partial: false, rows: rows.flatMap(row => {
    const projected = projectFund(row);
    return projected ? [projected] : [];
  }) };
}

export async function readArchivedFundDetail(code: string) {
  const db = await getDb();
  const rows = db ? await db.select({
    id: marketDataObservationHistory.id,
    symbol: marketDataObservationHistory.symbol,
    observationDate: marketDataObservationHistory.observationDate,
    payload: marketDataObservationHistory.payload,
  }).from(marketDataObservationHistory).where(and(
    eq(marketDataObservationHistory.moduleId, MODULE),
    eq(marketDataObservationHistory.dataContractId, CONTRACT),
    eq(marketDataObservationHistory.symbol, code),
  )).orderBy(desc(marketDataObservationHistory.observationDate), desc(marketDataObservationHistory.id))
    .limit(120) : (await readAkShareObservations(CONTRACT, 100_000))
      .filter(row => row.symbol === code)
      .map((row, index) => ({
        id: 100_000 - index, symbol: row.symbol, observationDate: row.observationDate, payload: row.payload,
      }));
  const dates = new Map<string, ReturnType<typeof projectFund>>();
  for (const row of rows) {
    if (!dates.has(row.observationDate)) dates.set(row.observationDate, projectFund(row));
  }
  return [...dates.values()].filter((row): row is NonNullable<typeof row> => row !== null && row.netAssetValue !== null)
    .sort((a, b) => a.observationDate.localeCompare(b.observationDate));
}
