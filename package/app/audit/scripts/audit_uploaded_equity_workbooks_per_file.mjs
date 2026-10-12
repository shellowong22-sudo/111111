import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { listCandidateSheets, selectUniqueSources } from "../../scripts/import_global_equity_listings.mjs";

const uploadDir = "/home/ubuntu/upload";
const mergePreflightPath = "/home/ubuntu/finance-hub-recovery/audit/artifacts-uploaded-global-equity-merge-preflight.json";
const outputPath = "/home/ubuntu/finance-hub-recovery/audit/artifacts-uploaded-global-equity-per-file-audit.json";

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function headerValues(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
  return {
    header: (rows[0] ?? []).map((value) => value === null ? null : String(value)),
    physical_data_rows: Math.max(0, rows.length - 1),
  };
}

function main() {
  const candidates = listCandidateSheets();
  const selected = new Set(selectUniqueSources(candidates).map((item) => `${item.fileName}\u0000${item.sheetName}`));
  const candidateByFile = new Map();
  for (const candidate of candidates) {
    const items = candidateByFile.get(candidate.fileName) ?? [];
    items.push(candidate);
    candidateByFile.set(candidate.fileName, items);
  }
  const mergePreflight = JSON.parse(fs.readFileSync(mergePreflightPath, "utf8"));
  const files = fs.readdirSync(uploadDir)
    .filter((fileName) => fileName.toLowerCase().endsWith(".xlsx"))
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((fileName) => {
      const filePath = path.join(uploadDir, fileName);
      const workbook = XLSX.readFile(filePath, { raw: true, cellText: true });
      const recognizedCandidates = candidateByFile.get(fileName) ?? [];
      const candidateBySheet = new Map(recognizedCandidates.map((candidate) => [candidate.sheetName, candidate]));
      return {
        file_name: fileName,
        byte_size: fs.statSync(filePath).size,
        sha256: sha256(filePath),
        recognized_candidate_sheet_count: recognizedCandidates.length,
        source_sheet_count_selected_after_content_deduplication: recognizedCandidates.filter((candidate) => selected.has(`${candidate.fileName}\u0000${candidate.sheetName}`)).length,
        sheets: workbook.SheetNames.map((sheetName) => {
          const candidate = candidateBySheet.get(sheetName);
          const basics = headerValues(workbook.Sheets[sheetName]);
          if (!candidate) {
            return {
              sheet_name: sheetName,
              ...basics,
              mapping_status: "unmapped_by_archive_contract",
              column_mapping: null,
              valid_row_count: 0,
              rejected_row_count: basics.physical_data_rows,
              rejection_reasons: { unmapped_sheet: basics.physical_data_rows },
              selected_after_content_deduplication: false,
            };
          }
          const rejectionReasons = candidate.invalidRows.reduce((counts, row) => {
            counts[row.reason] = (counts[row.reason] ?? 0) + 1;
            return counts;
          }, {});
          return {
            sheet_name: sheetName,
            ...basics,
            mapping_status: "mapped_by_archive_contract",
            country: candidate.country,
            country_code: candidate.countryCode,
            exchange: candidate.exchange,
            column_mapping: { symbol: 0, name: 1 },
            valid_row_count: candidate.rows.length,
            rejected_row_count: candidate.invalidRows.length,
            rejection_reasons: rejectionReasons,
            content_sha256: candidate.hash,
            selected_after_content_deduplication: selected.has(`${candidate.fileName}\u0000${candidate.sheetName}`),
          };
        }),
      };
    });
  const report = {
    generated_at_utc: new Date().toISOString(),
    file_count: files.length,
    archive_column_contract: { symbol: 0, name: 1, header_row: 1 },
    merge_preflight: {
      incoming_new_count: mergePreflight.incoming_new_count,
      exact_existing_count: mergePreflight.exact_existing_count,
      conflict_count: mergePreflight.conflict_count,
      import_allowed: mergePreflight.import_allowed,
    },
    files,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output_path: outputPath,
    file_count: files.length,
    recognized_candidate_sheet_count: candidates.length,
    unique_source_sheet_count: selected.size,
    unmapped_file_count: files.filter((file) => file.recognized_candidate_sheet_count === 0).length,
  }, null, 2));
}

main();
