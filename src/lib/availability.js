// Room availability rules, shared by room.service and booking.service.
// Not a "use server" file.
import { query, run } from "@/lib/db/connection";

// Uses the transaction connection when given, otherwise the pool.
const exec = (connection, sql, params) =>
  connection ? run(connection, sql, params) : query(sql, params);

// A stay covers the nights [check_in, check_out). These statuses hold the room.
export const HOLDING_STATUSES = ["pending", "confirmed", "completed"];

export async function roomIsFree(connection, roomId, checkIn, checkOut, excludeBookingId = null) {
  const rows = await exec(
    connection,
    `SELECT 1 FROM bookings
      WHERE room_id = ?
        AND status IN ('pending','confirmed','completed')
        AND check_in < ? AND check_out > ?
        AND (? IS NULL OR id <> ?)
      LIMIT 1`,
    [roomId, checkOut, checkIn, excludeBookingId, excludeBookingId]
  );
  return rows.length === 0;
}

// Picks the cheapest free room that fits `guests`.
//   lock = true  -> locks every active room of the hotel (SELECT ... FOR UPDATE, in id
//                   order) so two simultaneous requests are serialised. Use inside a
//                   transaction when creating a booking.
//   lock = false -> plain read for availability checks.
// export async function findFreeRoom(connection, { hotelId, checkIn, checkOut, guests, lock }) {
//   const rooms = await exec(
//     connection,
//     `SELECT id, room_number, room_type, price_per_night, capacity
//        FROM rooms
//       WHERE hotel_id = ? AND status = 'active' AND capacity >= ?
//       ORDER BY id ${lock ? "FOR UPDATE" : ""}`,
//     [hotelId, guests]
//   );

//   const free = [];
//   for (const room of rooms) {
//     if (await roomIsFree(connection, room.id, checkIn, checkOut)) free.push(room);
//   }

//   free.sort(
//     (a, b) =>
//       (a.price_per_night ?? Number.MAX_SAFE_INTEGER) -
//       (b.price_per_night ?? Number.MAX_SAFE_INTEGER)
//   );

//   return { totalRooms: rooms.length, freeRooms: free, room: free[0] ?? null };
// }


export async function findFreeRoom(
  connection,
  { hotelId, checkIn, checkOut, guests, lock }
) {
  const rooms = await exec(
    connection,
    `SELECT
        r.id,
        r.hotel_id,
        r.room_number,
        r.room_type_id,
        rt.name AS room_type,
        rt.base_price AS price_per_night,
        rt.max_adults,
        rt.max_children,
        rt.currency
     FROM rooms r
     INNER JOIN room_types rt
        ON rt.id = r.room_type_id
     WHERE r.hotel_id = ?
       AND r.operational_status = 'active'
       AND rt.status = 'active'
       AND rt.hotel_id = r.hotel_id
       AND rt.max_adults >= ?
     ORDER BY r.id
     ${lock ? "FOR UPDATE" : ""}`,
    [hotelId, guests]
  );

  const totalRooms = rooms.length;

  for (const room of rooms) {
    const conflicts = await exec(
      connection,
      `SELECT id
       FROM bookings
       WHERE room_id = ?
         AND booking_status IN ('pending', 'confirmed')
         AND check_in < ?
         AND check_out > ?
       LIMIT 1`,
      [room.id, checkOut, checkIn]
    );

    if (conflicts.length === 0) {
      return { totalRooms, room };
    }
  }

  return { totalRooms, room: null };
}

