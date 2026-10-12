import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { listCandidateSheets } from "../../scripts/import_global_equity_listings.mjs";

const uploadDir = "/home/ubuntu/upload";
const outputPath = "/home/ubuntu/finance-hub-recovery/audit/artifacts-uploaded-global-equity-unmapped-review.json";
const aliasMappings = new Map([
  ["菲律宾股票.xlsx\u0000菲律宾股票", { country: "菲律宾", countryCode: "PH", exchange: "菲律宾证券交易所", canonicalSheet: "菲律宾股票_3" }],
  ["以色列股票_1.xlsx\u0000以色列股票_1", { country: "以色列", countryCode: "IL", exchange: "特拉维夫证券交易所", canonicalSheet: "以色列股票" }],
]);

function normaliseRows(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false }).slice(1);
  return rows.map((row, index) => ({
    sourceRow: index + 2,
    symbol: row[0] === null || row[0] === undefined ? "" : String(row[0]),
    name: row[1] === null || row[1] === undefined ? "" : String(row[1]),
  })).filter((row) => row.symbol !== "" && row.name !== "" && !row.symbol.startsWith("数据来源"));
}

function contentHash(rows) {
  return crypto.createHash("sha256").update(rows.map((row) => `${row.symbol}\t${row.name}`).join("\n"), "utf8").digest("hex");
}

function main() {
  const knownCandidates = listCandidateSheets();
  const knownHashes = new Map(knownCandidates.map((candidate) => [candidate.hash, {
    file_name: candidate.fileName,
    sheet_name: candidate.sheetName,
    country_code: candidate.countryCode,
  }]));
  const reviews = [];
  for (const fileName of ["菲律宾股票.xlsx", "以色列股票_1.xlsx", "grid_x4ojopb2.xlsx", "sheet1.xlsx"]) {
    const workbook = XLSX.readFile(path.join(uploadDir, fileName), { raw: true, cellText: true });
    for (const sheetName of workbook.SheetNames) {
      const rows = normaliseRows(workbook.Sheets[sheetName]);
      const hash = contentHash(rows);
      const key = `${fileName}\u0000${sheetName}`;
      reviews.push({
        file_name: fileName,
        sheet_name: sheetName,
        alias_mapping: aliasMappings.get(key) ?? null,
        valid_two_column_row_count: rows.length,
        content_sha256: hash,
        matches_existing_archive_candidate: knownHashes.get(hash) ?? null,
        first_five_rows: rows.slice(0, 5),
      });
    }
  }
  fs.writeFileSync(outputPath, `${JSON.stringify({ mode: "read-only-unmapped-review", reviews }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output_path: outputPath, reviews }, null, 2));
}

main();
