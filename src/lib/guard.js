import { redirect } from "next/navigation";
import { cache } from "react";
import { readSession, } from "./session";
import { execute, queryOne } from "./db";
import { headers } from "next/headers";

// Only an ACTIVE superadmin may use /admin. The cookie only tells us WHICH user to look up; the role and
// status are read from MySQL on every request (cached per request), so a demoted or suspended user loses
// access immediately instead of at cookie expiry.
const loadAdmin = cache(async (userId) =>
  queryOne(
    `SELECT u.id, u.status, r.role_key FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [userId]
  )
);

export async function requireAdmin() {
  const s = await readSession();
  const u = s?.userId ? await loadAdmin(s.userId) : null;
  if (!u || u.status !== "active" || u.role_key !== "superadmin") redirect("/admin/login");
  return { ...s, role: u.role_key };
}

export async function audit(
  userId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues
) {
  const h = await headers();
  await execute(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      userId,
      action,
      entityType ?? null,
      entityId ?? null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      (h.get("x-forwarded-for") ?? "").split(",")[0] || null,
      (h.get("user-agent") ?? "").slice(0, 255) || null,
    ]
  );
}


export const pg = (p) => {
  const pageSize = p.pageSize ?? 20;
  const page = Math.max(1, p.page ?? 1);
  return { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize };
};


// requireAdmin() only lets active superadmins in, so this is true for every session it returns.
// Kept as a function because services/admin/users.js checks it before creating/editing/deleting admin accounts.
export const isSuper = (s) => s?.role === "superadmin";
