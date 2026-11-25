"use server";

// Hotel registration, updates, discovery and details.

import { query, run, withTransaction } from "@/lib/db/connection";
import { ADMIN_ROLES, ROLES, getSessionUser, requireRole, requireUser } from "@/lib/auth/session";
import { mapHotel } from "@/lib/mappers";
import { parseJson, sanitizeDoc } from "@/lib/doc";
import { ServiceError, clampInt, newId, toMoney } from "@/lib/service-utils";
import { cleanString } from "@/lib/validation";
import { logActivity } from "@/lib/notify";

const HIDDEN = ["Pending", "Rejected", "inactive"]; // not shown to the public
const OWNER_ROLES = [ROLES.HOTEL_OWNER, ROLES.STAFF];
const HOTEL_STATUSES = ["Pending", "Approved", "Rejected", "inactive"];

// Document field -> real column. Everything else is kept in the `data` JSON.
const COLUMNS = {
  hotelName: "hotel_name",
  category: "category",
  city: "city",
  state: "state",
  country: "country",
  price: "price",
  coverImage: "cover_image",
  status: "status",
  approved: "approved",
  featured: "featured",
  verified: "verified",
};
const PRIVILEGED = new Set(["status", "approved", "featured", "verified"]);
const NEVER_FROM_CLIENT = new Set(["id", "ownerId", "legacyId", "createdAt", "updatedAt"]);

function splitInput(input, canUsePrivileged) {
  const doc = sanitizeDoc(input);
  const cols = {};
  const data = {};

  for (const [key, value] of Object.entries(doc)) {
    if (NEVER_FROM_CLIENT.has(key)) continue;

    if (COLUMNS[key]) {
      if (PRIVILEGED.has(key) && !canUsePrivileged) continue;

      if (key === "price") cols[COLUMNS[key]] = toMoney(value);
      else if (["approved", "featured", "verified"].includes(key)) cols[COLUMNS[key]] = value ? 1 : 0;
      else if (key === "status") {
        if (!HOTEL_STATUSES.includes(value)) throw new ServiceError("Invalid hotel status.");
        cols[COLUMNS[key]] = value;
      } else cols[COLUMNS[key]] = cleanString(String(value ?? ""), key === "coverImage" ? 1024 : 255);
    } else {
      data[key] = value;
    }
  }
  return { cols, data };
}

