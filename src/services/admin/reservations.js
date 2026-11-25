"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, pool } from "@/lib/db";
import { requireAdmin, audit, pg, } from "@/lib/guard";
import { z } from "zod";
export async function listReservations(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) {
    where.push("(r.reservation_code LIKE ? OR h.hotel_name LIKE ? OR u.email LIKE ? OR CONCAT(u.first_name,' ',u.last_name) LIKE ?)");
    const like = `%${String(p.q).trim()}%`;
    args.push(like, like, like, like);
  }
  if (p.status) { where.push("r.status=?"); args.push(p.status); }
  if (p.from) { where.push("r.check_in >= ?"); args.push(p.from); }
  if (p.to) { where.push("r.check_in <= ?"); args.push(p.to); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM reservations r JOIN hotels h ON h.id=r.hotel_id JOIN users u ON u.id=r.user_id ${w}`;
  const rows = await query(
    `SELECT r.id, r.reservation_code, r.status, r.check_in, r.check_out, r.total_amount, r.currency,
            r.created_at, h.hotel_name, CONCAT(u.first_name,' ',u.last_name) AS guest
       ${base} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getReservation(id) {
  await requireAdmin();
  const reservation = await queryOne(
    `SELECT r.*, h.hotel_name, CONCAT(u.first_name,' ',u.last_name) AS guest, u.email AS guest_email, u.phone AS guest_phone
       FROM reservations r JOIN hotels h ON h.id=r.hotel_id JOIN users u ON u.id=r.user_id WHERE r.id=?`, [id]);
  if (!reservation) return null;
  const [rooms, payments, history] = await Promise.all([
    query(
      `SELECT rr.id, rm.room_number, rt.name AS room_type, rr.nightly_rate, rr.total_price
         FROM reservation_rooms rr JOIN rooms rm ON rm.id=rr.room_id JOIN room_types rt ON rt.id=rr.room_type_id
        WHERE rr.reservation_id=?`, [id]),
    query(`SELECT id, payment_reference, amount, status, paid_at, created_at FROM payments WHERE reservation_id=? ORDER BY created_at DESC`, [id]),
    query(
      `SELECT h.old_status, h.new_status, h.reason, h.created_at, CONCAT(u.first_name,' ',u.last_name) AS changed_by
         FROM reservation_status_history h LEFT JOIN users u ON u.id=h.changed_by
        WHERE h.reservation_id=? ORDER BY h.created_at DESC`, [id]),
  ]);
  return { reservation, rooms, payments, history };
}

// Admin intervention: cancel a reservation (e.g. dispute, fraud). Does not issue refunds; use Payments → Refund.
export async function cancelReservationAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const reason = String(fd.get("reason") ?? "").slice(0, 500);
  if (!reason) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT status FROM reservations WHERE id=? FOR UPDATE", [id]);
    const old = rows[0]?.status;
    if (!old || ["cancelled", "completed", "expired", "rejected"].includes(old)) {
      await conn.rollback();
      return;
    }
    await conn.query(
      "UPDATE reservations SET status='cancelled', cancelled_by=?, cancelled_at=NOW(), rejection_reason=? WHERE id=?",
      [s.userId, reason, id]
    );
    await conn.query(
      "INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by, reason) VALUES (?,?,?,?,?)",
      [id, old, "cancelled", s.userId, reason]
    );
    await conn.commit();
    await audit(s.userId, "reservation.cancelled_by_admin", "reservation", id, { status: old }, { status: "cancelled", reason });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${id}`);
}

const editSchema = z.object({
  adults: z.coerce.number().int().min(1, "At least 1 adult.").max(50),
  children: z.coerce.number().int().min(0).max(50),
  special_requests: z.string().trim().max(5000).optional().or(z.literal("")),
});

// Dates, rooms and prices are deliberately not editable: they drive availability and money.
export async function updateReservationAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const p = editSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const old = await queryOne("SELECT adults, children, special_requests FROM reservations WHERE id=?", [id]);
  if (!old) return { error: "That reservation no longer exists." };
  await execute("UPDATE reservations SET adults=?, children=?, special_requests=? WHERE id=?",
    [p.data.adults, p.data.children, p.data.special_requests || null, id]);
  await audit(s.userId, "reservation.updated", "reservation", id, old, p.data);
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${id}`);
  redirect(`/admin/reservations/${id}`);
}

// Only dead records with no money trail can be removed.
export async function deleteReservationAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const conn = await pool.getConnection();
  let code;
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query("SELECT reservation_code, status FROM reservations WHERE id=? FOR UPDATE", [id]);
    if (!r) { await conn.rollback(); return { error: "That reservation no longer exists." }; }
    code = r.reservation_code;
    if (!["pending_payment", "expired", "cancelled", "rejected"].includes(r.status)) {
      await conn.rollback();
      return { error: "Only pending-payment, expired, cancelled or rejected reservations can be deleted. Cancel this one first." };
    }
    const [[paid]] = await conn.query(
      "SELECT COUNT(*) AS c FROM payments WHERE reservation_id=? AND status IN ('successful','refunded','partially_refunded')", [id]);
    if (paid.c) {
      await conn.rollback();
      return { error: "This reservation has a successful payment, so it must stay on record for accounting." };
    }
    await conn.query("DELETE n FROM reservation_room_nights n JOIN reservation_rooms rr ON rr.id=n.reservation_room_id WHERE rr.reservation_id=?", [id]);
    await conn.query("DELETE FROM reservation_rooms WHERE reservation_id=?", [id]);
    await conn.query("DELETE FROM reservation_status_history WHERE reservation_id=?", [id]);
    await conn.query("DELETE FROM coupon_redemptions WHERE reservation_id=?", [id]);
    await conn.query("DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE reservation_id=?)", [id]);
    await conn.query("DELETE FROM payments WHERE reservation_id=?", [id]);
    await conn.query("DELETE FROM reservations WHERE id=?", [id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(s.userId, "reservation.deleted", "reservation", id, { reservation_code: code }, null);
  revalidatePath("/admin/reservations");
  return { success: "Reservation deleted." };
}
