import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(".runtime", "akshare-public");
const SOURCE = "AKShare 公共数据接口";
let pendingWrite: Promise<unknown> = Promise.resolve();

export type AkShareStoredObservation = {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  observationDate: string;
  fetchedAt: string;
  source: string;
  sourceReference: string;
  payload: Record<string, unknown>;
  contentHash: string;
};

type Ledger = {
  version: 1;
  observations: AkShareStoredObservation[];
  states?: Record<string, { lastAttemptAt: string; lastSuccessAt: string | null; lastStatus: "succeeded" | "failed"; lastError: string | null }>;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "never" | "succeeded" | "failed";
  lastError: string | null;
};

const emptyLedger = (): Ledger => ({
  version: 1,
  observations: [],
  states: {},
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastStatus: "never",
  lastError: null,
});

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

async function readLedger(root = ROOT): Promise<Ledger> {
  try {
    const value = JSON.parse(await readFile(path.join(root, "history.json"), "utf8")) as Ledger;
    if (value?.version !== 1 || !Array.isArray(value.observations)) {
      throw new Error("AKSHARE_LEDGER_INVALID");
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyLedger();
    // Never interpret a damaged ledger as an empty file and overwrite the
    // permanent observation history during the next scheduled collection.
    throw error;
  }
}

async function writeLedger(value: Ledger, root = ROOT) {
  await mkdir(root, { recursive: true });
  const target = path.join(root, "history.json");
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(JSON.stringify(value), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, target);
}

function serializeWrite<T>(write: () => Promise<T>): Promise<T> {
  const current = pendingWrite.catch(() => undefined).then(write);
  pendingWrite = current;
  return current;
}

function observationKey(row: Pick<AkShareStoredObservation, "moduleId" | "dataContractId" | "symbol" | "observationDate" | "payload">) {
  const articleKey = row.dataContractId.startsWith("news.")
    ? String(row.payload.url ?? row.payload.title ?? row.symbol)
    : null;
  return `${row.moduleId}|${row.dataContractId}|${articleKey ?? `${row.symbol}|${row.observationDate}`}`;
}

export async function archiveAkShareObservations(input: {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  fetchedAt: Date;
  history: Array<{ date: string; payload: Record<string, unknown>; symbol?: string }>;
}, root = ROOT) {
  return serializeWrite(async () => {
  const ledger = await readLedger(root);
  const latest = new Map(ledger.observations.map(row => [observationKey(row), row]));
  let inserted = 0;
  let duplicate = 0;
  let revisions = 0;
  for (const point of input.history) {
    const symbol = point.symbol?.trim() || input.symbol;
    const identity = { moduleId: input.moduleId, dataContractId: input.dataContractId, symbol, observationDate: point.date, payload: point.payload };
    const contentHash = createHash("sha256").update(stableJson(identity)).digest("hex");
    const key = observationKey(identity);
    const previous = latest.get(key);
    if (previous?.contentHash === contentHash) {
      duplicate += 1;
      continue;
    }
    if (previous) revisions += 1;
    const row: AkShareStoredObservation = {
      ...identity,
      fetchedAt: input.fetchedAt.toISOString(),
      source: SOURCE,
      sourceReference: `backend:akshare:${input.dataContractId}`,
      contentHash,
    };
    ledger.observations.push(row);
    latest.set(key, row);
    inserted += 1;
  }
  ledger.lastAttemptAt = input.fetchedAt.toISOString();
  ledger.lastSuccessAt = input.fetchedAt.toISOString();
  ledger.lastStatus = "succeeded";
  ledger.lastError = null;
  ledger.states ??= {};
  ledger.states[input.dataContractId] = {
    lastAttemptAt: input.fetchedAt.toISOString(),
    lastSuccessAt: input.fetchedAt.toISOString(),
    lastStatus: "succeeded",
    lastError: null,
  };
  await writeLedger(ledger, root);
  return { inserted, duplicate, revisions, total: input.history.length, storage: "local-persistent-fallback" as const };
  });
}

export async function recordAkShareFailure(dataContractId: string, error: string, root = ROOT) {
  return serializeWrite(async () => {
  const ledger = await readLedger(root);
  const at = new Date().toISOString();
  ledger.lastAttemptAt = at;
  ledger.lastStatus = "failed";
  ledger.lastError = error.slice(0, 1_000);
  ledger.states ??= {};
  ledger.states[dataContractId] = {
    lastAttemptAt: at,
    lastSuccessAt: ledger.states[dataContractId]?.lastSuccessAt ?? null,
    lastStatus: "failed",
    lastError: error.slice(0, 1_000),
  };
  await writeLedger(ledger, root);
  });
}

export async function getAkShareDatasetState(dataContractId: string, root = ROOT) {
  const ledger = await readLedger(root);
  return ledger.states?.[dataContractId] ?? null;
}

export async function readAkShareObservations(dataContractId: string, limit = 2_500, root = ROOT) {
  const ledger = await readLedger(root);
  const rows = ledger.observations
    .filter(row => row.dataContractId === dataContractId)
    // A tick-time is not an observation date. Older connector revisions could
    // select `ticktime` when the exchange date was absent; keep those ledger
    // rows for audit but never project them as a second market observation.
    .filter(row => !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(row.observationDate.trim()))
    .sort((left, right) => right.observationDate.localeCompare(left.observationDate) || right.fetchedAt.localeCompare(left.fetchedAt));
  return rows.slice(0, Math.min(Math.max(limit, 1), 100_000));
}

export async function getAkShareLocalLedgerStatus(root = ROOT) {
  const ledger = await readLedger(root);
  return {
    storage: "local-persistent-fallback" as const,
    observationCount: ledger.observations.length,
    lastAttemptAt: ledger.lastAttemptAt,
    lastSuccessAt: ledger.lastSuccessAt,
    lastStatus: ledger.lastStatus,
    lastError: ledger.lastError,
  };
}
