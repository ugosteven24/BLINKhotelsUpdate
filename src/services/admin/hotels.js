"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, execute, pool } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";
import { redirect } from "next/navigation";
import { z } from "zod";

export async function listHotels(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) {
    where.push("(h.hotel_name LIKE ? OR h.city LIKE ? OR h.state LIKE ? OR CONCAT(u.first_name,' ',u.last_name) LIKE ? OR u.email LIKE ?)");
    const like = `%${String(p.q).trim()}%`;
    args.push(like, like, like, like, like);
  }
  if (p.status) { where.push("h.approval_status=?"); args.push(p.status); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query(
    `SELECT h.id, h.hotel_name, h.city, h.state, h.category, h.approval_status, h.is_featured,
            h.commission_rate, h.created_at, CONCAT(u.first_name,' ',u.last_name) AS owner_name
       FROM hotels h JOIN users u ON u.id=h.owner_id ${w}
      ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  );
  const total = (await queryOne(`SELECT COUNT(*) AS c FROM hotels h JOIN users u ON u.id=h.owner_id ${w}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getHotel(id) {
  await requireAdmin();
  const hotel = await queryOne(
    `SELECT h.*, CONCAT(u.first_name,' ',u.last_name) AS owner_name, u.email AS owner_email
       FROM hotels h JOIN users u ON u.id=h.owner_id WHERE h.id=?`, [id]);
  if (!hotel) return null;
  const [roomTypes, amenities, stats] = await Promise.all([
    query(
      `SELECT rt.id, rt.name, rt.base_price, rt.currency, rt.status,
              (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id=rt.id) AS rooms
         FROM room_types rt WHERE rt.hotel_id=?`, [id]),
    query(`SELECT a.name FROM hotel_amenities ha JOIN amenities a ON a.id=ha.amenity_id WHERE ha.hotel_id=?`, [id]),
    queryOne(
      `SELECT COUNT(*) AS reservations, COALESCE(SUM(total_amount),0) AS revenue, COALESCE(SUM(commission_amount),0) AS commission
         FROM reservations WHERE hotel_id=? AND status IN ('approved','checked_in','completed')`, [id]),
  ]);
  const counts = await queryOne(
    `SELECT (SELECT COUNT(*) FROM hotel_images WHERE hotel_id=?) AS images,
            (SELECT COUNT(*) FROM hotel_staff WHERE hotel_id=? AND status <> 'removed') AS staff`, [id, id]);
  return { hotel, roomTypes, amenities, stats, counts };
}

export async function hotelDecisionAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision"));
  const reason = String(fd.get("reason") ?? "").slice(0, 500) || null;
  const map = { approve: "approved", reject: "rejected", suspend: "suspended", reinstate: "approved" };
  const next = map[decision];
  if (!next) return;
  if ((decision === "reject" || decision === "suspend") && !reason) return;
  const old = await queryOne("SELECT approval_status FROM hotels WHERE id=?", [id]);
  await execute(
    `UPDATE hotels SET approval_status=?, approved_by=?, approved_at=NOW(), rejection_reason=? WHERE id=?`,
    [next, s.userId, next === "approved" ? null : reason, id]
  );
  await audit(s.userId, `hotel.${decision}`, "hotel", id, old, { approval_status: next, reason });
  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${id}`);
}

export async function updateHotelCommercialAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const rate = Number(fd.get("commission_rate"));
  if (!(rate >= 0 && rate <= 100)) return;
  const featured = fd.get("is_featured") === "on";
  const old = await queryOne("SELECT commission_rate, is_featured FROM hotels WHERE id=?", [id]);
  await execute("UPDATE hotels SET commission_rate=?, is_featured=? WHERE id=?", [rate, featured, id]);
  await audit(s.userId, "hotel.commercial_updated", "hotel", id, old, { commission_rate: rate, is_featured: featured });
  revalidatePath(`/admin/hotels/${id}`);
}

const slugify = (t) =>
  t.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 170) || "hotel";

async function uniqueSlug(base, excludeId) {
  let slug = base, i = 1;
  for (;;) {
    const hit = await queryOne(`SELECT id FROM hotels WHERE slug=?${excludeId ? " AND id<>?" : ""}`, excludeId ? [slug, excludeId] : [slug]);
    if (!hit) return slug;
    slug = `${base}-${++i}`;
  }
}

const opt = (max) => z.string().trim().max(max).optional().or(z.literal(""));
const hotelSchema = z.object({
  owner_id: z.coerce.number().int().positive("Choose an owner."),
  hotel_name: z.string().trim().min(2, "Enter the hotel name.").max(180),
  category: z.enum(["hotel", "guest_house", "resort", "apartment", "hostel", "other"]),
  description: opt(10000),
  email: z.string().trim().email("Enter a valid hotel email.").max(191).optional().or(z.literal("")),
  phone: opt(30),
  website: opt(255),
  address_line1: z.string().trim().min(2, "Enter the street address.").max(255),
  address_line2: opt(255),
  city: z.string().trim().min(1, "Enter the city.").max(100),
  state: z.string().trim().min(1, "Enter the state.").max(100),
  country: z.string().trim().min(1).max(100).default("Nigeria"),
  star_rating: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(0, "Stars must be 0 to 5.").max(5, "Stars must be 0 to 5.").optional()),
  check_in_time: z.string().regex(/^\d{2}:\d{2}/, "Enter a check-in time."),
  check_out_time: z.string().regex(/^\d{2}:\d{2}/, "Enter a check-out time."),
  cancellation_policy: opt(10000),
  commission_rate: z.coerce.number().min(0, "Commission must be 0 to 100.").max(100, "Commission must be 0 to 100."),
  approval_status: z.enum(["draft", "pending", "approved"]).optional(),
});

export async function listOwnerOptions() {
  await requireAdmin();
  return query(
    `SELECT u.id, CONCAT(u.first_name,' ',u.last_name,' (',u.email,')') AS label
       FROM users u JOIN roles r ON r.id=u.role_id AND r.role_key='hotel_owner' WHERE u.status='active' ORDER BY u.first_name`);
}
export async function listAmenityOptions() {
  await requireAdmin();
  return query("SELECT id, name FROM amenities WHERE amenity_type IN ('hotel','both') ORDER BY name");
}
export async function getHotelForEdit(id) {
  await requireAdmin();
  const hotel = await queryOne("SELECT * FROM hotels WHERE id=?", [id]);
  if (!hotel) return null;
  const am = await query("SELECT amenity_id FROM hotel_amenities WHERE hotel_id=?", [id]);
  return { hotel, amenityIds: am.map((a) => a.amenity_id) };
}

const hotelValues = (d) => [
  d.owner_id, d.hotel_name, d.category, d.description || null, d.email || null, d.phone || null, d.website || null,
  d.address_line1, d.address_line2 || null, d.city, d.state, d.country, d.star_rating ?? null,
  d.check_in_time, d.check_out_time, d.cancellation_policy || null, d.commission_rate,
];

async function setAmenities(conn, hotelId, ids) {
  await conn.query("DELETE FROM hotel_amenities WHERE hotel_id=?", [hotelId]);
  if (ids.length) await conn.query("INSERT INTO hotel_amenities (hotel_id, amenity_id) VALUES ?", [ids.map((a) => [hotelId, a])]);
}

export async function createHotelAction(_, fd) {
  const s = await requireAdmin();
  const p = hotelSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const status = d.approval_status ?? "pending";
  const amenityIds = fd.getAll("amenities").map(Number).filter(Boolean);
  const slug = await uniqueSlug(slugify(d.hotel_name));
  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO hotels (owner_id, hotel_name, category, description, email, phone, website, address_line1, address_line2,
         city, state, country, star_rating, check_in_time, check_out_time, cancellation_policy, commission_rate,
         slug, is_featured, approval_status, approved_by, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [...hotelValues(d), slug, fd.get("is_featured") === "on", status,
       status === "approved" ? s.userId : null, status === "approved" ? new Date() : null]);
    id = r.insertId;
    await setAmenities(conn, id, amenityIds);
    await conn.commit();
  } catch (e) {
    await conn.rollback(); throw e;
  } finally { conn.release(); }
  await audit(s.userId, "hotel.created", "hotel", id, null, { hotel_name: d.hotel_name, owner_id: d.owner_id, status });
  revalidatePath("/admin/hotels");
  redirect(`/admin/hotels/${id}`);
}

export async function updateHotelAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const p = hotelSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const old = await queryOne("SELECT hotel_name, owner_id, commission_rate, city, state FROM hotels WHERE id=?", [id]);
  if (!old) return { error: "That hotel no longer exists." };
  const amenityIds = fd.getAll("amenities").map(Number).filter(Boolean);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE hotels SET owner_id=?, hotel_name=?, category=?, description=?, email=?, phone=?, website=?, address_line1=?,
         address_line2=?, city=?, state=?, country=?, star_rating=?, check_in_time=?, check_out_time=?, cancellation_policy=?,
         commission_rate=?, is_featured=? WHERE id=?`,
      [...hotelValues(d), fd.get("is_featured") === "on", id]);
    await setAmenities(conn, id, amenityIds);
    await conn.commit();
  } catch (e) {
    await conn.rollback(); throw e;
  } finally { conn.release(); }
  await audit(s.userId, "hotel.updated", "hotel", id, old, { hotel_name: d.hotel_name, owner_id: d.owner_id, commission_rate: d.commission_rate, city: d.city, state: d.state });
  revalidatePath("/admin/hotels");
  revalidatePath(`/admin/hotels/${id}`);
  redirect(`/admin/hotels/${id}`);
}

