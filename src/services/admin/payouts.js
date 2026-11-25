"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";
import { withTx, row, rows, cents, fromCents, BizError } from "@/lib/tx";

// A reservation's earnings are payable when it is COMPLETED, was paid (and not fully refunded), and is not
// attached to any payout that is still alive (requested / under_review / approved / processing / paid).
// Rejected and failed payouts keep their items for history, but those reservations become payable again.
// Successful partial refunds shrink the hotel's share proportionally. Commission is the snapshot stored on
// the reservation at booking time - it is never recalculated from today's rate.
const ELIGIBLE = `
  SELECT r.id AS reservation_id, r.hotel_id, r.reservation_code, r.currency, r.total_amount, r.commission_amount, r.hotel_amount,
         ROUND(r.hotel_amount * (r.total_amount - LEAST(COALESCE(rf.refunded, 0), r.total_amount)) / r.total_amount, 2) AS net_amount
    FROM reservations r
    LEFT JOIN (SELECT p.reservation_id, SUM(f.amount) AS refunded FROM refunds f JOIN payments p ON p.id = f.payment_id
                WHERE f.status = 'successful' GROUP BY p.reservation_id) rf ON rf.reservation_id = r.id
   WHERE r.status = 'completed' AND r.total_amount > 0
     AND EXISTS (SELECT 1 FROM payments p WHERE p.reservation_id = r.id AND p.status IN ('successful','partially_refunded'))
     AND NOT EXISTS (SELECT 1 FROM payout_items pi JOIN payouts po ON po.id = pi.payout_id
                      WHERE pi.reservation_id = r.id AND po.status NOT IN ('rejected','failed'))`;

const fail = (e) => ({ error: e instanceof BizError ? e.message : "Something went wrong. Please try again." });

