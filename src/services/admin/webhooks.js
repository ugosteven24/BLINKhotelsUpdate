"use server";

import { query, queryOne } from "@/lib/db";
import { requireAdmin, pg } from "@/lib/guard";
import { safePayloadText } from "@/lib/redact";

// Listing never loads the (large) payload column. Events are read-only here: there is deliberately NO replay.
export async function listWebhookEvents(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.status) { where.push("processing_status=?"); args.push(p.status); }
  if (p.q) { where.push("(payment_reference LIKE ? OR provider_event_id LIKE ? OR event_type LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`, `%${p.q}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query(
    `SELECT id, provider, provider_event_id, payment_reference, event_type, processing_status, processing_error, received_at, processed_at
       FROM payment_webhook_events ${w} ORDER BY received_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c FROM payment_webhook_events ${w}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getWebhookEvent(id) {
  await requireAdmin();
  const e = await queryOne(
    `SELECT id, provider, provider_event_id, payment_reference, event_type, processing_status, processing_error, received_at, processed_at, payload
       FROM payment_webhook_events WHERE id=?`, [id]);
  if (!e) return null;
  const { payload, ...rest } = e;
  return { ...rest, payloadText: safePayloadText(payload) }; // sensitive keys are masked before leaving the server
}
