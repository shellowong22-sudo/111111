import mysql from "mysql2/promise";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const contract = "macro.us.cpi.level.v1";
const moduleId = "economic-ecst";
const wrongSymbol = "CPIAUCSL";
const correctSymbols = ["CPIAUCNS", "CUUR0000SA0"];
const sourceReference = "backend:bls-us-cpi";
const connection = await mysql.createConnection(databaseUrl);

try {
  const [summaryRows] = await connection.query(
    `SELECT symbol,source,source_reference,COUNT(*) AS row_count,
            MIN(observation_date) AS first_date,MAX(observation_date) AS last_date
       FROM market_data_observation_history
      WHERE module_id=? AND data_contract_id=?
      GROUP BY symbol,source,source_reference
      ORDER BY symbol`,
    [moduleId, contract]
  );
  const wrong = summaryRows.filter(
    row => row.symbol === wrongSymbol && row.source_reference === sourceReference
  );
  const correct = summaryRows.filter(row => correctSymbols.includes(row.symbol));
  const wrongCount = wrong.reduce((sum, row) => sum + Number(row.row_count), 0);
  const correctCount = correct.reduce((sum, row) => sum + Number(row.row_count), 0);
  const report = {
    mode: apply ? "apply" : "dry-run",
    moduleId,
    contract,
    wrongSeries: wrong,
    correctSeries: correct,
    rowsToDelete: wrongCount,
    correctRowsPresent: correctCount,
  };

  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (!wrongCount) {
      console.log(JSON.stringify({ ...report, committed: false, reason: "NO_WRONG_ROWS" }, null, 2));
    } else {
      if (!correctCount)
        throw new Error("CPI_CONTRACT_REPAIR_REFUSED:CORRECT_UNADJUSTED_SERIES_NOT_ARCHIVED");
      await connection.beginTransaction();
      const [result] = await connection.query(
        `DELETE FROM market_data_observation_history
          WHERE module_id=? AND data_contract_id=? AND symbol=? AND source_reference=?`,
        [moduleId, contract, wrongSymbol, sourceReference]
      );
      const deletedRows = Number(result.affectedRows ?? 0);
      if (deletedRows !== wrongCount)
        throw new Error(`CPI_CONTRACT_REPAIR_COUNT_MISMATCH:${wrongCount}:${deletedRows}`);
      await connection.commit();
      const [[verification]] = await connection.query(
        `SELECT
           SUM(CASE WHEN symbol=? THEN 1 ELSE 0 END) AS wrong_remaining,
           SUM(CASE WHEN symbol IN (?,?) THEN 1 ELSE 0 END) AS correct_remaining
         FROM market_data_observation_history
         WHERE module_id=? AND data_contract_id=?`,
        [wrongSymbol, ...correctSymbols, moduleId, contract]
      );
      console.log(JSON.stringify({
        ...report,
        committed: true,
        deletedRows,
        wrongRemaining: Number(verification.wrong_remaining ?? 0),
        correctRemaining: Number(verification.correct_remaining ?? 0),
      }, null, 2));
    }
  }
} catch (error) {
  if (apply) await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
