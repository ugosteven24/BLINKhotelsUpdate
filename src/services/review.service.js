"use server";

// Verified customer reviews: only a guest with a COMPLETED booking can review it,
// once per booking. Moderation is done by administrators.

import { query, run, withTransaction } from "@/lib/db/connection";
import { ADMIN_ROLES, requireRole, requireUser } from "@/lib/auth/session";
import { iso } from "@/lib/doc";
import { ServiceError, clampInt, newId } from "@/lib/service-utils";
import { cleanString } from "@/lib/validation";

const STATUSES = ["Pending", "Approved", "Rejected", "Resolved", "Dismissed", "Hidden", "Removed"];

const fail = (e) => {
  if (e instanceof ServiceError) return { ok: false, code: e.code, message: e.message };
  if (e?.code === "ER_DUP_ENTRY") return { ok: false, code: "duplicate", message: "Already submitted." };
  throw e;
};

export async function createReview({ bookingId, rating, review } = {}) {
  const user = await requireUser();
  try {
    const stars = clampInt(rating, 1, 5, 0);
    const text = cleanString(review, 4000);
    if (!stars) throw new ServiceError("Please choose a rating from 1 to 5.");
    if (text.length < 3) throw new ServiceError("Please write a short review.");

    await withTransaction(async (connection) => {
      const rows = await run(connection, "SELECT * FROM bookings WHERE id = ? AND user_id = ? FOR UPDATE", [bookingId, user.id]);
      const b = rows[0];
      if (!b || b.status !== "completed") throw new ServiceError("You can only review a completed stay.", "not-verified");
      await run(
        connection,
        `INSERT INTO hotel_reviews (id, hotel_id, user_id, booking_id, rating, review) VALUES (?, ?, ?, ?, ?, ?)`,
        [newId(), b.hotel_id, user.id, b.id, stars, text]
      );
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reportReview({ reviewId, reason } = {}) {
  const user = await requireUser();
  try {
    await query(`INSERT INTO review_reports (id, review_id, reporter_id, reason) VALUES (?, ?, ?, ?)`, [
      newId(), reviewId, user.id, cleanString(reason, 500),
    ]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Approved reviews of a hotel (public).
export async function listHotelReviews(hotelId) {
  const rows = await query(
    `SELECT r.id, r.rating, r.review, r.created_at, u.full_name, u.photo_url
       FROM hotel_reviews r JOIN users u ON u.id = r.user_id
      WHERE r.hotel_id = ? AND r.status = 'Approved' ORDER BY r.created_at DESC LIMIT 200`,
    [String(hotelId)]
  );
  return rows.map((r) => ({
    id: r.id, rating: r.rating, review: r.review, userName: r.full_name,
    userImage: r.photo_url, createdAt: iso(r.created_at), verified: true,
  }));
}

const SELECT_REVIEW = `
  SELECT r.id, r.rating, r.review, r.status, r.created_at,
         h.hotel_name, h.cover_image, h.city, h.country,
         u.full_name, u.email, u.photo_url`;

const mapReview = (r) => ({
  id: r.id,
  hotelName: r.hotel_name,
  hotelImage: r.cover_image,
  location: [r.city, r.country].filter(Boolean).join(", "),
  userName: r.full_name,
  userEmail: r.email,
  userImage: r.photo_url,
  rating: r.rating,
  review: r.review,
  status: r.status,
  createdAt: iso(r.created_at),
});

export async function listReviews() {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `${SELECT_REVIEW} FROM hotel_reviews r JOIN hotels h ON h.id = r.hotel_id JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC LIMIT 2000`
  );
  return rows.map(mapReview);
}

export async function setReviewStatus(id, status) {
  await requireRole(ADMIN_ROLES);
  if (!STATUSES.includes(status)) throw new ServiceError("Invalid status.");
  await query("UPDATE hotel_reviews SET status = ? WHERE id = ?", [status, id]);
  return { ok: true };
}

export async function deleteReview(id) {
  await requireRole(ADMIN_ROLES);
  await query("DELETE FROM hotel_reviews WHERE id = ?", [id]);
  return { ok: true };
}

export async function listReportedReviews() {
  await requireRole(ADMIN_ROLES);
  const rows = await query(
    `${SELECT_REVIEW}, rp.id AS report_id, rp.reason, rp.status AS report_status,
            rp.created_at AS reported_at,
            (SELECT COUNT(*) FROM review_reports x WHERE x.review_id = r.id) AS reported_count
       FROM review_reports rp
       JOIN hotel_reviews r ON r.id = rp.review_id
       JOIN hotels h ON h.id = r.hotel_id
       JOIN users u ON u.id = r.user_id
      ORDER BY rp.created_at DESC LIMIT 2000`
  );
  return rows.map((r) => ({
    ...mapReview(r),
    id: r.report_id,
    reviewId: r.id,
    status: r.report_status,
    reportReason: r.reason,
    reportedCount: Number(r.reported_count),
    createdAt: iso(r.reported_at),
  }));
}

export async function setReportStatus(reportId, status) {
  await requireRole(ADMIN_ROLES);
  if (!STATUSES.includes(status)) throw new ServiceError("Invalid status.");
  await query("UPDATE review_reports SET status = ? WHERE id = ?", [status, reportId]);
  return { ok: true };
}

export async function deleteReport(reportId) {
  await requireRole(ADMIN_ROLES);
  await query("DELETE FROM review_reports WHERE id = ?", [reportId]);
  return { ok: true };
}
