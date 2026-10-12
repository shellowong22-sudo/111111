import fs from "node:fs";
import mysql from "mysql2/promise";
import { listCandidateSheets, selectUniqueSources, makeListings } from "../../scripts/import_global_equity_listings.mjs";

const resultPath = "/home/ubuntu/finance-hub-recovery/audit/artifacts-uploaded-global-equity-import-result.json";

async function main() {
  const candidates = listCandidateSheets();
  const sources = selectUniqueSources(candidates);
  const { listings, duplicateRows } = makeListings(sources);
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    const [currentRows] = await connection.query(
      "SELECT country_code AS countryCode, symbol, name FROM equity_listings FOR UPDATE",
    );
    const currentByKey = new Map(currentRows.map((row) => [`${row.countryCode}\u0000${row.symbol}`, row]));
    const newListings = [];
    const conflicts = [];
    for (const listing of listings) {
      const key = `${listing.countryCode}\u0000${listing.symbol}`;
      const existing = currentByKey.get(key);
      if (!existing) newListings.push(listing);
      else if (existing.name !== listing.name) conflicts.push({ key, existingName: existing.name, incomingName: listing.name });
    }
    if (conflicts.length) throw new Error(`同国同代码名称冲突，已回滚：${JSON.stringify(conflicts.slice(0, 10))}`);
    const expectedTotal = currentRows.length + newListings.length;
    const chunkSize = 2_000;
    for (let start = 0; start < newListings.length; start += chunkSize) {
      const values = newListings.slice(start, start + chunkSize).map((listing) => [
        listing.country,
        listing.countryCode,
        listing.exchange,
        listing.symbol,
        listing.name,
        listing.sourceFile,
        listing.sourceSheet,
        listing.sourceRow,
        listing.sourceContentSha256,
      ]);
      await connection.query(
        `INSERT INTO equity_listings (country, country_code, exchange, symbol, name, source_file, source_sheet, source_row, source_content_sha256)
         VALUES ?`,
        [values],
      );
    }
    const [[countRow]] = await connection.query("SELECT COUNT(*) AS count FROM equity_listings");
    if (Number(countRow.count) !== expectedTotal) {
      throw new Error(`导入后计数异常：expected=${expectedTotal} actual=${countRow.count}`);
    }
    const [countryRows] = await connection.query(
      "SELECT country_code AS countryCode, COUNT(*) AS count FROM equity_listings GROUP BY country_code ORDER BY country_code",
    );
    await connection.commit();
    const result = {
      mode: "insert-new-only",
      source_candidate_sheet_count: candidates.length,
      unique_source_sheet_count: sources.length,
      source_deduplicated_listing_count: listings.length,
      source_same_country_duplicate_row_count: duplicateRows.length,
      existing_before_count: currentRows.length,
      inserted_new_count: newListings.length,
      preserved_existing_count: currentRows.length,
      final_listing_count: Number(countRow.count),
      conflict_count: conflicts.length,
      counts_by_country_code: Object.fromEntries(countryRows.map((row) => [row.countryCode, Number(row.count)])),
    };
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...result, result_path: resultPath }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
