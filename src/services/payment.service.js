"use server";

// Payments, refunds, owner payouts and platform commission.
// There is no online payment gateway wired in yet: an administrator records
// (verifies) the payment received for a confirmed booking. Commission is a
// percentage of the booking total, fixed when the booking is approved.

import { query, run, withTransaction } from "@/lib/db/connection";
import { ADMIN_ROLES, ROLES, requireRole } from "@/lib/auth/session";
import { ensurePayout, getCommissionRate } from "@/lib/finance";
import { iso } from "@/lib/doc";
import { logActivity, notifyUser } from "@/lib/notify";
import { ServiceError, newId } from "@/lib/service-utils";
import { cleanString } from "@/lib/validation";
import { randomBytes } from "node:crypto";

const label = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const PAYMENT_METHODS = ["card", "bank_transfer", "cash", "mobile_money", "other"];

// ---------------------------------------------------------------------------
// PAYMENTS
// ---------------------------------------------------------------------------
export async function recordPayment({ bookingId, method, reference } = {}) {
  const admin = await requireRole(ADMIN_ROLES);
  const paymentMethod = PAYMENT_METHODS.includes(method) ? method : "other";

  await withTransaction(async (connection) => {
    const rows = await run(connection, "SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
    const b = rows[0];
    if (!b) throw new ServiceError("Booking not found.", "not-found");
    if (!["confirmed", "completed"].includes(b.status)) {
      throw new ServiceError("Only confirmed bookings can be paid.", "invalid-state");
    }
    if (b.payment_status !== "unpaid") throw new ServiceError("This booking is already paid.", "invalid-state");

    const transactionId = cleanString(reference, 80) || `TXN-${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
    await run(
      connection,
      `INSERT INTO payments (id, booking_id, transaction_id, amount, method, status, recorded_by)
       VALUES (?, ?, ?, ?, ?, 'paid', ?)`,
      [newId(), b.id, transactionId, b.total_amount, paymentMethod, admin.id]
    );
    await run(connection, "UPDATE bookings SET payment_status = 'paid' WHERE id = ?", [b.id]);
    await ensurePayout(connection, b.id);
    await notifyUser(connection, b.user_id, {
      title: "Payment received",
      message: `We received your payment for booking ${b.booking_number}.`,
      category: "payment",
      icon: "payments",
    });
    await logActivity(connection, admin, `Recorded payment for ${b.booking_number}`, "Payments");
  });

  return { ok: true };
}

// Verifies a transaction reference; returns its status without exposing other users' data.
export async function verifyPayment(transactionId) {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `SELECT p.status, p.amount, b.booking_number, b.total_amount
       FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.transaction_id = ?`,
    [cleanString(transactionId, 80)]
  );
  const r = rows[0];
  if (!r) return { ok: true, found: false };
  return {
    ok: true,
    found: true,
    status: label(r.status),
    bookingNumber: r.booking_number,
    amountMatches: Number(r.amount) === Number(r.total_amount),
  };
}

export async function listTransactions() {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `SELECT p.id, p.transaction_id, p.amount, p.method, p.status, p.created_at,
            b.booking_number, b.hotel_name, b.guest_name
       FROM payments p JOIN bookings b ON b.id = p.booking_id
      ORDER BY p.created_at DESC LIMIT 2000`
  );
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    bookingNumber: r.booking_number,
    hotelName: r.hotel_name,
    guestName: r.guest_name,
    amount: Number(r.amount),
    paymentMethod: r.method,
    status: label(r.status),
    createdAt: iso(r.created_at),
  }));
}

// ---------------------------------------------------------------------------
// REFUNDS (opened automatically when a paid booking is cancelled)
// ---------------------------------------------------------------------------
export async function listRefunds() {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `SELECT f.*, b.booking_number, b.hotel_name, b.guest_name
       FROM refunds f JOIN bookings b ON b.id = f.booking_id
      ORDER BY f.created_at DESC LIMIT 2000`
  );
  return rows.map((r) => ({
    id: r.id,
    bookingNumber: r.booking_number,
    hotelName: r.hotel_name,
    guestName: r.guest_name,
    refundAmount: Number(r.amount),
    refundReason: r.reason,
    status: r.status,
    createdAt: iso(r.created_at),
    approvedAt: iso(r.approved_at),
    rejectedAt: iso(r.rejected_at),
  }));
}

export async function decideRefund(refundId, decision) {
  const admin = await requireRole(ADMIN_ROLES);
  if (!["Approved", "Rejected"].includes(decision)) throw new ServiceError("Invalid decision.");

  await withTransaction(async (connection) => {
    const rows = await run(connection, "SELECT * FROM refunds WHERE id = ? FOR UPDATE", [refundId]);
    const f = rows[0];
    if (!f) throw new ServiceError("Refund not found.", "not-found");
    if (f.status !== "Pending") throw new ServiceError("This refund was already decided.", "invalid-state");

    const approved = decision === "Approved";
    await run(
      connection,
      `UPDATE refunds SET status = ?, decided_by = ?, approved_at = ?, rejected_at = ? WHERE id = ?`,
      [decision, admin.id, approved ? new Date() : null, approved ? null : new Date(), f.id]
    );
    await run(connection, "UPDATE bookings SET payment_status = ? WHERE id = ?", [approved ? "refunded" : "paid", f.booking_id]);
    if (approved) await run(connection, "UPDATE payments SET status = 'refunded' WHERE booking_id = ?", [f.booking_id]);
    await logActivity(connection, admin, `${decision} refund ${f.id}`, "Payments");
  });
  return { ok: true };
}

// Same as decideRefund, addressed by booking (used by the bookings > refunds page).
export async function decideRefundForBooking(bookingId, decision) {
  await requireRole(ADMIN_ROLES);
  const rows = await query("SELECT id FROM refunds WHERE booking_id = ?", [bookingId]);
  if (!rows[0]) throw new ServiceError("No refund request exists for this booking.", "not-found");
  return decideRefund(rows[0].id, decision);
}

// ---------------------------------------------------------------------------
// PAYOUTS (owner payments, released only after administrator approval)
// ---------------------------------------------------------------------------
export async function listPayouts() {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `SELECT p.*, b.booking_number, h.hotel_name, u.full_name AS owner_name
       FROM payouts p
       JOIN bookings b ON b.id = p.booking_id
       JOIN hotels h ON h.id = p.hotel_id
       LEFT JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC LIMIT 2000`
  );
  return rows.map((r) => ({
    id: r.id,
    bookingNumber: r.booking_number,
    hotelName: r.hotel_name,
    ownerName: r.owner_name || "—",
    totalBooking: Number(r.total_booking),
    commission: Number(r.commission),
    payoutAmount: Number(r.payout_amount),
    status: r.status,
    paidAt: iso(r.paid_at),
    createdAt: iso(r.created_at),
  }));
}

// Administrator approval: marks the payout as paid out.
export async function markPayoutPaid(payoutId) {
  const admin = await requireRole(ADMIN_ROLES);

  await withTransaction(async (connection) => {
    const rows = await run(
      connection,
      `SELECT p.*, b.status AS booking_status, b.payment_status
         FROM payouts p JOIN bookings b ON b.id = p.booking_id
        WHERE p.id = ? FOR UPDATE`,
      [payoutId]
    );
    const p = rows[0];
    if (!p) throw new ServiceError("Payout not found.", "not-found");
    if (p.status !== "Pending") throw new ServiceError("This payout was already processed.", "invalid-state");
    if (p.booking_status !== "completed" || p.payment_status !== "paid") {
      throw new ServiceError("The booking must be completed and paid first.", "invalid-state");
    }

    await run(connection, "UPDATE payouts SET status = 'Paid', paid_at = UTC_TIMESTAMP(), decided_by = ? WHERE id = ?", [admin.id, p.id]);
    if (p.owner_id) {
      await notifyUser(connection, p.owner_id, {
        title: "Payout released",
        message: "A payout for one of your bookings has been paid.",
        category: "payment",
        icon: "payments",
      });
    }
    await logActivity(connection, admin, `Paid payout ${p.id}`, "Payments");
  });
  return { ok: true };
}

export async function rejectPayout(payoutId) {
  const admin = await requireRole(ADMIN_ROLES);
  const result = await query(
    "UPDATE payouts SET status = 'Rejected', decided_by = ? WHERE id = ? AND status = 'Pending'",
    [admin.id, payoutId]
  );
  if (!result.affectedRows) throw new ServiceError("Payout not found or already processed.", "invalid-state");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// COMMISSION
// ---------------------------------------------------------------------------
export async function listCommissions() {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `SELECT b.id, b.booking_number, b.hotel_name, b.total_amount, b.commission_rate,
            b.commission_amount, b.owner_amount, b.status, u.full_name AS owner_name
       FROM bookings b
       JOIN hotels h ON h.id = b.hotel_id
       LEFT JOIN users u ON u.id = h.owner_id
      WHERE b.commission_amount IS NOT NULL
      ORDER BY b.created_at DESC LIMIT 2000`
  );
  return rows.map((r) => ({
    id: r.id,
    bookingNumber: r.booking_number,
    hotelName: r.hotel_name,
    ownerName: r.owner_name || "—",
    totalBooking: Number(r.total_amount),
    commissionRate: Number(r.commission_rate),
    commission: Number(r.commission_amount),
    payoutAmount: Number(r.owner_amount),
    status: label(r.status),
  }));
}

export async function getPlatformCommissionRate() {
  await requireRole(ADMIN_ROLES);
  return getCommissionRate();
}

export async function setPlatformCommissionRate(rate) {
  await requireRole([ROLES.SUPERADMIN]);
  const value = Number(rate);
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new ServiceError("Commission must be between 0 and 100.");

  await query(
    `INSERT INTO records (collection, id, data) VALUES ('settings', 'commission', ?)
     ON DUPLICATE KEY UPDATE data = JSON_SET(data, '$.rate', ?)`,
    [JSON.stringify({ rate: value }), value]
  );
  return { ok: true, rate: value };
}
