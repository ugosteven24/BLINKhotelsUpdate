"use server";

// Physical room inventory and availability.

import { query } from "@/lib/db/connection";
import { ADMIN_ROLES, ROLES, requireUser } from "@/lib/auth/session";
import { findFreeRoom } from "@/lib/availability";
import { ServiceError, clampInt, newId, nightsBetween, parseDay, todayUtc, toMoney } from "@/lib/service-utils";
import { cleanString } from "@/lib/validation";

const ROOM_STATUSES = ["active", "maintenance", "inactive"];

async function assertCanManageHotel(hotelId) {
  const user = await requireUser();
  if (ADMIN_ROLES.includes(user.role)) return user;

  if ([ROLES.HOTEL_OWNER, ROLES.STAFF].includes(user.role)) {
    const rows = await query("SELECT 1 FROM hotels WHERE id = ? AND owner_id = ?", [hotelId, user.id]);
    if (rows.length) return user;
  }
  throw new ServiceError("You cannot manage this hotel's rooms.", "forbidden");
}

const mapRoom = (r) => ({
  id: r.id,
  hotelId: r.hotel_id,
  roomNumber: r.room_number,
  roomType: r.room_type,
  pricePerNight: r.price_per_night == null ? null : Number(r.price_per_night),
  capacity: r.capacity,
  status: r.status,
});

export async function listRooms(hotelId) {
  await assertCanManageHotel(hotelId);
  const rows = await query("SELECT * FROM rooms WHERE hotel_id = ? ORDER BY room_number", [hotelId]);
  return rows.map(mapRoom);
}

function readRoomInput(input) {
  const roomNumber = cleanString(input?.roomNumber, 30);
  if (!roomNumber) throw new ServiceError("Room number is required.");

  const status = input?.status ?? "active";
  if (!ROOM_STATUSES.includes(status)) throw new ServiceError("Invalid room status.");

  const price = input?.pricePerNight === "" || input?.pricePerNight == null ? null : toMoney(input.pricePerNight);
  return {
    roomNumber,
    roomType: cleanString(input?.roomType, 100) || "Standard",
    price,
    capacity: clampInt(input?.capacity, 1, 20, 2),
    status,
  };
}

