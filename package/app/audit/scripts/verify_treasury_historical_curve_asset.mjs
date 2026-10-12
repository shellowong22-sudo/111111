import crypto from "node:crypto";
import mysql from "mysql2/promise";

const SOURCE_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rate-archives/par-yield-curve-rates-1990-2023.csv";
const CURVE_CODE = "UST_PAR_YIELD_OFFICIAL_HIST_1990_2023";
const PERIODS = [["1 mo", "1M"], ["3 mo", "3M"], ["6 mo", "6M"], ["1 yr", "1Y"], ["2 yr", "2Y"], ["3 yr", "3Y"], ["5 yr", "5Y"], ["7 yr", "7Y"], ["10 yr", "10Y"], ["20 yr", "20Y"], ["30 yr", "30Y"]];

function parseCsv(text) {
  const parseLine = (line) => {
    const cells = []; let cell = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += character;
    }
    cells.push(cell.trim());
    return cells;
  };
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = parseLine(lines[0]).map((header) => header.replace(/^\uFEFF/, "").toLowerCase());
  return lines.slice(1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index] ?? "", value])));
}

function isoDate(usDate) {
  const [month, day, year] = usDate.split("/").map(Number);
  if (!month || !day || !year) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function selectActualMonthEndRows(rows) {
  const byMonth = new Map();
  for (const row of rows) {
    const date = isoDate(row.date ?? "");
    if (!date) continue;
    const month = date.slice(0, 7);
    const current = byMonth.get(month);
    if (!current || date > current.date) byMonth.set(month, { date, row });
  }
  return [...byMonth.values()].sort((left, right) => left.date.localeCompare(right.date));
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);
let connection;
try {
  const response = await fetch(SOURCE_URL, { headers: { "User-Agent": "finance-hub/official-treasury-historical-audit" }, signal: controller.signal });
  if (!response.ok) throw new Error(`美国财政部 CSV 返回 HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString("utf8");
  if (!text.startsWith("date,")) throw new Error("美国财政部 CSV 未返回预期的 date 表头");
  const selected = selectActualMonthEndRows(parseCsv(text));
  const expected = selected.flatMap(({ date, row }) => PERIODS.flatMap(([sourceColumn, period]) => {
    const value = row[sourceColumn];
    return value && Number.isFinite(Number(value)) ? [{ date, period, value }] : [];
  }));
  connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [[curve]] = await connection.execute("SELECT id FROM curves WHERE curve_id = ? LIMIT 1", [CURVE_CODE]);
  if (!curve?.id) throw new Error("数据库中缺少官方历史曲线目录");
  const [actual] = await connection.execute("SELECT data_date AS date, period, value FROM curve_data_points WHERE curve_id = ? ORDER BY data_date, period", [curve.id]);
  const normalize = (points) => points.map((point) => `${point.date}|${point.period}|${point.value}`).sort();
  const expectedHash = crypto.createHash("sha256").update(normalize(expected).join("\n")).digest("hex");
  const actualHash = crypto.createHash("sha256").update(normalize(actual).join("\n")).digest("hex");
  const verified = expectedHash === actualHash && expected.length === actual.length;
  console.log(JSON.stringify({
    auditKind: "official-treasury-historical-curve-read-only-verification",
    verified,
    sourceUrl: SOURCE_URL,
    sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    sourceFirstDate: selected[0]?.date ?? null,
    sourceLastDate: selected.at(-1)?.date ?? null,
    selectedObservationCount: selected.length,
    expectedPointCount: expected.length,
    actualPointCount: actual.length,
    expectedPointSetSha256: expectedHash,
    actualPointSetSha256: actualHash,
    curveId: curve.id,
  }, null, 2));
} finally {
  clearTimeout(timer);
  await connection?.end();
}
