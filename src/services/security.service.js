"use server";

// Security pages: login logs and blocked accounts.

import { query } from "@/lib/db/connection";
import { ADMIN_ROLES, requireRole } from "@/lib/auth/session";
import { iso } from "@/lib/doc";

export async function listLoginLogs(options = {}) {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `SELECT l.id, l.email, l.success, l.ip_address, l.user_agent, l.created_at, u.full_name, u.role
       FROM login_logs l LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC LIMIT ${Math.min(Math.max(Number(options.limit) || 500, 1), 2000)}`
  );
  return rows.map((r) => ({
    id: String(r.id),
    email: r.email,
    user: r.full_name || r.email,
    fullName: r.full_name || "",
    role: r.role || "",
    status: r.success ? "Success" : "Failed",
    success: !!r.success,
    ip: r.ip_address || "",
    ipAddress: r.ip_address || "",
    device: r.user_agent || "",
    userAgent: r.user_agent || "",
    createdAt: iso(r.created_at),
  }));
}

export async function deleteLoginLog(id) {
  await requireRole(ADMIN_ROLES);
  await query("DELETE FROM login_logs WHERE id = ?", [Number(id) || 0]);
  return { ok: true };
}
