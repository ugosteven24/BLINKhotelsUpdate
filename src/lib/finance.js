// Commission and payout rules. Not a "use server" file.
import { query, run } from "@/lib/db/connection";
import { newId, toMoney } from "@/lib/service-utils";
import { parseJson } from "@/lib/doc";

const DEFAULT_RATE = 10;

// Platform commission, as a percentage. Stored in records(settings/commission);
// falls back to PLATFORM_COMMISSION_PERCENT, then 10.
export async function getCommissionRate() {
  const rows = await query(
    "SELECT data FROM records WHERE collection = 'settings' AND id = 'commission'"
  );
  const stored = Number(parseJson(rows[0]?.data).rate);
  if (Number.isFinite(stored) && stored >= 0 && stored <= 100) return stored;

  const fromEnv = Number(process.env.PLATFORM_COMMISSION_PERCENT);
  return Number.isFinite(fromEnv) && fromEnv >= 0 && fromEnv <= 100 ? fromEnv : DEFAULT_RATE;
}

export function splitAmount(total, ratePercent) {
  const commission = toMoney((total * ratePercent) / 100);
  return { commission, owner: toMoney(total - commission) };
}

// Creates the owner payout once a booking is BOTH completed and paid.
// Safe to call repeatedly (booking_id is unique).
export async function ensurePayout(connection, bookingId) {
  const rows = await run(
    connection,
    `SELECT b.id, b.hotel_id, b.total_amount, b.commission_amount, b.owner_amount,
            b.status, b.payment_status, h.owner_id
       FROM bookings b JOIN hotels h ON h.id = b.hotel_id
      WHERE b.id = ? FOR UPDATE`,
    [bookingId]
  );
  const b = rows[0];
  if (!b || b.status !== "completed" || b.payment_status !== "paid" || b.owner_amount == null) {
    return false;
  }

  await run(
    connection,
    `INSERT IGNORE INTO payouts
       (id, booking_id, hotel_id, owner_id, total_booking, commission, payout_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), b.id, b.hotel_id, b.owner_id, b.total_amount, b.commission_amount ?? 0, b.owner_amount]
  );
  return true;
}
