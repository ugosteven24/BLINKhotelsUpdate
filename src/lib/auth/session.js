// Server-side session internals. NOT a "use server" file: nothing here is
// callable from the browser. Import it from src/services/* and server components.
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { query, run } from "@/lib/db/connection";
import {
  SESSION_COOKIE,
  SEVEN_DAYS,
  ONE_DAY,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  HOTEL_OWNER: "hotel_owner",
  STAFF: "staff",
  CLIENT: "client",
};

export const ADMIN_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN];

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip") || "").slice(0, 45) || null,
    userAgent: (h.get("user-agent") || "").slice(0, 255) || null,
  };
}

// Inserts the session row (using the caller's transaction connection when one
// is given) and sets the HTTP-only cookie. Call setSessionCookie() AFTER the
// transaction has committed.
export async function insertSession(connection, userId, remember = true) {
  const sessionId = randomUUID();
  const seconds = remember === false ? ONE_DAY : SEVEN_DAYS;
  const meta = await getRequestMeta();

  await run(
    connection,
    `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), ?, ?)`,
    [sessionId, userId, seconds, meta.ip, meta.userAgent]
  );

  return { sessionId, seconds, persistent: remember !== false };
}

export async function setSessionCookie({ sessionId, seconds, persistent }) {
  const token = await createSessionToken(sessionId, seconds);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // No maxAge = cleared when the browser closes.
    ...(persistent ? { maxAge: seconds } : {}),
  });
}

// Validates the cookie against MySQL. Returns the public user or null.
// Cached per request so a layout and a page asking twice cost one query.
export const getSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  // const rows = await query(
  //   `SELECT u.id, u.email, u.first_name, u.last_name,  u.role_id,
  //           u.phone, u.profile_image, u.status
  //      FROM sessions s
  //      JOIN users u ON u.id = s.user_id
  //     WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()
  //     LIMIT 1`,
  //   [session.sessionId]
  // );
const rows = await query(
  `SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.role_id,
      r.role_key AS role,
      r.role_name,
      u.phone,
      u.profile_image,
      u.status
   FROM sessions s
   JOIN users u ON u.id = s.user_id
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE s.id = ?
     AND s.expires_at > UTC_TIMESTAMP()
   LIMIT 1`,
  [session.sessionId]
);
  const row = rows[0];
  if (!row || row.status !== "active") return null;

  return toPublicUser(row);
});

// The ONLY shape of a user that may leave the server. Never includes password_hash.
export function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    photoURL: row.photo_url,
    // Names that the existing pages already read:
    uid: row.id,
    displayName: row.full_name,
    phoneNumber: row.phone,
  };
}

// Use at the top of every protected Server Action.
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Please sign in to continue.", 401);
  return user;
}

export async function requireRole(allowedRoles) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthError("You do not have permission to do that.", 403);
  }
  return user;
}

// Deletes the session row and the cookie. Only call from a Server Action or
// route handler (cookies cannot be modified while rendering).
export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (session) {
    await query("DELETE FROM sessions WHERE id = ?", [session.sessionId]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

// Id of the session behind the current request (used to keep this session
// alive when other sessions are revoked, e.g. after a password change).
export async function getCurrentSessionId() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return session?.sessionId ?? null;
}