export async function createRoom(hotelId, input) {
  await assertCanManageHotel(hotelId);
  const r = readRoomInput(input);
  const id = newId();

  try {
    await query(
      `INSERT INTO rooms (id, hotel_id, room_number, room_type, price_per_night, capacity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, hotelId, r.roomNumber, r.roomType, r.price, r.capacity, r.status]
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw new ServiceError("That room number already exists for this hotel.");
    throw error;
  }
  return { ok: true, id };
}

export async function updateRoom(roomId, input) {
  const rows = await query("SELECT hotel_id FROM rooms WHERE id = ?", [roomId]);
  if (!rows[0]) throw new ServiceError("Room not found.", "not-found");
  await assertCanManageHotel(rows[0].hotel_id);

  const r = readRoomInput(input);
  try {
    await query(
      `UPDATE rooms SET room_number = ?, room_type = ?, price_per_night = ?, capacity = ?, status = ? WHERE id = ?`,
      [r.roomNumber, r.roomType, r.price, r.capacity, r.status, roomId]
    );
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") throw new ServiceError("That room number already exists for this hotel.");
    throw error;
  }
  return { ok: true };
}

export async function deleteRoom(roomId) {
  const rows = await query("SELECT hotel_id FROM rooms WHERE id = ?", [roomId]);
  if (!rows[0]) throw new ServiceError("Room not found.", "not-found");
  await assertCanManageHotel(rows[0].hotel_id);

  try {
    await query("DELETE FROM rooms WHERE id = ?", [roomId]);
  } catch (error) {
    if (error?.code === "ER_ROW_IS_REFERENCED_2") {
      throw new ServiceError("This room has bookings. Set it to inactive instead of deleting it.");
    }
    throw error;
  }
  return { ok: true };
}

// Public read-only check shown before booking. The binding check happens again
// inside the booking transaction.
export async function checkAvailability({ hotelId, checkIn, checkOut, guests = 1 } = {}) {
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (!a || !b || checkOut <= checkIn || checkIn < todayUtc()) {
    return { available: false, message: "Choose valid check-in and check-out dates." };
  }

  const { totalRooms, freeRooms, room } = await findFreeRoom(null, {
    hotelId: String(hotelId ?? ""),
    checkIn,
    checkOut,
    guests: clampInt(guests, 1, 20, 1),
    lock: false,
  });

  return {
    available: !!room,
    roomsLeft: freeRooms.length,
    hasRooms: totalRooms > 0,
    nights: nightsBetween(checkIn, checkOut),
  };
}






// In room.service.js: delete the old createSlug + getRoomCategories block
// (everything after checkAvailability) and paste this in its place.
// No new imports needed: `query` is already imported at the top of the file.

// room.service.js: replace the previous getRoomCategories (and createSlug) with this.
// `query` is already imported at the top of that file.

function createSlug(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Escape LIKE wildcards so "%" or "_" in the destination can't match everything.
const likeTerm = (s) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;

// Room types treated as the platform's "standard" categories. Anything else a
// hotel types into rooms.room_type is shown as a "Hotel Specialty".
// Edit this list, or later move the flag into a room_types table.
const STANDARD_TYPES = new Set([
  "standard", "deluxe", "executive", "presidential suite", "family suite", "suite","Deluxe King"
]);

export async function getRoomCategorie(destination = "") {
  const search = String(destination ?? "").trim().slice(0, 100);
  const term = search ? likeTerm(search) : null;
  const p = search ? [term, term, term] : [];

  const hotelFilter = search ? `AND (h.city LIKE ? OR h.state LIKE ? OR h.country LIKE ?)` : "";
  const hotelFilterInner = search ? `AND (h2.city LIKE ? OR h2.state LIKE ? OR h2.country LIKE ?)` : "";

  // Placeholder order follows the SQL text: image subquery first, then the derived table.
  const rows = await query(
    `
    SELECT
      c.name, c.rooms, c.hotels, c.minPrice, c.maxCapacity,
      (
        SELECT h2.cover_image
        FROM hotels h2
        INNER JOIN rooms r2 ON r2.hotel_id = h2.id
        WHERE TRIM(r2.room_type) = c.name
          AND r2.status = 'active'
          AND h2.approved = 1
          AND LOWER(h2.status) = 'approved'
          AND h2.cover_image <> ''
          ${hotelFilterInner}
        ORDER BY h2.created_at DESC
        LIMIT 1
      ) AS image
    FROM (
      SELECT
        TRIM(r.room_type) AS name,
        COUNT(r.id) AS rooms,
        COUNT(DISTINCT h.id) AS hotels,
        MIN(COALESCE(r.price_per_night, h.price)) AS minPrice,
        MAX(r.capacity) AS maxCapacity
      FROM rooms r
      INNER JOIN hotels h ON h.id = r.hotel_id
      WHERE r.status = 'active'
        AND h.approved = 1
        AND LOWER(h.status) = 'approved'
        AND TRIM(r.room_type) <> ''
        ${hotelFilter}
      GROUP BY TRIM(r.room_type)
    ) c
    ORDER BY c.name ASC
    `,
    [...p, ...p]
  );

  const categories = rows.map((row) => ({
    id: row.name,
    name: row.name,
    slug: createSlug(row.name),
    hotels: Number(row.hotels),
    rooms: Number(row.rooms),
    minPrice: row.minPrice == null ? null : Number(row.minPrice),
    maxCapacity: Number(row.maxCapacity || 0),
    image: row.image || null,
    type: STANDARD_TYPES.has(row.name.toLowerCase()) ? "global" : "custom",
  }));

  const summaryRows = await query(
    `
    SELECT COUNT(DISTINCT h.id) AS totalHotels, COUNT(r.id) AS totalRooms
    FROM hotels h
    LEFT JOIN rooms r ON r.hotel_id = h.id AND r.status = 'active'
    WHERE h.approved = 1 AND LOWER(h.status) = 'approved'
      ${hotelFilter}
    `,
    p
  );

  return {
    categories,
    summary: {
      totalHotels: Number(summaryRows[0]?.totalHotels || 0),
      totalRooms: Number(summaryRows[0]?.totalRooms || 0),
    },
  };
}





/**
 * Get room categories across approved hotels.
 *
 * @param {string} destination - City, state, or country
 */



export async function getRoomCategories(destination = "") {
  const params = [];
  let destinationCondition = "";

  if (destination.trim()) {
    const searchValue = `%${destination.trim()}%`;

    destinationCondition = `
      AND (
        h.city LIKE ?
        OR h.state LIKE ?
        OR h.country LIKE ?
      )
    `;

    params.push(searchValue, searchValue, searchValue);
  }

  const categoriesSql = `
    SELECT
      MIN(rt.id) AS id,
      rt.name AS name,

      MIN(rt.base_price) AS minPrice,

      MAX(
        COALESCE(rt.max_adults, 0) +
        COALESCE(rt.max_children, 0)
      ) AS maxCapacity,

      COUNT(DISTINCT h.id) AS hotels,
      COUNT(DISTINCT r.id) AS rooms,

      (
        SELECT hi.image_path
        FROM hotel_images hi
        WHERE hi.hotel_id = h.id
        ORDER BY
          hi.is_cover DESC,
          hi.sort_order ASC,
          hi.id ASC
        LIMIT 1
      ) AS image

    FROM room_types rt

    INNER JOIN hotels h
      ON h.id = rt.hotel_id

    LEFT JOIN rooms r
      ON r.room_type_id = rt.id
      AND r.hotel_id = h.id
      AND r.operational_status = 'active'

    WHERE
      rt.status = 'active'
      AND h.approval_status = 'approved'
      ${destinationCondition}

    GROUP BY rt.name

    ORDER BY hotels DESC, rooms DESC, rt.name ASC
  `;

  const summarySql = `
    SELECT
      COUNT(DISTINCT h.id) AS totalHotels,
      COUNT(DISTINCT r.id) AS totalRooms

    FROM hotels h

    INNER JOIN room_types rt
      ON rt.hotel_id = h.id
      AND rt.status = 'active'

    LEFT JOIN rooms r
      ON r.room_type_id = rt.id
      AND r.hotel_id = h.id
      AND r.operational_status = 'active'

    WHERE
      h.approval_status = 'approved'
      ${destinationCondition}
  `;

  const [categories, summaryRows] = await Promise.all([
    query(categoriesSql, params),
    query(summarySql, params),
  ]);

  const summary = summaryRows[0] || {};

  return {
    categories: categories.map((category) => ({
      id: Number(category.id),
      name: category.name,
      minPrice: Number(category.minPrice || 0),
      maxCapacity: Number(category.maxCapacity || 0),
      hotels: Number(category.hotels || 0),
      rooms: Number(category.rooms || 0),
      image: category.image || null,
    })),

    summary: {
      totalHotels: Number(summary.totalHotels || 0),
      totalRooms: Number(summary.totalRooms || 0),
    },
  };
}

