import mysql, { } from "mysql2/promise";

const globalForDb = globalThis ;

export const pool =
  globalForDb.__pool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: true,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__pool = pool;

export async function query(
  sql,
  params = []
) {
  const [rows] = await pool.query(sql, params);
  return rows ;
}

export async function queryOne(
  sql,
  params = []
) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql, params = []) {
  const [res] = await pool.execute(sql, params );
  return res;
}
