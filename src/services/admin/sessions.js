"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";

// The `sessions` table holds sign-ins to the public site (guests, hotel owners, staff).
// Admin panel sign-ins use a signed cookie and are not listed here.
export async function listSessions(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.status === "expired") where.push("s.expires_at <= NOW()");
  else where.push("s.expires_at > NOW()");
  if (p.q) {
    where.push("(CONCAT(u.first_name,' ',u.last_name) LIKE ? OR u.email LIKE ? OR s.ip_address LIKE ? OR s.user_agent LIKE ?)");
    const like = `%${String(p.q).trim()}%`;
    args.push(like, like, like, like);
  }
  const w = `WHERE ${where.join(" AND ")}`;
  const base = `FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN roles r ON r.id=u.role_id ${w}`;
  const rows = await query(
    `SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.created_at, s.expires_at,
            u.first_name, u.last_name, u.email, u.status AS user_status, r.role_name
       ${base} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  const counts = await queryOne("SELECT SUM(expires_at > NOW()) AS active, SUM(expires_at <= NOW()) AS expired FROM sessions");
  return { rows, total, page, pageSize, active: Number(counts.active ?? 0), expired: Number(counts.expired ?? 0) };
}

export async function revokeSessionAction(fd) {
  const s = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const row = await queryOne("SELECT user_id FROM sessions WHERE id=?", [id]);
  if (!row) return { error: "That session has already ended." };
  await execute("DELETE FROM sessions WHERE id=?", [id]);
  await audit(s.userId, "session.revoked", "user", row.user_id, null, { scope: "one" });
  revalidatePath("/admin/sessions");
  return { success: "Session ended. That device will be signed out." };
}

export async function revokeUserSessionsAction(fd) {
  const s = await requireAdmin();
  const userId = Number(fd.get("user_id"));
  const res = await execute("DELETE FROM sessions WHERE user_id=?", [userId]);
  if (!res.affectedRows) return { error: "That user has no active sessions." };
  await audit(s.userId, "session.revoked", "user", userId, null, { scope: "all", count: res.affectedRows });
  revalidatePath("/admin/sessions");
  return { success: `Signed out of ${res.affectedRows} device${res.affectedRows === 1 ? "" : "s"}.` };
}

export async function purgeExpiredSessionsAction() {
  const s = await requireAdmin();
  const res = await execute("DELETE FROM sessions WHERE expires_at <= NOW()");
  await audit(s.userId, "session.purged", "session", null, null, { count: res.affectedRows });
  revalidatePath("/admin/sessions");
  return { success: `Removed ${res.affectedRows} expired session${res.affectedRows === 1 ? "" : "s"}.` };
}
