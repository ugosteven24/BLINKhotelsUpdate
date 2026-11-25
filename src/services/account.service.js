"use server";

// The signed-in guest's own account: profile, default address, notification switches, photo and password.
// Written for the hotel_marketplace tables: users, user_addresses.

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query, run, withTransaction } from "@/lib/db/connection";
import { requireUser } from "@/lib/auth/session";
import { sniff } from "@/lib/image-sniff";
import { changeMyPassword } from "@/services/user.service";

const GENDERS = ["male", "female", "prefer_not_to_say"];
const DEFAULT_SETTINGS = { emailNotifications: true, bookingUpdates: true, promotionalEmails: false };
const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const MAX_AVATAR = 6 * 1024 * 1024;

const fail = (message, code = "invalid") => ({ ok: false, code, message });
const text = (v, max) => String(v ?? "").trim().slice(0, max);

// null (instead of throwing) when nobody is signed in, so the page can send them to /login.
async function me() {
  try { return await requireUser(); } catch { return null; }
}

// gender / date_of_birth / notification_preferences come from the optional migration.
let extrasChecked = false;
async function extrasReady() {
  if (extrasChecked) return true;
  const rows = await query(
    `SELECT COUNT(*) AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users'
        AND column_name IN ('gender','date_of_birth','notification_preferences')`);
  extrasChecked = Number(rows[0].c) === 3;
  return extrasChecked;
}

const MIGRATION_MSG = "This isn't available yet: run database/migrations/2026-11-user-profile-fields.sql first.";

function parsePrefs(raw) {
  try { return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) }; } catch { return { ...DEFAULT_SETTINGS }; }
}

export async function getMyAccount() {
  const user = await me();
  if (!user) return { ok: false, code: "auth", message: "Please sign in to continue." };

  const extras = await extrasReady();
  const rows = await query(
    `SELECT id, first_name, last_name, email, phone, profile_image, created_at${extras ? ", gender, date_of_birth, notification_preferences" : ""}
       FROM users WHERE id = ? LIMIT 1`, [user.id]);
  const u = rows[0];
  if (!u) return { ok: false, code: "auth", message: "Please sign in to continue." };

  const addr = (await query(
    `SELECT address_line1, city, state, postal_code, country FROM user_addresses
      WHERE user_id = ? ORDER BY is_default DESC, id LIMIT 1`, [user.id]))[0];

  return {
    ok: true,
    extrasAvailable: extras,
    account: {
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone ?? "",
      gender: extras ? u.gender ?? "" : "",
      dateOfBirth: extras && u.date_of_birth ? new Date(u.date_of_birth).toISOString().slice(0, 10) : "",
      photoURL: u.profile_image ?? "",
      memberSince: u.created_at ? new Date(u.created_at).toISOString() : null,
      address: {
        country: addr?.country ?? "Nigeria",
        state: addr?.state ?? "",
        city: addr?.city ?? "",
        street: addr?.address_line1 ?? "",
        postalCode: addr?.postal_code ?? "",
      },
      settings: extras ? parsePrefs(u.notification_preferences) : { ...DEFAULT_SETTINGS },
    },
  };
}

export async function saveMyProfile(input = {}) {
  const user = await me();
  if (!user) return fail("Please sign in to continue.", "auth");

  const firstName = text(input.firstName, 100);
  const lastName = text(input.lastName, 100);
  const phone = text(input.phone, 30);
  const gender = text(input.gender, 30);
  const dob = text(input.dateOfBirth, 10);

  if (!firstName || !lastName) return fail("Enter your first and last name.");
  if (phone && !/^[+\d][\d\s\-()]{5,28}$/.test(phone)) return fail("Enter a valid phone number.");

  if (gender && !GENDERS.includes(gender)) return fail("Choose a valid gender option.");
  if (dob) {
    const d = new Date(`${dob}T00:00:00Z`);
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(dob) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dob;
    if (!valid) return fail("Enter a valid date of birth.");
    if (d > new Date()) return fail("Date of birth can't be in the future.");
    if (d < new Date("1900-01-01T00:00:00Z")) return fail("Enter a valid date of birth.");
  }

  const extras = await extrasReady();
  if ((gender || dob) && !extras) return fail(MIGRATION_MSG, "migration");

  if (extras) {
    await query("UPDATE users SET first_name=?, last_name=?, phone=?, gender=?, date_of_birth=? WHERE id=?",
      [firstName, lastName, phone || null, gender || null, dob || null, user.id]);
  } else {
    await query("UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?", [firstName, lastName, phone || null, user.id]);
  }
  return { ok: true };
}

