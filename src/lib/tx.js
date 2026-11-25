// Server-only helper (NOT a "use server" file). Transaction wrapper for money/booking code.
//
// READ COMMITTED matters here: after we take a row lock (SELECT ... FOR UPDATE) every later read in the
// same transaction must see rows committed by competing transactions. Under the default REPEATABLE READ an
// earlier plain SELECT would freeze a snapshot and could miss them (double bookings / double payouts).
//
// LOCK ORDER used everywhere: rooms (ascending id) -> hotels -> reservations -> payments -> refunds/payouts.
// Never call an external provider (Paystack) while a transaction is open.
import { pool } from "@/lib/db";

export async function withTx(work, { retries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await conn.beginTransaction();
      const out = await work(conn);
      await conn.commit();
      return out;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      if ((e?.code === "ER_LOCK_DEADLOCK" || e?.code === "ER_LOCK_WAIT_TIMEOUT") && attempt < retries) continue;
      throw e;
    } finally {
      conn.release();
    }
  }
}

// Prepared-statement shortcuts for a transaction connection.
export const rows = async (conn, sql, params = []) => (await conn.execute(sql, params))[0];
export const row = async (conn, sql, params = []) => (await rows(conn, sql, params))[0] ?? null;

// Money is compared in integer cents (never float equality).
export const cents = (n) => Math.round(Number(n) * 100);
export const fromCents = (c) => (c / 100).toFixed(2);

// Business error whose message is safe to show an admin.
export class BizError extends Error {}