export async function deleteHotelAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const h = await queryOne("SELECT hotel_name FROM hotels WHERE id=?", [id]);
  if (!h) return { error: "That hotel no longer exists." };
  const used = await queryOne("SELECT COUNT(*) AS c FROM reservations WHERE hotel_id=?", [id]);
  if (used.c > 0) return { error: "This hotel has reservations, so it can't be deleted. Suspend it instead to hide it from guests." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM room_blocks WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM rooms WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM room_type_amenities WHERE room_type_id IN (SELECT id FROM room_types WHERE hotel_id=?)", [id]);
    await conn.query("DELETE FROM room_rate_rules WHERE room_type_id IN (SELECT id FROM room_types WHERE hotel_id=?)", [id]);
    await conn.query("DELETE FROM room_types WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM hotel_staff_permissions WHERE hotel_staff_id IN (SELECT id FROM hotel_staff WHERE hotel_id=?)", [id]);
    await conn.query("DELETE FROM hotel_staff WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM hotel_images WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM hotel_amenities WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM coupons WHERE hotel_id=?", [id]);
    await conn.query("DELETE FROM hotels WHERE id=?", [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e.code === "ER_ROW_IS_REFERENCED_2") return { error: "Other records still depend on this hotel. Suspend it instead." };
    throw e;
  } finally { conn.release(); }
  await audit(s.userId, "hotel.deleted", "hotel", id, { hotel_name: h.hotel_name }, null);
  revalidatePath("/admin/hotels");
  return { success: "Hotel deleted." };
}
