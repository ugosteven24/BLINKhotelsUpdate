"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query, queryOne, execute, pool } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/guard";

const optNum = (min, max, msg) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(min, msg).max(max, msg).optional());

const typeSchema = z.object({
  hotel_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, "Enter a room type name.").max(120),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  max_adults: z.coerce.number().int().min(1, "At least 1 adult.").max(20),
  max_children: z.coerce.number().int().min(0).max(20).default(0),
  bed_configuration: z.string().trim().max(150).optional().or(z.literal("")),
  room_size_sqm: optNum(0, 99999, "Enter a valid room size."),
  base_price: z.coerce.number().min(0, "Price can't be negative."),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Currency must be 3 letters, e.g. NGN."),
  status: z.enum(["active", "inactive"]),
});

export async function getRoomType(hotelId, id) {
  await requireAdmin();
  const rt = await queryOne(
    `SELECT rt.*, h.hotel_name FROM room_types rt JOIN hotels h ON h.id=rt.hotel_id WHERE rt.id=? AND rt.hotel_id=?`, [id, hotelId]);
  if (!rt) return null;
  const rooms = await query(
    `SELECT r.id, r.room_number, r.floor_number, r.operational_status, r.notes,
            (SELECT COUNT(*) FROM reservation_rooms rr WHERE rr.room_id=r.id) AS bookings
       FROM rooms r WHERE r.room_type_id=? ORDER BY r.room_number`, [id]);
  const amenities = await query(
    "SELECT a.id, a.name FROM room_type_amenities rta JOIN amenities a ON a.id=rta.amenity_id WHERE rta.room_type_id=? ORDER BY a.name", [id]);
  return { roomType: rt, rooms, amenities, amenityIds: amenities.map((a) => a.id) };
}

export async function saveRoomTypeAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id") || 0);
  const p = typeSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const vals = [d.name, d.description || null, d.max_adults, d.max_children, d.bed_configuration || null,
    d.room_size_sqm ?? null, d.base_price, d.currency.toUpperCase(), d.status];
  let rtId = id;
  try {
    if (id) {
      await execute(
        `UPDATE room_types SET name=?, description=?, max_adults=?, max_children=?, bed_configuration=?, room_size_sqm=?,
           base_price=?, currency=?, status=? WHERE id=? AND hotel_id=?`, [...vals, id, d.hotel_id]);
      await audit(s.userId, "room_type.updated", "room_type", id, null, d);
    } else {
      const r = await execute(
        `INSERT INTO room_types (name, description, max_adults, max_children, bed_configuration, room_size_sqm, base_price, currency, status, hotel_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`, [...vals, d.hotel_id]);
      rtId = r.insertId;
      await audit(s.userId, "room_type.created", "room_type", rtId, null, d);
    }
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return { error: "This hotel already has a room type with that name." };
    throw e;
  }
  // Replace the room type's amenities with the ticked ones (only amenities usable for rooms are accepted).
  const wanted = [...new Set(fd.getAll("amenities").map(Number).filter(Boolean))];
  const valid = wanted.length ? (await query("SELECT id FROM amenities WHERE id IN (?) AND amenity_type IN ('room','both')", [wanted])).map((a) => a.id) : [];
  await pool.query("DELETE FROM room_type_amenities WHERE room_type_id=?", [rtId]);
  if (valid.length) await pool.query("INSERT INTO room_type_amenities (room_type_id, amenity_id) VALUES ?", [valid.map((a) => [rtId, a])]);
  revalidatePath(`/admin/hotels/${d.hotel_id}`);
  revalidatePath("/admin/rooms/types");
  redirect(`/admin/hotels/${d.hotel_id}/room-types/${rtId}`);
}

export async function deleteRoomTypeAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const rt = await queryOne("SELECT id, hotel_id, name FROM room_types WHERE id=?", [id]);
  if (!rt) return { error: "That room type no longer exists." };
  const refs = await queryOne(
    `SELECT (SELECT COUNT(*) FROM rooms WHERE room_type_id=?) AS rooms,
            (SELECT COUNT(*) FROM reservation_rooms WHERE room_type_id=?) AS bookings`, [id, id]);
  if (refs.bookings) return { error: "Guests have booked this room type, so it can't be deleted. Set it to Inactive instead." };
  if (refs.rooms) return { error: "Delete this room type's rooms first." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM room_type_amenities WHERE room_type_id=?", [id]);
    await conn.query("DELETE FROM room_rate_rules WHERE room_type_id=?", [id]);
    await conn.query("DELETE FROM room_types WHERE id=?", [id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(s.userId, "room_type.deleted", "room_type", id, { name: rt.name }, null);
  revalidatePath(`/admin/hotels/${rt.hotel_id}`);
  return { success: "Room type deleted." };
}

const roomSchema = z.object({
  hotel_id: z.coerce.number().int().positive(),
  room_type_id: z.coerce.number().int().positive(),
  room_number: z.string().trim().min(1, "Enter a room number.").max(50),
  floor_number: z.string().trim().max(30).optional().or(z.literal("")),
  operational_status: z.enum(["active", "maintenance", "out_of_service"]),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function getRoom(id) {
  await requireAdmin();
  return queryOne("SELECT * FROM rooms WHERE id=?", [id]);
}

export async function saveRoomAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id") || 0);
  const p = roomSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const ok = await queryOne("SELECT id FROM room_types WHERE id=? AND hotel_id=?", [d.room_type_id, d.hotel_id]);
  if (!ok) return { error: "That room type doesn't belong to this hotel." };
  try {
    if (id) {
      await execute("UPDATE rooms SET room_number=?, floor_number=?, operational_status=?, notes=? WHERE id=? AND hotel_id=?",
        [d.room_number, d.floor_number || null, d.operational_status, d.notes || null, id, d.hotel_id]);
      await audit(s.userId, "room.updated", "room", id, null, d);
    } else {
      const r = await execute(
        "INSERT INTO rooms (hotel_id, room_type_id, room_number, floor_number, operational_status, notes) VALUES (?,?,?,?,?,?)",
        [d.hotel_id, d.room_type_id, d.room_number, d.floor_number || null, d.operational_status, d.notes || null]);
      await audit(s.userId, "room.created", "room", r.insertId, null, d);
    }
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return { error: "This hotel already has a room with that number." };
    throw e;
  }
  revalidatePath(`/admin/hotels/${d.hotel_id}/room-types/${d.room_type_id}`);
  revalidatePath("/admin/rooms");
  // Only ever redirect to a fixed, known path (never a user-supplied URL).
  if (fd.get("return_to") === "rooms") redirect("/admin/rooms");
  redirect(`/admin/hotels/${d.hotel_id}/room-types/${d.room_type_id}`);
}

export async function deleteRoomAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const room = await queryOne("SELECT id, hotel_id, room_type_id, room_number FROM rooms WHERE id=?", [id]);
  if (!room) return { error: "That room no longer exists." };
  const used = await queryOne("SELECT COUNT(*) AS c FROM reservation_rooms WHERE room_id=?", [id]);
  if (used.c) return { error: "This room has booking history, so it can't be deleted. Set it to Out of service instead." };
  await execute("DELETE FROM room_blocks WHERE room_id=?", [id]);
  await execute("DELETE FROM rooms WHERE id=?", [id]);
  await audit(s.userId, "room.deleted", "room", id, { room_number: room.room_number }, null);
  revalidatePath(`/admin/hotels/${room.hotel_id}/room-types/${room.room_type_id}`);
  return { success: "Room deleted." };
}
