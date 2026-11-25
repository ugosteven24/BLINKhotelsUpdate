import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pool } from "@/lib/db";
import { audit } from "@/lib/guard";

// Shared by the Photos page and the Add/Edit hotel form.
// Files are saved under public/uploads/hotels/<hotelId>/ and stored as "/uploads/hotels/<hotelId>/<file>".
// (On serverless hosting with a read-only disk, use image links instead, or swap writeStored() for your cloud storage.)
export const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "hotels");
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 20;   // per hotel
export const MAX_BATCH = 10;    // per upload

import { sniff } from "@/lib/image-sniff";
export { sniff };

// Picks the real files out of a FormData entry list (empty file inputs arrive as zero-byte files).
export const realFiles = (entries) => entries.filter((f) => f && typeof f !== "string" && f.size > 0);

// Reads and checks files without touching the disk or database.
export async function prepareImages(files) {
  const items = [];
  const skipped = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) { skipped.push(`${file.name} (over 5 MB)`); continue; }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = sniff(buf);
    if (!ext) { skipped.push(`${file.name} (not a JPG, PNG or WebP)`); continue; }
    items.push({ buf, ext, name: file.name });
  }
  return { items, skipped };
}

// Keeps hotels.cover_image in step with the image flagged is_cover (promotes the first image if none is flagged).
export async function syncCover(conn, hotelId) {
  const [[cover]] = await conn.query("SELECT id, image_path FROM hotel_images WHERE hotel_id=? AND is_cover=1 ORDER BY sort_order, id LIMIT 1", [hotelId]);
  let c = cover;
  if (!c) {
    const [[first]] = await conn.query("SELECT id, image_path FROM hotel_images WHERE hotel_id=? ORDER BY sort_order, id LIMIT 1", [hotelId]);
    if (first) { await conn.query("UPDATE hotel_images SET is_cover=1 WHERE id=?", [first.id]); c = first; }
  }
  await conn.query("UPDATE hotels SET cover_image=? WHERE id=?", [c?.image_path ?? null, hotelId]);
}

export async function insertImage(hotelId, imagePath, alt, userId, makeCover = false) {
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
    if (makeCover) await conn.query("UPDATE hotel_images SET is_cover=(id=?) WHERE hotel_id=?", [id, hotelId]);
    await syncCover(conn, hotelId);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await audit(userId, "hotel_image.added", "hotel", hotelId, null, { image_id: id, image_path: imagePath, cover: makeCover });
  return { success: "Photo added.", id };
}

async function writeStored(hotelId, item) {
  const dir = path.join(UPLOAD_ROOT, String(hotelId));
  const name = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${item.ext}`;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), item.buf);
  return { file: path.join(dir, name), imagePath: `/uploads/hotels/${hotelId}/${name}` };
}

// Saves prepared images for a hotel. `coverFirst` makes the first item the cover photo.
export async function storeImages(hotelId, items, { alt = "", userId, coverFirst = false } = {}) {
  let added = 0;
  const skipped = [];
  for (const [i, item] of items.entries()) {
    let saved;
    try { saved = await writeStored(hotelId, item); }
    catch (e) {
      console.error("hotel image write failed", e.message);
      return { added, skipped, error: "The server couldn't save the photos (read-only disk?). Use an image link instead." };
    }
    const res = await insertImage(hotelId, saved.imagePath, alt, userId, coverFirst && i === 0);
    if (res.error) {
      await unlink(saved.file).catch(() => {});
      skipped.push(`${item.name} (${res.error.replace(/\.$/, "")})`);
      break; // the hotel is full: the rest would fail the same way
    }
    added++;
  }
  return { added, skipped };
}

// Removes the file only if we saved it ourselves, and only inside the uploads folder.
export async function removeStoredFile(imagePath) {
  if (!imagePath?.startsWith("/uploads/hotels/")) return;
  const file = path.resolve(process.cwd(), "public", imagePath.replace(/^\//, ""));
  if (file.startsWith(UPLOAD_ROOT + path.sep)) await unlink(file).catch(() => {});
}
