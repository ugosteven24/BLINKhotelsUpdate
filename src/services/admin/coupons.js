"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg, } from "@/lib/guard";


const schema = z
  .object({
    code: z.string().min(3).max(50).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _ only."),
    title: z.string().min(2).max(150),
    description: z.string().max(500).optional(),
    discount_type: z.enum(["percentage", "fixed"]),
    discount_value: z.coerce.number().positive(),
    max_discount_amount: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
    min_booking_amount: z.coerce.number().min(0).default(0),
    hotel_id: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
    usage_limit: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
    per_user_limit: z.coerce.number().int().min(1).default(1),
    starts_at: z.string().min(1),
    expires_at: z.string().min(1),
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .refine((d) => new Date(d.expires_at) > new Date(d.starts_at), {
    message: "The end date must be after the start date.",
    path: ["expires_at"],
  })
  .refine((d) => d.discount_type !== "percentage" || d.discount_value <= 100, {
    message: "A percentage discount can't exceed 100.",
    path: ["discount_value"],
  });

export async function listCoupons(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = [];
  const args = [];
  if (p.q) { where.push("(c.code LIKE ? OR c.title LIKE ?)"); args.push(`%${p.q}%`, `%${p.q}%`); }
  if (p.status === "expired") where.push("c.expires_at < NOW()");
  else if (p.status) { where.push("c.status=? AND c.expires_at >= NOW()"); args.push(p.status); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query(
    `SELECT c.*, h.hotel_name, IF(c.expires_at < NOW(), 'expired', c.status) AS effective_status
       FROM coupons c LEFT JOIN hotels h ON h.id=c.hotel_id ${w}
      ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c FROM coupons c ${w}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getCoupon(id) {
  await requireAdmin();
  return queryOne("SELECT * FROM coupons WHERE id=?", [id]);
}

export async function listHotelOptions() {
  await requireAdmin();
  return query("SELECT id, hotel_name FROM hotels WHERE approval_status='approved' ORDER BY hotel_name");
}

export async function saveCouponAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id") || 0);
  const raw = Object.fromEntries(fd);
  const p = schema.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const vals = [
    d.code.toUpperCase(), d.title, d.description || null, d.discount_type, d.discount_value,
    d.max_discount_amount ?? null, d.min_booking_amount, d.hotel_id ?? null, d.usage_limit ?? null,
    d.per_user_limit, d.starts_at.replace("T", " "), d.expires_at.replace("T", " "), d.status,
  ];
  try {
    if (id) {
      await execute(
        `UPDATE coupons SET code=?, title=?, description=?, discount_type=?, discount_value=?, max_discount_amount=?,
           min_booking_amount=?, hotel_id=?, usage_limit=?, per_user_limit=?, starts_at=?, expires_at=?, status=? WHERE id=?`,
        [...vals, id]);
      await audit(s.userId, "coupon.updated", "coupon", id, null, d);
    } else {
      const r = await execute(
        `INSERT INTO coupons (code,title,description,discount_type,discount_value,max_discount_amount,min_booking_amount,
           hotel_id,usage_limit,per_user_limit,starts_at,expires_at,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [...vals, s.userId]);
      await audit(s.userId, "coupon.created", "coupon", r.insertId, null, d);
    }
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return { error: "A coupon with that code already exists." };
    throw e;
  }
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function toggleCouponAction(fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id"));
  const old = await queryOne("SELECT status FROM coupons WHERE id=?", [id]);
  if (!old) return;
  const next = old.status === "active" ? "inactive" : "active";
  await execute("UPDATE coupons SET status=? WHERE id=?", [next, id]);
  await audit(s.userId, "coupon.toggled", "coupon", id, old, { status: next });
  revalidatePath("/admin/coupons");
}

export async function deleteCouponAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const c = await queryOne("SELECT code FROM coupons WHERE id=?", [id]);
  if (!c) return { error: "That coupon no longer exists." };
  const used = await queryOne("SELECT COUNT(*) AS c FROM coupon_redemptions WHERE coupon_id=?", [id]);
  if (used.c > 0) {
    await execute("UPDATE coupons SET status='inactive' WHERE id=?", [id]); // keep redemption history
    await audit(s.userId, "coupon.deactivated_instead_of_deleted", "coupon", id, { code: c.code }, null);
    revalidatePath("/admin/coupons");
    return { success: "This coupon was already used, so it was deactivated and its history kept." };
  }
  await execute("DELETE FROM coupons WHERE id=?", [id]);
  await audit(s.userId, "coupon.deleted", "coupon", id, { code: c.code }, null);
  revalidatePath("/admin/coupons");
  return { success: "Coupon deleted." };
}

export async function getCouponDetail(id) {
  await requireAdmin();
  const coupon = await queryOne(
    `SELECT c.*, h.hotel_name, IF(c.expires_at < NOW(), 'expired', c.status) AS effective_status
       FROM coupons c LEFT JOIN hotels h ON h.id=c.hotel_id WHERE c.id=?`, [id]);
  if (!coupon) return null;
  const redemptions = await query(
    `SELECT cr.id, cr.discount_amount, cr.created_at, r.id AS reservation_id, r.reservation_code,
            u.id AS user_id, CONCAT(u.first_name,' ',u.last_name) AS guest
       FROM coupon_redemptions cr JOIN reservations r ON r.id=cr.reservation_id JOIN users u ON u.id=cr.user_id
      WHERE cr.coupon_id=? ORDER BY cr.created_at DESC LIMIT 50`, [id]);
  return { coupon, redemptions };
}
