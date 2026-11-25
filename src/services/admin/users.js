"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg, isSuper } from "@/lib/guard";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

export async function listUsers(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) {
    where.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT(u.first_name,' ',u.last_name) LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
    const like = `%${String(p.q).trim()}%`;
    args.push(like, like, like, like, like);
  }
  if (p.status) { where.push("u.status = ?"); args.push(p.status); }
  if (p.role) { where.push("r.role_key = ?"); args.push(p.role); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.last_login_at, u.created_at, r.role_name, r.role_key
       FROM users u LEFT JOIN roles r ON r.id=u.role_id ${w}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );
  const total = (await queryOne(
    `SELECT COUNT(*) AS c FROM users u LEFT JOIN roles r ON r.id=u.role_id ${w}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getUser(id) {
  await requireAdmin();
  const user = await queryOne(
    `SELECT u.*, r.role_name, r.role_key FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?`, [id]);
  if (!user) return null;
  delete user.password_hash;
  const [reservations, hotels, addresses, extra] = await Promise.all([
    query(
      `SELECT r.id, r.reservation_code, r.status, r.total_amount, r.check_in, r.check_out, h.hotel_name
         FROM reservations r JOIN hotels h ON h.id=r.hotel_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 10`, [id]),
    query(`SELECT id, hotel_name, approval_status, city FROM hotels WHERE owner_id=?`, [id]),
    query(`SELECT id, address_line1, address_line2, city, state, postal_code, country, is_default FROM user_addresses WHERE user_id=? ORDER BY is_default DESC, id`, [id]),
    queryOne(
      `SELECT (SELECT COUNT(*) FROM favorites WHERE user_id=?) AS favourites,
              (SELECT COUNT(*) FROM sessions WHERE user_id=? AND expires_at > NOW()) AS sessions,
              (SELECT COUNT(*) FROM hotel_staff WHERE user_id=? AND status <> 'removed') AS staff_of`, [id, id, id]),
  ]);
  return { user, reservations, hotels, addresses, favourites: extra.favourites, sessions: extra.sessions, staffOf: extra.staff_of };
}

export async function listRoles() {
  await requireAdmin();
  return query("SELECT id, role_key, role_name FROM roles ORDER BY id");
}

// The platform must always keep one active superadmin, or nobody can sign in to /admin.
async function wouldRemoveLastSuperadmin(id) {
  const r = await queryOne(
    `SELECT COUNT(*) AS total, COALESCE(SUM(u.id=?),0) AS me
       FROM users u JOIN roles r ON r.id=u.role_id AND r.role_key='superadmin' WHERE u.status='active'`, [id]);
  return Number(r.me) > 0 && Number(r.total) <= 1;
}
const revokeSessions = (id) => execute("DELETE FROM sessions WHERE user_id=?", [id]);

export async function setUserStatusAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["active", "inactive", "suspended"].includes(status)) return;
  if (id === s.userId) return; // never lock yourself out
  if (status !== "active" && (await wouldRemoveLastSuperadmin(id))) return;
  const old = await queryOne("SELECT status FROM users WHERE id=?", [id]);
  await execute("UPDATE users SET status=? WHERE id=?", [status, id]);
  if (status !== "active") await revokeSessions(id); // signed-in devices are cut off immediately
  await audit(s.userId, "user.status_changed", "user", id, old, { status });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
}

export async function setUserRoleAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const roleId = Number(fd.get("role_id"));
  if (id === s.userId) return;
  if (await wouldRemoveLastSuperadmin(id)) return;
  const old = await queryOne("SELECT role_id FROM users WHERE id=?", [id]);
  await execute("UPDATE users SET role_id=? WHERE id=?", [roleId, id]);
  await audit(s.userId, "user.role_changed", "user", id, old, { role_id: roleId });
  revalidatePath(`/admin/users/${id}`);
}

const ADMIN_KEYS = ["superadmin"];

const userSchema = z.object({
  first_name: z.string().trim().min(1, "Enter a first name.").max(100),
  last_name: z.string().trim().min(1, "Enter a last name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(191),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role_id: z.coerce.number().int().positive("Choose a role."),
  status: z.enum(["active", "inactive", "suspended", "pending_verification"]),
  password: z.string().optional().or(z.literal("")),
});

const roleKeyOf = async (roleId) => (await queryOne("SELECT role_key FROM roles WHERE id=?", [roleId]))?.role_key;

const dupMessage = (e) =>
  e.code === "ER_DUP_ENTRY" ? (String(e.message).includes("phone") ? "That phone number is already in use." : "That email is already in use.") : null;

export async function getUserForEdit(id) {
  await requireAdmin();
  const u = await queryOne(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role_id, u.status, r.role_key
       FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?`, [id]);
  return u;
}

