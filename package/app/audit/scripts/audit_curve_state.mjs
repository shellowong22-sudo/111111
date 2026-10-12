import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [curves] = await connection.query(
    `SELECT c.id, c.curve_id, c.name, c.name_en, c.type, c.category, c.description, c.is_active,
      COUNT(p.id) AS point_count, MIN(p.data_date) AS first_data_date, MAX(p.data_date) AS last_data_date
     FROM curves AS c
     LEFT JOIN curve_data_points AS p ON p.curve_id = c.id
     GROUP BY c.id, c.curve_id, c.name, c.name_en, c.type, c.category, c.description, c.is_active
     ORDER BY c.id`,
  );
  const [orphanGroups] = await connection.query(
    `SELECT p.curve_id, COUNT(*) AS point_count, MIN(p.data_date) AS first_data_date, MAX(p.data_date) AS last_data_date
     FROM curve_data_points AS p
     LEFT JOIN curves AS c ON c.id = p.curve_id
     WHERE c.id IS NULL
     GROUP BY p.curve_id
     ORDER BY p.curve_id`,
  );
  console.log(JSON.stringify({ auditKind: "read-only-curve-state", curves, orphanGroups }, null, 2));
} finally {
  await connection.end();
}