async function canManage(user, hotelId) {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (!OWNER_ROLES.includes(user.role)) return false;
  const rows = await query("SELECT 1 FROM hotels WHERE id = ? AND owner_id = ?", [hotelId, user.id]);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// DISCOVERY (public)
// ---------------------------------------------------------------------------

// Paged list of bookable hotels. cursor = last id of the previous page.
export async function listHotel(options = {}) {
  const limit = clampInt(options.limit, 1, 500, 24);
  const params = [];
  // Only approved hotels are public. (Matches the schema's draft / pending / approved / rejected / suspended values;
  // the old "NOT IN (Pending, Rejected, inactive)" let draft and suspended hotels through.)
  let where = "approval_status = 'approved'";

  if (options.cursor) { where += " AND id > ?"; params.push(String(options.cursor)); }
  if (options.city) { where += " AND city = ?"; params.push(cleanString(options.city, 120)); }
  if (options.state) { where += " AND state = ?"; params.push(cleanString(options.state, 120)); }
  if (options.featured) { where += " AND featured = 1"; }
  if (options.q) {
    // Search by hotel name, city, state or country. % and _ typed by the guest are matched literally.
    const like = `%${cleanString(String(options.q), 100).replace(/[\\%_]/g, "\\$&")}%`;
    where += " AND (hotel_name LIKE ? OR city LIKE ? OR state LIKE ? OR country LIKE ?)";
    params.push(like, like, like, like);
  }

  const rows = await query(`SELECT * FROM hotels WHERE ${where} ORDER BY id LIMIT ${limit}`, params);

  return {
    items: rows.map(mapHotel),
    nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
  };
}




// Fetch approved hotels by destination and room category.



export async function listHotels(options = {}) {
  const limit = clampInt(options.limit, 1, 500, 24);

  const params = [];
  const category = cleanString(options.category || "", 120);
  const destination = cleanString(options.destination || "", 120);

  let where = "h.approval_status = 'approved'";

  // DESTINATION FILTER
  if (destination) {
    const value = `%${destination}%`;

    where += `
      AND (
        h.city LIKE ?
        OR h.state LIKE ?
        OR h.country LIKE ?
      )
    `;

    params.push(value, value, value);
  }

  // ROOM CATEGORY FILTER
  if (category) {
    where += `
      AND EXISTS (
        SELECT 1
        FROM room_types rt
        WHERE rt.hotel_id = h.id
          AND rt.name = ?
          AND rt.status = 'active'
      )
    `;

    params.push(category);
  }

  // CURSOR FILTER
  if (options.cursor) {
    where += " AND h.id > ?";
    params.push(options.cursor);
  }

  // FEATURED FILTER
  if (options.featured) {
    where += " AND h.featured = 1";
  }

  // SEARCH FILTER
  if (options.q) {
    const search = cleanString(String(options.q), 100);
    const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
    const like = `%${escapedSearch}%`;

    where += `
      AND (
        h.hotel_name LIKE ?
        OR h.city LIKE ?
        OR h.state LIKE ?
        OR h.country LIKE ?
      )
    `;

    params.push(like, like, like, like);
  }

  // PRICE SUBQUERY
  const priceQuery = category
    ? `
        (
          SELECT MIN(rt.base_price)
          FROM room_types rt
          WHERE rt.hotel_id = h.id
            AND rt.status = 'active'
            AND rt.name = ?
        ) AS price
      `
    : `
        (
          SELECT MIN(rt.base_price)
          FROM room_types rt
          WHERE rt.hotel_id = h.id
            AND rt.status = 'active'
        ) AS price
      `;

  // SELECT placeholders come before WHERE placeholders.
  const queryParams = category
    ? [category, ...params]
    : params;

  const rows = await query(
    `
      SELECT
        h.*,
        ${priceQuery}
      FROM hotels h
      WHERE ${where}
      ORDER BY h.id ASC
      LIMIT ${limit}
    `,
    queryParams
  );

  return {
    items: rows.map(mapHotel),
    nextCursor:
      rows.length === limit
        ? rows[rows.length - 1].id
        : null,
  };
}



export async function getHotel(id) {
  if (typeof id !== "string" || !id || id.length > 80) return null;

  let rows = await query("SELECT * FROM hotels WHERE id = ?", [id]);
  // Old numeric ids used in /dashboard/hoteldetails/<n> links.
  if (!rows[0] && /^\d{1,9}$/.test(id)) {
    rows = await query("SELECT * FROM hotels WHERE legacy_id = ? LIMIT 1", [Number(id)]);
  }
  const row = rows[0];
  if (!row) return null;

  if (HIDDEN.includes(row.status)) {
    const user = await getSessionUser();
    if (!user || !(await canManage(user, row.id))) return null;
  }
  return mapHotel(row);
}

// ---------------------------------------------------------------------------
// ADMIN / OWNER MANAGEMENT
// ---------------------------------------------------------------------------

export async function listAdminHotels(filter = {}) {
  await requireRole(ADMIN_ROLES);

  const params = [];
  let where = "1=1";
  if (filter.status) {
    if (!HOTEL_STATUSES.includes(filter.status)) throw new ServiceError("Invalid status.");
    where += " AND status = ?";
    params.push(filter.status);
  }
  const rows = await query(`SELECT * FROM hotels WHERE ${where} ORDER BY created_at DESC LIMIT 2000`, params);
  return rows.map(mapHotel);
}

export async function createHotel(input) {
  const user = await requireRole([...ADMIN_ROLES, ...OWNER_ROLES]);
  const isAdmin = ADMIN_ROLES.includes(user.role);
  const { cols, data } = splitInput(input, isAdmin);

  if (!cols.hotel_name) throw new ServiceError("Hotel name is required.");

  const id = newId();
  const ownerId = isAdmin ? null : user.id;

  await withTransaction(async (connection) => {
    await run(
      connection,
      `INSERT INTO hotels (id, owner_id, hotel_name, category, city, state, country, price,
                           status, approved, featured, verified, cover_image, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, ownerId, cols.hotel_name, cols.category ?? "", cols.city ?? "", cols.state ?? "",
        cols.country ?? "", cols.price ?? 0,
        isAdmin ? cols.status ?? "Pending" : "Pending",
        isAdmin ? cols.approved ?? 0 : 0,
        isAdmin ? cols.featured ?? 0 : 0,
        isAdmin ? cols.verified ?? 0 : 0,
        cols.cover_image ?? "", JSON.stringify(data),
      ]
    );
    await logActivity(connection, user, `Created hotel ${cols.hotel_name}`, "Hotels");
  });

  return { ok: true, id };
}

export async function updateHotel(id, input) {
  const user = await requireUser();
  if (!(await canManage(user, id))) throw new ServiceError("You cannot edit this hotel.", "forbidden");

  const { cols, data } = splitInput(input, ADMIN_ROLES.includes(user.role));

  await withTransaction(async (connection) => {
    const rows = await run(connection, "SELECT data FROM hotels WHERE id = ? FOR UPDATE", [id]);
    if (!rows[0]) throw new ServiceError("Hotel not found.", "not-found");

    const merged = { ...parseJson(rows[0].data), ...data };
    const names = Object.keys(cols);
    const sets = [...names.map((n) => `${n} = ?`), "data = ?"].join(", ");

    await run(connection, `UPDATE hotels SET ${sets} WHERE id = ?`, [
      ...names.map((n) => cols[n]), JSON.stringify(merged), id,
    ]);
  });

  return { ok: true };
}

export async function setHotelStatus(id, status) {
  const user = await requireRole(ADMIN_ROLES);
  if (!HOTEL_STATUSES.includes(status)) throw new ServiceError("Invalid hotel status.");

  await withTransaction(async (connection) => {
    const rows = await run(connection, "SELECT data, hotel_name FROM hotels WHERE id = ? FOR UPDATE", [id]);
    if (!rows[0]) throw new ServiceError("Hotel not found.", "not-found");

    const data = parseJson(rows[0].data);
    if (status === "Approved") data.approvedAt = new Date().toISOString();

    await run(connection, "UPDATE hotels SET status = ?, approved = ?, data = ? WHERE id = ?", [
      status, status === "Approved" ? 1 : 0, JSON.stringify(data), id,
    ]);
    await logActivity(connection, user, `Set hotel ${rows[0].hotel_name} to ${status}`, "Hotels");
  });

  return { ok: true };
}

export async function setHotelFeatured(id, featured) {
  await requireRole(ADMIN_ROLES);
  await query("UPDATE hotels SET featured = ? WHERE id = ?", [featured ? 1 : 0, id]);
  return { ok: true };
}

export async function deleteHotel(id) {
  const user = await requireRole(ADMIN_ROLES);

  try {
    await withTransaction(async (connection) => {
      await run(connection, "DELETE FROM hotels WHERE id = ?", [id]);
      await logActivity(connection, user, `Deleted hotel ${id}`, "Hotels");
    });
  } catch (error) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      throw new ServiceError("This hotel has bookings and cannot be deleted. Set it to inactive instead.");
    }
    throw error;
  }
  return { ok: true };
}
