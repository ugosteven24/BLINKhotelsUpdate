"use server";

// User profiles, account management and favourites.

import bcrypt from "bcryptjs";
import { query, run, withTransaction, isDuplicateEntry } from "@/lib/db/connection";
import { ADMIN_ROLES, ROLES, getCurrentSessionId, requireRole, requireUser } from "@/lib/auth/session";
import { mapHotel, mapUser } from "@/lib/mappers";
import { parseJson, sanitizeDoc } from "@/lib/doc";
import { ServiceError, newId } from "@/lib/service-utils";
import { cleanString, isAcceptablePassword, isValidEmail, normalizeEmail } from "@/lib/validation";
import { logActivity } from "@/lib/notify";

const BCRYPT_ROUNDS = 12;
const RESERVED = new Set([
  "id", "uid", "email", "role", "status", "passwordHash", "password", "provider",
  "createdAt", "updatedAt", "blocked", "blockedAt", "lastLoginAt", "fullName",
  "firstName", "lastName", "phone", "photoURL", "photo", "profileImage",
]);

// ---------------------------------------------------------------------------
// OWN PROFILE
// ---------------------------------------------------------------------------
export async function getMyProfile() {
  const user = await requireUser();
  const rows = await query("SELECT * FROM users WHERE id = ?", [user.id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function updateMyProfile(input) {
  const user = await requireUser();
  const doc = sanitizeDoc(input);

  const firstName = cleanString(doc.firstName, 100);
  const lastName = cleanString(doc.lastName, 100);
  const phone = cleanString(doc.phone, 40);
  const photoURL = cleanString(doc.photoURL ?? doc.profileImage ?? doc.imageURL ?? doc.photo, 1024);
  const extra = Object.fromEntries(Object.entries(doc).filter(([k]) => !RESERVED.has(k) && k !== "imageURL"));

  await withTransaction(async (connection) => {
    const rows = await run(connection, "SELECT * FROM users WHERE id = ? FOR UPDATE", [user.id]);
    const current = rows[0];

    const nextFirst = "firstName" in doc ? firstName : current.first_name;
    const nextLast = "lastName" in doc ? lastName : current.last_name;
    const fullName = `${nextFirst} ${nextLast}`.trim() || cleanString(doc.fullName, 200) || current.full_name;

    await run(
      connection,
      `UPDATE users SET first_name = ?, last_name = ?, full_name = ?, phone = ?, photo_url = ?, profile = ? WHERE id = ?`,
      [
        nextFirst, nextLast, fullName,
        "phone" in doc ? phone : current.phone,
        photoURL || current.photo_url,
        JSON.stringify({ ...parseJson(current.profile), ...extra }),
        user.id,
      ]
    );
  });
  return { ok: true };
}

export async function updateMyLocation(location) {
  const user = await requireUser();
  const doc = sanitizeDoc(location);
  const keep = ["city", "state", "country", "latitude", "longitude"];
  const patch = Object.fromEntries(keep.filter((k) => k in doc).map((k) => [k, doc[k]]));

  await withTransaction(async (connection) => {
    const rows = await run(connection, "SELECT profile FROM users WHERE id = ? FOR UPDATE", [user.id]);
    await run(connection, "UPDATE users SET profile = ? WHERE id = ?", [
      JSON.stringify({ ...parseJson(rows[0]?.profile), ...patch }), user.id,
    ]);
  });
  return { ok: true };
}

export async function changeMyPassword({ currentPassword, newPassword } = {}) {
  const user = await requireUser();

  if (!isAcceptablePassword(newPassword)) {
    return { ok: false, code: "weak-password", message: "Password must be at least 6 characters." };
  }

  const rows = await query("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  const hash = rows[0]?.password_hash;
  if (!hash || typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, hash))) {
    return { ok: false, code: "wrong-password", message: "Current password is incorrect." };
  }

  const nextHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const sessionId = await getCurrentSessionId();

  await withTransaction(async (connection) => {
    await run(connection, "UPDATE users SET password_hash = ? WHERE id = ?", [nextHash, user.id]);
    // Sign every OTHER browser out; keep this one.
    await run(connection, "DELETE FROM sessions WHERE user_id = ? AND id <> ?", [user.id, sessionId ?? ""]);
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ADMIN USER MANAGEMENT
// ---------------------------------------------------------------------------
const ROLE_VALUES = Object.values(ROLES);

export async function listUsers(filter = {}) {
  await requireRole(ADMIN_ROLES);

  const params = [];
  let where = "1=1";
  if (filter.role) {
    if (!ROLE_VALUES.includes(filter.role)) throw new ServiceError("Invalid role.");
    where += " AND role = ?";
    params.push(filter.role);
  }
  const rows = await query(
    `SELECT id, first_name, last_name, full_name, email, role, status, phone, photo_url,
            provider, profile, blocked_at, created_at, last_login_at
       FROM users WHERE ${where} ORDER BY full_name LIMIT 5000`,
    params
  );
  return rows.map(mapUser);
}

async function targetUser(connection, actor, id) {
  const rows = await run(connection, "SELECT id, role, full_name FROM users WHERE id = ? FOR UPDATE", [id]);
  const target = rows[0];
  if (!target) throw new ServiceError("User not found.", "not-found");
  if (target.id === actor.id) throw new ServiceError("You cannot do that to your own account.");
  if (target.role === ROLES.SUPERADMIN && actor.role !== ROLES.SUPERADMIN) {
    throw new ServiceError("Only a superadmin can change a superadmin.", "forbidden");
  }
  if (target.role === ROLES.ADMIN && actor.role !== ROLES.SUPERADMIN) {
    throw new ServiceError("Only a superadmin can change an admin.", "forbidden");
  }
  return target;
}

// status: "Active" | "Blocked" | "Inactive" (the labels the admin pages use)
export async function setUserStatus(id, status) {
  const actor = await requireRole(ADMIN_ROLES);
  const next = { Active: "active", Blocked: "blocked", Inactive: "disabled" }[status];
  if (!next) throw new ServiceError("Invalid status.");

  await withTransaction(async (connection) => {
    const target = await targetUser(connection, actor, id);
    await run(
      connection,
      "UPDATE users SET status = ?, blocked_at = ? WHERE id = ?",
      [next, next === "active" ? null : new Date(), id]
    );
    if (next !== "active") await run(connection, "DELETE FROM sessions WHERE user_id = ?", [id]);
    await logActivity(connection, actor, `Set ${target.full_name} to ${status}`, "Users");
  });
  return { ok: true };
}

export async function blockUser(id, blocked) {
  return setUserStatus(id, blocked ? "Blocked" : "Active");
}

export async function deleteUser(id) {
  const actor = await requireRole(ADMIN_ROLES);
  try {
    await withTransaction(async (connection) => {
      const target = await targetUser(connection, actor, id);
      await run(connection, "DELETE FROM users WHERE id = ?", [id]);
      await logActivity(connection, actor, `Deleted user ${target.full_name}`, "Users");
    });
  } catch (error) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      throw new ServiceError("This user has bookings and cannot be deleted. Block the account instead.");
    }
    throw error;
  }
  return { ok: true };
}

// Creates a staff / hotel-owner / admin account.
export async function createStaffUser(input) {
  const actor = await requireRole(ADMIN_ROLES);
  try {
    return await createStaffUserInner(actor, input);
  } catch (error) {
    if (error instanceof ServiceError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

async function createStaffUserInner(actor, input) {

  const fullName = cleanString(input?.fullName, 200);
  const email = normalizeEmail(input?.email);
  const role = input?.role ?? "staff";

  if (!fullName || !isValidEmail(email)) throw new ServiceError("Name and a valid email are required.");
  if (!isAcceptablePassword(input?.password)) throw new ServiceError("Password must be at least 6 characters.");
  if (![ROLES.STAFF, ROLES.HOTEL_OWNER, ROLES.ADMIN].includes(role)) throw new ServiceError("Invalid role.");
  if (role === ROLES.ADMIN && actor.role !== ROLES.SUPERADMIN) {
    throw new ServiceError("Only a superadmin can create admins.", "forbidden");
  }

  const [firstName, ...rest] = fullName.split(/\s+/);
  const hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const status = input?.status === "Inactive" ? "disabled" : "active";

  try {
    await withTransaction(async (connection) => {
      await run(
        connection,
        `INSERT INTO users (id, first_name, last_name, full_name, email, password_hash, role, status, phone, photo_url, profile)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(), firstName, rest.join(" "), fullName, email, hash, role, status,
          cleanString(input?.phone, 40), cleanString(input?.photoURL, 1024),
          JSON.stringify({ department: cleanString(input?.department, 100) }),
        ]
      );
      await logActivity(connection, actor, `Created ${role} ${email}`, "Users");
    });
  } catch (error) {
    if (isDuplicateEntry(error)) throw new ServiceError("An account already exists with this email.");
    throw error;
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// FAVOURITES
// ---------------------------------------------------------------------------
export async function listFavoriteIds() {
  const user = await requireUser();
  const rows = await query("SELECT hotel_id FROM favorites WHERE user_id = ?", [user.id]);
  return rows.map((r) => r.hotel_id);
}

// Favourite hotels with their current details.
export async function listFavorites() {
  const user = await requireUser();
  const rows = await query(
    `SELECT h.*, f.created_at AS favorited_at
       FROM favorites f JOIN hotels h ON h.id = f.hotel_id
      WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    [user.id]
  );
  return rows.map((r) => ({ ...mapHotel(r), hotelId: r.id, favoritedAt: r.favorited_at?.toISOString?.() ?? null }));
}

export async function addFavorite(hotelId) {
  const user = await requireUser();
  try {
    await query("INSERT IGNORE INTO favorites (user_id, hotel_id) VALUES (?, ?)", [user.id, String(hotelId)]);
  } catch (error) {
    if (error?.code === "ER_NO_REFERENCED_ROW_2") throw new ServiceError("Hotel not found.", "not-found");
    throw error;
  }
  return { ok: true };
}

export async function removeFavorite(hotelId) {
  const user = await requireUser();
  await query("DELETE FROM favorites WHERE user_id = ? AND hotel_id = ?", [user.id, String(hotelId)]);
  return { ok: true };
}
