import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import XLSX from "xlsx";

const UPLOAD_DIR = "/home/ubuntu/upload";
const REPORT_PATH = "/home/ubuntu/finance-hub/tmp/global_equity_listing_import_report.json";
const DRY_RUN = process.argv.includes("--dry-run");

const COUNTRY_BY_SHEET = new Map([
  ["东证所全部股票", ["日本", "JP", "东京证券交易所"]],
  ["澳大利亚全部股票", ["澳大利亚", "AU", "澳大利亚证券交易所"]],
  ["丹麦股票", ["丹麦", "DK", "哥本哈根证券交易所"]],
  ["德国全部股票", ["德国", "DE", "德意志交易所"]],
  ["以色列股票", ["以色列", "IL", "特拉维夫证券交易所"]],
  ["俄罗斯股票", ["俄罗斯", "RU", "莫斯科交易所"]],
  ["全部A股", ["中国", "CN", "中国境内交易所"]],
  ["全部港股", ["中国香港", "HK", "香港交易所"]],
  ["全部美股", ["美国", "US", "美国证券市场"]],
  ["全部英股", ["英国", "GB", "伦敦证券交易所"]],
  ["冰岛股票", ["冰岛", "IS", "纳斯达克冰岛"]],
  ["加拿大多伦多证券交易所", ["加拿大", "CA", "多伦多证券交易所"]],
  ["印尼股票", ["印度尼西亚", "ID", "印度尼西亚证券交易所"]],
  ["印度全部股票_1", ["印度", "IN", "印度证券市场"]],
  ["台湾全部股票", ["中国台湾", "TW", "台湾证券市场"]],
  ["墨西哥股票", ["墨西哥", "MX", "墨西哥证券交易所"]],
  ["荷兰股票", ["荷兰", "NL", "泛欧阿姆斯特丹"]],
  ["奥地利股票", ["奥地利", "AT", "维也纳证券交易所"]],
  ["巴西股票", ["巴西", "BR", "巴西证券交易所"]],
  ["意大利股票", ["意大利", "IT", "意大利证券交易所"]],
  ["挪威股票", ["挪威", "NO", "奥斯陆证券交易所"]],
  ["新加坡全部股票", ["新加坡", "SG", "新加坡交易所"]],
  ["新西兰股票_1", ["新西兰", "NZ", "新西兰证券交易所"]],
  ["柬埔寨股票", ["柬埔寨", "KH", "柬埔寨证券交易所"]],
  ["韩国全部股票", ["韩国", "KR", "韩国证券市场"]],
  ["沙特全部股票_1", ["沙特阿拉伯", "SA", "沙特交易所"]],
  ["法国全部股票", ["法国", "FR", "泛欧巴黎"]],
  ["泰国股票_1", ["泰国", "TH", "泰国证券交易所"]],
  ["爱尔兰股票", ["爱尔兰", "IE", "泛欧都柏林"]],
  ["瑞典股票", ["瑞典", "SE", "纳斯达克斯德哥尔摩"]],
  ["瑞士股票", ["瑞士", "CH", "瑞士证券交易所"]],
  ["缅甸股票", ["缅甸", "MM", "仰光证券交易所"]],
  ["老挝股票", ["老挝", "LA", "老挝证券交易所"]],
  ["芬兰股票", ["芬兰", "FI", "纳斯达克赫尔辛基"]],
  ["菲律宾股票_3", ["菲律宾", "PH", "菲律宾证券交易所"]],
  ["葡萄牙股票", ["葡萄牙", "PT", "泛欧里斯本"]],
  ["西班牙股票", ["西班牙", "ES", "西班牙证券交易所"]],
  ["越南全部股票", ["越南", "VN", "越南证券市场"]],
  ["迪拜金融市场", ["阿拉伯联合酋长国", "AE", "迪拜金融市场"]],
  ["阿联酋全部股票", ["阿拉伯联合酋长国", "AE", "阿联酋证券市场"]],
  ["马来西亚全部股票", ["马来西亚", "MY", "马来西亚交易所"]],
]);

function sourceHash(rows) {
  return crypto.createHash("sha256").update(rows.map(([symbol, name]) => `${symbol}\t${name}`).join("\n"), "utf8").digest("hex");
}

