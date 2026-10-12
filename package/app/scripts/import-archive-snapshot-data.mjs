import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import mysql from "mysql2/promise";

const snapshotPath = process.argv[2];
const reportPath = process.argv[3];
const batchSize = 250;

if (!snapshotPath || !reportPath) {
  throw new Error("Usage: node scripts/import-archive-snapshot-data.mjs <snapshot.sql> <report.json>");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", () => resolve(hash.digest("hex")));
  });
}

function parseInsertTable(line) {
  const match = line.match(/^INSERT INTO `([^`]+)`(?: \([^\n]*\))? VALUES /);
  return match?.[1] ?? null;
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    snapshot: {
      path: snapshotPath,
      sha256: await sha256(snapshotPath),
      bytes: (await fs.stat(snapshotPath)).size,
    },
    policy: {
      accepted: "Only single-line INSERT INTO statements from the archive snapshot, excluding __drizzle_migrations.",
      excluded: ["DROP TABLE", "CREATE TABLE", "LOCK TABLES", "UNLOCK TABLES", "__drizzle_migrations INSERT"],
      destructiveStatementsExecuted: 0,
    },
    sourceStatements: { insertsAccepted: 0, insertsExcludedMigrationMetadata: 0, nonInsertLinesIgnored: 0 },
    insertedRowsByTable: {},
    batchesCommitted: 0,
    batchAttempts: 0,
    failedStatements: [],
    status: "running",
  };

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });
  const auditStream = createWriteStream(`${reportPath}.ndjson`, { flags: "w" });
  let batch = [];

  const executeBatch = async (items) => {
    if (items.length === 0) return;
    report.batchAttempts += 1;
    const savepoint = `archive_import_${report.batchAttempts}`;
    await connection.query(`SAVEPOINT ${savepoint}`);
    try {
      await connection.query(items.map((item) => item.sql).join("\n"));
      for (const item of items) {
        report.insertedRowsByTable[item.table] = (report.insertedRowsByTable[item.table] ?? 0) + 1;
      }
      report.batchesCommitted += 1;
      auditStream.write(`${JSON.stringify({ event: "batchCommitted", batch: report.batchesCommitted, statements: items.length })}\n`);
    } catch (error) {
      await connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      if (items.length > 1) {
        const midpoint = Math.floor(items.length / 2);
        await executeBatch(items.slice(0, midpoint));
        await executeBatch(items.slice(midpoint));
        return;
      }
      const item = items[0];
      const detail = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
      const failed = { lineNumber: item.lineNumber, table: item.table, sha256: createHash("sha256").update(item.sql).digest("hex"), error: detail };
      report.failedStatements.push(failed);
      auditStream.write(`${JSON.stringify({ event: "statementRejected", ...failed })}\n`);
    }
  };

  const flush = async () => {
    if (batch.length === 0) return;
    await executeBatch(batch);
    batch = [];
  };

  try {
    await connection.beginTransaction();
    const input = readline.createInterface({ input: createReadStream(snapshotPath), crlfDelay: Infinity });
    let lineNumber = 0;
    for await (const line of input) {
      lineNumber += 1;
      const table = parseInsertTable(line);
      if (!table) {
        report.sourceStatements.nonInsertLinesIgnored += 1;
        continue;
      }
      if (table === "__drizzle_migrations") {
        report.sourceStatements.insertsExcludedMigrationMetadata += 1;
        continue;
      }
      batch.push({ line, lineNumber, sql: line, table });
      report.sourceStatements.insertsAccepted += 1;
      if (batch.length >= batchSize) await flush();
    }
    await flush();
    await connection.commit();
    report.status = report.failedStatements.length === 0 ? "committed" : "committed_with_statement_rejections";
  } catch (error) {
    await connection.rollback();
    report.status = "rolled_back";
    report.error = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
    throw error;
  } finally {
    auditStream.end();
    await connection.end();
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
}

await main();
