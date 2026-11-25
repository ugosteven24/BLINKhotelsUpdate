"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { queryOne, execute } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { audit, requireAdmin } from "@/lib/guard";
import { headers } from "next/headers";




// Every attempt (success or failure) is recorded for the Login Logs page.
async function logAttempt(email, userId, success) {
  try {
    const h = await headers();
    await execute(
      "INSERT INTO login_logs (user_id, email, success, ip_address, user_agent) VALUES (?,?,?,?,?)",
      [userId ?? null, String(email).slice(0, 191), success ? 1 : 0, (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 45) || null, (h.get("user-agent") ?? "").slice(0, 255) || null]
    );
  } catch (e) { console.error("login_logs insert failed", e.message); }
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function loginAction(_, fd) {
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const user = await queryOne(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.status, r.role_key
       FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.email = ?`,
    [parsed.data.email]
  );
  const ok = user?.password_hash && (await bcrypt.compare(parsed.data.password, user.password_hash));
  if (!user || !ok) { await logAttempt(parsed.data.email, user?.id, false); return { error: "Email or password is incorrect." }; }
  if (user.role_key !== "superadmin") { await logAttempt(user.email, user.id, false); return { error: "This account does not have admin access." }; }
  if (user.status !== "active") { await logAttempt(user.email, user.id, false); return { error: "This account is not active." }; }

  await execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  await createSession({
    userId: user.id,
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    role: user.role_key,
  });
  await logAttempt(user.email, user.id, true);
  await audit(user.id, "admin.login", "user", user.id);
  redirect("/admin");
}

export async function logoutAction() {
  const s = await requireAdmin();
  await audit(s.userId, "admin.logout", "user", s.userId);
  await destroySession();
  redirect("/admin/login");
}

const profileSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: z.string().max(30).optional().or(z.literal("")),
});

export async function getMyProfile() {
  const s = await requireAdmin();
  return queryOne(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.profile_image, u.last_login_at, u.created_at, r.role_name
       FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [s.userId]
  );
}

export async function updateProfileAction(_, fd) {
  const s = await requireAdmin();
  const p = profileSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Check your name and phone number." };
  try {
    await execute("UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?", [
      p.data.first_name,
      p.data.last_name,
      p.data.phone || null,
      s.userId,
    ]);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return { error: "That phone number is already in use." };
    throw e;
  }
  await audit(s.userId, "admin.profile_updated", "user", s.userId, null, p.data);
  return { success: "Profile saved." };
}

const pwSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8, "Use at least 8 characters."),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "The new passwords don't match.",
    path: ["confirm_password"],
  });

export async function changePasswordAction(_, fd) {
  const s = await requireAdmin();
  const p = pwSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const row = await queryOne("SELECT password_hash FROM users WHERE id=?", [s.userId]);
  if (!row?.password_hash || !(await bcrypt.compare(p.data.current_password, row.password_hash)))
    return { error: "Your current password is incorrect." };
  await execute("UPDATE users SET password_hash=? WHERE id=?", [
    await bcrypt.hash(p.data.new_password, 12),
    s.userId,
  ]);
  await audit(s.userId, "admin.password_changed", "user", s.userId);
  return { success: "Password changed." };
}
