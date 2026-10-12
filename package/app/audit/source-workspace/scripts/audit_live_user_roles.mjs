import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await connection.query("SELECT `role`, COUNT(*) AS count FROM `users` GROUP BY `role` ORDER BY `role`");
  const [[currentUser]] = await connection.query("SELECT `role` FROM `users` WHERE `id` = 1");
  console.log(JSON.stringify({ roleCounts: rows.map((row) => ({ role: row.role, count: Number(row.count) })), currentUserIdOneRole: currentUser?.role ?? null }, null, 2));
} finally {
  await connection.end();
}