export async function saveMyAddress(input = {}) {
  const user = await me();
  if (!user) return fail("Please sign in to continue.", "auth");

  const street = text(input.street, 255);
  const city = text(input.city, 100);
  const state = text(input.state, 100);
  const postalCode = text(input.postalCode, 30);
  const country = text(input.country, 100);
  if (!street) return fail("Enter your street address.");
  if (!city) return fail("Enter your city.");
  if (!country) return fail("Choose your country.");

  await withTransaction(async (connection) => {
    const rows = await run(connection,
      "SELECT id FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id LIMIT 1 FOR UPDATE", [user.id]);
    if (rows[0]) {
      await run(connection,
        `UPDATE user_addresses SET address_line1=?, city=?, state=?, postal_code=?, country=?, is_default=1
          WHERE id=? AND user_id=?`, [street, city, state || null, postalCode || null, country, rows[0].id, user.id]);
    } else {
      await run(connection,
        `INSERT INTO user_addresses (user_id, address_line1, city, state, postal_code, country, is_default)
         VALUES (?,?,?,?,?,?,1)`, [user.id, street, city, state || null, postalCode || null, country]);
    }
  });
  return { ok: true };
}

export async function saveMySettings(input = {}) {
  const user = await me();
  if (!user) return fail("Please sign in to continue.", "auth");
  if (!(await extrasReady())) return fail(MIGRATION_MSG, "migration");

  const prefs = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, input[k] === true]));
  await query("UPDATE users SET notification_preferences=? WHERE id=?", [JSON.stringify(prefs), user.id]);
  return { ok: true };
}

export async function changePassword({ current, next } = {}) {
  const user = await me();
  if (!user) return fail("Please sign in to continue.", "auth");
  if (typeof next !== "string" || next.length < 8) return fail("Password must contain at least 8 characters.");
  if (next === current) return fail("Choose a password you haven't used here before.");
  const res = await changeMyPassword({ currentPassword: current, newPassword: next });
  return res.ok ? { ok: true } : fail(res.message ?? "Couldn't change your password.", res.code);
}

export async function uploadMyPhoto(fd) {
  const user = await me();
  if (!user) return fail("Please sign in to continue.", "auth");

  const file = fd.get("photo");
  if (!file || typeof file === "string" || !file.size) return fail("Choose a photo to upload.");
  if (file.size > MAX_AVATAR) return fail("Photos must be 2 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return fail("Only JPG, PNG or WebP photos are allowed.");

  const name = `${user.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  try {
    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(path.join(AVATAR_DIR, name), buf);
  } catch (e) {
    console.error("avatar write failed", e.message);
    return fail("The photo couldn't be saved on the server.", "server");
  }

  const photoURL = `/uploads/avatars/${name}`;
  const old = (await query("SELECT profile_image FROM users WHERE id=?", [user.id]))[0]?.profile_image;
  await query("UPDATE users SET profile_image=? WHERE id=?", [photoURL, user.id]);
  // Remove the previous photo only if we saved it ourselves, and only inside the avatars folder.
  if (old?.startsWith("/uploads/avatars/")) {
    const f = path.resolve(process.cwd(), "public", old.replace(/^\//, ""));
    if (f.startsWith(AVATAR_DIR + path.sep)) await unlink(f).catch(() => {});
  }
  return { ok: true, photoURL };
}
