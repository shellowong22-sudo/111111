import "dotenv/config";
import { syncManagedPublicDataset, getManagedPublicDatasetSchedule } from "../../server/adminPublicDatasetIngestion";
import { readArchivedFxReference } from "../../server/archivedFxReference";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  if (process.argv.includes("--sync")) {
    for (const id of ["hkma-daily-exchange-rates", "bank-of-canada-usdcad"] as const) {
      console.log(JSON.stringify({ phase: "collect", ...await syncManagedPublicDataset(id, null) }));
    }
  }
  const archive = await readArchivedFxReference();
  console.log(JSON.stringify({
    phase: "archive-read", available: archive.available, storage: archive.storage,
    points: archive.points.length, indices: archive.indices.length,
    unique: new Set(archive.points.map(point => point.pair + "|" + point.date)).size,
    pairs: [...new Set(archive.points.map(point => point.pair))],
    first: archive.points[0]?.date, last: archive.points.at(-1)?.date,
    collection: archive.collection, schedule: await getManagedPublicDatasetSchedule(),
  }));
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
