// Edge-safe: only depends on `jose`. Safe to import from proxy.js.
// The token carries ONLY the session id. Who the user is, their role and
// whether they are blocked are always read from MySQL on the server.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const SEVEN_DAYS = 60 * 60 * 24 * 7;
export const ONE_DAY = 60 * 60 * 24;

// Read lazily so a missing variable can't crash the build or an import.
function getKey() {
  const secret = process.env.SESSION_SECRET; // server-only: no NEXT_PUBLIC_ prefix
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(sessionId, seconds = SEVEN_DAYS) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${seconds}s`)
    .sign(getKey());
}

// Returns { sessionId } for a correctly signed, unexpired token, otherwise null.
export async function verifySessionToken(token) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });

    return typeof payload.sid === "string" && payload.sid
      ? { sessionId: payload.sid }
      : null;
  } catch {
    return null;
  }
}