export async function listPayouts(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.status) { where.push("po.status=?"); args.push(p.status); }
  if (p.q) { where.push("(po.payout_reference LIKE ? OR h.hotel_name LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM payouts po JOIN hotels h ON h.id=po.hotel_id JOIN hotel_bank_accounts b ON b.id=po.bank_account_id ${w}`;
  const rows_ = await query(
    `SELECT po.id, po.payout_reference, po.status, po.gross_amount, po.commission_amount, po.net_amount, po.currency, po.created_at, po.paid_at,
            h.hotel_name, b.bank_name, b.account_number_last4 ${base} ORDER BY po.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows: rows_, total, page, pageSize };
}

// Hotels that have money waiting, with their VERIFIED bank accounts (for the "create payout" form).
export async function payoutCandidates() {
  await requireAdmin();
  const hotels = await query(
    `SELECT e.hotel_id, h.hotel_name, COUNT(*) AS reservations, SUM(e.net_amount) AS available, MAX(e.currency) AS currency
       FROM (${ELIGIBLE}) e JOIN hotels h ON h.id = e.hotel_id GROUP BY e.hotel_id, h.hotel_name ORDER BY h.hotel_name`);
  if (!hotels.length) return [];
  const accounts = await query(
    `SELECT id, hotel_id, bank_name, account_name, account_number_last4 FROM hotel_bank_accounts WHERE verification_status='verified' ORDER BY is_default DESC, id`);
  return hotels.map((h) => ({ ...h, accounts: accounts.filter((a) => a.hotel_id === h.hotel_id) }));
}

export async function payoutOverview() {
  await requireAdmin();
  return queryOne(
    `SELECT COALESCE((SELECT SUM(net_amount) FROM (${ELIGIBLE}) e), 0) AS available,
            COALESCE((SELECT SUM(net_amount) FROM payouts WHERE status IN ('requested','under_review','approved','processing')), 0) AS in_progress,
            COALESCE((SELECT SUM(net_amount) FROM payouts WHERE status = 'paid'), 0) AS paid`);
}

export async function getPayout(id) {
  await requireAdmin();
  const payout = await queryOne(
    `SELECT po.*, h.hotel_name, b.bank_name, b.account_name, b.account_number_last4, b.verification_status
       FROM payouts po JOIN hotels h ON h.id=po.hotel_id JOIN hotel_bank_accounts b ON b.id=po.bank_account_id WHERE po.id=?`, [id]);
  if (!payout) return null;
  const items = await query(
    `SELECT pi.*, r.reservation_code, r.check_in, r.check_out FROM payout_items pi JOIN reservations r ON r.id=pi.reservation_id WHERE pi.payout_id=? ORDER BY pi.id`, [id]);
  const history = await query(
    `SELECT a.action, a.created_at, CONCAT(u.first_name,' ',u.last_name) AS actor, a.new_values
       FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.entity_type='payout' AND a.entity_id=? ORDER BY a.created_at DESC`, [String(id)]);
  return { payout, items, history };
}

export async function createPayoutAction(fd) {
  const s = await requireAdmin();
  const hotelId = Number(fd.get("hotel_id"));
  const bankId = Number(fd.get("bank_account_id"));
  if (!hotelId || !bankId) return { error: "Choose a verified bank account." };
  let created;
  try {
    created = await withTx(async (conn) => {
      // Lock the hotel FIRST: concurrent payout requests for one hotel queue here, and the eligibility read
      // below (READ COMMITTED) then sees everything the previous request committed.
      const hotel = await row(conn, "SELECT id, hotel_name FROM hotels WHERE id=? FOR UPDATE", [hotelId]);
      if (!hotel) throw new BizError("Hotel not found.");
      const bank = await row(conn, "SELECT id, verification_status FROM hotel_bank_accounts WHERE id=? AND hotel_id=?", [bankId, hotelId]);
      if (!bank) throw new BizError("That bank account does not belong to this hotel.");
      if (bank.verification_status !== "verified") throw new BizError("The bank account must be verified before a payout can be created.");
      const items = await rows(conn, `SELECT * FROM (${ELIGIBLE}) e WHERE e.hotel_id=? ORDER BY e.reservation_id`, [hotelId]);
      if (!items.length) throw new BizError("There are no completed, paid reservations waiting for payout.");
      if (new Set(items.map((i) => i.currency)).size > 1) throw new BizError("Mixed currencies cannot be paid out together.");
      let gross = 0, comm = 0, net = 0;
      for (const i of items) { gross += cents(i.total_amount); comm += cents(i.commission_amount); net += cents(i.net_amount); }
      const adjustments = net - (gross - comm); // <= 0: this hotel's share of refunds already paid to guests
      const ref = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
      const [res] = await conn.execute(
        `INSERT INTO payouts (hotel_id, bank_account_id, payout_reference, gross_amount, commission_amount, refund_adjustments, other_adjustments, net_amount, currency, status, requested_by)
         VALUES (?,?,?,?,?,?,0,?,?, 'requested', ?)`,
        [hotelId, bankId, ref, fromCents(gross), fromCents(comm), fromCents(adjustments), fromCents(net), items[0].currency, s.userId]);
      for (const i of items) {
        await conn.execute(
          `INSERT INTO payout_items (payout_id, reservation_id, gross_amount, commission_amount, adjustment_amount, net_amount) VALUES (?,?,?,?,?,?)`,
          [res.insertId, i.reservation_id, i.total_amount, i.commission_amount, fromCents(cents(i.net_amount) - cents(i.hotel_amount)), i.net_amount]);
      }
      return { id: res.insertId, ref, count: items.length, net: fromCents(net), hotel: hotel.hotel_name };
    });
  } catch (e) { return fail(e); }
  await audit(s.userId, "payout.created", "payout", created.id, null, { reference: created.ref, hotel: created.hotel, reservations: created.count, net: created.net });
  revalidatePath("/admin/payouts");
  return { success: `Payout ${created.ref} created for ${created.count} reservation(s).` };
}

const FLOW = {
  under_review: { from: ["requested"] },
  approved: { from: ["requested", "under_review"] },
  processing: { from: ["approved"] },
  paid: { from: ["approved", "processing"], needsRef: true },
  rejected: { from: ["requested", "under_review"], needsReason: true },
  failed: { from: ["approved", "processing"], needsReason: true },
};

export async function payoutTransitionAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const to = String(fd.get("to"));
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  const transferRef = String(fd.get("transfer_reference") ?? "").trim().slice(0, 120);
  const t = FLOW[to];
  if (!t) return { error: "Unknown payout action." };
  if (t.needsReason && reason.length < 3) return { error: "Enter a reason." };
  // "Paid" is a claim about real money: it needs the bank/provider transfer reference AND an explicit confirmation.
  if (t.needsRef && (transferRef.length < 6 || fd.get("confirmed") !== "on")) return { error: "Enter the transfer reference and confirm the transfer has been received/cleared." };
  let old;
  try {
    old = await withTx(async (conn) => {
      const p = await row(conn, "SELECT id, status, payout_reference FROM payouts WHERE id=? FOR UPDATE", [id]);
      if (!p) throw new BizError("Payout not found.");
      if (!t.from.includes(p.status)) throw new BizError(`A ${p.status.replace("_", " ")} payout cannot move to ${to.replace("_", " ")}.`);
      await conn.execute(
        `UPDATE payouts SET status=?, approved_by=IF(?='approved', ?, approved_by), approved_at=IF(?='approved', NOW(), approved_at),
                paid_at=IF(?='paid', NOW(), paid_at), provider_transfer_reference=COALESCE(?, provider_transfer_reference),
                rejection_reason=IF(? IN ('rejected','failed'), ?, rejection_reason) WHERE id=?`,
        [to, to, s.userId, to, to, transferRef || null, to, reason || null, id]);
      return p;
    });
  } catch (e) { return fail(e); }
  await audit(s.userId, `payout.${to}`, "payout", id, { status: old.status }, { status: to, reason: reason || undefined, transfer_reference: transferRef || undefined });
  revalidatePath("/admin/payouts");
  revalidatePath(`/admin/payouts/${id}`);
  return { success: `Payout marked ${to.replace("_", " ")}.` };
}
