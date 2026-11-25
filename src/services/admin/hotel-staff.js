"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, pool } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/guard";

const STATUSES = ["invited", "active", "suspended", "removed"];
const refresh = (hotelId) => { revalidatePath(`/admin/hotels/${hotelId}/staff`); revalidatePath(`/admin/hotels/${hotelId}`); };

export async function getHotelStaff(hotelId) {
  await requireAdmin();
  const hotel = await queryOne("SELECT id, hotel_name FROM hotels WHERE id=?", [hotelId]);
  if (!hotel) return null;
  const [staff, grants, permissions, candidates] = await Promise.all([
    query(
      `SELECT hs.id, hs.user_id, hs.staff_title, hs.status, hs.joined_at, hs.created_at,
              u.first_name, u.last_name, u.email, u.status AS user_status
         FROM hotel_staff hs JOIN users u ON u.id=hs.user_id
        WHERE hs.hotel_id=? ORDER BY (hs.status='removed'), u.first_name, u.last_name`, [hotelId]),
    query(
      `SELECT hsp.hotel_staff_id, hsp.permission_id FROM hotel_staff_permissions hsp
         JOIN hotel_staff hs ON hs.id=hsp.hotel_staff_id WHERE hs.hotel_id=?`, [hotelId]),
    query("SELECT id, permission_key, permission_name, description FROM permissions ORDER BY id"),
    // Active users with the Hotel Staff role who aren't on this hotel's team yet.
    query(
      `SELECT u.id, CONCAT(u.first_name,' ',u.last_name,' (',u.email,')') AS label
         FROM users u JOIN roles r ON r.id=u.role_id AND r.role_key='hotel_staff'
        WHERE u.status='active' AND u.id NOT IN (SELECT user_id FROM hotel_staff WHERE hotel_id=?)
        ORDER BY u.first_name, u.last_name`, [hotelId]),
  ]);
  const byStaff = {};
  for (const g of grants) (byStaff[g.hotel_staff_id] ??= []).push(g.permission_id);
  return { hotel, staff: staff.map((s) => ({ ...s, permissionIds: byStaff[s.id] ?? [] })), permissions, candidates };
}

// Only ids that really exist in `permissions` are stored.
async function cleanPermissionIds(fd) {
  const wanted = [...new Set(fd.getAll("permissions").map(Number).filter(Boolean))];
  if (!wanted.length) return [];
  const rows = await query("SELECT id FROM permissions WHERE id IN (?)", [wanted]);
  return rows.map((r) => r.id);
}

async function replacePermissions(conn, staffId, ids, grantedBy) {
  await conn.query("DELETE FROM hotel_staff_permissions WHERE hotel_staff_id=?", [staffId]);
  if (ids.length) await conn.query("INSERT INTO hotel_staff_permissions (hotel_staff_id, permission_id, granted_by) VALUES ?", [ids.map((p) => [staffId, p, grantedBy])]);
}

export async function addStaffAction(fd) {
  const s = await requireAdmin();
  const hotelId = Number(fd.get("hotel_id"));
  const userId = Number(fd.get("user_id"));
  const title = String(fd.get("staff_title") ?? "").trim().slice(0, 100);
  if (!hotelId || !userId) return { error: "Choose a staff member to add." };
  if (!(await queryOne("SELECT id FROM hotels WHERE id=?", [hotelId]))) return { error: "That hotel no longer exists." };
  const user = await queryOne(
    `SELECT u.id, u.status, r.role_key FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?`, [userId]);
  if (!user) return { error: "That user no longer exists." };
  if (user.role_key !== "hotel_staff") return { error: "Only users with the Hotel Staff role can join a hotel's team." };
  if (user.status !== "active") return { error: "That user's account isn't active." };
  if (await queryOne("SELECT id FROM hotel_staff WHERE hotel_id=? AND user_id=?", [hotelId, userId]))
    return { error: "That person is already on this hotel's team." };
  const permIds = await cleanPermissionIds(fd);
  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO hotel_staff (hotel_id, user_id, staff_title, status, invited_by, joined_at) VALUES (?,?,?,'active',?,NOW())",
      [hotelId, userId, title || null, s.userId]);
    id = r.insertId;
    await replacePermissions(conn, id, permIds, s.userId);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e.code === "ER_DUP_ENTRY") return { error: "That person is already on this hotel's team." };
    throw e;
  } finally { conn.release(); }
  await audit(s.userId, "hotel_staff.added", "hotel_staff", id, null, { hotel_id: hotelId, user_id: userId, staff_title: title, permissions: permIds });
  refresh(hotelId);
  return { success: "Staff member added." };
}

export async function updateStaffAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const title = String(fd.get("staff_title") ?? "").trim().slice(0, 100);
  const status = String(fd.get("status"));
  if (!STATUSES.includes(status)) return { error: "Choose a valid status." };
  const old = await queryOne("SELECT hotel_id, staff_title, status FROM hotel_staff WHERE id=?", [id]);
  if (!old) return { error: "That staff member no longer exists." };
  const permIds = await cleanPermissionIds(fd);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE hotel_staff SET staff_title=?, status=?, joined_at=IF(?='active' AND joined_at IS NULL, NOW(), joined_at) WHERE id=?`,
      [title || null, status, status, id]);
    await replacePermissions(conn, id, permIds, s.userId);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(s.userId, "hotel_staff.updated", "hotel_staff", id, old, { staff_title: title, status, permissions: permIds });
  refresh(old.hotel_id);
  return { success: "Staff member saved." };
}

export async function removeStaffAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const old = await queryOne(
    `SELECT hs.hotel_id, hs.user_id, hs.staff_title, u.email FROM hotel_staff hs JOIN users u ON u.id=hs.user_id WHERE hs.id=?`, [id]);
  if (!old) return { error: "That staff member no longer exists." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM hotel_staff_permissions WHERE hotel_staff_id=?", [id]);
    await conn.query("DELETE FROM hotel_staff WHERE id=?", [id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(s.userId, "hotel_staff.removed", "hotel_staff", id, { user: old.email, staff_title: old.staff_title }, null);
  refresh(old.hotel_id);
  return { success: "Removed from the hotel's team." };
}
