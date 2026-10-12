import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { fetchFinMindDataset, FINMIND_DATASETS, listFinMindDatasetCatalog } from "../finmindApi";
import { listFinMindBindings } from "../finmindSync";
import { readArchivedPublicDataset } from "../archivedPublicDataset";

const datasetEnum = z.enum(FINMIND_DATASETS);

export const finmindRouter = router({
  // Raw dataset identifiers and contracts are administration details. The
  // terminal reads only the cleaned, module-scoped archive projection.
  catalog: adminProcedure.query(() => ({
    retrievedAt: new Date().toISOString(),
    datasets: listFinMindDatasetCatalog(),
    bindings: listFinMindBindings().map(binding => ({ id: binding.id, moduleId: binding.moduleId, label: binding.label, frequency: binding.frequency, freshness: binding.freshness })),
  })),
  dataset: adminProcedure.input(z.object({
    dataset: datasetEnum,
    dataId: z.string().trim().max(64).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().int().min(1).max(5_000).default(500),
  })).query(({ input }) => fetchFinMindDataset(input)),
  history: adminProcedure.input(z.object({ contract: z.string().trim().min(8).max(160), limit: z.number().int().min(1).max(5_000).default(500) })).query(({ input }) => readArchivedPublicDataset(input.contract, input.limit)),
});
