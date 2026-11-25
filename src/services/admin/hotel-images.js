"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query, queryOne, execute, pool } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/guard";

// Files are saved under public/uploads/hotels/<hotelId>/ and stored as "/uploads/hotels/<hotelId>/<file>".
// (On serverless hosting with a read-only disk, paste an image URL instead, or swap saveFile() for your cloud storage.)
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "hotels");
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 20;

// Trust the file's real bytes, not the name or the browser-reported type.
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

const refresh = (hotelId) => {
  revalidatePath(`/admin/hotels/${hotelId}/images`);
  revalidatePath(`/admin/hotels/${hotelId}`);
};

export async function getHotelImages(hotelId) {
  await requireAdmin();
  const hotel = await queryOne("SELECT id, hotel_name, cover_image FROM hotels WHERE id=?", [hotelId]);
  if (!hotel) return null;
  const images = await query(
    "SELECT id, image_path, alt_text, sort_order, is_cover FROM hotel_images WHERE hotel_id=? ORDER BY sort_order, id", [hotelId]);
  return { hotel, images, max: MAX_IMAGES };
}

// Keeps hotels.cover_image in step with the image flagged is_cover (promotes the first image if none is flagged).
async function syncCover(conn, hotelId) {
  const [[cover]] = await conn.query("SELECT id, image_path FROM hotel_images WHERE hotel_id=? AND is_cover=1 ORDER BY sort_order, id LIMIT 1", [hotelId]);
  let c = cover;
  if (!c) {
    const [[first]] = await conn.query("SELECT id, image_path FROM hotel_images WHERE hotel_id=? ORDER BY sort_order, id LIMIT 1", [hotelId]);
    if (first) { await conn.query("UPDATE hotel_images SET is_cover=1 WHERE id=?", [first.id]); c = first; }
  }
  await conn.query("UPDATE hotels SET cover_image=? WHERE id=?", [c?.image_path ?? null, hotelId]);
}

async function insertImage(hotelId, imagePath, alt, userId) {
  const conn = await pool.getConnection();
  let id;
  try {
    await conn.beginTransaction();
    const [[cnt]] = await conn.query("SELECT COUNT(*) AS c, COALESCE(MAX(sort_order),0) AS m FROM hotel_images WHERE hotel_id=? FOR UPDATE", [hotelId]);
    if (cnt.c >= MAX_IMAGES) { await conn.rollback(); return { error: `A hotel can have up to ${MAX_IMAGES} photos.` }; }
    const [r] = await conn.query(
      "INSERT INTO hotel_images (hotel_id, image_path, alt_text, sort_order, is_cover) VALUES (?,?,?,?,0)",
      [hotelId, imagePath, alt || null, Number(cnt.m) + 1]);
    id = r.insertId;
    await syncCover(conn, hotelId);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(userId, "hotel_image.added", "hotel", hotelId, null, { image_id: id, image_path: imagePath });
  refresh(hotelId);
  return { success: "Photo added." };
}

const MAX_BATCH = 10;

// Accepts one or many files (<input type="file" multiple>). Each file is checked on its own, so one bad
// file never blocks the rest; the reply says how many went in and which were skipped, and why.
export async function uploadHotelImageAction(fd) {
  const s = await requireAdmin();
  const hotelId = Number(fd.get("hotel_id"));
  const files = fd.getAll("file").filter((f) => f && typeof f !== "string" && f.size > 0);
  if (!(await queryOne("SELECT id FROM hotels WHERE id=?", [hotelId]))) return { error: "That hotel no longer exists." };
  if (!files.length) return { error: "Choose at least one photo to upload." };
  if (files.length > MAX_BATCH) return { error: `Choose up to ${MAX_BATCH} photos at a time.` };
  // One shared description only makes sense for a single photo.
  const alt = files.length === 1 ? String(fd.get("alt_text") ?? "").trim().slice(0, 255) : "";

  const dir = path.join(UPLOAD_ROOT, String(hotelId));
  let added = 0;
  const skipped = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) { skipped.push(`${file.name} (over 5 MB)`); continue; }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) { skipped.push(`${file.name} (not a JPG, PNG or WebP)`); continue; }
    const name = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), buf);
    } catch (e) {
      console.error("hotel image write failed", e.message);
      return { error: added ? `${added} added, then the server couldn't save more. Paste an image URL instead.` : "The photos couldn't be saved on the server. Paste an image URL instead." };
    }
    const res = await insertImage(hotelId, `/uploads/hotels/${hotelId}/${name}`, alt, s.userId);
    if (res.error) {
      await unlink(path.join(dir, name)).catch(() => {});
      skipped.push(`${file.name} (${res.error.replace(/\.$/, "")})`);
      break; // the hotel is full: the rest would fail the same way
    }
    added++;
  }
  const notes = skipped.length ? ` Skipped: ${skipped.join("; ")}.` : "";
  if (!added) return { error: `No photos were added.${notes}` };
  return { success: `${added} photo${added === 1 ? "" : "s"} added.${notes}` };
}

