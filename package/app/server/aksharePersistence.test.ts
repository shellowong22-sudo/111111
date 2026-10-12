import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  archiveAkShareObservations,
  getAkShareLocalLedgerStatus,
  readAkShareObservations,
  recordAkShareFailure,
} from "./aksharePersistence";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function temporaryLedger() {
  const root = await mkdtemp(path.join(tmpdir(), "akshare-ledger-test-"));
  roots.push(root);
  return root;
}

function observation(symbol: string, value: number, fetchedAt = "2026-09-30T09:00:00Z") {
  return {
    moduleId: "stock-eqs",
    dataContractId: "equity.cn.a.snapshot.akshare.v1",
    symbol,
    fetchedAt: new Date(fetchedAt),
    history: [{ symbol, date: "2026-09-30", payload: { symbol, value } }],
  };
}

describe("AKShare durable archive", () => {
  it("serializes concurrent writes, dedupes retries and retains price revisions", async () => {
    const root = await temporaryLedger();
    await Promise.all([
      archiveAkShareObservations(observation("sh600000", 9.48), root),
      archiveAkShareObservations(observation("sz000001", 11.1), root),
    ]);
    const duplicate = await archiveAkShareObservations(observation("sh600000", 9.48), root);
    const revised = await archiveAkShareObservations(
      observation("sh600000", 9.49, "2026-09-30T09:30:00Z"), root,
    );
    expect(duplicate).toMatchObject({ inserted: 0, duplicate: 1 });
    expect(revised).toMatchObject({ inserted: 1, revisions: 1 });
    const rows = await readAkShareObservations("equity.cn.a.snapshot.akshare.v1", 10, root);
    expect(rows).toHaveLength(3);
    expect(rows.filter(row => row.symbol === "sh600000").map(row => row.payload.value)).toEqual([9.49, 9.48]);
  });

  it("never overwrites a malformed ledger with an empty one", async () => {
    const root = await temporaryLedger();
    const target = path.join(root, "history.json");
    await writeFile(target, "{damaged", "utf8");
    await expect(recordAkShareFailure("test", "network down", root)).rejects.toThrow();
    await expect(archiveAkShareObservations(observation("sh600000", 9.48), root)).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe("{damaged");
  });

  it("keeps old clock-only audit rows without projecting them as market dates", async () => {
    const root = await temporaryLedger();
    await archiveAkShareObservations({
      ...observation("sh600000", 9.48),
      history: [{ symbol: "sh600000", date: "15:30:00", payload: { value: 9.48 } }],
    }, root);
    expect((await getAkShareLocalLedgerStatus(root)).observationCount).toBe(1);
    expect(await readAkShareObservations("equity.cn.a.snapshot.akshare.v1", 10, root)).toHaveLength(0);
  });
});
