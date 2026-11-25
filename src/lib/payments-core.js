// Server-only payment logic. Deliberately NOT a "use server" file: every export of a "use server" file is a
// public endpoint callable from the browser, and these functions must only run from trusted server code
// (admin actions that call requireAdmin(), and the signed Paystack webhook).
import crypto from "node:crypto";
import { pool } from "@/lib/db";
import { withTx, row, rows, cents, fromCents, BizError } from "@/lib/tx";
import * as paystack from "@/lib/paystack";
import { verifyPaystackSignature } from "@/lib/paystack-signature";

/* ---------------- audit (works without an admin session) ---------------- */
export async function auditSys(conn, userId, action, entityType, entityId, oldV = null, newV = null) {
  await (conn ?? pool).execute(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?,?,?,?,?,?)`,
    [userId ?? null, action, entityType, entityId ?? null, oldV ? JSON.stringify(oldV) : null, newV ? JSON.stringify(newV) : null]
  );
}

const refundStatusOf = (s) => (s === "processed" ? "successful" : s === "failed" ? "failed" : "processing");

/* ---------------- refunds ---------------- */

// Creates a refund REQUEST inside the caller's transaction. Locks the payment row and enforces
// "total of open + successful refunds <= amount paid" so concurrent requests cannot over-refund.
export async function createRefundRecord(conn, { paymentId, amount = null, reason, userId = null }) {
  const pay = await row(conn, "SELECT id, amount, currency, status FROM payments WHERE id=? FOR UPDATE", [paymentId]);
  if (!pay) throw new BizError("Payment not found.");
  if (!["successful", "partially_refunded"].includes(pay.status)) throw new BizError("Only successful payments can be refunded.");
  const open = await row(conn, "SELECT COALESCE(SUM(amount),0) AS t FROM refunds WHERE payment_id=? AND status IN ('pending','processing','successful') FOR UPDATE", [paymentId]);
  const remaining = cents(pay.amount) - cents(open.t);
  const c = amount == null ? remaining : cents(amount);
  if (c <= 0 || c > remaining) throw new BizError(`That exceeds what can still be refunded (${fromCents(Math.max(remaining, 0))}).`);
  const ref = `RF-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const res = (await conn.execute(
    `INSERT INTO refunds (payment_id, refund_reference, amount, currency, status, reason, requested_by) VALUES (?,?,?,?, 'pending', ?, ?)`,
    [paymentId, ref, fromCents(c), pay.currency, String(reason ?? "").slice(0, 500) || null, userId]
  ))[0];
  return { id: res.insertId, reference: ref };
}

// Records what the PROVIDER reported. A refund becomes 'successful' only when Paystack says "processed".
export async function applyProviderRefund(refundId, data, userId = null) {
  const status = refundStatusOf(data.status);
  await withTx(async (conn) => {
    const rf = await row(conn, "SELECT id, payment_id, status FROM refunds WHERE id=? FOR UPDATE", [refundId]);
    if (!rf || rf.status === "successful") return; // idempotent
    await conn.execute(
      `UPDATE refunds SET status=?, provider_refund_id=COALESCE(?, provider_refund_id), provider_response=?,
              processed_by=COALESCE(?, processed_by), processed_at=IF(? IN ('successful','failed'), NOW(), processed_at) WHERE id=?`,
      [status, data.id != null ? String(data.id) : null, JSON.stringify(data), userId, status, refundId]
    );
    if (status === "successful") {
      const p = await row(conn, "SELECT amount FROM payments WHERE id=? FOR UPDATE", [rf.payment_id]);
      const s = await row(conn, "SELECT COALESCE(SUM(amount),0) AS t FROM refunds WHERE payment_id=? AND status='successful'", [rf.payment_id]);
      await conn.execute("UPDATE payments SET status=? WHERE id=?", [cents(s.t) >= cents(p.amount) ? "refunded" : "partially_refunded", rf.payment_id]);
    }
    await auditSys(conn, userId, `refund.${status}`, "refund", refundId, { status: rf.status }, { status, provider_status: data.status });
  });
  return status;
}