export async function addHotelImageUrlAction(fd) {
  const s = await requireAdmin();
  const hotelId = Number(fd.get("hotel_id"));
  const raw = String(fd.get("url") ?? "").trim();
  const alt = String(fd.get("alt_text") ?? "").trim().slice(0, 255);
  if (!(await queryOne("SELECT id FROM hotels WHERE id=?", [hotelId]))) return { error: "That hotel no longer exists." };
  let url;
  try { url = new URL(raw); } catch { return { error: "Enter a full image address starting with https://" }; }
  if (url.protocol !== "https:") return { error: "Image addresses must start with https://" };
  if (raw.length > 500) return { error: "That address is too long (500 characters at most)." };
  return insertImage(hotelId, url.toString(), alt, s.userId);
}

async function loadImage(id) {
  return queryOne("SELECT id, hotel_id, image_path, is_cover FROM hotel_images WHERE id=?", [Number(id)]);
}

export async function setCoverImageAction(fd) {
  const s = await requireAdmin();
  const img = await loadImage(fd.get("id"));
  if (!img) return { error: "That photo no longer exists." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE hotel_images SET is_cover=(id=?) WHERE hotel_id=?", [img.id, img.hotel_id]);
    await syncCover(conn, img.hotel_id);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(s.userId, "hotel_image.cover_set", "hotel", img.hotel_id, null, { image_id: img.id });
  refresh(img.hotel_id);
  return { success: "Cover photo updated." };
}

export async function updateImageAltAction(fd) {
  const s = await requireAdmin();
  const img = await loadImage(fd.get("id"));
  if (!img) return { error: "That photo no longer exists." };
  const alt = String(fd.get("alt_text") ?? "").trim().slice(0, 255);
  await execute("UPDATE hotel_images SET alt_text=? WHERE id=?", [alt || null, img.id]);
  await audit(s.userId, "hotel_image.updated", "hotel", img.hotel_id, null, { image_id: img.id, alt_text: alt });
  refresh(img.hotel_id);
  return { success: "Description saved." };
}

export async function moveImageAction(fd) {
  const s = await requireAdmin();
  const img = await loadImage(fd.get("id"));
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!img) return { error: "That photo no longer exists." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query("SELECT id FROM hotel_images WHERE hotel_id=? ORDER BY sort_order, id FOR UPDATE", [img.hotel_id]);
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(img.id), j = i + dir;
    if (j < 0 || j >= ids.length) { await conn.rollback(); return {}; }
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let k = 0; k < ids.length; k++) await conn.query("UPDATE hotel_images SET sort_order=? WHERE id=?", [k + 1, ids[k]]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(s.userId, "hotel_image.reordered", "hotel", img.hotel_id, null, { image_id: img.id, dir: dir < 0 ? "up" : "down" });
  refresh(img.hotel_id);
  return {};
}

export async function deleteImageAction(id) {
  const s = await requireAdmin();
  const img = await loadImage(id);
  if (!img) return { error: "That photo no longer exists." };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM hotel_images WHERE id=?", [img.id]);
    await syncCover(conn, img.hotel_id);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  // Remove the file only if it is one we saved ourselves, and only inside the uploads folder.
  if (img.image_path.startsWith("/uploads/hotels/")) {
    const file = path.resolve(process.cwd(), "public", img.image_path.replace(/^\//, ""));
    if (file.startsWith(UPLOAD_ROOT + path.sep)) await unlink(file).catch(() => {});
  }
  await audit(s.userId, "hotel_image.deleted", "hotel", img.hotel_id, { image_path: img.image_path }, null);
  refresh(img.hotel_id);
  return { success: "Photo removed." };
}