function listCandidateSheets() {
  const candidates = [];
  for (const fileName of fs.readdirSync(UPLOAD_DIR).filter((name) => name.endsWith(".xlsx")).sort()) {
    const filePath = path.join(UPLOAD_DIR, fileName);
    const workbook = XLSX.readFile(filePath, { raw: true, cellText: true });
    for (const sheetName of workbook.SheetNames) {
      const mapping = COUNTRY_BY_SHEET.get(sheetName);
      if (!mapping) continue;
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null, blankrows: false });
      const body = rawRows.slice(1);
      const normalizedRows = body.map((row, index) => ({
          sourceRow: index + 2,
          symbol: row[0] === null || row[0] === undefined ? "" : String(row[0]),
          name: row[1] === null || row[1] === undefined ? "" : String(row[1]),
        }));
      const rows = normalizedRows.filter((row) => row.symbol !== "" && row.name !== "" && !row.symbol.startsWith("数据来源"));
      const invalidRows = normalizedRows
        .filter((row) => !rows.includes(row))
        .map((row) => ({
          ...row,
          reason: row.symbol.startsWith("数据来源") ? "source_metadata" : row.symbol === "" ? "missing_symbol" : "missing_name",
        }));
      const hash = sourceHash(rows.map((row) => [row.symbol, row.name]));
      candidates.push({
        fileName,
        sheetName,
        country: mapping[0],
        countryCode: mapping[1],
        exchange: mapping[2],
        rows,
        invalidRows,
        hash,
        preferred: path.basename(fileName, ".xlsx") === sheetName,
      });
    }
  }
  return candidates;
}

function selectUniqueSources(candidates) {
  const seen = new Set();
  return [...candidates]
    .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.fileName.localeCompare(right.fileName) || left.sheetName.localeCompare(right.sheetName))
    .filter((candidate) => {
      if (seen.has(candidate.hash)) return false;
      seen.add(candidate.hash);
      return true;
    });
}

function makeListings(sources) {
  const byCountrySymbol = new Map();
  const duplicateRows = [];
  for (const source of sources) {
    for (const row of source.rows) {
      const key = `${source.countryCode}\u0000${row.symbol}`;
      const listing = {
        country: source.country,
        countryCode: source.countryCode,
        exchange: source.exchange,
        symbol: row.symbol,
        name: row.name,
        sourceFile: source.fileName,
        sourceSheet: source.sheetName,
        sourceRow: row.sourceRow,
        sourceContentSha256: source.hash,
      };
      const existing = byCountrySymbol.get(key);
      if (!existing) {
        byCountrySymbol.set(key, listing);
        continue;
      }
      if (existing.name !== listing.name) {
        throw new Error(`同国同代码名称冲突：${source.countryCode} ${row.symbol}，${existing.name} / ${listing.name}`);
      }
      duplicateRows.push({ key, retained: existing, skipped: listing });
    }
  }
  return { listings: [...byCountrySymbol.values()].sort((left, right) => left.countryCode.localeCompare(right.countryCode) || left.symbol.localeCompare(right.symbol)), duplicateRows };
}

function groupedCounts(listings) {
  return Object.fromEntries([...listings.reduce((counts, listing) => {
    counts.set(listing.country, (counts.get(listing.country) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN")));
}

async function upsertListings(listings) {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.beginTransaction();
    const chunkSize = 2_000;
    for (let start = 0; start < listings.length; start += chunkSize) {
      const values = listings.slice(start, start + chunkSize).map((item) => [
        item.country,
        item.countryCode,
        item.exchange,
        item.symbol,
        item.name,
        item.sourceFile,
        item.sourceSheet,
        item.sourceRow,
        item.sourceContentSha256,
      ]);
      await connection.query(
        `INSERT INTO equity_listings (country, country_code, exchange, symbol, name, source_file, source_sheet, source_row, source_content_sha256)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           country = VALUES(country),
           exchange = VALUES(exchange),
           name = VALUES(name),
           source_file = VALUES(source_file),
           source_sheet = VALUES(source_sheet),
           source_row = VALUES(source_row),
           source_content_sha256 = VALUES(source_content_sha256),
           imported_at = NOW()`,
        [values],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

async function main() {
  const candidates = listCandidateSheets();
  const sources = selectUniqueSources(candidates);
  const { listings, duplicateRows } = makeListings(sources);
  const report = {
    mode: DRY_RUN ? "dry-run" : "import",
    candidate_sheet_count: candidates.length,
    unique_source_sheet_count: sources.length,
    candidate_row_count: sources.reduce((total, source) => total + source.rows.length, 0),
    deduplicated_listing_count: listings.length,
    same_country_duplicate_row_count: duplicateRows.length,
    counts_by_country: groupedCounts(listings),
    sources: sources.map((source) => ({
      country: source.country,
      country_code: source.countryCode,
      exchange: source.exchange,
      file_name: source.fileName,
      sheet_name: source.sheetName,
      row_count: source.rows.length,
      content_sha256: source.hash,
    })),
    duplicate_samples: duplicateRows.slice(0, 10),
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!DRY_RUN) await upsertListings(listings);
  console.log(JSON.stringify({ ...report, sources: undefined, duplicate_samples: undefined, report_path: REPORT_PATH }, null, 2));
}

export { listCandidateSheets, selectUniqueSources, makeListings, groupedCounts };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