// pending|failed -> processing (tx) -> call Paystack (no tx) -> record the provider's answer (tx).
export async function submitRefundToProvider(refundId, userId) {
  const rf = await withTx(async (conn) => {
    const r = await row(conn, "SELECT id, payment_id, amount, currency, status, refund_reference, reason FROM refunds WHERE id=? FOR UPDATE", [refundId]);
    if (!r) throw new BizError("Refund not found.");
    if (!["pending", "failed"].includes(r.status)) throw new BizError(`This refund is already ${r.status}.`);
    const p = await row(conn, "SELECT payment_reference, status FROM payments WHERE id=?", [r.payment_id]);
    if (!["successful", "partially_refunded"].includes(p.status)) throw new BizError("The original payment is not in a refundable state.");
    await conn.execute("UPDATE refunds SET status='processing', processed_by=? WHERE id=?", [userId, refundId]);
    await auditSys(conn, userId, "refund.processing", "refund", refundId, { status: r.status }, { status: "processing" });
    return { ...r, payment_reference: p.payment_reference };
  });
  let data;
  try {
    data = await paystack.createRefund({
      transaction: rf.payment_reference, amount: cents(rf.amount), currency: rf.currency,
      merchant_note: `${rf.refund_reference}: ${rf.reason || "Refund"}`.slice(0, 200),
    });
  } catch (e) {
    if (e instanceof paystack.ProviderError && e.apiRejected) {
      await conn_markFailed(refundId, userId, e.message);
      throw new BizError(`Paystack rejected the refund: ${e.message}`);
    }
    // Unknown outcome: stay in "processing". Use Sync to reconcile - never blindly retry.
    throw new BizError("Paystack did not answer, so the outcome is unknown. The refund is marked Processing - use Sync status before retrying.");
  }
  return applyProviderRefund(refundId, data, userId);
}

async function conn_markFailed(refundId, userId, message) {
  await withTx(async (conn) => {
    await conn.execute(`UPDATE refunds SET status='failed', provider_response=?, processed_at=NOW() WHERE id=? AND status<>'successful'`, [JSON.stringify({ error: message }), refundId]);
    await auditSys(conn, userId, "refund.failed", "refund", refundId, null, { error: message });
  });
}

export async function syncRefundWithProvider(refundId, userId) {
  const rf = await row(pool, `SELECT f.id, f.status, f.amount, f.provider_refund_id, p.payment_reference
                                FROM refunds f JOIN payments p ON p.id=f.payment_id WHERE f.id=?`, [refundId]);
  if (!rf) throw new BizError("Refund not found.");
  if (rf.status !== "processing") throw new BizError("Only refunds that are Processing can be synced.");
  let data;
  try {
    if (rf.provider_refund_id) data = await paystack.fetchRefund(rf.provider_refund_id);
    else {
      const list = await paystack.listRefunds(rf.payment_reference);
      data = (Array.isArray(list) ? list : []).find((x) => Number(x.amount) === cents(rf.amount));
      if (!data) throw new BizError("Paystack has no matching refund yet. It is safe to wait and sync again.");
    }
  } catch (e) {
    if (e instanceof paystack.ProviderError) throw new BizError(e.message);
    throw e;
  }
  return applyProviderRefund(refundId, data, userId);
}

async function applyRefundEvent(data, eventName) {
  const ref = data.transaction_reference || data.reference || null;
  let found = data.id != null ? await rows(pool, "SELECT id FROM refunds WHERE provider_refund_id=?", [String(data.id)]) : [];
  if (!found.length && ref) {
    found = await rows(pool, `SELECT f.id, f.amount FROM refunds f JOIN payments p ON p.id=f.payment_id WHERE p.payment_reference=? AND f.status IN ('processing','pending')`, [ref]);
    if (found.length > 1) found = found.filter((r) => cents(r.amount) === Number(data.amount) || Number(r.amount) === Number(data.amount));
  }
  if (found.length !== 1) return "ignored";
  await applyProviderRefund(found[0].id, { ...data, status: data.status || eventName.replace("refund.", "") }, null);
  return "processed";
}

/* ---------------- successful charge ---------------- */

