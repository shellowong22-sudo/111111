import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOT = path.resolve(".runtime", "public-datasets");

export type PublicDatasetStoredObservation = {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  observationDate: string;
  fetchedAt: string;
  payload: Record<string, unknown>;
  contentHash: string;
};

type Ledger = { version: 1; observations: PublicDatasetStoredObservation[] };
let pendingWrite: Promise<unknown> = Promise.resolve();

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

async function readLedger(root: string): Promise<Ledger> {
  try {
    const value = JSON.parse(
      await readFile(path.join(root, "history.json"), "utf8")
    ) as Ledger;
    if (value?.version !== 1 || !Array.isArray(value.observations)) {
      throw new Error("PUBLIC_DATASET_LEDGER_INVALID");
    }
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, observations: [] };
    }
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

export function archivePublicDatasetObservations(input: {
  moduleId: string;
  dataContractId: string;
  symbol: string;
  fetchedAt: Date;
  history: Array<{
    date: string;
    payload: Record<string, unknown>;
    symbol?: string;
  }>;
}, root = DEFAULT_ROOT) {
  const operation = pendingWrite.catch(() => undefined).then(async () => {
    const ledger = await readLedger(root);
    const latest = new Map<string, PublicDatasetStoredObservation>();
    for (const row of ledger.observations) {
      latest.set(
        `${row.moduleId}|${row.dataContractId}|${row.symbol}|${row.observationDate}`,
        row
      );
    }
    let inserted = 0;
    let duplicate = 0;
    let revisions = 0;
    for (const point of input.history) {
      const symbol = point.symbol?.trim() || input.symbol;
      if (!symbol || !String(point.date).trim()) continue;
      const observationDate = String(point.date).trim();
      const identity = `${input.moduleId}|${input.dataContractId}|${symbol}|${observationDate}`;
      const contentHash = createHash("sha256")
        .update(stableJson({ identity, payload: point.payload }))
        .digest("hex");
      const previous = latest.get(identity);
      if (previous?.contentHash === contentHash) {
        duplicate += 1;
        continue;
      }
      if (previous) revisions += 1;
      const row: PublicDatasetStoredObservation = {
        moduleId: input.moduleId,
        dataContractId: input.dataContractId,
        symbol,
        observationDate,
        fetchedAt: input.fetchedAt.toISOString(),
        payload: point.payload,
        contentHash,
      };
      ledger.observations.push(row);
      latest.set(identity, row);
      inserted += 1;
    }
    if (inserted || ledger.observations.length === 0) {
      await writeLedger(root, ledger);
    }
    return {
      inserted,
      duplicate,
      revisions,
      total: input.history.length,
      storage: "local-persistent-fallback" as const,
    };
  });
  pendingWrite = operation;
  return operation;
}

export async function readPublicDatasetObservations(
  dataContractId: string,
  limit = 2_500,
  root = DEFAULT_ROOT
) {
  const ledger = await readLedger(root);
  const latest = new Map<string, PublicDatasetStoredObservation>();
  for (const row of ledger.observations) {
    if (row.dataContractId !== dataContractId) continue;
    latest.set(`${row.moduleId}|${row.symbol}|${row.observationDate}`, row);
  }
  return [...latest.values()]
    .sort(
      (a, b) =>
        b.observationDate.localeCompare(a.observationDate) ||
        b.fetchedAt.localeCompare(a.fetchedAt)
    )
    .slice(0, Math.min(Math.max(limit, 1), 5_000));
}
