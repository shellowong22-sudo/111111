import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOT = path.resolve(".runtime", "fincept-public");

export type FinceptStoredObservation = {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  observationDate: string;
  fetchedAt: string;
  source?: string;
  payload: Record<string, unknown>;
  contentHash: string;
};

type Ledger = { version: 1; observations: FinceptStoredObservation[] };
let pendingWrite: Promise<unknown> = Promise.resolve();

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

async function readLedger(root: string): Promise<Ledger> {
  try {
    const value = JSON.parse(await readFile(path.join(root, "history.json"), "utf8")) as Ledger;
    if (value?.version !== 1 || !Array.isArray(value.observations)) {
      throw new Error("FINCEPT_LEDGER_INVALID");
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, observations: [] };
    }
    // Never replace a damaged ledger with an empty file.
    throw error;
  }
}

async function writeLedger(root: string, ledger: Ledger) {
  await mkdir(root, { recursive: true });
  const target = path.join(root, "history.json");
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(JSON.stringify(ledger), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, target);
}

export function archiveFinceptObservations(input: {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  fetchedAt: Date;
  source?: string;
  history: Array<{ date: string; payload: Record<string, unknown>; symbol?: string }>;
}, root = DEFAULT_ROOT) {
  const operation = pendingWrite.catch(() => undefined).then(async () => {
    const ledger = await readLedger(root);
    const latest = new Map<string, FinceptStoredObservation>();
    for (const row of ledger.observations) {
      latest.set(`${row.moduleId}|${row.dataContractId}|${row.symbol}|${row.observationDate}`, row);
    }
    let inserted = 0;
    let duplicate = 0;
    let revisions = 0;
    let metadataUpdated = false;
    for (const point of input.history) {
      const symbol = point.symbol?.trim() || input.symbol;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || !symbol) continue;
      const identity = `${input.moduleId}|${input.dataContractId}|${symbol}|${point.date}`;
      const payload = point.payload;
      const contentHash = createHash("sha256").update(stableJson({ identity, payload })).digest("hex");
      const previous = latest.get(identity);
      if (previous?.contentHash === contentHash) {
        if (!previous.source && input.source) {
          const index = ledger.observations.findIndex(row => row === previous);
          if (index >= 0) {
            ledger.observations[index] = { ...previous, source: input.source };
            latest.set(identity, ledger.observations[index]);
            metadataUpdated = true;
          }
        }
        duplicate += 1;
        continue;
      }
      if (previous) revisions += 1;
      const row = {
        moduleId: input.moduleId,
        dataContractId: input.dataContractId,
        symbol,
        observationDate: point.date,
        fetchedAt: input.fetchedAt.toISOString(),
        source: input.source ?? "Fincept public adapter",
        payload,
        contentHash,
      };
      ledger.observations.push(row);
      latest.set(identity, row);
      inserted += 1;
    }
    // A successful archive is durable only after the atomic write completes.
    // An unchanged public snapshot must not rewrite a large permanent ledger.
    if (inserted || metadataUpdated || ledger.observations.length === 0) await writeLedger(root, ledger);
    return { inserted, duplicate, revisions, total: input.history.length, storage: "local-persistent-fallback" as const };
  });
  pendingWrite = operation;
  return operation;
}

export async function readFinceptObservations(dataContractId: string, limit = 2_500, root = DEFAULT_ROOT) {
  const ledger = await readLedger(root);
  const latest = new Map<string, FinceptStoredObservation>();
  for (const row of ledger.observations) {
    if (row.dataContractId === dataContractId) {
      latest.set(`${row.moduleId}|${row.symbol}|${row.observationDate}`, row);
    }
  }
  return [...latest.values()]
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate) || a.symbol.localeCompare(b.symbol))
    .slice(0, Math.min(Math.max(limit, 1), 5_000));
}
