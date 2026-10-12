import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const verificationPath = "/home/ubuntu/finance-hub-recovery/audit/artifacts-treasury-historical-verification.json";
const importKey = "treasury-par-yield-curve-month-end-v1-1990-2023";
const curveCode = "UST_PAR_YIELD_OFFICIAL_HIST_1990_2023";
const samplingRule = "calendar-month last actual Treasury-published observation; no interpolation";

const verification = JSON.parse(await readFile(verificationPath, "utf8"));
if (!verification.verified) throw new Error("只读官方点位核验未通过，拒绝写入导入元数据");
if (verification.sourceFirstDate !== "1990-01-31" || verification.sourceLastDate !== "2023-12-29" || verification.selectedObservationCount !== 408 || verification.actualPointCount !== 4257) {
  throw new Error("只读核验结果与归档导入契约不一致，拒绝写入导入元数据");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();
  try {
    const [existingRows] = await connection.execute(
      "SELECT id, curve_id, source_sha256 FROM treasury_historical_curve_imports WHERE import_key = ? LIMIT 1 FOR UPDATE",
      [importKey],
    );
    if (existingRows.length) {
      await connection.rollback();
      console.log(JSON.stringify({ auditKind: "treasury-historical-import-metadata-reconciliation", status: "already_present", existing: existingRows[0] }, null, 2));
      process.exit(0);
    }
    const [[curve]] = await connection.execute("SELECT id FROM curves WHERE curve_id = ? LIMIT 1 FOR UPDATE", [curveCode]);
    if (!curve?.id || Number(curve.id) !== Number(verification.curveId)) {
      throw new Error("官方历史曲线目录与独立核验结果不一致");
    }
    const [[pointCount]] = await connection.execute("SELECT COUNT(*) AS row_count FROM curve_data_points WHERE curve_id = ?", [curve.id]);
    if (Number(pointCount.row_count) !== verification.actualPointCount) {
      throw new Error("官方历史曲线点位数在写入前发生变化，拒绝写入元数据");
    }
    await connection.execute(
      `INSERT INTO treasury_historical_curve_imports
       (import_key, curve_id, source_url, source_sha256, source_first_date, source_last_date, sampling_rule, selected_observation_count, imported_point_count, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [importKey, curve.id, verification.sourceUrl, verification.sourceSha256, verification.sourceFirstDate, verification.sourceLastDate, samplingRule, verification.selectedObservationCount, verification.actualPointCount],
    );
    await connection.commit();
    console.log(JSON.stringify({
      auditKind: "treasury-historical-import-metadata-reconciliation",
      status: "inserted-after-read-only-verification",
      importKey,
      curveId: curve.id,
      sourceSha256: verification.sourceSha256,
      importedPointCount: verification.actualPointCount,
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} finally {
  await connection.end();
}
