// Centralised MySQL access. Server-only: import this from src/services/* or
// other server code, never from a client component.
//
// One pool per Node process. The pool is cached on globalThis so Next.js hot
// reloading in development does not open a new pool on every file change.
import mysql from "mysql2/promise";

const POOL_KEY = Symbol.for("hotelreserve.mysql.pool");

function readConfig() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_POOL_SIZE } =
    process.env;

  // Read lazily so a missing variable cannot break `next build` or an import.
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error(
      "Database is not configured. Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME."
    );
  }

  return {
    host: DB_HOST,
    port: Number(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD ?? "",
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(DB_POOL_SIZE) || 10,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z", // store and read every DATETIME as UTC
    dateStrings: ["DATE"], // DATE columns come back as 'YYYY-MM-DD', no timezone shift
    decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
  };
}

export function getPool() {
  if (!globalThis[POOL_KEY]) {
    globalThis[POOL_KEY] = mysql.createPool(readConfig());
  }
  return globalThis[POOL_KEY];
}

// Single parameterised query. Always pass user input through `params`,
// never by string concatenation. Returns the rows (SELECT) or the result
// header (INSERT/UPDATE/DELETE).
export async function query(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

// Same as query() but for a connection obtained from withTransaction().
export async function run(connection, sql, params = []) {
  const [result] = await connection.execute(sql, params);
  return result;
}

// Runs `work(connection)` inside a transaction.
//   - the connection is taken from the pool and ALWAYS released
//   - commit on success, rollback on any thrown error (the error is rethrown)
//   - use run(connection, sql, params) for the statements inside
// For booking-style critical sections, take row locks with SELECT ... FOR UPDATE.
export async function withTransaction(work) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export function isDuplicateEntry(error) {
  return error?.code === "ER_DUP_ENTRY";
}
