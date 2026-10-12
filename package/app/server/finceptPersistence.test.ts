import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { archiveFinceptObservations, readFinceptObservations } from "./finceptPersistence";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (root.startsWith(os.tmpdir() + path.sep)) await rm(root, { recursive: true, force: true });
  }
});

describe("Fincept persistent observation ledger", () => {
  it("deduplicates identical daily valuations and retains revisions and prior days", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fincept-ledger-test-"));
    roots.push(root);
    const base = { moduleId: "stock-eqs", dataContractId: "equity.twse.valuation.v1", symbol: "TWSE:VALUATIONS", fetchedAt: new Date("2026-09-24T12:00:00Z") };
    const point = { symbol: "1102", date: "2026-09-24", payload: { pe: 9.86, name: "亞泥" } };
    expect((await archiveFinceptObservations({ ...base, history: [point] }, root)).inserted).toBe(1);
    expect((await archiveFinceptObservations({ ...base, history: [point] }, root)).duplicate).toBe(1);
    expect((await archiveFinceptObservations({ ...base, history: [
      { ...point, payload: { pe: 9.90, name: "亞泥" } },
      { ...point, date: "2026-09-25" },
    ] }, root)).revisions).toBe(1);
    const latest = await readFinceptObservations(base.dataContractId, 5, root);
    expect(latest).toHaveLength(2);
    expect(latest.find(row => row.observationDate === "2026-09-24")?.payload.pe).toBe(9.90);
    const ledger = JSON.parse(await readFile(path.join(root, "history.json"), "utf8"));
    expect(ledger.observations).toHaveLength(3);
  });
});
