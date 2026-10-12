import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { marketDataObservationHistory as ledger, managedPublicDatasetStates } from "../drizzle/schema";
import { getDb } from "./db";

export const FX_REFERENCE_CONTRACTS = ["fx.hkma.daily-reference.v1", "fx.bank-of-canada.usdcad.v1"] as const;
const datasetIds = ["hkma-daily-exchange-rates", "bank-of-canada-usdcad"];

export function projectFxReference(rows: Array<{
  id: number; dataContractId: string; observationDate: string;
  payload: Record<string, unknown>; fetchedAt: Date;
}>) {
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!FX_REFERENCE_CONTRACTS.some(contract => contract === row.dataContractId)) continue;
    const key = row.dataContractId + "|" + row.observationDate;
    if ((unique.get(key)?.id ?? -1) < row.id) unique.set(key, row);
  }
  const points: Array<{ pair: string; date: string; value: number; savedAt: string; kind: "reference" }> = [];
  const indices: Array<{ date: string; value: number; base: string }> = [];
  const add = (row: (typeof rows)[number], pair: string, value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0)
      points.push({ pair, date: row.observationDate, value, savedAt: row.fetchedAt.toISOString(), kind: "reference" });
  };
  for (const row of unique.values()) {
    if (row.dataContractId === FX_REFERENCE_CONTRACTS[0]) {
      for (const currency of ["usd", "eur", "cny", "jpy"])
        add(row, currency.toUpperCase() + "/HKD", row.payload[currency]);
      const value = row.payload.index;
      if (typeof value === "number" && Number.isFinite(value) && value > 0)
        indices.push({ date: row.observationDate, value, base: "2020 trade weighted" });
    } else add(row, "USD/CAD", row.payload.value);
  }
  return { points: points.sort((a, b) => a.date.localeCompare(b.date) || a.pair.localeCompare(b.pair)), indices: indices.sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function readArchivedFxReference() {
  const db = await getDb();
  if (!db) return { available: false, storage: "unavailable" as const, points: [], indices: [], collection: [] };
  const latest = db.select({ id: sql<number>`max(${ledger.id})`.as("latest_id") }).from(ledger)
    .where(and(eq(ledger.moduleId, "forex-hub"), inArray(ledger.dataContractId, [...FX_REFERENCE_CONTRACTS])))
    .groupBy(ledger.dataContractId, ledger.observationDate).as("latest");
  const rows = await db.select({
    id: ledger.id, dataContractId: ledger.dataContractId, observationDate: ledger.observationDate,
    payload: ledger.payload, fetchedAt: ledger.fetchedAt,
  }).from(ledger).innerJoin(latest, eq(ledger.id, latest.id))
    .orderBy(desc(ledger.observationDate), desc(ledger.id)).limit(2000);
  const collection = await db.select({
    datasetId: managedPublicDatasetStates.datasetId, lastAttemptAt: managedPublicDatasetStates.lastAttemptAt,
    lastSuccessAt: managedPublicDatasetStates.lastSuccessAt, nextAttemptAt: managedPublicDatasetStates.nextAttemptAt,
    lastStatus: managedPublicDatasetStates.lastStatus,
  }).from(managedPublicDatasetStates).where(inArray(managedPublicDatasetStates.datasetId, datasetIds));
  const data = projectFxReference(rows);
  return { available: data.points.length > 0, storage: "persistent" as const, ...data, collection };
}