// Idempotent. Called ONLY with data returned by Paystack's verify endpoint (never with webhook/browser data).
export async function applyChargeSuccess(reference, v) {
  return withTx(async (conn) => {
    const pre = await row(conn, "SELECT reservation_id FROM payments WHERE payment_reference=?", [reference]);
    if (!pre) throw new BizError("Unknown payment reference.");
    const rsv = await row(conn, "SELECT id, reservation_code, status, hotel_id, user_id FROM reservations WHERE id=? FOR UPDATE", [pre.reservation_id]);
    const pay = await row(conn, "SELECT id, amount, currency, status FROM payments WHERE payment_reference=? FOR UPDATE", [reference]);
    if (["successful", "partially_refunded", "refunded"].includes(pay.status)) return "already_applied";

    const metaId = v.metadata?.reservation_id;
    if (Number(v.amount) !== cents(pay.amount) || String(v.currency).toUpperCase() !== String(pay.currency).toUpperCase() || (metaId != null && Number(metaId) !== Number(rsv.id))) {
      await conn.execute("UPDATE payments SET status='failed', failure_reason='Amount, currency or reservation mismatch', provider_response=? WHERE id=?", [JSON.stringify({ status: v.status, amount: v.amount, currency: v.currency }), pay.id]);
      await auditSys(conn, null, "payment.mismatch", "payment", pay.id, null, { reference });
      return "mismatch";
    }
    const dup = await row(conn, "SELECT id FROM payments WHERE reservation_id=? AND status IN ('successful','partially_refunded','refunded') AND id<>? LIMIT 1 FOR UPDATE", [rsv.id, pay.id]);
    await conn.execute(
      `UPDATE payments SET status='successful', provider_transaction_id=?, paid_at=NOW(), failure_reason=NULL, provider_response=? WHERE id=?`,
      [v.id != null ? String(v.id) : null, JSON.stringify({ status: v.status, gateway_response: v.gateway_response, channel: v.channel }), pay.id]
    );
    await auditSys(conn, null, "payment.successful", "payment", pay.id, { status: pay.status }, { status: "successful", reference });

    if (!dup && rsv.status === "pending_payment") {
      // A successful payment goes to the HOTEL for approval - it never auto-approves.
      await conn.execute("UPDATE reservations SET status='pending_approval', hold_expires_at=NULL WHERE id=?", [rsv.id]);
      await conn.execute("INSERT INTO reservation_status_history (reservation_id, old_status, new_status, changed_by, reason) VALUES (?,?,?,?,?)", [rsv.id, "pending_payment", "pending_approval", null, "Payment verified with Paystack"]);
      return "reservation_moved";
    }
    // Paid twice, or paid for a reservation that is no longer awaiting payment (expired / cancelled / rejected):
    // keep the money visible and queue a refund request for an admin to process.
    const rf = await createRefundRecord(conn, { paymentId: pay.id, reason: dup ? "Duplicate payment for the same reservation" : `Payment received while the reservation was ${rsv.status}`, userId: null });
    await auditSys(conn, null, "refund.auto_requested", "refund", rf.id, null, { reservation: rsv.reservation_code });
    return "refund_queued";
  });
}

/* ---------------- webhook ---------------- */
export async function handlePaystackWebhook(rawBody, signature) {
  if (!verifyPaystackSignature(rawBody, signature, process.env.PAYSTACK_SECRET_KEY)) return { status: 401 };
  let evt;
  try { evt = JSON.parse(rawBody); } catch { return { status: 400 }; }
  const event = String(evt.event || "");
  const data = evt.data || {};
  const ref = data.reference || data.transaction_reference || null;
  const idPart = data.id ?? ref ?? crypto.createHash("sha256").update(rawBody).digest("hex");
  const eventId = `${event}:${idPart}${event.startsWith("refund") ? `:${data.status || ""}` : ""}`.slice(0, 191);

  let rowId;
  try {
    const [r] = await pool.execute(
      `INSERT INTO payment_webhook_events (provider, provider_event_id, payment_reference, event_type, payload, processing_status) VALUES ('paystack',?,?,?,?, 'processing')`,
      [eventId, ref ? String(ref).slice(0, 100) : null, event.slice(0, 100), rawBody]
    );
    rowId = r.insertId;
  } catch (e) {
    if (e.code !== "ER_DUP_ENTRY") throw e;
    const [[ex]] = await pool.execute("SELECT id FROM payment_webhook_events WHERE provider='paystack' AND provider_event_id=?", [eventId]);
    const [claim] = await pool.execute("UPDATE payment_webhook_events SET processing_status='processing' WHERE id=? AND processing_status IN ('received','failed')", [ex.id]);
    if (claim.affectedRows !== 1) return { status: 200, duplicate: true }; // already handled / being handled
    rowId = ex.id;
  }

  try {
    let outcome = "processed";
    if (event === "charge.success" && ref) {
      const [[known]] = await pool.execute("SELECT id FROM payments WHERE payment_reference=?", [ref]);
      if (!known) outcome = "ignored";
      else {
        const verified = await paystack.verifyTransaction(ref); // server-to-server; the webhook body is only a trigger
        if (verified.status === "success") await applyChargeSuccess(ref, verified);
        else if (["failed", "abandoned"].includes(verified.status)) {
          await pool.execute("UPDATE payments SET status=?, failure_reason=? WHERE payment_reference=? AND status IN ('initiated','pending')", [verified.status === "abandoned" ? "abandoned" : "failed", String(verified.gateway_response || verified.status).slice(0, 500), ref]);
        }
      }
    } else if (event.startsWith("refund.")) outcome = await applyRefundEvent(data, event);
    else outcome = "ignored";
    await pool.execute("UPDATE payment_webhook_events SET processing_status=?, processed_at=NOW(), processing_error=NULL WHERE id=?", [outcome, rowId]);
    return { status: 200 };
  } catch (err) {
    await pool.execute("UPDATE payment_webhook_events SET processing_status='failed', processing_error=? WHERE id=?", [String(err.message).slice(0, 2000), rowId]);
    return { status: 500 }; // Paystack retries; the claim logic above lets the retry run again exactly once
  }
}
