import fs from "node:fs";
import mysql from "mysql2/promise";
import {
  groupedCounts,
  listCandidateSheets,
  makeListings,
  selectUniqueSources,
} from "./import_global_equity_listings.mjs";

const REPORT_PATH = "/home/ubuntu/finance-hub/tmp/global_equity_listing_verification.json";

function comparable(listing) {
  return {
    country: listing.country,
    countryCode: listing.countryCode,
    exchange: listing.exchange,
    symbol: listing.symbol,
    name: listing.name,
    sourceFile: listing.sourceFile,
    sourceSheet: listing.sourceSheet,
    sourceRow: Number(listing.sourceRow),
    sourceContentSha256: listing.sourceContentSha256,
  };
}

async function main() {
  const expected = makeListings(selectUniqueSources(listCandidateSheets())).listings;
  const expectedByKey = new Map(expected.map((listing) => [`${listing.countryCode}\u0000${listing.symbol}`, comparable(listing)]));
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.query(
      `SELECT country, country_code AS countryCode, exchange, symbol, name,
              source_file AS sourceFile, source_sheet AS sourceSheet, source_row AS sourceRow,
              source_content_sha256 AS sourceContentSha256
       FROM equity_listings
       ORDER BY country_code, symbol`,
    );
    const actualByKey = new Map(rows.map((listing) => [`${listing.countryCode}\u0000${listing.symbol}`, comparable(listing)]));
    const missing = [];
    const unexpected = [];
    const mismatches = [];
    for (const [key, expectedListing] of expectedByKey) {
      const actual = actualByKey.get(key);
      if (!actual) {
        missing.push(key);
      } else if (JSON.stringify(actual) !== JSON.stringify(expectedListing)) {
        mismatches.push({ key, expected: expectedListing, actual });
      }
    }
    for (const key of actualByKey.keys()) {
      if (!expectedByKey.has(key)) unexpected.push(key);
    }
    const actualCounts = groupedCounts([...actualByKey.values()]);
    const expectedCounts = groupedCounts(expected);
    const countryCountMatches = JSON.stringify(actualCounts) === JSON.stringify(expectedCounts);
    const result = {
      expected_listing_count: expected.length,
      actual_listing_count: actualByKey.size,
      missing_count: missing.length,
      unexpected_count: unexpected.length,
      field_mismatch_count: mismatches.length,
      country_count_matches: countryCountMatches,
      expected_counts_by_country: expectedCounts,
      actual_counts_by_country: actualCounts,
      samples: {
        missing: missing.slice(0, 10),
        unexpected: unexpected.slice(0, 10),
        mismatches: mismatches.slice(0, 3),
      },
    };
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    if (result.missing_count || result.unexpected_count || result.field_mismatch_count || !countryCountMatches) {
      throw new Error(`导入核验失败：${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({ ...result, report_path: REPORT_PATH }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
