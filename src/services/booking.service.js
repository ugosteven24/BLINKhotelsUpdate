"use server";

// Reservations: creation, cancellation, approval, completion.
//
// Integrity rules (enforced here, never only in the browser):
//  * every booking holds ONE physical room;
//  * the room rows of a hotel are locked (SELECT ... FOR UPDATE) while a booking
//    is created or approved, so two simultaneous requests cannot take the same
//    room for overlapping nights;
//  * the price is recomputed on the server from the room / hotel price;
//  * a client may only see and cancel their own bookings.

import { randomBytes } from "node:crypto";
import { query, run, withTransaction } from "@/lib/db/connection";
import { ADMIN_ROLES, requireRole, requireUser } from "@/lib/auth/session";
import { findFreeRoom, roomIsFree } from "@/lib/availability";
import { ensurePayout, getCommissionRate, splitAmount } from "@/lib/finance";
import { mapBooking } from "@/lib/mappers";
import { logActivity, notifyUser } from "@/lib/notify";
import { ServiceError, clampInt, newId, nightsBetween, parseDay, todayUtc, toMoney } from "@/lib/service-utils";
import { cleanString, isValidEmail } from "@/lib/validation";

const MAX_NIGHTS = 60;

const fail = (error) => {
  if (error instanceof ServiceError) return { ok: false, code: error.code, message: error.message };
  throw error; // auth errors and unexpected errors are handled by the caller / Next.js
};

function bookingNumber() {
  return `BK-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// CLIENT
// ---------------------------------------------------------------------------
export async function createBooking(input) {
  const user = await requireUser();

  try {
    const hotelId = cleanString(input?.hotelId, 80);
    const checkIn = input?.checkIn;
    const checkOut = input?.checkOut;
    const guests = clampInt(input?.guests, 1, 20, 1);

    if (!hotelId) throw new ServiceError("Hotel is required.");
    if (!parseDay(checkIn) || !parseDay(checkOut)) throw new ServiceError("Please choose valid dates.");
    if (checkIn < todayUtc()) throw new ServiceError("Check-in cannot be in the past.");
    if (checkOut <= checkIn) throw new ServiceError("Check-out must be after check-in.");

    const nights = nightsBetween(checkIn, checkOut);
    if (nights > MAX_NIGHTS) throw new ServiceError(`Stays are limited to ${MAX_NIGHTS} nights.`);

    const guestName = cleanString(input?.guestName, 200) || user.fullName;
    const guestEmail = cleanString(input?.guestEmail, 255).toLowerCase() || user.email;
    const guestPhone = cleanString(input?.guestPhone, 40) || user.phone || "";
    if (!guestName) throw new ServiceError("Guest name is required.");
    if (!isValidEmail(guestEmail)) throw new ServiceError("Please enter a valid guest email.");

    const booking = await withTransaction(async (connection) => {
      const hotels = await run(
        connection,
        "SELECT * FROM hotels WHERE id = ? AND approval_status NOT IN ('Pending','Rejected','inactive')",
        [hotelId]
      );
      const hotel = hotels[0];
      if (!hotel) throw new ServiceError("This hotel is not available for booking.", "not-found");

      const { totalRooms, room } = await findFreeRoom(connection, { hotelId, checkIn, checkOut, guests, lock: true });
      if (!totalRooms) throw new ServiceError("This hotel is not accepting reservations yet (no rooms set up).", "no-rooms");
      if (!room) throw new ServiceError("No room is available for those dates. Please choose other dates.", "unavailable");

      const unit = toMoney(room.price_per_night ?? hotel.price);
      if (!(unit > 0)) throw new ServiceError("This room has no price set.", "no-price");
      const total = toMoney(unit * nights);

      const id = newId();
      const number = bookingNumber();

      await run(
        connection,
        `INSERT INTO bookings
           (id, booking_number, user_id, hotel_id, room_id, guest_name, guest_email, guest_phone,
            hotel_name, hotel_image, room_type, city, country, check_in, check_out, nights, guests,
            price_per_night, total_amount, special_requests)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, number, user.id, hotelId, room.id, guestName, guestEmail, guestPhone,
          hotel.hotel_name, hotel.cover_image, room.room_type, hotel.city, hotel.country,
          checkIn, checkOut, nights, guests, unit, total,
          cleanString(input?.specialRequests, 2000),
        ]
      );

      await notifyUser(connection, user.id, {
        title: "Booking received",
        message: `Your booking ${number} at ${hotel.hotel_name} is waiting for approval.`,
        category: "booking",
        icon: "event",
        actionUrl: "/mybooking",
      });

      const rows = await run(connection, "SELECT * FROM bookings WHERE id = ?", [id]);
      return mapBooking(rows[0]);
    });

    return { ok: true, booking };
  } catch (error) {
    return fail(error);
  }
}

export async function listMyBookings() {
  const user = await requireUser();
  const rows = await query("SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC", [user.id]);
  return rows.map(mapBooking);
}

