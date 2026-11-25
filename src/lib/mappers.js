// Row -> object mappers. They return the SAME camelCase shapes the old
// the old documents had, so the existing UI keeps working. Timestamps are
// ISO strings; money is a number. Never include password hashes.
import { iso, parseJson } from "@/lib/doc";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const PAYMENT_LABELS = { unpaid: "Unpaid", paid: "Paid", refund_pending: "Refund Requested", refunded: "Refunded" };

export function mapHotels(row) {
  const data = parseJson(row.data);
  return {
    ...data,
    id: row.id,
    ...(row.legacy_id != null ? { legacyId: row.legacy_id } : {}),
    ownerId: row.owner_id ?? null,
    hotelName: row.hotel_name,
    category: row.category,
    city: row.city,
    state: row.state,
    country: row.country,
    price: Number(row.price),
    status: row.status,
    approved: !!row.approved,
    featured: !!row.featured,
    verified: !!row.verified,
    coverImage: row.cover_image,
    // hotels.star_rating is decimal(2,1), e.g. 4.5. (Older rows kept a "starRating" inside the JSON `data` column.)
    starRating: row.star_rating != null ? Number(row.star_rating) : data.starRating,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
export function mapHotel(row) {
  const data = parseJson(row.data) || {};

  return {
    ...data,

    id: String(row.id),

    ...(row.legacy_id != null
      ? { legacyId: row.legacy_id }
      : {}),

    ownerId: row.owner_id ?? null,

    hotelName: row.hotel_name || "Unnamed hotel",

    category: row.category || "",

    city: row.city || "",
    state: row.state || "",
    country: row.country || "",

    price: Number(row.price) || 0,

    // Use the actual database approval column.
    status: row.approval_status || "",

    approved: row.approval_status === "approved",

    featured:
      row.featured === 1 ||
      row.featured === true,

    verified:
      row.verified === 1 ||
      row.verified === true,

    coverImage: row.cover_image || "",

    starRating:
      row.star_rating != null
        ? Number(row.star_rating)
        : Number(data.starRating) || 0,

    reviewCount:
      Number(row.review_count ?? data.reviewCount) || 0,

    amenities:
      Array.isArray(data.amenities)
        ? data.amenities
        : [],

    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapBooking(row) {
  return {
    id: row.id,
    bookingNumber: row.booking_number,
    bookingId: row.booking_number,
    userId: row.user_id,
    hotelId: row.hotel_id,
    roomId: row.room_id,
    roomNumber: row.room_number ?? undefined,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    hotelName: row.hotel_name,
    hotelImage: row.hotel_image,
    roomType: row.room_type,
    city: row.city,
    country: row.country,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    guests: row.guests,
    pricePerNight: Number(row.price_per_night),
    totalAmount: Number(row.total_amount),
    totalPrice: Number(row.total_amount),
    commissionRate: row.commission_rate == null ? null : Number(row.commission_rate),
    commission: row.commission_amount == null ? 0 : Number(row.commission_amount),
    ownerAmount: row.owner_amount == null ? null : Number(row.owner_amount),
    specialRequests: row.special_requests ?? "",
    status: row.status,
    bookingStatus: cap(row.status),
    paymentStatus: PAYMENT_LABELS[row.payment_status] ?? row.payment_status,
    paymentState: row.payment_status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// Admin-facing user (no secrets).
export function mapUser(row) {
  const profile = parseJson(row.profile);
  return {
    ...profile,
    id: row.id,
    uid: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    photoURL: row.photo_url,
    photo: row.photo_url,
    profileImage: row.photo_url,
    provider: row.provider,
    status: row.status === "active" ? "Active" : cap(row.status),
    blocked: row.status === "blocked",
    blockedAt: iso(row.blocked_at),
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at),
  };
}

export function mapRecord(row) {
  return {
    ...parseJson(row.data),
    id: row.id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
