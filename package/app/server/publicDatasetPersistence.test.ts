import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  archivePublicDatasetObservations,
  readPublicDatasetObservations,
} from "./publicDatasetPersistence";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe("public dataset local persistence", () => {
  it("keeps observations durable and blocks identical duplicates", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "public-dataset-"));
    roots.push(root);
    const input = {
      moduleId: "commodity-market",
      dataContractId: "commodity.test.v1",
      symbol: "TEST",
      fetchedAt: new Date("2026-10-01T00:00:00.000Z"),
      history: [{ date: "2026-09-30", payload: { value: 101 } }],
    };
    await expect(archivePublicDatasetObservations(input, root)).resolves.toMatchObject({
      inserted: 1,
      duplicate: 0,
      revisions: 0,
    });
    await expect(archivePublicDatasetObservations(input, root)).resolves.toMatchObject({
      inserted: 0,
      duplicate: 1,
      revisions: 0,
    });
    await expect(readPublicDatasetObservations("commodity.test.v1", 10, root)).resolves.toHaveLength(1);
  });
});