// Shared by the client (own booking) and admin cancellation.
async function cancelInTransaction(connection, bookingId, { requireOwner = null } = {}) {
  const rows = await run(connection, "SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
  const b = rows[0];
  if (!b || (requireOwner && b.user_id !== requireOwner)) throw new ServiceError("Booking not found.", "not-found");
  if (!["pending", "confirmed"].includes(b.status)) {
    throw new ServiceError("This booking can no longer be cancelled.", "invalid-state");
  }

  const paid = b.payment_status === "paid";
  await run(
    connection,
    `UPDATE bookings
        SET status = 'cancelled', payment_status = ?,
            commission_rate = NULL, commission_amount = NULL, owner_amount = NULL
      WHERE id = ?`,
    [paid ? "refund_pending" : b.payment_status, bookingId]
  );

  if (paid) {
    await run(
      connection,
      `INSERT IGNORE INTO refunds (id, booking_id, amount, reason) VALUES (?, ?, ?, 'Booking cancelled')`,
      [newId(), bookingId, b.total_amount]
    );
  }
  await run(connection, "DELETE FROM payouts WHERE booking_id = ? AND status = 'Pending'", [bookingId]);

  await notifyUser(connection, b.user_id, {
    title: "Booking cancelled",
    message: `Booking ${b.booking_number} has been cancelled.${paid ? " A refund request was opened." : ""}`,
    category: "booking",
    icon: "event_busy",
  });
  return b;
}

export async function cancelMyBooking(bookingId) {
  const user = await requireUser();
  try {
    await withTransaction((connection) => cancelInTransaction(connection, bookingId, { requireOwner: user.id }));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
const STATUSES = ["pending", "confirmed", "cancelled", "rejected", "completed"];

export async function listBookings(filter = {}) {
  await requireRole(ADMIN_ROLES);

  const params = [];
  let where = "1=1";
  if (filter.status) {
    const status = String(filter.status).toLowerCase();
    if (!STATUSES.includes(status)) throw new ServiceError("Invalid status.");
    where += " AND b.status = ?";
    params.push(status);
  }
  if (filter.paymentStatus) {
    where += " AND b.payment_status = ?";
    params.push(String(filter.paymentStatus));
  }

  const rows = await query(
    `SELECT b.*, r.room_number FROM bookings b
       LEFT JOIN rooms r ON r.id = b.room_id
      WHERE ${where} ORDER BY b.created_at DESC LIMIT 2000`,
    params
  );
  return rows.map(mapBooking);
}

export async function approveBooking(bookingId) {
  const admin = await requireRole(ADMIN_ROLES);
  try {
    await withTransaction(async (connection) => {
      const rows = await run(connection, "SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
      const b = rows[0];
      if (!b) throw new ServiceError("Booking not found.", "not-found");
      if (b.status !== "pending") throw new ServiceError("Only pending bookings can be approved.", "invalid-state");

      // Lock the room row, then make sure no OTHER stay overlaps these nights.
      await run(connection, "SELECT id FROM rooms WHERE id = ? FOR UPDATE", [b.room_id]);
      if (!(await roomIsFree(connection, b.room_id, b.check_in, b.check_out, b.id))) {
        throw new ServiceError("Another reservation already holds this room for those dates.", "unavailable");
      }

      const rate = await getCommissionRate();
      const { commission, owner } = splitAmount(Number(b.total_amount), rate);

      await run(
        connection,
        `UPDATE bookings SET status = 'confirmed', commission_rate = ?, commission_amount = ?, owner_amount = ? WHERE id = ?`,
        [rate, commission, owner, b.id]
      );
      await notifyUser(connection, b.user_id, {
        title: "Booking confirmed",
        message: `Booking ${b.booking_number} at ${b.hotel_name} is confirmed.`,
        category: "booking",
        icon: "event_available",
        actionUrl: "/dashboard/mybooking",
      });
      await logActivity(connection, admin, `Approved booking ${b.booking_number}`, "Bookings");
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function rejectBooking(bookingId) {
  const admin = await requireRole(ADMIN_ROLES);
  try {
    await withTransaction(async (connection) => {
      const rows = await run(connection, "SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
      const b = rows[0];
      if (!b) throw new ServiceError("Booking not found.", "not-found");
      if (b.status !== "pending") throw new ServiceError("Only pending bookings can be rejected.", "invalid-state");

      await run(connection, "UPDATE bookings SET status = 'rejected' WHERE id = ?", [b.id]);
      await notifyUser(connection, b.user_id, {
        title: "Booking declined",
        message: `Booking ${b.booking_number} could not be confirmed.`,
        category: "booking",
        icon: "event_busy",
      });
      await logActivity(connection, admin, `Rejected booking ${b.booking_number}`, "Bookings");
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function adminCancelBooking(bookingId) {
  const admin = await requireRole(ADMIN_ROLES);
  try {
    await withTransaction(async (connection) => {
      const b = await cancelInTransaction(connection, bookingId);
      await logActivity(connection, admin, `Cancelled booking ${b.booking_number}`, "Bookings");
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// Marks a stay as finished. Only after the check-out day; opens the owner payout
// when the booking has also been paid.
export async function completeBooking(bookingId) {
  const admin = await requireRole(ADMIN_ROLES);
  try {
    await withTransaction(async (connection) => {
      const rows = await run(connection, "SELECT * FROM bookings WHERE id = ? FOR UPDATE", [bookingId]);
      const b = rows[0];
      if (!b) throw new ServiceError("Booking not found.", "not-found");
      if (b.status !== "confirmed") throw new ServiceError("Only confirmed bookings can be completed.", "invalid-state");
      if (b.check_out > todayUtc()) throw new ServiceError("The stay has not finished yet.", "too-early");

      await run(connection, "UPDATE bookings SET status = 'completed' WHERE id = ?", [b.id]);
      await ensurePayout(connection, b.id);
      await notifyUser(connection, b.user_id, {
        title: "Stay completed",
        message: `Thank you for staying at ${b.hotel_name}. You can now leave a review.`,
        category: "booking",
        icon: "rate_review",
      });
      await logActivity(connection, admin, `Completed booking ${b.booking_number}`, "Bookings");
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
