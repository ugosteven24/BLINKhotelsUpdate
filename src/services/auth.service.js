"use server";

// Authentication Server Actions: registration, login, admin login, logout,
// current user and password reset. Every export here is a public endpoint the
// browser can call, so each function validates its own input, and the role is
// NEVER taken from the caller: new accounts are always "client".

import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { query, run, withTransaction, isDuplicateEntry } from "@/lib/db/connection";
import {
  ADMIN_ROLES,
  ROLES,
  destroyCurrentSession,
  getRequestMeta,
  getSessionUser,
  insertSession,
  setSessionCookie,
} from "@/lib/auth/session";
import {
  cleanString,
  isAcceptablePassword,
  isValidEmail,
  normalizeEmail,
} from "@/lib/validation";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5; // per email, per window
const LOGIN_WINDOW_MINUTES = 15;
const RESET_TOKEN_MINUTES = 60;

const fail = (code, message) => ({ ok: false, code, message });

// Compared against when the email does not exist, so "unknown email" and
// "wrong password" take about the same time.
let dummyHashPromise;
function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash(randomBytes(16).toString("hex"), BCRYPT_ROUNDS);
  return dummyHashPromise;
}

async function logLogin({ userId = null, email, success }) {
  try {
    const meta = await getRequestMeta();
    await query(
      `INSERT INTO login_logs (user_id, email, success, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, email.slice(0, 255), success ? 1 : 0, meta.ip, meta.userAgent]
    );
  } catch (error) {
    console.error("login log failed:", error);
  }
}

async function tooManyFailures(email) {
  const rows = await query(
    `SELECT COUNT(*) AS failures
       FROM login_logs
      WHERE email = ? AND success = 0
        AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)`,
    [email, LOGIN_WINDOW_MINUTES]
  );
  return Number(rows[0]?.failures ?? 0) >= MAX_FAILED_LOGINS;
}

// ---------------------------------------------------------------------------
// REGISTER (public sign-up, always creates a "client")
// ---------------------------------------------------------------------------
export async function registerUser(input) {
  try {
    const firstName = cleanString(input?.firstName, 100);
    const lastName = cleanString(input?.lastName, 100);
    const email = normalizeEmail(input?.email);
    const password = input?.password;

    if (!firstName || !lastName || !email || !password) {
      return fail("invalid-input", "Please fill in all fields.");
    }
    if (!isValidEmail(email)) {
      return fail("invalid-email", "Please enter a valid email address.");
    }
    if (!isAcceptablePassword(password)) {
      return fail("weak-password", "Password must be at least 6 characters.");
    }
    if (input?.confirmPassword !== undefined && input.confirmPassword !== password) {
      return fail("invalid-input", "Passwords do not match.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = randomUUID();
    const fullName = `${firstName} ${lastName}`;

    const session = await withTransaction(async (connection) => {
      await run(
        connection,
        `INSERT INTO users (first_name, last_name, full_name, email, password_hash, role, userId)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [firstName, lastName, fullName, email, passwordHash, ROLES.CLIENT,userId]
      );
      return insertSession(connection, userId, true);
    });

    await setSessionCookie(session);

    return {
      ok: true,
      user: { id: userId, email, firstName, lastName, fullName, role: ROLES.CLIENT },
    };
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return fail("email-already-in-use", "An account already exists with this email.");
    }
    console.error("registerUser failed:", error);
    return fail("server-error", "Something went wrong. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// LOGIN (shared by the client login page and the admin login page)
// ---------------------------------------------------------------------------
async function authenticate({ email: rawEmail, password, remember }, audience) {
  const email = normalizeEmail(rawEmail);

  if (!email || typeof password !== "string" || !password) {
    return fail("invalid-input", "Please enter your email and password.");
  }
  if (!isValidEmail(email)) {
    return fail("invalid-email", "Please enter a valid email address.");
  }
  if (await tooManyFailures(email)) {
    return fail("too-many-requests", "Too many attempts. Please wait and try again.");
  }

  const rows = await query(
    `SELECT id, password_hash, role_id, status FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  const user = rows[0];

  const hash = user?.password_hash || (await getDummyHash());
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || !user.password_hash || !passwordMatches) {
    await logLogin({ userId: user?.id ?? null, email, success: false });
    return fail("invalid-credential", "Invalid email or password.");
  }

  if (user.status !== "active") {
    await logLogin({ userId: user.id, email, success: false });
    return fail("user-disabled", "This account has been disabled.");
  }

  // Admin portal: the role is checked here on the server, after the password.
  if (audience === "admin" && !ADMIN_ROLES.includes(user.role)) {
    await logLogin({ userId: user.id, email, success: false });
    return fail("invalid-credential", "Invalid email or password.");
  }

  const session = await withTransaction(async (connection) => {
    await run(connection, "UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [
      user.id,
    ]);
    return insertSession(connection, user.id, remember !== false);
  });

  await setSessionCookie(session);
  await logLogin({ userId: user.id, email, success: true });

  return { ok: true, role: user.role };
}

export async function loginUser(input) {
  try {
    return await authenticate(input ?? {}, "client");
  } catch (error) {
    console.error("loginUser failed:", error);
    return fail("server-error", "Unable to sign in. Please try again.");
  }
}

export async function adminLogin(input) {
  try {
    return await authenticate({ ...(input ?? {}), remember: false }, "admin");
  } catch (error) {
    console.error("adminLogin failed:", error);
    return fail("server-error", "Login failed.");
  }
}

// ---------------------------------------------------------------------------
// LOGOUT / CURRENT USER
// ---------------------------------------------------------------------------
export async function logout() {
  try {
    await destroyCurrentSession();
    return { ok: true };
  } catch (error) {
    console.error("logout failed:", error);
    return fail("server-error", "Unable to sign out.");
  }
}

// Safe, serialisable user for client components, or null when signed out.
export async function getCurrentUser() {
  return getSessionUser();
}

// ---------------------------------------------------------------------------
// PASSWORD RESET
// ---------------------------------------------------------------------------
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

// Always answers the same way so account existence is not revealed.
export async function requestPasswordReset(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return fail("invalid-email", "Please enter a valid email address.");
  }

  try {
    const rows = await query(
      "SELECT id FROM users WHERE email = ? AND status = 'active' AND password_hash IS NOT NULL LIMIT 1",
      [email]
    );

    if (rows[0]) {
      const token = randomBytes(32).toString("hex");

      await withTransaction(async (connection) => {
        await run(
          connection,
          "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
          [rows[0].id]
        );
        await run(
          connection,
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
          [rows[0].id, sha256(token), RESET_TOKEN_MINUTES]
        );
      });

      // TODO(email): no mail transport is configured in this project yet.
      // Replace this with an SMTP/provider call that emails `link`.
      const base = process.env.APP_URL || "http://localhost:3000";
      const link = `${base}/reset-password?token=${token}`;
      if (process.env.NODE_ENV !== "production") {
        console.log(`[password reset] ${email}: ${link}`);
      } else {
        console.error("Password reset requested but no email transport is configured.");
      }
    }
  } catch (error) {
    console.error("requestPasswordReset failed:", error);
  }

  return { ok: true };
}

export async function resetPassword({ token, password } = {}) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return fail("invalid-token", "This reset link is invalid or has expired.");
  }
  if (!isAcceptablePassword(password)) {
    return fail("weak-password", "Password must be at least 6 characters.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const done = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id, user_id FROM password_reset_tokens
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
          FOR UPDATE`,
        [sha256(token)]
      );
      if (!rows[0]) return false;

      await run(connection, "UPDATE users SET password_hash = ? WHERE id = ?", [
        passwordHash,
        rows[0].user_id,
      ]);
      await run(connection, "UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?", [
        rows[0].id,
      ]);
      // Sign the account out everywhere.
      await run(connection, "DELETE FROM sessions WHERE user_id = ?", [rows[0].user_id]);
      return true;
    });

    return done
      ? { ok: true }
      : fail("invalid-token", "This reset link is invalid or has expired.");
  } catch (error) {
    console.error("resetPassword failed:", error);
    return fail("server-error", "Unable to reset password.");
  }
}
