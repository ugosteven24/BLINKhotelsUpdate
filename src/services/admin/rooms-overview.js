"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";
import { withTx, row, BizError } from "@/lib/tx";

// A reservation holds a physical room while it is awaiting approval, approved or checked in, or while an
// UNPAID hold is still inside its hold window. Expired / rejected / cancelled / completed never hold a room.
const HOLDS = `(rs.status IN ('pending_approval','approved','checked_in') OR (rs.status='pending_payment' AND rs.hold_expires_at > NOW()))`;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const fail = (e) => ({ error: e instanceof BizError ? e.message : "Something went wrong. Please try again." });

export async function listRoomsAdmin(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.hotel) { where.push("rm.hotel_id=?"); args.push(Number(p.hotel)); }
  if (p.type) { where.push("rm.room_type_id=?"); args.push(Number(p.type)); }
  if (p.status) { where.push("rm.operational_status=?"); args.push(p.status); }
  if (p.q) { where.push("(rm.room_number LIKE ? OR h.hotel_name LIKE ? OR rt.name LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`, `%${p.q}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM rooms rm JOIN hotels h ON h.id=rm.hotel_id JOIN room_types rt ON rt.id=rm.room_type_id ${w}`;
  const rows = await query(
    `SELECT rm.id, rm.hotel_id, rm.room_type_id, rm.room_number, rm.floor_number, rm.operational_status, h.hotel_name, rt.name AS type_name,
            EXISTS (SELECT 1 FROM reservation_rooms rr JOIN reservations rs ON rs.id=rr.reservation_id
                     WHERE rr.room_id=rm.id AND ${HOLDS} AND rs.check_in <= CURDATE() AND rs.check_out > CURDATE()) AS booked_today,
            EXISTS (SELECT 1 FROM room_blocks b WHERE b.room_id=rm.id AND b.status='active' AND b.start_date <= CURDATE() AND b.end_date > CURDATE()) AS blocked_today
       ${base} ORDER BY h.hotel_name, rm.room_number LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function listRoomTypeOptions(hotelId) {
  await requireAdmin();
  return query(`SELECT id, name, hotel_id FROM room_types ${hotelId ? "WHERE hotel_id=?" : ""} ORDER BY name`, hotelId ? [Number(hotelId)] : []);
}

export async function listRoomAmenityOptions() {
  await requireAdmin();
  return query("SELECT id, name FROM amenities WHERE amenity_type IN ('room','both') ORDER BY name");
}

// Every hotel, whatever its approval status - a room type can be prepared before a hotel goes live.
export async function listAllHotelOptions() {
  await requireAdmin();
  return query("SELECT id, hotel_name FROM hotels ORDER BY hotel_name");
}

// Hotels that already have a room type (a room must belong to one), plus every room type for the dependent dropdown.
export async function listRoomFormOptions() {
  await requireAdmin();
  const [hotels, types] = await Promise.all([
    query(`SELECT h.id, h.hotel_name FROM hotels h WHERE EXISTS (SELECT 1 FROM room_types rt WHERE rt.hotel_id=h.id) ORDER BY h.hotel_name`),
    query(`SELECT id, hotel_id, name, status FROM room_types ORDER BY name`),
  ]);
  return { hotels, types };
}

export async function getRoomDetail(id) {
  await requireAdmin();
  const room = await queryOne(
    `SELECT rm.*, h.hotel_name, rt.name AS type_name FROM rooms rm JOIN hotels h ON h.id=rm.hotel_id JOIN room_types rt ON rt.id=rm.room_type_id WHERE rm.id=?`, [id]);
  if (!room) return null;
  const [blocks, upcoming] = await Promise.all([
    query(`SELECT b.id, b.start_date, b.end_date, b.reason, b.notes, b.status, b.released_at, CONCAT(u.first_name,' ',u.last_name) AS created_by_name
             FROM room_blocks b LEFT JOIN users u ON u.id=b.created_by WHERE b.room_id=? ORDER BY (b.status='active') DESC, b.start_date DESC LIMIT 50`, [id]),
    query(`SELECT rs.id, rs.reservation_code, rs.check_in, rs.check_out, rs.status FROM reservation_rooms rr JOIN reservations rs ON rs.id=rr.reservation_id
            WHERE rr.room_id=? AND ${HOLDS} AND rs.check_out > CURDATE() ORDER BY rs.check_in`, [id]),
  ]);
  return { room, blocks, upcoming };
}

export async function createBlockAction(fd) {
  const s = await requireAdmin();
  const roomId = Number(fd.get("room_id"));
  const start = String(fd.get("start_date")), end = String(fd.get("end_date"));
  const reason = String(fd.get("reason"));
  if (!isDay(start) || !isDay(end) || end <= start) return { error: "Choose valid dates; the end date (the day the room returns to service) must be after the start date." };
  if (!["maintenance", "owner_use", "renovation", "other"].includes(reason)) return { error: "Choose a reason." };
  const notes = String(fd.get("notes") ?? "").trim().slice(0, 500) || null;
  let info;
  try {
    info = await withTx(async (conn) => {
      // Same lock a booking takes first (the room row), so a block and a booking can never both win the same nights.
      const room = await row(conn, "SELECT id, hotel_id, room_number FROM rooms WHERE id=? FOR UPDATE", [roomId]);
      if (!room) throw new BizError("Room not found.");
      const clash = await row(conn,
        `SELECT rs.reservation_code FROM reservation_rooms rr JOIN reservations rs ON rs.id=rr.reservation_id
          WHERE rr.room_id=? AND ${HOLDS} AND rs.check_in < ? AND rs.check_out > ? LIMIT 1`, [roomId, end, start]);
      if (clash) throw new BizError(`Reservation ${clash.reservation_code} already holds this room during those dates.`);
      const [res] = await conn.execute("INSERT INTO room_blocks (hotel_id, room_id, start_date, end_date, reason, notes, created_by) VALUES (?,?,?,?,?,?,?)",
        [room.hotel_id, roomId, start, end, reason, notes, s.userId]);
      return { id: res.insertId, number: room.room_number };
    });
  } catch (e) { return fail(e); }
  await audit(s.userId, "room.block_created", "room", roomId, null, { block_id: info.id, start, end, reason });
  revalidatePath(`/admin/rooms/${roomId}`);
  return { success: "Dates blocked." };
}

export async function releaseBlockAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const b = await queryOne("SELECT id, room_id, status FROM room_blocks WHERE id=?", [id]);
  if (!b || b.status !== "active") return { error: "That block is not active." };
  await execute("UPDATE room_blocks SET status='released', released_by=?, released_at=NOW() WHERE id=? AND status='active'", [s.userId, id]);
  await audit(s.userId, "room.block_released", "room", b.room_id, { block_id: id, status: "active" }, { status: "released" });
  revalidatePath(`/admin/rooms/${b.room_id}`);
  return { success: "Block released." };
}

export async function listRoomTypesAdmin(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.hotel) { where.push("rt.hotel_id=?"); args.push(Number(p.hotel)); }
  if (p.status) { where.push("rt.status=?"); args.push(p.status); }
  if (p.q) { where.push("(rt.name LIKE ? OR h.hotel_name LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM room_types rt JOIN hotels h ON h.id=rt.hotel_id ${w}`;
  const rows = await query(
    `SELECT rt.id, rt.hotel_id, rt.name, rt.max_adults, rt.max_children, rt.base_price, rt.currency, rt.status, h.hotel_name,
            (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id=rt.id) AS rooms,
            (SELECT COUNT(*) FROM room_rate_rules x WHERE x.room_type_id=rt.id AND x.end_date >= CURDATE()) AS active_rules
       ${base} ORDER BY h.hotel_name, rt.name LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c ${base}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getRoomTypeRates(id) {
  await requireAdmin();
  const type = await queryOne("SELECT rt.id, rt.hotel_id, rt.name, rt.base_price, rt.currency, h.hotel_name FROM room_types rt JOIN hotels h ON h.id=rt.hotel_id WHERE rt.id=?", [id]);
  if (!type) return null;
  const rules = await query("SELECT id, start_date, end_date, nightly_rate, currency, priority FROM room_rate_rules WHERE room_type_id=? ORDER BY start_date DESC, priority DESC", [id]);
  return { type, rules };
}

// A rule prices every night from start_date up to (not including) end_date. Highest priority wins on overlap.
// Existing reservations keep their own nightly prices (stored in reservation_room_nights), so editing rates is safe.
export async function saveRateRuleAction(fd) {
  const s = await requireAdmin();
  const typeId = Number(fd.get("room_type_id"));
  const start = String(fd.get("start_date")), end = String(fd.get("end_date"));
  const rate = Number(fd.get("nightly_rate"));
  const priority = Math.trunc(Number(fd.get("priority") || 0));
  if (!isDay(start) || !isDay(end) || end <= start) return { error: "The end date must be after the start date." };
  if (!Number.isFinite(rate) || rate < 0) return { error: "Enter a valid nightly rate." };
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) return { error: "Priority must be between 0 and 1000." };
  const t = await queryOne("SELECT id, currency FROM room_types WHERE id=?", [typeId]);
  if (!t) return { error: "Room type not found." };
  const res = await execute("INSERT INTO room_rate_rules (room_type_id, start_date, end_date, nightly_rate, currency, priority) VALUES (?,?,?,?,?,?)",
    [typeId, start, end, rate.toFixed(2), t.currency, priority]);
  await audit(s.userId, "room_type.rate_rule_added", "room_type", typeId, null, { rule_id: res.insertId, start, end, rate, priority });
  revalidatePath(`/admin/rooms/types/${typeId}`);
  return { success: "Rate rule added." };
}

export async function deleteRateRuleAction(id) {
  const s = await requireAdmin();
  const r = await queryOne("SELECT id, room_type_id, start_date, end_date, nightly_rate FROM room_rate_rules WHERE id=?", [Number(id)]);
  if (!r) return { error: "That rule no longer exists." };
  await execute("DELETE FROM room_rate_rules WHERE id=?", [r.id]);
  await audit(s.userId, "room_type.rate_rule_deleted", "room_type", r.room_type_id, r, null);
  revalidatePath(`/admin/rooms/types/${r.room_type_id}`);
  return { success: "Rate rule removed." };
}
