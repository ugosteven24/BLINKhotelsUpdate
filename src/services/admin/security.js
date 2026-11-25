"use server";

import { query, queryOne } from "@/lib/db";
import { requireAdmin, pg } from "@/lib/guard";

export async function listLoginLogs(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) { where.push("(l.email LIKE ? OR l.ip_address LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`); }
  if (p.result === "success") where.push("l.success=1");
  if (p.result === "failed") where.push("l.success=0");
  if (p.from) { where.push("l.created_at >= ?"); args.push(`${p.from} 00:00:00`); }
  if (p.to) { where.push("l.created_at < DATE_ADD(?, INTERVAL 1 DAY)"); args.push(p.to); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM login_logs l LEFT JOIN users u ON u.id=l.user_id ${w}`;
  const rows = await query(
    `SELECT l.id, l.email, l.success, l.ip_address, l.user_agent, l.created_at, CONCAT(u.first_name,' ',u.last_name) AS user_name
       ${base} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

// Read-only. roles/permissions are definitions; per-staff grants live in hotel_staff_permissions.
export async function getRolesOverview() {
  await requireAdmin();
  const [roles, permissions, activeSuperadmins] = await Promise.all([
    query(`SELECT r.id, r.role_key, r.role_name, r.description, COUNT(u.id) AS users, COALESCE(SUM(u.status='active'),0) AS active_users
             FROM roles r LEFT JOIN users u ON u.role_id=r.id GROUP BY r.id ORDER BY r.id`),
    query(`SELECT p.id, p.permission_key, p.permission_name, p.description, COUNT(hsp.hotel_staff_id) AS grants
             FROM permissions p LEFT JOIN hotel_staff_permissions hsp ON hsp.permission_id=p.id GROUP BY p.id ORDER BY p.permission_key`),
    queryOne(`SELECT COUNT(*) AS c FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_key='superadmin' AND u.status='active'`),
  ]);
  return { roles, permissions, activeSuperadmins: activeSuperadmins.c };
}
