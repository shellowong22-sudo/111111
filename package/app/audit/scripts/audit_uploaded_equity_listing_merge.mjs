import fs from "node:fs";
import mysql from "mysql2/promise";
import { listCandidateSheets, selectUniqueSources, makeListings, groupedCounts } from "../../scripts/import_global_equity_listings.mjs";

const outputPath = "/home/ubuntu/finance-hub-recovery/audit/artifacts-uploaded-global-equity-merge-preflight.json";

async function main() {
  const candidates = listCandidateSheets();
  const sources = selectUniqueSources(candidates);
  const { listings, duplicateRows } = makeListings(sources);
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.query(
      "SELECT country_code AS countryCode, symbol, name, country, exchange, source_file AS sourceFile, source_sheet AS sourceSheet, source_row AS sourceRow, source_content_sha256 AS sourceContentSha256 FROM equity_listings",
    );
    const currentByKey = new Map(rows.map((row) => [`${row.countryCode}\u0000${row.symbol}`, row]));
    const newListings = [];
    const exactExisting = [];
    const conflicts = [];
    for (const listing of listings) {
      const key = `${listing.countryCode}\u0000${listing.symbol}`;
      const current = currentByKey.get(key);
      if (!current) {
        newListings.push(listing);
      } else if (current.name === listing.name) {
        exactExisting.push({ key, current, incoming: listing });
      } else {
        conflicts.push({ key, current, incoming: listing });
      }
    }
    const incomingKeys = new Set(listings.map((listing) => `${listing.countryCode}\u0000${listing.symbol}`));
    const currentWithoutIncomingSource = rows.filter((row) => !incomingKeys.has(`${row.countryCode}\u0000${row.symbol}`));
    const report = {
      mode: "read-only-preflight",
      candidate_sheet_count: candidates.length,
      unique_source_sheet_count: sources.length,
      candidate_row_count: sources.reduce((sum, source) => sum + source.rows.length, 0),
      deduplicated_listing_count: listings.length,
      same_country_duplicate_row_count: duplicateRows.length,
      incoming_counts_by_country: groupedCounts(listings),
      current_listing_count: rows.length,
      incoming_new_count: newListings.length,
      exact_existing_count: exactExisting.length,
      conflict_count: conflicts.length,
      current_without_incoming_source_count: currentWithoutIncomingSource.length,
      import_allowed: conflicts.length === 0,
      conflict_samples: conflicts.slice(0, 20),
      sources: sources.map((source) => ({
        country: source.country,
        country_code: source.countryCode,
        exchange: source.exchange,
        file_name: source.fileName,
        sheet_name: source.sheetName,
        row_count: source.rows.length,
        content_sha256: source.hash,
      })),
    };
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      report_path: outputPath,
      current_listing_count: report.current_listing_count,
      deduplicated_listing_count: report.deduplicated_listing_count,
      incoming_new_count: report.incoming_new_count,
      exact_existing_count: report.exact_existing_count,
      conflict_count: report.conflict_count,
      import_allowed: report.import_allowed,
    }, null, 2));
    if (!report.import_allowed) process.exitCode = 2;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
