import {
  MANAGED_PUBLIC_DATASETS,
  syncManagedPublicDataset,
} from "./adminPublicDatasetIngestion";
import { syncAllFinMindDatasets } from "./finmindSync";
import { ENV } from "./_core/env";

let started = false;
const MAX_CONCURRENCY = 4;

export function getFinceptPublicAutoSyncStatus() {
  return {
    enabled: started,
    mode: ENV.standaloneMode ? "standalone_scheduler" as const : "bounded_poller" as const,
    intervalSeconds: ENV.standaloneMode ? null : 60,
    note: ENV.standaloneMode
      ? "由持久化独立调度器按数据库任务执行。"
      : "由服务进程每分钟检查到期数据集；每个数据集按自身发布频率和失败退避执行。",
  };
}

/**
 * The ordinary managed-dataset schedule is database-backed. In a local
 * standalone terminal without DATABASE_URL, these Fincept public contracts
 * still need bounded automatic collection into their durable local ledger.
 */
export async function startFinceptPublicAutoSync() {
  // The previous implementation returned early whenever a database was
  // configured.  That made the local poller a no-op in the normal deployment
  // (the exact deployment where durable dataset state exists).  Standalone
  // mode has its own persisted cron scheduler, so keep that single owner and
  // use this bounded poller everywhere else.
  if (started || ENV.standaloneMode) return false;
  started = true;
  const nextDue = new Map<string, number>();
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = MANAGED_PUBLIC_DATASETS.filter(dataset =>
        Date.now() >= (nextDue.get(dataset.id) ?? 0)
      );
      let cursor = 0;
      let available = 0;
      let unavailable = 0;
      let failed = 0;
      let duplicate = 0;
      let inserted = 0;
      const worker = async () => {
        while (cursor < due.length) {
          const dataset = due[cursor++];
          try {
            const result = await syncManagedPublicDataset(dataset.id, null);
            const success = result.status === "available";
            nextDue.set(
              dataset.id,
              Date.now() + (success ? dataset.pollMinutes : 10) * 60_000
            );
            if (success) {
              available += 1;
              inserted += result.archive?.inserted ?? 0;
              duplicate += result.archive?.duplicate ?? 0;
            } else {
              unavailable += 1;
              console.warn(`[FinceptAutoSync] ${dataset.id}: ${result.status}`);
            }
          } catch (error) {
            failed += 1;
            nextDue.set(dataset.id, Date.now() + 10 * 60_000);
            console.warn(
              `[FinceptAutoSync] ${dataset.id}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(MAX_CONCURRENCY, Math.max(1, due.length)) },
          () => worker()
        )
      );
      if (due.length) {
        console.info(
          `[FinceptAutoSync] batch complete total=${due.length} available=${available} unavailable=${unavailable} failed=${failed} inserted=${inserted} duplicate=${duplicate}`
        );
      }
      const finmindResults = await syncAllFinMindDatasets();
      if (finmindResults.length) {
        const finmindAvailable = finmindResults.filter(
          result => (result as { status?: string }).status === "available"
        ).length;
        const finmindFailed = finmindResults.filter(
          result => (result as { status?: string }).status === "failed"
        ).length;
        console.info(
          `[FinceptAutoSync] FinMind batch complete total=${finmindResults.length} available=${finmindAvailable} failed=${finmindFailed}`
        );
      }
    } finally {
      running = false;
    }
  };
  setTimeout(() => void tick(), 5_000).unref();
  setInterval(() => void tick(), 60_000).unref();
  return true;
}
