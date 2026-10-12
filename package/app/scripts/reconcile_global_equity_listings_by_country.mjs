import fs from "node:fs";
import mysql from "mysql2/promise";
import {
  listCandidateSheets,
  makeListings,
  selectUniqueSources,
} from "./import_global_equity_listings.mjs";

const REPORT_PATH = "/home/ubuntu/finance-hub/tmp/global_equity_listing_country_reconciliation.json";

async function main() {
  const sources = selectUniqueSources(listCandidateSheets());
  const { listings, duplicateRows } = makeListings(sources);
  const countryRows = new Map();

  for (const source of sources) {
    const key = source.countryCode;
    const entry = countryRows.get(key) ?? {
      country: source.country,
      country_code: source.countryCode,
      valid_source_rows: 0,
      invalid_source_rows: 0,
      invalid_reasons: {},
      same_country_duplicate_rows: 0,
      expected_import_rows: 0,
      database_rows: 0,
      failed_rows: 0,
      source_sheets: [],
    };
    entry.valid_source_rows += source.rows.length;
    entry.invalid_source_rows += source.invalidRows.length;
    for (const invalid of source.invalidRows) {
      entry.invalid_reasons[invalid.reason] = (entry.invalid_reasons[invalid.reason] ?? 0) + 1;
    }
    entry.source_sheets.push(`${source.fileName}::${source.sheetName}`);
    countryRows.set(key, entry);
  }
  for (const listing of listings) countryRows.get(listing.countryCode).expected_import_rows += 1;
  for (const duplicate of duplicateRows) countryRows.get(duplicate.retained.countryCode).same_country_duplicate_rows += 1;

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [dbCounts] = await connection.query(
      "SELECT country_code AS countryCode, COUNT(*) AS total FROM equity_listings GROUP BY country_code",
    );
    for (const row of dbCounts) {
      const entry = countryRows.get(row.countryCode);
      if (!entry) throw new Error(`数据库中出现未映射国家：${row.countryCode}`);
      entry.database_rows = Number(row.total);
      entry.failed_rows = entry.expected_import_rows - entry.database_rows;
    }
  } finally {
    await connection.end();
  }

  const countries = [...countryRows.values()].sort((left, right) => left.country_code.localeCompare(right.country_code));
  const totals = countries.reduce((total, country) => ({
    valid_source_rows: total.valid_source_rows + country.valid_source_rows,
    invalid_source_rows: total.invalid_source_rows + country.invalid_source_rows,
    same_country_duplicate_rows: total.same_country_duplicate_rows + country.same_country_duplicate_rows,
    expected_import_rows: total.expected_import_rows + country.expected_import_rows,
    database_rows: total.database_rows + country.database_rows,
    failed_rows: total.failed_rows + country.failed_rows,
  }), { valid_source_rows: 0, invalid_source_rows: 0, same_country_duplicate_rows: 0, expected_import_rows: 0, database_rows: 0, failed_rows: 0 });
  const result = { countries, totals };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  if (totals.failed_rows !== 0) throw new Error(`逐国导入对账失败：${JSON.stringify(totals)}`);
  console.log(JSON.stringify({ ...totals, country_count: countries.length, report_path: REPORT_PATH }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
