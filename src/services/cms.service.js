"use server";

// Content / configuration collections (amenities, categories, locations,
// banners, advertisements, coupons, roles, CMS pages, campaigns, settings,
// destinations, contact messages, activity logs).
//
// One generic set of Server Actions, protected by a per-collection policy.
// A collection that is not listed here cannot be read or written from the
// browser, and the caller's role is always taken from the server session.

import { query } from "@/lib/db/connection";
import { ADMIN_ROLES, ROLES, getSessionUser, requireRole } from "@/lib/auth/session";
import { mapRecord } from "@/lib/mappers";
import { parseJson, sanitizeDoc } from "@/lib/doc";
import { ServiceError, clampInt, newId } from "@/lib/service-utils";

const SUPER = [ROLES.SUPERADMIN];

// read / create / write: "public" | "admin" | "superadmin"
const POLICY = {
  amenities:         { read: "public", write: "admin" },
  hotel_categories:  { read: "public", write: "admin" },
  locations:         { read: "public", write: "admin" },
  banners:           { read: "public", write: "admin" },
  advertisements:    { read: "public", write: "admin" },
  destinations:      { read: "public", write: "admin" },
  aboutCMS:          { read: "public", write: "admin" },
  contactCMS:        { read: "public", write: "admin" },
  homepageCMS:       { read: "public", write: "admin" },
  coupons:           { read: "admin",  write: "admin" },
  pushNotifications: { read: "admin",  write: "admin" },
  emailBroadcasts:   { read: "admin",  write: "admin" },
  activityLogs:      { read: "admin",  write: "admin" },
  contactMessages:   { read: "admin",  write: "admin", create: "public" },
  roles:             { read: "superadmin", write: "superadmin" },
  adminRoles:        { read: "superadmin", write: "superadmin" },
  admins:            { read: "superadmin", write: "superadmin" },
  settings:          { read: "superadmin", write: "superadmin" }, // holds gateway/SMTP/SMS secrets
};

const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function policyFor(collection) {
  const policy = Object.hasOwn(POLICY, String(collection)) ? POLICY[collection] : null;
  if (!policy) throw new ServiceError("Unknown collection.", "forbidden");
  return policy;
}

async function authorize(level) {
  if (level === "public") return getSessionUser();
  return requireRole(level === "superadmin" ? SUPER : ADMIN_ROLES);
}

function checkId(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) throw new ServiceError("Invalid id.");
  return id;
}

// options: { where: { field: value }, orderBy: "createdAt"|"updatedAt", direction: "asc"|"desc", limit }
export async function listRecords(collection, options = {}) {
  const policy = policyFor(collection);
  await authorize(policy.read);

  const params = [collection];
  let where = "collection = ?";

  for (const [field, value] of Object.entries(options.where ?? {})) {
    if (!FIELD_RE.test(field)) throw new ServiceError("Invalid filter.");
    if (!["string", "number", "boolean"].includes(typeof value)) throw new ServiceError("Invalid filter.");
    where += " AND JSON_UNQUOTE(JSON_EXTRACT(data, ?)) = ?";
    params.push(`$.${field}`, String(value));
  }

  const column = options.orderBy === "updatedAt" ? "updated_at" : "created_at";
  const direction = options.direction === "asc" ? "ASC" : "DESC";
  const limit = clampInt(options.limit, 1, 2000, 1000);

  const rows = await query(
    `SELECT id, data, created_at, updated_at FROM records
      WHERE ${where} ORDER BY ${column} ${direction}, id LIMIT ${limit}`,
    params
  );
  return rows.map(mapRecord);
}

export async function getRecord(collection, id) {
  const policy = policyFor(collection);
  await authorize(policy.read);

  const rows = await query(
    "SELECT id, data, created_at, updated_at FROM records WHERE collection = ? AND id = ?",
    [collection, checkId(id)]
  );
  return rows[0] ? mapRecord(rows[0]) : null;
}

export async function createRecord(collection, data) {
  const policy = policyFor(collection);
  await authorize(policy.create ?? policy.write);

  const id = newId();
  await query("INSERT INTO records (collection, id, data) VALUES (?, ?, ?)", [
    collection,
    id,
    JSON.stringify(sanitizeDoc(data)),
  ]);
  return { ok: true, id };
}

// Merges `data` into the existing document (an existing field is only replaced when the patch sets it).
export async function updateRecord(collection, id, data) {
  const policy = policyFor(collection);
  await authorize(policy.write);
  checkId(id);

  const patch = sanitizeDoc(data);
  const rows = await query("SELECT data FROM records WHERE collection = ? AND id = ?", [collection, id]);
  if (!rows[0]) throw new ServiceError("Record not found.", "not-found");

  await query("UPDATE records SET data = ? WHERE collection = ? AND id = ?", [
    JSON.stringify({ ...parseJson(rows[0].data), ...patch }),
    collection,
    id,
  ]);
  return { ok: true };
}

// Creates or replaces-by-merge a document with a chosen id (settings, destinations).
export async function setRecord(collection, id, data) {
  const policy = policyFor(collection);
  await authorize(policy.write);
  checkId(id);

  await query(
    `INSERT INTO records (collection, id, data) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE data = JSON_MERGE_PATCH(data, VALUES(data))`,
    [collection, id, JSON.stringify(sanitizeDoc(data))]
  );
  return { ok: true };
}

export async function deleteRecord(collection, id) {
  const policy = policyFor(collection);
  await authorize(policy.write);

  await query("DELETE FROM records WHERE collection = ? AND id = ?", [collection, checkId(id)]);
  return { ok: true };
}
