"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin, audit, pg } from "@/lib/guard";

const schema = z.object({
  name: z.string().trim().min(2, "Enter an amenity name.").max(100),
  amenity_type: z.enum(["hotel", "room", "both"]),
  icon_key: z.string().trim().max(100).optional().or(z.literal("")),
});

export async function listAmenities(p) {
  await requireAdmin();
  const { limit, offset, page, pageSize } = pg(p);
  const where = p.q ? "WHERE a.name LIKE ?" : "";
  const args = p.q ? [`%${p.q}%`] : [];
  const rows = await query(
    `SELECT a.*, (SELECT COUNT(*) FROM hotel_amenities ha WHERE ha.hotel_id IS NOT NULL AND ha.amenity_id=a.id) AS hotels
       FROM amenities a ${where} ORDER BY a.name LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const total = (await queryOne(`SELECT COUNT(*) AS c FROM amenities a ${where}`, args)).c;
  return { rows, total, page, pageSize };
}

export async function getAmenity(id) {
  await requireAdmin();
  return queryOne("SELECT * FROM amenities WHERE id=?", [id]);
}

export async function saveAmenityAction(_, fd) {
  const s = await requireAdmin();
  const id = Number(fd.get("id") || 0);
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  try {
    if (id) {
      await execute("UPDATE amenities SET name=?, amenity_type=?, icon_key=? WHERE id=?", [d.name, d.amenity_type, d.icon_key || null, id]);
      await audit(s.userId, "amenity.updated", "amenity", id, null, d);
    } else {
      const r = await execute("INSERT INTO amenities (name, amenity_type, icon_key) VALUES (?,?,?)", [d.name, d.amenity_type, d.icon_key || null]);
      await audit(s.userId, "amenity.created", "amenity", r.insertId, null, d);
    }
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return { error: "An amenity with that name already exists." };
    throw e;
  }
  revalidatePath("/admin/amenities");
  redirect("/admin/amenities");
}

export async function deleteAmenityAction(id) {
  const s = await requireAdmin();
  id = Number(id);
  const a = await queryOne("SELECT name FROM amenities WHERE id=?", [id]);
  if (!a) return { error: "That amenity no longer exists." };
  await execute("DELETE FROM hotel_amenities WHERE amenity_id=?", [id]);
  await execute("DELETE FROM room_type_amenities WHERE amenity_id=?", [id]);
  await execute("DELETE FROM amenities WHERE id=?", [id]);
  await audit(s.userId, "amenity.deleted", "amenity", id, { name: a.name }, null);
  revalidatePath("/admin/amenities");
  return { success: "Amenity deleted and removed from every hotel and room type." };
}
