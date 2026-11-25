"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";
import { withTx, BizError } from "@/lib/tx";
import { createRefundRecord, submitRefundToProvider, syncRefundWithProvider } from "@/lib/payments-core";

const fail = (e) => ({ error: e instanceof BizError ? e.message : "Something went wrong. Please try again." });
const refresh = (paymentId) => { revalidatePath("/admin/payments/refunds"); revalidatePath("/admin/payments"); if (paymentId) revalidatePath(`/admin/payments/${paymentId}`); };

export async function listPayments(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) {
    where.push("(p.payment_reference LIKE ? OR r.reservation_code LIKE ? OR u.email LIKE ? OR p.provider_transaction_id LIKE ?)");
    args.push(`%${p.q}%`, `%${p.q}%`, `%${p.q}%`, `%${p.q}%`);
  }
  if (p.status) { where.push("p.status=?"); args.push(p.status); }
  if (p.hotel) { where.push("r.hotel_id=?"); args.push(Number(p.hotel)); }
  if (p.from) { where.push("p.created_at >= ?"); args.push(`${p.from} 00:00:00`); }
  if (p.to) { where.push("p.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); args.push(p.to); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM payments p JOIN reservations r ON r.id=p.reservation_id JOIN hotels h ON h.id=r.hotel_id JOIN users u ON u.id=r.user_id ${w}`;
  const rows = await query(
    `SELECT p.id, p.payment_reference, p.provider, p.provider_transaction_id, p.amount, p.currency, p.status, p.paid_at, p.created_at,
            r.id AS reservation_id, r.reservation_code, h.hotel_name, CONCAT(u.first_name,' ',u.last_name) AS guest
       ${base} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getPayment(id) {
  await requireAdmin();
  const payment = await queryOne(
    `SELECT p.*, r.reservation_code, r.total_amount AS reservation_total FROM payments p
       JOIN reservations r ON r.id=p.reservation_id WHERE p.id=?`, [id]);
  if (!payment) return null;
  const refunds = await query(`SELECT id, refund_reference, amount, status, reason, created_at, processed_at FROM refunds WHERE payment_id=? ORDER BY created_at DESC`, [id]);
  // Pending / processing refunds already reserve their amount; only failed ones free it again.
  const committed = refunds.filter((r) => r.status !== "failed").reduce((a, r) => a + Math.round(Number(r.amount) * 100), 0);
  return { payment, refunds, refundable: Math.max(0, Math.round(Number(payment.amount) * 100) - committed) / 100 };
}

export async function listRefunds(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) {
    where.push("(f.refund_reference LIKE ? OR f.provider_refund_id LIKE ? OR f.reason LIKE ? OR p.payment_reference LIKE ? OR r.reservation_code LIKE ?)");
    const like = `%${String(p.q).trim()}%`;
    args.push(like, like, like, like, like);
  }
  if (p.status) { where.push("f.status=?"); args.push(p.status); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query(
    `SELECT f.id, f.refund_reference, f.provider_refund_id, f.amount, f.currency, f.status, f.reason, f.created_at, f.processed_at,
            p.id AS payment_id, p.payment_reference, r.id AS reservation_id, r.reservation_code
       FROM refunds f JOIN payments p ON p.id=f.payment_id JOIN reservations r ON r.id=p.reservation_id ${w}
      ORDER BY f.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c FROM refunds f JOIN payments p ON p.id=f.payment_id JOIN reservations r ON r.id=p.reservation_id ${w}`, args)).c;
  return { rows, total, page, pageSize };
}

// Creates a refund REQUEST (status 'pending'). Nothing is sent to Paystack until "Send to Paystack".
export async function requestRefundAction(fd) {
  const s = await requireAdmin();
  const paymentId = Number(fd.get("payment_id"));
  const amount = Number(fd.get("amount"));
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (!(amount > 0) || !reason) return { error: "Enter an amount and a reason." };
  try {
    const rf = await withTx((conn) => createRefundRecord(conn, { paymentId, amount, reason, userId: s.userId }));
    await audit(s.userId, "refund.requested", "refund", rf.id, null, { paymentId, amount, reason });
  } catch (e) { return fail(e); }
  refresh(paymentId);
  return { success: "Refund request created." };
}

// The ONLY way a refund can succeed: Paystack must report it as processed.
export async function processRefundAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  try {
    const status = await submitRefundToProvider(id, s.userId);
    refresh();
    return { success: status === "successful" ? "Refund completed." : "Refund submitted to Paystack. It will show as successful only after Paystack confirms it." };
  } catch (e) { refresh(); return fail(e); }
}

export async function syncRefundAction(fd) {
  const s = await requireAdmin();
  try {
    const status = await syncRefundWithProvider(Number(fd.get("id")), s.userId);
    refresh();
    return { success: `Paystack reports this refund as ${status}.` };
  } catch (e) { return fail(e); }
}

// Withdraws a refund request that hasn't been sent to the provider yet.
export async function deleteRefundAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const r = await queryOne("SELECT payment_id, refund_reference, status FROM refunds WHERE id=?", [id]);
  if (!r) return { error: "That refund no longer exists." };
  if (r.status !== "pending") return { error: "Only pending refund requests can be deleted. This one has already been sent to the provider." };
  await execute("DELETE FROM refunds WHERE id=? AND status='pending'", [id]);
  await audit(s.userId, "refund.deleted", "refund", id, { refund_reference: r.refund_reference }, null);
  refresh(r.payment_id);
  return { success: "Refund request deleted." };
}