export async function createUserAction(_, fd) {
  const s = await requireAdmin();
  const p = userSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (!d.password || d.password.length < 8) return { error: "Use a password of at least 8 characters." };
  const rk = await roleKeyOf(d.role_id);
  if (!rk) return { error: "That role doesn't exist." };
  if (ADMIN_KEYS.includes(rk) && !isSuper(s)) return { error: "Only a super admin can create administrator accounts." };
  let id;
  try {
    const r = await execute(
      `INSERT INTO users (role_id, first_name, last_name, email, phone, password_hash, status, email_verified_at)
       VALUES (?,?,?,?,?,?,?, NOW())`,
      [d.role_id, d.first_name, d.last_name, d.email, d.phone || null, await bcrypt.hash(d.password, 12), d.status]);
    id = r.insertId;
  } catch (e) {
    const m = dupMessage(e); if (m) return { error: m }; throw e;
  }
  await audit(s.userId, "user.created", "user", id, null, { email: d.email, role_id: d.role_id, status: d.status });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}`);
}

export async function updateUserAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const p = userSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const old = await getUserForEdit(id);
  if (!old) return { error: "That user no longer exists." };
  const newKey = await roleKeyOf(d.role_id);
  if (!newKey) return { error: "That role doesn't exist." };
  if ((ADMIN_KEYS.includes(old.role_key) || ADMIN_KEYS.includes(newKey)) && !isSuper(s))
    return { error: "Only a super admin can change administrator accounts." };
  if (id === s.userId) { d.role_id = old.role_id; d.status = old.status; } // never lock yourself out
  else if ((d.role_id !== old.role_id || d.status !== "active") && (await wouldRemoveLastSuperadmin(id)))
    return { error: "This is the only active superadmin. Make another superadmin first." };
  if (d.password && d.password.length < 8) return { error: "A new password needs at least 8 characters." };
  try {
    await execute(
      "UPDATE users SET first_name=?, last_name=?, email=?, phone=?, role_id=?, status=? WHERE id=?",
      [d.first_name, d.last_name, d.email, d.phone || null, d.role_id, d.status, id]);
    if (d.password) await execute("UPDATE users SET password_hash=? WHERE id=?", [await bcrypt.hash(d.password, 12), id]);
    if (d.password || d.status !== "active") await revokeSessions(id);
  } catch (e) {
    const m = dupMessage(e); if (m) return { error: m }; throw e;
  }
  await audit(s.userId, "user.updated", "user", id, old,
    { first_name: d.first_name, last_name: d.last_name, email: d.email, phone: d.phone, role_id: d.role_id, status: d.status, password_reset: !!d.password });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  redirect(`/admin/users/${id}`);
}

export async function deleteUserAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  if (id === s.userId) return { error: "You can't delete your own account." };
  const u = await getUserForEdit(id);
  if (!u) return { error: "That user no longer exists." };
  if (ADMIN_KEYS.includes(u.role_key) && !isSuper(s)) return { error: "Only a super admin can delete administrator accounts." };
  if (await wouldRemoveLastSuperadmin(id)) return { error: "This is the only active superadmin and can't be deleted." };
  const refs = await queryOne(
    `SELECT (SELECT COUNT(*) FROM reservations WHERE user_id=?) AS reservations,
            (SELECT COUNT(*) FROM hotels WHERE owner_id=?) AS hotels,
            (SELECT COUNT(*) FROM hotel_staff WHERE user_id=?) AS staff`, [id, id, id]);
  if (refs.reservations || refs.hotels || refs.staff)
    return { error: "This user has reservations, hotels or staff records, so it can't be deleted. Set the status to Inactive instead." };
  try {
    await revokeSessions(id);
    await execute("DELETE FROM favorites WHERE user_id=?", [id]);
    await execute("DELETE FROM user_addresses WHERE user_id=?", [id]);
    await execute("DELETE FROM users WHERE id=?", [id]);
  } catch (e) {
    if (e.code === "ER_ROW_IS_REFERENCED_2") return { error: "Other records still depend on this user. Set the status to Inactive instead." };
    throw e;
  }
  await audit(s.userId, "user.deleted", "user", id, { email: u.email, role: u.role_key }, null);
  revalidatePath("/admin/users");
  return { success: "User deleted." };
}
