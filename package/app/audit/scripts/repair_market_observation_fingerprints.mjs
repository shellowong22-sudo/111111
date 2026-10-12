import { createHash } from "node:crypto";
import mysql from "mysql2/promise";

const CONTRACTS = [
  "macro.us.cpi.level.v1",
  "energy.us.natural-gas-storage.weekly.v1",
  "rates.us.sofr.fred.v1",
  "macro.world.gdp.world-bank.v1",
];
const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const stableJson = value => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
};
const canonicalHash = row =>
  createHash("sha256")
    .update(
      stableJson({
        moduleId: row.module_id,
        dataContractId: row.data_contract_id,
        symbol: row.symbol,
        observationDate: row.observation_date,
        payload: row.payload,
      })
    )
    .digest("hex");
const chunks = (values, size) => {
  const output = [];
  for (let index = 0; index < values.length; index += size)
    output.push(values.slice(index, index + size));
  return output;
};

const connection = await mysql.createConnection(databaseUrl);
try {
  const placeholders = CONTRACTS.map(() => "?").join(",");
  const [rows] = await connection.query(
    `SELECT id,module_id,data_contract_id,symbol,observation_date,payload,content_hash
       FROM market_data_observation_history
      WHERE data_contract_id IN (${placeholders})
      ORDER BY id`,
    CONTRACTS
  );
  const byIdentity = new Map();
  for (const row of rows) {
    const hash = canonicalHash(row);
    const identity = [
      row.module_id,
      row.data_contract_id,
      row.symbol,
      row.observation_date,
      hash,
    ].join("|");
    const group = byIdentity.get(identity) ?? [];
    group.push({ ...row, canonical_hash: hash });
    byIdentity.set(identity, group);
  }
  const survivors = [];
  const duplicateIds = [];
  for (const group of byIdentity.values()) {
    survivors.push(group[0]);
    duplicateIds.push(...group.slice(1).map(row => row.id));
  }
  const staleSurvivors = survivors.filter(
    row => row.content_hash !== row.canonical_hash
  );
  const summary = {
    mode: apply ? "apply" : "dry-run",
    scopedRows: rows.length,
    duplicateRows: duplicateIds.length,
    staleSurvivorHashes: staleSurvivors.length,
  };
  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = duplicateIds.length || staleSurvivors.length ? 2 : 0;
  } else {
    await connection.beginTransaction();
    for (const batch of chunks(duplicateIds, 500)) {
      const marks = batch.map(() => "?").join(",");
      await connection.query(
        `DELETE FROM market_data_observation_history WHERE id IN (${marks})`,
        batch
      );
    }
    for (const batch of chunks(staleSurvivors, 250)) {
      const cases = batch.map(() => "WHEN ? THEN ?").join(" ");
      const marks = batch.map(() => "?").join(",");
      await connection.query(
        `UPDATE market_data_observation_history
            SET content_hash = CASE id ${cases} ELSE content_hash END
          WHERE id IN (${marks})`,
        [
          ...batch.flatMap(row => [row.id, row.canonical_hash]),
          ...batch.map(row => row.id),
        ]
      );
    }
    await connection.commit();
    console.log(JSON.stringify({ ...summary, committed: true }, null, 2));
  }
} catch (error) {
  if (apply) await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
